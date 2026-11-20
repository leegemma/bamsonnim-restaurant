import {ASSETS,SKINS,WALK_ANIMATION,recipe,zombie,furniture,DIRECTIONS} from './data.js';
import {stoveStatus,placementProblem,seats,seatedDirection} from './engine.js';
import {walkingPose} from './walking.js';
import {drawWorkerWalk} from './worker-walk.js';
import {drawStaffSantaHat} from './staff-seasonal.js';
import {christmasActive,seasonalBackdrop} from './seasonal-scene.js';
import {lockDirectionalHeads} from './sprite-heads.js';
import {guestDialogue} from './guest-dialogue.js';
import {needsFavoriteThought} from './favorite-thought.js';
import {needsHungerBubble,visibleHeadBounds,hungerBubbleGeometry,HUNGER_BUBBLE_TILE_RATIO} from './hunger-bubble.js';
import {splitGroundCompanions} from './sprite-companions.js';
import {eatingAnimationFrame,eatingSpriteFrame} from './eating.js';
import {registerEatingFrames} from './eating-registration.js';
import {BACKGROUND_SCENE} from './background-fx.generated.js';
import {backgroundFrame,backgroundFxGeometry} from './background-fx.js';
import {createCamera,gameplayTile,gameplayCameraLimits,cameraTransform,sceneToScreen,screenToScene,clientToScreen,clampCamera,zoomCameraAt,resizeCamera,visibleSceneRect,backgroundCover} from './camera.js';
import {bindCameraGestures} from './camera-gestures.js';
import {furnitureArt,placedFurniture} from './furniture-placement.js';
import {furnitureCells,furnitureFootprint,wallAttachment} from './furniture-footprint.js';
import {floorSheetSegments} from './surface-textures.js';
import {pickHit} from './hit-testing.js';
import {worldMarkerMetrics,cureMarkerHit,pickCureMarker} from './world-markers.js';
import {zombieEntrance} from './entrances.js';
import {cookingCountdown,COOKING_TIMER_FONT} from './cooking-countdown.js';
import {ASSET_MANIFEST,characterFrame,directionalCharacter,eatingCharacter,foodFrame} from './assets.js';
import {workerFrame,workerInfectedSprite} from './worker-art.js';
const PREPARED_FOOD_SCALE=.44;
const INITIAL_CAMERA_ZOOM=1.4;

