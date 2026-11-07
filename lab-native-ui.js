/* Native home, Custom Tracks entry and local-only edition polish. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab,ui=document.getElementById('ui');
  lab.onPanelOpen=()=>{lab.setPracticePanelOpen?.(true);window.dispatchEvent(new Event('blur'));};
  lab.onPanelClose=()=>lab.setPracticePanelOpen?.(false);
  let queued=false,homeButtonSpawned=false,trackStarting=false,bindingSignature='',runLabel='';
  lab.markTrackStarting=()=>{trackStarting=true;};
  const movementCodes=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']),heldMovement=new Map();
  document.addEventListener('keydown',event=>{if((document.body.dataset.labScene==='game'||trackStarting)&&(movementCodes.has(event.code)||Object.values(lab.getBindings()).includes(event.code))&&!(event.repeat&&event.code===lab.getBindings().jump)&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&!event.target?.closest?.('input,textarea,select,[contenteditable=true],dialog[open]'))heldMovement.set(event.code,event.key);if(event.code==='Escape'&&document.body.dataset.labScene!=='game')trackStarting=false;},true);
  document.addEventListener('click',event=>{if(event.target?.closest?.('.track-info-ui .side-panel > button.play'))lab.markTrackStarting();},true);
  document.addEventListener('keyup',event=>heldMovement.delete(event.code),true);
  window.addEventListener('blur',()=>heldMovement.clear());
  window.addEventListener('polytrack-lab-bindings-changed',()=>heldMovement.clear());
  const text=(node,value)=>{if(node.textContent!==value)node.textContent=value;};
  function ensureHome(menu){
    const footer=menu.querySelector('.button-bar');
    if(footer&&!footer.querySelector('.lab-privacy-link')){const link=document.createElement('a');link.className='button lab-privacy-link';link.href='privacy.html';link.target='_blank';link.rel='noopener';link.textContent='Lab privacy';footer.append(link);}
    const buttons=menu.querySelector('.main-buttons-container');
    if(!buttons)return;
    for(const button of buttons.querySelectorAll('button'))if(button.querySelector('img[src$="multiplayer.svg"]')){button.hidden=true;button.style.display='none';}
    if(!buttons.querySelector('.lab-home-button')){
      const button=document.createElement('button');button.type='button';button.className='button button-image lab-home-button';
      if(!homeButtonSpawned){button.classList.add('button-spawn');button.addEventListener('animationend',()=>button.classList.remove('button-spawn'),{once:true});homeButtonSpawned=true;}
      const icon=document.createElement('img');icon.src='images/lab.svg';icon.alt='';
      const name=document.createElement('p');name.textContent='Physics Lab';
      button.append(icon,name);
      button.addEventListener('click',()=>{if(!buttons.classList.contains('hidden')){if(lab.openPhysicsLab)lab.openPhysicsLab();else window.dispatchEvent(new Event('lab-open'));}});
      buttons.append(button);
    }
    const labButton=buttons.querySelector('.lab-home-button');
    if(buttons.lastElementChild!==labButton)buttons.append(labButton);
    const visible=[...buttons.querySelectorAll('button')].filter(button=>!button.hidden);
    visible.forEach((button,index)=>{if(!button.dataset.labOrder){button.dataset.labOrder=String(index+1);button.style.animationDelay=(.3+index*.1)+'s';}});
    const home=!buttons.classList.contains('hidden')&&!menu.classList.contains('loading-screen');
    const logo=menu.querySelector(':scope > .logo');
    if(logo&&!menu.querySelector('.lab-wordmark')){const word=document.createElement('div');word.className='lab-wordmark';word.textContent='LAB';logo.after(word);}
    const word=menu.querySelector('.lab-wordmark');if(word)word.hidden=!home;
    return home;
  }
  function ensureExtra(menu){
    const wrapper=menu.querySelector('.track-selection-ui .tracks-container.no-group-containers > .wrapper');
    if(!wrapper||wrapper.querySelector('.lab-extra-entry'))return;
    const card=document.createElement('div');card.className='track sq-extra-tracks-entry lab-extra-entry';
    const button=document.createElement('button');button.type='button';button.className='button';
    const title=document.createElement('div');title.className='track-title';const name=document.createElement('p');name.textContent='Extra Tracks';title.append(name);
    const icon=document.createElement('img');icon.className='thumbnail';icon.src='images/extra-tracks.svg';icon.alt='';
    const count=document.createElement('div');count.className='record';count.textContent='263 tracks';
    button.append(title,icon,count);card.append(button);wrapper.prepend(card);
    button.addEventListener('click',async()=>{
      button.disabled=true;count.textContent='Opening track library…';
      try{await lab.openExtraTracks();count.textContent='263 tracks';}
      catch(error){count.textContent=error.message||'Could not open tracks. Try again.';}
      finally{button.disabled=false;}
    });
  }
  function update(){
    queued=false;
    if(!ui.querySelector('.settings-menu-ui,.setting')){const signature=JSON.stringify(lab.getNativeReservedBindingCodes?.()||[]);if(signature!==bindingSignature){bindingSignature=signature;try{lab.reconcileBindings?.();}catch(error){lab.bindingNotice=error.message;}}}
    const menu=ui.querySelector(':scope > .menu-ui');
    const home=menu?ensureHome(menu):false;
    if(menu){ensureExtra(menu);ensureRunway(menu);ensureRunwayDemo();}
    for(const weekly of ui.querySelectorAll('.track-of-the-week'))if(!weekly.querySelector('.lab-weekly-source')){
      const source=document.createElement('span');source.className='lab-weekly-source';source.textContent=lab.weeklyStatus?.source==='live'?'Live Kodub selection':'Saved Kodub selection';weekly.append(source);
    }
    const race=!!ui.querySelector(':scope > .game-ui');
    const spectating=race&&(!!ui.querySelector(':scope > .game-ui img[src$="graph.svg"]')||[...ui.querySelectorAll(':scope > .game-ui button')].some(button=>button.textContent.trim()==='Graphs'));
    const scene=home?'home':menu?'browse':spectating?'replay':race?'game':'other';
    const previousScene=document.body.dataset.labScene;
    if(document.body.dataset.labScene!==scene)document.body.dataset.labScene=scene;
    if(previousScene==='game'&&scene!=='game')heldMovement.clear();
    if(scene==='game'){trackStarting=false;if(previousScene!=='game'&&heldMovement.size)requestAnimationFrame(()=>{for(const [code,key] of heldMovement)document.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true}));});}
    for(const watermark of ui.querySelectorAll('#static-more-games-watermark')){
      watermark.setAttribute('aria-label','More unblocked games by Static');
    }
    for(const image of ui.querySelectorAll('img[src$="logo.svg"]'))image.alt='PolyTrack Lab';
    for(const best of ui.querySelectorAll('.track-info-ui .personal-best')){const row=best.children[1];if(row&&!row.classList.contains('lab-pb-setup-row')){row.classList.add('lab-pb-setup-row');const icon=document.createElement('img');icon.src='images/lab.svg';icon.alt='';const name=document.createElement('span');name.className='lab-pb-setup';name.textContent=lab.getSetupIdentity().label;name.title='Current physics setup';row.replaceChildren(icon,name);}}
    if(lab.replayEnabled?.()===false)for(const button of ui.querySelectorAll('button'))if(/^(Watch|Watch replay)$/.test(button.textContent.trim())){
      if(button.dataset.labPublicSelection==='true')continue;if(!button.disabled)button.disabled=true;
      button.title='Extra controls save time and setup. Their input format does not support replay playback.';
    }
    if(lab.replayEnabled?.()===false){
      for(const button of ui.querySelectorAll('.leaderboard-ui > .container button'))if(!button.disabled){button.disabled=true;button.title='Time saved locally. Replays are unavailable with interactive mechanics.';}
    }
    for(const note of ui.querySelectorAll('.track-info-ui .no-opponents'))text(note,lab.replayEnabled?.()===false?'Times and setups save locally. Extra control runs do not have replay playback.':'Click a saved time for its physics and replay actions.');
    const hint=document.getElementById('lab-mechanics-hint');
    if(hint){const config=lab.getSettings();const keys=[];if(!race)runLabel='';if(race&&!runLabel){const identity=lab.getSetupIdentity(config),save=lab.getSetupHistory()[0];runLabel=identity.label+(lab.getActiveCourse?.()?" · Course rules":"")+(save?.saveNumber?' · Save #'+save.saveNumber:'')+(lab.getPracticeState?.().enabled?' · TAS practice':'')+(lab.getWheelState?.().enabled?' · Wheel '+(lab.getWheelState().mode==='modified'?'Modified':'Original'):'');}for(const [action,label] of [['boost','Boost'],['handbrake','Slide'],['jump','Jump']])if(config[action]>0)keys.push((lab.isMechanicBindingEnabled?.(action)===false?'Choose a free key':lab.getBindingLabel(action))+' '+label);if(config.airJumps>0)keys.push(config.airJumps+" air jump"+(config.airJumps===1?"":"s"));text(hint,spectating?'Watching replay · Your physics setup is kept.':[runLabel,...keys].filter(Boolean).join(' · '));hint.hidden=!race;}
  }
  function ensureRunway(menu){
    const wrapper=menu.querySelector('.track-selection-ui .tracks-container.no-group-containers > .wrapper');if(!wrapper)return;
    const id='dfcdc5ee1d27ece87ee65a36075439b3a7148d06b67fbcf6c352897e98d884b7';
    if(lab.isExtraTrackSaved?.({trackId:id})){wrapper.querySelector('.lab-runway-entry')?.remove();return;}
    if(wrapper.querySelector('.lab-runway-entry'))return;
    const card=document.createElement('div');card.className='track lab-runway-entry';
    const button=document.createElement('button');button.type='button';button.className='button';
    const title=document.createElement('div');title.className='track-title';const name=document.createElement('p');name.textContent='Lab Runway: Desert Skyway';title.append(name);
    const image=document.createElement('img');image.className='thumbnail';image.src='lab-tracks/runway.svg?v=4';image.alt='';
    const note=document.createElement('div');note.className='record';note.textContent='3 km · 60 m above the desert';button.append(title,image,note);card.append(button);
    wrapper.querySelector('.lab-extra-entry')?.after(card);
    button.addEventListener('click',async()=>{
      button.disabled=true;note.textContent='Preparing the runway…';
      try{
        const meta=await(await fetch('lab-tracks/runway.json')).json();const parsed=await lab.saveTrainingTrack(meta);
        await new Promise(requestAnimationFrame);
        const target=[...document.querySelectorAll('.track-selection-ui .tracks-container.no-group-containers .track-title p')].find(p=>p.textContent.trim()===parsed.trackMetadata.name&&!p.closest('.lab-runway-entry'));
        if(!target)throw Error('The course was saved. Reopen Custom tracks to play.');
        target.closest('button').click();
      }catch(error){note.textContent=error.message||'Could not open the runway.';button.disabled=false;}
    });
  }
  function ensureRunwayDemo(){
    const panel=ui.querySelector('.track-info-ui .side-panel'),id=lab.trackActions?.trackId,runway=id==='dfcdc5ee1d27ece87ee65a36075439b3a7148d06b67fbcf6c352897e98d884b7';
    if(!panel)return;if(!runway){panel.querySelector('.lab-runway-demo')?.remove();return;}if(panel.querySelector('.lab-runway-demo'))return;
    const demo=document.createElement('button');demo.type='button';demo.className='button lab-runway-demo';demo.textContent='Try boosts & rings';demo.title='Temporary demo: boost pads, rings, double jumps and changing gravity. Your setup returns when you leave.';
    panel.querySelector('button.play')?.before(demo);
    demo.addEventListener('click',async()=>{demo.disabled=true;try{const response=await fetch('lab-tracks/runway-demo.json');if(!response.ok)throw Error('The demo could not load.');const course=await response.json(),row=lab.importCourseCode(lab.encodeLabCourse(course));await lab.startCourse(row.trackId);}catch(error){demo.textContent=error.message;demo.disabled=false;}});
  }
  const hint=document.createElement('div');hint.id='lab-mechanics-hint';hint.title='Physics for this run. The game HUD place is local to this setup.';hint.hidden=true;document.body.append(hint);
  const replayError=document.createElement('div');replayError.className='lab-replay-error';replayError.setAttribute('role','status');replayError.hidden=true;document.body.append(replayError);
  window.addEventListener('polytrack-lab-replay-error',event=>{replayError.textContent='Ghost unavailable: '+(event.detail?.message||'The recording could not load.')+' Your setup was kept.';replayError.hidden=false;});
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(update);}}).observe(ui,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
  update();
  document.addEventListener('keydown',event=>{
    if(!['Space','Enter','NumpadEnter'].includes(event.code)||event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
    if(document.querySelector('dialog[open],.sq-extra-overlay:not([hidden])')||event.target?.closest?.('input,select,textarea,[contenteditable=true],button,a,summary,[role=tab],[role=button],[role=checkbox]'))return;
    const play=ui.querySelector('.track-info-ui .side-panel > button.play');
    if(play&&!play.disabled){event.preventDefault();event.stopImmediatePropagation();play.click();}
  },true);
})();

/* The fifth home slot follows the native menu through every rebuild. */
