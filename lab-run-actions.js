/* Local experiment details and bundled public replay playback. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab,key='polytrack-lab.resume.v1',cache=new Map();let dialogToken=0;
  const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const time=ms=>`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;
  const dialog=make('dialog','lab-run-dialog'),title=make('h2'),content=make('div','lab-run-content'),status=make('p','lab-run-status'),actions=make('div','lab-run-buttons');dialog.setAttribute('aria-label','Run details');dialog.append(title,content,status,actions);document.body.append(dialog);
  const button=(text,fn)=>{const b=make('button','button',text);b.type='button';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(error){status.textContent=error.message;}finally{b.disabled=false;}});actions.append(b);return b;};
  function open(heading){dialogToken++;title.textContent=heading;content.replaceChildren();actions.replaceChildren();status.textContent='';if(!dialog.open)dialog.showModal();button('Back',()=>dialog.close());return dialogToken;}
  function details(values){if(!values){content.append(make('p','','This older run has no recoverable physics settings.'));return;}const dl=make('dl','lab-run-values');for(const f of lab.fields){if(values[f.key]!==f.default){dl.append(make('dt','',f.label),make('dd','',values[f.key]+f.unit));}}if(!dl.children.length)content.append(make('p','','Original physics. Nothing changed.'));else content.append(dl);}
  async function codeFor(trackId){if(lab.trackActions?.trackId!==trackId)throw Error('Open this track before using its run.');return lab.trackActions.exportTrack();}
  async function restart(record,type){if(record.courseRules)return lab.restoreCourseRun(record);const code=await codeFor(record.trackId);if(type==='local-watch'||type==='local-race')lab.ensureGhostsVisible?.();sessionStorage.setItem(key,JSON.stringify({type,trackId:record.trackId,runId:record.runId,code}));try{await lab.restoreRunSettings(record);}catch(error){sessionStorage.removeItem(key);throw error;}}
  lab.showRunDetails=record=>{
    open(`${time(record.timeMs)} · ${record.setupLabel||record.presetName}`);
    content.append(make('p','lab-run-meta',`${record.nickname || 'Anonymous'} (you) · ${record.saveNumber?'Save #'+record.saveNumber:'Earlier save'} · ${new Date(record.date).toLocaleString(undefined,{dateStyle:'short',timeStyle:'medium'})}`));
    details(record.physicsValues);
    if(record.courseRules)content.append(make("p","lab-run-meta","Saved course rules: "+record.courseRules.checkpoints.length+" physics sections and "+record.courseRules.objects.length+" Lab objects. Restoring this run restores those rules too."));
    if(record.physicsValues)button('Use setup & play',()=>restart(record,'play'));
    if(record.replayAvailable)button('Watch replay',async()=>{if(!record.isCurrentSetup)return restart(record,'local-watch');if(lab.trackActions?.trackId!==record.trackId)throw Error('Open this track before watching its replay.');const replay=lab.getLocalReplay(record);if(!replay)throw Error('This recording is unavailable.');lab.ensureGhostsVisible?.();dialog.close();lab.trackActions.watch([replay]);});
    else content.append(make('p','lab-run-meta',record.physicsValues&&['boost','handbrake','jump'].some(key=>record.physicsValues[key]>0)?'Time and setup saved. Extra control inputs cannot be replayed.':'Time and setup saved. This older run has no retained replay.'));
    if(record.replayAvailable)button('Race this ghost',async()=>{if(!record.isCurrentSetup)return restart(record,'local-race');if(lab.trackActions?.trackId!==record.trackId)throw Error('Open this track before racing its ghost.');const replay=lab.getLocalReplay(record);if(!replay)throw Error('This recording is unavailable.');lab.ensureGhostsVisible?.();dialog.close();lab.markTrackStarting?.();lab.trackActions.race([replay]);});
  };
  async function replayFile(trackId){if(!cache.has(trackId))cache.set(trackId,fetch(`snapshots/replays/${trackId}.json`).then(async r=>{if(!r.ok){cache.delete(trackId);return null;}const text=await r.text();if(text.length>=20000000)throw Error('Replay file exceeds the size limit.');const v=JSON.parse(text);if(v.trackId!==trackId||v.physics!=='stock'||!Array.isArray(v.entries))throw Error('Invalid replay capture.');return v;}).catch(error=>{cache.delete(trackId);throw error;}));return cache.get(trackId);}
  lab.getPublicReplayCapture=replayFile;
  lab.playPublicSelection=async(trackId,entries,mode='watch')=>{
    if(!['watch','race'].includes(mode)||!Array.isArray(entries)||!entries.length||entries.length>10)throw Error('Select between 1 and 10 public ghosts.');
    const capture=await replayFile(trackId);
    const rows=entries.map(entry=>capture?.entries.find(row=>row.rank===entry.rank&&row.nickname===entry.nickname&&row.timeMs===entry.timeMs&&row.status==='available'));
    if(rows.some(row=>!row))throw Error('One or more selected results have no saved recording. Choose another result.');
    if(lab.trackActions?.trackId!==trackId)throw Error('Open this track before using its ghosts.');
    lab.ensureGhostsVisible?.();
    if(lab.getPhysicsKey()!=='stock'){
      const code=await codeFor(trackId);
      sessionStorage.setItem(key,JSON.stringify({type:'public-selection',mode,trackId,code,entries:rows.map(({rank,nickname,timeMs,recordingId})=>({rank,nickname,timeMs,recordingId}))}));
      try{await lab.applySettings(lab.getDefaults());}catch(error){sessionStorage.removeItem(key);throw error;}return;
    }
    const replays=rows.map(row=>lab.decodePublicReplay(row));dialog.close();
    if(mode==='race'){lab.markTrackStarting?.();lab.trackActions.race(replays);}else lab.trackActions.watch(replays);
  };
  lab.showPublicReplay=async(trackId,entry)=>{
    const request=open(`#${entry.rank} · ${entry.nickname} · ${time(entry.timeMs)}`);status.textContent='Loading saved replay…';
    let capture;try{capture=await replayFile(trackId);}catch(error){if(request===dialogToken&&dialog.open)status.textContent=error.message;return;}
    if(request!==dialogToken||!dialog.open)return;
    const row=capture?.entries.find(r=>r.rank===entry.rank&&r.timeMs===entry.timeMs&&r.nickname===entry.nickname);
    if(!row||row.status!=='available'){status.textContent='No saved replay is available for this result.';return;}
    status.textContent='Original physics · saved public replay and car style';
    button('Watch replay',()=>lab.playPublicSelection(trackId,[row],'watch'));
    button('Race this ghost',()=>lab.playPublicSelection(trackId,[row],'race'));
  };
  let outside=false;
  const isOutside=e=>{const r=dialog.getBoundingClientRect();return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom;};
  dialog.addEventListener('pointerdown',e=>{outside=e.target===dialog&&isOutside(e);});dialog.addEventListener('click',e=>{if(outside&&e.target===dialog&&isOutside(e))dialog.close();outside=false;});
  for(const type of ['keydown','keyup','pointerdown','pointerup','click'])dialog.addEventListener(type,e=>e.stopPropagation());
  async function resume(){
    let pending;try{pending=JSON.parse(sessionStorage.getItem(key)||'null');sessionStorage.removeItem(key);if(!pending)return;if(!/^[a-f0-9]{64}$/.test(pending.trackId)||typeof pending.code!=='string')throw Error('Invalid saved run destination.');
      if(pending.type!=='play')lab.ensureGhostsVisible?.();
      if(pending.type==='play'){lab.markTrackStarting?.();await lab.playTrackCode(pending.code,pending.trackId);}
      else if(pending.type==='local-watch'){const record=lab.getLocalRun?.(pending.runId,pending.trackId)||lab.getTrackExperiments(pending.trackId).find(r=>r.runId===pending.runId);const replay=record&&lab.getLocalReplay(record);if(!replay)throw Error('The saved recording is unavailable.');await lab.watchTrackCode(pending.code,[replay],pending.trackId);}
      else if(pending.type==='local-race'){const record=lab.getLocalRun?.(pending.runId,pending.trackId)||lab.getTrackExperiments(pending.trackId).find(r=>r.runId===pending.runId);const replay=record&&lab.getLocalReplay(record);if(!replay)throw Error('The saved recording is unavailable.');lab.markTrackStarting?.();await lab.raceTrackCode(pending.code,[replay],pending.trackId);}
      else if(pending.type==='public-watch'){const row=(await replayFile(pending.trackId))?.entries.find(r=>r.rank===pending.rank&&r.nickname===pending.nickname&&r.timeMs===pending.timeMs&&r.recordingId===pending.recordingId&&r.status==='available');if(!row||lab.getPhysicsKey()!=='stock')throw Error('The original-physics replay is unavailable or the public capture changed.');await lab.watchTrackCode(pending.code,[lab.decodePublicReplay(row)],pending.trackId);}
      else if(pending.type==='public-selection'){
        if(!['watch','race'].includes(pending.mode)||!Array.isArray(pending.entries)||!pending.entries.length||pending.entries.length>10||lab.getPhysicsKey()!=='stock')throw Error('Invalid saved ghost selection.');
        const capture=await replayFile(pending.trackId),rows=pending.entries.map(entry=>capture?.entries.find(row=>row.rank===entry.rank&&row.nickname===entry.nickname&&row.timeMs===entry.timeMs&&row.recordingId===entry.recordingId&&row.status==='available'));
        if(rows.some(row=>!row))throw Error('A selected recording is unavailable or the capture changed.');
        const replays=rows.map(row=>lab.decodePublicReplay(row));
        if(pending.mode==='race'){lab.markTrackStarting?.();await lab.raceTrackCode(pending.code,replays,pending.trackId);}else await lab.watchTrackCode(pending.code,replays,pending.trackId);
      }
    }catch(error){open('Could not open saved run');status.textContent=error.message;}
  }
  window.addEventListener('polytrack-lab-runtime-ready',()=>{
    if(!sessionStorage.getItem(key))return;
    let queued=false;
    const ready=()=>{queued=false;if(!document.querySelector('#ui>.menu-ui:not(.loading-screen) .main-buttons-container:not(.hidden) .lab-home-button'))return;observer.disconnect();requestAnimationFrame(resume);};
    const observer=new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(ready);}});observer.observe(document.getElementById('ui'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});ready();
  });
})();

/* The replay follows the saved setup back onto the same runway. */
