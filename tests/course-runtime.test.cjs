const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto}=require('node:crypto');
const root=path.resolve(__dirname,'..'),id='a'.repeat(64),otherId='b'.repeat(64);
const sessionKey='polytrack-lab.course-session.v1',pendingKey='polytrack-lab.course-launch.v1';
const plain=value=>JSON.parse(JSON.stringify(value));
class MemoryStorage{constructor(){this.data=new Map();}get length(){return this.data.size;}key(index){return [...this.data.keys()][index]??null;}getItem(key){return this.data.get(String(key))??null;}setItem(key,value){this.data.set(String(key),String(value));}removeItem(key){this.data.delete(String(key));}}
class Node{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.hidden=false;this.textContent='';}append(...children){this.children.push(...children);}setAttribute(){}addEventListener(){}querySelector(){return null;}}
function environment(localStorage=new MemoryStorage(),sessionStorage=new MemoryStorage()){
  const handlers=new Map(),domHandlers=new Map(),observers=[],frames=[],nativeWorkers=[],stats={reloads:0,played:0,saved:0,parseCalls:0},body=new Node('body'),ui=new Node('div');body.dataset.labScene='home';
  const on=(map,type,callback)=>{if(!map.has(type))map.set(type,[]);map.get(type).push(callback);};
  const context={console,Date,URL,Math,Uint8Array,Float32Array,TextEncoder,TextDecoder,btoa,atob,crypto:webcrypto,localStorage,sessionStorage,
    location:{href:'https://lab.example/PolyTrack-Lab/',origin:'https://lab.example',reload(){stats.reloads++;}},
    document:{baseURI:'https://lab.example/PolyTrack-Lab/',body,createElement:tag=>new Node(tag),getElementById:()=>ui,querySelector:selector=>selector.includes('.main-buttons-container')?ui:null,addEventListener:(type,callback)=>on(domHandlers,type,callback)},
    Worker:class{constructor(url){this.url=url;this.messages=[];nativeWorkers.push(this);}postMessage(message){this.messages.push(message);}terminate(){}},
    MutationObserver:class{constructor(callback){this.callback=callback;this.connected=false;observers.push(this);}observe(){this.connected=true;}disconnect(){this.connected=false;}},
    requestAnimationFrame:callback=>frames.push(callback),addEventListener:(type,callback)=>on(handlers,type,callback),
    dispatchEvent:event=>{for(const callback of handlers.get(event.type)||[])callback(event);},
    CustomEvent:class{constructor(type,init={}){this.type=type;this.detail=init.detail;}},fetch:async()=>({ok:true,json:async()=>({tracks:[]})})};
  context.window=context;context.globalThis=context;vm.createContext(context);
  for(const filename of ['lab-physics.js','lab-course-codec.js','lab-api.js','lab-course.js'])vm.runInContext(fs.readFileSync(path.join(root,filename),'utf8'),context,{filename});
  const lab=context.PolyTrackLab;
  class Frames{constructor(numberOfFrames){this.numberOfFrames=numberOfFrames;}}
  class Style{serialize(){return 'style';}static default(){return new Style();}static deserializeSafe(){return new Style();}}
  class Recording{serialize(){return 'recording';}static deserialize(){return new Recording();}}
  class Api{}lab.installApi(Api,{Frames,CarStyle:Style,Recording});
  class NativeTrack{static fromExportString(code){stats.parseCalls++;if(code==='PolyTrackFixture')return {trackMetadata:{name:'Native fixture',author:'Native author'},trackData:{getId:()=>id}};return null;}}
  lab.installCourseParser(NativeTrack);
  const profile={token:'local',tokenHash:'local-hash',nickname:'Local tester',carStyle:new Style()};
  lab.attachRuntime({parseTrack:code=>NativeTrack.fromExportString(code),saveTrack:()=>{stats.saved++;return true;},playTrack:()=>{stats.played++;},getCurrentProfile:()=>profile,getProfile:()=>profile,getScene:()=>null});
  for(const callback of domHandlers.get('DOMContentLoaded')||[])callback();
  return {context,lab,body,localStorage,sessionStorage,stats,NativeTrack,Frames,Recording,Style,nativeWorkers,
    note:body.children.find(node=>node.className==='lab-course-hud'),
    flush(){for(const observer of observers)if(observer.connected)observer.callback();while(frames.length)frames.shift()();},
    worker(){return new context.Worker('simulation_worker.bundle.js');}};
}
function car(){const position={x:100,y:0,z:100},resets=[],checkpoints=[];let started=false,nextCheckpoint=0;return {position,resets,checkpoints,getPosition:()=>position,hasStarted:()=>started,getNextCheckpointIndex:()=>nextCheckpoint,addResetCallback:callback=>resets.push(callback),addCheckpointCallback:callback=>checkpoints.push(callback),move(x,y,z){Object.assign(position,{x,y,z});},checkpoint(index){nextCheckpoint=index+1;for(const callback of checkpoints)callback(index);},reset(full=true){started=!full;for(const callback of resets)callback();}};}
const blueprint={code:'PolyTrackFixture',name:'Runtime experiment',author:'Fixture builder',physics:{acceleration:1,gravity:1},checkpoints:[{after:1,values:{gravity:.25}},{after:2,values:{acceleration:2,grip:.4}}],objects:[{type:'boost',x:0,y:0,z:0,size:10,strength:3},{type:'gravity',x:30,y:0,z:0,size:10,strength:.1},{type:'ring',x:0,y:0,z:20,size:5}]};
(async()=>{
  const first=environment();
  const native=first.NativeTrack.fromExportString('PolyTrackFixture');assert.equal(native.trackMetadata.name,'Native fixture');assert.equal(first.lab.getSavedCourse(id),null,'Native imports do not acquire Lab rules');
  assert.throws(()=>first.NativeTrack.fromExportString('PolyTrackLab1invalid'),/Lab|code|package|JSON|UTF|character|Unexpected|valid/i);
  const encoded=first.lab.encodeLabCourse(blueprint),row=first.lab.importCourseCode(encoded);assert.equal(row.trackId,id);assert.equal(row.name,blueprint.name);assert.match(row.ruleKey,/^lab1-/);assert.equal(first.lab.getSavedCourse(id).ruleKey,row.ruleKey);assert.equal(first.stats.saved,1);
  const imported=first.NativeTrack.fromExportString(encoded);assert.equal(imported.trackMetadata.name,blueprint.name);assert.equal(imported.trackMetadata.author,blueprint.author);
  assert.equal(first.lab.getActiveCourse(),null,'Import alone never changes active physics');assert.equal(first.lab.getPhysicsKey(),'stock');
  await first.lab.startCourse(id);assert.equal(first.stats.reloads,1);assert.equal(JSON.parse(first.sessionStorage.getItem(sessionKey)).ruleKey,row.ruleKey);assert.equal(JSON.parse(first.sessionStorage.getItem(pendingKey)).trackId,id);
  const live=environment(first.localStorage,first.sessionStorage);assert.equal(live.lab.getActiveCourse().trackId,id);assert.equal(live.lab.getPhysicsKey(),'stock~course:'+row.ruleKey);assert.equal(live.lab.replayEnabled(),false);assert.equal(live.lab.canReplay(),false);assert.ok(live.body.children.includes(live.note),'Course HUD waits for DOMContentLoaded before mounting');
  live.flush();assert.equal(live.stats.played,1,'The pending course resumes through the native parser only when home is ready');assert.equal(live.sessionStorage.getItem(pendingKey),null);
  const worker=live.worker(),workerUrl=new URL(worker.url);assert.equal(JSON.parse(decodeURIComponent(workerUrl.hash.slice(1)))._dynamicCourse,true);
  const driver=car(),savedBefore=JSON.stringify(live.lab.getSettings());live.lab.attachCoursePlayer(driver,id);
  live.lab.updateCourse(1/30);assert.equal(live.stats.reloads,0,'Attaching the player before native home transitions to game cannot exit the course');assert.equal(live.lab.getActiveCourse().trackId,id);assert.ok(live.sessionStorage.getItem(sessionKey));live.body.dataset.labScene='game';live.lab.updateCourse(1/30);
  const last=()=>worker.messages.filter(message=>message.labCourseSettings).at(-1)?.labCourseSettings;
  assert.equal(last().gravity,1);assert.equal(last().acceleration,1);driver.checkpoint(0);assert.equal(last().gravity,.25);driver.checkpoint(1);assert.equal(last().acceleration,2);assert.equal(last().grip,.4);
  driver.move(0,0,0);live.lab.updateCourse(1/30);assert.equal(last().acceleration,6,'A boost pad multiplies the current checkpoint power');
  driver.move(15,0,0);live.lab.updateCourse(1/30);assert.equal(last().acceleration,2,'Leaving a pad restores checkpoint power');
  driver.move(30,0,0);live.lab.updateCourse(1/30);assert.equal(last().gravity,.1);driver.move(15,0,0);live.lab.updateCourse(1/30);assert.equal(last().gravity,.25,'Leaving a gravity field restores checkpoint gravity');
  driver.move(0,0,25);live.lab.updateCourse(1/30);driver.move(0,0,15);live.lab.updateCourse(1/30);assert.match(live.note.textContent,/Rings 1\/1/,'A reused native position vector still detects a ring-plane crossing');
  driver.move(0,0,25);live.lab.updateCourse(1/30);assert.match(live.note.textContent,/Rings 1\/1/,'Crossing the same ring again never counts twice');
  assert.equal(JSON.stringify(live.lab.getSettings()),savedBefore,'Zones and checkpoint sections never overwrite saved settings');
  live.lab.captureRun({trackId:id,frames:new live.Frames(12345),recording:new live.Recording(),carStyle:new live.Style()});const experiment=live.lab.getTrackExperiments(id)[0];assert.equal(experiment.timeMs,12345);assert.equal(experiment.physicsKey,'stock~course:'+row.ruleKey);assert.equal(experiment.replayAvailable,false,'Course finishes do not advertise an incompatible native replay');assert.match(experiment.setupLabel,/Course rules/);
  driver.reset();assert.equal(last().gravity,1);assert.equal(last().acceleration,1);driver.move(100,0,100);live.lab.updateCourse(1/30);assert.match(live.note.textContent,/CP 0/);assert.match(live.note.textContent,/Rings 0\/1/,'Full restart clears ring and section progress');
  driver.checkpoint(0);driver.reset(false);assert.equal(last().gravity,.25,'Checkpoint respawn restores the reached checkpoint section');
  live.body.dataset.labScene='browse';live.lab.updateCourse(1/30);assert.equal(live.stats.reloads,1,'Leaving a played course refreshes native cached record state');assert.equal(live.sessionStorage.getItem(sessionKey),null);assert.equal(live.lab.getActiveCourse(),null);assert.equal(live.lab.getPhysicsKey(),'stock');assert.equal(live.lab.replayEnabled(),true);
  const normal=environment(live.localStorage,live.sessionStorage);assert.equal(normal.lab.getActiveCourse(),null);assert.equal(normal.lab.getPhysicsKey(),'stock');assert.equal(normal.lab.getTrackExperiments(id)[0].physicsKey,'stock~course:'+row.ruleKey,'The course PB remains isolated and readable after exit');
  const started=environment(first.localStorage,new MemoryStorage());await started.lab.startCourse(id);const switching=environment(started.localStorage,started.sessionStorage);switching.flush();const switchedWorker=switching.worker(),switchedDriver=car();switching.body.dataset.labScene='game';switching.lab.attachCoursePlayer(switchedDriver,id);switchedDriver.checkpoint(0);switching.lab.setCourseTrack(otherId);assert.equal(switching.sessionStorage.getItem(sessionKey),null);assert.equal(switching.lab.getActiveCourse(),null);assert.equal(switching.stats.reloads,1,'Switching directly from a course to a different track reloads native state');assert.equal(switchedWorker.messages.filter(message=>message.labCourseSettings).at(-1).labCourseSettings.gravity,1,'Base physics is restored before clearing the active-course guard');
  assert.deepEqual(plain(experiment.courseRules.checkpoints),plain(row.checkpoints),'PBs retain their exact course sections');
  assert.deepEqual(plain(normal.lab.getRunHistory({trackId:id})[0].courseRules.objects),plain(row.objects),'Run summaries retain their course objects');
  normal.lab.importCourseCode(normal.lab.encodeLabCourse({...blueprint,physics:{gravity:.5}}));
  normal.lab.trackActions={trackId:id,exportTrack:()=> 'PolyTrackFixture'};
  await normal.lab.restoreCourseRun(experiment);
  assert.equal(normal.lab.getSavedCourse(id).ruleKey,row.ruleKey,'Restoring an older run restores its exact rules after the course was edited');
  const corrupt=new MemoryStorage(),corruptSession=new MemoryStorage();corrupt.setItem('polytrack-lab:courses:v1',JSON.stringify([{trackId:id,ruleKey:row.ruleKey,code:'PolyTrackFixture',objects:null}]));corruptSession.setItem(sessionKey,JSON.stringify({trackId:id,ruleKey:row.ruleKey}));
  assert.equal(environment(corrupt,corruptSession).lab.getActiveCourse(),null,'Malformed persisted course rows do not break normal startup');
  const rotated=environment(),rotatedRules={...blueprint,checkpoints:[],objects:[{type:'ring',x:0,y:0,z:20,size:5,yaw:45},{type:'boost',x:20,y:0,z:0,size:10,yaw:20,strength:3}]};
  const rotatedRow=rotated.lab.importCourseCode(rotated.lab.encodeLabCourse(rotatedRules));await rotated.lab.startCourse(rotatedRow.trackId);
  const diagonal=environment(rotated.localStorage,rotated.sessionStorage);diagonal.flush();const diagonalWorker=diagonal.worker(),diagonalCar=car();diagonal.body.dataset.labScene='game';diagonal.lab.attachCoursePlayer(diagonalCar,id);
  // Three.js positive Y rotates local +Z toward world +X. Cross the visible ring
  // away from its center, where a mirrored plane would not detect the crossing.
  const c=Math.SQRT1_2,offset=4;
  diagonalCar.move(c*(offset-1),0,20-c*(offset+1));diagonal.lab.updateCourse(1/30);
  diagonalCar.move(c*(offset+1),0,20-c*(offset-1));diagonal.lab.updateCourse(1/30);
  assert.match(diagonal.note.textContent,/Rings 1\/1/,'A 45-degree detector follows the rendered ring plane, not its mirror');
  const angle=20*Math.PI/180;
  const worldPoint=(x,z)=>[20+Math.cos(angle)*x+Math.sin(angle)*z,-Math.sin(angle)*x+Math.cos(angle)*z];
  let point=worldPoint(4.5,4.5);diagonalCar.move(point[0],0,point[1]);diagonal.lab.updateCourse(1/30);
  assert.equal(diagonalWorker.messages.filter(message=>message.labCourseSettings).at(-1).labCourseSettings.acceleration,3,'An oblique pad applies power inside its rendered corner');
  point=worldPoint(5.5,0);diagonalCar.move(point[0],0,point[1]);diagonal.lab.updateCourse(1/30);
  assert.equal(diagonalWorker.messages.filter(message=>message.labCourseSettings).at(-1).labCourseSettings.acceleration,1,'Leaving the actual oblique pad restores power');
  console.log('PASS: native/Lab imports, resumed rule-key isolation, live checkpoint fields, zone restore, rotated geometry, mutable-vector rings, restart, immutable course PB rules, corrupt storage and safe exits.');
})().catch(error=>{console.error(error);process.exitCode=1;});
