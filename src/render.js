import {ASSETS,SKINS,WALK_ANIMATION,recipe,zombie,furniture,DIRECTIONS} from './data.js';
import {stoveStatus,placementProblem,seats} from './engine.js';
import {walkingPose} from './walking.js';
import {lockDirectionalHeads} from './sprite-heads.js';
import {guestDialogue} from './guest-dialogue.js';
import {splitGroundCompanions} from './sprite-companions.js';
import {eatingAnimationFrame,eatingSpriteFrame} from './eating.js';
import {registerEatingFrames} from './eating-registration.js';
import {BACKGROUND_SCENE} from './background-fx.generated.js';
import {backgroundFrame,backgroundFxGeometry} from './background-fx.js';
import {createCamera,cameraTransform,sceneToScreen,screenToScene,clientToScreen,clampCamera,zoomCameraAt,resizeCamera,visibleSceneRect,backgroundCopies} from './camera.js';
import {bindCameraGestures} from './camera-gestures.js';
import {furnitureArt,placedFurniture} from './furniture-placement.js';
import {ASSET_MANIFEST,characterFrame,directionalCharacter,eatingCharacter,foodFrame} from './assets.js';

export class RestaurantView{
  constructor(canvas,{onSelect,onTile,onHover,onCameraChange}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.images={};this.sprites={};this.hits=[];this.onSelect=onSelect;this.onTile=onTile;this.onHover=onHover;this.hover=null;this.width=0;this.height=0;this.walkingStates=new WeakMap();this.paymentEffects=[];this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    this.camera=createCamera();this.onCameraChange=onCameraChange;
    this.gestures=bindCameraGestures(canvas,{toScreen:e=>this.screenPoint(e),getCamera:()=>this.camera,getViewport:()=>this.viewport(),getBounds:()=>this.cameraBounds,setCamera:value=>this.commitCamera(value),onTap:p=>this.tapAt(this.screenToScene(p)),onHover:p=>{if(!this.origin)return;const point=this.screenToScene(p);this.hover=this.grid(point.x,point.y);this.onHover?.(this.hover);canvas.style.cursor=this.edit?'crosshair':this.hits.some(h=>point.x>=h.x&&point.x<=h.x+h.w&&point.y>=h.y&&point.y<=h.y+h.h)?'pointer':'default';},onLeave:()=>{this.hover=null;},onGestureChange:active=>{this.hover=null;canvas.style.cursor=active?'grabbing':this.edit?'crosshair':'default';}});
    this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(canvas);
  }
  async load(){
    this.ready=false;this.failedAssets=[];
    const priority=['food','furniture','workers','waiterTray','quarterFurniture','quarterServer','stoveIsometric','serverIsometric','woodenEntrance','night','poster'];
    const rank=key=>ASSET_MANIFEST[key].actorId==='wanderer'?2:priority.includes(key)?priority.indexOf(key):100;
    const queue=Object.entries(ASSETS).filter(([key])=>!ASSET_MANIFEST[key].archived).sort(([a],[b])=>rank(a)-rank(b));let next=0;
    const worker=async()=>{while(next<queue.length){const [key,url]=queue[next++],im=new Image();let timeout;im.src=url;
      try{
        await Promise.race([im.decode(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('이미지 응답 시간 초과')),12000);})]);
        if(key!=='night')this.cutAtlas(key,im,ASSET_MANIFEST[key]);
        // The renderer uses the cut cells; keep full decoded sheets only for
        // backgrounds that are drawn directly, allowing the rest to be freed.
        this.images[key]=['night','poster'].includes(key)?im:{src:im.src,width:im.width,height:im.height,naturalWidth:im.naturalWidth,naturalHeight:im.naturalHeight};
      }catch{this.failedAssets.push(key);im.src='';console.warn('이미지 로드 실패',url);}finally{clearTimeout(timeout);}
    }};
    await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));this.alignWalkFrames();this.alignEatingFrames();this.ready=true;
  }
  alignEatingFrames(){this.eatingRegistrations={};for(const meta of Object.values(ASSET_MANIFEST).filter(a=>a.type==='eating-atlas')){const base=ASSET_MANIFEST[meta.baseAtlas];if(this.sprites[meta.key]?.length&&this.sprites[base?.key]?.length)this.eatingRegistrations[meta.key]=registerEatingFrames(this.sprites[meta.key],meta,this.sprites[base.key],base);}}
  async getAssetSource(key){
    const cached=this.images[key];if(cached instanceof HTMLImageElement)return cached;
    if(!ASSETS[key])return null;const image=new Image();image.src=ASSETS[key];await image.decode();return image;
  }
  alignWalkFrames(){const frames=WALK_ANIMATION.keys.map(key=>this.sprites[key]?.[0]).filter(Boolean);if(!frames.length)return;const width=Math.max(...frames.map(f=>f.width)),height=Math.max(...frames.map(f=>f.height));for(const key of WALK_ANIMATION.keys){const frame=this.sprites[key]?.[0];if(!frame)continue;const aligned=document.createElement('canvas');aligned.width=width;aligned.height=height;aligned.getContext('2d').drawImage(frame,Math.round((width-frame.width)/2),height-frame.height);this.sprites[key][0]=aligned;}}
  cutAtlas(key,im,asset={}){
    const columns=asset.cols||asset.grid?.cols||1,rows=asset.rows||asset.grid?.rows||1,cw=asset.grid?.cellWidth||im.width/columns,ch=asset.grid?.cellHeight||im.height/rows;
    const sources=asset.poses?.length&&asset.type?.endsWith('-atlas')?asset.poses.map(p=>p.source):Array.from({length:columns*rows},(_,i)=>({x:(asset.grid?.x||0)+(i%columns)*cw,y:(asset.grid?.y||0)+Math.floor(i/columns)*ch,width:cw,height:ch}));
    this.sprites[key]=[];
    for(const source of sources){
      const c=document.createElement('canvas');c.width=Math.ceil(source.width);c.height=Math.ceil(source.height);const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,source.x,source.y,source.width,source.height,0,0,source.width,source.height);
      if(asset.trim===false||key==='wandererDirectional'){this.sprites[key].push(c);continue;}
      const pixels=ctx.getImageData(0,0,c.width,c.height);let minX=c.width,minY=c.height,maxX=0,maxY=0;
      for(let y=2;y<c.height-2;y++)for(let x=2;x<c.width-2;x++)if(pixels.data[(y*c.width+x)*4+3]>80){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      const out=document.createElement('canvas');out.width=Math.max(1,maxX-minX+1);out.height=Math.max(1,maxY-minY+1);if(minX<c.width)out.getContext('2d').drawImage(c,minX,minY,out.width,out.height,0,0,out.width,out.height);this.sprites[key].push(out);
    }
    this.headLocks??={};this.headLocks[key]=lockDirectionalHeads(this.sprites[key],asset);
    this.companions??={};this.companions[key]=splitGroundCompanions(this.sprites[key],asset);
  }

  measure(){
    const r=this.canvas.getBoundingClientRect(),next={width:r.width,height:r.height};this.camera??=createCamera();
    if(r.width>0&&r.height>0){Object.assign(this.camera,resizeCamera(this.camera,this.cameraViewport||next,next));this.cameraViewport=next;this.cameraBounds=null;if(this.gestures?.input.active)this.gestures.cancel();}
    this.width=r.width;this.height=r.height;this.backgroundFxClip=undefined;
    if(r.width<=700&&window.innerWidth>window.innerHeight){
      const rail=this.canvas.parentElement?.querySelector('.right-rail')?.getBoundingClientRect();
      // Cache stage-relative HUD geometry here, never in the animation loop.
      // Hidden edit controls retain the compact rail's 10px + 44px footprint.
      this.backgroundFxClip={right:rail?.width>0?rail.left-r.left-6:r.width-60};
    }
    const dpr=this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=Math.round(r.width*dpr);this.canvas.height=Math.round(r.height*dpr);this.ctx.setTransform(dpr,0,0,dpr,0,0);this.ctx.imageSmoothingEnabled=false;
  }
  viewport(){return{width:this.width,height:this.height};}
  screenPoint(e){return clientToScreen(e,this.canvas.getBoundingClientRect(),this.viewport());}
  point(e){return this.screenToScene(this.screenPoint(e));}
  sceneToScreen(point){return sceneToScreen(point,this.camera,this.viewport());}
  screenToScene(point){return screenToScene(point,this.camera,this.viewport());}
  commitCamera(value){const next=clampCamera(value,this.viewport(),this.cameraBounds),old=this.camera||createCamera(),changed=Object.keys(next).some(k=>Math.abs(next[k]-old[k])>1e-8);this.camera??=createCamera();Object.assign(this.camera,next);if(changed){this.hover=null;this.onCameraChange?.({...this.camera});}}
  resetCamera(){if(this.gestures?.input.active)this.gestures.cancel();this.commitCamera(createCamera());}
  zoomCamera(factor,anchor){this.commitCamera(zoomCameraAt(this.camera,factor,anchor,this.viewport(),this.cameraBounds));}
  tapAt(p){if(!this.origin||this.gestures?.input.active)return;if(this.edit?.ghost){this.onTile?.(this.grid(p.x,p.y));return;}const hit=[...this.hits].reverse().find(h=>p.x>=h.x&&p.x<=h.x+h.w&&p.y>=h.y&&p.y<=h.y+h.h);if(hit)this.onSelect?.(hit);else if(this.edit)this.onTile?.(this.grid(p.x,p.y));}
  world(x,y){return{x:this.origin.x+(x-y)*this.tile/2,y:this.origin.y+(x+y)*this.tile/4};}
  grid(x,y){const a=(x-this.origin.x)/(this.tile/2),b=(y-this.origin.y)/(this.tile/4);return{x:Math.floor((a+b)/2+.5),y:Math.floor((b-a)/2+.5)};}
  polygon(points,fill,stroke=null,line=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
  sprite(key,index,x,y,width,height,options={}){const im=this.sprites[key]?.[index],h=height||(im?width*im.height/im.width:width),w=width,c=this.ctx;c.save();if(options.alpha!==undefined)c.globalAlpha=options.alpha;if(options.filter)c.filter=options.filter;if(!im){c.fillStyle='#8b9c75';c.fillRect(x-w*.3,y-h*.7,w*.6,h*.7);c.fillStyle='#263b31';c.font='12px NeoDunggeunmo,monospace';c.textAlign='center';c.fillText((key==='food'||ASSET_MANIFEST[key]?.type==='food-atlas')?'요리':key==='furniture'?'가구':'손님',x,y-h*.2);}else if(options.flip){c.translate(x,y);c.scale(-1,1);c.drawImage(im,-w/2,-h,w,h);}else c.drawImage(im,x-w/2,y-h,w,h);c.restore();}
  label(text,x,y,{color='#f5e7c5',background='#263b31',small=false,border='#a6ad75',width=null}={}){
    const c=this.ctx,fontSize=small?14:16;c.font=`${fontSize}px NeoDunggeunmo,monospace`;const w=width||Math.ceil(c.measureText(text).width)+16,h=small?24:28,left=Math.round(x-w/2),top=Math.round(y-h);
    this.labelRects?.push({x:left,y:top,w:w+3,h:h+3});
    c.fillStyle='#0c181a';c.fillRect(left+3,top+3,w,h);c.fillStyle=border;c.fillRect(left+2,top,w-4,h);c.fillRect(left,top+2,w,h-4);c.fillStyle=background;c.fillRect(left+3,top+2,w-6,h-4);c.fillRect(left+2,top+3,w-4,h-6);
    c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.fillText(text,Math.round(x),top+h/2+1);
  }
  furnitureGeometry(o){
    const category=furniture(o.type)?.category,art=furnitureArt(category,o.dir||0),image=art&&this.sprites[art.key]?.[art.index];
    return placedFurniture(art,image,this.world(o.x,o.y),this.tile,['stove','server'].includes(category)&&o.dir%2===1);
  }
  serverFoodLayout(o){
    const t=this.tile,p=this.world(o.x,o.y),geometry=this.furnitureGeometry(o),anchor=geometry?.surface||{x:p.x,y:p.y-t*.49};
    const {key,index}=foodFrame(recipe(o.foodId)?.sprite||0),food=this.sprites[key]?.[index],width=t*.42,height=food?width*food.height/food.width:t*.32;
    return{key,index,x:anchor.x,y:anchor.y+height*.14,width,height,surface:anchor};
  }
  drawFoodOnSurface(foodId,x,y,width,options={}){
    const {key,index}=foodFrame(recipe(foodId)?.sprite||0),im=this.sprites[key]?.[index],h=im?width*im.height/im.width:width;
    this.sprite(key,index,x,y+h*.14,width,h,options);
  }
  chairGeometry(o){return this.furnitureGeometry(o);}
  drawChairFront(chair){
    const {meta,im,x,y,w,h}=this.chairGeometry(chair);if(!im||!meta.front)return;
    const c=this.ctx;c.save();c.beginPath();meta.front.forEach(([px,py],i)=>{const a=x+w*px/meta.width,b=y+h*py/meta.height;i?c.lineTo(a,b):c.moveTo(a,b);});c.closePath();c.clip();c.drawImage(im,x,y,w,h);c.restore();
  }
  stoveControlLayout(s){
    const c=this.ctx;c.font='14px NeoDunggeunmo,monospace';
    const items=s.objects.filter(o=>furniture(o.type)?.category==='stove').map(o=>{
      const status=stoveStatus(s,o),p=this.world(o.x,o.y),remain=Math.max(0,(o.cook?.readyAt||0)-s.time),text=status==='empty'?'+ COOK':status==='cooking'?(remain<60?`${Math.ceil(remain)}초`:`${Math.ceil(remain/60)}분`):status==='done'?'DONE':status==='collecting'?'운반 중':'상했어요';
      const geometry=this.furnitureGeometry(o),visibleTop=geometry?geometry.y+geometry.h*(geometry.meta.bounds?.y||0)/geometry.meta.height:p.y-this.tile*.86;return{o,status,text,sourceX:p.x,sourceY:visibleTop+this.tile*.06,x:p.x,y:Math.max(28,visibleTop-this.tile*.12),width:Math.ceil(c.measureText(text).width)+16};
    }).sort((a,b)=>a.x-b.x||a.y-b.y);
    // Nearest non-overlapping horizontal positions, keeping the pot's own
    // isometric height. Pool adjacent conflicts instead of alternating offsets.
    const blocks=[];let offset=0;
    items.forEach((item,i)=>{if(i)offset+=(items[i-1].width+item.width)/2+8;item.offset=offset;blocks.push({start:i,end:i,sum:item.x-offset,count:1});while(blocks.length>1){const b=blocks.at(-1),a=blocks.at(-2);if(a.sum/a.count<=b.sum/b.count)break;blocks.splice(-2,2,{start:a.start,end:b.end,sum:a.sum+b.sum,count:a.count+b.count});}});
    for(const block of blocks)for(let i=block.start;i<=block.end;i++)items[i].x=block.sum/block.count+items[i].offset;
    if(items.length){const left=items[0].x-items[0].width/2,right=items.at(-1).x+items.at(-1).width/2,shift=left<8?8-left:right>this.width-8?this.width-8-right:0;for(const item of items)item.x+=shift;}
    return new Map(items.map(item=>[item.o.uid,item]));
  }
  drawBackgroundEffects(s,background){
    const c=this.ctx;this.backgroundEffects=[];
    for(const placement of BACKGROUND_SCENE?.placements||[]){
      const meta=ASSET_MANIFEST[placement.key],index=backgroundFrame(placement.kind,s.time+(s.fraction||0),{reducedMotion:this.motionPreference.matches,offset:placement.offset||0}),image=this.sprites[placement.key]?.[index];
      if(!image)continue;
      const bounds=backgroundFxGeometry(background,{width:this.width,height:this.height},placement,image,meta.poses[index],this.backgroundFxClip);
      c.drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height);
      this.backgroundEffects.push({key:placement.key,kind:placement.kind,index,...bounds});
    }
  }
  draw(s,edit,clock,playing=true){
    if(!this.width)return;const effectClock=clock;if(this.motionPreference.matches)clock=0;this.animating=playing&&!edit;const c=this.ctx,W=this.width,H=this.height,dpr=this.dpr||1;this.edit=edit;this.hits=[];c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,H);
    const availableH=H-(edit?150:0);this.tile=Math.min(83,(W-(W<800?165:260))/s.size,availableH<400?(availableH-30)/(s.size*.5+1.5):(availableH-155)/(s.size/2));this.tile=Math.max(22,this.tile);const n=s.size;this.origin={x:W*(W<750?.57:.575),y:(availableH-n*this.tile/2)/2+(availableH<400?this.tile*.6:58)};
    const left=this.world(-.5,n-.5),right=this.world(n-.5,-.5),front=this.world(n-.5,n-.5),back=this.world(-.5,-.5);
    this.cameraBounds={x:left.x-20,y:back.y-this.tile*1.4-18,width:right.x-left.x+40,height:front.y+55-(back.y-this.tile*1.4-18)};this.commitCamera(this.camera);
    const matrix=cameraTransform(this.camera,this.viewport()),visible=visibleSceneRect(this.camera,this.viewport());c.save();c.setTransform(dpr*matrix.zoom,0,0,dpr*matrix.zoom,dpr*matrix.x,dpr*matrix.y);c.imageSmoothingEnabled=false;
    const bg=this.images.night;if(bg){c.globalAlpha=.6;for(const copy of backgroundCopies(bg,this.viewport(),this.camera)){if(!copy.flipX&&!copy.flipY)c.drawImage(bg,copy.x,copy.y,copy.width,copy.height);else{c.save();c.translate(copy.x+(copy.flipX?copy.width:0),copy.y+(copy.flipY?copy.height:0));c.scale(copy.flipX?-1:1,copy.flipY?-1:1);c.drawImage(bg,0,0,copy.width,copy.height);c.restore();}}this.drawBackgroundEffects(s,bg);c.globalAlpha=1;}
    const grd=c.createLinearGradient(0,visible.y,0,visible.y+visible.height);grd.addColorStop(0,'#102c2822');grd.addColorStop(1,'#0c2528aa');c.fillStyle=grd;c.fillRect(visible.x,visible.y,visible.width,visible.height);
    this.polygon([{x:left.x-20,y:left.y+12},{x:front.x,y:front.y+30},{x:right.x+20,y:right.y+12},{x:back.x,y:back.y}], '#07191c66');
    this.polygon([left,front,{x:front.x,y:front.y+21},{x:left.x,y:left.y+21}],'#443f34','#1e3029',2);
    this.polygon([front,right,{x:right.x,y:right.y+21},{x:front.x,y:front.y+21}],'#554735','#23332b',2);
    const floor=SKINS.find(x=>x.id===s.floor)?.color||'#aa774b';
    for(let sum=0;sum<n*2;sum++)for(let x=0;x<n;x++){const y=sum-x;if(y<0||y>=n)continue;const p=[this.world(x-.5,y-.5),this.world(x+.5,y-.5),this.world(x+.5,y+.5),this.world(x-.5,y+.5)];this.polygon(p,floor,'#543f2b88',1);const tone=(x*17+y*29)%5;c.fillStyle=tone%2?'#f5c67c13':'#25190f12';c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fill();for(let j=1;j<=2;j++){const a=this.world(x-.5+j/3,y-.5),b=this.world(x-.5+j/3,y+.5);c.strokeStyle='#4e382529';c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}if((x+y)%3===0){const p=this.world(x+.1,y);c.fillStyle='#e9ba7522';c.fillRect(p.x,p.y,7,1);}}
    const wh=this.tile*1.4,wall=SKINS.find(x=>x.id===s.wall)?.color||'#d9c39b';
    for(const axis of [0,1])for(let i=0;i<n;i++){
      const a=axis?this.world(-.5,i-.5):this.world(i-.5,-.5),b=axis?this.world(-.5,i+.5):this.world(i+.5,-.5);
      this.polygon([a,b,{x:b.x,y:b.y-wh},{x:a.x,y:a.y-wh}],wall,'#62432b',2);
      for(let k=1;k<4;k++){const t=k/4;c.strokeStyle='#6e4b3099';c.lineWidth=2;c.beginPath();c.moveTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-8);c.lineTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-wh+8);c.stroke();}
      for(let k=1;k<4;k++){c.beginPath();c.moveTo(a.x,a.y-wh*k/4);c.lineTo(b.x,b.y-wh*k/4);c.stroke();}
      c.strokeStyle='#483227';c.lineWidth=6;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x,a.y-wh);c.stroke();
      this.polygon([{x:a.x-4,y:a.y-wh},{x:b.x+4,y:b.y-wh},{x:b.x+4,y:b.y-wh-13},{x:a.x-4,y:a.y-wh-13}],'#283c3b','#122a2c',2);
      c.strokeStyle='#57716b';c.lineWidth=1;for(let k=0;k<3;k++){const t=k/3;c.beginPath();c.moveTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-wh);c.lineTo(a.x+(b.x-a.x)*t+3,a.y+(b.y-a.y)*t-wh-13);c.stroke();}
    }
    const entranceImage=this.sprites.woodenEntrance?.[0];if(entranceImage){const entrance=this.world(-.5,n-1),doorHeight=this.tile*1.32,doorWidth=doorHeight*entranceImage.width/entranceImage.height;c.save();c.transform(1,-.5,0,1,entrance.x-doorWidth/2,entrance.y+doorWidth/4);c.drawImage(entranceImage,0,-doorHeight,doorWidth,doorHeight);c.restore();}
    // Warm pools of lantern light stay behind the game objects.
    for(const o of s.objects.filter(o=>['lantern','xmas-lantern','stove'].includes(o.type))){const p=this.world(o.x,o.y),g=c.createRadialGradient(p.x,p.y,1,p.x,p.y,this.tile*1.3);g.addColorStop(0,'#ffd58024');g.addColorStop(1,'#ffd58000');c.fillStyle=g;c.fillRect(p.x-this.tile*1.3,p.y-this.tile*1.3,this.tile*2.6,this.tile*2.6);}
    if(edit)for(let x=0;x<n;x++)for(let y=0;y<n;y++){const p=[this.world(x-.5,y-.5),this.world(x+.5,y-.5),this.world(x+.5,y+.5),this.world(x-.5,y+.5)];this.polygon(p,'#c3d58b08','#e3e2a33b');}
    const entities=s.objects.map(o=>({kind:'object',value:o,depth:o.x+o.y+.1}));
    for(const seat of seats(s))if(seat.chair.dirty)entities.push({kind:'empty-dish',value:seat,depth:seat.table.x+seat.table.y+.2});
    for(const w of s.waiters)entities.push({kind:'waiter',value:w,depth:w.x+w.y+.3});
    for(const z of s.customers){entities.push({kind:'customer',value:z,depth:z.x+z.y+.3});if(z.phase==='eating'){const seat=seats(s).find(item=>item.uid===z.seat);if(seat?.table)entities.push({kind:'meal',value:z,depth:seat.table.x+seat.table.y+.2});}}
    entities.sort((a,b)=>a.depth-b.depth);
    this.guestLabels=[];this.labelRects=[];
    for(const e of entities){if(e.kind==='object')this.drawObject(s,e.value,clock,edit);else if(e.kind==='meal')this.drawMeal(s,e.value);else if(e.kind==='empty-dish')this.drawEmptyDish(e.value);else this.drawPerson(s,e.value,e.kind==='waiter',clock);}
    // Controls share one layout pass, with each displaced badge tied to its pot.
    this.stoveControls=this.stoveControlLayout(s);
    if(!edit){
      for(const control of this.stoveControls.values())if(Math.abs(control.x-control.sourceX)>2){c.strokeStyle='#bda77b';c.lineWidth=1;c.beginPath();c.moveTo(Math.round(control.x),control.y+9);c.lineTo(Math.round(control.x),control.sourceY-3);c.lineTo(control.sourceX,control.sourceY);c.stroke();}
      for(const control of this.stoveControls.values()){
        const {o,status,text,x,y,width}=control,options=status==='cooking'?{background:'#6b4d33',border:'#d6ae66'}:status==='done'?{background:'#c2cf8b',color:'#273d2b',border:'#f5ecc0'}:status==='spoiled'?{background:'#704a4a',border:'#d58e75'}:{};
        this.label(text,x,y,{small:true,width,...options});
        if(status==='cooking'){const r=recipe(o.cook.foodId),progress=Math.max(0,Math.min(1,1-(o.cook.readyAt-s.time)/r.duration)),barWidth=width-10;c.fillStyle='#342b24';c.fillRect(x-barWidth/2,y+4,barWidth,3);c.fillStyle='#e4b76b';c.fillRect(x-barWidth/2,y+4,barWidth*progress,3);}
        this.hits.push({kind:'stove',uid:o.uid,x:x-width/2,y:y-24,w:width,h:32});
      }
      for(const o of s.objects)if(furniture(o.type)?.category==='server'&&(o.stock>0||o.reservedFood)){const carrying=s.waiters.some(w=>w.task?.kind==='serve'&&w.task.server===o.uid&&w.task.picked),food=this.serverFoodLayout(o),labelY=o.stock>0?food.y-food.height-8:food.surface.y-this.tile*.14;this.label(o.stock>0?`${Math.ceil(o.stock)}개`:carrying?'서빙 중':'운반 예약',food.x,labelY,{small:true,background:'#eee0ba',color:'#50452e',border:'#9d8555'});}
    }
    if(edit?.ghost){const g=edit.ghost,t={x:g.x??3,y:g.y??3},error=placementProblem(s,g.type,t.x,t.y,g.dir,g.existing),p=this.world(t.x,t.y);this.polygon([this.world(t.x-.5,t.y-.5),this.world(t.x+.5,t.y-.5),this.world(t.x+.5,t.y+.5),this.world(t.x-.5,t.y+.5)],error?'#d97e6c88':'#bacb8799',error?'#fa9789':'#deefba',2);this.drawObject(s,{type:g.type,x:t.x,y:t.y,dir:g.dir,uid:'ghost'},clock,{ghost:true});}
    const door=this.world(0,n-.5);if(!edit){c.fillStyle='#ded1a0';c.font='12px NeoDunggeunmo,monospace';c.textAlign='center';c.textBaseline='alphabetic';c.fillText('어서 오세요',door.x-4,door.y+34);}
    for(let i=0;i<16;i++){const x=(Math.sin(i*77.1)*.5+.5)*W,y=(Math.cos(i*31.4)*.5+.5)*H;const a=(Math.sin(clock*1.5+i*2)+1)/2;c.fillStyle=`rgba(226,220,143,${a*.6})`;c.fillRect(Math.round(x+Math.sin(clock*.4+i)*12),Math.round(y+Math.cos(clock*.3+i)*8),2,2);}
    if(s.feverUntil>s.time){c.save();c.setTransform(dpr,0,0,dpr,0,0);c.strokeStyle=`rgba(242,202,103,${.3+Math.sin(clock*7)*.2})`;c.lineWidth=5;c.strokeRect(3,3,W-6,H-6);c.restore();}
    if(!edit){this.drawPaymentEffects(effectClock);this.drawGuestLabels();}
    this.guestLabels=null;this.labelRects=null;c.restore();
  }
  drawGuestLabels(){
    this.dialogueLayout=[];
    for(const item of [...(this.guestLabels||[])].reverse()){
      this.ctx.font='14px NeoDunggeunmo,monospace';const w=Math.ceil(this.ctx.measureText(item.text).width)+16;
      if(w+11>this.width)continue;
      const x=Math.max(w/2+4,Math.min(this.width-w/2-7,item.x));
      for(const rise of [0,30]){const y=Math.max(28,Math.min(this.height-7,item.y-rise)),box={x:Math.round(x-w/2),y:Math.round(y-24),w:w+3,h:27};
        if(this.labelRects.some(b=>box.x<b.x+b.w+5&&box.x+box.w+5>b.x&&box.y<b.y+b.h+5&&box.y+box.h+5>b.y))continue;
        this.label(item.text,x,y,item.options);this.dialogueLayout.push({...box,text:item.text});break;
      }
    }
  }
  addPaymentEffect(event){if(![event.amount,event.xp,event.x,event.y].every(Number.isFinite))return;this.paymentEffects.push({amount:event.amount,xp:event.xp,x:event.x,y:event.y,favorite:!!event.favorite,startedAt:performance.now()/1000});this.paymentEffects=this.paymentEffects.slice(-20);}
  drawPaymentEffects(clock){const c=this.ctx,reduced=this.motionPreference.matches;this.paymentEffects=this.paymentEffects.filter(effect=>clock-effect.startedAt<1.9);for(const effect of this.paymentEffects){const age=Math.max(0,clock-effect.startedAt),p=this.world(effect.x,effect.y),rise=reduced?0:Math.floor(age*14)*2,y=p.y-this.tile*1.15-rise;c.save();c.globalAlpha=reduced?1:Math.max(.25,Math.min(1,Math.ceil((1.9-age)/.4)/4));if(age<1.6){this.sprite('food',15,p.x-34,y,22,22);this.label(`+${effect.amount} 코인`,p.x+18,y,{small:true,color:'#ffe39b',background:'#423520',border:'#d7b36c'});}if(age>=.35)this.label(`+${effect.xp} XP`,p.x+8,y+28,{small:true,color:'#cbecdf',background:'#213e35',border:'#9cbf9b'});if(effect.favorite){const heart=['0110110','1111111','1111111','0111110','0011100','0001000'];c.fillStyle='#e59aab';heart.forEach((row,yy)=>[...row].forEach((bit,xx)=>{if(bit==='1')c.fillRect(Math.round(p.x+53+xx*2),Math.round(y-18+yy*2),2,2);}));}c.restore();}}
  drawObject(s,o,clock,edit){
    const f=furniture(o.type);if(!f)return;const p=this.world(o.x,o.y),t=this.tile;let index=f.sprite;
    if(f.category==='chair')index=[1,2,3,4][o.dir||0];
    const sizing={table:[t*.94,t*.83],chair:[t*.65,t*.92],stove:[t*.94,t*.98],server:[t*1.03,t*.78],decor:[t*.7,t*.9]};let [w,h]=sizing[f.category]||sizing.decor;
    if(f.category==='chair'){const geometry=this.chairGeometry(o);w=geometry.w;h=geometry.h;}
    const isometricKey=f.category==='stove'?'stoveIsometric':f.category==='server'?'serverIsometric':null,isometricImage=this.sprites[isometricKey]?.[0];
    if(isometricImage){w=t*(f.category==='stove'?1.04:1.1);h=w*isometricImage.height/isometricImage.width;}
    if(o.type==='lantern'){h=t*1.2;const image=this.sprites.furniture?.[index];w=image?h*image.width/image.height:t*.6;}else if(!isometricImage&&f.category!=='chair'){const image=this.sprites.furniture?.[index];if(image){const scale=Math.min(w/image.width,h/image.height);w=image.width*scale;h=image.height*scale;}}
    const placed=this.furnitureGeometry(o);if(placed){w=placed.w;h=placed.h;}
    const selected=edit?.selected===o.uid;this.ctx.save();if(selected)this.ctx.filter='brightness(1.35)';
    if(o.type==='poster'){
      const wallPoint=o.y===0?this.world(o.x,-.5):this.world(-.5,o.y),slope=o.y===0?.5:-.5;
      w=t*.62;h=w*1.5;const c=this.ctx,y=wallPoint.y-t*.22;
      c.save();c.transform(1,slope,0,1,wallPoint.x-w/2,y-slope*w/2);
      if(this.images.poster)c.drawImage(this.images.poster,0,-h,w,h);else{c.fillStyle='#e9dbb4';c.fillRect(0,-h,w,h);}
      c.fillStyle='#362d24';c.textAlign='center';c.font=`bold ${Math.max(6,t*.075)}px NeoDunggeunmo,monospace`;c.fillText('뇌 주먹밥',w/2,-h*.84);c.fillStyle='#955a44';c.fillText('의 효능',w/2,-h*.7);c.restore();
      this.hits.push({kind:'object',uid:o.uid,x:wallPoint.x-w/2,y:y-h-Math.abs(slope)*w/2,w,h:h+Math.abs(slope)*w});
    }else this.sprite(placed?.meta.key||(isometricImage?isometricKey:'furniture'),placed?.meta.index??(isometricImage?0:index),placed?.centerX??p.x,placed?.bottom??p.y+t*.15,w,h,{flip:placed?.flip??(!!isometricImage&&o.dir%2===1),alpha:edit?.ghost?.existing===o.uid ? .35 : edit?.ghost===true ? .7 : 1});this.ctx.restore();
    if(o.type==='poster')return;
    if(f.category==='server'&&o.stock>0){const food=this.serverFoodLayout(o);this.sprite(food.key,food.index,food.x,food.y,food.width,food.height);}
    if(f.category==='stove'&&o.cook){const status=stoveStatus(s,o);if(status!=='cooking')this.drawFoodOnSurface(o.cook.foodId,placed?.surface?.x??p.x,placed?.surface?.y??p.y-t*.48,t*.44,{filter:status==='spoiled'?'hue-rotate(100deg) saturate(.45)':''});else{const c=this.ctx;c.fillStyle='#f3ebc488';for(let i=0;i<3;i++){const phase=(clock*.6+i*.3)%1;c.fillRect(p.x-13+i*12+Math.sin(clock*2+i)*3,p.y-t*.72-phase*20,4,6);}}}
    this.hits.push({kind:'object',uid:o.uid,x:(placed?.x??p.x-w/2)+w*.04,y:placed?.y??p.y-h+t*.12,w:w*.92,h});
  }
  drawPerson(s,a,waiter,clock,active=this.animating!==false){
    const c=this.ctx,p=this.world(a.x,a.y),walking=!!a.path?.length,bob=walking?Math.sin(clock*12)*1.7:Math.sin(clock*2+a.x)*.6,t=this.tile,def=waiter?null:zombie(a.zombieId),isSeated=['waiting','eating'].includes(a.phase),short=def?.id==='prince';
    c.fillStyle='#17282644';c.beginPath();c.ellipse(p.x,p.y+3,t*.18,t*.075,0,0,Math.PI*2);c.fill();
    const chair=isSeated?s.objects.find(o=>o.uid===a.seat):null;
    const directionalMeta=!waiter?directionalCharacter(a.zombieId):null;
    const pose=directionalMeta?walkingPose(a,this.walkingStates.get(a),{reducedMotion:this.motionPreference.matches,active,time:s.time+(s.fraction||0),seatedDirection:chair?.dir??null,frameCount:directionalMeta.walkFrames||directionalMeta.frames.walk.length,fps:directionalMeta.fps||7,keys:null,sequence:directionalMeta.sequence||null}):null;
    if(pose)this.walkingStates.set(a,pose);
    let flip=pose?pose.flip:walking&&(a.path[0][0]-a.x)-(a.path[0][1]-a.y)<0;
    const mapped=waiter&&this.sprites.workers?.length?{key:'workers',index:a.appearance??Math.max(0,s.waiters.indexOf(a))}:characterFrame(waiter?15:def?.sprite||0);let atlas=mapped.key,index=mapped.index;
    const directional=!!pose&&!!this.sprites[directionalMeta.key]?.length;
    const seatedRow=ASSET_MANIFEST.seatedNeighbors?.actorRows?.[a.zombieId],officeSeat=a.zombieId==='office'&&!!this.sprites.seatedOffice?.length,dedicatedSeat=!waiter&&isSeated&&!!chair&&(officeSeat||seatedRow!==undefined&&!!this.sprites.seatedNeighbors?.length);
    let h=t*(short?.8:waiter?1.02:1.07),w;
    if(directional){const frameCount=directionalMeta.walkFrames||directionalMeta.frames.walk.length;atlas=directionalMeta.key;index=pose.direction*(frameCount+1)+(isSeated?frameCount:pose.frame);flip=false;}
    else if(dedicatedSeat){atlas=officeSeat?'seatedOffice':'seatedNeighbors';index=(officeSeat?0:seatedRow*4)+(chair.dir||0);flip=false;}
    if(directional&&chair&&a.phase==='eating'){const extra=eatingCharacter(a.zombieId);if(extra&&this.sprites[extra.key]?.length){const selected=eatingSpriteFrame(directionalMeta,extra,pose.direction,eatingAnimationFrame(a,s.time+(s.fraction||0),{reducedMotion:this.motionPreference.matches}));if(selected){atlas=selected.key;index=selected.index;}}}
    const image=this.sprites[atlas]?.[index];
    // Scale uniformly: preserve the actual character silhouette instead of
    // stretching every image into a fixed width/height rectangle.
    let y=p.y+5+(isSeated||pose||this.motionPreference.matches?0:bob);
    if(directional||dedicatedSeat){
      const meta=ASSET_MANIFEST[atlas],cellHeight=image?.height||meta.cell?.height||280;
      const hip=isSeated&&chair?(this.eatingRegistrations?.[atlas]?.[index]?.hip||meta.poses?.[index]?.hip):null,anchor=hip||meta.poses?.[index]?.anchor||meta.anchor||{x:140,y:270};
      const standingHeight=meta.referenceHeight||257,scale=h/standingHeight;
      for(const companion of this.companions?.[atlas]?.[index]||[]){const offset=companion.relativeGroundOffset||{x:0,y:0},foot=companion.footAnchor,im=companion.image;this.ctx.drawImage(im,p.x+offset.x*h-foot.x*scale,p.y+5+offset.y*h-foot.y*scale,im.width*scale,im.height*scale);}
      w=(image?.width||280)*scale;h=cellHeight*scale;
      const offsetX=((image?.width||280)/2-anchor.x)*scale;
      const attachment=hip?this.chairGeometry(chair).seat:{x:p.x,y};
      this.sprite(atlas,index,attachment.x+offsetX,attachment.y+(cellHeight-anchor.y)*scale,w,h,{flip:false,filter:a.red?'hue-rotate(290deg) saturate(1.7)':''});
    }else{
      if(isSeated)h*=.86;
      w=h*(image?image.width/image.height:.64);
      this.sprite(atlas,index,p.x,y,w,h,{flip,filter:a.red?'hue-rotate(290deg) saturate(1.7)':waiter&&a.infectedUntil>s.time?'hue-rotate(65deg) saturate(.7)':''});
    }
    if(waiter){const trayX=p.x+(flip?-1:1)*t*.15,trayY=y-h*.22,tray=this.sprites.waiterTray?.[0],scale=tray?t*.46/tray.width:1,anchor=ASSET_MANIFEST.waiterTray?.foodAnchor;if(tray)this.sprite('waiterTray',0,trayX,trayY,t*.46,null,{flip});const foodY=tray&&anchor?trayY-(tray.height-anchor.y)*scale:trayY-t*.13;if(a.task?.picked&&['transfer','serve'].includes(a.task.kind)&&recipe(a.task.foodId))this.drawFoodOnSurface(a.task.foodId,trayX,foodY,t*.3);}
    if(a.phase==='eating'&&chair&&!seats(s).find(seat=>seat.uid===a.seat)?.table){const seat=this.chairGeometry(chair).seat,[dx,dy]=DIRECTIONS[chair.dir||0];this.drawFoodOnSurface(a.foodId,seat.x+(dx-dy)*t*.12,seat.y+(dx+dy)*t*.06,t*.27);}
    if(chair)this.drawChairFront(chair);
    if(a.red)this.label('!',p.x,p.y-h-1,{small:true,background:'#b65d4f',border:'#efbd82'});
    else if(waiter&&a.infectedUntil>s.time)this.label('치료',p.x,p.y-h,{small:true,background:'#8d5f66'});
    else if(!waiter){const line=guestDialogue(a,{favorite:zombie(a.zombieId)?.favorite===a.foodId,time:s.time+(s.fraction||0)});if(line){const options={small:true,...(a.phase==='waiting'?{background:'#8b633d'}:{})};if(this.guestLabels)this.guestLabels.push({text:line,x:p.x,y:p.y-h,options});else this.label(line,p.x,p.y-h,options);}}
    if(waiter)this.hits.push({kind:'waiter',uid:a.uid,x:p.x-w/2,y:p.y-h,w,h});
  }
  drawMeal(s,customer){const seat=seats(s).find(item=>item.uid===customer.seat);if(!seat?.table)return;const table=seat.table,dx=seat.chair.x-table.x,dy=seat.chair.y-table.y,p=this.world(table.x+dx*.4,table.y+dy*.4);const center=this.world(table.x,table.y),surface=this.furnitureGeometry(table)?.surface||{x:center.x,y:center.y-this.tile*.39};this.drawFoodOnSurface(customer.foodId,surface.x+p.x-center.x,surface.y+p.y-center.y,this.tile*.27);}
  drawEmptyDish(seat){const {table,chair}=seat,dx=chair.x-table.x,dy=chair.y-table.y,point=this.world(table.x+dx*.4,table.y+dy*.4),center=this.world(table.x,table.y),surface=this.furnitureGeometry(table)?.surface||{x:center.x,y:center.y-this.tile*.39},width=this.tile*.27,height=width*20/32;this.sprite('emptyDish',0,surface.x+point.x-center.x,surface.y+point.y-center.y+height*.14,width,height);}
  accessibleObjects(s){return s.objects.filter(o=>furniture(o.type)?.category==='stove').map((o,i)=>({uid:o.uid,label:`가마솥 ${i+1} · ${{empty:'비어 있음 · 요리 선택',cooking:'조리 중 · 남은 시간 보기',done:'완성 · 서빙대로 옮기기',collecting:'서빙대로 운반 중',spoiled:'상한 음식 · 되살리기 또는 버리기'}[stoveStatus(s,o)]}`}));}
}