export class RestaurantView{
  constructor(canvas,{onSelect,onTile,onHover,onCameraChange}){
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.images={};this.sprites={};this.hits=[];this.onSelect=onSelect;this.onTile=onTile;this.onHover=onHover;this.hover=null;this.width=0;this.height=0;this.walkingStates=new WeakMap();this.paymentEffects=[];this.motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
    this.camera={...createCamera(),zoom:INITIAL_CAMERA_ZOOM};this.onCameraChange=onCameraChange;
    this.hitMasks=new WeakMap();
    this.gestures=bindCameraGestures(canvas,{toScreen:e=>this.screenPoint(e),getCamera:()=>this.camera,getViewport:()=>this.viewport(),getBounds:()=>this.cameraBounds,getLimits:()=>this.cameraLimits,setCamera:value=>this.commitCamera(value),onTap:p=>this.tapAt(this.screenToScene(p)),onHover:p=>{if(!this.origin)return;const point=this.screenToScene(p);this.hover=this.edit?.ghost&&furniture(this.edit.ghost.type)?.wallMounted?(this.wallSlotAt(point)||this.grid(point.x,point.y)):this.grid(point.x,point.y);this.onHover?.(this.hover);canvas.style.cursor=this.edit?'crosshair':this.hitAt(point)?'pointer':'default';},onLeave:()=>{this.hover=null;},onGestureChange:active=>{this.hover=null;canvas.style.cursor=active?'grabbing':this.edit?'crosshair':'default';}});
    this.resize=new ResizeObserver(()=>this.measure());this.resize.observe(canvas);
  }
  async load(){
    this.ready=false;this.failedAssets=[];
    const priority=['food','furniture','workers','waiterTray','quarterFurniture','quarterServer','stoveIsometric','serverIsometric','woodenEntrance','zombieEntrance','night','poster'];
    const rank=key=>ASSET_MANIFEST[key].actorId==='wanderer'?2:priority.includes(key)?priority.indexOf(key):100;
    const queue=Object.entries(ASSETS).filter(([key])=>!ASSET_MANIFEST[key].archived&&!ASSET_MANIFEST[key].lazy).sort(([a],[b])=>rank(a)-rank(b));let next=0;
    const worker=async()=>{while(next<queue.length){const [key,url]=queue[next++],im=new Image();let timeout;im.src=url;
      try{
        await Promise.race([im.decode(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('이미지 응답 시간 초과')),12000);})]);
        if(ASSET_MANIFEST[key].type!=='background')this.cutAtlas(key,im,ASSET_MANIFEST[key]);
        // The renderer uses the cut cells; keep full decoded sheets only for
        // backgrounds that are drawn directly, allowing the rest to be freed.
        this.images[key]=ASSET_MANIFEST[key].type==='background'||key==='poster'?im:{src:im.src,width:im.width,height:im.height,naturalWidth:im.naturalWidth,naturalHeight:im.naturalHeight};
      }catch{this.failedAssets.push(key);im.src='';console.warn('이미지 로드 실패',url);}finally{clearTimeout(timeout);}
    }};
    await Promise.all(Array.from({length:Math.min(4,queue.length)},worker));this.alignWalkFrames();this.alignEatingFrames();this.ready=true;
  }
  ensureAsset(key){
    if(this.images[key]&&ASSET_MANIFEST[key]?.type==='background')return Promise.resolve(true);
    if(this.sprites[key]?.length)return Promise.resolve(true);
    const asset=ASSET_MANIFEST[key];if(!asset||!ASSETS[key])return Promise.resolve(false);
    this.optionalAssetLoads??=new Map();this.optionalAssetRetryAt??=new Map();
    if(this.optionalAssetLoads.has(key))return this.optionalAssetLoads.get(key);
    if(performance.now()<(this.optionalAssetRetryAt.get(key)||0))return Promise.resolve(false);
    const load=(async()=>{const im=new Image();let timeout;try{im.src=ASSETS[key];await Promise.race([im.decode(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('optional asset timeout')),12000);})]);if(asset.type==='background')this.images[key]=im;else{this.cutAtlas(key,im,asset);this.images[key]={src:im.src,width:im.width,height:im.height};}this.optionalAssetRetryAt.delete(key);return true;}catch{this.optionalAssetRetryAt.set(key,performance.now()+15000);im.src='';return false;}finally{clearTimeout(timeout);this.optionalAssetLoads.delete(key);}})();
    this.optionalAssetLoads.set(key,load);return load;
  }
  alignEatingFrames(){
    this.eatingRegistrations={};
    for(const meta of Object.values(ASSET_MANIFEST).filter(a=>a.type==='eating-atlas')){
      const base=ASSET_MANIFEST[meta.baseAtlas];
      if(!this.sprites[meta.key]?.length||!this.sprites[base?.key]?.length)continue;
      if(meta.preRegistered&&(!meta.poses?.length||this.sprites[meta.key].length!==meta.poses.length||meta.poses.some((p,i)=>!Number.isFinite(p.hip?.x)||!Number.isFinite(p.hip?.y)||this.sprites[meta.key][i].width!==meta.cell?.width||this.sprites[meta.key][i].height!==meta.cell?.height)))throw new Error(`승인 먹기 아틀라스 좌표가 올바르지 않습니다: ${meta.key}`);
      // Approved final canvases already share their canonical seated hip.
      // Preserve the cut RGBA instead of applying raw-art registration again.
      this.eatingRegistrations[meta.key]=meta.preRegistered
        ?meta.poses.map(p=>({hip:p.hip,baseIndex:p.dir*(base.walkFrames+1)+base.frames.sit,preRegistered:true}))
        :registerEatingFrames(this.sprites[meta.key],meta,this.sprites[base.key],base);
    }
  }
  async getAssetSource(key){
    const cached=this.images[key];if(cached instanceof HTMLImageElement)return cached;
    if(!ASSETS[key])return null;const image=new Image();image.src=ASSETS[key];await image.decode();return image;
  }
  alignWalkFrames(){const frames=WALK_ANIMATION.keys.map(key=>this.sprites[key]?.[0]).filter(Boolean);if(!frames.length)return;const width=Math.max(...frames.map(f=>f.width)),height=Math.max(...frames.map(f=>f.height));for(const key of WALK_ANIMATION.keys){const frame=this.sprites[key]?.[0];if(!frame)continue;const aligned=document.createElement('canvas');aligned.width=width;aligned.height=height;aligned.getContext('2d').drawImage(frame,Math.round((width-frame.width)/2),height-frame.height);this.sprites[key][0]=aligned;}}
  cutAtlas(key,im,asset={}){
    const columns=asset.cols||asset.grid?.cols||1,rows=asset.rows||asset.grid?.rows||1,cw=asset.grid?.cellWidth||im.width/columns,ch=asset.grid?.cellHeight||im.height/rows;
    const sources=asset.poses?.length&&asset.type?.endsWith('-atlas')?asset.poses.map(p=>p.source):Array.from({length:columns*rows},(_,i)=>({x:(asset.grid?.x||0)+(i%columns)*cw,y:(asset.grid?.y||0)+Math.floor(i/columns)*ch,width:cw,height:ch}));
    this.sprites[key]=[];const shared=asset.shareFrames?new Map():null;let sourceIndex=0;
    for(const source of sources){
      const pose=asset.poses?.[sourceIndex++],signature=JSON.stringify(source);if(shared?.has(signature)){this.sprites[key].push(shared.get(signature));continue;}
      const c=document.createElement('canvas');c.width=Math.ceil(source.width);c.height=Math.ceil(source.height);const ctx=c.getContext('2d',{willReadFrequently:true});if(pose?.clipPolygons){ctx.beginPath();for(const points of pose.clipPolygons){points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();}ctx.clip();}ctx.drawImage(im,source.x,source.y,source.width,source.height,0,0,source.width,source.height);
      if(asset.trim===false||key==='wandererDirectional'){this.sprites[key].push(c);shared?.set(signature,c);continue;}
      const pixels=ctx.getImageData(0,0,c.width,c.height);let minX=c.width,minY=c.height,maxX=0,maxY=0;
      for(let y=2;y<c.height-2;y++)for(let x=2;x<c.width-2;x++)if(pixels.data[(y*c.width+x)*4+3]>80){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
      const out=document.createElement('canvas');out.width=Math.max(1,maxX-minX+1);out.height=Math.max(1,maxY-minY+1);if(minX<c.width)out.getContext('2d').drawImage(c,minX,minY,out.width,out.height,0,0,out.width,out.height);this.sprites[key].push(out);
    }
    if(asset.preRegistered)return;
    this.headLocks??={};this.headLocks[key]=lockDirectionalHeads(this.sprites[key],asset);
    this.companions??={};this.companions[key]=splitGroundCompanions(this.sprites[key],asset);
  }

  measure(){
    const r=this.canvas.getBoundingClientRect(),next={width:r.width,height:r.height};this.camera??=createCamera();
    if(r.width>0&&r.height>0){if(this.roomSize)this.cameraLimits=gameplayCameraLimits(next,this.roomSize);Object.assign(this.camera,resizeCamera(this.camera,this.cameraViewport||next,next,undefined,this.cameraLimits));this.cameraViewport=next;this.cameraBounds=null;if(this.gestures?.input.active)this.gestures.cancel();}
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
  sceneToScreen(point){return sceneToScreen(point,this.camera,this.viewport(),this.cameraLimits);}
  screenToScene(point){return screenToScene(point,this.camera,this.viewport(),this.cameraLimits);}
  commitCamera(value){const next=clampCamera(value,this.viewport(),this.cameraBounds,this.cameraLimits),old=this.camera||createCamera(),changed=Object.keys(next).some(k=>Math.abs(next[k]-old[k])>1e-8);this.camera??=createCamera();Object.assign(this.camera,next);if(changed){this.hover=null;this.onCameraChange?.({...this.camera});}}
  resetCamera(){if(this.gestures?.input.active)this.gestures.cancel();this.commitCamera({...createCamera(),zoom:INITIAL_CAMERA_ZOOM});}
  zoomCamera(factor,anchor){this.commitCamera(zoomCameraAt(this.camera,factor,anchor,this.viewport(),this.cameraBounds,this.cameraLimits));}
  hitAt(p){return pickCureMarker(this.hits,p)||pickHit(this.hits,p);}
  tapAt(p){if(!this.origin||this.gestures?.input.active)return;if(this.edit?.ghost){this.onTile?.(furniture(this.edit.ghost.type)?.wallMounted?(this.wallSlotAt(p)||this.grid(p.x,p.y)):this.grid(p.x,p.y));return;}const hit=this.hitAt(p);if(hit)this.onSelect?.(hit);else if(this.edit)this.onTile?.(this.grid(p.x,p.y));}
  hitMask(image){
    if(!image?.getContext)return null;
    let mask=this.hitMasks.get(image);
    if(!mask){const {width,height}=image,pixels=image.getContext('2d',{willReadFrequently:true}).getImageData(0,0,width,height).data,alpha=new Uint8Array(width*height);for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];mask={width,height,alpha};this.hitMasks.set(image,mask);}
    return mask;
  }
  world(x,y){return{x:this.origin.x+(x-y)*this.tile/2,y:this.origin.y+(x+y)*this.tile/4};}
  grid(x,y){const a=(x-this.origin.x)/(this.tile/2),b=(y-this.origin.y)/(this.tile/4);return{x:Math.floor((a+b)/2+.5),y:Math.floor((b-a)/2+.5)};}
  polygon(points,fill,stroke=null,line=1){const c=this.ctx;c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=line;c.stroke();}}
  sprite(key,index,x,y,width,height,options={}){const im=options.image||this.sprites[key]?.[index],h=height||(im?width*im.height/im.width:width),w=width,c=this.ctx;c.save();if(options.alpha!==undefined)c.globalAlpha=options.alpha;if(options.filter)c.filter=options.filter;if(!im){c.fillStyle=options.infected?'#719c4d':'#8b9c75';c.fillRect(x-w*.3,y-h*.7,w*.6,h*.7);c.fillStyle='#263b31';c.font='12px NeoDunggeunmo,monospace';c.textAlign='center';c.fillText((key==='food'||ASSET_MANIFEST[key]?.type==='food-atlas')?'요리':key==='furniture'?'가구':'손님',x,y-h*.2);}else if(options.flip){c.translate(x,y);c.scale(-1,1);c.drawImage(im,-w/2,-h,w,h);}else c.drawImage(im,x-w/2,y-h,w,h);c.restore();}
  label(text,x,y,{color='#f5e7c5',background='#263b31',small=false,border='#a6ad75',width=null,fontSize=small?14:16,height=small?24:28,font=null,recordRect=true,textOffsetY=1,padding=8,pixel=1}={}){
    const c=this.ctx;c.font=font||`${fontSize}px NeoDunggeunmo,monospace`;const w=width||Math.ceil(c.measureText(text).width)+padding*2,h=height,left=Math.round(x-w/2),top=Math.round(y-h);
    if(recordRect)this.labelRects?.push({x:left,y:top,w:w+3*pixel,h:h+3*pixel});
    c.fillStyle='#0c181a';c.fillRect(left+3*pixel,top+3*pixel,w,h);c.fillStyle=border;c.fillRect(left+2*pixel,top,w-4*pixel,h);c.fillRect(left,top+2*pixel,w,h-4*pixel);c.fillStyle=background;c.fillRect(left+3*pixel,top+2*pixel,w-6*pixel,h-4*pixel);c.fillRect(left+2*pixel,top+3*pixel,w-4*pixel,h-6*pixel);
    c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.fillText(text,Math.round(x),top+h/2+textOffsetY);return{x:left,y:top,w,h};
  }
  worldLabel(text,x,y,options={}){const metrics=worldMarkerMetrics(this.tile,this.camera?.zoom),rect=this.label(text,x,y,{...metrics,...options});this.worldLabels?.push({text,...rect,fontSize:metrics.fontSize,kind:options.kind});return rect;}
  drawActorMarkers(){for(const marker of this.actorMarkers){const rect=this.worldLabel(marker.text,marker.x,marker.y,marker.options);if(marker.uid)this.hits.push(cureMarkerHit(marker.uid,rect,this.camera.zoom));}}
  furnitureDepth(o){const shape=furnitureFootprint(o);return o.x+o.y+(shape.width+shape.height-2)/2;}
  furnitureGeometry(o){
    const category=furniture(o.type)?.category,art=furnitureArt(category,o.dir||0,o.type);if(art&&ASSET_MANIFEST[art.key]?.lazy&&!this.sprites[art.key]?.length)this.ensureAsset(art.key);const image=art&&this.sprites[art.key]?.[art.index],shape=furnitureFootprint(o),point=this.world(o.x+Math.max(0,shape.width-1)/2,o.y+Math.max(0,shape.height-1)/2),flip=art?.itemId?!!art.mirrorOdd&&o.dir%2===1:['stove','server'].includes(category)&&o.dir%2===1;
    return placedFurniture(art,image,point,this.tile,flip);
  }
  serverFoodLayout(o){
    const t=this.tile,p=this.world(o.x,o.y),geometry=this.furnitureGeometry(o),anchor=geometry?.surface||{x:p.x,y:p.y-t*.49};
    const {key,index}=foodFrame(recipe(o.foodId)?.sprite||0),food=this.sprites[key]?.[index],width=t*PREPARED_FOOD_SCALE,height=food?width*food.height/food.width:t*.32;
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
    const c=this.ctx,scale=1/Math.max(1,this.camera?.zoom||1),viewportTop=this.camera?this.screenToScene({x:0,y:4}).y:4;
    const items=s.objects.filter(o=>furniture(o.type)?.category==='stove').map(o=>{
      const status=stoveStatus(s,o),p=this.world(o.x,o.y),remain=Math.max(0,(o.cook?.readyAt||0)-s.time),text=status==='empty'?'':status==='cooking'?cookingCountdown(remain):status==='done'?'DONE':status==='collecting'?'운반 중':'상했어요',fontSize=12,font=status==='cooking'?COOKING_TIMER_FONT:null;
      c.font=font||`${fontSize}px NeoDunggeunmo,monospace`;
      const diameter=Math.min(28,Math.max(18,this.tile*.5))*scale,height=['empty','done'].includes(status)?diameter:20*scale;
      const geometry=this.furnitureGeometry(o),visibleTop=geometry?geometry.y+geometry.h*(geometry.meta.bounds?.y||0)/geometry.meta.height:p.y-this.tile*.86,minY=viewportTop+height,naturalY=visibleTop-6*scale,baseY=Math.max(minY,naturalY);
      return{o,status,text,fontSize,font,height,scale,minY,naturalY,baseY,sourceX:p.x,sourceY:visibleTop+this.tile*.06,x:p.x,y:baseY,width:['empty','done'].includes(status)?diameter:(Math.ceil(c.measureText(text).width)+8)*scale};
    }).sort((a,b)=>(a.status==='done'?-1:0)-(b.status==='done'?-1:0)||b.y-a.y||a.x-b.x);
    // Keep every badge over its own pot. Only lift rear badges if their
    // actual circle or rectangle would touch an already placed badge.
    const placed=[];
    const overlaps=(a,b)=>['empty','done'].includes(a.status)&&['empty','done'].includes(b.status)?Math.hypot(a.x-b.x,(a.y-a.height/2)-(b.y-b.height/2))<(a.width+b.width)/2+3*scale:Math.abs(a.x-b.x)<(a.width+b.width)/2+scale&&a.y>b.y-b.height&&a.y-a.height<b.y;
    for(const item of items){while(placed.some(other=>overlaps(item,other)))item.y-=2*scale;if(item.y<item.minY){item.y=item.baseY;while(placed.some(other=>overlaps(item,other)))item.y+=2*scale;}placed.push(item);}
    return new Map(items.map(item=>[item.o.uid,item]));
  }
  materialTexture(skin){if(!skin?.textureKey)return null;this.ensureAsset(skin.textureKey);return this.sprites[skin.textureKey]?.[0]||null;}
  texturePattern(image){this.texturePatterns??=new WeakMap();let pattern=this.texturePatterns.get(image);if(!pattern){pattern=this.ctx.createPattern(image,'repeat');this.texturePatterns.set(image,pattern);}return pattern;}
  drawFloorMaterial(skin,size){
    const c=this.ctx,back=this.world(-.5,-.5),image=this.materialTexture(skin);this.polygon([back,this.world(size-.5,-.5),this.world(size-.5,size-.5),this.world(-.5,size-.5)],skin.color);
    if(image){const sx=this.tile*3/image.width,sy=this.tile*3/image.height;c.save();c.transform(.5,.25,-.5,.25,back.x,back.y);c.scale(sx,sy);c.fillStyle=this.texturePattern(image);c.fillRect(0,0,size*this.tile/sx,size*this.tile/sy);c.restore();}
    const segments=floorSheetSegments(size,skin.sheetCells);this.floorSheetLayout={skin:skin.id,segments};c.strokeStyle='#8d6928';c.lineWidth=1;
    for(const segment of segments){const a=this.world(segment.from.x,segment.from.y),b=this.world(segment.to.x,segment.to.y);c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}
  }
  drawWallMaterial(image,axis,a,b,height,size){
    const c=this.ctx,back=this.world(-.5,-.5),scale=this.tile*2/image.width;c.save();c.beginPath();[a,b,{x:b.x,y:b.y-height},{x:a.x,y:a.y-height}].forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();c.transform(axis?-.5:.5,.25,0,1,back.x,back.y-height);c.scale(scale,scale);c.fillStyle=this.texturePattern(image);c.fillRect(0,0,size*this.tile/scale,height/scale);c.restore();
  }
  wallSlotAt(point){
    if(!this.origin||!this.tile)return null;const north=point.x>=this.origin.x,slot=Math.round(Math.abs(point.x-this.origin.x)/(this.tile/2)-.5);if(slot<0||slot>=this.roomSize)return null;const anchor=north?this.world(slot,-.5):this.world(-.5,slot),groundY=anchor.y+(point.x-anchor.x)*(north?.5:-.5);if(point.y>groundY||point.y<groundY-this.tile*1.4)return null;return{x:north?slot:0,y:north?0:slot,dir:north?0:1,wallSide:north?'north':'west',wallSlot:slot};
  }
  drawWallHanging(o,edit){
    const f=furniture(o.type),attachment=wallAttachment(o,{legacy:!o.wallSide&&o.uid!=='ghost'}),north=attachment.wallSide==='north',span=f.wallSpan||1,centerSlot=attachment.wallSlot+(span-1)/2,anchor=north?this.world(centerSlot,-.5):this.world(-.5,centerSlot),slope=north?.5:-.5,t=this.tile,c=this.ctx;
    if(f.artKey)this.ensureAsset(f.artKey);const image=f.artKey?this.sprites[f.artKey]?.[0]:this.images.poster,ratio=image?image.height/image.width:o.type==='poster'?1.5:.8,naturalW=t*.44*span,fit=Math.min(1,t*1.08/(naturalW*ratio)),w=naturalW*fit,h=w*ratio,y=anchor.y-t*.22,offset={x:anchor.x-w/2,y:y-slope*w/2};
    c.save();c.globalAlpha=edit?.ghost?.existing===o.uid ? .35 : edit?.ghost===true ? .7 : 1;c.transform(1,slope,0,1,offset.x,offset.y);if(image)c.drawImage(image,0,-h,w,h);else{c.fillStyle='#e9dbb4';c.fillRect(0,-h,w,h);}if(o.type==='poster'){c.fillStyle='#362d24';c.textAlign='center';c.font=`bold ${Math.max(6,t*.075)}px NeoDunggeunmo,monospace`;c.fillText('뇌 주먹밥',w/2,-h*.84);c.fillStyle='#955a44';c.fillText('의 효능',w/2,-h*.7);}c.restore();
    this.hits.push({kind:'object',uid:o.uid,x:offset.x,y:Math.min(offset.y,offset.y+slope*w)-h,w,h:h+Math.abs(slope*w),wall:{...offset,slope,width:w,height:h},mask:this.hitMask(image)});
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
    const availableH=H-(edit?150:0);this.roomSize=s.size;this.cameraLimits=gameplayCameraLimits(this.viewport(),s.size);this.tile=gameplayTile({width:W,height:availableH},s.size);const n=s.size;this.origin={x:W*(W<750?.57:.575),y:(availableH-n*this.tile/2)/2+(availableH<400?this.tile*.6:58)};
    const left=this.world(-.5,n-.5),right=this.world(n-.5,-.5),front=this.world(n-.5,n-.5),back=this.world(-.5,-.5);
    this.cameraBounds={x:left.x-20,y:back.y-this.tile*1.4-18,width:right.x-left.x+40,height:front.y+55-(back.y-this.tile*1.4-18)};this.commitCamera(this.camera);
    const matrix=cameraTransform(this.camera,this.viewport(),this.cameraLimits),visible=visibleSceneRect(this.camera,this.viewport(),this.cameraLimits);c.imageSmoothingEnabled=false;
    if(christmasActive(s)&&!this.images.nightWinter)void this.ensureAsset('nightWinter');
    const scenery=seasonalBackdrop(s,this.images);this.seasonalBackground={key:scenery.key,winter:scenery.winter,fallback:scenery.fallback};this.backgroundEffects=[];
    const bg=scenery.image;if(bg){const backdrop=backgroundCover(bg,this.viewport());c.save();c.globalAlpha=.6;c.drawImage(bg,backdrop.x,backdrop.y,backdrop.width,backdrop.height);if(scenery.normalFx)this.drawBackgroundEffects(s,bg);c.restore();}
    c.save();c.setTransform(dpr*matrix.zoom,0,0,dpr*matrix.zoom,dpr*matrix.x,dpr*matrix.y);
    const grd=c.createLinearGradient(0,visible.y,0,visible.y+visible.height);grd.addColorStop(0,'#102c2822');grd.addColorStop(1,'#0c2528aa');c.fillStyle=grd;c.fillRect(visible.x,visible.y,visible.width,visible.height);
    this.polygon([{x:left.x-20,y:left.y+12},{x:front.x,y:front.y+30},{x:right.x+20,y:right.y+12},{x:back.x,y:back.y}], '#07191c66');
    this.polygon([left,front,{x:front.x,y:front.y+21},{x:left.x,y:left.y+21}],'#443f34','#1e3029',2);
    this.polygon([front,right,{x:right.x,y:right.y+21},{x:front.x,y:front.y+21}],'#554735','#23332b',2);
    const floorSkin=SKINS.find(x=>x.id===s.floor),floor=floorSkin?.color||'#aa774b';this.floorSheetLayout=null;
    if(floorSkin?.textureKey)this.drawFloorMaterial(floorSkin,n);else for(let sum=0;sum<n*2;sum++)for(let x=0;x<n;x++){const y=sum-x;if(y<0||y>=n)continue;const p=[this.world(x-.5,y-.5),this.world(x+.5,y-.5),this.world(x+.5,y+.5),this.world(x-.5,y+.5)];this.polygon(p,floor,'#543f2b88',1);const tone=(x*17+y*29)%5;c.fillStyle=tone%2?'#f5c67c13':'#25190f12';c.beginPath();p.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fill();for(let j=1;j<=2;j++){const a=this.world(x-.5+j/3,y-.5),b=this.world(x-.5+j/3,y+.5);c.strokeStyle='#4e382529';c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();}if((x+y)%3===0){const p=this.world(x+.1,y);c.fillStyle='#e9ba7522';c.fillRect(p.x,p.y,7,1);}}
    const wallSkin=SKINS.find(x=>x.id===s.wall),wallTexture=this.materialTexture(wallSkin),wh=this.tile*1.4,wall=wallSkin?.color||'#d9c39b';
    for(const axis of [0,1])for(let i=0;i<n;i++){
      const a=axis?this.world(-.5,i-.5):this.world(i-.5,-.5),b=axis?this.world(-.5,i+.5):this.world(i+.5,-.5);
      this.polygon([a,b,{x:b.x,y:b.y-wh},{x:a.x,y:a.y-wh}],wall,'#62432b',2);if(wallTexture)this.drawWallMaterial(wallTexture,axis,a,b,wh,n);
      if(!wallSkin?.textureKey){
      for(let k=1;k<4;k++){const t=k/4;c.strokeStyle='#6e4b3099';c.lineWidth=2;c.beginPath();c.moveTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-8);c.lineTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-wh+8);c.stroke();}
      for(let k=1;k<4;k++){c.beginPath();c.moveTo(a.x,a.y-wh*k/4);c.lineTo(b.x,b.y-wh*k/4);c.stroke();}
      }
      c.strokeStyle='#483227';c.lineWidth=6;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x,a.y-wh);c.stroke();
      this.polygon([{x:a.x-4,y:a.y-wh},{x:b.x+4,y:b.y-wh},{x:b.x+4,y:b.y-wh-13},{x:a.x-4,y:a.y-wh-13}],'#283c3b','#122a2c',2);
      c.strokeStyle='#57716b';c.lineWidth=1;for(let k=0;k<3;k++){const t=k/3;c.beginPath();c.moveTo(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t-wh);c.lineTo(a.x+(b.x-a.x)*t+3,a.y+(b.y-a.y)*t-wh-13);c.stroke();}
    }
    const entranceImage=this.sprites.woodenEntrance?.[0];if(entranceImage){const entrance=this.world(-.5,n-1),doorHeight=this.tile*1.32,doorWidth=doorHeight*entranceImage.width/entranceImage.height;c.save();c.transform(1,-.5,0,1,entrance.x-doorWidth/2,entrance.y+doorWidth/4);c.drawImage(entranceImage,0,-doorHeight,doorWidth,doorHeight);c.restore();}
    const portal=this.sprites.zombieEntrance?.[0];if(portal){
      const gate=zombieEntrance(s),leftWall=gate.y!==0,point=leftWall?this.world(-.5,gate.y):this.world(gate.x,-.5),height=this.tile*1.44,width=height*portal.width/portal.height,slope=leftWall?-.5:.5;
      c.save();c.transform(1,slope,0,1,point.x-width/2,point.y-slope*width/2);c.drawImage(portal,0,-height,width,height);
      if(s.zombieDoorOpenedAt!==undefined&&s.time-s.zombieDoorOpenedAt<1){c.globalCompositeOperation='screen';c.fillStyle=this.motionPreference.matches?'#b3e6b322':`rgba(166,226,172,${.12+.07*Math.sin(clock*9)})`;c.fillRect(width*.18,-height*.74,width*.64,height*.69);}c.restore();
    }
    // Warm pools of lantern light stay behind the game objects.
    for(const o of s.objects.filter(o=>['lantern','xmas-lantern','stove'].includes(o.type))){const p=this.world(o.x,o.y),g=c.createRadialGradient(p.x,p.y,1,p.x,p.y,this.tile*1.3);g.addColorStop(0,'#ffd58024');g.addColorStop(1,'#ffd58000');c.fillStyle=g;c.fillRect(p.x-this.tile*1.3,p.y-this.tile*1.3,this.tile*2.6,this.tile*2.6);}
    if(edit)for(let x=0;x<n;x++)for(let y=0;y<n;y++){const p=[this.world(x-.5,y-.5),this.world(x+.5,y-.5),this.world(x+.5,y+.5),this.world(x-.5,y+.5)];this.polygon(p,'#c3d58b08','#e3e2a33b');}
    const entities=s.objects.map(o=>{const shape=furnitureFootprint(o);return{kind:'object',value:o,depth:furniture(o.type)?.wallMounted?-1000+o.x+o.y:this.furnitureDepth(o)+.1};});
    for(const seat of seats(s))if(seat.chair.dirty)entities.push({kind:'empty-dish',value:seat,depth:this.furnitureDepth(seat.table)+.2});
    for(const w of edit?[]:s.waiters)entities.push({kind:'waiter',value:w,depth:w.x+w.y+.3});
    for(const z of edit?[]:s.customers){entities.push({kind:'customer',value:z,depth:z.x+z.y+.3});if(z.phase==='eating'){const seat=seats(s).find(item=>item.uid===z.seat);if(seat?.table)entities.push({kind:'meal',value:z,depth:this.furnitureDepth(seat.table)+.2});}}
    entities.sort((a,b)=>a.depth-b.depth);
    this.guestLabels=[];this.labelRects=[];this.hungerLayout=[];this.worldLabels=[];this.actorMarkers=[];this.staffSeasonalHats=[];
    for(const e of entities){if(e.kind==='object')this.drawObject(s,e.value,clock,edit);else if(e.kind==='meal')this.drawMeal(s,e.value);else if(e.kind==='empty-dish')this.drawEmptyDish(e.value);else this.drawPerson(s,e.value,e.kind==='waiter',clock);}
    // Controls share one layout pass, with each displaced badge tied to its pot.
    this.stoveControls=this.stoveControlLayout(s);
    if(!edit){
      for(const control of this.stoveControls.values())if(Math.abs(control.naturalY-control.y)>2*control.scale){c.strokeStyle='#bda77b';c.lineWidth=control.scale;c.beginPath();c.moveTo(control.x,control.y+4*control.scale);c.lineTo(control.sourceX,control.sourceY);c.stroke();}
      for(const control of this.stoveControls.values()){
        const {o,status,text,x,y,width,height,fontSize,font,scale}=control,localWidth=width/scale,localHeight=height/scale,options=status==='cooking'?{background:'#6b4d33',border:'#d6ae66'}:status==='spoiled'?{background:'#704a4a',border:'#d58e75'}:{};
        c.save();c.translate(x,y);c.scale(scale,scale);
        if(status==='done'){
          const radius=localWidth/2-1,cy=-localHeight/2;
          c.fillStyle='#3c9956';c.strokeStyle='#23663a';c.lineWidth=2;c.beginPath();c.arc(0,cy,radius,0,Math.PI*2);c.fill();c.stroke();
          c.strokeStyle='#ffffff';c.lineWidth=Math.max(2,radius*.24);c.lineCap='round';c.lineJoin='round';c.beginPath();c.moveTo(-radius*.48,cy);c.lineTo(-radius*.15,cy+radius*.32);c.lineTo(radius*.5,cy-radius*.38);c.stroke();
        }else if(status==='empty'){
          const radius=localWidth/2-1,cy=-localHeight/2;
          c.fillStyle='#c8443f';c.strokeStyle='#802e2d';c.lineWidth=2;c.beginPath();c.arc(0,cy,radius,0,Math.PI*2);c.fill();c.stroke();
          // Cream ladle: a long handle and a deep, round bowl.
          c.strokeStyle='#fff4da';c.lineWidth=Math.max(2,radius*.2);c.lineCap='round';c.beginPath();c.moveTo(radius*.43,cy-radius*.5);c.lineTo(-radius*.14,cy+radius*.13);c.stroke();
          c.fillStyle='#fff4da';c.beginPath();c.ellipse(-radius*.24,cy+radius*.26,radius*.36,radius*.26,-Math.PI/4,0,Math.PI*2);c.fill();
        }else this.label(text,0,0,{small:true,width:localWidth,height:localHeight,fontSize,font,recordRect:false,textOffsetY:status==='cooking'?-2:1,...options});
        if(status==='cooking'){const r=recipe(o.cook.foodId),progress=Math.max(0,Math.min(1,1-(o.cook.readyAt-s.time)/r.duration)),barWidth=localWidth-10;c.fillStyle='#342b24';c.fillRect(-barWidth/2,-5,barWidth,2);c.fillStyle='#e4b76b';c.fillRect(-barWidth/2,-5,barWidth*progress,2);}
        c.restore();this.labelRects?.push({x:x-width/2,y:y-height,w:width+3*scale,h:height+3*scale});
        this.hits.push({kind:'stove',uid:o.uid,x:x-width/2,y:y-height,w:width+(['empty','done'].includes(status)?0:3*scale),h:height+(['empty','done'].includes(status)?0:3*scale),...(['empty','done'].includes(status)?{circle:true}:{})});
      }
      for(const o of s.objects)if(furniture(o.type)?.category==='server'&&(o.stock>0||o.reservedFood)){const carrying=s.waiters.some(w=>w.task?.kind==='serve'&&w.task.server===o.uid&&w.task.picked),food=this.serverFoodLayout(o),labelY=o.stock>0?food.y-food.height-worldMarkerMetrics(this.tile,this.camera.zoom).gap:food.surface.y-this.tile*.14;this.worldLabel(o.stock>0?`${Math.ceil(o.stock)}개`:carrying?'서빙 중':'운반 예약',food.x,labelY,{kind:'stock',background:'#eee0ba',color:'#50452e',border:'#9d8555'});}
    }
    if(edit?.ghost){const g=edit.ghost,t={x:g.x??3,y:g.y??3},error=placementProblem(s,g.type,t.x,t.y,g.dir,g.existing,{ignoreStaff:true}),p=this.world(t.x,t.y);if(furniture(g.type)?.wallMounted){const attachment=wallAttachment({...t,dir:g.dir}),north=attachment.wallSide==='north',slot=attachment.wallSlot,span=furniture(g.type)?.wallSpan||1,a=north?this.world(slot-.5,-.5):this.world(-.5,slot-.5),b=north?this.world(slot+span-.5,-.5):this.world(-.5,slot+span-.5);this.polygon([a,b,{x:b.x,y:b.y-this.tile*1.4},{x:a.x,y:a.y-this.tile*1.4}],error?'#d97e6c88':'#bacb8744',error?'#fa9789':'#deefba',2);}else for(const[x,y]of furnitureCells({type:g.type,...t,dir:g.dir}))this.polygon([this.world(x-.5,y-.5),this.world(x+.5,y-.5),this.world(x+.5,y+.5),this.world(x-.5,y+.5)],error?'#d97e6c88':'#bacb8799',error?'#fa9789':'#deefba',2);this.drawObject(s,{type:g.type,x:t.x,y:t.y,dir:g.dir,uid:'ghost'},clock,{ghost:true});}
    if(scenery.fireflies)for(let i=0;i<16;i++){const x=(Math.sin(i*77.1)*.5+.5)*W,y=(Math.cos(i*31.4)*.5+.5)*H;const a=(Math.sin(clock*1.5+i*2)+1)/2;c.fillStyle=`rgba(226,220,143,${a*.6})`;c.fillRect(Math.round(x+Math.sin(clock*.4+i)*12),Math.round(y+Math.cos(clock*.3+i)*8),2,2);}
    if(s.feverUntil>s.time){c.save();c.setTransform(dpr,0,0,dpr,0,0);c.strokeStyle=`rgba(242,202,103,${.3+Math.sin(clock*7)*.2})`;c.lineWidth=5;c.strokeRect(3,3,W-6,H-6);c.restore();}
    if(!edit){this.drawPaymentEffects(effectClock);this.drawHungerBubbles();this.drawActorMarkers();this.drawGuestLabels();}
    this.guestLabels=null;this.labelRects=null;c.restore();
  }
  drawGuestLabels(){
    this.dialogueLayout=[];const m=worldMarkerMetrics(this.tile,this.camera?.zoom),visible=visibleSceneRect(this.camera,this.viewport(),this.cameraLimits),margin=m.gap+3*m.pixel;
    for(const item of [...(this.guestLabels||[])].reverse()){
      if(item.x<visible.x||item.x>visible.x+visible.width||item.y<visible.y||item.y>visible.y+visible.height)continue;
      this.ctx.font=`${m.fontSize}px NeoDunggeunmo,monospace`;const w=Math.ceil(this.ctx.measureText(item.text).width)+m.padding*2;
      if(w+2*margin>visible.width)continue;
      const x=Math.max(visible.x+w/2+margin,Math.min(visible.x+visible.width-w/2-margin,item.x));let chosen;
      for(const rise of [0,m.height+margin+2*m.pixel]){const y=Math.max(visible.y+m.height+margin,Math.min(visible.y+visible.height-margin,item.y-rise)),box={x:Math.round(x-w/2),y:Math.round(y-m.height),w:w+3*m.pixel,h:m.height+3*m.pixel};
        if(this.labelRects.some(b=>box.x<b.x+b.w+m.gap&&box.x+box.w+m.gap>b.x&&box.y<b.y+b.h+m.gap&&box.y+box.h+m.gap>b.y))continue;chosen={x,y,box};break;
      }
      if(!chosen)continue;
      this.worldLabel(item.text,chosen.x,chosen.y,{...item.options,kind:'dialogue'});this.dialogueLayout.push({...chosen.box,text:item.text,fontSize:m.fontSize});
    }
  }
  drawHungerBubbles(){
    for(const box of this.hungerLayout){const image=this.sprites[box.thought||'hungerThought']?.[0];if(image){this.ctx.drawImage(image,box.x,box.y,box.w,box.h);this.labelRects.push(box);}}
  }
  addPaymentEffect(event){if(![event.amount,event.xp,event.x,event.y].every(Number.isFinite))return;this.paymentEffects.push({amount:event.amount,xp:event.xp,x:event.x,y:event.y,favorite:!!event.favorite,tip:Number.isFinite(event.tip)?event.tip:0,startedAt:performance.now()/1000});this.paymentEffects=this.paymentEffects.slice(-20);}
  drawPaymentEffects(clock){
    const c=this.ctx,reduced=this.motionPreference.matches,m=worldMarkerMetrics(this.tile,this.camera.zoom),u=m.fontSize/10;
    this.paymentEffects=this.paymentEffects.filter(effect=>clock-effect.startedAt<1.9);
    for(const effect of this.paymentEffects){
      const age=Math.max(0,clock-effect.startedAt),p=this.world(effect.x,effect.y),rise=reduced?0:age*this.tile*.42,y=p.y-this.tile*1.15-rise;
      c.save();c.globalAlpha=reduced?1:Math.max(.25,Math.min(1,Math.ceil((1.9-age)/.4)/4));
      if(age<1.6){const text=`+${effect.amount} 코인${effect.tip?` · 팁 ${effect.tip}`:''}`,rect=this.worldLabel(text,p.x,y,{kind:'coin',color:'#ffe39b',background:'#423520',border:'#d7b36c'});this.sprite('food',15,rect.x-m.gap-m.icon/2,y,m.icon,m.icon);if(effect.favorite){const heart=['0110110','1111111','1111111','0111110','0011100','0001000'];c.fillStyle='#e59aab';heart.forEach((row,yy)=>[...row].forEach((bit,xx)=>{if(bit==='1')c.fillRect(rect.x+rect.w+m.gap+xx*u,y-m.height+yy*u,u,u);}));}}
      if(age>=.35)this.worldLabel(`+${effect.xp} XP`,p.x,y+m.height+m.gap,{kind:'xp',color:'#cbecdf',background:'#213e35',border:'#9cbf9b'});
      c.restore();
    }
  }
  drawObject(s,o,clock,edit){
    const f=furniture(o.type);if(!f)return;if(f.wallMounted){this.drawWallHanging(o,edit);return;}const p=this.world(o.x,o.y),t=this.tile;let index=f.sprite;
    if(f.category==='chair')index=[1,2,3,4][o.dir||0];
    const sizing={table:[t*.94,t*.83],chair:[t*.65,t*.92],stove:[t*.94,t*.98],server:[t*1.03,t*.78],decor:[t*.7,t*.9]};let [w,h]=sizing[f.category]||sizing.decor;
    if(f.category==='chair'){const geometry=this.chairGeometry(o);w=geometry.w;h=geometry.h;}
    const isometricKey=f.category==='stove'?'stoveIsometric':f.category==='server'?'serverIsometric':null,isometricImage=this.sprites[isometricKey]?.[0];
    if(isometricImage){w=t*(f.category==='stove'?1.04:1.1);h=w*isometricImage.height/isometricImage.width;}
    if(o.type==='lantern'){h=t*1.2;const image=this.sprites.furniture?.[index];w=image?h*image.width/image.height:t*.6;}else if(!isometricImage&&f.category!=='chair'){const image=this.sprites.furniture?.[index];if(image){const scale=Math.min(w/image.width,h/image.height);w=image.width*scale;h=image.height*scale;}}
    const placed=this.furnitureGeometry(o);if(placed){w=placed.w;h=placed.h;}
    const selected=edit?.selected===o.uid;this.ctx.save();if(selected)this.ctx.filter='brightness(1.35)';
    this.sprite(placed?.meta.key||(isometricImage?isometricKey:'furniture'),placed?.meta.index??(isometricImage?0:index),placed?.centerX??p.x,placed?.bottom??p.y+t*.15,w,h,{flip:placed?.flip??(!!isometricImage&&o.dir%2===1),alpha:edit?.ghost?.existing===o.uid ? .35 : edit?.ghost===true ? .7 : 1});this.ctx.restore();
    if(f.category==='server'&&o.stock>0){const food=this.serverFoodLayout(o);this.sprite(food.key,food.index,food.x,food.y,food.width,food.height);}
    if(f.category==='stove'&&o.cook){const status=stoveStatus(s,o);if(status!=='cooking')this.drawFoodOnSurface(o.cook.foodId,placed?.surface?.x??p.x,placed?.surface?.y??p.y-t*.48,t*PREPARED_FOOD_SCALE,{filter:status==='spoiled'?'hue-rotate(100deg) saturate(.45)':''});else{const c=this.ctx;c.fillStyle='#f3ebc488';for(let i=0;i<3;i++){const phase=(clock*.6+i*.3)%1;c.fillRect(p.x-13+i*12+Math.sin(clock*2+i)*3,p.y-t*.72-phase*20,4,6);}}}
    const hitKey=placed?.meta.key||(isometricImage?isometricKey:'furniture'),hitIndex=placed?.meta.index??(isometricImage?0:index),hitImage=this.sprites[hitKey]?.[hitIndex];
    this.hits.push({kind:'object',uid:o.uid,x:placed?.x??p.x-w/2,y:placed?.y??p.y+t*.15-h,w,h,flip:placed?.flip??(!!isometricImage&&o.dir%2===1),mask:this.hitMask(hitImage)});
  }
  drawPerson(s,a,waiter,clock,active=this.animating!==false){
    const artId=!waiter&&(a.red||a.zombieId==='red')?'dokkaebi':a.zombieId;
    const c=this.ctx,p=this.world(a.x,a.y),walking=!!a.path?.length,bob=walking?Math.sin(clock*12)*1.7:Math.sin(clock*2+a.x)*.6,t=this.tile,def=waiter?null:zombie(artId),isSeated=['waiting','eating'].includes(a.phase),short=def?.id==='prince';
    c.fillStyle='#17282644';c.beginPath();c.ellipse(p.x,p.y+3,t*.18,t*.075,0,0,Math.PI*2);c.fill();
    const chair=isSeated?s.objects.find(o=>o.uid===a.seat):null,chairFacing=seatedDirection(s,chair);
    const directionalMeta=!waiter?directionalCharacter(artId):null,entry=zombieEntrance(s),queuedAtDoor=!waiter&&a.phase==='queue'&&!a.path?.length&&Math.hypot(a.x-entry.x,a.y-entry.y)<1e-6;
    const pose=directionalMeta?walkingPose(a,this.walkingStates.get(a),{reducedMotion:this.motionPreference.matches,active,time:s.time+(s.fraction||0),seatedDirection:chairFacing,idleDirection:queuedAtDoor?1:null,frameCount:directionalMeta.walkFrames||directionalMeta.frames.walk.length,fps:directionalMeta.fps||7,keys:null,sequence:directionalMeta.sequence||null}):null;
    if(pose)this.walkingStates.set(a,pose);
    let flip=pose?pose.flip:queuedAtDoor?true:walking&&(a.path[0][0]-a.x)-(a.path[0][1]-a.y)<0;
    const appearance=a.appearance??Math.max(0,s.waiters.indexOf(a)),workerArt=waiter?workerFrame(appearance,{infected:a.infectedUntil>s.time}):null;
    const mapped=waiter&&this.sprites.workers?.length?(this.sprites[workerArt.key]?.length?workerArt:{key:'workers',index:appearance}):characterFrame(waiter?15:def?.sprite||0);let atlas=mapped.key,index=mapped.index;
    const directional=!!pose&&!!this.sprites[directionalMeta.key]?.length;
    const seatedRow=ASSET_MANIFEST.seatedNeighbors?.actorRows?.[artId],officeSeat=artId==='office'&&!!this.sprites.seatedOffice?.length,dedicatedSeat=!waiter&&isSeated&&!!chair&&(officeSeat||seatedRow!==undefined&&!!this.sprites.seatedNeighbors?.length);
    let h=t*(short?.8:waiter?1.02:1.07),w;
    if(directional){const frameCount=directionalMeta.walkFrames||directionalMeta.frames.walk.length;atlas=directionalMeta.key;index=pose.direction*(frameCount+1)+(isSeated?frameCount:pose.frame);flip=false;}
    else if(dedicatedSeat){atlas=officeSeat?'seatedOffice':'seatedNeighbors';index=(officeSeat?0:seatedRow*4)+(chairFacing||0);flip=false;}
    if(directional&&chair&&a.phase==='eating'){const extra=eatingCharacter(artId);if(extra&&this.sprites[extra.key]?.length){const selected=eatingSpriteFrame(directionalMeta,extra,pose.direction,eatingAnimationFrame(a,s.time+(s.fraction||0),{reducedMotion:this.motionPreference.matches}));if(selected){atlas=selected.key;index=selected.index;}}}
    const image=this.sprites[atlas]?.[index];
    // Scale uniformly: preserve the actual character silhouette instead of
    // stretching every image into a fixed width/height rectangle.
    let y=p.y+5+(waiter||isSeated||pose||this.motionPreference.matches?0:bob),placement;
    if(directional||dedicatedSeat){
      const meta=ASSET_MANIFEST[atlas],cellHeight=image?.height||meta.cell?.height||280;
      const hip=isSeated&&chair?(this.eatingRegistrations?.[atlas]?.[index]?.hip||meta.poses?.[index]?.hip):null,anchor=hip||meta.poses?.[index]?.anchor||meta.anchor||{x:140,y:270};
      const standingHeight=meta.referenceHeight||257,scale=h/standingHeight;
      for(const companion of this.companions?.[atlas]?.[index]||[]){const offset=companion.relativeGroundOffset||{x:0,y:0},foot=companion.footAnchor,im=companion.image;this.ctx.drawImage(im,p.x+offset.x*h-foot.x*scale,p.y+5+offset.y*h-foot.y*scale,im.width*scale,im.height*scale);}
      w=(image?.width||280)*scale;h=cellHeight*scale;
      const offsetX=((image?.width||280)/2-anchor.x)*scale;
      const attachment=hip?this.chairGeometry(chair).seat:{x:p.x,y};
      placement={x:attachment.x+offsetX-w/2,y:attachment.y-anchor.y*scale,width:w,height:h};
      this.sprite(atlas,index,attachment.x+offsetX,attachment.y+(cellHeight-anchor.y)*scale,w,h,{flip:false});
    }else{
      if(isSeated)h*=.86;
      w=h*(image?image.width/image.height:.64);
      placement={x:p.x-w/2,y:y-h,width:w,height:h,flip};
      const infected=waiter&&a.infectedUntil>s.time,renderImage=waiter?workerInfectedSprite(image,{infected,precolored:!!ASSET_MANIFEST[atlas]?.precoloredInfected}):image;
      const moving=active&&(walking||Math.abs(a.x-Math.round(a.x))>.001||Math.abs(a.y-Math.round(a.y))>.001);
      const walked=waiter&&image&&drawWorkerWalk(c,renderImage,placement,{flip,clock,appearance,infected,moving,reducedMotion:this.motionPreference.matches});
      if(!walked)this.sprite(atlas,index,p.x,y,w,h,{flip,image:renderImage,infected});
    }
    const santaHat=waiter?drawStaffSantaHat(c,s,placement,appearance):null;if(santaHat)this.staffSeasonalHats?.push({uid:a.uid,appearance,...santaHat});
    if(waiter){const trayX=p.x+(flip?-1:1)*t*.15,trayY=y-h*.22,tray=this.sprites.waiterTray?.[0],scale=tray?t*.46/tray.width:1,anchor=ASSET_MANIFEST.waiterTray?.foodAnchor;if(tray)this.sprite('waiterTray',0,trayX,trayY,t*.46,null,{flip});const foodY=tray&&anchor?trayY-(tray.height-anchor.y)*scale:trayY-t*.13;if(a.task?.picked&&['transfer','serve'].includes(a.task.kind)&&recipe(a.task.foodId))this.drawFoodOnSurface(a.task.foodId,trayX,foodY,t*.4);}
    if(a.phase==='eating'&&chair&&!seats(s).find(seat=>seat.uid===a.seat)?.table){const seat=this.chairGeometry(chair).seat,[dx,dy]=DIRECTIONS[chair.dir||0];this.drawFoodOnSurface(a.foodId,seat.x+(dx-dy)*t*.12,seat.y+(dx+dy)*t*.06,t*.38);}
    if(chair)this.drawChairFront(chair);
    let bubble=null;
    const favoriteThought=!waiter&&needsFavoriteThought(a,zombie(a.zombieId)?.favorite,s.time+(s.fraction||0));
    const thoughtKey=favoriteThought?'favoriteThought':'hungerThought';
    if(!waiter&&(needsHungerBubble(a)||favoriteThought)&&image&&this.sprites[thoughtKey]?.[0]){
      this.hungerHeads??=new WeakMap();let head=this.hungerHeads.get(image);
      if(head===undefined){head=visibleHeadBounds(this.hitMask(image),ASSET_MANIFEST[atlas]?.poses?.[index]?.headPolygon);this.hungerHeads.set(image,head);}
      if(head){const thought=this.sprites[thoughtKey][0];bubble={uid:a.uid,atlas,index,thought:thoughtKey,...hungerBubbleGeometry(head,{...placement,sourceWidth:image.width,sourceHeight:image.height},thought.height/thought.width,t*HUNGER_BUBBLE_TILE_RATIO)};this.hungerLayout?.push(bubble);}
    }
    if(a.red)this.actorMarkers?.push({text:'!',x:bubble?bubble.head.x+bubble.head.width*.65:p.x,y:bubble?bubble.head.y:placement.y-this.tile*.04,options:{kind:'hostile',background:'#b65d4f',border:'#efbd82'}});
    else if(waiter&&a.infectedUntil>s.time){const marker=worldMarkerMetrics(t,this.camera.zoom);this.actorMarkers?.push({uid:a.uid,text:'치료',x:p.x,y:santaHat?santaHat.y-marker.gap-3*marker.pixel:placement.y-this.tile*.04,options:{kind:'cure',background:'#8d5f66'}});}
    else if(!waiter&&!needsHungerBubble(a)&&!favoriteThought){const line=guestDialogue(a,{favorite:zombie(a.zombieId)?.favorite===a.foodId,time:s.time+(s.fraction||0)});if(line){const options={...(a.phase==='waiting'?{background:'#8b633d'}:{})};if(this.guestLabels)this.guestLabels.push({text:line,x:p.x,y:p.y-h,options});else this.worldLabel(line,p.x,p.y-h,{...options,kind:'dialogue'});}}
    if(waiter)this.hits.push({kind:'waiter',uid:a.uid,x:p.x-w/2,y:y-h,w,h,flip,mask:this.hitMask(image)});
  }
  drawMeal(s,customer){const seat=seats(s).find(item=>item.uid===customer.seat);if(!seat?.table)return;const table=seat.table,shape=furnitureFootprint(table),cx=table.x+(shape.width-1)/2,cy=table.y+(shape.height-1)/2,dx=seat.chair.x-cx,dy=seat.chair.y-cy,p=this.world(cx+dx*.4,cy+dy*.4);const center=this.world(cx,cy),surface=this.furnitureGeometry(table)?.surface||{x:center.x,y:center.y-this.tile*.39};this.drawFoodOnSurface(customer.foodId,surface.x+p.x-center.x,surface.y+p.y-center.y,this.tile*.38);}
  drawEmptyDish(seat){const {table,chair}=seat,shape=furnitureFootprint(table),cx=table.x+(shape.width-1)/2,cy=table.y+(shape.height-1)/2,dx=chair.x-cx,dy=chair.y-cy,point=this.world(cx+dx*.4,cy+dy*.4),center=this.world(cx,cy),surface=this.furnitureGeometry(table)?.surface||{x:center.x,y:center.y-this.tile*.39},width=this.tile*.27,height=width*20/32;this.sprite('emptyDish',0,surface.x+point.x-center.x,surface.y+point.y-center.y+height*.14,width,height);}
  accessibleObjects(s){return s.objects.filter(o=>furniture(o.type)?.category==='stove').map((o,i)=>({uid:o.uid,label:`가마솥 ${i+1} · ${{empty:'비어 있음 · 요리 선택',cooking:'조리 중 · 남은 시간 보기',done:'완성 · 서빙대로 옮기기',collecting:'서빙대로 운반 중',spoiled:'상한 음식 · 되살리기 또는 버리기'}[stoveStatus(s,o)]}`}));}
}
