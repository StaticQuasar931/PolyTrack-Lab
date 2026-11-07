/* PolyTrack Lab: device-only physics workshop. */
(() => {
  'use strict';
  const lab = () => (window.PolyTrackLab ||= {});
  const fields = () => lab().fields || [];
  const active = () => lab().getSettings?.() || {};
  const defaults = () => lab().getDefaults?.() || Object.fromEntries(fields().map(f => [f.key, f.default]));
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const btn = (className, text, fn) => {
    const el = make('button', `button ${className}`, text); el.type = 'button'; el.addEventListener('click', fn); return el;
  };
  const num = value => Number(value).toLocaleString(undefined, {maximumFractionDigits: 3});
  const icon = name => {const img=make('img','ptlab-icon');img.src=`images/lab-presets/${name}.svg`;img.alt='';return img;};
  const presetCopy = {standard:['standard','100% original · nothing changed'],arcade:['arcade','Fast and easy to steer'],drift:['drift','Slide around corners'],rocket:['rocket','Big speed · boost'],gentle:['gentle','Slower and forgiving'],stunt:['stunt','Boost · slide · jump'],lowgravity:['lowgravity','Float through the air'],random:['random','A new experiment every click']};
  const keyLabel=action=>lab().getBindingLabel?.(action)||({boost:'B',handbrake:'N',jump:'J'})[action];
  const fieldIcons = {carScale:'standard',bodyWidth:'standard',bodyHeight:'standard',bodyLength:'standard',wheelRadius:'wheel',wheelWidth:'wheel',wheelTrack:'steering',wheelBase:'steering',suspensionLength:'downforce',boostAuto:'rocket',jumpCooldown:'stunt',airJumpCooldown:'stunt',airJumpUnlimited:'stunt',acceleration:'rocket',reverse:'reverse',braking:'braking',grip:'drift',steering:'steering',downforce:'downforce',coasting:'braking',maxSpeed:'gentle',boost:'rocket',handbrake:'drift',jump:'stunt',airJumps:'stunt',gravity:'lowgravity'};
  const format = (value, f) => {
    if(f.options)return f.options[value]??String(value);
    const unit = (f.unit || '').trim();
    return num(value) + (['×','x','%'].includes(unit) ? unit : unit ? ` ${unit}` : '');
  };
  function compare(f, value) {
    if (!Number.isFinite(value)) return 'Enter a valid number.';
    if(f.options)return f.options[value]??'Choose an option.';
    if (value === f.default) return ({acceleration:'How quickly you gain speed. Original: 1×.',reverse:'Power while reversing. Original: 1×.',braking:'How quickly the brake slows you. Original: 1×.',grip:'How strongly tires hold the road. Original: 1×.',steering:'How tightly the car turns. Original: 1×.',downforce:'Road hold at high speed. Original: 1×.',coasting:'Extra slowing when you release both pedals. Original: off.',maxSpeed:'No added speed cap. Set a speed to limit it.',boost:`Off. Add strength to enable ${keyLabel('boost')} boost.`,handbrake:`Off. Add strength to enable ${keyLabel('handbrake')} slides.`,jump:`Off. Add strength to enable ${keyLabel('jump')} jumps.`,gravity:'Normal gravity. Lower it for longer airtime.'})[f.key] || 'Original game behavior.';
    if (f.key === 'maxSpeed') return value ? `Limits total speed to ${format(value,f)}.` : 'Original uncapped speed.';
    if (f.key === 'boost') return value ? `${keyLabel('boost')} adds ${num(value)}× original engine power.` : 'Boost disabled.';
    if (f.key === 'jump') return value ? `${keyLabel('jump')} on the ground: ${format(value,f)} upward speed.` : 'Jump disabled.';
    if (f.key === 'airJumps') return value ? `${num(value)} extra ${keyLabel('jump')} ${value===1?'press':'presses'} in the air. Enable Jump strength too.` : 'Off. Land to jump again.';
    if (f.key === 'handbrake') return value ? `Hold ${keyLabel('handbrake')} for rear braking and slides.` : 'Handbrake disabled.';
    if (f.key === 'gravity') return value===0 ? 'Zero gravity. You float when airborne.' : `${Math.round(value*100)}% of normal gravity. ${value<1?'Longer jumps and slower falls.':'Shorter jumps and faster falls.'}`;
    if (f.key === 'coasting') return value ? `About ${Math.round(Math.exp(-value)*100)}% of speed remains after 1 second off both pedals, before other game forces.` : 'Original coasting behavior.';
    if (!f.default) return `Custom value: ${format(value,f)}.`;
    const effect = {acceleration:'engine force',reverse:'reverse force',braking:'braking force',grip:'tire traction',steering:'steering angle',downforce:'downforce'}[f.key] || f.label.toLowerCase();
    return `${Math.round(Math.abs(value / f.default - 1) * 100)}% ${value > f.default ? 'more' : 'less'} ${effect} than default.`;
  }
  function mount() {
    if (document.getElementById('ptlab-dialog')) return;
    let draft = {}, selectedPreset = null, applying = false, returnFocus,rangeMode='normal',previewTimer=0,previewSequence=0;
    const rangeMax=f=>rangeMode==='sandbox'?f.max:rangeMode==='extended'?(f.extendedMax??f.max):(f.normalMax??f.max);
    function ensureRange(){const required=fields().some(f=>draft[f.key]>(f.extendedMax??f.max))?'sandbox':fields().some(f=>draft[f.key]>(f.normalMax??f.max))?'extended':'normal';if(['normal','extended','sandbox'].indexOf(required)>['normal','extended','sandbox'].indexOf(rangeMode)){rangeMode=required;rangeSelect.value=rangeMode;renderFields();}}
    const lockStorageKey = 'polytrack-lab.workshop-locks.v1';
    let lockStorageError = '';
    const loadLocks = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(lockStorageKey) || '[]');
        const keys = new Set(fields().map(field => field.key));
        return Array.isArray(stored) ? stored.filter(key => typeof key === 'string' && keys.has(key)) : [];
      } catch { lockStorageError = 'Control locks could not be read. New lock changes will work for this session.'; return []; }
    };
    const locks = new Set(loadLocks()), controls = new Map(), presetButtons = new Map();
    const dialog = make('dialog','ptlab-dialog'); dialog.id = 'ptlab-dialog'; dialog.setAttribute('aria-labelledby','ptlab-title');
    const shell = make('div','ptlab-shell'), header = make('header','ptlab-header'), brand = make('div');
    const title = make('h1','ptlab-title','Physics Lab'); title.id = 'ptlab-title';
    brand.append(make('div','ptlab-eyebrow','POLYTRACK LAB / WORKSHOP'), title, make('p','ptlab-subtitle','Tune the car. Find your feel.'));
    const right = make('div','ptlab-header-right'), activeBadge = make('span','ptlab-active-badge');
    const close = btn('ptlab-close','Back',() => dialog.close()); close.setAttribute('aria-label','Close Physics Lab');
    right.append(activeBadge,close); header.append(brand,right);
    const scroll = make('div','ptlab-workshop-scroll');
    const presetSection = make('section','ptlab-presets-section'), presetTop = make('div','ptlab-section-top'), presetHeading = make('div');
    presetHeading.append(make('h2','','Choose your driving style'),make('p','','Pick a style, then Apply & restart to play.'));
    const random = btn('ptlab-random','↻ Random mix',() => choose(lab().randomizeSettings?.() || defaults(),'Random mix','random'));
    random.title = 'Mix moderate values for unlocked controls. Apply is still required.';
    presetTop.append(presetHeading);
    const presetGrid = make('div','ptlab-presets'); presetSection.append(presetTop,presetGrid);
    const tuneTop = make('div','ptlab-section-top ptlab-tuning-heading'), tuneHeading = make('div'), lockSummary = make('span','ptlab-lock-summary');
    tuneHeading.append(make('h2','','Fine-tune your car'),make('p','','1× means the original game. Change a value below, then Apply & restart.'));
    lockSummary.title = 'Locks protect values from presets, saved setups, and random mixes. Manual edits and individual resets still work.';
    tuneTop.append(tuneHeading,lockSummary);
    const grid = make('div','ptlab-fields'), vehicleGrid=make('div','ptlab-fields'), warning = make('p','ptlab-extra-warning'); warning.setAttribute('role','note');
    const saved = make('details','ptlab-saved-section'), savedSummary = make('summary','','My saved setups'), savedBody = make('div','ptlab-saved-content');
    savedBody.append(make('p','ptlab-saved-intro','Save this draft with a name so you can return to it. Setups stay in this browser. Using an existing name replaces that saved setup.'));
    const saveForm = make('form','ptlab-save-form'), nameLabel = make('label','ptlab-setup-name-label','Setup name'), nameInput = make('input','ptlab-setup-name');
    nameInput.id = 'ptlab-setup-name'; nameInput.type = 'text'; nameInput.maxLength = 40; nameInput.placeholder = 'e.g. My mountain setup'; nameInput.autocomplete = 'off'; nameLabel.htmlFor = nameInput.id;
    const saveNamed = make('button','button ptlab-secondary','Save draft as setup'); saveNamed.type = 'submit';
    saveForm.append(nameLabel,nameInput,saveNamed);
    const savedList = make('div','ptlab-saved-list'); savedBody.append(saveForm,savedList); saved.append(savedSummary,savedBody);
    const advanced = make('details','ptlab-advanced'), advancedSummary=make('summary','','Advanced tuning');
    const rangeLabel=make('label','ptlab-extended'),rangeSelect=make('select','ptlab-range-mode');rangeSelect.setAttribute('aria-label','Tuning range');
    for(const [value,label] of [['normal','Normal ranges'],['extended','Extended ranges'],['sandbox','Sandbox ranges']]){const option=make('option','',label);option.value=value;rangeSelect.append(option);}rangeLabel.append(make('span','','Limits'),rangeSelect);
    const rangeHelp=make('p','ptlab-range-help','Sandbox opens the higher finite engine-tested limits. Speed limit 0 is uncapped.');
    rangeSelect.addEventListener('change',()=>{const candidate=rangeSelect.value,max=f=>candidate==='sandbox'?f.max:candidate==='extended'?(f.extendedMax??f.max):(f.normalMax??f.max);if(fields().some(f=>draft[f.key]>max(f))){rangeSelect.value=rangeMode;say('Lower the larger values before choosing a smaller range.');return;}rangeMode=candidate;try{localStorage.setItem('polytrack-lab.range-mode.v1',rangeMode);}catch{}renderFields();refresh();});
    rangeLabel.append(btn('ptlab-text-button','Uncap speed',()=>{draft.maxSpeed=0;selectedPreset=null;refresh();say('No added speed cap. Apply to use this setting.');}));
    advanced.append(advancedSummary,rangeLabel,rangeHelp,tuneTop,grid);
    const vehicle=make('details','ptlab-vehicle-studio'),vehicleSummary=make('summary','','Vehicle studio'),vehicleIntro=make('p','ptlab-vehicle-intro','Resize the real chassis and wheel contacts. Tire width is appearance-only. Apply restarts the engine.');
    const vehicleTop=make('div','ptlab-vehicle-top'),vehicleImage=make('img','ptlab-vehicle-preview'),vehiclePreviewNote=make('span','ptlab-vehicle-preview-note','Draft preview'),vehicleChoices=make('div','ptlab-vehicle-choices');
    const vehiclePreviewCard=make('figure','ptlab-vehicle-preview-card'),vehicleReadout=make('div','ptlab-vehicle-size-readout');vehicleReadout.setAttribute('aria-label','Effective size compared with Original');
    vehicleImage.alt='Draft car dimensions';vehicleImage.title='Unloaded car geometry. Suspension settles and compresses while driving.';vehicleImage.src='images/car_thumbnail_placeholder.png';vehiclePreviewCard.append(vehicleImage,make('figcaption','','Unloaded car · draft only'));vehicleTop.append(vehiclePreviewCard,vehicleChoices);
    for(const [name,values] of [['Mini',{carScale:.5}],['Giant',{carScale:2}],['Monster wheels',{wheelRadius:1.7,wheelWidth:1.8}],['Long body',{bodyLength:1.6,wheelBase:1.2}]])vehicleChoices.append(btn('ptlab-vehicle-choice',name,()=>choose({...draft,...values},name)));
    vehicleChoices.append(btn('ptlab-vehicle-choice','Original size',()=>{for(const field of fields().filter(f=>f.group==='vehicle'))draft[field.key]=field.default;selectedPreset=null;refresh();say('Car dimensions reset in the draft. Apply to restore the physical size.');}));
    vehicle.append(vehicleSummary,vehicleIntro,vehicleTop,vehicleReadout,vehiclePreviewNote,vehicleGrid);vehicle.addEventListener('toggle',()=>{if(vehicle.open)queuePreview();});
    function queuePreview(){
      clearTimeout(previewTimer);const sequence=++previewSequence;if(!dialog.open||!vehicle.open)return;
      const values=lab().vehicleDimensions?.({labVehiclePreviewSettings:draft})||draft,scale=values.carScale||1;
      vehicleReadout.replaceChildren(make('span','',`Body W ${num(scale*values.bodyWidth)}× · H ${num(scale*values.bodyHeight)}× · L ${num(scale*values.bodyLength)}×`),make('span','',`Wheel radius ${num(scale*values.wheelRadius)}× · tire width ${num(scale*values.wheelWidth)}× (visual)`));
      vehicleImage.setAttribute('aria-busy','true');vehiclePreviewNote.textContent='Updating draft preview…';
      previewTimer=setTimeout(async()=>{
        if(!fields().every(f=>Number.isFinite(draft[f.key])&&draft[f.key]>=f.min&&draft[f.key]<=f.max)){vehicleImage.hidden=true;vehicleImage.setAttribute('aria-busy','false');vehiclePreviewNote.textContent='Enter valid values to preview the car.';return;}
        try{
          const previewValues={...draft},image=await lab().renderVehiclePreview?.(previewValues);
          if(sequence!==previewSequence||!dialog.open||!vehicle.open)return;
          vehicleImage.setAttribute('aria-busy','false');
          if(image){vehicleImage.src=image;vehicleImage.hidden=false;vehiclePreviewNote.textContent=lab().vehiclePreviewOptions?.(previewValues).framing==='fit'?'Fitted view · large cars are zoomed out. Size multipliers above stay exact.':'Original camera scale · smaller cars stay visibly smaller.';}
          else{vehicleImage.hidden=true;vehiclePreviewNote.textContent='Preview will appear when car resources finish loading.';}
        }catch(error){if(sequence===previewSequence){vehicleImage.hidden=true;vehicleImage.setAttribute('aria-busy','false');vehiclePreviewNote.textContent=error.message;}}
      },140);
    }
    const bindings=make('div','ptlab-binding-mount');
    const sectionLinks=make('nav','ptlab-section-links');sectionLinks.setAttribute('aria-label','Physics Lab sections');
    for(const [label,target] of [['Driving styles',presetSection],['Vehicle studio',vehicle],['Advanced tuning',advanced]])sectionLinks.append(btn('ptlab-section-link',label,()=>{if(target.tagName==='DETAILS')target.open=true;requestAnimationFrame(()=>{target.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});const heading=target.querySelector('summary,h2');if(heading){if(heading.tagName!=='SUMMARY')heading.tabIndex=-1;heading.focus({preventScroll:true});}});}));
    const history=make('details','ptlab-saved-section ptlab-history'),historySummary=make('summary','','Recent experiments'),historyList=make('div');history.append(historySummary,historyList);
    scroll.append(bindings,sectionLinks,presetSection,vehicle,warning,advanced,saved,history);
    window.PolyTrackLab.mountBindings?.(bindings,()=>{const next=lab().enableAllMechanics(draft);for(const key of ['boost','handbrake','jump','airJumps'])draft[key]=next[key];selectedPreset=null;refresh();say('Boost, slide and double jump enabled in the draft. Apply to play.');});
    const status = make('div','ptlab-status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    const footer = make('footer','ptlab-footer'), stateCopy = make('div','ptlab-state-copy'), changeSummary = make('strong','ptlab-change-summary');
    stateCopy.append(changeSummary,make('span','','Apply saves on this device and restarts the game.'));
    const actions = make('div','ptlab-actions');
    const undo = btn('ptlab-text-button','Undo draft',() => {draft = {...active()}; selectedPreset = null;ensureRange(); refresh(); say('Draft restored to active physics. Your locks were kept.');});
    undo.title = 'Discard unsaved values and restore active physics. Keeps your locks.';
    const reset = btn('ptlab-secondary','Reset all',() => {draft = {...defaults()}; locks.clear(); selectedPreset = 'standard'; refresh(); say('Original values restored and every lock cleared. Apply to use these values.'); persistLocks();});
    reset.title = 'Restore all original values and clear every lock. Apply is still required.';
    const apply = btn('ptlab-primary','Apply & restart game',applyDraft);
    actions.append(undo,reset,apply); footer.append(stateCopy,close,actions); shell.append(header,scroll,status,footer); dialog.append(shell); document.body.append(dialog);
    function say(message,error = false) {status.textContent = message; status.hidden=!message;status.classList.toggle('ptlab-error',error);}
    function persistLocks() {
      try { localStorage.setItem(lockStorageKey,JSON.stringify([...locks])); lockStorageError = ''; }
      catch { lockStorageError = 'Lock changes work for this session, but this browser could not save them. They may be lost when you reload.'; say(lockStorageError,true); }
    }
    function valid() {
      for (const f of fields()) {
        const input = controls.get(f.key)?.number, value = draft[f.key];
        if (!Number.isFinite(value) || value < f.min || value > rangeMax(f) || (input && !input.validity.valid)) {
          say(`Check ${f.label}: enter a number from ${f.min} to ${rangeMax(f)}.`,true); input?.reportValidity(); input?.focus(); return false;
        }
      }
      return true;
    }
    function updateState() {
      const current = active(), original = defaults();
      const changes = fields().filter(f => draft[f.key] !== current[f.key]).length;
      const stock = fields().every(f => current[f.key] === original[f.key]);
      const identity=lab().getSetupIdentity?.(current),save=lab().getSetupHistory?.()[0];
      activeBadge.textContent = `${identity?.label||'Original'} · ${stock?'unchanged':'active'}${save?.saveNumber?' · Save #'+save.saveNumber:''}`; activeBadge.classList.toggle('ptlab-custom-active',!stock);
      changeSummary.textContent = changes ? `${changes} unsaved ${changes === 1 ? 'change' : 'changes'}` : 'Draft matches active physics';
      changeSummary.classList.toggle('ptlab-has-changes',changes > 0);
      apply.disabled = applying || !changes || !fields().length; undo.disabled = applying || !changes;
      reset.disabled = applying || (!locks.size && fields().every(f => draft[f.key] === original[f.key]));
      lockSummary.textContent = locks.size ? `${locks.size} ${locks.size === 1 ? 'control' : 'controls'} locked` : 'All controls unlocked';
      const concrete=lab().presets.find(p=>!p.random&&fields().every(f=>draft[f.key]===p.values[f.key]));
      for (const [id,node] of presetButtons) {const preset=lab().presets.find(p=>p.id===id);const matches=preset&&(preset.random?selectedPreset==='random'&&!concrete:concrete?.id===id);node.setAttribute('aria-pressed',String(matches));}
      const extra = [['boost',`${keyLabel('boost')} + accelerate: boost`],['jump',`${keyLabel('jump')} on ground: jump`],['handbrake',`${keyLabel('handbrake')}: handbrake`]].filter(([key]) => Number(draft[key]) > 0).map(([,text]) => text);
      warning.hidden = !extra.length;
      warning.textContent = extra.length ? `${extra.join(' · ')}. These extra controls disable ghosts and replays for this setup. Your times still save locally.` : '';
    }
    function updateCard(f,setNumber = true) {
      const c = controls.get(f.key); if (!c) return;
      const value = draft[f.key];
      if (setNumber) c.number.value = Number.isFinite(value) ? value : '';
      if (Number.isFinite(value) && value >= f.min && value <= f.max) c.range.value = value;
      c.range.style.setProperty('--ptlab-fill',`${(Number(c.range.value) - f.min) / (rangeMax(f) - f.min) * 100}%`);
      c.range.setAttribute('aria-valuetext',format(c.range.value,f)); c.effect.textContent = compare(f,value);
      c.current.textContent = `Active ${format(active()[f.key] ?? f.default,f)}`;
      c.card.classList.toggle('ptlab-field-changed',value !== (active()[f.key] ?? f.default));
      c.card.classList.toggle('ptlab-field-locked',locks.has(f.key));
      c.lock.textContent = locks.has(f.key) ? '● Locked' : '○ Lock'; c.lock.setAttribute('aria-pressed',String(locks.has(f.key)));
      c.lock.setAttribute('aria-label',`${locks.has(f.key) ? 'Unlock' : 'Lock'} ${f.label} for presets and random mixes`);
      c.reset.disabled = value === f.default;
    }
    function refresh() {for (const f of fields()) updateCard(f); updateState();queuePreview();}
    function choose(values,name,id = null) {
      for (const f of fields()) if (!locks.has(f.key)) draft[f.key] = values[f.key] ?? f.default;
      ensureRange();
      selectedPreset = id; refresh();
      say(`${name} loaded into your draft.${locks.size ? ` ${locks.size} locked ${locks.size === 1 ? 'value was' : 'values were'} kept.` : ''} Apply when you are ready.`);
    }
    function renderPresets() {
      presetGrid.replaceChildren(); presetButtons.clear();
      for (const preset of lab().presets || []) {
        const tile = btn('ptlab-preset','',() => choose(preset.random?lab().randomizeSettings():preset.values,preset.name,preset.id));
        const [image,caption]=presetCopy[preset.id]||['standard',preset.description];
        const selected=icon('selected');selected.classList.add('ptlab-selected');
        tile.append(icon(image),make('strong','',preset.name),make('span','',caption),selected); tile.setAttribute('aria-pressed','false');tile.title=preset.description;
        const stats=make('span','ptlab-preset-stats');
        const statKeys={standard:['acceleration','grip','gravity'],arcade:['acceleration','grip','braking'],drift:['grip','steering'],rocket:['acceleration','boost'],gentle:['acceleration','maxSpeed'],stunt:['boost','handbrake','jump'],lowgravity:['gravity','downforce'],random:[]};
        const names={acceleration:'Power',grip:'Grip',gravity:'Gravity',braking:'Brake',steering:'Turn',boost:'Boost',maxSpeed:'Cap',handbrake:'Slide',jump:'Jump',downforce:'Road hold'};
        for(const key of statKeys[preset.id]||[]) {const f=fields().find(f=>f.key===key);if(f)stats.append(make('span','',`${names[key]} ${format(preset.values[key],f)}`));}
        if(preset.random)stats.append(make('span','','Unlocked controls only'));tile.append(stats);
        presetGrid.append(tile); presetButtons.set(preset.id,tile);
      }
      if (!presetButtons.size) presetGrid.append(make('p','ptlab-muted','Driving styles are loading. You can still tune every control below.'));
    }
    function renderFields() {
      controls.clear(); grid.replaceChildren();vehicleGrid.replaceChildren();
      for (const f of fields()) {
        const card = make('section','ptlab-field'), top = make('div','ptlab-field-top'), label = make('label','ptlab-field-label',f.label);
        label.htmlFor = `ptlab-number-${f.key}`;
        const help = make('span','ptlab-help','?'); help.tabIndex = 0; help.setAttribute('role','note'); help.setAttribute('aria-label',f.description || f.label);
        help.append(make('span','ptlab-tooltip',f.description || f.label)); top.append(icon(fieldIcons[f.key]||'standard'),label,help);
        const row = make('div','ptlab-value-row'), current = make('span','ptlab-current-value'), box = make('div','ptlab-value-box');
        const number = make(f.options?'select':'input','ptlab-number');if(f.options){f.options.forEach((text,value)=>{const option=make('option','',text);option.value=value;number.append(option);});}else number.type='number'; number.id = label.htmlFor; number.min = f.min; number.max = rangeMax(f); number.step = f.step || 'any'; number.inputMode = 'decimal';
        box.append(make('span','ptlab-draft-label','Draft'),number,make('span','ptlab-unit',(f.unit || '').trim())); row.append(current,box);
        const slider = make('div','ptlab-slider'), range = make('input','ptlab-range'), marker = make('span','ptlab-default-marker');
        range.type = 'range'; range.min = f.min; range.max = rangeMax(f); range.step = f.step || 'any'; range.setAttribute('aria-label',`${f.label} draft value`);
        marker.style.left = `${(f.default - f.min) / (rangeMax(f) - f.min) * 100}%`; marker.title = `Default ${format(f.default,f)}`; slider.append(range,marker);
        const scale = make('div','ptlab-scale'); scale.append(make('span','',`${format(f.min,f)}${f.left ? ` · ${f.left}` : ''}`),make('span','',`${format(rangeMax(f),f)}${f.right&&f.key!=='maxSpeed' ? ` · ${f.right}` : ''}`));
        const effect = make('p','ptlab-field-effect'); effect.id = `ptlab-effect-${f.key}`; number.setAttribute('aria-describedby',effect.id); range.setAttribute('aria-describedby',effect.id);
        const bottom = make('div','ptlab-field-bottom');
        const resetField = btn('ptlab-reset-field',`↶ Default ${format(f.default,f)}`,() => {draft[f.key] = f.default; selectedPreset = null; updateCard(f); updateState();queuePreview(); say(`${f.label} reset to its original value. Apply to use the change.`);});
        resetField.title = 'Reset this control only, even if it is locked. Apply is required.';
        const lock = btn('ptlab-lock','○ Lock',() => {
          if (locks.has(f.key)) locks.delete(f.key); else locks.add(f.key);
          updateCard(f); updateState(); say(locks.has(f.key) ? `${f.label} will stay unchanged for presets, saved setups, and random mixes. Manual edits still work.` : `${f.label} can change with presets and random mixes.`);
          persistLocks();
        });
        lock.title = 'Keep this value for presets, saved setups, and random mixes. Manual edits still work.'; bottom.append(resetField,lock);
        range.addEventListener('input',() => {draft[f.key] = Number(range.value); selectedPreset = null; updateCard(f); updateState();queuePreview(); say('Draft updated. Active physics stays unchanged until you apply.');});
        number.addEventListener('input',() => {draft[f.key] = f.options?Number(number.value):number.valueAsNumber; selectedPreset = null; updateCard(f,false); updateState();queuePreview(); say('Draft updated. Active physics stays unchanged until you apply.');});
        card.append(top,row,slider,scale,effect,bottom);if(f.options){slider.hidden=true;scale.hidden=true;}(f.group==='vehicle'?vehicleGrid:grid).append(card); controls.set(f.key,{card,number,range,effect,current,lock,reset:resetField});
      }
    }
    async function renderSaved() {
      savedList.replaceChildren();
      try {
        const items = await lab().getSavedSetups?.() || [];
        savedSummary.textContent = `My saved setups${items.length ? ` (${items.length})` : ''}`;
        if (!items.length) savedList.append(make('p','ptlab-muted','No saved setups yet. Give your draft a name above.'));
        for (const setup of items) {
          const row = make('div','ptlab-saved-row'), actions = make('div','ptlab-saved-actions'); row.append(make('strong','',setup.name));
          actions.append(btn('ptlab-secondary','Load draft',() => choose(setup.values,setup.name)));
          const remove = btn('ptlab-text-button','Delete',async () => {
            try {await lab().deleteSetup(setup.id); await renderSaved(); say(`Saved setup “${setup.name}” deleted. Your draft and active physics were kept.`);}
            catch(error) {say(error?.message || 'This setup could not be deleted.',true);}
          });
          remove.setAttribute('aria-label',`Delete saved setup ${setup.name}`); actions.append(remove); row.append(actions); savedList.append(row);
        }
      } catch(error) {savedList.append(make('p','ptlab-muted',error?.message || 'Saved setups are unavailable.'));}
    }
    function renderHistory(){historyList.replaceChildren();const entries=lab().getSetupHistory?.()||[];for(const entry of entries){const row=make('div','ptlab-saved-row');row.append(make('strong','',`${entry.presetId===null?(entry.name||'Custom'):entry.presetId+' · '+entry.name} · Save #${entry.saveNumber||'earlier'}`));row.append(btn('ptlab-secondary','Use as draft',()=>choose(entry.values||entry.physicsValues,entry.name||'Saved experiment')));historyList.append(row);}if(!entries.length)historyList.append(make('p','ptlab-muted','Applied setups appear here automatically.'));}
    saveForm.addEventListener('submit',async event => {
      event.preventDefault(); const name = nameInput.value.trim();
      if (!name) {say('Give your setup a name before saving.',true); nameInput.focus(); return;}
      if (!valid()) return; saveNamed.disabled = true;
      try {
        if (typeof lab().saveSetup !== 'function') throw Error('Saved setups are still loading. Please try again.');
        await lab().saveSetup(name,{...draft}); await renderSaved(); nameInput.value = '';
        say(`“${name}” saved on this device. Saving a setup does not apply it.`);
      } catch(error) {say(error?.message || 'This setup could not be saved.',true);}
      finally {saveNamed.disabled = false;}
    });
    async function applyDraft() {
      if (applying || !valid()) return; applying = true; updateState(); apply.textContent = 'Saving…';
      try {
        if (typeof lab().applySettings !== 'function') throw Error('Physics is still loading. Please try again.');
        await lab().applySettings({...draft}); draft = {...active()}; refresh(); say('Physics saved locally. Restarting the game…');
      } catch(error) {say(error?.message || 'Settings could not be saved. Active physics was kept.',true);}
      finally {applying = false; apply.textContent = 'Apply & restart game'; updateState();}
    }
    function open() {
      if (dialog.open) return; returnFocus = document.activeElement; draft = {...defaults(),...active()}; selectedPreset = null;
      try{rangeMode=localStorage.getItem('polytrack-lab.range-mode.v1')||'normal';}catch{rangeMode='normal';}if(!['normal','extended','sandbox'].includes(rangeMode))rangeMode='normal';rangeSelect.value=rangeMode;ensureRange();
      renderPresets(); renderFields(); refresh(); renderSaved();renderHistory();advanced.open=false;vehicle.open=false;saved.open=false;history.open=false;
      say(lab().storageError || lab().historyStorageError || lockStorageError || '',!!(lab().storageError || lab().historyStorageError || lockStorageError));
      lab().onPanelOpen?.(); dialog.showModal(); scroll.scrollTop = 0; close.focus();
    }
    lab().openPhysicsLab = open;
    dialog.addEventListener('close',() => {clearTimeout(previewTimer);previewSequence++;lab().onPanelClose?.(); if (returnFocus?.isConnected) returnFocus.focus();});
    let outsideDown=false;
    const outside=event=>{const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
    dialog.addEventListener('pointerdown',event=>{outsideDown=event.target===dialog&&outside(event);});
    dialog.addEventListener('click',event=>{if(outsideDown&&event.target===dialog&&outside(event))dialog.close();outsideDown=false;});
    for (const event of ['keydown','keyup','pointerdown','pointerup','click']) dialog.addEventListener(event,e => e.stopPropagation());
    window.addEventListener('lab-open',open);
    window.addEventListener('polytrack-lab-bindings-changed',()=>{if(dialog.open){renderPresets();renderFields();refresh();}});
    window.addEventListener('lab-ready',() => {lab().openPhysicsLab = open; if (dialog.open) {renderPresets(); renderFields(); refresh();}});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})();

/* The draft stays on the workbench until the driver applies it. */
