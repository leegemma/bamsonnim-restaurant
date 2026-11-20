import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {RECIPES,BOOKS} from '../src/data.js';
import * as E from '../src/engine.js';
const moved=['pancake','noodle','cookie','human-suyuk','yukgaejang','hell-dakbokkeum','human-kimchi-jjim','human-leg-kalguksu','eyeball-squid-sundae'];
test('the midnight feast contains exactly nine requested dishes while the first retains fifteen',()=>{
 assert.deepEqual(new Set(RECIPES.filter(r=>r.book===2).map(r=>r.id)),new Set(moved));assert.equal(BOOKS[2].name,'밤 깊은 잔칫상');assert.deepEqual(BOOKS.map((_,i)=>RECIPES.filter(r=>r.book===i).length),[15,2,9,1,3,1,3,4,0,2,4]);assert.equal(RECIPES.length,44);assert.equal(RECIPES.at(-1).id,'worm-gimmari');assert.equal(RECIPES.at(-1).book,0);
});
test('chapter movement preserves non-book fields except the two approved recipe balance overrides',()=>{
 const digest=createHash('sha256').update(JSON.stringify(RECIPES.map(({book,...r})=>r.id==='liver'?{...r,duration:21600,servings:300,coins:0,hearts:6,price:2}:r.id==='kimchi'?{...r,duration:43200,servings:950,coins:50,hearts:0,price:1}:r))).digest('hex');assert.equal(digest,'289c1e21fbea55e06240528ddeaf7a58085cd26eea240a6521046e2e0ce12dee');
});
test('chapter changes leave imported cooking times, mastery, stock, customer food and money intact',()=>{
 const s=E.newGame(1000);s.time=200;s.coins=31415;s.mastery.pancake=4;s.knownRecipes.pancake=true;s.album.scholar=3;const stove=s.objects.find(o=>o.type==='stove'),server=s.objects.find(o=>o.type==='server'),seat=E.seats(s)[0];stove.cook={foodId:'pancake',started:100,readyAt:28900,spoilAt:86500};Object.assign(server,{foodId:'human-kimchi-jjim',stock:37});s.customers=[{uid:'chapter-old-guest',zombieId:'scholar',phase:'eating',x:seat.chair.x,y:seat.chair.y,seat:seat.uid,wait:0,path:[],foodId:'noodle',portion:1,eatUntil:205}];const before=structuredClone(s);assert.deepEqual(E.validateSave(s),before);assert.deepEqual(s,before);
});
