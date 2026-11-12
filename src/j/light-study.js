/* Lighting study I. Shared H scenery; original actor/camera samplers stay intact.
   Real-time PBR, deterministic contact-hardening shadows and depth-based AO.
   PCSS method: https://threejs.org/examples/webgl_shadowmap_pcss.html (MIT).
*/
window.F1LightStudy=(()=>{
  let T,renderer,scene,camera,key,ready=false,enabled=true,track=1,baseRig,reflection,reflectionHeading=0,reflectionRoots=[];
  const surfaces=new Map(),upgrades=new WeakMap(),architecture=new Map(),actors=[];
  const families={},direction={value:null},counts={},fillLights=[],reflectionBases=new Map();
  const physicalKeys=['metalness','roughness','envMapIntensity','clearcoat','clearcoatRoughness','ior','emissiveIntensity'];
  const read=m=>Object.fromEntries(physicalKeys.filter(k=>typeof m[k]==='number').map(k=>[k,m[k]]));
  function remember(m,family,finish){
    if(surfaces.has(m))return;
    const base=m.userData.f1LightSurface?.base||read(m);
    m.userData.f1LightSurface={family,base,finish};surfaces.set(m,{base,finish,family});
    families[family]=(families[family]||0)+1;
    Object.assign(m,enabled?finish:base);
  }
  function upgradeCar(THREE,root){
    T=THREE;
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const upgrade=original=>{
        if(upgrades.has(original))return upgrades.get(original);
        const family=original.userData.f1SurfaceProfile?.family;
        if(!family||!original.isMeshStandardMaterial)return original;
        let material=original;
        if(['paint','carbon'].includes(family)&&!original.isMeshPhysicalMaterial){
          material=new T.MeshPhysicalMaterial();T.MeshStandardMaterial.prototype.copy.call(material,original);
          material.defines={...original.defines,STANDARD:'',PHYSICAL:''};
          material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey;
        }
        const finish=family==='paint'?{metalness:Math.min(original.metalness,.12),roughness:.29,envMapIntensity:1.22,clearcoat:.86,clearcoatRoughness:.16,ior:1.5}:
          family==='carbon'?{metalness:0,roughness:.43,envMapIntensity:.95,clearcoat:.24,clearcoatRoughness:.30}:
          family==='rubber'?{metalness:0,roughness:/tread/i.test(original.name)?.96:.87,envMapIntensity:.23}:
          family==='metal'?{metalness:Math.max(original.metalness,.76),roughness:/mirror/i.test(original.name)?.12:.25,envMapIntensity:1.20}:
          family==='decal'?{metalness:0,roughness:.35,envMapIntensity:.95}:{};
        remember(material,'car-'+family,finish);upgrades.set(original,material);return material;
      };
      mesh.material=Array.isArray(mesh.material)?mesh.material.map(upgrade):upgrade(mesh.material);
    });
  }
  function installSoftShadows(){
    const chunk=T.ShaderChunk.shadowmap_pars_fragment;
    const marker='float depth = texture2D( shadowMap, shadowCoord.xy ).r;';
    if(!chunk.includes(marker))throw new Error('Lighting I: native raw-depth shadow hook changed');
    const pcss=`
    #if !defined( SHADOWMAP_TYPE_PCF ) && !defined( SHADOWMAP_TYPE_VSM )
      vec2 lightISample(int i,float count){float a=float(i)*2.39996323;return vec2(cos(a),sin(a))*sqrt((float(i)+.5)/count);}
      float lightIDepth(sampler2D map,vec2 uv){
        float d=textureLod(map,clamp(uv,vec2(.00001),vec2(.99999)),0.).r;
        #ifdef USE_REVERSED_DEPTH_BUFFER
          d=1.-d;
        #endif
        return d;
      }
      float lightIPcss(sampler2D map,vec3 coord,vec2 size){
        float z=coord.z;
        #ifdef USE_REVERSED_DEPTH_BUFFER
          z=1.-z;
        #endif
        float blockers=0.,sum=0.;
        for(int j=0;j<8;j++){
          float d=lightIDepth(map,coord.xy+lightISample(j,8.)*7./size);
          if(d<z-.000025){sum+=d;blockers+=1.;}
        }
        if(blockers<.5)return 1.;
        // Orthographic shadow depth is linear: convert separation back to m.
        float separation=max(0.,z-sum/blockers)*179.;
        vec2 penumbra=clamp(vec2(separation*.025)/vec2(60.,52.),.65/size,14./size);
        float result=0.;
        for(int j=0;j<12;j++)result+=step(z,lightIDepth(map,coord.xy+lightISample(j,12.)*penumbra));
        return result/12.;
      }
    #endif
    `;
    T.ShaderChunk.shadowmap_pars_fragment=chunk.replace('#ifdef USE_SHADOWMAP','#ifdef USE_SHADOWMAP\n'+pcss)
      .replace(marker,`if(shadowMapSize.x>3072.)return mix(1.,lightIPcss(shadowMap,shadowCoord.xyz,shadowMapSize),shadowIntensity*smoothstep(0.,.07,min(min(shadowCoord.x,1.-shadowCoord.x),min(shadowCoord.y,1.-shadowCoord.y))));\n`+marker);
  }
  function setup(THREE,render,world,view,lights){
    T=THREE;renderer=render;scene=world;camera=view;key=lights[0];direction.value=new T.Vector3();
    for(const light of world.children)if(light.isAmbientLight||light.isHemisphereLight)fillLights.push(light);
    baseRig={type:renderer.shadowMap.type,size:key.shadow.mapSize.clone(),normalBias:key.shadow.normalBias,bias:key.shadow.bias,
      camera:Object.fromEntries(['left','right','top','bottom','near','far'].map(k=>[k,key.shadow.camera[k]])),exposure:renderer.toneMappingExposure};
    installSoftShadows();configureShadow();
  }
  function configureShadow(){
    if(!renderer)return;
    const size=enabled?4096:baseRig.size.x;
    if(key.shadow.mapSize.x!==size){key.shadow.map?.dispose();key.shadow.map=null;key.shadow.mapSize.set(size,size);}
    renderer.shadowMap.type=enabled?T.BasicShadowMap:baseRig.type;
    Object.assign(key.shadow.camera,enabled?{left:-30,right:30,top:26,bottom:-26,near:1,far:180}:baseRig.camera);
    key.shadow.camera.updateProjectionMatrix();key.shadow.normalBias=enabled?.018:baseRig.normalBias;key.shadow.bias=enabled?-.000035:baseRig.bias;
    renderer.shadowMap.needsUpdate=true;
  }
  function prepareArchitecture(THREE,render,world,root,pairs){
    const seen=new Set();
    const profile=(m,name)=>{
      if(!m?.isMeshStandardMaterial||m.userData.f1SurfaceProfile||seen.has(m)||m.visible===false)return;
      seen.add(m);let family,finish;
      if(/glass/i.test(m.name)){family='building-glass';finish={metalness:0,roughness:.14,envMapIntensity:1.7};}
      else if(/metal/i.test(m.name)&&!/alpha/i.test(m.name)){family='building-metal';finish={metalness:.74,roughness:.30,envMapIntensity:1.1};}
      else if(/Imported_Monza|Grandstand|Stand_|Spectator_/.test(name)){
        family='building-concrete';finish={metalness:0,roughness:.88,envMapIntensity:1.02};
        if(m.emissiveIntensity>0)finish.emissiveIntensity=Math.min(m.emissiveIntensity,.09);
      }else return;
      remember(m,family,finish);
    };
    root.traverse(mesh=>{
      if(!mesh.isMesh)return;
      for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        profile(m,mesh.name);
        const pair=pairs.get(m);if(pair)for(const variant of Object.values(pair))profile(variant,mesh.name);
      }
    });
    ready=true;collectMeshes();setEnabled(enabled);
  }
  function collectMeshes(){
    actors.length=0;const groups=new Map();
    scene.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(materials.some(m=>m.userData.f1SurfaceProfile)){
        let anchor=mesh;while(anchor.parent&&anchor.parent!==scene)anchor=anchor.parent;
        if(!groups.has(anchor))groups.set(anchor,[]);
        const base=mesh.userData.f1IShadowBase??={cast:mesh.castShadow,receive:mesh.receiveShadow};
        groups.get(anchor).push({mesh,...base,opaque:materials.some(m=>!m.transparent&&m.userData.f1SurfaceProfile?.family!=='decal')});
        for(const m of materials){const info=m.userData.f1LightSurface;if(info&&!surfaces.has(m))remember(m,info.family,info.finish);}
      }else if(/^Imported_Monza|^(?:Far_)?Grandstand_|^Stand_/.test(mesh.name)&&!/_seats?|_cushions|_backs|flag|fence|crowd|alpha/i.test(mesh.name)){
        if(!architecture.has(mesh))architecture.set(mesh,mesh.userData.f1IShadowBase??={cast:mesh.castShadow,receive:mesh.receiveShadow});
      }
    });
    for(const[anchor,meshes]of groups)actors.push({anchor,meshes,position:new T.Vector3()});
    counts.carGroups=actors.length;counts.buildingMeshes=architecture.size;
  }
  function setEnabled(value){
    enabled=!!value;lastReflectionHeading=null;
    for(const[m,profile]of surfaces)Object.assign(m,enabled?{...profile.base,...profile.finish}:profile.base);
    for(const[mesh,base]of architecture){mesh.castShadow=enabled||base.cast;mesh.receiveShadow=enabled||base.receive;}
    if(!enabled)for(const actor of actors)for(const item of actor.meshes){item.mesh.castShadow=item.cast;item.mesh.receiveShadow=item.receive;}
    configureShadow();
    if(!enabled&&renderer)renderer.toneMappingExposure=baseRig.exposure;
    applyReflections();
  }
  const reflective=family=>['car-paint','car-carbon','car-metal','building-glass','building-metal'].includes(family);
  function applyReflections(){
    if(!reflection)return;
    for(const[m,profile]of surfaces){
      if(!reflective(profile.family))continue;
      if(!reflectionBases.has(m))reflectionBases.set(m,{map:m.envMap,rotation:m.envMapRotation.clone()});
      const base=reflectionBases.get(m),texture=enabled?reflection.texture:base.map;
      if(m.envMap!==texture){m.envMap=texture;m.needsUpdate=true;}
      if(!enabled)m.envMapRotation.copy(base.rotation);
    }
  }
  async function bakeReflections(roots){
    if(reflection)return;
    reflectionRoots=roots.filter(root=>/CIRCUIT/.test(root.name));
    reflectionHeading=reflectionRoots.find(root=>root.visible)?.rotation.y||0;
    const hidden=[],grass=[],sky=roots.find(root=>/sky/i.test(root.name));
    const skyPosition=sky?.position.clone(),shadow=renderer.shadowMap.enabled;
    const target=new T.WebGLCubeRenderTarget(256,{type:T.HalfFloatType,generateMipmaps:false});
    const probe=new T.CubeCamera(.15,1600,target),position=key.target.position.clone();position.y=1.1;
    probe.position.copy(position);
    try{
      for(const child of scene.children)if(!child.isLight&&!roots.includes(child)){hidden.push([child,child.visible]);child.visible=false;}
      // Capture static Monza geometry only: no frozen cars, chart bars or grass
      // blades duplicated inside their reflections. Terrain and trees remain.
      for(const root of roots)root.traverse(mesh=>{if(mesh.isMesh&&/_grass_/.test(mesh.name)){grass.push([mesh,mesh.visible]);mesh.visible=false;}});
      if(sky)sky.position.copy(position);
      renderer.shadowMap.enabled=false;
      probe.update(renderer,scene);
      await window.F1GlobalJ.prepare(target);
      const generator=new T.PMREMGenerator(renderer);reflection=generator.fromCubemap(target.texture);generator.dispose();
      counts.reflection={source:'static Monza scene, vehicles excluded',cubeSize:256,textureSize:[reflection.width,reflection.height],runtimeCubeRenders:0};
    }finally{
      for(const[object,visible]of[...hidden,...grass])object.visible=visible;
      if(sky)sky.position.copy(skyPosition);
      renderer.shadowMap.enabled=shadow;renderer.shadowMap.needsUpdate=true;target.dispose();
    }
    applyReflections();await window.F1Boot?.tick();
  }
  function frame(alpha,main){
    track=T.MathUtils.clamp(alpha||0,0,1);if(!enabled)return;
    direction.value.copy(main.position).sub(main.target.position).normalize();
    scene.environmentIntensity=T.MathUtils.lerp(.56,.50,track);
    renderer.toneMappingExposure=T.MathUtils.lerp(baseRig.exposure,1.0,track);
    for(const light of fillLights){
      if(light.isAmbientLight)light.intensity=T.MathUtils.lerp(.12,.035,track);
      else if(light.isHemisphereLight)light.intensity=T.MathUtils.lerp(.36,.78,track);
    }
    key.intensity=2.6;
    if(scene.fog)scene.fog.density=T.MathUtils.lerp(.00055,.00020,track);
  }
  const visible=object=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
  function beforeRenderJ(alpha){
    if(!enabled||!ready||!key)return;
    camera.updateMatrixWorld();const center=key.target.position.clone(),projection=new T.Vector3(),candidates=[];
    if(reflection){const heading=(reflectionRoots.find(root=>root.visible)?.rotation.y||0)-reflectionHeading;window.F1GlobalJ.setHeading(heading);for(const[m,p]of surfaces)if(reflective(p.family))m.envMapRotation.set(0,heading,0);}
    for(const actor of actors){
      actor.anchor.getWorldPosition(actor.position);
      if(!visible(actor.anchor))continue;
      projection.copy(actor.position).project(camera);
      if(Math.abs(projection.x)<1.3&&Math.abs(projection.y)<1.3&&projection.z> -1&&projection.z<1)candidates.push({actor,score:projection.x*projection.x+projection.y*projection.y});
    }
    if(!window.F1SurfaceJ.shadowCenter(center,alpha)&&alpha>.05&&candidates.length){
      candidates.sort((a,b)=>a.score-b.score);const primary=candidates[0].actor.position;center.set(0,0,0);let n=0;
      for(const {actor}of candidates)if(actor.position.distanceToSquared(primary)<24*24){center.add(actor.position);n++;}
      center.multiplyScalar(1/Math.max(1,n));center.y=0;
    }
    window.F1SurfaceJ.alignShadow(center,direction.value);
    let casting=0;
    for(const actor of actors){
      const near=visible(actor.anchor)&&(window.F1SurfaceJ.openingShadows||actor.position.distanceToSquared(center)<37*37);
      for(const item of actor.meshes){item.mesh.castShadow=alpha>.001?near&&item.opaque:item.cast;item.mesh.receiveShadow=true;if(item.mesh.castShadow)casting++;}
    }
    counts.shadowCarMeshes=casting;counts.shadowFocus=center.toArray();
  }
  const scratch={};let lastReflectionHeading=null;
  function beforeRender(alpha){
    if(!window.F1ParallelK.enabled){lastReflectionHeading=null;return beforeRenderJ(alpha);}
    if(!enabled||!ready||!key)return;
    if(!scratch.center){scratch.center=new T.Vector3();scratch.projection=new T.Vector3();scratch.candidates=[];}
    camera.updateMatrixWorld();const center=scratch.center.copy(key.target.position),projection=scratch.projection,candidates=scratch.candidates;candidates.length=0;
    if(reflection){const heading=(reflectionRoots.find(root=>root.visible)?.rotation.y||0)-reflectionHeading;window.F1GlobalJ.setHeading(heading);
      if(heading!==lastReflectionHeading){for(const[m,p]of surfaces)if(reflective(p.family))m.envMapRotation.set(0,heading,0);lastReflectionHeading=heading;}
    }
    for(const actor of actors){actor.anchor.getWorldPosition(actor.position);if(!visible(actor.anchor))continue;projection.copy(actor.position).project(camera);
      if(Math.abs(projection.x)<1.3&&Math.abs(projection.y)<1.3&&projection.z>-1&&projection.z<1){actor.score=projection.x*projection.x+projection.y*projection.y;candidates.push(actor);}}
    if(!window.F1SurfaceJ.shadowCenter(center,alpha)&&alpha>.05&&candidates.length){candidates.sort((a,b)=>a.score-b.score);const primary=candidates[0].position;center.set(0,0,0);let n=0;
      for(const actor of candidates)if(actor.position.distanceToSquared(primary)<24*24){center.add(actor.position);n++;}center.multiplyScalar(1/Math.max(1,n));center.y=0;
    }
    window.F1SurfaceJ.alignShadow(center,direction.value);let casting=0;
    for(const actor of actors){const near=visible(actor.anchor)&&(window.F1SurfaceJ.openingShadows||actor.position.distanceToSquared(center)<37*37);
      for(const item of actor.meshes){item.mesh.castShadow=alpha>.001?near&&item.opaque:item.cast;item.mesh.receiveShadow=true;if(item.mesh.castShadow)casting++;}}
    counts.shadowCarMeshes=casting;counts.shadowFocus??=[0,0,0];center.toArray(counts.shadowFocus);
  }
  function state(){return{enabled,ready,three:T?.REVISION,method:'PBR clearcoat / stable PCSS / depth contact AO',families,...counts,
    shadowMap:key?.shadow.mapSize.toArray(),shadowType:renderer?.shadowMap.type,exposure:renderer?.toneMappingExposure,environmentIntensity:scene?.environmentIntensity,
    materialSamples:[...surfaces].filter(([,p])=>['car-paint','car-carbon','building-glass','building-metal','building-concrete'].includes(p.family)).slice(0,24).map(([m,p])=>({name:m.name,family:p.family,type:m.type,...read(m),transparent:m.transparent,alphaTest:m.alphaTest})),
    compositor:window.__F1LightComposite,colorGrade:{saturation:1.09,contrast:1.035,daylightFog:.00020},changedCamera:false,changedActors:false};}
  return{setup,upgradeCar,prepareArchitecture,bakeReflections,refreshScene(){collectMeshes();setEnabled(enabled);},setEnabled,frame,beforeRender,state,get enabled(){return enabled;}};
})();

(()=>{
 const light=window.F1LightStudy,setup=light.setup,prepare=light.prepareArchitecture,frame=light.frame,toggle=light.setEnabled;
 light.setup=function(...args){setup(...args);window.F1SurfaceJ.setup(args[0],args[1],args[2],args[4][0]);window.F1GlobalJ.setup(args[0],args[1],args[2]);window.F1MaterialJ.setup(args[0],args[1],args[2],args[4][0]);window.F1LiveJ?.setup(args[1]);};
 light.prepareArchitecture=function(...args){prepare(...args);window.F1SurfaceJ.prepareRoad();};
 light.frame=function(alpha,main){
  frame(alpha,main);
  window.F1MaterialJ.frame(alpha);
  window.F1GlobalJ.frame(alpha,light.enabled,window.F1MaterialJ.daylightWeight.value);
 };
 light.setEnabled=function(value){
  if(!value)window.F1MaterialJ.setEnabled(false);
  toggle(value);
  if(value)window.F1MaterialJ.setEnabled(true);
  window.F1GlobalJ.frame(window.F1GlobalJ.state().track,light.enabled,window.F1MaterialJ.daylightWeight.value);
 };
})();
