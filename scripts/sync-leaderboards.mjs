import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

const ENDPOINT = 'https://vps.kodub.com/v6/leaderboard';
const HEX = /^[a-f0-9]{64}$/;
export async function collectTracks(root) {
  const [bundle, catalog] = await Promise.all([
    readFile(path.join(root, 'main.bundle.js'), 'utf8'),
    readFile(path.join(root, 'extra-tracks/catalog.json'), 'utf8').then(JSON.parse)
  ]);
  const tracks = new Map();
  const native = /\{id:"([a-f0-9]{64})",(?:group:"[^"]+",)?trackMetadata:\{name:"((?:\\.|[^"\\])*)"[^}]*\},environment:[^,]+,trackUrl:"(tracks\/(official|community)\/[^"\s]+)"/g;
  for (const match of bundle.matchAll(native)) tracks.set(match[1], {
    trackId: match[1], name: JSON.parse('"' + match[2] + '"'), category: match[4], onlyVerified: true
  });
  if (!tracks.size) throw Error('No native official/community tracks found');
  if (!Array.isArray(catalog)) throw Error('Invalid extra-track catalog');
  for (const entry of catalog) {
    if (!HEX.test(entry?.trackId || '') || typeof entry.name !== 'string') throw Error('Invalid catalog track identity');
    if (!tracks.has(entry.trackId)) tracks.set(entry.trackId, { trackId: entry.trackId, name: entry.name, category: 'extra', onlyVerified: false });
  }
  try {
    const weekly = JSON.parse(await readFile(path.join(root,'weekly/current.json'),'utf8'))?.current;
    if (weekly && HEX.test(weekly.trackId || '') && typeof weekly.name === 'string' && !tracks.has(weekly.trackId)) {
      tracks.set(weekly.trackId,{trackId:weekly.trackId,name:weekly.name,category:'weekly',onlyVerified:false});
    }
  } catch { /* Weekly capture is optional when creating an initial snapshot. */ }
  return [...tracks.values()];
}
export function snapshotEntries(value) {
  if (!value || !Number.isSafeInteger(value.total) || value.total < 0 || !Array.isArray(value.entries) || value.entries.length > 100) throw Error('Invalid official leaderboard');
  const entries = value.entries.map((entry, index) => {
    if (!entry || typeof entry.nickname !== 'string' || entry.nickname.length > 200 ||
        !Number.isSafeInteger(entry.frames) || entry.frames <= 0 || entry.frames > 86400000 ||
        !(entry.countryCode === null || typeof entry.countryCode === 'string' && /^[a-zA-Z]{2}$/.test(entry.countryCode))) throw Error('Invalid public leaderboard row');
    return { rank: index + 1, nickname: entry.nickname, timeMs: entry.frames, countryCode: entry.countryCode?.toLowerCase() ?? null };
  });
  if (entries.some((entry, index) => index > 0 && entry.timeMs < entries[index - 1].timeMs)) throw Error('Official leaderboard is not ordered by time');
  if (entries.length > value.total) throw Error('Invalid public leaderboard total');
  return { total: value.total, entries };
}
async function download(fetchImpl, track) {
  const url = new URL(ENDPOINT);
  for (const [key, value] of Object.entries({version:'0.6.3',trackId:track.trackId,skip:'0',amount:'100',onlyVerified:String(track.onlyVerified)})) url.searchParams.set(key,value);
  const response = await fetchImpl(url.href, {method:'GET',redirect:'error',credentials:'omit',
    headers:{Accept:'application/json',Origin:'https://app-polytrack.kodub.com',Referer:'https://app-polytrack.kodub.com/'},signal:AbortSignal.timeout(20000)});
  if (!response.ok || response.redirected || response.url && response.url !== url.href) throw Error('Official leaderboard download failed: ' + response.status);
  if (!(response.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) throw Error('Official leaderboard is not JSON');
  const limit = 1024 * 1024;
  if (Number(response.headers.get('content-length')) > limit) throw Error('Official leaderboard exceeds size limit');
  const reader = response.body?.getReader(); if (!reader) throw Error('Official leaderboard is empty');
  const chunks=[];let length=0;
  try { for (;;) { const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>limit){await reader.cancel();throw Error('Official leaderboard exceeds size limit');}chunks.push(Buffer.from(value)); } }
  finally { reader.releaseLock(); }
  return snapshotEntries(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
async function atomicJson(filename, value) {
  const temporary = filename + '.' + randomUUID() + '.tmp';
  try { await writeFile(temporary,JSON.stringify(value,null,2)+'\n');await rename(temporary,filename); }
  finally { await rm(temporary,{force:true}); }
}
/** Captures first 100 public rows. Tokens, user IDs, record IDs, recordings and car styles are discarded. */
export async function syncLeaderboards({fetchImpl=fetch,root=fileURLToPath(new URL('../',import.meta.url)),now=Date.now(),tracks,delayMs=100,concurrency=2}={}) {
  const requested = tracks || await collectTracks(root);
  if (!Array.isArray(requested) || !requested.length || requested.some(track=>!HEX.test(track?.trackId||'') || typeof track.name!=='string' || typeof track.onlyVerified!=='boolean')) throw Error('Invalid snapshot track list');
  const capturedAt = new Date(typeof now==='function'?now():now).toISOString();
  const destination=path.resolve(root,'snapshots/leaderboards');await mkdir(destination,{recursive:true});
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 3) throw Error('Snapshot concurrency must be between 1 and 3');
  const successful=[],failed=[],indexRows=[];
  const capture = async track => {
    try {
      const snapshot=await download(fetchImpl,track);
      await atomicJson(path.join(destination,track.trackId+'.json'),{schemaVersion:1,source:'Kodub public leaderboard',physics:'stock',version:'0.6.3',capturedAt,
        trackId:track.trackId,trackName:track.name,onlyVerified:track.onlyVerified,...snapshot});
      successful.push(track.trackId);
      indexRows.push({trackId:track.trackId,name:track.name,category:track.category || 'extra',status:snapshot.total ? 'available' : 'no-board',total:snapshot.total,path:track.trackId+'.json'});
    } catch(error) {
      failed.push({trackId:track.trackId,error:error.message});
      indexRows.push({trackId:track.trackId,name:track.name,category:track.category || 'extra',status:'failed'});
    }
  };
  for (let index=0;index<requested.length;index+=concurrency) {
    if(index && delayMs>0)await new Promise(resolve=>setTimeout(resolve,delayMs));
    await Promise.all(requested.slice(index,index+concurrency).map(capture));
  }
  const result={schemaVersion:1,capturedAt,physics:'stock',requested:requested.length,captured:successful.length,failed:failed.length,tracks:successful,failures:failed};
  await atomicJson(path.join(destination,'manifest.json'),result);
  await atomicJson(path.join(destination,'index.json'),{schemaVersion:1,capturedAt,physics:'stock',tracks:indexRows.sort((a,b)=>a.name.localeCompare(b.name))});
  return result;
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  syncLeaderboards().then(result=>{console.log(JSON.stringify({requested:result.requested,captured:result.captured,failed:result.failed}));if(result.failed)process.exitCode=1;})
    .catch(error=>{console.error('Public leaderboard capture failed: '+error.message);process.exitCode=1;});
}
