import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as E from '../src/engine.js';
import {RECIPES,ZOMBIES,OFFLINE_CAP,recipe,DIRECTIONS} from '../src/data.js';

const stove=s=>s.objects.find(o=>o.type==='stove');
const server=s=>s.objects.find(o=>o.type==='server');
function supply(s,stock=1000,foodId='rice'){Object.assign(server(s),{stock,foodId});}
function batch(s,id='rice'){const o=stove(s),before=s.stats.cooked;assert.equal(E.cook(s,o.uid,id),null);E.advance(s,recipe(id).duration);assert.equal(E.collect(s,o.uid),null);advanceUntil(s,()=>s.stats.cooked===before+1,'collection completes immediately');}
function singleChairGame(dir=0){
 const s=E.newGame(1000),[dx,dy]=DIRECTIONS[dir];s.objects=[stove(s),server(s),{uid:'test-chair',type:'chair',x:3,y:5,dir},{uid:'test-table',type:'table',x:3+dx,y:5+dy,dir:0}];s.spawnIn=1e9;return s;
}
function twoCounterGame(){
 const s=E.newGame(1000);s.spawnIn=1e9;s.coins=10000;s.mastery={rice:10,skewer:10};s.objects.push({uid:'extra-counter',type:'server',x:5,y:1,dir:0});return s;
}
function queueGuest(s,uid='test-guest'){
 const c={uid,zombieId:'wanderer',x:0,y:s.size-1,phase:'queue',wait:0,path:[],seat:null,red:false};s.customers.push(c);return c;
}
function advanceUntil(s,condition,message,seconds=60){
 for(let elapsed=0;elapsed<seconds&&!condition();elapsed+=.25)E.advance(s,.25);
 assert.ok(condition(),message);
}
function assertActorRules(s){
 const claimed=new Set();for(const c of s.customers)if(c.seat){assert.ok(!claimed.has(c.seat),'one chair has only one reservation');claimed.add(c.seat);}
 for(const a of [...s.customers,...s.waiters]){assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));assert.ok(a.x>=-1e-6&&a.y>=-1e-6&&a.x<s.size&&a.y<s.size);}
 for(const c of s.customers.filter(c=>['waiting','eating'].includes(c.phase))){const chair=s.objects.find(o=>o.uid===c.seat);assert.ok(chair);assert.deepEqual([c.x,c.y],[chair.x,chair.y]);}
}
function corridorGame(bay=true){
 const s=E.newGame();s.spawnIn=1e9;s.objects=[];const allowed=new Set(Array.from({length:8},(_,x)=>`${x},3`));if(bay)allowed.add('3,2');
 for(let x=0;x<8;x++)for(let y=0;y<8;y++)if(!allowed.has(`${x},${y}`))s.objects.push({uid:`wall-${x}-${y}`,type:'jars',x,y,dir:0});
 s.objects.push({uid:'left-chair',type:'chair',x:0,y:3,dir:0,dirty:true},{uid:'right-chair',type:'chair',x:7,y:3,dir:2,dirty:true});
 s.waiters=[{uid:'left',name:'왼쪽 직원',appearance:0,x:1,y:3,path:[],task:{kind:'clean',chair:'right-chair',work:0},infectedUntil:0},{uid:'right',name:'오른쪽 직원',appearance:1,x:6,y:3,path:[],task:{kind:'clean',chair:'left-chair',work:0},infectedUntil:0}];return s;
}
function longRunGame(count=4,seed=67291){
 const s=E.newGame(1000);s.seed=seed;s.level=30;s.coins=1e6;s.mastery=Object.fromEntries(RECIPES.map(r=>[r.id,r.milestones.at(-1)]));
 if(count===4)s.objects.push({uid:'counter-soup',type:'server',x:5,y:2,dir:0},{uid:'counter-skewer',type:'server',x:6,y:2,dir:0});
 else{s.size=12;s.objects=[{uid:'run-stove-1',type:'stove',x:1,y:1,dir:0},{uid:'run-stove-2',type:'stove',x:2,y:1,dir:0},...[4,7,10].map((x,i)=>({uid:`run-counter-${i}`,type:'server',x,y:1,dir:0}))];for(let i=0;i<count;i++){const x=2+i%4*3,y=4+Math.floor(i/4)*3,dir=i%4,[dx,dy]=DIRECTIONS[dir];s.objects.push({uid:`run-chair-${i}`,type:'chair',x,y,dir},{uid:`run-table-${i}`,type:'table',x:x+dx,y:y+dy,dir:0});}}
 while(s.waiters.length<8)assert.equal(E.hire(s),null);for(const [i,o]of s.objects.filter(o=>o.type==='server').entries())Object.assign(o,{foodId:['rice','soup','skewer'][i],stock:100000});return s;
}

test('content IDs are unique and every favorite resolves to an available food',()=>{
 assert.equal(RECIPES.filter(r=>!r.event).length,43);assert.equal(ZOMBIES.filter(z=>!z.event).length,35);
 assert.equal(new Set(ZOMBIES.map(z=>z.id)).size,ZOMBIES.length);
 for(const z of ZOMBIES)if(z.favorite)assert.ok(recipe(z.favorite));
});
test('completed cooking waits for collection, instantly reaches the counter, and never automatically recooks',()=>{
 const s=E.newGame(),o=stove(s);assert.equal(E.cook(s,o.uid,'rice'),null);E.advance(s,11.75);assert.equal(E.stoveStatus(s,o),'cooking');E.advance(s,.25);assert.equal(E.stoveStatus(s,o),'done');assert.equal(s.stats.cooked,0);assert.equal(server(s).stock,undefined);
 assert.equal(E.collect(s,o.uid),null);assert.equal(E.stoveStatus(s,o),'empty');assert.deepEqual(s.transfers,[]);E.advance(s,7);assert.equal(s.stats.cooked,1);assert.equal(E.stoveStatus(s,o),'empty');assert.ok(server(s).stock>0);E.advance(s,15);assert.equal(E.stoveStatus(s,o),'empty');
});
test('repeated soup batches merge into existing soup stock even when an empty counter comes first',()=>{
 const s=twoCounterGame(),[empty,soup]=s.objects.filter(o=>o.type==='server'),o=stove(s);Object.assign(soup,{foodId:'soup',stock:7});
 for(let batch=1;batch<=2;batch++){
  assert.equal(E.cook(s,o.uid,'soup'),null);E.advance(s,recipe('soup').duration);assert.equal(E.collect(s,o.uid),null);assert.equal(soup.foodId,'soup');assert.deepEqual(s.transfers,[]);
  advanceUntil(s,()=>s.stats.cooked===batch,'soup is carried to its existing counter');assert.equal(soup.stock,7+batch*recipe('soup').servings);assert.ok(!(empty.stock>0));
 }
 assert.equal(soup.stock,55);assert.equal(s.mastery.soup,2);assert.equal(s.objects.filter(o=>o.type==='server'&&o.foodId==='soup'&&o.stock>0).length,1);
});
test('simultaneous soup collections merge into the existing soup counter ahead of an empty counter',()=>{
 const s=twoCounterGame(),[first,target]=s.objects.filter(o=>o.type==='server'),stoves=s.objects.filter(o=>o.type==='stove');Object.assign(first,{foodId:'rice',stock:1});
 for(const o of stoves)assert.equal(E.cook(s,o.uid,'soup'),null);E.advance(s,recipe('soup').duration);
 assert.equal(E.collect(s,stoves[0].uid),null);assert.equal(target.foodId,'soup');assert.equal(target.stock,24);first.stock=0;
 assert.equal(E.collect(s,stoves[1].uid),null);assert.deepEqual(s.transfers,[]);assert.equal(target.stock,48);
 advanceUntil(s,()=>s.stats.cooked===2,'both soup batches reach the shared counter');assert.equal(target.stock,48);assert.equal(target.reservedFood,undefined);assert.equal(first.stock,0);
});
test('two immediate soup collections total both batches and a sold-out counter accepts another dish',()=>{
 const s=twoCounterGame(),counter=server(s),stoves=s.objects.filter(o=>o.type==='stove');s.objects=s.objects.filter(o=>o.uid!=='extra-counter');
 for(const o of stoves)assert.equal(E.cook(s,o.uid,'soup'),null);E.advance(s,recipe('soup').duration);for(const o of stoves)assert.equal(E.collect(s,o.uid),null);
 assert.equal(s.stats.cooked,2);assert.equal(counter.stock,48);assert.equal(counter.reservedFood,undefined);assert.deepEqual(s.transfers,[]);
 counter.stock=0;assert.equal(E.cook(s,stoves[0].uid,'rice'),null);assert.equal(E.instant(s,stoves[0].uid),null);assert.equal(E.collect(s,stoves[0].uid),null);assert.equal(counter.foodId,'rice');assert.equal(counter.stock,6);assert.equal(s.stats.cooked,3);
});

