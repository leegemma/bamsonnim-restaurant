import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const browserName=process.env.BROWSER||'chromium';
if(!['chromium','webkit'].includes(browserName))throw new Error(`Unsupported BROWSER: ${browserName}`);
const browserType=browserName==='webkit'?webkit:chromium;

const output=process.env.COMPACT_OUTPUT||'artifacts/compact-ui',baseURL=process.env.BASE_URL||'http://127.0.0.1:5173';
await fs.mkdir(output,{recursive:true});const browser=await browserType.launch(),results=[];
try{
 for(const viewport of [{width:844,height:390},{width:667,height:375},{width:568,height:320}]){
  const context=await browser.newContext({viewport,hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];
  await page.addInitScript(()=>{window.__compactPointers=[];document.addEventListener('pointerdown',e=>window.__compactPointers.push(e.pointerType),true);});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.__BAMSONNIM__.pause());
  async function snapshot(name,selectors){
   const layout=await page.evaluate(selectors=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return{dialog:{x:r.x,y:r.y,width:r.width,height:r.height,client:d.clientHeight,scroll:d.scrollHeight},documentOverflow:document.documentElement.scrollWidth>innerWidth,elements:selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map(el=>{const b=el.getBoundingClientRect();return{selector,text:el.textContent.trim(),visible:el.checkVisibility(),x:b.x,y:b.y,width:b.width,height:b.height,scroll:el.scrollHeight,client:el.clientHeight,inViewport:b.x>=0&&b.y>=0&&b.right<=innerWidth+.5&&b.bottom<=innerHeight+.5};}))};},selectors);
   assert.equal(layout.documentOverflow,false);assert.ok(layout.dialog.scroll<=layout.dialog.client+1,`${viewport.width} ${name}: no dialog scrolling`);for(const el of layout.elements)assert.ok(el.visible&&el.inViewport,`${viewport.width} ${name}: ${el.selector} fits`);
   await page.screenshot({path:`${output}/${name}-${viewport.width}.png`});return layout;
  }
  await page.locator('[data-act="cookbook"]').first().tap();await page.locator('.recipe-page').first().waitFor({state:'visible'});
  assert.equal(await page.locator('.recipe-page').count(),2);
  const cookbook=await snapshot('cookbook',['.recipe-page','.recipe-prices','.recipe-stock','.cook-button','.book-footer','.book-tabs']);
  assert.ok(cookbook.elements.filter(e=>e.selector==='.recipe-stock').every(e=>e.text.includes('서빙대 재고')));
  const first=await page.locator('.recipe-page h2').allTextContents();await page.getByRole('button',{name:'다음 페이지',exact:true}).tap();await page.waitForFunction(first=>JSON.stringify([...document.querySelectorAll('.recipe-page h2')].map(e=>e.textContent))!==JSON.stringify(first),first);assert.notDeepEqual(await page.locator('.recipe-page h2').allTextContents(),first);await page.getByRole('button',{name:'이전 페이지',exact:true}).tap();await page.waitForFunction(first=>JSON.stringify([...document.querySelectorAll('.recipe-page h2')].map(e=>e.textContent))===JSON.stringify(first),first);assert.deepEqual(await page.locator('.recipe-page h2').allTextContents(),first);
  await page.locator('[data-act="book-tab"][data-n="1"]').tap();await page.locator('[data-act="book-tab"][data-n="0"]').tap();
  await page.locator('[data-act="cook"][data-id="rice"]').tap();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
  const stove=await page.evaluate(()=>window.__BAMSONNIM__.state.objects.find(o=>o.cook)?.uid);assert.ok(stove);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const point=await page.evaluate(uid=>{const g=window.__BAMSONNIM__,h=g.view.hits.filter(h=>h.uid===uid&&h.kind==='stove').at(-1),r=g.view.canvas.getBoundingClientRect();return{x:r.x+h.x+h.w/2,y:r.y+h.y+12};},stove);
  await page.touchscreen.tap(point.x,point.y);await page.locator('.stove-dialog').waitFor({state:'visible'});
  const cooking=await snapshot('cooking',['.stove-dialog','.cook-progress','[data-act="instant"]','[data-act="discard"]']);
  const progressBefore=await page.locator('.cook-progress').evaluate(el=>({value:el.value,max:el.max,label:el.getAttribute('aria-label')}));assert.deepEqual(progressBefore,{value:0,max:12,label:'조리 진행률'});
  await page.evaluate(()=>window.__BAMSONNIM__.advance(3));await page.waitForFunction(()=>document.querySelector('.cook-progress')?.value===3);assert.match(await page.locator('.stove-dialog h2').textContent(),/9초/);const progressAfter=await snapshot('cooking-progress',['.cook-progress','.stove-dialog h2','[data-act="instant"]']);
  await page.locator('[data-act="instant"]').tap();await page.locator('[data-act="collect"]').waitFor({state:'visible'});assert.equal(await page.evaluate(uid=>window.__BAMSONNIM__.engine.stoveStatus(window.__BAMSONNIM__.state,window.__BAMSONNIM__.state.objects.find(o=>o.uid===uid)),stove),'done');await page.locator('[data-act="collect"]').tap();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.state.feverUntil=g.state.time+30;g.pause();});
  const fever=await page.locator('#fever-banner').evaluate(el=>{const r=el.getBoundingClientRect();return{text:el.textContent,hidden:el.hidden,x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,progress:document.querySelector('#fever-progress').value};});
  assert.equal(fever.hidden,false);assert.match(fever.text,/30초/);assert.match(fever.text,/코인 ×2/);assert.match(fever.text,/등장 빈도 ×3/);assert.match(fever.text,/서빙당 재고 1개 소모/);assert.match(fever.text,/이동·조리 속도·XP는 평소/);assert.equal(fever.progress,30);assert.ok(fever.x>=0&&fever.y>=0&&fever.right<=viewport.width&&fever.bottom<=viewport.height);
  await page.screenshot({path:`${output}/fever-${viewport.width}.png`});
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.state.time+=5;g.pause();});assert.equal(await page.locator('#fever-progress').evaluate(el=>el.value),25);assert.match(await page.locator('#fever-title').textContent(),/25초/);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.state.time=g.state.feverUntil;g.pause();});assert.equal(await page.locator('#fever-banner').isVisible(),false);
  const pointerTypes=await page.evaluate(()=>window.__compactPointers);assert.ok(pointerTypes.length>0&&pointerTypes.every(type=>type==='touch'));assert.deepEqual(errors,[]);
  results.push({viewport,cookbook,cooking,progressBefore,progressAfter,fever,pointerEvents:pointerTypes.length,pointerTypes:[...new Set(pointerTypes)],errors});await context.close();
 }
 await fs.writeFile(`${output}/results.json`,JSON.stringify({browser:browserName,browserVersion:browser.version(),status:'passed',scope:'Playwright engine emulation, not a real mobile Safari device.',results},null,2));console.log(JSON.stringify({status:'passed',viewports:results.map(r=>r.viewport)}));
}catch(error){await fs.writeFile(`${output}/results.json`,JSON.stringify({browser:browserName,browserVersion:browser.version(),status:'failed',completed:results,error:error.stack},null,2));throw error;}finally{await browser.close();}
