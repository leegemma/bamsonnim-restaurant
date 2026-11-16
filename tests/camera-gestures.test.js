import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCamera,sceneToScreen,screenToScene} from '../src/camera.js';
import {createCameraGestures,bindCameraGestures} from '../src/camera-gestures.js';
const p=(id,x,y,more={})=>({id,x,y,button:0,buttons:1,pointerType:'touch',...more});
const sameCamera=(a,b)=>{for(const key of ['zoom','panX','panY'])assert.ok(Math.abs(a[key]-b[key])<1e-8,`${key} jumped`);};
function rig(){let camera=createCamera(),time=1000;const taps=[],hover=[],changes=[],viewport={width:844,height:302},bounds={x:-1000,y:-1000,width:2844,height:2302},options={getCamera:()=>camera,setCamera:c=>{camera=c;changes.push(c);},getViewport:()=>viewport,getBounds:()=>bounds,onTap:q=>taps.push(q),onHover:q=>hover.push(q),now:()=>time},input=createCameraGestures(options);return{input,options,taps,hover,changes,viewport,get camera(){return camera;},tick:n=>time+=n};}

test('short taps keep the eight-pixel threshold, while drags never tap or move an editor ghost',()=>{
 const r=rig(),g=r.input;g.move(p(9,10,10,{buttons:0,pointerType:'mouse'}));assert.equal(r.hover.length,1);g.down(p(1,100,100));g.move(p(1,104,104));assert.equal(r.changes.length,0);assert.equal(r.hover.length,1);g.up(p(1,104,104));assert.equal(r.taps.length,1);assert.equal(g.click({detail:1}),false);assert.equal(g.click({detail:0}),true);
 g.down(p(2,100,100));g.move(p(2,109,100));assert.equal(r.camera.panX,9);g.move(p(2,100,100));g.up(p(2,100,100));assert.equal(r.taps.length,1);assert.equal(g.click({detail:0}),false);assert.equal(r.hover.length,1);g.down(p(3,10,10));g.up(p(3,10,10));assert.equal(r.taps.length,2);
});

test('pinch uses distance ratio and moving centroid, then one remaining finger continues without a jump or tap',()=>{
 const r=rig(),g=r.input;g.down(p(1,200,100));g.down(p(2,400,100));const anchor=screenToScene({x:300,y:100},r.camera,r.viewport);g.move(p(2,500,100));assert.equal(r.camera.zoom,1.5);const projected=sceneToScreen(anchor,r.camera,r.viewport);assert.ok(Math.abs(projected.x-350)<1e-8);assert.ok(Math.abs(projected.y-100)<1e-8);g.up(p(2,500,100));const before={...r.camera};g.move(p(1,220,100));assert.equal(r.camera.zoom,before.zoom);assert.equal(r.camera.panX,before.panX+20);g.up(p(1,220,100));assert.equal(r.taps.length,0);assert.equal(r.hover.length,0);assert.equal(g.click({detail:0}),false);
});

test('third pointers cannot change the active pinch, and switching the pair rebases safely',()=>{
 const r=rig(),g=r.input;g.down(p(1,200,100));g.down(p(2,400,100));g.move(p(2,500,100));const before={...r.camera};g.down(p(3,600,200));g.move(p(3,700,200));assert.deepEqual(r.camera,before);g.up(p(1,200,100));assert.deepEqual(r.camera,before);g.move(p(2,500,100));sameCamera(r.camera,before);g.move(p(3,730,200));assert.ok(Number.isFinite(r.camera.zoom));for(const q of [p(2,500,100),p(3,730,200)])g.up(q);assert.equal(r.taps.length,0);
});

test('zero-distance pinches, cancellation, stale moves and stale releases do not jump or activate anything',()=>{
 const r=rig(),g=r.input;g.down(p(1,300,100));g.down(p(2,300,100));g.move(p(2,301,100));assert.deepEqual(r.camera,createCamera());g.move(p(2,302,100));assert.equal(r.camera.zoom,1.8);g.cancel();g.move(p(1,500,200));g.up(p(1,500,200));assert.equal(r.taps.length,0);assert.equal(r.hover.length,0);assert.equal(g.active,false);assert.equal(g.click({detail:0}),false);r.tick(701);assert.equal(g.click({detail:0}),true);
});

