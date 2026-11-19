import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const results=[],out=process.env.TUTORIAL_OUTPUT||'/Users/leesb/Downloads/12-claud project/zombie/artifacts/mayor-tutorial-qa';
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();try{for(const viewport of [{width:1280,height:800},{width:568,height:320}])for(const pageIndex of [0,1]){
  const p=await browser.newPage({viewport,hasTouch:viewport.width===568});await p.goto(process.env.BASE_URL||'http://127.0.0.1:5297');await p.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  for(let i=0;i<3;i++)await p.locator('.tutorial-next').click();await p.waitForFunction(()=>window.__BAMSONNIM__.state.guidedTutorial.step==='stove');await p.locator('.tutorial-next').click();await p.locator('#dialog.cookbook[open] .book-reader').waitFor();
  if(pageIndex){await p.locator('[data-act="book-page"][data-n="1"]').click();await p.locator('[data-act="cook"][data-id="rice"]').waitFor({state:'detached'});}
  await p.locator('.tutorial-skip').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>window.__BAMSONNIM__.state.guidedTutorial.step==='skipped');
  const focus=await p.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect(),d=document.querySelector('#dialog');return {inside:d.contains(el),visible:r.width>=44&&r.height>=44&&r.top>=0&&r.bottom<=innerHeight,close:el.classList.contains('close-button'),dialog:d.open};});assert.deepEqual(focus,{inside:true,visible:true,close:true,dialog:true});assert.equal(await p.locator('.tutorial-recipe-target').count(),0);
  const direction=pageIndex?-1:1;await p.locator(`[data-act="book-page"][data-n="${direction}"]`).click();if(pageIndex)await p.locator('[data-act="cook"][data-id="rice"]').waitFor({state:'attached'});else await p.locator('[data-act="cook"][data-id="rice"]').waitFor({state:'detached'});
  await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.querySelector('#dialog').open);assert.equal(await p.locator('.mayor-tutorial').isVisible(),false);results.push({browser:name,viewport,pageIndex,skipFocusVisibleInsideDialog:true,bookNavigationAfterSkip:true});await p.close();
 }}finally{await browser.close();}
}
await fs.mkdir(out,{recursive:true});await fs.writeFile(`${out}/book-skip-focus.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
