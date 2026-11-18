import {ZOMBIE_ATLASES} from './zombie-atlases.generated.js';
import {QUARTER_FURNITURE} from './quarter-furniture.generated.js';
import {FOOD_ATLASES} from './food-atlases.generated.js';
import {EATING_ATLASES} from './eating-atlases.generated.js';
import {BACKGROUND_SCENE} from './background-fx.generated.js';
// Asset IDs and URLs are shared by the renderer, collection and art gallery.
// Keep legacy keys stable: saved content IDs and atlas indexes do not change.
function asset(key,name,{width,height,cols=1,rows=cols,type='sprite',...metadata}){
  return {key,name,url:`/assets/${key}.png`,type,width,height,cols,rows,
    grid:{x:0,y:0,cols,rows,cellWidth:width/cols,cellHeight:height/rows},
    trim:true,...metadata};
}

const directions=[
  {id:'se',name:'오른쪽 아래',row:0,index:0,vector:[1,0],screen:'SE'},
  {id:'sw',name:'왼쪽 아래',row:1,index:1,vector:[0,1],screen:'SW'},
  {id:'nw',name:'왼쪽 위·뒷모습',row:2,index:2,vector:[-1,0],screen:'NW'},
  {id:'ne',name:'오른쪽 위·뒷모습',row:3,index:3,vector:[0,-1],screen:'NE'},
];

// Measured alpha >80 bounds, relative to each untrimmed 280px square cell.
// Per-pose foot anchors compensate generated padding without stretching art.
const poseBounds=[
  [75,7,174,257],[82,7,150,250],[72,9,148,252],[52,6,156,251],[55,37,149,224],
  [69,6,172,259],[75,6,149,249],[61,9,160,255],[48,6,151,249],[46,36,151,226],
  [63,7,171,253],[74,3,145,254],[64,10,154,250],[52,6,151,251],[52,38,146,220],
  [61,6,171,253],[81,6,142,247],[52,8,162,253],[52,6,153,247],[50,40,153,219],
];
const poses=poseBounds.map(([x,y,width,height],index)=>{
  const row=Math.floor(index/5),column=index%5;
  return {index,row,column,direction:directions[row].id,dir:row,
    state:column===4?'sit':'walk',frame:column===4?0:column,
    x:column*280,y:row*280,width:280,height:280,
    source:{x:column*280,y:row*280,width:280,height:280},
    bounds:{x,y,width,height},
    anchor:{x:Math.round(x+width/2),y:y+height}};
});
const seatedHips=[[100,223],[145,223],[134,232],[122,232]];
for(let dir=0;dir<4;dir++)poses[dir*5+4].hip={x:seatedHips[dir][0],y:seatedHips[dir][1]};

const seatedActors=[
  {id:'student',name:'야자 학생',sprite:1,row:0},
  {id:'rider',name:'새벽 배달원',sprite:5,row:1},
  {id:'hostess',name:'수다쟁이 주모',sprite:6,row:2},
  {id:'hiker',name:'정상 찍은 등산객',sprite:7,row:3},
  {id:'nurse',name:'퇴근한 간호사',sprite:9,row:4},
];
// Alpha >80 bounds and bottom-shoe anchors, relative to 280x270 cells.
const seatedPoseBounds=[
  [67,31,195,234,199,265],[57,31,196,234,120,265],[44,31,181,225,98,256],[19,31,182,223,145,254],
  [74,31,164,232,195,263],[75,31,160,232,120,263],[61,31,150,228,98,259],[33,31,148,228,145,259],
  [74,17,204,237,179,254],[42,17,195,237,136,254],[27,20,184,232,122,252],[32,20,178,234,116,254],
  [65,15,182,232,193,247],[64,15,183,230,119,245],[53,15,170,229,93,244],[19,13,175,231,142,244],
  [74,5,168,254,194,259],[66,3,169,256,119,259],[54,7,156,249,96,256],[31,7,151,247,143,254],
];
const seatedPoses=seatedPoseBounds.map(([x,y,width,height,anchorX,anchorY],index)=>{
  const row=Math.floor(index/4),column=index%4;
  return {index,row,column,actorId:seatedActors[row].id,direction:directions[column].id,dir:column,state:'sit',frame:0,
    x:column*280,y:24+row*270,width:280,height:270,
    source:{x:column*280,y:24+row*270,width:280,height:270},
    bounds:{x,y,width,height},anchor:{x:anchorX,y:anchorY}};
});
const officePoses=[
  [198,39,334,551,352,590],[95,41,346,546,274,587],
  [147,35,335,548,288,583],[138,37,344,546,318,583],
].map(([x,y,width,height,anchorX,anchorY],index)=>{
  const row=Math.floor(index/2),column=index%2;
  return {index,row,column,actorId:'office',direction:directions[index].id,dir:index,state:'sit',frame:0,
    x:column*627,y:row*627,width:627,height:627,
    source:{x:column*627,y:row*627,width:627,height:627},
    bounds:{x,y,width,height},anchor:{x:anchorX,y:anchorY}};
});

