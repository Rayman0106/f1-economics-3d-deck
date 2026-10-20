/* Runtime surface finish. Original geometry, UVs and livery stay intact. */
function f1FixMetalMaterials(THREE,root,renderer){
  const seen=new Set();
  const textures=new Set(),anisotropy=renderer?.capabilities.getMaxAnisotropy()||16;
  root.traverse(object=>{
    if(!object.isMesh)return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      for(const value of Object.values(material))if(value?.isTexture&&!textures.has(value)){
        textures.add(value);value.anisotropy=anisotropy;
        if(!value.isCompressedTexture){value.generateMipmaps=true;value.minFilter=THREE.LinearMipmapLinearFilter;value.magFilter=THREE.LinearFilter;}
        value.needsUpdate=true;
      }
      if(seen.has(material)||material.userData.f1SurfaceProfile)continue;
      seen.add(material);
      material.fog=false;const name=material.name.toLowerCase();let family='original',floor=0;
      if(/sidewall|tyre|tire_|tread/.test(name)){
        family='rubber';material.metalness=0;material.roughness=/tread/.test(name)?.94:.86;material.envMapIntensity=.25;floor=.76;
      }else if(/carbon|black_s|cockpit_black|plastic|negro|^black(?:\.|$)/.test(name)){
        family='carbon';material.metalness=0;material.roughness=.48;material.envMapIntensity=.72;floor=.32;
        if(material.isMeshPhysicalMaterial){material.clearcoat=.16;material.clearcoatRoughness=.38;}
      }else if(/paint|chasis|chassis|(?:^|_)body(?:\.|$)/.test(name)){
        family='paint';material.metalness=Math.min(material.metalness,.22);material.roughness=.34;material.envMapIntensity=.95;floor=.24;
        if(material.isMeshPhysicalMaterial){material.clearcoat=.55;material.clearcoatRoughness=.23;material.ior=1.5;}
      }else if(/decal|number_/.test(name)){
        family='decal';material.metalness=0;material.roughness=.48;material.envMapIntensity=.65;floor=.32;
        // Authored decals sit only fractions of a millimetre off the body.
        // Preserve MASK/OPAQUE semantics and UVs, but give the overlay a stable
        // depth separation under long telephoto views instead of z-fighting.
        material.polygonOffset=true;material.polygonOffsetFactor=-1;material.polygonOffsetUnits=-2;
        if(material.alphaTest>0)material.alphaToCoverage=true;
      }else if(/wheel_hub|chrome|mirror|^details$/.test(name)){
        family='metal';material.metalness=/mirror/.test(name)?.95:.78;material.roughness=/mirror/.test(name)?.12:.3;material.envMapIntensity=.9;floor=/mirror/.test(name)?.08:.22;
      }else if(/discs/.test(name)){
        family='brake';material.metalness=.12;material.roughness=.72;floor=.6;
      }
      material.userData.f1SurfaceProfile={version:23,family,nativeTransparent:material.transparent,nativeOpacity:material.opacity,nativeAlphaTest:material.alphaTest};
      if(/^details$/i.test(name))material.userData.f1NeutralMetal=true;
      const before=material.onBeforeCompile,cache=material.customProgramCacheKey;
      material.onBeforeCompile=function(shader,renderer){
        before.call(this,shader,renderer);
        if(floor)shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
          '#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,'+floor.toFixed(3)+');');
        if(/^details$/i.test(name))shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\ndiffuseColor.rgb=vec3(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)));');
      };
      material.customProgramCacheKey=function(){return cache.call(this)+'-surface-p23-'+family;};
      material.needsUpdate=true;
    }
  });
}
