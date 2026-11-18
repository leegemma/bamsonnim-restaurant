import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.THUMB_OUTPUT||'artifacts/furniture-thumbnails',base=process.env.BASE_URL||'http://127.0.0.1:5173';await fs.mkdir(output,{recursive:true});const browser=await chromium.launch(),results=[];
try{
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:touch?{width:844,height:390}:{width:1280,height:800},hasTouch:touch}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const activate=async locator=>touch?locator.tap():locator.click();
  await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__,v=g.view;g.pause();Object.assign(g.state,{objects:[],waiters:[],customers:[],coins:10000,level:30,storage:['stove','server']});window.__furnitureCalls=[];const object=v.drawObject,sprite=v.sprite;v.drawObject=function(s,o,...args){this.__qaObject=o;try{return object.call(this,s,o,...args);}finally{this.__qaObject=null;}};v.sprite=function(key,index,x,y,w,h,options){const o=this.__qaObject;if(o&&['stove','server'].includes(o.type)){const entry={type:o.type,uid:o.uid,key,index,w,h,flip:options?.flip,sourceWidth:this.sprites[key]?.[index]?.width,sourceHeight:this.sprites[key]?.[index]?.height};const signature=JSON.stringify(entry);if(!window.__furnitureCalls.some(c=>JSON.stringify(c)===signature))window.__furnitureCalls.push(entry);}return sprite.call(this,key,index,x,y,w,h,options);};});
  const thumbs=[];
  async function inspect(where,type){
   const art=await page.evaluate(async type=>(await import('/src/furniture-placement.js')).furnitureArt(type),type),key=art.key,index=art.index,selector=`${where==='gallery'?'#dialog':'#shop-dock'} [data-furniture-key="${key}"][data-furniture-index="${index}"]`;
   const result=await page.locator(selector).evaluate((canvas,{where,key,index})=>{const image=window.__BAMSONNIM__.view.sprites[key][index],expected=document.createElement('canvas');expected.width=160;expected.height=160;const ctx=expected.getContext('2d'),scale=Math.min(148/image.width,148/image.height);ctx.imageSmoothingEnabled=false;ctx.drawImage(image,(160-image.width*scale)/2,(160-image.height*scale)/2,image.width*scale,image.height*scale);const pixels=canvas.getContext('2d').getImageData(0,0,160,160).data;let opaque=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>80)opaque++;return{where,key,index,sourceWidth:image.width,sourceHeight:image.height,matchesTrimmedImage:canvas.toDataURL()===expected.toDataURL(),opaque};},{where,key,index});
   assert.equal(result.matchesTrimmedImage,true);assert.ok(result.opaque>100);thumbs.push(result);await page.locator(selector).screenshot({path:`${output}/${touch?'touch':'mouse'}-${where}-${type}.png`});
  }
  await activate(page.locator('[data-act="decorate"]'));
  for(const [i,type]of ['stove','server'].entries()){
   await activate(page.locator(`[data-act="shop-tab"][data-id="${type}"]`));await inspect('shop',type);await activate(page.locator(`[data-act="buy-furniture"][data-id="${type}"]`));
   await page.waitForFunction(type=>window.__furnitureCalls.some(c=>c.type===type&&c.uid==='ghost'),type);await page.screenshot({path:`${output}/${touch?'touch':'mouse'}-ghost-${type}.png`});
   if(!await page.locator('#keyboard-placement').evaluate(d=>d.open))await activate(page.locator('#keyboard-placement summary'));
   await page.locator('[data-coordinate="x"]').fill(String(3+i));await page.locator('[data-coordinate="y"]').fill('4');await activate(page.locator('[data-act="place"]'));
   await page.waitForFunction(type=>window.__BAMSONNIM__.state.objects.some(o=>o.type===type),type);
   await page.screenshot({path:`${output}/${touch?'touch':'mouse'}-placed-${type}.png`});
  }
  await activate(page.locator('[data-act="shop-tab"][data-id="storage"]'));for(const type of ['stove','server'])await inspect('storage',type);
  await activate(page.locator('[data-act="finish-edit"]'));await activate(page.locator('[data-act="debug"]'));await activate(page.locator('[data-act="gallery"]'));for(const type of ['stove','server'])await inspect('gallery',type);
  const calls=await page.evaluate(()=>window.__furnitureCalls);for(const type of ['stove','server']){const entries=calls.filter(c=>c.type===type);assert.ok(entries.some(c=>c.uid==='ghost'));assert.ok(entries.some(c=>c.uid!=='ghost'));for(const c of entries){const expected=thumbs.find(t=>t.where==='shop'&&t.key===c.key);assert.ok(expected);assert.equal(c.index,expected.index);assert.ok(Math.abs(c.w/c.h-c.sourceWidth/c.sourceHeight)<1e-6);}}
  assert.deepEqual(errors,[]);results.push({touch,thumbs,calls,errors});await context.close();
 }
 await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:true,scope:'Fresh fixtures and real input: shop, storage, gallery, ghost and placed renderer image identity; perspective art correctness is separate.',results},null,2));console.log(JSON.stringify({passed:true,contexts:results.length,thumbnailComparisons:results.reduce((n,r)=>n+r.thumbs.length,0)}));
}finally{await browser.close();}
