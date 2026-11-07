/* Calibration reads the channels exposed by the browser, never a guessed wheel layout. */
(() => {
  'use strict';
  const lab=window.PolyTrackLab=window.PolyTrackLab||{},nav=window.navigator||{},clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const finite=value=>typeof value==='number'&&Number.isFinite(value);
  function normalizePedal(raw,rest,pressed,deadzone=.03){
    if(![raw,rest,pressed].every(finite)||Math.abs(pressed-rest)<1e-6)return 0;
    const travel=clamp((raw-rest)/(pressed-rest),0,1),zone=finite(deadzone)?clamp(deadzone,0,.45):.03;
    return travel<=zone?0:(travel-zone)/(1-zone);
  }
  function normalizeSteer(raw,left,center,right,deadzone=.04,sensitivity=1){
    if(![raw,left,center,right].every(finite)||(left-center)*(right-center)>=0||Math.min(Math.abs(left-center),Math.abs(right-center))<1e-6)return 0;
    const delta=raw-center,rightSide=delta*(right-center)>=0,travel=clamp(Math.abs(delta/(rightSide?right-center:left-center)),0,1),zone=finite(deadzone)?clamp(deadzone,0,.45):.04;
    if(travel<=zone)return 0;
    const response=Math.pow((travel-zone)/(1-zone),1/(finite(sensitivity)?clamp(sensitivity,.1,4):1));
    return (rightSide?1:-1)*response;
  }
  const channelList=value=>Array.isArray(value)?value:Array.isArray(value?.channels)?value.channels:[];
  function detectMovedChannel(baseline,sample,minimumTravel=.25,options={}){
    const before=new Map(channelList(baseline).map(channel=>[channel.id,channel.value])),threshold=finite(minimumTravel)?Math.max(.0001,minimumTravel):.25,steeringOnly=options===true||options?.steeringOnly===true;
    let best=null;
    for(const channel of channelList(sample)){
      const old=before.get(channel.id),kind=channel.kind||(String(channel.id).startsWith('button:')?'button':'axis');
      if(!finite(old)||!finite(channel.value)||steeringOnly&&kind!=='axis')continue;
      const travel=Math.abs(channel.value-old);if(travel<threshold||best&&travel<=best.travel)continue;
      best={id:channel.id,label:channel.label,value:channel.value,baseline:old,travel,sourceId:sample?.id||null,kind};
    }
    return best;
  }
  const gamepadSlots=new Map(),knownNames=new Map();
  function gamepadSources(){
    let gamepads;try{gamepads=typeof nav.getGamepads==='function'?Array.from(nav.getGamepads()).filter(pad=>pad&&pad.connected!==false):[];}catch{return [];}
    const active=new Set(gamepads.map(pad=>pad.index));for(const index of gamepadSlots.keys())if(!active.has(index))gamepadSlots.delete(index);
    const groups=new Map();for(const pad of gamepads){const name=String(pad.id||'Game controller');if(!groups.has(name))groups.set(name,[]);groups.get(name).push(pad);}
    const sources=[];
    for(const [name,pads] of groups){
      pads.sort((a,b)=>a.index-b.index);const used=new Set();for(const pad of pads){const previous=gamepadSlots.get(pad.index);if(previous?.name===name)used.add(previous.ordinal);}
      for(const pad of pads){
        let slot=gamepadSlots.get(pad.index);if(slot?.name!==name){let ordinal=0;while(used.has(ordinal))ordinal++;used.add(ordinal);slot={name,ordinal};gamepadSlots.set(pad.index,slot);}
        const id='gamepad:'+name+':'+slot.ordinal,channels=[];
        Array.from(pad.axes||[]).forEach((value,index)=>{if(finite(value))channels.push({id:'axis:'+index,label:'Axis '+(index+1),value:clamp(value,-1,1),kind:'axis'});});
        Array.from(pad.buttons||[]).forEach((button,index)=>{const value=typeof button==='number'?button:button?.value;if(finite(value))channels.push({id:'button:'+index,label:'Button '+(index+1),value:clamp(value,0,1),kind:'button'});});
        if(pad.mapping!=='standard'&&/logitech|046d|g29\b|g920\b|g923\b|PRO.*Wheel/i.test(name)&&pad.axes?.length>=10){const raw=pad.axes[9],position=(raw+1)*3.5,direction=Math.round(position),valid=finite(raw)&&raw>=-1&&raw<=1&&Math.abs(position-direction)<.08;for(const [name,positions] of [['up',[7,0,1]],['right',[1,2,3]],['down',[3,4,5]],['left',[5,6,7]]])channels.push({id:'hat:9:'+name,label:'D-pad '+name,value:Number(valid&&positions.includes(direction)),kind:'button'});}
        const source={id,name:name+(pads.length>1?' #'+(slot.ordinal+1):''),type:'gamepad',mapping:pad.mapping||'',connected:true,channels};knownNames.set(id,source.name);sources.push(source);
      }
    }
    return sources;
  }
  const desktopNames={48:'X',49:'Y',50:'Z',51:'Rotation X',52:'Rotation Y',53:'Rotation Z',54:'Slider',55:'Dial',56:'Wheel'},simulationNames={196:'Accelerator',197:'Brake',198:'Clutch',199:'Shifter',200:'Steering'};
  const packedUsage=(usage,page)=>{const value=Number(usage);return Number.isSafeInteger(value)&&value>=0&&value<=0xffffffff?(value>0xffff?value:((page||0)<<16)|value)>>>0:null;};
  function compileHIDDescriptor(collections){
    const reports=new Map(),channels=[];let axisIndex=0,buttonIndex=0;
    function addChannel(report,kind,label,usage,offset,size,minimum,maximum,extra={}){
      if(channels.length>=512)return;
      const channel={id:kind+':'+(kind==='axis'?axisIndex++:buttonIndex++),label,kind,reportId:report.reportId,usage,offset,size,minimum,maximum,...extra};report.fields.push(channel);channels.push(channel);
    }
    function visit(collection,inherited=new Set()){
      const present=new Set(inherited);
      for(const definition of Array.from(collection?.inputReports||[])){
        const reportId=definition?.reportId;if(!Number.isInteger(reportId)||reportId<0||reportId>255||inherited.has(reportId))continue;present.add(reportId);
        let report=reports.get(reportId);if(!report){report={reportId,bits:0,fields:[]};reports.set(reportId,report);}
        for(const item of Array.from(definition.items||[])){
          const size=item.reportSize,count=item.reportCount;if(!Number.isInteger(size)||!Number.isInteger(count)||size<1||count<1||count>4096||report.bits+size*count>65536)throw Error('This HID report layout is too large or invalid.');
          const start=report.bits;report.bits+=size*count;
          if(size>32||item.isConstant||item.isBufferedBytes||item.isAbsolute===false)continue;
          const minimum=item.logicalMinimum,maximum=item.logicalMaximum;if(!finite(minimum)||!finite(maximum)||minimum>=maximum||minimum<-2147483648||maximum>4294967295)continue;
          const usageAt=index=>item.isRange?packedUsage(Math.min(Number(item.usageMinimum)+index,Number(item.usageMaximum)),collection.usagePage):packedUsage(item.usages?.[Math.min(index,(item.usages?.length||1)-1)],collection.usagePage);
          if(item.isArray){
            const first=usageAt(0),last=item.isRange?packedUsage(item.usageMaximum,collection.usagePage):null;
            if(first===null||first>>>16!==9||last===null||last>>>16!==9||last<first||last-first>127)continue;
            for(let usage=first;usage<=last;usage++)if((usage&0xffff)!==0)addChannel(report,'button','Button '+(usage&0xffff),usage,start,size,minimum,maximum,{arrayCount:count,arrayUsageMinimum:first});
            continue;
          }
          for(let index=0;index<count;index++){
            const usage=usageAt(index);if(usage===null)continue;const page=usage>>>16,code=usage&0xffff,kind=page===9&&code>0?'button':page===1&&(desktopNames[code]||code===57)||page===2&&simulationNames[code]?'axis':null;
            if(!kind)continue;const name=kind==='button'?'Button '+code:page===1?(desktopNames[code]||'D-pad'):simulationNames[code];
            addChannel(report,kind,name+' · HID '+reportId,usage,start+index*size,size,minimum,maximum);
          }
        }
      }
      for(const child of Array.from(collection?.children||[]))visit(child,present);
    }
    for(const collection of Array.from(collections||[]))visit(collection);
    return {reports,channels};
  }
  function readBits(view,offset,size,signed){
    let value=0;for(let index=0;index<size;index++){const bit=offset+index;if((view.getUint8(Math.floor(bit/8))>>bit%8)&1)value+=2**index;}
    return signed&&value>=2**(size-1)?value-2**size:value;
  }
  function decodeHIDReport(layout,reportId,data){
    const report=layout?.reports?.get(reportId);if(!report)return [];
    const view=data instanceof DataView?data:ArrayBuffer.isView(data)?new DataView(data.buffer,data.byteOffset,data.byteLength):data instanceof ArrayBuffer?new DataView(data):null;
    if(!view||view.byteLength*8<report.bits)return [];
    const result=[];
    for(const field of report.fields){
      let raw;
      if(field.arrayCount){raw=0;for(let index=0;index<field.arrayCount;index++){const selector=readBits(view,field.offset+index*field.size,field.size,field.minimum<0);if(selector>=field.minimum&&selector<=field.maximum&&field.arrayUsageMinimum+selector-field.minimum===field.usage){raw=1;break;}}}
      else{raw=readBits(view,field.offset,field.size,field.minimum<0);if((raw<field.minimum||raw>field.maximum)&&(field.usage&0xffff)!==57)continue;}
      if(field.usage===0x10039){const direction=raw-field.minimum,valid=direction>=0&&direction<8&&raw<=field.maximum;for(const [name,positions] of [['up',[7,0,1]],['right',[1,2,3]],['down',[3,4,5]],['left',[5,6,7]]])result.push({id:field.id+':'+name,label:'D-pad '+name,value:Number(valid&&positions.includes(direction)),kind:'button'});continue;}const value=field.arrayCount?raw:field.kind==='button'?clamp((raw-field.minimum)/(field.maximum-field.minimum),0,1):clamp(2*(raw-field.minimum)/(field.maximum-field.minimum)-1,-1,1);
      result.push({id:field.id,label:field.label,value,kind:field.kind});
    }
    return result;
  }
  const hidRecords=new Map(),deviceRecords=new WeakMap();
  const descriptorKey=layout=>{const text=layout.channels.map(channel=>[channel.reportId,channel.usage,channel.offset,channel.size].join(':')).join('|');let hash=2166136261;for(const character of text)hash=Math.imul(hash^character.charCodeAt(0),16777619)>>>0;return hash.toString(16);};
  async function attachHIDDevice(device){
    if(device.vendorId!==0x046d)throw Error('Choose a Logitech wheel or pedal device.');
    const existing=deviceRecords.get(device);if(existing?.connected)return existing;
    const layout=compileHIDDescriptor(device.collections);if(!layout.channels.length)throw Error('This device exposes no readable standard wheel, pedal, or button channels.');
    const base='hid:'+device.vendorId.toString(16)+':'+device.productId.toString(16)+':'+String(device.productName||'Logitech')+':'+descriptorKey(layout);
    let ordinal=0;while(hidRecords.get(base+':'+ordinal)?.connected)ordinal++;
    const id=base+':'+ordinal,old=hidRecords.get(id);if(old?.device&&old.listener)old.device.removeEventListener?.('inputreport',old.listener);
    if(!device.opened)await device.open();
    const record={id,name:String(device.productName||'Logitech wheel / pedals')+' (HID)',type:'hid',device,layout,values:new Map(),connected:true,receivedAt:0};
    record.listener=event=>{if(!record.connected||event.device&&event.device!==device)return;const report=layout.reports.get(event.reportId);if(!report)return;for(const channel of report.fields)record.values.delete(channel.id);for(const channel of decodeHIDReport(layout,event.reportId,event.data))record.values.set(channel.id,channel);record.receivedAt=Date.now();};
    device.addEventListener('inputreport',record.listener);deviceRecords.set(device,record);hidRecords.set(id,record);knownNames.set(id,record.name);return record;
  }
  function hidSnapshot(record){const connected=record.connected&&record.device.opened!==false;return {id:record.id,name:record.name,type:'hid',vendorId:record.device.vendorId,productId:record.device.productId,connected,channels:connected?[...record.values.values()].map(channel=>({...channel})):[],ready:connected&&record.receivedAt>0};}
  async function requestLogitechHID(){
    if(!nav.hid?.requestDevice)throw Error('WebHID is unavailable. Try Chrome or Edge on a secure page, or use a browser Gamepad device.');
    const devices=await nav.hid.requestDevice({filters:[{vendorId:0x046d}]}),sources=[],failures=[];
    for(const device of devices)try{sources.push(hidSnapshot(await attachHIDDevice(device)));}catch(error){failures.push(error.message);}
    if(!sources.length&&failures.length)throw Error(failures.join(' '));return sources;
  }
  async function restoreHIDConnections(){
    if(!nav.hid?.getDevices)return [];const result=[];for(const device of await nav.hid.getDevices())if(device.vendorId===0x046d)try{result.push(hidSnapshot(await attachHIDDevice(device)));}catch{}
    return result;
  }
  async function closeHIDSource(id){const record=hidRecords.get(id);if(!record)return;record.connected=false;record.values.clear();record.device.removeEventListener?.('inputreport',record.listener);if(record.device.opened)await record.device.close();}
  nav.hid?.addEventListener?.('disconnect',event=>{const record=deviceRecords.get(event.device);if(record){record.connected=false;record.values.clear();record.receivedAt=0;}});
  function listSources(){return [...gamepadSources(),...[...hidRecords.values()].filter(record=>record.connected).map(hidSnapshot)];}
  function readSource(id){return listSources().find(source=>source.id===id)||{id,name:knownNames.get(id)||'Disconnected controller',connected:false,channels:[]};}
  lab.wheelInput={listSources,readSource,normalizePedal,normalizeSteer,detectMovedChannel,requestLogitechHID,restoreHIDConnections,closeHIDSource,compileHIDDescriptor,decodeHIDReport};
})();
