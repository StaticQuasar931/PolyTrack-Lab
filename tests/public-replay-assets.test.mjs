import assert from 'node:assert/strict';
import {readdir,readFile,stat} from 'node:fs/promises';
import {validateReplay} from '../scripts/sync-public-replays.mjs';
const root=new URL('../snapshots/',import.meta.url),directory=new URL('replays/',root);
const files=(await readdir(directory)).filter(name=>/^[a-f0-9]{64}\.json$/.test(name));
const allowed=new Set(['rank','nickname','timeMs','countryCode','recordingId','status','recording','frames','verifiedState','carStyle','error']);
let playable=0,unavailable=0;
for(const name of files){
  const file=new URL(name,directory);assert((await stat(file)).size<20000000,name+' below20MB');
  const capture=JSON.parse(await readFile(file,'utf8')),board=JSON.parse(await readFile(new URL('leaderboards/'+name,root),'utf8'));
  assert.equal(capture.physics,'stock');assert.equal(capture.trackId,name.slice(0,-5));assert(capture.entries.length<=100);
  assert.equal(capture.entries.length,board.entries.length,name+' displayed result count');
  for(const [index,row] of capture.entries.entries()){
    assert.equal(row.rank,index+1);assert.equal(row.nickname,board.entries[index].nickname);assert.equal(row.timeMs,board.entries[index].timeMs);assert.equal(row.countryCode,board.entries[index].countryCode);
    for(const field of Object.keys(row))assert(allowed.has(field),'Unexpected public replay field: '+field);
    if(row.status==='available'){validateReplay(row,row.timeMs);playable++;}else{assert(['missing','unavailable'].includes(row.status));assert(!row.recording,'Unavailable result has no fabricated recording');unavailable++;}
  }
}
console.log(`PASS: ${files.length} bundled replay boards match displayed results; ${playable} native recordings/car styles validated, ${unavailable} unavailable.`);
