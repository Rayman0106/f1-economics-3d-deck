/* K look prototype: lighting and surface finish only.
   Cameras, actor trajectories, timing, geometry and assets are unchanged.
   Disable with ?look=j, or at runtime with F1LookK.setEnabled(false), for A/B.
   - Sun: lower (32 deg instead of the HDR's ~48 deg), slightly warmer key.
   - Fill: less hemisphere/environment fill in the 3D world, so key and shade separate.
   - Haze: a little more aerial perspective at distance.
   - Architecture: lower albedo, base grime, macro weathering and vertical streaks.
   - Grandstand seats: muted tint instead of untextured white.
   - Turf: visible, filtered mowing stripes.
   All world-only adjustments scale with the world alpha, so 2D slide cars keep their look. */
window.F1LookK=(()=>{
 const query=new URLSearchParams(location.search).get('look');
 let enabled=query!=='j',prepared=false,scene=null;
 const settings={elevationDeg:32,hemisphere:.72,environment:.8,fog:.00055,sunTint:[1,.97,.92],
  // 90 deg: bands parallel to the start/finish straight.
  stripeWidth:11,stripeAmount:.09,stripeAngleDeg:90};
 const on={value:enabled?1:0};
 const patched=new WeakSet(),counts={building:0,barrier:0,paving:0,seat:0,turf:0,skipped:0};
 const tracked=new Map();

 // Per-frame writers in several J modules set these values. Track the last value
 // this module wrote; anything else is a fresh base from an upstream writer.
 function adjust(key,current,apply){
  let record=tracked.get(key);
  if(!record){record={base:current,set:undefined};tracked.set(key,record);}
  if(record.set===undefined||current!==record.set)record.base=current;
  record.set=apply(record.base);return record.set;
 }
 function adjustColor(key,color,apply){
  let record=tracked.get(key);
  if(!record){record={base:color.clone(),set:null};tracked.set(key,record);}
  if(!record.set||!color.equals(record.set))record.base.copy(color);
  apply(color.copy(record.base));record.set=(record.set||color.clone()).copy(color);
 }

 const noise=`
  float kLookHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float kLookNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
   return mix(mix(kLookHash(i),kLookHash(i+vec2(1.,0.)),f.x),mix(kLookHash(i+vec2(0.,1.)),kLookHash(i+vec2(1.,1.)),f.x),f.y);}
 `;
 const roles={
  building:{albedo:.62,weather:1,tint:[1,1,1],tintAmount:0},
  barrier:{albedo:.85,weather:.75,tint:[1,1,1],tintAmount:0},
  paving:{albedo:.76,weather:.35,tint:[1,1,1],tintAmount:0},
  // Linear-space blue-grey. Seats read as seating rather than bare white steps,
  // while staying light enough to silhouette the darker cars in front.
  seat:{albedo:1,weather:.25,tint:[.36,.45,.53],tintAmount:.7}
 };
 // One uniform set per role and one for turf, shared by every patched material,
 // so tune() can adjust the whole look live without recompiling programs.
 const shared={};
 function roleUniforms(kind){
  if(shared[kind])return shared[kind];
  const values=roles[kind],Color=scene.fog.color.constructor;
  return shared[kind]={kLookOn:on,kLookAlbedo:{value:values.albedo},kLookWeather:{value:values.weather},
   kLookTint:{value:new Color(...values.tint)},kLookTintAmount:{value:values.tintAmount}};
 }
 const stripeDirection=deg=>({x:Math.cos(deg*Math.PI/180),y:Math.sin(deg*Math.PI/180),isVector2:true});
 const turfUniforms={kLookOn:on,kStripeWidth:{value:settings.stripeWidth},kStripeAmount:{value:settings.stripeAmount},
  kStripeDir:{value:stripeDirection(settings.stripeAngleDeg)}};
 function role(mesh,material){
  if(!material?.isMeshStandardMaterial||material.transparent||material.alphaTest>0||material.alphaToCoverage)return null;
  const name=mesh.name,base=(material.name||'').split(' / ')[0];
  if(/glass|metal|fence|flag|antenna|Vehicles|objects1|serraglio|alpha|crowd|LED|Signal|Gantry/i.test(base+' '+name))return null;
  if(/cleanstand_(?:seats|cushions)|seat_(?:backs|cushions)/i.test(name))return 'seat';
  if(/cleanstand_(?:forecourt|frontwalk)/.test(name))return 'paving';
  if(/^(?:Concrete_wall|Wall_panel)/.test(name))return 'barrier';
  if(/^Imported_Monza_/.test(name)&&(/^(?:box_M|box|gstand|walls|wall2|paddk|misc1)\.\d+$/.test(base)||base===''||/Inset pit interior/.test(base)))return 'building';
  if(/Pale precast grandstand end walls|Textured grandstand concrete/.test(base))return 'building';
  return null;
 }
 function patchSurface(material,kind){
  const uniforms=roleUniforms(kind);
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
   previous.call(this,shader,renderer);
   if(!shader.vertexShader.includes('#include <begin_vertex>')||!shader.fragmentShader.includes('#include <map_fragment>')){counts.skipped++;return;}
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
    varying vec3 kLookWorld;varying float kLookUp;`).replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 kLookPosition=vec4(transformed,1.);
    #ifdef USE_INSTANCING
     kLookPosition=instanceMatrix*kLookPosition;
    #endif
    kLookWorld=(modelMatrix*kLookPosition).xyz;
    kLookUp=normalize(mat3(modelMatrix)*objectNormal).y;`);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec3 kLookWorld;varying float kLookUp;
    uniform float kLookOn,kLookAlbedo,kLookWeather,kLookTintAmount;uniform vec3 kLookTint;
    ${noise}`).replace('#include <map_fragment>',`#include <map_fragment>
    {
     float kHeight=kLookWorld.y,kVertical=1.-abs(kLookUp);
     // Splash and dirt collect near the ground on walls, not on roofs or paving.
     float kBase=mix(1.,mix(.72,1.,smoothstep(.15,4.5,kHeight)),kVertical*kLookWeather);
     float kMacro=.6*kLookNoise(kLookWorld.xz*.045+vec2(kHeight*.021,0.))+.4*kLookNoise(kLookWorld.xz*.19+kHeight*.07);
     float kStreak=kLookNoise(vec2((kLookWorld.x+kLookWorld.z)*.9,kHeight*.09));
     float kWear=(1.+.18*(kMacro-.5)*kLookWeather)*(1.-.09*kLookWeather*kVertical*smoothstep(.55,.95,kStreak));
     float kLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
     vec3 kTinted=mix(diffuseColor.rgb,kLookTint*(.82+.36*kLookNoise(kLookWorld.xz*1.7+kHeight*2.3))*(.6+.4*kLuma),kLookTintAmount);
     diffuseColor.rgb=mix(diffuseColor.rgb,kTinted*kLookAlbedo*kBase*kWear,kLookOn);
    }`);
  };
  material.customProgramCacheKey=function(){return cacheKey.call(this)+'-look-K1-'+kind;};
  material.needsUpdate=true;patched.add(material);counts[kind]++;
 }
 const turfKeys=/^monza-(?:meadow-H2|close-turf-H4|middle-turf-H4|projected-grass-H3)$/;
 const turfAnchor='return mix(turf,verge,wear)*mix(.59,1.,contact)*pigment;';
 function patchTurf(material){
  const uniforms=turfUniforms;
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
   previous.call(this,shader,renderer);
   if(!shader.fragmentShader.includes(turfAnchor)){counts.skipped++;return;}
   Object.assign(shader.uniforms,uniforms);
   shader.fragmentShader=shader.fragmentShader.replace('vec3 parkGrassTone(vec3 turf',
    'uniform float kLookOn,kStripeWidth,kStripeAmount;uniform vec2 kStripeDir;\n    vec3 parkGrassTone(vec3 turf').replace(turfAnchor,`
      vec3 kField=mix(turf,verge,wear)*mix(.59,1.,contact)*pigment;
      // Box-filtered mowing bands: fade before they alias at grazing distance.
      float kU=dot(metres,kStripeDir)/kStripeWidth+.35*parkNoise(metres*.011);
      float kFw=max(footprint/kStripeWidth,.0001);
      float kBand=clamp(sin(kU*6.2831853)/max(kFw*6.2831853,.05),-1.,1.);
      float kAmp=kLookOn*(1.-smoothstep(.12,.45,kFw));
      return kField*(1.+kStripeAmount*kBand*kAmp);`);
  };
  material.customProgramCacheKey=function(){return cacheKey.call(this)+'-look-K1-stripes';};
  material.needsUpdate=true;patched.add(material);counts.turf++;
 }
 function patchScene(){
  if(!scene)return;
  scene.traverse(mesh=>{
   if(!mesh.isMesh)return;
   for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    if(!material||patched.has(material))continue;
    let key='';try{key=material.customProgramCacheKey();}catch{}
    if(turfKeys.test(key)){patchTurf(material);continue;}
    if(mesh.name==='Fine_asphalt'){patchRoad(material,false);continue;}
    if(/^(?:Runoff_|K_runoff_apron_)/.test(mesh.name)){patchRoad(material,true);continue;}
    const kind=role(mesh,material);if(kind)patchSurface(material,kind);
   }
  });
 }
 // Shadow stability. The near shadow map is a 60 x 52 m window that follows the
 // cars. Architecture only ever caught a moving slice of it, which read as a shadow
 // edge sliding across facades once K darkened them; keep buildings out of it after
 // the opening (whose window is fixed to the grid). Story cars stay in focus by
 // choosing the visible car nearest the camera, not the one nearest screen centre,
 // which could be a distant background car and drop the battle pair's shadows.
 let opening=false,flagsMode=null;const actors=[],architecture=new Map();
 function collect(){
  actors.length=0;
  for(const root of scene.children){
   let car=false;root.traverse(mesh=>{if(!car&&mesh.isMesh)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(m?.userData.f1SurfaceProfile){car=true;break;}});
   if(car)actors.push({root,position:root.position.clone()});
  }
  scene.traverse(mesh=>{
   if(mesh.isMesh&&!architecture.has(mesh)&&/^(?:Imported_Monza_|(?:Far_)?Grandstand_|Stand_)/.test(mesh.name))
    architecture.set(mesh,{cast:mesh.castShadow,receive:mesh.receiveShadow});
  });
  flagsMode=null;applyFlags();
 }
 function applyFlags(){
  const isolate=enabled&&!opening;if(flagsMode===isolate)return;flagsMode=isolate;
  for(const[mesh,base]of architecture){
   // LightStudy may have updated the native flags since collection; keep its latest.
   if(!isolate){mesh.castShadow=base.cast;mesh.receiveShadow=base.receive;continue;}
   base.cast=mesh.castShadow;base.receive=mesh.receiveShadow;mesh.castShadow=false;mesh.receiveShadow=false;
  }
  window.F1SurfaceJ?.invalidateShadow();
 }
 const surface=window.F1SurfaceJ;
 for(const[name,isOpening]of[['setOpening',true],['setShot',false]]){
  const original=surface[name];
  surface[name]=function(...args){const result=original.apply(this,args);if(opening!==isOpening){opening=isOpening;if(prepared)applyFlags();}return result;};
 }
 const shadowCenter=surface.shadowCenter,toCar={x:0,y:0,z:0};
 surface.shadowCenter=function(center,alpha){
  if(shadowCenter.call(this,center,alpha))return true;
  const camera=window.__F1CinematicPreviousCamera;
  if(!enabled||!prepared||alpha<=.05||!camera?.position||!camera.target)return false;
  const [cx,cy,cz]=camera.position,[tx,ty,tz]=camera.target;
  let vx=tx-cx,vy=ty-cy,vz=tz-cz;const vl=Math.hypot(vx,vy,vz)||1;vx/=vl;vy/=vl;vz/=vl;
  const half=Math.atan(Math.tan((camera.fov||40)*Math.PI/360)*16/9)*1.3,minDot=Math.cos(Math.min(half,1.45));
  let nearest=null,best=Infinity;
  for(const actor of actors){
   actor.visibleNow=false;
   let visible=true;for(let node=actor.root;node;node=node.parent)if(!node.visible){visible=false;break;}
   if(!visible)continue;
   actor.root.getWorldPosition(actor.position);
   toCar.x=actor.position.x-cx;toCar.y=actor.position.y-cy;toCar.z=actor.position.z-cz;
   const d=Math.hypot(toCar.x,toCar.y,toCar.z)||1;
   actor.visibleNow=(toCar.x*vx+toCar.y*vy+toCar.z*vz)/d>=minDot;
   if(actor.visibleNow&&d<best){best=d;nearest=actor;}
  }
  if(!nearest)return false;
  center.set(0,0,0);let n=0;
  for(const actor of actors)if(actor.visibleNow&&actor.position.distanceToSquared(nearest.position)<24*24){center.add(actor.position);n++;}
  center.multiplyScalar(1/n);center.y=0;return true;
 };

 // ---- Track: corner-only kerbs and asphalt wear ----------------------------
 // Final J ran one red/white kerb along both edges of the whole 2.5 km route.
 // K keeps kerbs to the corner (outside entry, inside apex, wide outside exit)
 // and lays run-off asphalt in the old kerb strip on the straights. Heights match
 // the old 5 cm kerb, so car paths and wheel contact are unchanged.
 // Road UVs are (lateral, station) * 0.13 metres in every track strip.
 const roadUniforms={kLookOn:on,kTurnStart:{value:0},kTurnEnd:{value:0}};
 function patchRoad(material,runoff){
  const previous=material.onBeforeCompile,cacheKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
   previous.call(this,shader,renderer);
   if(!shader.fragmentShader.includes('#include <map_fragment>')||!shader.fragmentShader.includes('#include <lights_physical_fragment>')){counts.skipped++;return;}
   Object.assign(shader.uniforms,roadUniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n varying vec2 kLookRoad;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\n kLookRoad=uv/.13;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec2 kLookRoad;uniform float kLookOn,kTurnStart,kTurnEnd;
    ${noise}`).replace('#include <map_fragment>',`#include <map_fragment>
    float kRubber=0.,kMarks=0.,kDust=0.,kPatch=0.;
    {
     float l=kLookRoad.x,s=kLookRoad.y,side=abs(l);
     // Fade fine wear where one pixel spans more than ~0.6 m of road.
     float kDetail=1.-smoothstep(.25,.6,max(fwidth(s),fwidth(l)));
     ${runoff?`
     kDust=.55+.45*kLookNoise(vec2(l*.7,s*.05));`:`
     float wander=.9*sin(s*.011)+.35*sin(s*.037);
     kRubber=(1.-smoothstep(.55,2.3,abs(l-wander)))*(.62+.38*kLookNoise(vec2(l*2.6,s*.045)));
     float corner=smoothstep(kTurnStart-70.,kTurnStart,s)*(1.-smoothstep(kTurnEnd,kTurnEnd+70.,s));
     kRubber=max(kRubber,corner*(1.-smoothstep(1.8,5.6,side))*.75);
     float braking=smoothstep(kTurnStart-160.,kTurnStart-25.,s)*(1.-smoothstep(kTurnStart,kTurnStart+20.,s));
     kMarks=braking*smoothstep(.6,.92,kLookNoise(vec2(l*4.3,s*.018)))*(1.-smoothstep(2.2,4.8,side))*kDetail;
     kDust=smoothstep(4.8,6.25,side)*(.55+.45*kLookNoise(vec2(l*1.4,s*.07)));
     vec2 cellSize=vec2(3.15,27.),cell=floor(vec2(l,s)/cellSize),inside=fract(vec2(l,s)/cellSize)*cellSize;
     float h=kLookHash(cell+17.3),len=7.+14.*fract(h*7.31),fw=max(fwidth(s),.02);
     kPatch=step(h,.16)*smoothstep(.25,.25+fw,inside.x)*(1.-smoothstep(2.9-fw,2.9,inside.x))
      *smoothstep(3.,3.+fw,inside.y)*(1.-smoothstep(3.+len-fw,3.+len,inside.y));`}
     vec3 k=diffuseColor.rgb*(1.-.17*kRubber-.24*kMarks)*(1.+.11*kDust)*(1.-.09*kPatch);
     k=mix(k,k*vec3(1.05,1.025,.97),kDust*.6);
     diffuseColor.rgb=mix(diffuseColor.rgb,k,kLookOn);
    }`).replace('#include <lights_physical_fragment>',`
    roughnessFactor=clamp(roughnessFactor+kLookOn*(-.09*kRubber-.05*kPatch+.04*kDust),.45,1.);
    #include <lights_physical_fragment>`);
  };
  material.customProgramCacheKey=function(){return cacheKey.call(this)+'-look-K1-'+(runoff?'runoff':'asphalt');};
  material.needsUpdate=true;patched.add(material);counts[runoff?'runoff':'asphalt']=(counts[runoff?'runoff':'asphalt']||0)+1;
 }
 const kerbMaterials=[];
 function kerbMaterial(source){
  const m=source.clone();m.name='K corner kerb';m.vertexColors=false;m.map=null;m.color.setRGB(1,1,1);m.roughness=.66;m.metalness=0;
  m.polygonOffset=false;m.onBeforeCompile=shader=>{
   shader.uniforms.kLookOn=on;
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n varying vec2 kLookKerb;')
    .replace('#include <begin_vertex>','#include <begin_vertex>\n kLookKerb=uv;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
    varying vec2 kLookKerb;${noise}`).replace('#include <map_fragment>',`#include <map_fragment>
    float kKerbRubber;
    {
     // 1.25 m red/white blocks, box-filtered so distant kerbs do not shimmer.
     float x=kLookKerb.y/2.5,f=max(fwidth(x),1e-4);
     float white=clamp((abs(fract(x)-.5)-.25)/f+.5,0.,1.);
     vec3 colour=mix(vec3(.50,.045,.036),vec3(.70,.69,.63),white);
     // Tyres cut the inner edge; dust and rubber collect in streaks along it.
     kKerbRubber=exp(-kLookKerb.x*2.4)*(.5+.5*kLookNoise(vec2(kLookKerb.y*.32,kLookKerb.x*5.)));
     float grime=.10*kLookNoise(vec2(kLookKerb.y*.9,kLookKerb.x*9.));
     diffuseColor.rgb=colour*(1.-.5*kKerbRubber)*(1.-grime);
    }`).replace('#include <lights_physical_fragment>',`
    roughnessFactor=mix(.6,.84,kKerbRubber);
    #include <lights_physical_fragment>`);
  };
  m.customProgramCacheKey=()=> 'monza-look-K1-kerb';m.needsUpdate=true;kerbMaterials.push(m);return m;
 }
 const trackMeshes=[],hiddenKerbs=[];
 function buildTrack(){
  const circuit=window.F1Cinematic?.circuit?.();
  const left=scene.getObjectByName('APEX_CIRCUIT_V10'),right=scene.getObjectByName('Monza_right_route_road');
  const oldKerb=left?.getObjectByName('Bevelled_kerbs'),runoff=left?.getObjectByName('Runoff_1');
  if(!circuit||!left||!oldKerb||!runoff){counts.trackSkipped=true;return;}
  const {turnStart,turnEnd}=circuit,length=turnEnd-turnStart;
  roadUniforms.kTurnStart.value=turnStart;roadUniforms.kTurnEnd.value=turnEnd;
  const stations=runoff.geometry.attributes.uv,first=Math.min(...Array.from({length:stations.count},(_,k)=>stations.getY(k)))/.13,
   last=Math.max(...Array.from({length:stations.count},(_,k)=>stations.getY(k)))/.13;
  const Geometry=oldKerb.geometry.constructor,Attribute=oldKerb.geometry.attributes.position.constructor,Mesh=oldKerb.constructor;
  // Positions on the left-hand route; the right-hand story route is its z mirror.
  const at=(s,l,y)=>{const p=circuit.sample(s,l).position;return[p[0],y,p[2]];};
  function strip(from,to,step,rows,uvOf){
   const count=Math.max(1,Math.ceil((to-from)/step)),positions=[],uv=[],index=[],width=rows(from).length;
   for(let r=0;r<=count;r++){const s=from+(to-from)*r/count;for(const[l,y]of rows(s)){positions.push(...at(s,l,y));uv.push(...uvOf(s,l));}}
   for(let r=0;r<count;r++)for(let c=0;c<width-1;c++){const a=r*width+c,b=a+1,d=a+width,e=d+1;index.push(a,d,b,b,d,e);}
   return{positions,uv,index};
  }
  function geometry({positions,uv,index},mirror){
   const p=positions.slice(),u=uv.slice(),idx=index.slice();
   if(mirror){for(let k=2;k<p.length;k+=3)p[k]=-p[k];for(let k=0;k<idx.length;k+=3)[idx[k+1],idx[k+2]]=[idx[k+2],idx[k+1]];}
   const g=new Geometry();g.setAttribute('position',new Attribute(p,3));g.setAttribute('uv',new Attribute(u,2));g.setIndex(idx);
   g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function add(parent,name,data,material,mirror){
   if(!parent)return;const mesh=new Mesh(geometry(data,mirror),material);mesh.name=name;mesh.receiveShadow=true;mesh.castShadow=false;
   mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.frustumCulled=false;parent.add(mesh);trackMeshes.push(mesh);
  }
  // Run-off asphalt where the continuous kerb used to be (mirrored UVs for the right route).
  for(const side of[-1,1]){
   const rows=()=>side>0?[[6.3,-.4],[7.15,-.411]]:[[-7.15,-.411],[-6.3,-.4]];
   const data=strip(first,last,1.8,rows,(s,l)=>[l*.13,s*.13]);
   add(left,'K_runoff_apron_'+side,data,runoff.material,false);
   const mirrored={...data,uv:data.uv.map((v,k)=>k%2?v:-v)};
   add(right,'K_runoff_apron_'+side,mirrored,runoff.material,true);
  }
  // Corner kerbs. Positive lateral is the inside of the left-hand bend.
  const material=kerbMaterial(oldKerb.material);
  const kerbs=[
   {name:'entry_outside',side:-1,from:turnStart-38,to:turnStart+.22*length,width:1.25},
   {name:'apex_inside',side:1,from:turnStart+.12*length,to:turnStart+.86*length,width:1.25},
   {name:'exit_outside',side:-1,from:turnStart+.5*length,to:turnEnd+48,width:1.6}
  ];
  for(const kerb of kerbs){
   const taper=s=>Math.min(1,(s-kerb.from)/6,(kerb.to-s)/6);
   const rows=s=>{
    const t=Math.max(0,taper(s)),outer=6.55+(6.3+kerb.width-6.55)*t,top=-.398+.048*Math.min(1,t*1.6);
    const profile=[[6.3,-.398],[6.42,top],[Math.max(6.43,outer-.13),top],[outer,-.409]];
    return kerb.side>0?profile:profile.map(([l,y])=>[-l,y]).reverse();
   };
   const data=strip(kerb.from,kerb.to,.5,rows,(s,l)=>[Math.abs(l)-6.3,s]);
   add(left,'K_kerb_'+kerb.name,data,material,false);
   add(right,'K_kerb_'+kerb.name,data,material,true);
  }
  for(const root of[left,right]){const kerb=root?.getObjectByName('Bevelled_kerbs');if(kerb)hiddenKerbs.push(kerb);}
  window.F1PerformanceJ?.invalidateStatic();
  counts.track={turnStart,turnEnd,stations:[first,last],meshes:trackMeshes.length};
  applyTrack();
 }
 function applyTrack(){
  for(const kerb of hiddenKerbs)kerb.visible=!enabled;
  for(const mesh of trackMeshes)mesh.visible=enabled;
 }

 // Called during preparation, before the warmup renders that compile programs.
 function prepare(world){scene=world;buildTrack();patchScene();collect();prepared=true;}
 const setLook=window.F1Background.setLook;
 window.F1Background.setLook=function(...args){const result=setLook.apply(this,args);if(prepared)patchScene();return result;};

 // Upstream modules finish writing light values before the world render calls
 // F1LightStudy.beforeRender. Apply K's world-only balance there.
 const beforeRender=window.F1LightStudy.beforeRender;
 window.F1LightStudy.beforeRender=function(alpha,...rest){
  const result=beforeRender.call(this,alpha,...rest);
  if(prepared)frame(alpha);
  return result;
 };
 function frame(alpha){
  const world=enabled?Math.max(0,Math.min(1,alpha||0)):0;
  for(const light of scene.children){
   if(light.isHemisphereLight)light.intensity=adjust(light,light.intensity,v=>v*(1+(settings.hemisphere-1)*world));
   else if(light.isDirectionalLight&&light.castShadow){
    adjustColor(light.color,light.color,c=>c.setRGB(c.r*(1+(settings.sunTint[0]-1)*world),c.g*(1+(settings.sunTint[1]-1)*world),c.b*(1+(settings.sunTint[2]-1)*world)));
   }
  }
  adjust('environment',scene.environmentIntensity,v=>scene.environmentIntensity=v*(1+(settings.environment-1)*world));
  // The opening's long lens looks across ~1 km of forest; extra haze reads as mist.
  if(scene.fog)adjust('fog',scene.fog.density,v=>scene.fog.density=Math.max(v,opening?0:settings.fog*world));
 }
 // Read by F1Background.frameLighting when it places the sun for each frame.
 function sunSlope(hdrSlope){return enabled?Math.tan(settings.elevationDeg*Math.PI/180):hdrSlope;}
 function setEnabled(value){
  enabled=!!value;on.value=enabled?1:0;if(prepared){applyFlags();applyTrack();}
  window.F1SurfaceJ?.invalidateShadow();
  for(const[key,record]of tracked){
   if(key==='environment'&&scene)scene.environmentIntensity=record.base;
   else if(key==='fog'&&scene?.fog)scene.fog.density=record.base;
   else if(key?.isColor)key.copy(record.base);
   else if(key?.isLight)key.intensity=record.base;
  }
  tracked.clear();
 }
 // Live look development, e.g. F1LookK.tune({stripeAmount:.1,seat:{tintAmount:.5}}).
 // Lighting keys take effect on the next rendered frame; surface keys are uniforms.
 function tune(values={}){
  for(const key of['elevationDeg','hemisphere','environment','fog','sunTint'])if(key in values)settings[key]=values[key];
  if('stripeWidth'in values)turfUniforms.kStripeWidth.value=settings.stripeWidth=values.stripeWidth;
  if('stripeAmount'in values)turfUniforms.kStripeAmount.value=settings.stripeAmount=values.stripeAmount;
  if('stripeAngleDeg'in values)turfUniforms.kStripeDir.value=stripeDirection(settings.stripeAngleDeg=values.stripeAngleDeg);
  for(const kind of Object.keys(roles)){
   const change=values[kind];if(!change)continue;
   Object.assign(roles[kind],change);const u=shared[kind];if(!u)continue;
   if('albedo'in change)u.kLookAlbedo.value=change.albedo;
   if('weather'in change)u.kLookWeather.value=change.weather;
   if('tintAmount'in change)u.kLookTintAmount.value=change.tintAmount;
   if(change.tint)u.kLookTint.value.setRGB(...change.tint);
  }
  window.F1SurfaceJ?.invalidateShadow();
  return state();
 }
 function state(){return{enabled,prepared,settings:{...settings},roles:JSON.parse(JSON.stringify(roles)),patched:{...counts},changedCamera:false,changedActors:false,changedTiming:false};}
 return{prepare,sunSlope,setEnabled,tune,state,get enabled(){return enabled;}};
})();
