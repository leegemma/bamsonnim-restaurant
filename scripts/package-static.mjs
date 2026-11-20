// Lossless deployment packaging; public PNG source artwork remains untouched.
import {readdir,readFile,writeFile,unlink,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const exec=promisify(execFile),root=path.resolve('dist');
async function walk(dir){const rows=await readdir(dir,{withFileTypes:true});return(await Promise.all(rows.map(r=>r.isDirectory()?walk(path.join(dir,r.name)):[path.join(dir,r.name)]))).flat();}
const files=await walk(root),pngs=files.filter(f=>f.endsWith('.png')),changes=[];
let next=0;
await Promise.all(Array.from({length:4},async()=>{while(next<pngs.length){const file=pngs[next++],target=file.slice(0,-4)+'.webp';await exec('cwebp',['-lossless','-exact','-quiet',file,'-o',target]);if((await stat(target)).size<(await stat(file)).size){changes.push([path.relative(root,file).replaceAll(path.sep,'/'),path.relative(root,target).replaceAll(path.sep,'/')]);await unlink(file);}else await unlink(target);}}));
for(const file of files.filter(f=>/\.(js|css|html|json|webmanifest|txt|svg)$/.test(f))){let text=await readFile(file,'utf8');for(const [from,to] of changes)text=text.split(from).join(to);await writeFile(file,text);}
const bytes=(await Promise.all((await walk(root)).map(async f=>(await stat(f)).size))).reduce((a,b)=>a+b,0);
console.log(JSON.stringify({losslessWebpAssets:changes.length,expandedBytes:bytes}));
if(bytes>250*1024*1024)throw Error('Static build still exceeds deployment budget');
