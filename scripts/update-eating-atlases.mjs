import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),records=[];
const meta=await fs.readFile(path.join(root,'public/assets/wanderer-eating.json'),'utf8').then(JSON.parse).catch(()=>null);
if(meta?.status==='verified'){
 if(meta.actorId!=='wanderer'||meta.poses?.length!==8)throw Error('Expected two additional eating drawings in each of four directions');
 for(let dir=0;dir<4;dir++)for(const frame of [1,2])if(meta.poses.filter(p=>p.dir===dir&&p.frame===frame&&p.hip&&p.source&&p.registration).length!==1)throw Error(`Missing eating pose ${dir}/${frame}`);
 await fs.access(path.join(root,'public',meta.url));
 records.push({key:meta.key,actorId:meta.actorId,name:'허기진 행인 · 네 방향 먹기 추가 2프레임',url:meta.url,type:'eating-atlas',baseAtlas:meta.baseAtlas||'wandererShuffle',trim:false,width:meta.width,height:meta.height,cols:meta.cols||2,rows:meta.rows||4,referenceHeight:meta.referenceHeight,fps:5,framesPerDirection:2,sequence:[0,1,2],status:'verified',metadataUrl:'/assets/wanderer-eating.json',promptFile:meta.promptFile||meta.generation?.promptFile?.replace(/^public\//,'/'),poses:meta.poses.map((p,index)=>({index,dir:p.dir,state:'eat',frame:p.frame,source:p.source,bounds:p.bounds,hip:p.hip,anchor:p.anchor,registration:p.registration}))});
}
await fs.writeFile(path.join(root,'src/eating-atlases.generated.js'),'// Generated from verified eating atlas metadata.\nexport const EATING_ATLASES='+JSON.stringify(records,null,2)+';\n');
console.log(JSON.stringify({atlases:records.length,additionalFrames:records.reduce((n,a)=>n+a.poses.length,0)}));
