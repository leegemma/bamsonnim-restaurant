import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Sound,coinStackPattern} from '../src/audio.js';

test('coin contacts vary within a short, uneven settling pattern without a musical pitch progression',()=>{
 let seed=19;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const patterns=Array.from({length:12},()=>coinStackPattern(random));assert.ok(new Set(patterns.map(p=>p.length)).size>1);
 for(const impacts of patterns){
  assert.ok(impacts.length>=4&&impacts.length<=6);assert.equal(impacts[0].delay,0);
  const intervals=impacts.slice(1).map((p,i)=>p.delay-impacts[i].delay);assert.ok(new Set(intervals.map(n=>n.toFixed(4))).size>1);assert.ok(impacts.at(-1).delay+impacts.at(-1).decay<.8);
  assert.ok(impacts.every(p=>p.frequency>=1750&&p.frequency<2900&&p.level>0&&p.level<.27&&p.noiseOffset<.8));
  const up=impacts.slice(1).map((p,i)=>p.frequency>impacts[i].frequency);assert.ok(up.some(Boolean)&&up.some(n=>!n),'contacts do not simply ascend or descend a scale');
 }
});

function fakeContext(){
 const nodes=[],parameter=()=>({value:0,events:[],setValueAtTime(...args){this.events.push(['set',...args]);this.value=args[0];},setTargetAtTime(...args){this.events.push(['target',...args]);this.value=args[0];},linearRampToValueAtTime(...args){this.events.push(['linear',...args]);},exponentialRampToValueAtTime(...args){this.events.push(['exponential',...args]);}}),node=kind=>{const n={kind,gain:parameter(),frequency:parameter(),pan:parameter(),Q:parameter(),connections:[],starts:[],stops:[],connect(target){this.connections.push(target);},disconnect(){this.disconnected=true;},start(...args){this.starts.push(args);},stop(...args){this.stops.push(args);}};nodes.push(n);return n;};
 return{state:'running',currentTime:0,nodes,createGain:()=>node('gain'),createStereoPanner:()=>node('pan'),createOscillator:()=>node('oscillator'),createBiquadFilter:()=>node('filter'),createBufferSource:()=>node('noise')};
}

test('payment voices require a running context and SFX volume, independent of music mute',()=>{
 const sound=new Sound();assert.equal(sound.coinJingle(),false);assert.equal(sound.context,null);
 const context=fakeContext();sound.context=context;sound.noise={};context.state='suspended';assert.equal(sound.coinJingle(),false);assert.equal(context.nodes.length,0);
 context.state='running';sound.effects=0;assert.equal(sound.coinJingle(),false);assert.equal(context.nodes.length,0);
 sound.effects=1;sound.effectsBus=context.createGain();sound.musicMuted=true;assert.equal(sound.coinJingle(),true);assert.ok(context.nodes.length>0);
});

test('a payment burst caps concurrent coin piles and permits new sounds after their tails expire',()=>{
 const sound=new Sound(),context=fakeContext();sound.context=context;sound.effectsBus={};sound.noise={};
 assert.equal(sound.coinJingle(),true);assert.equal(sound.coinJingle(),true);const count=context.nodes.length;
 for(let i=0;i<20;i++)assert.equal(sound.coinJingle(),false);assert.equal(context.nodes.length,count);
 context.currentTime=1;assert.equal(sound.coinJingle(),true);assert.ok(context.nodes.length>count);
});

test('the kitchen bell never unlocks audio or schedules a muted or suspended effect',()=>{
 const sound=new Sound();assert.equal(sound.effect('done'),false);assert.equal(sound.context,null);
 const context=fakeContext();sound.context=context;sound.effectsBus=context.createGain();context.state='suspended';let before=context.nodes.length;assert.equal(sound.cookingDoneBell(),false);assert.equal(context.nodes.length,before);context.state='running';sound.effects=0;assert.equal(sound.effect('done'),false);assert.equal(context.nodes.length,before);
});

test('the completion bell is one short metal strike on the effects bus and remains audible with music muted',()=>{
 const sound=new Sound(),context=fakeContext();context.currentTime=10;sound.context=context;sound.noise={};sound.effectsBus=context.createGain();sound.musicBus=context.createGain();sound.effects=1;const effectAutomation=structuredClone(sound.effectsBus.gain.events);sound.musicMuted=true;sound.music=0;assert.deepEqual(sound.effectsBus.gain.events,effectAutomation);assert.equal(sound.effect('done'),true);
 const tones=context.nodes.filter(n=>n.kind==='oscillator');assert.ok(tones.length>=3);assert.ok(tones.every(n=>n.starts.length===1&&n.starts[0][0]===10));const end=Math.max(...tones.map(n=>n.stops[0][0]));assert.ok(end>=10.6&&end<=10.9);
 const frequencies=tones.map(n=>n.frequency.value);assert.ok(frequencies.every(f=>Number.isFinite(f)&&f>0));assert.ok(frequencies.some(f=>Math.abs(f/frequencies[0]-Math.round(f/frequencies[0]))>.1),'metal modes are inharmonic');
 for(const tone of tones){const envelope=tone.connections[0];assert.deepEqual(envelope.connections,[sound.effectsBus]);assert.ok(envelope.gain.events.some(e=>e[0]==='linear'&&e[2]-10<=.005));tone.onended();assert.equal(tone.disconnected,true);assert.equal(envelope.disconnected,true);}
 assert.equal(sound.coinTails,undefined);assert.equal(sound.timer,null);assert.equal(context.nodes.some(n=>n.connections.includes(sound.musicBus)),false);
});

test('one ignition schedules a short wood-fire whoosh and crackles on the effects bus',()=>{
 const sound=new Sound();assert.equal(sound.effect('ignite'),false);const context=fakeContext();sound.context=context;sound.effectsBus=context.createGain();sound.noise={};sound.musicMuted=true;
 assert.equal(sound.effect('ignite'),true);const sources=context.nodes.filter(n=>n.kind==='noise');assert.equal(sources.length,6);assert.ok(sources.every(n=>n.starts.length===1&&n.starts[0][2]<=.6));assert.equal(context.nodes.some(n=>n.kind==='oscillator'),false);
 for(const source of sources){const filter=source.connections[0],gain=filter.connections[0];assert.deepEqual(gain.connections,[sound.effectsBus]);source.onended();assert.equal(source.disconnected,true);assert.equal(filter.disconnected,true);assert.equal(gain.disconnected,true);}
 let count=context.nodes.length;sound.effects=0;assert.equal(sound.effect('ignite'),false);assert.equal(context.nodes.length,count);sound.effects=1;context.state='suspended';count=context.nodes.length;assert.equal(sound.effect('ignite'),false);assert.equal(context.nodes.length,count);
});
