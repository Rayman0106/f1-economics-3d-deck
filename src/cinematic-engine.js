/* Injected inside the Three.js closure. Original GLBs, UVs and wheel pivots remain
   intact. A curved circuit, neutral metal, cached timelines and shader warmup. */
window.F1Cinematic = (() => {
  const environment=createF1Environment(xa,n,i,Y,new gu(),ve);
  const worldRoots=[J,environment.group,environment.sky],worldDissolve=createWorldDissolve(xa,n,i,r,worldRoots);let rightRoute=null;
  let gridOpening=null;
  const daylightFog=.00055;
  i.fog.color.setHex(0xa8c8d8);i.fog.density=daylightFog;
  a.color.setHex(0xfff5e7);a.intensity=2.8;
  o.color.setHex(0xc4d8e6);o.intensity=.8;
  c.color.setHex(0xe2ecf2);c.intensity=.65;
  l.color.setHex(0xf2ede0);l.intensity=.15;
  i.children.forEach(light=>{if(light.isAmbientLight)light.intensity=.28;});
  a.shadow.mapSize.set(2048,2048);a.shadow.normalBias=.025;a.shadow.bias=-.00015;a.shadow.radius=2;n.shadowMap.autoUpdate=false;
  const sunDirection=new xa.Vector3(.62,0,.78).normalize();
  function lightRig(focus){
    // A fixed daylight direction. The shadow is drawn with this same frame's
    // car and light transforms, rather than a throttled, stale shadow matrix.
    a.position.copy(focus).addScaledVector(sunDirection,7);a.position.y=6.5;
    o.position.copy(focus).addScaledVector(sunDirection,-5);o.position.y=4.2;
    c.position.set(focus.x-sunDirection.z*5,2.9,focus.z+sunDirection.x*5);
    l.position.copy(focus).addScaledVector(sunDirection,2);l.position.y=1.4;
    for(const light of[a,o,c,l]){light.target.position.copy(focus).setY(0);light.target.updateMatrixWorld();}
    window.__F1Lighting={direction:sunDirection.toArray(),synchronizedShadows:true};
  }
  const rival = new xa.Group();
  rival.name = 'Story_McLaren'; i.add(rival); rival.visible = false;
  const rivalShadow = $e.clone();rivalShadow.material=$e.material.clone(); rival.add(rivalShadow);
  const mc = p0({THREE:xa, loader:new gu(), parent:rival, renderer:n, readAsset:ve});
  const extraCars=Object.fromEntries(['ferrari','mercedes','cadillac'].map(key=>{
    const group=new xa.Group();group.name='Story_'+key;i.add(group);group.visible=false;
    const shadow=$e.clone();shadow.material=$e.material.clone();group.add(shadow);
    const controller=p0({THREE:xa,loader:new gu(),parent:group,renderer:n,readAsset:key==='cadillac'?()=>ve('cadillac'):ve});
    return[key,{group,shadow,controller,corners:[]}];
  }));
  const allKeys=['redbull','mclaren','ferrari','mercedes','cadillac','aston','williams','haas','audi','alpine','racingbulls'];
  const actorGroups=()=>({redbull:h,mclaren:rival,...Object.fromEntries(Object.entries(extraCars).map(([key,entry])=>[key,entry.group]))});
  const actorWheels=()=>({redbull:u,mclaren:mc.wheels,...Object.fromEntries(Object.entries(extraCars).map(([key,entry])=>[key,entry.controller.wheels]))});
  const materialLists=new WeakMap(),flatUniforms = new Map(),alphaStates = new Map();
  const tableCache=new Map();let localCarCorners=[],redCarCorners=[],openingRedbullAngles=null;
  let playing=false,quality=1,previousTick=0,frameSamples=[];
  let prepared = false, last = null, baseAngles = {redbull:[],mclaren:[]};
  let wheelTables = null, currentScene = '';
  const wheelTotals=new Map();
  const redWheelTotals=new Map();
  const sceneTotals=new Map();
  const vec = value => new xa.Vector3(...value);
  const researchStage=createResearchStage(xa,i);
  const finishStage=createFinishStage(xa,i,worldRoots);
  const columns=new xa.Group();columns.name='Horizontal_budget_columns';i.add(columns);
  const budgetConfig={width:90,repairWidth:17.9375,height:2,gap:.3125};
  const budgetFlat={value:0},mixNumber=(a,b,t)=>a+(b-a)*t;
  function configureBudget(metrics){
    budgetConfig.repairWidth=90*metrics.repairWidth/metrics.width;budgetConfig.height=90*metrics.height/metrics.width;budgetConfig.gap=90*metrics.gap/metrics.width;
  }
  const tileGeometry=new xa.BoxGeometry(1,1,1),tileMaterials=[0xff8708,0xbdd0dc].map(color=>{
    const material=new xa.MeshBasicMaterial({color,toneMapped:false,transparent:true,depthWrite:true,fog:false});
    material.onBeforeCompile=shader=>{
      shader.uniforms.budgetFlat=budgetFlat;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float budgetFace;').replace('#include <begin_vertex>','#include <begin_vertex>\nvec3 faceDirection=normalize(mat3(modelMatrix)*normal);budgetFace=faceDirection.z>0.5?1.0:faceDirection.y>0.5?1.12:0.47;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float budgetFlat;varying float budgetFace;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb*=mix(budgetFace,1.0,budgetFlat);');
    };material.customProgramCacheKey=()=> 'horizontal-budget-p09';return material;
  });
  const budgetPosts=Array.from({length:4},(_,index)=>{const mesh=new xa.Mesh(tileGeometry,tileMaterials[0]);mesh.name='Separate_repair_'+(index+1);columns.add(mesh);return mesh;});
  const development=new xa.Group();development.name='Development_headroom';columns.add(development);columns.visible=false;
  const developmentPosts=Array.from({length:8},(_,index)=>{const mesh=new xa.Mesh(tileGeometry,tileMaterials[1]);mesh.name='Development_million_'+(index+1);development.add(mesh);return mesh;});

  // The revisions use triangles from the supplied McLaren, with their existing
  // UVs and materials. Only the two wing assemblies move in the development act.
  // These are illustrative variants, not claimed real-world upgrade packages.
  const wingParts=[],wingHighlight=new xa.Color(0xffc47d),frontRevisionMeshes=[];
  let frontRevision=-1;
  let airflow=null;
  function buildUpgradeParts(car){
    completeMcLarenRearWing(xa,car);
    const supplied={front:car.getObjectByName('Front_Wing'),rear:car.getObjectByName('Rear_Wing')};
    const pivots={front:new xa.Vector3(...(supplied.front?.userData.wingPivot||[-2.38,.18,0])),rear:new xa.Vector3(...(supplied.rear?.userData.wingPivot||[2.48,1.04,0]))},groups={};
    for(const key of['front','rear']){
      const part=new xa.Group();part.name=key+'_wing_revision';
      part.position.copy(pivots[key]);car.add(part);groups[key]={key,part,pivot:pivots[key],triangles:0,materials:[]};wingParts.push(groups[key]);
    }
    car.updateMatrixWorld(true);const inverse=new xa.Matrix4().copy(car.matrixWorld).invert(),meshes=[];
    if(supplied.front&&supplied.rear){
      for(const key of['front','rear']){
        const assembly=supplied[key],entry=groups[key];
        assembly.removeFromParent();entry.part.add(assembly);assembly.position.copy(pivots[key]).multiplyScalar(-1);
        assembly.traverse(mesh=>{
          if(!mesh.isMesh)return;
          entry.triangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
          const clone=original=>{const material=original.clone();material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey;entry.materials.push({material,emissive:material.emissive?.clone()});return material;};
          mesh.material=Array.isArray(mesh.material)?mesh.material.map(clone):clone(mesh.material);
          if(key==='front'){
            const geometry=mesh.geometry,homePosition=geometry.attributes.position.array.slice(),homeNormal=geometry.attributes.normal.array.slice(),revisedPosition=homePosition.slice(),lockedOffsets=[];
            const rear=assembly.userData.bounds[1][0],threshold=rear-.14;
            for(let k=0;k<revisedPosition.length;k+=3){
              if(homePosition[k]>=threshold||Math.abs(homePosition[k+2])<.16){lockedOffsets.push(k);continue;}
              const blend=Math.min(1,Math.max(0,(threshold-homePosition[k])/.42));
              revisedPosition[k+1]+=.042*blend*Math.sin((homePosition[k]-rear)*Math.PI/1.2);
            }
            const revised=geometry.clone();revised.attributes.position.array.set(revisedPosition);revised.computeVertexNormals();
            const revisedNormal=revised.attributes.normal.array.slice();revised.dispose();
            frontRevisionMeshes.push({geometry,homePosition,homeNormal,revisedPosition,revisedNormal,locked:lockedOffsets.length,lockedOffsets});
          }
        });
      }
    }else{
    car.traverse(mesh=>{if(mesh.isMesh&&/^(body|carbon|details)$/i.test(mesh.name))meshes.push(mesh);});
    for(const mesh of meshes){
      const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone(),position=source.attributes.position,transform=new xa.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld),normalMatrix=new xa.Matrix3().getNormalMatrix(transform);
      const attributes=Object.keys(source.attributes),buckets={rest:[],front:[],rear:[]};
      // The front wing is one connected assembly. A centroid cut sliced its
      // tall endplates and rearward flaps, leaving genuine wing surfaces behind.
      // Weld position seams only for classification; retain every original UV.
      const triangleCount=position.count/3,parents=Array.from({length:triangleCount},(_,k)=>k),welds=new Map(),vertices=[];
      const find=k=>parents[k]===k?k:parents[k]=find(parents[k]);
      for(let index=0;index<position.count;index++){
        const point=new xa.Vector3().fromBufferAttribute(position,index).applyMatrix4(transform);vertices.push(point);
        const token=[point.x,point.y,point.z].map(value=>Math.round(value*10000)).join(','),triangle=Math.floor(index/3);
        if(welds.has(token))parents[find(triangle)]=find(welds.get(token));else welds.set(token,triangle);
      }
      const components=new Map();
      for(let index=0;index<position.count;index++){
        const root=find(Math.floor(index/3));if(!components.has(root))components.set(root,new xa.Box3());components.get(root).expandByPoint(vertices[index]);
      }
      const completeFront=new Set([...components].filter(([,box])=>box.min.x< -2.02&&box.max.x< -1.66&&box.max.y<.68).map(([root])=>root));
      for(let index=0;index<position.count;index+=3){
        const centre=new xa.Vector3();for(let k=0;k<3;k++)centre.add(vertices[index+k]);centre.multiplyScalar(1/3);
        const key=completeFront.has(find(index/3))?'front':centre.x>2.18&&centre.y>.82?'rear':'rest';buckets[key].push(index,index+1,index+2);
      }
      const geometryFor=(indices,key)=>{
        const geometry=new xa.BufferGeometry();
        for(const name of attributes){
          const attribute=source.attributes[name],values=[];
          for(const index of indices){
            if(key!=='rest'&&name==='position'){const p=new xa.Vector3().fromBufferAttribute(attribute,index).applyMatrix4(transform).sub(pivots[key]);values.push(p.x,p.y,p.z);}
            else if(key!=='rest'&&name==='normal'){const p=new xa.Vector3().fromBufferAttribute(attribute,index).applyMatrix3(normalMatrix).normalize();values.push(p.x,p.y,p.z);}
            else for(let k=0;k<attribute.itemSize;k++)values.push(k===0?attribute.getX(index):k===1?attribute.getY(index):k===2?attribute.getZ(index):attribute.getW(index));
          }
          geometry.setAttribute(name,new xa.Float32BufferAttribute(values,attribute.itemSize));
        }geometry.computeBoundingSphere();return geometry;
      };
      mesh.geometry=geometryFor(buckets.rest,'rest');
      for(const key of['front','rear'])if(buckets[key].length){
        const emphasizeMaterial=original=>{
          const material=original.clone();material.onBeforeCompile=original.onBeforeCompile;material.customProgramCacheKey=original.customProgramCacheKey;
          groups[key].materials.push({material,emissive:material.emissive?.clone()});return material;
        };
        const geometry=geometryFor(buckets[key],key),materials=Array.isArray(mesh.material)?mesh.material.map(emphasizeMaterial):emphasizeMaterial(mesh.material),part=new xa.Mesh(geometry,materials);
        if(key==='front'){
          const homePosition=geometry.attributes.position.array.slice(),homeNormal=geometry.attributes.normal.array.slice(),revisedPosition=homePosition.slice();let locked=0;const lockedOffsets=[];
          for(let k=0;k<revisedPosition.length;k+=3){
            const carX=homePosition[k]+pivots.front.x,carY=homePosition[k+1]+pivots.front.y;
            if(carX>=-2.08||carY>=.47){locked++;lockedOffsets.push(k);continue;}
            const blend=Math.min(1,Math.max(0,(-2.08-carX)/.32));
            revisedPosition[k+1]+=.075*blend*Math.sin((carX+3.05)*Math.PI/1.2);
          }
          const revisedGeometry=geometry.clone();revisedGeometry.attributes.position.array.set(revisedPosition);revisedGeometry.computeVertexNormals();
          const revisedNormal=revisedGeometry.attributes.normal.array.slice();revisedGeometry.dispose();
          frontRevisionMeshes.push({geometry,homePosition,homeNormal,revisedPosition,revisedNormal,locked,lockedOffsets});
        }
        part.castShadow=part.receiveShadow=true;part.frustumCulled=false;groups[key].part.add(part);groups[key].triangles+=buckets[key].length/3;
      }source.dispose();
    }
    }
    airflow=new xa.Group();airflow.name='Revision_airflow_test';car.add(airflow);
    const flowMaterial=new xa.LineBasicMaterial({color:0x8bc8dc,transparent:true,opacity:.32,depthWrite:false,toneMapped:false});
    for(let index=0;index<9;index++){
      const side=(index-4)*.31,points=[];
      for(let step=0;step<=100;step++){
        const x=-4.3+8.6*step/100,deflection=Math.exp(-Math.pow((x+.2)/2.0,2));points.push(new xa.Vector3(x,.42+deflection*(.6+.15*(index%3)),side*(1+.26*deflection)));
      }
      const geometry=new xa.BufferGeometry().setFromPoints(points),line=new xa.Line(geometry,flowMaterial);airflow.add(line);
    }
    window.__F1UpgradeGeometry=wingParts.map(({key,triangles})=>({key,triangles,baselineOutline:false,mountAttachmentError:key==='front'?0:null,lockedMountVertices:key==='front'?frontRevisionMeshes.reduce((n,mesh)=>n+mesh.locked,0):null}));
  }
  function frameUpgrade(pose){
    const upgrade=pose.upgrade,revision=upgrade?.front||0;
    if(revision!==frontRevision){
      for(const entry of frontRevisionMeshes){
        const p=entry.geometry.attributes.position.array,norm=entry.geometry.attributes.normal.array;
        for(let k=0;k<p.length;k++){p[k]=mixNumber(entry.homePosition[k],entry.revisedPosition[k],revision);norm[k]=mixNumber(entry.homeNormal[k],entry.revisedNormal[k],revision);}
        entry.geometry.attributes.position.needsUpdate=true;entry.geometry.attributes.normal.needsUpdate=true;
      }frontRevision=revision;
    }
    for(const entry of wingParts){
      const revision=upgrade?.[entry.key]||0,lift=upgrade?.[entry.key+'Lift']||0;
      entry.part.position.copy(entry.pivot).add(new xa.Vector3(entry.key==='front'?-1.05*lift:.1*lift,(entry.key==='front'?1.1:.55)*lift,0));
      entry.part.rotation.z=entry.key==='front'?0:-.045*revision;
      const emphasis=1+.18*lift;
      entry.part.scale.set((entry.key==='rear'?1+.09*revision:1)*emphasis,emphasis,(entry.key==='front'?1:1+.065*revision)*emphasis);
      for(const {material,emissive} of entry.materials)if(emissive){
        material.emissive.copy(emissive);material.emissive.r+=wingHighlight.r*.09*lift;material.emissive.g+=wingHighlight.g*.09*lift;material.emissive.b+=wingHighlight.b*.09*lift;
      }
    }
    if(airflow){
      airflow.visible=!!upgrade&&upgrade.test>.001;
      airflow.children.forEach((line,index)=>{const start=Math.floor(((pose.seconds*1.4+index*.13)%1)*65);line.geometry.setDrawRange(start,25);line.material.opacity=.34*(upgrade?.test||0);});
    }
  }
  const skidGroup=new xa.Group();skidGroup.name='Rear_tyre_skid_marks';i.add(skidGroup);
  const skidMaterial=new xa.MeshBasicMaterial({color:0x101519,transparent:true,opacity:.5,depthWrite:false,side:xa.DoubleSide,forceSinglePass:true});
  const skidMeshes=[];let skidSegments=0;
  // The custom side cameras cross the near barrier line. Preserve the far side
  // and the road, and remove only near-side furniture for unobstructed framing.
  const trackSamples=[];
  for(let station=-170;station<=Y.raceMetres+950;station+=4){
    const point=Y.lane(station,0,0),next=Y.lane(station+1,0,0),forward=next.clone().sub(point).normalize();
    trackSamples.push({point,left:new xa.Vector3(forward.z,0,-forward.x)});
  }
  const trackSide=point=>{
    let closest=trackSamples[0],distance=Infinity;
    for(const sample of trackSamples){const current=sample.point.distanceToSquared(point);if(current<distance){distance=current;closest=sample;}}
    return point.clone().sub(closest.point).dot(closest.left);
  };
  const hiddenFurniture=[],instanceFurniture=[],vegetationBounds=[],furnitureBounds=[],furnitureMasks=new Map();J.updateMatrixWorld(true);
  function matrixAttribute(matrices){const values=new Float32Array(matrices.length*16);matrices.forEach((matrix,index)=>matrix.toArray(values,index*16));return new xa.InstancedBufferAttribute(values,16);}
  const registerFurniture=(object,knownSide=null,corridor=Infinity)=>{
    // Ground is y=-.4. Low walls still hide tyres and the front wing.
    if(!object.isMesh||new xa.Box3().setFromObject(object).max.y<-.35)return;
    if(object.isInstancedMesh){
      const originals=[],storyMatrices=[],oppositeMatrices=[],wideStoryMatrices=[],wideOppositeMatrices=[];
      for(let index=0;index<object.count;index++){
        const matrix=new xa.Matrix4();object.getMatrixAt(index,matrix);originals.push(matrix.clone());
        const point=new xa.Vector3().setFromMatrixPosition(matrix).applyMatrix4(object.matrixWorld);
        const side=knownSide??trackSide(point),opposite=matrix.clone(),wide=matrix.clone(),wideOpposite=matrix.clone();
        if(side>6)wide.scale(new xa.Vector3(0,0,0));if(side< -6)wideOpposite.scale(new xa.Vector3(0,0,0));
        if(side>6&&side<corridor)matrix.scale(new xa.Vector3(0,0,0));if(side< -6&&side> -corridor)opposite.scale(new xa.Vector3(0,0,0));
        storyMatrices.push(matrix);oppositeMatrices.push(opposite);wideStoryMatrices.push(wide);wideOppositeMatrices.push(wideOpposite);
      }const owner={object,originals,storyMatrices,oppositeMatrices,wideStoryMatrices,wideOppositeMatrices,attributes:{original:object.instanceMatrix,story:matrixAttribute(storyMatrices),opposite:matrixAttribute(oppositeMatrices),wide:matrixAttribute(wideStoryMatrices),wideOpposite:matrixAttribute(wideOppositeMatrices)}};instanceFurniture.push(owner);
      object.geometry.computeBoundingBox();
      originals.forEach((matrix,index)=>{const world=object.matrixWorld.clone().multiply(matrix),box=object.geometry.boundingBox.clone().applyMatrix4(world);furnitureBounds.push({object,index,owner,box,world,right:!!object.userData.f1RightRoute,inverse:world.clone().invert(),local:object.geometry.boundingBox.clone()});});
      if(/^(Irregular_broadleaf_|Tapered_tree_|Tree_branches|Layered_pine_|Verge_shrubs)/.test(object.name)){
        object.geometry.computeBoundingBox();
        originals.forEach((matrix,index)=>{const box=object.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(object.matrixWorld);vegetationBounds.push({name:object.name,index,box,side:trackSide(box.getCenter(new xa.Vector3()))});});
      }
    }else{
      const point=object.geometry.attributes.position?new xa.Vector3().fromBufferAttribute(object.geometry.attributes.position,0).applyMatrix4(object.matrixWorld):object.getWorldPosition(new xa.Vector3());
      const side=knownSide??trackSide(point);if(Math.abs(side)>6){hiddenFurniture.push({object,side:Math.sign(side),originalVisible:object.visible});object.geometry.computeBoundingBox();const world=object.matrixWorld.clone();furnitureBounds.push({object,index:null,right:!!object.userData.f1RightRoute,box:new xa.Box3().setFromObject(object),world,inverse:world.clone().invert(),local:object.geometry.boundingBox.clone()});}
    }
  };
  // Keep the near-side camera corridor clear, including scenery instances.
  // The low corner camera must not travel through seats, people or roof beams.
  function registerAllFurniture(){
  J.traverse(registerFurniture);
  i.getObjectByName('Circuit_scenery')?.updateMatrixWorld(true);
  i.getObjectByName('Circuit_scenery')?.traverse(object=>{
    if(/^(Grandstand_|Spectator_|Pit_|Garage_|Awning_)/.test(object.name))registerFurniture(object,-20);
    if(/^Far_(Grandstand_|Spectator_)/.test(object.name))registerFurniture(object,20);
    if(/^(Irregular_broadleaf_|Tapered_tree_|Tree_branches|Layered_pine_|Verge_shrubs)/.test(object.name))registerFurniture(object,null,70);
    if(/^Imported_Monza_/.test(object.name))registerFurniture(object);
  });
  }
  function registerRouteFurniture(route){for(const root of[route.road,route.scenery])root.traverse(object=>object.userData.f1RightRoute=true);route.road.updateMatrixWorld(true);route.scenery.updateMatrixWorld(true);route.road.traverse(registerFurniture);route.scenery.traverse(object=>{if(/^(Grandstand_|Spectator_|Pit_|Garage_|Awning_|Far_|Irregular_broadleaf_|Tapered_tree_|Tree_branches|Layered_pine_|Verge_shrubs|Imported_Monza_)/.test(object.name))registerFurniture(object);});}
  let furnitureHidden=false,furnitureSide=1,furnitureWide=false,furnitureMaskName='';
  function frameFurniture(hide,side=1,wide=false){
    if(!furnitureMaskName&&hide===furnitureHidden&&side===furnitureSide&&wide===furnitureWide)return;furnitureMaskName='';furnitureHidden=hide;furnitureSide=side;furnitureWide=wide;
    hiddenFurniture.forEach(entry=>entry.object.visible=entry.originalVisible&&!(hide&&entry.side===side));
    for(const entry of instanceFurniture)entry.object.instanceMatrix=entry.attributes[hide?(wide?(side>0?'wide':'wideOpposite'):(side>0?'story':'opposite')):'original'];
  }
  const nativePoint=(point,pose)=>{const p=vec(point);if(pose.circuitFrame)p.sub(vec(pose.circuitFrame.origin||[0,0,0])).applyAxisAngle(new xa.Vector3(0,1,0),-(pose.circuitFrame.heading||0));return p;};
  function subjectRays(pose){
    const camera=nativePoint(pose.camera.position,pose),target=nativePoint(pose.camera.target,pose),viewCamera=new xa.PerspectiveCamera(pose.camera.fov,1600/900,.1,3000);
    viewCamera.position.copy(camera);viewCamera.lookAt(target);viewCamera.updateMatrixWorld(true);if(pose.camera.principal){viewCamera.projectionMatrix.elements[8]=-(pose.camera.principal[0]-800)/800;viewCamera.projectionMatrix.elements[9]=(pose.camera.principal[1]-450)/450;viewCamera.projectionMatrixInverse.copy(viewCamera.projectionMatrix).invert();}const rays=[];
    const subjects=pose.corridorActors?pose.corridorActors.map((actor,index)=>['grid_'+index,actor]):allKeys.map(key=>[key,pose[key]]);
    for(const mate of pose.inspectionMates||[])subjects.push([mate.key+'-mate',mate.actor]);
    for(const [key,actor] of subjects){if(!actor||actor.opacity<.1)continue;
      const centre=nativePoint([actor.position[0],.55,actor.position[2]],pose),screen=centre.clone().project(viewCamera);
      if(screen.z< -1||screen.z>1||Math.abs(screen.x)>1.25||Math.abs(screen.y)>1.3)continue;
      for(const along of[-3,0,3])for(const lateral of[-1.15,1.15])for(const height of[-.28,.15,.85,1.35]){
        const point=nativePoint([actor.position[0]-Math.cos(actor.heading)*along+Math.sin(actor.heading)*lateral,height,actor.position[2]+Math.sin(actor.heading)*along+Math.cos(actor.heading)*lateral],pose);
        rays.push({actor:key,right:pose.circuitFrame?.route==='right',ray:new xa.Ray(camera,point.clone().sub(camera).normalize()),length:camera.distanceTo(point)});
      }
    }
    // The bills are physical subjects too. Sample their evolving 3D boxes,
    // including the tops and the budget portions behind the moving car.
    if(pose.trail?.opacity>.01){
      const tr=pose.trail,shape=tr.shape,scale=tr.visualScale||1,origin=[mixNumber(tr.x,pose.mclaren.position[0]-budgetConfig.repairWidth,shape),-.4,tr.z];let cumulative=0;
      for(let index=0;index<4;index++){
        const allocation=budgetConfig.repairWidth*tr.amounts[index]*tr.growth[index]/2,height=allocation*(1+1.4*(1-shape));if(height<.001)continue;
        const center=[origin[0]+scale*mixNumber(4+index*13,cumulative+allocation/2,shape),origin[1]+scale*mixNumber(height/2,-tr.height/2,shape),origin[2]-scale*tr.depth/2];
        const half=[scale*mixNumber(tr.height,allocation,shape)/2,scale*mixNumber(height,tr.height,shape)/2,scale*tr.depth/2];
        for(const x of[-1,0,1])for(const y of[-1,1])for(const z of[-1,1]){
          const point=nativePoint(center.map((v,k)=>v+[x,y,z][k]*half[k]),pose),screen=point.clone().project(viewCamera);
          if(Math.abs(screen.x)>1.15||Math.abs(screen.y)>1.2)continue;
          rays.push({actor:'budget-'+index,budget:true,right:pose.circuitFrame?.route==='right',ray:new xa.Ray(camera,point.clone().sub(camera).normalize()),length:camera.distanceTo(point)});
        }cumulative+=allocation;
      }
    }
    // Thin near-side rails should not cut across unrelated parts of the frame.
    // This corridor uses the current shot's frustum, not just the car centre.
    const nearest=Math.min(...rays.filter(v=>!v.budget).map(v=>v.length));
    if(Number.isFinite(nearest)){const frustum=new xa.Frustum().setFromProjectionMatrix(viewCamera.projectionMatrix.clone().multiply(viewCamera.matrixWorldInverse));rays.push({actor:'foreground',foreground:true,right:pose.circuitFrame?.route==='right',frustum,origin:camera,length:Math.max(3,nearest-2)});}
    return rays;
  }
  const furnitureRay=new xa.Ray(),furnitureHit=new xa.Vector3(),furnitureA=new xa.Vector3(),furnitureB=new xa.Vector3(),furnitureC=new xa.Vector3();
  const architectural=entry=>/^(?:Far_)?(?:Grandstand_|Spectator_|Imported_Monza_(?:gstand|roof|crowd))/.test(entry.object.name);
  function furnitureBlocks(sample,entry,hit){
    if(sample.foreground&&!/^(Fence_|Wall_|Lighting_|Lamp_|Catch_fence_|Circuit_panels_|Pit_balcony_rails|Grandstand_steel_|Imported_Monza_(?:metals?|fences?|walls?))/.test(entry.object.name))return false;
    if(sample.foreground)return !!sample.right===!!entry.right&&sample.frustum.intersectsBox(entry.box)&&entry.box.distanceToPoint(sample.origin)<sample.length;
    if(!!sample.right!==!!entry.right||!sample.ray.intersectBox(entry.box,hit))return false;
    furnitureRay.copy(sample.ray).applyMatrix4(entry.inverse);
    if(!furnitureRay.intersectBox(entry.local,furnitureHit))return false;
    // Stand floors/roofs have large empty bounding boxes. Test their actual
    // faces before clearing them, including when the subject is a car. A
    // blanket "protect all stands" rule hid the car behind a wall at 2->3.
    if(architectural(entry)){
      const geometry=entry.object.geometry,positions=geometry.attributes.position,indices=geometry.index,count=indices?indices.count:positions.count;
      for(let k=0;k<count;k+=3){
        furnitureA.fromBufferAttribute(positions,indices?indices.getX(k):k);furnitureB.fromBufferAttribute(positions,indices?indices.getX(k+1):k+1);furnitureC.fromBufferAttribute(positions,indices?indices.getX(k+2):k+2);
        if(furnitureRay.intersectTriangle(furnitureA,furnitureB,furnitureC,false,furnitureHit)){hit.copy(furnitureHit).applyMatrix4(entry.world);if(sample.ray.origin.distanceTo(hit)<sample.length-.8)return true;}
      }return false;
    }
    hit.copy(furnitureHit).applyMatrix4(entry.world);return sample.ray.origin.distanceTo(hit)<sample.length-.8;
  }
  async function prepareFurnitureMasks(story){
    // A stable union for the connected driving acts prevents furniture popping
    // as the camera moves. Only geometry on the camera-to-car rays is removed.
    // Trees behind the camera and the far grandstand keep their full geometry.
    // These two acts meet on a clean, world-free slide. Give each its own
    // stable mask: the budget camera must not excavate the earlier grandstand.
    for(const[name,kinds]of[['opening',['opening']],['overtake',['overtake']],['costs',['costs']],['race',['advantage','competition']],['entry',['entry']],['conclusion',['conclusion']]]){
      const rays=[];
      for(const kind of kinds)for(let t=kind==='advantage'?9.6:0;t<=(kind==='opening'?gridOpening.duration:story.durations[kind])+.01;t+=.05){const p=kind==='opening'?(gridOpening.frame(t),gridOpening.summary()):story[kind](t);if(p.track>.02)rays.push(...subjectRays(p));}
      const blocked=new Set(),hit=new xa.Vector3();
      const buildingCells=new Set(),wholeStands=new Set();
      for(const [index,entry] of furnitureBounds.entries()){
        const protectedStructure=architectural(entry);
        for(const sample of rays){if(furnitureBlocks(sample,entry,hit)){
          blocked.add(entry);
          const stand=entry.object.name.match(/^(Far_)?(?:Grandstand_|Spectator_)/);
          if(stand)wholeStands.add(!!entry.right+':'+(stand[1]||''));
          const cell=entry.object.name.match(/_(-?\d+)_(-?\d+)_tile(-?\d+)$/);
          if(protectedStructure&&cell)buildingCells.add(!!entry.right+':'+cell[0]);
          break;
        }}if(index%60===0)await window.F1Boot?.tick();
      }
      // Clear complete modular stand sections, never a floor alone underneath
      // a retained roof or seated crowd. Far-side architecture remains intact.
      for(const entry of furnitureBounds){const name=entry.object.name,cell=name.match(/_(-?\d+)_(-?\d+)_tile(-?\d+)$/),stand=name.match(/^(Far_)?(?:Grandstand_|Spectator_)/);if((stand&&wholeStands.has(!!entry.right+':'+(stand[1]||'')))||(cell&&buildingCells.has(!!entry.right+':'+cell[0])&&/^Imported_Monza_(?:gstand|roof|crowd|antennas)/.test(name)))blocked.add(entry);}
      const blockedTrees=new Set([...blocked].filter(e=>e.index!==null&&e.object.userData.treeIds?.[e.index]!==undefined&&e.object.userData.treeIds[e.index]!==null).map(e=>!!e.right+':'+e.object.userData.treeIds[e.index]));
      for(const entry of furnitureBounds){const treeId=entry.index===null?null:entry.object.userData.treeIds?.[entry.index];if(treeId!==null&&treeId!==undefined&&blockedTrees.has(!!entry.right+':'+treeId))blocked.add(entry);}
      const matrices=new Map();for(const owner of instanceFurniture)matrices.set(owner,owner.originals.map(matrix=>matrix.clone()));
      for(const entry of blocked)if(entry.index!==null)matrices.get(entry.owner)[entry.index].scale(new xa.Vector3(0,0,0));
      furnitureMasks.set(name,{blocked,matrices,attributes:new Map([...matrices].map(([owner,values])=>[owner,matrixAttribute(values)])),hidden:new Set([...blocked].filter(entry=>entry.index===null).map(entry=>entry.object))});
    }
  }
  function frameSubjectFurniture(pose){
    const name=pose.scene==='opening'?'opening':['advantage','competition'].includes(pose.scene)?'race':['overtake','costs','entry','conclusion'].includes(pose.scene)?pose.scene:null,mask=furnitureMasks.get(name);
    if(!mask){const camera=nativePoint(pose.camera.position,pose);frameFurniture(true,Math.sign(trackSide(camera))||1);return;}
    if(furnitureMaskName===name)return;furnitureMaskName=name;
    for(const entry of hiddenFurniture)entry.object.visible=entry.originalVisible&&!mask.hidden.has(entry.object);
    // Reuse GPU-uploaded buffers. Switching a shot must not rebuild thousands
    // of instance matrices or upload the whole stand/forest on the first frame.
    for(const[owner,attribute]of mask.attributes)owner.object.instanceMatrix=attribute;
  }
  function sceneryState(){
    const mask=furnitureMasks.get(furnitureMaskName),counts={};
    for(const entry of furnitureBounds){const name=entry.object.name;counts[name]??={total:0,retained:0};counts[name].total++;if(!mask?.blocked.has(entry))counts[name].retained++;}
    return{mask:furnitureMaskName,counts,detail:window.__F1SceneryDetail};
  }
  // Optional QA: conservative instance bounds along rays through the chassis.
  // Cached once at setup; this does not run in the animation loop.
  function inspectCorridor(pose){
    const mask=furnitureMasks.get(pose.scene==='opening'?'opening':['advantage','competition'].includes(pose.scene)?'race':pose.scene),blocked=[],rays=subjectRays(pose),hit=new xa.Vector3();
    for(const sample of rays)for(const entry of furnitureBounds){if(mask?.blocked.has(entry))continue;if(furnitureBlocks(sample,entry,hit)&&blocked.length<12)blocked.push({actor:sample.actor,name:entry.object.name,index:entry.index});}
    return{rays:rays.length,budgetRays:rays.filter(r=>r.budget).length,foregroundRays:rays.filter(r=>r.foreground).length,instances:furnitureBounds.length,blocked};
  }
  const hazeCanvas=document.createElement('canvas');hazeCanvas.width=hazeCanvas.height=96;
  const hazeContext=hazeCanvas.getContext('2d');
  const hazeGradient=hazeContext.createRadialGradient(48,48,4,48,48,47);
  hazeGradient.addColorStop(0,'rgba(220,231,236,.75)');
  hazeGradient.addColorStop(.45,'rgba(220,231,236,.25)');
  hazeGradient.addColorStop(1,'rgba(220,231,236,0)');
  hazeContext.fillStyle=hazeGradient;hazeContext.fillRect(0,0,96,96);
  const hazeTexture=new xa.CanvasTexture(hazeCanvas);
  const haze=Array.from({length:28},()=>{
    const sprite=new xa.Sprite(new xa.SpriteMaterial({map:hazeTexture,transparent:true,depthWrite:false,opacity:0}));
    sprite.visible=false;sprite.renderOrder=6;i.add(sprite);return sprite;
  });
  const project = point => {
    const projected=point.clone().project(r);
    return {x:(projected.x+1)*800,y:(1-projected.y)*450,z:projected.z};
  };
  const sceneryRoot=i.getObjectByName('Circuit_scenery'),distantHills=i.getObjectByName('Distant_hills');
  let circuitFrameActive=false,circuitFrameKey='';
  function frameCircuit(pose){
    const active=!!pose?.circuitFrame,key=JSON.stringify(pose?.circuitFrame||null);if(key===circuitFrameKey)return;circuitFrameActive=active;circuitFrameKey=key;
    const origin=pose?.circuitFrame?.origin||[0,0,0],heading=pose?.circuitFrame?.heading||0;
    J.position.fromArray(origin);J.rotation.y=heading;J.updateMatrix();
    if(rightRoute)for(const root of[rightRoute.road,rightRoute.scenery]){root.position.fromArray(origin);root.rotation.y=heading;root.updateMatrix();}
    if(distantHills){distantHills.scale.set(active?3:1,1,active?3:1);distantHills.updateMatrix();}
    if(sceneryRoot){sceneryRoot.position.fromArray(origin);sceneryRoot.rotation.y=heading;sceneryRoot.updateMatrix();}
  }
  function materialOpacity(car,opacity,flat) {
    if(!car)return;
    let list=materialLists.get(car);
    if(!list){
      const unique=new Set();car.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])unique.add(material);});
      list=[...unique];materialLists.set(car,list);
    }
    const actorOpacity=Math.max(0,Math.min(1,opacity));
    for(const material of list){
      if(!alphaStates.has(material))alphaStates.set(material,{opacity:material.opacity,depthWrite:material.depthWrite,transparent:material.transparent,alphaTest:material.alphaTest});
      const original=alphaStates.get(material);
      if(!flatUniforms.has(material)){
        const uniforms={flat:{value:0},opacity:{value:1}},before=material.onBeforeCompile,cache=material.customProgramCacheKey;
        const flatColour=car===extraCars.cadillac?.controller.car?'vec3(0.84,0.80,0.70)':'vec3(1.0,0.242281,0.002428)';
        flatUniforms.set(material,uniforms);
        material.onBeforeCompile=function(shader,renderer){
          before.call(this,shader,renderer);shader.uniforms.storyFlatMix=uniforms.flat;shader.uniforms.storyActorOpacity=uniforms.opacity;
          shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float storyFlatMix;\nuniform float storyActorOpacity;');
          // OPAQUE albedo alpha may store unrelated data (carbon alpha is often 34/255).
          // Ignore it even while the whole actor intentionally dissolves into the slide.
          if(!original.transparent&&original.alphaTest===0)shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a=opacity;');
          // Preserve glass and native decal cutouts; fade only after the cutout test.
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.a*=storyActorOpacity;').replace('#include <colorspace_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,'+flatColour+',storyFlatMix);\n#include <colorspace_fragment>');
        };
        material.customProgramCacheKey=function(){return cache.call(this)+'-story-flat-v3-'+flatColour;};material.needsUpdate=true;
      }
      flatUniforms.get(material).flat.value=flat;flatUniforms.get(material).opacity.value=actorOpacity;
      const transparent=original.transparent||actorOpacity<1;
      if(material.transparent!==transparent){material.transparent=transparent;material.needsUpdate=true;}
      material.opacity=original.opacity;material.depthWrite=original.depthWrite;
    }
  }
  function reset() {
    researchStage.frame({});finishStage.frame({});
    gridOpening?.hide();last=null;currentScene='';window.__F1CinematicPreviousCamera=null;frameFurniture(false);frameCircuit(null);
    if(distantHills)distantHills.visible=true;
    rival.visible=false;for(const entry of Object.values(extraCars))entry.group.visible=false;columns.visible=false;skidGroup.visible=false;h.visible=true;frameUpgrade({seconds:0});
    haze.forEach(sprite=>sprite.visible=false);
    materialOpacity(d.car,1,0);materialOpacity(mc.car,1,0);for(const entry of Object.values(extraCars))materialOpacity(entry.controller.car,1,0);
    rivalShadow.visible=true;$e.visible=true;$e.material.opacity=.65;i.fog.density=daylightFog;
  }
  async function prepare() {
    if(prepared)return;
    const model=await mc.apply('mclaren');Fe.markCar(model.car);
    for(const[key,entry]of Object.entries(extraCars)){
      const loaded=await entry.controller.apply(key==='cadillac'?'mclaren':key);window.F1Boot?.parsed(key);Fe.markCar(loaded.car);materialOpacity(loaded.car,1,0);
      entry.group.updateMatrixWorld(true);const box=new xa.Box3().setFromObject(loaded.car);
      for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])entry.corners.push(new xa.Vector3(x,y,z));
      entry.group.visible=false;
    }
    Fe.markCar(d.car);
    h.updateMatrixWorld(true);const redBox=new xa.Box3(),redInverse=h.matrixWorld.clone().invert();
    d.car.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();const matrix=redInverse.clone().multiply(mesh.matrixWorld),box=mesh.geometry.boundingBox;for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])redBox.expandByPoint(new xa.Vector3(x,y,z).applyMatrix4(matrix));});
    for(const x of[redBox.min.x,redBox.max.x])for(const y of[redBox.min.y,redBox.max.y])for(const z of[redBox.min.z,redBox.max.z])redCarCorners.push(new xa.Vector3(x,y,z));
    materialOpacity(d.car,1,0);
    rival.updateMatrixWorld(true);
    const box=new xa.Box3().setFromObject(model.car);
    for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])localCarCorners.push(new xa.Vector3(x,y,z));
    buildUpgradeParts(model.car);materialOpacity(model.car,1,0);Fe.markCar(model.car);
    i.userData.openingCamera=r;gridOpening=createOpeningGrid(xa,n,i,p0,gu,ve,$e,{redbull:{group:h,car:d.car,wheels:u},mclaren:{group:rival,car:mc.car,wheels:mc.wheels},...Object.fromEntries(Object.entries(extraCars).map(([key,e])=>[key,{group:e.group,car:e.controller.car,wheels:e.controller.wheels}]))});
    await gridOpening.prepare();await gridOpening.prepareSignals();
    // Reuse the six already decoded grid templates as story actors. Their
    // original groups were idle after cloning the grid; no second asset load.
    for(const[key,source]of Object.entries(gridOpening.storyTemplates())){
      const shadow=$e.clone();shadow.material=$e.material.clone();source.group.add(shadow);
      source.group.name='Story_'+key;const corners=[];source.group.updateMatrixWorld(true);
      const box=new xa.Box3().setFromObject(source.car);
      for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new xa.Vector3(x,y,z));
      extraCars[key]={group:source.group,controller:source.controller,shadow,corners};
      materialOpacity(source.car,1,0);Fe.markCar(source.car);source.group.visible=false;
    }
    await environment.prepare();
    registerAllFurniture();
    prepared=true;rival.visible=false;
  }
  function setPlayback(value){playing=value;previousTick=0;frameSamples=[];if(value){playbackStarted=0;playbackTrace.length=0;}}
  const playbackTrace=[];let playbackStarted=0;
  function sampleFrame(now){
    if(!playing)return;if(!playbackStarted)playbackStarted=now;
    if(previousTick&&playbackTrace.length<15000)playbackTrace.push({ms:now-playbackStarted,delta:now-previousTick});previousTick=now;
  }
  function pixelRatio(){return Math.min(2,Math.max(1.5,window.devicePixelRatio||1));}
  function frameRendering(focus){
    const ratio=pixelRatio();if(Math.abs(n.getPixelRatio()-ratio)>.001)n.setPixelRatio(ratio);
    window.__F1MotionFocus=focus;
    n.shadowMap.needsUpdate=true;
  }
  function renderGridOpening(seconds){if(currentScene!=="opening"){reset();currentScene="opening";}frameCircuit(null);gridOpening.frame(seconds);const opening=gridOpening.summary();frameSubjectFurniture(opening);if(rightRoute){rightRoute.road.visible=false;rightRoute.scenery.visible=false;}J.visible=opening.track>0;T.visible=false;Y.fade(1);environment.update(opening.track,r);lightRig(h.position);frameRendering(h.position.toArray());worldDissolve.render(opening.track,gridOpening.openingWorldGroups());last={...opening,worldActors:['mclaren'],displayActors:opening.track===0?['redbull']:['redbull','mclaren','grid']};return last;}
  async function warmup(story){
    window.F1Boot?.update(76,"准备镜头与遮挡");await window.F1Boot?.tick();frameCircuit(null);frameFurniture(false);gridOpening.configure(story);window.F1Boot?.update(77,"布置蒙扎连接弯道");rightRoute=await createStoryRouteVariant(xa,Y,[J,environment.group]);i.add(rightRoute.road,rightRoute.scenery);worldRoots.push(rightRoute.road,rightRoute.scenery);registerRouteFurniture(rightRoute);window.F1Boot?.update(79,"预计算镜头遮挡");await prepareFurnitureMasks(story);
    window.APEXTransition.seek(8.4);openingRedbullAngles=u.map(wheel=>gridOpening.distance(gridOpening.duration)/wheel.radius);
    skidSegments=180;
    for(const side of[-1,1]){
      const positions=[],uv=[],indices=[];
      for(let index=0;index<=skidSegments;index++){
        const time=story.skidStart+(story.skidEnd-story.skidStart)*index/skidSegments,p=story.skidPoint(time,side),next=story.skidPoint(Math.min(story.skidEnd,time+.001),side);
        const dx=next[0]-p[0],dz=next[2]-p[2],length=Math.hypot(dx,dz)||1;
        for(const edge of[-1,1]){positions.push(p[0]+dz/length*.14*edge,p[1],p[2]-dx/length*.14*edge);uv.push(edge<0?0:1,index/skidSegments);}
        if(index<skidSegments){const a=index*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
      }
      const geometry=new xa.BufferGeometry();geometry.setAttribute('position',new xa.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new xa.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeBoundingSphere();
      const mesh=new xa.Mesh(geometry,skidMaterial);mesh.renderOrder=3;skidGroup.add(mesh);skidMeshes.push(mesh);
    }
    for(const kind of Object.keys(story.durations)){makeWheelTables(story[kind],story.durations[kind]);await window.F1Boot?.tick();}
    // Compile all cars, road, scenery, smoke and chart materials before playback.
    researchStage.frame(story.conclusion(story.durations.conclusion));
    h.visible=true;rival.visible=true;for(const entry of Object.values(extraCars))entry.group.visible=true;J.visible=true;Y.fade(1);environment.update(1,r);columns.visible=true;development.visible=true;skidGroup.visible=true;if(airflow)airflow.visible=true;
    haze.forEach(sprite=>sprite.visible=true);
    gridOpening.showAll();
    window.F1Boot?.update(84,"预编译着色器…");await window.F1Boot?.tick();if(n.compileAsync)await n.compileAsync(i,r);else n.compile(i,r);
    window.F1Boot?.update(90,"预热赛车与贴图");await gridOpening.warmup();
    // The native grid warmup does not exercise the offscreen world/hero
    // compositor. Upload its 22-car program variants before the first fade.
    for(const t of[26.5,27.5,28.2]){renderGridOpening(t);await window.F1Boot?.tick();}
    gridOpening.hide();
    render(story.overtake(2.0),story.overtake(1.988).camera);
    render(story.overtake(2.85),story.overtake(2.838).camera);render(story.overtake(7.7));render(story.overtake(8.5));
    // The photo-to-model handover briefly uses the transparent material
    // program. Warm it explicitly; opaque-only samples leave its first compile
    // on the presentation's playback thread at about t=0.9s.
    render(story.costs(1.0));render(story.costs(1.5));render(story.costs(8.4));render(story.costs(10.5));
    render(story.regulation(4.65));
    render(story.advantage(3.2));render(story.advantage(6.5));render(story.advantage(story.durations.advantage));
    render(story.competition(3.8));render(story.competition(story.durations.competition));
    // Partial world alpha exercises different compositor programs from a
    // fully restored circuit. Warm both the nine-car reveal and hero exit.
    for(let t=.5;t<=story.entryFreeze+.5;t+=.25){render(story.entry(t));await window.F1Boot?.tick();}
    for(const t of[story.entryFreeze+.8,story.entryFreeze+1.5]){render(story.entry(t));await window.F1Boot?.tick();}
    render(story.entry(story.durations.entry));
    for(const kind of['conclusion'])for(const t of[0,.6,1.2,2.4,4,6,10,14,18,20.5,23,story.durations[kind]]){render(story[kind](t));await window.F1Boot?.tick();}
    // Drain texture uploads and first shader draws during the loading screen.
    // Never use finish/readback in the playback loop.
    n.getContext().finish();await new Promise(requestAnimationFrame);reset();
  }
  function captureBaseAngles(){
    for(const[key,wheels]of Object.entries(actorWheels()))baseAngles[key]=wheels.map(wheel=>wheel.rolling.rotation.z);
  }
  function makeWheelTables(sample,duration){
    const scene=sample(0).scene,cached=tableCache.get(scene),actors=actorWheels();
    const sceneOrder=Object.keys(window.F1Story.durations),predecessors=sceneOrder.slice(0,Math.max(0,sceneOrder.indexOf(scene)));
    const setBaseline=()=>{
      for(const[key,wheels]of Object.entries(actors)){
        const history=predecessors;
        baseAngles[key]=wheels.map((wheel,index)=>gridOpening.actorDistance(key,gridOpening.duration)/wheel.radius+history.reduce((sum,act)=>sum+(sceneTotals.get(act)?.[key]?.[index]||0),0)/wheel.radius);
      }
    };
    if(cached){wheelTables=cached;setBaseline();return cached;}
    const steps=Math.ceil(duration*180),tables={duration,steps};
    const previous={};for(const[key,wheels]of Object.entries(actors))tables[key]=wheels.map(()=>new Float64Array(steps+1));
    for(let step=0;step<=steps;step++){
      const frame=sample(step*duration/steps);
      for(const[key,wheels]of Object.entries(actors)){
        const pose=frame[key];if(!pose)continue;
        const rotation=new xa.Quaternion().setFromAxisAngle(new xa.Vector3(0,1,0),pose.heading),centres=wheels.map(wheel=>wheel.center.clone().setY(0).applyQuaternion(rotation).add(vec(pose.position)));
        if(previous[key])wheels.forEach((wheel,index)=>{const direction=new xa.Vector3(-1,0,0).applyAxisAngle(new xa.Vector3(0,1,0),pose.heading+(wheel.front?(pose.steer||0):0));tables[key][index][step]=tables[key][index][step-1]+centres[index].clone().sub(previous[key][index]).dot(direction);});
        previous[key]=centres;
      }
    }
    sceneTotals.set(scene,Object.fromEntries(Object.keys(actors).map(key=>[key,tables[key].map(values=>values[steps])])));
    wheelTotals.set(scene,sceneTotals.get(scene).mclaren);redWheelTotals.set(scene,sceneTotals.get(scene).redbull);wheelTables=tables;tableCache.set(scene,tables);setBaseline();return tables;
  }
  function wheelDistance(key,index,seconds) {
    if(!wheelTables)return 0;
    const t=Math.max(0,Math.min(wheelTables.steps,seconds/wheelTables.duration*wheelTables.steps));
    const low=Math.min(wheelTables.steps-1,Math.floor(t)),values=wheelTables[key][index];
    return values[low]+(values[low+1]-values[low])*(t-low);
  }
  function applyActor(key,group,controller,wheels,pose,seconds) {
    group.visible=!!pose&&pose.opacity>0;
    if(!pose)return;
    group.position.fromArray(pose.position);group.rotation.set(0,pose.heading,0);group.scale.setScalar(pose.scale||1);
    materialOpacity(controller.car,pose.opacity??1,pose.flat??0);
    wheels.forEach((wheel,index)=>{
      wheel.rolling.rotation.z=(baseAngles[key]?.[index]||0)+wheelDistance(key,index,seconds)/wheel.radius;
      wheel.steer.rotation.y=wheel.front?(pose.steer||0):0;
      wheel.setBlur(Math.min(.38,(pose.speed||0)/100));
    });
  }
  function render(pose,previousCamera=null,dry=false) {
    te();E=null;currentScene=pose.scene;frameCircuit(pose);frameSubjectFurniture(pose);researchStage.frame(pose);finishStage.frame(pose);
    applyActor('redbull',h,d,u,pose.redbull,pose.seconds);
    applyActor('mclaren',rival,mc,mc.wheels,pose.mclaren,pose.seconds);frameUpgrade(pose);
    for(const[key,entry]of Object.entries(extraCars)){
      applyActor(key,entry.group,entry.controller,entry.controller.wheels,pose[key],pose.seconds);entry.shadow.visible=pose[key]?.flat!==1;entry.shadow.material.opacity=.65*(1-(pose[key]?.flat||0));
    }
    const right=pose.circuitFrame?.route==='right';J.visible=pose.track>0&&!right;if(rightRoute)rightRoute.road.visible=pose.track>0&&right;T.visible=false;Y.fade(1);
    $e.visible=pose.redbull?.flat!==1;rivalShadow.visible=pose.mclaren?.flat!==1;
    rivalShadow.material.opacity=.65*(1-(pose.mclaren?.flat||0));
    i.fog.density=daylightFog;
    r.position.fromArray(pose.camera.position);r.up.set(0,1,0);
    r.lookAt(vec(pose.camera.target));r.fov=pose.camera.fov;
    const subjectDistances=allKeys.filter(key=>pose[key]?.opacity>0).map(key=>r.position.distanceTo(vec(pose[key].position)));
    const closest=subjectDistances.length?Math.min(...subjectDistances):r.position.distanceTo(vec(pose.camera.target));
    r.near=Math.max(.4,Math.min(80,closest*.18));r.updateProjectionMatrix();
    if(pose.camera.roll)r.rotateZ(pose.camera.roll);
    if(pose.camera.principal){r.projectionMatrix.elements[8]=-(pose.camera.principal[0]-800)/800;r.projectionMatrix.elements[9]=(pose.camera.principal[1]-450)/450;r.projectionMatrixInverse.copy(r.projectionMatrix).invert();}
    environment.update(pose.track,r);environment.group.visible=pose.track>0&&!right;if(rightRoute)rightRoute.scenery.visible=pose.track>0&&right;
    const focus=vec(pose.lightFocus||pose.camera.target);
    lightRig(focus);
    columns.visible=!!pose.trail&&pose.trail.opacity>0;
    if(pose.trail){
      const trail=pose.trail,shape=trail.shape,thickness=trail.height,depth=trail.depth;
      columns.scale.setScalar(trail.visualScale||1);
      columns.position.set(mixNumber(trail.x,pose.mclaren.position[0]-budgetConfig.repairWidth,shape),-.4,trail.z);columns.rotation.z=0;
      budgetFlat.value=pose.mclaren.flat||0;tileMaterials.forEach(material=>material.opacity=trail.opacity);
      let cumulative=0;
      budgetPosts.forEach((mesh,index)=>{
        const value=trail.amounts[index]*trail.growth[index],allocation=budgetConfig.repairWidth*value/2,height=allocation*(1+1.4*(1-shape));
        const seam=.17*shape*(1-(pose.mclaren.flat||0));mesh.visible=height>.001;
        mesh.scale.set(mixNumber(thickness,Math.max(.001,allocation-seam),shape),mixNumber(Math.max(.001,height-seam),thickness,shape),depth);
        // Each upright bill reshapes into its own portion of the horizontal budget.
        // The budget stays horizontal while its depth later collapses to 2D.
        mesh.rotation.z=0;
        mesh.position.set(mixNumber(4+index*13,cumulative+allocation/2,shape),mixNumber(height/2,-thickness/2,shape),-depth/2);
        cumulative+=allocation;
      });
      const unit=(budgetConfig.width-budgetConfig.repairWidth-budgetConfig.gap)/8,seam=.17*(1-(pose.mclaren.flat||0));development.visible=trail.development>.001;
      developmentPosts.forEach((mesh,index)=>{const growth=Math.max(0,Math.min(1,trail.development*8-index));mesh.visible=growth>.001;mesh.scale.set(Math.max(.001,(unit-seam)*growth),thickness,depth);mesh.position.set(budgetConfig.repairWidth+budgetConfig.gap+unit*index+unit*growth/2+1.5*(1-growth),-thickness/2,-depth/2);});
    }
    skidGroup.visible=pose.scene==='overtake'&&pose.skid>0&&pose.track>.001;
    skidMaterial.opacity=.5*pose.track;
    for(const mesh of skidMeshes)mesh.geometry.setDrawRange(0,Math.floor((pose.skid||0)*skidSegments)*6);
    haze.forEach((sprite,index)=>{
      const puff=pose.smoke?.[index];sprite.visible=!!puff&&puff.opacity>.001;
      if(!puff)return;sprite.position.fromArray(puff.position);sprite.scale.set(puff.width,puff.height,1);sprite.material.opacity=puff.opacity;
    });
    gridOpening.follow(pose);
    i.updateMatrixWorld(true);r.updateMatrixWorld(true);
    if(pose.marker>0){
      // Place only the car during the same flattening that registers the budget.
      // The canvas has no extra settle animation after the 2D bar takes over.
      const startPosition=rival.position.clone(),startScale=rival.scale.x;
      const top=project(new xa.Vector3(0,0,0).applyMatrix4(columns.matrixWorld)),right=project(new xa.Vector3(budgetConfig.width,0,0).applyMatrix4(columns.matrixWorld)),boundary=project(new xa.Vector3(budgetConfig.repairWidth,0,0).applyMatrix4(columns.matrixWorld));
      const faceScale=1440/Math.hypot(right.x-top.x,right.y-top.y),goalWidth=110/faceScale,goalBottom=top.y-8/faceScale;
      const carBox=()=>{const points=localCarCorners.map(point=>project(point.clone().applyMatrix4(rival.matrixWorld)));return{x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),height:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))};};
      for(let iteration=0;iteration<3;iteration++){
        let box=carBox();rival.scale.multiplyScalar(goalWidth/box.width);rival.updateMatrixWorld(true);box=carBox();
        const center=rival.position.clone().project(r),source=new xa.Vector3(center.x,center.y,center.z).unproject(r),target=new xa.Vector3(center.x+(boundary.x-box.x-box.width/2)/800,center.y-(goalBottom-box.y-box.height)/450,center.z).unproject(r);
        rival.position.add(target.sub(source));rival.updateMatrixWorld(true);
      }
      rival.position.lerp(startPosition,1-pose.marker);rival.scale.setScalar(mixNumber(startScale,rival.scale.x,pose.marker));rival.updateMatrixWorld(true);
    }
    window.__F1CinematicPreviousCamera=previousCamera||pose.camera;
    if(!dry){frameRendering(pose.lightFocus||pose.mclaren?.position||pose.redbull?.position||pose.cadillac?.position||pose.ferrari?.position);worldDissolve.render(pose.track,[...(pose.worldActors||[]).map(key=>actorGroups()[key]),...gridOpening.backgroundGroups()]);}

    const anchors=mc.wheels.map(wheel=>({name:wheel.steer.name,front:wheel.front,lateral:wheel.center.z,...project(wheel.steer.getWorldPosition(new xa.Vector3()))}));
    let costTrail=null,budgetProjection=null;
    if(pose.trail){
      const localPoint=(x,y,z=0)=>project(new xa.Vector3(x,y,z).applyMatrix4(columns.matrixWorld)),thickness=pose.trail.height;
      const posts=budgetPosts.map((mesh,index)=>({point:localPoint(mesh.position.x,mesh.position.y+(Math.abs(Math.sin(mesh.rotation.z))*mesh.scale.x+Math.abs(Math.cos(mesh.rotation.z))*mesh.scale.y)/2),amount:pose.trail.amounts[index],growth:pose.trail.growth[index]}));
      costTrail={posts,tip:localPoint(24,25),total:pose.trail.total,progress:pose.trail.progress};
      budgetProjection={top:[localPoint(0,0),localPoint(budgetConfig.width,0)],bottom:[localPoint(0,-thickness),localPoint(budgetConfig.width,-thickness)],
        labels:[localPoint(budgetConfig.repairWidth*.5,13),localPoint((budgetConfig.width+budgetConfig.repairWidth)/2,13)],depth:pose.trail.depth,height:thickness,shape:pose.trail.shape,layout:'horizontal'};
    }
    const corners=localCarCorners.map(point=>project(point.clone().applyMatrix4(rival.matrixWorld)));
    const bounds={x:Math.min(...corners.map(p=>p.x)),y:Math.min(...corners.map(p=>p.y)),width:Math.max(...corners.map(p=>p.x))-Math.min(...corners.map(p=>p.x)),height:Math.max(...corners.map(p=>p.y))-Math.min(...corners.map(p=>p.y))};
    const redCorners=redCarCorners.map(point=>project(point.clone().applyMatrix4(h.matrixWorld)));
    const redBounds={x:Math.min(...redCorners.map(p=>p.x)),y:Math.min(...redCorners.map(p=>p.y)),width:Math.max(...redCorners.map(p=>p.x))-Math.min(...redCorners.map(p=>p.x)),height:Math.max(...redCorners.map(p=>p.y))-Math.min(...redCorners.map(p=>p.y))};
    last={scene:currentScene,seconds:pose.seconds,camera:pose.camera,redbull:pose.redbull,mclaren:pose.mclaren,anchors,bounds,costTrail,budgetProjection,track:pose.track,quality:pixelRatio(),wheelAngles:{redbull:u.map(w=>w.rolling.rotation.z),mclaren:mc.wheels.map(w=>w.rolling.rotation.z)},steering:mc.wheels.map(w=>w.steer.rotation.y),upgrade:pose.upgrade||null,upgradeParts:wingParts.map(entry=>({key:entry.key,position:entry.part.position.toArray(),scale:entry.part.scale.toArray(),highlight:.09*(pose.upgrade?.[entry.key+'Lift']||0),mountOutline:false}))};
    last.finish=finishStage.state();last.inspection=pose.inspectionGrid?{...pose.inspectionGrid,mates:pose.inspectionMates.length}:null;last.research=researchStage.getState();last.scopeAnchors=researchStage.scopeAnchors().map(project);last.researchAnchors=Object.fromEntries(Object.entries(researchStage.anchors()).map(([key,points])=>[key,points.map(project)]));
    last.depth={near:r.near,far:r.far,shadowResolution:a.shadow.mapSize.toArray()};
    last.worldActors=pose.worldActors||[];last.displayActors=allKeys.filter(key=>pose[key]?.opacity>0&&(pose.track>0||!last.worldActors.includes(key)));
    last.actorBounds={mclaren:bounds,redbull:redBounds};last.actors={mclaren:pose.mclaren,redbull:pose.redbull};
    for(const[key,entry]of Object.entries(extraCars)){
      const points=entry.corners.map(point=>project(point.clone().applyMatrix4(entry.group.matrixWorld))),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
      last.actorBounds[key]={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
      last.actors[key]=pose[key];last.wheelAngles[key]=entry.controller.wheels.map(w=>w.rolling.rotation.z);
    }return last;
  }
  function captureSilhouette(pose,team='mclaren'){
    // One GPU readback during preparation, never during animation. The vector
    // comes from the actual projected GLB, including its wheels and wing.
    const target=new xa.WebGLRenderTarget(1600,900),pixels=new Uint8Array(1600*900*4),oldTarget=n.getRenderTarget(),oldColor=n.getClearColor(new xa.Color()),oldAlpha=n.getClearAlpha(),background=i.background;
    const isolated=Object.fromEntries(allKeys.map(key=>[key,key===team?{...pose[key],flat:1,opacity:1,speed:0}:null]));
    // Isolate the actual car, including all cloned grid cars and ceremonial props.
    // A mate left in this offscreen pass becomes a false second silhouette.
    render({...pose,...isolated,convoy:null,inspectionGrid:null,inspectionMates:[],distantTraffic:null,finish:null,worldActors:[],track:0},null,true);
    i.background=null;n.setRenderTarget(target);n.setClearColor(0x000000,0);n.clear();n.render(i,r);n.readRenderTargetPixels(target,0,0,1600,900,pixels);
    n.setRenderTarget(oldTarget);n.setClearColor(oldColor,oldAlpha);i.background=background;target.dispose();
    const mask=new Uint8Array(1600*900),edges=new Map(),stride=1601;
    for(let y=0;y<900;y++)for(let x=0;x<1600;x++)mask[y*1600+x]=pixels[((899-y)*1600+x)*4+3]>80?1:0;
    const filled=(x,y)=>x>=0&&x<1600&&y>=0&&y<900&&mask[y*1600+x];
    const edge=(ax,ay,bx,by)=>{const key=ay*stride+ax;const list=edges.get(key)||[];list.push(by*stride+bx);edges.set(key,list);};
    for(let y=0;y<900;y++)for(let x=0;x<1600;x++)if(filled(x,y)){
      if(!filled(x,y-1))edge(x,y,x+1,y);if(!filled(x+1,y))edge(x+1,y,x+1,y+1);
      if(!filled(x,y+1))edge(x+1,y+1,x,y+1);if(!filled(x-1,y))edge(x,y+1,x,y);
    }
    const loops=[];
    while(edges.size){
      const start=edges.keys().next().value,points=[];let key=start,guard=0;
      do{points.push([key%stride,Math.floor(key/stride)]);const list=edges.get(key);if(!list)break;const next=list.pop();if(!list.length)edges.delete(key);key=next;}while(key!==start&&guard++<20000);
      if(points.length<12)continue;
      let area=0;for(let k=0;k<points.length;k++){const p=points[k],q=points[(k+1)%points.length];area+=p[0]*q[1]-q[0]*p[1];}
      if(area<24)continue;
      const simplified=points.filter((p,k)=>{const a=points[(k+points.length-1)%points.length],b=points[(k+1)%points.length];return(p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});
      loops.push({area:area/2,points:simplified});
    }
    loops.sort((a,b)=>b.area-a.area);return{loops,path:loops.map(loop=>'M'+loop.points.map(p=>p.join(',')).join('L')+'Z').join(''),bounds:last.actorBounds[team]};
  }
  function sampleBackdrop(rect){
    // Preparation only. Sampling the composed scene avoids blanket white
    // panels and never adds GPU readback to live playback.
    const gl=n.getContext(),sx=gl.drawingBufferWidth/1600,sy=gl.drawingBufferHeight/900;
    const x=Math.max(0,Math.floor(rect.x*sx)),y=Math.max(0,Math.floor((900-rect.y-rect.height)*sy));
    const w=Math.min(gl.drawingBufferWidth-x,Math.ceil(rect.width*sx)),h=Math.min(gl.drawingBufferHeight-y,Math.ceil(rect.height*sy)),pixels=new Uint8Array(w*h*4),values=[];
    gl.readPixels(x,y,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    const linear=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);
    for(let row=0;row<h;row+=Math.max(1,Math.floor(h/18)))for(let col=0;col<w;col+=Math.max(1,Math.floor(w/48))){const k=(row*w+col)*4,alpha=pixels[k+3]/255;values.push([0,1,2].reduce((sum,j)=>sum+linear((pixels[k+j]*alpha+[12,18,26][j]*(1-alpha))/255)*[.2126,.7152,.0722][j],0));}
    values.sort((a,b)=>a-b);return{mean:values.reduce((s,v)=>s+v,0)/values.length,low:values[Math.floor(values.length*.15)],high:values[Math.floor(values.length*.85)]};
  }
  function surfaceState(){
    return Object.fromEntries(Object.entries({redbull:d.car,mclaren:mc.car,...Object.fromEntries(Object.entries(extraCars).map(([key,entry])=>[key,entry.controller.car]))}).map(([key,car])=>{
      const materials=[];const seen=new Set();car?.traverse(mesh=>{if(!mesh.isMesh)return;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        if(seen.has(material))continue;seen.add(material);
        const original=alphaStates.get(material),profile=material.userData.f1SurfaceProfile;
        materials.push({name:material.name,family:profile?.family||'original',nativeTransparent:profile?.nativeTransparent??original?.transparent,nativeAlphaTest:profile?.nativeAlphaTest??original?.alphaTest,transparent:material.transparent,alphaTest:material.alphaTest,depthWrite:material.depthWrite,opacity:material.opacity,actorOpacity:flatUniforms.get(material)?.opacity.value??1,metalness:material.metalness,roughness:material.roughness,clearcoat:material.clearcoat??0});
      }});return[key,materials];
    }));
  }
  function verifyWorldDissolve(pose){
    render({...pose,track:1,blur:false});
    const size=n.getDrawingBufferSize(new xa.Vector2()),gl=n.getContext(),before=new Uint8Array(size.x*size.y*4),after=new Uint8Array(before.length);
    gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,before);
    worldDissolve.render(.9999);gl.readPixels(0,0,size.x,size.y,gl.RGBA,gl.UNSIGNED_BYTE,after);
    let sum=0,max=0,changed=0;for(let k=0;k<before.length;k++){const d=Math.abs(before[k]-after[k]);sum+=d;max=Math.max(max,d);if(d>3)changed++;}
    let quietSum=0,quietCount=0;for(let y=1;y<size.y-1;y++)for(let x=1;x<size.x-1;x++){const k=(y*size.x+x)*4;let gradient=0;for(const off of[-4,4,-size.x*4,size.x*4])for(let c=0;c<3;c++)gradient=Math.max(gradient,Math.abs(before[k+c]-before[k+off+c]));if(gradient<4){for(let c=0;c<3;c++)quietSum+=Math.abs(before[k+c]-after[k+c]);quietCount+=3;}}
    render(pose);return{width:size.x,height:size.y,quietMeanAbsoluteDifference:quietSum/quietCount,meanAbsoluteChannelDifference:sum/before.length,maxChannelDifference:max,channelsOver3:changed,scope:'Native render versus 0.9999 world dissolve; one diagnostic readback'};
  }
  function textureState(){
    const actors={redbull:d.car,mclaren:mc.car,...Object.fromEntries(Object.entries(extraCars).map(([key,entry])=>[key,entry.controller.car]))},textures={};
    for(const[key,car]of Object.entries(actors)){const seen=new Set(),values=[];car?.traverse(mesh=>{if(!mesh.isMesh)return;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const[slot,map]of Object.entries(mat))if(map?.isTexture&&!seen.has(map)){seen.add(map);const image=map.image||map.source?.data;values.push({material:mat.name,slot,width:image?.width,height:image?.height,anisotropy:map.anisotropy,minFilter:map.minFilter,magFilter:map.magFilter,generateMipmaps:map.generateMipmaps,colorSpace:map.colorSpace});}});textures[key]=values;}
    const size=n.getDrawingBufferSize(new xa.Vector2());return{textures,width:size.x,height:size.y,pixelRatio:n.getPixelRatio(),maxAnisotropy:n.capabilities.getMaxAnisotropy(),lodPolicy:'UV-seam-preserving; focal-length-aware'};
  }
  return Object.freeze({prepare,warmup,reset,render,textureState,
    renderGridOpening,
    appearanceState(){return{fogDensity:i.fog.density,fogColor:i.fog.color.getHexString(),farTraffic:gridOpening.backgroundGroups().map(group=>group.name)};},
    routeState(){return [J,environment.group,rightRoute?.road,rightRoute?.scenery].filter(Boolean).map(root=>({name:root.name,visible:root.visible,position:root.position.toArray(),scale:root.scale.toArray(),meshes:root.children.filter(o=>o.isMesh).slice(0,9).map(o=>({name:o.name,visible:o.visible,box:new xa.Box3().setFromObject(o),vertices:o.geometry.attributes.position?.count}))}));},openingDuration:31,playbackMetrics(){return {frames:playbackTrace.slice(),drawCalls:n.info.render.calls,triangles:n.info.render.triangles,pixelRatio:n.getPixelRatio()};},gridInspectionState(){return gridOpening.inspectionState();},gridState(){return gridOpening.state();},worldState(){return window.__F1WorldDissolve;},rearWingPartition(){return window.__F1RearWingPartition;},configureBudget,captureSilhouette,sampleBackdrop,makeWheelTables,captureBaseAngles,setPlayback,sampleFrame,pixelRatio,verifyWorldDissolve,inspectCorridor,sceneryState,surfaceState,
    frameOpening(seconds,moving){
      frameCircuit(null);
      frameFurniture(moving&&seconds>=2.8&&seconds<6.65);
      environment.update(moving?1-z((seconds/8.4-.72)/.06):0,r);i.fog.density=daylightFog;
      lightRig(h.position);
      frameRendering(h.position.toArray());
    },
    get ready(){return prepared;},getState(){return last;},
    openingEnd(){const point=j.getPointAt(ee(1)),forward=j.getTangentAt(ee(1));return{position:point.toArray(),forward:forward.toArray(),heading:Math.atan2(forward.z,-forward.x)};},
    circuit(){return{turnStart:Y.turnStart,turnEnd:Y.turnEnd,sample(station,lateral){return{position:Y.lane(station,lateral,0).toArray(),heading:Y.heading(station),curvature:(Y.heading(station+.5)-Y.heading(station-.5))};}};},
    footprints(){return Object.fromEntries(Object.entries({mclaren:localCarCorners,redbull:redCarCorners,...Object.fromEntries(Object.entries(extraCars).map(([key,entry])=>[key,entry.corners]))}).map(([key,points])=>[key,{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))}]));},
    upgradeMountInfo(){
      let error=0;for(const entry of frontRevisionMeshes)for(const k of entry.lockedOffsets)for(let a=0;a<3;a++)error=Math.max(error,Math.abs(entry.geometry.attributes.position.array[k+a]-entry.homePosition[k+a]));
      const part=wingParts.find(entry=>entry.key==='front');return{error,lockedVertices:frontRevisionMeshes.reduce((n,entry)=>n+entry.locked,0),position:part.part.position.toArray(),scale:part.part.scale.toArray(),rotation:part.part.rotation.toArray().slice(0,3)};
    },
    materialInfo(){const result=[];for(const car of[d.car,mc.car])car?.traverse(object=>{if(object.isMesh)for(const material of Array.isArray(object.material)?object.material:[object.material])if(/^details$/i.test(material.name)&&!result.some(entry=>entry.uuid===material.uuid))result.push({uuid:material.uuid,name:material.name,neutral:!!material.userData.f1NeutralMetal,metalness:material.metalness,roughness:material.roughness});});return result;},
    wheelInfo(){return Object.fromEntries(Object.entries(actorWheels()).map(([key,wheels])=>[key,wheels.map(w=>({name:w.steer.name,front:w.front,radius:w.radius,center:w.center.toArray(),axis:new xa.Vector3(0,0,1).applyQuaternion(w.axle.quaternion).toArray()}))]));}
  });
})();
