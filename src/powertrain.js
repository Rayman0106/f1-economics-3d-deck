/* Scene-driven, illustrative eight-gear state. Camera reveals never launch it. */
window.F1Powertrain=(()=>{
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,u)=>a+(b-a)*u;
  const ease=(a,b,t)=>{const u=clamp((t-a)/(b-a),0,1);return u*u*(3-2*u);};
  // Rounded RPM/(m/s) from an observed Monza 2025 lap, not private team ratios.
  // Gear one is illustrative: the reference lap did not include a first-gear run.
  const ratios=[475,344,277,220,188,163,144,128];
  const shiftRPM=[11350,11400,11650,11700,11800,11700,11650,12000];
  const minimumHolds=[.30,.33,.38,.45,.55,.65,.80,.90];
  function seed(key){let h=2166136261;for(const c of key)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  function create(key,speed=0,time=0){
    let random=seed(key);const unit=()=>{random^=random<<13;random^=random>>>17;random^=random<<5;return(random>>>0)/4294967296;};
    const detune=.996+.008*unit(),thresholdVariation=.995+.01*unit(),holdVariation=.96+.08*unit(),downDwell=.075+.012*unit();
    const threshold=11650*thresholdVariation,dwell=.45*holdVariation;
    const idle=3900*(.97+.06*unit()),flutter=.23+.17*unit(),angle=6.2831853*unit();
    const gearAt=s=>{let g=1;while(g<8&&s*ratios[g-1]*detune>shiftRPM[g-1]*thresholdVariation)g++;return g;};
    let gear=gearAt(speed),lastTime=time,lastSpeed=speed,acceleration=0;
    let rpm=clamp(speed*ratios[gear-1]*detune,idle,14200),heldRPM=rpm,heldThrottle=speed>0?.78:.12,shift=null,lastShift=time-.8,filteredSpeed=speed,brakingBurst=false;
    function step(speed,time,mode={}){
      const dt=time-lastTime,continuous=dt>0&&dt<.35,rawAcceleration=continuous?(speed-lastSpeed)/dt:0;
      if(continuous)acceleration=mix(acceleration,rawAcceleration,1-Math.exp(-dt/.18));else acceleration=0;
      filteredSpeed=continuous&&!mode.reveal?mix(filteredSpeed,speed,1-Math.exp(-dt/.12)):speed;
      if(!continuous||!mode.braking||mode.slow)brakingBurst=false;
      let event=null,throttle=mode.braking?clamp(.11+acceleration*.007,.05,.30):clamp(.82+acceleration*.025,.38,1),cut=1,revMatch=0,shiftGain=1;
      const wobble=9*Math.sin(time*6.2831853*flutter+angle)+5*Math.sin(time*6.2831853*flutter*.57+angle*1.71);
      if(mode.parked||mode.idle){
        const build=mode.parked?ease(13.8,16.6,time):0;
        gear=1;shift=null;rpm=mix(idle,9600,build)+wobble;throttle=mix(.12,.50,build);heldRPM=rpm;heldThrottle=throttle;
      }else if(mode.slow){
        // The visual clock is slowing to the slide. Preserve the acoustic
        // state; it is not another braking or lower-rev engine event.
        shift=null;rpm=heldRPM;throttle=heldThrottle;acceleration=0;
      }else if(mode.reveal||!continuous){
        // Resolve the already-moving car directly into its road gear. Never
        // play catch-up shifts during a reveal, a seek or a dropped frame.
        gear=gearAt(speed);shift=null;rpm=clamp(speed*ratios[gear-1]*detune,idle,14200)+wobble;
        heldRPM=rpm;lastShift=time;throttle=.78;heldThrottle=throttle;acceleration=0;
      }else{
        let linked=filteredSpeed*ratios[gear-1]*detune;
        if(shift&&time-shift.time>(shift.kind==='up'?.095:.070))shift=null;
        const wait=time-lastShift,upReady=!shift&&wait>minimumHolds[gear-1]*holdVariation,downReady=!shift&&wait>downDwell;
        if(upReady&&gear<8&&linked>shiftRPM[gear-1]*thresholdVariation&&acceleration>1.1&&!mode.cruise&&!mode.braking){
          const from=gear;gear++;lastShift=time;shift={kind:'up',time,from,to:gear,fromRPM:rpm,toRPM:clamp(rpm*ratios[gear-1]/ratios[from-1],idle,14200)};event={...shift};
        }else if(downReady&&gear>(mode.minimumGear??3)&&mode.braking&&rawAcceleration< -3.0&&acceleration< -3.0&&(brakingBurst||linked<9300)&&filteredSpeed*ratios[gear-2]*detune<12400){
          const from=gear;gear--;lastShift=time;brakingBurst=true;shift={kind:'down',time,from,to:gear,fromRPM:rpm,toRPM:filteredSpeed*ratios[gear-1]*detune};event={...shift};
        }
        linked=filteredSpeed*ratios[gear-1]*detune;
        // Launch clutch holds revs while wheel speed is still low.
        const clutch=mode.launch&&speed<15?mix(9600,linked,ease(2,15,speed)):idle;
        let target=clamp(Math.max(linked,clutch),idle,14200)+wobble;
        if(shift){
          const age=time-shift.time;
          if(shift.kind==='up'){
            target=mix(mix(shift.fromRPM,shift.toRPM,ease(.002,.034,age)),target,ease(.052,.095,age));cut=mix(.83,1,ease(.004,.027,age));throttle*=cut;
          }else{
            target=mix(shift.fromRPM,target,ease(.006,.042,age))+160*Math.sin(Math.PI*clamp(age/.065,0,1));
            // The closed-throttle braking bed is deliberately quiet. A real
            // downshift needs a brief, audible rev-match instead of inheriting
            // that bed's low combustion load. A compact accent leaves a gap
            // between successive rapid downshifts without raising cruise gain.
            revMatch=ease(0,.006,age)*(1-ease(.027,.065,age));
            throttle=clamp(throttle+.86*revMatch,0,1);shiftGain=1+.45*revMatch;
          }
        }
        rpm=mix(rpm,target,1-Math.exp(-dt/.022));heldRPM=rpm;heldThrottle=throttle;
      }
      lastTime=time;lastSpeed=speed;
      return{gear,rpm:clamp(rpm,3000,14500),acceleration,throttle,cut,revMatch,shiftGain,detune,threshold,dwell,event,shift:shift?.kind||null};
    }
    return{step,parameters:{detune,threshold,dwell,downDwell,minimumHolds:minimumHolds.map(v=>v*holdVariation),idle,flutter,angle,seed:seed(key)}};
  }
  return Object.freeze({create,seed,ratios:ratios.slice()});
})();
