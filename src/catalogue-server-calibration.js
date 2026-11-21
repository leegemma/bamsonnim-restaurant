// Measured contacts in the new quarter-view drawings; preserve each approved
// counter's floor-to-food-surface height while registering its real tray.
// The live default quarterServer uses surface188/ground558, footprint.9/width672.
const defaultServerSurfaceHeight=(558-188)*.9/672;
// Retain the original robot pixel-to-world scale so the shorter redraw stays shorter.
const robotNativeScale=.7845547675334909/(1110-600);
const contacts={
 'serving-cart-stainless':{surface:[619,367],ground:[619,988],height:defaultServerSurfaceHeight},
 'serving-robot':{surface:[580,646],ground:[630,1112],height:(1112-646)*robotNativeScale},
 'serving-cabinet-najeon':{surface:[622.5,402.75],ground:[622.5,890.75],height:.5783753256033747},
};
export function calibrateServer(pose,id,source){
 const contact=contacts[id];if(!contact)return;
 const local=([x,y])=>({x:x-source.x,y:y-source.y});
 pose.surfaceAnchor=local(contact.surface);pose.groundCenter=local(contact.ground);
 pose.footprint=contact.height/(contact.ground[1]-contact.surface[1])*pose.groundWidth;
}
