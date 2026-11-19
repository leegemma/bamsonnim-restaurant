import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const results=[];
for(const [browserName,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.BASE_URL||'http://127.0.0.1:5197',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>window.__BAMSONNIM__.pause());
  for(const viewport of [{width:1280,height:800},{width:1024,height:768},{width:874,height:402},{width:844,height:390},{width:568,height:320},{width:320,height:568},{width:640,height:400}]){
   await page.setViewportSize(viewport);
   for(const direction of ['ltr','rtl'])for(const growth of [false,true]){
    await page.evaluate(({direction,growth})=>{document.documentElement.dir=direction;const g=window.__BAMSONNIM__,s=g.state;s.coins=growth?999999999:15772;s.hearts=growth?999999:60;s.hunger=100;g.advance(0);},{direction,growth});
    const geometry=await page.evaluate(()=>{
     const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};},header=document.querySelector('.topbar');
     const cards=[...header.querySelectorAll(':scope>.hunger-card,.currency,.top-actions>.icon-button')].map(e=>({name:e.className,...rect(e)}));
     const controls=[...header.querySelectorAll('button')].filter(e=>getComputedStyle(e).display!=='none').map(e=>({name:e.dataset.act,...rect(e)}));
     const values=[...header.querySelectorAll('.currency b')].map(e=>({text:e.textContent,overflow:e.scrollWidth>e.clientWidth,parent:e.parentElement.scrollWidth>e.parentElement.clientWidth}));
     return{header:rect(header),cards,controls,values,face:rect(header.querySelector('.hunger-face')),bar:rect(header.querySelector('.hunger-track')),percentage:rect(header.querySelector('#hunger-value')),hungerName:header.querySelector('.hunger-track').getAttribute('aria-label'),hungerValue:header.querySelector('.hunger-track').getAttribute('aria-valuenow'),text:header.querySelector('#hunger-value').textContent,scroll:header.scrollWidth,client:header.clientWidth};
    });
    assert.equal(geometry.cards.length,5);assert.equal(geometry.hungerName,'도시의 허기');assert.equal(geometry.hungerValue,'100');assert.equal(geometry.text,'100%');assert.ok(geometry.bar.width<100);
    for(const r of [...geometry.cards,...geometry.controls]){assert.ok(r.x>=geometry.header.x-1&&r.right<=geometry.header.right+1,JSON.stringify({browserName,viewport,direction,growth,r,geometry}));assert.ok(r.y>=geometry.header.y-1&&r.bottom<=geometry.header.bottom+1);}
    for(const r of geometry.cards)assert.equal(r.height,48);for(const r of geometry.controls)assert.ok(r.height>=44&&r.width>=44);
    if(viewport.width>480)assert.equal(new Set(geometry.cards.map(r=>r.y)).size,1);else assert.equal(new Set(geometry.cards.slice(1).map(r=>r.y)).size,1);
    for(let i=0;i<geometry.cards.length;i++)for(let j=i+1;j<geometry.cards.length;j++){const a=geometry.cards[i],b=geometry.cards[j];assert.ok(a.right<=b.x||b.right<=a.x||a.bottom<=b.y||b.bottom<=a.y);}
    for(const value of geometry.values)assert.equal(value.overflow||value.parent,false,JSON.stringify({viewport,direction,growth,value}));
    if(direction==='ltr'){assert.ok(geometry.face.right<=geometry.bar.x);assert.ok(geometry.bar.right<=geometry.percentage.x);}else{assert.ok(geometry.percentage.right<=geometry.bar.x);assert.ok(geometry.bar.right<=geometry.face.x);}
    results.push({browserName,viewport,direction,growth,cards:geometry.cards,controls:geometry.controls});
   }
  }
  await page.setViewportSize({width:874,height:402});await page.evaluate(()=>{document.documentElement.dir='ltr';const g=window.__BAMSONNIM__;g.state.coins=15772;g.state.hearts=60;g.advance(0);});
  const sound=page.locator('[data-act="sound"]'),before=await sound.getAttribute('aria-label');await sound.tap();await page.waitForFunction(label=>document.querySelector('[data-act="sound"]').getAttribute('aria-label')!==label,before);
  await page.locator('.top-actions [data-act="settings"]').tap();await page.waitForFunction(()=>document.querySelector('#dialog').open);await page.locator('.close-button').click();
  if(process.env.TOPBAR_SCREENSHOT&&browserName==='chromium')await page.screenshot({path:process.env.TOPBAR_SCREENSHOT});assert.deepEqual(errors,[]);
  console.log(browserName,'uniform HUD:',results.filter(r=>r.browserName===browserName).length,'layout cases + sound/settings touch PASS');
 }finally{await browser.close();}
}
console.log(JSON.stringify(results,null,2));
