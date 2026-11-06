/*
 * PolyTrack 0.6.3 worker adapter. The original Bullet solver still advances every
 * 1 ms. Controls change actual engine force, wheel brakes, traction, steering,
 * aerodynamic downforce and rigid-body velocity, never the rendered car position.
 *
 * The hook is specific to the supplied 396005-byte 0.6.3 physics binary.
 * At byte 196573 updateCarModel is about to call stepSimulation and local 8 is
 * CarModel*. CarModel+32 = btRaycastVehicle*, +36 = btRigidBody*.
 * Vehicle+144 = wheel array; sizeof(btWheelInfo)=284. Wheel offsets: steering
 * 232, engineForce252, brake256, frictionSlip216. RigidBody velocity312..320.
 * An existing Date.now import carries the hook, using memory[0] temporarily.
 * At stock settings there is no binary or memory modification whatsoever.
 */
'use strict';
let labSettings;
try { labSettings=JSON.parse(decodeURIComponent(self.location.hash.slice(1))); } catch { labSettings={}; }
const labDefaults={acceleration:1,reverse:1,braking:1,grip:1,steering:1,downforce:1,coasting:0,maxSpeed:0,boost:0,handbrake:0,jump:0,airJumps:0,gravity:1};
for(const key of Object.keys(labDefaults))if(typeof labSettings?.[key]!=='number'||!Number.isFinite(labSettings[key]))labSettings={...labSettings,[key]:labDefaults[key]};
labSettings.airJumps=Math.max(0,Math.min(3,Math.round(labSettings.airJumps)));
const labDynamicCourse=labSettings._dynamicCourse===true,labInitialDownforce=labSettings.downforce;
const labCourseBounds={acceleration:[.1,10],reverse:[.1,10],braking:[.1,10],grip:[.1,5],steering:[.2,2],downforce:[0,10],coasting:[0,10],maxSpeed:[0,3000],boost:[0,10],handbrake:[0,5],jump:[0,40],airJumps:[0,3],gravity:[0,4]};
let labBoost=false,labHandbrake=false,labJumpSequence=0;
const labPlayerCars=new Set();
const labPlayerState=new Map();
self.addEventListener('message',event=>{
  if(event.data?.labCourseSettings){
    event.stopImmediatePropagation();const values=event.data.labCourseSettings;
    const invalid=!labDynamicCourse||!values||typeof values!=='object'||Array.isArray(values)||Object.entries(values).some(([key,value])=>!labCourseBounds[key]||typeof value!=='number'||!Number.isFinite(value)||value<labCourseBounds[key][0]||value>labCourseBounds[key][1]||key==='airJumps'&&!Number.isInteger(value))||values.downforce!==undefined&&values.downforce!==labInitialDownforce;
    if(invalid){self.postMessage?.({labCourseSettingsRejected:true,error:'Live course settings are invalid or require a physics restart.'});return;}
    labSettings={...labSettings,...values,_dynamicCourse:true};return;
  }
  if(event.data?.labPhysics){labBoost=event.data.boost===true;labHandbrake=event.data.handbrake===true;if(Number.isSafeInteger(event.data.jumpSequence)&&event.data.jumpSequence>=0)labJumpSequence=event.data.jumpSequence;if(event.data.cancelJump===true)for(const state of labPlayerState.values())state.jumpSequence=labJumpSequence;event.stopImmediatePropagation();return;}
  const message=event.data;
  if(message?.messageType===3){if(message.carRecording==null){labPlayerCars.add(message.carId);labPlayerState.set(message.carId,{jumpSequence:labJumpSequence,cooldown:0});}else{labPlayerCars.delete(message.carId);labPlayerState.delete(message.carId);}}
  else if(message?.messageType===4){labPlayerCars.delete(message.carId);labPlayerState.delete(message.carId);}
  else if(message?.messageType===7){const state=labPlayerState.get(message.carId);if(state)state.jumpSequence=labJumpSequence;}
});
const labImportScripts=self.importScripts.bind(self);
self.importScripts=(...urls)=>{
  labImportScripts(...urls);
  if(urls.some(url=>String(url).endsWith('lib/polytrack_physics.js'))){
    const original=PolyTrackPhysics;
    self.PolyTrackPhysics=async options=>{
      if(!labDynamicCourse&&Object.keys(labDefaults).every(key=>labSettings[key]===labDefaults[key]))return original(options);
      const response=await fetch('polytrack_physics.wasm');
      if(!response.ok)throw new Error('PolyTrack Lab could not load the physics engine.');
      const bytes=new Uint8Array(await response.arrayBuffer());
      const patched=labPatchPhysics(bytes,labSettings);
      let memory;
      return original({...options,instantiateWasm(imports,receive){
        const now=imports.a.h;
        imports.a.h=()=>{if(memory){const scratch=new DataView(memory.buffer),ptr=scratch.getUint32(0,true),id=scratch.getUint32(16,true),player=labPlayerCars.has(id);if(ptr)labTuneStep(memory,ptr,labSettings,labBoost&&player,scratch.getUint32(12,true)===1,player?{handbrake:labHandbrake,jumpSequence:labJumpSequence,state:labPlayerState.get(id)}:{});}return now();};
        WebAssembly.instantiate(patched,imports).then(({instance,module})=>{memory=instance.exports.j;receive(instance,module);}).catch(error=>{setTimeout(()=>{throw error;});});
        return {};
      }});
    };
  }
};
function labPatchPhysics(source,settings){
  if(source.length!==396005||source[196573]!==32||source[196574]!==8||source[196575]!==40)throw new Error('Unsupported physics engine. PolyTrack Lab needs the supplied 0.6.3 binary.');
  const bytes=source.slice(),view=new DataView(bytes.buffer);
  for(const address of [193940,193970,194000]){
    if(bytes[address]!==67||Math.abs(view.getFloat32(address+1,true)-0.05)>1e-8)throw new Error('Physics downforce compatibility check failed.');
    view.setFloat32(address+1,0.05*settings.downforce,true);
  }
  // i32.const 0; local.get 8; i32.store; call Date.now; drop; clear scratch.
  const injection=new Uint8Array([65,0,32,8,54,2,0,65,4,32,1,54,2,0,65,8,32,3,54,2,0,65,12,65,0,54,2,0,65,16,32,0,54,2,0,65,20,32,5,54,2,0,16,7,26,65,0,65,0,54,2,0]);
  const afterStep=new Uint8Array([65,0,32,8,54,2,0,65,12,65,1,54,2,0,16,7,26,65,0,65,0,54,2,0]);
  let pos=8;
  const read=()=>{let n=0,s=0,b;do{b=bytes[pos++];n|=(b&127)<<s;s+=7;}while(b&128);return n>>>0;};
  const leb=n=>{const a=[];do{let b=n&127;n>>>=7;if(n)b|=128;a.push(b);}while(n);return a;};
  const join=(...parts)=>{const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){result.set(p,i);i+=p.length;}return result;};
  while(pos<bytes.length){const sectionStart=pos,id=bytes[pos++],size=read(),payloadStart=pos,end=pos+size;if(id===10){const count=read();for(let index=0;index<count;index++){const bodySizeStart=pos,bodySize=read(),bodyStart=pos,bodyEnd=pos+bodySize;if(bodyStart<=196573&&bodyEnd>196573){
    const payload=join(bytes.subarray(payloadStart,bodySizeStart),leb(bodySize+injection.length+afterStep.length),bytes.subarray(bodyStart,196573),injection,bytes.subarray(196573,196607),afterStep,bytes.subarray(196607,end));
    const result=join(bytes.subarray(0,sectionStart),[10],leb(payload.length),payload,bytes.subarray(end));
    if(!WebAssembly.validate(result))throw new Error('Physics adapter validation failed.');return result;
  }pos=bodyEnd;}}pos=end;}
  throw new Error('Physics simulation hook not found.');
}
function labTuneStep(memory,car,settings,boost,afterStep=false,actions={}){
  const data=new DataView(memory.buffer),length=data.byteLength;
  if(car<1024||car+192>length)throw new Error('Invalid physics car pointer.');
  const vehicle=data.getUint32(car+32,true),body=data.getUint32(car+36,true);
  const wheels=data.getUint32(vehicle+144,true);
  if(!vehicle||!body||!wheels||body+392>length||wheels+1136>length)throw new Error('Invalid physics vehicle layout.');
  // Bullet stores acceleration and mass-scaled gravitational force separately.
  // Native 0.6.3 gravity is -9.82 m/s²; inverse mass is at body+344.
  if(!afterStep&&typeof settings.gravity==='number'&&(settings.gravity!==1||settings._dynamicCourse===true)){const inverseMass=data.getFloat32(body+344,true);if(!(inverseMass>0))throw new Error('Invalid car mass for gravity tuning.');const acceleration=-9.82*settings.gravity;data.setFloat32(body+384,acceleration,true);data.setFloat32(body+368,acceleration/inverseMass,true);}
  if(!afterStep)for(let index=0;index<4;index++){
    const wheel=wheels+284*index;
    const engine=data.getFloat32(wheel+252,true);
    if(engine!==0){const multiplier=engine>0?settings.acceleration+(boost?settings.boost:0):settings.reverse;data.setFloat32(wheel+252,engine*multiplier,true);}
    if(settings.braking!==1)data.setFloat32(wheel+256,data.getFloat32(wheel+256,true)*settings.braking,true);
    if(settings.grip!==1)data.setFloat32(wheel+216,data.getFloat32(wheel+216,true)*settings.grip,true);
    if(settings.steering!==1&&index<2)data.setFloat32(wheel+232,data.getFloat32(wheel+232,true)*settings.steering,true);
    if(settings.handbrake>0&&actions.handbrake&&index>=2){data.setFloat32(wheel+256,data.getFloat32(wheel+256,true)+10*settings.handbrake,true);data.setFloat32(wheel+216,data.getFloat32(wheel+216,true)*0.35,true);}
  }
  if(!afterStep&&settings.jump>0&&actions.state){
    const state=actions.state;
    if(data.getUint32(20,true)){state.cooldown=0;state.airCooldown=0;state.airJumpsUsed=0;state.groundedTicks=0;state.initialJumpSequence=null;state.jumpSequence=actions.jumpSequence;}
    else{
    state.cooldown=Math.max(0,(state.cooldown||0)-1);
    state.airCooldown=Math.max(0,(state.airCooldown||0)-1);
    const fresh=Number.isSafeInteger(actions.jumpSequence)&&actions.jumpSequence!==state.jumpSequence;
    const frame=data.getUint32(car+172,true);
    const expiredInitialPress=state.initialJumpSequence===actions.jumpSequence&&frame>20;
    const pressed=fresh&&!expiredInitialPress;
    const grounded=[0,1,2,3].filter(index=>data.getUint8(wheels+284*index+84)).length>=2;
    state.groundedTicks=grounded?(state.groundedTicks||0)+1:0;
    if(state.groundedTicks>=20)state.airJumpsUsed=0;
    // A newly started car has no raycast contacts until its first solver step.
    // Keep that initial press for at most 20 ticks; later airborne presses expire.
    const waitingForFirstContact=pressed&&!grounded&&frame<=20&&state.cooldown===0&&!data.getUint32(20,true);
    if(waitingForFirstContact)state.initialJumpSequence=actions.jumpSequence;
    else{state.jumpSequence=actions.jumpSequence;state.initialJumpSequence=null;}
    if(pressed&&state.cooldown===0&&grounded&&!data.getUint32(20,true)){data.setFloat32(body+316,data.getFloat32(body+316,true)+settings.jump,true);state.cooldown=750;state.airCooldown=150;}
    else if(pressed&&!grounded&&frame>20&&state.airCooldown===0&&(state.airJumpsUsed||0)<Math.max(0,Math.min(3,Math.round(settings.airJumps||0)))){data.setFloat32(body+316,data.getFloat32(body+316,true)+settings.jump,true);state.airJumpsUsed=(state.airJumpsUsed||0)+1;state.airCooldown=150;}
    }
  }
  if(!afterStep&&settings.coasting>0&&!data.getUint32(4,true)&&!data.getUint32(8,true)&&[0,1,2,3].some(index=>data.getUint8(wheels+284*index+84))){const factor=Math.exp(-settings.coasting*0.001);for(const offset of [312,316,320])data.setFloat32(body+offset,data.getFloat32(body+offset,true)*factor,true);}
  if(settings.maxSpeed>0){const x=data.getFloat32(body+312,true),y=data.getFloat32(body+316,true),z=data.getFloat32(body+320,true),speed=Math.hypot(x,y,z),cap=settings.maxSpeed/3.6;if(speed>cap){const scale=cap/speed;data.setFloat32(body+312,x*scale,true);data.setFloat32(body+316,y*scale,true);data.setFloat32(body+320,z*scale,true);if(afterStep)data.setFloat32(vehicle+112,(data.getFloat32(vehicle+112,true)<0?-1:1)*settings.maxSpeed,true);}}
}
labImportScripts('simulation_worker.bundle.js');




/* Road contact gates each extra impulse before the next fixed step. */
