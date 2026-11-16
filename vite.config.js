import {defineConfig} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';

// GitHub project Pages runs under /repository/, while local development uses /.
const base=process.env.GITHUB_PAGES_BASE||'/';
function publicPaths(){
 let output,isBuild;
 const prefix=value=>typeof value==='string'&&/^\/(assets|icons|fonts)\//.test(value)?base+value.slice(1):value;
 const rewrite=value=>Array.isArray(value)?value.map(rewrite):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,rewrite(item)])):prefix(value);
 return{
  name:'project-pages-public-paths',enforce:'pre',
  configResolved(config){output=path.resolve(config.root,config.build.outDir);isBuild=config.command==='build';},
  transform(code,id){
   if(base==='/'||!id.includes('/src/')||!id.endsWith('.js'))return null;
   return{code:code.replace(/(["'`])\/(assets|icons|fonts)\//g,(_,quote,directory)=>`${quote}${base}${directory}/`),map:null};
  },
  async closeBundle(){
   if(!isBuild||base==='/')return;
   async function patchJson(directory){
    for(const entry of await fs.readdir(directory,{withFileTypes:true})){
     const file=path.join(directory,entry.name);
     if(entry.isDirectory())await patchJson(file);
     else if(entry.name.endsWith('.json'))await fs.writeFile(file,JSON.stringify(rewrite(JSON.parse(await fs.readFile(file,'utf8'))),null,2)+'\n');
    }
   }
   await patchJson(path.join(output,'assets'));
   const file=path.join(output,'manifest.webmanifest'),manifest=JSON.parse(await fs.readFile(file,'utf8'));
   manifest.id=base;manifest.start_url=base;manifest.scope=base;
   manifest.icons=manifest.icons.map(icon=>({...icon,src:prefix(icon.src)}));
   await fs.writeFile(file,JSON.stringify(manifest,null,2)+'\n');
  },
 };
}
export default defineConfig({base,plugins:[publicPaths()],build:{target:'es2022'},server:{host:'127.0.0.1'}});