test('different dishes reserve separate counters, preserve DONE when full and reuse sold-out counters',()=>{
 const s=twoCounterGame(),[rice,soup]=s.objects.filter(o=>o.type==='server'),stoves=s.objects.filter(o=>o.type==='stove');
 assert.equal(E.cook(s,stoves[0].uid,'rice'),null);assert.equal(E.cook(s,stoves[1].uid,'soup'),null);E.advance(s,recipe('soup').duration);
 assert.equal(E.collect(s,stoves[0].uid),null);assert.equal(E.collect(s,stoves[1].uid),null);assert.deepEqual(s.transfers,[]);assert.equal(rice.foodId,'rice');assert.equal(soup.foodId,'soup');
 advanceUntil(s,()=>s.stats.cooked===2,'different dishes reach separate counters');assert.equal(rice.foodId,'rice');assert.equal(rice.stock,6);assert.equal(soup.foodId,'soup');assert.equal(soup.stock,24);
 assert.equal(E.cook(s,stoves[0].uid,'skewer'),null);E.advance(s,recipe('skewer').duration);assert.equal(E.collect(s,stoves[0].uid),'서빙대가 모두 차 있어요. 빈 서빙대를 마련해주세요.');assert.equal(E.stoveStatus(s,stoves[0]),'done');assert.equal(s.transfers.length,0);
 rice.stock=0;assert.equal(rice.reservedFood,undefined);assert.equal(E.collect(s,stoves[0].uid),null);assert.equal(rice.foodId,'skewer');assert.equal(rice.stock,10);assert.deepEqual(s.transfers,[]);
 advanceUntil(s,()=>s.stats.cooked===3,'sold-out counter is reused for another dish');assert.equal(rice.foodId,'skewer');assert.equal(rice.stock,10);assert.equal(soup.foodId,'soup');assert.equal(soup.stock,24);
});
test('cooking spends only once and rejects locked or unaffordable recipes',()=>{
 const s=E.newGame(),o=stove(s);assert.ok(E.cook(s,o.uid,'skewer'));assert.equal(s.coins,500);s.mastery.rice=10;s.coins=0;assert.ok(E.cook(s,o.uid,'skewer'));s.coins=3;assert.equal(E.cook(s,o.uid,'skewer'),null);assert.equal(s.coins,1);assert.ok(E.cook(s,o.uid,'skewer'));assert.equal(s.coins,1);
});
test('stove food spoils at boundary; serving inventory does not spoil',()=>{
 const s=E.newGame(),o=stove(s);E.cook(s,o.uid,'rice');E.advance(s,191.75);assert.equal(E.stoveStatus(s,o),'done');E.advance(s,.25);assert.equal(E.stoveStatus(s,o),'spoiled');assert.ok(E.collect(s,o.uid));assert.equal(E.recover(s,o.uid),null);assert.equal(s.hearts,9);assert.equal(E.stoveStatus(s,o),'done');supply(s,17);s.time+=200000;assert.equal(server(s).stock,17);
});
test('recipe level is sum of individual mastery and unlocks next food after ten collections',()=>{
 const s=E.newGame();for(let i=0;i<10;i++)batch(s);assert.equal(E.stars(s,'rice'),3);assert.equal(E.recipeLevel(s),3);assert.ok(E.canCook(s,recipe('skewer')));assert.equal(s.stats.cooked,10);assert.ok(s.knownRecipes.rice);
});
test('workers sell finite inventory, clean seats, and register only completed online transactions',()=>{
 const s=E.newGame();supply(s,12);E.advance(s,230);assert.equal(s.stats.sold,12);assert.equal(s.stats.earned,12);assert.equal(s.album.wanderer,12);assert.equal(server(s).stock,0);assert.ok(s.stats.served===12);assert.ok(s.objects.some(o=>o.type==='chair'&&!o.dirty));
});
test('eight workers keep separate positions during real service and every initial chair is used',()=>{
 const s=E.newGame();s.level=30;s.coins=1e6;while(s.waiters.length<8)assert.equal(E.hire(s),null);supply(s,1000);assertActorRules(s);const used=new Set();
 for(let i=0;i<480;i++){E.advance(s,.25);assertActorRules(s);for(const c of s.customers)if(['waiting','eating'].includes(c.phase))used.add(c.seat);}
 assert.ok(s.stats.served>0&&s.stats.sold>0);assert.deepEqual([...used].sort(),E.seats(s).map(seat=>seat.uid).sort());
 for(const seat of E.seats(s).filter(seat=>seat.chair.y===5&&seat.chair.dir===3))assert.ok(used.has(seat.uid),'lower backward-facing chair is occupied');
});
test('walking guests pass through one another and keep their overlapping positions on v1 reload',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair');s.zombieEntrance=E.staffEntrance(s);Object.assign(chair,{x:6,y:7});Object.assign(s.objects.find(o=>o.uid==='test-table'),{x:7,y:7});
 const entering={uid:'crossing-in',zombieId:'wanderer',x:0,y:7,phase:'seating',wait:0,path:[],seat:chair.uid},leaving={uid:'crossing-out',zombieId:'wanderer',x:5.6,y:7,phase:'leaving',wait:0,path:[[5,7],[4,7],[3,7],[2,7],[1,7],[0,7]],seat:null};s.customers=[entering,leaving];let shared=false;
 for(let i=0;i<20;i++){
  const before=[{x:entering.x,y:entering.y},{x:leaving.x,y:leaving.y}],wasWalking=entering.phase==='seating';E.advance(s,.25);assertActorRules(s);
  if(wasWalking&&entering.phase==='seating')assert.ok(Math.hypot(entering.x-before[0].x,entering.y-before[0].y)>.39,'incoming guest does not stop for the outgoing guest');
  assert.ok(Math.hypot(entering.x-before[0].x,entering.y-before[0].y)<=.4+1e-6);assert.ok(Math.hypot(leaving.x-before[1].x,leaving.y-before[1].y)<=.4+1e-6);
  if(s.customers.includes(leaving)&&Math.hypot(entering.x-leaving.x,entering.y-leaving.y)<1e-6){shared=true;const loaded=E.validateSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded.customers.map(c=>[c.uid,c.x,c.y]),s.customers.map(c=>[c.uid,c.x,c.y]));}
 }
 assert.ok(shared,'mobile guest pair intentionally shares a position while passing');assert.equal(entering.phase,'waiting');assert.equal(s.customers.includes(leaving),false);
});
test('a guest takes its exclusive chair while another actor is passing',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),sitting={uid:'taking-seat',zombieId:'wanderer',x:chair.x,y:chair.y,phase:'seating',wait:0,path:[],seat:chair.uid},passing={uid:'passing-seat',zombieId:'wanderer',x:chair.x,y:chair.y,phase:'leaving',wait:0,path:[],seat:null};s.customers=[sitting,passing];
 E.advance(s,.25);assert.equal(sitting.phase,'waiting');assert.ok(Math.hypot(passing.x-chair.x,passing.y-chair.y)<=.4+1e-6);assert.equal(E.path(s,passing,[chair.x,chair.y],{allowBlockedTarget:false}),null);assertActorRules(s);
});
test('an incoming guest takes a free chair after yielding to staff while another guest is still leaving',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[{uid:'ready-chair',type:'chair',x:7,y:6,dir:3},{uid:'ready-table',type:'table',x:7,y:5,dir:0},...[2,4,5].map(x=>({uid:`crossing-chair-${x}`,type:'chair',x,y:7,dir:0})),{uid:'left-table',type:'table',x:2,y:6,dir:0},...[0,1].map(x=>({uid:`left-counter-${x}`,type:'server',x,y:6,dir:0})),...[4,5].map(x=>({uid:`upper-jars-${x}`,type:'jars',x,y:6,dir:0}))];
 Object.assign(s.waiters[0],{x:3,y:7,path:[],task:null});const outgoing={uid:'other-departure',zombieId:'wanderer',x:3,y:6,phase:'leaving',wait:0,path:[],seat:null},incoming={uid:'ready-to-sit',zombieId:'wanderer',x:6,y:7,phase:'seating',wait:0,path:[],seat:'ready-chair'};s.customers=[outgoing,incoming];
 for(let i=0;i<12&&incoming.phase!=='waiting';i++){E.advance(s,.25);assertActorRules(s);}
 assert.equal(incoming.phase,'waiting','unrelated walking departures do not hold a reachable reserved chair');assert.ok(s.customers.includes(outgoing));assert.deepEqual([incoming.x,incoming.y],[7,6]);
});
test('all actors pass through staff while empty and occupied chairs remain furniture obstacles',()=>{
 const s=singleChairGame(),w=s.waiters[0],chair=s.objects.find(o=>o.type==='chair');s.zombieEntrance=E.staffEntrance(s);Object.assign(w,{x:2,y:7});const c={uid:'crossing-worker-guest',zombieId:'wanderer',x:4,y:7,phase:'leaving',wait:0,path:[],seat:null};s.customers=[c];let shared=false;
 for(let i=0;i<20&&s.customers.includes(c);i++){const before={x:c.x,y:c.y};E.advance(s,.25);assertActorRules(s);if(s.customers.includes(c))assert.ok(Math.hypot(c.x-before.x,c.y-before.y)>.39);if(Math.hypot(c.x-w.x,c.y-w.y)<1e-6)shared=true;}
 assert.equal(s.customers.includes(c),false);assert.ok(shared);
 const fixed={uid:'fixed-seat-guest',zombieId:'wanderer',x:chair.x,y:chair.y,phase:'waiting',wait:0,path:[],seat:chair.uid},other={uid:'other-mobile-guest',zombieId:'wanderer',x:5,y:5,phase:'leaving',wait:0,path:[],seat:null};s.customers=[fixed,other];
 assert.equal(E.path(s,other,[chair.x,chair.y],{allowBlockedTarget:false}),null);assert.equal(E.path(s,other,[stove(s).x,stove(s).y],{allowBlockedTarget:false}),null);for(let i=0;i<20;i++){E.advance(s,.25);assertActorRules(s);}assert.deepEqual([fixed.x,fixed.y],[chair.x,chair.y]);
});
for(const count of [4,8,12])test(`${count} chairs sustain one hour of service with bounded admissions and finite departures`,t=>{
 const s=longRunGame(count,count===4?42:67291),leftAt=new Map(),arrivals=new Set(),sat=new Set(),used=new Set(),soldAt=[];let maxCustomers=0,maxLeavingAge=0,exited=0,previous=new Set();
 for(let i=0;i<14400;i++){
  E.advance(s,.25);assertActorRules(s);const current=new Set(s.customers.map(c=>c.uid));for(const id of previous)if(!current.has(id))exited++;previous=current;maxCustomers=Math.max(maxCustomers,s.customers.length);
  for(const c of s.customers){arrivals.add(c.uid);if(c.phase==='leaving'){if(!leftAt.has(c.uid))leftAt.set(c.uid,s.time);maxLeavingAge=Math.max(maxLeavingAge,s.time-leftAt.get(c.uid));}if(['waiting','eating'].includes(c.phase)){sat.add(c.uid);used.add(c.seat);}}
  assert.ok(s.customers.length<=count+1,`${count} chairs admitted ${s.customers.length} guests including departures at ${s.time}`);assert.ok(maxLeavingAge<120,`departure stalled ${maxLeavingAge}s`);if((i+1)%2400===0)soldAt.push(s.stats.sold);
 }
 assert.ok(soldAt.every((sold,i)=>i===0?sold>0:sold>soldAt[i-1]),'sales continue through every ten-minute interval');assert.equal(used.size,count);assert.ok(sat.size/arrivals.size>.75,'most admitted guests actually sit');assert.ok(exited>0);
 t.diagnostic(JSON.stringify({chairs:count,time:s.time,sold:s.stats.sold,maxCustomers,maxLeavingAge,arrivals:arrivals.size,seated:sat.size,exited,soldAt}));
});
test('a chair-blocked legacy layout preserves trapped guests and furniture while reachable guests leave',async t=>{
 const raw=JSON.parse(await readFile(new URL('./fixtures/traffic/12-seats-clutter-final.json',import.meta.url),'utf8')),s=E.validateSave(raw),start=s.time,layout=JSON.stringify(s.objects.map(o=>[o.uid,o.type,o.x,o.y,o.dir]));s.zombieEntrance=E.staffEntrance(s);
 const canExit=c=>{if(E.path(s,c,[0,s.size-1],{allowBlockedTarget:false})!==null)return true;const chair=c.phase==='seating'&&s.objects.find(o=>o.uid===c.seat);return !!chair&&E.path(s,c,[chair.x,chair.y])!==null&&E.path(s,chair,[0,s.size-1],{allowBlockedTarget:false})!==null;},reachable=new Set(s.customers.filter(canExit).map(c=>c.uid)),trapped=new Set(s.customers.filter(c=>!reachable.has(c.uid)&&c.phase!=='queue').map(c=>c.uid));assert.ok(reachable.size&&trapped.size);
 for(let i=0;i<2400;i++){E.advance(s,.25);assertActorRules(s);}
 assert.ok(!s.customers.some(c=>reachable.has(c.uid)),'all originally reachable guests leave');assert.ok([...trapped].every(id=>s.customers.some(c=>c.uid===id)),'trapped legacy guests are not discarded');assert.equal(JSON.stringify(s.objects.map(o=>[o.uid,o.type,o.x,o.y,o.dir])),layout);assert.equal(E.trafficStatus(s).exitBlocked,true);assert.ok(s.stats.sold>=raw.stats.sold);
 t.diagnostic(JSON.stringify({fixture:'12-seats-clutter-final',seconds:s.time-start,reachableOriginals:reachable.size,preservedBlockedOriginals:trapped.size,exitBlocked:true}));
});
test('a v1 save containing thirty departures drains through the door and resumes selling',t=>{
 const s=longRunGame(4);s.zombieEntrance=E.staffEntrance(s);s.time=300;s.spawnIn=0;const legacyIds=new Set();
 for(let y=s.size-1;y>=0&&s.customers.length<30;y--)for(let x=0;x<s.size&&s.customers.length<30;x++){
  if(s.waiters.some(w=>Math.hypot(w.x-x,w.y-y)<1e-6)||E.path(s,{x:0,y:s.size-1},[x,y],{allowBlockedTarget:false})===null)continue;
  const c={uid:`legacy-departure-${s.customers.length}`,zombieId:'wanderer',x,y,phase:'leaving',wait:0,path:[],seat:null,red:false,leavingAt:0};c.path=E.path(s,c,[0,s.size-1])||[];s.customers.push(c);legacyIds.add(c.uid);
 }
 assert.equal(legacyIds.size,30);const raw=JSON.parse(JSON.stringify(s)),loaded=E.validateSave(raw);assertActorRules(loaded);assert.equal(loaded.customers.length,30);let clearedAt=null;
 for(let i=0;i<1200;i++){
  const before=new Map(loaded.customers.map(c=>[c.uid,{x:c.x,y:c.y}]));E.advance(loaded,.25);assertActorRules(loaded);
  for(const [uid,p]of before)if(legacyIds.has(uid)){const c=loaded.customers.find(c=>c.uid===uid);if(c)assert.ok(Math.hypot(c.x-p.x,c.y-p.y)<=.4+1e-6,'saved guest exits by walking');else assert.ok(Math.hypot(p.x,p.y-(loaded.size-1))<=.4+1e-6,'guest is removed only at the doorway');}
  if(clearedAt===null&&!loaded.customers.some(c=>legacyIds.has(c.uid)))clearedAt=loaded.time;
 }
 assert.ok(clearedAt!==null,'all saved departures leave');assert.ok(loaded.customers.length<=E.trafficStatus(loaded).capacity);assert.ok(loaded.stats.sold>0,'admissions and sales resume');assert.equal(raw.customers.length,30);t.diagnostic(JSON.stringify({legacyDepartures:30,clearedIn:clearedAt-300,resumedSales:loaded.stats.sold,customers:loaded.customers.length}));
});
test('a physically blocked exit reports congestion without discarding or teleporting the guest',()=>{
 const s=corridorGame(false);s.time=20;s.waiters=[{...s.waiters[0],task:null,path:[]}];const c={uid:'blocked-departure',zombieId:'wanderer',x:3,y:3,path:[],seat:null,phase:'leaving',wait:0,leavingAt:0};s.customers=[c];
 assert.equal(E.trafficStatus(s).congested,true);assert.equal(E.trafficStatus(s).exitBlocked,true);E.advance(s,5);assert.ok(s.customers.includes(c));assert.deepEqual([c.x,c.y],[3,3]);assert.equal(E.trafficStatus(s).exitBlocked,true);
});
test('a seated chair has the same terrain route as an empty chair and workers do not alter it',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),c={uid:'terrain-departure',zombieId:'wanderer',x:5,y:7,path:[],seat:null,phase:'leaving',wait:0};s.customers=[c];const route=E.path(s,c,[0,7],{allowBlockedTarget:false});assert.ok(route);
 s.customers.push({uid:'fixed-terrain-guest',zombieId:'wanderer',x:chair.x,y:chair.y,path:[],seat:chair.uid,phase:'waiting',wait:0});Object.assign(s.waiters[0],{x:route[0][0],y:route[0][1]});assert.deepEqual(E.path(s,c,[0,7],{allowBlockedTarget:false}),route);
 for(let i=0;i<40&&s.customers.includes(c);i++){E.advance(s,.25);assertActorRules(s);}assert.equal(s.customers.includes(c),false);
});
test('shared doorway actors pass while paid guests leave and table service continues',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[{uid:'pocket-server',type:'server',x:0,y:3,dir:0,foodId:'rice',stock:99},{uid:'waiting-chair',type:'chair',x:1,y:6,dir:0},{uid:'pocket-table-1',type:'table',x:2,y:4,dir:0},{uid:'pocket-table-2',type:'table',x:2,y:6,dir:0},...[3,4,5].flatMap((x,i)=>[{uid:`incoming-chair-${i}`,type:'chair',x,y:5,dir:3},{uid:`incoming-table-${i}`,type:'table',x,y:4,dir:0}])];
 const w=s.waiters[0];Object.assign(w,{x:0,y:4,path:[[0,5],[0,6]],task:{kind:'serve',customer:'waiting-guest',server:'pocket-server',foodId:'rice',portion:1,phase:'deliver',picked:true,work:0}});
 const outgoing=[[1,7],[1,5],[1,4],[1,3]].map(([x,y],i)=>({uid:`old-exit-${i}`,zombieId:'wanderer',x,y,phase:'leaving',wait:0,path:[],seat:null,leavingAt:0}));
 s.customers=[...outgoing,...[5,6,7].map((y,i)=>({uid:`incoming-${i}`,zombieId:'wanderer',x:0,y,phase:'seating',wait:0,path:[],seat:`incoming-chair-${i}`})),{uid:'waiting-guest',zombieId:'wanderer',x:1,y:6,phase:'waiting',wait:0,path:[],seat:'waiting-chair',worker:w.uid}];
 for(let i=0;i<480;i++){const before=new Map([...s.customers,...s.waiters].map(a=>[a.uid,{x:a.x,y:a.y}]));E.advance(s,.25);assertActorRules(s);for(const a of [...s.customers,...s.waiters]){const p=before.get(a.uid);if(p)assert.ok(Math.hypot(a.x-p.x,a.y-p.y)<=.65+1e-6,'escape chain uses ordinary movement');}}
 assert.ok(outgoing.every(c=>!s.customers.includes(c)));assert.ok(s.stats.sold>0,'seated and incoming guests resume eating and paying');
});
test('workers on an exit route do not require passing through an empty chair',()=>{
 const s=E.newGame();s.spawnIn=1e9;s.objects=[{uid:'empty-chair',type:'chair',x:1,y:6,dir:0},{uid:'occupied-chair',type:'chair',x:0,y:6,dir:3},{uid:'side-table',type:'table',x:2,y:6,dir:0},{uid:'occupied-table',type:'table',x:0,y:5,dir:0}];
 Object.assign(s.waiters[0],{x:1,y:7,path:[],task:null});s.waiters.push({...s.waiters[0],uid:'boundary-worker',name:'통로 직원',appearance:1,x:1,y:5,path:[]});
 const c={uid:'exit-through-pocket',zombieId:'wanderer',x:2,y:7,phase:'leaving',wait:0,path:[],seat:null,leavingAt:0};s.customers=[c,{uid:'fixed-guest',zombieId:'wanderer',x:0,y:6,phase:'waiting',wait:0,path:[],seat:'occupied-chair'}];
 for(let i=0;i<80&&s.customers.includes(c);i++){const before=s.waiters.map(w=>({x:w.x,y:w.y}));E.advance(s,.25);assertActorRules(s);s.waiters.forEach((w,n)=>assert.ok(Math.hypot(w.x-before[n].x,w.y-before[n].y)<=.65+1e-6));}
 assert.equal(s.customers.includes(c),false,'the worker beyond the empty chair opens a real escape square');
});
test('a stranded carried meal grants finite patience and is returned before the guest leaves',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),w=s.waiters[0],c=queueGuest(s);supply(s,0);
 for(const [i,[x,y]]of [[2,5],[4,5],[3,4],[3,6]].entries())if(!s.objects.some(o=>o.x===x&&o.y===y))s.objects.push({uid:`delivery-block-${i}`,type:'jars',x,y,dir:0});
 Object.assign(c,{x:chair.x,y:chair.y,phase:'waiting',seat:chair.uid,wait:59.75,worker:w.uid});w.task={kind:'serve',customer:c.uid,server:server(s).uid,foodId:'rice',portion:1,phase:'deliver',picked:true,work:0};w.path=[];
 E.advance(s,.25);assert.equal(c.phase,'leaving');assert.equal(c.seat,null);assert.equal(w.task,null);assert.equal(server(s).stock,1);assert.equal(s.stats.sold,0);assert.equal(s.notifications.some(n=>n.type==='payment'),false);
});
test('a carried last portion reserves its source counter until delivery or a safe refund',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),w=s.waiters[0],c=queueGuest(s),o=stove(s),counter=server(s);s.mastery.rice=10;supply(s,1);
 Object.assign(c,{x:chair.x,y:chair.y,phase:'waiting',seat:chair.uid});advanceUntil(s,()=>w.task?.kind==='serve'&&w.task.picked,'last rice portion is picked up');assert.equal(counter.stock,0);
 const legacy=JSON.parse(JSON.stringify(s));delete legacy.objects.find(o=>o.uid===counter.uid).reservedFood;assert.equal(E.validateSave(legacy).objects.find(o=>o.uid===counter.uid).reservedFood,'rice');
 assert.equal(E.cook(s,o.uid,'skewer'),null);assert.equal(E.instant(s,o.uid),null);assert.equal(E.collect(s,o.uid),'서빙대가 모두 차 있어요. 빈 서빙대를 마련해주세요.');assert.equal(E.stoveStatus(s,o),'done');
 assert.ok(E.removeFurniture(s,counter.uid));assert.ok(E.removeFurniture(s,counter.uid,true));assert.ok(E.place(s,{type:counter.type,x:6,y:2,dir:0,existing:counter.uid}));assert.ok(s.objects.includes(counter));
 for(const [i,[x,y]]of [[2,5],[4,5],[3,4],[3,6]].entries())if(!s.objects.some(o=>o.x===x&&o.y===y))s.objects.push({uid:`refund-obstacle-${i}`,type:'jars',x,y,dir:0});c.wait=59.75;E.advance(s,.25);
 assert.equal(c.phase,'leaving');assert.equal(counter.foodId,'rice');assert.equal(counter.stock,1);assert.equal(counter.reservedFood,undefined);assert.equal(E.stoveStatus(s,o),'done');assert.equal(s.stats.cooked,0);
});
test('a delivered last portion releases its empty counter for a different dish',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),w=s.waiters[0],c=queueGuest(s),o=stove(s),counter=server(s);s.mastery.rice=10;supply(s,1);Object.assign(c,{x:chair.x,y:chair.y,phase:'waiting',seat:chair.uid});
 advanceUntil(s,()=>w.task?.picked,'rice is carried');assert.equal(counter.reservedFood,'rice');assert.equal(E.cook(s,o.uid,'skewer'),null);assert.equal(E.instant(s,o.uid),null);assert.ok(E.collect(s,o.uid));
 advanceUntil(s,()=>c.phase==='eating','rice reaches the guest');assert.equal(c.foodId,'rice');assert.equal(counter.stock,0);assert.equal(counter.reservedFood,undefined);assert.equal(E.collect(s,o.uid),null);
 advanceUntil(s,()=>s.stats.cooked===1,'new dish reaches the released counter');assert.equal(counter.foodId,'skewer');assert.equal(counter.stock,10);
});
test('cancelling a serve task between tiles walks to its segment end before taking another job',()=>{
 const s=singleChairGame(),w=s.waiters[0],chair=s.objects.find(o=>o.type==='chair'),c=queueGuest(s);supply(s,20);Object.assign(c,{x:chair.x,y:chair.y,phase:'waiting',seat:chair.uid,wait:44.75,worker:w.uid});
 Object.assign(w,{x:1,y:5.3,path:[[1,6],[1,7]],task:{kind:'serve',customer:c.uid,server:server(s).uid,foodId:'rice',portion:1,phase:'pickup',work:0}});
 const start={x:w.x,y:w.y};E.advance(s,.25);assert.equal(c.phase,'leaving');assert.equal(w.task,null);assert.ok(Math.hypot(w.x-start.x,w.y-start.y)>0,'cancelled worker keeps walking');assert.ok(Math.hypot(w.x-start.x,w.y-start.y)<=.65+1e-6);assert.equal(server(s).stock,20);
 for(let i=0;i<20&&Math.abs(w.y-Math.round(w.y))>1e-6;i++){const before={x:w.x,y:w.y};E.advance(s,.25);assert.ok(Math.hypot(w.x-before.x,w.y-before.y)<=.65+1e-6);assertActorRules(s);}
 assert.equal(w.y,6);assert.equal(w.task,null);assert.deepEqual(w.path,[]);
});
test('v1 and in-memory idle workers stranded between tiles resume movement without teleporting',()=>{
 for(const reload of [false,true]){
  const s=singleChairGame(),w=s.waiters[0];Object.assign(w,{x:1,y:5.3,path:[],task:null});const raw=JSON.parse(JSON.stringify(s)),loaded=reload?E.validateSave(raw):s,worker=loaded.waiters[0],coins=loaded.coins;
  assert.equal(worker.x,1);assert.equal(worker.y,5.3);assert.equal(worker.task,null);
  for(let i=0;i<20&&Math.abs(worker.y-Math.round(worker.y))>1e-6;i++){const before={x:worker.x,y:worker.y};E.advance(loaded,.25);assert.ok(Math.hypot(worker.x-before.x,worker.y-before.y)<=.65+1e-6);assertActorRules(loaded);}
  assert.ok(Number.isInteger(worker.x)&&Number.isInteger(worker.y),'legacy idle reaches a tile centre');assert.equal(loaded.coins,coins);assert.deepEqual(raw.waiters[0].path,[]);assert.equal(raw.waiters[0].y,5.3);
 }
});
test('a chase ending between tiles finishes its segment before turning toward the exit',()=>{
 const s=E.newGame();s.spawnIn=1e9;Object.assign(s.waiters[0],{x:7,y:7});const c={uid:'fractional-red',zombieId:'red',red:true,x:5.3,y:5,path:[[6,5]],phase:'chasing',seat:null,wait:0,chaseTime:15,target:s.waiters[0].uid};s.customers=[c];
 E.advance(s,.25);assert.equal(c.phase,'leaving');
 for(let i=0;i<60&&s.customers.includes(c);i++){const before={x:c.x,y:c.y};E.advance(s,.25);const dx=Math.abs(c.x-Math.round(c.x)),dy=Math.abs(c.y-Math.round(c.y));assert.ok(!(dx>1e-6&&dy>1e-6),'route turns only at grid centres');assert.ok(Math.hypot(c.x-before.x,c.y-before.y)>.000001,'unblocked guest keeps walking');assert.ok(Math.hypot(c.x-before.x,c.y-before.y)<=.4+1e-6);assertActorRules(s);}
 assert.equal(s.customers.includes(c),false);
});
test('infection and furniture edits cancel mid-segment jobs without stranding workers',()=>{
 const infected=singleChairGame(),w=infected.waiters[0],chair=infected.objects.find(o=>o.type==='chair'),c=queueGuest(infected);supply(infected,20);Object.assign(c,{x:chair.x,y:chair.y,phase:'waiting',seat:chair.uid,worker:w.uid});Object.assign(w,{x:1,y:5.3,path:[[1,6],[1,7]],task:{kind:'serve',customer:c.uid,server:server(infected).uid,foodId:'rice',portion:1,phase:'pickup',work:0}});
 infected.customers.push({uid:'mid-step-biter',zombieId:'red',red:true,x:1,y:4.5,path:[],seat:null,phase:'chasing',wait:0,chaseTime:0,target:w.uid});E.advance(infected,.25);assert.ok(w.infectedUntil>infected.time);assert.ok(w.y>5.3);assert.ok(w.y-5.3<=1.5*.25+1e-6);assertActorRules(infected);
 const edited=singleChairGame(),worker=edited.waiters[0],o=stove(edited);edited.level=30;edited.coins=10000;assert.equal(E.cook(edited,o.uid,'rice'),null);E.advance(edited,12);assert.equal(E.collect(edited,o.uid),null);E.advance(edited,.25);assert.notEqual(worker.task?.kind,'transfer');const dirtyChair=edited.objects.find(o=>o.type==='chair');dirtyChair.dirty=true;Object.assign(worker,{x:1,y:5.3,path:[[1,6],[1,7]],task:{kind:'clean',chair:dirtyChair.uid,work:0}});
 assert.equal(E.place(edited,{type:'jars',x:1,y:6}),null);assert.equal(worker.y,5.3);assert.equal(worker.task,null);E.advance(edited,.25);assert.equal(worker.y,5);assert.ok(worker.y!==6,'newly blocked forward endpoint is not used');assert.equal(edited.stats.cooked,1);
 advanceUntil(edited,()=>edited.stats.cooked===1,'collected food is preserved while the cancelled worker centres');assert.equal(server(edited).foodId,'rice');assert.equal(server(edited).stock,6);
});
test('a fractional active worker centres before retrying an unreachable job',()=>{
 const s=singleChairGame(),w=s.waiters[0],chair=s.objects.find(o=>o.type==='chair');for(const [i,[x,y]]of [[2,5],[4,5],[3,4],[3,6]].entries())if(!s.objects.some(o=>o.x===x&&o.y===y))s.objects.push({uid:`centre-wall-${i}`,type:'jars',x,y,dir:0});
 chair.dirty=true;chair.cleaner=w.uid;
 Object.assign(w,{x:1,y:5.3,path:[],task:{kind:'clean',chair:chair.uid,work:0}});const loaded=E.validateSave(JSON.parse(JSON.stringify(s))),worker=loaded.waiters[0];assert.equal(worker.y,5.3);E.advance(loaded,.25);assert.equal(worker.y,5);assert.equal(worker.task.kind,'clean');assertActorRules(loaded);
});
test('workers pass in a one-tile corridor without using a passing bay',()=>{
 const s=corridorGame();let sawBay=false;
 for(let i=0;i<160&&s.objects.some(o=>o.type==='chair'&&o.dirty);i++){
  const before=s.waiters.map(w=>({x:w.x,y:w.y}));E.advance(s,.25);assertActorRules(s);
  s.waiters.forEach((w,n)=>{assert.ok(Math.hypot(w.x-before[n].x,w.y-before[n].y)<=2.6*.25+1e-6,'traffic yields by walking');if(w.y<3)sawBay=true;});
 }
 assert.equal(s.objects.some(o=>o.type==='chair'&&o.dirty),false);assert.equal(sawBay,false);
});
test('workers cross and finish cleaning even when a corridor has no passing space',()=>{
 const s=corridorGame(false);for(let i=0;i<80&&s.objects.some(o=>o.type==='chair'&&o.dirty);i++){E.advance(s,.25);assertActorRules(s);}assert.equal(s.objects.some(o=>o.type==='chair'&&o.dirty),false);
});
test('an occupied chair blocks old walking routes and service waits for a free adjacent square',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),w=s.waiters[0];Object.assign(chair,{x:3,y:3,dir:2});Object.assign(s.objects.find(o=>o.uid==='test-table'),{x:2,y:3});Object.assign(w,{x:6,y:3});
 for(const [i,[x,y]] of [[2,3],[3,2],[3,4]].entries())if(!s.objects.some(o=>o.x===x&&o.y===y))s.objects.push({uid:`service-wall-${i}`,type:'jars',x,y,dir:0});
 const neighbor={uid:'neighbor-chair',type:'chair',x:4,y:3,dir:0};s.objects.push(neighbor,{uid:'neighbor-table',type:'table',x:5,y:3,dir:0});supply(s,10);
 const c=queueGuest(s,'main'),other=queueGuest(s,'neighbor');Object.assign(c,{x:3,y:3,phase:'waiting',seat:chair.uid});Object.assign(other,{x:4,y:3,phase:'waiting',seat:neighbor.uid});
 assert.equal(E.path(s,w,[chair.x,chair.y],{allowBlockedTarget:false}),null);assert.equal(E.path(s,w,[neighbor.x,neighbor.y],{allowBlockedTarget:false}),null);
 E.advance(s,3);assert.equal(s.stats.served,0);assertActorRules(s);
 s.objects=s.objects.filter(o=>o.uid!=='service-wall-1');
 for(let i=0;i<120&&c.phase!=='eating';i++){E.advance(s,.25);assertActorRules(s);}
 assert.equal(c.phase,'eating');assert.equal(Math.abs(w.x-chair.x)+Math.abs(w.y-chair.y),1);
});
test('v1 load preserves overlapping actors and stock while workers walk off a legacy chair',()=>{
 const s=singleChairGame();s.level=30;s.coins=10000;assert.equal(E.hire(s),null);supply(s,20);const chair=s.objects.find(o=>o.type==='chair'),c=queueGuest(s);
 Object.assign(c,{phase:'waiting',seat:chair.uid,x:chair.x,y:chair.y});for(const w of s.waiters)Object.assign(w,{x:chair.x,y:chair.y,path:[]});
 c.worker=s.waiters[0].uid;s.waiters[0].task={kind:'serve',customer:c.uid,server:server(s).uid,foodId:'rice',portion:1,phase:'pickup',work:0};
 const raw=JSON.parse(JSON.stringify(s)),loaded=E.validateSave(raw);assertActorRules(loaded);assert.ok(loaded.waiters.every(w=>w.x===chair.x&&w.y===chair.y));assert.equal(loaded.customers[0].seat,chair.uid);assert.equal(loaded.customers[0].x,chair.x);assert.equal(loaded.customers[0].y,chair.y);assert.equal(server(loaded).stock,20);assert.equal(loaded.coins,raw.coins);assert.equal(loaded.waiters[0].task.customer,c.uid);assert.equal(raw.waiters[0].x,chair.x);assert.equal(raw.waiters[0].y,chair.y);
 advanceUntil(loaded,()=>loaded.stats.served>0,'recovered staff continues serving');assertActorRules(loaded);
});
test('ordinary guests buy from both counters instead of starving the second dish',()=>{
 const s=E.newGame();supply(s,200);s.objects.push({uid:'other-counter',type:'server',x:6,y:1,dir:0,foodId:'skewer',stock:200});const eaten=new Set();
 for(let i=0;i<480;i++){E.advance(s,.25);assertActorRules(s);for(const c of s.customers)if(c.phase==='eating')eaten.add(c.foodId);}
 assert.deepEqual([...eaten].sort(),['rice','skewer']);assert.ok(server(s).stock<200);assert.ok(s.objects.find(o=>o.uid==='other-counter').stock<200);assert.ok(s.stats.sold>0);
});
test('favorite dishes keep priority and blocked counters fall back to a reachable counter',()=>{
 const favorite=singleChairGame(),favoriteChair=favorite.objects.find(o=>o.type==='chair');supply(favorite,20);favorite.objects.push({uid:'favorite-counter',type:'server',x:6,y:1,dir:0,foodId:'skewer',stock:20});
 const fan=queueGuest(favorite);Object.assign(fan,{zombieId:ZOMBIES.find(z=>z.favorite==='skewer').id,phase:'waiting',seat:favoriteChair.uid,x:favoriteChair.x,y:favoriteChair.y});E.advance(favorite,.25);assert.equal(favorite.waiters[0].task.server,'favorite-counter');
 const blocked=singleChairGame(),chair=blocked.objects.find(o=>o.type==='chair');supply(blocked,20);blocked.objects.push({uid:'reachable-counter',type:'server',x:6,y:1,dir:0,foodId:'skewer',stock:20});
 for(const [i,[x,y]] of [[3,1],[5,1],[4,0],[4,2]].entries())blocked.objects.push({uid:`counter-wall-${i}`,type:'jars',x,y,dir:0});
 const c=queueGuest(blocked);Object.assign(c,{phase:'waiting',seat:chair.uid,x:chair.x,y:chair.y});E.advance(blocked,.25);assert.equal(blocked.waiters[0].task.server,'reachable-counter');advanceUntil(blocked,()=>blocked.stats.sold>0,'reachable dish is sold');assert.equal(server(blocked).stock,20);
});
test('eight simultaneous assignments reserve finite inventory before pickup',()=>{
 const s=E.newGame();s.level=30;s.coins=1e6;while(s.waiters.length<8)assert.equal(E.hire(s),null);s.spawnIn=1e9;
 s.objects=[{uid:'small-counter',type:'server',x:0,y:0,dir:0,foodId:'rice',stock:1},{uid:'large-counter',type:'server',x:7,y:0,dir:0,foodId:'skewer',stock:20},{uid:'reserve-table-0',type:'table',x:2,y:4,dir:0},{uid:'reserve-table-1',type:'table',x:5,y:4,dir:0}];s.customers=[];
 const positions=[[1,4,0],[2,3,1],[3,4,2],[2,5,3],[4,4,0],[5,3,1],[6,4,2],[5,5,3]];
 for(let i=0;i<8;i++){const [x,y,dir]=positions[i],chair={uid:`reserve-chair-${i}`,type:'chair',x,y,dir};s.objects.push(chair);Object.assign(s.waiters[i],{x:i,y:2,path:[],task:null});const c=queueGuest(s,`reserve-guest-${i}`);Object.assign(c,{x:chair.x,y:chair.y,seat:chair.uid,phase:'waiting'});}
 E.advance(s,.25);const tasks=s.waiters.map(w=>w.task).filter(t=>t?.kind==='serve');assert.equal(tasks.length,8);assert.equal(tasks.filter(t=>t.server==='small-counter').length,1);assert.equal(tasks.filter(t=>t.server==='large-counter').length,7);assert.ok(tasks.filter(t=>t.server==='small-counter').reduce((n,t)=>n+t.portion,0)<=1);assertActorRules(s);
});
test('v1 saves default both rotation cursors and reject invalid cursor values',()=>{
 const s=E.newGame();delete s.serveCursor;delete s.seatCursor;const loaded=E.validateSave(s);assert.equal(loaded.serveCursor,0);assert.equal(loaded.seatCursor,0);
 for(const key of ['serveCursor','seatCursor'])for(const value of [-1,1.5,'0',257]){const bad=structuredClone(loaded);bad[key]=value;assert.throws(()=>E.validateSave(bad),/순서/);}
});
test('an online payment emits one coin event and does not repeat after advancing or reloading',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),c=queueGuest(s);
 Object.assign(c,{x:chair.x,y:chair.y,phase:'eating',seat:chair.uid,foodId:'rice',portion:3,eatUntil:.25});s.feverUntil=10;
 E.advance(s,.25);const payments=s.notifications.filter(n=>n.type==='payment');assert.equal(payments.length,1);assert.match(payments[0].message,/6코인/);assert.equal(payments[0].time,s.time);assert.deepEqual({amount:payments[0].amount,xp:payments[0].xp,x:payments[0].x,y:payments[0].y,favorite:payments[0].favorite},{amount:6,xp:3,x:chair.x,y:chair.y,favorite:false});assert.equal(s.stats.sold,1);assert.equal(c.phase,'leaving');
 const saved=JSON.parse(JSON.stringify(s));E.advance(s,20);assert.deepEqual(s.notifications.filter(n=>n.type==='payment'),payments);assert.equal(s.stats.sold,1);
 const loaded=E.validateSave(saved);E.advance(loaded,20);assert.deepEqual(loaded.notifications.filter(n=>n.type==='payment'),payments);assert.equal(loaded.stats.sold,1);
});
test('payment metadata records the actual favorite and fever rewards while old events remain readable',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),c=queueGuest(s);Object.assign(c,{zombieId:ZOMBIES.find(z=>z.favorite==='rice').id,x:chair.x,y:chair.y,phase:'eating',seat:chair.uid,foodId:'rice',portion:3,eatUntil:.25});s.feverUntil=10;E.advance(s,.25);
 const event=s.notifications.find(n=>n.type==='payment');assert.equal(event.amount,9);assert.equal(event.xp,5);assert.equal(event.favorite,true);assert.equal(event.x,chair.x);assert.equal(event.y,chair.y);
 const legacy=structuredClone(s);for(const n of legacy.notifications)if(n.type==='payment')for(const key of ['amount','xp','x','y','favorite'])delete n[key];assert.doesNotThrow(()=>E.validateSave(legacy));
 const bad=structuredClone(s);bad.notifications.find(n=>n.type==='payment').amount=Infinity;assert.throws(()=>E.validateSave(bad),/결제/);
});
test('payment events retain the existing 35-notification cap during repeated transactions',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),paymentIds=new Set();
 for(let i=0;i<40;i++){
  const c=queueGuest(s,`paying-${i}`);Object.assign(c,{x:chair.x,y:chair.y,phase:'eating',seat:chair.uid,foodId:'rice',portion:1,eatUntil:s.time+.25});
  E.advance(s,.25);const last=s.notifications.at(-1);assert.equal(last.type,'payment');assert.match(last.message,/1코인/);paymentIds.add(last.id);assert.ok(s.notifications.length<=35);
 }
 assert.equal(paymentIds.size,40);assert.equal(s.stats.sold,40);assert.equal(s.notifications.length,35);
});
test('all four inward-facing chair rotations complete cooking, serving, payment and cleanup at their table',()=>{
 for(let dir=0;dir<4;dir++){
  const s=singleChairGame(dir),chair=s.objects.find(o=>o.type==='chair'),o=stove(s);
  assert.equal(s.objects.some(o=>o.type==='table'),true);assert.equal(E.seats(s).length,1);assert.equal(E.seats(s)[0].table.uid,'test-table');
  assert.equal(E.cook(s,o.uid,'rice'),null);E.advance(s,recipe('rice').duration);assert.equal(E.collect(s,o.uid),null);
  advanceUntil(s,()=>s.stats.cooked===1,`rotation ${dir}: completed food reaches the server`);
  assert.equal(server(s).stock,recipe('rice').servings);assert.equal(s.mastery.rice,1);assert.equal(E.stoveStatus(s,o),'empty');
  const c=queueGuest(s);E.advance(s,.25);assert.equal(c.seat,chair.uid);assert.equal(c.phase,'seating');
  advanceUntil(s,()=>c.phase==='eating',`rotation ${dir}: guest receives food at the chair`);
  assert.equal(c.foodId,'rice');assert.equal(c.seat,chair.uid);assert.equal(chair.dir,dir);assert.equal(s.stats.served,1);assert.equal(s.album.wanderer,undefined);
  assert.deepEqual(E.validateSave(JSON.parse(JSON.stringify(s))),s);
  const coins=s.coins;advanceUntil(s,()=>s.stats.sold===1,`rotation ${dir}: seated guest finishes and pays`);
  assert.equal(s.coins-coins,recipe('rice').price*recipe('rice').portion);assert.equal(s.album.wanderer,1);assert.equal(chair.dirty,true);assert.equal(c.seat,null);
  advanceUntil(s,()=>!chair.dirty,`rotation ${dir}: staff cleans the table-side chair`);
  assert.equal(chair.cleaner,null);assert.equal(s.waiters[0].task,null);
 }
});
test('storing a table leaves its two chairs as inactive decoration',()=>{
 const s=E.newGame(),count=E.seats(s).length,chair=s.objects.find(o=>o.type==='chair'),table=E.seats(s).find(seat=>seat.uid===chair.uid).table;
 assert.ok(table);assert.equal(E.removeFurniture(s,table.uid),null);assert.equal(E.seats(s).length,count-2);assert.equal(E.seats(s).some(seat=>seat.uid===chair.uid),false);assert.ok(s.objects.includes(chair));
});
test('blocked table-side chairs are unavailable and placement preserves the last access path',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair');
 for(const [i,[x,y]] of [[2,5],[3,4]].entries())s.objects.push({uid:`block-${i}`,type:'jars',x,y,dir:0});
 assert.equal(E.seats(s).length,1);assert.ok(E.path(s,{x:0,y:7},[chair.x,chair.y]));
 const coins=s.coins;assert.match(E.place(s,{type:'jars',x:3,y:6}),/빈 바닥/);assert.equal(s.coins,coins);
 // A valid table does not make an enclosed legacy chair reachable.
 s.objects.push({uid:'old-block',type:'jars',x:3,y:6,dir:0});
 const loaded=E.validateSave(JSON.parse(JSON.stringify(s)));assert.equal(E.seats(loaded).length,0);assert.equal(E.path(loaded,{x:0,y:7},[3,5],{allowBlockedTarget:false}),null);
 supply(loaded,10);const c=queueGuest(loaded);E.advance(loaded,.25);assert.equal(c.phase,'queue');assert.equal(c.seat,null);
 E.advance(loaded,21);assert.equal(loaded.stats.served,0);assert.equal(loaded.stats.sold,0);assert.equal(server(loaded).stock,10);
});
test('extra tables remain blocking furniture while paired chairs retain their access',()=>{
 const s=singleChairGame();
 for(const [i,[x,y]] of [[5,3],[7,3],[6,2],[6,4]].entries())s.objects.push({uid:`decor-${i}`,type:'jars',x,y,dir:0});
 assert.equal(E.place(s,{type:'table',x:6,y:3}),null);assert.equal(E.seats(s).length,1);
 assert.equal(E.path(s,{x:0,y:7},[6,3]),null);
});
test('one chair has one reservation through seating, eating and cleanup before the next guest',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair');supply(s,10);
 const first=queueGuest(s,'first'),second=queueGuest(s,'second');E.advance(s,.25);
 assert.equal(first.seat,chair.uid);assert.equal(second.seat,null);assert.equal(second.phase,'queue');
 advanceUntil(s,()=>first.phase==='eating','first guest starts eating');assert.equal(second.seat,null);
 advanceUntil(s,()=>s.stats.sold===1,'first guest pays');assert.equal(chair.dirty,true);assert.equal(second.seat,null);
 advanceUntil(s,()=>second.seat===chair.uid,'next guest waits until the chair is clean');assert.equal(chair.dirty,false);
 const reservations=s.customers.filter(c=>c.seat===chair.uid);assert.equal(reservations.length,1);assert.equal(reservations[0].uid,'second');
});
test('v1 saves reject duplicate or missing chair reservations without changing the source',()=>{
 const s=singleChairGame(),chair=s.objects.find(o=>o.type==='chair'),c=queueGuest(s);
 Object.assign(c,{phase:'waiting',seat:chair.uid,x:chair.x,y:chair.y});assert.deepEqual(E.validateSave(s),s);
 const duplicate=structuredClone(s);duplicate.customers.push({...duplicate.customers[0],uid:'duplicate'});assert.throws(()=>E.validateSave(duplicate),/좌석/);assert.equal(s.customers.length,1);
 const missing=structuredClone(s);missing.customers[0].seat='missing-chair';assert.throws(()=>E.validateSave(missing),/좌석/);
});
test('v1 table-directed delivery and cleaning tasks continue at the saved chair',()=>{
 for(const kind of ['serve','clean']){
  const s=E.newGame(1000),chair=s.objects.find(o=>o.type==='chair'),w=s.waiters[0];s.spawnIn=1e9;supply(s,5);
  Object.assign(w,{x:3,y:3,path:[[3,4]]});
  if(kind==='serve'){
   const c=queueGuest(s);Object.assign(c,{x:chair.x,y:chair.y,phase:'waiting',seat:chair.uid,worker:w.uid});
   w.task={kind,customer:c.uid,server:server(s).uid,phase:'deliver',work:0,foodId:'rice',portion:1,picked:true};
  }else{chair.dirty=true;chair.cleaner=w.uid;w.task={kind,chair:chair.uid,work:0};}
  const loaded=E.validateSave(JSON.parse(JSON.stringify(s))),loadedChair=loaded.objects.find(o=>o.uid===chair.uid),worker=loaded.waiters[0];
  advanceUntil(loaded,()=>kind==='serve'?loaded.stats.served===1:!loadedChair.dirty,`saved ${kind} task completes`);
  assert.equal(Math.abs(worker.x-chair.x)+Math.abs(worker.y-chair.y),1);
  if(kind==='serve')assert.equal(loaded.customers[0].phase,'eating');else assert.equal(loadedChair.cleaner,null);
 }
});
test('offline table-side transactions award earnings and XP but never register new guests or fever',()=>{
 const s=E.newGame();supply(s,100);E.advance(s,600,{offline:true});assert.ok(s.stats.sold>0);assert.ok(s.coins>500);assert.ok(s.level>1);assert.deepEqual(s.album,{});assert.equal(s.combo,0);assert.equal(s.stats.fevers,0);assert.equal(s.notifications.some(n=>n.type==='payment'),false);
});
test('offline operational cap does not cap cooking, spoilage, or five-minute recovery clocks',()=>{
 const s=E.newGame(1000),o=stove(s);s.mastery=Object.fromEntries(RECIPES.map(r=>[r.id,r.milestones.at(-1)]));E.cook(s,o.uid,'kimchi');s.waiters[0].infectedUntil=300;const report=E.reconcileOffline(s,1000+13*3600*1000);assert.equal(report.simulated,OFFLINE_CAP);assert.equal(s.time,13*3600);assert.equal(E.stoveStatus(s,o),'done');assert.equal(report.infected,0);assert.equal(E.reconcileOffline(s,s.savedAt),null);
});
test('event ending blocks new cooks but preserves previously started food and owned decor',()=>{
 const s=E.newGame(),o=stove(s);E.setEvent(s,'active');assert.equal(E.cook(s,o.uid,'xmas-rice'),null);s.coins=1000;assert.equal(E.place(s,{type:'tree',x:7,y:1}),null);const tree=s.objects.find(o=>o.type==='tree');assert.equal(E.removeFurniture(s,tree.uid),null);E.setEvent(s,'ended');E.advance(s,120);assert.equal(E.stoveStatus(s,o),'done');assert.equal(E.collect(s,o.uid),null);E.advance(s,20);assert.equal(E.stoveStatus(s,o),'empty');assert.ok(E.cook(s,o.uid,'xmas-rice'));assert.equal(E.place(s,{type:'tree',x:7,y:1,fromStorage:true}),null);assert.equal(E.place(s,{type:'tree',x:7,y:2}),'이벤트 기간에만 구매할 수 있어요.');assert.ok(s.eventBooks.christmas);
});
test('registered event guests can return after expiry, missed guests do not appear',()=>{
 const registered=E.newGame(),missed=E.newGame();for(const s of [registered,missed]){s.mastery['xmas-rice']=10;E.setEvent(s,'ended');supply(s,2000);}registered.album['santa-scholar']=1;E.advance(registered,1000);E.advance(missed,1000);assert.ok(registered.stats.fed['santa-scholar']>0);assert.equal(missed.stats.fed['santa-scholar'],undefined);assert.equal(missed.album['santa-scholar'],undefined);
});
test('hiring uses quadratic cost, level caps, and cannot fire the final worker',()=>{
 const s=E.newGame();assert.equal(E.fire(s,s.waiters[0].uid),'직원은 최소 1명 필요해요.');assert.equal(E.hire(s),null);assert.equal(s.coins,100);assert.equal(s.waiters.length,2);s.coins=10000;assert.ok(E.hire(s));assert.equal(E.fire(s,s.waiters[1].uid),null);assert.equal(s.waiters.length,1);
});
test('eight staff keep distinct appearances when coworkers leave and replacements join',()=>{
 const s=E.newGame();s.level=30;s.coins=1e6;assert.equal(s.waiters[0].appearance,0);
 while(s.waiters.length<8)assert.equal(E.hire(s),null);assert.deepEqual(s.waiters.map(w=>w.appearance),[0,1,2,3,4,5,6,7]);
 const first=s.waiters[1],second=s.waiters[4];assert.equal(E.fire(s,first.uid),null);assert.equal(E.fire(s,second.uid),null);
 const remaining=s.waiters.map(w=>({uid:w.uid,appearance:w.appearance}));
 assert.equal(E.hire(s),null);assert.equal(s.waiters.at(-1).appearance,1);assert.equal(E.hire(s),null);assert.equal(s.waiters.at(-1).appearance,4);
 for(const saved of remaining)assert.equal(s.waiters.find(w=>w.uid===saved.uid).appearance,saved.appearance);
 const coins=s.coins;assert.ok(E.hire(s));assert.equal(s.coins,coins);assert.equal(new Set(s.waiters.map(w=>w.appearance)).size,8);
 assert.deepEqual(E.validateSave(JSON.parse(JSON.stringify(s))),s);
});
test('v1 saves fill missing staff appearances in order while preserving saved numbers and the source',()=>{
 const s=E.newGame();s.level=30;s.coins=1e6;while(s.waiters.length<8)assert.equal(E.hire(s),null);
 const legacy=structuredClone(s);for(const w of legacy.waiters)delete w.appearance;
 const loaded=E.validateSave(legacy);assert.deepEqual(loaded.waiters.map(w=>w.appearance),[0,1,2,3,4,5,6,7]);assert.ok(legacy.waiters.every(w=>!Object.hasOwn(w,'appearance')));assert.equal(loaded.version,legacy.version);
 const mixed=structuredClone(legacy);mixed.waiters[0].appearance=7;mixed.waiters[2].appearance=0;
 const upgraded=E.validateSave(mixed);assert.deepEqual(upgraded.waiters.map(w=>w.appearance),[7,1,0,2,3,4,5,6]);assert.ok(!Object.hasOwn(mixed.waiters[1],'appearance'));
});
test('staff imports reject duplicate, fractional, out-of-range and nonnumeric appearance numbers',()=>{
 const s=E.newGame();assert.equal(E.hire(s),null);
 const duplicate=structuredClone(s);duplicate.waiters[1].appearance=0;assert.throws(()=>E.validateSave(duplicate),/외모/);
 for(const appearance of [-1,8,1.5,'1',null,NaN,Infinity]){const bad=structuredClone(s);bad.waiters[0].appearance=appearance;assert.throws(()=>E.validateSave(bad),/외모/);}
 assert.deepEqual(s.waiters.map(w=>w.appearance),[0,1]);
});
test('recovery is exactly five minutes and curing charges only infected staff',()=>{
 const s=E.newGame(),w=s.waiters[0];w.infectedUntil=300;E.advance(s,299.75);assert.ok(w.infectedUntil>s.time);E.advance(s,.25);assert.ok(w.infectedUntil<=s.time);assert.ok(E.cure(s,w.uid));w.infectedUntil=s.time+300;const before=s.coins;assert.equal(E.cure(s,w.uid),null);assert.equal(s.coins,before-E.cureCost(s));assert.equal(w.infectedUntil,0);
});
test('a hungry red zombie chases a worker before biting; workers are never deleted',()=>{
 const s=E.newGame();s.hunger=85;s.stats.served=1;s.customers.push({uid:'red-test',zombieId:'red',red:true,x:2,y:5,path:[],phase:'waiting',seat:s.objects.find(o=>o.type==='chair').uid,wait:24.75});
 E.advance(s,.25);assert.equal(s.customers.find(c=>c.uid==='red-test').phase,'chasing');assert.equal(s.waiters[0].infectedUntil,0);E.advance(s,10);assert.ok(s.waiters[0].infectedUntil>s.time);assert.equal(s.waiters.length,1);
});
test('placement rejects overlaps, entrance obstruction and off-wall posters without charging',()=>{
 const s=E.newGame(),coins=s.coins;assert.ok(E.place(s,{type:'chair',x:1,y:1}));assert.ok(E.place(s,{type:'table',x:0,y:7}));assert.ok(E.place(s,{type:'poster',x:3,y:3}));assert.equal(s.coins,coins);assert.equal(E.place(s,{type:'chair',x:3,y:5,dir:3}),null);assert.equal(s.coins,coins-50);
});
test('full serving tables prevent collection and storage does not discard live stock',()=>{
 const s=E.newGame(),o=stove(s);supply(s,100,'skewer');E.cook(s,o.uid,'rice');E.advance(s,12);assert.ok(E.collect(s,o.uid));assert.equal(E.stoveStatus(s,o),'done');assert.ok(E.removeFurniture(s,server(s).uid));assert.ok(E.removeFurniture(s,o.uid));
});
test('quest claims pay once and advance requirements without double counting prior actions',()=>{
 const s=E.newGame();s.stats.cooked=2;assert.equal(E.claimQuest(s),null);assert.equal(s.coins,600);assert.equal(s.questIndex,1);assert.ok(E.claimQuest(s));s.stats.served=2;assert.equal(E.claimQuest(s),null);assert.equal(s.questIndex,2);assert.equal(E.questProgress(s).progress,0);
});
test('malformed import is rejected without mutating current state; valid active saves round trip',()=>{
 const s=E.newGame();batch(s);const loaded=E.validateSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);const bad=structuredClone(s);bad.objects[0].type='does-not-exist';assert.throws(()=>E.validateSave(bad));assert.equal(s.objects[0].type,'stove');const negative=structuredClone(s);negative.coins=-5;assert.throws(()=>E.validateSave(negative));const brokenPath=structuredClone(s);brokenPath.waiters[0].path=[null];assert.throws(()=>E.validateSave(brokenPath));
});
