/* J-only surface refinement. No actor, camera, route or animation-time edits. */
window.F1SurfaceJ=(()=>{
 let T,renderer,world,key,enabled=true,shot='',focus=null,opening=null;
 let right,up,parkedCenter,parkedSun,parkedMap=null,parkedLook;
 let openingShadows=false,pendingParked=false,reused=false,parkedDraws=0;
 const roads=new Map(),strength={value:1};
 const properties=['roughness','metalness','envMapIntensity'];
 function setup(three,render,scene,light){
  T=three;renderer=render;world=scene;key=light;
  right=new T.Vector3();up=new T.Vector3();parkedCenter=new T.Vector3();parkedSun=new T.Vector3();
 }
 function invalidateShadow(){parkedMap=null;pendingParked=false;reused=false;}
 function setShot(kind,point){shot=kind;focus=point||null;opening=null;openingShadows=false;invalidateShadow();}
 function setOpening(pose){shot='opening';opening=pose;}
 function shadowCenter(center,alpha){
  openingShadows=enabled&&!!opening&&alpha>.001;
  if(openingShadows){
   // The lineup is one long, shallow group. Keep its light-space coverage
   // anchored to the actual cars as they launch, even as the camera pans.
   let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
   for(const {position:[x,,z]} of opening.corridorActors){
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
   }
   center.set((minX+maxX)*.5,0,(minZ+maxZ)*.5);
   return true;
  }
  // The inspection uses its authored survey focus through the full move.
  if(!enabled||shot!=='entry'||alpha<=.05||!focus)return false;
  center.fromArray(focus);center.y=0;return true;
 }
 function alignShadow(center,direction){
  const camera=key.shadow.camera,width=openingShadows?160:60,height=openingShadows?116:52;
  if(camera.right!==width*.5||camera.top!==height*.5){
   camera.left=-width*.5;camera.right=width*.5;camera.bottom=-height*.5;camera.top=height*.5;
   camera.updateProjectionMatrix();
  }
  right.set(direction.z,0,-direction.x).normalize();up.crossVectors(direction,right).normalize();
  const x=center.dot(right),y=center.dot(up),pitchX=width/key.shadow.mapSize.x,pitchY=height/key.shadow.mapSize.y;
  center.addScaledVector(right,Math.round(x/pitchX)*pitchX-x);
  center.addScaledVector(up,Math.round(y/pitchY)*pitchY-y);
  key.target.position.copy(center);key.target.updateMatrixWorld();key.position.copy(center).addScaledVector(direction,85);

  const stationary=openingShadows&&opening.seconds<=16.6&&opening.distance===0&&!window.F1ParallelK?.warming;
  reused=stationary&&parkedMap!==null&&parkedMap===key.shadow.map
   &&parkedLook===window.F1Background?.mode&&parkedCenter.equals(center)&&parkedSun.equals(key.position);
  if(reused)renderer.shadowMap.needsUpdate=false;
  pendingParked=stationary&&!reused;
 }
 function shadowDrawn(lights){
  if(!lights.includes(key))return;
  if(pendingParked){
   parkedMap=key.shadow.map;parkedCenter.copy(key.target.position);parkedSun.copy(key.position);
   parkedLook=window.F1Background?.mode;parkedDraws++;
  }else parkedMap=null;
  pendingParked=false;
 }
 function roadProfile(material,runoff){
  if(!material?.isMeshStandardMaterial||roads.has(material))return;
  const base={color:material.color.clone(),normalScale:material.normalScale.clone()};
  for(const name of properties)base[name]=material[name];
  const profile={base,runoff};roads.set(material,profile);
  const before=material.onBeforeCompile,cache=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,render){
   before.call(this,shader,render);shader.uniforms.jRoadStrength=strength;
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    varying vec2 vJRoadMetres;`).replace('#include <begin_vertex>',`#include <begin_vertex>
    vJRoadMetres=uv/0.13;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec2 vJRoadMetres;uniform float jRoadStrength;`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    // Dry, fine aggregate. The source roughness map is retained, but dark
    // texels cannot turn this dry circuit into a polished/wet surface.
    float jRoadPatch=bgNoise(vJRoadMetres*vec2(.23,.035));
    float jWornLane=.55*sin(vJRoadMetres.y*.017)+.20*sin(vJRoadMetres.y*.043);
    float jRubber=(1.-smoothstep(.50,2.45,abs(vJRoadMetres.x-jWornLane)))
      *smoothstep(.28,.78,jRoadPatch)*${runoff?'0.0':'1.0'};
    float jDryRoughness=clamp(.87+.08*(roughnessFactor-.5)+.025*(jRoadPatch-.5)-.065*jRubber,.80,.94);
    roughnessFactor=mix(roughnessFactor,jDryRoughness,jRoadStrength);
    // Low-contrast binder patches and accumulated rubber, not a uniform
    // brightness/saturation grade or an extra coplanar decal layer.
    diffuseColor.rgb*=mix(1.,(.975+.05*jRoadPatch)*(1.-.115*jRubber),jRoadStrength);`);
  };
  material.customProgramCacheKey=()=>cache+'-dry-asphalt-J-1-'+(runoff?'runoff':'main');
  material.needsUpdate=true;applyRoad(material,profile);
 }
 function applyRoad(material,{base,runoff}){
  material.color.copy(base.color);material.normalScale.copy(base.normalScale);
  for(const name of properties)material[name]=base[name];
  if(!enabled)return;
  material.color.multiplyScalar(runoff ? .98 : .95);
  material.normalScale.setScalar(runoff ? .22 : .26);
  material.metalness=0;material.envMapIntensity=.48;
 }
 function prepareRoad(){
  world.traverse(mesh=>{
   if(!mesh.isMesh||!(mesh.name==='Fine_asphalt'||/^Runoff_[+-]?\d+$/.test(mesh.name)))return;
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])roadProfile(material,mesh.name!=='Fine_asphalt');
  });
 }
 function setEnabled(value){enabled=!!value;invalidateShadow();strength.value=enabled?1:0;for(const[m,p]of roads)applyRoad(m,p);}
 function roadEdges(){
  const entries=[];world.traverse(mesh=>{
   if(mesh.name!=='Bevelled_kerbs')return;
   if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
   entries.push({route:mesh.parent.name,visible:mesh.visible,materialVisible:mesh.material.visible,vertices:mesh.geometry.attributes.position.count,minY:mesh.geometry.boundingBox.min.y,maxY:mesh.geometry.boundingBox.max.y});
  });return entries;
 }
 function state(){return{enabled,shot,focusSource:openingShadows?'opening-lineup':enabled&&shot==='entry'?'continuous-inspection-rail':'native-actor-selection',
  reused,parkedDraws,shadowExtent:key&&[key.shadow.camera.right-key.shadow.camera.left,key.shadow.camera.top-key.shadow.camera.bottom],
  roadMaterials:roads.size,extraDrawCalls:0,extraTextures:0,shadowResolution:key?.shadow.mapSize.toArray(),
  shadowPosition:key?.position.toArray(),shadowTarget:key?.target.position.toArray(),
  shadowMatrix:key?.shadow.matrix.elements.slice(),
  roadSamples:[...roads].map(([m,p])=>({name:m.name,runoff:p.runoff,color:m.color.getHexString(),roughness:m.roughness,normalScale:m.normalScale.toArray(),envMapIntensity:m.envMapIntensity,texture:m.map?.image&&[m.map.image.width,m.map.image.height],anisotropy:m.map?.anisotropy})),
  changedCamera:false,changedActors:false,changedResolution:false};}
 return{setup,setShot,setOpening,shadowCenter,alignShadow,shadowDrawn,invalidateShadow,prepareRoad,setEnabled,state,roadEdges,
  get openingShadows(){return openingShadows;}};
})();
