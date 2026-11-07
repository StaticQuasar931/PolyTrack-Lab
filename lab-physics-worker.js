/*
 * PolyTrack 0.6.3 worker adapter. The original Bullet solver still advances every
 * 1 ms. Controls change actual engine force, wheel brakes, traction, steering,
 * aerodynamic downforce and rigid-body velocity, never the rendered car position.
 *
 * The hook is specific to the supplied 396005-byte 0.6.3 physics binary.
 * At byte 196573 updateCarModel is about to call stepSimulation and local 8 is
 * CarModel*. CarModel+32 = btRaycastVehicle*, +36 = btRigidBody*.
 * Vehicle+144 = wheel array; sizeof(btWheelInfo)=284. Wheel offsets: steering
 * 232, engineForce252, brake256, frictionSlip216; chassis connection156..164,
 * spring rest204, wheel radius212. Chassis hulls scale through the native Init
 * vertex API before Bullet builds the hull and its inertia. RigidBody velocity312..320.
 * An existing Date.now import carries the hook, using memory[0] temporarily.
 * At stock settings there is no binary or memory modification whatsoever.
 */
'use strict';
let labSettings;
try { labSettings=JSON.parse(decodeURIComponent(self.location.hash.slice(1))); } catch { labSettings={}; }
const labDefaults={acceleration:1,reverse:1,braking:1,grip:1,steering:1,downforce:1,coasting:0,maxSpeed:0,boost:0,handbrake:0,jump:0,airJumps:0,gravity:1,carScale:1,bodyWidth:1,bodyHeight:1,bodyLength:1,wheelRadius:1,wheelTrack:1,wheelBase:1,suspensionLength:1,wheelWidth:1,boostAuto:0,jumpCooldown:.75,airJumpCooldown:.15,airJumpUnlimited:0};
for(const key of Object.keys(labDefaults))if(typeof labSettings?.[key]!=='number'||!Number.isFinite(labSettings[key]))labSettings={...labSettings,[key]:labDefaults[key]};
labSettings.airJumps=Math.max(0,Math.min(99,Math.round(labSettings.airJumps)));
const labDynamicCourse=labSettings._dynamicCourse===true,labInitialDownforce=labSettings.downforce;
const labAnalogWheel=labSettings._analogWheel===true,labWheelPedals=labSettings._wheelPedals==='analog'?'analog':'digital';
let labWheelState={active:false,throttle:0,brake:0,steering:0,lastSeen:-Infinity},labWheelErrorPosted=false;
const labWheelNow=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
function labWheelPacket(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['active','throttle','brake','steering'].includes(key))||typeof value.active!=='boolean')throw new Error('Invalid wheel input packet. Controls were released.');
  if(!value.active)return {active:false,throttle:0,brake:0,steering:0};
  for(const [key,min,max] of [['throttle',0,1],['brake',0,1],['steering',-1,1]])if(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<min||value[key]>max)throw new Error('Invalid wheel input: '+key+'. Controls were released.');
  return {active:true,throttle:labWheelPedals==='digital'?(value.throttle>0?1:0):value.throttle,brake:labWheelPedals==='digital'?(value.brake>0?1:0):value.brake,steering:value.steering};
}
function labCurrentWheel(now=labWheelNow()){
  if(!labAnalogWheel)return null;
  const age=now-labWheelState.lastSeen,fresh=labWheelState.active&&age>=0&&age<=500;
  return {pedals:labWheelPedals,active:fresh,throttle:fresh?labWheelState.throttle:0,brake:fresh?labWheelState.brake:0,steering:fresh?labWheelState.steering:0};
}
const labGeometryBounds={carScale:[.25,4],bodyWidth:[.5,2],bodyHeight:[.5,2],bodyLength:[.5,2],wheelRadius:[.5,2],wheelTrack:[.5,2],wheelBase:[.5,2],suspensionLength:[.5,2],wheelWidth:[.25,3]};
const labInitialGeometry=Object.fromEntries(Object.keys(labGeometryBounds).map(key=>[key,labSettings[key]]));
const labCourseBounds={acceleration:[0,1000],reverse:[0,1000],braking:[0,1000],grip:[0,50],steering:[0,8],downforce:[0,100],coasting:[0,100],maxSpeed:[0,1000000],boost:[0,1000],handbrake:[0,100],jump:[0,1000],airJumps:[0,99],gravity:[0,20],boostAuto:[0,1],airJumpUnlimited:[0,1],jumpCooldown:[0,5],airJumpCooldown:[.05,5],...labGeometryBounds};
let labBoost=false,labHandbrake=false,labJumpSequence=0;
const labPlayerCars=new Set();
const labPlayerState=new Map();
let labNativeInit=null;
const labReplayGroups=new Map(),labReplayCars=new Map();
let labPracticeSeen=false,labPracticeState={rate:1,paused:false,step:0};
function labPracticePacket(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['rate','paused','step','inputs'].includes(key))||![.25,.5,1,2,4].includes(value.rate)||typeof value.paused!=='boolean'||![0,1,10,100].includes(value.step??0)||(value.step??0)>0&&!value.paused)throw new Error('Choose a valid practice rate, pause state, and a paused 1, 10, or 100 ms step.');
  const packet={rate:value.rate,paused:value.paused,step:value.step??0};
  if(Object.prototype.hasOwnProperty.call(value,'inputs')){const inputs=value.inputs;if(inputs!==null&&(!inputs||typeof inputs!=='object'||Array.isArray(inputs)||Object.keys(inputs).length!==4||['up','right','down','left'].some(key=>typeof inputs[key]!=='boolean')))throw new Error('Practice inputs must contain four driving switches, or null.');packet.inputs=inputs===null?null:{up:inputs.up,right:inputs.right,down:inputs.down,left:inputs.left};}
  return packet;
}
function labReplayValues(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Saved replay physics are missing.');
  const next={...labDefaults};
  for(const [key,value] of Object.entries(input)){
    const bounds=labCourseBounds[key];
    if(!Object.prototype.hasOwnProperty.call(labDefaults,key)||!bounds||typeof value!=='number'||!Number.isFinite(value)||value<bounds[0]||value>bounds[1]||['airJumps','boostAuto','airJumpUnlimited'].includes(key)&&!Number.isInteger(value))throw new Error('Saved replay physics are invalid: '+key);
    next[key]=value;
  }
  return next;
}
function labReplayGroupKey(values){return Object.keys(labDefaults).map(key=>key+':'+values[key]).join('|');}
function labDisposeReplayGroup(group){
  if(labReplayGroups.get(group.key)!==group)return;
  labReplayGroups.delete(group.key);for(const id of group.ids)labReplayCars.delete(id);group.ids.clear();group.pending.length=0;group.worker.terminate();
}
function labReplayFailure(group,error,ids=group?[...group.ids]:[]){
  const message=String(error?.message||error||'Replay simulation could not start.').slice(0,300);
  if(group)labDisposeReplayGroup(group);
  self.postMessage?.({labReplayError:true,message,carIds:ids});
}
function labInitializeReplayGroup(group){
  if(group.initialized||!labNativeInit)return;
  group.worker.postMessage({...labNativeInit});group.initialized=true;
  if(labPracticeSeen)group.worker.postMessage({labPractice:{...labPracticeState}});
  for(const message of group.pending)group.worker.postMessage(message);group.pending.length=0;
}
function labReplayGroup(values){
  const stock=Object.keys(labDefaults).every(key=>values[key]===labDefaults[key]),key=stock?'stock':labReplayGroupKey(values);
  if(labReplayGroups.has(key))return labReplayGroups.get(key);
  if(labReplayGroups.size>=10)throw new Error('Choose up to 10 different replay setups at once.');
  if(typeof self.Worker!=='function')throw new Error('This browser cannot isolate recorded replay physics.');
  const url=new URL(stock?'simulation_worker.bundle.js':'lab-physics-worker.js',self.location.href);
  url.searchParams.set('lab','1.9.1');if(!stock)url.hash=encodeURIComponent(JSON.stringify(values));
  const worker=new self.Worker(url.href),group={key,worker,ids:new Set(),pending:[],initialized:false};labReplayGroups.set(key,group);
  worker.addEventListener('message',event=>{
    if(labReplayGroups.get(key)!==group)return;const data=event.data;
    if(data?.labReplayError){labReplayFailure(group,data.message);return;}
    if(data?.labPracticeError){self.postMessage(data);return;}
    if(data?.messageType===10&&Array.isArray(data.carStateBuffers)){
      const buffers=data.carStateBuffers.filter(buffer=>buffer?.byteLength>=4&&group.ids.has(new DataView(buffer).getUint32(0,true)));
      if(buffers.length)self.postMessage({messageType:10,carStateBuffers:buffers},buffers);return;
    }
    if(data?.messageType===8&&group.ids.has(data.carId)){
      self.postMessage(data);group.ids.delete(data.carId);labReplayCars.delete(data.carId);if(!group.ids.size)labDisposeReplayGroup(group);
    }
  });
  worker.addEventListener('error',event=>{event.preventDefault?.();if(labReplayGroups.get(key)===group)labReplayFailure(group,event.message||'Recorded replay engine failed to load.');});
  return group;
}
function labRouteReplayMessage(message,event){
  if(message?.labDisposeReplays===true){event.stopImmediatePropagation();for(const group of [...labReplayGroups.values()])labDisposeReplayGroup(group);return true;}
  if(message?.messageType===0){
    // Keep the original Init vertices: the parent is allowed to replace its own
    // hull, but an Original replay must build the untouched native collider.
    labNativeInit={...message};for(const group of [...labReplayGroups.values()])try{labInitializeReplayGroup(group);}catch(error){labReplayFailure(group,error);}return false;
  }
  const existing=labReplayCars.get(message?.carId);
  if(existing&&[4,5,6,7].includes(message.messageType)){
    event.stopImmediatePropagation();try{if(existing.initialized)existing.worker.postMessage(message);else existing.pending.push(message);
    if(message.messageType===4){existing.ids.delete(message.carId);labReplayCars.delete(message.carId);if(!existing.ids.size)labDisposeReplayGroup(existing);}}catch(error){labReplayFailure(existing,error);}return true;
  }
  if(message?.messageType!==1&&!(message?.messageType===3&&message.carRecording!=null&&['stock','custom'].includes(message._labPhysicsMode)))return false;
  event.stopImmediatePropagation();
  let targetGroup=null;
  try{
    if(!Number.isSafeInteger(message.carId)||message.carId<0||message.carId>0xffffffff)throw new Error('Invalid replay car identity.');
    if(existing)throw new Error('The recorded car is already running.');
    const values=message.messageType===1||message._labPhysicsMode==='stock'?{...labDefaults}:labReplayValues(message._labPhysicsSettings);
    const group=targetGroup=labReplayGroup(values),forward={...message};delete forward._labPhysicsMode;delete forward._labPhysicsSettings;
    group.ids.add(message.carId);labReplayCars.set(message.carId,group);
    labInitializeReplayGroup(group);if(group.initialized)group.worker.postMessage(forward);else group.pending.push(forward);
  }catch(error){labReplayFailure(targetGroup,error,targetGroup?[...targetGroup.ids]:[message.carId]);}
  return true;
}
self.addEventListener('message',event=>{
  if(event.data&&Object.prototype.hasOwnProperty.call(event.data,'labWheel')){
    event.stopImmediatePropagation();
    if(!labAnalogWheel)return;
    try{labWheelState={...labWheelPacket(event.data.labWheel),lastSeen:labWheelNow()};labWheelErrorPosted=false;}
    catch(error){labWheelState={active:false,throttle:0,brake:0,steering:0,lastSeen:labWheelNow()};if(!labWheelErrorPosted){self.postMessage?.({labWheelError:true,message:error.message});labWheelErrorPosted=true;}}
    return;
  }
  if(event.data&&Object.prototype.hasOwnProperty.call(event.data,'labPractice')){
    let packet;try{packet=labPracticePacket(event.data.labPractice);}catch(error){event.stopImmediatePropagation();self.postMessage?.({labPracticeError:true,message:error.message});return;}
    const ghostPacket={rate:packet.rate,paused:packet.paused,step:packet.step};labPracticeSeen=true;labPracticeState={...ghostPacket,step:0};
    for(const group of [...labReplayGroups.values()])try{const message={labPractice:{...ghostPacket}};if(group.initialized)group.worker.postMessage(message);else group.pending.push(message);}catch(error){labReplayFailure(group,error);}
    // The native scheduler receives the same event after this listener. Inputs
    // remain only on the player's engine, never on a recorded opponent.
    return;
  }
  if(event.data?.labCourseSettings){
    event.stopImmediatePropagation();const values=event.data.labCourseSettings;
    const invalid=!labDynamicCourse||!values||typeof values!=='object'||Array.isArray(values)||Object.entries(values).some(([key,value])=>!labCourseBounds[key]||typeof value!=='number'||!Number.isFinite(value)||value<labCourseBounds[key][0]||value>labCourseBounds[key][1]||['airJumps','boostAuto','airJumpUnlimited'].includes(key)&&!Number.isInteger(value)||labGeometryBounds[key]&&value!==labInitialGeometry[key])||values.downforce!==undefined&&values.downforce!==labInitialDownforce;
    if(invalid){self.postMessage?.({labCourseSettingsRejected:true,error:'Live course settings are invalid or require a physics restart.'});return;}
    labSettings={...labSettings,...values,_dynamicCourse:true};return;
  }
  if(event.data?.labPhysics){labBoost=event.data.boost===true;labHandbrake=event.data.handbrake===true;if(Number.isSafeInteger(event.data.jumpSequence)&&event.data.jumpSequence>=0)labJumpSequence=event.data.jumpSequence;if(event.data.cancelJump===true)for(const state of labPlayerState.values())state.jumpSequence=labJumpSequence;event.stopImmediatePropagation();return;}
  const message=event.data;
  if(labRouteReplayMessage(message,event))return;
  if(message?.messageType===0)labScaleCollisionInit(message,labSettings);
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
      if(!labDynamicCourse&&!labAnalogWheel&&Object.keys(labDefaults).every(key=>labSettings[key]===labDefaults[key]))return original(options);
      const response=await fetch('polytrack_physics.wasm');
      if(!response.ok)throw new Error('PolyTrack Lab could not load the physics engine.');
      const bytes=new Uint8Array(await response.arrayBuffer());
      const patched=labPatchPhysics(bytes,labSettings);
      let memory;
      return original({...options,instantiateWasm(imports,receive){
        const now=imports.a.h;
        imports.a.h=()=>{if(memory){const scratch=new DataView(memory.buffer),ptr=scratch.getUint32(0,true),id=scratch.getUint32(16,true),player=labPlayerCars.has(id);if(ptr)labTuneStep(memory,ptr,labSettings,labBoost&&player,scratch.getUint32(12,true)===1,player?{player:true,wheel:labCurrentWheel(),handbrake:labHandbrake,jumpSequence:labJumpSequence,state:labPlayerState.get(id)}:{});}return now();};
        WebAssembly.instantiate(patched,imports).then(({instance,module})=>{memory=instance.exports.j;receive(instance,module);}).catch(error=>{setTimeout(()=>{throw error;});});
        return {};
      }});
    };
  }
};
function labPatchPhysics(source,settings){
  if(source.length!==396005||source[196573]!==32||source[196574]!==8||source[196575]!==40)throw new Error('Unsupported physics engine. PolyTrack Lab needs the supplied 0.6.3 binary.');
  const bytes=source.slice(),view=new DataView(bytes.buffer);
  if(labAnalogWheel&&labWheelPedals==='analog'){
    const brakeConstant=[65,128,128,128,137,4,54,2];
    if([194698,194710,194722,194734].some(address=>brakeConstant.some((byte,index)=>bytes[address+index]!==byte)))throw new Error('Native wheel brake compatibility check failed.');
  }
  if(Object.keys(labGeometryBounds).some(key=>key!=='wheelWidth'&&(settings[key]??1)!==1)){
    const wheelLayout=[32,1,65,213,241,165,245,3,54,2,212,1,32,1,32,13,56,2,208,1,32,1,65,143,133,215,239,3,54,2,204,1];
    if(wheelLayout.some((byte,index)=>bytes[19757+index]!==byte))throw new Error('Vehicle geometry compatibility check failed.');
  }
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
function labGeometryFactors(settings){
  const values={};
  for(const [key,[min,max]] of Object.entries(labGeometryBounds)){const value=settings[key]??1;if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error('Invalid vehicle geometry: '+key);values[key]=value;}
  return values;
}
function labScaleCollisionInit(message,settings){
  const s=labGeometryFactors(settings),x=s.carScale*s.bodyWidth,y=s.carScale*s.bodyHeight,z=s.carScale*s.bodyLength;
  if(x===1&&y===1&&z===1)return;
  const source=message.carCollisionShapeVertices;
  if(!source||!Number.isSafeInteger(source.length)||source.length===0||source.length%3!==0||source.length>1000000||typeof message.carMassOffset!=='number'||!Number.isFinite(message.carMassOffset))throw new Error('Invalid native chassis collision geometry.');
  const vertices=new Float32Array(source.length);
  for(let index=0;index<source.length;index++){if(typeof source[index]!=='number'||!Number.isFinite(source[index]))throw new Error('Invalid native chassis collision vertex.');vertices[index]=source[index]*[x,y,z][index%3];}
  // Native initializeCarCollisionShape builds the convex hull and recalculates inertia.
  message.carCollisionShapeVertices=vertices;message.carMassOffset*=y;
}
function labApplyWheelGeometry(data,vehicle,wheels,settings){
  if(!['carScale','bodyWidth','bodyHeight','bodyLength','wheelRadius','wheelTrack','wheelBase','suspensionLength'].some(key=>(settings[key]??1)!==1))return;
  const s=labGeometryFactors(settings);
  if(data.getUint32(vehicle+136,true)!==4)throw new Error('Unsupported native wheel geometry.');
  const sx=s.carScale*s.bodyWidth*s.wheelTrack,sy=s.carScale*s.bodyHeight,sz=s.carScale*s.bodyLength*s.wheelBase;
  for(let index=0;index<4;index++){
    const wheel=wheels+284*index;
    // Verified 0.6.3 btWheelInfo: connection CS156, spring rest204, radius212.
    data.setFloat32(wheel+156,(index<2?.627909:.720832)*(index%2===0?1:-1)*sx,true);
    data.setFloat32(wheel+160,.27*sy,true);
    data.setFloat32(wheel+164,(index<2?1.3478:-1.52686)*sz,true);
    data.setFloat32(wheel+204,.12*s.carScale*s.suspensionLength,true);
    data.setFloat32(wheel+212,.331*s.carScale*s.wheelRadius,true);
  }
}
function labApplyWheelInputs(data,wheels,input){
  for(let index=0;index<4;index++){
    const wheel=wheels+284*index,engine=data.getFloat32(wheel+252,true),brake=data.getFloat32(wheel+256,true);
    if(input.pedals==='analog'){
      data.setFloat32(wheel+252,input.brake>0||engine<0?0:engine*input.throttle,true);
      // Native 0.6.3 applies 10 brake units to every wheel while braking
      // forward. Keep that verified force at low speed instead of reversing.
      data.setFloat32(wheel+256,10*input.brake,true);
    }else{
      if(engine!==0)data.setFloat32(wheel+252,engine*(engine>0?input.throttle:input.brake),true);
      if(brake!==0)data.setFloat32(wheel+256,brake*input.brake,true);
    }
    if(index<2&&Math.abs(input.steering)!==1)data.setFloat32(wheel+232,data.getFloat32(wheel+232,true)*Math.abs(input.steering),true);
  }
}
function labTuneStep(memory,car,settings,boost,afterStep=false,actions={}){
  const data=new DataView(memory.buffer),length=data.byteLength;
  if(car<1024||car+192>length)throw new Error('Invalid physics car pointer.');
  const vehicle=data.getUint32(car+32,true),body=data.getUint32(car+36,true);
  const wheels=data.getUint32(vehicle+144,true);
  if(!vehicle||!body||!wheels||body+392>length||wheels+1136>length)throw new Error('Invalid physics vehicle layout.');
  const wheelInput=actions.player&&actions.wheel?actions.wheel:null;
  if(!afterStep&&wheelInput)labApplyWheelInputs(data,wheels,wheelInput);
  if(!afterStep)labApplyWheelGeometry(data,vehicle,wheels,settings);
  // Bullet stores acceleration and mass-scaled gravitational force separately.
  // Native 0.6.3 gravity is -9.82 m/s²; inverse mass is at body+344.
  if(!afterStep&&typeof settings.gravity==='number'&&(settings.gravity!==1||settings._dynamicCourse===true)){const inverseMass=data.getFloat32(body+344,true);if(!(inverseMass>0))throw new Error('Invalid car mass for gravity tuning.');const acceleration=-9.82*settings.gravity;data.setFloat32(body+384,acceleration,true);data.setFloat32(body+368,acceleration/inverseMass,true);}
  if(!afterStep)for(let index=0;index<4;index++){
    const wheel=wheels+284*index;
    const engine=data.getFloat32(wheel+252,true);
    if(engine!==0){const multiplier=engine>0?settings.acceleration+((boost||settings.boostAuto===1&&(actions.player||actions.state))?settings.boost:0):settings.reverse;data.setFloat32(wheel+252,engine*multiplier,true);}
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
    if(pressed&&state.cooldown===0&&grounded&&!data.getUint32(20,true)){data.setFloat32(body+316,data.getFloat32(body+316,true)+settings.jump,true);state.cooldown=Math.round((settings.jumpCooldown??.75)*1000);state.airCooldown=Math.round((settings.airJumpCooldown??.15)*1000);}
    else if(pressed&&!grounded&&frame>20&&state.airCooldown===0&&(settings.airJumpUnlimited===1||(state.airJumpsUsed||0)<Math.max(0,Math.min(99,Math.round(settings.airJumps||0))))){data.setFloat32(body+316,data.getFloat32(body+316,true)+settings.jump,true);state.airJumpsUsed=(state.airJumpsUsed||0)+1;state.airCooldown=Math.round((settings.airJumpCooldown??.15)*1000);}
    }
  }
  if(!afterStep&&settings.coasting>0&&(wheelInput?wheelInput.throttle===0&&wheelInput.brake===0:!data.getUint32(4,true)&&!data.getUint32(8,true))&&[0,1,2,3].some(index=>data.getUint8(wheels+284*index+84))){const factor=Math.exp(-settings.coasting*0.001);for(const offset of [312,316,320])data.setFloat32(body+offset,data.getFloat32(body+offset,true)*factor,true);}
  if(settings.maxSpeed>0){const x=data.getFloat32(body+312,true),y=data.getFloat32(body+316,true),z=data.getFloat32(body+320,true),speed=Math.hypot(x,y,z),cap=settings.maxSpeed/3.6;if(speed>cap){const scale=cap/speed;data.setFloat32(body+312,x*scale,true);data.setFloat32(body+316,y*scale,true);data.setFloat32(body+320,z*scale,true);if(afterStep)data.setFloat32(vehicle+112,(data.getFloat32(vehicle+112,true)<0?-1:1)*settings.maxSpeed,true);}}
}
labImportScripts('simulation_worker.bundle.js?v=1.9.1');




/* Road contact gates each extra impulse before the next fixed step. */
