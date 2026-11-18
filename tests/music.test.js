import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TRACK_BARS,STEPS_PER_BAR,STEP_SECONDS,scoreBar} from '../src/music-score.js';
test('normal score lasts over two minutes with seven distinct musical sections',()=>{
 assert.equal(TRACK_BARS*STEPS_PER_BAR*STEP_SECONDS.normal,135);
 const bars=Array.from({length:TRACK_BARS},(_,i)=>scoreBar(i));
 assert.equal(new Set(bars.map(b=>b.section)).size,7);
 assert.ok(new Set(bars.map(b=>b.melody.join(','))).size>=30);
 assert.ok(bars.some(b=>b.instrument==='reed'));
 assert.notDeepEqual(bars.slice(4,12).map(b=>b.melody),bars.slice(12,20).map(b=>b.melody));
});
test('normal, warning and fever arrangements have valid pitches and seamless score wrap',()=>{
 for(const mode of Object.keys(STEP_SECONDS)){
   for(let i=0;i<TRACK_BARS;i++){const bar=scoreBar(i,mode);assert.equal(bar.melody.length,6);assert.ok(bar.melody.every(n=>n===0||Number.isInteger(n)&&n>=36&&n<=108));assert.ok(bar.chord.notes.every(Number.isFinite));}
   assert.deepEqual(scoreBar(TRACK_BARS,mode),scoreBar(0,mode));
 }
});
