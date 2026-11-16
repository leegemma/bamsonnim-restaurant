// Transparent parts of a front sprite must not hide a visible object behind it.
export function containsHit(hit,point){
 if(point.x<hit.x||point.y<hit.y||point.x>=hit.x+hit.w||point.y>=hit.y+hit.h)return false;
 if(hit.circle)return Math.hypot((point.x-hit.x-hit.w/2)/(hit.w/2),(point.y-hit.y-hit.h/2)/(hit.h/2))<=1;
 if(!hit.mask)return true;
 const {width,height,alpha}=hit.mask;
 let x=Math.min(width-1,Math.floor((point.x-hit.x)/hit.w*width));
 const y=Math.min(height-1,Math.floor((point.y-hit.y)/hit.h*height));
 if(hit.flip)x=width-1-x;
 return alpha[y*width+x]>32;
}
export function pickHit(hits,point){
 for(let i=hits.length-1;i>=0;i--)if(containsHit(hits[i],point))return hits[i];
 return null;
}
