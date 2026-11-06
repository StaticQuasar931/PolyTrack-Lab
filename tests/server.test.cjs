const assert=require('node:assert/strict');
const {createServer}=require('../serve.cjs');
const server=createServer();
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  for(const file of ['extra-tracks/catalog-ui.js','extra-tracks/review.js','extra-tracks/reviewed-data.js','extra-tracks/featured-picks.js','extra-tracks/reviewed.js','extra-tracks/snapshot-popularity.js','tools/search-text.js']){
    const response=await fetch(base+'/'+file);
    assert.equal(response.status,200,file);
    assert.match(response.headers.get('content-type'),/javascript/,file+' must load as a browser module');
  }
  const page=await fetch(base+'/');assert.match(await page.text(),/lab-tracks\.js/);
  const model=await fetch(base+'/polytrack_physics.wasm');const etag=model.headers.get('etag');assert.ok(etag);await model.arrayBuffer();
  const cached=await fetch(base+'/polytrack_physics.wasm',{headers:{'If-None-Match':etag}});assert.equal(cached.status,304);assert.equal((await cached.arrayBuffer()).byteLength,0);
  assert.equal((await fetch(base+'/missing.track')).status,404);
  assert.equal((await fetch(base+'/scores',{method:'POST',body:'test'})).status,405);
  console.log('PASS: native server serves every track-browser module with a valid JavaScript MIME type; missing files and writes handled correctly.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>server.close());
