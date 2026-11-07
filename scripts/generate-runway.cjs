const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),codec=require(root+'/scripts/lab-track-codec.cjs');
const elevationGrid=12,elevationMeters=elevationGrid*5;
const pieces=new Map(),add=(x,z,id=25,rotation=0,extra={})=>pieces.set(`${x},${z}`,{x,y:elevationGrid,z,id,rotation,color:[25,33].includes(id)?1:0,...extra});
const waypoints=[[0,0],[0,-120],[120,-120],[120,-240],[-40,-240],[-40,-324]];
for(let index=1;index<waypoints.length;index++){
  const [ax,az]=waypoints[index-1],[bx,bz]=waypoints[index],dx=Math.sign(bx-ax)*4,dz=Math.sign(bz-az)*4;
  for(let x=ax,z=az;;x+=dx,z+=dz){for(const offset of [-4,0,4])add(x+(dz?offset:0),z+(dx?offset:0));if(x===bx&&z===bz)break;}
}
// Wide braking aprons leave room for four deliberate changes of direction.
for(const [cx,cz] of waypoints.slice(1,-1))for(let x=cx-8;x<=cx+8;x+=4)for(let z=cz-8;z<=cz+8;z+=4)add(x,z);
// A side practice apron keeps the optional launch ramps off the timed center line.
for(let z=4;z>=-76;z-=4)for(let x=-12;x<=12;x+=4)add(x,z);
for(const x of [-8,8])for(const z of [-28,-52])add(x,z,33);
add(0,0,92,0,{startOrder:0});
const checkpoints=[{x:0,z:-80,rotation:0},{x:80,z:-120,rotation:3},{x:120,z:-200,rotation:0},{x:20,z:-240,rotation:1},{x:-40,z:-300,rotation:0}];
checkpoints.forEach((part,index)=>add(part.x,part.z,75,part.rotation,{checkpointOrder:index}));add(-40,-324,76);
const parts=[...pieces.values()];
// Put signs beyond the aprons, never in the center of a driving surface.
parts.push({id:59,x:0,y:elevationGrid,z:-132,rotation:0,color:0},{id:58,x:132,y:elevationGrid,z:-120,rotation:3,color:0},{id:58,x:120,y:elevationGrid,z:-252,rotation:0,color:0},{id:59,x:-52,y:elevationGrid,z:-240,rotation:1,color:0});
const min={x:Math.min(...parts.map(p=>p.x)),y:elevationGrid,z:Math.min(...parts.map(p=>p.z))},max={x:Math.max(...parts.map(p=>p.x)),y:elevationGrid,z:Math.max(...parts.map(p=>p.z))};
const size=axis=>Math.max(1,Math.ceil(Math.log2(max[axis]-min[axis]+2)/8)),widths=[size('x'),size('y'),size('z')],output=[2,28];
const put=(value,bytes)=>{const b=Buffer.alloc(bytes);b.writeUIntLE(value,0,bytes);output.push(...b);},put32=value=>{const b=Buffer.alloc(4);b.writeInt32LE(value);output.push(...b);};
put32(min.x);put32(min.y);put32(min.z);output.push(widths[0]|widths[1]<<2|widths[2]<<4);
for(const id of [...new Set(parts.map(p=>p.id))].sort((a,b)=>a-b)){
  const group=parts.filter(p=>p.id===id).sort((a,b)=>a.x-b.x||a.y-b.y||a.z-b.z||a.rotation-b.rotation);output.push(id);put32(group.length);
  for(const part of group){put(part.x-min.x,widths[0]);put(part.y-min.y,widths[1]);put(part.z-min.z,widths[2]);output.push(part.rotation,part.color);if(part.checkpointOrder!==undefined)put(part.checkpointOrder,2);if(part.startOrder!==undefined)put32(part.startOrder);}
}
const canonical=Buffer.from(output),trackId=crypto.createHash('sha256').update(canonical).digest('hex');
const metadata={id:'lab-runway',name:'Lab Runway: Desert Skyway',author:'PolyTrack Lab',description:'Gray roads rise 60 m above the desert so every edge is clear. Follow the 3 km circuit through four broad turns and five checkpoints, or try the separate Boosts & Rings demo with visible Lab mechanics.',trackId,trackPath:'lab-tracks/runway.track',thumbnailUrl:'lab-tracks/runway.svg',revision:4,environment:'desert',elevationGrid,elevationMeters,features:['Raised gray roads','3 km test route','Five checkpoints','Boosts & Rings demo'],parts:parts.length,routeWaypoints:waypoints.map(([x,z])=>({x,y:elevationGrid,z})),checkpoints:checkpoints.map(part=>({...part,y:elevationGrid})),routeLengthMeters:waypoints.slice(1).reduce((n,[x,z],i)=>n+5*(Math.abs(x-waypoints[i][0])+Math.abs(z-waypoints[i][1])),0),demoPath:'lab-tracks/runway-demo.json'};
const code=codec.exportTrack(canonical,{...metadata,lastModified:null});
const demoCanonical=Buffer.from(canonical);demoCanonical[1]=29;
const demoNative=codec.exportTrack(demoCanonical,{name:'Desert Lab: Boosts & Rings',author:'PolyTrack Lab',lastModified:null});
metadata.demoTrackId=crypto.createHash('sha256').update(demoCanonical).digest('hex');
const settingsContext={console,URL,Date,Math,TextEncoder,TextDecoder,Uint8Array,btoa,atob,Worker:class{postMessage(){}terminate(){}},location:{href:'https://lab.example/',reload(){}},localStorage:{getItem:()=>null,setItem(){}},document:{addEventListener(){}},addEventListener(){}};settingsContext.window=settingsContext;vm.createContext(settingsContext);vm.runInContext(fs.readFileSync(root+'/lab-physics.js','utf8'),settingsContext);vm.runInContext(fs.readFileSync(root+'/lab-course-codec.js','utf8'),settingsContext);
const demo=settingsContext.PolyTrackLab.validateLabCourse({code:demoNative,name:'Desert Lab: Boosts & Rings',author:'PolyTrack Lab',notes:'Green pads add power while you cross them. Gold rings count bonus crossings. Blue boxes lower gravity inside them. Press your Jump key for a jump and again for a double jump. The side ramps are optional. CP1 lowers gravity; CP2 restores gravity and loosens grip; CP3 adds power; CP4 restores normal power. The normal Skyway is a separate track without these rules.',physics:{jump:8,airJumps:1},checkpoints:[{after:1,values:{gravity:.5}},{after:2,values:{gravity:1,grip:.65}},{after:3,values:{grip:1,acceleration:1.5}},{after:4,values:{acceleration:1}},{after:5,values:{gravity:1,grip:1,acceleration:1}}],objects:[
  {type:'boost',x:0,y:elevationMeters+.15,z:-60,size:36,yaw:0,strength:2},
  {type:'ring',x:0,y:elevationMeters+6,z:-150,size:6,yaw:0,strength:1},
  {type:'boost',x:0,y:elevationMeters+.15,z:-220,size:36,yaw:0,strength:2.5},
  {type:'gravity',x:40,y:elevationMeters+20,z:-260,size:60,yaw:0,strength:.25},
  {type:'ring',x:40,y:elevationMeters+8,z:-280,size:10,yaw:0,strength:1},
  {type:'gravity',x:0,y:elevationMeters+15,z:-340,size:30,yaw:0,strength:.25},
  {type:'ring',x:0,y:elevationMeters+6,z:-350,size:6,yaw:0,strength:1},
  {type:'boost',x:450,y:elevationMeters+.15,z:-600,size:30,yaw:90,strength:2}
]});
// Let the supplied engine validate the export and draw its actual native thumbnail.
const source=fs.readFileSync(root+'/main.bundle.js','utf8'),start=source.indexOf('t={')+2,end=source.indexOf('},n={};function i');let rendered;
const document={createElement:type=>{if(type!=='canvas')throw Error('Unexpected native element '+type);const canvas={width:0,height:0,getContext:()=>({createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{rendered=image;}})};return canvas;}};
const modules=vm.runInNewContext('('+source.slice(start,end+1)+')',{console,Uint8Array,Uint8ClampedArray,Uint16Array,Uint32Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,TextEncoder,TextDecoder,atob,btoa,document},{timeout:5000}),cache={};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};modules[id](m,m.exports,load);return m.exports;}
load.d=(e,d)=>{for(const[k,get]of Object.entries(d))if(!Object.hasOwn(e,k))Object.defineProperty(e,k,{enumerable:true,get});};load.o=(e,k)=>Object.hasOwn(e,k);load.n=m=>{const get=m&&m.__esModule?()=>m.default:()=>m;load.d(get,{a:get});return get;};load.r=e=>{Object.defineProperty(e,'__esModule',{value:true});};load.p='';
const parsed=load(9117).A.fromExportString(code);if(!parsed||parsed.trackData.getId()!==trackId)throw Error('Native parser rejected runway');parsed.trackData.createThumbnail();
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
const chunk=(name,data)=>{const type=Buffer.from(name),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);type.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return b;};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(rendered.width,0);ihdr.writeUInt32BE(rendered.height,4);ihdr[8]=8;ihdr[9]=6;const scan=Buffer.alloc((rendered.width*4+1)*rendered.height);for(let y=0;y<rendered.height;y++)Buffer.from(rendered.data.buffer,rendered.data.byteOffset+y*rendered.width*4,rendered.width*4).copy(scan,y*(rendered.width*4+1)+1);
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
const demoParsed=load(9117).A.fromExportString(demo.code);if(!demoParsed||demoParsed.trackData.getId()!==metadata.demoTrackId||demoParsed.trackData.getId()===trackId)throw Error('Demo identity is not isolated from the normal track');
fs.writeFileSync(root+'/lab-tracks/runway.track',code+'\n');fs.writeFileSync(root+'/lab-tracks/runway.json',JSON.stringify(metadata,null,2)+'\n');fs.writeFileSync(root+'/lab-tracks/runway-demo.track',demo.code+'\n');fs.writeFileSync(root+'/lab-tracks/runway-demo.json',JSON.stringify(demo,null,2)+'\n');
fs.writeFileSync(root+'/lab-tracks/runway.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${rendered.width} ${rendered.height}"><image width="${rendered.width}" height="${rendered.height}" style="image-rendering:pixelated" href="data:image/png;base64,${png.toString('base64')}"/></svg>\n`);
console.log(JSON.stringify({...metadata,nativeThumbnail:{width:rendered.width,height:rendered.height}},null,2));
