import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backgroundFrame,backgroundFxGeometry} from '../src/background-fx.js';
import {BACKGROUND_SCENE} from '../src/background-fx.generated.js';
import {RestaurantView} from '../src/render.js';

test('fire alternates two drawings while a corpse rests between brief twitches',()=>{
 assert.deepEqual([0,.25,.5,.75].map(t=>backgroundFrame('fire',t)),[0,1,0,1]);
 for(const t of [0,1,3,5,6.7,7,10])assert.equal(backgroundFrame('corpse',t),0);
 assert.equal(backgroundFrame('corpse',6.03),1);assert.equal(backgroundFrame('corpse',6.16),0);
 for(const kind of ['fire','corpse']){assert.equal(backgroundFrame(kind,6.03,{reducedMotion:true}),0);assert.equal(backgroundFrame(kind,NaN),0);assert.equal(backgroundFrame(kind,6.03),backgroundFrame(kind,6.03));}
});

test('effects follow the background cover crop and keep the same ground anchor across drawings',()=>{
 const bg={width:1671,height:941},view={width:844,height:302},place={x:1500,y:480,width:100},image={width:200,height:180},pose={anchor:{x:100,y:170}},r=backgroundFxGeometry(bg,view,place,image,pose),scale=844/1671;
 assert.ok(Math.abs((r.x+r.width*.5)-place.x*scale)<1e-8);
 assert.ok(Math.abs((r.y+r.height*170/180)-((302-941*scale)/2+place.y*scale))<1e-8);
 const second=backgroundFxGeometry(bg,view,place,{width:200,height:200},{anchor:{x:100,y:190}});
 assert.ok(Math.abs((second.y+second.height*190/200)-(r.y+r.height*170/180))<1e-8);
});

test('narrow scenery moves only the minimum distance left of the HUD while staying outside the room',()=>{
 const bg=BACKGROUND_SCENE.base;
 for(const height of [232,152])for(const placement of BACKGROUND_SCENE.placements){
  const meta=BACKGROUND_SCENE.assets.find(a=>a.key===placement.key),image=meta.poses[0].source,view={width:568,height},original=backgroundFxGeometry(bg,view,placement,image,meta.poses[0]),bounds=backgroundFxGeometry(bg,view,placement,image,meta.poses[0],{right:508}),tile=Math.max(22,Math.min(83,(568-165)/8,(height-30)/(8*.5+1.5))),roomRight=568*.57+8*tile/2;
  assert.ok(bounds.x+bounds.width<=508+1e-8);assert.ok(bounds.x>=roomRight,'all sprite pixels remain outside the room');assert.equal(bounds.x,Math.min(original.x,508-original.width));assert.deepEqual([bounds.y,bounds.width,bounds.height],[original.y,original.width,original.height]);
  const second=backgroundFxGeometry(bg,view,placement,meta.poses[1].source,meta.poses[1],{right:508});assert.deepEqual(second,bounds,'both drawings retain their common anchor');
 }
});

test('a scenery rectangle already outside the HUD remains unchanged',()=>{
 const bg={width:1000,height:600},view={width:844,height:302},placement={x:700,y:400,width:50},image={width:100,height:120},pose={anchor:{x:50,y:110}},original=backgroundFxGeometry(bg,view,placement,image,pose);
 assert.deepEqual(backgroundFxGeometry(bg,view,placement,image,pose,{right:800}),original);assert.deepEqual(backgroundFxGeometry(bg,view,placement,image,pose,{right:Infinity}),original);
});

test('HUD geometry is measured in canvas coordinates once and never read during scenery drawing',()=>{
 const previous=globalThis.window;let railReads=0,canvasReads=0,draws=0;const rect={left:20,width:568,height:232},rail={getBoundingClientRect(){railReads++;return{left:534,width:44};}},ctx={setTransform(){},drawImage(){draws++;}},canvas={getBoundingClientRect(){canvasReads++;return rect;},parentElement:{querySelector(){return rail;}}},view={canvas,ctx,motionPreference:{matches:false},sprites:Object.fromEntries(BACKGROUND_SCENE.assets.map(a=>[a.key,a.poses.map(p=>({width:p.source.width,height:p.source.height}))]))};
 try{globalThis.window={innerWidth:568,innerHeight:320,devicePixelRatio:2};RestaurantView.prototype.measure.call(view);assert.deepEqual(view.backgroundFxClip,{right:508});assert.equal(canvas.width,1136);assert.equal(canvas.height,464);
  for(const time of [0,.25,6.03])RestaurantView.prototype.drawBackgroundEffects.call(view,{time},BACKGROUND_SCENE.base);assert.equal(draws,6);assert.equal(canvasReads,1);assert.equal(railReads,1);
  window.innerWidth=844;window.innerHeight=390;rect.width=844;rect.height=302;RestaurantView.prototype.measure.call(view);assert.equal(view.backgroundFxClip,undefined);assert.equal(railReads,1,'wide layouts keep their original placement without a HUD query');
 }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
