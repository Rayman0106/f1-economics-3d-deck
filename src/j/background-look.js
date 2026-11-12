/* Background-only look development. Original meshes, motion and camera remain
   owned by the approved deck. A/B changes only materials and illumination. */
window.F1Background = (() => {
  const trackRoots=[];const pairs=new Map();const families={};
  let T,renderer,scene,sky,baseline,improved,daylight,dayWeight=-1,lights=[],mode='H',prepared=false;
  const uniform={value:1};
  function registerTrack(THREE,render,root){T=THREE;renderer=render;trackRoots.push(root);}
  function detail(material,family,amount=.08){
    const previous=material.onBeforeCompile;
    material.onBeforeCompile=function(shader,render){
      previous.call(this,shader,render);
      shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
        varying vec3 vBgWorld;`).replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 bgPosition=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          bgPosition=instanceMatrix*bgPosition;
        #endif
        vBgWorld=(modelMatrix*bgPosition).xyz;`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        varying vec3 vBgWorld;
        float bgHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float bgNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
          return mix(mix(bgHash(i),bgHash(i+vec2(1.,0.)),f.x),mix(bgHash(i+vec2(0.,1.)),bgHash(i+vec2(1.,1.)),f.x),f.y);}
      `).replace('#include <map_fragment>',`#include <map_fragment>
        float bgMacro=bgNoise(vBgWorld.xz*.045)*.65+bgNoise(vBgWorld.xz*.013)*.35;
        diffuseColor.rgb*=1.0+(bgMacro-.5)*${amount.toFixed(3)};
        ${family==='grass'?`
          #ifdef USE_MAP
            vec2 bgSecondUV=mat2(.7193,-.6947,.6947,.7193)*vMapUv*.483+vec2(.317,.713);
            vec3 bgSecond=texture2D(map,bgSecondUV).rgb;
            diffuseColor.rgb=mix(diffuseColor.rgb,bgSecond,.40);
          #endif
          float bgLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          vec3 bgGreen=vec3(.038,.090,.028)*(.85+bgLuma*2.4);
          diffuseColor.rgb=mix(diffuseColor.rgb,bgGreen,.9);`:''}
      `);
    };
    material.customProgramCacheKey=()=>`monza-bg-v1-${family}`;
  }
  function add(original,family,configure){
    if(pairs.has(original))return pairs.get(original).enhanced;
    const enhanced=original.clone();enhanced.name=original.name+' / background B';
    configure(enhanced);enhanced.needsUpdate=true;
    const pair={original,enhanced,family};pairs.set(original,pair);pairs.set(enhanced,pair);
    families[family]=(families[family]||0)+1;return enhanced;
  }
  function readTexture(file,repeat,color=false){
    return new T.TextureLoader().loadAsync(window.F1BackgroundAssets('/look-assets/'+file)).then(map=>{
      map.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
      map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(repeat,repeat);
      map.anisotropy=renderer.capabilities.getMaxAnisotropy();
      map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;
      return map;
    });
  }
  async function prepare(THREE,render,world,root,visibleSky,hemi,road){
    T=THREE;renderer=render;scene=world;sky=visibleSky;
    baseline={environment:scene.environment,environmentIntensity:scene.environmentIntensity,
      background:scene.background,backgroundIntensity:scene.backgroundIntensity,
      backgroundRotation:scene.backgroundRotation?.clone(),environmentRotation:scene.environmentRotation?.clone(),
      skyMaterialVisible:sky.material.visible,skyTransparent:sky.material.transparent,skyDepthTest:sky.material.depthTest,
      fogDensity:scene.fog?.density,fogColor:scene.fog?.color.clone()};
    scene.traverse(o=>{if(o.isLight)lights.push({light:o,intensity:o.intensity,color:o.color.clone(),ground:o.groundColor?.clone()});});
    const roadScale=1/(.13*2.1),grassScale=2400/2;
    const [roadMap,roadNormal,roadRough,grassMap,grassNormal,grassRough]=await Promise.all([
      readTexture('asphalt-color.jpg',roadScale,true),readTexture('asphalt-normal.jpg',roadScale),readTexture('asphalt-rough.jpg',roadScale),
      readTexture('grass-color.jpg',grassScale,true),readTexture('grass-normal.jpg',grassScale),readTexture('grass-rough.jpg',grassScale)
    ]);
    const HDRLoader=window.createF1HDRLoader(T),hdr=await new HDRLoader().setDataType(T.FloatType).loadAsync(window.F1BackgroundAssets("/look-assets/daylight.hdr"));
    hdr.mapping=T.EquirectangularReflectionMapping;
    const generator=new T.PMREMGenerator(renderer);generator.compileEquirectangularShader();
    const env=generator.fromEquirectangular(hdr);generator.dispose();
    // Locate the sun above the horizon. The previous comparison excluded the
    // top 30 percent of the image, including this capture's 48-degree sun.
    const pixels=hdr.image.data,width=hdr.image.width,height=hdr.image.height,channels=pixels.length/(width*height);
    let largest=0,brightX=0,sunLuma=0,sunX=0,sunY=0;
    const oldCut=Math.floor(height*.3),azimuth=Math.atan2(.78,.62);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const k=(y*width+x)*channels,l=.2126*pixels[k]+.7152*pixels[k+1]+.0722*pixels[k+2];
      if(y>=oldCut&&l>largest){largest=l;brightX=x;}
      if(y<height/2&&l>sunLuma){sunLuma=l;sunX=x;sunY=y;}
    }
    const sourceAzimuth=(brightX/width-.5)*Math.PI*2;
    const elevation=(.5-(sunY+.5)/height)*Math.PI;
    const skyRotation=azimuth-((sunX+.5)/width-.5)*Math.PI*2;
    window.F1MaterialJ.retainSky(hdr,-skyRotation);
    improved={environment:env.texture,rotation:azimuth-sourceAzimuth};
    daylight={rotation:skyRotation,elevation,slope:Math.tan(elevation),sunPixel:[sunX,sunY],
      sun:new T.Color(0xfff2dc),sky:new T.Color(0xe0e9f2),ground:new T.Color(0xa6a08e),haze:new T.Color(0xa9c1d5)};
    for(const track of trackRoots)track.traverse(o=>{
      if(!o.isMesh||!o.material?.isMeshStandardMaterial)return;
      const name=o.name;
      if(name==='Fine_asphalt'||name.startsWith('Runoff_'))add(o.material,'asphalt',m=>{
        m.color.setHex(name==='Fine_asphalt'?0xe4e6e8:0xc4c8c4);m.map=roadMap;m.normalMap=roadNormal;m.normalScale.set(.18,.18);
        m.roughnessMap=roadRough;m.roughness=.92;m.bumpMap=null;m.bumpScale=0;detail(m,'asphalt',.07);
      });
      else if(name==='Grass_infield')add(o.material,'grass',m=>{
        m.color.setHex(0xffffff);m.map=grassMap;m.normalMap=grassNormal;m.normalScale.set(.09,.09);
        m.roughnessMap=grassRough;m.roughness=1;detail(m,'grass',.28);
      });
      else if(/Concrete_wall|Wall_panel/.test(name))add(o.material,'concrete',m=>{m.color.setHex(0xb7b8b5);m.roughness=.9;detail(m,'concrete',.09);});
      else if(/Safety_rail|Fence_posts|Lighting_poles/.test(name))add(o.material,'track-metal',m=>{m.color.setHex(0x989d9f);m.metalness=.62;m.roughness=.38;m.envMapIntensity=.85;});
      else if(/Bevelled_kerbs|Edge_line|Pit_entry_dashes/.test(name))add(o.material,'paint',m=>{m.roughness=.76;m.envMapIntensity=.35;});
    });
    root.traverse(o=>{
      if(!o.isMesh)return;
      for(const material of Array.isArray(o.material)?o.material:[o.material]){
        if(!material?.isMeshStandardMaterial||pairs.has(material))continue;
        const name=material.name.toLowerCase();
        if(name.includes('glass'))add(material,'glass',m=>{m.roughness=.13;m.metalness=0;m.envMapIntensity=1.1;});
        else if(name.startsWith('metals'))add(material,'architecture-metal',m=>{m.roughness=.46;m.metalness=.42;m.envMapIntensity=.85;});
        else if(/wall|gstand|box|paddk/.test(name))add(material,'architecture',m=>{m.roughness=.86;m.metalness=0;m.envMapIntensity=.55;detail(m,'architecture',.055);});
        else if(/Grandstand_steps|Grandstand_stairs|gstand_structure/.test(o.name))add(material,'concrete',m=>{m.color.setHex(0xaaa9a3);m.roughness=.9;detail(m,'concrete',.065);});
        else if(/Irregular_broadleaf|Layered_pine|Verge_shrubs/.test(o.name))add(material,'foliage',m=>{m.color.setHex(0xb1c39a);m.roughness=.93;m.envMapIntensity=.45;});
      }
    });
    await window.F1DetailLayer.prepare(THREE,renderer,scene,root,trackRoots,{pairs});
    await window.F1StructureLayer.prepare(THREE,renderer,scene,root,road,{pairs,trackRoots});
    await window.F1RefineLayer.prepare(THREE,renderer,scene,root,road,{pairs,trackRoots});
    await window.F1GroundLayer.prepare(THREE,renderer,scene,root,road,{pairs,trackRoots});
    await window.F1ParkLayer.prepare(THREE,renderer,scene,root,road,{pairs,sky,skyRotation:daylight.rotation,vergeColor:grassMap});
    prepared=true;setLook(mode);
    window.F1LightStudy.prepareArchitecture(THREE,renderer,scene,root,pairs);
  }
  function setLook(value){
    mode=['A','B','C','D','E','F','H'].includes(value)?value:'H';if(!prepared)return;const baseMode=mode==='H'?'F':mode;
    scene.traverse(o=>{
      if(!o.isMesh||!o.material)return;
      const swap=m=>{const local=window.F1ParkLayer.materialFor(o,mode)||window.F1GroundLayer.materialFor(o,baseMode)||window.F1RefineLayer.materialFor(o,baseMode);if(local)return local;const pair=pairs.get(m);return pair?(mode==='A'?pair.original:mode==='H'?(pair.parked||pair.grounded||pair.refined||pair.structured||pair.detailed||pair.enhanced):mode==='F'?(pair.grounded||pair.refined||pair.structured||pair.detailed||pair.enhanced):mode==='E'?(pair.refined||pair.structured||pair.detailed||pair.enhanced):mode==='D'?(pair.structured||pair.detailed||pair.enhanced):mode==='C'?(pair.detailed||pair.enhanced):pair.enhanced):m;};
      o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material);
    });
    dayWeight=-1;
    for(const {light,intensity,color,ground} of lights){
      light.color.copy(color);light.intensity=intensity;
      if(ground)light.groundColor.copy(ground);
      if(mode!=='A'){
        if(light.isAmbientLight)light.intensity=.12;
        else if(light.isHemisphereLight)light.intensity=intensity*.65;
        else if(light.isDirectionalLight)light.intensity=intensity>2?2.6:intensity*.62;
      }
    }
    scene.environment=mode==='A'?baseline.environment:improved.environment;
    scene.environmentIntensity=mode==='A'?baseline.environmentIntensity:.5;
    // Long-lens shots magnify a tiny crop of the sky. Keep the clean visible
    // dome; the 1K HDR is used only for diffuse illumination and reflections.
    scene.background=baseline.background;
    scene.backgroundIntensity=baseline.backgroundIntensity;
    sky.material.visible=baseline.skyMaterialVisible;
    // A transparent sky dome renders after opaque scenery and, with opacity
    // 1, paints over trees beyond its 850 m radius. Render E's unchanged sky
    // texture first as an opaque, depth-free background instead.
    const transparent=['E','F','H'].includes(mode)?false:baseline.skyTransparent,depthTest=['E','F','H'].includes(mode)?false:baseline.skyDepthTest;
    if(sky.material.transparent!==transparent||sky.material.depthTest!==depthTest){sky.material.transparent=transparent;sky.material.depthTest=depthTest;sky.material.needsUpdate=true;}
    if(scene.environmentRotation)scene.environmentRotation.copy(mode==='A'?baseline.environmentRotation:new T.Euler(0,improved.rotation,0));
    if(scene.backgroundRotation)scene.backgroundRotation.copy(baseline.backgroundRotation);
    if(scene.fog){scene.fog.color.copy(baseline.fogColor);scene.fog.density=baseline.fogDensity;}
    frameLighting(1);
    window.F1StructureLayer?.setMode(baseMode);window.F1RefineLayer?.setMode(baseMode);window.F1GroundLayer?.setMode(baseMode);window.F1ParkLayer?.setMode(mode);
    document.documentElement.dataset.backgroundLook=mode;
  }
  function frameLighting(alpha,key){
    if(mode!=='H'||!prepared)return;
    const t=T.MathUtils.clamp(alpha,0,1),mix=T.MathUtils.lerp;
    if(t!==dayWeight){
      for(const {light,intensity,color,ground} of lights){
        light.color.copy(color);
        if(light.isAmbientLight)light.intensity=mix(.12,.045,t);
        else if(light.isHemisphereLight){
          light.intensity=mix(intensity*.65,.62,t);light.color.lerp(daylight.sky,t);
          light.groundColor.copy(ground).lerp(daylight.ground,t);
        }else if(light.isDirectionalLight){
          light.intensity=mix(intensity>2?2.6:intensity*.62,light.castShadow?2.18:0,t);
          if(light.castShadow)light.color.lerp(daylight.sun,t);
        }
      }
      scene.environmentIntensity=mix(.50,.36,t);
      if(scene.environmentRotation)scene.environmentRotation.y=mix(improved.rotation,-daylight.rotation,t);
      if(scene.fog)scene.fog.color.copy(baseline.fogColor).lerp(daylight.haze,t);
      dayWeight=t;
    }
    if(scene.fog)scene.fog.density=mix(baseline.fogDensity,.00039,t);
    if(key){
      const target=key.target.position,p=key.position,distance=Math.hypot(p.x-target.x,p.z-target.z);
      // K prototype may lower the key; it falls back to the HDR sun elevation.
      const slope=window.F1LookK?window.F1LookK.sunSlope(daylight.slope):daylight.slope;
      p.y=mix(p.y,target.y+distance*slope,t);
    }
  }
  return {registerTrack,prepare,setLook,frameLighting,get mode(){return mode;},state(){return{mode,prepared,families,detail:window.F1DetailLayer.state(),structure:window.F1StructureLayer.state(),refine:window.F1RefineLayer.state(),ground:window.F1GroundLayer.state(),park:window.F1ParkLayer.state(),lighting:daylight&&{sunPixel:daylight.sunPixel,elevationDegrees:T.MathUtils.radToDeg(daylight.elevation),skyRotation:daylight.rotation,weight:dayWeight,fog:scene.fog?.density},textureSources:['clean_asphalt','leafy_grass','kloofendal_48d_partly_cloudy_puresky'],motionModified:false};}};
})();
