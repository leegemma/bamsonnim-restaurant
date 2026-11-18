import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
const output=process.env.TABLE_OUTPUT||'artifacts/table-policy-browser',base=process.env.BASE_URL||'http://127.0.0.1:5173';await fs.mkdir(output,{recursive:true});const browser=await chromium.launch(),results=[];
const engineHash=createHash('sha256').update(await fs.readFile('src/engine.js')).digest('hex');
try{
 for(const touch of [false,true]){
  const mode=touch?'touch':'mouse',context=await browser.newContext({viewport:touch?{width:844,height:390}:{width:1280,height:800},hasTouch:touch,isMobile:touch}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__tablePointers=[];document.addEventListener('pointerdown',e=>window.__tablePointers.push(e.pointerType),true);});
  try{
   await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);
   const activate=l=>touch?l.tap():l.click();
   const setup=await page.evaluate(()=>{
    const g=window.__BAMSONNIM__,s=g.state;g.pause();const fresh=g.engine.newGame();Object.assign(s,fresh);s.coins=10000;s.customers=[];s.objects=[{uid:'qa-table',type:'table',x:3,y:3,dir:0},...[[2,3],[3,2],[4,3],[3,4]].map(([x,y],dir)=>({uid:`qa-chair-${dir}`,type:'chair',x,y,dir})),{uid:'qa-orphan',type:'chair',x:6,y:5,dir:0},{uid:'qa-diagonal',type:'chair',x:2,y:2,dir:0},{uid:'qa-server',type:'server',x:5,y:1,dir:0,foodId:'rice',stock:240}];s.spawnIn=0;s.hunger=0;
    return {seats:g.engine.seats(s).map(seat=>({uid:seat.uid,table:seat.table?.uid})),orphan:g.engine.chairSeatProblem(s,'qa-orphan'),diagonal:g.engine.chairSeatProblem(s,'qa-diagonal')};
   });
   assert.equal(setup.seats.length,4);assert.ok(setup.seats.every(s=>s.table==='qa-table'));assert.match(setup.orphan,/식탁/);assert.match(setup.diagonal,/식탁/);
   await page.waitForTimeout(80);
   async function chairClick(uid){const point=await page.evaluate(uid=>{const v=window.__BAMSONNIM__.view,hits=v.hits,r=v.canvas.getBoundingClientRect(),target=hits.find(h=>h.uid===uid);for(let yy=.1;yy<1;yy+=.1)for(let xx=.1;xx<1;xx+=.1){const x=target.x+target.w*xx,y=target.y+target.h*yy,hit=[...hits].reverse().find(h=>x>=h.x&&x<=h.x+h.w&&y>=h.y&&y<=h.y+h.h);if(hit?.uid===uid)return{x:r.x+x,y:r.y+y};}throw new Error('No exposed chair hit area');},uid);if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);return point;}
   await chairClick('qa-orphan');await page.waitForFunction(()=>document.querySelector('#toasts')?.textContent.includes('앞 칸에 식탁'));const invalidToast=await page.locator('#toasts').innerText();await page.screenshot({path:`${output}/${mode}-invalid-chair.png`});
   await chairClick('qa-chair-0');await page.waitForFunction(()=>document.querySelector('#toasts')?.textContent.includes('식탁을 향한 좌석'));const validToast=await page.locator('#toasts').innerText();
   await activate(page.locator('#decorate-button'));await activate(page.locator('#keyboard-placement summary'));await page.locator('#furniture-select').selectOption('qa-chair-0');
   const rotations=[];
   for(let i=1;i<=4;i++){await activate(page.locator('[data-act="rotate"]'));const row=await page.evaluate(()=>{const g=window.__BAMSONNIM__;return{dir:g.edit.ghost.dir,text:document.querySelector('#edit-info').textContent,disabled:document.querySelector('[data-act="place"]').disabled};});assert.equal(row.dir,i%4);assert.equal(row.disabled,false,'Decorative chair placement remains allowed');if(i<4)assert.match(row.text,/장식 의자.*식탁/);else assert.doesNotMatch(row.text,/장식 의자/);rotations.push(row);}
   await activate(page.locator('[data-act="rotate"]'));await page.screenshot({path:`${output}/${mode}-wrong-facing-ghost.png`});await activate(page.locator('[data-act="place"]'));assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.engine.seats(window.__BAMSONNIM__.state).length),3);
   await activate(page.locator('[data-act="finish-edit"]'));await chairClick('qa-chair-0');await page.waitForFunction(()=>document.querySelector('#toasts')?.textContent.includes('앞 칸에 식탁'));
   await activate(page.locator('#decorate-button'));if(!await page.locator('#keyboard-placement').evaluate(e=>e.open))await activate(page.locator('#keyboard-placement summary'));await page.locator('#furniture-select').selectOption('qa-chair-0');for(let i=0;i<3;i++)await activate(page.locator('[data-act="rotate"]'));await activate(page.locator('[data-act="place"]'));await activate(page.locator('[data-act="finish-edit"]'));
   const business=await page.evaluate(()=>{
    const g=window.__BAMSONNIM__,s=g.state,used=new Set(),paid=new Set(),seen=new Set(),trace=[];let maxOccupied=0,frame=null;g.pause();
    for(let i=0;i<960;i++){g.engine.advance(s,.25);const occupied=s.customers.filter(c=>['waiting','eating'].includes(c.phase));maxOccupied=Math.max(maxOccupied,occupied.length);for(const c of occupied)used.add(c.seat);for(const c of s.customers){const key=`${c.uid}:${c.phase}`;if(!seen.has(key)){seen.add(key);trace.push({time:s.time,uid:c.uid,phase:c.phase,seat:c.seat});}if(c.phase==='leaving')paid.add(c.uid);}if(occupied.length===4&&!frame){g.view.draw(s,null,0,false);frame=g.view.canvas.toDataURL();}}
    return {used:[...used],maxOccupied,sold:s.stats.sold,served:s.stats.served,album:s.album,trace,frame,remaining:s.customers.length,seats:g.engine.seats(s).map(x=>x.uid)};
   });
   assert.deepEqual([...business.used].sort(),[0,1,2,3].map(d=>`qa-chair-${d}`));assert.equal(business.maxOccupied,4);assert.ok(business.sold>0&&business.served>0&&business.album.wanderer>0);assert.ok(business.frame);await fs.writeFile(`${output}/${mode}-four-occupied.png`,Buffer.from(business.frame.split(',')[1],'base64'));delete business.frame;
   await activate(page.locator('[data-act="menu"]').first());await activate(page.locator('[data-act="help"]'));const help=await page.locator('#dialog-content').innerText().catch(()=>page.locator('dialog').innerText());assert.match(help,/최대 4명/);assert.match(help,/식탁 없는 의자는 장식/);await page.screenshot({path:`${output}/${mode}-help.png`});
   const pointers=await page.evaluate(()=>window.__tablePointers);assert.ok(pointers.length>10&&pointers.every(x=>x===(touch?'touch':'mouse')));assert.deepEqual(errors,[]);results.push({mode,passed:true,setup,invalidToast,validToast,rotations,business,pointers:pointers.length,pointerTypes:[...new Set(pointers)],errors});console.log(`${mode}: passed; ${business.sold} sales, all four seats used`);
  }catch(e){await page.screenshot({path:`${output}/${mode}-failure.png`});results.push({mode,passed:false,error:e.stack,errors});throw e;}finally{await fs.writeFile(`${output}/results.json`,JSON.stringify({engineHash,scope:'Actual browser input plus accelerated production engine; artificial table/stock fixture, natural engine arrivals and serving. Native select controlled with selectOption; real native popup keyboard behavior excluded.',results},null,2));await context.close();}
 }
}finally{await browser.close();}
