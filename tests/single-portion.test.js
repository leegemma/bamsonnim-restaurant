import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../src/engine.js';
import {RECIPES,ZOMBIES,recipe} from '../src/data.js';

function setup(foodId='spine-gamjatang',stock=700,count=1){
 const s=E.newGame(1000);s.spawnIn=1e9;s.objects=s.objects.filter(o=>['stove','server','table','chair'].includes(o.type));
 const counter=s.objects.find(o=>o.type==='server');Object.assign(counter,{foodId,stock});
 const chairs=s.objects.filter(o=>o.type==='chair');
 s.customers=chairs.slice(0,count).map((chair,i)=>({uid:`meal-${i}`,zombieId:'wanderer',x:chair.x,y:chair.y,phase:'waiting',wait:0,path:[],seat:chair.uid,red:false}));
 return s;
}
const counter=s=>s.objects.find(o=>o.type==='server');
function until(s,condition,offline=false){
 for(let i=0;i<240&&!condition();i++)E.advance(s,.25,{offline});
 assert.ok(condition(),'meal progresses within 60 seconds');
}

test('700 units become 699 then 698 at consecutive pickups',()=>{
 const s=setup(undefined,700,2),stocks=[700];
 for(let i=0;i<240&&stocks.length<3;i++){
  E.advance(s,.25);if(counter(s).stock!==stocks.at(-1))stocks.push(counter(s).stock);
  if(s.waiters[0].task?.kind==='serve')assert.equal(s.waiters[0].task.portion,1);
 }
 assert.deepEqual(stocks,[700,699,698]);
});

test('every recipe reserves, consumes and bills one unit online and offline',()=>{
 for(const offline of [false,true])for(const r of RECIPES){
  const s=setup(r.id),coins=s.coins;
  E.advance(s,.25,{offline});assert.equal(s.waiters[0].task.portion,1,r.id);
  until(s,()=>s.stats.sold===1,offline);
  assert.equal(counter(s).stock,699,r.id);assert.equal(s.customers.find(c=>c.uid==='meal-0').portion,1,r.id);
  const favorite=ZOMBIES.find(z=>z.id==='wanderer').favorite===r.id;
  assert.equal(s.coins-coins,Math.round(r.price*(favorite?1.5:1)),r.id);assert.equal(s.stats.served,1);assert.equal(s.stats.sold,1);
 }
});

test('multiple waiters reserve only the final available units and cannot overdraw stock',()=>{
 for(const stock of [1,2]){
  const s=setup(undefined,stock,4);s.level=30;s.coins=1e6;
  while(s.waiters.length<4)assert.equal(E.hire(s),null);
  E.advance(s,.25);const tasks=s.waiters.map(w=>w.task).filter(t=>t?.kind==='serve');
  assert.equal(tasks.length,stock);assert.ok(tasks.every(t=>t.portion===1));
  for(let i=0;i<240;i++){E.advance(s,.25);assert.ok(counter(s).stock>=0);}
  assert.equal(counter(s).stock,0);assert.equal(s.stats.sold,stock);
 }
});

test('unpicked legacy reservations migrate without mutating saves or reserving recipe chunks',()=>{
 const raw=setup(undefined,2,2);raw.level=30;raw.coins=1e6;assert.equal(E.hire(raw),null);
 E.advance(raw,.25);raw.waiters[0].task.portion=35;
 raw.waiters[1].task=null;raw.waiters[1].path=[];raw.customers[1].worker=null;
 const saved=structuredClone(raw),s=E.validateSave(raw);
 assert.equal(s.waiters[0].task.portion,1);assert.deepEqual(raw,saved);assert.equal(counter(s).stock,2);
 E.advance(s,.25);assert.equal(s.waiters[1].task.portion,1);
 until(s,()=>s.stats.sold===2);assert.equal(counter(s).stock,0);
});

test('legacy pickup is clamped to one even without a save reload',()=>{
 const s=setup();E.advance(s,.25);s.waiters[0].task.portion=35;
 until(s,()=>s.waiters[0].task?.picked);assert.equal(counter(s).stock,699);assert.equal(s.waiters[0].task.portion,1);
});

