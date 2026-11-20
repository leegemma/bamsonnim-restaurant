import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {RECIPES,recipe,xpNeeded} from '../src/data.js';
import {ASSET_MANIFEST,foodFrame} from '../src/assets.js';
import {FOOD_ATLASES} from '../src/food-atlases.generated.js';
import * as E from '../src/engine.js';
const unlocked=()=>{const s=E.newGame();s.spawnIn=1e9;for(const r of RECIPES.slice(0,5))s.mastery[r.id]=r.milestones.at(-1);return s;};
test('worm gimmari appends a stable new sprite and its approved early-book balance',()=>{
 assert.equal(RECIPES.length,44);assert.equal(RECIPES.at(-1).id,'worm-gimmari');assert.equal(RECIPES.filter(r=>r.book===0).length,15);
 const r=recipe('worm-gimmari');assert.deepEqual({...r,description:undefined},{id:'worm-gimmari',name:'벌레 김말이',description:undefined,duration:600,servings:60,coins:60,hearts:0,sprite:45,book:0,required:15,price:6,portion:3,milestones:[3,8,10]});assert.match(r.description,/벌레/);
 assert.equal(new Set(RECIPES.map(r=>r.sprite)).size,44);assert.equal(Math.max(...RECIPES.slice(0,-1).map(r=>r.sprite)),44);
});
test('a separate one-frame PNG routes sprite45 without altering the old food or currency routes',async()=>{
 assert.deepEqual(foodFrame(45),{key:'wormGimmariFood',index:0});const asset=ASSET_MANIFEST.wormGimmariFood;assert.deepEqual([asset.width,asset.height,asset.cols,asset.rows,asset.type],[1448,1086,1,1,'food-atlas']);
 const png=await fs.readFile(new URL('../public'+asset.url,import.meta.url));assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),asset.width);assert.equal(png.readUInt32BE(20),asset.height);
 for(let index=0;index<=44;index++){const a=FOOD_ATLASES.find(a=>index>=a.startSprite&&index<a.startSprite+a.count),expected=index===13?{key:'ghostDumplingFood',index:0}:index===18?{key:'spiderDumplingFood',index:0}:a?{key:a.key,index:index-a.startSprite}:{key:'food',index};assert.deepEqual(foodFrame(index),expected);}
});
test('level14 and insufficient-wallet attempts preserve the game; level15 cooks and imports the real batch safely',()=>{
 const s=unlocked(),r=recipe('worm-gimmari'),stove=s.objects.find(o=>o.type==='stove');s.mastery.sausage=r.milestones[1];assert.equal(E.recipeLevel(s),14);let before=structuredClone(s);assert.ok(E.cook(s,stove.uid,r.id));assert.deepEqual(s,before);
 s.mastery.sausage=10;s.coins=59;assert.equal(E.recipeLevel(s),15);before=structuredClone(s);assert.ok(E.cook(s,stove.uid,r.id));assert.deepEqual(s,before);s.coins=60;const hearts=s.hearts;assert.equal(E.cook(s,stove.uid,r.id),null);assert.equal(s.coins,0);assert.equal(s.hearts,hearts);assert.equal(stove.cook.readyAt-stove.cook.started,600);
 const loaded=E.validateSave(s);assert.deepEqual(loaded,s);assert.equal(E.recipeLevel(loaded),15);assert.equal(loaded.mastery[r.id],undefined);E.advance(loaded,599.75);assert.equal(E.stoveStatus(loaded,loaded.objects.find(o=>o.uid===stove.uid)),'cooking');E.advance(loaded,.25);assert.equal(E.collect(loaded,stove.uid),null);assert.equal(loaded.objects.find(o=>o.type==='server').stock,60);assert.equal(loaded.mastery[r.id],1);assert.equal(loaded.knownRecipes[r.id],true);assert.deepEqual(E.validateSave(loaded),loaded);
});
test('actual waiter serving sells one gimmari, credits six coins and six XP once, and preserves old save progress',()=>{
 const s=unlocked(),r=recipe('worm-gimmari'),stove=s.objects.find(o=>o.type==='stove');E.cook(s,stove.uid,r.id);E.advance(s,600);E.collect(s,stove.uid);const server=s.objects.find(o=>o.type==='server'),seat=E.seats(s)[0],c={uid:'gimmari-buyer',zombieId:'scholar',phase:'waiting',x:seat.chair.x,y:seat.chair.y,seat:seat.uid,path:[],wait:0};s.customers=[c];const totalXp=s=>s.xp+Array.from({length:s.level-1},(_,i)=>xpNeeded(i+1)).reduce((a,b)=>a+b,0),coins=s.coins,xp=totalXp(s);
 for(let i=0;i<240&&s.stats.sold===0;i++)E.advance(s,.25);assert.equal(s.stats.served,1);assert.equal(s.stats.sold,1);assert.equal(c.portion,1);assert.equal(server.stock,59);assert.equal(s.coins,coins+6);assert.equal(totalXp(s),xp+6);assert.equal(s.notifications.filter(n=>n.type==='payment').length,1);
 const legacy=unlocked();legacy.coins=31415;legacy.mastery.rice=37;legacy.album.scholar=4;const before=structuredClone(legacy);assert.deepEqual(E.validateSave(legacy),before);assert.equal(E.recipeLevel(legacy),E.recipeLevel(before));assert.equal(legacy.mastery['worm-gimmari'],undefined);
});
