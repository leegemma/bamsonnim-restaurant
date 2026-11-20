import {najeonShape} from './najeon-layout.js';
import {furniture} from './data.js';

// The saved x/y is always the leading corner; odd rotations swap the sides.
// Existing furniture has the same single-cell occupancy as before.
export function furnitureFootprint(object){const najeon=najeonShape(object);if(najeon)return najeon;if(furniture(object.type)?.wallMounted)return{width:0,height:0};const base=furniture(object.type)?.occupancy||[1,1],odd=(object.dir||0)%2;return{width:base[odd?1:0],height:base[odd?0:1]};}
export function furnitureCells(object){const {width,height}=furnitureFootprint(object),cells=[];for(let y=0;y<height;y++)for(let x=0;x<width;x++)cells.push([object.x+x,object.y+y]);return cells;}
export function furnitureOccupies(object,x,y){const {width,height}=furnitureFootprint(object);return x>=object.x&&x<object.x+width&&y>=object.y&&y<object.y+height;}

// Legacy posters used the back boundary y=0 before the left boundary x=0.
// New corner attachments use their direction to distinguish both wall slots.
export function wallAttachment(object,{legacy=false}={}){
 const explicit=['north','west'].includes(object.wallSide)&&Number.isInteger(object.wallSlot),side=explicit?object.wallSide:object.x===0&&object.y===0&&!legacy?(object.dir%2?'west':'north'):object.y===0?'north':object.x===0?'west':object.x<=object.y?'west':'north',slot=explicit?object.wallSlot:side==='north'?object.x:object.y;
 return{wallSide:side,wallSlot:slot,x:side==='north'?slot:0,y:side==='west'?slot:0,dir:side==='west'?1:0};
}
export function wallSlotKey(object,options){const a=wallAttachment(object,options);return`${a.wallSide}:${a.wallSlot}`;}

export function wallOccupiedSlots(object,options){const attachment=wallAttachment(object,options),span=furniture(object.type)?.wallSpan||1;return Array.from({length:span},(_,i)=>({...attachment,wallSlot:attachment.wallSlot+i,key:`${attachment.wallSide}:${attachment.wallSlot+i}`}));}
