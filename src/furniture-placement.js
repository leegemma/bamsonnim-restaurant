import {ASSET_MANIFEST} from './assets.js';

// Measured contacts in the trimmed legacy artwork. A unified sheet can supply
// the same geometry without changing room placement or saved furniture IDs.
const legacy={
 server:{key:'serverIsometric',index:0,width:723,height:698,groundCenter:{x:354.5,y:566.5},groundWidth:578,footprint:.9,surface:{x:365,y:184}},
 stove:{key:'stoveIsometric',index:0,width:847,height:888,groundCenter:{x:424,y:659.85},groundWidth:822,footprint:.9,surface:{x:424,y:170}},
 table:{key:'furniture',index:0,width:271,height:233,groundCenter:{x:135,y:185},groundWidth:190,footprint:.65,surface:{x:135,y:70}},
};
export function furnitureArt(category,dir=0){
 const unified=Object.values(ASSET_MANIFEST).filter(asset=>asset.type==='furniture-atlas').find(asset=>asset.poses?.some(p=>p.category===category&&(category!=='chair'||p.dir===dir))),pose=unified?.poses.find(p=>p.category===category&&(category!=='chair'||p.dir===dir));
 if(pose)return{...pose,key:unified.key,index:pose.index,width:pose.source.width,height:pose.source.height,seat:pose.seatAnchor,front:pose.frontPolygon,surface:pose.surfaceAnchor};
 if(category==='chair'){
  const chair=ASSET_MANIFEST.furniture.chairs[dir];if(!chair)return null;
  return{...chair,key:'furniture',groundCenter:{x:dir<2?95:86.5,y:dir<2?232:dir===2?217.5:219},groundWidth:dir<2?150:130,footprint:.5};
 }
 return legacy[category]||null;
}
export function placedFurniture(art,image,point,tile,flip=false){
 if(!art)return null;const source=image||{width:art.width,height:art.height};
 const scale=tile*art.footprint/(art.groundWidth*source.width/art.width),w=source.width*scale,h=source.height*scale;
 const gx=(flip?art.width-art.groundCenter.x:art.groundCenter.x)/art.width,gy=art.groundCenter.y/art.height;
 const x=point.x-w*gx,y=point.y-h*gy;
 const project=anchor=>anchor?{x:x+w*(flip?1-anchor.x/art.width:anchor.x/art.width),y:y+h*anchor.y/art.height}:null;
 return{meta:art,im:image,x,y,w,h,scale,centerX:x+w/2,bottom:y+h,flip,surface:project(art.surface),seat:project(art.seat)};
}
