import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium,webkit} from 'playwright';
const browserName=process.env.BROWSER||'chromium';
if(!['chromium','webkit'].includes(browserName))throw new Error(`Unsupported BROWSER: ${browserName}`);
const browserType=browserName==='webkit'?webkit:chromium;
const output=process.env.HUD_OUTPUT||'artifacts/mobile-hud',base=process.env.BASE_URL||'http://127.0.0.1:5173',captureOnly=process.env.HUD_CAPTURE_ONLY==='1';await fs.mkdir(output,{recursive:true});const browser=await browserType.launch(),results=[],failures=[];
try{
 for(const viewport of [{width:844,height:390},{width:667,height:375},{width:568,height:320},{width:844,height:300},{width:568,height:240}].filter(v=>!process.env.HUD_VIEWPORT||`${v.width}x${v.height}`===process.env.HUD_VIEWPORT)){
  const name=`${viewport.width}x${viewport.height}`,context=await browser.newContext({viewport,hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[],record={viewport};page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.__hudPointers=[];document.addEventListener('pointerdown',e=>window.__hudPointers.push(e.pointerType),true);});
  try{
   await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.__BAMSONNIM__.pause());
   record.layout=await page.evaluate(()=>{const selectors=['#app','.topbar','.bottom-bar','#stage','#world','.brand small','.mayor-portrait','.season-card','#bottom-center','#coins','#hearts','#level','#hunger-value','.hunger-track','.quest-track','[data-act="menu"]','#decorate-button','.right-rail [data-act="cookbook"]','.mayor-card'];return{viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},tile:window.__BAMSONNIM__.view.tile,background:(()=>{const im=window.__BAMSONNIM__.view.images.night;return{src:im?.src,width:im?.naturalWidth,height:im?.naturalHeight};})(),elements:Object.fromEntries(selectors.map(selector=>{const el=document.querySelector(selector),r=el.getBoundingClientRect(),style=getComputedStyle(el),visible=el.checkVisibility()&&r.width>0&&r.height>0;return[selector,{visible,x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,font:style.fontSize,intercept:visible?document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.dataset.act:null}];}))};});
   await page.screenshot({path:`${output}/hud-${name}.png`});
   if(!captureOnly){
    const l=record.layout,e=l.elements;assert.equal(l.document.width,viewport.width);assert.equal(l.document.height,viewport.height,'No inaccessible page content below viewport');assert.ok(e['.topbar'].height<=44&&e['.bottom-bar'].height<=44,'HUD bars use at most 88px');
    for(const sel of ['#coins','#hearts','#level','#hunger-value','.hunger-track','.quest-track','[data-act="menu"]','#decorate-button','.right-rail [data-act="cookbook"]','.mayor-card']){const r=e[sel];assert.ok(r.visible&&r.x>=0&&r.y>=0&&r.right<=viewport.width+.5&&r.bottom<=viewport.height+.5,`${sel} visible inside ${name}`);}
    assert.ok(e['.hunger-track'].bottom<=e['.bottom-bar'].y,'Hunger progress remains above footer');
    for(const sel of ['.brand small','.mayor-portrait','.season-card','#bottom-center'])assert.equal(e[sel].visible,false,`${sel} is intentionally compacted`);
    const close=async()=>{await page.getByRole('button',{name:'창 닫기',exact:true}).tap();assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);};record.flows=[];
    for(const action of ['settings','events','album','hire','quest']){
     await page.locator('[data-act="menu"]').tap();await page.locator(`#dialog [data-act="${action}"]`).tap();await page.locator('#dialog-content').waitFor({state:'visible'});assert.ok((await page.locator('#dialog-content').textContent()).trim());await page.screenshot({path:`${output}/${action}-${name}.png`});await close();record.flows.push(action);
    }
    await page.locator('.right-rail [data-act="cookbook"]').tap();await page.screenshot({path:`${output}/cookbook-${name}.png`});await page.getByRole('button',{name:'다음 페이지',exact:true}).tap();await page.getByRole('button',{name:'이전 페이지',exact:true}).tap();await page.locator('[data-act="cook"][data-id="rice"]').tap();assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);record.flows.push('cookbook-navigation-and-cook');
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const stove=await page.evaluate(()=>{const g=window.__BAMSONNIM__,o=g.state.objects.find(o=>o.cook),h=g.view.hits.find(h=>h.kind==='stove'&&h.uid===o.uid),r=g.view.canvas.getBoundingClientRect();return{uid:o.uid,x:r.x+h.x+h.w/2,y:r.y+h.y+h.h/2};});
    await page.touchscreen.tap(stove.x,stove.y);await page.locator('.stove-dialog').waitFor({state:'visible'});await page.screenshot({path:`${output}/stove-${name}.png`});assert.equal(await page.locator('.cook-progress').getAttribute('max'),'12');
    await page.evaluate(()=>window.__BAMSONNIM__.advance(3));await page.waitForFunction(()=>document.querySelector('.cook-progress')?.value===3);assert.match(await page.locator('.stove-dialog h2').textContent(),/9초/);await page.locator('[data-act="instant"]').tap();await page.locator('[data-act="collect"]').tap();assert.equal(await page.locator('dialog').evaluate(d=>d.open),false);record.flows.push('stove-progress-instant-collect');
    await page.locator('#decorate-button').tap();await page.locator('[data-act="shop-tab"][data-id="chair"]').tap();await page.locator('[data-act="buy-furniture"][data-id="chair"]').tap();
    await page.screenshot({path:`${output}/decorate-selected-${name}.png`});
    if(!await page.locator('#keyboard-placement').evaluate(d=>d.open))await page.locator('#keyboard-placement summary').tap();
    const spot=await page.evaluate(()=>{const g=window.__BAMSONNIM__;for(let y=1;y<g.state.size-1;y++)for(let x=1;x<g.state.size-1;x++)if(!g.engine.placementProblem(g.state,'chair',x,y,0))return{x,y};});assert.ok(spot);
    await page.locator('[data-coordinate="x"]').fill(String(spot.x+1));await page.locator('[data-coordinate="y"]').fill(String(spot.y+1));await page.locator('[data-act="place"]').tap();assert.ok(await page.evaluate(spot=>window.__BAMSONNIM__.state.objects.some(o=>o.type==='chair'&&o.x===spot.x&&o.y===spot.y),spot));await page.locator('[data-act="finish-edit"]').tap();record.flows.push('shop-place-chair-finish');
    await page.screenshot({path:`${output}/after-actions-${name}.png`});const pointers=await page.evaluate(()=>window.__hudPointers);assert.ok(pointers.length>0&&pointers.every(p=>p==='touch'));record.pointerTypes=[...new Set(pointers)];record.pointerEvents=pointers.length;
   }
   assert.deepEqual(errors,[]);record.passed=true;
  }catch(error){record.passed=false;record.error=error.stack;failures.push(`${name}: ${error.message}`);await page.screenshot({path:`${output}/failure-${name}.png`}).catch(()=>{});}finally{record.errors=errors;results.push(record);await context.close();}
 }
 await fs.writeFile(`${output}/results.json`,JSON.stringify({browser:browserName,browserVersion:browser.version(),passed:failures.length===0,captureOnly,scope:'Playwright browser-engine touch viewport emulation only. Reduced heights model remaining browser viewport; no claim of real iOS Safari chrome or installed-app verification.',results,failures},null,2));console.log(JSON.stringify({passed:failures.length===0,captureOnly,viewports:results.map(r=>({viewport:r.viewport,passed:r.passed,error:r.error?.split('\n')[0]}))}));assert.deepEqual(failures,[]);
}finally{await browser.close();}
