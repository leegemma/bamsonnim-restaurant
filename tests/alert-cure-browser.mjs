import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const baseURL=process.env.BASE_URL||'http://127.0.0.1:5197';
const results=[];
async function refresh(page){await page.evaluate(()=>window.__BAMSONNIM__.advance(0));}
async function reset(page){
 await page.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state;g.pause();s.spawnIn=1e9;s.coins=500;s.level=1;s.tutorial=3;s.time=0;s.dailyClaim='';s.customers=[];s.notifications=[];for(const w of s.waiters)w.infectedUntil=0;g.advance(0);});
}
async function bite(page){
 const uid=await page.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state,w=s.waiters[0];Object.assign(w,{x:3,y:3,path:[],task:null,infectedUntil:0});s.customers=[{uid:'browser-biter',zombieId:'red',red:true,x:3,y:4,path:[],phase:'chasing',seat:null,wait:0,chaseTime:0,target:w.uid}];g.advance(.25);return w.uid;});
 await page.locator(`[data-staff-uid="${uid}"] [data-act="cure"]`).waitFor();
 assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.notifications.findLast(n=>n.type==='danger').staffUid),uid);
 return uid;
}
const cure=(page,uid)=>page.locator(`#toasts [data-staff-uid="${uid}"] [data-act="cure"]`);
try{
 for(const viewport of [{width:1280,height:800},{width:874,height:402},{width:844,height:390},{width:568,height:320}]){
  console.log('checking viewport',JSON.stringify(viewport));
  const context=await browser.newContext({viewport,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await reset(page);const uid=await bite(page);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state;s.time=20;s.customers=Array.from({length:6},(_,i)=>({uid:`blocked-${i}`,zombieId:'wanderer',x:7,y:7,phase:'leaving',leavingAt:0,wait:0,path:[],seat:null}));g.engine.notify(s,'일반 알림이 감염 알림 위에 표시돼요. 긴 안내도 끝까지 스크롤할 수 있어야 해요. '.repeat(12));g.advance(0);});
  await page.locator('#toasts .toast.info').waitFor({timeout:10000}).catch(async error=>{console.log('notice timeout',await page.evaluate(()=>({notifications:window.__BAMSONNIM__.state.notifications,toasts:document.querySelector('#toasts').innerHTML,hidden:document.hidden})));throw error;});await page.locator('#traffic-notice').waitFor({state:'visible'});
  const bounds=await page.evaluate(()=>{const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return{x:x.x,y:x.y,bottom:x.bottom,right:x.right,width:x.width,height:x.height};};return{rail:r('#notification-rail'),traffic:r('#traffic-notice'),normal:r('#toasts .toast.info'),bite:r('#toasts .toast.danger'),buttons:r('.bottom-actions')};});
  for(const key of ['traffic','normal','bite']){assert.equal(bounds[key].x,bounds.rail.x);assert.equal(bounds[key].width,bounds.rail.width);assert.equal(bounds[key].height,48);}
  assert.ok(bounds.rail.width<=440);assert.ok(bounds.traffic.bottom<=bounds.normal.y);assert.ok(bounds.normal.bottom<=bounds.bite.y);assert.ok(bounds.rail.bottom<bounds.buttons.y);assert.ok(bounds.rail.y>=0);
  const longMessage=page.locator('#toasts .toast.info .notice-message');await page.waitForFunction(()=>document.querySelector('#toasts .toast.info .notice-message').tabIndex===0);
  assert.equal(await longMessage.evaluate(e=>e.scrollHeight>e.clientHeight),true);assert.equal(await page.locator('#toasts .toast.info .notice-scroll-cue').isVisible(),true);
  await longMessage.focus();await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('#toasts .toast.info .notice-message').scrollTop>0);
  const gap={x:bounds.rail.x+200,y:bounds.traffic.bottom+3};assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('#notification-rail')===null,gap),true);
  if(process.env.ALERT_SCREENSHOT&&viewport.width===568)await page.screenshot({path:process.env.ALERT_SCREENSHOT});
  await cure(page,uid).click();assert.equal(await page.locator('#dialog-title').textContent(),'치료하시겠습니까?');assert.equal(await page.locator('[data-act="confirm"]').textContent(),'예(25원)');assert.equal(await page.locator('.confirm-buttons [data-act="close"]').textContent(),'아니요');assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),500);
  await page.locator('.confirm-buttons [data-act="close"]').click();assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),500);
  await cure(page,uid).click();await page.locator('.close-button').click();assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),500);
  await cure(page,uid).click();await page.locator('[data-act="confirm"]').click();assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),475);assert.equal(await page.locator(`[data-staff-uid="${uid}"]`).count(),0);assert.equal(await page.locator('#dialog').evaluate(d=>d.open),false);
  await page.locator('.bottom-actions [data-act="menu"]').click();assert.ok(await page.locator('#dialog').evaluate(d=>d.open));await page.locator('.close-button').click();

  await page.evaluate(()=>window.__BAMSONNIM__.open('hearts'));
  await page.locator('#dialog [data-act="daily"]').click();await page.locator('#dialog [data-act="daily"]').click();await page.locator('#dialog [data-act="daily"]').click();await page.locator('.close-button').click();
  const daily=page.locator('#toasts .toast.danger').filter({hasText:'오늘의 선물은 이미 받았어요.'});assert.equal(await daily.count(),2);
  await daily.first().evaluate(e=>{window.__dailyAlert=e;});await page.waitForTimeout(600);assert.equal(await daily.first().evaluate(e=>e===window.__dailyAlert),true);
  const target=await daily.first().locator('button').boundingBox();assert.ok(target.width>=44&&target.height>=44);await daily.first().locator('button').tap();assert.equal(await daily.count(),1);await daily.first().locator('button').tap();assert.equal(await daily.count(),0);
  await page.evaluate(()=>window.__BAMSONNIM__.view.commitCamera({zoom:1.5,panX:0,panY:0}));const pan=await page.evaluate(()=>window.__BAMSONNIM__.view.camera.panX);
  const floor={x:viewport.width-80,y:viewport.height-100};await page.mouse.move(floor.x,floor.y);await page.mouse.down();await page.mouse.move(floor.x-30,floor.y-12,{steps:8});await page.mouse.up();assert.notEqual(await page.evaluate(()=>window.__BAMSONNIM__.view.camera.panX),pan);
  if(viewport.width===1280){
   await reset(page);await bite(page);await page.waitForFunction(uid=>window.__BAMSONNIM__.view.hits.some(h=>h.kind==='cure'&&h.uid===uid),uid);const marker=await page.evaluate(uid=>{const v=window.__BAMSONNIM__.view,h=v.hits.find(h=>h.kind==='cure'&&h.uid===uid),b=h.badge||h;return v.sceneToScreen({x:b.x+b.w/2,y:b.y+b.h/2});},uid);const canvas=await page.locator('#world').boundingBox();await page.mouse.click(canvas.x+marker.x,canvas.y+marker.y);assert.equal(await page.locator('#dialog-title').textContent(),'치료하시겠습니까?');await page.locator('.confirm-buttons [data-act="close"]').click();await cure(page,uid).click();await page.evaluate(()=>{window.__BAMSONNIM__.state.level=2;});await page.locator('[data-act="confirm"]').click();assert.equal(await page.locator('[data-act="confirm"]').textContent(),'예(30원)');assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),500);
   await page.evaluate(()=>{window.__BAMSONNIM__.state.coins=0;});await page.locator('[data-act="confirm"]').click();assert.match(await page.locator('#dialog-description').textContent(),/부족/);assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.waiters[0].infectedUntil>window.__BAMSONNIM__.state.time),true);
   await page.evaluate(()=>{window.__BAMSONNIM__.state.coins=500;});await page.locator('[data-act="confirm"]').evaluate(b=>{b.click();b.click();});assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),470);
   await reset(page);await bite(page);await cure(page,uid).click();await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.state.time=g.state.waiters[0].infectedUntil;g.advance(0);});await page.locator('[data-act="confirm"]').click();assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),500);
   await reset(page);await bite(page);await cure(page,uid).click();await page.evaluate(()=>{window.__BAMSONNIM__.state.waiters=[];});await page.locator('[data-act="confirm"]').click();assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),500);
   await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await reset(page);
   await page.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state;s.level=30;s.coins=1e6;while(s.waiters.length<8)g.engine.hire(s);s.notifications=[];for(const w of s.waiters){w.name='동명이인';w.infectedUntil=300;g.engine.notify(s,'같은 이름의 직원이 물렸어요.','danger',{staffUid:w.uid});}g.engine.notify(s,'UID 없는 옛 감염 알림','danger');g.advance(0);});
   await page.waitForFunction(()=>document.querySelectorAll('#toasts [data-staff-uid]').length===8);
   assert.equal(await page.locator('#toasts .toast:not([data-staff-uid]) [data-act="cure"]').count(),0);
   await page.evaluate(()=>window.__BAMSONNIM__.open('hire'));await page.locator('[data-act="fire"]').first().click();assert.equal(await page.locator('.confirm-buttons [data-act="close"]').textContent(),'취소');assert.equal(await page.locator('[data-act="confirm"]').textContent(),'해고하기');await page.locator('.confirm-buttons [data-act="close"]').click();
   const last=await page.evaluate(()=>window.__BAMSONNIM__.state.waiters.at(-1).uid);await cure(page,last).click();await page.locator('[data-act="confirm"]').click();assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.waiters.at(-1).infectedUntil),0);assert.ok(await page.evaluate(()=>window.__BAMSONNIM__.state.waiters[0].infectedUntil>0));
  }
  await page.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state;s.level=30;s.coins=1e6;while(s.waiters.length<8)g.engine.hire(s);s.notifications=[];for(const w of s.waiters){w.infectedUntil=s.time+300;g.engine.notify(s,'여러 직원 감염 알림','danger',{staffUid:w.uid});}g.advance(0);});
  await page.waitForFunction(()=>document.querySelectorAll('#toasts [data-staff-uid]').length===8);
  const scroll=await page.evaluate(()=>{const e=document.querySelector('#notification-rail'),r=e.getBoundingClientRect();return{y:r.y,bottom:r.bottom,height:r.height,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight};});assert.ok(scroll.y>=0);assert.ok(scroll.bottom<bounds.buttons.y);assert.ok(scroll.scrollHeight>=scroll.clientHeight);
  await page.locator('#toasts [data-act="cure"]').last().click();assert.equal(await page.locator('#dialog-title').textContent(),'치료하시겠습니까?');await page.locator('.confirm-buttons [data-act="close"]').click();
  assert.deepEqual(errors,[]);results.push({viewport,bounds,scroll,cureFlow:'passed',pageErrors:errors});await context.close();
 }
 console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