test('cancelled pinch members let remaining fingers pan without an accidental selection',()=>{
 const r=rig(),g=r.input;g.down(p(1,100,100));g.down(p(2,200,100));g.cancelPointer(p(2,200,100));g.move(p(1,120,100));assert.equal(r.camera.panX,20);g.up(p(1,120,100));assert.equal(r.taps.length,0);assert.equal(g.click({detail:1}),false);
});

test('wheel zoom is pointer-centered, clamped and leaves independent keyboard activation available',()=>{
 const r=rig(),g=r.input,anchor={x:200,y:100},scene=screenToScene(anchor,r.camera,r.viewport);g.wheel(-100,anchor);const after=sceneToScreen(scene,r.camera,r.viewport);assert.ok(Math.abs(after.x-anchor.x)<1e-8);assert.ok(Math.abs(after.y-anchor.y)<1e-8);assert.equal(g.click({detail:0}),true);for(let i=0;i<30;i++)g.wheel(-100,anchor);assert.equal(r.camera.zoom,1.8);for(let i=0;i<30;i++)g.wheel(100,anchor);assert.equal(r.camera.zoom,.7);assert.equal(r.taps.length,0);
});

class Canvas extends EventTarget{
 constructor(){super();this.ownerDocument={defaultView:new EventTarget()};this.captured=new Set();}
 focus(){this.focused=true;}
 setPointerCapture(id){this.captured.add(id);}
 hasPointerCapture(id){return this.captured.has(id);}
 releasePointerCapture(id){this.captured.delete(id);this.emit('lostpointercapture',{pointerId:id});}
 emit(type,fields={}){const e=new Event(type,{cancelable:true});for(const [k,v]of Object.entries(fields))Object.defineProperty(e,k,{value:v});this.dispatchEvent(e);return e;}
}
test('DOM binding captures pointers, suppresses compatibility clicks, and permits independent detail-zero activation',()=>{
 const r=rig(),canvas=new Canvas(),bound=bindCameraGestures(canvas,{...r.options,toScreen:e=>({x:e.clientX||0,y:e.clientY||0})}),fields={pointerId:1,button:0,buttons:1,pointerType:'mouse',clientX:100,clientY:100};canvas.emit('click',{detail:0,clientX:70,clientY:80});assert.equal(r.taps.length,1);canvas.emit('pointerdown',fields);assert.equal(canvas.focused,true);assert.equal(canvas.captured.has(1),true);canvas.emit('pointerup',{...fields,buttons:0});assert.equal(r.taps.length,2);assert.equal(canvas.captured.size,0);canvas.emit('click',{detail:1});assert.equal(r.taps.length,2);canvas.emit('click',{detail:0,clientX:200,clientY:100});assert.equal(r.taps.length,3);
 canvas.emit('pointerdown',fields);canvas.emit('pointermove',{...fields,clientX:130});canvas.emit('lostpointercapture',fields);canvas.emit('pointerup',fields);canvas.emit('click',{detail:0});assert.equal(r.taps.length,3);assert.equal(bound.input.active,false);bound.destroy();canvas.emit('click',{detail:0});assert.equal(r.taps.length,3);
});

test('pointer cancellation and window blur release captured inputs without selecting or hovering',()=>{
 const r=rig(),canvas=new Canvas(),bound=bindCameraGestures(canvas,{...r.options,toScreen:e=>({x:e.clientX||0,y:e.clientY||0})}),fields={pointerId:1,button:0,buttons:1,pointerType:'touch',clientX:100,clientY:100};canvas.emit('pointerdown',fields);canvas.emit('pointercancel',fields);assert.equal(canvas.captured.size,0);canvas.emit('pointerup',fields);canvas.emit('click',{detail:0});assert.equal(r.taps.length,0);canvas.emit('pointerdown',fields);canvas.ownerDocument.defaultView.dispatchEvent(new Event('blur'));assert.equal(canvas.captured.size,0);assert.equal(bound.input.active,false);assert.equal(r.taps.length,0);bound.destroy();
});