export const ASSET_MANIFEST={
  food:asset('food','기괴한 한식·재화',{width:1254,height:1254,cols:4,type:'atlas'}),
  emptyDish:asset('emptyDish','식사 후 빈 그릇',{url:'/assets/empty-dish.svg',width:32,height:20,rows:1,trim:false}),
  characters:asset('characters','첫 손님 15종·직원',{width:1254,height:1254,cols:4,type:'atlas'}),
  seatedNeighbors:asset('seatedNeighbors','단골 손님 5종·네 방향 착석',{
    url:'/assets/seated-neighbors.png',width:1122,height:1402,cols:4,rows:5,type:'seated-atlas',trim:false,
    grid:{x:0,y:24,cols:4,rows:5,cellWidth:280,cellHeight:270},cell:{width:280,height:270},
    actors:seatedActors,actorRows:Object.fromEntries(seatedActors.map(a=>[a.id,a.row])),
    directions:directions.map(({row,...direction},column)=>({...direction,column})),
    poses:seatedPoses,frames:{sit:0},referenceHeight:280,anchorMode:'feet',mirror:false,
    note:'행 학생/배달원/주모/등산객/간호사, 열 SE/SW/NW/NE. 원본 그대로, y24+row*270으로 잘라야 발·모자가 보존됨. referenceHeight는 명목 서있는 키, 앉은 몸을 280px로 늘이지 않음.',
  }),
  seatedOffice:asset('seatedOffice','야근 직장인·네 방향 착석',{
    url:'/assets/office-seated.png',width:1254,height:1254,cols:2,rows:2,type:'seated-atlas',trim:false,
    grid:{x:0,y:0,cols:2,rows:2,cellWidth:627,cellHeight:627},cell:{width:627,height:627},
    actorId:'office',sprite:3,poses:officePoses,
    directions:directions.map(({row,...direction},index)=>({...direction,row:Math.floor(index/2),column:index%2})),
    frames:{sit:0},referenceHeight:640,anchorMode:'feet',mirror:false,
    note:'행 우선 SE/SW/NW/NE. 흰 셔츠·빨간 넥타이·사원증·서류가방, 실제 굽힌 무릎과 후면. 별도 걷기 없음.',
  }),
  workers:asset('workers','모습이 다른 직원 8명',{
    width:1774,height:887,cols:4,rows:2,type:'worker-atlas',
    grid:{x:0,y:0,cols:4,rows:2,cellWidth:443,cellHeight:443},
    styles:[
      {index:0,id:'rose',name:'분홍 저고리·크림 앞치마'},
      {index:1,id:'bandana',name:'흰 두건·갈색 앞치마'},
      {index:2,id:'glasses',name:'회색 머리·안경·초록 앞치마'},
      {index:3,id:'curly',name:'곱슬머리·파랑 앞치마'},
      {index:4,id:'beard',name:'짧은 머리·수염·노랑 앞치마'},
      {index:5,id:'braid',name:'땋은 머리·보라 앞치마'},
      {index:6,id:'cap',name:'검정 모자·먹색 앞치마'},
      {index:7,id:'bob',name:'단발머리·민트 앞치마'},
    ],
    note:'4열×2행, 행 우선 index 0~7. 건강한 인간 직원, 빈손 정지 자세. 외형별 능력 차이 없음.',
  }),
  infectedHaon:asset('infectedHaon','감염된 하온 · 동공 없는 하얀 눈',{
    url:'/assets/worker-haon-white-eyes-v1.png',width:1254,height:1254,rows:1,type:'worker-variant',
    promptFile:'/assets/worker-haon-white-eyes-v1.prompt.txt',appearance:0,infectedOnly:true,
  }),
  waiterTray:asset('waiterTray','직원이 드는 빈 황동 쟁반',{
    url:'/assets/waiter-tray.png',width:1254,height:1254,type:'overlay',
    bounds:{x:104,y:361,width:1046,height:597},anchor:{x:627,y:958},
    foodAnchor:{x:523,y:299},empty:true,
    note:'투명 배경의 빈 쟁반 한 개. trim 후 foodAnchor는 그림 내부 중심. 직원 손앞에 별도로 겹치고 운반 중에만 음식을 올림.',
  }),
  woodenEntrance:asset('woodenEntrance','한옥 식당 나무 출입문',{
    url:'/assets/wooden-entrance.png',width:887,height:1774,cols:1,rows:1,type:'wall-overlay',trim:true,
    bounds:{x:110,y:150,width:667,height:1479},sourceBoundRatio:667/1479,
    anchor:{x:444,y:1629},view:'front-elevation',
    note:'닫힌 문 한 짝과 나무 문틀의 정면 수직 그림. 원근 없음. 벽·바닥 없이 렌더 단계에서 왼쪽 벽 affine(1,-.5,0,1) 적용.',
  }),
  zombieEntrance:asset('zombieEntrance','좀비 손님 해골 출입문',{
    url:'/assets/zombie-entrance.png',width:887,height:1774,cols:1,rows:1,type:'wall-overlay',trim:true,
  }),
  furniture:asset('furniture','한옥 가구·네 방향 의자',{
    width:1254,height:1254,cols:4,type:'atlas',
    chairs:[
      {index:1,width:191,height:268,seat:{x:108,y:148}},
      {index:2,width:191,height:268,seat:{x:83,y:148}},
      {index:3,width:173,height:251,seat:{x:83,y:128},front:[[44,44],[143,0],[173,0],[173,223],[142,223],[142,154],[80,185],[80,251],[44,251]]},
      {index:4,width:173,height:252,seat:{x:90,y:128},front:[[129,44],[30,0],[0,0],[0,224],[31,224],[31,155],[93,186],[93,252],[129,252]]},
    ],
  }),
  stoveIsometric:asset('stoveIsometric','격자 각도에 맞춘 무쇠 가마솥',{
    url:'/assets/stove-isometric.png',width:1254,height:1254,type:'furniture',
    bounds:{x:202,y:200,width:847,height:888},anchor:{x:626,y:1088},
    projection:{type:'isometric',axisSlope:.5,footprint:[1,1]},views:1,
    note:'테이블과 같은 2:1 등각. 단일 뷰, 별도 회전 그림 없음. 기존 가구 아틀라스 보존.',
  }),
  serverIsometric:asset('serverIsometric','격자 각도에 맞춘 나무 서빙대',{
    url:'/assets/server-isometric.png',width:1774,height:887,type:'furniture',
    bounds:{x:525,y:99,width:723,height:698},anchor:{x:887,y:797},
    projection:{type:'isometric',axisSlope:.5,footprint:[1,1]},views:1,
    surface:{width:723,height:698,anchor:{x:365,y:184},polygon:[[365,0],[722,184],[365,365],[0,184]]},
    note:'빈 마름모 상판, 앞면 천과 붉은 술. 단일 뷰, 별도 회전 그림 없음.',
  }),
  bookCoverBlank:asset('bookCoverBlank','요리책 빈 표지 자리',{url:'/assets/cookbook-cover-blank.png',width:1,height:1,type:'ui-placeholder',trim:false}),
  night:asset('night','쿼터뷰 폐허 한옥 마당',{url:'/assets/night-ruins-quarterview.png',width:1671,height:941,type:'background',trim:false,projection:{type:'orthographic-isometric',axisSlope:.5,horizon:false}}),
  poster:asset('poster','뇌 주먹밥의 효능 포스터',{width:1024,height:1536,type:'poster',trim:false}),
  delinquent:asset('delinquent','일진 고딩',{width:1254,height:1254}),
  neighbors:asset('neighbors','러닝·테니스·찜질방·복학생',{width:1254,height:1254,cols:2,type:'atlas'}),
  diver:asset('diver','해녀',{width:1254,height:1254}),
  folklore:asset('folklore','처녀귀신·삼신할머니·호랑이·머슴',{width:1247,height:1261,cols:2,type:'atlas'}),
  hahoe:asset('hahoe','하회탈',{width:1254,height:1254}),
  femaleidol:asset('femaleidol','백금발 여자 아이돌',{width:1222,height:1287}),
  dokkaebi:asset('dokkaebi','도깨비',{width:1254,height:1254}),
  kongjwi:asset('kongjwi','가난한 콩쥐·개구리',{width:1254,height:1254}),
  walk1:asset('walk1','행인 기존 걷기 1',{url:'/assets/wanderer-walk/frame-1.png',width:1254,height:1254,type:'animation-frame'}),
  walk2:asset('walk2','행인 기존 걷기 2',{url:'/assets/wanderer-walk/frame-2.png',width:1254,height:1254,type:'animation-frame'}),
  walk3:asset('walk3','행인 기존 걷기 3',{url:'/assets/wanderer-walk/frame-3.png',width:1254,height:1254,type:'animation-frame'}),
  walk4:asset('walk4','행인 기존 걷기 4',{url:'/assets/wanderer-walk/frame-4.png',width:1254,height:1254,type:'animation-frame'}),
  wandererDirectional:asset('wandererDirectional','허기진 행인·네 방향 걷기와 앉기',{
    url:'/assets/wanderer-directional.png',width:1402,height:1122,cols:5,rows:4,type:'directional-atlas',trim:false,
    grid:{x:0,y:0,cols:5,rows:4,cellWidth:280,cellHeight:280},
    cell:{width:280,height:280},anchor:{x:140,y:270},
    directions,frames:{walk:[0,1,2,3],sit:4,idle:0},poses,fps:7,
    referenceHeight:257,actorId:'wanderer',mirror:false,
    note:'행 SE/SW/NW/NE, 열 걷기0~3/앉기. 우·하단 2px는 여백. poses[index].anchor는 셀 내부 발밑 좌표.',
  }),
};

