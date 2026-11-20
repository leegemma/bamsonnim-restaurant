import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CATALOGUE_ENTRIES} from '../src/catalogue-expansion.js';
import {furnitureArt,placedFurniture} from '../src/furniture-placement.js';
import {furnitureFootprint} from '../src/furniture-footprint.js';
// World widths before the rejected whole-chair shrink, measured at tile100.
const originalWidths={
 'chair-plastic-blue':57.446808510638306,'chair-shell-white':56.52173913043478,
 'chair-dining-black':57.608695652173914,'chair-camping-khaki':57.608695652173914,
 'chair-christmas-velvet':57.608695652173914,'stool-plastic-blue':51.06382978723405,
 'stool-plastic-red':51.06382978723405,'stool-log':50,'sofa-dabang-single':68.08510638297872,
};
test('all nine single chairs retain original body widths, native proportions and one-cell footprints in every view and zoom',()=>{
 for(const [id,width]of Object.entries(originalWidths))for(let dir=0;dir<4;dir++)for(const tile of [22,80,160]){
  const art=furnitureArt('chair',dir,id),point={x:200,y:300},g=placedFurniture(art,null,point,tile);
  assert.ok(Math.abs(g.w/tile*100-width)<1e-8,`${id} dir${dir} width`);
  assert.ok(Math.abs(g.w/g.h-art.width/art.height)<1e-8);
  assert.ok(Math.abs(g.x+g.w*art.groundCenter.x/art.width-point.x)<1e-8);
  assert.ok(Math.abs(g.y+g.h*art.groundCenter.y/art.height-point.y)<1e-8);
  assert.ok(g.seat.y<point.y);assert.deepEqual(furnitureFootprint({type:id,dir}),{width:1,height:1});
 }
});
test('single sofa keeps its original artwork; the other eight chairs use the supplied shorter legs or trunk',()=>{
 for(const e of CATALOGUE_ENTRIES.filter(e=>e.id in originalWidths)){
  assert.match(e.asset,e.id==='sofa-dabang-single'?/-v1\.png$/:/-(shortlegs|shortbody)-v\d\.png$/);
 }
});

test('shortened artwork keeps real seat heights near the basic chair without shrinking body widths',()=>{
 for(const id of Object.keys(originalWidths))for(let dir=0;dir<4;dir++){
  const g=placedFurniture(furnitureArt('chair',dir,id),null,{x:0,y:0},100),ref=placedFurniture(furnitureArt('chair',dir,'chair'),null,{x:0,y:0},100);
  // Red plastic retains its thicker molded seat and a slightly taller leg body.
  assert.ok(Math.abs(g.seat.y-ref.seat.y)<(id==='stool-plastic-red'?6.1:4.5),id+' dir'+dir);
 }
});
