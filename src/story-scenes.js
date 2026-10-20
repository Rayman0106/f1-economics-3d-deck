/* Illustrative choreography, not a reconstruction of the Baku accident or an
   invoice. The racing is illustrative choreography, not telemetry. */
window.F1Story = (() => {
  const clamp=value=>Math.max(0,Math.min(1,value));
  const ease=(a,b,time)=>{const x=clamp((time-a)/(b-a));return x*x*x*(x*(x*6-15)+10);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const zoomFov=(fov,factor)=>2*Math.atan(Math.tan(fov*Math.PI/360)/factor)*180/Math.PI;
  const blend=(a,b,t)=>a.map((value,index)=>mix(value,b[index],t));
  const entryFreeze=32;
  const durations={overtake:11.4,costs:14.6,regulation:5.8,advantage:11.8,competition:18.4,entry:35.5,conclusion:25.5};
  const motionEnd=5.4,freeze=6.7,skidStart=1.3,skidEnd=2.6;
  let end=null,road=null,trackInfo=null,wheelInfo=null,distances=null,mcMotion=null,competitionEnd=null,lateLine=null;
  let entryCamera={fov:34,roll:0,principal:[405,540],view:{forward:18,left:-2.8,height:1.25}};
  let photoCamera={fov:32,roll:0,principal:[800,450]};
  // Re-lay only the first film route to a right-hand bend. Models and photos
  // keep their proper rotations and original texture handedness.
  function passRoad(station,lane){const p=road(station,-lane);return{...p,position:[p.position[0],p.position[1],-p.position[2]],heading:-p.heading,curvature:-p.curvature};}
  function redSpeed(t){return 76*ease(0,.8,t)-30*ease(2.15,3.55,t);}
  function mcSpeed(t){return 82*ease(0,.8,t)-32*ease(2.05,3.45,t);}
  const gripSlip=()=>0;
  const slideLane=t=>-3.2+.4*ease(.8,1.6,t);
  const wrap=angle=>Math.atan2(Math.sin(angle),Math.cos(angle));
  function basis(heading){return{forward:[-Math.cos(heading),0,Math.sin(heading)],left:[Math.sin(heading),0,Math.cos(heading)]};}
  function offset(position,heading,forward,left,y){
    const axes=basis(heading);
    return[position[0]+axes.forward[0]*forward+axes.left[0]*left,y,position[2]+axes.forward[2]*forward+axes.left[2]*left];
  }
  function setup(openingEnd,circuit,wheels){
    end=openingEnd;road=circuit.sample;trackInfo=circuit;wheelInfo=wheels;competitionEnd=null;
    const steps=Math.round(motionEnd*240),dt=motionEnd/steps;
    distances={steps,redbull:new Float64Array(steps+1)};
    const travel=new Float64Array(steps+1);
    for(let index=1;index<=steps;index++){
      distances.redbull[index]=distances.redbull[index-1]+(redSpeed((index-1)*dt)+redSpeed(index*dt))*dt*.5;
      travel[index]=travel[index-1]+(mcSpeed((index-1)*dt)+mcSpeed(index*dt))*dt*.5;
    }
    // A normal pass, followed by braking and a corner. The photographic freeze
    // occurs inside the original bend. Heading follows the CG path throughout.
    const front=wheelInfo.mclaren.filter(w=>w.front),rear=wheelInfo.mclaren.filter(w=>!w.front);
    const frontLength=-front.reduce((sum,w)=>sum+w.center[0],0)/front.length;
    const rearLength=-rear.reduce((sum,w)=>sum+w.center[0],0)/rear.length;
    distances.station0=trackInfo.turnEnd-12-travel[steps];
    const path=[];mcMotion=[];
    for(let index=0;index<=steps;index++){
      const t=index*dt,station=distances.station0+travel[index],lane=slideLane(t),point=passRoad(station,lane);
      path.push({...point,referencePosition:point.position,roadHeading:point.heading,station,lane});
    }
    for(let index=0;index<=steps;index++){
      const point=path[index],before=path[Math.max(0,index-1)],after=path[Math.min(steps,index+1)],span=index===0||index===steps?dt:2*dt;
      const vx=(after.position[0]-before.position[0])/span,vz=(after.position[2]-before.position[2])/span,heading=Math.atan2(vz,-vx);
      mcMotion.push({...point,heading,pathHeading:heading,speed:Math.hypot(vx,vz),steer:0,slip:0,frontSlip:0,rearSlip:0,lateralVelocity:0,rearLateralVelocity:0,yawRate:0,
        frontPosition:offset(point.position,heading,frontLength,0,0),rearPosition:offset(point.position,heading,rearLength,0,0),opacity:1,opaque:true});
    }
    for(let index=0;index<=steps;index++){
      const a=mcMotion[index],before=mcMotion[Math.max(0,index-1)],after=mcMotion[Math.min(steps,index+1)],span=index===0||index===steps?dt:2*dt;
      a.yawRate=wrap(after.heading-before.heading)/span;
      a.steer=Math.max(-.35,Math.min(.35,Math.atan(3.4*a.yawRate/Math.max(.1,a.speed))))*(1-ease(motionEnd-.35,motionEnd,index*dt));
    }
    prepareLateLine();
  }
  function configurePhoto(camera){photoCamera=camera;}
  function configureEntryPhoto(camera){entryCamera=camera;}
  function actorAt(key,time){
    const t=Math.min(motionEnd,Math.max(0,time)),fraction=t/motionEnd*distances.steps,low=Math.min(distances.steps-1,Math.floor(fraction)),alpha=fraction-low;
    if(key==='mclaren'){
      const first=mcMotion[low],next=mcMotion[low+1],actor={position:blend(first.position,next.position,alpha),frontPosition:blend(first.frontPosition,next.frontPosition,alpha),rearPosition:blend(first.rearPosition,next.rearPosition,alpha),referencePosition:blend(first.referencePosition,next.referencePosition,alpha),opacity:1,opaque:true};
      for(const field of['heading','pathHeading','roadHeading','station','lane','steer','speed','lateralVelocity','yawRate','slip','rearSlip','frontSlip','rearLateralVelocity'])actor[field]=mix(first[field],next[field],alpha);
      if(time>=motionEnd)actor.speed=0;return actor;
    }
    const station=distances.station0+8+mix(distances.redbull[low],distances.redbull[low+1],alpha),point=passRoad(station,1.2);
    return{position:point.position,heading:point.heading,roadHeading:point.heading,station,lane:1.2,steer:Math.atan(3.4*point.curvature),speed:time<motionEnd?redSpeed(t):0,opacity:1,opaque:true};
  }
  function skidPoint(time,side){
    const actor=actorAt('mclaren',time),rear=wheelInfo.mclaren.filter(wheel=>!wheel.front).find(wheel=>Math.sign(wheel.center[2])===Math.sign(side)),centre=rear?.center||[1.8,0,side];
    return[actor.position[0]+Math.cos(actor.heading)*centre[0]+Math.sin(actor.heading)*centre[2],-.375,
      actor.position[2]-Math.sin(actor.heading)*centre[0]+Math.cos(actor.heading)*centre[2]];
  }
  function openingProfile(time){
    const t=Math.max(0,Math.min(29,time)),clock=integratedEase(16.8,17.2,t)-integratedEase(24.2,28.2,t);
    return{distance:72*(clock-3.8*(1-Math.exp(-clock/3.8))),speed:72*(1-Math.exp(-clock/3.8))*(ease(16.8,17.2,t)-ease(24.2,28.2,t)),pass:18*ease(16.90,20.45,t)};
  }
  function openingCamera(time,redbull,station0){
    const t=Math.max(0,Math.min(29,time));
    // A remote trackside camera sees the approaching noses. At the stopping
    // station the Red Bull is exactly abreast of it: the cover is a side view,
    // never a telephoto view of the rear. Camera XYZ stays fixed throughout.
    const position=road(station0+openingProfile(29).distance+8,76).position.slice();position[1]=2.6;
    const scan=mix(-140,-11,ease(.5,10.5,t));
    const fieldFocus=road(station0+openingProfile(t).distance+scan,-1).position.slice();
    const hero=ease(20.8,23,t),focus=blend(fieldFocus,redbull.position,hero);
    const target=[focus[0],mix(mix(.8,3,ease(8,10.5,t)),.45,ease(16.8,18.7,t)),focus[2]];
    const distance=Math.hypot(...position.map((v,k)=>v-target[k])),zoom=ease(22.0,26,t);
    // Begin with the front rows and signals in a long lens. Zoom out during
    // acceleration, then take up the Red Bull in one uninterrupted pan/zoom.
    const span=mix(mix(10,13.5,ease(16.8,19.4,t)),6.25,zoom),fov=2*Math.atan(span/(2*distance))*180/Math.PI;
    return{position,target,fov,principal:blend([800,450],[1110,525],zoom)};
  }
  function overtake(time){
    const t=Math.max(0,Math.min(durations.overtake,time)),drive=Math.min(motionEnd,t-integratedEase(4.1,freeze,t)),rate=1-ease(4.1,freeze,t);
    const redbull=actorAt('redbull',drive),mclaren=actorAt('mclaren',drive);
    mclaren.flat=ease(freeze+.3,freeze+1.1,t);redbull.speed*=rate;mclaren.speed*=rate;
    if(t>=freeze){redbull.speed=0;mclaren.speed=0;}
    const view=photoCamera.view||{forward:-16.16647,left:13.10134,height:.60656};
    const firstMC=actorAt('mclaren',0),firstRB=actorAt('redbull',0),lastMC=actorAt('mclaren',motionEnd);
    const opening=openingCamera(29,firstRB,firstMC.station-openingProfile(29).distance),openingTarget=opening.target;
    const initialOffset=opening.position.map((v,k)=>v-firstMC.position[k]),finalOffset=offset([0,0,0],lastMC.heading,view.forward,view.left,view.height);
    const firstAngle=Math.atan2(initialOffset[2],initialOffset[0]),lastAngle=firstAngle+wrap(Math.atan2(finalOffset[2],finalOffset[0])-firstAngle);
    const registration=ease(.85,motionEnd,drive),reframe=ease(.65,2.8,drive),zoom=ease(1.65,motionEnd,drive);
    const angle=mix(firstAngle,lastAngle,registration),radius=Math.exp(mix(Math.log(Math.hypot(initialOffset[0],initialOffset[2])),Math.log(Math.hypot(view.forward,view.left)),registration));
    const targetOffset=blend(openingTarget.map((v,k)=>v-firstMC.position[k]),[0,.04,0],reframe);
    const camera={position:[mclaren.position[0]+Math.cos(angle)*radius,mix(opening.position[1],view.height,registration),mclaren.position[2]+Math.sin(angle)*radius],target:mclaren.position.map((v,k)=>v+targetOffset[k]),
      fov:2*Math.atan(mix(Math.tan(opening.fov*Math.PI/360),Math.tan(photoCamera.fov*Math.PI/360),registration))*180/Math.PI,roll:photoCamera.roll*registration,principal:blend(opening.principal,photoCamera.principal,registration)};
    const distantTraffic=[['ferrari',2,38,1.5],['mercedes',3,56,-2.1],['aston',4,73,1.5]].map(([key,index,gap,lane])=>{const station=mclaren.station-gap,p=passRoad(station,lane);return{key,index,...p,station,lane,opacity:1,speed:mclaren.speed,steer:Math.atan(3.4*p.curvature),travel:mclaren.station-firstMC.station};});
    return{scene:'overtake',seconds:t,redbull,mclaren,convoy:null,distantTraffic,circuitFrame:{origin:[0,0,0],heading:0,route:'right'},worldActors:t<1.7?['mclaren']:['redbull'],camera,smoke:[],skid:0,track:ease(.8,1.7,t)*(1-ease(freeze+.65,freeze+1.8,t)),blur:false,
      phase:t<1.6?'THE LEAD AFTER THE START':t<4.1?'BRAKE AND TURN INTO THE CORNER':t<freeze?'SLOW MOTION TO A STOP':t<freeze+.3?'HOLD THE FROZEN CAR':'3D TO OUTLINE',
      photo:ease(freeze+1.0,freeze+2.3,t),photoFit:ease(freeze+1.0,freeze+2.3,t),silhouette:ease(freeze+.8,freeze+1.15,t)*(1-ease(freeze+1.45,freeze+2.5,t)),outline:ease(freeze+1.45,freeze+2.5,t),copy:ease(freeze+2.7,durations.overtake,t),cover:1-ease(0,.8,t),layout:1,canvas:1-ease(freeze+1.0,freeze+2.3,t)};
  }
  function costBudget(time){
    const t=Math.max(0,Math.min(6.5,time)),drive=Math.min(t,2.8),progress=drive/2.8;
    const x=-140+75*drive+5*drive*drive,wide=ease(.08,1.1,t),shape=ease(2.8,3.8,t),projection=ease(5.1,5.65,t),flat=ease(4.65,5.5,t);
    const amounts=[.25,.40,.60,.75],growth=amounts.map((amount,index)=>ease(.40+index*.53,.88+index*.53,t));
    const depth=mix(6,.025,flat),mclaren={position:[x,0,-1.6],heading:Math.PI,opacity:1,speed:t<2.8?75+10*drive:0,steer:0,flat,scale:1};
    const centre=x+27.0625,budgetView=ease(2.8,3.8,t),frontView=flat;
    const camera={position:blend(blend([x+18,3.2,35],[x-27,13,130],wide),blend([centre+23,27,182],[centre,2.5,150],frontView),budgetView),
      target:blend(blend([x,1,-1.6],[x-28,5,-4.4],wide),blend([centre,0,-4.4],[centre,2.5,-4.4],frontView),budgetView),fov:mix(54,30,wide)};
    const trail={x:x-60,z:-4.4,progress,shape,height:mix(8,2,flat),depth,growth,amounts,
      development:ease(3.45,4.35,t),opacity:1-ease(5.85,6.4,t),total:amounts.reduce((sum,amount,index)=>sum+amount*growth[index],0)};
    return{scene:'costs',seconds:t,redbull:null,mclaren,camera,trail,smoke:[],track:1-ease(1.8,3.8,t),blur:false,
      phase:t<2.8?'FOUR SEPARATE REPAIR COSTS':t<3.8?'STACK THE COSTS':t<4.65?'REPAIRS / DEVELOPMENT':t<5.7?'PROJECT THE BUDGET':'THE BUDGET CHOICE',
      flat,projection,budgetHandoff:ease(5.4,5.7,t),marker:ease(4.65,5.5,t),diagram:projection,budgetLabels:ease(3.9,4.35,t)*(1-ease(4.7,5.1,t)),copy:ease(5.3,6.15,t),news:0,canvas:1,labels:1-ease(2.8,3.35,t)};
  }
  function costs(time){
    const t=Math.max(0,Math.min(durations.costs,time)),entry=7,budgetSeconds=Math.min(6.5,Math.max(0,t-entry)),pose=costBudget(budgetSeconds);
    Object.assign(pose,{seconds:t,budgetSeconds,photo:1-ease(.25,1.0,t),news:1-ease(0,.6,t),bridgeFill:ease(.12,.6,t)*(1-ease(1.4,1.45,t)),bridgeOutline:1-ease(.7,.95,t),bridgeFit:1-ease(.35,.95,t)});
    pose.environment={sky:pose.track,scenery:pose.track};
    if(t>=entry){
      const frozen=overtake(freeze),drive=Math.min(budgetSeconds,2.8),anchor=pose.mclaren,travel=14*Math.abs(wrap(Math.PI-frozen.mclaren.heading))+85.8+75*drive+5*drive*drive;Object.assign(pose,bridgeCompanions(frozen,anchor,travel));return pose;
    }
    const frozen=overtake(freeze),endPosition=pose.mclaren.position,h0=frozen.mclaren.heading;
    // A single directional arc joins the budget straight directly. There is
    // no closed circle, return-to-start, or additional alignment turn.
    const radius=14,turnStart=1.65,turnEnd=4.8,exitEnd=7,endHeading=h0+wrap(Math.PI-h0),sweep=endHeading-h0,sign=Math.sign(sweep);
    const arcEnd=endPosition.map((value,k)=>k===1?0:value-basis(Math.PI).forward[k]*85.8);
    const centre=[arcEnd[0]+sign*radius*Math.sin(endHeading),0,arcEnd[2]+sign*radius*Math.cos(endHeading)];
    const initial=[centre[0]-sign*radius*Math.sin(h0),0,centre[2]-sign*radius*Math.cos(h0)];
    const arcSpeed=radius*Math.abs(sweep)/(turnEnd-turnStart-.3);
    const curveAt=seconds=>{
      if(seconds>=entry)return {...costBudget(seconds-entry).mclaren,curvature:0};
      if(seconds<=turnEnd){
        const travelled=arcSpeed*integratedEase(turnStart,turnStart+.6,seconds),heading=h0+sign*Math.min(Math.abs(sweep),travelled/radius);
        return{position:[centre[0]-sign*radius*Math.sin(heading),0,centre[2]-sign*radius*Math.cos(heading)],heading,travel:Math.min(radius*Math.abs(sweep),travelled),curvature:seconds<turnStart?0:sign/radius};
      }
      const u=(seconds-turnEnd)/(exitEnd-turnEnd),v=1-u,d=85.8;
      const travelled=3*v*v*u*(arcSpeed*(exitEnd-turnEnd)/3)+3*v*u*u*(d-75*(exitEnd-turnEnd)/3)+u*u*u*d;
      return{position:arcEnd.map((value,k)=>value+basis(Math.PI).forward[k]*travelled),heading:endHeading,travel:radius*Math.abs(sweep)+travelled,curvature:0};
    };
    const moving=movingActor(curveAt,t,Infinity),shift=initial.map((value,k)=>value-frozen.mclaren.position[k]);
    const photoPosition=frozen.camera.position.map((value,k)=>value+shift[k]),photoTarget=frozen.camera.target.map((value,k)=>value+shift[k]);
    const travel=moving.position.map((value,k)=>value-initial[k]),photoOffset=photoPosition.map((value,k)=>value-photoTarget[k]);
    const angle0=Math.atan2(photoOffset[2],photoOffset[0]),angle1=Math.atan2(36.6,18),view=ease(1.65,4.8,t);
    let delta=angle1-angle0;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;
    const pullBack=ease(turnEnd,entry,t),angle=angle0+delta*view;
    const fieldView=0; // Monza continuity does not require a field-reveal shot.
    const distance=mix(mix(Math.hypot(photoOffset[0],photoOffset[2]),18,view),Math.hypot(18,36.6),pullBack)+36*fieldView;
    const target=offset(moving.position,moving.heading,-14*fieldView,0,mix(mix(photoTarget[1],.25,view),1,pullBack));
    // Fade the composited canvas behind the registered opaque silhouette.
    // A per-material fade exposes interior faces and changes surface sorting.
    pose.mclaren={...pose.mclaren,...moving,flat:1-ease(1.45,2.1,t),opacity:t<.95?0:1};pose.canvas=ease(.95,1.4,t);
    pose.camera={position:[target[0]+Math.cos(angle)*distance,mix(mix(photoPosition[1],1.4,view),3.2,pullBack)+14*fieldView,target[2]+Math.sin(angle)*distance],target,fov:mix(mix(frozen.camera.fov,40,view),54,pullBack)+7*fieldView,roll:frozen.camera.roll*(1-view),principal:blend(frozen.camera.principal||[800,450],[800,450],Math.max(view,ease(1.65,3.5,t)))};
    Object.assign(pose,bridgeCompanions(frozen,pose.mclaren,moving.travel));
    pose.trail.opacity=0;pose.track=ease(1.25,2.4,t);pose.environment={sky:pose.track,scenery:pose.track};pose.blur=false;pose.labels=0;pose.copy=0;pose.phase=t<1.65?'LIFT THE CAR OUT OF THE PHOTO':t<turnEnd?'MCLAREN / MONZA CONNECTOR':'ACCELERATE ONTO THE STRAIGHT';return pose;
  }

  function bridgeCompanions(frozen,anchor,travel=0){
    const native=passRoad(frozen.mclaren.station+travel,frozen.mclaren.lane),yaw=anchor.heading-native.heading,c=Math.cos(yaw),s=Math.sin(yaw),origin=[anchor.position[0]-c*native.position[0]-s*native.position[2],0,anchor.position[2]+s*native.position[0]-c*native.position[2]],frame={origin,heading:yaw,route:'right'};
    // Keep the background field well behind the complete bill-column corridor,
    // including the camera pullback and the horizontal-budget reorganization.
    const distantTraffic=[['ferrari',2,118,1.2],['williams',5,146,-2.7]].map(([key,index,gap,lane])=>{const station=frozen.mclaren.station+travel-gap,p=passRoad(station,lane),[x,,z]=p.position;return{key,index,station,lane,position:[origin[0]+c*x+s*z,0,origin[2]-s*x+c*z],heading:p.heading+yaw,speed:anchor.speed,opacity:1,steer:Math.atan(3.4*p.curvature),travel};});
    return{circuitFrame:frame,convoy:null,distantTraffic,worldActors:[]};
  }
  function regulation(time){
    const t=Math.max(0,Math.min(durations.regulation,time)),drive=Math.min(t,4.65),move=ease(.35,4.65,drive);
    const x=109.2+96*move,derivative=t>.35&&t<4.65?96/4.3*30*Math.pow(clamp((t-.35)/4.3),2)*Math.pow(1-clamp((t-.35)/4.3),2):0;
    const orbit=ease(1.15,4.65,t),angle=mix(Math.atan2(-151.6,27.0625),Math.atan2(-6.15,7.8),orbit),radius=mix(Math.hypot(27.0625,151.6),Math.hypot(7.8,6.15),orbit);
    const position=[x,0,-1.6],camera={position:offset(position,Math.PI,Math.cos(angle)*radius,Math.sin(angle)*radius,mix(2.5,2.15,orbit)),
      target:[x+27.0625*(1-orbit),mix(2.5,.10,orbit),mix(-4.4,-1.6,orbit)],fov:mix(30,39,orbit),principal:blend([800,450],[1190,472],orbit)};
    return{scene:'regulation',seconds:t,redbull:null,mclaren:{position,heading:Math.PI,opacity:1,speed:derivative,steer:0,flat:1-ease(1.55,4.25,t)},camera,track:0,blur:false,smoke:[],
      phase:t<2?'FROM BUDGET TO REGULATION':t<4?'THE LIMIT APPLIES TO SPENDING':'WHY LIMIT SPENDING?',
      copy:ease(4.25,5.55,t),budget:1-ease(.2,1.55,t),morph:ease(.45,2.4,t),cap:ease(1.8,2.65,t),excess:ease(1.3,2.75,t)*(1-ease(3.1,4.45,t)),canvas:1};
  }
  function advantage(time){
    const t=Math.max(0,Math.min(durations.advantage,time)),move=ease(.45,2.2,t),testA=ease(4.3,5.45,t),testB=ease(7.65,8.8,t),x=205.2+20*move+4*testA+4*testB;
    const orbit=ease(.45,2.2,t),detail=ease(2.1,3.1,t)*(1-ease(9,10.5,t)),rearView=ease(5.2,6.3,t)*(1-ease(8.8,10.5,t));
    const position=[x,0,-1.6],camera={position:offset(position,Math.PI,mix(7.8,10,orbit)-1.1*detail-4.5*rearView,mix(-6.15,-7.9,orbit)+.9*detail-3.4*rearView,mix(2.15,3.1,orbit)-.7*rearView),
      target:[x,.1+.08*detail,-1.6],fov:zoomFov(39,1+.08*orbit),principal:blend([1190,472],[800,545],orbit)};
    const nodeTimes=[1.0,2.0,8.0,9.0,10.1],nodes=nodeTimes.map(start=>ease(start,start+.65,t));
    const derivative=(a,b,time)=>time>a&&time<b?30*Math.pow(clamp((time-a)/(b-a)),2)*Math.pow(1-clamp((time-a)/(b-a)),2)/(b-a):0;
    const upgrade={front:ease(2.95,3.65,t),rear:ease(6.15,6.95,t),frontLift:ease(2.35,2.95,t)*(1-ease(3.65,4.25,t)),rearLift:ease(5.6,6.15,t)*(1-ease(6.95,7.55,t)),
      test:(ease(4.25,4.6,t)*(1-ease(5.15,5.55,t)))+(ease(7.6,7.9,t)*(1-ease(8.6,9.0,t))),version:t<4.25?1:t<7.55?2:3};
    return{scene:'advantage',seconds:t,redbull:null,mclaren:{position,heading:Math.PI,opacity:1,speed:20*derivative(.45,2.2,t)+4*derivative(4.3,5.45,t)+4*derivative(7.65,8.8,t),steer:0,flat:0},
      camera,upgrade,track:0,circuitFrame:{origin:[313.2,0,0],heading:Math.PI},environment:{sky:0,scenery:0},blur:false,smoke:[],phase:t<2.35?'BASELINE CAR':t<4.25?'REVISE THE FRONT WING':t<5.55?'TEST VERSION 02':t<7.55?'REFINE THE REAR AERO':t<9?'TEST VERSION 03':'REINVEST IN THE NEXT ITERATION',previous:1-ease(0,.7,t),copy:ease(.8,1.5,t),nodes,loop:ease(1.6,11.2,t)};
  }
  // Exact integral of the smooth speed changes. Distance, rolling wheels and
  // braking all come from the same profile; no independent exit lunge.
  function integratedEase(a,b,time){
    if(time<=a)return 0;if(time>=b)return time-(a+b)/2;
    const u=(time-a)/(b-a);return(b-a)*(u**6-3*u**5+2.5*u**4);
  }
  function prepareLateLine(){
    // The car's heading responds late to the road curvature. Integrating that
    // heading produces the missed apex and wider exit, without a lateral tween.
    const first=trackInfo.turnStart-34,step=.18,stop=trackInfo.turnEnd+400,initial=road(first,3.3).position;
    const points=[];let x=initial[0],z=initial[2];
    for(let s=first;s<=stop+step;s+=step){
      const heading=road(s-4.2,0).heading;
      points.push({station:s,position:[x,0,z],heading});
      const mid=road(s+step/2-4.2,0).heading;x-=Math.cos(mid)*step;z+=Math.sin(mid)*step;
    }
    lateLine={first,step,points};
  }
  function latePoint(station){
    const index=Math.max(0,Math.min(lateLine.points.length-2,Math.floor((station-lateLine.first)/lateLine.step))),a=lateLine.points[index],b=lateLine.points[index+1],fraction=clamp((station-a.station)/lateLine.step);
    const position=blend(a.position,b.position,fraction),heading=mix(a.heading,b.heading,fraction),centre=road(station,0),axes=basis(centre.heading);
    const lane=(position[0]-centre.position[0])*axes.left[0]+(position[2]-centre.position[2])*axes.left[2];
    return{position,heading,curvature:(b.heading-a.heading)/lateLine.step,lane};
  }
  function racePoint(time,key){
    const acceleration=76*integratedEase(.5,1.9,time);
    const station=key==='mclaren'?-80+acceleration-40*integratedEase(5.5,6.3,time)+29*integratedEase(8.35,10.6,time)
      :-92+acceleration+7*integratedEase(2.15,3.05,time)-7*integratedEase(4.75,5.15,time)-38*integratedEase(5.18,6.02,time)+26*integratedEase(7.8,10.3,time);
    const apex=(trackInfo.turnStart+trackInfo.turnEnd)/2;
    let lane=key==='mclaren'?1.6+1.7*ease(2.35,3.65,time)
      :1.6-4.2*ease(2.7,3.9,time)+7*ease(trackInfo.turnStart-8,apex-5,station)-7.2*ease(apex+15,trackInfo.turnEnd+110,station);
    const p=key==='mclaren'&&station>=lateLine.first?latePoint(station):road(station,lane);if(p.lane!==undefined)lane=p.lane;
    return{position:[313.2-p.position[0],0,-p.position[2]],station,lane,heading:Math.PI+p.heading,curvature:p.curvature};
  }
  function movingActor(sample,time,freezeAt){
    const t=Math.min(time,freezeAt),point=sample(t),before=sample(Math.max(0,t-.002)),after=sample(t+.002),span=t+.002-Math.max(0,t-.002);
    const vx=(after.position[0]-before.position[0])/span,vz=(after.position[2]-before.position[2])/span,speed=Math.hypot(vx,vz);
    let heading=speed>.001?Math.atan2(vz,-vx):point.heading;while(heading-point.heading>Math.PI)heading-=2*Math.PI;while(heading-point.heading< -Math.PI)heading+=2*Math.PI;
    const earlier=sample(Math.max(0,t-.012)),later=sample(t+.012),a=Math.atan2(point.position[2]-earlier.position[2],-(point.position[0]-earlier.position[0])),b=Math.atan2(later.position[2]-point.position[2],-(later.position[0]-point.position[0]));
    let yaw=b-a;while(yaw>Math.PI)yaw-=2*Math.PI;while(yaw< -Math.PI)yaw+=2*Math.PI;
    const curvature=speed>.1?yaw/.012/speed:point.curvature;
    return{...point,heading,steer:clamp(Math.abs(Math.atan(3.4*curvature))/.36)*.36*Math.sign(curvature),speed:time>=freezeAt?0:speed,opacity:1,flat:0,scale:1};
  }
  function competition(time){
    const t=Math.max(0,Math.min(durations.competition,time)),freezeAt=12.4,raceTime=Math.min(t,freezeAt);
    let mclaren=movingActor(value=>racePoint(value,'mclaren'),t,freezeAt),redbull=movingActor(value=>racePoint(value,'redbull'),t,freezeAt);redbull.opacity=1;mclaren.opacity=1;
    // The foreground duel remains a pair; two other teams run far behind it.
    let companions={};
    if(t>=freezeAt){
      // Keep Red Bull's side-view endpoint. McLaren leaves with the world;
      // its later alignment is hidden after the world has fully dissolved.
      const original={redbull,mclaren,...companions},base=redbull.station,u=t-freezeAt;
      const formation=(time,key)=>{
        const clock=Math.max(0,Math.min(6,time)),old=original[key],index=['redbull','mclaren','ferrari','mercedes','cadillac'].indexOf(key),align=ease(0,2.2,clock),close=ease(2.4,6,clock),advance=64*(clock-integratedEase(0,6,clock));
        const station=old.station+advance+(base-old.station)*close,lane=mix(old.lane,original.redbull.lane+index*2.25,align),p=road(station,lane),home=road(old.station,old.lane);
        const residual=[old.position[0]-(313.2-home.position[0]),0,old.position[2]+home.position[2]];
        return{position:[313.2-p.position[0]+residual[0]*(1-align),0,-p.position[2]+residual[2]*(1-align)],station,lane,heading:Math.PI+p.heading,curvature:p.curvature};
      };
      const actors=Object.fromEntries(Object.keys(original).map(key=>[key,movingActor(value=>formation(value,key),u,6)]));({mclaren,redbull}=actors);companions={};
    }
    const wide=ease(.35,2.45,t),settle=ease(10.55,freezeAt,t),mid=blend(mclaren.position,redbull.position,.5);
    const heading=Math.PI+road(mix(mclaren.station,redbull.station,.5),0).heading;
    const opening=offset(mclaren.position,Math.PI,10,-7.9,3.1),tracking=offset(mid,heading,18,-16,1.8);
    const side=offset(redbull.position,redbull.heading,0,-45,.18);
    const target=blend(blend([mclaren.position[0],.1,mclaren.position[2]],[mid[0],.14,mid[2]],wide),[redbull.position[0],.18,redbull.position[2]],settle);
    const camera={position:blend(blend(opening,tracking,wide),side,settle),target,fov:zoomFov(mix(mix(39,43,wide),8.2,settle),1+.08*(1-wide)+.07*settle),principal:blend([800,545],[1110,525],settle)};

    const racingPhase=raceTime<2.35?'SLIPSTREAM':raceTime<3.9?'DEFEND LEFT':raceTime<5?'STRAIGHT-LINE PASS':raceTime<6.5?'MCLAREN BRAKES LATE':raceTime<8.5?'MISSED APEX / RUNS WIDE':'BETTER DRIVE OUT';
    const distantTraffic=[['ferrari',2,65,1.5],['mercedes',3,84,-2.1]].map(([key,index,gap,lane])=>{const station=mclaren.station-gap,p=road(station,lane);return{key,index,position:[313.2-p.position[0],0,-p.position[2]],heading:Math.PI+p.heading,station,lane,opacity:1,speed:mclaren.speed,steer:Math.atan(3.4*p.curvature),travel:mclaren.station-racePoint(0,'mclaren').station};});
    return{scene:'competition',seconds:t,mclaren,redbull,...companions,convoy:null,distantTraffic,worldActors:t<2?['redbull']:['mclaren'],camera,track:ease(.8,2,t)*(1-ease(13,15.6,t)),environment:{sky:ease(.8,2,t)*(1-ease(13,15.6,t)),scenery:ease(.8,2,t)*(1-ease(13,15.6,t))},blur:false,smoke:[],
      circuitFrame:{origin:[313.2,0,0],heading:Math.PI},upgrade:{front:1,rear:1,frontLift:0,rearLift:0,test:0,version:3},phase:t<freezeAt?racingPhase:'COMPETITION / FINANCIAL SUSTAINABILITY',racingPhase,raceTime,
      raceStatus:ease(1.1,1.6,t)*(1-ease(12.2,12.7,t)),raceSpeed:mclaren.speed*3.6,redSpeed:redbull.speed*3.6,
      previous:1-ease(0,.8,t),copy:ease(15.8,16.7,t),benefits:[ease(16.0,16.7,t),ease(16.4,17.1,t)],conditions:ease(16.7,17.6,t),canvas:1};
  }
  // Parked team inspection at the original Monza start area. Existing ten
  // teams occupy one level row each. Cadillac rolls in only after the rail
  // reaches the back; visibility changes happen outside the camera frustum.
  const gridOrder=['redbull','mclaren','ferrari','mercedes','aston','williams','haas','audi','alpine','racingbulls','cadillac'];
  const inspectionNativeHead=()=>distances.station0-openingProfile(29).distance;
  function entryFrame(start){
    const home=road(inspectionNativeHead(),-3),heading=start.redbull.heading-home.heading,c=Math.cos(heading),s=Math.sin(heading),p=home.position;
    return{origin:[start.redbull.position[0]-c*p[0]-s*p[2],0,start.redbull.position[2]+s*p[0]-c*p[2]],heading};
  }
  function inspectionPoint(start,index,lane,time){
    const approach=index===10?70*(1-ease(24,entryFreeze,time)):0,nativeStation=inspectionNativeHead()-12*index-(lane===3?6:0)-approach,p=road(nativeStation,lane),frame=entryFrame(start),c=Math.cos(frame.heading),s=Math.sin(frame.heading),[x,,z]=p.position;
    return{position:[frame.origin[0]+c*x+s*z,0,frame.origin[2]-s*x+c*z],heading:p.heading+frame.heading,station:nativeStation,nativeStation,lane,curvature:p.curvature,travel:index===10?70*ease(24,entryFreeze,time):0};
  }
  function entryPoint(start,key,time){return inspectionPoint(start,gridOrder.indexOf(key),-3,time);}
  function entry(time){
    const t=Math.max(0,Math.min(durations.entry,time)),run=Math.min(t,entryFreeze),start=competitionEnd||competition(durations.competition),actors={},mates=[];
    for(const[key,index]of gridOrder.map((key,index)=>[key,index])){
      const visible=index<10||t>=24,actor=movingActor(value=>inspectionPoint(start,index,-3,value),run,entryFreeze);
      actor.opacity=visible?1:0;actor.flat=key==='cadillac'?ease(entryFreeze+.55,entryFreeze+.95,t):0;actors[key]=actor;
      if(visible)mates.push({key,actor:{...movingActor(value=>inspectionPoint(start,index,3,value),run,entryFreeze),opacity:1},travel:inspectionPoint(start,index,3,run).travel});
    }
    const progress=clamp((integratedEase(4,5.5,t)-integratedEase(22.5,24,t))/18.5),row=9*progress;
    const rail=inspectionPoint(start,row,0,0),survey={position:offset(rail.position,rail.heading,7.5,-9.5,5.2),target:[rail.position[0],.5,rail.position[2]],fov:42,principal:[800,505],roll:0};
    const reveal=ease(.5,3.5,t),close=ease(26,entryFreeze,t),cadillac=actors.cadillac;
    const photoView={position:offset(cadillac.position,cadillac.heading,entryCamera.view.forward,entryCamera.view.left,entryCamera.view.height),target:[cadillac.position[0],.18,cadillac.position[2]],fov:entryCamera.fov,principal:entryCamera.principal,roll:0};
    const camera={position:blend(blend(start.camera.position,survey.position,reveal),photoView.position,close),target:blend(blend(start.camera.target,survey.target,reveal),photoView.target,close),fov:mix(mix(start.camera.fov,survey.fov,reveal),photoView.fov,close),principal:blend(blend(start.camera.principal||[1110,525],survey.principal,reveal),photoView.principal,close),roll:0};
    const track=ease(.8,3.5,t)*(1-ease(entryFreeze-.2,entryFreeze+.5,t)),vectors=ease(entryFreeze+.65,entryFreeze+1.05,t),vectorOut=1-ease(entryFreeze+1.45,entryFreeze+2.5,t),photo=ease(entryFreeze+1.45,entryFreeze+2.5,t);
    return{scene:'entry',seconds:t,circuitFrame:entryFrame(start),...actors,camera,track,blur:false,inspectionGrid:{nativeHead:inspectionNativeHead(),rows:t<24?10:11,pitch:12,stagger:6,lanes:[-3,3],row,approach:close},inspectionMates:mates,lightFocus:blend(rail.position,cadillac.position,close),
      worldActors:gridOrder.filter(key=>key!==(t<3.5?'redbull':'cadillac')),previous:1-ease(0,.5,t),vectors:0,silhouette:vectors*vectorOut,photoFit:photo,outline:photo,gridLabels:0,
      canvas:1-ease(entryFreeze+.55,entryFreeze+1.1,t),copy:ease(entryFreeze+2.5,entryFreeze+3.5,t),photo,barriers:[ease(entryFreeze+2.55,entryFreeze+3.05,t),ease(entryFreeze+2.75,entryFreeze+3.25,t),ease(entryFreeze+2.95,entryFreeze+3.5,t)],takeaway:ease(entryFreeze+3.05,entryFreeze+3.5,t)};
  }
  function conclusion(time){
    const t=Math.max(0,Math.min(durations.conclusion,time)),start=entry(durations.entry),home=start.cadillac,heading=home.heading;
    // Restore the photographed contour to the model before moving either the
    // camera or car. All eight opaque cars stay at fixed studio positions.
    // Later cars start behind the photo camera and enter through the frustum.
    const glide=(a,b,x0,x1,v0,v1)=>{const u=clamp((t-a)/(b-a)),u2=u*u,u3=u2*u;return(2*u3-3*u2+1)*x0+(u3-2*u2+u)*(b-a)*v0+(-2*u3+3*u2)*x1+(u3-u2)*(b-a)*v1;};
    const firstMove=ease(.8,4.8,t),finalMove=ease(8.5,20.5,t);
    // One continuous rail: a pullback, a slow survey and a move into the final
    // group. The intermediate keys share velocity rather than adding holds.
    const station=t<4.8?glide(.8,4.8,0,3.7,0,.8):t<8.5?glide(4.8,8.5,3.7,9,.8,1.4):glide(8.5,20.5,9,58.5,1.4,0);
    const centre=offset(home.position,heading,station,mix(8.8,5.4,finalMove),.2);
    const initialOffset=start.camera.position.map((v,k)=>v-start.camera.target[k]),sideOffset=offset([0,0,0],heading,mix(30,6,finalMove),-40,0);
    const angle0=Math.atan2(initialOffset[2],initialOffset[0]),angle1=angle0+wrap(Math.atan2(sideOffset[2],sideOffset[0])-angle0),angle=mix(angle0,angle1,firstMove);
    const radius=Math.exp(mix(Math.log(Math.hypot(initialOffset[0],initialOffset[2])),Math.log(Math.hypot(mix(30,6,finalMove),40)),firstMove));
    const target=blend(start.camera.target,centre,firstMove);
    const camera=t<=.8?{...start.camera,position:[...start.camera.position],target:[...start.camera.target],principal:[...start.camera.principal]}:{
      position:[target[0]+Math.cos(angle)*radius,mix(start.camera.position[1],mix(22,16,finalMove),firstMove),target[2]+Math.sin(angle)*radius],target,
      fov:mix(start.camera.fov,mix(22,18,finalMove),firstMove),principal:blend(start.camera.principal,[850,480],firstMove),roll:0};
    const parked=(forward,left=0,yaw=0,scale=1)=>({position:offset(home.position,heading,forward,left,0),heading:heading+yaw,scale,speed:0,steer:0,opacity:1,opaque:true,flat:0});
    const cadillac={...home,speed:0,steer:0,opacity:1,opaque:true,flat:0};
    return{scene:'conclusion',seconds:t,cadillac,alpine:parked(8,7,.32),racingbulls:parked(.6,11.5,-.32),haas:parked(7,17.6,Math.PI+.22),mclaren:parked(53.06112084,-1.22546280,.18,1.52329129),ferrari:parked(64.28673211,-.89698276,Math.PI+.12,1.32980531),mercedes:parked(64.83688394,20.29265807,.78,1.64171795),redbull:parked(60.50079997,7.17353943,-.22,1.44268458),camera,blur:false,worldActors:[],
      track:0,canvas:ease(.35,.8,t),photo:1-ease(.02,.45,t),outlineFit:1-ease(.02,.5,t),outline:1-ease(.45,.8,t),previous:1-ease(0,.6,t),finish:null,
      lightFocus:target,studio:{move:finalMove,centre,paired:['mclaren','ferrari','mercedes','redbull']},
      title:ease(20.5,21.1,t),reason:ease(22.2,23,t),limitation:ease(23.4,24.5,t),copy:ease(20.5,24.5,t)};
  }
  return Object.freeze({setup,circuitPoint:(station,lane)=>road(station,lane),openingProfile,openingCamera,configurePhoto,configureEntryPhoto,freeze,entryFreeze,skidStart,skidEnd,skidPoint,actorAt,durations,overtake,costs,costBudget,regulation,advantage,competition,entry,conclusion,entryPoint,gridOrder,ease,blend,mix,clamp,basis,offset});
})();
