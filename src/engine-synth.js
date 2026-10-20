/* Procedural V6 exterior sound. No engine recordings or electric oscillators.
 * Bidirectional waveguide structure adapted from Antonio-R1 (MIT), 2021-2022.
 * See docs/Engine-Synthesis-References.md and docs/Engine-Synthesis-License.txt.
 * This is an acoustic sound-design model, not a thermodynamic engine simulator.
 */
window.F1EngineSynth=(()=>{
  'use strict';
  function makeCore(){
    const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
    // Two travelling pressure waves and damped reflection at each pipe end.
    class Guide{
      constructor(samples,left,right,damping=.55){this.a=new Float32Array(samples);this.b=new Float32Array(samples);this.i=0;this.left=left;this.right=right;this.damping=damping;this.filteredA=0;this.filteredB=0;this.outLeft=0;this.outRight=0;}
      step(leftInput,rightInput){
        const a=this.a[this.i],b=this.b[this.i];
        this.filteredA+=(a-this.filteredA)*this.damping;this.filteredB+=(b-this.filteredB)*this.damping;
        this.outLeft=this.filteredB*(1-this.left);this.outRight=this.filteredA*(1-this.right);
        this.a[this.i]=leftInput+this.filteredB*this.left;this.b[this.i]=rightInput+this.filteredA*this.right;
        if(++this.i===this.a.length)this.i=0;
      }
    }
    class Engine{
      constructor(rate=48000,seed=1){
        this.rate=rate;this.seed=(seed>>>0)||1;this.phase=(this.random()+1)/6;
        this.cylinder=0;this.firingInterval=1;this.rpm=4200;this.load=.18;this.gain=0;this.pan=0;this.doppler=1;
        this.target={rpm:4200,load:.18,gain:0,pan:0,doppler:1,revMatch:0};
        this.slow=new Float64Array(6);this.fast=new Float64Array(6);this.amplitude=new Float64Array(6);
        const variation=.975+.05*this.random(),samples=m=>Math.max(2,Math.round(rate*m/540*variation));
        const damping=1-Math.exp(-2*Math.PI*3200/rate);
        this.headers=[new Guide(samples(.48),.23,-.16,damping),new Guide(samples(.57),.21,-.18,damping)];
        this.collector=new Guide(samples(1.05),.16,-.22,damping);this.outlet=new Guide(samples(.26),.08,-.12,damping);
        this.decaySlow=Math.exp(-1/(rate*.00072));this.decayFast=Math.exp(-1/(rate*.00015));
        this.rpmSmooth=1-Math.exp(-1/(rate*.020));this.mixSmooth=1-Math.exp(-1/(rate*.045));this.blipSmooth=1-Math.exp(-1/(rate*.009));
        this.noiseSmooth=1-Math.exp(-2*Math.PI*1900/rate);this.lowNoiseSmooth=1-Math.exp(-2*Math.PI*540/rate);this.flowSmooth=1-Math.exp(-2*Math.PI*140/rate);
        this.exhaustSmooth=1-Math.exp(-2*Math.PI*2200/rate);
        this.bodySmooth=1-Math.exp(-2*Math.PI*410/rate);this.dcSmooth=1-Math.exp(-2*Math.PI*42/rate);
        this.noise=0;this.lowNoise=0;this.flow=0;this.body=0;this.tone=0;this.tone2=0;this.dc=0;
        // A modest bank/cylinder imbalance exposes the lower engine orders.
        // Small cycle variation broadens the exhaust note without a synth LFO.
        this.pattern=[1.075,.935,1.035,.97,1.015,.95];
      }
      random(){let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed/4294967296;}
      update(value){
        this.target.rpm=clamp(value.rpm||4200,3000,14500);this.target.load=clamp(value.load??.18,.02,1);
        this.target.gain=clamp(value.gain||0,0,1);this.target.pan=clamp(value.pan||0,-.95,.95);
        this.target.doppler=clamp(value.doppler||1,.8,1.24);
        this.target.revMatch=clamp(value.revMatch||0,0,1);
      }
      sample(){
        this.rpm+=(this.target.rpm-this.rpm)*this.rpmSmooth;
        const accentSmooth=this.target.revMatch>0?this.blipSmooth:this.mixSmooth;
        this.load+=(this.target.load-this.load)*accentSmooth;
        this.gain+=(this.target.gain-this.gain)*accentSmooth;
        this.pan+=(this.target.pan-this.pan)*this.mixSmooth;
        this.doppler+=(this.target.doppler-this.doppler)*this.rpmSmooth;
        // Six combustion events per 720-degree cycle: firing rate = RPM/20.
        this.phase+=this.rpm*this.doppler/(20*this.rate);
        if(this.phase>=this.firingInterval){
          this.phase-=this.firingInterval;const i=this.cylinder;
          this.firingInterval=1+(.003+.003*(1-this.load))*(this.random()*2-1);
          const irregularity=(.045+.045*(1-this.load))*(this.random()*2-1);
          this.slow[i]+=1;this.fast[i]+=1;
          this.amplitude[i]=this.pattern[i]*(1+irregularity)*(.34+.66*this.load);
          this.cylinder=(i+1)%6;
        }
        let left=0,right=0;
        for(let i=0;i<6;i++){
          this.slow[i]*=this.decaySlow;this.fast[i]*=this.decayFast;
          const pulse=(this.slow[i]-this.fast[i])*this.amplitude[i];
          if(i%2)right+=pulse;else left+=pulse;
        }
        // Combustion-gated turbulence, rather than a continuous turbo whistle.
        const white=this.random()*2-1;this.noise+=(white-this.noise)*this.noiseSmooth;this.lowNoise+=(white-this.lowNoise)*this.lowNoiseSmooth;
        const pressure=left+right;this.flow+=(pressure-this.flow)*this.flowSmooth;
        const air=(this.noise*.65+this.lowNoise*.60)*(.15+.55*this.load)*Math.min(1,this.flow*1.8);
        this.headers[0].step(left*.43+air*.18,this.collector.outLeft*.18);
        this.headers[1].step(right*.43+air*.21,this.collector.outLeft*.18);
        this.collector.step((this.headers[0].outRight+this.headers[1].outRight)*.70,this.outlet.outLeft*.24);
        this.outlet.step(this.collector.outRight*.75,0);
        this.body+=(pressure-this.body)*this.bodySmooth;
        const exhaust=this.outlet.outRight*.73+pressure*.14+air+this.body*.29;
        this.tone+=(exhaust-this.tone)*this.exhaustSmooth;
        this.tone2+=(this.tone-this.tone2)*this.exhaustSmooth;
        this.dc+=(this.tone2-this.dc)*this.dcSmooth;
        const value=(this.tone2-this.dc)*3.10;
        return value/(1+.42*Math.abs(value));
      }
    }
    class Mixer{
      constructor(rate){this.rate=rate;this.engines=new Map();this.lastMessage=-Infinity;this.blocks=0;this.maxEngines=0;}
      update(voices,time){
        this.lastMessage=time;const active=new Set();
        for(const v of voices){active.add(v.key);let engine=this.engines.get(v.key);if(!engine){engine=new Engine(this.rate,v.seed);engine.rpm=v.rpm;this.engines.set(v.key,engine);}engine.update(v);}
        for(const [key,engine] of this.engines)if(!active.has(key))engine.target.gain=0;
        this.maxEngines=Math.max(this.maxEngines,active.size);
      }
      stop(){for(const engine of this.engines.values())engine.target.gain=0;this.lastMessage=-Infinity;}
      render(left,right,time){
        left.fill(0);if(right!==left)right.fill(0);
        for(const [key,engine] of this.engines){
          if(time-this.lastMessage>.65)engine.target.gain=0;
          if(engine.target.gain===0&&engine.gain<.00002){this.engines.delete(key);continue;}
          const angle=(engine.pan+1)*Math.PI/4,panLeft=Math.cos(angle),panRight=Math.sin(angle);
          for(let n=0;n<left.length;n++){const sample=engine.sample()*engine.gain;left[n]+=sample*panLeft;right[n]+=sample*panRight;}
        }
        this.blocks++;
      }
      state(){return{voices:this.engines.size,maxVoices:this.maxEngines,blocks:this.blocks};}
    }
    return{Engine,Guide,Mixer};
  }
  function processorSource(){
    return 'const core=('+makeCore.toString()+')();\n'+String.raw`
class F1V6Processor extends AudioWorkletProcessor{
  constructor(){
    super();this.mixer=new core.Mixer(sampleRate);
    this.port.onmessage=e=>{
      const msg=e.data;
      if(msg.type==='frame'){
        this.mixer.update(msg.voices,currentTime);
      }else if(msg.type==='stop')this.mixer.stop();
    };
  }
  process(inputs,outputs){
    const channels=outputs[0];if(!channels?.length)return true;
    const left=channels[0],right=channels[1]||left;
    this.mixer.render(left,right,currentTime);
    if(this.mixer.blocks%512===0)this.port.postMessage({type:'stats',...this.mixer.state()});
    return true;
  }
}
registerProcessor('f1-procedural-v6',F1V6Processor);`;
  }
  function createCompatibility(context,destination,workletError){
    if(typeof context.createScriptProcessor!=='function')throw new Error('No compatible procedural audio renderer: '+workletError);
    // File origins can reject module loading. This bounded compatibility path
    // uses exactly the same DSP with no module URL, fetch or browser flags.
    const node=context.createScriptProcessor(2048,0,2),mixer=new(makeCore().Mixer)(context.sampleRate);
    node.onaudioprocess=event=>mixer.render(event.outputBuffer.getChannelData(0),event.outputBuffer.getChannelData(1),context.currentTime);
    node.connect(destination);
    return{send:voices=>mixer.update(voices,context.currentTime),stop:()=>mixer.stop(),state:()=>({...mixer.state(),backend:'inline-compatibility',workletError}),node};
  }
  async function create(context,destination){
    let renderer=null,lastVoices=[],workletError=null;
    try{
      if(!context.audioWorklet||typeof AudioWorkletNode==='undefined')throw new Error('AudioWorklet is unavailable');
      const source=processorSource(),local=window.location?.protocol==='file:';
      // A data module has no opaque blob-origin lookup when opened offline.
      const url=local?'data:text/javascript;charset=utf-8,'+encodeURIComponent(source):URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
      try{await context.audioWorklet.addModule(url,{credentials:'omit'});}finally{if(!local)URL.revokeObjectURL(url);}
      const node=new AudioWorkletNode(context,'f1-procedural-v6',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});
      node.connect(destination);let stats={voices:0,maxVoices:0,blocks:0};
      node.port.onmessage=e=>{if(e.data?.type==='stats')stats=e.data;};
      renderer={send:voices=>node.port.postMessage({type:'frame',voices}),stop:()=>node.port.postMessage({type:'stop'}),state:()=>({...stats,backend:'audio-worklet',module:local?'embedded-data':'embedded-blob'}),node};
      node.onprocessorerror=()=>{node.disconnect();workletError='AudioWorklet processor stopped';renderer=createCompatibility(context,destination,workletError);renderer.send(lastVoices);};
    }catch(reason){workletError=String(reason?.message||reason);renderer=createCompatibility(context,destination,workletError);}
    return{send:voices=>{lastVoices=voices;renderer.send(voices);},stop:()=>{lastVoices=[];renderer.stop();},state:()=>renderer.state(),get node(){return renderer.node;}};
  }
  return Object.freeze({makeCore,processorSource,create});
})();
