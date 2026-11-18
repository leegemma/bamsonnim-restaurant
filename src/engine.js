import {SAVE_VERSION,OFFLINE_CAP,RECIPES,ZOMBIES,FURNITURE,SKINS,WAITER_NAMES,WAITER_NAME_UPDATES,LIMITS,EXPANSIONS,QUESTS,DIRECTIONS,recipe,zombie,furniture,xpNeeded} from './data.js';
import {staffEntrance,zombieEntrance,zombieExit,customerExit,atEntrance} from './entrances.js';
export {staffEntrance,zombieEntrance} from './entrances.js';

const trafficState=new WeakMap();
const seated=c=>['seating','waiting','eating'].includes(c.phase);
const actors=s=>[...s.customers.filter(c=>!c.removed),...s.waiters];
const tileKey=(x,y)=>`${x},${y}`;
const atTile=a=>Math.abs(a.x-Math.round(a.x))<1e-6&&Math.abs(a.y-Math.round(a.y))<1e-6;
function traffic(a){let value=trafficState.get(a);if(!value){value={blocked:0};trafficState.set(a,value);}return value;}

export function newGame(now=Date.now()){
  const state={version:SAVE_VERSION,savedAt:now,time:0,seed:67291,coins:500,hearts:10,xp:0,level:1,size:8,hunger:0,
    floor:'wood',wall:'paper',ownedSkins:['wood','paper'],storage:[],objects:[],waiters:[],customers:[],transfers:[],zombieEntrance:{x:6,y:0},
    mastery:{},knownRecipes:{},album:{},seenVisitors:[],events:{christmas:'upcoming'},eventBooks:{},
    stats:{cooked:0,served:0,sold:0,earned:0,tablesBought:0,chairsBought:0,hired:0,fevers:0,fed:{}},
    questIndex:0,questBase:0,combo:0,lastServe:-100,feverUntil:0,spawnIn:7,nextId:1,serveCursor:0,seatCursor:0,
    settings:{music:.22,sfx:.45},tutorial:0,notifications:[],dailyClaim:'',fraction:0,
  };
  for(const [type,x,y,dir] of [['stove',1,1,0],['stove',2,1,1],['server',4,1,0],['table',2,4,0],['chair',2,5,3],['chair',1,4,0],['table',5,4,0],['chair',5,5,3],['chair',6,4,2],['jars',0,1,0],['lantern',7,0,0],['poster',3,0,0]])state.objects.push({uid:uid(state),type,x,y,dir});
  state.waiters.push({uid:uid(state),name:WAITER_NAMES[0],appearance:0,x:3,y:3,infectedUntil:0,task:null,path:[],speedLevel:0,kindnessLevel:0});
  return state;
}
function uid(s){return `o${s.nextId++}`;}
function random(s){s.seed=(s.seed*1664525+1013904223)>>>0;return s.seed/4294967296;}
export function notify(s,message,type='info',details={}){const event={...details,id:uid(s),message,type,time:s.time};s.notifications.push(event);if(s.notifications.length>35)s.notifications.shift();return event;}
export const stars=(s,id)=>recipe(id)?.milestones.filter(n=>(s.mastery[id]||0)>=n).length||0;
export const recipeLevel=s=>RECIPES.reduce((n,r)=>n+stars(s,r.id),0);
export const limit=(s,type)=>LIMITS[type].reduce((n,[level,value])=>s.level>=level?value:n,0);
export const hireCost=s=>100*(s.waiters.length+1)**2;
export const cureCost=s=>20+5*s.level;
export const STAFF_UPGRADE_MAX=5;
export const staffSpeedMultiplier=w=>1+(w.speedLevel||0)*.1;
export const staffTipChance=w=>(w.kindnessLevel||0)*.1;
export const staffMoveSpeed=(s,w)=>(w.infectedUntil>s.time?1.5:2.6)*staffSpeedMultiplier(w);
export const staffUpgradeCost=(w,kind)=>2*((w[kind==='speed'?'speedLevel':'kindnessLevel']||0)+1);
export function upgradeStaff(s,id,kind){
  const w=s.waiters.find(w=>w.uid===id);if(!w||!['speed','kindness'].includes(kind))return '강화할 직원과 능력을 선택해주세요.';
  const key=kind==='speed'?'speedLevel':'kindnessLevel',level=w[key]||0;if(level>=STAFF_UPGRADE_MAX)return '이미 최고 단계예요.';
  const cost=staffUpgradeCost(w,kind);if(s.hearts<cost)return `심장 ${cost}개가 필요해요.`;
  s.hearts-=cost;w[key]=level+1;return null;
}
export function addXp(s,amount){
  s.xp+=amount;
  while(s.xp>=xpNeeded(s.level)){s.xp-=xpNeeded(s.level);s.level++;s.hearts++;notify(s,`식당 레벨 ${s.level}! 새 손님과 심장 1개가 기다려요.`, 'level');}
}
export function canCook(s,r){return !!r&&s.level>=1&&recipeLevel(s)>=r.required&&(!r.event||s.events[r.event]==='active');}
export function stoveStatus(s,o){if(!o?.cook)return 'empty';if(o.cook.collecting)return 'collecting';if(s.time<o.cook.readyAt)return 'cooking';return s.time>=o.cook.spoilAt?'spoiled':'done';}
export function cook(s,stoveId,foodId){
  const o=s.objects.find(o=>o.uid===stoveId),r=recipe(foodId);
  if(!o||furniture(o.type)?.category!=='stove'||o.cook)return '빈 가마솥을 선택해주세요.';
  if(!canCook(s,r))return r?.event&&s.events[r.event]!=='active'?'이벤트 기간에만 조리할 수 있어요.':'레시피 레벨이 부족해요.';
  if(s.coins<r.coins||s.hearts<r.hearts)return '조리 비용이 부족해요.';
  s.coins-=r.coins;s.hearts-=r.hearts;
  const grace=Math.min(21600,Math.max(180,r.duration*2));
  o.cook={foodId:r.id,started:s.time,readyAt:s.time+r.duration,spoilAt:s.time+r.duration+grace};
  if(r.event)s.eventBooks[r.event]=true;
  s.tutorial=Math.max(s.tutorial,1);notify(s,`${r.name} 조리를 시작했어요.`, 'cook-start');return null;
}
export function instant(s,id){const o=s.objects.find(o=>o.uid===id);if(!o?.cook||stoveStatus(s,o)!=='cooking')return '조리 중인 음식이 없어요.';const r=recipe(o.cook.foodId),cost=Math.max(1,Math.ceil((r.duration<=600?1:Math.ceil(r.duration/3600))*Math.max(0,o.cook.readyAt-s.time)/r.duration));if(s.hearts<cost)return '심장이 부족해요.';s.hearts-=cost;const grace=o.cook.spoilAt-o.cook.readyAt;o.cook.readyAt=s.time;o.cook.spoilAt=s.time+grace;notify(s,'심장으로 요리를 즉시 완성했어요.','cook');return null;}
export function discard(s,id){const o=s.objects.find(o=>o.uid===id);if(!o?.cook||o.cook.collecting)return '이미 운반 중이에요.';delete o.cook;return null;}
export function recover(s,id){const o=s.objects.find(o=>o.uid===id);if(stoveStatus(s,o)!=='spoiled')return '상한 음식이 없어요.';if(s.hearts<1)return '심장 1개가 필요해요.';s.hearts--;o.cook.readyAt=s.time;o.cook.spoilAt=s.time+180;return null;}

