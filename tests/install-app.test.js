import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isStandalone,fullscreenAvailable,requestFullscreen} from '../src/install-app.js';

test('standalone detection uses display mode and the native standalone flag without browser-name assumptions',()=>{
 assert.equal(isStandalone({}),false);assert.equal(isStandalone({navigator:{standalone:true}}),true);
 assert.equal(isStandalone({matchMedia:query=>({matches:query==='(display-mode: standalone)'})}),true);
 assert.equal(isStandalone({navigator:{userAgent:'Safari iPhone'},matchMedia:()=>({matches:false})}),false);
});

test('fullscreen requests require capability and an active gesture and report real API rejection',async()=>{
 assert.equal(fullscreenAvailable({}),false);assert.equal(await requestFullscreen({},{}),false);let calls=0;
 const doc={fullscreenEnabled:true,documentElement:{async requestFullscreen(){calls++;throw new Error('NotAllowedError');}}};
 assert.equal(fullscreenAvailable(doc),true);assert.equal(await requestFullscreen(doc,{userActivation:{isActive:false}}),false);assert.equal(calls,0);
 assert.equal(await requestFullscreen(doc,{userActivation:{isActive:true}}),false);assert.equal(calls,1);
 doc.fullscreenEnabled=false;assert.equal(fullscreenAvailable(doc),false);assert.equal(await requestFullscreen(doc,{}),false);
});

test('standard and vendor fullscreen APIs succeed only after the document actually enters fullscreen',async()=>{
 const doc={documentElement:{async requestFullscreen(){doc.fullscreenElement=this;}}};assert.equal(await requestFullscreen(doc,{}),true);
 const vendor={webkitFullscreenEnabled:true,documentElement:{webkitRequestFullscreen(){vendor.webkitFullscreenElement=this;}}};assert.equal(fullscreenAvailable(vendor),true);assert.equal(await requestFullscreen(vendor,{}),true);
 const ineffective={documentElement:{async requestFullscreen(){}}};assert.equal(await requestFullscreen(ineffective,{}),false);
});

test('the local manifest starts the existing Korean restaurant in standalone mode with opaque app icons',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
 assert.equal(manifest.name,'밤손님 식당');assert.equal(manifest.display,'standalone');assert.equal(manifest.orientation,'landscape');assert.equal(manifest.start_url,'/');assert.equal(manifest.scope,'/');
 assert.deepEqual(manifest.icons.filter(icon=>icon.purpose==='any').map(icon=>icon.sizes),['192x192','512x512']);
 assert.deepEqual(manifest.icons.filter(icon=>icon.purpose==='maskable').map(icon=>icon.sizes),['512x512']);
 for(const icon of manifest.icons)assert.ok(icon.src.startsWith('/icons/'));
});
