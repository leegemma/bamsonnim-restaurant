import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {WAITER_NAMES} from '../src/data.js';

test('new staff use the requested names and avoid names already hired',()=>{
 const s=E.newGame();s.level=100;s.coins=1e6;
 assert.equal(s.waiters[0].name,'하온');
 for(let i=0;i<3;i++)assert.equal(E.hire(s),null);
 assert.deepEqual(s.waiters.map(w=>w.name),['하온','하영','은재','리아']);
 assert.deepEqual(WAITER_NAMES.slice(0,4),s.waiters.map(w=>w.name));
});

test('old saves rename the four defaults without changing staff appearance, task, money or source data',()=>{
 const raw=E.newGame(),oldNames=['달래','보리','초롱','두리','직접 정한 이름','toString','__proto__'];
 raw.waiters=oldNames.map((name,i)=>({...raw.waiters[0],uid:`staff-${i}`,name,appearance:i}));
 const original=structuredClone(raw),loaded=E.validateSave(raw);
 assert.deepEqual(raw,original);
 assert.deepEqual(loaded.waiters.map(w=>w.name),['하온','하영','은재','리아','직접 정한 이름','toString','__proto__']);
 const expected=structuredClone(original);expected.waiters.forEach((w,i)=>w.name=loaded.waiters[i].name);
 assert.deepEqual(loaded,expected);
 assert.deepEqual(E.validateSave(loaded),loaded);
});
