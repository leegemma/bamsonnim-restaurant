import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';

const output=process.env.SEATING_OUTPUT||'artifacts/visual-seating',baseURL=process.env.BASE_URL||'http://127.0.0.1:5173';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(baseURL);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>document.fonts.ready);
 const evidence=await page.evaluate(async()=>{
  const g=window.__BAMSONNIM__,v=g.view;g.pause();
  const {ASSET_MANIFEST,characterFrame,directionalCharacter}=await import('/src/assets.js'),{zombie}=await import('/src/data.js');
  let rows=Object.entries(ASSET_MANIFEST.seatedNeighbors.actorRows).map(([id,row])=>({id,row,key:'seatedNeighbors'}));
  if(ASSET_MANIFEST.seatedOffice&&v.sprites.seatedOffice?.length)rows.push({id:'office',row:0,key:'seatedOffice'});
  rows=rows.map(row=>{const meta=directionalCharacter(row.id);return meta?{...row,key:meta.key,directional:true,count:meta.walkFrames||meta.frames.walk.length}:row;});
  const cellWidth=260,cellHeight=230,sheet=document.createElement('canvas');sheet.width=cellWidth*4;sheet.height=cellHeight*rows.length;
  const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;
  const drawing=Object.create(v);drawing.ctx=c;drawing.tile=140;drawing.hits=[];drawing.walkingStates=new WeakMap();
  const actual=[],tiles=[];
  for(const {id,row,key,directional,count}of rows)for(let dir=0;dir<4;dir++){
   const expectedIndex=directional?dir*(count+1)+count:key==='seatedNeighbors'?row*4+dir:dir,meta=ASSET_MANIFEST[key],im=v.sprites[key][expectedIndex];
   const pixels=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
   tiles.push({id,dir,key,index:expectedIndex,width:im.width,height:im.height,opaque:pixels.some((n,i)=>i%4===3&&n>80),trim:meta.trim,referenceHeight:meta.referenceHeight,source:meta.poses?.[expectedIndex]?.source});
   const sheetRow=rows.findIndex(r=>r.id===id),left=dir*cellWidth,top=sheetRow*cellHeight,p={x:left+130,y:top+190};drawing.world=()=>p;
   c.fillStyle='#1b332c';c.fillRect(left,top,cellWidth,cellHeight);c.strokeStyle='#83966a';c.strokeRect(left+.5,top+.5,cellWidth-1,cellHeight-1);
   c.fillStyle='#efe5c8';c.textAlign='center';c.font='16px NeoDunggeunmo';c.fillText(`${id} · ${['SE','SW','NW','NE'][dir]}`,p.x,top+25);
   const chair={uid:'visual-chair',type:'chair',x:3,y:3,dir},s={...g.state,objects:[chair],customers:[]};
   const actor={uid:`visual-${id}-${dir}`,zombieId:id,x:3,y:3,phase:'waiting',path:[],seat:chair.uid,wait:0,foodId:'rice'};
   const calls=[],original=drawing.sprite;
   drawing.sprite=function(key,index,x,y,w,h,options){calls.push({key,index,x,y,w,h,flip:options?.flip});return original.call(this,key,index,x,y,w,h,options);};
   drawing.drawObject(s,chair,0,null);drawing.drawPerson(s,actor,false,0);
   const waiting=calls.find(call=>call.key===key);calls.length=0;
   // Draw into a separate canvas for clock equality; the real renderer does all drawing.
   const scratch=document.createElement('canvas');scratch.width=400;scratch.height=300;const beforeContext=drawing.ctx;drawing.ctx=scratch.getContext('2d');drawing.world=()=>({x:200,y:220});
   const drawPixels=clock=>{drawing.ctx.clearRect(0,0,400,300);drawing.drawPerson(s,actor,false,clock);return drawing.ctx.getImageData(0,0,400,300).data;};
   const a=drawPixels(1),b=drawPixels(9);let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;
   calls.length=0;drawing.drawPerson(s,{...actor,phase:'eating'},false,1);const eating=calls.find(call=>call.key===key);
   calls.length=0;drawing.drawPerson(s,{...actor,phase:'seating',path:[[4,3]]},false,1);const moving=calls.find(call=>!['food','furniture'].includes(call.key));
   drawing.ctx=beforeContext;drawing.sprite=original;
   actual.push({id,dir,key,expectedIndex,waiting,eating,moving,expectedMoving:directional?{key,index:0}:characterFrame(zombie(id).sprite),changedSeatedChannels:changed});
  }
  // First guest uses the currently selected metadata, including irregular source cells.
  const firstCanvas=document.createElement('canvas');firstCanvas.width=400;firstCanvas.height=300;drawing.ctx=firstCanvas.getContext('2d');
  const firstMeta=directionalCharacter('wanderer'),firstCount=firstMeta.walkFrames||firstMeta.frames.walk.length,first=[],firstWalk=[];for(let dir=0;dir<4;dir++){
   const chair={uid:'first-chair',type:'chair',x:3,y:3,dir},s={...g.state,objects:[chair]},calls=[],original=drawing.sprite;
   drawing.sprite=function(key,index,...args){calls.push({key,index});return original.call(this,key,index,...args);};
   drawing.drawPerson(s,{uid:`first-${dir}`,zombieId:'wanderer',x:3,y:3,phase:'waiting',seat:chair.uid,path:[],wait:0},false,0);first.push(calls.find(call=>call.key===firstMeta.key));
   const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][dir],walker={uid:`first-walk-${dir}`,zombieId:'wanderer',x:3,y:3,phase:'leaving',path:[[3+dx*2,3+dy*2]],wait:0};
   s.time=10;s.fraction=0;drawing.drawPerson(s,walker,false,10,true);const frames=[];for(let f=0;f<firstCount;f++){calls.length=0;walker.x+=dx*.05;walker.y+=dy*.05;s.time=10+((firstMeta.sequence||firstMeta.frames.walk).indexOf(f)+.2)/(firstMeta.fps||7);s.fraction=0;drawing.drawPerson(s,walker,false,s.time,true);frames.push(calls.find(call=>call.key===firstMeta.key));}firstWalk.push({dir,frames});drawing.sprite=original;
  }
  return{scope:'Synthetic paused rendering fixtures; no natural business simulation',rows,tiles,actual,first,firstWalk,firstCount,firstFrameCount:v.sprites[firstMeta.key].length,failedAssets:v.failedAssets,loadedAssets:Object.keys(v.images),sheet:sheet.toDataURL('image/png')};
 });
 assert.deepEqual(evidence.failedAssets,[]);assert.equal(evidence.tiles.length,evidence.rows.length*4);
 for(const t of evidence.tiles){assert.ok(t.opaque);assert.equal(t.trim,false);if(t.key==='seatedNeighbors'){assert.equal(t.width,280);assert.equal(t.height,270);assert.equal(t.source.y,24+Math.floor(t.index/4)*270);assert.equal(t.referenceHeight,280);}}
 for(const r of evidence.actual){for(const draw of [r.waiting,r.eating]){assert.equal(draw?.key,r.key);assert.equal(draw?.index,r.expectedIndex);assert.equal(draw?.flip,false);}assert.equal(r.moving.key,r.expectedMoving.key);assert.equal(r.moving.index,r.expectedMoving.index);assert.equal(r.changedSeatedChannels,0);}
 assert.equal(evidence.firstFrameCount,4*(evidence.firstCount+1));assert.deepEqual(evidence.first.map(p=>p.index),[0,1,2,3].map(dir=>dir*(evidence.firstCount+1)+evidence.firstCount));
 for(const {dir,frames}of evidence.firstWalk)assert.deepEqual([...new Set(frames.map(f=>f.index))].sort((a,b)=>a-b),Array.from({length:evidence.firstCount},(_,f)=>dir*(evidence.firstCount+1)+f));
 await fs.writeFile(`${output}/seated-contact-sheet.png`,Buffer.from(evidence.sheet.split(',')[1],'base64'));delete evidence.sheet;
 for(const row of evidence.rows){
  await page.evaluate(id=>{const g=window.__BAMSONNIM__,s=g.state;g.pause();s.objects=[{uid:'fixture-table',type:'table',x:3,y:3,dir:0},...[{x:2,y:3},{x:3,y:2},{x:4,y:3},{x:3,y:4}].map((p,dir)=>({uid:`fixture-chair-${dir}`,type:'chair',...p,dir}))];s.waiters=[];s.customers=s.objects.filter(o=>o.type==='chair').map(o=>({uid:`fixture-guest-${o.dir}`,zombieId:id,x:o.x,y:o.y,phase:o.dir%2?'eating':'waiting',path:[],wait:0,seat:o.uid,foodId:'rice',eatUntil:s.time+1000}));s.spawnIn=10000;g.pause();},row.id);
  await page.waitForTimeout(150);await page.screenshot({path:`${output}/actual-scene-${row.id}.png`});
 }
 assert.deepEqual(errors,[]);await fs.writeFile(`${output}/results.json`,JSON.stringify({status:'passed',...evidence,errors},null,2));console.log(JSON.stringify({status:'passed',actors:evidence.rows.map(r=>r.id),poses:evidence.actual.length,loadedAssets:evidence.loadedAssets.length}));
}finally{await browser.close();}
