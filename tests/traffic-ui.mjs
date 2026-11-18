import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const output=process.env.TRAFFIC_UI_OUTPUT||'artifacts/traffic-ui',baseURL=process.env.BASE_URL||'http://127.0.0.1:5173';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch(),results=[];
try{
 for(const viewport of [{width:1280,height:800},{width:844,height:390},{width:320,height:640}]){
  const hasTouch=viewport.width<900,context=await browser.newContext({viewport,hasTouch}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(baseURL);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);
  const portrait=page.getByRole('button',{name:'이대로 보기',exact:true});if(await portrait.isVisible()){if(hasTouch)await portrait.tap();else await portrait.click();}
  await page.evaluate(()=>window.__BAMSONNIM__.pause());
  assert.equal(await page.locator('#traffic-notice').isVisible(),false);
  const blocked=await page.evaluate(()=>{
   const g=window.__BAMSONNIM__,E=g.engine,s=E.newGame();g.pause();s.time=30;s.spawnIn=0;Object.assign(s.objects.find(o=>o.type==='server'),{foodId:'rice',stock:100});
   s.objects.push({uid:'blocked-exit-1',type:'jars',x:0,y:6,dir:0},{uid:'blocked-exit-2',type:'jars',x:1,y:7,dir:0});
   s.customers=[{uid:'blocked-leaver',zombieId:'wanderer',x:2,y:5,phase:'leaving',path:[],wait:0,seat:null,leavingAt:0}];
   Object.assign(g.state,s);E.advance(g.state,30);g.pause();
   return{status:E.trafficStatus(g.state),guest:g.state.customers.find(c=>c.uid==='blocked-leaver'),count:g.state.customers.length};
  });
  assert.equal(blocked.status.exitBlocked,true);assert.equal(blocked.count,1);assert.ok(blocked.guest);
  await page.waitForTimeout(200);const notice=page.locator('#traffic-notice');
  assert.equal(await notice.isVisible(),true);assert.equal(await notice.getAttribute('role'),'status');
  assert.match(await notice.innerText(),/출입문.*통로.*비워/);
  const bounds=await notice.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width+.5);
  await page.screenshot({path:`${output}/blocked-${viewport.width}.png`});
  const normal=await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.state.objects=g.state.objects.filter(o=>!o.uid.startsWith('blocked-exit'));g.state.objects.find(o=>o.type==='server').stock=0;g.engine.advance(g.state,30);g.pause();return{status:g.engine.trafficStatus(g.state),hasGuest:g.state.customers.some(c=>c.uid==='blocked-leaver')};});
  assert.equal(normal.hasGuest,false);assert.equal(normal.status.congested,false);assert.equal(await notice.isVisible(),false);assert.deepEqual(errors,[]);
  results.push({viewport,blocked,normal,bounds,errors});await context.close();
 }
 await fs.writeFile(`${output}/results.json`,JSON.stringify({status:'passed',results},null,2));console.log(JSON.stringify({status:'passed',viewports:results.map(r=>r.viewport)}));
}finally{await browser.close();}
