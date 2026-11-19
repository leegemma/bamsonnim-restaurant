// Healthy and infected atlases share the same eight appearance indexes.
export function workerFrame(appearance=0,{infected=false}={}){
  return {key:infected?'workersInfected':'workers',index:appearance};
}
const infectedSprites=new WeakMap();
export function infectedWorkerColor(r,g,b){const light=r*.2126+g*.7152+b*.0722;return[Math.round(light*.62),Math.min(255,Math.round(light*1.03)),Math.round(light*.48)];}
export function workerInfectedSprite(base,{infected=false,precolored=false}={}){
  if(!infected||precolored||!base?.getContext)return base;
  let filtered=infectedSprites.get(base);if(filtered)return filtered;
  filtered=base.ownerDocument.createElement('canvas');filtered.width=base.width;filtered.height=base.height;
  const ctx=filtered.getContext('2d'),pixels=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,base.width,base.height);
  for(let i=0;i<pixels.data.length;i+=4){if(!pixels.data[i+3])continue;const [r,g,b]=infectedWorkerColor(pixels.data[i],pixels.data[i+1],pixels.data[i+2]);pixels.data[i]=r;pixels.data[i+1]=g;pixels.data[i+2]=b;}
  ctx.putImageData(pixels,0,0);infectedSprites.set(base,filtered);return filtered;
}
