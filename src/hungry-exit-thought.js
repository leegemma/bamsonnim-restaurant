// Only a natural patience timeout marks an unsuccessful meal departure.
export const needsHungryExitThought=actor=>!actor.removed&&actor.phase==='leaving'&&actor.departureReason==='hungry';
export function drawHungryExitFace(ctx,box,face){
 if(!face)return;
 const {x,y,w,h}=box;
 ctx.save();ctx.fillStyle='#fff';ctx.beginPath();ctx.ellipse(x+w*.5,y+h*.4,w*.36,h*.3,0,0,Math.PI*2);ctx.fill();
 const width=w*.72,height=width*face.height/face.width;
 ctx.drawImage(face,x+(w-width)/2,y+h*.1,width,height);ctx.restore();
}
