/* Procedural combustion voices follow driving state; static slides stay quiet. */
window.F1Sound=(()=>{
  'use strict';
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const sub=(a,b)=>a.map((v,k)=>v-b[k]),dot=(a,b)=>a.reduce((v,x,k)=>v+x*b[k],0);
  const length=v=>Math.hypot(...v),normalize=v=>{const n=length(v)||1;return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const getPreference=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};
  let enabled=getPreference('f1-sound-enabled','1')!=='0',volume=clamp(Number(getPreference('f1-sound-volume','.70')));
  if(!Number.isFinite(volume))volume=.70;
  let context=null,master=null,synth=null,unlocking=null,ready=false,unlocked=false,error=null,phase=null,lastFrame=null,lastLights=0,lastBeep=-Infinity,lastSend=-Infinity,preparing=null,lastCounts={actors:0,voices:0};
  const buffers=new Map(),voices=new Map(),cues=new Set(),events=[];
  const remember=(key,value)=>{try{localStorage.setItem(key,String(value));}catch{}};
  function note(type,detail={}){events.push({type,...detail});if(events.length>512)events.shift();}
  function syncControls(){
    document.querySelectorAll('[data-sound-toggle]').forEach(button=>{button.textContent=error?'Sound unavailable':enabled?'Sound on':'Muted';button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?'Mute sound (M)':'Enable sound (M)');button.disabled=!!error;});
    document.querySelectorAll('[data-sound-volume]').forEach(input=>input.value=String(Math.round(volume*100)));
  }
  function ramp(parameter,value,seconds=.08){if(!context)return;const now=context.currentTime;parameter.setTargetAtTime(value,now,seconds/3);}
  function ensureContext(){
    if(context)return context;const Constructor=window.AudioContext||window.webkitAudioContext;
    if(!Constructor)throw new Error('Web Audio is unavailable');
    context=new Constructor({latencyHint:'interactive'});master=context.createGain();master.gain.value=0;
    const limiter=context.createDynamicsCompressor(),output=context.createGain();
    limiter.threshold.value=-5;limiter.knee.value=3;limiter.ratio.value=12;limiter.attack.value=.002;limiter.release.value=.16;output.gain.value=.90;
    master.connect(limiter);limiter.connect(output);output.connect(context.destination);return context;
  }
  function updateMaster(){if(master)ramp(master.gain,enabled&&!document.hidden?volume:0,.07);}
  function fail(reason){error=String(reason?.message||reason);ready=false;syncControls();note('unavailable',{error});console.info('Presentation sound is unavailable:',error);}
  async function prepare(){
    if(preparing)return preparing;
    preparing=(async()=>{
      try{
        const records=JSON.parse(document.getElementById('sound-manifest')?.textContent||'null');
        if(records?.synthesis?.kind!=='procedural-v6'||!window.F1EngineSynth)throw new Error('Procedural V6 renderer has not been assembled');
        const decoder=new OfflineAudioContext(2,1,48000);
        for(const clip of records.clips){
          const node=document.getElementById('sound-'+clip.key);if(!node)throw new Error('Missing sound: '+clip.key);
          const raw=node.textContent.trim(),bytes=Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
          buffers.set(clip.key,await decoder.decodeAudioData(bytes.buffer));await window.F1Boot?.tick();
        }
        ready=true;syncControls();note('prepared',{keys:[...buffers.keys()],engine:'procedural-v6'});
      }catch(reason){fail(reason);}
    })();return preparing;
  }
  function unlock(){
    if(!ready)return Promise.resolve(false);
    if(unlocking)return unlocking;
    unlocking=(async()=>{
      try{ensureContext();await context.resume();if(!synth)synth=await window.F1EngineSynth.create(context,master);unlocked=true;updateMaster();return true;}
      catch(reason){fail(reason);return false;}
      finally{unlocking=null;}
    })();return unlocking;
  }
  function setEnabled(value){enabled=!!value;remember('f1-sound-enabled',enabled?'1':'0');syncControls();updateMaster();if(enabled&&unlocked)void unlock();}
  function setVolume(value){volume=clamp(Number(value));remember('f1-sound-volume',volume);syncControls();updateMaster();}
  function bindControls(){
    document.querySelectorAll('[data-sound-toggle]').forEach(button=>button.addEventListener('click',()=>setEnabled(!enabled)));
    document.querySelectorAll('[data-sound-volume]').forEach(input=>input.addEventListener('input',()=>setVolume(Number(input.value)/100)));
    syncControls();
  }
  // Positive radial approach raises pitch. Moving-camera velocity is included.
  function spatial(actor,camera,previousActor,previousCamera,dt){
    const ray=sub(actor.position,camera.position),distance=length(ray),line=normalize(ray);
    const sourceVelocity=previousActor&&dt>0?sub(actor.position,previousActor.position).map(v=>v/dt):[0,0,0];
    const listenerVelocity=previousCamera&&dt>0?sub(camera.position,previousCamera.position).map(v=>v/dt):[0,0,0];
    const towardsListener=-dot(sourceVelocity,line),towardsSource=dot(listenerVelocity,line);
    const doppler=clamp((343+clamp(towardsSource,-90,90))/(343-clamp(towardsListener,-90,90)),.78,1.30);
    const forward=normalize(sub(camera.target,camera.position)),right=normalize(cross(forward,[0,1,0]));
    // The camera is often hundreds of metres away with a long lens. A fixed
    // 75 m rolloff made the featured car nearly silent as its image grew.
    // Keep distance ordering while matching the listening scale to the shot.
    const listeningDistance=clamp(length(sub(camera.target,camera.position)),65,260);
    const focusDistance=length(sub(actor.position,camera.target));
    return{distance,doppler,pan:clamp(dot(line,right)*1.15,-.92,.92),
      attenuation:1/(1+(.65*distance/listeningDistance)**1.7),
      focus:.10+.90/(1+(focusDistance/20)**2)};
  }
  function createVoice(key,offset=0,speed=0,seconds=0){
    const engine=window.F1Powertrain.create(key,speed,seconds),voice={key,engine,metrics:null};voices.set(key,voice);return voice;
  }
  function disposeVoice(key){voices.delete(key);}
  function stop(){
    phase=null;lastFrame=null;lastLights=0;lastBeep=-Infinity;lastSend=-Infinity;lastCounts={actors:0,voices:0};voices.clear();synth?.stop();
    for(const cue of cues){try{cue.source.stop();}catch{}}cues.clear();
  }
  function begin(kind){stop();phase=kind;note('begin',{kind});}
  function beep(index){
    if(!enabled||!ready||!unlocked||document.hidden||!context)return;
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffers.get('lights');gain.gain.value=.65;source.connect(gain);gain.connect(master);
    const cue={source,gain};cues.add(cue);source.onended=()=>{cues.delete(cue);gain.disconnect();source.disconnect();};source.start();lastBeep=context.currentTime;note('light',{index});
  }
  function actorsFor(pose){
    if(pose.scene==='opening')return(pose.corridorActors||[]).map((actor,index)=>({key:'grid-'+index,actor,index}));
    if(!['overtake','costs','competition','entry'].includes(pose.scene))return[];
    const teams=window.F1Story.gridOrder||['redbull','mclaren','cadillac','ferrari','mercedes','aston','williams','haas','audi','alpine','racingbulls'];
    const main=teams.filter(key=>pose[key]?.opacity!==0&&pose[key]?.position).map((key,index)=>({key,actor:pose[key],index}));
    const mates=(pose.inspectionMates||[]).filter(record=>record.actor.opacity!==0).map((record,index)=>({key:record.key+'-mate',actor:record.actor,index:index+11}));
    return main.concat(mates,(pose.distantTraffic||[]).filter(actor=>actor.opacity!==0).map(actor=>({key:'traffic-'+actor.index,actor,index:actor.index+22})));
  }
  function drivingMode(pose,actor){
    const scene=pose.scene,t=pose.seconds,parked=scene==='opening'&&t<16.8;
    const handoffRange=scene==='opening'?[24.2,28.2]:scene==='overtake'?[4.1,6.7]:scene==='costs'?[9.6,10.8]:scene==='competition'?[12.4,15.6]:scene==='entry'?[31.75,34.5]:null;
    const slow=!!handoffRange&&t>=handoffRange[0];
    const fade=slow?1-window.F1Story.ease(...handoffRange,t):1;
    // The visible reveal speed ramps are choreography, not another standing
    // start. Already-racing actors enter at a consistent high road gear.
    const reveal=scene==='overtake'&&t<.95||scene==='competition'&&t<2.1||scene==='costs'&&t>=6.65&&t<7.35;
    let speed=Math.max(0,actor.speed||0);
    if(reveal)speed=Math.max(scene==='overtake'?82:76,speed);
    const braking=scene==='overtake'&&t>=1.8&&t<4.1||scene==='competition'&&t>=4.9&&t<8.5;
    return{speed,parked,slow,fade,reveal,braking:braking&&!slow,minimumGear:scene==='overtake'?4:3,idle:scene==='entry'&&speed<.6&&!slow,
      launch:scene==='opening'&&t>=16.8&&t<19,cruise:scene==='competition'&&t>=2.1&&t<4.9};
  }
  function frame(pose,playing=false){
    if(!playing||!pose?.camera||!ready||!unlocked||!context||!synth||document.hidden)return;
    if(phase!==pose.scene)begin(pose.scene);
    const seconds=pose.seconds,dt=lastFrame?seconds-lastFrame.seconds:0;
    if(lastFrame&&dt===0)return;
    const contiguous=dt>0&&dt<.2,prior=contiguous?lastFrame:null;
    if(pose.scene==='opening'){
      const count=pose.lights||0;
      if(count>lastLights&&seconds-(10+count)<.15)beep(count);
      lastLights=count;
    }
    const candidates=actorsFor(pose),previous=new Map(prior?.actors.map(record=>[record.key,record.actor])||[]);
    const active=new Set(),routed=[],commands=[];let shifted=false;
    for(const record of candidates){
      const {key,actor,index}=record,speed=Math.max(0,actor.speed||0),mode=drivingMode(pose,actor),parked=mode.parked;
      let presence=pose.scene==='opening'?(1-window.F1Story.ease(26,28.2,seconds)):clamp(pose.track||0);
      const movingPresence=pose.scene==='entry'?(speed>1?clamp(speed/8):.22):parked?1:clamp(speed/8);
      const previousVoice=voices.get(key);
      if(previousVoice&&!mode.slow)previousVoice.handoff=null;
      if(mode.slow&&previousVoice&&!previousVoice.handoff){
        previousVoice.handoff={movingPresence:previousVoice.metrics?.movingPresence??movingPresence,doppler:previousVoice.metrics?.doppler||1};
      }
      const acousticPresence=mode.slow?(previousVoice?.handoff?.movingPresence??movingPresence):movingPresence;
      presence*=acousticPresence*mode.fade;
      if(presence<=.001)continue;
      const space=spatial(actor,pose.camera,previous.get(key),prior?.camera,contiguous?dt:0);
      if(mode.slow&&previousVoice?.handoff)space.doppler=previousVoice.handoff.doppler;
      routed.push({key,index,speed,mode,parked,presence,acousticPresence,space,weight:space.attenuation*space.focus});
    }
    // Normalize audible energy, not the count of distant actors. Main-car
    // level no longer collapses when more background cars enter a scene.
    const crowd=Math.max(1,Math.sqrt(routed.reduce((sum,r)=>sum+(r.weight*r.presence)**2,0))/1.35);
    const cueDuck=context.currentTime-lastBeep<.43?.55:1;
    for(const {key,index,speed,mode,parked,presence,acousticPresence,space,weight} of routed){
      active.add(key);
      const voice=voices.get(key)||createVoice(key,index*.113,mode.speed,seconds);
      const drive=voice.engine.step(mode.speed,seconds,mode),load=drive.throttle;
      const gain=presence*weight*(parked?.32:.94)*drive.cut*drive.shiftGain*cueDuck/crowd;
      const command={key,seed:voice.engine.parameters.seed,rpm:drive.rpm,load,gain,revMatch:drive.revMatch,pan:space.pan,doppler:space.doppler};commands.push(command);
      if(drive.event){note('shift',{key,scene:pose.scene,...drive.event});shifted=true;}
      voice.metrics={key,seconds,speed,drivingSpeed:mode.speed,movingPresence:acousticPresence,gain,rpm:drive.rpm,gear:drive.gear,acceleration:drive.acceleration,throttle:load,shift:drive.shift,revMatch:drive.revMatch,shiftGain:drive.shiftGain,detune:drive.detune,mode,crowd,model:'procedural-v6',...space};
    }
    for(const key of [...voices.keys()])if(!active.has(key))disposeVoice(key);
    if(context.currentTime-lastSend>.025||shifted){synth.send(commands);lastSend=context.currentTime;}
    lastFrame={seconds,camera:pose.camera,actors:candidates};
    lastCounts={actors:candidates.length,voices:voices.size};
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();updateMaster();});
  window.addEventListener('pagehide',()=>{stop();if(context)void context.suspend();});
  bindControls();
  return Object.freeze({prepare,unlock,begin,frame,stop,setEnabled,setVolume,toggle:()=>setEnabled(!enabled),spatial,actorsFor,drivingMode,
    state:()=>({ready,error,enabled,volume,unlocked,context:context?.state||'not-started',phase,...lastCounts,renderer:synth?.state()||null,voices:[...voices.values()].map(v=>v.metrics),events:[...events]})});
})();
