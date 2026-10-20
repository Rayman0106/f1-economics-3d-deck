/* Camera rail: last row to front, parallel to the straight, physical signals.
   Shared immutable GLBs; independent transforms and calibrated wheel pivots. */
function createOpeningGrid(THREE,renderer,scene,controllerFactory,Loader,readAsset,shadow,existing){
  const duration=29,templates={...existing},cars=[],lodCache=new WeakMap();let story=null,last=null,end=null,station0=0,gantry=null,gantryAsset=null,gridMarks=null,inspectionMarks=null,inspectionLast=null;
  const order=['mclaren','redbull','ferrari','mercedes','aston','williams','cadillac','haas','audi','alpine','racingbulls','redbull','mclaren','ferrari','mercedes','aston','williams','cadillac','haas','audi','alpine','racingbulls'];
  const ease=(a,b,t)=>{const u=Math.max(0,Math.min(1,(t-a)/(b-a)));return u*u*u*(10+u*(-15+6*u));};
  function integral(a,b,t){if(t<=a)return 0;if(t>=b)return t-(a+b)/2;const u=(t-a)/(b-a);return(b-a)*(u**6-3*u**5+2.5*u**4);}
  const distance=t=>(story||window.F1Story).openingProfile(t).distance;
  // The chasers react first and pull out while still approaching the camera.
  // Positive integral distance remains after the early acceleration advantage.
  const launchPasses={1:{start:16.90,end:20.45,advance:18,pullout:.65},3:{start:16.84,end:19.70,advance:14,pullout:1.65},5:{start:16.94,end:19.95,advance:14,pullout:.95},7:{start:16.88,end:20.15,advance:14,pullout:1.90},9:{start:17.02,end:20.40,advance:14,pullout:1.25}};
  const pass=(index,t)=>{const plan=launchPasses[index];return plan?plan.advance*ease(plan.start,plan.end,t):0;};
  const passSpeed=(index,t)=>{const plan=launchPasses[index];if(!plan||t<=plan.start||t>=plan.end)return 0;const u=(t-plan.start)/(plan.end-plan.start);return plan.advance*30*u*u*(1-u)*(1-u)/(plan.end-plan.start);};
  const actorDistance=(key,t)=>distance(t)+(key==='redbull'?pass(1,t):0);
  const velocity=t=>(story||window.F1Story).openingProfile(t).speed;
  function simplified(source,cell){
    let levels=lodCache.get(source);if(!levels){levels=new Map();lodCache.set(source,levels);}if(levels.has(cell))return levels.get(cell);
    const p=source.attributes.position,attributes=Object.entries(source.attributes),bins=new Map(),mapped=[],sums=[],counts=[];
    for(let k=0;k<p.count;k++){
      const normal=source.attributes.normal;
      const uv=source.attributes.uv;
      // Never weld across texture seams or average distinct atlas coordinates.
      const token=[Math.round(p.getX(k)/cell),Math.round(p.getY(k)/cell),Math.round(p.getZ(k)/cell),...(normal?[normal.getX(k),normal.getY(k),normal.getZ(k)].map(v=>Math.round(v*2)):[]),...(uv?[Math.round(uv.getX(k)*4096),Math.round(uv.getY(k)*4096)]:[])].join(',');
      let slot=bins.get(token);if(slot===undefined){slot=counts.length;bins.set(token,slot);counts.push(0);sums.push(Object.fromEntries(attributes.map(([name,a])=>[name,Array(a.itemSize).fill(0)])));}
      mapped[k]=slot;counts[slot]++;for(const[name,a]of attributes)for(let j=0;j<a.itemSize;j++)sums[slot][name][j]+=a.array[k*a.itemSize+j];
    }
    const idx=source.index?.array||Array.from({length:p.count},(_,k)=>k),triangles=[],seen=new Set();
    for(let k=0;k<idx.length;k+=3){const t=[mapped[idx[k]],mapped[idx[k+1]],mapped[idx[k+2]]];if(new Set(t).size<3)continue;const token=t.slice().sort((a,b)=>a-b).join(',');if(seen.has(token))continue;seen.add(token);triangles.push(...t);}
    const geometry=new THREE.BufferGeometry();for(const[name,a]of attributes){const values=sums.flatMap((sum,k)=>sum[name].map(v=>v/counts[k]));geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));}
    geometry.setIndex(triangles);geometry.normalizeNormals();geometry.computeBoundingSphere();levels.set(cell,geometry);return geometry;
  }

  async function prepare(){
    for(const key of ['aston','williams','haas','audi','alpine','racingbulls']){
      const group=new THREE.Group();group.visible=false;scene.add(group);
      const controller=controllerFactory({THREE,loader:new Loader(),parent:group,renderer,readAsset:()=>readAsset(key)});
      const loaded=await controller.apply('mclaren');window.F1Boot?.parsed(key);templates[key]={group,car:loaded.car,wheels:loaded.wheels,controller};await window.F1Boot?.tick();
    }
    // Prepare unique geometry once, and yield between meshes while the loader is visible.
    const levels=new WeakMap();let count=0;
    for(const source of Object.values(templates)){
      const meshes=[];source.car.traverse(m=>{if(m.isMesh)meshes.push(m);});
      for(const mesh of meshes){if(!levels.has(mesh.geometry)){
        const wheel=/Wheel/.test(mesh.parent?.name||'')||/sidewall|tread|hub|disc/.test(Array.isArray(mesh.material)?mesh.material[0].name:mesh.material.name);
        levels.set(mesh.geometry,{full:mesh.geometry,mid:simplified(mesh.geometry,wheel?.035:.065),far:simplified(mesh.geometry,wheel?.055:.11)});
        if(++count%3===0)await window.F1Boot?.tick();
      }}
    }
    order.forEach((key,index)=>{
      const source=templates[key];let entry;
      if(index<2)entry={...source,index,key,primary:true,meshes:[],lod:0};
      else{
        const group=new THREE.Group(),car=source.car.clone(true);group.name='Grid_'+index+'_'+key;group.add(car);scene.add(group);
        const contact=shadow.clone();contact.material=shadow.material;group.add(contact);
        const wheels=source.wheels.map(w=>({...w,steer:car.getObjectByName(w.steer.name),rolling:car.getObjectByName(w.rolling.name)}));
        const meshes=[];car.traverse(mesh=>{if(!mesh.isMesh)return;mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=true;meshes.push({mesh,...levels.get(mesh.geometry)});});
        entry={group,car,wheels,meshes,index,key,primary:false,lod:-1};
      }
      entry.group.visible=false;cars.push(entry);
    });
  }
  async function prepareSignals(){
    const gltf=await new Loader().parseAsync(await readAsset('start-gantry'),'');gantryAsset=gltf.scene;window.F1Boot?.parsed('start-gantry');await window.F1Boot?.tick();
  }
  function poseAt(index,station,speed,t=duration){
    const plan=launchPasses[index],baseLane=index%2===0?-3.2:1.2;
    const pullout=plan?plan.pullout*(ease(17.25,18.65,t)-ease(20.55,22.5,t)):0;
    const lane=baseLane+pullout,offset=(index===1?-10:-index*7)+pass(index,t),p=story.circuitPoint(station+offset,lane);
    const derivative=(a,b,s)=>s>a&&s<b?30*((s-a)/(b-a))**2*(1-(s-a)/(b-a))**2/(b-a):0;
    const laneSpeed=plan?plan.pullout*(derivative(17.25,18.65,t)-derivative(20.55,22.5,t)):0;
    const forwardSpeed=speed+passSpeed(index,t),yaw=forwardSpeed>.5?Math.atan2(laneSpeed,forwardSpeed):0;
    return{...p,heading:p.heading+yaw,station:station+offset,lane,speed:Math.hypot(forwardSpeed,laneSpeed),steer:Math.max(-.16,Math.min(.16,yaw*.45)),opacity:1};
  }
  function configure(value){
    story=value;end=story.overtake(0);station0=end.mclaren.station-distance(duration);
    const marks=new THREE.Group();marks.name='Starting_grid_22';gridMarks=marks;const material=new THREE.MeshBasicMaterial({color:0xe8e6dc,depthWrite:true,fog:true});
    for(let index=0;index<22;index++){
      const pose=poseAt(index,station0,0,0),[x,,z]=pose.position;
      for(const side of[-1,1]){const line=new THREE.Mesh(new THREE.BoxGeometry(5.8,.008,.065),material);line.position.set(x,-.389,z+side*1.1);marks.add(line);}
      const nose=new THREE.Mesh(new THREE.BoxGeometry(.065,.008,2.2),material);nose.position.set(x-3.1,-.389,z);marks.add(nose);
    }
    const track=scene.getObjectByName('APEX_CIRCUIT_V10');track.add(marks);
    gantry=createStartGantry(THREE,track,new THREE.Vector3(...story.circuitPoint(station0+12,0).position),gantryAsset);
    inspectionMarks=new THREE.Group();inspectionMarks.name='Team_inspection_grid';inspectionMarks.visible=false;track.add(inspectionMarks);
    for(let row=0;row<11;row++)for(const lane of[-3,3]){
      const p=story.circuitPoint(station0-row*12-(lane===3?6:0),lane),stall=new THREE.Group();stall.userData.row=row;stall.position.fromArray(p.position);stall.rotation.y=p.heading;
      for(const side of[-1,1]){const line=new THREE.Mesh(new THREE.BoxGeometry(5.8,.008,.065),material);line.position.set(0,-.378,side*1.1);stall.add(line);}
      const nose=new THREE.Mesh(new THREE.BoxGeometry(.065,.008,2.2),material);nose.position.set(-3.1,-.378,0);stall.add(nose);inspectionMarks.add(stall);
    }

  }
  const cameraPosition=new THREE.Vector3(),cameraTarget=new THREE.Vector3();
  function place(entry,pose,travel){entry.group.visible=true;entry.group.position.fromArray(pose.position);entry.group.rotation.set(0,pose.heading,0);entry.group.scale.setScalar(1);for(const w of entry.wheels){w.rolling.rotation.z=travel/w.radius;w.steer.rotation.y=w.front?(pose.steer||0):0;w.setBlur(Math.min(.38,pose.speed/100));}}
  function selectLod(entry,position,force=false){
    if(entry.primary)return;const d=entry.group.position.distanceTo(position)*Math.tan(scene.userData.openingCamera.fov*Math.PI/360)/Math.tan(44*Math.PI/360);let level=d>85?2:d>30?1:0;
    if(!force&&entry.lod>=0){if(entry.lod===0&&d<34)level=0;if(entry.lod===1&&d>27&&d<94)level=1;if(entry.lod===2&&d>77)level=2;}
    if(level===entry.lod)return;entry.lod=level;const key=['full','mid','far'][level];for(const item of entry.meshes)item.mesh.geometry=item[key];
  }
  function frame(seconds){
    if(gantry)gantry.group.visible=true;
    if(gridMarks)gridMarks.visible=true;if(inspectionMarks)inspectionMarks.visible=false;inspectionLast=null;
    const t=Math.max(0,Math.min(duration,seconds)),travel=distance(t),station=station0+travel,speed=velocity(t);
    for(const entry of cars)place(entry,poseAt(entry.index,station,speed,t),travel+pass(entry.index,t));
    const redbull=cars.find(e=>e.primary&&e.key==='redbull'),mclaren=cars.find(e=>e.primary&&e.key==='mclaren');
    const rbPose=poseAt(redbull.index,station,speed,t),mcPose=poseAt(mclaren.index,station,speed,t),view=story.openingCamera(t,rbPose,station0);
    cameraPosition.fromArray(view.position);cameraTarget.fromArray(view.target);
    // After the rail stops, the camera's world position never changes. Only
    // its aim and focal length track the cars driving past and away.
    const camera=scene.userData.openingCamera;camera.position.copy(cameraPosition);camera.up.set(0,1,0);camera.lookAt(cameraTarget);camera.fov=view.fov;
    const subjectDistance=Math.min(...cars.map(e=>e.group.position.distanceTo(cameraPosition)));
    camera.near=Math.max(.4,Math.min(80,subjectDistance*.18));camera.updateProjectionMatrix();camera.projectionMatrix.elements[8]=-(view.principal[0]-800)/800;camera.projectionMatrix.elements[9]=(view.principal[1]-450)/450;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();camera.updateMatrixWorld();
    for(const entry of cars)selectLod(entry,cameraPosition);const lights=t<11||t>=16.6?0:Math.min(5,1+Math.floor((t-11+1e-9)/1));gantry.setCount(lights);
    last={scene:'opening',seconds:t,track:1-ease(26,28.2,t),count:22,types:11,redbull:rbPose,mclaren:mcPose,camera:view,distance:travel,worldSpeed:speed,lights,copy:ease(28.2,29,t),near:camera.near,corridorActors:cars.map(e=>poseAt(e.index,station,speed,t)),gantry:gantry.centers.map(p=>p.toArray()),launchPasses};
    if(last.track===0)for(const entry of cars)if(!entry.primary)entry.group.visible=false;
    scene.updateMatrixWorld(true);
  }
  function state(){
    const camera=scene.userData.openingCamera,project=p=>{const v=p.clone().project(camera);return{x:(v.x+1)*800,y:(1-v.y)*450,z:v.z};};
    const bounds=entry=>{const b=new THREE.Box3().setFromObject(entry.car),points=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z])points.push(project(new THREE.Vector3(x,y,z)));return{x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y)),front:points.every(p=>p.z<1&&p.z>-1)};};
    return{...last,gantryMaterials:gantry.materials(),gantrySource:gantry.source,lampRows:gantry.lampRows,gantryScreen:gantry.centers.map(project),cars:cars.map(entry=>({index:entry.index,team:entry.key,visible:entry.group.visible,position:entry.group.position.toArray(),bounds:bounds(entry),opacity:1,lod:entry.lod,triangles:entry.meshes.reduce((sum,m)=>sum+(m.mesh.geometry.index?.count||m.mesh.geometry.attributes.position.count)/3,0)})),wheelAngles:Object.fromEntries(cars.slice(0,2).map(e=>[e.key,e.wheels.map(w=>w.rolling.rotation.z)]))};
  }
  function follow(pose){
    // The finish camera has its own flag and stripe. Clear the foreground
    // portal for the whole shot, rather than toggle a post near the hero car.
    if(gantry)gantry.group.visible=pose.scene!=='conclusion';
    if(gridMarks)gridMarks.visible=!pose.inspectionGrid;if(inspectionMarks){inspectionMarks.visible=!!pose.inspectionGrid;inspectionMarks.children.forEach(stall=>stall.visible=stall.userData.row<(pose.inspectionGrid?.rows||0));}
    inspectionLast=null;
    if(pose.inspectionGrid){
      for(const entry of cars)if(!entry.primary)entry.group.visible=false;
      const active=[];
      for(const record of pose.inspectionMates||[]){
        const entry=cars.find(e=>!e.primary&&e.index>=11&&e.key===record.key);if(!entry||record.actor.opacity<=0)continue;
        place(entry,record.actor,record.travel);selectLod(entry,scene.userData.openingCamera.position);active.push(entry);
      }
      // Photo calibration renders this scene before the gantry is configured.
      gantry?.setCount(0);inspectionLast={rows:pose.inspectionGrid.rows,active};return;
    }

    if(pose.distantTraffic){
      const traffic=new Map(pose.distantTraffic.map(actor=>[actor.index,actor]));
      for(const entry of cars)if(!entry.primary){
        const actor=traffic.get(entry.index);entry.group.visible=!!actor&&pose.track>0;
        if(entry.group.visible){place(entry,actor,distance(duration)+(actor.travel||0));selectLod(entry,scene.userData.openingCamera.position);}
      }return;
    }
    if(!story||!pose.convoy){for(const entry of cars)if(!entry.primary)entry.group.visible=false;return;}
    const formation=pose.convoy,advance=formation.station-end.redbull.station,travel=distance(duration)+advance;
    for(const entry of cars)if(!entry.primary){
      if(entry.index<11&&pose[entry.key]){entry.group.visible=false;continue;}
      let actor=poseAt(entry.index,formation.station-(formation.tailGap||0),pose.mclaren?.speed||pose.redbull?.speed||0);
      if(formation.frame){const {origin,heading}=formation.frame,[x,,z]=actor.position;actor={...actor,heading:actor.heading+heading,position:[origin[0]+Math.cos(heading)*x+Math.sin(heading)*z,0,origin[2]-Math.sin(heading)*x+Math.cos(heading)*z]};}
      else if(formation.anchor){const original=formation.source,heading=formation.anchor.heading-original.heading,dx=actor.position[0]-original.position[0],dz=actor.position[2]-original.position[2];actor={...actor,heading:actor.heading+heading,position:[formation.anchor.position[0]+Math.cos(heading)*dx+Math.sin(heading)*dz,0,formation.anchor.position[2]-Math.sin(heading)*dx+Math.cos(heading)*dz]};}
      place(entry,actor,travel+(formation.travel||0));selectLod(entry,scene.userData.openingCamera.position);
    }
  }
  async function warmup(){for(const t of[0,1,2,3,4,5,6,7,8,9,10.5,11,13,15,16.6,17,19,21,23,24.5,26,27,28.2,29]){frame(t);renderer.render(scene,scene.userData.openingCamera);await window.F1Boot?.tick();}}
  function inspectionState(){if(!inspectionLast)return null;const camera=scene.userData.openingCamera;return{rows:inspectionLast.rows,mates:inspectionLast.active.map(entry=>{const b=new THREE.Box3().setFromObject(entry.car),points=[];for(const x of[b.min.x,b.max.x])for(const y of[b.min.y,b.max.y])for(const z of[b.min.z,b.max.z]){const v=new THREE.Vector3(x,y,z).project(camera);points.push({x:(v.x+1)*800,y:(1-v.y)*450,z:v.z});}return{team:entry.key,position:entry.group.position.toArray(),box:{x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y)),front:points.every(p=>p.z>-1&&p.z<1)}};})};}
  return{inspectionState,duration,prepare,prepareSignals,configure,frame,follow,distance,actorDistance,state,storyTemplates:()=>Object.fromEntries(['aston','williams','haas','audi','alpine','racingbulls'].map(key=>[key,templates[key]])),backgroundGroups:()=>cars.filter(e=>!e.primary&&e.group.visible).map(e=>e.group),openingWorldGroups:()=>cars.filter(e=>!(e.primary&&e.key==='redbull')).map(e=>e.group),summary:()=>last,warmup,hide(){for(const entry of cars)if(!entry.primary)entry.group.visible=false;},showAll(){for(const entry of cars)entry.group.visible=true;}};
}
