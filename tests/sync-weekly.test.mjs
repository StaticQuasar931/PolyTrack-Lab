import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { syncWeekly } from '../scripts/sync-weekly.mjs';

const now = Date.parse('2026-11-06T12:00:00Z');
const rootUrl = 'https://vps.kodub.com/v6/trackOfTheWeek';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const code = Buffer.from('PolyTrack2' + 'A'.repeat(64));
const image = Buffer.from('RIFF0000WEBPfixture');
const trackHash = digest(code), imageHash = digest(image);
const metadata = () => ({serverTime:new Date(now).toISOString(),current:{trackId:'a'.repeat(64),name:'Fixture weekly',author:'Fixture author',lastModified:null,environment:3,
  endTime:'2026-11-08T20:00:00Z',trackUrl:`${rootUrl}/track/${trackHash}`,thumbnailUrl:`${rootUrl}/image/${imageHash}`,coverUrl:null}});
function fixture(value=metadata(), override) {
  const requests=[];
  const fetchImpl = async(url,options) => {
    requests.push({url,options});assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
    assert.ok(url.startsWith(rootUrl));assert.ok(!url.includes('leaderboard'));assert.ok(!('body' in options));
    if(override){const response=await override(url,options);if(response)return response;}
    if(url===rootUrl+'?version=0.6.3')return Response.json(value);
    if(url===`${rootUrl}/track/${trackHash}?version=0.6.3`)return new Response(code,{headers:{'content-type':'text/plain'}});
    if(url===`${rootUrl}/image/${imageHash}?version=0.6.3`)return new Response(image,{headers:{'content-type':'image/webp'}});
    throw Error('Unexpected fixture request '+url);
  };
  return {requests,fetchImpl};
}
async function workspace(t){
  const root=await mkdtemp(path.join(tmpdir(),'polytrack-lab-weekly-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(path.join(root,'weekly'));await writeFile(path.join(root,'weekly/current.json'),'previous capture');return root;
}
test('captures public metadata and validated content-addressed assets only',async t=>{
  const root=await workspace(t),input=metadata();input.current.playerSecret='must not copy';input.scores=['must not copy'];
  const {fetchImpl,requests}=fixture(input);
  const result=await syncWeekly({root,fetchImpl,now});assert.equal(result.updated,true);assert.equal(requests.length,3);
  const captured=JSON.parse(await readFile(path.join(root,'weekly/current.json'),'utf8'));
  assert.equal(captured.current.trackUrl,`assets/${trackHash}.track`);assert.equal(captured.current.environment,3);
  assert.equal(captured.current.thumbnailUrl,`assets/${imageHash}.webp`);
  assert.equal(captured.current.playerSecret,undefined);assert.equal(captured.scores,undefined);
  assert.deepEqual(await readFile(path.join(root,'weekly/assets',`${trackHash}.track`)),code);
  assert.deepEqual((await readdir(path.join(root,'weekly'))).sort(),['assets','current.json']);
  // Repeat capture tests replacement of already published assets and metadata.
  await syncWeekly({root,fetchImpl,now});
});
test('no current selection preserves the previous capture',async t=>{
  const root=await workspace(t),{fetchImpl,requests}=fixture({serverTime:new Date(now).toISOString(),current:null});
  assert.deepEqual(await syncWeekly({root,fetchImpl,now}),{updated:false,reason:'no-current'});
  assert.equal(await readFile(path.join(root,'weekly/current.json'),'utf8'),'previous capture');assert.equal(requests.length,1);
});
test('shared thumbnail and cover content publishes one immutable image',async t=>{
  const root=await workspace(t),value=metadata();value.current.coverUrl=value.current.thumbnailUrl;
  const {fetchImpl}=fixture(value);const result=await syncWeekly({root,fetchImpl,now});
  assert.equal(result.assets,2);const captured=JSON.parse(await readFile(path.join(root,'weekly/current.json'),'utf8'));
  assert.equal(captured.current.coverUrl,captured.current.thumbnailUrl);
});
test('failed final asset download publishes nothing',async t=>{
  const root=await workspace(t),{fetchImpl}=fixture(metadata(),url=>url.includes('/image/')?new Response('outage',{status:503}):null);
  await assert.rejects(syncWeekly({root,fetchImpl,now}),/download failed/);
  assert.equal(await readFile(path.join(root,'weekly/current.json'),'utf8'),'previous capture');
  assert.deepEqual(await readdir(path.join(root,'weekly')),['current.json']);
});
test('invalid track identity, foreign URLs and expired feed are rejected',async t=>{
  const root=await workspace(t);
  for(const change of [item=>{item.trackId='invalid';},item=>{item.trackUrl='https://evil.example/track/'+trackHash;},
    item=>{item.thumbnailUrl+= '?redirect=evil';},item=>{item.endTime=new Date(now-1).toISOString();},item=>{item.environment=99;}]){
    const value=metadata();change(value.current);const {fetchImpl}=fixture(value);await assert.rejects(syncWeekly({root,fetchImpl,now}));
  }
  assert.equal(await readFile(path.join(root,'weekly/current.json'),'utf8'),'previous capture');
});
test('redirects, wrong content types, invalid images, digest mismatch and oversized replies fail closed',async t=>{
  const root=await workspace(t);
  for(const response of [()=>new Response(null,{status:302,headers:{location:'https://evil.example'}}),
    ()=>new Response(code,{headers:{'content-type':'text/html'}}),
    ()=>new Response('PolyTrack2'+'B'.repeat(64),{headers:{'content-type':'text/plain'}}),
    ()=>new Response(code,{headers:{'content-type':'text/plain','content-length':'999999999'}})]){
    const {fetchImpl}=fixture(metadata(),url=>url.includes('/track/')?response():null);
    await assert.rejects(syncWeekly({root,fetchImpl,now}));
  }
  const {fetchImpl}=fixture(metadata(),url=>url.includes('/image/')?new Response('not webp',{headers:{'content-type':'image/webp'}}):null);
  await assert.rejects(syncWeekly({root,fetchImpl,now}),/WebP/);
  assert.equal(await readFile(path.join(root,'weekly/current.json'),'utf8'),'previous capture');
});
