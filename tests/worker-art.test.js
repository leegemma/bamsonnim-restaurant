import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workerFrame} from '../src/worker-art.js';

test('the white-eye pilot applies to exactly one infected appearance',()=>{
  for(let appearance=0;appearance<8;appearance++){
    assert.deepEqual(workerFrame(appearance),{key:'workers',index:appearance});
    assert.deepEqual(workerFrame(appearance,{infected:true}),appearance===0?{key:'infectedHaon',index:0}:{key:'workers',index:appearance});
  }
});

test('healing restores the original appearance without changing employee state',()=>{
  const worker={uid:'haon',appearance:0,infectedUntil:20,task:{kind:'clean',chair:'seat',work:0}},snapshot=structuredClone(worker);
  assert.equal(workerFrame(worker.appearance,{infected:worker.infectedUntil>19.9}).key,'infectedHaon');
  assert.equal(workerFrame(worker.appearance,{infected:worker.infectedUntil>20}).key,'workers');
  assert.deepEqual(worker,snapshot);
});
