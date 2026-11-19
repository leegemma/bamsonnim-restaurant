import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {christmasActive,seasonalBackdrop} from '../src/seasonal-scene.js';
import {ASSET_MANIFEST} from '../src/assets.js';

test('winter artwork is optional, lazy and matches its actual source dimensions',async()=>{
 const meta=ASSET_MANIFEST.nightWinter,png=await readFile(new URL('../public/assets/night-ruins-winter-v1.png',import.meta.url));
 assert.equal(meta.type,'background');assert.equal(meta.lazy,true);assert.equal(meta.trim,false);
 assert.deepEqual([meta.width,meta.height],[png.readUInt32BE(16),png.readUInt32BE(20)]);
});
test('active season selects winter without mutating state or replacing the original image',()=>{
 const normal={},winter={},images=Object.freeze({night:normal,nightWinter:winter}),state=Object.freeze({events:Object.freeze({christmas:'active'})});
 const chosen=seasonalBackdrop(state,images);assert.equal(christmasActive(state),true);assert.equal(chosen.image,winter);assert.equal(chosen.key,'nightWinter');assert.equal(chosen.fireflies,false);assert.equal(chosen.normalFx,false);assert.equal(images.night,normal);
 for(const christmas of ['upcoming','ended',undefined]){const result=seasonalBackdrop({events:{christmas}},images);assert.equal(result.image,normal);assert.equal(result.normalFx,true);assert.equal(result.fireflies,true);}
});
test('missing or failed seasonal artwork uses the existing background and existing effects',()=>{
 const night={},state={events:{christmas:'active'}},result=seasonalBackdrop(state,{night});
 assert.equal(result.image,night);assert.equal(result.key,'night');assert.equal(result.fallback,true);assert.equal(result.normalFx,true);assert.equal(result.fireflies,true);
 assert.equal(seasonalBackdrop(state).image,null);
});
