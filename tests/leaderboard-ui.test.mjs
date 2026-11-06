import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const lab = {};
const context = { window: { PolyTrackLab: lab }, document: { getElementById: () => null } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('../lab-leaderboards.js', import.meta.url), 'utf8'), context);
const { countStatus, comparison } = lab.leaderboardReference;
const capture = (count, total = count) => ({available:true,total,entries:Array.from({length:count},(_,index)=>({rank:index+1,timeMs:1000+index*10}))});
test('count badges distinguish full, many, few, empty and unavailable before a tab is opened', () => {
  assert.equal(countStatus(null).kind,'loading');
  assert.equal(countStatus({available:false}).kind,'unavailable');
  for (const [count,kind] of [[100,'full'],[99,'many'],[11,'many'],[10,'few'],[1,'few'],[0,'empty']]) {
    const status=countStatus(capture(count));assert.equal(status.kind,kind);assert.equal(status.label,`${count} saved`);
    assert.match(status.description,new RegExp('^'+count+' saved public'));
  }
});
test('stock personal best comparison locates insertion and tie within the saved results', () => {
  const top=capture(100,50000);
  assert.equal(comparison(top,900,true).position,1);
  assert.equal(comparison(top,1005,true).position,2);
  const tie=comparison(top,1500,true);assert.equal(tie.kind,'tie');assert.equal(tie.position,51);assert.match(tie.text,/not a live overall/);
  assert.equal(comparison(top,1990,true).position,100);
});
test('slower than saved top100 never claims an overall100th or101st position', () => {
  const result=comparison(capture(100,100000),2000,true);
  assert.equal(result.kind,'outside');assert.equal(result.position,undefined);
  assert.match(result.text,/outside the saved top 100/);assert.match(result.text,/overall Kodub position cannot be determined/);
});
test('partial captures and empty boards do not fabricate an overall placement', () => {
  const partial=comparison(capture(3,500),2000,true);assert.equal(partial.kind,'outside');assert.equal(partial.position,undefined);
  const complete=comparison(capture(3,3),2000,true);assert.equal(complete.position,4);assert.match(complete.text,/not an overall Kodub rank/);
  const empty=comparison(capture(0),1200,true);assert.equal(empty.kind,'empty');assert.equal(empty.position,undefined);
  assert.equal(comparison({available:false},1200,true).kind,'unavailable');
});
test('custom physics and missing personal best disable comparison without hiding reference rows', () => {
  const custom=comparison(capture(100),1000,false);assert.equal(custom.kind,'custom');assert.equal(custom.position,undefined);assert.match(custom.text,/not compared/);
  assert.equal(comparison(capture(100),null,true).kind,'none');
  assert.equal(comparison(capture(100),0,true).kind,'none');
});
