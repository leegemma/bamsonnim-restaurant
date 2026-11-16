// Original 6/8 composition: 72 bars, 135 seconds at the normal tempo.
export const TRACK_BARS=72;
export const STEPS_PER_BAR=6;
export const STEP_SECONDS={normal:.3125,danger:.34,fever:.235};
const A=[
 [74,0,77,81,79,0],[77,76,0,74,0,69],[70,0,74,77,76,74],[73,0,76,0,69,0],
 [74,77,0,81,84,81],[79,0,77,76,0,72],[70,74,77,0,76,73],[74,0,0,69,0,0],
];
const B=[
 [81,0,84,86,0,84],[81,79,0,77,79,81],[82,0,81,79,77,0],[76,0,73,69,0,0],
 [77,81,84,0,86,84],[79,82,0,81,79,77],[76,77,79,0,73,0],[74,0,77,76,74,0],
];
const C=[
 [77,0,81,84,81,77],[76,0,79,82,0,79],[74,77,81,0,79,77],[73,76,0,81,0,0],
 [82,81,77,0,74,0],[79,0,76,72,0,76],[73,0,76,79,76,73],[74,0,0,0,0,0],
];
const CHORDS=[{root:38,notes:[50,53,57]},{root:41,notes:[53,57,60]},
 {root:34,notes:[46,50,53]},{root:33,notes:[45,49,52]},
 {root:38,notes:[50,53,57]},{root:36,notes:[48,52,55]},
 {root:43,notes:[55,58,62]},{root:33,notes:[45,49,52]}];
const sections=[['intro',4],['a',16],['b',16],['bridge',8],['c',12],['reprise',12],['outro',4]];
export function scoreBar(index,mode='normal'){
 let position=((index%TRACK_BARS)+TRACK_BARS)%TRACK_BARS,section,local=0;
 for(const [name,bars] of sections){if(position<bars){section=name;local=position;break;}position-=bars;}
 const phrase=Math.floor(local/8),bar=local%8,chord=CHORDS[section==='bridge'?(bar+2)%8:bar];
 let melody=[...(section==='b'?B:section==='c'?C:section==='reprise'?phrase%2?B:A:A)[bar]];
 if(section==='intro')melody=local%2?[0,0,77,0,0,0]:[74+local,0,0,0,0,0];
 if(section==='bridge')melody=bar%2?[69,0,0,73,0,0]:[74,0,75,0,0,0];
 if(section==='outro')melody=local===3?[74,0,0,0,0,0]:[77-local,0,0,74,0,0];
 if(phrase&&['a','b','reprise'].includes(section)){
   if(bar%2===0){melody[1]=melody[0]+(section==='b'?-2:3);melody[4]=0;}
   if(bar%4===3)melody=[77,76,74,0,73,74];
 }
 if(mode==='danger')melody=melody.map((n,i)=>n?(i===2&&bar%3===0?75:n-12):0);
 if(mode==='fever')melody=melody.map((n,i)=>n||i===2?((n||chord.notes[2])+12):0);
 const sparse=section==='intro'||section==='outro';
 return {section,local,chord,melody,instrument:section==='b'?'reed':'bell',accompaniment:!sparse,
   percussion:!sparse&&section!=='bridge',answer:!sparse&&bar%2===1,
   intensity:sparse?.55:section==='bridge'?.65:section==='c'?.9:1,mode};
}
