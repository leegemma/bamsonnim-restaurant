import {scoreBar,STEP_SECONDS,STEPS_PER_BAR} from './music-score.js';

// Uneven, progressively closer contacts suggest loose coins settling into a pile.
// This uses its own randomness and never advances the restaurant's saved RNG.
export function coinStackPattern(random=Math.random){
  const count=4+Math.floor(random()*3),impacts=[];let delay=0;
  for(let i=0;i<count;i++){
    if(i)delay+=(.072+random()*.036)*.79**(i-1);
    impacts.push({delay,frequency:1750+random()*1150,level:(.24-i*.019)*(.87+random()*.22),decay:.2+random()*.13,noiseOffset:random()*.8});
  }
  return impacts;
}
// Layered original retro score, synthesized at the browser's floating-point precision.
// Timbre is independent of any exported PCM file's bit depth.
export class Sound{
  constructor(){this.context=null;this.timer=null;this.beat=0;this.mode='normal';this.playbackMode='normal';this.nextTime=0;this._music=.22;this._effects=.45;this._musicMuted=false;this.suspendTimer=null;}
  get musicMuted(){return this._musicMuted;}
  set musicMuted(value){this._musicMuted=!!value;if(this.musicBus)this.musicBus.gain.setTargetAtTime(this._musicMuted?0:this._music*.85,this.context.currentTime,.04);}
  get music(){return this._music;}
  set music(value){this._music=Math.max(0,Math.min(1,Number(value)||0));if(this.musicBus)this.musicBus.gain.setTargetAtTime(this._musicMuted?0:this._music*.85,this.context.currentTime,.04);}
  get effects(){return this._effects;}
  set effects(value){this._effects=Math.max(0,Math.min(1,Number(value)||0));if(this.effectsBus)this.effectsBus.gain.setTargetAtTime(this._effects*.25,this.context.currentTime,.025);}
  setup(context){
    this.context=context;this.bus=context.createGain();this.bus.gain.value=.7;
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-17;compressor.knee.value=16;compressor.ratio.value=3;compressor.attack.value=.008;compressor.release.value=.23;this.bus.connect(compressor);compressor.connect(context.destination);
    this.musicBus=context.createGain();this.musicBus.gain.value=this._musicMuted?0:this._music*.85;this.musicBus.connect(this.bus);
    this.effectsBus=context.createGain();this.effectsBus.gain.value=this._effects*.25;this.effectsBus.connect(this.bus);
    let seed=48391;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1;};
    const impulse=context.createBuffer(2,Math.floor(context.sampleRate*1.35),context.sampleRate);
    for(let ch=0;ch<2;ch++){const d=impulse.getChannelData(ch);for(let i=0;i<d.length;i++)d[i]=rand()*Math.pow(1-i/d.length,3.5)*.3;}
    this.reverb=context.createConvolver();this.reverb.buffer=impulse;const wet=context.createGain();wet.gain.value=.16;this.musicBus.connect(this.reverb);this.reverb.connect(wet);wet.connect(this.bus);
    this.noise=context.createBuffer(1,context.sampleRate,context.sampleRate);const noise=this.noise.getChannelData(0);for(let i=0;i<noise.length;i++)noise[i]=rand();
  }
  async start(){
    clearTimeout(this.suspendTimer);if(!this.context)this.setup(new (window.AudioContext||window.webkitAudioContext)());
    await this.context.resume();this.bus.gain.cancelScheduledValues(this.context.currentTime);this.bus.gain.setTargetAtTime(.7,this.context.currentTime,.025);
    if(this.nextTime<this.context.currentTime-.15)this.nextTime=this.context.currentTime+.045;
    if(!this.timer){this.schedule();this.timer=setInterval(()=>this.schedule(),50);}
  }
  schedule(){if(!this.context||this.context.state!=='running')return;
    if(this.nextTime<this.context.currentTime-.2)this.nextTime=this.context.currentTime+.04;
    while(this.nextTime<this.context.currentTime+.16){if(this.beat%STEPS_PER_BAR===0)this.playbackMode=STEP_SECONDS[this.mode]?this.mode:'normal';this.playStep(this.beat,this.nextTime,this.playbackMode);this.nextTime+=STEP_SECONDS[this.playbackMode];this.beat++;}
  }
  voice(note,at,duration,instrument='bell',volume=.15,pan=0,bus=this.musicBus){
    if(!this.context||!note||!bus)return;
    const context=this.context,f=440*2**((note-69)/12),gate=context.createGain(),filter=context.createBiquadFilter(),panner=context.createStereoPanner();
    filter.type='lowpass';filter.frequency.value=instrument==='bell'?4200:instrument==='reed'?2600:1800;filter.Q.value=.4;panner.pan.value=pan;gate.connect(filter);filter.connect(panner);panner.connect(bus);
    const attack=instrument==='pad'?.16:instrument==='reed'?.035:.005,release=instrument==='pad'?.6:instrument==='bell'?.45:.1,end=at+Math.max(attack+.02,duration)+release;
    gate.gain.setValueAtTime(0,at);gate.gain.linearRampToValueAtTime(volume,at+attack);gate.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*(instrument==='bell'?.18:.6)),at+Math.max(attack+.01,duration));gate.gain.exponentialRampToValueAtTime(.0001,end);
    const osc=context.createOscillator();osc.type=instrument==='bell'||instrument==='pad'?'sine':'triangle';osc.frequency.value=f;osc.connect(gate);
    if(instrument==='bell'){const harmonic=context.createOscillator(),gain=context.createGain();harmonic.type='sine';harmonic.frequency.value=f*2.004;gain.gain.setValueAtTime(.24,at);gain.gain.exponentialRampToValueAtTime(.005,at+.18);harmonic.connect(gain);gain.connect(gate);harmonic.start(at);harmonic.stop(end+.02);}
    if(instrument==='reed'||instrument==='pad'){const vibrato=context.createOscillator(),depth=context.createGain();vibrato.frequency.value=instrument==='pad'?3.2:4.8;depth.gain.value=instrument==='pad'?3:5;vibrato.connect(depth);depth.connect(osc.detune);vibrato.start(at);vibrato.stop(end+.02);}
    osc.start(at);osc.stop(end+.02);osc.onended=()=>{gate.disconnect();filter.disconnect();panner.disconnect();};
  }
  percussion(at,step,volume=.08){
    const context=this.context;if(step===0||step===3){const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.setValueAtTime(105,at);osc.frequency.exponentialRampToValueAtTime(43,at+.12);gain.gain.setValueAtTime(volume,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.16);osc.connect(gain);gain.connect(this.musicBus);osc.start(at);osc.stop(at+.18);osc.onended=()=>gain.disconnect();}
    if(step===2||step===5){const noise=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();noise.buffer=this.noise;filter.type='bandpass';filter.frequency.value=2300;filter.Q.value=.45;gain.gain.setValueAtTime(volume*.2,at);gain.gain.exponentialRampToValueAtTime(.0001,at+.075);noise.connect(filter);filter.connect(gain);gain.connect(this.musicBus);noise.start(at,step*.1,.08);noise.onended=()=>{filter.disconnect();gain.disconnect();};}
  }
  playStep(index,at,mode='normal'){
    const bar=scoreBar(Math.floor(index/STEPS_PER_BAR),mode),step=index%STEPS_PER_BAR,unit=STEP_SECONDS[mode],amp=bar.intensity;if(this._music===0)return;
    const lead=bar.melody[step];if(lead)this.voice(lead,at,unit*(step===5?1.35:.8),bar.instrument,.17*amp,bar.instrument==='reed'?-.16:.13);
    if(step===0){this.voice(bar.chord.root,at,unit*1.7,'pluck',.16*amp,-.08);for(let i=0;i<bar.chord.notes.length;i++)this.voice(bar.chord.notes[i]+12,at+.012*i,unit*4.7,'pad',.022*amp,(i-1)*.36);if(mode==='danger'&&Math.floor(index/6)%4===0)this.voice(bar.chord.root+25,at,unit*3,'pad',.025,.45);}
    if(bar.accompaniment&&(step===2||step===4))this.voice(bar.chord.notes[step===2?1:2]+12,at,unit*.65,'pluck',.066*amp,step===2?-.45:.45);
    if(step===3&&!['intro','outro'].includes(bar.section))this.voice(bar.chord.root+7,at,unit*1.4,'pluck',.11*amp,.08);
    if(bar.answer&&step===5&&bar.section!=='bridge')this.voice(bar.chord.notes[1]+24,at+unit*.35,unit*.75,'bell',.055,-.4);
    if(bar.percussion)this.percussion(at,step,mode==='fever'?.12:.065);
  }
  renderScore(seconds=135,mode='normal'){const step=STEP_SECONDS[mode]||STEP_SECONDS.normal;for(let i=0;i*step<seconds;i++)this.playStep(i,.02+i*step,mode);}
  tone(note,duration=.12,volume=.3,type='bell',delay=0){if(this.context?.state==='running')this.voice(note,this.context.currentTime+delay,duration,type==='square'?'pluck':type,volume,0,this.effectsBus);}
  coinJingle(){if(this.context?.state!=='running'||this._effects===0)return false;
    const context=this.context,at=context.currentTime;
    this.coinTails=(this.coinTails||[]).filter(end=>end>at);
    if(this.coinTails.length>=2)return false;
    const impacts=coinStackPattern(),stack=context.createGain(),pan=context.createStereoPanner();let remaining=0,endAt=at;
    stack.gain.value=.8;pan.pan.value=(Math.random()-.5)*.24;stack.connect(pan);pan.connect(this.effectsBus);
    const ended=()=>{if(--remaining===0){stack.disconnect();pan.disconnect();}};
    for(const impact of impacts){
      const start=at+impact.delay;
      // Free metal plates have inharmonic modes, unlike a pitched arcade chord.
      for(const [ratio,weight,tail]of [[1,1,1],[1.493,.5,.72],[2.113,.26,.51],[2.887,.13,.32],[4.071,.055,.18]]){
        const osc=context.createOscillator(),gain=context.createGain(),duration=impact.decay*tail,freq=impact.frequency*ratio*(.997+Math.random()*.006);
        osc.type='sine';osc.frequency.setValueAtTime(freq,start);osc.frequency.exponentialRampToValueAtTime(freq*.994,start+duration);
        gain.gain.setValueAtTime(.00001,start);gain.gain.linearRampToValueAtTime(impact.level*weight,start+.0006);gain.gain.exponentialRampToValueAtTime(.00001,start+duration);
        osc.connect(gain);gain.connect(stack);remaining++;osc.start(start);osc.stop(start+duration+.012);endAt=Math.max(endAt,start+duration+.012);osc.onended=()=>{osc.disconnect();gain.disconnect();ended();};
      }
      // A tiny scrape under the ringing modes supplies the contact's broadband
      // attack and friction, without a long hiss or an artificial pitch sweep.
      const noise=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();noise.buffer=this.noise;
      filter.type='bandpass';filter.frequency.value=4800+Math.random()*1800;filter.Q.value=.75;
      gain.gain.setValueAtTime(.00001,start);gain.gain.linearRampToValueAtTime(impact.level*.36,start+.0003);gain.gain.exponentialRampToValueAtTime(impact.level*.025,start+.009);gain.gain.exponentialRampToValueAtTime(.00001,start+.045);
      noise.connect(filter);filter.connect(gain);gain.connect(stack);remaining++;noise.start(start,impact.noiseOffset,.05);noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();ended();};
    }
    this.coinTails.push(endAt);return true;
  }
  cookingDoneBell(){
    if(this.context?.state!=='running'||this._effects===0||!this.effectsBus)return false;
    const context=this.context,at=context.currentTime;
    // One kitchen-bell strike: a clear low mode with short, inharmonic metal
    // overtones. It has no coin contacts or ascending notification melody.
    for(const [ratio,level,duration]of [[1,.33,.78],[2.756,.12,.47],[5.404,.046,.28],[8.933,.018,.13]]){
      const osc=context.createOscillator(),gain=context.createGain();osc.type='sine';osc.frequency.setValueAtTime(1180*ratio,at);
      gain.gain.setValueAtTime(.00001,at);gain.gain.linearRampToValueAtTime(level,at+.001);gain.gain.exponentialRampToValueAtTime(.00001,at+duration);
      osc.connect(gain);gain.connect(this.effectsBus);osc.start(at);osc.stop(at+duration+.01);osc.onended=()=>{osc.disconnect();gain.disconnect();};
    }
    if(this.noise){
      const strike=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();strike.buffer=this.noise;filter.type='highpass';filter.frequency.value=6000;
      gain.gain.setValueAtTime(.035,at);gain.gain.exponentialRampToValueAtTime(.00001,at+.008);strike.connect(filter);filter.connect(gain);gain.connect(this.effectsBus);strike.start(at,.2,.01);strike.onended=()=>{strike.disconnect();filter.disconnect();gain.disconnect();};
    }
    return true;
  }
  igniteWoodFire(){
    if(this.context?.state!=='running'||this._effects===0||!this.effectsBus||!this.noise)return false;
    const context=this.context,at=context.currentTime;
    const burst=(delay,duration,frequency,level,type)=>{
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),start=at+delay;
      source.buffer=this.noise;filter.type=type;filter.frequency.value=frequency;filter.Q.value=.7;
      gain.gain.setValueAtTime(.00001,start);gain.gain.linearRampToValueAtTime(level,start+(duration>.1?.025:.001));gain.gain.exponentialRampToValueAtTime(.00001,start+duration);
      source.connect(filter);filter.connect(gain);gain.connect(this.effectsBus);source.start(start,.09,duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    };
    burst(0,.58,700,.65,'lowpass');
    for(const [delay,duration,frequency,level] of [[.04,.018,1800,.23],[.11,.013,2800,.28],[.19,.025,1400,.19],[.29,.012,3400,.24],[.41,.021,2100,.16]])burst(delay,duration,frequency,level,'highpass');
    return true;
  }
  effect(kind='click'){if(kind==='ignite')return this.igniteWoodFire();if(kind==='done')return this.cookingDoneBell();if(kind==='payment'){this.coinJingle();return;}const notes=kind==='danger'?[50,49,45]:['album','level','mastery'].includes(kind)?[74,77,81,86]:kind==='cook'?[69,74]:[81,86];notes.forEach((n,i)=>this.tone(n,.08,.3,'bell',i*.075));}
  stop(){if(this.timer)clearInterval(this.timer);this.timer=null;if(!this.context)return;const context=this.context;this.bus.gain.cancelScheduledValues(context.currentTime);this.bus.gain.setTargetAtTime(.0001,context.currentTime,.02);this.suspendTimer=setTimeout(()=>context.suspend(),90);}
}
