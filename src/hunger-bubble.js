// Hunger is derived from the service phase; counter stock is not a delivery.
export const needsHungerBubble=actor=>!actor.removed&&['queue','seating','waiting'].includes(actor.phase);

// Measure the visible upper silhouette, excluding transparent atlas padding,
// arms and ground companions. Explicit head polygons bound the scan when present.
export function visibleHeadBounds({width,height,alpha},polygon=null){
 let left=width,top=height,right=-1,bottom=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(alpha[y*width+x]>80){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 if(right<left)return null;
 const headBottom=polygon?Math.max(...polygon.map(p=>p[1])):top+(bottom-top+1)*.43;
 const minX=polygon?Math.min(...polygon.map(p=>p[0])):left,maxX=polygon?Math.max(...polygon.map(p=>p[0])):right;
 let headLeft=width,headRight=-1;
 for(let y=top;y<=Math.min(bottom,Math.floor(headBottom));y++)for(let x=Math.max(0,Math.ceil(minX));x<=Math.min(width-1,Math.floor(maxX));x++)if(alpha[y*width+x]>80){headLeft=Math.min(headLeft,x);headRight=Math.max(headRight,x);}
 return headRight<headLeft?null:{x:(headLeft+headRight+1)/2,y:top,width:headRight-headLeft+1};
}

export function hungerBubbleGeometry(head,placement,aspect){
 const {x,y,width,height,sourceWidth,sourceHeight,flip=false}=placement;
 const center=x+(flip?sourceWidth-head.x:head.x)*width/sourceWidth;
 const headTop=y+head.y*height/sourceHeight,headWidth=head.width*width/sourceWidth;
 const w=headWidth*.6,h=w*aspect,gap=headWidth*.015;
 return {x:center-w/2,y:headTop-gap-h,w,h,head:{x:center,y:headTop,width:headWidth}};
}