function tableInFront(s,chair){const direction=DIRECTIONS[chair.dir||0];return direction?s.objects.find(o=>furniture(o.type)?.category==='table'&&o.x===chair.x+direction[0]&&o.y===chair.y+direction[1]):null;}
export function chairSeatProblem(s,chair){
  if(typeof chair==='string')chair=s.objects.find(o=>o.uid===chair);
  if(!chair||furniture(chair.type)?.category!=='chair')return '의자를 선택해주세요.';
  if(!tableInFront(s,chair))return '의자가 바라보는 앞 칸에 식탁이 필요해요.';
  if(!chairReachable(reachableTiles(s,{x:0,y:s.size-1}),chair))return '의자로 가는 통로가 막혀 있어요.';
  return null;
}
function chairReachable(reachable,chair){return reachable.has(tileKey(chair.x,chair.y))||DIRECTIONS.some(([dx,dy])=>reachable.has(tileKey(chair.x+dx,chair.y+dy)));}
export function seats(s){
  const out=[],reachable=reachableTiles(s,{x:0,y:s.size-1});
  for(const c of s.objects.filter(o=>furniture(o.type)?.category==='chair')){
    if(!chairReachable(reachable,c))continue;
    const t=tableInFront(s,c);if(!t)continue;
    // One tile has four adjacent sides; saved seat IDs remain chair UIDs.
    out.push({uid:c.uid,chair:c,table:t});
  }return out;
}
function actorTiles(a){
  const result=new Set([tileKey(Math.round(a.x),Math.round(a.y))]);
  if(!atTile(a))for(const x of [Math.floor(a.x),Math.ceil(a.x)])for(const y of [Math.floor(a.y),Math.ceil(a.y)])result.add(tileKey(x,y));
  return result;
}
function segmentEnds(actor){
  const points=[];for(const x of new Set([Math.floor(actor.x),Math.ceil(actor.x)]))for(const y of new Set([Math.floor(actor.y),Math.ceil(actor.y)]))points.push([x,y]);
  const next=actor.path?.[0];return points.sort((a,b)=>{const preferred=p=>next&&p[0]===next[0]&&p[1]===next[1];return Number(preferred(b))-Number(preferred(a))||Math.hypot(a[0]-actor.x,a[1]-actor.y)-Math.hypot(b[0]-actor.x,b[1]-actor.y);});
}
function blockedTiles(s){return new Set(s.objects.map(o=>tileKey(o.x,o.y)));}
function walkable(s,x,y,blocked=null){if(x<0||y<0||x>=s.size||y>=s.size)return false;if(blocked)return !blocked.has(`${x},${y}`);return !s.objects.some(o=>o.x===x&&o.y===y);}
function reachableTiles(s,from){
  const blocked=blockedTiles(s),q=[[Math.round(from.x),Math.round(from.y)]],seen=new Set();
  if(!walkable(s,...q[0],blocked))return seen;
  seen.add(q[0].join(','));
  for(let at=0;at<q.length;at++){const [x,y]=q[at];for(const [dx,dy] of DIRECTIONS){const a=x+dx,b=y+dy,k=`${a},${b}`;if(walkable(s,a,b,blocked)&&!seen.has(k)){seen.add(k);q.push([a,b]);}}}
  return seen;
}
export function path(s,from,to,{allowBlockedTarget=true}={}){
  if(to[0]<0||to[1]<0||to[0]>=s.size||to[1]>=s.size)return null;
  const target=tileKey(...to),blocked=blockedTiles(s);if(allowBlockedTarget)blocked.delete(target);else if(blocked.has(target))return null;
  const partial=!atTile(from),start=partial?segmentEnds(from).find(([x,y])=>walkable(s,x,y,blocked)):[Math.round(from.x),Math.round(from.y)];if(!start)return null;
  const q=[start],prev=new Map([[tileKey(...start),null]]);
  for(let at=0;at<q.length;at++){
    const [x,y]=q[at];if(tileKey(x,y)===target){const result=[];let key=target;while(prev.get(key)!==null){result.push(key.split(',').map(Number));key=prev.get(key);}result.reverse();if(partial)result.unshift(start);return result;}
    for(const [dx,dy]of DIRECTIONS){const a=x+dx,b=y+dy,key=tileKey(a,b);if(walkable(s,a,b,blocked)&&!prev.has(key)){prev.set(key,tileKey(x,y));q.push([a,b]);}}
  }
  return null;
}
function accessPath(s,actor,o){
  let best=null;for(const [dx,dy]of DIRECTIONS){const x=o.x+dx,y=o.y+dy;if(!walkable(s,x,y))continue;const route=path(s,actor,[x,y],{allowBlockedTarget:false});if(route!==null&&(!best||route.length<best.length))best=route;}return best;
}
function setRoute(s,actor,o){const p=accessPath(s,actor,o);if(p===null)return false;actor.path=p;return true;}
function beside(actor,o){return Math.abs(Math.abs(actor.x-o.x)+Math.abs(actor.y-o.y)-1)<1e-6;}
function workerTarget(s,w){const t=w.task;if(!t)return null;if(t.kind==='clean')return s.objects.find(o=>o.uid===t.chair);if(t.kind==='transfer'){const x=s.transfers.find(x=>x.uid===t.transfer);return s.objects.find(o=>o.uid===(t.phase==='pickup'?x?.stove:x?.server));}return s.objects.find(o=>o.uid===(t.phase==='pickup'?t.server:s.customers.find(c=>c.uid===t.customer)?.seat));}
function higherPriority(a,b){
  const rank=x=>x.phase==='leaving'?5:x.phase==='chasing'?4:x.phase?x.phase==='queue'?1:3:x.task?2:0;
  if(rank(a)!==rank(b))return rank(a)>rank(b);
  if(a.phase==='leaving'&&b.phase==='leaving'){const da=traffic(a).exitDistance??Infinity,db=traffic(b).exitDistance??Infinity;if(da!==db)return da<db;}
  const age=x=>x.phase==='leaving'?x.leavingAt??x.enteredAt??0:x.enteredAt??0;if(age(a)!==age(b))return age(a)<age(b);
  const order=x=>Number(String(x.uid).match(/\d+$/)?.[0]||Infinity);return order(a)!==order(b)?order(a)<order(b):String(a.uid)<String(b.uid);
}
function missionRoute(s,actor){
  if(actor.task){const target=workerTarget(s,actor);return target?accessPath(s,actor,target):null;}
  if(actor.phase==='leaving')return path(s,actor,customerExit(s,actor),{allowBlockedTarget:false});
  if(actor.phase==='seating'){const chair=s.objects.find(o=>o.uid===actor.seat);return chair?path(s,actor,[chair.x,chair.y]):null;}
  const parking=trafficState.get(actor)?.parking;if(parking)return path(s,actor,[parking.x,parking.y],{avoidActors:true});
  return actor.path?.length?path(s,actor,actor.path.at(-1),{avoidActors:true}):[];
}
function move(s,actor,dt,speed){
  const state=traffic(actor);if(state.lastMovedAt===undefined)state.lastMovedAt=s.time;
  if(atTile(actor)&&['leaving','seating'].includes(actor.phase))actor.path=missionRoute(s,actor)||[];
  if(!atTile(actor)&&!actor.path?.length){const end=segmentEnds(actor).find(([x,y])=>walkable(s,x,y));if(end)actor.path=[end];}
  let distance=dt*speed;
  while(distance>1e-6&&actor.path?.length){
    const next=actor.path[0];if(atTile(actor)&&Math.abs(next[0]-actor.x)+Math.abs(next[1]-actor.y)>1.001)actor.path.unshift(Math.abs(next[0]-actor.x)>1e-6?[actor.x+Math.sign(next[0]-actor.x),actor.y]:[actor.x,actor.y+Math.sign(next[1]-actor.y)]);
    const [x,y]=actor.path[0],chair=actor.phase==='seating'&&s.objects.find(o=>o.uid===actor.seat),seatTarget=actor.path.length===1&&chair?.x===x&&chair?.y===y;
    if(!walkable(s,x,y)&&!seatTarget){
      state.blocked+=dt;
      if(!atTile(actor)){const back=segmentEnds(actor).find(([a,b])=>walkable(s,a,b));if(back){actor.path=[back];continue;}}
      const route=missionRoute(s,actor);if(route?.length&&walkable(s,...route[0])){actor.path=route;continue;}
      actor.path=[];return false;
    }
    const dx=x-actor.x,dy=y-actor.y,d=Math.hypot(dx,dy);state.blocked=0;if(d>1e-6)state.lastMovedAt=s.time;
    if(d<=distance){actor.x=x;actor.y=y;actor.path.shift();distance-=d;}else{actor.x+=dx/d*distance;actor.y+=dy/d*distance;distance=0;}
  }
  return !actor.path?.length;
}
function freePosition(s,from,{ignore=null,avoidEntry=false,spread=false}={}){
  const blocked=blockedTiles(s),q=[[Math.max(0,Math.min(s.size-1,Math.round(from.x))),Math.max(0,Math.min(s.size-1,Math.round(from.y)))]],seen=new Set([q[0].join(',')]);
  const candidates=[];
  for(let i=0;i<q.length;i++){const [x,y]=q[i];if(walkable(s,x,y,blocked)&&(!avoidEntry||!atEntrance(s,x,y))&&!s.objects.some(o=>o.x===x&&o.y===y)){if(!spread)return{x,y};candidates.push({x,y});}for(const [dx,dy] of DIRECTIONS){const a=x+dx,b=y+dy,k=tileKey(a,b);if(walkable(s,a,b)&&!seen.has(k)){seen.add(k);q.push([a,b]);}}}
  const existing=actors(s).filter(a=>a!==ignore),score=p=>Math.min(...existing.map(a=>Math.abs(p.x-a.x)+Math.abs(p.y-a.y)),Math.abs(p.x)+Math.abs(p.y-(s.size-1)));
  return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
}
function repairActorPositions(s,{relocateInvalid=false}={}){
  for(const c of s.customers)if(['waiting','eating'].includes(c.phase)){const chair=s.objects.find(o=>o.uid===c.seat);if(chair){c.x=chair.x;c.y=chair.y;}}
  // Shared floor coordinates are intentional. Only an explicit furniture edit
  // keeps the established repair for a worker covered by the newly placed art.
  if(relocateInvalid)for(const w of s.waiters){
    const stranded=atTile(w)?!walkable(s,w.x,w.y):!segmentEnds(w).some(([x,y])=>walkable(s,x,y));
    if(stranded){const position=freePosition(s,w,{ignore:w,avoidEntry:true})||freePosition(s,{x:0,y:s.size-1},{ignore:w,avoidEntry:true});if(position){Object.assign(w,position);w.path=[];trafficState.delete(w);}}
  }
}
function settleWorker(s,w,reset=false){
  let state=traffic(w);
  if(reset||!state.settling){state={blocked:0,lastMovedAt:s.time,settling:!atTile(w)};trafficState.set(w,state);}
  if(atTile(w)){const end=!walkable(s,w.x,w.y)&&DIRECTIONS.map(([dx,dy])=>[w.x+dx,w.y+dy]).find(([x,y])=>walkable(s,x,y));w.path=end?[end]:[];state.settling=!!end;return;}
  state.settling=true;const ends=segmentEnds(w),blocked=blockedTiles(s),end=ends.find(([x,y])=>walkable(s,x,y,blocked));w.path=end?[end]:[];
}
function carriedServing(s,serverId){return s.waiters.find(w=>w.task?.kind==='serve'&&w.task.picked&&!w.task.free&&w.task.server===serverId)?.task;}
function refreshServerReservation(s,serverId){
  const target=s.objects.find(o=>o.uid===serverId);if(!target)return;
  const foodId=s.transfers.find(x=>x.server===serverId)?.foodId||carriedServing(s,serverId)?.foodId;
  if(foodId)target.reservedFood=foodId;else delete target.reservedFood;
}
function reservedServer(s,foodId){
  const servers=s.objects.filter(o=>furniture(o.type)?.category==='server'),reservation=o=>o.reservedFood||carriedServing(s,o.uid)?.foodId,compatible=o=>(!reservation(o)||reservation(o)===foodId)&&!s.waiters.some(w=>w.task?.kind==='serve'&&w.task.picked&&!w.task.free&&w.task.server===o.uid&&w.task.foodId!==foodId);
  return servers.find(o=>o.stock>0&&o.foodId===foodId&&compatible(o))
    ||servers.find(o=>reservation(o)===foodId&&compatible(o)&&(!(o.stock>0)||o.foodId===foodId))
    ||servers.find(o=>!(o.stock>0)&&!reservation(o)&&compatible(o));
}
function finishTransfer(s,transfer){
  s.transfers=s.transfers.filter(x=>x!==transfer);
  refreshServerReservation(s,transfer.server);
}
export function collect(s,id){
  const o=s.objects.find(o=>o.uid===id);if(stoveStatus(s,o)!=='done')return '완성된 요리를 선택해주세요.';
  const target=reservedServer(s,o.cook.foodId);if(!target)return '서빙대가 모두 차 있어요. 빈 서빙대를 마련해주세요.';
  const foodId=o.cook.foodId;target.foodId=foodId;target.stock=(target.stock||0)+recipe(foodId).servings;delete o.cook;completeCooking(s,foodId);refreshServerReservation(s,target.uid);return null;
}
function settleLegacyTransfers(s){
  if(!s.transfers.length)return;
  for(const w of s.waiters)if(w.task?.kind==='transfer'){w.task=null;settleWorker(s,w,true);}
  for(const transfer of [...s.transfers]){
    delete transfer.worker;
    const original=s.objects.find(o=>o.uid===transfer.server),target=original&&(!(original.stock>0)||original.foodId===transfer.foodId)?original:reservedServer(s,transfer.foodId);
    if(!target)continue;
    target.foodId=transfer.foodId;target.stock=(target.stock||0)+recipe(transfer.foodId).servings;
    const stove=s.objects.find(o=>o.uid===transfer.stove);if(stove?.cook?.collecting)delete stove.cook;
    completeCooking(s,transfer.foodId);finishTransfer(s,transfer);refreshServerReservation(s,target.uid);
  }
}
function completeCooking(s,foodId){
  const before=recipeLevel(s),old=stars(s,foodId),r=recipe(foodId);s.mastery[foodId]=(s.mastery[foodId]||0)+1;s.stats.cooked++;s.knownRecipes[foodId]=true;s.tutorial=Math.max(s.tutorial,2);
  const n=stars(s,foodId);if(n>old){const base=Math.min(1000,10*Math.max(1,Math.round(r.servings*r.price/15))),reward=base*[1,5,10][n-1];s.coins+=reward;addXp(s,reward);notify(s,`${r.name} 숙련도 ${n}! 레시피 레벨 ${recipeLevel(s)}`, 'mastery');for(const r of RECIPES)if(r.required>before&&r.required<=recipeLevel(s))notify(s,`새 레시피 · ${r.name}`, 'unlock');}
}

