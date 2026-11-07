import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
const physicsSource=fs.readFileSync(new URL('../lab-physics.js',import.meta.url),'utf8');
const apiSource=fs.readFileSync(new URL('../lab-api.js',import.meta.url),'utf8');
class MemoryStorage {
  data=new Map();get length(){return this.data.size;}key(index){return [...this.data.keys()][index]??null;}
  getItem(key){return this.data.get(String(key))??null;}setItem(key,value){this.data.set(String(key),String(value));}removeItem(key){this.data.delete(String(key));}
}
class Frames {constructor(numberOfFrames){this.numberOfFrames=numberOfFrames;}}
class Style {constructor(id='style'){this.id=id;}serialize(){return this.id;}static default(){return new Style();}static deserializeSafe(value){return new Style(value);}}
class Recording {constructor(id='recording'){this.id=id;}serialize(){return this.id;}static deserialize(value){return /^(recording|recording-[a-z]+)$/.test(value)?new Recording(value):null;}}
const trackId='a'.repeat(64);
function environment(storage=new MemoryStorage()) {
  let reloads=0,played=0,watched=0,raced=0,saved=0;
  const events=[],profile={token:'local-one',tokenHash:'hash-one',nickname:'Local player',carStyle:new Style()};
  const context={console,Date,URL,Math,crypto:webcrypto,localStorage:storage,Worker:class{postMessage(){}terminate(){}},
    location:{href:'https://lab.example/',origin:'https://lab.example',reload(){reloads++;}},
    document:{baseURI:'https://lab.example/',body:{dataset:{labScene:'menu'}},addEventListener(){}},
    addEventListener(){},dispatchEvent(event){events.push(event.type);},CustomEvent:class{constructor(type){this.type=type;}},
    fetch:async()=>({ok:true,json:async()=>({tracks:[]})})};
  context.window=context;vm.createContext(context);vm.runInContext(physicsSource,context);vm.runInContext(apiSource,context);
  const lab=context.PolyTrackLab;class Api{}lab.installApi(Api,{Frames,CarStyle:Style,Recording});
  lab.attachRuntime({getProfile:()=>profile,getCurrentProfile:()=>profile,getTrackName:()=> 'Fixture course',
    parseTrack:()=>({trackMetadata:{name:'Fixture course'},trackData:{getId:()=>trackId}}),
    saveTrack:()=>{saved++;return true;},playTrack:()=>{played++;},watchTrack:()=>{watched++;},raceTrack:()=>{raced++;}});
  return {lab,api:new Api(),profile,storage,events,stats:()=>({reloads,played,watched,raced,saved})};
}
const finish=(lab,timeMs,recording=new Recording(),carStyle=null)=>lab.captureRun({trackId,frames:new Frames(timeMs),recording,...(carStyle?{carStyle}:{})});
test('one experiment per physics setup across profiles retains normalized values, stable preset IDs and save IDs',()=>{
  const {lab,storage,profile}=environment();finish(lab,12000);
  const stock=lab.getTrackExperiments(trackId)[0];assert.equal(stock.presetId,0);assert.equal(stock.physicsValues.gravity,1);assert.ok(stock.setupHistoryId);assert.ok(stock.saveNumber>0);
  const arcade=lab.presets.find(preset=>preset.id==='arcade');lab.saveSettings(arcade.values);finish(lab,11000);
  const firstArcade=lab.getTrackExperiments(trackId)[0];assert.equal(firstArcade.presetId,1);assert.equal(firstArcade.physicsValues.acceleration,1.5);
  const setupId=firstArcade.setupHistoryId,saveNumber=firstArcade.saveNumber;
  profile.token='local-two';profile.tokenHash='hash-two';finish(lab,10000);
  const experiments=lab.getTrackExperiments(trackId);assert.equal(experiments.length,2);assert.equal(experiments[0].timeMs,10000);assert.equal(experiments[0].setupHistoryId,setupId);assert.equal(experiments[0].saveNumber,saveNumber);
  assert.equal(JSON.parse(storage.getItem('polytrack-lab:scores:'+lab.getPhysicsKey())).length,2);
  assert.equal(experiments[0].verification,'local');assert.equal(experiments[0].physicsValues.jump,0);
});
test('legacy fingerprints decode safely without rewriting or deleting original profile records',()=>{
  const {lab,storage}=environment();const drift=lab.presets.find(preset=>preset.id==='drift');lab.saveSettings(drift.values);const key=lab.getPhysicsKey();
  const legacy=[{id:123,trackId,user:'legacy-local',nickname:'Legacy player',frames:9000,date:'2026-11-05T00:00:00Z',recording:'recording',carStyle:'style'}];
  const original=JSON.stringify(legacy);storage.setItem('polytrack-lab:scores:'+key,original);lab.saveSettings(lab.getDefaults());
  const record=lab.getTrackExperiments(trackId)[0];assert.equal(record.presetId,2);assert.equal(record.physicsValues.grip,.4);assert.equal(record.physicsValues.gravity,1);assert.match(record.runId,/^legacy:/);
  assert.equal(storage.getItem('polytrack-lab:scores:'+key),original);
  storage.setItem('polytrack-lab:scores:unknown:1',original);
  const unknown=lab.getTrackExperiments(trackId).find(entry=>entry.physicsKey==='unknown:1');assert.equal(unknown.physicsValues,null);assert.equal(unknown.replayAvailable,false);assert.throws(()=>lab.restoreRunSettings(unknown),/no complete physics/);
});
test('local replay carries its own physics without replacing the active setup',()=>{
  const {lab,stats}=environment();lab.saveSettings(lab.presets.find(preset=>preset.id==='arcade').values);finish(lab,11000);const record=lab.getTrackExperiments(trackId)[0];
  lab.saveSettings(lab.getDefaults());const independent=lab.getLocalReplay(record);assert.equal(independent.recording.labPhysicsMode,'custom');assert.equal(independent.recording.labPhysicsValues.acceleration,1.5);assert.equal(lab.getPhysicsKey(),'stock');assert.equal(stats().reloads,0);
  lab.restoreRunSettings(record);assert.equal(stats().reloads,1);assert.equal(lab.getPhysicsKey(),record.physicsKey);
  const replay=lab.getLocalReplay(record);assert.ok(replay.recording instanceof Recording);assert.equal(replay.time.numberOfFrames,11000);assert.equal(replay.isSelf,true);
  lab.saveSettings(lab.presets.find(preset=>preset.id==='rocket').values);finish(lab,9000);const rocket=lab.getTrackExperiments(trackId)[0];assert.equal(rocket.presetId,3);assert.equal(rocket.replayAvailable,false);assert.throws(()=>lab.getLocalReplay(rocket),/extra controls/);
});
test('cross-setup resume finds a per-profile PB even when another profile wins that setup experiment',()=>{
  const {lab,profile}=environment();finish(lab,1200);const earlier=lab.getTrackExperiments(trackId)[0];
  profile.token='other-local-profile';profile.tokenHash='other-hash';finish(lab,1000);
  assert.notEqual(lab.getTrackExperiments(trackId)[0].runId,earlier.runId);
  lab.saveSettings(lab.presets.find(preset=>preset.id==='arcade').values);
  const stored=lab.getLocalRun(earlier.runId,trackId);assert.equal(stored.timeMs,1200);assert.equal(stored.isCurrentSetup,false);
  lab.restoreRunSettings(stored);assert.equal(lab.getLocalReplay(lab.getLocalRun(earlier.runId,trackId)).time.numberOfFrames,1200);
  assert.equal(lab.getLocalRun(earlier.runId,'b'.repeat(64)),null);
  assert.equal(lab.getLocalRun('missing-run',trackId),null);
});
test('recent compatible runs retain exact oldPB and slower recordings and car styles without replacing the newPB',()=>{
  const {lab,storage}=environment();finish(lab,1000,new Recording('recording-old'),new Style('style-old'));const old=lab.getTrackExperiments(trackId)[0];
  finish(lab,900,new Recording('recording-new'),new Style('style-new'));finish(lab,1100,new Recording('recording-slow'),new Style('style-slow'));
  assert.equal(lab.getTrackExperiments(trackId)[0].timeMs,900);
  const oldReplay=lab.getLocalReplay(old);assert.equal(oldReplay.time.numberOfFrames,1000);assert.equal(oldReplay.recording.id,'recording-old');assert.equal(oldReplay.carStyle.id,'style-old');
  const history=lab.getRunHistory({trackId});assert.equal(history.length,3);assert.equal(history[0].isPersonalBest,false);assert.equal(history[0].replayAvailable,true);assert.equal(history[2].replayAvailable,true);
  assert.equal(history.some(record=>'recording'in record||'carStyle'in record),false);
  const slower=lab.getLocalRun(history[0].runId,trackId),slowReplay=lab.getLocalReplay(slower);assert.equal(slowReplay.time.numberOfFrames,1100);assert.equal(slowReplay.recording.id,'recording-slow');assert.equal(slowReplay.carStyle.id,'style-slow');
  const reloaded=environment(storage).lab;const restored=reloaded.getLocalRun(old.runId,trackId);assert.equal(reloaded.getLocalReplay(restored).recording.id,'recording-old');
});
test('archive keeps200 metadata rows, prioritizes newest replays within1MiB, and leaves allPB recordings intact',()=>{
  const {lab,storage}=environment();finish(lab,900,new Recording('recording-best'),new Style('style-best'));const best=lab.getTrackExperiments(trackId)[0];
  const largeRecording=new Recording('recording-'+'x'.repeat(9000));for(let index=0;index<205;index++)finish(lab,2000+index,largeRecording);
  const history=lab.getRunHistory();assert.equal(history.length,200);assert.equal(lab.getRunHistory({limit:5}).length,5);assert.equal(history[0].replayAvailable,true);assert.equal(history.at(-1).replayAvailable,false);
  assert.equal(lab.getTrackExperiments(trackId)[0].timeMs,900);assert.equal(lab.getLocalReplay(best).recording.id,'recording-best');
  const raw=JSON.parse(storage.getItem('polytrack-lab:runs:v1'));const bytes=raw.reduce((total,record)=>total+2*((record.recording?.length||0)+(record.carStyle?.length||0)),0);assert.ok(bytes<=1024*1024);
  const agedOut=lab.getLocalRun(history.at(-1).runId,trackId);assert.equal(agedOut.timeMs,history.at(-1).timeMs);assert.equal(agedOut.replayAvailable,false);assert.throws(()=>lab.getLocalReplay(agedOut),/aged out/);
  lab.saveSettings(lab.presets.find(preset=>preset.id==='rocket').values);finish(lab,500);const rocketHistory=lab.getRunHistory({limit:1})[0];assert.equal(rocketHistory.replayAvailable,false);assert.equal(JSON.parse(storage.getItem('polytrack-lab:runs:v1'))[0].recording,undefined);
});
test('finish hook, native PB path and API callback capture a single run while slower finishes keep native best',async()=>{
  const {lab,api,profile}=environment();let saves=0;
  class Records{best=null;getRecord(){return this.best;}getRecordTime(){return this.best?.time??null;}async setRecord(slot,id,verified,frames,recording){saves++;this.best={time:frames};return api.submitLeaderboard(profile.token,profile.nickname,null,new Style(),id,verified,frames,recording);}}
  lab.installRecords(Records);const records=new Records();finish(lab,1000);await records.setRecord(0,trackId,false,new Frames(1000),new Recording());
  assert.equal(lab.getRunHistory().length,1);assert.equal(saves,1);
  finish(lab,1500);await records.setRecord(0,trackId,false,new Frames(1500),new Recording());assert.equal(lab.getRunHistory().length,2);assert.equal(saves,1);assert.equal(records.getRecordTime().numberOfFrames,1000);
});
test('runtime bridge validates course identity and keeps public ghosts Original alongside custom physics',()=>{
  const {lab,events,stats}=environment();assert.ok(events.includes('polytrack-lab-runtime-ready'));
  assert.throws(()=>lab.playTrackCode('PolyTrackFixture','b'.repeat(64)),/identity/);assert.equal(stats().played,0);lab.playTrackCode('PolyTrackFixture',trackId);assert.equal(stats().played,1);
  const replay=lab.decodePublicReplay({status:'available',recording:'recording',carStyle:'style',nickname:'Public racer',frames:1234});assert.equal(replay.isSelf,false);lab.watchTrackCode('PolyTrackFixture',[replay],trackId);assert.equal(stats().watched,1);
  lab.raceTrackCode('PolyTrackFixture',[replay,replay],trackId);assert.equal(stats().raced,1);
  assert.throws(()=>lab.raceTrackCode('PolyTrackFixture',Array(11).fill(replay),trackId),/10 valid/);
  assert.throws(()=>lab.raceTrackCode('PolyTrackFixture',[replay],'b'.repeat(64)),/identity/);assert.equal(stats().raced,1);
  lab.saveSettings({...lab.presets.find(preset=>preset.id==='arcade').values,carScale:.5,wheelRadius:1.7});const active=JSON.stringify(lab.getSettings());lab.watchTrackCode('PolyTrackFixture',[replay],trackId);lab.raceTrackCode('PolyTrackFixture',[replay],trackId);
  assert.equal(stats().watched,2);assert.equal(stats().raced,2);assert.equal(stats().reloads,0);assert.equal(JSON.stringify(lab.getSettings()),active);assert.equal(replay.recording.labPhysicsMode,'stock');assert.equal(replay.recording.labPhysicsValues.acceleration,1);assert.equal(replay.recording.labPhysicsValues.carScale,1);
  assert.throws(()=>lab.decodePublicReplay({status:'missing',recording:'recording',carStyle:'style',nickname:'Public racer',frames:1234}),/unavailable/);
});
