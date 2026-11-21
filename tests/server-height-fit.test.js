import{test}from'node:test';import assert from'node:assert/strict';import{furnitureArt,placedFurniture}from'../src/furniture-placement.js';import{furnitureFootprint}from'../src/furniture-footprint.js';import{RestaurantView}from'../src/render.js';
test('metal cart carries the same food at the actual default counter height in every direction',()=>{
 for(const tile of[80,160])for(let dir=0;dir<4;dir++){
  const origin={x:200,y:300},defaultArt=furnitureArt('server',dir,'server'),cartArt=furnitureArt('server',dir,'serving-cart-stainless'),normal=placedFurniture(defaultArt,null,origin,tile,dir%2===1),cart=placedFurniture(cartArt,null,origin,tile);
  const view={tile,world:()=>origin,sprites:{},furnitureGeometry:o=>o.type==='server'?normal:cart};
  const a=RestaurantView.prototype.serverFoodLayout.call(view,{type:'server',foodId:'rice'}),b=RestaurantView.prototype.serverFoodLayout.call(view,{type:'serving-cart-stainless',foodId:'rice'});
  assert.ok(Math.abs(a.surface.y-b.surface.y)<1e-10);assert.ok(Math.abs(a.y-b.y)<1e-10);assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  assert.deepEqual(furnitureFootprint({type:'serving-cart-stainless',dir}),{width:1,height:1});
 }
});

test('shorter robot preserves native scale, ground and tray contact without compensating its height',()=>{
 const tile=160,ground={x:200,y:300},oldScale=tile*.7845547675334909/510;
 for(let dir=0;dir<4;dir++){
  const art=furnitureArt('server',dir,'serving-robot'),g=placedFurniture(art,null,ground,tile,dir%2===1);
  assert.ok(Math.abs(g.scale-oldScale)<1e-12);assert.ok(g.h/(1035*oldScale)>.89&&g.h/(1035*oldScale)<.92);
  assert.ok(g.w/(494*oldScale)>.99&&g.w/(494*oldScale)<1.01);
  assert.ok(Math.abs(ground.y-g.surface.y-466*oldScale)<1e-10);
  assert.deepEqual(art.source,{x:373,y:219,width:496,height:942});
  assert.deepEqual(furnitureFootprint({type:'serving-robot',dir}),{width:1,height:1});
 }
});