// Seat contact is independent of the foot anchor used by walking sprites.
const neighborHips=[
 [[143,226],[176,226],[151,229],[98,229]],
 [[143,224],[176,224],[147,229],[112,229]],
 [[135,220],[172,220],[142,224],[102,224]],
 [[140,210],[173,210],[142,217],[105,217]],
 [[144,217],[173,217],[141,224],[109,224]],
];
for(const pose of seatedPoses){const [x,y]=neighborHips[pose.row][pose.column];pose.hip={x,y};}
for(const [dir,[x,y]]of [[278,486],[361,486],[334,500],[278,501]].entries())officePoses[dir].hip={x,y};

for(const atlas of ZOMBIE_ATLASES)ASSET_MANIFEST[atlas.key]=atlas;
for(const atlas of FOOD_ATLASES)ASSET_MANIFEST[atlas.key]=atlas;
for(const atlas of EATING_ATLASES)ASSET_MANIFEST[atlas.key]=atlas;
if(BACKGROUND_SCENE){Object.assign(ASSET_MANIFEST.night,BACKGROUND_SCENE.base,{metadataUrl:'/assets/background-fx.json'});for(const atlas of BACKGROUND_SCENE.assets)ASSET_MANIFEST[atlas.key]=atlas;}
if(QUARTER_FURNITURE){ASSET_MANIFEST[QUARTER_FURNITURE.key]=QUARTER_FURNITURE;for(const asset of QUARTER_FURNITURE.externalAssets||[])ASSET_MANIFEST[asset.key]=asset;}
if(ZOMBIE_ATLASES.some(a=>a.actorId==='wanderer'))for(const key of ['wandererDirectional','walk1','walk2','walk3','walk4'])ASSET_MANIFEST[key].archived=true;
export function directionalCharacter(actorId){
  const id=({'santa-scholar':'scholar','snow-bride':'bride',red:'dokkaebi'})[actorId]||actorId;
  const generated=ZOMBIE_ATLASES.find(asset=>asset.actorId===id);
  if(generated)return generated;
  return id==='wanderer'?ASSET_MANIFEST.wandererDirectional:null;
}
export function eatingCharacter(actorId){return EATING_ATLASES.find(a=>a.actorId===actorId)||null;}

