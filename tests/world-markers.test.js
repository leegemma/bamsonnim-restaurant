import {test} from 'node:test';
import assert from 'node:assert/strict';
import {worldMarkerMetrics,cureMarkerHit,pickCureMarker} from '../src/world-markers.js';

test('world markers apply zoom once and keep screen typography bounded across rooms and cameras',()=>{
 for(const tile of [22,35,60,83])for(const zoom of [.7,1,1.55,1.8,3.2]){
  const m=worldMarkerMetrics(tile,zoom);assert.ok(m.fontSize*zoom>=8-1e-8&&m.fontSize*zoom<=12+1e-8);assert.ok(m.height*zoom>=12-1e-8&&m.height*zoom<=20+1e-8);
  assert.ok(m.padding*zoom>=3-1e-8&&m.padding*zoom<=5+1e-8);assert.ok(m.icon*zoom<=14+1e-8);assert.ok(m.pixel*zoom<=1+1e-8);
  if(zoom>=1.55)assert.ok(m.height*zoom<24*zoom,'compact markers are smaller than old fixed scene boxes');
 }
 assert.ok(worldMarkerMetrics(22,1).height<worldMarkerMetrics(83,1).height);
});

test('compact cure badges retain a usable screen target and overlapping targets select the visible employee',()=>{
 for(const zoom of [.7,1,1.8,3.2]){
  const a=cureMarkerHit('a',{x:100,y:100,w:18/zoom,h:12/zoom},zoom),b=cureMarkerHit('b',{x:100+20/zoom,y:100,w:18/zoom,h:12/zoom},zoom);
  assert.ok(a.w*zoom>=28-1e-8&&a.h*zoom>=28-1e-8);
  for(const hits of [[a,b],[b,a]])for(const h of [a,b])assert.equal(pickCureMarker(hits,{x:h.badge.x+h.badge.w/2,y:h.badge.y+h.badge.h/2}).uid,h.uid);
  assert.equal(pickCureMarker([a,b],{x:0,y:0}),null);
 }
});
