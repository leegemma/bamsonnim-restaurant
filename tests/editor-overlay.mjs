import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const baseURL=process.env.BASE_URL||'http://127.0.0.1:5197';
for(const [name,type] of [['chromium',chromium],['webkit',webkit]].filter(([name])=>!process.env.EDITOR_BROWSER||name===process.env.EDITOR_BROWSER)){
 const browser=await type.launch({headless:true});
 try{for(const viewport of [{width:1280,height:800},{width:874,height:402},{width:844,height:390},{width:568,height:320}].filter(v=>!process.env.EDITOR_WIDTH||v.width===Number(process.env.EDITOR_WIDTH))){
  console.log('checking',name,JSON.stringify(viewport));
  const context=await browser.newContext({viewport,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(baseURL,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  await page.evaluate(()=>{const g=window.__BAMSONNIM__;g.pause();g.state.level=30;g.state.coins=100000;g.state.tutorial=3;g.advance(0);});
  const activate=async selector=>{await page.locator(selector).tap();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));};
  const footer=await page.locator('.bottom-actions').boundingBox();
  await activate('[data-act="decorate"]');await page.waitForFunction(()=>!!window.__BAMSONNIM__.edit);assert.equal(await page.locator('#edit-tools').isVisible(),false);assert.equal(await page.locator('#keyboard-placement').count(),0);
  const shop=await page.locator('#shop-dock').boundingBox();assert.equal(shop.x,0);assert.equal(shop.width,viewport.width);assert.equal(shop.y+shop.height,viewport.height);
  assert.equal(await page.locator('.bottom-bar').evaluate(e=>e.inert),true);
  assert.ok(await page.evaluate(({x,y,width,height})=>document.elementFromPoint(x+width/2,y+height/2)?.closest('#shop-dock')!==null,footer));
  const exit=await page.locator('[data-act="finish-edit"]').boundingBox();assert.ok(exit.x>=0&&exit.x+exit.width<=viewport.width);

  async function chooseFloor(){
   const point=await page.evaluate(()=>{const g=window.__BAMSONNIM__,v=g.view,c=v.canvas.getBoundingClientRect(),s=g.state,f=g.edit.ghost;
    const tiles=Array.from({length:s.size*s.size},(_,i)=>({x:i%s.size,y:Math.floor(i/s.size)})).sort((a,b)=>Math.hypot(a.x-3,a.y-3)-Math.hypot(b.x-3,b.y-3));
    for(const {x,y} of tiles){
     if(g.engine.placementProblem(s,f.type,x,y,f.dir,f.existing,{ignoreStaff:true}))continue;
     const p=v.sceneToScreen(v.world(x,y)),screen={x:c.x+p.x,y:c.y+p.y};
     if(screen.y>c.y+8&&screen.x>8&&screen.x<innerWidth-8&&document.elementFromPoint(screen.x,screen.y)?.id==='world')return{...screen,tileX:x,tileY:y};
    }return null;
   });assert.ok(point,'an unobstructed valid floor tile remains reachable');await page.touchscreen.tap(point.x,point.y);
   assert.deepEqual(await page.evaluate(()=>{const g=window.__BAMSONNIM__.edit.ghost;return[g.x,g.y,g.locked];}),[point.tileX,point.tileY,true]);return point;
  }
  async function selectObject(uid){
   await page.waitForFunction(uid=>window.__BAMSONNIM__.view.hits.some(h=>h.uid===uid),uid);
   const point=await page.evaluate(uid=>{const v=window.__BAMSONNIM__.view,c=v.canvas.getBoundingClientRect(),h=v.hits.findLast(h=>h.uid===uid);
    for(const a of Array.from({length:19},(_,i)=>(i+1)/20))for(const b of Array.from({length:19},(_,i)=>(i+1)/20)){
     const p={x:h.x+h.w*a,y:h.y+h.h*b},q=v.sceneToScreen(p),screen={x:c.x+q.x,y:c.y+q.y};
     const edge=2/v.camera.zoom,stable=[[0,0],[-edge,0],[edge,0],[0,-edge],[0,edge]].every(([dx,dy])=>v.hitAt({x:p.x+dx,y:p.y+dy})?.uid===uid);
     if(stable&&document.elementFromPoint(screen.x,screen.y)?.id==='world')return screen;
    }return null;
   },uid);assert.ok(point,'existing furniture has a visible selection point');await page.touchscreen.tap(point.x,point.y);await page.waitForFunction(uid=>window.__BAMSONNIM__.edit.ghost?.existing===uid,uid);
  }
  await activate('[data-act="shop-tab"][data-id="chair"]');await activate('[data-act="buy-furniture"][data-id="chair"]');assert.equal(await page.locator('#edit-tools').isVisible(),true);
  const strip=await page.locator('#edit-tools').boundingBox();assert.ok(strip.y>40);assert.ok(strip.y+strip.height<=shop.y-6);
  await chooseFloor();const dir=await page.evaluate(()=>window.__BAMSONNIM__.edit.ghost.dir);await activate('[data-act="rotate"]');assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.edit.ghost.dir),(dir+1)%4);
  await page.locator('#world').focus();const old=await page.evaluate(()=>window.__BAMSONNIM__.edit.ghost.x);await page.keyboard.press(old>0?'ArrowLeft':'ArrowRight');assert.notEqual(await page.evaluate(()=>window.__BAMSONNIM__.edit.ghost.x),old);await page.keyboard.press('R');await page.keyboard.press('Escape');assert.equal(await page.locator('#edit-tools').isVisible(),false);
  await activate('[data-act="buy-furniture"][data-id="chair"]');const placed=await chooseFloor();await activate('[data-act="rotate"]');await activate('[data-act="place"]');
  const chair=await page.evaluate(({tileX,tileY})=>window.__BAMSONNIM__.state.objects.find(o=>o.type==='chair'&&o.x===tileX&&o.y===tileY),placed);assert.ok(chair);assert.equal(await page.locator('#edit-tools').isVisible(),false);
  await selectObject(chair.uid);assert.equal(await page.locator('[data-act="sell"]').isVisible(),true);await activate('[data-act="store"]');assert.ok(await page.evaluate(()=>window.__BAMSONNIM__.state.storage.includes('chair')));
  await activate('[data-act="shop-tab"][data-id="storage"]');const coins=await page.evaluate(()=>window.__BAMSONNIM__.state.coins);await activate('[data-act="buy-furniture"][data-id="chair"]');await chooseFloor();await activate('[data-act="place"]');assert.equal(await page.evaluate(()=>window.__BAMSONNIM__.state.coins),coins);
  await activate('[data-act="shop-tab"][data-id="chair"]');await activate('[data-act="buy-furniture"][data-id="chair"]');await activate('[data-act="cancel-placement"]');assert.equal(await page.locator('#edit-tools').isVisible(),false);
  if(process.env.EDITOR_SCREENSHOT&&name==='chromium'&&viewport.width===568)await page.screenshot({path:process.env.EDITOR_SCREENSHOT});
  await activate('[data-act="finish-edit"]');assert.equal(await page.locator('.bottom-bar').evaluate(e=>e.inert),false);assert.equal(await page.locator('#shop-dock').isVisible(),false);
  await activate('.bottom-actions [data-act="menu"]');assert.ok(await page.locator('#dialog').evaluate(d=>d.open));assert.deepEqual(errors,[]);
  console.log(JSON.stringify({browser:name,viewport,shop,strip,checks:'idle hidden, keyboard retained, footer covered/inert, tabs, chair tap/rotate/place/cancel, existing select/store/reuse, done/footer restore PASS'}));await context.close();
 }}finally{await browser.close();}
}
