import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../lab-api.js', import.meta.url), 'utf8');
class Frames { constructor(numberOfFrames) { this.numberOfFrames = numberOfFrames; } }
class Style { serialize() { return 'style'; } static deserializeSafe() { return new Style(); } static default() { return new Style(); } }
class Recording { serialize() { return 'recording'; } static deserialize() { return new Recording(); } }
const data = new Map();
let writeError = false, mode = 'default', calls = [], currentProfile = {token:'local-one',tokenHash:'hash-one',nickname:'Player one',carStyle:new Style()};
let weekly = { serverTime: new Date().toISOString(), current: {trackId:'a'.repeat(64),name:'Weekly fixture',author:'Fixture',lastModified:null,environment:0,endTime:new Date(Date.now()+86400000).toISOString(),trackUrl:'assets/'+'b'.repeat(64)+'.track',thumbnailUrl:'assets/'+'c'.repeat(64)+'.webp',coverUrl:null} };
let publicSnapshot = { trackId:'a'.repeat(64),physics:'stock',capturedAt:new Date().toISOString(),total:1,entries:[{rank:1,nickname:'Public racer',timeMs:1000,countryCode:'us'}] };
function environment() {
  const context = {console, Date, URL, AbortSignal, CustomEvent:class {constructor(name){this.type=name;}},location:{origin:'https://lab.example'},document:{baseURI:'https://lab.example/game/'},localStorage:{getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(writeError)throw Error('quota');data.set(key,value);}},fetch:async(url,options)=>{
    calls.push({url:String(url),options});
    if(String(url).startsWith('https://vps.kodub.com')) throw Error('fixture network outage');
    if(url==='weekly/current.json') return {ok:true,json:async()=>structuredClone(weekly)};
    if(url==='extra-tracks/catalog.json')return {ok:true,json:async()=>[]};
    if(url==='snapshots/leaderboards/index.json')return {ok:true,json:async()=>({tracks:[{trackId:'a'.repeat(64),name:'Named official track'}]})};
    if(String(url).startsWith('snapshots/leaderboards/'))return {ok:true,json:async()=>structuredClone(publicSnapshot)};
    if(String(url).includes('/weekly/assets/'))return {ok:true,text:async()=> 'PolyTrackFixture'};
    throw Error('Unexpected request');
  }};
  context.window = context; context.dispatchEvent=()=>{}; vm.createContext(context); vm.runInContext(source,context);
  const lab=context.PolyTrackLab; lab.getPhysicsKey=()=>mode;
  class Api {} lab.installApi(Api,{Frames,CarStyle:Style,Recording});
  lab.attachRuntime({getProfile:()=>currentProfile,getCurrentProfile:()=>currentProfile,getTrackName:()=> 'Test track'});
  return {lab,api:new Api()};
}
let {lab,api}=environment();
const finish = (frames=12345) => api.submitLeaderboard(currentProfile.token,currentProfile.nickname,null,new Style(),'track-one',false,new Frames(frames),new Recording());
await finish();
assert.equal(lab.getLocalTimes()[0].timeMs,12345);
assert.equal((await api.getLeaderboard('hash-one','track-one')).entries[0].isSelf,true);
const nativeShape=await api.getLeaderboard('hash-one','track-one');
assert.deepEqual(Object.keys(nativeShape.entries[0]).sort(),['id','nickname','countryCode','frames','time','carStyle','verifiedState','isSelf'].sort());
assert.ok(nativeShape.entries[0].frames instanceof Frames);assert.ok(nativeShape.entries[0].time instanceof Date);assert.ok(nativeShape.entries[0].carStyle instanceof Style);
assert.equal(nativeShape.userEntry.position,1);assert.equal(Math.floor((nativeShape.userEntry.position-1)/20),0);
assert.equal(lab.currentLeaderboardTrackId,'track-one');
assert.equal((await api.getLeaderboard('someone-else','track-one')).userEntry,null);
assert.equal((await api.getRecordings([lab.getLocalTimes()[0].id]))[0].time.numberOfFrames,12345);
await finish(13000); assert.equal(lab.getLocalTimes()[0].timeMs,12345);
await finish(12000); assert.equal(lab.getLocalTimes()[0].timeMs,12000);
mode='custom'; assert.equal(lab.getLocalTimes().length,0); await finish(9000); assert.equal(lab.getLocalTimes()[0].timeMs,9000);
mode='default'; assert.equal(lab.getLocalTimes()[0].timeMs,12000);
({lab,api}=environment()); assert.equal(lab.getLocalTimes()[0].timeMs,12000);
currentProfile={...currentProfile,token:'local-two',tokenHash:'hash-two',nickname:'Player two'};
await finish(11000);
const board=await api.getLeaderboard('hash-one','track-one');
assert.equal(board.total,2); assert.equal(board.userEntry.position,2); assert.equal(board.entries[0].isSelf,false);
assert.equal((await api.getLeaderboardUserEntry('hash-one','track-one')).position,2);
assert.equal((await api.getLeaderboard('hash-one','track-one',1,1)).entries[0].nickname,'Player one');
mode='stock';const publicBoard=await lab.getPublicLeaderboard('a'.repeat(64));assert.equal(publicBoard.source,'snapshot');assert.equal(publicBoard.comparable,true);
assert.equal((await lab.getPublicLeaderboard('b'.repeat(64))).available,false,'New local courses should have a clear absent-snapshot result');
assert.equal(lab.getLocalTimes().length,0);mode='custom';assert.equal((await lab.getPublicLeaderboard('a'.repeat(64))).comparable,false);
publicSnapshot.entries[0].timeMs=-1;await assert.rejects(lab.getPublicLeaderboard('a'.repeat(64)),/Invalid leaderboard snapshot/);publicSnapshot.entries[0].timeMs=1000;
mode='default';
const fixedNow=Date.now; Date.now=()=>2000000000000;
mode='collision'; await finish(5000); const id1=lab.getLocalTimes()[0].id;
currentProfile={...currentProfile,token:'local-three',tokenHash:'hash-three'};await finish(5001);
assert.notEqual(id1,lab.getLocalTimes()[1].id); Date.now=fixedNow;
mode='corrupt';data.set('polytrack-lab:scores:corrupt','{}');assert.equal(lab.getLocalTimes().length,0);
let nativeCalls=0;class Records {
  constructor(){this.best=null;}
  getRecord(){return this.best;}
  getRecordTime(){return this.getRecord()?.time??null;}
  setRecord(slot,trackId,verified,frames){nativeCalls++;this.best={time:frames};return Promise.resolve('native');}
}
lab.installRecords(Records);writeError=true;
assert.equal(await new Records().setRecord(0,'track-two',false,new Frames(1000),new Recording()),'native');
assert.equal(nativeCalls,1);assert.match(lab.storageError,/quota/);writeError=false;
const boostRecords=new Records();
await boostRecords.setRecord(0,'boost-track',false,new Frames(1000),new Recording());
const beforeBoostCalls=nativeCalls;
lab.replayEnabled=()=>false;
assert.equal(boostRecords.getRecord(0,'boost-track'),null);
assert.equal(boostRecords.getRecordTime(0,'boost-track').numberOfFrames,1000);
assert.equal(await boostRecords.setRecord(0,'boost-track',false,new Frames(1500),new Recording()),null);
assert.equal(nativeCalls,beforeBoostCalls);
assert.equal(boostRecords.getRecordTime(0,'boost-track').numberOfFrames,1000);
const boostBest=lab.getLocalTimes().find(entry=>entry.trackId==='boost-track');
assert.equal(boostBest.timeMs,1000);
assert.equal((await api.getRecordings([boostBest.id]))[0],null);
lab.replayEnabled=()=>true;
assert.equal(boostRecords.getRecord(0,'boost-track').time.numberOfFrames,1000);
assert.ok((await api.getRecordings([boostBest.id]))[0]);
mode='default';calls=[];
const result=await api.getTrackOfTheWeek();assert.equal(lab.weeklyStatus.source,'bundled');
assert.ok(Math.abs(result.current.clientEndTime.getTime()-result.current.endTime.getTime())<20);
assert.match(result.current.trackUrl,/https:\/\/lab\.example\/game\/weekly\/assets\//);
assert.ok(calls.every(call=>(call.options?.method||'GET')==='GET'));
let weeklyLaunch=null;
lab.attachRuntime({parseTrack:()=>({trackMetadata:{name:'Weekly fixture'},trackData:{getId:()=>weekly.current.trackId}}),playTrack:(metadata,data)=>{weeklyLaunch={metadata,data};}});
await lab.playWeeklyTrack();assert.equal(weeklyLaunch.metadata.name,'Weekly fixture');
assert.ok((await lab.getWeeklyTrack()).capturedAt);
lab.attachRuntime({parseTrack:()=>({trackMetadata:{},trackData:{getId:()=> 'wrong'}}),playTrack:()=>assert.fail('Wrong weekly identity must not launch')});
await assert.rejects(lab.playWeeklyTrack(),/identity/);
weekly.current.endTime=new Date(Date.now()-1000).toISOString();
await assert.rejects(lab.getWeeklyTrack(true),/No current weekly/);
await assert.rejects(api.loadTrackCodeFromUrl('https://evil.example/private'),/not permitted/);
const bundleRoot=new URL('../',import.meta.url);
const actualCatalog=JSON.parse(fs.readFileSync(new URL('extra-tracks/catalog.json',bundleRoot),'utf8'));
assert.equal(actualCatalog.length,263);
for(const track of actualCatalog){
  assert.ok(fs.existsSync(new URL(track.trackPath,bundleRoot)),track.trackPath);
  if(track.thumbnailUrl)assert.ok(fs.existsSync(new URL(track.thumbnailUrl,bundleRoot)),track.thumbnailUrl);
}
const customEnv=environment(),entry=actualCatalog[0];
let launched=null,parsedText=null;
customEnv.lab.attachRuntime({parseTrack:code=>{parsedText=code;return {trackMetadata:{name:entry.name},trackData:{getId:()=>entry.trackId}};},playTrack:(metadata,data)=>{launched={metadata,data};}});
// Run a second context with a file-backed fetch to exercise catalog identity and native launch routing.
const realFetch=async(url)=>({ok:true,json:async()=>actualCatalog,text:async()=>fs.readFileSync(new URL(url,bundleRoot),'utf8')});
const sandbox={console,Date,URL,AbortSignal,CustomEvent:class{},document:{baseURI:'https://lab.example/'},location:{origin:'https://lab.example'},localStorage:{getItem:()=>null,setItem:()=>{}},fetch:realFetch,dispatchEvent:()=>{}};
sandbox.window=sandbox;vm.createContext(sandbox);vm.runInContext(source,sandbox);
const launchLab=sandbox.PolyTrackLab;
let saveCount=0;
launchLab.attachRuntime({parseTrack:code=>{parsedText=code;return {trackMetadata:{name:entry.name},trackData:{getId:()=>entry.trackId}};},saveTrack:()=>{saveCount++;return true;},playTrack:(metadata,data)=>{launched={metadata,data};}});
await launchLab.saveExtraTrack(entry);assert.equal(saveCount,1);assert.equal(launched,null);assert.equal(launchLab.isExtraTrackSaved(entry),true);
await launchLab.playExtraTrack(entry);assert.equal(launched.metadata.name,entry.name);assert.ok(parsedText.startsWith('PolyTrack'));
assert.equal(saveCount,2);
launchLab.attachRuntime({parseTrack:()=>({trackMetadata:{},trackData:{getId:()=> 'wrong'}}),playTrack:()=>assert.fail('Mismatched identity must not launch')});
await assert.rejects(launchLab.playExtraTrack(entry),/identity/);
console.log('PASS: local finish persistence, reload, profile separation, personal attribution, id collisions, corrupt storage, quota fallback, read-only weekly fallback and expiry.');
console.log('PASS: all 263 extra tracks and thumbnails present, launch routes parsed track, mismatched identity rejected.');


