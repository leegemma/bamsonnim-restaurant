import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const {atlases}=JSON.parse(await fs.readFile(path.join(root,'public/assets/food-expansion.json'),'utf8'));
const records=[];
for(const atlas of atlases){
 if(atlas.status!=='verified')continue;
 const {width,height,cols,rows,count,startSprite}=atlas;
 if(![width,height,cols,rows,count,startSprite].every(Number.isInteger)||count>cols*rows||count<1)throw Error(`Invalid food atlas ${atlas.key}`);
 const file=await fs.readFile(path.join(root,'public',atlas.url));
 if(file.readUInt32BE(16)!==width||file.readUInt32BE(20)!==height)throw Error(`Food atlas dimensions changed: ${atlas.key}`);
 const poses=Array.from({length:count},(_,index)=>{const col=index%cols,row=Math.floor(index/cols),x=Math.floor(col*width/cols),y=Math.floor(row*height/rows);return{index,state:'food',source:{x,y,width:Math.floor((col+1)*width/cols)-x,height:Math.floor((row+1)*height/rows)-y}};});
 records.push({...atlas,metadataUrl:'/assets/food-expansion.json',grid:{x:0,y:0,cols,rows,cellWidth:width/cols,cellHeight:height/rows},poses});
}
const sprites=records.flatMap(a=>Array.from({length:a.count},(_,i)=>a.startSprite+i));
if(new Set(sprites).size!==sprites.length||sprites.some(s=>s<16))throw Error('Duplicate or reserved food sprite ID');
await fs.writeFile(path.join(root,'src/food-atlases.generated.js'),'// Generated from verified public/assets/food-expansion.json.\nexport const FOOD_ATLASES='+JSON.stringify(records,null,2)+';\n');
console.log(JSON.stringify({atlases:records.length,foods:sprites.length}));
