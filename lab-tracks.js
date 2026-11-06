/* Familiar Extra Tracks browser, integrated into the native Custom Tracks screen. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab;
  const feedbackKey='polytrack-lab:track-picks:v1';
  const read=()=>{try{const value=JSON.parse(localStorage.getItem(feedbackKey)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}};
  let browser=null,pending=null;
  lab.openExtraTracks=async()=>{
    if(browser){browser.refresh();browser.open();return;}
    if(pending)return pending;
    pending=(async()=>{
      const [entries,module,publicTracks]=await Promise.all([lab.getExtraTracks(),import('./extra-tracks/catalog-ui.js'),lab.loadTrackNames().catch(()=>[])]);
      browser=module.mountExtraTracks({document,root:document.body,entries,
        onPlay:async entry=>{
          const parsed=await lab.saveExtraTrack(entry);
          await new Promise(requestAnimationFrame);
          const cards=[...document.querySelectorAll('.track-selection-ui .tracks-container.no-group-containers .track-title p')].filter(title=>title.textContent.trim()===parsed.trackMetadata.name.trim());
          if(cards.length===1)cards[0].closest('button').click();
          else await lab.playExtraTrack(entry);
          browser.close();
        },
        onSave:entry=>lab.saveExtraTrack(entry),
        getPersonalBest:entry=>lab.getPersonalBest(entry.trackId),
        isLoaded:entry=>lab.isExtraTrackSaved(entry),
        getLocalRating:entry=>read()[entry.trackId]?.rating||0,
        getFeedback:entry=>read()[entry.trackId]||{},
        onFeedback:(entry,change)=>{const all=read();all[entry.trackId]={...(all[entry.trackId]||{}),...change};localStorage.setItem(feedbackKey,JSON.stringify(all));},
        onExportFeedback:()=>{
          const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),tracks:read()},null,2)],{type:'application/json'});
          const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='polytrack-lab-track-picks.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
        }
      });
      browser.setPublicResultCounts(publicTracks);browser.open();
    })().finally(()=>{pending=null;});
    return pending;
  };
  window.addEventListener('polytrack-lab-records-changed',()=>browser?.refresh());
})();

/* The practice runway keeps its own identity beside imported courses. */
