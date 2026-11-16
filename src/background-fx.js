// Simulation time keeps scenery still when the game is paused.
export function backgroundFrame(kind,time,{reducedMotion=false,offset=0}={}){
  if(reducedMotion||!Number.isFinite(time))return 0;
  const t=Math.max(0,time+offset);
  if(kind==='fire')return Math.floor(t*4)%2;
  if(kind==='corpse'){
    const phase=t%7;
    return phase>=5.9&&phase<6.6?Math.floor((phase-5.9)*8+1e-8)%2:0;
  }
  return 0;
}

export function backgroundFxGeometry(background,viewport,placement,image,pose,clip){
  const scale=Math.max(viewport.width/background.width,viewport.height/background.height);
  const width=placement.width*scale,height=width*image.height/image.width;
  const anchor=pose?.anchor||{x:image.width/2,y:image.height};
  const x=(viewport.width-background.width*scale)/2+placement.x*scale-anchor.x/image.width*width;
  return{x:Number.isFinite(clip?.right)?Math.min(x,clip.right-width):x,
    y:(viewport.height-background.height*scale)/2+placement.y*scale-anchor.y/image.height*height,width,height};
}
