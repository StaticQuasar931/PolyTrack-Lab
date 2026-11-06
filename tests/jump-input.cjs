const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={console,DataView,Uint8Array,WebAssembly,URL,Math,Date,self:null,location:{hash:''},addEventListener(){},importScripts(){}};
context.self=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../lab-physics-worker.js'),'utf8'),context);
function fixture(overrides={}){
  const memory={buffer:new ArrayBuffer(16384)},data=new DataView(memory.buffer),car=1024,vehicle=2048,body=4096,wheels=8192;
  data.setUint32(car+32,vehicle,true);data.setUint32(car+36,body,true);data.setUint32(vehicle+144,wheels,true);
  const settings={acceleration:1,reverse:1,braking:1,grip:1,steering:1,downforce:1,coasting:0,maxSpeed:0,boost:0,handbrake:0,jump:8,airJumps:0,...overrides},state={jumpSequence:0,cooldown:0};
  return {data,state,step(frame,grounded,sequence,reset=false){data.setUint32(car+172,frame,true);data.setUint32(20,reset?1:0,true);for(let index=0;index<4;index++)data.setUint8(wheels+284*index+84,grounded?1:0);context.labTuneStep(memory,car,settings,false,false,{jumpSequence:sequence,state});return data.getFloat32(body+316,true);}};
}
const warmup=fixture();assert.equal(warmup.step(1,false,1),0);assert.equal(warmup.state.jumpSequence,0,'Initial input waits for raycast contacts');assert.equal(warmup.step(2,true,1),8,'Initial press launches once contacts arrive');assert.equal(warmup.step(3,true,1),8,'Holding J cannot add another impulse');
const expired=fixture();assert.equal(expired.step(1,false,1),0);assert.equal(expired.step(21,true,1),0,'First-contact queue expires after 20 simulation ticks');
const airborne=fixture();assert.equal(airborne.step(100,false,1),0);assert.equal(airborne.state.jumpSequence,1,'Later airborne input is consumed immediately');assert.equal(airborne.step(101,true,1),0,'An airborne press cannot queue a jump on landing');
const boundary=fixture();boundary.step(1,false,1);assert.equal(boundary.step(20,true,1),8,'Contact on tick 20 is still inside initial warmup');
const reset=fixture();reset.step(1,true,1);assert.equal(reset.state.cooldown,750);reset.step(2,true,2,true);assert.equal(reset.state.cooldown,0,'Reset clears jump cooldown');assert.equal(reset.state.jumpSequence,2,'Reset consumes current input');assert.equal(reset.state.initialJumpSequence,null);assert.equal(reset.step(3,true,2),8,'Reset does not queue the consumed press');assert.equal(reset.step(4,true,3),16,'A fresh press after reset is available immediately');
const resetPending=fixture();resetPending.step(1,false,1);resetPending.step(2,false,1,true);assert.equal(resetPending.step(3,true,1),0,'Reset clears a pending first-contact jump');
console.log('Initial jump contact warmup, expiry, no later airborne queue and reset state clearing: PASS');
const double=fixture({airJumps:1});assert.equal(double.step(1,true,1),8);
for(let frame=2;frame<=151;frame++)double.step(frame,false,1);
assert.equal(double.step(152,false,2),16,'One extra press supplies a double jump');
assert.equal(double.state.airJumpsUsed,1);
for(let frame=153;frame<=303;frame++)double.step(frame,false,2);
assert.equal(double.step(304,false,3),16,'The airborne budget prevents a third jump');
for(let frame=305;frame<=324;frame++)double.step(frame,true,3);
assert.equal(double.state.airJumpsUsed,0,'Stable landing recharges the airborne budget');
assert.equal(double.step(325,false,4),24,'A fresh press after leaving the road can use the recharged air jump');
double.step(326,false,5,true);assert.equal(double.state.airJumpsUsed,0);assert.equal(double.state.airCooldown,0);
assert.equal(double.step(327,false,5),24,'Restart consumes the reset input');
assert.equal(double.step(328,false,6),32,'Restart makes a fresh airborne press available');
const earlyAir=fixture({airJumps:1});earlyAir.step(1,true,1);assert.equal(earlyAir.step(2,false,2),8,'Air jumps cannot bypass their short press cooldown');
for(let frame=3;frame<=160;frame++)earlyAir.step(frame,false,2);
assert.equal(earlyAir.step(161,false,2),8,'An early airborne press is consumed rather than queued');
assert.equal(earlyAir.step(162,false,3),16);
const disabled=fixture({airJumps:3,jump:0});assert.equal(disabled.step(100,false,1),0,'Air jumps require a nonzero jump strength');
console.log('Air-jump budget, separate press cooldown, stable landing recharge and reset clearing: PASS');
function courseWorker(dynamic){
  const handlers={},replies=[],worker={console,DataView,Uint8Array,WebAssembly,URL,Math,Date,location:{hash:'#'+encodeURIComponent(JSON.stringify({_dynamicCourse:dynamic}))},addEventListener:(type,handler)=>{handlers[type]=handler;},importScripts(){},postMessage:value=>replies.push(value)};
  worker.self=worker;vm.createContext(worker);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../lab-physics-worker.js'),'utf8'),worker);
  return {worker,replies,send(values){handlers.message({data:{labCourseSettings:values},stopImmediatePropagation(){}});},value:key=>vm.runInContext('labSettings.'+key,worker)};
}
const dynamic=courseWorker(true);dynamic.send({gravity:.25,acceleration:2,grip:.4});assert.equal(dynamic.value('gravity'),.25);assert.equal(dynamic.value('acceleration'),2);assert.equal(dynamic.value('grip'),.4);dynamic.send({gravity:1});assert.equal(dynamic.value('gravity'),1);
dynamic.send({gravity:.5,downforce:2});assert.equal(dynamic.value('gravity'),1,'A rejected message cannot partly change course settings');assert.equal(dynamic.value('downforce'),1);assert.equal(dynamic.replies.at(-1).labCourseSettingsRejected,true);dynamic.send({airJumps:1.5});assert.equal(dynamic.value('airJumps'),0);dynamic.send({gravity:NaN});assert.equal(dynamic.value('gravity'),1);
const ordinary=courseWorker(false);ordinary.send({gravity:.25});assert.equal(ordinary.value('gravity'),1,'Ordinary workers cannot silently start using course physics');assert.equal(ordinary.replies.at(-1).labCourseSettingsRejected,true);
console.log('Worker course updates validate atomically, preserve baked downforce and reject non-course mutation: PASS');
