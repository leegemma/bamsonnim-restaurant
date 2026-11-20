// Instance-local compatibility: old saved cabinets retain one logical cell.
export const NAJEON_ID='serving-cabinet-najeon';
export const isNajeon=o=>o?.type===NAJEON_ID;
export const isLegacyNajeon=o=>isNajeon(o)&&o.najeonLayout===1;
export function najeonShape(o){if(!isNajeon(o))return null;return isLegacyNajeon(o)?{width:1,height:1}:(o.dir||0)%2?{width:1,height:2}:{width:2,height:1};}
export function normalizeSavedNajeon(o){
 if(!isNajeon(o)){if(o.najeonLayout!==undefined)throw Error('나전 배치 정보가 올바르지 않습니다.');return;}
 if(o.najeonLayout===undefined)o.najeonLayout=1;
 if(o.najeonLayout!==1&&o.najeonLayout!==2)throw Error('나전 배치 정보가 올바르지 않습니다.');
}
export function najeonServiceCells(o){const shape=najeonShape(o);if(!shape)return null;if(isLegacyNajeon(o))return[[o.x+1,o.y],[o.x,o.y+1],[o.x-1,o.y],[o.x,o.y-1]];const cells=[];for(let x=0;x<shape.width;x++){cells.push([o.x+x,o.y-1],[o.x+x,o.y+shape.height]);}for(let y=0;y<shape.height;y++){cells.push([o.x-1,o.y+y],[o.x+shape.width,o.y+y]);}return cells;}
export function najeonRenderArt(o,art){
 // Use the latest artwork in both modes. Fit old instances to their original
 // .86/.94 tile display width even when the new artwork calibration changes.
 return isLegacyNajeon(o)&&art?{...art,footprint:(.86/.94)*art.groundWidth/art.width}:art;
}
