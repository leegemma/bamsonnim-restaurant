import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCamera,cameraTransform,sceneToScreen,screenToScene,clientToScreen,clampCamera,zoomCameraAt,panCameraBy,resizeCamera,visibleSceneRect,backgroundCopies,wheelZoomFactor} from '../src/camera.js';
import {RestaurantView} from '../src/render.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),view={width:844,height:302},bounds={x:-1000,y:-1000,width:2844,height:2302};

test('the default camera preserves coordinates and every zoom/pan projection has an exact inverse',()=>{
 assert.deepEqual(createCamera(),{zoom:1,panX:0,panY:0});assert.deepEqual(cameraTransform(createCamera(),view),{zoom:1,x:0,y:0});
 for(const zoom of [.7,1,1.8])for(const p of [{x:0,y:0},{x:422,y:151},{x:-51,y:820}]){const c={zoom,panX:81,panY:-29},back=screenToScene(sceneToScreen(p,c,view),c,view);near(back.x,p.x);near(back.y,p.y);}
});

test('wheel and button zoom keep the pointed scene position fixed and obey the original zoom limits',()=>{
 const c={zoom:1,panX:15,panY:-8},anchor={x:137,y:199},before=screenToScene(anchor,c,view),next=zoomCameraAt(c,1.5,anchor,view,bounds),after=screenToScene(anchor,next,view);near(before.x,after.x);near(before.y,after.y);assert.equal(next.zoom,1.5);assert.equal(zoomCameraAt(c,100,anchor,view,bounds).zoom,1.8);assert.equal(zoomCameraAt(c,.001,anchor,view,bounds).zoom,.7);
 near(wheelZoomFactor(2000),Math.exp(-.15));near(wheelZoomFactor(-2000),Math.exp(.15));near(wheelZoomFactor(2,1),Math.exp(-32*.0015));
});

test('pan clamps keep the view center near the actual room, even on small edit layouts',()=>{
 for(const room of [{x:180,y:-40,width:450,height:370},{x:120,y:-140,width:360,height:220}]){assert.deepEqual(clampCamera(createCamera(),view,room),createCamera());for(const delta of [-1e8,1e8]){const c=panCameraBy({zoom:1.8,panX:0,panY:0},delta,delta,view,room),center=screenToScene({x:422,y:151},c,view);assert.ok(center.x>=Math.min(422,room.x)&&center.x<=Math.max(422,room.x+room.width));assert.ok(center.y>=Math.min(151,room.y)&&center.y<=Math.max(151,room.y+room.height));}}
 assert.deepEqual(clampCamera({zoom:NaN,panX:Infinity,panY:NaN},view),createCamera());
});

test('CSS scaling and DPR do not alter input coordinates, and resizing preserves normalized pan',()=>{
 assert.deepEqual(clientToScreen({clientX:261,clientY:105.5},{left:50,top:30,width:422,height:151},view),{x:422,y:151});
 const before={zoom:1.4,panX:50,panY:-20},after={width:568,height:152},resized=resizeCamera(before,view,after);near(resized.panX/after.width,before.panX/view.width);near(resized.panY/after.height,before.panY/view.height);assert.equal(resized.zoom,before.zoom);
});

test('reflected background margins cover every visible screen pixel without changing the default cover draw',()=>{
 const image={width:1670,height:941},base=backgroundCopies(image,view,createCamera());assert.equal(base.length,1);near(base[0].width,844);assert.equal(base[0].flipX,false);assert.equal(base[0].flipY,false);
 for(const zoom of [.7,1,1.8])for(const direction of [-1,0,1]){const camera=panCameraBy({zoom,panX:0,panY:0},direction*1e6,-direction*1e6,view),tiles=backgroundCopies(image,view,camera),visible=visibleSceneRect(camera,view);assert.ok(tiles.length<=9);for(let x=0;x<=8;x++)for(let y=0;y<=8;y++){const p={x:visible.x+visible.width*x/8,y:visible.y+visible.height*y/8};assert.ok(tiles.some(t=>p.x>=t.x-1e-7&&p.x<=t.x+t.width+1e-7&&p.y>=t.y-1e-7&&p.y<=t.y+t.height+1e-7),'no uncovered background margin');}}
});

test('room tiles and furniture placement invert correctly at every zoom for sizes eight, fifteen and sixteen',()=>{
 for(const n of [8,15,16])for(const height of [152,302,631])for(const edit of [false,true]){const width=568,available=height-(edit?150:0),tile=Math.max(22,Math.min(83,(width-165)/n,available<400?(available-30)/(n*.5+1.5):(available-155)/(n/2))),v={origin:{x:width*.57,y:(available-n*tile/2)/2+(available<400?tile*.6:58)},tile};
  for(const zoom of [.7,1,1.8])for(const [x,y]of [[0,0],[n-1,n-1],[2,5]]){const scene=RestaurantView.prototype.world.call(v,x,y),camera={zoom,panX:65,panY:-31},p=screenToScene(sceneToScreen(scene,camera,{width,height}),camera,{width,height});assert.deepEqual(RestaurantView.prototype.grid.call(v,p.x,p.y),{x,y});}
 }
});

test('transformed taps select logical stove hits and short editor taps use the correct grid',()=>{
 const selected=[],placed=[],v={origin:{x:400,y:40},tile:50,hits:[{kind:'stove',uid:'pot',x:300,y:100,w:60,h:32}],onSelect:h=>selected.push(h.uid),onTile:p=>placed.push(p),grid:RestaurantView.prototype.grid,hitAt:RestaurantView.prototype.hitAt};
 const c={zoom:1.8,panX:53,panY:-17},screen=sceneToScreen({x:330,y:116},c,view),p=screenToScene(screen,c,view);RestaurantView.prototype.tapAt.call(v,p);assert.deepEqual(selected,['pot']);v.edit={ghost:{type:'chair'}};const floor=RestaurantView.prototype.world.call(v,3,4),at=screenToScene(sceneToScreen(floor,c,view),c,view);RestaurantView.prototype.tapAt.call(v,at);assert.deepEqual(placed,[{x:3,y:4}]);v.gestures={input:{active:true}};RestaurantView.prototype.tapAt.call(v,at);assert.equal(placed.length,1);
});
