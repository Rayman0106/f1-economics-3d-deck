/* D: shallow, inset architectural completion and stable shot-wide decluttering. */
window.F1StructureLayer=(()=>{
  let T,pairs,root,track,world,lastCamera,mode='D',shot='opening';const quiet=[];const counts={};const extraRoofSources=new Set();
  function copy(m){const clone=m.clone();clone.onBeforeCompile=m.onBeforeCompile;clone.customProgramCacheKey=m.customProgramCacheKey.bind(m);return clone;}
  function register(pair){for(const m of new Set([pair.original,pair.enhanced,pair.detailed,pair.structured]))pairs.set(m,pair);return pair;}
  function fork(mesh){
    const old=pairs.get(mesh.material)||{original:mesh.material,enhanced:mesh.material,detailed:mesh.material};
    const pair={original:copy(old.original),enhanced:copy(old.enhanced),detailed:copy(old.detailed||old.enhanced),structured:copy(old.detailed||old.enhanced),family:'structure-control'};
    register(pair);mesh.material=pair.detailed;return pair;
  }
  function onlyD(material){const hidden=copy(material);hidden.visible=false;register({original:hidden,enhanced:hidden,detailed:hidden,structured:material,family:'building-interior'});return material;}
  function addSurface(section,tile,label,profile,material){
    const vertices=[],indices=[],count=Math.max(2,Math.ceil((section.end-section.start)/2)),offset=tile*520;
    for(let row=0;row<=count;row++){
      const station=section.start+(section.end-section.start)*row/count+offset;
      for(const [lateral,height]of profile){const p=track.lane(station,lateral,height);vertices.push(p.x,p.y,p.z);}
    }
    for(let row=0;row<count;row++){const a=row*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new T.Mesh(geometry,material);mesh.name=`Imported_Monza_interior_${label}_${section.column}_1_tile${tile}`;
    mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.receiveShadow=false;mesh.castShadow=false;root.add(mesh);
    counts.interiorSurfaces=(counts.interiorSurfaces||0)+1;
  }
  function innerMaterial(color){
    return onlyD(new T.MeshStandardMaterial({name:'Inset pit interior D',color,roughness:.96,metalness:0,envMapIntensity:.25,side:T.DoubleSide}));
  }
  function interiors(plan){
    const back=innerMaterial(0x354249),floor=innerMaterial(0x51595b),ceiling=innerMaterial(0x697274);
    for(let tile=-1;tile<3;tile++)for(const section of plan.sections){
      // Inset from the actual facade; do not enclose an AABB around railings.
      const front=section.front+1.25,rear=Math.max(front+.7,section.back-.8),top=section.top-.22;
      addSurface(section,tile,'back',[ [rear,-.35],[rear,top] ],back);
      addSurface(section,tile,'ceiling',[ [front,top],[rear,top] ],ceiling);
      for(let height=2.8;height<top-.8;height+=2.8)addSurface(section,tile,'floor'+Math.round(height*10),[[front,height],[rear,height]],floor);
    }
    counts.buildingSections=plan.sections.length*4;
  }
  function compressWireContrast(material){
    const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,render){previous.call(this,shader,render);
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.30,.36,.38),.14);`);
    };material.customProgramCacheKey=()=>key+'-quiet-wire-D';
  }
  async function prepare(THREE,renderer,scene,scenery,road,registry){
    T=THREE;world=scene;root=scenery;track=road;pairs=registry.pairs;
    const plan=await fetch(window.F1BackgroundAssets("/structure-assets/architecture-plan.json")).then(r=>r.json());
    const roofNames=new Set(plan.quietBudgetRoofMeshes);
    const meshes=[];root.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material))meshes.push(o);});
    for(const mesh of meshes){
      const base=mesh.name.replace(/_tile-?\d+$/,'');
      if(roofNames.has(base)){
        const pair=fork(mesh);quiet.push({material:pair.structured,shots:new Set(['costs'])});counts.quietRoofMeshes=(counts.quietRoofMeshes||0)+1;
      }else if(/^Imported_Monza_fences/.test(mesh.name)){
        const pair=fork(mesh);compressWireContrast(pair.structured);counts.wireMeshes=(counts.wireMeshes||0)+1;
      }
    }
    for(const roadRoot of registry.trackRoots)roadRoot.traverse(mesh=>{
      if(mesh.isMesh&&mesh.name.startsWith('Catch_fence_')){
        const pair=fork(mesh);quiet.push({material:pair.structured,shots:new Set(['opening'])});
        counts.openingDuplicateFenceMeshes=(counts.openingDuplicateFenceMeshes||0)+1;
      }
    });
    interiors(plan);setMode(mode);
    const floor=registry.trackRoots[0].getObjectByName('Fine_asphalt'),before=floor.onBeforeRender;
    floor.onBeforeRender=function(...args){before.apply(this,args);if(args[2]?.isPerspectiveCamera)lastCamera=args[2];};
    const rules=await fetch(window.F1BackgroundAssets("/structure-assets/visual-rules.json"),{cache:'no-store'}).then(r=>r.json());
    for(const name of rules.budgetRoofSources||[])suppressRoof(name,false);
  }
  function setMode(value){mode=value;for(const entry of quiet)entry.material.visible=!(['D','E','F'].includes(mode)&&entry.shots.has(shot));}
  function frame(kind){shot=kind;setMode(mode);window.F1RefineLayer?.frame(kind);window.F1GroundLayer?.frame(kind);window.F1ParkLayer?.frame(kind);}
  function inspectRoof(){
    if(!lastCamera)return{error:'Render a world scene first'};
    const candidates=[],point=new T.Vector3();world.updateMatrixWorld(true);
    world.traverse(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh||!/^Imported_Monza_/.test(mesh.name)||mesh.name.includes('_interior_')||mesh.material.visible===false)return;
      for(let p=mesh;p;p=p.parent)if(!p.visible)return;
      const positions=mesh.geometry.attributes.position,matrix=lastCamera.projectionMatrix.clone().multiply(lastCamera.matrixWorldInverse).multiply(mesh.matrixWorld);let hits=0,maximum=-10;
      for(let k=0;k<positions.count;k++){
        point.fromBufferAttribute(positions,k).applyMatrix4(matrix);
        if(point.z>-1&&point.z<1&&Math.abs(point.x)<1.1&&point.y>.15&&point.y<.37){hits++;maximum=Math.max(maximum,point.y);}
      }
      if(hits)candidates.push({name:mesh.name,verticesInRoofBand:hits,highestNdcY:maximum,material:mesh.material.name});
    });
    return{shot,bandNdc:[.15,.37],candidates:candidates.sort((a,b)=>b.verticesInRoofBand-a.verticesInRoofBand).slice(0,30)};
  }
  function suppressRoof(name,refresh=true){
    const base=name.replace(/_tile-?\d+$/,'');if(extraRoofSources.has(base))return;
    extraRoofSources.add(base);
    const meshes=[];world.traverse(mesh=>{if(mesh.isMesh&&mesh.name.replace(/_tile-?\d+$/,'')===base)meshes.push(mesh);});
    for(const mesh of meshes){const pair=fork(mesh);quiet.push({material:pair.structured,shots:new Set(['costs'])});}
    setMode(mode);if(refresh)window.F1Background.setLook(mode);
  }
  return{prepare,setMode,frame,getCamera:()=>lastCamera,inspectRoof,suppressRoof,state:()=>({...counts,mode,shot,extraRoofSources:[...extraRoofSources],fogChanged:false,sceneryOnly:true})};
})();
