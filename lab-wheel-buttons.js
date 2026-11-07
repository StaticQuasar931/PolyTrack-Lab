/* Wheel shortcuts share native actions while menu focus stays on visible controls. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab,storageKey='polytrack-lab.wheel-buttons.v1';
  const actions={confirm:'Select / play',back:'Back',restart:'Restart track',checkpoint:'Last checkpoint',pause:'Pause / resume',up:'Menu up',down:'Menu down',left:'Menu left',right:'Menu right',camera:'Change camera',setup:'Wheel setup'};
  let saved={enabled:true,devices:{}},previous=new Map(),repeatAt=new Map(),ready=false,sourceId=null,capture=null,lastScope=null,notice=null;
  try{const value=JSON.parse(localStorage.getItem(storageKey)||'null');if(value&&typeof value.devices==='object'&&value.devices&&!Array.isArray(value.devices))saved={enabled:value.enabled!==false,devices:value.devices};}catch{}
  const persist=()=>localStorage.setItem(storageKey,JSON.stringify(saved));
  function profile(source){
    const standard=source.mapping==='standard',pro=/PRO.*(Racing|Wheel)|Racing.*PRO/i.test(source.name),known=standard||/logitech|046d|g29\b|g920\b|g923\b|thrustmaster|t300|t150|t248|t128|fanatec|moza|simagic|pxn/i.test(source.name+' '+source.id);
    if(!known)return null;
    // Logitech's PC PRO guide uses one-based A=1, B=3, X=2, Y=4.
    const buttons=standard?{confirm:0,back:1,checkpoint:2,restart:3,pause:9,up:12,down:13,left:14,right:15,camera:4,setup:8}:pro?{confirm:0,back:2,checkpoint:1,restart:3,pause:9,camera:11,setup:8}:{confirm:0,back:2,checkpoint:1,restart:3,pause:9,camera:4,setup:8};
    const bindings={};for(const [action,index] of Object.entries(buttons)){const id='button:'+index;if(source.channels.some(c=>c.id===id))bindings[action]=id;}
    for(const direction of ['up','down','left','right']){const hat=source.channels.find(c=>c.id.endsWith(':'+direction)&&c.kind==='button');if(hat)bindings[direction]=hat.id;}
    if(!bindings.up&&source.channels.some(c=>c.id==='button:4'))bindings.up='button:4';if(!bindings.down&&source.channels.some(c=>c.id==='button:5'))bindings.down='button:5';return {name:standard?'Standard controller':pro?'Logitech PRO PC':'Numbered PC wheel',bindings};
  }
  function choose(sources){const preferred=lab.getWheelSourceId?.();return sources.find(s=>s.id===preferred&&s.connected)||sources.find(s=>s.connected&&profile(s));}
  function bindings(source){const base=profile(source),custom=saved.devices[source.id];const map={...(base?.bindings||{})};if(custom&&typeof custom==='object')for(const action of Object.keys(actions))if(custom[action]===null||typeof custom[action]==='string'&&custom[action].length<100)map[action]=custom[action];return map;}
  const visible=node=>!!node&&node.isConnected!==false&&!node.closest?.('[hidden],.hidden,[inert]')&&node.getClientRects().length>0&&getComputedStyle(node).visibility!=='hidden';
  function scope(){return [...document.querySelectorAll('dialog[open]')].at(-1)||document.getElementById('ui')||document.body;}
  function candidates(root){return [...root.querySelectorAll('button,a[href],input:not([type=hidden]),select,summary,[tabindex]')].filter(n=>!n.disabled&&n.tabIndex>=0&&visible(n));}
  function key(code,action){for(const type of ['keydown','keyup']){const event=new KeyboardEvent(type,{code,key:code==='Escape'?'Escape':code,bubbles:true,cancelable:true});if(action)Object.defineProperty(event,'labWheelAction',{value:action});window.dispatchEvent(event);}}
  function focusMove(direction){
    const root=scope(),nodes=candidates(root);if(!nodes.length)return;const current=document.activeElement;
    if(root!==lastScope||!nodes.includes(current)){lastScope=root;nodes[0].focus();nodes[0].scrollIntoView({block:'nearest'});return;}
    const delta=direction==='left'||direction==='up'?-1:1;
    if(current.matches('input[type=range],input[type=number]')&&['left','right'].includes(direction)){const step=Number(current.step)||1,minimum=Number(current.min||0),maximum=Number(current.max||100);current.value=String(Math.max(minimum,Math.min(maximum,Number(current.value)+delta*step)));current.dispatchEvent(new Event('input',{bubbles:true}));current.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if(current.matches('select')&&['left','right'].includes(direction)){current.selectedIndex=Math.max(0,Math.min(current.options.length-1,current.selectedIndex+delta));current.dispatchEvent(new Event('change',{bubbles:true}));return;}
    const a=current.getBoundingClientRect(),ax=a.x+a.width/2,ay=a.y+a.height/2,horizontal=['left','right'].includes(direction);let best=null,score=Infinity;
    for(const node of nodes){if(node===current)continue;const b=node.getBoundingClientRect(),dx=b.x+b.width/2-ax,dy=b.y+b.height/2-ay,forward=(horizontal?dx:dy)*delta,side=Math.abs(horizontal?dy:dx);if(forward<=2)continue;const cost=forward+side*3;if(cost<score){score=cost;best=node;}}
    (best||nodes[(nodes.indexOf(current)+delta+nodes.length)%nodes.length]).focus();document.activeElement.scrollIntoView({block:'nearest'});
  }
  function perform(action){
    if(capture)return;const root=scope(),dialog=root.matches?.('dialog[open]'),game=document.body.dataset.labScene==='game',typing=document.activeElement?.matches('textarea,input:not([type=range]):not([type=checkbox]):not([type=button])');
    if(action==='setup'){lab.openWheelSetup?.();return;}
    if(['up','down','left','right'].includes(action)){focusMove(action);return;}
    if(action==='back'){if(dialog){root.close();return;}const back=[...root.querySelectorAll('button.back,button.close,[aria-label="Back"]')].find(visible);if(back)back.click();else key('Escape');return;}
    if(action==='confirm'){if(typing)return;const focused=document.activeElement;if(root.contains(focused)&&visible(focused)&&!focused.disabled&&focused.matches('button,a[href],summary,input[type=checkbox]')){focused.click();return;}const play=[...root.querySelectorAll('button.play,.lab-play-track')].find(visible);if(play)play.click();else focusMove('down');return;}
    if(!game||dialog||typing||lab.physicsRestarting)return;
    if(['restart','checkpoint','pause','camera'].includes(action))key('Unidentified',action);
  }
  function tick(now){
    const sources=lab.wheelInput.listSources(),source=choose(sources),focused=document.hasFocus?.()!==false&&!document.hidden;
    if(!source||source.id!==sourceId||!focused||!saved.enabled){sourceId=source?.id||null;previous=new Map(source?.channels.filter(c=>c.kind==='button').map(c=>[c.id,c.value>=.5])||[]);repeatAt.clear();ready=false;if(capture&&(!source||!focused)){capture=null;if(notice)notice.textContent='Binding cancelled. Reconnect and try again.';}requestAnimationFrame(tick);return;}
    const channels=source.channels.filter(c=>c.kind==='button'),current=new Map(channels.map(c=>[c.id,c.value>=.5]));
    if(!ready){if(channels.length&&![...current.values()].some(Boolean))ready=true;previous=current;requestAnimationFrame(tick);return;}
    if(capture){for(const c of channels)if(current.get(c.id)&&!previous.get(c.id)){try{lab.bindWheelButton(capture,source.id,c.id);if(notice)notice.textContent=actions[capture]+' saved.';}catch(error){if(notice)notice.textContent=error.message;}capture=null;ready=false;break;}}
    else {const map=bindings(source),used=new Set();for(const [action,id] of Object.entries(map)){if(!id||used.has(id))continue;used.add(id);const down=current.get(id)===true,pressed=down&&!previous.get(id),navigation=['up','down','left','right'].includes(action);if(pressed||down&&navigation&&now>=(repeatAt.get(id)||Infinity)){perform(action);repeatAt.set(id,now+(pressed?400:150));}if(!down)repeatAt.delete(id);}}
    previous=current;requestAnimationFrame(tick);
  }
  lab.getWheelButtonState=()=>{const source=choose(lab.wheelInput.listSources());return {enabled:saved.enabled,sourceId:source?.id||null,profile:source?profile(source)?.name||'Custom wheel':null,bindings:source?bindings(source):{},capture};};
  lab.bindWheelButton=(action,id,channelId)=>{if(!Object.hasOwn(actions,action))throw Error('Choose a wheel action.');const source=lab.wheelInput.readSource(id);if(!source.connected||!source.channels.some(c=>c.id===channelId&&c.kind==='button'))throw Error('Press a wheel button, not a pedal or steering axis.');const previousSaved=structuredClone(saved);const map={...bindings(source)};for(const key of Object.keys(map))if(map[key]===channelId)map[key]=null;map[action]=channelId;saved.devices[id]=map;try{persist();}catch(error){saved=previousSaved;throw error;}};
  lab.mountWheelButtons=dialog=>{
    const section=document.createElement('details');section.className='lab-wheel-shortcuts';const summary=document.createElement('summary');summary.textContent='Wheel buttons & menu controls';section.append(summary);
    const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=saved.enabled;const label=document.createElement('label');label.append(enabled,' Enable wheel buttons (also in menus)');section.append(label);enabled.addEventListener('change',()=>{const old=saved.enabled;saved.enabled=enabled.checked;try{persist();ready=false;}catch(error){saved.enabled=old;enabled.checked=old;notice.textContent=error.message;}});
    const info=document.createElement('p');section.append(info);notice=document.createElement('p');notice.setAttribute('role','status');notice.className='lab-wheel-notice';
    const rows=[];for(const [action,title] of Object.entries(actions)){const row=document.createElement('div');row.className='lab-wheel-binding';const name=document.createElement('strong');name.textContent=title;const value=document.createElement('span'),button=document.createElement('button');button.type='button';button.className='button';button.textContent='Rebind';button.addEventListener('click',()=>{capture=action;ready=false;notice.textContent='Release all wheel buttons, then press the button for '+title+'.';});row.append(name,value,button);section.append(row);rows.push({action,value,button});}
    const reset=document.createElement('button');reset.type='button';reset.className='button';reset.textContent='Restore automatic buttons';reset.addEventListener('click',()=>{const source=choose(lab.wheelInput.listSources());if(!source)return;const old=saved.devices[source.id];delete saved.devices[source.id];try{persist();capture=null;ready=false;notice.textContent='Automatic buttons restored. Calibration was kept.';}catch(error){saved.devices[source.id]=old;notice.textContent=error.message;}});const cancel=document.createElement('button');cancel.type='button';cancel.className='button';cancel.textContent='Cancel binding';cancel.addEventListener('click',()=>{capture=null;notice.textContent='';});section.append(reset,cancel,notice);dialog.append(section);
    const refresh=()=>{if(!dialog.open)return;const state=lab.getWheelButtonState(),source=state.sourceId&&lab.wheelInput.readSource(state.sourceId);info.textContent=source?state.profile+' · Defaults are automatic. Press Rebind if a button differs. D-pad moves focus; left/right adjusts sliders.':'Connect a wheel to use automatic buttons. Your pedal calibration is kept.';for(const row of rows){const channel=source?.channels.find(c=>c.id===state.bindings[row.action]);const face=(state.profile==='Logitech PRO PC'?{'button:0':'A','button:1':'X','button:2':'B','button:3':'Y','button:9':'Menu'}:state.profile==='Standard controller'?{'button:0':'A / Cross','button:1':'B / Circle','button:2':'X / Square','button:3':'Y / Triangle'}:{})[channel?.id];row.value.textContent=channel?(face?face+' · '+channel.label:channel.label):'Not bound';row.button.disabled=!source||!saved.enabled;}};setInterval(refresh,200);dialog.addEventListener('close',()=>{capture=null;ready=false;});
  };
  document.addEventListener('DOMContentLoaded',()=>requestAnimationFrame(tick),{once:true});
})();
