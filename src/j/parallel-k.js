/* K: bounded real Worker pool for startup, retained immutable render resources. */
window.F1ParallelK=(()=>{
 const started=performance.now(),metrics={logicalThreads:navigator.hardwareConcurrency||0,configuredWorkers:0,workersStarted:0,peakActive:0,jobs:0,completed:0,workerCpuMs:0,phases:{},fallback:null,released:false,preparedVertices:0},queue=[],workers=[],all=new Map();
 let sequence=0,active=0,sourceURL=null,bootPromise=null,enabled=true,forcedLod=null,fatal=null;
 const threadOption=new URLSearchParams(location.search).get('workers'),limit=threadOption==='0'?0:Math.min(6,Math.max(1,(navigator.hardwareConcurrency||4)-2));
 const tick=()=>window.F1Boot?.tick()||new Promise(resolve=>setTimeout(resolve,0));
 async function init(){
  if(bootPromise)return bootPromise;
  bootPromise=(async()=>{
   if(!limit||typeof Worker==='undefined'){metrics.fallback=limit?'Web Worker unavailable':'requested single-thread preparation';return;}
   sourceURL=URL.createObjectURL(new Blob([document.getElementById('f1-k-worker-source').textContent],{type:'text/javascript'}));
   try{
    await Promise.all(Array.from({length:limit},async()=>{
     const worker=new Worker(sourceURL,{name:'F1 geometry preparation'}),slot={worker,busy:false,job:null};workers.push(slot);
     await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Worker startup timed out')),15000);worker.onmessage=event=>{if(event.data.ready){clearTimeout(timeout);metrics.workersStarted++;resolve();}};worker.onerror=error=>{clearTimeout(timeout);reject(new Error(error.message));};});
     worker.onmessage=event=>{const msg=event.data,job=slot.job;if(!job||job.id!==msg.id)return;slot.job=null;slot.busy=false;active--;all.delete(job.id);metrics.completed++;metrics.workerCpuMs+=msg.ms||0;msg.error?job.reject(new Error(msg.error)):job.resolve(msg.result);pump();};
     worker.onerror=error=>{fatal=new Error(error.message);metrics.fallback=error.message;for(const job of all.values())job.reject(fatal);all.clear();queue.length=0;for(const slot of workers)slot.worker.terminate();workers.length=0;active=0;};
    }));metrics.configuredWorkers=workers.length;
   }catch(error){metrics.fallback=String(error);for(const s of workers)s.worker.terminate();workers.length=0;metrics.configuredWorkers=0;}
  })();return bootPromise;
 }
 function pump(){
  for(const slot of workers){if(slot.busy||!queue.length)continue;const job=queue.shift();slot.busy=true;slot.job=job;active++;metrics.peakActive=Math.max(metrics.peakActive,active);
   try{const data=job.build();slot.worker.postMessage({id:job.id,kind:job.kind,data},window.F1GeometryKernel.buffers(data));}catch(error){slot.busy=false;slot.job=null;active--;all.delete(job.id);job.reject(error);}
  }
 }
 async function submit(kind,build){
  await init();if(fatal)throw fatal;metrics.jobs++;
  if(!workers.length){await tick();const start=performance.now(),result=window.F1GeometryKernel.execute(kind,build());metrics.completed++;metrics.workerCpuMs+=performance.now()-start;return result;}
  return new Promise((resolve,reject)=>{const job={id:++sequence,kind,build,resolve,reject};queue.push(job);all.set(job.id,job);pump();});
 }
 function array(attribute){
  if(attribute.isInterleavedBufferAttribute){const raw=new attribute.data.array.constructor(attribute.count*attribute.itemSize);for(let k=0;k<attribute.count;k++)for(let j=0;j<attribute.itemSize;j++)raw[k*attribute.itemSize+j]=attribute.data.array[k*attribute.data.stride+attribute.offset+j];return raw;}
  return attribute.array.slice();
 }
 function hydrate(T,data){
  const geometry=new T.BufferGeometry();for(const[name,a]of Object.entries(data.attributes))geometry.setAttribute(name,new T.BufferAttribute(a.array,a.itemSize));geometry.setIndex(new T.BufferAttribute(data.index,1));
  const b=data.bounds;geometry.boundingBox=new T.Box3(new T.Vector3(...b.min),new T.Vector3(...b.max));geometry.boundingSphere=new T.Sphere(new T.Vector3(...b.center),b.radius);return geometry;
 }
 async function prepareLods(T,templates){
  const start=performance.now(),levels=new WeakMap(),specs=[],seen=new Set();await init();
  for(const source of templates)source.car.traverse(mesh=>{if(!mesh.isMesh||seen.has(mesh.geometry))return;seen.add(mesh.geometry);const wheel=/Wheel/.test(mesh.parent?.name||'')||/sidewall|tread|hub|disc/.test(Array.isArray(mesh.material)?mesh.material[0].name:mesh.material.name);specs.push({geometry:mesh.geometry,wheel});});
  let done=0;window.F1Boot?.update(70,'多核生成赛车 LOD 0/'+specs.length);
  await Promise.all(specs.map(async({geometry,wheel})=>{
   const result=await submit('lod',()=>({source:{attributes:Object.fromEntries(Object.entries(geometry.attributes).map(([name,a])=>[name,{array:array(a),itemSize:a.itemSize}])),index:geometry.index?.array.slice()},cells:wheel?[.035,.055]:[.065,.11]}));
   levels.set(geometry,{full:geometry,mid:hydrate(T,result[0]),far:hydrate(T,result[1])});metrics.preparedVertices+=geometry.attributes.position.count;
   if(++done%24===0||done===specs.length){window.F1Boot?.update(70+3*done/specs.length,'多核生成赛车 LOD '+done+'/'+specs.length);await tick();}
  }));metrics.phases.lod={ms:performance.now()-start,geometries:specs.length};return levels;
 }
 async function merge(T,parts){const result=await submit('shadow',()=>parts.map(p=>({position:array(p.geometry.attributes.position),index:p.geometry.index?.array.slice(),matrix:p.matrix.elements.slice(),flip:p.matrix.determinant()<0,start:p.geometry.drawRange.start,count:p.geometry.drawRange.count})));return hydrate(T,result);}
 const architecture=entry=>/^(?:Far_)?(?:Grandstand_|Spectator_|Imported_Monza_(?:gstand|roof|crowd))/.test(entry.object.name);
 function serializeRays(rays){const data=new Float64Array(rays.length*9),planes=new Float64Array(rays.filter(r=>r.foreground).length*24);let plane=0;rays.forEach((s,index)=>{const k=index*9,o=s.foreground?s.origin:s.ray.origin;data[k]=s.foreground?plane+1:0;data[k+1]=s.right?1:0;o.toArray(data,k+2);if(s.ray)s.ray.direction.toArray(data,k+5);data[k+8]=s.length;if(s.foreground){s.frustum.planes.forEach((p,j)=>{p.normal.toArray(planes,plane+j*4);planes[plane+3+j*4]=p.constant;});plane+=24;}});return{rays:data,planes};}
 function serializeEntry(entry,id){const b=entry.box,l=entry.local,result={id,right:!!entry.right,box:[...b.min.toArray(),...b.max.toArray()],local:[...l.min.toArray(),...l.max.toArray()],world:entry.world.elements.slice(),inverse:entry.inverse.elements.slice(),architectural:architecture(entry),foreground:/^(Fence_|Wall_|Lighting_|Lamp_|Catch_fence_|Circuit_panels_|Pit_balcony_rails|Grandstand_steel_|Imported_Monza_(?:metals?|fences?|walls?))/.test(entry.object.name)};
  if(result.architectural){result.position=array(entry.object.geometry.attributes.position);result.index=entry.object.geometry.index?.array.slice();}return result;}
 async function prepareMask(name,rays,entries){
  const start=performance.now(),encoded=serializeRays(rays),chunks=Math.max(1,Math.min(12,entries.length)),size=Math.ceil(entries.length/chunks),blocked=[];
  await Promise.all(Array.from({length:chunks},async(_,chunk)=>{const first=chunk*size,last=Math.min(entries.length,first+size);const result=await submit('mask',()=>({rays:encoded.rays.slice(),planes:encoded.planes.slice(),entries:entries.slice(first,last).map((entry,index)=>serializeEntry(entry,first+index))}));blocked.push(...result);window.F1Boot?.update(79,'多核检查镜头遮挡 '+name+' '+blocked.length);await tick();}));
  metrics.phases['mask-'+name]={ms:performance.now()-start,rays:rays.length,entries:entries.length,blocked:blocked.length};blocked.sort((a,b)=>a-b);return blocked;
 }
 function beginPhase(name){metrics.phases[name]={start:performance.now()};}
 function endPhase(name){const item=metrics.phases[name];if(item?.start!==undefined){item.ms=performance.now()-item.start;delete item.start;}}
 async function release(){if(active||queue.length)throw new Error('Preparation ended with pending geometry jobs');for(const s of workers)s.worker.terminate();workers.length=0;if(sourceURL)URL.revokeObjectURL(sourceURL);metrics.released=true;metrics.readyMs=performance.now()-started;await tick();}
 function state(){return {...metrics,phases:{...metrics.phases},activeWorkers:workers.length,inFlight:active,queued:queue.length,enabled,playbackRenderThread:'main',resolutionChanged:false};}
 return{init,prepareLods,prepareMask,merge,beginPhase,endPhase,release,state,setEnabled(v){enabled=!!v;},get enabled(){return enabled;},get forcedLod(){return forcedLod;},set forcedLod(v){forcedLod=v;},get warming(){return forcedLod!==null;}};
})();
