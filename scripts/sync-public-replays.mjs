import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {collectTracks,snapshotEntries} from './sync-leaderboards.mjs';

const ROOT='https://vps.kodub.com/v6/';
const HEX=/^[a-f0-9]{64}$/;
const MAX_FILE=19*1024*1024;
const HEADERS={Accept:'application/json',Origin:'https://www.kodub.com',Referer:'https://www.kodub.com/'};
export function validateReplay(value,expectedFrames) {
  if(value===null)return null;
  if(!value||typeof value.recording!=='string'||!/^[-_A-Za-z0-9]+$/.test(value.recording)||value.recording.length>16000||
    !Number.isSafeInteger(value.frames)||value.frames<=0||value.frames>5999999||value.frames!==expectedFrames||
    !Number.isSafeInteger(value.verifiedState)||value.verifiedState<0||typeof value.carStyle!=='string'||!/^[-_A-Za-z0-9]{22}$/.test(value.carStyle))throw Error('Invalid public replay');
  const style=Buffer.from(value.carStyle,'base64url');
  if(style.length!==16||style[0]!==0||style[1]>15||style[2]>11||style[3]>7)throw Error('Unsupported public car style');
  let inputs;
  try{inputs=inflateSync(Buffer.from(value.recording,'base64url'),{maxOutputLength:2*1024*1024});}catch{throw Error('Public replay cannot be decompressed');}
  let offset=0;
  for(let control=0;control<5;control++) {
    if(offset+3>inputs.length)throw Error('Public replay input header is truncated');
    const count=inputs.readUIntLE(offset,3);offset+=3;
    if(offset+count*3>inputs.length)throw Error('Public replay input events are truncated');
    let frame=0;
    for(let index=0;index<count;index++){frame+=inputs.readUIntLE(offset,3);offset+=3;if(frame>5999999)throw Error('Public replay input frame exceeds engine limit');}
  }
  if(offset!==inputs.length)throw Error('Unsupported public replay trailing input data');
  return {recording:value.recording,frames:value.frames,verifiedState:value.verifiedState,carStyle:value.carStyle};
}
export async function readPublicJson(fetchImpl,url,{limit=MAX_FILE,retries=4,delayMs=1000,schedule=async()=>{},onRateLimit=()=>{}}={}) {
  if(url.origin!=='https://vps.kodub.com'||!['/v6/leaderboard','/v6/recordings'].includes(url.pathname)||url.username||url.password)throw Error('Unapproved public API endpoint');
  let failure;
  for(let attempt=0;attempt<retries;attempt++) {
    try {
      await schedule();
      const response=await fetchImpl(url.href,{method:'GET',redirect:'error',credentials:'omit',headers:HEADERS,signal:AbortSignal.timeout(25000)});
      if(!response.ok||response.redirected||(response.url&&response.url!==url.href)){
        const error=Error('Public API HTTP '+response.status),retryAfter=response.headers.get('retry-after');
        const specified=retryAfter?(Number.isFinite(Number(retryAfter))?Number(retryAfter)*1000:Date.parse(retryAfter)-Date.now()):0;
        if(response.status===429||specified>0){error.rateLimitMs=Math.max(1000,specified||30000);onRateLimit(error.rateLimitMs);}
        await response.body?.cancel();throw error;
      }
      if(!(response.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))throw Error('Public API did not return JSON');
      if(Number(response.headers.get('content-length'))>limit)throw Error('Public API response exceeds file limit');
      const reader=response.body?.getReader();if(!reader)throw Error('Public API response is empty');
      let size=0;const chunks=[];
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('Public API response exceeds file limit');}chunks.push(Buffer.from(value));}}
      finally{reader.releaseLock();}
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch(error) {failure=error;if(/^Public API HTTP 4(?!29)/.test(error.message))break;if(attempt+1<retries&&(delayMs||error.rateLimitMs))await new Promise(resolve=>setTimeout(resolve,Math.max(error.rateLimitMs||0,Math.min(8000,delayMs*2**attempt))));}
  }
  throw failure;
}
async function atomicJson(filename,value) {
  const text=JSON.stringify(value)+'\n';if(Buffer.byteLength(text)>MAX_FILE)throw Error('Replay asset would exceed 19 MiB');
  const temporary=filename+'.'+randomUUID()+'.tmp';
  try{await writeFile(temporary,text);await rename(temporary,filename);}finally{await rm(temporary,{force:true});}
}
export async function downloadPublicBoard(request,track) {
  const urlFor=(skip,amount)=>{
    const url=new URL(ROOT+'leaderboard');
    for(const [key,value]of Object.entries({version:'0.6.3',trackId:track.trackId,skip:String(skip),amount:String(amount),onlyVerified:String(track.onlyVerified)}))url.searchParams.set(key,value);
    return url;
  };
  try {
    const full=await request(urlFor(0,100),{limit:1024*1024,retries:1});snapshotEntries(full);return full;
  } catch(error) {
    // Some official boards consistently return 503 for 100 rows while 20-row pages work.
    if(!/Public API HTTP 503/.test(error.message))throw error;
    const entries=[];let total=0;
    for(let skip=0;skip<100;skip+=20){
      const page=await request(urlFor(skip,20),{limit:1024*1024});snapshotEntries(page);
      if(page.entries.length>20)throw Error('Public leaderboard page exceeded its requested size');
      total=Math.max(total,page.total);entries.push(...page.entries);
      if(page.entries.length<20||entries.length>=page.total)break;
    }
    const merged={total,entries};snapshotEntries(merged);
    if(new Set(entries.map(row=>row.id)).size!==entries.length)throw Error('Public leaderboard changed during pagination; retry capture');
    return merged;
  }
}
/** Public snapshots only. No user tokens, user IDs, private profiles, or uploads. */
export async function syncPublicReplays({root=fileURLToPath(new URL('../',import.meta.url)),fetchImpl=fetch,tracks,concurrency=2,batchSize=10,delayMs=150,requestIntervalMs=1000,resume=false,retryRounds=1,allowUnavailable=false,onProgress=()=>{}}={}) {
  const requested=tracks||await collectTracks(root);
  if(!Array.isArray(requested)||!requested.length||requested.some(track=>!HEX.test(track?.trackId||'')||typeof track.name!=='string'||typeof track.onlyVerified!=='boolean'))throw Error('Invalid public replay track list');
  if(!Number.isInteger(concurrency)||concurrency<1||concurrency>3||!Number.isInteger(batchSize)||batchSize<1||batchSize>10)throw Error('Invalid public replay request limits');
  if(!Number.isFinite(requestIntervalMs)||requestIntervalMs<0||requestIntervalMs>60000||!Number.isInteger(retryRounds)||retryRounds<0||retryRounds>10)throw Error('Invalid public replay retry limits');
  const destination=path.join(root,'snapshots/replays'),boards=path.join(root,'snapshots/leaderboards');
  await mkdir(destination,{recursive:true});await mkdir(boards,{recursive:true});
  let requestGate=Promise.resolve(),nextRequest=0,blockedUntil=0;
  const schedule=()=>{
    const waiting=requestGate.then(async()=>{
      for(;;){const wait=Math.max(nextRequest,blockedUntil)-Date.now();if(wait<=0)break;await new Promise(resolve=>setTimeout(resolve,wait));}
      nextRequest=Date.now()+requestIntervalMs;
    });requestGate=waiting.catch(()=>{});return waiting;
  };
  const request=(url,options={})=>readPublicJson(fetchImpl,url,{...options,schedule,onRateLimit:milliseconds=>{blockedUntil=Math.max(blockedUntil,Date.now()+milliseconds);}});
  const results=[],replayCache=new Map();let completed=0;
  const resultFor=item=>{const index=results.findIndex(existing=>existing.trackId===item.trackId);if(index<0)results.push(item);else results[index]=item;};
  async function capture(track) {
    let errorStage='leaderboard';
    try {
      const filename=path.join(destination,track.trackId+'.json');
      if(resume)try{
        const bytes=await readFile(filename);if(bytes.length>MAX_FILE)throw Error('Cached replay asset too large');
        const cached=JSON.parse(bytes);
        if(cached.schemaVersion===1&&cached.trackId===track.trackId&&Array.isArray(cached.entries)&&cached.entries.length<=100){
          snapshotEntries({total:cached.total,entries:cached.entries.map(row=>({nickname:row.nickname,frames:row.timeMs,countryCode:row.countryCode}))});
          for(const row of cached.entries)if(row.status==='available')replayCache.set(row.recordingId,validateReplay(row,row.timeMs));
          if(cached.entries.every(row=>['available','missing'].includes(row.status))){
            resultFor({trackId:track.trackId,name:track.name,path:track.trackId+'.json',status:cached.entries.length?'available':'no-board',entries:cached.entries.length,playable:cached.entries.filter(row=>row.recording).length,missing:cached.entries.filter(row=>row.status==='missing').length,unavailable:0,capturedAt:cached.capturedAt});return;
          }
        }
      }catch{}
      const raw=await downloadPublicBoard(request,track);
      const board=snapshotEntries(raw),capturedAt=new Date().toISOString(),entries=[];
      if(raw.entries.some(row=>!Number.isSafeInteger(row.id)||row.id<=0))throw Error('Public recording ID is invalid');
      errorStage='recordings';
      const probeOne=async(row,unavailable)=>{
        try{
          const value=await request(new URL(ROOT+'recordings?version=0.6.3&ids='+row.id),{retries:2});
          if(!Array.isArray(value)||value.length!==1)throw Error('Public replay response does not match the requested ID');
          replayCache.set(row.id,validateReplay(value[0],row.frames));
        }catch(error){unavailable.set(row.id,error.message);}
      };
      for(let start=0;start<raw.entries.length;start+=batchSize) {
        const batch=raw.entries.slice(start,start+batchSize),needed=batch.filter(row=>!replayCache.has(row.id)),unavailable=new Map();
        if(needed.length){
          // Match the native wire format, with literal comma-separated public IDs.
          const recordingsUrl=new URL(ROOT+'recordings?version=0.6.3&ids='+needed.map(row=>row.id).join(','));
          let fetched,batchError;
          try{fetched=await request(recordingsUrl,allowUnavailable?{retries:2}:{});}
          catch(error){if(!allowUnavailable)throw error;batchError=error;}
          if(!batchError&&(!Array.isArray(fetched)||fetched.length!==needed.length))batchError=Error('Public replay response does not match requested IDs');
          if(batchError){
            if(!allowUnavailable)throw batchError;
            if(needed.length===1)unavailable.set(needed[0].id,batchError.message);
            else for(const row of needed)await probeOne(row,unavailable);
          }else for(let index=0;index<needed.length;index++){
            const row=needed[index];
            try{replayCache.set(row.id,validateReplay(fetched[index],row.frames));}
            catch(error){
              if(!allowUnavailable)throw error;
              // A bad batch row is confirmed by a separate per-ID request before it is unavailable.
              if(needed.length===1)unavailable.set(row.id,error.message);else await probeOne(row,unavailable);
            }
          }
        }
        const data=batch.map(row=>replayCache.get(row.id));
        for(let index=0;index<batch.length;index++) {
          const rank=start+index+1;
          if(unavailable.has(batch[index].id)){entries.push({...board.entries[rank-1],recordingId:batch[index].id,status:'unavailable',error:unavailable.get(batch[index].id)});continue;}
          const replay=validateReplay(data[index],batch[index].frames);
          entries.push({...board.entries[rank-1],recordingId:batch[index].id,status:replay?'available':'missing',...(replay||{})});
        }
        if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));
      }
      const capture={schemaVersion:1,source:'Kodub public replays',version:'0.6.3',physics:'stock',capturedAt,trackId:track.trackId,trackName:track.name,onlyVerified:track.onlyVerified,total:board.total,entries};
      await atomicJson(filename,capture);
      // Keep visible ranks/times aligned with the exact leaderboard that supplied these replay IDs.
      await atomicJson(path.join(boards,track.trackId+'.json'),{schemaVersion:1,source:'Kodub public leaderboard',version:'0.6.3',physics:'stock',capturedAt,trackId:track.trackId,trackName:track.name,onlyVerified:track.onlyVerified,...board});
      resultFor({trackId:track.trackId,name:track.name,path:track.trackId+'.json',status:entries.some(row=>row.status==='unavailable')?'partial':entries.length?'available':'no-board',entries:entries.length,playable:entries.filter(row=>row.recording).length,unavailable:entries.filter(row=>row.status==='unavailable').length,missing:entries.filter(row=>row.status==='missing').length,capturedAt});
    } catch(error) {resultFor({trackId:track.trackId,name:track.name,status:'failed',error:error.message,errorStage});console.error('Replay capture failed '+track.name+' ['+errorStage+']: '+error.message);}
    finally{completed++;onProgress({completed:Math.min(completed,requested.length),attempts:completed,requested:requested.length,playable:results.reduce((sum,item)=>sum+(item.playable||0),0),failed:results.filter(item=>item.status==='failed').length});}
  }
  for(let index=0;index<requested.length;index+=concurrency){await Promise.all(requested.slice(index,index+concurrency).map(capture));if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));}
  for(let round=0;round<retryRounds;round++) {
    const failed=results.filter(item=>item.status==='failed'&&/HTTP (?:429|5\d\d)|fetch failed|timed out|timeout|aborted|changed during pagination/i.test(item.error||''));
    if(!failed.length)break;
    if(delayMs)await new Promise(resolve=>setTimeout(resolve,4000*2**round));
    for(const item of failed){await capture(requested.find(track=>track.trackId===item.trackId));if(delayMs)await new Promise(resolve=>setTimeout(resolve,delayMs));}
  }
  const manifest={schemaVersion:1,source:'Kodub public replays',version:'0.6.3',physics:'stock',capturedAt:new Date().toISOString(),requested:requested.length,captured:results.filter(item=>item.status!=='failed').length,failed:results.filter(item=>item.status==='failed').length,playable:results.reduce((sum,item)=>sum+(item.playable||0),0),unavailable:results.reduce((sum,item)=>sum+(item.unavailable||0),0),missing:results.reduce((sum,item)=>sum+(item.missing||0),0),tracks:results};
  await atomicJson(path.join(destination,'manifest.json'),manifest);return manifest;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  syncPublicReplays({resume:process.argv.includes('--resume'),onProgress:state=>{if(state.attempts%10===0)console.log(JSON.stringify(state));}})
    .then(result=>{console.log(JSON.stringify({requested:result.requested,captured:result.captured,failed:result.failed,playable:result.playable}));if(result.failed)process.exitCode=1;})
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
