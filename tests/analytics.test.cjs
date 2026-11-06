const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../lab-analytics.js'),'utf8');
function run(overrides={},navigator={}){
  const scripts=[],context={Date,navigator,location:{protocol:'https:',hostname:'game.example',origin:'https://game.example',pathname:'/PolyTrack-Lab/',search:'?private=hidden',hash:'#saved-run',...overrides},document:{createElement:()=>({}),head:{append:script=>scripts.push(script)}}};
  context.window=context;vm.createContext(context);vm.runInContext(source,context);return {scripts,commands:Array.from(context.dataLayer||[],args=>Array.from(args))};
}
const published=run();assert.equal(published.scripts.length,1);assert.equal(published.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-QXB7CHLEDT');
const consent=published.commands.find(command=>command[0]==='consent')[2];for(const value of Object.values(consent))assert.equal(value,'denied');
const config=published.commands.find(command=>command[0]==='config');assert.equal(config[1],'G-QXB7CHLEDT');assert.equal(config[2].page_title,'PolyTrack Lab');assert.equal(config[2].page_location,'https://game.example/PolyTrack-Lab/');assert.equal(config[2].page_referrer,'');assert.equal(config[2].allow_google_signals,false);
for(const args of [[{protocol:'http:'}],[{hostname:'localhost'}],[{}, {doNotTrack:'1'}],[{}, {globalPrivacyControl:true}]])assert.equal(run(...args).scripts.length,0);
assert.doesNotMatch(source,/localStorage|sessionStorage|getPersonalBest|getRunHistory|captureRun/);
console.log('PASS: published analytics uses the Lab title, strips URL details, denies storage/ads and reads no game saves; local/private previews skip it.');