test('already carried and eating legacy meals preserve quantities and one payment across reloads',()=>{
 for(const phase of ['carried','eating']){
  const raw=setup(undefined,665);E.advance(raw,.25);const w=raw.waiters[0],c=raw.customers[0],chair=raw.objects.find(o=>o.uid===c.seat);
  if(phase==='carried')Object.assign(w,{x:chair.x,y:chair.y+1,path:[],task:{...w.task,phase:'deliver',picked:true,portion:35}});
  else{w.task=null;w.path=[];Object.assign(c,{phase:'eating',foodId:counter(raw).foodId,portion:35,eatUntil:raw.time+.25});}
  const s=E.validateSave(raw),coins=s.coins;
  assert.equal(phase==='carried'?s.waiters[0].task.portion:s.customers[0].portion,35);
  until(s,()=>s.stats.sold===1);assert.equal(counter(s).stock,665);assert.equal(s.coins-coins,35*recipe(counter(s).foodId).price);
  const loaded=E.validateSave(s);E.advance(loaded,20);assert.equal(loaded.stats.sold,1);assert.equal(loaded.coins,s.coins);
 }
});

test('cancelled carried legacy meals refund exactly their consumed quantity',()=>{
 const raw=setup(undefined,665);E.advance(raw,.25);
 Object.assign(raw.waiters[0],{path:[],task:{...raw.waiters[0].task,phase:'deliver',picked:true,portion:35}});
 raw.customers[0].phase='leaving';raw.customers[0].seat=null;
 const s=E.validateSave(raw);until(s,()=>!s.waiters[0].task);assert.equal(counter(s).stock,700);assert.equal(s.stats.sold,0);
 E.advance(s,20);assert.equal(counter(s).stock,700);
});

test('fever consumes one unit while retaining the favorite multiplier and staff tips',()=>{
 const s=setup('gimbap'),c=s.customers[0];c.zombieId=ZOMBIES.find(z=>z.favorite==='gimbap').id;
 s.feverUntil=1000;s.waiters[0].kindnessLevel=5;s.seed=0;
 until(s,()=>s.stats.sold===1);const payment=s.notifications.find(n=>n.type==='payment');
 const coins=Math.round(recipe('gimbap').price*1.5*2);
 assert.equal(counter(s).stock,699);assert.equal(c.portion,1);assert.equal(payment.xp,Math.round(recipe('gimbap').price*1.5));assert.equal(payment.favorite,true);
 assert.equal(payment.tip,Math.ceil(coins*.2));assert.equal(payment.amount,coins+payment.tip);assert.equal(s.stats.sold,1);
});


test('fever consumes every recipe online and offline, including the final unit',()=>{
 for(const offline of [false,true])for(const r of RECIPES){
  const s=setup(r.id,1);s.feverUntil=1000;
  until(s,()=>s.stats.sold===1,offline);
  assert.equal(counter(s).stock,0,`${r.id} offline=${offline}`);
  assert.equal(s.customers.find(c=>c.uid==='meal-0').portion,1);
 }
});

test('concurrent fever pickups cannot reserve more meals than the remaining stock',()=>{
 const s=setup(undefined,2,4);s.feverUntil=1000;s.level=30;s.coins=1e6;
 while(s.waiters.length<4)assert.equal(E.hire(s),null);
 E.advance(s,.25);assert.equal(s.waiters.filter(w=>w.task?.kind==='serve').length,2);
 for(let i=0;i<240;i++){E.advance(s,.25);assert.ok(counter(s).stock>=0);}
 assert.equal(counter(s).stock,0);assert.equal(s.stats.sold,2);
});

test('cancelling an old free carried meal does not refund unconsumed stock',()=>{
 const raw=setup(undefined,700);E.advance(raw,.25);
 Object.assign(raw.waiters[0],{path:[],task:{...raw.waiters[0].task,phase:'deliver',picked:true,portion:35,free:true}});
 raw.customers[0].phase='leaving';raw.customers[0].seat=null;
 const s=E.validateSave(raw);until(s,()=>!s.waiters[0].task);assert.equal(counter(s).stock,700);assert.equal(s.stats.sold,0);
});

test('cancelling a newly consumed fever meal refunds its single unit once',()=>{
 const s=setup();s.feverUntil=1000;until(s,()=>s.waiters[0].task?.picked);
 assert.equal(counter(s).stock,699);assert.equal(s.waiters[0].task.free,undefined);
 s.customers[0].phase='leaving';s.customers[0].seat=null;
 until(s,()=>!s.waiters[0].task);assert.equal(counter(s).stock,700);E.advance(s,20);assert.equal(counter(s).stock,700);
});
