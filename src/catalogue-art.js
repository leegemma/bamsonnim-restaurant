import {CATALOGUE_ENTRIES} from './catalogue-expansion.js';
import {CATALOGUE_IMAGE_BOUNDS} from './catalogue-image-bounds.js';
import {calibrateTable} from './catalogue-table-calibration.js';
import {CHAIR_CONTACTS} from './catalogue-chair-contacts.js';
import {QUARTER_FURNITURE} from './quarter-furniture.generated.js';
// Anchors are local to the measured alpha crop. Four-facing chairs keep the
// correct seat/front layer instead of stretching a front drawing backwards.
const contacts={
 'chair-plastic-blue':{groundY:.87,seatY:.50,groundWidth:.94,footprint:.54},
 'chair-shell-white':{groundY:.89,seatY:.48,groundWidth:.92,footprint:.52},
 'stool-plastic-blue':{groundY:.86,seatY:.20,groundWidth:.94,footprint:.48},
 'stool-plastic-red':{groundY:.86,seatY:.20,groundWidth:.94,footprint:.48},
 'stool-log':{groundY:.94,seatY:.20,groundWidth:.94,footprint:.47},
 'sofa-dabang-single':{groundY:.89,seatY:.57,groundWidth:.94,footprint:.64},
 'sofa-dabang-double':{groundY:.90,seatY:.60,groundWidth:.94,footprint:1.2},
 'table-folding-blue':{groundY:.88,surfaceY:.19,groundWidth:.88,footprint:.76},
 'table-log':{groundY:.95,surfaceY:.22,groundWidth:.65,footprint:.66},
 'table-dabang':{groundY:.89,surfaceY:.22,groundWidth:.84,footprint:.74},
 'stove-kettle-bbq':{groundY:.89,surfaceY:.31,groundWidth:.83,footprint:.82},
 'stove-overhead-grill':{groundY:.94,surfaceY:.72,groundWidth:.92,footprint:.84},
 'stove-portable-butane':{groundY:.84,surfaceY:.31,groundWidth:.92,footprint:.78},
 'serving-cart-stainless':{groundY:.90,surfaceY:.16,groundWidth:.94,footprint:.88},
 'serving-robot':{groundY:.93,surfaceY:.43,groundWidth:.94,footprint:.76},
 'serving-cabinet-najeon':{groundY:.91,surfaceY:.16,groundWidth:.94,footprint:.86},
 'table-bbq-wood-wide':{groundY:.89,surfaceY:.19,groundWidth:.94,footprint:1.38},
 'table-aluminum-floral-soban':{groundY:.91,surfaceY:.27,groundWidth:.94,footprint:.74},
 'decor-aquarium':{groundY:.88,groundWidth:.95,footprint:1.38},
 'decor-christmas-village':{groundY:.88,groundWidth:.95,footprint:1.38},
 'decor-christmas-trees':{groundY:.88,groundWidth:.95,footprint:1.78},
};
// Native source rectangles remove rejected baked glow without modifying PNGs.
const wallCrops={
 'decor-landscape-poster':{x:198,y:253,width:630,height:1186},
 'decor-bamboo-blind':{x:90,y:89,width:842,height:1375},
 'decor-ink-bird-flower':{x:233,y:186,width:557,height:1277},
 'decor-window-red-curtains':{x:193,y:84,width:1147,height:868},
};
const windowOutline=[[202,92],[1328,92],[1338,111],[1335,159],[1280,169],[1282,220],[1272,330],[1255,470],[1248,565],[1292,608],[1277,651],[1304,759],[1332,897],[1232,943],[1141,916],[1102,899],[432,899],[388,931],[300,943],[197,902],[224,797],[253,680],[273,641],[253,608],[279,563],[272,480],[260,367],[246,242],[248,172],[196,161],[194,111]];
export const CATALOGUE_ASSETS=CATALOGUE_ENTRIES.map(entry=>{
 const info=CATALOGUE_IMAGE_BOUNDS[entry.asset],width=info?.width||1254,height=info?.height||1254,base={key:entry.artKey,name:entry.name,url:'/assets/'+entry.asset,width,height,lazy:true,trim:false};
 if(['wall','floor'].includes(entry.category))return{...base,type:entry.category+'-texture',cols:1,rows:1};
 const directional=(entry.category==='chair'&&entry.id!=='stool-log')||['decor-aquarium','decor-christmas-village','table-bbq-wood-wide'].includes(entry.id),count=directional||entry.category==='chair'?4:1,contact=contacts[entry.id]||{groundY:.90,seatY:.50,surfaceY:.22,groundWidth:.92,footprint:entry.category==='chair'?.53:entry.category==='table'?.74:entry.category==='decor'?.68:.84},poses=[];
 for(let dir=0;dir<count;dir++){
  const cell=directional?[0,1,3,2][dir]:0,col=directional?cell%2:0,row=directional?Math.floor(cell/2):0,cols=directional?2:1,region=info?.cells[cell]?.source||{x:Math.floor(col*width/cols),y:Math.floor(row*height/cols),width:Math.floor((col+1)*width/cols)-Math.floor(col*width/cols),height:Math.floor((row+1)*height/cols)-Math.floor(row*height/cols)},bounds=info?.cells[cell]?.bounds||{x:0,y:0,width:region.width,height:region.height},crop=wallCrops[entry.id],source=crop||{x:region.x+bounds.x,y:region.y+bounds.y,width:bounds.width,height:bounds.height},w=source.width,h=source.height;
  const pose={index:dir,itemId:entry.id,category:entry.category,dir,source,groundCenter:{x:w*.5,y:h*contact.groundY},groundWidth:w*contact.groundWidth,footprint:contact.footprint,mirrorOdd:!directional&&entry.category!=='chair'};
  if(entry.id==='decor-window-red-curtains')pose.clipPolygons=[windowOutline.map(([x,y])=>[x-source.x,y-source.y])];
  if(entry.category==='chair'){pose.seatAnchor={x:w*.5,y:h*contact.seatY};
   const measured=CHAIR_CONTACTS[entry.id]?.[dir];
   if(measured){const [x,seatY,groundY]=measured;pose.seatAnchor={x,y:seatY};pose.groundCenter={x,y:groundY};}
   if(entry.id==='sofa-dabang-double'){
    const anchors=[[[.71,.53],[.37,.698]],[[.63,.698],[.29,.53]],[[.29,.70],[.63,.50]],[[.37,.50],[.71,.70]]][dir];
    pose.seatAnchors=anchors.map(([x,y])=>({x:w*x,y:h*y}));
    pose.seatAnchor={x:pose.seatAnchors.reduce((sum,p)=>sum+p.x,0)/2,y:pose.seatAnchors.reduce((sum,p)=>sum+p.y,0)/2};
   }
   // The two-seat sofa fits both logical cell centers to its real cushions.
   const reference=QUARTER_FURNITURE.poses.find(p=>p.category==='chair'&&p.dir===dir),target=(reference.groundCenter.y-reference.seatAnchor.y)*reference.footprint/reference.groundWidth;
   if(pose.seatAnchors){
    // Two logical cell centers project half a tile across and a quarter down.
    // Fit the actual cushion pair uniformly, then register its ground plane
    // so both seats retain the legacy seat height, rather than scaling a
    // two-person couch around a single center seat.
    const [a,b]=pose.seatAnchors,dx=b.x-a.x,dy=b.y-a.y,[wx,wy]=[[-.5,.25],[-.5,-.25],[.5,-.25],[.5,.25]][dir],scalePerTile=(dx*wx+dy*wy)/(dx*dx+dy*dy);
    pose.footprint=scalePerTile*pose.groundWidth;
    pose.groundCenter={x:pose.seatAnchor.x,y:pose.seatAnchor.y+target/scalePerTile};
   }
   const front=dir<2?Math.min(.95,pose.seatAnchor.y/h+.09):0;pose.frontPolygon=[[0,h*front],[w,h*front],[w,h],[0,h]];}
  if(['table','stove','server'].includes(entry.category))pose.surfaceAnchor={x:w*.5,y:h*contact.surfaceY};
  if(entry.category==='table')calibrateTable(pose,entry.id,source);
  poses.push(pose);
 }
 return{...base,type:'furniture-atlas',directional,shareFrames:entry.id==='stool-log',poses};
});
