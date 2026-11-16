import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const meta=await fs.readFile(path.join(root,'public/assets/background-fx.json'),'utf8').then(JSON.parse).catch(()=>null);
let scene=null;
if(meta?.status==='verified'){
  if(!meta.base?.url||!meta.base.width||!meta.base.height||meta.assets?.length!==2||meta.placements?.length<2)throw Error('Incomplete background scene');
  for(const asset of meta.assets){
    if(!asset.key||!asset.url||asset.poses?.length!==2)throw Error('Background effects require two drawings');
    await fs.access(path.join(root,'public',asset.url));
    for(const p of asset.poses){const s=p.source;if(!s||![s.x,s.y,s.width,s.height].every(Number.isInteger)||s.x<0||s.y<0||s.width<=0||s.height<=0||s.x+s.width>asset.width||s.y+s.height>asset.height||![p.anchor?.x,p.anchor?.y].every(Number.isFinite))throw Error(`Invalid effect crop ${asset.key}`);}
  }
  for(const p of meta.placements)if(!meta.assets.some(a=>a.key===p.key)||!['fire','corpse'].includes(p.kind)||![p.x,p.y,p.width].every(Number.isFinite)||p.width<=0)throw Error('Invalid effect placement');
  await fs.access(path.join(root,'public',meta.base.url));
  scene={base:meta.base,assets:meta.assets.map(a=>({...a,type:'background-fx-atlas',trim:false,metadataUrl:'/assets/background-fx.json'})),placements:meta.placements};
}
await fs.writeFile(path.join(root,'src/background-fx.generated.js'),'// Generated from verified background-fx.json.\nexport const BACKGROUND_SCENE='+JSON.stringify(scene,null,2)+';\n');
console.log(JSON.stringify({assets:scene?.assets.length||0,placements:scene?.placements.length||0}));
