const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls = [];
class XHR { open(...args) { calls.push(args); } }
const context = {URL, location:{href:'https://lab.example/PolyTrack-Lab/',origin:'https://lab.example'},XMLHttpRequest:XHR,navigator:{sendBeacon:(...args)=>{calls.push(args);return true;}},fetch:async(...args)=>{calls.push(args);return {ok:true};}};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../lab-network.js'),'utf8'),context);
(async()=>{
  await context.fetch('extra-tracks/catalog.json');
  await context.fetch('https://vps.kodub.com/v6/trackOfTheWeek?version=0.6.3');
  await context.fetch('https://vps.kodub.com/v6/trackOfTheWeek/track/'+'a'.repeat(64));
  await context.fetch('https://www.google-analytics.com/g/collect?v=2&tid=G-QXB7CHLEDT',{method:'POST'});
  assert.equal(context.navigator.sendBeacon('https://region1.google-analytics.com/g/collect?v=2&tid=G-QXB7CHLEDT','en=page_view'),true);
  const before=calls.length;
  for(const [url,method] of [
    ['https://vps.kodub.com/v6/leaderboard','GET'],
    ['https://vps.kodub.com/v6/leaderboard','POST'],
    ['https://vps.kodub.com/v6/trackOfTheWeek','POST'],
    ['https://example.firebaseio.com/scores','POST'],
    ['/scores','POST'],
    ['https://www.google-analytics.com/g/collect?tid=G-OTHER','POST'],
    ['https://www.google-analytics.com/other?tid=G-QXB7CHLEDT','POST'],
    ['https://www.google-analytics.com.evil.example/g/collect?tid=G-QXB7CHLEDT','POST']
  ]) {
    await assert.rejects(()=>context.fetch(url,{method}));
    assert.throws(()=>new XHR().open(method,url));
  }
  assert.equal(calls.length,before);
  assert.equal(context.navigator.sendBeacon('/scores','data'),false);
  assert.throws(()=>new context.WebSocket('wss://example.com'));
  assert.throws(()=>new context.EventSource('https://example.com'));
  console.log('PASS: local assets, official weekly GET and the exact Google measurement destination allowed; score uploads, Firebase, unrelated beacons, sockets and streams blocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
