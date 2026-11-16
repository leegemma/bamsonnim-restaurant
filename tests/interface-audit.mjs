import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const baseURL=process.env.BASE_URL||'http://127.0.0.1:5173';
const axePath=process.env.AXE_PATH||'node_modules/axe-core/axe.min.js';
await fs.access(axePath);
const output=process.env.AUDIT_OUTPUT||'artifacts/interface-review-current';await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const [width,height] of [[1280,800],[844,390],[640,400],[320,640]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:width===844,isMobile:width===844});
  const page=await context.newPage();await page.goto(baseURL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>window.__BAMSONNIM__.pause());
  if(await page.locator('#orientation-dialog').isVisible())await page.setViewportSize({width:height,height:width});
  await page.addScriptTag({path:axePath});
  for(const screen of ['main','cookbook','menu','settings','decorate']){
   if(screen==='cookbook')await page.locator('[data-act="cookbook"]').first().click();
   if(screen==='menu'){
    await page.locator('dialog [data-act="close"]').click();
    await page.locator('[data-act="menu"]').click();
   }
   if(screen==='settings')await page.locator('dialog [data-act="settings"]').click();
   if(screen==='decorate'){
    await page.locator('dialog [data-act="close"]').click();
    await page.locator('[data-act="decorate"]').click();
    await page.locator('[data-act="buy-furniture"][data-id="table"]').click();
   }
   await page.keyboard.press('Tab');
   const layout=await page.evaluate(()=>({
    horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
    font:{family:getComputedStyle(document.body).fontFamily,ready:document.fonts.status,neoLoaded:document.fonts.check('16px NeoDunggeunmo')},
    focus:(()=>{const el=document.activeElement,s=getComputedStyle(el),r=el.getBoundingClientRect();return{tag:el.tagName,label:el.getAttribute('aria-label')||el.textContent,outline:s.outline,boxShadow:s.boxShadow,visible:r.width>0&&r.height>0};})(),
    viewport:[innerWidth,innerHeight],
    controls:[...document.querySelectorAll('#edit-tools button,#furniture-select,.shop-tabs button')].filter(el=>el.checkVisibility()).map(el=>{
     const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
     return{text:el.getAttribute('aria-label')||el.textContent,box:{x:r.x,y:r.y,width:r.width,height:r.height},centerHit:el===target||el.contains(target)};
    }),
   }));
   const audit=width>=844?await page.evaluate(async()=>{
    const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
    const trim=items=>items.map(({id,impact,help,nodes})=>({id,impact,help,nodes:nodes.map(({target,html,failureSummary,any,all})=>({target,html,failureSummary,checks:[...any,...all].map(({id,data})=>({id,data}))}))}));
    return{violations:trim(result.violations),incomplete:trim(result.incomplete),passes:result.passes.map(r=>r.id)};
   }):{notRun:'Layout-only at this viewport'};
   await page.screenshot({path:`${output}/${width}-${screen}.png`,fullPage:true});
   results.push({width,height,screen,layout,audit});
  }
  await context.close();
 }
 await fs.writeFile(`${output}/results.json`,JSON.stringify({results,notVerified:['VoiceOver/NVDA','physical iOS/Safari','actual browser 200%/400% zoom','all image/translucent-background contrast pairs']},null,2));
 console.log(JSON.stringify(results.map(({width,screen,layout,audit})=>({width,screen,overflow:layout.horizontalOverflow,violations:audit.violations?.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),incomplete:audit.incomplete?.map(v=>v.id)})),null,2));
 if(results.some(r=>r.layout.horizontalOverflow||r.audit.violations?.length))process.exitCode=1;
}finally{await browser.close();}
