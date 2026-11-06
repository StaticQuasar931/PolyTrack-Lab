/* Course rules travel with the track while every finish stays in its local lane. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab=window.PolyTrackLab||{};
  const prefix='PolyTrackLab1',maxTrackBytes=2*1024*1024,maxEnvelopeBytes=4*1024*1024;
  const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  function object(value,allowed,label){
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be an object.');
    const prototype=Object.getPrototypeOf(value);
    if(prototype!==null&&Object.getPrototypeOf(prototype)!==null)throw Error(label+' must contain plain data.');
    for(const key of Reflect.ownKeys(value)){
      if(typeof key!=='string'||!allowed.includes(key))throw Error('Unknown '+label+' field: '+String(key));
      const descriptor=Object.getOwnPropertyDescriptor(value,key);
      if(!descriptor||!own(descriptor,'value'))throw Error(label+' must contain plain data.');
    }
    return value;
  }
  function number(value,min,max,label,integer=false){
    if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||integer&&!Number.isSafeInteger(value))throw Error(label+' must be '+(integer?'a whole number':'a number')+' between '+min+' and '+max+'.');
    return Object.is(value,-0)?0:value;
  }
  function text(value,max,label){
    if(value===undefined)return '';
    if(typeof value!=='string'||value.length>max)throw Error(label+' must be at most '+max+' characters.');
    return value;
  }
  function list(value,max,label){
    if(!Array.isArray(value)||value.length>max)throw Error('Use at most '+max+' '+label+'.');
    for(const key of Reflect.ownKeys(value)){
      if(key==='length')continue;
      if(typeof key!=='string'||!/^(0|[1-9][0-9]*)$/.test(key)||Number(key)>=value.length)throw Error(label+' must contain plain entries.');
      const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!descriptor||!own(descriptor,'value'))throw Error(label+' must contain plain entries.');
    }
    for(let index=0;index<value.length;index++)if(!own(value,index))throw Error(label+' must not contain empty entries.');
    return value;
  }
  function fields(){
    if(!Array.isArray(lab.fields)||!lab.fields.length)throw Error('Physics controls must load before Lab course codes.');
    return lab.fields;
  }
  function physics(input){
    const controls=fields(),value=input===undefined?{}:object(input,controls.map(field=>field.key),'physics');
    const result={};
    for(const field of controls)result[field.key]=own(value,field.key)?number(value[field.key],field.min,field.max,field.label||field.key,field.key==='airJumps'):field.default;
    return result;
  }
  function chapters(input){
    if(input===undefined)return [];
    list(input,32,'checkpoint rules');
    const allowed=['acceleration','gravity','grip','maxSpeed'],controls=new Map(fields().map(field=>[field.key,field]));
    const result=input.map(entry=>{
      object(entry,['after','values'],'checkpoint rule');
      const after=number(entry.after,0,100,'Checkpoint number',true),values=object(entry.values,allowed,'checkpoint values'),normalized={};
      for(const key of allowed)if(own(values,key)){
        const field=controls.get(key);if(!field)throw Error('Unsupported checkpoint control: '+key);
        normalized[key]=number(values[key],field.min,field.max,field.label||key);
      }
      return {after,values:normalized};
    }).sort((a,b)=>a.after-b.after);
    for(let index=1;index<result.length;index++)if(result[index].after===result[index-1].after)throw Error('Each checkpoint can have only one rule.');
    return result;
  }
  function objects(input){
    if(input===undefined)return [];
    list(input,64,'Lab objects');
    return input.map(entry=>{
      object(entry,['type','x','y','z','size','yaw','strength'],'Lab object');
      if(!['boost','gravity','ring'].includes(entry.type))throw Error('Choose a boost, gravity, or ring object.');
      const defaults=entry.type==='boost'?{size:20,strength:1}:entry.type==='gravity'?{size:30,strength:0.25}:{size:6,strength:1};
      const result={type:entry.type,x:number(entry.x,-100000,100000,'Object X'),y:number(entry.y,-100000,100000,'Object Y'),z:number(entry.z,-100000,100000,'Object Z'),size:number(entry.size===undefined?defaults.size:entry.size,1,100,'Object size'),yaw:number(entry.yaw===undefined?0:entry.yaw,0,360,'Object rotation')};
      if(entry.type==='ring'){
        if(entry.strength!==undefined&&!(typeof entry.strength==='number'&&Number.isFinite(entry.strength)))throw Error('Ring strength must be finite.');
        result.strength=1;
      }else result.strength=number(entry.strength===undefined?defaults.strength:entry.strength,entry.type==='boost'?1:0,entry.type==='boost'?10:4,'Object strength');
      return result;
    });
  }
  function validateLabCourse(input){
    object(input,['schemaVersion','code','physics','name','author','notes','checkpoints','objects'],'Lab course');
    if(input.schemaVersion!==undefined&&input.schemaVersion!==1)throw Error('This Lab course version is not supported.');
    if(typeof input.code!=='string'||input.code.length>maxTrackBytes||!/^PolyTrack[0-9A-Za-z+/_=-]+$/.test(input.code))throw Error('Choose a native PolyTrack code of at most 2 MiB.');
    return {schemaVersion:1,code:input.code,name:text(input.name,80,'Track name'),author:text(input.author,80,'Author'),notes:text(input.notes,500,'Notes'),physics:physics(input.physics),checkpoints:chapters(input.checkpoints),objects:objects(input.objects)};
  }
  function base64url(bytes){
    let binary='';for(let at=0;at<bytes.length;at+=32768)binary+=String.fromCharCode(...bytes.subarray(at,at+32768));
    return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function encodeLabCourse(input){
    const bytes=new TextEncoder().encode(JSON.stringify(validateLabCourse(input))),result=prefix+base64url(bytes);
    if(bytes.length>maxEnvelopeBytes||result.length>maxEnvelopeBytes)throw Error('Lab course code exceeds the 4 MiB limit.');
    return result;
  }
  function decodeLabCourse(value){
    if(typeof value!=='string'||value.length>maxEnvelopeBytes)throw Error('Choose a Lab course code of at most 4 MiB.');
    const code=value.trim();if(!code.startsWith(prefix))throw Error('This is not a PolyTrack Lab course code.');
    const payload=code.slice(prefix.length);if(!payload||!/^[A-Za-z0-9_-]+$/.test(payload)||payload.length%4===1)throw Error('Invalid Lab course encoding.');
    let parsed;
    try{
      const binary=atob(payload.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-payload.length%4)%4));
      if(binary.length>maxEnvelopeBytes)throw Error('oversized');
      const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
      parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    }catch{throw Error('Lab course code contains invalid UTF-8 or JSON.');}
    return validateLabCourse(parsed);
  }
  function courseRuleKey(input){
    const normalized=validateLabCourse(input),value=JSON.stringify({physics:normalized.physics,checkpoints:normalized.checkpoints,objects:normalized.objects});
    const seeds=[0x811c9dc5,0x9e3779b9,0x85ebca6b,0xc2b2ae35];
    const hash=seed=>{let result=seed>>>0;for(let index=0;index<value.length;index++)result=Math.imul(result^value.charCodeAt(index),0x01000193)>>>0;result^=result>>>16;result=Math.imul(result,0x85ebca6b)>>>0;result^=result>>>13;result=Math.imul(result,0xc2b2ae35)>>>0;result^=result>>>16;return (result>>>0).toString(16).padStart(8,'0');};
    return 'lab1-'+seeds.map(hash).join('');
  }
  Object.assign(lab,{encodeLabCourse,decodeLabCourse,validateLabCourse,courseRuleKey});
})();
