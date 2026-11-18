import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
const out=process.env.HIRE_OUTPUT||'artifacts/hire-scroll',base=process.env.BASE_URL||'http://127.0.0.1:5173';
await fs.mkdir(out,{recursive:true});const results=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();
 try{for(const viewport of [{width:844,height:390},{width:568,height:320},{width:568,height:240},{width:1280,height:800}]){
  console.log(name,viewport);const page=await browser.newPage({viewport,hasTouch:true});await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.pause();const first=g.state.waiters[0];g.state.waiters=Array.from({length:8},(_,i)=>({...first,uid:'scroll-test-'+i,appearance:i,name:'직원 '+(i+1)}));g.open('hire');});
  const list=page.locator('.staff-list'),box=await list.boundingBox();assert.ok(box.height>30,'Employee list must retain visible room');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.wheel(0,3000);
  await page.waitForFunction(()=>document.querySelector('.staff-list').scrollTop>0);
  const values=await page.evaluate(()=>{const list=document.querySelector('.staff-list'),dialog=document.querySelector('dialog'),button=document.querySelector('[data-act="hire-now"]'),close=dialog.querySelector('.close-button'),last=list.lastElementChild;const b=button.getBoundingClientRect(),c=close.getBoundingClientRect(),l=last.getBoundingClientRect(),r=list.getBoundingClientRect();return{scrollTop:list.scrollTop,scrollHeight:list.scrollHeight,clientHeight:list.clientHeight,lastBottom:l.bottom,listBottom:r.bottom,buttonTop:b.top,buttonBottom:b.bottom,closeTop:c.top,closeBottom:c.bottom,viewportHeight:innerHeight,dialogScrollTop:dialog.scrollTop};});
  assert.ok(values.scrollTop>0);assert.ok(values.buttonTop>=0&&values.buttonBottom<=viewport.height,'Hire button must remain visible');assert.ok(values.closeTop>=0&&values.closeBottom<=viewport.height,'Close button must remain visible');
  await list.evaluate(e=>{e.scrollTop=e.scrollHeight;window.__staffListBefore=e;});await page.waitForTimeout(1100);
  assert.ok(await list.evaluate(e=>e===window.__staffListBefore&&e.scrollTop>0),'Periodic updates must preserve scroll and the list DOM');
  assert.ok(await page.locator('.staff-card').last().evaluate(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return r.bottom<=p.bottom+1;}),'Last employee must be reachable');
  await page.screenshot({path:`${out}/${name}-${viewport.width}x${viewport.height}.png`});results.push({browser:name,viewport,...values,passed:true});await page.close();
 }}finally{await browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} employee scroll cases passed.`);
