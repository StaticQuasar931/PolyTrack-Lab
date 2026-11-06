// PolyTrack 0.6.3 export format, based on bundled modules 9117, 6582 and 7754.
const zlib=require('node:zlib');
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
function encode(bytes){let bit=0,result='';while(bit<bytes.length*8){const index=bit>>>3,shift=bit&7,value=((bytes[index]>>>shift)|((bytes[index+1]||0)<<(8-shift)))&63;if((value&30)===30){result+=alphabet[value&31];bit+=5;}else{result+=alphabet[value];bit+=6;}}return result;}
function decode(text){const bytes=[];let bit=0;for(let index=0;index<text.length;index++){const value=alphabet.indexOf(text[index]);if(value<0)throw Error('Invalid PolyTrack character');const count=(value&30)===30?5:6,byte=bit>>>3,shift=bit&7;while(bytes.length<=byte)bytes.push(0);bytes[byte]|=(value<<shift)&255;if(shift>8-count&&index!==text.length-1){if(bytes.length<=byte+1)bytes.push(0);bytes[byte+1]|=value>>>(8-shift);}bit+=count;}return Buffer.from(bytes);}
function runwayParts(){
  const parts=[];
  for(let z=0;z>=-120;z-=4)for(let x=-12;x<=12;x+=4){
    if(x===0&&z===0)parts.push({id:92,x,y:0,z,startOrder:0});
    else if(Math.abs(x)===8&&[-40,-76].includes(z))parts.push({id:33,x,y:0,z});
    else parts.push({id:25,x,y:0,z});
  }
  parts.push({id:76,x:0,y:0,z:-124});
  return parts;
}
function runwayCanonical(){
  const parts=runwayParts();
  const output=[0,28];
  const put32=value=>{const b=Buffer.alloc(4);b.writeInt32LE(value);output.push(...b);};
  put32(-12);put32(0);put32(-124);output.push(1|(1<<2)|(1<<4));
  for(const id of [...new Set(parts.map(part=>part.id))].sort((a,b)=>a-b)){const group=parts.filter(part=>part.id===id).sort((a,b)=>a.x-b.x||a.y-b.y||a.z-b.z);output.push(id);put32(group.length);for(const part of group){output.push(part.x+12,part.y,part.z+124,0,0);if(id===92)put32(part.startOrder);}}
  return Buffer.from(output);
}
function exportTrack(canonical,{name,author,lastModified=null}){
  const nameBytes=Buffer.from(name),authorBytes=Buffer.from(author||'');
  if(nameBytes.length>255||authorBytes.length>255)throw Error('Metadata too long');
  const modified=lastModified===null?Buffer.from([0]):(()=>{const b=Buffer.alloc(5);b[0]=1;b.writeUInt32LE(Math.floor(new Date(lastModified).getTime()/1000),1);return b;})();
  const metadata=Buffer.concat([Buffer.from([nameBytes.length]),nameBytes,Buffer.from([authorBytes.length]),authorBytes,modified]);
  const inner=zlib.deflateSync(Buffer.concat([metadata,canonical]),{level:9,windowBits:9,memLevel:9});
  return 'PolyTrack2'+encode(zlib.deflateSync(Buffer.from(encode(inner)),{level:9,windowBits:15,memLevel:9}));
}
function parseExport(code){
  if(!code.startsWith('PolyTrack2'))throw Error('Expected PolyTrack2 export');
  const innerCode=zlib.inflateSync(decode(code.slice(10))).toString('utf8'),payload=zlib.inflateSync(decode(innerCode));
  let offset=0;const nameLength=payload[offset++],name=payload.subarray(offset,offset+nameLength).toString('utf8');offset+=nameLength;
  const authorLength=payload[offset++],author=authorLength?payload.subarray(offset,offset+authorLength).toString('utf8'):null;offset+=authorLength;
  const modified=payload[offset++];let lastModified=null;if(modified===1){lastModified=new Date(payload.readUInt32LE(offset)*1000).toISOString();offset+=4;}else if(modified!==0)throw Error('Invalid metadata');
  return {name,author,lastModified,canonical:payload.subarray(offset)};
}
module.exports={encode,decode,runwayParts,runwayCanonical,exportTrack,parseExport};
