const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');let files=0,max={size:0,name:''};
function scan(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','work','test-results'].includes(item.name))continue;const file=path.join(dir,item.name);if(item.isDirectory())scan(file);else if(item.isFile()){const size=fs.statSync(file).size;files++;assert(size<20000000,'Public file must be below20MB: '+path.relative(root,file));if(size>max.size)max={size,name:path.relative(root,file)};}}}
scan(root);console.log(`PASS: ${files} public project files below20MB; largest ${max.name} (${max.size}bytes).`);
