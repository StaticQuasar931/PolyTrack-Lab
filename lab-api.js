/* PolyTrack Lab: read-only official track feed and device-only records. */
(() => {
  'use strict';
  const lab = window.PolyTrackLab ||= {};
  const ROOT = 'https://vps.kodub.com/v6/trackOfTheWeek';
  const PREFIX = 'polytrack-lab:';
  let runtime = null, catalogPromise = null, catalog = [], types = null, weeklyPromise = null, weeklyUntil = 0, apiInstance = null;
  const weeklyNames = new Map();
  const knownTrackNames = new Map();
  let trackNamesPromise = null;
  const savedExtraTracks = new Set();
  const profileKey = () => typeof lab.getPhysicsKey === 'function' ? String(lab.getPhysicsKey()) : 'stock';
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(PREFIX + key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(PREFIX + key, JSON.stringify(value)); lab.storageError = null; };
  const scoreKey = (key = profileKey()) => 'scores:' + key;
  const scores = (key = profileKey()) => {
    const value = read(scoreKey(key), []);
    return Array.isArray(value) ? value.filter(entry => entry && typeof entry.trackId === 'string' &&
      Number.isSafeInteger(entry.id) && Number.isSafeInteger(entry.frames) && entry.frames > 0 &&
      typeof entry.nickname === 'string' && Number.isFinite(Date.parse(entry.date))) : [];
  };
  const fallbackFields = [
    ['acceleration', .1, 5, 1], ['reverse', .1, 5, 1], ['braking', .1, 5, 1], ['grip', .1, 3, 1],
    ['steering', .2, 2, 1], ['downforce', 0, 5, 1], ['coasting', 0, 5, 0], ['maxSpeed', 0, 1500, 0],
    ['boost', 0, 5, 0], ['handbrake', 0, 5, 0], ['jump', 0, 20, 0], ['gravity', 0, 2, 1]
  ].map(([key, min, max, defaultValue]) => ({ key, min, max, default: defaultValue }));
  const physicsFields = () => Array.isArray(lab.fields) && lab.fields.length ? lab.fields : fallbackFields;
  function normalizedPhysics(input, strict = false) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const result = {};
    for (const field of physicsFields()) {
      const value = input[field.key];
      if (value === undefined) { result[field.key] = field.default; continue; }
      const integer=field.integer||field.key==='airJumps';
      if (typeof value !== 'number' || !Number.isFinite(value) || strict && (value < field.min || value > field.max || integer && !Number.isInteger(value))) return null;
      const bounded=Math.min(field.max,Math.max(field.min,value));result[field.key]=integer?Math.round(bounded):bounded;
    }
    return result;
  }
  function decodeLegacyPhysics(key) {
    if (key === 'stock' || key === 'default') return normalizedPhysics({});
    if (typeof key !== 'string' || key.length > 2048) return null;
    const input = {}, allowed = new Set(physicsFields().map(field => field.key));
    for (const part of key.split('|')) {
      const match = /^([a-zA-Z][a-zA-Z0-9]*):(-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)$/i.exec(part);
      if (!match || !allowed.has(match[1]) || Object.hasOwn(input, match[1])) return null;
      input[match[1]] = Number(match[2]);
    }
    if (!fallbackFields.slice(0, 9).every(field => Object.hasOwn(input, field.key))) return null;
    return normalizedPhysics(input, true);
  }
  const numericPresetIds = { standard: 0, original: 0, arcade: 1, drift: 2, rocket: 3, gentle: 4, stunt: 5, lowgravity: 6 };
  const presetNames = ['Original', 'Arcade', 'Drift', 'Rocket', 'Gentle', 'Stunt', 'Low gravity'];
  function setupDescriptor(key, values, setupHistoryId = null) {
    let identity = null;
    try { if (values && lab.getSetupIdentity) identity = lab.getSetupIdentity(values); } catch {}
    let presetId = Number.isInteger(identity?.presetId) && identity.presetId >= 0 && identity.presetId <= 6 ? identity.presetId : null;
    if (!identity && values) {
      const matches = candidate => physicsFields().every(field => candidate?.[field.key] === values[field.key]);
      const preset = lab.presets?.find(item => !item.random && matches(normalizedPhysics(item.values)));
      if (preset) presetId = numericPresetIds[preset.id] ?? null;
      else if (matches(normalizedPhysics({}))) presetId = 0;
    }
    const presetName = presetId !== null ? presetNames[presetId] : values ? 'Custom' : 'Unknown legacy setup';
    return { metadataVersion: 2, physicsKey: key, physicsValues: values ? { ...values } : null,
      presetId, presetName, setupName: typeof identity?.name === 'string' ? identity.name : presetName,
      setupLabel: (typeof identity?.label === 'string' ? identity.label : presetId !== null ? `${presetId} · ${presetName}` : presetName)+(String(key).includes('~course:')?' · Course rules':'')+(String(key).includes('~tas')?' · TAS practice':''),
      physicsLabel: presetName, setupHistoryId,
      replayAvailable: !!values && !String(key).includes('~course:') && !String(key).includes('~tas') && values.boost === 0 && values.handbrake === 0 && values.jump === 0 };
  }
  lab.getCurrentSetupDescriptor = () => {
    const key = profileKey();
    let values = null, history = null;
    try { values = lab.getSettings ? normalizedPhysics(lab.getSettings()) : decodeLegacyPhysics(key); } catch {}
    try { history = lab.getActiveSetupHistoryEntry?.(); } catch {}
    return { ...setupDescriptor(key, values, typeof history?.id === 'string' ? history.id : null),
      ...(lab.getActiveCourse?.()?{courseRules:Object.fromEntries(['name','author','notes','physics','checkpoints','objects'].map(key=>[key,lab.getActiveCourse()[key]]))}:{}),
      ...(lab.getPracticeRunInfo?.()?{practice:lab.getPracticeRunInfo()}:{}),
      setupSaveNumber: Number.isSafeInteger(history?.saveNumber) ? history.saveNumber : null,
      saveNumber: Number.isSafeInteger(history?.saveNumber) ? history.saveNumber : null };
  };
  function allPhysicsKeys() {
    const keys = new Set([profileKey()]);
    try {
      const storageKeys = typeof localStorage.key === 'function' ? Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)) : Object.keys(localStorage);
      for (const key of storageKeys) if (typeof key === 'string' && key.startsWith(PREFIX + 'scores:')) keys.add(key.slice((PREFIX + 'scores:').length));
    } catch {}
    return [...keys];
  }
  function descriptorForRecord(record, key) {
    const values = normalizedPhysics(record.physicsValues, true) || decodeLegacyPhysics(key);
    const descriptor = setupDescriptor(key, values, typeof record.setupHistoryId === 'string' ? record.setupHistoryId : null);
    const saveNumber = Number.isSafeInteger(record.setupSaveNumber ?? record.saveNumber) ? record.setupSaveNumber ?? record.saveNumber : null;
    return { ...descriptor, setupSaveNumber: saveNumber, saveNumber, ...(record.courseRules?{courseRules:record.courseRules}:{}),...(record.practice?{practice:record.practice}:{}),
      setupName: typeof record.setupName === 'string' ? record.setupName : descriptor.setupName,
      setupLabel: typeof record.setupLabel === 'string' ? record.setupLabel : descriptor.setupLabel };
  }
  function experimentRecord(record, key) {
    const descriptor = descriptorForRecord(record, key);
    return { id: record.id, recordId: record.id, runId: record.runId || `legacy:${encodeURIComponent(key)}:${record.id}`,
      experimentId: key, trackId: record.trackId, name: knownTrackName(record.trackId) || record.name || trackName(record.trackId),
      nickname: record.nickname, timeMs: record.frames, frames: record.frames, date: record.date,
      ...descriptor, replayAvailable: descriptor.replayAvailable && typeof record.recording === 'string' && !!record.recording,
      isCurrentSetup: key === profileKey(), verification: 'local' };
  }
  lab.getTrackExperiments = trackId => {
    const experiments = [];
    for (const key of allPhysicsKeys()) {
      const best = scores(key).filter(record => record.trackId === trackId).sort((a, b) => a.frames - b.frames)[0];
      if (best) experiments.push(experimentRecord(best, key));
    }
    return experiments.sort((a, b) => a.timeMs - b.timeMs || a.date.localeCompare(b.date));
  };
  lab.getLocalRun = (runId, trackId = null) => {
    if (typeof runId !== 'string' || !runId || runId.length > 4096) return null;
    const result = findRawLocalRun(runId, trackId);
    return result ? experimentRecord(result.record, result.key) : null;
  };
  function findRawLocalRun(runId, trackId = null, physicsKey = null) {
    for (const key of physicsKey ? [physicsKey] : allPhysicsKeys()) {
      const record = scores(key).find(candidate => (!trackId || candidate.trackId === trackId) &&
        (candidate.runId || `legacy:${encodeURIComponent(key)}:${candidate.id}`) === runId);
      if (record) return { record, key };
    }
    const history = read(RUN_HISTORY_KEY, []);
    const archived = (Array.isArray(history) ? history : []).find(record => record?.runId === runId &&
      (!trackId || record.trackId === trackId) && (!physicsKey || record.physicsKey === physicsKey));
    if (archived && typeof archived.physicsKey === 'string' && Number.isSafeInteger(archived.timeMs) && archived.timeMs > 0) {
      return { key: archived.physicsKey, record: { ...archived, id: archived.recordId, frames: archived.timeMs,
        nickname: typeof archived.nickname === 'string' ? archived.nickname : 'Local player' } };
    }
    return null;
  }
  const RUN_HISTORY_KEY = 'runs:v1';
  const RUN_REPLAY_BUDGET = 1024 * 1024;
  let runSequence = 0;
  const newRunId = () => globalThis.crypto?.randomUUID?.() || `run-${Date.now().toString(36)}-${++runSequence}-${Math.random().toString(36).slice(2, 8)}`;
  function appendRunHistory(record, isPersonalBest) {
    try {
      const previous = read(RUN_HISTORY_KEY, []), history = Array.isArray(previous) ? previous : [];
      history.unshift({ runId: record.runId, recordId: record.id, trackId: record.trackId, name: record.name,nickname:record.nickname,
        timeMs: record.frames, date: record.date, physicsKey: record.physicsKey, physicsValues: record.physicsValues,
        presetId: record.presetId, presetName: record.presetName, setupLabel: record.setupLabel,...(record.courseRules?{courseRules:record.courseRules}:{}),...(record.practice?{practice:record.practice}:{}),
        setupHistoryId: record.setupHistoryId, setupSaveNumber: record.setupSaveNumber, saveNumber: record.saveNumber, isPersonalBest,
        isSetupBest: record.isSetupBest, captureSource: record.captureSource, verification: 'local',
        replayAvailable: record.replayAvailable,
        ...(record.replayAvailable ? { recording: record.recording, carStyle: record.carStyle } : {}) });
      const bounded = history.slice(0, 200);
      let remaining = RUN_REPLAY_BUDGET;
      for (const archived of bounded) {
        // Browser storage holds UTF-16 strings. The budget covers replay/car-style data, not the small run metadata.
        const bytes = 2 * ((typeof archived.recording === 'string' ? archived.recording.length : 0) +
          (typeof archived.carStyle === 'string' ? archived.carStyle.length : 0));
        if (bytes && bytes <= remaining) { remaining -= bytes; archived.replayRetained = true; }
        else { delete archived.recording; delete archived.carStyle; archived.replayRetained = false; }
      }
      localStorage.setItem(PREFIX + RUN_HISTORY_KEY, JSON.stringify(bounded));
      lab.historyStorageError = null;
    } catch (error) { lab.historyStorageError = 'Run history could not be saved: ' + error.message; }
  }
  lab.getRunHistory = ({ trackId, physicsKey, limit = 200 } = {}) => {
    const history = read(RUN_HISTORY_KEY, []);
    const savedBySetup = new Map();
    return (Array.isArray(history) ? history : []).filter(record => record && typeof record.runId === 'string' &&
      Number.isSafeInteger(record.timeMs) && record.timeMs > 0 && (!trackId || record.trackId === trackId) &&
      (!physicsKey || record.physicsKey === physicsKey)).slice(0, Math.max(0, Math.min(200, Number.isFinite(limit) ? Math.floor(limit) : 200)))
      .map(record => {
        if (!savedBySetup.has(record.physicsKey)) savedBySetup.set(record.physicsKey, scores(record.physicsKey));
        const saved = savedBySetup.get(record.physicsKey).find(candidate => candidate.id === record.recordId && candidate.trackId === record.trackId);
        const { recording, carStyle, ...metadata } = record;
        const personalBestReplay = saved?.runId === record.runId && typeof saved.recording === 'string' && !!saved.recording;
        const archiveReplay = typeof recording === 'string' && !!recording;
        const descriptor = descriptorForRecord(record, record.physicsKey);
        return { ...metadata,nickname:typeof record.nickname==='string'?record.nickname:'Local player', physicsValues: descriptor.physicsValues,
          replayAvailable: descriptor.replayAvailable && (personalBestReplay || archiveReplay),
          replayStorage: personalBestReplay ? 'personal-best' : archiveReplay ? 'recent-archive' : 'none' };
      });
  };
  lab.restoreRunSettings = record => {
    if(String(record?.physicsKey).includes('~course:')){if(!lab.restoreCourseRun)throw Error('Course restoration is still loading.');return lab.restoreCourseRun(record);}
    const values = normalizedPhysics(record?.physicsValues, true) || decodeLegacyPhysics(record?.physicsKey);
    if (!values) throw Error('This legacy setup has no complete physics settings to restore');
    if (typeof lab.applySettings !== 'function') throw Error('The physics settings are still starting');
    lab.applySettings(values); return { ...values };
  };
  lab.getLocalReplay = record => {
    if (!record || typeof record.physicsKey !== 'string') throw Error('Choose a saved run with physics settings');
    const fallback = !record.runId && scores(record.physicsKey).find(candidate => candidate.id === (record.recordId ?? record.id) && candidate.trackId === record.trackId);
    const runId = record.runId || fallback?.runId || `legacy:${encodeURIComponent(record.physicsKey)}:${record.recordId ?? record.id}`;
    const saved = findRawLocalRun(runId, record.trackId, record.physicsKey)?.record;
    if (!saved) throw Error('This saved run is no longer available');
    const descriptor = descriptorForRecord(saved, record.physicsKey);
    if (!descriptor.replayAvailable) throw Error('This run uses extra controls that cannot be replayed');
    if (!saved.recording) throw Error('This replay has aged out of the bounded local archive. Its time and settings remain saved');
    if (!types) throw Error('The game is still starting');
    const recording = types.Recording.deserialize(saved.recording);
    if (!recording) throw Error('This local recording could not be read');
    recording.labPhysicsMode=record.physicsKey==='stock'?'stock':'custom';recording.labPhysicsValues={...descriptor.physicsValues};
    return { recording, carStyle: saved.carStyle ? types.CarStyle.deserializeSafe(saved.carStyle) : types.CarStyle.default(),
      nickname: `${saved.nickname || 'Anonymous'} (you) · ${descriptor.setupLabel}`, time: new types.Frames(saved.frames), isSelf: true, physicsKey: record.physicsKey };
  };
  lab.decodePublicReplay = row => {
    if (!types) throw Error('The game is still starting');
    if (row?.status !== 'available' || !Number.isSafeInteger(row.frames) || row.frames <= 0 || row.frames > (types.Recording.maxFrames || 86400000) ||
      typeof row.recording !== 'string' || !row.recording || row.recording.length > 20 * 1024 * 1024 ||
      typeof row.carStyle !== 'string' || !row.carStyle || row.carStyle.length > 4096 ||
      typeof row.nickname !== 'string' || row.nickname.length > 200) throw Error('This saved public replay is unavailable or invalid');
    const recording = types.Recording.deserialize(row.recording);
    if (!recording) throw Error('This saved public replay could not be read');
    recording.labPhysicsMode='stock';recording.labPhysicsValues=normalizedPhysics({});
    return { recording, time: new types.Frames(row.frames), carStyle: types.CarStyle.deserializeSafe(row.carStyle),
      nickname: row.nickname, isSelf: false, physicsKey: 'stock' };
  };
  const knownTrackName = id => catalog.find(track => track.trackId === id)?.name || weeklyNames.get(id) || knownTrackNames.get(id) || runtime?.getTrackName?.(id);
  const trackName = id => knownTrackName(id) || 'Track ' + String(id).slice(0, 8);
  lab.rememberTrackName = (id, name) => { if (/^[a-f0-9]{64}$/.test(id || '') && typeof name === 'string' && name.trim()) knownTrackNames.set(id, name); };
  lab.loadTrackNames = () => trackNamesPromise ||= fetch('snapshots/leaderboards/index.json', { credentials: 'omit' })
    .then(response => response.ok ? response.json() : null).then(value => {
      if (Array.isArray(value?.tracks)) for (const track of value.tracks) lab.rememberTrackName(track.trackId, track.name);
      return value?.tracks || [];
    }).catch(() => { trackNamesPromise = null; return []; });
  lab.getPublicLeaderboardIndex = lab.loadTrackNames;
  const serialize = value => typeof value?.serialize === 'function' ? value.serialize() : value;
  function deserialize(record, userHash) {
    return { id: record.id, nickname: record.nickname, countryCode: record.countryCode,
      frames: new types.Frames(record.frames), time: new Date(record.date),
      carStyle: record.carStyle ? types.CarStyle.deserializeSafe(record.carStyle) : types.CarStyle.default(), verifiedState: 0, isSelf: record.userHash === userHash };
  }
  function remember({ trackId, nickname = 'Local player', countryCode = null, carStyle, frames, recording, user = 'local', userHash = null, captureHistory = true, captureSource = 'record' }) {
    const numberOfFrames = frames?.numberOfFrames ?? frames;
    if (!Number.isSafeInteger(numberOfFrames) || numberOfFrames <= 0) throw Error('Invalid local finish time');
    const list = scores(), existing = list.find(entry => entry.trackId === trackId && entry.user === user);
    const isPersonalBest = !existing || existing.frames > numberOfFrames;
    const isSetupBest = !list.some(entry => entry.trackId === trackId && entry.frames <= numberOfFrames);
    if (!isPersonalBest && !captureHistory) return existing.id;
    const descriptor = lab.getCurrentSetupDescriptor();
    const nextId = isPersonalBest && !existing ? allPhysicsKeys().reduce((next, key) => scores(key).reduce((id, entry) => Math.max(id, entry.id + 1), next), Date.now()) : existing?.id;
    const serializedRecording = serialize(recording);
    const record = { id: existing?.id || nextId, trackId, user, userHash, nickname, countryCode,
      frames: numberOfFrames, recording: serializedRecording, carStyle: serialize(carStyle),
      date: new Date().toISOString(), name: trackName(trackId), ...descriptor,
      runId: newRunId(), isSetupBest, captureSource,
      replayAvailable: descriptor.replayAvailable && typeof serializedRecording === 'string' && !!serializedRecording };
    if (!isPersonalBest) {
      appendRunHistory(record, false);
      window.dispatchEvent(new CustomEvent('polytrack-lab-run-history-changed'));
      return existing.id;
    }
    if (existing) list.splice(list.indexOf(existing), 1);
    list.push(record); write(scoreKey(), list);
    appendRunHistory(record, true);
    window.dispatchEvent(new CustomEvent('polytrack-lab-records-changed'));
    window.dispatchEvent(new CustomEvent('polytrack-lab-run-history-changed'));
    return record.id;
  }
  lab.captureFinish = remember;
  const pendingFinishCaptures = new Map();
  const finishCaptureKey = (trackId, user) => JSON.stringify([profileKey(), trackId, user]);
  lab.captureRun = input => {
    if(lab.physicsRestarting)return null;
    const profile = runtime?.getCurrentProfile?.();
    const args = { user: profile?.token || 'local', userHash: profile?.tokenHash || null,
      nickname: profile?.nickname || 'Local player', countryCode: profile?.countryCode || null,
      carStyle: profile?.carStyle, ...input, captureSource: 'finish' };
    const id = remember(args);
    pendingFinishCaptures.set(finishCaptureKey(args.trackId, args.user), { id, frames: args.frames?.numberOfFrames ?? args.frames, at: Date.now() });
    return id;
  };
  lab.installRecords = RecordClass => {
    const original = RecordClass.prototype.setRecord;
    const originalGetRecord = RecordClass.prototype.getRecord;
    const originalGetRecordTime = RecordClass.prototype.getRecordTime;
    RecordClass.prototype.getRecord = function() {
      if (lab.replayEnabled?.() === false) return null;
      const record=originalGetRecord.apply(this, arguments);if(record?.recording&&!record.recording.labPhysicsValues)lab.tagRecording(record.recording);return record;
    };
    RecordClass.prototype.getRecordTime = function() {
      if (lab.replayEnabled?.() === false) return originalGetRecord.apply(this, arguments)?.time ?? null;
      return originalGetRecordTime.apply(this, arguments);
    };
    RecordClass.prototype.setRecord = function(slot, trackId, verified, frames, recording) {
      const best = originalGetRecord?.call(this, slot, trackId);
      const profile = runtime?.getProfile?.(slot);
      const pendingKey = finishCaptureKey(trackId, profile?.token || 'slot-' + slot), pending = pendingFinishCaptures.get(pendingKey);
      const alreadyCaptured = pending && pending.frames === frames.numberOfFrames && Date.now() - pending.at < 30000;
      if (alreadyCaptured) pendingFinishCaptures.delete(pendingKey);
      try { if (!alreadyCaptured) remember({ trackId, frames, recording, user: profile?.token || 'slot-' + slot, userHash: profile?.tokenHash,
        nickname: profile?.nickname || 'Local player', countryCode: profile?.countryCode || null,
        carStyle: profile?.carStyle || types?.CarStyle.default() }); }
      catch (error) { lab.storageError = 'Local records could not be saved: ' + error.message; console.warn(lab.storageError); }
      if (best && best.time.numberOfFrames <= frames.numberOfFrames) return Promise.resolve(null);
      return original.apply(this, arguments);
    };
  };
  lab.attachRuntime = value => { runtime = value; window.dispatchEvent(new CustomEvent('polytrack-lab-runtime-ready')); };
  lab.ensureGhostsVisible=()=>runtime?.ensureGhostsVisible?.();
  lab.restartPhysics=()=>runtime?.restartPhysics?.()??false;
  lab.canRestartCurrentRun=()=>runtime?.canRestartCurrentRun?.()===true;
  lab.queueCurrentRunRestart=()=>runtime?.queueCurrentRunRestart?.();
  lab.tagRecording=(recording,values=lab.getSettings(),key=profileKey(),unsupported=lab.replayEnabled?.()===false)=>{if(!recording)return recording;recording.labReplayUnsupported=unsupported;recording.labPhysicsMode=key==='stock'?'stock':'custom';recording.labPhysicsValues=normalizedPhysics(values,true);return recording;};
  lab.renderCarThumbnail=(style,values=lab.getDefaults())=>{if(!types||!runtime?.renderCarThumbnail)return Promise.resolve('');return runtime.renderCarThumbnail(typeof style==='string'?types.CarStyle.deserializeSafe(style):style,normalizedPhysics(values,true)||lab.getDefaults());};
  lab.renderVehiclePreview=values=>{if(!types||!runtime?.renderCarThumbnail)return Promise.resolve('');const normalized=normalizedPhysics(values,true);if(!normalized)throw Error('Enter valid dimensions to preview the car.');return runtime.renderCarThumbnail(runtime.getCurrentProfile?.()?.carStyle||types.CarStyle.default(),normalized);};
  lab.getLocalCarStyle=record=>findRawLocalRun(record.runId,record.trackId,record.physicsKey)?.record?.carStyle||null;
  lab.getCourseScene=()=>runtime?.getScene?.();
  lab.getCourseThree=()=>runtime?.three;
  lab.getEditorTrackCode=()=>{const exporter=lab.editorActions?.exportTrack||lab.trackActions?.exportTrack;if(!exporter)throw Error('Open a track or the editor first.');return exporter();};
  lab.inspectCourseCode=code=>{if(!runtime)throw Error('The game is still starting.');const parsed=runtime.parseTrack(code);if(!parsed)throw Error('Invalid PolyTrack course.');return {trackId:parsed.trackData.getId(),name:parsed.trackMetadata.name,author:parsed.trackMetadata.author};};
  lab.getNativeReservedBindingCodes=()=>runtime?.getNativeReservedCodes?.()||[];
  function parseTrackCode(code, expectedTrackId = null) {
    if (!runtime) throw Error('The game is still starting. Please try again.');
    if (typeof code !== 'string' || code.length > 4 * 1024 * 1024 || !/^PolyTrack[0-9A-Za-z+/_=-]+$/.test(code.trim())) throw Error('Invalid PolyTrack course code');
    if (expectedTrackId !== null && !/^[a-f0-9]{64}$/.test(expectedTrackId)) throw Error('Invalid expected track identity');
    const parsed = runtime.parseTrack(code.trim());
    if (!parsed) throw Error('This course code is not supported by PolyTrack 0.6.3');
    const id = parsed.trackData.getId();
    if (expectedTrackId !== null && id !== expectedTrackId) throw Error('Track identity does not match the selected course');
    lab.rememberTrackName(id, parsed.trackMetadata.name);
    if (typeof runtime.saveTrack !== 'function' || runtime.saveTrack(parsed.trackMetadata, parsed.trackData) === false) throw Error('This course could not be saved locally');
    return parsed;
  }
  lab.playTrackCode = (code, expectedTrackId = null) => {
    const parsed = parseTrackCode(code, expectedTrackId);
    runtime.playTrack(parsed.trackMetadata, parsed.trackData); return parsed;
  };
  lab.saveCourseCode=code=>parseTrackCode(code);
  lab.watchTrackCode = (code, entries, expectedTrackId = null) => {
    if (!Array.isArray(entries) || !entries.length || entries.length > 10 || entries.some(entry => !entry?.recording || !entry.carStyle ||
      !Number.isSafeInteger(entry.time?.numberOfFrames) || entry.time.numberOfFrames <= 0 || typeof entry.nickname !== 'string')) throw Error('Choose a valid replay to watch');
    if (!runtime?.watchTrack) throw Error('The replay viewer is still starting');
    const parsed = parseTrackCode(code, expectedTrackId);
    runtime.watchTrack(parsed.trackMetadata, parsed.trackData, entries); return parsed;
  };
  lab.raceTrackCode = (code, entries, expectedTrackId = null) => {
    if (!Array.isArray(entries) || !entries.length || entries.length > 10 || entries.some(entry => !entry?.recording || !entry.carStyle ||
      !Number.isSafeInteger(entry.time?.numberOfFrames) || entry.time.numberOfFrames <= 0 || typeof entry.nickname !== 'string')) throw Error('Choose up to 10 valid ghosts');
    if (!runtime?.raceTrack) throw Error('The race is still starting');
    const parsed=parseTrackCode(code,expectedTrackId);runtime.raceTrack(parsed.trackMetadata,parsed.trackData,entries);return parsed;
  };
  lab.getExtraTracks = () => catalogPromise ||= fetch('extra-tracks/catalog.json', { credentials: 'omit' })
    .then(response => { if (!response.ok) throw Error('Extra track collection could not load'); return response.json(); })
    .then(entries => { if (!Array.isArray(entries)) throw Error('Invalid track collection'); catalog = entries; return catalog; })
    .catch(error => { catalogPromise = null; throw error; });
  async function prepareExtraTrack(entry) {
    if (!runtime) throw Error('The game is still starting. Please try again.');
    const entries = await lab.getExtraTracks(), track = entries.find(candidate => candidate.id === entry?.id);
    if (!track || !/^(?:extra-tracks\/(?:track-data|challenges)\/[a-zA-Z0-9_\-/]+|events\/kodub\/assets\/[a-f0-9]{64})\.track$/.test(track.trackPath)) throw Error('Unknown extra track');
    const response = await fetch(track.trackPath, { credentials: 'omit' });
    if (!response.ok) throw Error('This track could not load. Please try again.');
    const parsed = runtime.parseTrack((await response.text()).trim());
    if (!parsed) throw Error('This track file is not supported by PolyTrack 0.6.3');
    if (parsed.trackData.getId() !== track.trackId) throw Error('Track identity does not match its catalog entry');
    lab.rememberTrackName(track.trackId, parsed.trackMetadata.name);
    return parsed;
  }
  lab.saveExtraTrack = async entry => {
    const parsed = await prepareExtraTrack(entry);
    if (!runtime.saveTrack || runtime.saveTrack(parsed.trackMetadata, parsed.trackData) === false) throw Error('This track could not be saved locally');
    savedExtraTracks.add(parsed.trackData.getId());
    return parsed;
  };
  lab.saveTrainingTrack = async entry => {
    if(!runtime)throw Error('The game is still starting. Please try again.');
    if(entry?.trackPath!=='lab-tracks/runway.track'||!/^[a-f0-9]{64}$/.test(entry.trackId||''))throw Error('Unknown training course');
    const response=await fetch(entry.trackPath);
    if(!response.ok)throw Error('The training course could not load');
    const parsed=runtime.parseTrack((await response.text()).trim());
    if(!parsed||parsed.trackData.getId()!==entry.trackId)throw Error('Training course identity check failed');
    if(runtime.saveTrack?.(parsed.trackMetadata,parsed.trackData)===false)throw Error('The training course could not be saved');
    lab.rememberTrackName(entry.trackId,parsed.trackMetadata.name);
    return parsed;
  };
  lab.isExtraTrackSaved = entry => !!(runtime?.isCustomTrack?.(entry?.trackId) || savedExtraTracks.has(entry?.trackId));
  lab.playExtraTrack = async entry => {
    const parsed = await prepareExtraTrack(entry);
    if (runtime.saveTrack?.(parsed.trackMetadata, parsed.trackData) !== false) savedExtraTracks.add(parsed.trackData.getId());
    runtime.playTrack(parsed.trackMetadata, parsed.trackData);
  };
  lab.getPersonalBest = trackId => {
    const times = scores().filter(entry => entry.trackId === trackId).map(entry => entry.frames);
    return times.length ? Math.min(...times) : null;
  };
  lab.getLocalTimes = () => scores().map(entry => ({ ...entry, ...experimentRecord(entry, profileKey()) }));
  lab.getPublicLeaderboard = async trackId => {
    if (!/^[a-f0-9]{64}$/.test(trackId || '')) throw Error('Invalid track identity');
    const known=await lab.loadTrackNames();
    if(!known.some(track=>track.trackId===trackId))return {available:false,source:'snapshot',physics:'stock'};
    const response = await fetch('snapshots/leaderboards/' + trackId + '.json', { credentials: 'omit' });
    if (!response.ok) return { available: false, source: 'snapshot', physics: 'stock' };
    const value = await response.json();
    if (!value || value.trackId !== trackId || value.physics !== 'stock' ||
        !Number.isFinite(Date.parse(value.capturedAt)) || !Number.isSafeInteger(value.total) || value.total < 0 ||
        !Array.isArray(value.entries) || value.entries.length > 100 || value.entries.some((entry, index) =>
          entry.rank !== index + 1 || typeof entry.nickname !== 'string' ||
          !Number.isSafeInteger(entry.timeMs) || entry.timeMs <= 0 ||
          !(entry.countryCode === null || typeof entry.countryCode === 'string' && /^[a-z]{2}$/.test(entry.countryCode)))) throw Error('Invalid leaderboard snapshot');
    return { ...value, available: true, source: 'snapshot', comparable: profileKey() === 'stock' };
  };
  async function weeklyJson() {
    try {
      const response = await fetch(ROOT + '?version=0.6.3', { credentials: 'omit', signal: AbortSignal.timeout(7000) });
      if (!response.ok) throw Error('Official weekly feed is unavailable');
      const value = await response.json(); validateWeekly(value, true);
      lab.weeklyStatus = { source: 'live', endTime: value.current?.endTime || null };
      window.dispatchEvent(new CustomEvent('polytrack-lab-weekly-changed'));
      return value;
    } catch (liveError) {
      const response = await fetch('weekly/current.json', { credentials: 'omit' });
      if (!response.ok) throw liveError;
      const value = await response.json(); validateWeekly(value, false);
      if (value.current) for (const field of ['trackUrl', 'thumbnailUrl', 'coverUrl']) {
        if (value.current[field]) value.current[field] = new URL(value.current[field], new URL('weekly/', document.baseURI)).href;
      }
      value.capturedAt = value.serverTime;
      value.serverTime = new Date().toISOString();
      lab.weeklyStatus = { source: 'bundled', endTime: value.current?.endTime || null };
      window.dispatchEvent(new CustomEvent('polytrack-lab-weekly-changed'));
      return value;
    }
  }
  async function loadWeekly() {
    const value = await weeklyJson(), current = value.current;
    if (!current) return { current: null, source: lab.weeklyStatus.source, capturedAt: value.capturedAt || null };
    weeklyNames.set(current.trackId, current.name);
    const endTime = new Date(current.endTime), serverTime = new Date(value.serverTime);
    return { source: lab.weeklyStatus.source, capturedAt: value.capturedAt || null, current: { ...current,
      trackMetadata: { name: current.name, author: current.author,
        lastModified: current.lastModified ? new Date(current.lastModified) : null },
      endTime, clientEndTime: new Date(endTime.getTime() + Date.now() - serverTime.getTime()) } };
  }
  lab.getWeeklyTrack = (refresh = false) => {
    if (refresh || weeklyUntil <= Date.now()) weeklyPromise = null;
    if (weeklyPromise) return weeklyPromise;
    weeklyUntil = Infinity;
    return weeklyPromise = loadWeekly().then(result => {
      weeklyUntil = result.current?.endTime.getTime() || 0;
      if (!result.current) weeklyPromise = null;
      return result;
    }).catch(error => { weeklyPromise = null; throw error; });
  };
  lab.playWeeklyTrack = async () => {
    if (!runtime || !apiInstance) throw Error('The game is still starting. Please try again.');
    let selection = await lab.getWeeklyTrack();
    if (!selection.current || selection.current.endTime.getTime() <= Date.now()) selection = await lab.getWeeklyTrack(true);
    const current = selection.current;
    if (!current || current.endTime.getTime() <= Date.now()) throw Error('No current weekly track is available');
    const code = await apiInstance.loadTrackCodeFromUrl(current.trackUrl);
    const parsed = runtime.parseTrack(code.trim());
    if (!parsed) throw Error('The weekly track is not supported by PolyTrack 0.6.3');
    if (parsed.trackData.getId() !== current.trackId) throw Error('Weekly track identity does not match the official selection');
    runtime.saveTrack?.(parsed.trackMetadata, parsed.trackData);
    runtime.playTrack(parsed.trackMetadata, parsed.trackData);
  };
  function validateWeekly(value, live) {
    if (!value || !Number.isFinite(Date.parse(value.serverTime))) throw Error('Invalid weekly feed');
    const current = value.current;
    if (current === null) return;
    if (!current || !/^[a-f0-9]{64}$/.test(current.trackId) || typeof current.name !== 'string' ||
        !Number.isFinite(Date.parse(current.endTime)) || Date.parse(current.endTime) <= Date.now() ||
        !Number.isInteger(current.environment)) throw Error('No current weekly track is available');
    for (const field of ['trackUrl', 'thumbnailUrl', 'coverUrl']) {
      if (field === 'coverUrl' && current[field] === null) continue;
      if (typeof current[field] !== 'string') throw Error('Invalid weekly asset');
      if (live) {
        const url = new URL(current[field]);
        if (url.origin !== 'https://vps.kodub.com' || !/^\/v6\/trackOfTheWeek\/(track|image)\/[a-f0-9]{64}$/.test(url.pathname) || url.username || url.password || url.hash) throw Error('Invalid official weekly asset');
      } else if (!/^assets\/[a-f0-9]{64}\.(track|webp)$/.test(current[field])) throw Error('Invalid bundled weekly asset');
    }
  }
  lab.installApi = (Api, runtimeTypes) => {
    types = runtimeTypes;
    void lab.loadTrackNames();
    apiInstance = new Api();
    const proto = Api.prototype;
    proto.submitLeaderboard = async (user, nickname, countryCode, carStyle, trackId, verified, frames, recording) => ({
      uploadId: remember({ user, userHash: runtime?.getCurrentProfile?.()?.tokenHash, nickname, countryCode, carStyle, trackId, frames, recording, captureHistory: false, captureSource: 'api' }), positionChange: null
    });
    proto.getLeaderboard = async (user, trackId, skip = 0, amount = 20) => {
      lab.currentLeaderboardTrackId = trackId;
      window.dispatchEvent(new CustomEvent('polytrack-lab-leaderboard-changed', { detail: { trackId } }));
      void lab.loadTrackNames();
      const list = scores().filter(entry => entry.trackId === trackId).sort((a, b) => a.frames - b.frames);
      const own = list.find(entry => entry.userHash === user);
      return { total: list.length, entries: list.slice(skip, skip + amount).map(entry => deserialize(entry, user)),
        userEntry: own ? { position: list.indexOf(own) + 1, time: new types.Frames(own.frames), id: own.id } : null };
    };
    proto.getLeaderboardUserEntry = async (user, trackId) => {
      const list = scores().filter(entry => entry.trackId === trackId).sort((a, b) => a.frames - b.frames);
      const record = list.find(entry => entry.userHash === user);
      return record ? { position: list.indexOf(record) + 1, time: new types.Frames(record.frames), id: record.id } : null;
    };
    proto.getRecordings = async ids => ids.map(id => {
      if (lab.replayEnabled?.() === false) return null;
      const record = scores().find(entry => entry.id === id);
      if (!record || !record.recording) return null;
      return { recording: lab.tagRecording(types.Recording.deserialize(record.recording),descriptorForRecord(record,profileKey()).physicsValues,profileKey(),false), time: new types.Frames(record.frames),
        verifiedState: 0, carStyle: record.carStyle ? types.CarStyle.deserializeSafe(record.carStyle) : types.CarStyle.default() };
    });
    proto.submitUserProfile = async () => {};
    proto.getUser = async () => null;
    proto.verifyRecordings = async () => ({ unverifiedRecordings: [], exhaustive: true, estimatedRemaining: 0 });
    proto.getIceServers = async () => [];
    const unavailable = () => { throw Error('PolyTrack Lab saves records locally. Online multiplayer and administration are disabled.'); };
    proto.createMultiplayerHostWebSocket = unavailable;
    proto.createMultiplayerJoinWebSocket = unavailable;
    proto.getAdminTrackOfTheWeekList = async () => { throw Error('Administration is unavailable in PolyTrack Lab'); };
    proto.setAdminTrackOfTheWeek = proto.getAdminTrackOfTheWeekList;
    proto.getTrackOfTheWeek = () => lab.getWeeklyTrack();
    proto.loadTrackCodeFromUrl = async url => {
      const asset = new URL(url, document.baseURI);
      const official = asset.origin === 'https://vps.kodub.com' && /^\/v6\/trackOfTheWeek\/track\/[a-f0-9]{64}$/.test(asset.pathname);
      const local = asset.origin === location.origin && asset.pathname.startsWith(new URL('.', document.baseURI).pathname);
      if (!official && !local) throw Error('Track URL is not permitted');
      const response = await fetch(asset.href, { credentials: 'omit', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('Track could not load');
      return response.text();
    };
  };
})();

/* A finish belongs to its own lane in the local setup ledger. */