function chooseCustomer(s){
  if(s.hunger>=70&&random(s)<.15+(s.hunger-70)/100)return {id:'red',name:'붉은 좀비',sprite:0,red:true};
  let pool=ZOMBIES.filter(z=>s.level>=z.level&&(!z.event?(z.favorite?stars(s,z.favorite)>=3:true):(s.events[z.event]==='active'?(z.favorite?stars(s,z.favorite)>=3:true):!!s.album[z.id])));
  if(s.feverUntil>s.time)pool=pool.filter(z=>z.id==='wanderer');
  const available=s.objects.filter(o=>o.stock>0).map(o=>o.foodId);const weighted=pool.flatMap(z=>Array(z.id==='wanderer'?3:available.includes(z.favorite)?4:1).fill(z));return weighted[Math.floor(random(s)*weighted.length)]||ZOMBIES[0];
}
function entryBlocked(s){
  const {x,y}=zombieEntrance(s);
  return s.objects.some(o=>o.x===x&&o.y===y);
}
function exitTrafficBlocked(s){return s.customers.some(c=>c.phase==='leaving'&&path(s,c,customerExit(s,c),{allowBlockedTarget:false})===null);}
function announceGuest(s,c){
  if(c.red||c.phase==='leaving'||!zombie(c.zombieId))return;
  const seen=s.seenVisitors??=Object.keys(s.album);if(seen.includes(c.zombieId))return;seen.push(c.zombieId);
  if(!s.album[c.zombieId])notify(s,`새로운 좀비 방문! ${zombie(c.zombieId).name}`,'new-guest',{zombieId:c.zombieId});
}
function createCustomer(s,offline=false){
  if(entryBlocked(s)||exitTrafficBlocked(s))return false;
  const def=chooseCustomer(s),c={uid:uid(s),zombieId:def.id,...zombieEntrance(s),phase:'queue',wait:0,path:[],seat:null,red:!!def.red,enteredAt:s.time};s.customers.push(c);if(!offline)announceGuest(s,c);s.zombieDoorOpenedAt=s.time;return true;
}
function leave(s,c){c.phase='leaving';c.leavingAt=s.time;c.path=path(s,c,customerExit(s,c),{allowBlockedTarget:false})||[];traffic(c).exitDistance=c.path.length;c.seat=null;}
function releaseInactiveSeats(s){
  for(const c of s.customers){
    if(!['seating','waiting'].includes(c.phase))continue;
    const chair=s.objects.find(o=>o.uid===c.seat);if(chair&&tableInFront(s,chair)&&(c.phase!=='seating'||path(s,c,[chair.x,chair.y])!==null))continue;
    for(const w of s.waiters.filter(w=>w.task?.kind==='serve'&&w.task.customer===c.uid))cancelTask(s,w);
    c.worker=null;leave(s,c);
  }
}
export function trafficStatus(s){
  const leaving=s.customers.filter(c=>c.phase==='leaving'),capacity=seats(s).length+1,oldestLeaving=Math.max(0,...leaving.map(c=>s.time-(c.leavingAt??s.time))),oldestSeating=Math.max(0,...s.customers.filter(c=>c.phase==='seating').map(c=>s.time-(c.seatingAt??s.time))),congested=oldestLeaving>=8||oldestSeating>=20||s.customers.length>capacity;
  return{congested,customers:s.customers.length,capacity,leaving:leaving.length,oldestLeaving,oldestSeating,entryBlocked:entryBlocked(s),admissionBlocked:entryBlocked(s)||exitTrafficBlocked(s),capacityReached:s.customers.length>=capacity,exitBlocked:congested&&leaving.some(c=>path(s,c,customerExit(s,c),{allowBlockedTarget:false})===null)};
}
function angry(s,c,queue=false){s.hunger=Math.min(100,s.hunger+(queue?4:8));s.combo=0;if(c.red){const w=s.waiters.filter(w=>w.infectedUntil<=s.time).sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y))[0];if(w){c.phase='chasing';c.target=w.uid;c.seat=null;c.chaseTime=0;c.path=[];return;}}leave(s,c);}
function pay(s,c,offline){
  const r=recipe(c.foodId);if(!r)return;
  const fav=zombie(c.zombieId)?.favorite===r.id,base=r.price*(c.portion||1),xp=Math.round(base*(fav?1.5:1)),coins=Math.round(base*(fav?1.5:1)*(s.feverUntil>s.time?2:1));const tip=(c.tipChance||0)>0&&random(s)<c.tipChance?Math.max(1,Math.ceil(coins*.2)):0,paid=coins+tip;s.coins+=paid;s.stats.earned+=paid;if(tip)s.stats.tips=(s.stats.tips||0)+tip;s.stats.sold++;s.stats.fed[c.zombieId]=(s.stats.fed[c.zombieId]||0)+1;addXp(s,xp);
  if(!offline&&!c.red){if(!s.album[c.zombieId])notify(s,`캐릭터북 등록 · ${zombie(c.zombieId).name}`, 'album');s.album[c.zombieId]=(s.album[c.zombieId]||0)+1;}
  const seat=s.objects.find(o=>o.uid===c.seat);if(seat)seat.dirty=true;s.tutorial=Math.max(s.tutorial,3);leave(s,c);
  if(!offline)notify(s,`손님이 ${paid}코인을 냈어요.${tip?` 팁 +${tip}코인!`:''}`,'payment',{amount:paid,tip,xp,x:c.x,y:c.y,favorite:fav});
}
function hasFood(s){return s.objects.some(o=>furniture(o.type)?.category==='server'&&o.stock>0);}
function addCombo(s,offline){
  s.hunger=Math.max(0,s.hunger-2);s.stats.served++;
  if(offline)return;
  s.combo=s.time-s.lastServe<=9?s.combo+1:1;s.lastServe=s.time;
  if(s.combo===21){s.feverUntil=s.time+30;s.stats.fevers++;notify(s,'달밤의 축제! 30초 동안 코인 2배 · 재고 소모 없음', 'fever');}
}
function cancelTask(s,w){
  const t=w.task;if(!t){settleWorker(s,w,true);return;}
  if(t.kind==='serve'){
    const c=s.customers.find(c=>c.uid===t.customer);if(c)c.worker=null;
    if(t.picked&&!t.free){const o=s.objects.find(o=>o.uid===t.server);if(o){o.foodId=t.foodId;o.stock=(o.stock||0)+t.portion;}}
  }
  if(t.kind==='transfer'){
    const x=s.transfers.find(x=>x.uid===t.transfer);if(x){x.worker=null;if(t.picked){const target=s.objects.find(o=>o.uid===x.server);if(target){target.foodId=x.foodId;target.stock=(target.stock||0)+recipe(x.foodId).servings;completeCooking(s,x.foodId);}finishTransfer(s,x);}}
  }
  if(t.kind==='clean'){const c=s.objects.find(o=>o.uid===t.chair);if(c)c.cleaner=null;}
  w.task=null;settleWorker(s,w,true);
  if(t.kind==='serve')refreshServerReservation(s,t.server);
}
function assign(s,w){
  const waiting=s.customers.filter(c=>c.phase==='waiting'&&!c.worker).sort((a,b)=>b.wait-a.wait);
  for(const c of waiting){
    const favorite=zombie(c.zombieId)?.favorite,counters=s.objects.filter(o=>furniture(o.type)?.category==='server'),start=(s.serveCursor||0)%Math.max(1,counters.length),servers=[...counters.slice(start),...counters.slice(0,start)].sort((a,b)=>(b.foodId===favorite)-(a.foodId===favorite));
    for(const o of servers){const reserved=s.waiters.reduce((n,other)=>n+(other.task?.kind==='serve'&&other.task.phase==='pickup'&&other.task.server===o.uid?1:0),0),available=(o.stock||0)-reserved;if(available<1||!setRoute(s,w,o))continue;w.task={kind:'serve',customer:c.uid,server:o.uid,foodId:o.foodId,portion:1,phase:'pickup',work:0};c.worker=w.uid;s.serveCursor=(counters.indexOf(o)+1)%counters.length;return;}
  }
  // A legacy meal may finish on a now-inactive chair; its dish still gets cleaned.
  for(const chair of s.objects.filter(o=>furniture(o.type)?.category==='chair'))if(chair.dirty&&!chair.cleaner&&setRoute(s,w,chair)){chair.cleaner=w.uid;w.task={kind:'clean',chair:chair.uid,work:0};return;}
}
function parkingComponent(s,from,blocked){
  if(!walkable(s,...from,blocked))return new Set();const q=[from],seen=new Set([from.join(',')]);
  for(let i=0;i<q.length;i++)for(const [dx,dy]of DIRECTIONS){const x=q[i][0]+dx,y=q[i][1]+dy,key=tileKey(x,y);if(walkable(s,x,y,blocked)&&!seen.has(key)){seen.add(key);q.push([x,y]);}}
  return seen;
}
function safeParkingTile(s,point,claims){
  // Resting staff must not turn an open floor component into a bottleneck,
  // even when every chair becomes occupied. Keep a service side available too.
  const before=new Set([...s.objects.map(o=>tileKey(o.x,o.y)),...claims]),component=parkingComponent(s,point,before);if(component.size<3)return false;
  const after=new Set(before);after.add(point.join(','));const neighbor=DIRECTIONS.map(([dx,dy])=>[point[0]+dx,point[1]+dy]).find(p=>walkable(s,...p,after));
  if(!neighbor||parkingComponent(s,neighbor,after).size!==component.size-1)return false;
  for(const o of s.objects.filter(o=>['server','stove'].includes(furniture(o.type)?.category))){const sides=DIRECTIONS.map(([dx,dy])=>[o.x+dx,o.y+dy]);if(sides.some(p=>walkable(s,...p,before))&&!sides.some(p=>walkable(s,...p,after)))return false;}
  return true;
}
function parkIdle(s,w){
  const state=traffic(w);if(state.idleSince===undefined)state.idleSince=s.time;
  if(state.parking||s.time-state.idleSince<1.5||s.time<(state.nextParkAt||0))return;state.nextParkAt=s.time+2;
  const counters=s.objects.filter(o=>furniture(o.type)?.category==='server');if(!counters.length)return;
  const claims=new Set(s.waiters.filter(other=>other!==w).map(other=>trafficState.get(other)?.parking).filter(Boolean).map(p=>tileKey(p.x,p.y))),blocked=blockedTiles(s),occupied=new Set([...s.objects.map(o=>tileKey(o.x,o.y)),...actors(s).filter(a=>a!==w).flatMap(a=>[...actorTiles(a)])]),chairs=s.objects.filter(o=>furniture(o.type)?.category==='chair');
  const routes=new Set(actors(s).filter(a=>a!==w).flatMap(a=>(a.path||[]).map(p=>p.join(',')))),layout={...s,customers:[],waiters:[]},door={x:0,y:s.size-1};
  for(const o of s.objects){const category=furniture(o.type)?.category,route=category==='chair'?path(layout,door,[o.x,o.y]):['server','stove'].includes(category)?accessPath(layout,door,o):null;for(const p of route||[])routes.add(p.join(','));}
  const choices=[];
  for(let x=0;x<s.size;x++)for(let y=0;y<s.size;y++){
    const key=tileKey(x,y),distance=Math.min(...counters.map(o=>Math.abs(o.x-x)+Math.abs(o.y-y)));
    if(distance>3||[staffEntrance(s),zombieEntrance(s)].some(p=>Math.abs(x-p.x)+Math.abs(y-p.y)<=2)||occupied.has(key)||blocked.has(key)||claims.has(key)||routes.has(key)||chairs.some(o=>Math.abs(o.x-x)+Math.abs(o.y-y)<=1)||!safeParkingTile(s,[x,y],claims))continue;
    const route=path(s,w,[x,y],{avoidActors:true});if(route!==null)choices.push({x,y,route,distance});
  }
  const choice=choices.sort((a,b)=>a.distance-b.distance||a.route.length-b.route.length||a.y-b.y||a.x-b.x)[0];
  if(choice){state.parking={x:choice.x,y:choice.y};state.blocked=0;delete state.blockedSince;w.path=choice.route;}
}
function updateWorker(s,w,dt,offline){
  const state=traffic(w);
  // A saved idle route has no WeakMap marker. It is still lower priority than
  // new work; path() preserves the current segment before the worker turns.
  if(!w.task&&(state.parking||w.path?.length)){assign(s,w);if(w.task){delete state.parking;delete state.idleSince;delete state.nextParkAt;}}
  if((!atTile(w)||!walkable(s,w.x,w.y))&&(traffic(w).settling||!w.path?.length||atTile(w)&&!walkable(s,w.x,w.y))){
    settleWorker(s,w);if(w.path.length)move(s,w,dt,staffMoveSpeed(s,w));
    if(atTile(w))traffic(w).settling=false;return;
  }
  if(!w.task){
    if(state.parking&&atTile(w)&&w.path?.length&&blockedTiles(s).has(w.path[0].join(','))){delete state.parking;state.idleSince=s.time;state.nextParkAt=s.time+2;w.path=[];return;}
    if(w.path?.length&&!move(s,w,dt,staffMoveSpeed(s,w)))return;
    if(!atTile(w))return;traffic(w).settling=false;assign(s,w);if(!w.task)parkIdle(s,w);else{delete state.parking;delete state.idleSince;delete state.nextParkAt;}return;
  }
  delete state.parking;delete state.idleSince;delete state.nextParkAt;
  let target=workerTarget(s,w);if(!w.path?.length&&target&&!beside(w,target)&&!setRoute(s,w,target))return;
  if(!move(s,w,dt,staffMoveSpeed(s,w)))return;
  target=workerTarget(s,w);if(target&&!beside(w,target)){setRoute(s,w,target);return;}
  const t=w.task;t.work+=dt;if(t.work<(t.kind==='clean'?1.2:.6)*(w.infectedUntil>s.time?1.4:1)/staffSpeedMultiplier(w))return;t.work=0;
  if(t.kind==='transfer'){
    const x=s.transfers.find(x=>x.uid===t.transfer);if(!x){w.task=null;return;}
    if(t.phase==='pickup'){const o=s.objects.find(o=>o.uid===x.stove),target=s.objects.find(o=>o.uid===x.server);if(!o?.cook||!target||!setRoute(s,w,target)){cancelTask(s,w);return;}delete o.cook;t.picked=true;t.foodId=x.foodId;t.phase='deliver';}
    else{const target=s.objects.find(o=>o.uid===x.server);if(target){target.foodId=x.foodId;target.stock=(target.stock||0)+recipe(x.foodId).servings;completeCooking(s,x.foodId);}finishTransfer(s,x);w.task=null;}
  }else if(t.kind==='serve'){
    const c=s.customers.find(c=>c.uid===t.customer),seat=seats(s).find(x=>x.uid===c?.seat),o=s.objects.find(o=>o.uid===t.server);
    if(!c||c.phase!=='waiting'||!seat){cancelTask(s,w);return;}
    if(t.phase==='pickup'){if(!(o?.stock>=1)||t.foodId&&t.foodId!==o.foodId||!setRoute(s,w,seat.chair)){cancelTask(s,w);return;}t.foodId=o.foodId;t.portion=1;t.picked=true;t.phase='deliver';if(s.feverUntil<=s.time)o.stock-=t.portion;else t.free=true;refreshServerReservation(s,o.uid);}
    else{
      // Older v1 saves may still be walking to the former table service point.
      if(!beside(w,seat.chair)){if(!setRoute(s,w,seat.chair))cancelTask(s,w);return;}
      c.phase='eating';c.foodId=t.foodId;c.portion=t.portion;c.eatUntil=s.time+6;c.worker=null;if(staffTipChance(w)>0){c.tipChance=staffTipChance(w);c.tipStaffName=w.name;}w.task=null;refreshServerReservation(s,t.server);addCombo(s,offline);
    }
  }else{const chair=s.objects.find(o=>o.uid===t.chair);if(chair){if(!beside(w,chair)){if(!setRoute(s,w,chair))cancelTask(s,w);return;}chair.dirty=false;chair.cleaner=null;}w.task=null;}
}
function step(s,dt,offline){
  s.time+=dt;
  settleLegacyTransfers(s);
  repairActorPositions(s);
  const seatList=seats(s);
  if(!offline)for(const c of s.customers)announceGuest(s,c);
  releaseInactiveSeats(s);
  if(s.stats.served>0){s.hunger=Math.min(100,s.hunger+(.5+(hasFood(s)?0:6))*dt/60);}
  if(!offline&&s.time-s.lastServe>9)s.combo=0;
  if(offline){s.combo=0;s.feverUntil=0;}
  s.spawnIn-=dt;
  if(s.spawnIn<=0){
    s.spawnIn=6.5*(1.15-s.hunger/400)/(1+seatList.length*.06)*(hasFood(s)?1:1.6)*(.7+random(s)*.6)/(s.feverUntil>s.time?3:1);
    // Every actor pair can cross at the door. Departures still count toward
    // indoor capacity; only furniture blocks the entrance tile itself.
    if((hasFood(s)||s.stats.served>0)&&s.customers.length<seatList.length+1){if(!createCustomer(s,offline))s.spawnIn=.5;}else s.spawnIn=.5;
  }
  for(const c of s.customers){if(c.phase==='leaving'){if(c.leavingAt===undefined)c.leavingAt=s.time;traffic(c).exitDistance=path(s,c,customerExit(s,c),{allowBlockedTarget:false})?.length??Infinity;}else if(c.phase==='seating'&&c.seatingAt===undefined)c.seatingAt=s.time;}
  const ordered=[...s.customers].sort((a,b)=>higherPriority(a,b)?-1:higherPriority(b,a)?1:0);
  for(const c of ordered){
    if(c.phase==='queue'){
      if((c.path?.length||!atTile(c))&&!move(s,c,dt,c.red?1.2:1.6))continue;
      const available=seatList.filter(x=>!x.chair.dirty&&!s.customers.some(other=>other.seat===x.uid));
      for(let i=available.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[available[i],available[j]]=[available[j],available[i]];}
      const seat=available.find(x=>path(s,c,[x.chair.x,x.chair.y])!==null);
      if(seat){c.seat=seat.uid;c.path=path(s,c,[seat.chair.x,seat.chair.y]);c.phase='seating';c.seatingAt=s.time;c.wait=0;}
      else{c.wait+=dt;if(c.wait>=20)angry(s,c,true);}
    }else if(c.phase==='seating'){if(move(s,c,dt,c.red?1.2:1.6)){const chair=s.objects.find(o=>o.uid===c.seat);if(!chair)leave(s,c);else if(Math.hypot(c.x-chair.x,c.y-chair.y)<1e-6){c.x=chair.x;c.y=chair.y;c.phase='waiting';c.wait=0;}else c.path=path(s,c,[chair.x,chair.y])||[];}}
    else if(c.phase==='waiting'){
      c.wait+=dt;const worker=s.waiters.find(w=>w.uid===c.worker),service=worker?.task?.kind==='serve'&&worker.task.customer===c.uid?worker.task:null,patience=c.red?25:45;
      // Carrying a meal gives a short grace period, not unlimited patience. A
      // stranded delivery otherwise keeps an occupied bottleneck chair forever.
      if(c.wait>=patience&&(!service?.picked||c.wait>=patience+15)){if(service)cancelTask(s,worker);angry(s,c);}
    }
    else if(c.phase==='chasing'){
      c.chaseTime+=dt;const target=s.waiters.find(w=>w.uid===c.target&&w.infectedUntil<=s.time);
      if(!target||c.chaseTime>15){leave(s,c);continue;}
      if(Math.hypot(c.x-target.x,c.y-target.y)<1.1){target.infectedUntil=s.time+300;cancelTask(s,target);notify(s,`${target.name}(이)가 물렸어요! 치료하거나 5분 기다려주세요.`,'danger');leave(s,c);}
      else{if(!c.path?.length||atTile(c)){const route=accessPath(s,c,{x:Math.round(target.x),y:Math.round(target.y)});if(route===null){leave(s,c);continue;}c.path=route;}move(s,c,dt,1.5);}
    }
    else if(c.phase==='eating'){if(s.time>=c.eatUntil)pay(s,c,offline);}
    else if(c.phase==='leaving'){if(!c.path?.length)c.path=missionRoute(s,c)||[];if(move(s,c,dt,1.6)){if(Math.hypot(c.x-customerExit(s,c)[0],c.y-customerExit(s,c)[1])<1e-6){c.removed=true;s.zombieDoorOpenedAt=s.time;}else c.path=missionRoute(s,c)||[];}}
  }
  s.customers=s.customers.filter(c=>!c.removed);
  for(const w of s.waiters)updateWorker(s,w,dt,offline);
}
export function advance(s,seconds,{offline=false}={}){
  if(!Number.isFinite(seconds)||seconds<=0)return;
  const active=offline?Math.min(OFFLINE_CAP,seconds):seconds;
  let remaining=active+(s.fraction||0);
  while(remaining>=.25){step(s,.25,offline);remaining-=.25;}
  s.fraction=remaining;
  if(offline&&seconds>OFFLINE_CAP)s.time+=seconds-OFFLINE_CAP;
}
export function reconcileOffline(s,now=Date.now()){
  const seconds=Math.max(0,(now-s.savedAt)/1000),before={coins:s.coins,sold:s.stats.sold,level:s.level};
  if(seconds<3){s.savedAt=now;return null;}
  advance(s,seconds,{offline:true});s.savedAt=now;
  return {seconds,simulated:Math.min(seconds,OFFLINE_CAP),coins:s.coins-before.coins,sold:s.stats.sold-before.sold,levels:s.level-before.level,done:s.objects.filter(o=>stoveStatus(s,o)==='done').length,spoiled:s.objects.filter(o=>stoveStatus(s,o)==='spoiled').length,infected:s.waiters.filter(w=>w.infectedUntil>s.time).length};
}
export function hire(s){if(s.waiters.length>=limit(s,'waiters'))return '현재 레벨의 고용 한도에 도달했어요.';const cost=hireCost(s);if(s.coins<cost)return '코인이 부족해요.';const position=freePosition(s,{x:0,y:s.size-1},{avoidEntry:true,spread:true});if(!position)return '직원이 설 빈 공간과 통로가 필요해요.';s.coins-=cost;const name=WAITER_NAMES.find(n=>!s.waiters.some(w=>w.name===n))||`직원 ${s.nextId}`,appearance=Array.from({length:8},(_,i)=>i).find(i=>!s.waiters.some(w=>w.appearance===i));const entry=staffEntrance(s),start=walkable(s,entry.x,entry.y)?entry:position;s.waiters.push({uid:uid(s),name,appearance,speedLevel:0,kindnessLevel:0,...start,path:path(s,start,[position.x,position.y])||[],task:null,infectedUntil:0});s.staffDoorOpenedAt=s.time;s.stats.hired++;notify(s,`${name}가 식당에 합류했어요!`, 'hire');return null;}
export function fire(s,id){if(s.waiters.length<=1)return '직원은 최소 1명 필요해요.';const w=s.waiters.find(w=>w.uid===id);if(!w)return '직원을 찾을 수 없어요.';cancelTask(s,w);s.waiters=s.waiters.filter(w=>w.uid!==id);return null;}
export function cure(s,id){const w=s.waiters.find(w=>w.uid===id);if(!w||w.infectedUntil<=s.time)return '치료가 필요하지 않아요.';if(s.coins<cureCost(s))return '치료 비용이 부족해요.';s.coins-=cureCost(s);w.infectedUntil=0;return null;}

