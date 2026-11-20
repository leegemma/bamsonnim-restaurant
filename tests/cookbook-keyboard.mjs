import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {RECIPES,BOOKS} from '../src/data.js';

for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{for(const viewport of [{width:1280,height:800},{width:568,height:320}]){
  const page=await browser.newPage({viewport}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:5197',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  await page.evaluate(recipes=>{const g=window.__BAMSONNIM__;g.pause();g.state.mastery=Object.fromEntries(recipes.map(r=>[r.id,r.milestones.at(-1)]));g.state.events.christmas='active';},RECIPES);
  await page.locator('.right-rail [data-act="cookbook"]').focus();await page.keyboard.press('Enter');await page.locator('.book-shelf-grid').waitFor();
  const labels=new Map();
  async function checkLabels(){
   for(const card of await page.locator('[data-act="book-open"]').all()){
    const index=Number(await card.getAttribute('data-n')),label=await card.getAttribute('aria-label'),count=RECIPES.filter(r=>r.book===index).length;
    if(count)assert.ok(label.includes(`${count}가지 요리`));else{assert.match(label,/잠김 · 준비 중/);assert.equal(await card.isDisabled(),true);}if(BOOKS[index].event)assert.ok(label.includes('성탄 한정'));
    const snapshot=await card.ariaSnapshot();assert.ok(snapshot.includes(count?`${count}가지 요리`:'준비 중'));labels.set(index,label);
   }
  }
  await checkLabels();const initialScroll=await page.locator('#dialog').evaluate(d=>d.scrollTop);
  await page.locator('[data-act="book-shelf-page"][data-n="1"]').focus();
  for(const [firstIndex,direction] of [[5,1],[10,-1],[5,-1],[0,1]]){
   await page.keyboard.press('Enter');await page.waitForFunction(index=>Number(document.querySelector('[data-act="book-open"]').dataset.n)===index,firstIndex);
   const focus=await page.evaluate(()=>({act:document.activeElement.dataset.act,n:Number(document.activeElement.dataset.n),disabled:document.activeElement.disabled}));
   assert.deepEqual(focus,{act:'book-shelf-page',n:direction,disabled:false});assert.equal(await page.locator('#dialog').evaluate(d=>d.scrollTop),initialScroll);await checkLabels();
  }
  assert.equal(labels.size,BOOKS.length);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal(await page.evaluate(()=>document.activeElement.dataset.act),'cookbook');
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.state.mastery={};g.open('cookbook');});
  for(const card of await page.locator('.book-cover-card.locked').all())assert.match(await card.getAttribute('aria-label'),await card.isDisabled()?/잠김 · 준비 중/:/잠김 · 레시피 레벨 \d+ 필요/);
  const season=page.locator('[data-act="book-open"]').filter({has:page.locator('.book-season')});assert.ok((await season.getAttribute('aria-label')).includes('성탄 한정'));
  assert.deepEqual(errors,[]);console.log(JSON.stringify({browser:name,viewport,books:labels.size,keyboard:'next/next edge/back/back edge; focus retained and no scroll jump PASS',labels:[...labels],pageErrors:errors}));await page.close();
 }}finally{await browser.close();}
}
