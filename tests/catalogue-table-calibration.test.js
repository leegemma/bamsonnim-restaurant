import {test} from 'node:test';
import assert from 'node:assert/strict';
import {furniture} from '../src/data.js';
import {CATALOGUE_ENTRIES} from '../src/catalogue-expansion.js';
import {furnitureArt,placedFurniture} from '../src/furniture-placement.js';
import {furnitureFootprint} from '../src/furniture-footprint.js';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const sides=g=>g.meta.surfacePolygon.map((p,i,a)=>distance(p,a[(i+1)%4])*g.scale);
const mean=a=>a.reduce((sum,x)=>sum+x,0)/a.length;
test('all ten new tabletops share the basic world side or usable round diameter, retaining native proportions',()=>{
 const base=placedFurniture(furnitureArt('table',0,'table'),null,{x:0,y:0},100),side=mean(sides(base));
 for(const e of CATALOGUE_ENTRIES.filter(e=>e.category==='table'))for(let dir=0;dir<4;dir++){
  const art=furnitureArt('table',dir,e.id),g=placedFurniture(art,null,{x:0,y:0},100);
  assert.ok(Math.abs(g.w/g.h-art.width/art.height)<1e-8);
  if(art.surfaceEllipse){
   const {rx,ry}=art.surfaceEllipse,major=side*Math.sqrt(.5)/Math.hypot(.5,.25);
   assert.ok(Math.abs(2*rx*g.scale-major)<1e-8,e.id);
   assert.ok(Math.abs(2*ry*g.scale-major/2)<(e.id==='table-aluminum-floral-soban'?4:1.1),`${e.id} projected circle`);
  }else{
   const lengths=sides(g).sort((a,b)=>a-b),wide=e.id==='table-bbq-wood-wide';
   assert.ok(Math.abs(mean(wide?lengths.slice(0,2):lengths)-side)<1e-8,e.id);
   if(wide)assert.ok(Math.abs(mean(lengths.slice(2))/side-2)<.06);
   for(let i=0;i<4;i++){const p=art.surfacePolygon[i],q=art.surfacePolygon[(i+1)%4];assert.ok(Math.abs(Math.abs((q[1]-p[1])/(q[0]-p[0]))-.5)<.075,`${e.id} grid angle`);}
  }
  assert.ok(Math.abs(-g.surface.y+base.surface.y)<5.5,`${e.id} actual floor to tabletop height`);
 }
});
test('table artwork calibration preserves one-customer capacity and logical footprint in every direction',()=>{
 for(const e of CATALOGUE_ENTRIES.filter(e=>e.category==='table'))for(let dir=0;dir<4;dir++){
  assert.equal(furniture(e.id).seatCapacity,1);
  assert.deepEqual(furnitureFootprint({type:e.id,dir}),e.id==='table-bbq-wood-wide'?(dir%2?{width:1,height:2}:{width:2,height:1}):{width:1,height:1});
 }
});