export function placementProblem(s,type,x,y,dir=0,ignore=null,{ignoreStaff=false}={}){
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=s.size||y>=s.size)return '식당 안에 배치해주세요.';
  if(atEntrance(s,x,y))return '출입구는 비워주세요.';
  if(type==='poster'&&x!==0&&y!==0)return '포스터는 뒤쪽 벽면에 붙여주세요.';
  if(s.objects.some(o=>o.uid!==ignore&&o.x===x&&o.y===y))return '다른 가구와 겹쳐요.';
  const candidate={uid:ignore||'preview',type,x,y,dir};
  const temp={...s,objects:[...s.objects.filter(o=>o.uid!==ignore),candidate]};
  if(!ignoreStaff&&s.waiters.some(w=>!atTile(w)&&!segmentEnds(w).some(([x,y])=>walkable(temp,x,y))))return '직원이 걷는 칸 옆에 빈 공간을 남겨주세요.';
  // Preserve working approaches without making an already blocked old layout
  // impossible to repair. An unpaired decorative chair needs no service side.
  const door=staffEntrance(s),before=reachableTiles(s,door),reachable=reachableTiles(temp,door),guestDoor=zombieEntrance(s);
  if(before.has(tileKey(guestDoor.x,guestDoor.y))&&!reachable.has(tileKey(guestDoor.x,guestDoor.y)))return '두 출입문을 잇는 통로를 비워주세요.';
  if(ignoreStaff&&s.waiters.length&&![...reachable].some(key=>key!==tileKey(door.x,door.y)))return '직원이 설 빈 바닥을 남겨주세요.';
  for(const o of temp.objects){const category=furniture(o.type)?.category;if(!['stove','server'].includes(category))continue;const old=s.objects.find(old=>old.uid===o.uid);if((o.uid===candidate.uid||old&&accessPath(s,door,old)!==null)&&accessPath(temp,door,o)===null)return '직원이 지나다닐 통로가 필요해요.';}
  for(const chair of temp.objects.filter(o=>furniture(o.type)?.category==='chair')){
    const old=s.objects.find(o=>o.uid===chair.uid),active=!!tableInFront(temp,chair),newSeat=active&&(chair.uid===candidate.uid||!old||!tableInFront(s,old)),preserve=chair.uid!==candidate.uid&&old&&chairReachable(before,old);
    if((newSeat||preserve)&&!chairReachable(reachable,chair))return '손님과 직원이 의자 옆 빈 바닥까지 갈 수 없어요.';
  }
  return null;
}
function furnitureAvailable(s,f){return s.level>=f.level&&(!f.event||s.events[f.event]==='active');}
export function place(s,{type,x,y,dir=0,existing=null,fromStorage=false,editing=false}){
  const f=furniture(type);if(!f)return '알 수 없는 가구예요.';
  const o=existing?s.objects.find(o=>o.uid===existing):null;
  if(existing&&!o)return '가구를 찾을 수 없어요.';
  if(o?.cook)return '음식이 있는 가마솥은 이동할 수 없어요.';
  if(existing&&carriedServing(s,existing))return '직원이 음식을 서빙한 뒤 이동해주세요.';
  if(existing&&s.transfers.some(t=>t.server===existing||t.stove===existing))return '운반이 끝난 뒤 이동해주세요.';
  const error=placementProblem(s,type,x,y,dir,existing,{ignoreStaff:editing});if(error)return error;
  if(!existing){
    if(fromStorage){if(!s.storage.includes(type))return '창고에 가구가 없어요.';if(LIMITS[f.category]&&s.objects.filter(o=>furniture(o.type)?.category===f.category).length>=limit(s,f.category))return '현재 레벨의 설치 한도에 도달했어요.';}
    else{if(!furnitureAvailable(s,f))return f.event?'이벤트 기간에만 구매할 수 있어요.':'식당 레벨이 부족해요.';if(s.coins<f.price)return '코인이 부족해요.';if(LIMITS[f.category]&&s.objects.filter(o=>furniture(o.type)?.category===f.category).length>=limit(s,f.category))return '현재 레벨의 설치 한도에 도달했어요.';}
  }
  for(const w of s.waiters)cancelTask(s,w);s.customers=[];for(const c of s.objects){delete c.dirty;delete c.cleaner;}
  if(existing){o.x=x;o.y=y;o.dir=dir;}
  else{if(fromStorage)s.storage.splice(s.storage.indexOf(type),1);else{s.coins-=f.price;addXp(s,Math.round(f.price*.25));if(f.category==='table')s.stats.tablesBought++;if(f.category==='chair')s.stats.chairsBought++;}s.objects.push({uid:uid(s),type,x,y,dir});}
  repairActorPositions(s,{relocateInvalid:true});
  return null;
}
export function removeFurniture(s,id,sell=false){
  const o=s.objects.find(o=>o.uid===id);if(!o)return '가구가 없어요.';
  if(carriedServing(s,id))return '직원이 음식을 서빙한 뒤 시도해주세요.';
  if(o.cook)return '가마솥의 음식을 먼저 회수하거나 버려주세요.';
  if(o.stock>0)return '서빙대 재고를 먼저 비워주세요.';
  if(s.transfers.some(t=>t.server===id||t.stove===id))return '운반이 끝난 뒤 시도해주세요.';
  for(const w of s.waiters)cancelTask(s,w);s.customers=[];
  if(sell)s.coins+=Math.floor(furniture(o.type).price/2);else s.storage.push(o.type);
  s.objects=s.objects.filter(x=>x.uid!==id);return null;
}
export function applySkin(s,id){const skin=SKINS.find(x=>x.id===id);if(!skin)return '디자인이 없어요.';if(!s.ownedSkins.includes(id)){if(s.level<skin.level)return '식당 레벨이 부족해요.';if(s.coins<skin.price)return '코인이 부족해요.';s.coins-=skin.price;s.ownedSkins.push(id);}s[skin.type]=id;return null;}
export function expand(s){const next=EXPANSIONS.find(x=>x.size>s.size);if(!next)return '최대 크기예요.';if(s.level<next.level)return `식당 레벨 ${next.level}부터 확장할 수 있어요.`;if(s.coins<next.price)return '코인이 부족해요.';s.coins-=next.price;s.size=next.size;notify(s,`식당이 ${s.size}×${s.size}로 넓어졌어요!`,'level');return null;}
export function statValue(s,key){if(key==='mastered')return RECIPES.filter(r=>stars(s,r.id)===3).length;if(key==='size')return s.size;if(key==='album')return Object.keys(s.album).length;if(key.startsWith('fed:'))return s.stats.fed[key.slice(4)]||0;return s.stats[key]||0;}
export function questProgress(s){const q=QUESTS[s.questIndex];return q?{...q,progress:Math.max(0,Math.min(q.target,statValue(s,q.stat)-(q.absolute?0:s.questBase)))}:null;}
export function claimQuest(s){const q=questProgress(s);if(!q||q.progress<q.target)return '아직 의뢰 조건을 달성하지 못했어요.';s.coins+=q.coins;addXp(s,q.xp);s.questIndex++;const next=QUESTS[s.questIndex];s.questBase=next&&!next.absolute?statValue(s,next.stat):0;notify(s,`시장님의 선물 · ${q.coins}코인 + ${q.xp} XP`,'quest');return null;}
export function setEvent(s,status){if(!['upcoming','active','ended'].includes(status))return;s.events.christmas=status;notify(s,status==='active'?'오싹한 성탄절이 시작됐어요!':status==='ended'?'성탄절 영업이 끝났어요. 모은 추억은 남아있어요.':'다음 성탄절을 준비합니다.','event');}
export function daily(s,now=new Date()) {const date=now.toISOString().slice(0,10);if(s.dailyClaim===date)return '오늘의 선물은 이미 받았어요.';s.dailyClaim=date;s.coins+=100;s.hearts+=2;notify(s,'오늘의 선물 · 100코인 + 심장 2개','quest');return null;}

