const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 8080);
const types = {'.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.cjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.jpg':'image/jpeg', '.woff2':'font/woff2', '.woff':'font/woff', '.glb':'model/gltf-binary', '.mp3':'audio/mpeg', '.ogg':'audio/ogg'};
const createServer = () => http.createServer((req,res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname)); }
  catch { res.writeHead(400); return res.end(); }
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
  if (file === root || file.endsWith(path.sep)) file = path.join(file, 'index.html');
  fs.stat(file, (err,stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    const etag='"'+stat.size.toString(16)+'-'+Math.trunc(stat.mtimeMs).toString(16)+'"';
    const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','ETag':etag,'X-Content-Type-Options':'nosniff'};
    if(req.headers['if-none-match']===etag){res.writeHead(304,headers);return res.end();}
    res.writeHead(200,headers);
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
});
module.exports = {createServer};
if (require.main === module) createServer().listen(port,'127.0.0.1',() => {
  console.log(`PolyTrack Lab: http://localhost:${port}`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    require('node:child_process').spawn('cmd.exe',['/c','start','','http://localhost:'+port],{windowsHide:true,stdio:'ignore'});
  }
}).on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use. Close the earlier server window, then try again.` : error.message);
  process.exitCode=1;
});

/* An unchanged asset returns its cache receipt before another transfer. */
