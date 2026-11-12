/* E: visual composition fixes and denser, layered scenery. No actor/camera edits. */
window.F1RefineLayer=(()=>{
  let T,renderer,world,root,road,pairs,mode='E',shot='opening',plan={};
  const controlled=new Map(),byName=new Map(),counts={},leafGeometries=new Map(),treeGeometryNames=new Map(),tailBuffers=new Map(),fixedTailBounds=new WeakSet();let geometryMode='';
  function copy(m){const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey.bind(m);return c;}
  function onlyE(material){const hidden=copy(material);hidden.visible=false;const pair={original:hidden,enhanced:hidden,detailed:hidden,structured:hidden,refined:material};for(const m of[hidden,material])pairs.set(m,pair);return material;}
  function fork(mesh){
    if(controlled.has(mesh))return controlled.get(mesh);
    const p=pairs.get(mesh.material)||{original:mesh.material,enhanced:mesh.material};
    const pair={...p,refined:copy(p.structured||p.detailed||p.enhanced)};
    for(const m of new Set([pair.original,pair.enhanced,pair.detailed,pair.structured,pair.refined].filter(Boolean)))pairs.set(m,pair);
    mesh.material=pair.refined;controlled.set(mesh,pair);byName.set(mesh.name,pair);return pair;
  }
  function visible(mesh){for(let p=mesh;p;p=p.parent)if(!p.visible)return false;return true;}
  function inspect(points){
    const camera=window.F1StructureLayer.getCamera();if(!camera)return{error:'No rendered camera'};
    world.updateMatrixWorld(true);const ray=new T.Raycaster(),objects=[];
    world.traverse(o=>{if(o.isMesh&&visible(o)&&!Array.isArray(o.material)&&o.material.visible!==false)objects.push(o);});
    const forest=[];for(const mesh of objects)if(mesh.name.includes('forest_E')&&mesh.name.includes('_leaves_')){
      let alive=0;const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),scale=new T.Vector3();let nearest=null;
      for(let k=0;k<mesh.count;k++){mesh.getMatrixAt(k,matrix);matrix.decompose(p,q,scale);if(scale.x<.01)continue;alive++;const point=p.clone().add(new T.Vector3(0,scale.y*.55,0)),ndc=point.clone().project(camera),score=Math.hypot(ndc.x,ndc.y);if(!nearest||score<nearest.score)nearest={score,position:point.toArray(),ndc:ndc.toArray(),distance:point.distanceTo(camera.position)};}
      forest.push({name:mesh.name,materialVisible:mesh.material.visible,visible:visible(mesh),alive,count:mesh.count,nearest});
    }
    const grass=world.getObjectByName('Grass_infield');
    return {shot,mode,park:window.F1ParkLayer.state(),ground:window.F1GroundLayer.inspect(camera),camera:{position:camera.position.toArray(),far:camera.far,near:camera.near,fov:camera.fov},forest:forest.sort((a,b)=>(a.nearest?.score??Infinity)-(b.nearest?.score??Infinity)).slice(0,16),grass:{name:grass?.material.name,map:grass?.material.map?.image?.src,key:grass?.material.customProgramCacheKey()},points:points.map(([u,v])=>{
      ray.setFromCamera(new T.Vector2(u*2-1,1-v*2),camera);
      const hits=ray.intersectObjects(objects,false).slice(0,14).map(h=>({name:h.object.name,distance:h.distance,point:h.point.toArray(),material:h.object.material.name,face:h.faceIndex,instance:h.instanceId}));
      return{u,v,hits};
    }),state:counts};
  }
  async function texture(file,color=false){const m=await new T.TextureLoader().loadAsync(window.F1BackgroundAssets('/structure-assets/'+file));m.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;m.wrapS=m.wrapT=T.RepeatWrapping;m.anisotropy=renderer.capabilities.getMaxAnisotropy();return m;}
  async function turf(trackRoots){
    const [color,normal,rough]=await Promise.all([texture('turf-color.jpg',true),texture('turf-normal.jpg'),texture('turf-rough.jpg')]);
    for(const map of[color,normal,rough])map.repeat.setScalar(2400/1.4);
    for(const roadRoot of trackRoots){
      const mesh=roadRoot.getObjectByName('Grass_infield'),pair=fork(mesh),m=pair.refined;
      // Use the authored short-grass albedo. Do not replace 90% of its values
      // with one green colour: that destroyed the actual blade/soil contrast.
      m.onBeforeCompile=shader=>{
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 turfWorld;').replace('#include <begin_vertex>','#include <begin_vertex>\nturfWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          varying vec3 turfWorld;
          float turfHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float turfNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(turfHash(i),turfHash(i+vec2(1.,0.)),f.x),mix(turfHash(i+vec2(0.,1.)),turfHash(i+vec2(1.,1.)),f.x),f.y);}
        `).replace('#include <map_fragment>',`#include <map_fragment>
          float soil=turfNoise(turfWorld.xz*.09),broad=turfNoise(turfWorld.xz*.014);
          vec3 turfTint=mix(vec3(.77,.84,.59),vec3(.93,.98,.85),smoothstep(.18,.78,soil));
          diffuseColor.rgb*=turfTint*(.84+.26*broad);
        `);
      };m.customProgramCacheKey=()=> 'monza-turf-E-2';m.map=color;m.normalMap=normal;m.normalScale.set(.32,.32);m.roughnessMap=rough;m.roughness=.98;m.color.setHex(0xffffff);m.envMapIntensity=.32;m.needsUpdate=true;
    }counts.grass='ambientCG Grass004 / 1.4 m / 2K albedo';
  }
  function instance(name,geometry,material,placements){
    const mesh=new T.InstancedMesh(geometry,material,placements.length),o=new T.Object3D();mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;
    placements.forEach((p,k)=>{o.position.copy(p.position);o.rotation.set(0,p.yaw||0,0);o.scale.setScalar(p.scale||1);o.updateMatrix();mesh.setMatrixAt(k,o.matrix);if(p.color)mesh.setColorAt(k,p.color);});
    mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.updateMatrix();root.add(mesh);return mesh;
  }
  function forest(){
    let seed=84519;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const templates=new Map();root.traverse(m=>{const hit=m.name.match(/^(Irregular_broadleaf|Layered_pine)_detail_(\d+)_(branches|leaves)_/);if(hit){if(!templates.has(hit[2]+hit[3]))templates.set(hit[2]+hit[3],m);if(hit[3]==='leaves')treeGeometryNames.set(m.name,{original:m.geometry,refined:denseLeaves(m.geometry)});}});
    const groups=Array.from({length:6},()=>[]);let id=200000;
    const landPoint=(s,l,y)=>{if(s>=-690)return road.lane(s,l,y);const h=road.heading(-690);return road.lane(-690,l,y).addScaledVector(new T.Vector3(-Math.cos(h),0,Math.sin(h)),s+690);};
    for(const side of[-1,1])for(let band=0;band<2;band++)for(let station=-1180;station<road.raceMetres+850;station+=band?25+random()*9:13+random()*7){
      const lateral=side*(band?138+random()*23:79+random()*12),height=band?12+random()*7:9.5+random()*5.5;
      const variant=random()<.16?4+id%2:id%4;
      groups[variant].push({position:landPoint(station,lateral,-.53),scale:height,yaw:random()*Math.PI*2,treeId:id++,color:new T.Color().setHSL(.24+random()*.035,.10,.76+random()*.10)});
    }
    // The opening lens looks past the end of the original road at x=700.
    // Complete that visible land with a grove inside the existing 1,100 m
    // far clip. Do not move the lens or alter the route to expose trees.
    let tailTrees=0;
    for(let x=825;x<1035;x+=24+random()*8)for(let z=-156;z<36;z+=13+random()*5){
      const height=8.6+random()*4.3,treeId=id++,variant=treeId%4;
      groups[variant].push({position:new T.Vector3(x+(random()-.5)*9,-.53,z+(random()-.5)*8),scale:height,yaw:random()*Math.PI*2,treeId,color:new T.Color().setHSL(.25+random()*.02,.10,.77+random()*.09)});tailTrees++;
    }counts.tailGroveTrees=tailTrees;
    for(let variant=0;variant<6;variant++){
      const cells=new Map();for(const p of groups[variant]){const key=Math.floor(p.position.x/100)+':'+Math.floor(p.position.z/100);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
      for(const part of['branches','leaves']){const src=templates.get(variant+part);if(!src)continue;const material=onlyE(copy(src.material));
        for(const [cell,items]of cells){const mesh=instance('Irregular_broadleaf_forest_E_'+variant+'_'+part+'_'+cell,part==='leaves'?denseLeaves(src.geometry):src.geometry,material,items);mesh.userData.treeIds=items.map(p=>p.treeId);if(items.every(p=>p.position.x>800)){mesh.userData.f1TailForest=true;tailBuffers.set(mesh.name,mesh.instanceMatrix.clone());}}
      }
    }counts.addedTrees=groups.reduce((n,p)=>n+p.length,0);counts.totalTrees=194+counts.addedTrees;counts.forestMinTrunkOffset=79;
  }
  function denseLeaves(original){
    if(leafGeometries.has(original))return leafGeometries.get(original);
    const g=original.clone(),p=g.attributes.position;
    // EZ-Tree leaf surfaces are quads. Enlarge each small authored cluster
    // around its own centre; tree roots/branches/whole canopy do not move.
    for(let k=0;k<p.count;k+=4){let x=0,y=0,z=0;for(let j=0;j<4;j++){x+=p.getX(k+j)/4;y+=p.getY(k+j)/4;z+=p.getZ(k+j)/4;}for(let j=0;j<4;j++)p.setXYZ(k+j,x+(p.getX(k+j)-x)*1.85,y+(p.getY(k+j)-y)*1.85,z+(p.getZ(k+j)-z)*1.85);}
    g.computeBoundingBox();g.computeBoundingSphere();leafGeometries.set(original,g);return g;
  }
  function cleanStands(){
    const backTemplate=root.getObjectByName('Far_Grandstand_detail_seat_backs'),cushionTemplate=root.getObjectByName('Far_Grandstand_detail_seat_cushions');
    const concrete=onlyE(new T.MeshStandardMaterial({color:0x9d9f95,roughness:.94,envMapIntensity:.3,side:T.DoubleSide}));
    const roofMat=onlyE(new T.MeshStandardMaterial({color:0xd0d2c9,roughness:.72,metalness:.12,envMapIntensity:.4}));
    const supportMat=onlyE(new T.MeshStandardMaterial({color:0x747d7f,roughness:.64,metalness:.22,envMapIntensity:.45}));
    const seatMat=onlyE(new T.MeshStandardMaterial({color:0xffffff,roughness:.67,envMapIntensity:.35}));
    const modules=[-570,-410,-250,-90,70];let seats=0;
    for(let module=0;module<modules.length;module++){
      const station=modules[module],yaw=road.heading(station),origin=road.lane(station,0,0);
      const point=(s,l,y)=>origin.clone().addScaledVector(new T.Vector3(-Math.cos(yaw),0,Math.sin(yaw)),s).addScaledVector(new T.Vector3(Math.sin(yaw),0,Math.cos(yaw)),l).setY(y);
      // One closed stepped solid, rather than separate long floating treads.
      const profile=[[-35,-.53],[-35,.26]];
      for(let row=0;row<11;row++){const side=-35-row*.94;profile.push([side,.26+row*.40],[side-.94,.26+row*.40]);if(row<10)profile.push([side-.94,.26+(row+1)*.40]);}
      profile.push([-45.34,-.53]);
      const shape=new T.Shape();profile.forEach(([l,y],i)=>i?shape.lineTo(l,y):shape.moveTo(l,y));shape.closePath();
      const g=new T.ExtrudeGeometry(shape,{depth:90,bevelEnabled:false,steps:1,curveSegments:1});
      const p=g.attributes.position;for(let k=0;k<p.count;k++){const v=point(p.getZ(k)-45,p.getX(k),p.getY(k));p.setXYZ(k,v.x,v.y,v.z);}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
      const body=new T.Mesh(g,concrete);body.name='Imported_Monza_cleanstand_body_'+module;body.matrixAutoUpdate=false;body.updateMatrix();root.add(body);
      const placements=[],backs=[];
      for(let row=0;row<11;row++)for(let col=0;col<90;col++){
        if([14,15,44,45,74,75].includes(col))continue;
        const s=-43.7+col*.98,l=-35.47-row*.94,y=.26+row*.4;
        const color=new T.Color((Math.floor(col/14)+row)%5===0?0xbfc6c5:(module+Math.floor(col/14))%2?0x5b7480:0x718b93);
        placements.push({position:point(s,l,y+.10),yaw,color});backs.push({position:point(s,l-.22,y+.39),yaw,color});seats++;
      }
      if(backTemplate&&cushionTemplate){instance('Imported_Monza_cleanstand_seats_'+module,backTemplate.geometry,seatMat,backs).userData.f1SceneryBlock=true;instance('Imported_Monza_cleanstand_cushions_'+module,cushionTemplate.geometry,seatMat,placements).userData.f1SceneryBlock=true;}
      const roof=new T.Mesh(new T.BoxGeometry(94,.23,13),roofMat);roof.position.copy(point(0,-40.2,6.4));roof.rotation.y=yaw;roof.name='Imported_Monza_cleanstand_canopy_'+module;roof.updateMatrix();roof.matrixAutoUpdate=false;root.add(roof);
      const supports=[];for(let s=-42;s<=42;s+=14)supports.push({position:point(s,-45.8,2.9),yaw});
      instance('Imported_Monza_cleanstand_supports_'+module,new T.CylinderGeometry(.105,.14,6.85,8),supportMat,supports);
    }counts.replacementStandModules=modules.length;counts.replacementStandSeats=seats;
  }
  function kindsFor(mesh){const source=mesh.name.replace(/_tile-?\d+$/,'');return plan.hiddenSources?.[source]||plan.hiddenProcedural?.[mesh.name]||Object.entries(plan.hiddenPrefixes||{}).find(([prefix])=>mesh.name.startsWith(prefix))?.[1]||[];}
  function setMode(value){mode=value;for(const [mesh,pair]of controlled){const kinds=kindsFor(mesh);pair.refined.visible=!(['E','F'].includes(mode)&&(kinds.includes('*')||kinds.includes(shot)));}if(geometryMode!==value){world?.traverse(mesh=>{const pair=treeGeometryNames.get(mesh.name);if(pair)mesh.geometry=['E','F'].includes(value)?pair.refined:pair.original;});geometryMode=value;}}
  async function reload(){
    plan=await fetch(window.F1BackgroundAssets("/structure-assets/refine-plan.json"),{cache:'no-store'}).then(r=>r.json());
    world.traverse(mesh=>{if(mesh.isMesh&&!Array.isArray(mesh.material)&&kindsFor(mesh).length)fork(mesh);});
    window.F1Background.setLook(mode);setMode(mode);
  }
  function frame(kind){if(window.F1ParallelK.enabled&&shot===kind)return;shot=kind;setMode(mode);}
  function postFrame(){
    if(!['E','F'].includes(mode))return;
    // This distant grove is beyond every original road/actor position. Native
    // route remapping clamps positions past the road end, so retain its real
    // world placement on both route representations rather than folding it
    // into a wall at x=700. Camera/car states are not involved.
    const visit=mesh=>{
      if(!mesh.userData.f1TailForest)return;const buffer=tailBuffers.get(mesh.name);if(buffer)mesh.instanceMatrix=buffer;
      if(!fixedTailBounds.has(mesh)){mesh.computeBoundingBox();mesh.computeBoundingSphere();fixedTailBounds.add(mesh);}
    };
    if(window.F1PerformanceJ.enabled)for(const mesh of window.F1PerformanceJ.cachedTailNodes(world))visit(mesh);
    else world.getObjectByName('Monza_right_route_scenery')?.traverse(visit);
  }
  async function prepare(THREE,render,scene,scenery,track,registry){T=THREE;renderer=render;world=scene;root=scenery;road=track;pairs=registry.pairs;await turf(registry.trackRoots);forest();cleanStands();await reload();}
  function materialFor(mesh,value){const p=controlled.get(mesh)||byName.get(mesh.name);if(!p)return null;return ['E','F'].includes(value)?p.refined:value==='D'?(p.structured||p.detailed||p.enhanced):value==='C'?(p.detailed||p.enhanced):value==='B'?p.enhanced:p.original;}
  return{prepare,setMode,frame,postFrame,reload,inspect,materialFor,state:()=>({...counts,mode,shot,plan})};
})();