// Strict import boundary: malformed files never replace an existing game.
export function validateSave(raw){
  if(!raw||raw.version!==SAVE_VERSION||!Number.isFinite(raw.savedAt)||raw.savedAt<0||!Number.isFinite(raw.time)||raw.time<0)throw new Error('지원하지 않거나 손상된 저장 파일입니다.');
  const s=structuredClone(raw);
  for(const key of ['serveCursor','seatCursor']){if(s[key]===undefined)s[key]=0;if(!Number.isInteger(s[key])||s[key]<0||s[key]>256)throw new Error('서빙·좌석 순서 정보가 손상되었습니다.');}
  for(const key of ['coins','hearts','xp','level','hunger','size','seed','nextId','questIndex','questBase','spawnIn','combo','lastServe','feverUntil'])if(!Number.isFinite(s[key]))throw new Error('저장 수치가 손상되었습니다.');
  if(s.coins<0||s.hearts<0||s.xp<0||s.level<1||s.level>1000||!Number.isInteger(s.size)||s.size<8||s.size>16||s.hunger<0||s.hunger>100||s.questIndex<0||s.questIndex>QUESTS.length)throw new Error('저장 범위가 올바르지 않습니다.');
  for(const key of ['objects','waiters','customers','storage','transfers','ownedSkins','notifications'])if(!Array.isArray(s[key]))throw new Error('저장 목록이 손상되었습니다.');
  if(s.objects.length>256||s.waiters.length<1||s.waiters.length>8||s.customers.length>100||s.storage.length>10000)throw new Error('저장 목록의 크기가 올바르지 않습니다.');
  for(const key of ['mastery','knownRecipes','album','events','eventBooks','stats','settings'])if(!s[key]||typeof s[key]!=='object'||Array.isArray(s[key]))throw new Error('저장 정보가 손상되었습니다.');
  if(!['upcoming','active','ended'].includes(s.events.christmas))throw new Error('이벤트 정보가 올바르지 않습니다.');
  const ids=new Set(),positions=new Set();
  for(const o of s.objects){if(!furniture(o.type)||typeof o.uid!=='string'||ids.has(o.uid)||!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<0||o.y<0||o.x>=s.size||o.y>=s.size||!Number.isInteger(o.dir)||o.dir<0||o.dir>3)throw new Error('가구 정보가 올바르지 않습니다.');ids.add(o.uid);const k=`${o.x},${o.y}`;if(positions.has(k))throw new Error('가구 위치가 겹칩니다.');positions.add(k);if(o.stock!==undefined&&(!Number.isFinite(o.stock)||o.stock<0||!recipe(o.foodId)))throw new Error('음식 재고 정보가 손상되었습니다.');if(o.cook&&(!recipe(o.cook.foodId)||!['started','readyAt','spoilAt'].every(k=>Number.isFinite(o.cook[k]))))throw new Error('조리 정보가 손상되었습니다.');}
  if(s.seenVisitors===undefined)s.seenVisitors=[...new Set([...Object.keys(s.album),...s.customers.map(c=>c.zombieId).filter(id=>zombie(id))])];
  if(!Array.isArray(s.seenVisitors)||s.seenVisitors.length>ZOMBIES.length||new Set(s.seenVisitors).size!==s.seenVisitors.length||s.seenVisitors.some(id=>typeof id!=='string'||!zombie(id)))throw new Error('손님 방문 기록이 올바르지 않습니다.');
  for(const id of s.storage)if(!furniture(id))throw new Error('창고 정보가 손상되었습니다.');
  for(const [id,count] of Object.entries(s.mastery))if(!recipe(id)||!Number.isInteger(count)||count<0)throw new Error('숙련도 정보가 손상되었습니다.');
  for(const [id,count] of Object.entries(s.album))if(!zombie(id)||!Number.isInteger(count)||count<1)throw new Error('도감 정보가 손상되었습니다.');
  for(const c of s.customers)if(c.exitDoor!==undefined&&(!c.exitDoor||!Number.isInteger(c.exitDoor.x)||!Number.isInteger(c.exitDoor.y)||c.exitDoor.x<0||c.exitDoor.y<0||c.exitDoor.x>=s.size||c.exitDoor.y>=s.size||(c.exitDoor.x!==0&&c.exitDoor.y!==0)))throw new Error('손님 출구 정보가 올바르지 않습니다.');
  const validPath=p=>Array.isArray(p)&&p.length<=256&&p.every(t=>Array.isArray(t)&&t.length===2&&t.every(n=>Number.isInteger(n)&&n>=0&&n<s.size));
  const appearances=new Set();
  for(const w of s.waiters){
    if(typeof w.uid!=='string'||typeof w.name!=='string'||w.name.length>40||!Number.isFinite(w.x)||!Number.isFinite(w.y)||!Number.isFinite(w.infectedUntil)||!validPath(w.path))throw new Error('직원 정보가 손상되었습니다.');
    if(w.task&&(!['serve','transfer','clean'].includes(w.task.kind)||!Number.isFinite(w.task.work)||w.task.work<0||w.task.portion!==undefined&&(!Number.isFinite(w.task.portion)||w.task.portion<0)))throw new Error('직원 작업이 손상되었습니다.');
    // Only unconsumed reservations migrate; carried meals retain their debit/refund and payment quantity.
    if(w.task?.kind==='serve'&&w.task.phase==='pickup'&&!w.task.picked)w.task.portion=1;
    if(w.appearance!==undefined){if(!Number.isInteger(w.appearance)||w.appearance<0||w.appearance>7||appearances.has(w.appearance))throw new Error('직원 외모 정보가 손상되었습니다.');appearances.add(w.appearance);}
  }
  for(const w of s.waiters)for(const key of ['speedLevel','kindnessLevel']){if(w[key]===undefined)w[key]=0;if(!Number.isInteger(w[key])||w[key]<0||w[key]>STAFF_UPGRADE_MAX)throw new Error('직원 강화 정보가 올바르지 않습니다.');}
  for(const c of s.customers)if(c.tipChance!==undefined&&(!Number.isFinite(c.tipChance)||c.tipChance<0||c.tipChance>.5))throw new Error('손님 팁 정보가 올바르지 않습니다.');
  // Rename only the four retired defaults; preserve custom names and staff state.
  for(const w of s.waiters)if(Object.hasOwn(WAITER_NAME_UPDATES,w.name))w.name=WAITER_NAME_UPDATES[w.name];
  // Fill missing v1 appearances after reserving all explicitly saved numbers.
  for(const w of s.waiters)if(w.appearance===undefined){let appearance=0;while(appearances.has(appearance))appearance++;w.appearance=appearance;appearances.add(appearance);}
  const occupiedSeats=new Set();
  for(const c of s.customers){
    if((c.zombieId!=='red'&&!zombie(c.zombieId))||!Number.isFinite(c.x)||!Number.isFinite(c.y)||!validPath(c.path)||!['queue','seating','waiting','eating','chasing','leaving'].includes(c.phase)||!Number.isFinite(c.wait))throw new Error('손님 정보가 손상되었습니다.');
    for(const key of ['enteredAt','seatingAt','leavingAt'])if(c[key]!==undefined&&(!Number.isFinite(c[key])||c[key]<0))throw new Error('손님 이동 시간이 손상되었습니다.');
    if(['seating','waiting','eating'].includes(c.phase)){
      if(!s.objects.some(o=>o.uid===c.seat&&furniture(o.type)?.category==='chair')||occupiedSeats.has(c.seat))throw new Error('손님 좌석 정보가 손상되었습니다.');
      occupiedSeats.add(c.seat);
    }
  }
  for(const t of s.transfers)if(!t||typeof t.uid!=='string'||!s.objects.some(o=>o.uid===t.stove&&o.type==='stove')||!s.objects.some(o=>o.uid===t.server&&o.type==='server')||!recipe(t.foodId))throw new Error('운반 정보가 손상되었습니다.');
  for(const [id,value] of Object.entries(s.knownRecipes))if(!recipe(id)||value!==true)throw new Error('요리책 정보가 손상되었습니다.');
  for(const [k,v] of Object.entries(s.stats)){if(k==='fed'){if(!v||typeof v!=='object'||Object.values(v).some(n=>!Number.isFinite(n)||n<0))throw new Error('판매 기록이 손상되었습니다.');}else if(!Number.isFinite(v)||v<0)throw new Error('통계 정보가 손상되었습니다.');}
  for(const n of s.notifications)if(n?.type==='payment'){for(const key of ['amount','xp','x','y'])if(n[key]!==undefined&&(!Number.isFinite(n[key])||(['amount','xp'].includes(key)&&n[key]<0)))throw new Error('결제 알림 정보가 손상되었습니다.');if(n.favorite!==undefined&&typeof n.favorite!=='boolean')throw new Error('결제 알림 정보가 손상되었습니다.');}
  if(!SKINS.some(x=>x.id===s.floor&&x.type==='floor')||!SKINS.some(x=>x.id===s.wall&&x.type==='wall'))throw new Error('인테리어 정보가 손상되었습니다.');
  s.settings.music=Math.max(0,Math.min(1,Number(s.settings.music)||0));s.settings.sfx=Math.max(0,Math.min(1,Number(s.settings.sfx)||0));
  for(const o of s.objects)if(furniture(o.type)?.category==='server')refreshServerReservation(s,o.uid);
  if(s.zombieEntrance===undefined){
    // Old layouts keep their furniture: choose a connected free right-wall tile.
    const preferred=Math.min(6,s.size-2),xs=[preferred,...Array.from({length:s.size},(_,x)=>x).filter(x=>x!==preferred)];
    let x=xs.find(x=>path(s,staffEntrance(s),[x,0],{allowBlockedTarget:false})!==null);
    if(x===undefined)for(const candidateX of xs){
      if(path(s,staffEntrance(s),[candidateX,0])===null)continue;
      const obstacle=s.objects.find(o=>o.x===candidateX&&o.y===0);if(!obstacle)continue;
      s.zombieEntrance={x:candidateX,y:0};
      let position=null;
      for(let y=0;y<s.size&&!position;y++)for(let gx=0;gx<s.size;gx++){
        if(actors(s).some(a=>Math.round(a.x)===gx&&Math.round(a.y)===y))continue;
        if(!placementProblem(s,obstacle.type,gx,y,obstacle.dir,obstacle.uid,{ignoreStaff:true})){position={x:gx,y};break;}
      }
      if(position){Object.assign(obstacle,position);x=candidateX;notify(s,'좀비 출입구를 비우기 위해 가구를 빈 자리로 옮겼어요.');break;}
    }
    s.zombieEntrance={x:x??preferred,y:0};
    if(x===undefined)for(const c of s.customers)c.exitDoor=staffEntrance(s);
  }else if(!s.zombieEntrance||!Number.isInteger(s.zombieEntrance.x)||s.zombieEntrance.x<0||s.zombieEntrance.x>=s.size||!Number.isInteger(s.zombieEntrance.y)||s.zombieEntrance.y<0||s.zombieEntrance.y>=s.size||(s.zombieEntrance.x!==0&&s.zombieEntrance.y!==0))throw new Error('좀비 출입구 정보가 올바르지 않습니다.');
  for(const key of ['zombieDoorOpenedAt','staffDoorOpenedAt'])if(s[key]!==undefined&&!Number.isFinite(s[key]))throw new Error('출입문 상태가 올바르지 않습니다.');
  settleLegacyTransfers(s);
  releaseInactiveSeats(s);
  repairActorPositions(s);
  for(const w of s.waiters)if(!w.path?.length&&!atTile(w))settleWorker(s,w,true);
  return s;
}
