import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ASSET_MANIFEST} from '../src/assets.js';
import {ZOMBIES} from '../src/data.js';
import {atlasForActor,frameForPose,getCoverage} from '../src/atlas-preview.js';

function atlas(count=4){return{key:`fixture-${count}`,frames:{walk:Array.from({length:count},(_,i)=>i),sit:count,idle:0},poses:Array.from({length:4*(count+1)},(_,index)=>({index,dir:Math.floor(index/(count+1)),state:index%(count+1)===count?'sit':'walk'}))};}

test('three-, four- and eight-frame atlases select every direction and their separate seated column',()=>{
 for(const count of [3,4,8]){const meta=atlas(count);for(let dir=0;dir<4;dir++){for(let frame=0;frame<count;frame++)assert.equal(frameForPose(meta,dir,'walk',frame),dir*(count+1)+frame);assert.equal(frameForPose(meta,dir,'sit',99),dir*(count+1)+count);assert.equal(frameForPose(meta,dir,'idle'),dir*(count+1));}assert.equal(frameForPose(meta,-1,'walk',count+1),3*(count+1)+1);}
});

test('missing metadata and missing poses stay missing instead of borrowing a different drawing',()=>{
 assert.equal(atlasForActor('not-a-registered-guest'),null);assert.equal(atlasForActor(null),null);assert.equal(frameForPose(null),null);
 const meta=atlas();meta.poses.splice(4,1);assert.equal(frameForPose(meta,0,'sit'),null);assert.equal(frameForPose(meta,0,'unknown'),null);assert.equal(frameForPose(meta,'not-a-direction'),null);
});

test('coverage distinguishes a complete directional actor, legacy sit-only art, and an unregistered actor',()=>{
 const meta=atlas(),result=getCoverage([{id:'wanderer'},{id:'student'},{id:'missing'},{id:'event-guest',event:'christmas'}],{resolveAtlas:id=>id==='wanderer'?meta:null,manifest:ASSET_MANIFEST});
 assert.equal(result.total,3);assert.equal(result.walking,1);assert.equal(result.sitting,2);assert.equal(result.complete,1);
 assert.deepEqual(result.missingWalk,['student','missing']);assert.deepEqual(result.missingSit,['missing']);assert.deepEqual(result.unregistered,['student','missing']);
 assert.equal(result.entries[1].sitOnly,true);assert.equal(result.entries[1].sitKey,'seatedNeighbors');assert.equal(result.entries[1].walkKey,null);
});

test('incomplete atlas registration does not count as completed four-direction coverage',()=>{
 const meta=atlas(8);meta.poses=meta.poses.filter(p=>p.index!==35&&p.index!==2);
 const result=getCoverage(['partial'],{resolveAtlas:()=>meta,manifest:{}});assert.equal(result.walking,0);assert.equal(result.sitting,0);assert.equal(result.complete,0);assert.deepEqual(result.unregistered,[]);assert.equal(result.entries[0].walkPoses,31);assert.equal(result.entries[0].sitPoses,3);
});

test('the general roster reports all 32 IDs with no borrowed completion for unknown IDs',()=>{
 const result=getCoverage(ZOMBIES);assert.equal(result.total,32);assert.equal(result.entries.length,32);assert.ok(result.entries.find(e=>e.id==='wanderer').complete);
 assert.equal(result.walking+result.missingWalk.length,32);assert.equal(result.sitting+result.missingSit.length,32);
 const unknown=getCoverage(['still-generating']);assert.equal(unknown.complete,0);assert.deepEqual(unknown.unregistered,['still-generating']);
});
