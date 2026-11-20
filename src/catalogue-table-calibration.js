import {TABLE_CONTACTS} from './catalogue-table-contacts.js';
import {QUARTER_FURNITURE} from './quarter-furniture.generated.js';
const reference=QUARTER_FURNITURE.poses.find(p=>p.category==='table');
const edges=polygon=>polygon.map((p,i)=>Math.hypot(p[0]-polygon[(i+1)%4][0],p[1]-polygon[(i+1)%4][1]));
const mean=values=>values.reduce((sum,n)=>sum+n,0)/values.length;
export const BASIC_TABLE_SIDE=mean(edges(reference.surfacePolygon))*reference.footprint/reference.groundWidth;
// A world circle's screen major diameter is sqrt(.5) times its world diameter;
// a square world side projects with length sqrt(.5² + .25²).
export const BASIC_TABLE_ROUND_DIAMETER=BASIC_TABLE_SIDE*Math.sqrt(.5)/Math.hypot(.5,.25);
export function calibrateTable(pose,id,source){
 const rows=TABLE_CONTACTS[id],contact=rows?.[pose.dir]||rows?.[0];if(!contact)return;
 const local=([x,y])=>[x-source.x,y-source.y];
 let scalePerTile;
 if(contact.polygon){
  pose.surfacePolygon=contact.polygon.map(local);
  const sides=edges(pose.surfacePolygon).sort((a,b)=>a-b),short=id==='table-bbq-wood-wide'?mean(sides.slice(0,2)):mean(sides);
  scalePerTile=BASIC_TABLE_SIDE/short;
  pose.surfaceAnchor={x:mean(pose.surfacePolygon.map(p=>p[0])),y:mean(pose.surfacePolygon.map(p=>p[1]))};
 }else{
  const {center,rx,ry}=contact.ellipse,[x,y]=local(center);
  pose.surfaceEllipse={center:{x,y},rx,ry};pose.surfaceAnchor={x,y};
  scalePerTile=BASIC_TABLE_ROUND_DIAMETER/(2*rx);
 }
 const [x,y]=local(contact.ground);pose.groundCenter={x,y};
 pose.footprint=scalePerTile*pose.groundWidth;
}
