import {test}from'node:test';import assert from'node:assert/strict';import{CATALOGUE_ENTRIES}from'../src/catalogue-expansion.js';import{CATALOGUE_ASSETS}from'../src/catalogue-art.js';import{ASSET_MANIFEST}from'../src/assets.js';import{furnitureArt,placedFurniture}from'../src/furniture-placement.js';import{floorSheetBoundaries,floorSheetSegments}from'../src/surface-textures.js';import{containsHit}from'../src/hit-testing.js';import{sceneToScreen,screenToScene}from'../src/camera.js';
test('new art is lazy, item-specific, and never replaces legacy category lookup',()=>{
 assert.equal(CATALOGUE_ASSETS.length,CATALOGUE_ENTRIES.length);assert.ok(CATALOGUE_ASSETS.every(a=>a.lazy&&a.trim===false));for(const e of CATALOGUE_ENTRIES){assert.equal(ASSET_MANIFEST[e.artKey].url,'/assets/'+e.asset);if(['wall','floor'].includes(e.category))continue;for(const dir of [0,1,2,3]){const art=furnitureArt(e.category,dir,e.id);assert.equal(art.key,e.artKey);assert.equal(art.itemId,e.id);assert.ok(art.width>0&&art.height>0&&art.groundWidth>0);const placed=placedFurniture(art,{width:art.width,height:art.height},{x:300,y:200},80,!!art.mirrorOdd&&dir%2===1);for(const key of ['x','y','w','h'])assert.ok(Number.isFinite(placed[key]));if(e.category==='chair')assert.ok(placed.seat&&art.front.length>=3);}}
 for(const cat of ['chair','table','server','stove'])assert.ok(!furnitureArt(cat,0).itemId);
});
test('vinyl seams only follow every third world-cell boundary, invariant under camera projection',()=>{
 assert.deepEqual(floorSheetBoundaries(8,3),[3,6]);assert.deepEqual(floorSheetBoundaries(16,3),[3,6,9,12,15]);assert.deepEqual(floorSheetBoundaries(8,undefined),[]);
 const edges=floorSheetSegments(8,3);assert.equal(edges.length,4);assert.ok(edges.every(e=>[3,6].includes(e.edge)));assert.ok(!edges.some(e=>[1,2,4,5,7].includes(e.edge)));
 const viewport={width:874,height:358},limits={minZoom:.7,maxZoom:3.2};for(const zoom of [.7,1.55,3.2])for(const panX of [-90,0,210])for(const edge of edges){const point={x:400+(edge.from.x-edge.from.y)*20,y:70+(edge.from.x+edge.from.y)*10},camera={zoom,panX,panY:40},back=screenToScene(sceneToScreen(point,camera,viewport,limits),camera,viewport,limits);assert.ok(Math.abs(back.x-point.x)<1e-7&&Math.abs(back.y-point.y)<1e-7);}
});
test('wall hit geometry follows the projected artwork plane and transparent areas pass through',()=>{
 const hit={x:100,y:60,w:20,h:50,wall:{x:100,y:100,width:20,height:40,slope:.5},mask:{width:2,height:2,alpha:new Uint8Array([255,0,0,255])}};
 assert.equal(containsHit(hit,{x:105,y:72.5}),true);assert.equal(containsHit(hit,{x:115,y:77.5}),false);assert.equal(containsHit(hit,{x:115,y:97.5}),true);assert.equal(containsHit(hit,{x:105,y:105}),false);
});
