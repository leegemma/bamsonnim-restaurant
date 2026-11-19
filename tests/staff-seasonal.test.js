import {test} from 'node:test';
import assert from 'node:assert/strict';
import {STAFF_HAT_ANCHORS,staffChristmasActive,staffHatGeometry,drawStaffSantaHat} from '../src/staff-seasonal.js';

const placement={x:20,y:60,width:40,height:60};
const context=()=>({calls:[],save(){this.calls.push('save');},restore(){this.calls.push('restore');},translate(){},scale(){},fillRect(...args){this.calls.push(args);}});
test('only the explicit active Christmas event enables the cosmetic hat',()=>{
 for(const christmas of ['upcoming','ended',undefined]){const state={events:{christmas}},ctx=context();assert.equal(staffChristmasActive(state),false);assert.equal(drawStaffSantaHat(ctx,state,placement),null);assert.deepEqual(ctx.calls,[]);}
 assert.equal(staffChristmasActive({events:{christmas:'active'}}),true);
});
test('all eight crown anchors draw a cap above the face without mutating staff or placement',()=>{
 assert.equal(STAFF_HAT_ANCHORS.length,8);const state={events:{christmas:'active'},waiters:[{uid:'same',infectedUntil:300,task:{kind:'serve'}}]},before=structuredClone(state),p=structuredClone(placement);
 for(let appearance=0;appearance<8;appearance++){const ctx=context(),hat=drawStaffSantaHat(ctx,state,placement,appearance);assert.ok(ctx.calls.length>100);assert.equal(ctx.calls[0],'save');assert.equal(ctx.calls.at(-1),'restore');assert.ok(hat.w>0&&hat.h>0);assert.ok(hat.bottom<=placement.y+placement.height*.04);assert.ok(hat.y<placement.y);}
 assert.deepEqual(state,before);assert.deepEqual(placement,p);
});
test('hat geometry mirrors around the sprite center and scales with employee art',()=>{
 for(let appearance=0;appearance<8;appearance++){const a=staffHatGeometry(placement,appearance),b=staffHatGeometry({...placement,flip:true},appearance);assert.ok(Math.abs((a.x+b.x+b.w)-(2*placement.x+placement.width))<1e-9);assert.equal(a.y,b.y);assert.equal(a.w,b.w);const twice=staffHatGeometry({x:40,y:120,width:80,height:120},appearance);for(const key of ['x','y','w','h'])assert.ok(Math.abs(twice[key]-2*a[key])<1e-9);}
});
