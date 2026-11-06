import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {validateReplay,readPublicJson,downloadPublicBoard,syncPublicReplays} from '../scripts/sync-public-replays.mjs';
const trackId='a'.repeat(64);
const carStyle=Buffer.alloc(16).toString('base64url');
const recording=deflateSync(Buffer.alloc(15)).toString('base64url');
const replay=frames=>({recording,frames,verifiedState:1,carStyle});
const row=index=>({id:500+index,nickname:'Public racer '+index,countryCode:null,frames:12000+index,userId:'DO-NOT-COPY-USER-ID',carStyle});
const tracks=[{trackId,name:'Public fixture',category:'official',onlyVerified:true}];
async function workspace(t){const root=await mkdtemp(path.join(tmpdir(),'polytrack-replays-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('validates native five-input compressed recording, exact time and 16-byte car style',()=>{
  assert.deepEqual(validateReplay(replay(12345),12345),replay(12345));
  assert.equal(validateReplay(null,12345),null);
  assert.throws(()=>validateReplay(replay(12345),54321),/Invalid/);
  assert.throws(()=>validateReplay({...replay(12345),recording:'not_compressed'},12345),/decompressed/);
  assert.throws(()=>validateReplay({...replay(12345),recording:deflateSync(Buffer.alloc(14)).toString('base64url')},12345),/truncated/);
  assert.throws(()=>validateReplay({...replay(12345),carStyle:Buffer.alloc(16,255).toString('base64url')},12345),/car style/);
});
test('downloads matching top100 recording IDs using batches of ten and publishes playback assets without private identities',async t=>{
  const root=await workspace(t),requests=[];
  const rows=Array.from({length:23},(_,index)=>row(index));
  const fetchImpl=async(url,options)=>{
    const parsed=new URL(url);requests.push(parsed);
    assert.equal(parsed.origin,'https://vps.kodub.com');
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.body,undefined);
    assert.equal(options.headers.Origin,'https://www.kodub.com');
    assert.equal(parsed.searchParams.has('userToken'),false);assert.equal(parsed.searchParams.has('userTokenHash'),false);
    if(parsed.pathname==='/v6/leaderboard'){assert.equal(parsed.searchParams.get('amount'),'100');return Response.json({total:1234,entries:rows,userEntry:{token:'DO-NOT-COPY-TOKEN'}});}
    assert.equal(parsed.pathname,'/v6/recordings');
    const ids=parsed.searchParams.get('ids').split(',').map(Number);assert.ok(ids.length<=10);
    return Response.json(ids.map(id=>id===506?null:replay(12000+id-500)));
  };
  const result=await syncPublicReplays({root,tracks,fetchImpl,delayMs:0,requestIntervalMs:0});
  assert.equal(result.playable,22);assert.equal(result.failed,0);assert.equal(requests.length,4);
  const asset=JSON.parse(await readFile(path.join(root,'snapshots/replays',trackId+'.json'),'utf8'));
  assert.equal(asset.entries.length,23);assert.equal(asset.entries[0].rank,1);assert.equal(asset.entries[0].recordingId,500);
  assert.equal(asset.entries[0].carStyle,carStyle);assert.equal(asset.entries[0].recording,recording);
  assert.equal(asset.entries[6].status,'missing');assert.equal(asset.entries[6].recording,undefined);
  assert.equal(JSON.stringify(asset).includes('DO-NOT-COPY'),false);
  const board=JSON.parse(await readFile(path.join(root,'snapshots/leaderboards',trackId+'.json'),'utf8'));
  assert.equal(board.entries[0].timeMs,asset.entries[0].frames);assert.equal(board.capturedAt,asset.capturedAt);
  assert.equal('recordingId' in board.entries[0],false);
});
test('invalid replay time leaves a prior complete asset intact and reports failure',async t=>{
  const root=await workspace(t),destination=path.join(root,'snapshots/replays');await mkdir(destination,{recursive:true});
  await writeFile(path.join(destination,trackId+'.json'),'previous complete asset');
  const fetchImpl=async url=>new URL(url).pathname.endsWith('/leaderboard')?Response.json({total:1,entries:[row(0)]}):Response.json([replay(999)]);
  const result=await syncPublicReplays({root,tracks,fetchImpl,delayMs:0,requestIntervalMs:0});
  assert.equal(result.failed,1);assert.equal(await readFile(path.join(destination,trackId+'.json'),'utf8'),'previous complete asset');
});
test('rejects wrong destinations, too-large response and unsupported batch sizes',async t=>{
  await assert.rejects(readPublicJson(()=>assert.fail('No network allowed'),new URL('https://example.org/v6/recordings')),/endpoint/);
  await assert.rejects(readPublicJson(async()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'20000000'}}),new URL('https://vps.kodub.com/v6/recordings'),{retries:1}),/file limit/);
  const root=await workspace(t);await assert.rejects(syncPublicReplays({root,tracks,batchSize:20,fetchImpl:()=>assert.fail('No network allowed')}),/limits/);
});
test('individual failed public probes remain explicitly unavailable without fabricated playback',async t=>{
  const root=await workspace(t);
  const fetchImpl=async url=>new URL(url).pathname.endsWith('/leaderboard')?Response.json({total:1,entries:[row(0)]}):new Response('',{status:404});
  const result=await syncPublicReplays({root,tracks,fetchImpl,delayMs:0,requestIntervalMs:0,batchSize:1,allowUnavailable:true,retryRounds:0});
  assert.equal(result.playable,0);assert.equal(result.unavailable,1);assert.equal(result.tracks[0].status,'partial');
  const asset=JSON.parse(await readFile(path.join(root,'snapshots/replays',trackId+'.json'),'utf8'));
  assert.equal(asset.entries[0].status,'unavailable');assert.equal(asset.entries[0].recording,undefined);assert.match(asset.entries[0].error,/404/);
});
test('resume validates and reuses complete files without downloading them again',async t=>{
  const root=await workspace(t);
  const fetchImpl=async url=>new URL(url).pathname.endsWith('/leaderboard')?Response.json({total:1,entries:[row(0)]}):Response.json([replay(12000)]);
  await syncPublicReplays({root,tracks,fetchImpl,delayMs:0,requestIntervalMs:0});
  const result=await syncPublicReplays({root,tracks,fetchImpl:()=>assert.fail('Complete public assets should not be downloaded again'),delayMs:0,requestIntervalMs:0,resume:true});
  assert.equal(result.playable,1);assert.equal(result.failed,0);
});
test('individual probes retain supported neighbors when one native car style is unsupported',async t=>{
  const root=await workspace(t),rows=[row(0),row(1)],requests=[];
  const fetchImpl=async url=>{
    const parsed=new URL(url);if(parsed.pathname.endsWith('/leaderboard'))return Response.json({total:2,entries:rows});
    const ids=parsed.searchParams.get('ids');requests.push(ids);
    return Response.json(ids.split(',').map(Number).map(id=>id===500?{...replay(12000),carStyle:Buffer.alloc(16,255).toString('base64url')}:replay(12001)));
  };
  const result=await syncPublicReplays({root,tracks,fetchImpl,delayMs:0,requestIntervalMs:0,batchSize:10,allowUnavailable:true,retryRounds:0});
  assert.deepEqual(requests,['500,501','500']);
  assert.equal(result.playable,1);assert.equal(result.unavailable,1);assert.equal(result.failed,0);
  const asset=JSON.parse(await readFile(path.join(root,'snapshots/replays',trackId+'.json'),'utf8'));
  assert.equal(asset.entries[0].status,'unavailable');assert.match(asset.entries[0].error,/car style/);assert.equal(asset.entries[0].recording,undefined);
  assert.equal(asset.entries[1].status,'available');assert.equal(asset.entries[1].recording,recording);
});
test('100-row HTTP503 falls back to contiguous 20-row pages with correct ranks',async()=>{
  const rows=Array.from({length:100},(_,index)=>row(index)),requests=[];
  const request=async url=>{
    const skip=Number(url.searchParams.get('skip')),amount=Number(url.searchParams.get('amount'));requests.push([skip,amount]);
    if(amount===100)throw Error('Public API HTTP 503');
    return {total:100,entries:rows.slice(skip,skip+amount)};
  };
  const result=await downloadPublicBoard(request,tracks[0]);
  assert.deepEqual(requests,[[0,100],[0,20],[20,20],[40,20],[60,20],[80,20]]);
  assert.equal(result.entries.length,100);assert.deepEqual(result.entries.map(entry=>entry.id),rows.map(entry=>entry.id));
});
test('failed aggregate request probes each affected ID while retaining working neighbors',async t=>{
  const root=await workspace(t),requests=[];
  const fetchImpl=async url=>{
    const parsed=new URL(url);if(parsed.pathname.endsWith('/leaderboard'))return Response.json({total:2,entries:[row(0),row(1)]});
    const ids=parsed.searchParams.get('ids');requests.push(ids);
    if(ids.includes(','))return new Response('',{status:400});
    return ids==='500'?new Response('',{status:404}):Response.json([replay(12001)]);
  };
  const result=await syncPublicReplays({root,tracks,fetchImpl,delayMs:0,requestIntervalMs:0,batchSize:10,allowUnavailable:true,retryRounds:0});
  assert.deepEqual(requests,['500,501','500','501']);assert.equal(result.playable,1);assert.equal(result.unavailable,1);
});
test('pagination detects shifted duplicate records instead of publishing incorrect ranks',async()=>{
  const rows=Array.from({length:100},(_,index)=>row(index));
  const request=async url=>{
    const skip=Number(url.searchParams.get('skip'));if(Number(url.searchParams.get('amount'))===100)throw Error('Public API HTTP 503');
    const entries=rows.slice(skip,skip+20).map(entry=>({...entry}));if(skip===20)entries[0].id=rows[0].id;
    return {total:100,entries};
  };
  await assert.rejects(downloadPublicBoard(request,tracks[0]),/changed during pagination/);
});
