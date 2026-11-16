import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {chromium,webkit} from 'playwright';import {BOOKS,RECIPES} from '../src/data.js';
const base=process.env.BASE_URL||'http://127.0.0.1:5181',prefix=new URL(base).pathname.replace(/\/$/,''),out=process.env.COVERS_OUTPUT||'artifacts/cookbook-covers';await fs.mkdir(out,{recursive:true});const results=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){const browser=await type.launch();try{for(const viewport of [{width:1280,height:800},{width:844,height:390},{width:568,height:320}]){
 console.log(name,viewport);const p=await browser.newPage({viewport,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await p.evaluate(()=>{window.__BAMSONNIM__.pause();window.__BAMSONNIM__.open('cookbook');});assert.equal(await p.locator('.book-lock').count(),3);await p.locator('.book-cover-card.locked').first().click();assert.equal(await p.locator('[data-act="book-open"]').count(),5);assert.match(await p.locator('.toast').last().textContent(),/레시피 레벨/);await p.screenshot({path:`${out}/${name}-${viewport.width}-locked.png`});await p.evaluate(recipes=>{const g=window.__BAMSONNIM__;g.pause();g.state.level=30;g.state.mastery=Object.fromEntries(recipes.map(r=>[r.id,r.milestones.at(-1)]));g.state.events.christmas='active';g.open('cookbook');},RECIPES);
 const seen=[];
 for(let page=0;page<3;page++){
  assert.equal(await p.locator('.book-lock').count(),0);const indexes=await p.locator('[data-act="book-open"]').evaluateAll(cards=>cards.map(c=>Number(c.dataset.n)));assert.equal(indexes.length,page===2?1:5);
  await p.locator('.book-cover-image').evaluateAll(images=>Promise.all(images.map(im=>im.decode())));
  const images=await p.locator('[data-act="book-open"]').evaluateAll(cards=>cards.map(c=>{const im=c.querySelector('img');return{index:Number(c.dataset.n),src:im.getAttribute('src'),width:im.naturalWidth,height:im.naturalHeight};}));
  for(const im of images){assert.equal(im.src,prefix+BOOKS[im.index].cover);assert.equal(im.width,1086);assert.equal(im.height,1448);seen.push(im);}
  await p.screenshot({path:`${out}/${name}-${viewport.width}-page${page+1}.png`});
  for(const i of indexes){await p.locator(`[data-act="book-open"][data-n="${i}"]`).click();assert.equal((await p.locator('.book-toolbar strong').textContent()).trim(),BOOKS[i].name);await p.locator('[data-act="book-back"]').click();}
  if(page<2)await p.locator('[data-act="book-shelf-page"][data-n="1"]').click();
 }
 assert.deepEqual(seen.map(im=>im.index),BOOKS.map((_,i)=>i));assert.deepEqual(errors,[]);results.push({browser:name,viewport,covers:seen,opened:seen.length,passed:true});await p.close();
}}finally{await browser.close();}}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} cookbook cover/page cases passed; all 11 covers decoded and books opened in each.`);
