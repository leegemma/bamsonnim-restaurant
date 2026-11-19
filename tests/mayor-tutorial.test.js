import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {nextTutorial,skipTutorial,chooseTutorialStove,tutorialActive,reconcileTutorial,tutorialStove,restartTutorial} from '../src/mayor-tutorial.js';

const begin=()=>{const s=E.newGame();for(let i=0;i<3;i++)assert.equal(nextTutorial(s),true);return s;};
const roundTrip=s=>E.validateSave(JSON.parse(JSON.stringify(s)));

test('new game has three persisted intro panels, older numeric saves do not restart',()=>{
  const s=E.newGame();for(const step of ['intro-city','intro-full','intro-restaurant']){assert.equal(s.guidedTutorial.step,step);assert.deepEqual(roundTrip(s).guidedTutorial,s.guidedTutorial);nextTutorial(s);}
  assert.equal(s.guidedTutorial.step,'stove');assert.equal(nextTutorial(s),false);
  for(const numeric of [0,1,2,3,6]){const legacy=E.newGame();delete legacy.guidedTutorial;legacy.tutorial=numeric;legacy.mastery.rice=10;legacy.stats.sold=5;const loaded=roundTrip(legacy);assert.equal(loaded.guidedTutorial,undefined);assert.equal(loaded.tutorial,numeric);assert.equal(tutorialActive(loaded),false);assert.equal(loaded.mastery.rice,10);assert.equal(loaded.stats.sold,5);}
});

test('only successful rice cooking and real stock/serving advance the guide',()=>{
  let s=begin();const id=tutorialStove(s).uid;chooseTutorialStove(s,id);assert.equal(s.guidedTutorial.step,'recipe');
  assert.ok(E.cook(s,'missing','rice'));assert.ok(E.cook(s,id,'skewer'));assert.equal(s.guidedTutorial.step,'recipe');
  s.events.christmas='active';const other=s.objects.find(o=>o.type==='stove'&&o.uid!==id);assert.equal(E.cook(s,other.uid,'xmas-rice'),null);assert.equal(s.guidedTutorial.step,'recipe');
  const coins=s.coins,hearts=s.hearts;assert.equal(E.cook(s,id,'rice'),null);assert.equal(s.coins,coins);assert.equal(s.hearts,hearts);assert.equal(s.guidedTutorial.step,'cooking');assert.equal(s.objects.find(o=>o.uid===id).cook.readyAt-s.time,12);
  s=roundTrip(s);E.advance(s,11.75);reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'cooking');assert.ok(E.collect(s,id));assert.equal(s.guidedTutorial.step,'cooking');
  E.advance(s,.25);reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'ready');s=roundTrip(s);assert.equal(E.collect(s,id),null);assert.equal(s.guidedTutorial.step,'serving');assert.equal(s.stats.served,0);assert.equal(nextTutorial(s),false);s=roundTrip(s);
  for(let i=0;i<120&&s.stats.served===0;i++)E.advance(s,.5);
  assert.ok(s.stats.served>0);assert.equal(s.guidedTutorial.step,'finish');assert.equal(roundTrip(s).guidedTutorial.step,'finish');assert.equal(nextTutorial(s),true);assert.equal(s.guidedTutorial.step,'done');assert.equal(tutorialActive(s),false);
});

test('reload repairs target safely after discard, spoilage, or replacement',()=>{
  const s=begin(),id=tutorialStove(s).uid;chooseTutorialStove(s,id);E.cook(s,id,'rice');E.advance(s,12);reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'ready');
  assert.equal(E.discard(s,id),null);reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'stove');assert.equal(s.guidedTutorial.stoveId,null);
  E.cook(s,id,'rice');E.advance(s,193);reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'stove');assert.equal(tutorialStove(s).cook,undefined);assert.equal(E.discard(s,id),null);chooseTutorialStove(s,id);assert.equal(s.guidedTutorial.step,'recipe');
  s.objects=s.objects.filter(o=>o.uid!==id);reconcileTutorial(s);assert.ok(tutorialStove(s));assert.equal(s.guidedTutorial.step,'recipe');chooseTutorialStove(s,tutorialStove(s).uid);assert.notEqual(s.guidedTutorial.stoveId,id);
});

test('offline cooking and real offline first serving resume rather than repeat',()=>{
  let s=begin();const id=tutorialStove(s).uid;E.cook(s,id,'rice');E.advance(s,12,{offline:true});s=roundTrip(s);reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'ready');E.collect(s,id);E.advance(s,90,{offline:true});assert.ok(s.stats.served>0);assert.equal(roundTrip(s).guidedTutorial.step,'finish');
});

test('skip is persistent and never changes resources, actors, or running cooking',()=>{
  const s=begin(),id=tutorialStove(s).uid;E.cook(s,id,'rice');const before=structuredClone(s);assert.equal(skipTutorial(s),true);assert.equal(tutorialActive(s),false);assert.equal(roundTrip(s).guidedTutorial.step,'skipped');
  const expected=structuredClone(before);expected.guidedTutorial.step='skipped';assert.deepEqual(s,expected);E.advance(s,12);E.collect(s,id);E.advance(s,90);assert.equal(s.guidedTutorial.step,'skipped');assert.equal(skipTutorial(s),false);assert.equal(E.newGame().guidedTutorial.step,'intro-city');
});

test('import validates the explicit tutorial version and known steps without mutating raw data',()=>{
  for(const bad of [null,{version:2,step:'stove',stoveId:null},{version:1,step:'cheat',stoveId:null},{version:1,step:'recipe',stoveId:99}]){const s=E.newGame();s.guidedTutorial=bad;assert.throws(()=>roundTrip(s),/처음 안내/);}
  const s=E.newGame(),raw=JSON.stringify(s);E.validateSave(s);assert.equal(JSON.stringify(s),raw);
});

test('explicit replay changes only the guide and preserves progressed legacy gameplay',()=>{
  const s=E.newGame();delete s.guidedTutorial;s.tutorial=3;s.stats.served=10;s.mastery.rice=10;E.cook(s,s.objects[0].uid,'rice');const before=structuredClone(s);restartTutorial(s);const expected=structuredClone(before);expected.guidedTutorial={version:1,step:'intro-city',stoveId:null};assert.deepEqual(s,expected);assert.deepEqual(roundTrip(s).guidedTutorial,expected.guidedTutorial);skipTutorial(s);assert.equal(s.tutorial,3);assert.equal(s.stats.served,10);
});

test('imported guide with missing first stock recovers; busy layouts remain skippable',()=>{
  const s=begin(),id=tutorialStove(s).uid;E.cook(s,id,'rice');E.advance(s,12);E.collect(s,id);const server=s.objects.find(o=>o.foodId==='rice'&&o.stock>0);server.stock=0;reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'stove');assert.ok(tutorialStove(s));
  for(const o of s.objects.filter(o=>o.type==='stove'))E.cook(s,o.uid,'rice');restartTutorial(s);for(let i=0;i<3;i++)nextTutorial(s);reconcileTutorial(s);assert.equal(s.guidedTutorial.step,'cooking');const before=JSON.stringify(s.objects);skipTutorial(s);assert.equal(JSON.stringify(s.objects),before);
});
