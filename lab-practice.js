/* Practice pacing changes the clock, while each native physics step stays 1 ms. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab,key='polytrack-lab.practice.v1',rates=[.25,.5,1,2,4],baseKey=lab.getPhysicsKey.bind(lab),baseReplay=lab.replayEnabled.bind(lab);
  let enabled=false,rate=1,paused=false,panelOpen=false,inputs=null,player=null,changes=[],totalChanges=0,busy=false;
  try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');enabled=saved?.enabled===true;if(rates.includes(saved?.rate))rate=saved.rate;}catch{}
  const active=()=>enabled&&!lab.getActiveCourse?.();
  const persist=()=>sessionStorage.setItem(key,JSON.stringify({enabled,rate}));
  const frame=()=>{try{return player?.getTime?.()?.numberOfFrames||0;}catch{return 0;}};
  const snapshot=()=>({enabled:active(),rate,paused,inputs:inputs?{...inputs}:null,frame:frame(),busy});
  lab.getPracticeState=snapshot;
  lab.getPhysicsKey=()=>baseKey()+(active()?'~tas':'');
  lab.replayEnabled=lab.canReplay=()=>!active()&&baseReplay();
  lab.getPracticePacket=()=>({rate:active()?rate:1,paused:panelOpen||active()&&paused,step:0,inputs:active()?inputs:null});
  const send=(step=0)=>lab.sendPractice?.({...lab.getPracticePacket(),step});
  const log=(step=0)=>{if(!active())return;const mask=inputs?Number(inputs.up)+2*Number(inputs.right)+4*Number(inputs.down)+8*Number(inputs.left):0;changes.push([frame(),rate,Number(paused),mask,step]);totalChanges++;if(changes.length>128)changes.shift();};
  lab.getPracticeRunInfo=()=>active()?{version:1,changes:changes.map(row=>row.slice()),totalChanges,truncated:totalChanges>changes.length}:null;
  lab.setPracticePanelOpen=open=>{panelOpen=open===true;send();};
  lab.attachPracticePlayer=car=>{player=car;changes=[];totalChanges=0;log();car.addResetCallback?.(()=>{if(!car.hasStarted()){changes=[];totalChanges=0;log();}});if(active()&&inputs&&Object.values(inputs).some(Boolean))queueMicrotask(()=>car.start());};
  lab.setPracticeMode=async next=>{
    if(busy)throw Error('The run is still restarting.');if(!lab.canRestartCurrentRun?.())throw Error('Start a normal track before enabling TAS practice.');
    const previous={enabled,paused,inputs};let restarting=false;enabled=next===true;paused=false;inputs=null;busy=true;
    try{persist();lab.recordAppliedSetup(lab.getSettings(),'practice');restarting=true;const restarted=await lab.restartPhysics();if(!restarted)throw Error('The run could not restart.');}
    catch(error){enabled=previous.enabled;paused=previous.paused;inputs=previous.inputs;try{persist();}catch{}if(restarting){lab.queueCurrentRunRestart?.();location.reload();}throw error;}
    finally{busy=false;}
  };
  function requirePractice(){if(!active()||document.body.dataset.labScene!=='game'||busy||lab.physicsRestarting)throw Error('Enable TAS practice on a running track first.');}
  lab.setPracticeRate=value=>{requirePractice();if(!rates.includes(value))throw Error('Choose a listed practice speed.');const previousRate=rate;rate=value;try{persist();}catch(error){rate=previousRate;throw error;}log();send();};
  lab.pausePractice=value=>{requirePractice();paused=value===true;log();send();};
  lab.stepPractice=count=>{requirePractice();if(![1,10,100].includes(count))throw Error('Choose 1, 10 or 100 ticks.');paused=true;player?.start();log(count);send(count);};
  lab.setPracticeInputs=value=>{requirePractice();if(value!==null&&(!value||typeof value!=='object'||Object.keys(value).length!==4||!['up','right','down','left'].every(key=>typeof value[key]==='boolean')))throw Error('Invalid held inputs.');inputs=value?{...value}:null;if(inputs&&Object.values(inputs).some(Boolean))player?.start();log();send();};
  function mount(){
    const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;},button=(label,fn)=>{const b=make('button','button',label);b.type='button';b.addEventListener('click',async()=>{try{await fn();notice.textContent='';}catch(error){notice.textContent=error.message;}refresh();});return b;};
    const toolbar=make('div','lab-track-tools'),physics=button('Physics Lab',()=>lab.openPhysicsLab()),tools=make('details','lab-practice-tools'),summary=make('summary','button','TAS practice'),content=make('div','lab-practice-content'),notice=make('p','lab-practice-notice');notice.setAttribute('role','status');
    physics.title='Change physics, then restart this track with your new setup.';tools.append(summary,content);toolbar.append(physics,tools,button('Racing wheel',()=>lab.openWheelSetup?.()));document.body.append(toolbar);
    const enable=button('Enable TAS & restart',()=>lab.setPracticeMode(!enabled));content.append(make('p','','Slow motion and precise steps. TAS times save separately.'),enable);
    const label=make('label','','Simulation speed '),select=make('select');select.setAttribute('aria-label','Practice simulation speed');for(const speed of rates){const o=make('option','',speed+'×');o.value=speed;select.append(o);}select.addEventListener('change',()=>{try{lab.setPracticeRate(Number(select.value));notice.textContent='';}catch(error){notice.textContent=error.message;}refresh();});label.append(select);content.append(label);
    const pause=button('Pause',()=>lab.pausePractice(!paused)),steps=make('div','lab-practice-steps');for(const ticks of [1,10,100])steps.append(button('+'+ticks+' tick'+(ticks===1?'':'s'),()=>lab.stepPractice(ticks)));content.append(pause,steps);
    const inputRow=make('div','lab-practice-inputs'),inputButtons=[];for(const [key,title] of [['up','Throttle'],['down','Brake'],['left','Left'],['right','Right']]){const b=button(title,()=>lab.setPracticeInputs({...{up:false,right:false,down:false,left:false},...inputs,[key]:!inputs?.[key]}));b.title='Hold '+title.toLowerCase()+' while paused or running';inputButtons.push([b,key]);inputRow.append(b);}const release=button('Release held inputs',()=>lab.setPracticeInputs(null));content.append(inputRow,release);
    const tick=make('output','lab-practice-frame');content.append(tick,make('p','lab-practice-help','1 tick = 1 ms. Speed changes pacing only. TAS saves time and settings, not replays.'),notice);
    function refresh(){const scene=document.body.dataset.labScene;toolbar.hidden=scene!=='game'||!!lab.getActiveCourse?.()||!lab.canRestartCurrentRun?.();const working=busy||lab.physicsRestarting;physics.disabled=working;enable.disabled=working;enable.textContent=enabled?'Return to normal & restart':'Enable TAS & restart';summary.dataset.enabled=String(active());select.value=String(rate);select.disabled=!active()||working;pause.disabled=!active()||working;pause.textContent=paused?'Resume':'Pause';for(const b of steps.children)b.disabled=!active()||working;release.disabled=!active()||working;for(const [b,key] of inputButtons){b.disabled=!active()||working||lab.getWheelState?.().enabled;b.title=lab.getWheelState?.().enabled?'Use your wheel, or disable it to hold TAS driving inputs.':'';b.setAttribute('aria-pressed',String(!!inputs?.[key]));}const text=(active()?'TAS practice':'Normal run')+' · Tick '+frame()+(active()?' · '+rate+'×'+(paused?' · Paused':''):'');if(tick.textContent!==text)tick.textContent=text;}
    for(const type of ['keydown','keyup'])toolbar.addEventListener(type,event=>{if(event.target?.closest?.('select,input')||['Space','Enter','NumpadEnter'].includes(event.code))event.stopPropagation();});refresh();setInterval(refresh,100);
  }
  document.addEventListener('DOMContentLoaded',mount,{once:true});
})();
