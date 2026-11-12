/* J: precomputed scene irradiance, balanced with the existing sky/ground fill.
   Uses the MIT three.js r186 LightProbeGenerator, included with its license.
   No runtime cube renders, screen-space GI passes or temporal accumulation. */
window.F1GlobalJ=(()=>{
 let T,scene,renderer,probe,source,ready=false,enabled=true,lighting=true,track=0,heading=null;
 let gain=0,bakeMs=0,cubeSize=0,lights=[],normals,cubeStatistics=[],daylight=0;
 const luminance=v=>.2126*v.x+.7152*v.y+.0722*v.z;
 function setup(three,render,world){
  T=three;renderer=render;scene=world;
  lights=scene.children.filter(light=>light.isAmbientLight||light.isHemisphereLight);
  probe=new T.LightProbe();probe.name='J_static_scene_irradiance';probe.intensity=0;scene.add(probe);
  normals={up:new T.Vector3(0,1,0),down:new T.Vector3(0,-1,0),side:new T.Vector3(1,0,0)};
 }
 function measureFace(data,face){
  const half=data instanceof Uint16Array,bytes=data instanceof Uint8Array;
  let maxRGB=0,maxLuminance=0,total=0,aboveOne=0,finite=true;
  const decode=half?T.DataUtils.fromHalfFloat:bytes?v=>v/255:v=>v;
  for(let i=0;i<data.length;i+=4){
   const r=decode(data[i]),g=decode(data[i+1]),b=decode(data[i+2]);
   finite=finite&&Number.isFinite(r)&&Number.isFinite(g)&&Number.isFinite(b);
   const l=.2126*r+.7152*g+.0722*b;
   maxRGB=Math.max(maxRGB,r,g,b);maxLuminance=Math.max(maxLuminance,l);total+=l;
   if(Math.max(r,g,b)>1)aboveOne++;
  }
  return{face,pixels:data.length/4,maxRGB,maxLuminance,meanLuminance:total/(data.length/4),pixelsAboveOne:aboveOne,finite};
 }
 async function prepare(target){
  const began=performance.now();
  const generator=window.createF1LightProbeGenerator(T);
  // Reuse the six readbacks already required for SH. Retain numeric summaries
  // only: no extra cube renders, GPU readbacks or image capture.
  cubeStatistics=[];
  const reader={isWebGLRenderer:renderer.isWebGLRenderer,coordinateSystem:renderer.coordinateSystem,
   async readRenderTargetPixelsAsync(...args){
    const value=await renderer.readRenderTargetPixelsAsync(...args);
    if(window.F1ReviewMode)cubeStatistics.push(measureFace(args[5],args[6]));
    return value;
   }};
  const captured=await generator.fromCubeRenderTarget(reader,target);
  source=captured.sh.clone();probe.sh.copy(source);
  const upward=source.getIrradianceAt(normals.up,new T.Vector3());
  if(!source.coefficients.every(c=>[c.x,c.y,c.z].every(Number.isFinite))||luminance(upward)<=0)throw new Error('J scene irradiance is invalid');
  // Replace part of the former .78 hemisphere fill, rather than stack another
  // bright ambient light over it. Preserve comparable upward diffuse energy.
  gain=Math.min(1,.38/luminance(upward));cubeSize=target.width;ready=true;heading=null;
  bakeMs=performance.now()-began;frame(track,lighting,daylight);
 }
 function rotateSH(out,input,angle){
  // f_rotated(n)=f_original(R_y^-1 n). Rotate the L1 vector and the L2
  // traceless quadratic tensor, not the Object3D Euler of a LightProbe.
  const c=Math.cos(angle),s=Math.sin(angle),a=.315392,b=.546274;
  out.coefficients[0].copy(input.coefficients[0]);out.coefficients[1].copy(input.coefficients[1]);
  for(const axis of ['x','y','z']){
   const get=i=>input.coefficients[i][axis],put=(i,v)=>out.coefficients[i][axis]=v;
   put(2,c*get(2)-s*get(3));put(3,s*get(2)+c*get(3));
   const xx=-a*get(6)+b*get(8),yy=-a*get(6)-b*get(8),zz=2*a*get(6),xz=b*get(7),xy=b*get(4),yz=b*get(5);
   const nx=c*c*xx+2*c*s*xz+s*s*zz,nz=s*s*xx-2*c*s*xz+c*c*zz;
   put(4,(c*xy+s*yz)/b);put(5,(-s*xy+c*yz)/b);
   put(6,nz/(2*a));put(7,(c*s*(zz-xx)+(c*c-s*s)*xz)/b);put(8,(nx-yy)/(2*b));
  }
 }
 function setHeading(value){if(!ready||heading===value)return;heading=value;rotateSH(probe.sh,source,value);}
 function frame(value,lightEnabled=true,daylightWeight=0){
  track=Math.max(0,Math.min(1,value||0));lighting=!!lightEnabled;daylight=daylightWeight;
  const mix=T.MathUtils.lerp,amount=ready&&enabled&&lighting?track*(1-daylight):0;
  probe.intensity=gain*amount;
  if(!lighting)return;
  for(const light of lights){
   if(light.isAmbientLight)light.intensity=mix(.12,.035,track)-.017*amount-.018*daylight;
   else light.intensity=mix(.36,.78,track)-.45*amount-.42*daylight;
  }
 }
 function setEnabled(value){enabled=!!value;frame(track,lighting,daylight);}
 function auditMaterials(){
  const unique=new Map();
  scene.traverse(mesh=>{
   if(!mesh.isMesh)return;
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    if(!material?.isMeshStandardMaterial)continue;
    let item=unique.get(material);
    if(!item){item={material,meshes:0,example:mesh.name};unique.set(material,item);}item.meshes++;
   }
  });
  const families={},buildings=[];
  for(const{material:m,meshes,example}of unique.values()){
   const family=m.userData.f1LightSurface?.family||m.userData.f1SurfaceProfile?.family||'unclassified';
   const row=families[family]??={materials:0,meshes:0,map:0,roughnessMap:0,normalMap:0,clearcoatNormalMap:0,emissive:0};
   row.materials++;row.meshes+=meshes;
   for(const field of['map','roughnessMap','normalMap','clearcoatNormalMap'])if(m[field])row[field]++;
   if(m.emissiveIntensity>0&&m.emissive?.getHex()>0)row.emissive++;
   if(family.startsWith('building-')||/Imported_Monza|Grandstand|Stand_|Spectator_/i.test(example)||/glass|window|concrete|precast|canopy/i.test(m.name))buildings.push({name:m.name,example,family,meshes,color:m.color.toArray(),roughness:m.roughness,metalness:m.metalness,envMapIntensity:m.envMapIntensity,
    emissiveIntensity:m.emissiveIntensity,emissive:m.emissive.toArray(),map:m.map?.name||m.map?.image?.src||!!m.map,normalMap:!!m.normalMap,roughnessMap:!!m.roughnessMap});
  }
  return{uniqueMaterials:unique.size,families,buildings,cubeStatistics,changesRenderState:false};
 }
 function state(){
  const irradiance=ready?Object.fromEntries(Object.entries(normals).map(([name,n])=>[name,probe.sh.getIrradianceAt(n,new T.Vector3()).multiplyScalar(gain).toArray()])):null;
  return{enabled,ready,method:'baked static-scene SH irradiance + existing PMREM specular',cubeSize,bakeMs,gain,track,heading,
   intensity:probe?.intensity,irradiance,coefficients:probe?.sh.coefficients.map(v=>v.toArray()),
   ambient:lights.map(light=>({type:light.type,intensity:light.intensity})),
   runtimeCubeRenders:0,extraScreenPasses:0,extraShadowMaps:0,changedCamera:false,changedActors:false};
 }
 return{setup,prepare,setHeading,frame,setEnabled,state,auditMaterials,measureFace,testing:{rotateSH}};
})();
