import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gameplayTile,gameplayCameraLimits,sceneToScreen,screenToScene,clampCamera,zoomCameraAt,resizeCamera} from '../src/camera.js';
import {createCameraGestures} from '../src/camera-gestures.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('adaptive maximum reaches the same target tile across expansions, within hard limits',()=>{
 for(const viewport of [{width:874,height:298},{width:844,height:286},{width:568,height:216},{width:1280,height:649},{width:300,height:100}])for(const size of [8,16]){
  const tile=gameplayTile(viewport,size),limits=gameplayCameraLimits(viewport,size),target=Math.max(70,Math.min(140,Math.min(viewport.width,viewport.height)*.28));
  assert.equal(limits.minZoom,.7);assert.ok(limits.maxZoom>=1.4&&limits.maxZoom<=3.2);
  near(limits.maxZoom,Math.max(1.4,Math.min(3.2,target/tile)));
  if(limits.maxZoom>1.4&&limits.maxZoom<3.2)near(tile*limits.maxZoom,target);
  assert.equal(clampCamera({zoom:1.4,panX:0,panY:0},viewport,undefined,limits).zoom,1.4);
 }
 assert.equal(gameplayTile({width:568,height:100},16),22);
});

test('adaptive projection, pointer anchoring and resize retain zooms above the generic default',()=>{
 const viewport={width:844,height:286},limits=gameplayCameraLimits(viewport,16),bounds={x:-2000,y:-2000,width:5000,height:5000},camera={zoom:2.5,panX:42,panY:-20},point={x:280,y:80};
 const back=screenToScene(sceneToScreen(point,camera,viewport,limits),camera,viewport,limits);near(back.x,point.x);near(back.y,point.y);
 const anchored=zoomCameraAt(camera,100,point,viewport,bounds,limits);near(anchored.zoom,limits.maxZoom);const a=screenToScene(point,camera,viewport,limits),b=screenToScene(point,anchored,viewport,limits);near(a.x,b.x);near(a.y,b.y);
 const next={width:1280,height:649},nextLimits=gameplayCameraLimits(next,8),resized=resizeCamera(camera,viewport,next,bounds,nextLimits);near(resized.zoom,nextLimits.maxZoom);assert.ok(Number.isFinite(resized.panX));
 assert.equal(zoomCameraAt(camera,100,point,viewport,bounds).zoom,1.8,'generic callers keep their existing cap');
});

test('pinch, wheel and pan share the live adaptive limit, including a limit change mid gesture',()=>{
 let camera={zoom:1.4,panX:0,panY:0},limits={minZoom:.7,maxZoom:3.2};const viewport={width:844,height:286},bounds={x:-2000,y:-2000,width:5000,height:5000};
 const g=createCameraGestures({getCamera:()=>camera,setCamera:c=>camera=c,getViewport:()=>viewport,getBounds:()=>bounds,getLimits:()=>limits});
 const p=(id,x)=>({id,x,y:140,button:0,buttons:1,pointerType:'touch'});
 g.down(p(1,200));g.down(p(2,300));g.move(p(2,420));near(camera.zoom,3.08);g.move(p(2,700));near(camera.zoom,3.2);g.up(p(2,700));g.move(p(1,210));near(camera.zoom,3.2);g.cancel();
 g.wheel(-100,{x:400,y:140});near(camera.zoom,3.2);limits={minZoom:.7,maxZoom:2.1};g.wheel(-100,{x:400,y:140});near(camera.zoom,2.1);for(let i=0;i<20;i++)g.wheel(100,{x:400,y:140});near(camera.zoom,.7);
});
