import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workerFrame} from '../src/worker-art.js';

test('the infected atlas retains each of the eight appearance indexes',()=>{
  for(let appearance=0;appearance<8;appearance++){
    assert.deepEqual(workerFrame(appearance),{key:'workers',index:appearance});
    assert.deepEqual(workerFrame(appearance,{infected:true}),{key:'workersInfected',index:appearance});
  }
});

test('healing restores the original appearance without changing employee state',()=>{
  const worker={uid:'haon',appearance:0,infectedUntil:20,task:{kind:'clean',chair:'seat',work:0}},snapshot=structuredClone(worker);
  assert.equal(workerFrame(worker.appearance,{infected:worker.infectedUntil>19.9}).key,'workersInfected');
  assert.equal(workerFrame(worker.appearance,{infected:worker.infectedUntil>20}).key,'workers');
  assert.deepEqual(worker,snapshot);
});

test('infection tint is consistently green across all skin and garment luminance levels',async()=>{
 const {infectedWorkerColor,workerInfectedSprite}=await import('../src/worker-art.js');
 for(const rgb of [[244,183,134],[220,205,170],[80,45,30],[250,250,250],[30,30,30]]){const [r,g,b]=infectedWorkerColor(...rgb);assert.ok(g>r&&g>b);}
 const base={};assert.equal(workerInfectedSprite(base),base);assert.equal(workerInfectedSprite(base,{infected:true,precolored:true}),base);
});
