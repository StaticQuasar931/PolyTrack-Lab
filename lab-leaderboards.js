/* Public captures are a reference beside device-only Lab records. No scores are uploaded. */
(() => {
  'use strict';
  const lab = window.PolyTrackLab;
  const time = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`;
  function countStatus(snapshot) {
    if (!snapshot) return { kind: 'loading', label: 'Loading', description: 'Loading saved result count' };
    if (!snapshot.available) return { kind: 'unavailable', label: 'Unavailable', description: 'No saved public snapshot is available' };
    const count = snapshot.entries.length;
    return { kind: count >= 100 ? 'full' : count > 10 ? 'many' : count > 0 ? 'few' : 'empty',
      label: `${count} saved`, description: `${count} saved public ${count === 1 ? 'result' : 'results'} on original physics` };
  }
  function comparison(snapshot, best, stock) {
    if (!stock) return { kind: 'custom', text: 'Custom physics active. Your local times are not compared with this original-physics snapshot.' };
    if (!snapshot?.available) return { kind: 'unavailable', text: 'A saved public snapshot is needed to compare your local best.' };
    if (!Number.isFinite(best) || best <= 0) return { kind: 'none', text: 'Finish this track with original physics to compare your local best with the saved results.' };
    const entries = snapshot.entries, count = entries.length, prefix = `Your local best ${time(best)}`;
    if (!count) return { kind: 'empty', text: `${prefix} is saved on this device. This capture has no public results to compare.` };
    const tie = entries.findIndex(entry => entry.timeMs === best);
    if (tie >= 0) return { kind: 'tie', position: tie + 1, text: `${prefix} ties saved #${tie + 1}. This compares the saved results, not a live overall Kodub rank.` };
    const ahead = entries.filter(entry => entry.timeMs < best).length;
    if (ahead === count && (count >= 100 || snapshot.total > count)) return { kind: 'outside', text: `${prefix} is outside the saved top ${count}. Its overall Kodub position cannot be determined from this capture.` };
    return { kind: 'placed', position: ahead + 1, text: `${prefix} would fit at #${ahead + 1} among the ${count} saved results. This is a snapshot comparison, not an overall Kodub rank. Your time has not been uploaded.` };
  }
  lab.leaderboardReference = { countStatus, comparison };
  const ui = document.getElementById('ui');
  if (!ui) return;
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const states = new WeakMap();
  const carPreviews=new Map();
  async function carPreview(style){
    if(typeof style!=='string'||!style||typeof lab.renderCarThumbnail!=='function')return null;
    if(!carPreviews.has(style)){
      const promise=Promise.resolve().then(()=>lab.renderCarThumbnail(style)).catch(error=>{carPreviews.delete(style);throw error;});
      carPreviews.set(style,promise);if(carPreviews.size>160)carPreviews.delete(carPreviews.keys().next().value);
    }
    return carPreviews.get(style);
  }
  let queued = false, nextId = 0, pendingTrack = null;
  function mount(trackId) {
    queued = false;
    const board = ui.querySelector('.track-info-ui .leaderboard-ui');
    if (!board) return;
    if (states.has(board)) { if (trackId) states.get(board).load(trackId); return; }
    board.dataset.labLeaderboard = 'true';
    const heading = board.querySelector(':scope > h2'), subheading = board.querySelector(':scope > h3');
    if (!heading || !subheading) return;
    heading.textContent = 'Local times'; subheading.textContent = 'This device · Current setup';
    const identity = 'lab-board-' + ++nextId;
    const tabs = make('div', 'lab-board-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Leaderboard source');
    const local = make('button', 'button', 'Local Lab times'), reference = make('button', 'button');
    const badge = make('span', 'lab-board-count', 'Loading'); badge.setAttribute('aria-hidden', 'true');
    reference.append(make('span', '', 'Kodub top 100'), badge);
    const announcement = make('span', 'lab-board-announcement'); announcement.setAttribute('role', 'status');
    for (const [button, suffix] of [[local, 'local'], [reference, 'snapshot']]) {
      button.type = 'button'; button.id = identity + '-' + suffix + '-tab'; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', identity + '-' + suffix);
    }
    tabs.append(local, reference); subheading.after(tabs); tabs.after(announcement);
    const localSummary = make('p', 'lab-local-comparison', 'Local places apply to this device. Checking the saved Kodub reference…');
    localSummary.setAttribute('role', 'status'); announcement.after(localSummary);
    const panel = make('section', 'lab-snapshot-panel'); panel.id = identity + '-snapshot'; panel.hidden = true; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', reference.id);
    board.insertBefore(panel, board.querySelector(':scope > .pages') || board.querySelector(':scope > .button-wrapper'));
    const experiments=make('section','lab-experiments-panel');experiments.setAttribute('aria-label','Personal bests across physics setups');panel.before(experiments);
    board.classList.add('lab-experiment-board');
    const container = board.querySelector(':scope > .container');
    if (container) { container.id = identity + '-local'; container.setAttribute('role', 'tabpanel'); container.setAttribute('aria-labelledby', local.id); }
    const selectedPublic=new Map();
    let thumbnailObserver=null;
    const stopPreviews=()=>{thumbnailObserver?.disconnect();thumbnailObserver=null;};
    function previewList(list){
      const pending=new Map();
      const load=async image=>{const getStyle=pending.get(image);if(!getStyle)return;pending.delete(image);try{const source=await carPreview(await getStyle());if(source&&image.isConnected)image.src=source;}catch{image.title='Saved car preview unavailable';}};
      if(typeof IntersectionObserver==='function'){const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);load(entry.target);}},{root:list,rootMargin:'100px'});thumbnailObserver=observer;}
      return (row,getStyle)=>{const image=make('img','lab-car-thumbnail');image.alt='';image.src='images/car_thumbnail_placeholder.png';image.width=50;image.height=50;image.draggable=false;pending.set(image,getStyle);row.append(image);if(thumbnailObserver)thumbnailObserver.observe(image);else requestAnimationFrame(()=>load(image));};
    }
    function updateOpponentSummary(){
      const note=ui.querySelector('.track-info-ui .opponents-container');if(!note)return;
      const nativeWatch=ui.querySelector('.track-info-ui .side-panel > .button.watch');
      if(nativeWatch){nativeWatch.dataset.labPublicSelection=String(state.active==='snapshot'&&selectedPublic.size>0);nativeWatch.disabled=!(state.active==='snapshot'&&selectedPublic.size)&&!(lab.getPersonalBest?.(state.trackId)>0&&lab.replayEnabled?.()!==false);}
      if(state.active==='snapshot'&&selectedPublic.size){note.classList.remove('no-opponents');note.textContent=`${selectedPublic.size} public ghost${selectedPublic.size===1?'':'s'} selected. Play to race, or Watch to view their cars.`;}
      else {note.classList.add('no-opponents');note.textContent=state.active==='snapshot'?'Select public ghosts on the left, then Race selected.':'Click a saved time for its physics and replay actions.';}
    }
    const state = { trackId: null, snapshot: null, error: null, token: 0, active: 'local', load: null, render: null, refreshComparison: null };
    function select(source) {
      state.active = source;
      const snapshot = source === 'snapshot';
      board.classList.toggle('lab-show-snapshot', snapshot); panel.hidden = !snapshot;
      experiments.hidden=snapshot;
      localSummary.hidden = snapshot;
      for (const [button, selected] of [[local, !snapshot], [reference, snapshot]]) { button.setAttribute('aria-selected', String(selected)); button.tabIndex = selected ? 0 : -1; }
      heading.textContent = snapshot ? 'Kodub top 100' : 'Lab experiments';
      subheading.textContent = snapshot ? 'Saved reference · Original physics' : 'PB per setup · This device';
      updateOpponentSummary();
      if (snapshot) render();
      else {refreshComparison();renderExperiments();}
    }
    let recentRuns=false;
    function renderExperiments(){
      stopPreviews();
      experiments.replaceChildren();if(!state.trackId){experiments.append(make('p','lab-board-note','Loading saved runs…'));return;}const tools=make('div','lab-experiment-tools'),mode=make('select');mode.setAttribute('aria-label','Local run view');
      for(const [value,label] of [['best','PB per setup'],['recent','Recent runs']]){const option=make('option','',label);option.value=value;mode.append(option);}mode.value=recentRuns?'recent':'best';mode.addEventListener('change',()=>{recentRuns=mode.value==='recent';renderExperiments();});tools.append(mode);experiments.append(tools);
      const rows=recentRuns?(lab.getRunHistory?.({trackId:state.trackId,limit:200})||[]).map(r=>({...r,isCurrentSetup:r.physicsKey===lab.getPhysicsKey()})):lab.getTrackExperiments?.(state.trackId)||[];
      if(!rows.length){experiments.append(make('p','lab-board-empty','Finish a run to save your first experiment. Each physics setup keeps its own personal best.'));return;}
      const list=make('ol','lab-public-list');list.setAttribute('aria-label','Local setup personal bests');
      const addPreview=previewList(list);
      rows.forEach((record,index)=>{const li=make('li'),row=make('button','lab-public-row lab-experiment-row');row.type='button';
        const label=make('span','lab-experiment-label');label.append(make('strong','',`${record.nickname || 'Anonymous'} (you)`),make('span','',`${record.setupLabel||record.presetName}${record.saveNumber?' · Save #'+record.saveNumber:''}`));
        if(recentRuns)label.append(make('small','lab-run-age',new Date(record.date).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'})));
        row.append(make('span','lab-public-rank',recentRuns?'↻':'#'+(index+1)));addPreview(row,()=>lab.getLocalCarStyle?.(record));row.append(label,make('span','lab-public-time',time(record.timeMs)));
        row.title=lab.describeSettings?.(record.physicsValues)||'Open settings for this run';
        row.addEventListener('click',()=>lab.showRunDetails(record));row.addEventListener('contextmenu',e=>{e.preventDefault();lab.showRunDetails(record);});li.append(row);list.append(li);
      });experiments.append(list);
    }
    function refreshComparison() {
      if (!state.snapshot) { localSummary.textContent = 'Local places apply to this device. Checking the saved Kodub reference…'; return null; }
      const best = lab.getPersonalBest?.(state.trackId), result = comparison(state.snapshot, best, lab.getPhysicsKey?.() === 'stock');
      const prefix = Number.isFinite(best) && best > 0 ? `Local best ${time(best)}` : 'Local places apply to this device';
      const messages = {
        custom: 'Local places apply to this device and setup. Original-physics results are a reference, not a comparison.',
        unavailable: 'Local places apply to this device. No saved public snapshot is available.',
        none: 'Local places apply to this device. Finish on original physics to compare with saved Kodub results.',
        empty: `${prefix}. The public capture has no results to compare.`,
        outside: `${prefix} is outside the saved top ${state.snapshot.entries?.length || 0}. Overall Kodub rank is unknown.`,
        tie: `${prefix} ties saved #${result.position}. Snapshot comparison only.`,
        placed: `${prefix} would fit at #${result.position} in the saved results. Snapshot comparison only.`
      };
      localSummary.textContent = messages[result.kind]; localSummary.dataset.comparison = result.kind;
      return result;
    }
    state.refreshComparison = refreshComparison;state.renderExperiments=renderExperiments;
    function updateStatus() {
      const status = countStatus(state.snapshot);
      reference.dataset.snapshotCount = status.kind; badge.textContent = status.label;
      reference.setAttribute('aria-label', 'Kodub top 100: ' + status.description);
      reference.title = status.description; announcement.textContent = status.description;
    }
    function render() {
      stopPreviews();
      panel.replaceChildren();
      if (!state.snapshot) { panel.append(make('p', 'lab-board-note', 'Loading saved public results…')); return; }
      if (!state.snapshot.available) { panel.append(make('p', 'lab-board-empty', state.error || 'No public snapshot is saved for this track. Local Lab times still work.')); return; }
      const snapshot = state.snapshot;
      const captureId=state.trackId;
      const date = new Date(snapshot.capturedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      const note = make('div', 'lab-snapshot-summary');
      note.append(make('p', 'lab-board-total', `${snapshot.entries.length} saved results · ${snapshot.total.toLocaleString()} public results reported`));
      note.append(make('p', 'lab-board-note', `Captured ${date}. ${snapshot.onlyVerified ? 'Verified public results.' : 'Public capture; includes unverified entries.'} Select up to 10 ghosts. Public ghosts use Original physics automatically. Right-click for details.`));
      const compare = refreshComparison();
      const message = make('p', 'lab-board-comparison', compare.text); message.dataset.comparison = compare.kind; note.append(message); panel.append(note);
      if (!snapshot.entries.length) { panel.append(make('p', 'lab-board-empty', 'Kodub reported no public results for this track when this capture was made.')); return; }
      const tools=make('div','lab-ghost-tools'),selectionNote=make('span','','0 selected');selectionNote.setAttribute('role','status');
      const watch=make('button','button','Watch selected'),race=make('button','button','Race selected'),clear=make('button','button','Clear');
      for(const button of [watch,race,clear])button.type='button';
      const refreshSelection=()=>{selectionNote.textContent=selectedPublic.size+' selected';for(const button of [watch,race,clear])button.disabled=!selectedPublic.size;updateOpponentSummary();};
      let launching=false;
      for(const [button,mode] of [[watch,'watch'],[race,'race']])button.addEventListener('click',async()=>{if(launching)return;launching=true;watch.disabled=race.disabled=true;try{await lab.playPublicSelection(state.trackId,[...selectedPublic.values()],mode);}catch(error){selectionNote.textContent=error.message;}finally{launching=false;watch.disabled=race.disabled=!selectedPublic.size;}});
      clear.addEventListener('click',()=>{selectedPublic.clear();render();});tools.append(selectionNote,watch,race,clear);panel.append(tools);refreshSelection();
      const list = make('ol', 'lab-public-list'); list.tabIndex = 0; list.setAttribute('aria-label', 'Saved public results, scroll to view all ' + snapshot.entries.length);
      const addPreview=previewList(list);
      const capturePromise=Promise.resolve(lab.getPublicReplayCapture?.(captureId));
      for (const entry of snapshot.entries) {
        const row = make('li', 'lab-public-row'); row.value = entry.rank;
        const rank = make('span', 'lab-public-rank', '#' + entry.rank);
        const nickname=entry.nickname.replace(/[\u200b-\u200d\u2060\ufeff\u3164\u2800]/g,'').trim()||'Anonymous';
        const name = make('span', 'lab-public-name', nickname); name.title = entry.nickname;
        if (entry.countryCode) {
          const country = make('img', 'lab-public-flag');country.src='images/countries/'+entry.countryCode.toLowerCase()+'.svg';country.alt=entry.countryCode.toUpperCase();country.title='Public country code: '+entry.countryCode.toUpperCase();country.draggable=false;country.addEventListener('error',()=>{country.hidden=true;},{once:true});
          name.prepend(country);
        }
        const checked=make('span','lab-ghost-check',selectedPublic.has(entry.rank)?'☑':'☐');checked.setAttribute('aria-hidden','true');
        const savedEntry=capture=>capture?.entries.find(saved=>saved.rank===entry.rank&&saved.nickname===entry.nickname&&saved.timeMs===entry.timeMs&&saved.status==='available');
        row.append(checked,rank);addPreview(row,async()=>savedEntry(await capturePromise)?.carStyle);row.append(name, make('span', 'lab-public-time', time(entry.timeMs))); list.append(row);
        row.tabIndex=0;row.setAttribute('role','button');row.setAttribute('aria-pressed',String(selectedPublic.has(entry.rank)));row.title='Select ghost; right-click for replay details';
        const toggle=()=>{if(row.dataset.replayStatus==='unavailable'){selectionNote.textContent='This score is a reference only; no replay was captured. Right-click for details.';return;}if(selectedPublic.has(entry.rank))selectedPublic.delete(entry.rank);else{if(selectedPublic.size>=10){selectionNote.textContent='Select up to 10 ghosts at once.';return;}selectedPublic.set(entry.rank,entry);}checked.textContent=selectedPublic.has(entry.rank)?'☑':'☐';row.setAttribute('aria-pressed',String(selectedPublic.has(entry.rank)));refreshSelection();};
        capturePromise.then(capture=>{if(!row.isConnected)return;const available=!!savedEntry(capture);row.dataset.replayStatus=available?'available':'unavailable';if(!available){row.setAttribute('aria-disabled','true');row.title='Saved score reference only. No replay was captured; right-click for details.';if(selectedPublic.delete(entry.rank)){checked.textContent='☐';row.setAttribute('aria-pressed','false');refreshSelection();}}}).catch(()=>{if(row.isConnected)row.title='Replay availability could not be checked; select to retry.';});
        row.addEventListener('click',toggle);
        row.addEventListener('contextmenu',event=>{event.preventDefault();lab.showPublicReplay(state.trackId,entry);});
        row.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();toggle();}});
      }
      panel.append(list);
    }
    state.render = render;
    let nativeLaunching=false;
    for(const [selector,mode] of [['.side-panel > .button.play','race'],['.side-panel > .button.watch','watch']]){
      const button=ui.querySelector('.track-info-ui '+selector);
      button?.addEventListener('click',async event=>{
        if(state.active!=='snapshot'||!selectedPublic.size)return;
        event.preventDefault();event.stopImmediatePropagation();if(nativeLaunching)return;nativeLaunching=true;button.disabled=true;let failed=false;
        try{await lab.playPublicSelection(state.trackId,[...selectedPublic.values()],mode);}catch(error){failed=true;announcement.textContent=error.message;const note=ui.querySelector('.track-info-ui .opponents-container');if(note)note.textContent=error.message;}
        finally{nativeLaunching=false;button.disabled=false;if(!failed)updateOpponentSummary();}
      },true);
    }
    state.load = async id => {
      if (!id || state.trackId === id) return;
      selectedPublic.clear();state.trackId = id; state.snapshot = null; state.error = null; const request = ++state.token; updateStatus();renderExperiments();
      refreshComparison();
      if (state.active === 'snapshot') render();
      try {
        const snapshot = await lab.getPublicLeaderboard(id);
        if (request !== state.token || !board.isConnected) return;
        state.snapshot = snapshot;
      } catch (error) {
        if (request !== state.token || !board.isConnected) return;
        state.snapshot = { available: false }; state.error = 'This saved public snapshot could not load. Local Lab times are unaffected.';
      }
      updateStatus(); refreshComparison(); if (state.active === 'snapshot') render();
    };
    states.set(board, state); select('local'); updateStatus();
    local.addEventListener('click', () => select('local'));
    reference.addEventListener('click', () => { select('snapshot'); if (!state.trackId && lab.currentLeaderboardTrackId) state.load(lab.currentLeaderboardTrackId); });
    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); const target = event.key === 'Home' ? local : event.key === 'End' ? reference : document.activeElement === local ? reference : local;
      target.focus(); select(target === local ? 'local' : 'snapshot');
    });
    const empty = make('div', 'lab-board-empty lab-local-empty', 'Your first finish starts this board. Race this track to save a local personal best, or view the saved Kodub results.');
    function refreshEmpty() {
      const zero = /^0\s/.test(board.querySelector('.total-players')?.textContent?.trim() || '');
      if (zero && container && empty.parentElement !== container) container.append(empty);
      empty.hidden = !zero;
    }
    const observer = new MutationObserver(() => { if (!board.isConnected) { observer.disconnect();stopPreviews(); return; } refreshEmpty(); });
    observer.observe(board, { subtree: true, childList: true }); refreshEmpty();
    if (trackId || lab.currentLeaderboardTrackId) state.load(trackId || lab.currentLeaderboardTrackId);
  }
  function queue(trackId) {
    if (trackId) pendingTrack = trackId;
    if (!queued) { queued = true; requestAnimationFrame(() => { const id = pendingTrack; pendingTrack = null; mount(id); }); }
  }
  new MutationObserver(() => queue()).observe(ui, { childList: true, subtree: true });
  window.addEventListener('polytrack-lab-leaderboard-changed', event => queue(event.detail?.trackId || lab.currentLeaderboardTrackId));
  window.addEventListener('polytrack-lab-records-changed', () => {
    const board = ui.querySelector('.track-info-ui .leaderboard-ui'), state = board && states.get(board);
    state?.refreshComparison();state?.renderExperiments(); if (state?.active === 'snapshot') state.render();
  });
  queue(lab.currentLeaderboardTrackId);
})();

/* Snapshot lanes and local experiment lanes keep separate clocks. */
