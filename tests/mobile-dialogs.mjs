import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import fs from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5173',out=process.env.MOBILE_OUTPUT||'artifacts/mobile-dialogs';await fs.mkdir(out,{recursive:true});const results=[];
for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch();try{
  for(const viewport of [{width:568,height:240},{width:568,height:320},{width:667,height:375},{width:844,height:390},{width:932,height:430}]){
   console.log(name,viewport);const context=await browser.newContext({viewport,hasTouch:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);await p.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await p.evaluate(()=>window.__BAMSONNIM__.pause());
   for(const screen of ['settings','album','quest','events','cookbook']){
    await p.evaluate(n=>window.__BAMSONNIM__.open(n),screen);
    assert.equal(await p.locator('#orientation-dialog').isVisible(),false);
    const box=await p.locator('#dialog').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,`${screen} must fit viewport`);
    const heading=await p.locator('#dialog .dialog-heading').boundingBox();assert.ok(heading.height<=75,`${screen} heading must leave content room`);
    if(screen==='album'){
     const grid=p.locator('.album-grid'),r=await grid.boundingBox();assert.ok(r.height>50);
     if(name==='chromium'){
      const cdp=await context.newCDPSession(p),x=r.x+r.width*.6,start=r.y+r.height*.8,end=r.y+r.height*.2;
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x,y:start}]});
      for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x,y:start+(end-start)*i/8}]});await p.waitForTimeout(20);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
     }else{await p.mouse.move(r.x+r.width/2,r.y+r.height/2);await p.mouse.wheel(0,600);}
     await p.waitForFunction(()=>document.querySelector('.album-grid').scrollTop>0);
     await grid.evaluate(e=>e.scrollTop=e.scrollHeight);const before=await grid.evaluate(e=>e.scrollTop);
     await p.locator('.guest-card').last().click();assert.ok(Math.abs(await grid.evaluate(e=>e.scrollTop)-before)<=1,'Selecting a character must preserve list position');
     assert.ok(await p.locator('.guest-detail > p').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'Character description must not overlap the conditions');
     await p.locator('.guest-detail').evaluate(e=>e.scrollTop=e.scrollHeight);
     await p.screenshot({path:`${out}/${name}-album-${viewport.width}x${viewport.height}.png`});
    }else if(screen==='settings'){
     await p.locator('[data-act="reset"]').scrollIntoViewIfNeeded();assert.ok(await p.locator('#dialog .close-button').isVisible());
    }else if(screen==='events'){
     await p.locator('[data-act="event-book"]').scrollIntoViewIfNeeded();
    }else if(screen==='quest'){
     await p.locator('[data-act="claim-quest"]').scrollIntoViewIfNeeded();
    }else if(screen==='cookbook'){
     await p.locator('[data-act="book-open"]').first().click();await p.locator('.cook-button').first().scrollIntoViewIfNeeded();
     const button=await p.locator('.cook-button').first().boundingBox();assert.ok(button.y>=0&&button.y+button.height<=viewport.height,'Cook action must be reachable');
     await p.screenshot({path:`${out}/${name}-cookbook-${viewport.width}x${viewport.height}.png`});
    }
   }
   assert.deepEqual(errors,[]);results.push({browser:name,viewport,passed:true});await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true}),p=await context.newPage();await p.goto(base);await p.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);assert.equal(await p.locator('#orientation-dialog').isVisible(),true);assert.equal(await p.locator('[data-act="dismiss-orientation"]').count(),0);await p.keyboard.press('Escape');assert.equal(await p.locator('#orientation-dialog').isVisible(),true);
  await p.evaluate(()=>window.__BAMSONNIM__.open('album'));assert.equal(await p.locator('#orientation-dialog').evaluate(e=>e.matches(':modal')),true);await p.screenshot({path:`${out}/${name}-rotate.png`});
  await p.setViewportSize({width:844,height:390});await p.waitForFunction(()=>!document.querySelector('#orientation-dialog').open);assert.equal(await p.locator('#dialog').isVisible(),true);await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.querySelector('#orientation-dialog').open);assert.equal(await p.locator('#orientation-dialog').isVisible(),true);results.push({browser:name,orientation:'portrait-landscape-portrait',passed:true});await context.close();
 }finally{await browser.close();}
}
await fs.writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log(`${results.length} mobile layout/orientation cases passed.`);
