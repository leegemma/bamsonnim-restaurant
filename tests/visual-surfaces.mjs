import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

// Screenshot evidence, not a claim that loaded PNGs imply correct visual contact.
// Review the exported actual-renderer composites and in-game scenes separately.
const output=process.env.SURFACE_OUTPUT||'artifacts/visual-surfaces-before';
const baseURL=process.env.BASE_URL||'http://127.0.0.1:5173';
await fs.mkdir(output,{recursive:true});
const sourceHashes=Object.fromEntries(await Promise.all(['render.js','assets.js'].map(async name=>[name,createHash('sha256').update(await fs.readFile(`${process.env.SOURCE_DIR||'src'}/${name}`)).digest('hex')])));
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseURL);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);
 const evidence=await page.evaluate(async()=>{
  const g=window.__BAMSONNIM__,v=g.view;g.pause();const{RECIPES}=await import('/src/data.js'),{ASSET_MANIFEST,foodFrame}=await import('/src/assets.js'),{furnitureArt}=await import('/src/furniture-placement.js');
  const actors=['empty','wanderer','student','rider','hostess','hiker','nurse','office'],directions=['SE','SW','NW','NE'];
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;
  const drawing=Object.create(v);Object.assign(drawing,{canvas,ctx:canvas.getContext('2d'),width:1000,height:700,hits:[],walkingStates:new WeakMap(),paymentEffects:[]});drawing.ctx.imageSmoothingEnabled=false;
  const calls=[],sprite=drawing.sprite;drawing.sprite=function(key,index,x,y,w,h,options){calls.push({key,index,x,y,w,h,flip:options?.flip});return sprite.call(this,key,index,x,y,w,h,options);};
  const sheets={},frames=[];
  for(const kind of ['chairs','chairs-eating','servers']){
   const isChair=kind.startsWith('chairs'),rows=isChair?actors.filter(id=>kind==='chairs'||id!=='empty'):RECIPES.map(r=>r.id),sheet=document.createElement('canvas');sheet.width=1120;sheet.height=rows.length*300;const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;
   for(let row=0;row<rows.length;row++)for(let dir=0;dir<4;dir++){
    const id=rows[row],o={uid:'surface-object',type:isChair?'chair':'server',x:3,y:3,dir,...(kind==='servers'?{foodId:id,stock:18}:{})};
    const s={...g.state,objects:[o],waiters:[],customers:isChair&&id!=='empty'?[{uid:'surface-guest',zombieId:id,x:3,y:3,phase:kind==='chairs-eating'?'eating':'waiting',seat:o.uid,path:[],wait:0,foodId:'kimchi',eatUntil:g.state.time+999}]:[]};
    // Hide only stock text in diagnostic server composites. Real screenshots below retain it.
    drawing.label=kind==='servers'?()=>{}:v.label;calls.length=0;drawing.draw(s,null,0,false);
    const p=drawing.world(3,3),left=dir*280,top=row*300;c.fillStyle='#18342d';c.fillRect(left,top,280,300);
    c.drawImage(canvas,p.x-70,p.y-105,140,130,left,top+30,280,260);
    c.fillStyle='#18342d';c.fillRect(left,top,280,30);c.fillStyle='#f1e6c8';c.font='16px NeoDunggeunmo';c.textAlign='center';c.fillText(`${id} · ${directions[dir]}`,left+140,top+22);
    c.strokeStyle='#83966a';c.strokeRect(left+.5,top+.5,279,299);
    let footprint=null;const art=furnitureArt('server',dir),surface=art?.surfacePolygon?{polygon:art.surfacePolygon,width:art.width,height:art.height}:ASSET_MANIFEST.serverIsometric?.surface;
    if(kind==='servers'&&surface){
     const server=calls.find(call=>call.key===art.key&&call.index===art.index),route=foodFrame(RECIPES.find(r=>r.id===id).sprite),food=calls.find(call=>call.key===route.key&&call.index===route.index),im=drawing.sprites[route.key][route.index],data=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
     const polygon=surface.polygon.map(([x,y])=>({x:server.x-server.w/2+server.w*(server.flip?1-x/surface.width:x/surface.width),y:server.y-server.h+server.h*y/surface.height}));
     const inside=p=>{let sign=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);if(Math.abs(cross)<1e-5)continue;const next=Math.sign(cross);if(sign&&sign!==next)return false;sign=next;}return true;};
     let minY=im.height,maxY=0;for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++)if(data[(y*im.width+x)*4+3]>80){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
     let sampled=0,outside=0;for(let y=Math.ceil(maxY-(maxY-minY)*.18);y<=maxY;y++)for(let x=0;x<im.width;x++)if(data[(y*im.width+x)*4+3]>80){sampled++;if(!inside({x:food.x-food.w/2+(x+.5)/im.width*food.w,y:food.y-food.h+(y+.5)/im.height*food.h}))outside++;}
     footprint={method:'Bottom 18% of opaque food silhouette projected into measured tabletop polygon',sampled,outside,polygon};
    }
    const frame={kind,id,dir,tile:drawing.tile,world:p,spriteCalls:structuredClone(calls),footprint};frames.push(frame);
    if(isChair&&id!=='empty'&&drawing.drawChairFront){
     const chairMeta=furnitureArt('chair',dir),chair=calls.find(call=>call.key===chairMeta.key&&call.index===chairMeta.index),body=calls.find(call=>['directional-atlas','seated-atlas'].includes(ASSET_MANIFEST[call.key]?.type)),hip=ASSET_MANIFEST[body.key].poses[body.index].hip,im=drawing.sprites[body.key][body.index];
     const seat={x:chair.x-chair.w/2+chair.w*chairMeta.seat.x/chairMeta.width,y:chair.y-chair.h+chair.h*chairMeta.seat.y/chairMeta.height},contact={x:body.x-body.w/2+body.w*hip.x/im.width,y:body.y-body.h+body.h*hip.y/im.height};
     frame.seatContact={seat,contact,error:Math.hypot(seat.x-contact.x,seat.y-contact.y)};
     const masked=drawing.ctx.getImageData(0,0,1000,700).data,originalFront=drawing.drawChairFront;drawing.drawChairFront=()=>{};drawing.draw(s,null,0,false);drawing.drawChairFront=originalFront;const unmasked=drawing.ctx.getImageData(0,0,1000,700).data;
     let count=0,minX=1000,minY=700,maxX=-1,maxY=-1;for(let i=0;i<masked.length;i+=4)if(masked[i]!==unmasked[i]||masked[i+1]!==unmasked[i+1]||masked[i+2]!==unmasked[i+2]){count++;const x=i/4%1000,y=Math.floor(i/4000);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
     const polygon=chairMeta.front?.map(([x,y])=>({x:chair.x-chair.w/2+chair.w*x/chairMeta.width,y:chair.y-chair.h+chair.h*y/chairMeta.height}));
     frame.foreground={changedPixels:count,bounds:count?{minX,minY,maxX,maxY}:null,maskBounds:polygon?{minX:Math.min(...polygon.map(p=>p.x)),minY:Math.min(...polygon.map(p=>p.y)),maxX:Math.max(...polygon.map(p=>p.x)),maxY:Math.max(...polygon.map(p=>p.y))}:null};
    }
   }sheets[kind]=sheet.toDataURL('image/png');
  }
  return{scope:'Paused synthetic fixtures. Actual RestaurantView.draw composition; server contact sheet omits stock text only. In-game screenshots retain stock text.',sheets,frames,failedAssets:v.failedAssets,loadedAssets:Object.keys(v.images)};
 });
 assert.deepEqual(evidence.failedAssets,[]);
 if(process.env.SURFACE_EXPECT_FIT==='1')for(const f of evidence.frames.filter(f=>f.kind==='servers')){assert.ok(f.footprint?.sampled>0);assert.equal(f.footprint.outside,0,`${f.id} direction ${f.dir}: food base stays within tabletop`);}
 if(process.env.SURFACE_EXPECT_FIT==='1')for(const f of evidence.frames.filter(f=>f.kind.startsWith('chairs')&&f.id!=='empty')){assert.ok(f.seatContact?.error<1e-5,`${f.id} direction ${f.dir}: hip contact meets cushion`);if(f.dir<2)assert.equal(f.foreground.changedPixels,0);else{assert.ok(f.foreground.changedPixels>0);const{bounds:b,maskBounds:m}=f.foreground;assert.ok(b.minX>=m.minX-1&&b.minY>=m.minY-1&&b.maxX<=m.maxX+1&&b.maxY<=m.maxY+1,`${f.id}: foreground changes remain in backrest mask`);}}
 for(const[key,url]of Object.entries(evidence.sheets))await fs.writeFile(`${output}/${key}-contact-sheet.png`,Buffer.from(url.split(',')[1],'base64'));delete evidence.sheets;
 for(const id of ['wanderer','student','rider','hostess','hiker','nurse','office']){
  await page.evaluate(id=>{const g=window.__BAMSONNIM__,s=g.state;g.pause();s.objects=[{uid:'surface-table',type:'table',x:3,y:3,dir:0},...[{x:2,y:3},{x:3,y:2},{x:4,y:3},{x:3,y:4}].map((p,dir)=>({uid:`surface-chair-${dir}`,type:'chair',...p,dir}))];s.waiters=[];s.customers=s.objects.filter(o=>o.type==='chair').map(o=>({uid:`surface-guest-${o.dir}`,zombieId:id,x:o.x,y:o.y,phase:o.dir%2?'eating':'waiting',path:[],wait:0,seat:o.uid,foodId:'rice',eatUntil:s.time+1000}));g.pause();},id);
  await page.waitForTimeout(100);await page.screenshot({path:`${output}/actual-chair-${id}.png`});
 }
 await page.evaluate(()=>{const g=window.__BAMSONNIM__,s=g.state;g.pause();s.customers=[];s.waiters=[];s.objects=[{x:2,y:2},{x:5,y:2},{x:2,y:5},{x:5,y:5}].map((p,dir)=>({uid:`surface-server-${dir}`,type:'server',...p,dir,foodId:['rice','soup','skewer','gimbap'][dir],stock:18}));g.pause();});
 await page.waitForTimeout(100);await page.screenshot({path:`${output}/actual-servers.png`});
 assert.deepEqual(errors,[]);await fs.writeFile(`${output}/results.json`,JSON.stringify({captureComplete:true,visualVerdict:'Requires explicit visual review; no automatic alignment approval',sourceHashes,...evidence,errors},null,2));
 console.log(JSON.stringify({captureComplete:true,frames:evidence.frames.length,loadedAssets:evidence.loadedAssets.length,output}));
}finally{await browser.close();}
