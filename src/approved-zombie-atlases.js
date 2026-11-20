// These three atlases contain the reviewed final canvases, not raw generated
// poses. Never trim, repair, re-register heads/arms, or split their fixed props.
const directions=[
 {id:'se',row:0,index:0,vector:[1,0],screen:'SE'},
 {id:'sw',row:1,index:1,vector:[0,1],screen:'SW'},
 {id:'nw',row:2,index:2,vector:[-1,0],screen:'NW'},
 {id:'ne',row:3,index:3,vector:[0,-1],screen:'NE'},
];
export const APPROVED_ZOMBIE_ACTORS=[
 {actorId:'nz-baduk-player',originId:'extra-zombie-050',name:'남자 바둑기사',sprite:34,referenceHeight:235},
 {actorId:'nz-golf-man',originId:'zombie-concept-001',name:'골프좀비',sprite:35,referenceHeight:213},
 {actorId:'nz-futsal-man',originId:'zombie-concept-002',name:'풋살좀비',sprite:36,referenceHeight:216},
];
function atlas(actor,eating=false){
 const cols=eating?2:4,rows=4,key=`approved-${actor.actorId}-${eating?'eating':'walk-sit'}`;
 const poses=Array.from({length:cols*rows},(_,index)=>{
  const row=Math.floor(index/cols),column=index%cols,state=eating?'eat':column===3?'sit':'walk';
  return {index,row,column,dir:row,direction:directions[row].id,state,frame:eating?column+1:state==='sit'?0:column,
   source:{x:column*280,y:row*300,width:280,height:300},
   anchor:{x:140,y:280},...(state!=='walk'?{hip:{x:140,y:220}}:{})};
 });
 return {key,actorId:actor.actorId,name:actor.name,url:`/assets/zombies/approved-three/${actor.actorId}/${eating?'eating':'walk-sit'}.png`,
  type:eating?'eating-atlas':'directional-atlas',width:cols*280,height:1200,cols,rows,
  grid:{x:0,y:0,cols,rows,cellWidth:280,cellHeight:300},cell:{width:280,height:300},
  anchor:{x:140,y:280},referenceHeight:actor.referenceHeight,trim:false,preRegistered:true,mirror:false,directions,poses,
  ...(eating?{baseAtlas:`approved-${actor.actorId}-walk-sit`,fps:5,sequence:[0,1,2]}:
   {walkFrames:3,frames:{walk:[0,1,2],sit:3,idle:0},fps:7,sequence:[0,1,0,2]})};
}
export const APPROVED_ZOMBIE_ATLASES=APPROVED_ZOMBIE_ACTORS.map(a=>atlas(a));
export const APPROVED_EATING_ATLASES=APPROVED_ZOMBIE_ACTORS.map(a=>atlas(a,true));
export const APPROVED_ZOMBIE_PORTRAITS=APPROVED_ZOMBIE_ACTORS.map(a=>({
 key:`approved-${a.actorId}-portrait`,actorId:a.actorId,name:a.name,
 url:`/assets/zombies/approved-three/${a.actorId}/portrait.png`,type:'sprite',
 width:1024,height:1536,cols:1,rows:1,trim:false,preRegistered:true,
 grid:{x:0,y:0,cols:1,rows:1,cellWidth:1024,cellHeight:1536},
}));
