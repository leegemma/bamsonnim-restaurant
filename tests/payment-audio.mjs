import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from 'playwright';
const output=process.env.PAYMENT_AUDIO_OUTPUT||'artifacts/payment-audio',base=process.env.BASE_URL||'http://127.0.0.1:5173';await fs.mkdir(output,{recursive:true});const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto(base);await page.waitForFunction(()=>window.__BAMSONNIM__?.view.ready);await page.evaluate(()=>window.__BAMSONNIM__.pause());
 const results=[];
 for(const scenario of ['single','burst','consecutive','effects-zero','music-muted']){
  const result=await page.evaluate(async scenario=>{
   const{Sound}=await import('/src/audio.js'),sampleRate=44100,context=new OfflineAudioContext(2,sampleRate*2,sampleRate),sound=new Sound();if(scenario==='effects-zero')sound.effects=0;if(scenario==='music-muted')sound.musicMuted=true;sound.setup(context);
   let seed=8042;const random=Math.random;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
   const pauses=scenario==='consecutive'?[.25,.5,.75].map(t=>context.suspend(t)):[],rendering=context.startRendering(),accepted=[];
   try{for(let i=0;i<(scenario==='burst'?8:1);i++)accepted.push(sound.coinJingle());for(const pause of pauses){await pause;const resume=context.resume();accepted.push(sound.coinJingle());await resume;}}finally{Math.random=random;}
   const buffer=await rendering,channels=[...Array(2)].map((_,ch)=>buffer.getChannelData(ch));let peak=0,sum=0,nonFinite=0,clipped=0;for(const channel of channels)for(const n of channel){if(!Number.isFinite(n))nonFinite++;peak=Math.max(peak,Math.abs(n));sum+=n*n;if(Math.abs(n)>=1)clipped++;}
   const bytes=new Uint8Array(44+buffer.length*4),v=new DataView(bytes.buffer),str=(at,s)=>[...s].forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));str(0,'RIFF');v.setUint32(4,bytes.length-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,buffer.length*4,true);for(let i=0;i<buffer.length;i++)for(let ch=0;ch<2;ch++)v.setInt16(44+i*4+ch*2,Math.round(Math.max(-1,Math.min(1,channels[ch][i]))*32767),true);
   let binary='';for(let at=0;at<bytes.length;at+=8192)binary+=String.fromCharCode(...bytes.subarray(at,at+8192));
   return{scenario,seconds:2,sampleRate,peak,rms:Math.sqrt(sum/(buffer.length*2)),nonFinite,clipped,accepted,effectsGain:sound.effectsBus.gain.value,musicMuted:sound.musicMuted,base64:btoa(binary)};
  },scenario);
  assert.equal(result.nonFinite,0);assert.equal(result.clipped,0);if(scenario==='effects-zero'){assert.equal(result.peak,0);assert.deepEqual(result.accepted,[false]);}else assert.ok(result.peak>0&&result.peak<1);
  if(scenario==='burst')assert.deepEqual(result.accepted,[true,true,false,false,false,false,false,false]);
  await fs.writeFile(`${output}/${scenario}.wav`,Buffer.from(result.base64,'base64'));delete result.base64;results.push(result);
 }
 const single=results.find(r=>r.scenario==='single'),muted=results.find(r=>r.scenario==='music-muted');assert.equal(muted.effectsGain,single.effectsGain);assert.equal(muted.musicMuted,true);assert.ok(Math.abs(muted.rms/single.rms-1)<.05,'Music mute leaves coin output level unchanged within offline scheduling tolerance');
 await fs.writeFile(`${output}/results.json`,JSON.stringify({passed:true,listeningReview:'Not independently certified by automated metrics. WAV files supplied for human listening.',results},null,2));console.log(JSON.stringify({passed:true,results}));
}finally{await browser.close();}
