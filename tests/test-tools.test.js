import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {RECIPES,recipe} from '../src/data.js';
import {restoreBibimbapMastery} from '../src/test-tools.js';

test('the bibimbap preset restores exactly the first nine mastered recipes and survives saving',()=>{
  const s=E.newGame();s.level=33;s.coins=12345;s.hearts=87;
  for(const r of RECIPES){s.mastery[r.id]=r.milestones.at(-1)+5;s.knownRecipes[r.id]=true;}
  const {mastery,knownRecipes,...before}=structuredClone(s);
  restoreBibimbapMastery(s);
  assert.equal(E.recipeLevel(s),27);
  assert.equal(Object.keys(s.mastery).length,9);
  for(const r of RECIPES){
    const complete=!r.event&&r.required<=recipe('bibimbap').required;
    assert.equal(E.stars(s,r.id),complete?3:0,r.id);
    assert.equal(s.knownRecipes[r.id],complete?true:undefined,r.id);
  }
  const {mastery:afterMastery,knownRecipes:afterKnown,...after}=s;
  assert.deepEqual(after,before);
  assert.equal(E.canCook(s,recipe('liver')),true);
  assert.equal(E.canCook(s,recipe('pancake')),false);
  const saved=E.validateSave(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(saved.mastery,s.mastery);
  const once=JSON.stringify(s);restoreBibimbapMastery(s);assert.equal(JSON.stringify(s),once);
});
