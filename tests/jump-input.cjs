const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={console,DataView,Uint8Array,WebAssembly,URL,Math,Date,self:null,location:{hash:''},addEventListener(){},importScripts(){}};
context.self=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../lab-physics-worker.js'),'utf8'),context);
function fixture(){
  const memory={buffer:new ArrayBuffer(16384)},data=new DataView(memory.buffer),car=1024,vehicle=2048,body=4096,wheels=8192;
  data.setUint32(car+32,vehicle,true);data.setUint32(car+36,body,true);data.setUint32(vehicle+144,wheels,true);
  const settings={acceleration:1,reverse:1,braking:1,grip:1,steering:1,downforce:1,coasting:0,maxSpeed:0,boost:0,handbrake:0,jump:8},state={jumpSequence:0,cooldown:0};
  return {data,state,step(frame,grounded,sequence,reset=false){data.setUint32(car+172,frame,true);data.setUint32(20,reset?1:0,true);for(let index=0;index<4;index++)data.setUint8(wheels+284*index+84,grounded?1:0);context.labTuneStep(memory,car,settings,false,false,{jumpSequence:sequence,state});return data.getFloat32(body+316,true);}};
}
const warmup=fixture();assert.equal(warmup.step(1,false,1),0);assert.equal(warmup.state.jumpSequence,0,'Initial input waits for raycast contacts');assert.equal(warmup.step(2,true,1),8,'Initial press launches once contacts arrive');assert.equal(warmup.step(3,true,1),8,'Holding J cannot add another impulse');
const expired=fixture();assert.equal(expired.step(1,false,1),0);assert.equal(expired.step(21,true,1),0,'First-contact queue expires after 20 simulation ticks');
const airborne=fixture();assert.equal(airborne.step(100,false,1),0);assert.equal(airborne.state.jumpSequence,1,'Later airborne input is consumed immediately');assert.equal(airborne.step(101,true,1),0,'An airborne press cannot queue a jump on landing');
const boundary=fixture();boundary.step(1,false,1);assert.equal(boundary.step(20,true,1),8,'Contact on tick 20 is still inside initial warmup');
const reset=fixture();reset.step(1,true,1);assert.equal(reset.state.cooldown,750);reset.step(2,true,2,true);assert.equal(reset.state.cooldown,0,'Reset clears jump cooldown');assert.equal(reset.state.jumpSequence,2,'Reset consumes current input');assert.equal(reset.state.initialJumpSequence,null);assert.equal(reset.step(3,true,2),8,'Reset does not queue the consumed press');assert.equal(reset.step(4,true,3),16,'A fresh press after reset is available immediately');
const resetPending=fixture();resetPending.step(1,false,1);resetPending.step(2,false,1,true);assert.equal(resetPending.step(3,true,1),0,'Reset clears a pending first-contact jump');
console.log('Initial jump contact warmup, expiry, no later airborne queue and reset state clearing: PASS');
