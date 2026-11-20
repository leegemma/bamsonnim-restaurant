import {furniture} from './data.js';

const offsets=[[[0,0],[0,1]],[[1,0],[0,0]],[[0,1],[0,0]],[[0,0],[1,0]]];
export const newSeatStates=()=>[{dirty:false},{dirty:false}];
export function seatSlots(object){
 if(furniture(object?.type)?.category!=='chair')return[];
 if(furniture(object.type).seatCount!==2)return[object];
 return offsets[object.dir||0].map(([dx,dy],seatIndex)=>{
  const slot={uid:`${object.uid}::seat:${seatIndex}`,type:object.type,x:object.x+dx,y:object.y+dy,dir:object.dir,seatIndex,seatObject:object};
  for(const key of ['dirty','cleaner'])Object.defineProperty(slot,key,{enumerable:true,get:()=>object.seatStates?.[seatIndex]?.[key]??(key==='dirty'?false:undefined),set:value=>{object.seatStates??=newSeatStates();object.seatStates[seatIndex][key]=value;}});
  return slot;
 });
}
export const allSeatSlots=state=>state.objects.flatMap(seatSlots);
export const resolveSeat=(state,uid)=>typeof uid==='string'?allSeatSlots(state).find(slot=>slot.uid===uid)||null:null;
