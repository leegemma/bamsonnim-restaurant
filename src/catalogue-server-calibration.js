// Measured contacts in the new quarter-view drawings; preserve each approved
// counter's floor-to-food-surface height while registering its real tray.
const contacts={
 'serving-cart-stainless':{surface:[619,367],ground:[619,988],height:.825704359292978},
 'serving-robot':{surface:[580,600],ground:[628,1110],height:.7845547675334909},
 'serving-cabinet-najeon':{surface:[622.5,402.75],ground:[622.5,890.75],height:.5783753256033747},
};
export function calibrateServer(pose,id,source){
 const contact=contacts[id];if(!contact)return;
 const local=([x,y])=>({x:x-source.x,y:y-source.y});
 pose.surfaceAnchor=local(contact.surface);pose.groundCenter=local(contact.ground);
 pose.footprint=contact.height/(contact.ground[1]-contact.surface[1])*pose.groundWidth;
}
