/* The extra mechanic keys are shared by Physics Lab and the native Controls screen. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab;
  lab.mountBindings=(root,enableAll)=>{
    if(root.querySelector('.lab-bindings'))return;
    const section=document.createElement('section');section.className='lab-bindings';
    const heading=document.createElement('h3');heading.textContent='Lab controls';section.append(heading);
    for(const [action,name] of [['boost','Boost'],['handbrake','Slide'],['jump','Jump']]){
      const label=document.createElement('label');label.textContent=name+' ';
      const select=document.createElement('select');select.dataset.labBinding=action;select.setAttribute('aria-label',name+' key');
      select.title='Choose a free letter. Driving and game shortcuts are reserved.';
      for(const code of lab.getAllowedBindingCodes()){const option=document.createElement('option');option.value=code;option.textContent=code.slice(3);select.append(option);}
      select.value=lab.getBindings()[action];
      select.addEventListener('change',()=>{try{lab.setBindings({...lab.getBindings(),[action]:select.value});note.textContent='Keys saved.';}catch(error){select.value=lab.getBindings()[action];note.textContent=error.message;}});
      label.append(select);section.append(label);
    }
    if(enableAll){const button=document.createElement('button');button.className='button';button.type='button';button.textContent='Enable all extras';button.title='Enable boost, slide and jump in the draft. Apply to play.';button.addEventListener('click',enableAll);section.append(button);}
    const reset=document.createElement('button');reset.className='button';reset.type='button';reset.textContent='Reset keys';reset.title='Restore B boost, N slide and J jump.';reset.addEventListener('click',()=>{try{lab.setBindings({boost:'KeyB',handbrake:'KeyN',jump:'KeyJ'});note.textContent='Default keys restored.';}catch(error){note.textContent=error.message;}});section.append(reset);
    const note=document.createElement('span');note.className='lab-bindings-note';note.textContent=lab.bindingNotice||'Keys save immediately.';note.setAttribute('role','status');section.append(note);root.append(section);
  };
  window.addEventListener('polytrack-lab-bindings-changed',()=>{for(const select of document.querySelectorAll('[data-lab-binding]')){select.replaceChildren();for(const code of lab.getAllowedBindingCodes()){const option=document.createElement('option');option.value=code;option.textContent=code.slice(3);select.append(option);}select.value=lab.getBindings()[select.dataset.labBinding];}for(const note of document.querySelectorAll('.lab-bindings-note'))note.textContent=lab.bindingNotice||'Keys save immediately.';});
  const ui=document.getElementById('ui');let queued=false;
  const mount=()=>{queued=false;const settings=ui.querySelector('.settings-menu-ui>.container');if(!settings||settings.querySelector('.lab-native-bindings'))return;const controls=[...settings.querySelectorAll('h2')].find(n=>n.textContent.trim()==='Controls');if(controls){const holder=document.createElement('div');holder.className='lab-native-bindings';controls.after(holder);lab.mountBindings(holder);}};
  new MutationObserver(()=>{if(!queued){queued=true;requestAnimationFrame(mount);}}).observe(ui,{subtree:true,childList:true});
})();

/* A free mechanic key must leave the driving shortcuts their own lane. */
