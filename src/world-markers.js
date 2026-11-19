const clamp=(min,value,max)=>Math.max(min,Math.min(max,value));

// Values are scene pixels. The scene transform applies zoom once, keeping
// small-room markers readable and expanded-room markers close to actor size.
export function worldMarkerMetrics(tile,zoom=1){
 const z=Number.isFinite(zoom)&&zoom>0?zoom:1,t=Number.isFinite(tile)&&tile>0?tile:22,rendered=t*z;
 return{fontSize:clamp(8,rendered*.22,12)/z,height:clamp(12,rendered*.38,20)/z,padding:clamp(3,rendered*.08,5)/z,pixel:clamp(.7,rendered*.018,1)/z,textOffsetY:.5/z,gap:clamp(2,rendered*.06,5)/z,icon:clamp(8,rendered*.28,14)/z};
}
export function cureMarkerHit(uid,rect,zoom=1){
 const min=28/zoom,w=Math.max(min,rect.w),h=Math.max(min,rect.h);
 return{kind:'cure',uid,x:rect.x+(rect.w-w)/2,y:rect.y+(rect.h-h)/2,w,h,badge:rect};
}
export function pickCureMarker(hits,point){
 const contains=r=>point.x>=r.x&&point.x<r.x+r.w&&point.y>=r.y&&point.y<r.y+r.h;
 const candidates=hits.filter(h=>h.kind==='cure'&&contains(h));
 // Adjacent expanded tap targets resolve to the visible badge under the tap,
 // then the nearest badge center, rather than the last-drawn employee.
 return candidates.sort((a,b)=>Number(contains(b.badge))-Number(contains(a.badge))||Math.hypot(point.x-a.badge.x-a.badge.w/2,point.y-a.badge.y-a.badge.h/2)-Math.hypot(point.x-b.badge.x-b.badge.w/2,point.y-b.badge.y-b.badge.h/2))[0]||null;
}
