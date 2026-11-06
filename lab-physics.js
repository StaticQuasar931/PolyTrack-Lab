/* PolyTrack Lab: local physics profiles. No settings are transmitted. */
(() => {
  'use strict';
  const fields = [
    {key:'acceleration',label:'Acceleration',min:0.1,max:5,step:0.1,default:1,unit:'×',description:'Scales the engine force while accelerating.',left:'Gentle',right:'Rapid'},
    {key:'reverse',label:'Reverse power',min:0.1,max:5,step:0.1,default:1,unit:'×',description:'Scales the engine force used to reverse.',left:'Gentle',right:'Strong'},
    {key:'braking',label:'Braking',min:0.1,max:5,step:0.1,default:1,unit:'×',description:'Scales all four wheel brakes.',left:'Soft',right:'Hard'},
    {key:'grip',label:'Tire grip',min:0.1,max:3,step:0.1,default:1,unit:'×',description:'Scales tire traction. Low grip makes sliding easier.',left:'Slippery',right:'Sticky'},
    {key:'steering',label:'Steering strength',min:0.2,max:2,step:0.1,default:1,unit:'×',description:'Scales the actual front wheel steering angle.',left:'Wide turns',right:'Sharp turns'},
    {key:'downforce',label:'Aerodynamic downforce',min:0,max:5,step:0.1,default:1,unit:'×',description:'Scales the speed-dependent force that presses the car toward the road.',left:'None',right:'Strong'},
    {key:'coasting',label:'Coasting slowdown',min:0,max:5,step:0.1,default:0,unit:' /s',description:'Adds slowing while grounded with acceleration and brake released. Zero keeps the original behavior.',left:'Original',right:'Stops quickly'},
    {key:'maxSpeed',label:'Speed limit',min:0,max:1500,step:10,default:0,unit:' km/h',description:'Caps the car’s total velocity. Zero keeps the original uncapped behavior.',left:'0 = original',right:'1500 km/h'},
    {key:'boost',label:'Boost power',min:0,max:5,step:0.1,default:0,unit:'×',description:'Hold B while accelerating to add engine power. Zero disables boost. Boost runs save times; ghosts and replays are unavailable.',left:'Off',right:'Strong boost'},
    {key:'handbrake',label:'Handbrake strength',min:0,max:5,step:0.1,default:0,unit:'×',description:'Hold N to brake the rear wheels and loosen their grip for sliding. Zero disables this extra control. Enabled runs save times without ghosts or replays.',left:'Off',right:'Strong rear brake'},
    {key:'jump',label:'Jump strength',min:0,max:20,step:0.5,default:0,unit:' m/s',description:'Press J with at least two wheels grounded to add upward velocity. A 0.75 second cooldown prevents repeated jumps. Zero disables jumping. Enabled runs save times without ghosts or replays.',left:'Off',right:'High jump'},
    {key:'gravity',label:'Gravity',min:0,max:2,step:0.05,default:1,unit:'×',description:'Scales the real downward gravitational force. Low values make airtime longer; zero removes gravity. Downforce remains a separate setting.',left:'Weightless',right:'Heavy'}
  ];
  // The workshop starts with the original practical ranges. Extended mode can
  // expose these additional engine-tested limits without changing presets.
  const extendedMaxima={acceleration:10,reverse:10,braking:10,grip:5,downforce:10,coasting:10,maxSpeed:3000,boost:10,jump:40,gravity:4};
  for(const field of fields){field.normalMax=field.max;field.max=extendedMaxima[field.key]??field.max;}
  const storageKey='polytrack-lab.physics.v1';
  const normalize = input => Object.fromEntries(fields.map(f => [f.key, typeof input?.[f.key] === 'number' && Number.isFinite(input[f.key]) ? Math.min(f.max, Math.max(f.min, input[f.key])) : f.default]));
  let settings;
  try { settings=normalize(JSON.parse(localStorage.getItem(storageKey)||'null')); } catch { settings=normalize(null); }
  // Preserve keys for existing v1 profiles when the two new mechanics are off.
  const fingerprint = s => fields.every(f=>s[f.key]===f.default) ? 'stock' : fields.filter(f=>!['handbrake','jump','gravity'].includes(f.key)||s[f.key]!==f.default).map(f=>`${f.key}:${s[f.key]}`).join('|');
  const replayEnabled = () => settings.boost===0&&settings.handbrake===0&&settings.jump===0;
  const preset = (id,name,description,values) => ({id,name,description,values:normalize(values)});
  const presets=[
    preset('standard','Original','The original PolyTrack feel. All extra mechanics are off.',{}),
    preset('arcade','Arcade','Stronger acceleration, grip and braking for responsive driving.',{acceleration:1.5,grip:1.5,braking:1.5}),
    preset('drift','Drift','Lower tire grip and sharper steering make slides easier.',{grip:0.4,steering:1.3}),
    preset('rocket','Rocket','Three times the engine force, plus a held-B boost.',{acceleration:3,boost:2}),
    preset('gentle','Gentle','Milder acceleration and a 150 km/h cap for learning a track.',{acceleration:0.6,maxSpeed:150}),
    preset('stunt','Stunt park','B to boost, N to slide, J to jump. A playful setup for open tracks.',{acceleration:1.4,maxSpeed:400,boost:1,handbrake:1,jump:8}),
    preset('lowgravity','Low gravity','Quarter gravity and light downforce for longer airtime.',{gravity:0.25,downforce:0.2,acceleration:1.1}),
    {...preset('random','Random mix','A new mix of moderate settings each time. Locked controls stay yours.',{}),random:true}
  ];
  const presetNumbers={standard:0,arcade:1,drift:2,rocket:3,gentle:4,stunt:5,lowgravity:6};
  presets.filter(entry=>!entry.random).forEach(entry=>{entry.presetId=presetNumbers[entry.id];});
  const randomizeSettings = () => {
    const pick=(min,max,step=0.1)=>Number((Math.round((min+Math.random()*(max-min))/step)*step).toFixed(3));
    return normalize({acceleration:pick(.5,2.5),reverse:pick(.5,2),braking:pick(.5,2.5),grip:pick(.3,2),steering:pick(.6,1.5),downforce:pick(0,2.5),coasting:Math.random()<.5?0:pick(.2,1.5),maxSpeed:Math.random()<.5?0:pick(150,600,10),boost:Math.random()<.6?0:pick(.5,2),handbrake:Math.random()<.6?0:pick(.5,2),jump:Math.random()<.6?0:pick(3,10,.5),gravity:Math.random()<.6?1:pick(.25,1.5,.05)});
  };
  const setupsKey='polytrack-lab.setups.v1';
  const getSavedSetups=()=>{try{const entries=JSON.parse(localStorage.getItem(setupsKey)||'[]');return Array.isArray(entries)?entries.filter(entry=>typeof entry?.id==='string'&&typeof entry?.name==='string'&&entry.name.trim()).slice(0,30).map(entry=>({id:entry.id,name:entry.name.slice(0,40),values:normalize(entry.values)})):[];}catch{return [];}};
  const saveSetup=(name,values)=>{
    if(typeof name!=='string'||!name.trim())throw Error('Give this setup a name first.');
    name=name.trim().slice(0,40);
    const entries=getSavedSetups(),existing=entries.find(entry=>entry.name.toLowerCase()===name.toLowerCase());
    if(!existing&&entries.length>=30)throw Error('You can save up to 30 setups. Delete one before adding another.');
    const entry={id:existing?.id||(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)),name,values:normalize(values)};
    if(existing)entries.splice(entries.indexOf(existing),1,entry);else entries.push(entry);
    localStorage.setItem(setupsKey,JSON.stringify(entries));return {...entry,values:{...entry.values}};
  };
  const deleteSetup=id=>{const entries=getSavedSetups(),next=entries.filter(entry=>entry.id!==id);localStorage.setItem(setupsKey,JSON.stringify(next));return next.length!==entries.length;};
  const getSetupIdentity=(input=settings)=>{
    const values=normalize(input),key=fingerprint(values),match=presets.find(entry=>!entry.random&&fingerprint(entry.values)===key);
    if(match)return {kind:'preset',presetId:match.presetId,id:match.id,name:match.name,label:match.presetId+' · '+match.name,fingerprint:key};
    const saved=getSavedSetups().find(entry=>fingerprint(entry.values)===key),name=saved?.name||'Custom setup';
    return {kind:'custom',presetId:null,id:'custom',name,label:name,fingerprint:key,...(saved?{savedSetupId:saved.id}:{})};
  };
  const describeSettings=(input=settings)=>{const values=normalize(input),changed=fields.filter(field=>values[field.key]!==field.default);return changed.length?changed.map(field=>field.label+' '+values[field.key]+field.unit).join(', '):'Original physics';};
  const enableAllMechanics=(input=settings)=>{const values=normalize(input);return {...values,boost:Math.max(1,values.boost),handbrake:Math.max(1,values.handbrake),jump:Math.max(8,values.jump)};};
  const historyKey='polytrack-lab.setup-history.v1';
  const historyCounterKey='polytrack-lab.setup-history-counter.v1';
  const getSetupHistory=()=>{
    try{
      const stored=JSON.parse(localStorage.getItem(historyKey)||'[]');
      if(!Array.isArray(stored))return [];
      const entries=stored.filter(entry=>typeof entry?.id==='string'&&entry.id.length<=100&&Number.isFinite(Date.parse(entry.appliedAt))&&entry.values&&typeof entry.values==='object').slice(0,20);
      return entries.map((entry,index)=>{const values=normalize(entry.values),identity=getSetupIdentity(values);return {id:entry.id,saveNumber:Number.isSafeInteger(entry.saveNumber)&&entry.saveNumber>0?entry.saveNumber:entries.length-index,appliedAt:entry.appliedAt,reason:['initial','apply','restore'].includes(entry.reason)?entry.reason:'apply',presetId:identity.presetId,name:identity.kind==='preset'?identity.name:String(entry.name||identity.name).slice(0,40),values,fingerprint:identity.fingerprint};});
    }catch{return [];}
  };
  const recordAppliedSetup=(input=settings,reason='apply')=>{
    const previous=getSetupHistory(),storedCounter=Number(localStorage.getItem(historyCounterKey)||0),counter=Number.isSafeInteger(storedCounter)&&storedCounter>=0?storedCounter:0;
    const saveNumber=Math.max(counter,...previous.map(entry=>entry.saveNumber),0)+1;
    if(!Number.isSafeInteger(saveNumber))throw Error('Setup save numbering has reached its limit.');
    const values=normalize(input),identity=getSetupIdentity(values),entry={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),saveNumber,appliedAt:new Date().toISOString(),reason:['initial','apply','restore'].includes(reason)?reason:'apply',presetId:identity.presetId,name:identity.name,values,fingerprint:identity.fingerprint};
    // Reserve a number first. Failed saves may leave a gap, never a reused number.
    localStorage.setItem(historyCounterKey,String(saveNumber));
    localStorage.setItem(historyKey,JSON.stringify([entry,...previous].slice(0,20)));return {...entry,values:{...values}};
  };
  const getActiveSetupHistoryEntry=()=>{const current=getSetupHistory()[0];return current?.fingerprint===fingerprint(settings)?current:recordAppliedSetup(settings,current?'restore':'initial');};
  // History is helpful metadata; unavailable storage must not stop game startup.
  try{getActiveSetupHistoryEntry();}catch{}
  const defaultBindings={boost:'KeyB',handbrake:'KeyN',jump:'KeyJ'};
  const reservedLetters=new Set(['W','A','S','D','R','T','C','M','H','P']);
  const baseBindingCodes='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(letter=>!reservedLetters.has(letter)).map(letter=>'Key'+letter);
  const getNativeReservedCodes=()=>{try{const codes=window.PolyTrackLab?.getNativeReservedBindingCodes?.();return new Set(Array.isArray(codes)?codes:[]);}catch{return new Set();}};
  const getAllowedBindingCodes=()=>{const reserved=getNativeReservedCodes();return baseBindingCodes.filter(code=>!reserved.has(code));};
  const validateBindings=(input,allowNativeConflict=false)=>{
    if(!input||typeof input!=='object')throw Error('Choose a key for boost, handbrake, and jump.');
    const next={};
    for(const action of Object.keys(defaultBindings)){let code=input[action];if(typeof code==='string'&&/^[a-z]$/i.test(code))code='Key'+code.toUpperCase();if(!baseBindingCodes.includes(code))throw Error('Choose a letter key that is not used by the original driving controls.');if(!allowNativeConflict&&!getAllowedBindingCodes().includes(code))throw Error('This key is already used by a driving or game shortcut.');next[action]=code;}
    if(new Set(Object.values(next)).size!==3)throw Error('Boost, handbrake, and jump need different keys.');
    return next;
  };
  const bindingsKey='polytrack-lab.bindings.v1';
  let bindings={...defaultBindings},onBindingsChanged=()=>{},bindingNotice='';
  try{const stored=JSON.parse(localStorage.getItem(bindingsKey)||'null');if(stored)bindings=validateBindings(stored,true);}catch{}
  const getBindings=()=>({...bindings});
  const isMechanicBindingEnabled=action=>getAllowedBindingCodes().includes(bindings[action]);
  const getBindingLabel=action=>(bindings[action]||'').replace(/^Key/,'');
  const updateBindingDescriptions=()=>{
    fields.find(field=>field.key==='boost').description='Hold '+getBindingLabel('boost')+' while accelerating to add engine power. Zero disables boost. Boost runs save times; ghosts and replays are unavailable.';
    fields.find(field=>field.key==='handbrake').description='Hold '+getBindingLabel('handbrake')+' to brake the rear wheels and loosen their grip for sliding. Zero disables this extra control. Enabled runs save times without ghosts or replays.';
    fields.find(field=>field.key==='jump').description='Press '+getBindingLabel('jump')+' with at least two wheels grounded to add upward velocity. A 0.75 second cooldown prevents repeated jumps. Zero disables jumping. Enabled runs save times without ghosts or replays.';
    presets.find(entry=>entry.id==='stunt').description=getBindingLabel('boost')+' to boost, '+getBindingLabel('handbrake')+' to slide, '+getBindingLabel('jump')+' to jump. A playful setup for open tracks.';
  };
  const publishBindings=notice=>{bindingNotice=notice;if(window.PolyTrackLab)window.PolyTrackLab.bindingNotice=notice;updateBindingDescriptions();onBindingsChanged();if(typeof window.dispatchEvent==='function'&&typeof CustomEvent==='function')window.dispatchEvent(new CustomEvent('polytrack-lab-bindings-changed',{detail:getBindings()}));return getBindings();};
  const setBindings=input=>{const next=validateBindings(input);localStorage.setItem(bindingsKey,JSON.stringify(next));bindings=next;return publishBindings('');};
  const reconcileBindings=()=>{
    const allowed=getAllowedBindingCodes(),conflicts=Object.keys(defaultBindings).filter(action=>!allowed.includes(bindings[action]));
    if(!conflicts.length){if(bindingNotice)publishBindings('');return getBindings();}
    if(allowed.length<3)return publishBindings('Some Lab controls are off: not enough free letter keys.');
    const next={...bindings},used=new Set(Object.keys(defaultBindings).filter(action=>!conflicts.includes(action)).map(action=>bindings[action]));
    for(const action of conflicts){const preferred=defaultBindings[action],replacement=allowed.includes(preferred)&&!used.has(preferred)?preferred:allowed.find(code=>!used.has(code));next[action]=replacement;used.add(replacement);}
    try{localStorage.setItem(bindingsKey,JSON.stringify(next));bindings=next;return publishBindings('Lab keys adjusted to avoid driving shortcuts.');}
    catch{return publishBindings('Lab key changes could not be saved. Conflicting controls are off.');}
  };
  updateBindingDescriptions();
  const NativeWorker=window.Worker;
  const workers=new Set();
  let boostHeld=false,handbrakeHeld=false,jumpSequence=0,jumpStartPending=false;
  const inGameScene=()=>{const scene=document.body?.dataset?.labScene;return scene===undefined||scene===''||scene==='game';};
  const consumeJumpStart=()=>{const pending=jumpStartPending;jumpStartPending=false;return pending&&settings.jump>0&&isMechanicBindingEnabled('jump')&&inGameScene();};
  window.Worker=class extends NativeWorker {
    constructor(url,options){
      const target=new URL(url,location.href);
      const physics=target.pathname.endsWith('/simulation_worker.bundle.js');
      if(physics){target.pathname=target.pathname.replace(/simulation_worker\.bundle\.js$/,'lab-physics-worker.js');target.searchParams.set('lab','1.2.0');target.hash=encodeURIComponent(JSON.stringify(settings));}
      super(physics?target.href:url,options);
      if(physics){workers.add(this);this.postMessage({labPhysics:true,boost:boostHeld,handbrake:handbrakeHeld,jumpSequence});}
    }
    terminate(){workers.delete(this);super.terminate();}
  };
  const sendActions=(cancelJump=false)=>{for(const worker of workers)worker.postMessage({labPhysics:true,boost:boostHeld,handbrake:handbrakeHeld,jumpSequence,cancelJump});};
  onBindingsChanged=()=>{boostHeld=false;handbrakeHeld=false;jumpStartPending=false;sendActions(true);};
  document.addEventListener('keydown',event=>{if(!inGameScene()||event.repeat||event.ctrlKey||event.altKey||event.metaKey||!getAllowedBindingCodes().includes(event.code)||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)||event.target?.isContentEditable)return;if(event.code===bindings.boost&&settings.boost>0)boostHeld=true;else if(event.code===bindings.handbrake&&settings.handbrake>0)handbrakeHeld=true;else if(event.code===bindings.jump&&settings.jump>0){jumpSequence++;jumpStartPending=true;}else return;sendActions();});
  document.addEventListener('keyup',event=>{if(event.code===bindings.boost)boostHeld=false;else if(event.code===bindings.handbrake)handbrakeHeld=false;else return;sendActions();});
  window.addEventListener('blur',()=>{boostHeld=false;handbrakeHeld=false;jumpStartPending=false;sendActions(true);});
  window.PolyTrackLab={...(window.PolyTrackLab||{}),fields,presets,getSavedSetups,saveSetup,deleteSetup,randomizeSettings,consumeJumpStart,getBindings,setBindings,reconcileBindings,bindingNotice,isMechanicBindingEnabled,getBindingLabel,getAllowedBindingCodes,getSetupIdentity,describeSettings,enableAllMechanics,getSetupHistory,recordAppliedSetup,getActiveSetupHistoryEntry,getSettings:()=>({...settings}),canReplay:replayEnabled,replayEnabled,getPhysicsKey:()=>fingerprint(settings),getDefaults:()=>normalize(null),
    saveSettings(input){const next=normalize(input);localStorage.setItem(storageKey,JSON.stringify(next));settings=next;return {...settings};},
    applySettings(input){
      const previous={...settings};this.saveSettings(input);
      try{recordAppliedSetup(settings);}
      catch(error){
        let rollbackError;
        try{localStorage.setItem(storageKey,JSON.stringify(previous));}
        catch(failure){rollbackError=failure;}
        finally{settings=previous;}
        if(rollbackError){const failure=new Error((error?.message||'Setup history could not be saved.')+' Active physics was kept, but the previous saved setup could not be restored. Keep this page open, free browser storage space, and retry Apply before reloading.');failure.cause=error;failure.rollbackError=rollbackError;throw failure;}
        throw error;
      }
      location.reload();
    }
  };
})();

/* The solver baseline stays intact while the workbench draft changes. */
