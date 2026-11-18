import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const baseURL=process.env.BASE_URL||'http://127.0.0.1:5173';
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(baseURL);
  await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  const before=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__;g.pause();
   Object.assign(g.state,g.engine.newGame());
   Object.assign(g.state.objects.find(o=>o.type==='server'),{foodId:'rice',stock:1000});
   for(let i=0;i<1600;i++){
    g.engine.advance(g.state,.25);
    if(g.state.customers.some(c=>c.phase==='eating')&&g.state.waiters.some(w=>w.task?.kind==='serve'))break;
   }
   if(!g.state.customers.some(c=>c.phase==='eating')||!g.state.waiters.some(w=>w.task?.kind==='serve'))throw new Error('Fixture requires an eating guest and an active serving assignment');
   window.editorCustomersBefore={customers:[...g.state.customers],waiters:[...g.state.waiters]};
   const snapshot=structuredClone(g.state);delete snapshot.savedAt;return snapshot;
  });
  async function assertPreserved(label){
   const actual=await page.evaluate(()=>{
    const s=window.__BAMSONNIM__.state,refs=window.editorCustomersBefore;
    const snapshot=structuredClone(s);delete snapshot.savedAt;
    return {snapshot,sameCustomers:refs.customers.length===s.customers.length&&refs.customers.every((c,i)=>c===s.customers[i]),sameWaiters:refs.waiters.every((w,i)=>w===s.waiters[i])};
   });
   assert.deepEqual(actual.snapshot,before,`${name}: ${label} preserves customer state, seats, food and waiter assignments`);
   assert.equal(actual.sameCustomers,true,`${name}: ${label} preserves customer object identities`);
   assert.equal(actual.sameWaiters,true,`${name}: ${label} preserves waiter object identities`);
  }
  for(const exit of ['toggle','finish','escape','cancel-then-escape','toggle','finish']){
   await page.locator('[data-act="decorate"]').click();
   await page.waitForFunction(()=>!!window.__BAMSONNIM__.edit);
   await assertPreserved(`enter before ${exit}`);
   // Leave the global pause off: editing itself must stop simulation updates.
   await page.evaluate(async()=>{
    window.__BAMSONNIM__.pause(false);
    for(let i=0;i<8;i++)await new Promise(requestAnimationFrame);
    window.__BAMSONNIM__.pause();
   });
   await assertPreserved(`editing before ${exit}`);
   if(exit==='cancel-then-escape'){
    await page.locator('[data-act="buy-furniture"][data-id="table"]').click();
    await page.locator('#world').focus();await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!!window.__BAMSONNIM__.edit&&!window.__BAMSONNIM__.edit.ghost);
    await assertPreserved('cancel unplaced furniture');
   }
   if(exit==='escape'||exit==='cancel-then-escape'){
    await page.locator('#world').focus();await page.keyboard.press('Escape');
   }else await page.locator(`[data-act="${exit==='toggle'?'decorate':'finish-edit'}"]`).click();
   await page.waitForFunction(()=>window.__BAMSONNIM__.edit===null);
   await assertPreserved(`exit via ${exit}`);
  }
  await page.evaluate(()=>window.__BAMSONNIM__.pause(false));
  await page.waitForFunction(time=>window.__BAMSONNIM__.state.time>time,before.time);
  await page.waitForFunction(({served,sold})=>{
   const s=window.__BAMSONNIM__.state;return s.stats.served>served&&s.stats.sold>sold;
  },before.stats,{timeout:30000});
  assert.deepEqual(errors,[]);
  console.log(`${name}: 6 edit cycles preserve identities/state/assignments; edit pauses and service resumes (PASS)`);
 }finally{await browser.close();}
}