export const ASSETS=Object.fromEntries(Object.entries(ASSET_MANIFEST).map(([key,value])=>[key,value.url]));

export function foodFrame(spriteIndex=0){
  const index=Number.isInteger(spriteIndex)?spriteIndex:0;
  const atlas=FOOD_ATLASES.find(a=>index>=a.startSprite&&index<a.startSprite+a.count);
  return atlas?{key:atlas.key,index:index-atlas.startSprite}:{key:'food',index};
}

// Shared sprite routing: sprite 15 is the waiter, 16 starts the extra guests.
export function characterFrame(spriteIndex=0){
  const sprite=Number.isInteger(spriteIndex)?spriteIndex:0;
  const updatedActor={7:'hiker',30:'santa',31:'shaman',32:'lounge-singer',33:'clown'}[sprite];
  if(updatedActor){const atlas=ZOMBIE_ATLASES.find(a=>a.actorId===updatedActor);if(atlas)return {key:atlas.key,index:0};}
  if(sprite===16)return {key:'delinquent',index:0};
  if(sprite>=17&&sprite<=20)return {key:'neighbors',index:sprite-17};
  if(sprite===21)return {key:'diver',index:0};
  if(sprite>=22&&sprite<=25)return {key:'folklore',index:sprite-22};
  if(sprite>=26&&sprite<=29)return {key:['hahoe','femaleidol','dokkaebi','kongjwi'][sprite-26],index:0};
  return {key:'characters',index:sprite>=0&&sprite<=15?sprite:0};
}

export function wandererPose(dir=0,state='walk',frame=0){
  const direction=((Math.trunc(dir)%4)+4)%4;
  const column=state==='sit'?4:((Math.trunc(frame)%4)+4)%4;
  return ASSET_MANIFEST.wandererDirectional.poses[direction*5+column];
}

export function seatedNeighborPose(actor,dir=0){
  const definition=seatedActors.find(a=>typeof actor==='number'?a.sprite===actor:a.id===actor);
  if(!definition)return null;
  const direction=Number.isFinite(dir)?((Math.trunc(dir)%4)+4)%4:0;
  return ASSET_MANIFEST.seatedNeighbors.poses[definition.row*4+direction];
}

export function seatedOfficePose(dir=0){
  const direction=Number.isFinite(dir)?((Math.trunc(dir)%4)+4)%4:0;
  return ASSET_MANIFEST.seatedOffice.poses[direction];
}
