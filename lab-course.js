/* Course rules travel with the track; local finishes keep a separate experiment lane. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab,storageKey='polytrack-lab:courses:v1',sessionKey='polytrack-lab.course-session.v1',pendingKey='polytrack-lab.course-launch.v1';
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');if(!Array.isArray(value))return [];const result=[];for(const row of value.slice(0,30)){try{if(!/^[a-f0-9]{64}$/.test(row?.trackId))continue;const course=lab.validateLabCourse(Object.fromEntries(['code','name','author','notes','physics','checkpoints','objects'].filter(key=>row[key]!==undefined).map(key=>[key,row[key]])));if(lab.courseRuleKey(course)!==row.ruleKey)continue;result.push({...course,trackId:row.trackId,ruleKey:row.ruleKey});}catch{}}return result;}catch{return [];}};
  let context=null,player=null,group=null,checkpoint=0,passed=new Set(),previous=null,lastSettings='',elapsed=0,hasRaced=false;
  try{const saved=JSON.parse(sessionStorage.getItem(sessionKey)||'null');context=read().find(row=>row.trackId===saved?.trackId&&row.ruleKey===saved?.ruleKey)||null;}catch{}
  if(context&&!sessionStorage.getItem(pendingKey))sessionStorage.setItem(pendingKey,JSON.stringify({trackId:context.trackId,ruleKey:context.ruleKey}));
  const baseKey=lab.getPhysicsKey.bind(lab),baseReplay=lab.replayEnabled.bind(lab);
  lab.getActiveCourse=()=>context;
  lab.getPhysicsKey=()=>baseKey()+(context?'~course:'+context.ruleKey:'');
  lab.replayEnabled=lab.canReplay=()=>!context&&baseReplay();
  lab.getSavedCourse=id=>read().find(row=>row.trackId===id)||null;
  function register(course,trackId){
    const row={...course,trackId,ruleKey:lab.courseRuleKey(course)},all=read().filter(entry=>entry.trackId!==trackId);
    localStorage.setItem(storageKey,JSON.stringify([row,...all].slice(0,30)));return row;
  }
  lab.installCourseParser=Type=>{
    const original=Type.fromExportString.bind(Type);
    Type.fromExportString=code=>{
      if(typeof code!=='string'||!code.trim().startsWith('PolyTrackLab1'))return original(code);
      const course=lab.decodeLabCourse(code.trim()),parsed=original(course.code);if(!parsed)throw Error('The Lab package contains an invalid native track.');
      register(course,parsed.trackData.getId());
      parsed.trackMetadata={...parsed.trackMetadata,name:course.name||parsed.trackMetadata.name,author:course.author||parsed.trackMetadata.author};return parsed;
    };
  };
  lab.importCourseCode=code=>{
    const parsed=lab.saveCourseCode(code);const row=lab.getSavedCourse(parsed.trackData.getId());if(!row)throw Error('Use a PolyTrack Lab code to import course rules.');return row;
  };
  const clearObjects=()=>{if(group){group.parent?.remove(group);group.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});group=null;}};
  lab.setCourseTrack=id=>{
    if(context&&context.trackId!==id){const hadPlayer=!!player;try{lab.sendCourseSettings(lab.getSettings());}finally{context=null;player=null;clearObjects();lastSettings='';sessionStorage.removeItem(sessionKey);if(hadPlayer)location.reload();}}
  };
  lab.startCourse=async id=>{
    const course=lab.getSavedCourse(id);if(!course)throw Error('This course package is no longer saved.');
    sessionStorage.setItem(sessionKey,JSON.stringify({trackId:id,ruleKey:course.ruleKey}));sessionStorage.setItem(pendingKey,JSON.stringify({trackId:id,ruleKey:course.ruleKey}));
    try{lab.applySettings(course.physics);}catch(error){sessionStorage.removeItem(sessionKey);sessionStorage.removeItem(pendingKey);throw error;}
  };
  lab.restoreCourseRun=async record=>{
    if(!record.courseRules||lab.trackActions?.trackId!==record.trackId)throw Error('Open this course before restoring its saved rules.');
    const code=await lab.trackActions.exportTrack(),course=lab.validateLabCourse({...record.courseRules,code});
    if(!record.physicsKey.endsWith('~course:'+lab.courseRuleKey(course)))throw Error('The saved course rules do not match this run.');
    register(course,record.trackId);return lab.startCourse(record.trackId);
  };
  const sectionValues=()=>{const values={...context.physics};for(const section of context.checkpoints)if(section.after<=checkpoint)Object.assign(values,section.values);return values;};
  const send=values=>{const signature=JSON.stringify(values);if(signature===lastSettings)return;lab.sendCourseSettings(values);lastSettings=signature;};
  const note=document.createElement('div');note.className='lab-course-hud';note.hidden=true;document.addEventListener('DOMContentLoaded',()=>document.body.append(note),{once:true});
  function reset(){checkpoint=0;passed=new Set();previous=null;lastSettings='';if(context)send(sectionValues());}
  lab.attachCoursePlayer=(car,id)=>{
    if(!context||context.trackId!==id)return;player=car;hasRaced=false;reset();
    car.addResetCallback(()=>{if(!car.hasStarted())reset();else{previous=null;checkpoint=car.getNextCheckpointIndex();lastSettings='';send(sectionValues());}});
    car.addCheckpointCallback(index=>{checkpoint=index+1;lastSettings='';send(sectionValues());});
    buildObjects();
  };
  lab.previewCourseObjects=objects=>buildObjects({objects});
  function buildObjects(course=context){
    clearObjects();const T=lab.getCourseThree(),scene=lab.getCourseScene();if(!T||!scene||!course)return;
    group=new T.YJl();group.name='Lab course objects';scene.add(group);
    for(const object of course.objects){
      let geometry;
      if(object.type==='ring'){
        geometry=new T.LoY();const vertices=[],indices=[],segments=64,r=object.size,thickness=Math.max(.2,r*.055);
        for(let n=0;n<=segments;n++){const a=n/segments*Math.PI*2;for(const radius of [r-thickness,r+thickness])vertices.push(Math.cos(a)*radius,Math.sin(a)*radius,0);if(n<segments){const k=n*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
        geometry.setAttribute('position',new T.THS(new Float32Array(vertices),3));geometry.setIndex(indices);geometry.computeVertexNormals();
      }else geometry=new T.iNn(object.size,object.type==='boost'?.15:object.size,object.size);
      const material=new T.V9B({color:object.type==='ring'?0xffdf72:object.type==='boost'?0x74eab0:0x91bfff,transparent:true,opacity:object.type==='gravity'?.13:.8,side:2,depthWrite:object.type!=='gravity'}),mesh=new T.eaF(geometry,material);
      mesh.position.set(object.x,object.y,object.z);mesh.rotation.y=object.yaw*Math.PI/180;group.add(mesh);
      if(object.type==='boost'){for(let k=-1;k<=1;k++){const stripe=new T.eaF(new T.iNn(object.size*.45,.18,.25),new T.V9B({color:0xffffff}));stripe.position.set(0,.12,k*object.size*.23);mesh.add(stripe);}}
    }
  }
  const local=(p,o)=>{const angle=o.yaw*Math.PI/180,dx=p.x-o.x,dz=p.z-o.z;return {x:dx*Math.cos(angle)-dz*Math.sin(angle),y:p.y-o.y,z:dx*Math.sin(angle)+dz*Math.cos(angle)};};
  lab.updateCourse=dt=>{
    if(!context&&!group){if(note.hidden!==true)note.hidden=true;return;}
    const racing=document.body?.dataset.labScene==='game';note.hidden=!context||!racing;
    if(racing)hasRaced=true;
    if(context&&player&&hasRaced&&!racing&&['home','browse'].includes(document.body?.dataset.labScene)){sessionStorage.removeItem(sessionKey);context=null;player=null;clearObjects();location.reload();return;}
    if(!context||!player||!racing){if(group)group.visible=!!document.querySelector('.editor-ui:not(.hidden)');return;}if(group)group.visible=true;
    elapsed+=dt;if(elapsed<1/60)return;elapsed=0;
    const position=player.getPosition(),values=sectionValues();
    for(let index=0;index<context.objects.length;index++){
      const object=context.objects[index],p=local(position,object);
      if(object.type==='ring'){
        if(previous&&!passed.has(index)){const a=local(previous,object);if(a.z*p.z<=0&&Math.abs(a.z-p.z)>.001){const t=a.z/(a.z-p.z),x=a.x+(p.x-a.x)*t,y=a.y+(p.y-a.y)*t;if(x*x+y*y<=object.size*object.size)passed.add(index);}}
      }else if(Math.abs(p.x)<=object.size/2&&Math.abs(p.z)<=object.size/2&&Math.abs(p.y)<(object.type==='boost'?2:object.size/2)){
        if(object.type==='boost')values.acceleration=Math.min(10,values.acceleration*object.strength);else values.gravity=object.strength;
      }
    }
    previous={x:position.x,y:position.y,z:position.z};try{send(values);const text=`Lab course · CP ${checkpoint} · Rings ${passed.size}/${context.objects.filter(o=>o.type==='ring').length} · Power ${values.acceleration}× · Gravity ${values.gravity}×`;if(note.textContent!==text)note.textContent=text;}catch(error){if(note.textContent!==error.message)note.textContent=error.message;}
  };
  window.addEventListener('polytrack-lab-runtime-ready',()=>{
    if(!sessionStorage.getItem(pendingKey))return;
    let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;if(!document.querySelector('.main-buttons-container:not(.hidden) .lab-home-button'))return;observer.disconnect();try{const saved=JSON.parse(sessionStorage.getItem(pendingKey));sessionStorage.removeItem(pendingKey);if(!context||context.trackId!==saved.trackId||context.ruleKey!==saved.ruleKey)throw Error('The course package changed before launch.');lab.markTrackStarting?.();lab.playTrackCode(lab.encodeLabCourse({code:context.code,name:context.name,author:context.author,notes:context.notes,physics:context.physics,checkpoints:context.checkpoints,objects:context.objects}),context.trackId);}catch(error){note.hidden=false;note.textContent=error.message;}});});observer.observe(document.getElementById('ui'),{childList:true,subtree:true});
  });
})();
