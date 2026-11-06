import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { collectTracks, snapshotEntries, syncLeaderboards } from '../scripts/sync-leaderboards.mjs';
const first='a'.repeat(64),second='b'.repeat(64),third='c'.repeat(64),fourth='d'.repeat(64);
const tracks=[{trackId:first,name:'Official fixture',category:'official',onlyVerified:true},{trackId:second,name:'Empty extra',category:'extra',onlyVerified:false}];
const response={total:200,entries:[{id:123,userId:'discard-public-user-id',nickname:'Public racer',frames:12345,countryCode:'US',carStyle:'discard-style',time:'2026-11-05',verifiedState:1}],userEntry:{userToken:'discard-token'}};
async function workspace(t){const root=await mkdtemp(path.join(tmpdir(),'polytrack-lab-snapshot-test-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('public snapshot fields are exact and exclude identity, recording and profile data',()=>{
  const result=snapshotEntries(response);
  assert.deepEqual(result,{total:200,entries:[{rank:1,nickname:'Public racer',timeMs:12345,countryCode:'us'}]});
  assert.equal(JSON.stringify(result).includes('discard'),false);
});
test('collects native official and community groups, extra tracks and current weekly without duplicates',async t=>{
  const root=await workspace(t);await mkdir(path.join(root,'extra-tracks'));await mkdir(path.join(root,'weekly'));
  await writeFile(path.join(root,'main.bundle.js'),`[{id:"${first}",trackMetadata:{name:"Summer 1",author:"Kodub",lastModified:null},environment:Cl.A.Summer,trackUrl:"tracks/official/summer1.track"},{id:"${second}",group:"0.6.3",trackMetadata:{name:"Community fixture",author:null,lastModified:null},environment:Cl.A.Winter,trackUrl:"tracks/community/fixture.track"}]`);
  await writeFile(path.join(root,'extra-tracks/catalog.json'),JSON.stringify([{trackId:first,name:'Duplicate official'},{trackId:third,name:'Extra fixture'}]));
  await writeFile(path.join(root,'weekly/current.json'),JSON.stringify({current:{trackId:fourth,name:'Weekly fixture'}}));
  const list=await collectTracks(root);assert.equal(list.length,4);assert.equal(list[0].category,'official');assert.equal(list[1].category,'community');assert.equal(list[2].onlyVerified,false);assert.equal(list[3].category,'weekly');
});
test('downloads first100 with GET only and no token, distinguishes empty board and publishes coverage',async t=>{
  const root=await workspace(t),requests=[];
  const fetchImpl=async(url,options)=>{requests.push(url);const parsed=new URL(url);
    assert.equal(parsed.origin,'https://vps.kodub.com');assert.equal(parsed.pathname,'/v6/leaderboard');assert.equal(parsed.searchParams.get('amount'),'100');assert.equal(parsed.searchParams.get('skip'),'0');
    assert.deepEqual([...parsed.searchParams.keys()].sort(),['amount','onlyVerified','skip','trackId','version']);
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.body,undefined);assert.equal(options.headers.Origin,'https://app-polytrack.kodub.com');assert.equal(options.headers.Referer,'https://app-polytrack.kodub.com/');
    return Response.json(parsed.searchParams.get('trackId')===first?response:{total:0,entries:[]});
  };
  const result=await syncLeaderboards({root,tracks,fetchImpl,delayMs:0,now:Date.parse('2026-11-06T00:00:00Z')});
  assert.equal(result.captured,2);assert.equal(result.failed,0);assert.equal(requests.length,2);
  const item=JSON.parse(await readFile(path.join(root,'snapshots/leaderboards',first+'.json'),'utf8'));
  assert.equal(item.physics,'stock');assert.equal(item.onlyVerified,true);assert.equal(JSON.stringify(item).includes('discard'),false);
  const index=JSON.parse(await readFile(path.join(root,'snapshots/leaderboards/index.json'),'utf8'));
  assert.equal(index.tracks.find(track=>track.trackId===first).status,'available');assert.equal(index.tracks.find(track=>track.trackId===second).status,'no-board');
});
test('failed refresh preserves existing capture and marks failed coverage without fabricating rows',async t=>{
  const root=await workspace(t),directory=path.join(root,'snapshots/leaderboards');await mkdir(directory,{recursive:true});await writeFile(path.join(directory,first+'.json'),'previous capture');
  for(const invalidResponse of [()=>new Response('redirect',{status:302}),()=>new Response('not JSON',{headers:{'content-type':'text/html'}}),()=>Response.json({total:1,entries:[{nickname:'Invalid',frames:-1,countryCode:null}]}),()=>new Response('{}',{headers:{'content-type':'application/json','content-length':'999999999'}})]){
    const result=await syncLeaderboards({root,tracks:[tracks[0]],fetchImpl:async()=>invalidResponse(),delayMs:0});
    assert.equal(result.captured,0);assert.equal(result.failed,1);assert.equal(await readFile(path.join(directory,first+'.json'),'utf8'),'previous capture');
    const index=JSON.parse(await readFile(path.join(directory,'index.json'),'utf8'));assert.equal(index.tracks[0].status,'failed');
  }
});
test('invalid IDs, oversized lists, out-of-order times and country strings are rejected',async t=>{
  const root=await workspace(t);await assert.rejects(syncLeaderboards({root,tracks:[{...tracks[0],trackId:'../../bad'}],fetchImpl:()=>assert.fail('Must validate before fetch')}),/track list/);
  assert.throws(()=>snapshotEntries({total:200,entries:Array(101).fill(response.entries[0])}),/Invalid/);
  assert.throws(()=>snapshotEntries({total:2,entries:[response.entries[0],{...response.entries[0],frames:1}]}),/ordered/);
  assert.throws(()=>snapshotEntries({total:1,entries:[{...response.entries[0],countryCode:'<script>'}]}),/Invalid/);
});
