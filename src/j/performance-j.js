/* J: avoid repeated static-scene work and batch exact grid-car shadow surfaces.
   Actor/camera samplers, material quality, resolution and geometry stay intact. */
window.F1PerformanceJ=(()=>{
 let T,renderer,scene,grid=[],prepared=false,enabled=true,shadowBatch=true;
 const roots=[],proxies=[],shadowSwaps=[],meshBases=new Map(),geometryCache=new Map(),depthMaterials=new Map();
 const counts={staticRoots:0,shadowBatches:0,shadowSourceMeshes:0,shadowGeometries:0,cacheHits:0,staticCullMeshes:0,staticBoundUpdates:0,staticCullHits:0,staticCullTests:0};
 let tailRoot=null,tailList=[],matrixEpoch=0,culling;const mergePending=new Map();let baseList=[];
 const local=o=>[o.position.x,o.position.y,o.position.z,o.quaternion.x,o.quaternion.y,o.quaternion.z,o.quaternion.w,o.scale.x,o.scale.y,o.scale.z];
 function same(a,b){if(!a||!b||a.length!==b.length)return false;for(let k=0;k<a.length;k++)if(a[k]!==b[k])return false;return true;}
 function cacheRoot(root){
  const original=root.updateMatrixWorld;let stamp=-1,trs=null,localMatrix=null,parentMatrix=null,revision=0;
  root.updateMatrixWorld=function(force){
   if(!enabled)return original.call(this,force);
   const values=local(this),parent=this.parent?.matrixWorld.elements;
   if(stamp===matrixEpoch&&!this.matrixWorldNeedsUpdate&&same(values,trs)&&same(this.matrix.elements,localMatrix)&&same(parent,parentMatrix))return;
   original.call(this,true);revision++;stamp=matrixEpoch;trs=values;localMatrix=this.matrix.elements.slice();parentMatrix=parent?.slice();
  };
  culling?.register(root,()=>revision);
  roots.push(root);
 }
 function cachedTailNodes(world){
  if(!tailRoot||tailRoot.parent!==world){
   tailRoot=world.children.find(o=>o.name==='Monza_right_route_scenery');tailList=[];
   tailRoot?.traverse(mesh=>{if(mesh.userData.f1TailForest)tailList.push(mesh);});
  }
  return tailList;
 }
 function hostFor(mesh,entry){
  for(let node=mesh.parent;node;node=node.parent){
   if(node===entry.car)return node;
   if(entry.wheels.some(w=>node===w.rolling||node===w.steer))return node;
  }
  return null;
 }
 function alive(mesh,stop){for(let n=mesh;n&&n!==stop;n=n.parent)if(!n.visible)return false;return true;}
 function eligible(mesh,entry){
  const m=mesh.material,g=mesh.geometry;
  return mesh.isMesh&&!mesh.isSkinnedMesh&&!mesh.isInstancedMesh&&!Array.isArray(m)&&m?.isMeshStandardMaterial&&
   !m.transparent&&!m.alphaTest&&!m.alphaMap&&!m.displacementMap&&!m.clippingPlanes&&!m.polygonOffset&&m.depthTest!==false&&
   m.userData.f1SurfaceProfile?.family!=='decal'&&!mesh.customDepthMaterial&&!g.morphAttributes.position?.length&&
   g.attributes.position&&alive(mesh,entry.car);
 }
 function mergePositions(items,host,level){
  const inverse=host.matrixWorld.clone().invert();
  const parts=items.map(item=>({geometry:item[level],matrix:inverse.clone().multiply(item.mesh.matrixWorld)}));
  const key=parts.map(p=>p.geometry.uuid+':'+p.matrix.elements.map(v=>Math.round(v*1e8)).join(',')).join(';');
  if(geometryCache.has(key)){counts.cacheHits++;return geometryCache.get(key);}
  let vertices=0,indices=0;
  for(const {geometry:g}of parts){vertices+=g.attributes.position.count;const available=g.index?.count??g.attributes.position.count;indices+=Math.floor(Math.min(available-g.drawRange.start,g.drawRange.count)/3)*3;}
  const positions=new Float32Array(vertices*3),index=new Uint32Array(indices),point=new T.Vector3();let vertex=0,cursor=0;
  for(const {geometry:g,matrix}of parts){
   const p=g.attributes.position;
   for(let k=0;k<p.count;k++){point.fromBufferAttribute(p,k).applyMatrix4(matrix);point.toArray(positions,(vertex+k)*3);}
   const end=Math.min(g.index?.count??p.count,g.drawRange.start+g.drawRange.count),flip=matrix.determinant()<0;
   for(let k=g.drawRange.start;k+2<end;k+=3){
    const a=g.index?g.index.getX(k):k,b=g.index?g.index.getX(k+1):k+1,c=g.index?g.index.getX(k+2):k+2;
    index[cursor++]=vertex+a;index[cursor++]=vertex+(flip?c:b);index[cursor++]=vertex+(flip?b:c);
   }
   vertex+=p.count;
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setIndex(new T.BufferAttribute(index,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();
  geometryCache.set(key,geometry);counts.shadowGeometries++;return geometry;
 }
 function materialFor(source){
  const key=source.side+':'+source.shadowSide;
  if(!depthMaterials.has(key))depthMaterials.set(key,new T.MeshBasicMaterial({name:'J shadow-only submission',side:source.side,shadowSide:source.shadowSide,colorWrite:false,depthWrite:false}));
  return depthMaterials.get(key);
 }
 async function mergeParallel(items,host,level){
  const inverse=host.matrixWorld.clone().invert();
  const parts=items.map(item=>({geometry:item[level],matrix:inverse.clone().multiply(item.mesh.matrixWorld)}));
  const key=parts.map(p=>p.geometry.uuid+':'+p.matrix.elements.map(v=>Math.round(v*1e8)).join(',')).join(';');
  if(geometryCache.has(key)){counts.cacheHits++;return geometryCache.get(key);}
  if(mergePending.has(key)){counts.cacheHits++;return mergePending.get(key);}
  const pending=window.F1ParallelK.merge(T,parts).then(geometry=>{geometryCache.set(key,geometry);counts.shadowGeometries++;mergePending.delete(key);return geometry;});
  mergePending.set(key,pending);return pending;
 }
 async function prepare(){
  if(prepared)return;
  window.F1ParallelK.beginPhase("shadows");scene.updateMatrixWorld(true);
  for(const entry of grid){
   if(entry.primary)continue;const buckets=new Map();
   for(const item of entry.meshes){
    if(!eligible(item.mesh,entry))continue;
    const host=hostFor(item.mesh,entry);if(!host)continue;const m=item.mesh.material,key=host.uuid+':'+m.side+':'+m.shadowSide;
    if(!buckets.has(key))buckets.set(key,{host,items:[],material:materialFor(m)});
    buckets.get(key).items.push(item);
   }
   await Promise.all([...buckets.values()].map(async({host,items,material})=>{
    // Keep single-mesh submissions unchanged. Only combine genuinely separate draws.
    if(items.length<2)return;
    const levels=Object.fromEntries(await Promise.all(['full','mid','far'].map(async level=>[level,await mergeParallel(items,host,level)])));
    const proxy=new T.Mesh(levels.full,material);proxy.name='J_exact_grid_shadow_'+entry.index+'_'+proxies.length;proxy.userData.f1JShadow=true;proxy.visible=false;proxy.castShadow=true;proxy.receiveShadow=false;host.add(proxy);
    const record={entry,host,items,levels,proxy,cast:false};proxies.push(record);
    for(const item of items)if(!meshBases.has(item.mesh))meshBases.set(item.mesh,{cast:item.mesh.castShadow,nativeCast:item.mesh.castShadow});
    counts.shadowSourceMeshes+=items.length;counts.shadowBatches++;
   }));
   await window.F1Boot?.tick();
  }
  // These hierarchies only change transforms at explicit circuit-frame changes.
  // Instance matrices, visibility and material updates do not move their nodes.
  freezeStatic();
  counts.staticRoots=roots.length;baseList=[...meshBases];prepared=true;window.F1ParallelK.endPhase("shadows");
 }
 function afterLighting(){
  if(!prepared||renderer.shadowMap.autoUpdate===false&&renderer.shadowMap.needsUpdate===false)return;
  for(let k=0;k<baseList.length;k++){const pair=baseList[k];pair[1].nativeCast=pair[0].castShadow;}
  const use=enabled&&shadowBatch&&window.F1LightStudy.enabled;
  for(const record of proxies){
   record.cast=use&&record.items.some(item=>item.mesh.castShadow&&alive(item.mesh,record.entry.group))&&alive(record.entry.group,null);
   if(window.F1ParallelK.warming)record.cast=true;
   const level=shadowLevel(record.entry);record.proxy.geometry=record.levels[level];record.proxy.visible=false;
   if(use)for(const item of record.items)item.mesh.castShadow=false;
  }
 }
 function fixedGridShadows(){return window.F1SurfaceJ?.openingShadows&&!window.F1ParallelK?.warming;}
 function shadowLevel(entry){
  if(fixedGridShadows())return entry.index<6?'mid':'far';
  return ['full','mid','far'][Math.max(0,entry.lod)];
 }
 function setEnabled(value,shadows=true){
  enabled=!!value;shadowBatch=!!shadows;matrixEpoch++;
  window.F1SurfaceJ?.invalidateShadow();
  for(const[mesh,base]of meshBases)mesh.castShadow=base.nativeCast;
  for(const record of proxies){record.cast=false;record.proxy.visible=false;}
 }
 function setup(three,render,world){
  T=three;renderer=render;scene=world;
  culling=window.createF1StaticCullingJ?.(T,()=>enabled&&window.F1ParallelK?.enabled!==false,counts);
  const renderShadows=renderer.shadowMap.render.bind(renderer.shadowMap);
  renderer.shadowMap.render=function(...args){
   if(renderer.shadowMap.enabled===false||renderer.shadowMap.autoUpdate===false&&renderer.shadowMap.needsUpdate===false||args[0]?.length===0)
    return renderShadows(...args);
   // Main render-list collection sees proxies hidden. The separate native
   // shadow traversal sees them only during this call, so no colour pass is added.
   for(const record of proxies)record.proxy.visible=record.cast;
   if(fixedGridShadows())for(const entry of grid){
    if(entry.primary||!entry.group.visible)continue;
    const level=shadowLevel(entry);
    for(const item of entry.meshes){
     if(!item.mesh.castShadow||item.mesh.geometry===item[level])continue;
     item.colorGeometry=item.mesh.geometry;item.mesh.geometry=item[level];shadowSwaps.push(item);
    }
   }
   try{
    const result=renderShadows(...args);
    window.F1SurfaceJ?.shadowDrawn(args[0]);
    return result;
   }finally{
    for(const record of proxies)record.proxy.visible=false;
    for(const item of shadowSwaps){item.mesh.geometry=item.colorGeometry;item.colorGeometry=null;}
    shadowSwaps.length=0;
   }
  };
 }
 const lightSetup=window.F1LightStudy.setup;window.F1LightStudy.setup=function(...args){lightSetup(...args);setup(...args);};
 const before=window.F1LightStudy.beforeRender;window.F1LightStudy.beforeRender=function(...args){before(...args);afterLighting();};
 function state(){return{enabled,shadowBatch,prepared,...counts,activeShadowBatches:proxies.filter(p=>p.cast).length,changedCamera:false,changedTrajectories:false,changedResolution:false,workerCount:window.F1ParallelK.state().activeWorkers};}
 function matrixProbe(){return[...roots,...grid.flatMap(entry=>[entry.group,...entry.wheels.flatMap(w=>[w.steer,w.rolling])])].map(o=>({name:o.name,matrix:o.matrixWorld.elements.slice()}));}
 async function warmVariants(draw){
  const saved=[];for(const entry of grid)entry.car.traverse(mesh=>{if(mesh.isMesh){saved.push([mesh,mesh.frustumCulled]);mesh.frustumCulled=false;}});
  for(const record of proxies){saved.push([record.proxy,record.proxy.frustumCulled]);record.proxy.frustumCulled=false;}
  window.F1ParallelK.beginPhase('gpu-variants');
  try{for(const level of[0,1,2]){window.F1ParallelK.forcedLod=level;draw(20);await window.F1Boot?.tick();}}
  finally{window.F1ParallelK.forcedLod=null;for(const[mesh,value]of saved)mesh.frustumCulled=value;draw(0);window.F1ParallelK.endPhase('gpu-variants');}
 }
 function freezeStatic(){for(const root of scene.children)if(['APEX_CIRCUIT_V10','Circuit_scenery','Monza_right_route_road','Monza_right_route_scenery'].includes(root.name)&&!roots.includes(root))cacheRoot(root);counts.staticRoots=roots.length;}
 return{prepare,freezeStatic,warmVariants,setEnabled,state,cachedTailNodes,matrixProbe,registerGrid(entries){grid=entries;},invalidateStatic(){matrixEpoch++;},get enabled(){return enabled;},testing:{mergePositions,setup}};
})();
