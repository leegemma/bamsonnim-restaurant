import {christmasActive} from './seasonal-scene.js';

// Crown anchors are fractions of each trimmed employee sprite. The two
// appearance atlases share these head positions; only the feet animate.
export const STAFF_HAT_ANCHORS=Object.freeze([
 {x:.44,y:.035,width:.64},
 {x:.47,y:.02,width:.66},
 {x:.57,y:.025,width:.63},
 {x:.48,y:.025,width:.65},
 {x:.44,y:.035,width:.66},
 {x:.46,y:.03,width:.65},
 {x:.48,y:.025,width:.67},
 {x:.48,y:.03,width:.67},
].map(Object.freeze));
const pixels=[
 '......dddd......',
 '.....drrrrd.....',
 '....drrrrrrd....',
 '...drrrrrrrrd...',
 '..drrrrrrrrrrd..',
 '.drrrrrrrrrrrrd.',
 '.drrrrrrrrrdddd.',
 'drrrrrrrrrrdffff',
 'drrrrrrrrrrdffff',
 'dddddddddddd.fff',
 'dffffffffffd....',
 '.dffffffffd.....',
];
const colors={d:'#58352d',r:'#c8463e',f:'#f5e6c7'};
export const staffChristmasActive=christmasActive;
export function staffHatGeometry(placement,appearance=0){
 const anchor=STAFF_HAT_ANCHORS[appearance]||STAFF_HAT_ANCHORS[0],flip=!!placement.flip,brim=placement.width*anchor.width,pixel=brim/12;
 const center=placement.x+placement.width*(flip?1-anchor.x:anchor.x),bottom=placement.y+placement.height*anchor.y;
 return{x:center-(flip?10:6)*pixel,y:bottom-12*pixel,w:16*pixel,h:12*pixel,center,bottom,pixel,flip};
}
export function drawStaffSantaHat(ctx,state,placement,appearance=0){
 if(!staffChristmasActive(state))return null;
 const hat=staffHatGeometry(placement,appearance);
 ctx.save();ctx.translate(hat.center,hat.bottom);if(hat.flip)ctx.scale(-1,1);ctx.translate(-6*hat.pixel,-12*hat.pixel);
 for(let y=0;y<pixels.length;y++)for(let x=0;x<pixels[y].length;x++){const color=colors[pixels[y][x]];if(color){ctx.fillStyle=color;ctx.fillRect(x*hat.pixel,y*hat.pixel,hat.pixel,hat.pixel);}}
 ctx.restore();return hat;
}
