/* Exact static-world culling caches. Native plane/sphere tests, no LOD edits. */
window.createF1StaticCullingJ=function(T,isEnabled,counts){
 const frusta=new WeakMap();let nextId=1;
 const nativeProjection=T.Frustum.prototype.setFromProjectionMatrix;
 T.Frustum.prototype.setFromProjectionMatrix=function(...args){
  const result=nativeProjection.apply(this,args);let state=frusta.get(this);
  if(!state){state={history:[],id:0};frusta.set(this,state);}
  // The renderer reuses a frustum for world, AO and composite cameras. Retain
  // their exact plane sets so a fixed camera can hit the cache next frame.
  let found=null;
  for(const item of state.history){let same=true;
   for(let k=0;k<6&&same;k++){const p=this.planes[k],i=k*4;const a=item.planes;
    same=a[i]===p.normal.x&&a[i+1]===p.normal.y&&a[i+2]===p.normal.z&&a[i+3]===p.constant;}
   if(same){found=item;break;}
  }
  if(!found){const planes=new Float64Array(24);for(let k=0;k<6;k++){const p=this.planes[k],i=k*4;planes[i]=p.normal.x;planes[i+1]=p.normal.y;planes[i+2]=p.normal.z;planes[i+3]=p.constant;}
   found={id:nextId++,planes};state.history.unshift(found);if(state.history.length>8)state.history.pop();}
  state.id=found.id;return result;
 };
 function register(root,revision){
  root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.geometry?.morphAttributes.position?.length)return;
   const native=mesh.intersectsFrustum;
   if(native!==T.Mesh.prototype.intersectsFrustum&&native!==T.InstancedMesh.prototype.intersectsFrustum)return;
   const sphere=new T.Sphere(),views=new WeakMap();let epoch=-1,boundsRevision=0,geometry=null,source=null,cx,cy,cz,radius;
   mesh.intersectsFrustum=function(frustum){
    if(!isEnabled())return native.call(this,frustum);
    let local;if(this.boundingSphere!==undefined){if(this.boundingSphere===null)this.computeBoundingSphere();local=this.boundingSphere;}
    else{if(this.geometry.boundingSphere===null)this.geometry.computeBoundingSphere();local=this.geometry.boundingSphere;}
    const changed=epoch!==revision()||geometry!==this.geometry||source!==local||cx!==local.center.x||cy!==local.center.y||cz!==local.center.z||radius!==local.radius;
    if(changed){epoch=revision();geometry=this.geometry;source=local;cx=local.center.x;cy=local.center.y;cz=local.center.z;radius=local.radius;
     sphere.copy(local).applyMatrix4(this.matrixWorld);boundsRevision++;counts.staticBoundUpdates++;}
    const id=frusta.get(frustum)?.id,old=views.get(frustum);
    if(!changed&&id!==undefined&&old?.id===id&&old.bounds===boundsRevision){counts.staticCullHits++;return old.result;}
    const result=frustum.intersectsSphere(sphere);counts.staticCullTests++;
    if(id!==undefined){if(old){old.id=id;old.bounds=boundsRevision;old.result=result;}else views.set(frustum,{id,bounds:boundsRevision,result});}return result;
   };
   counts.staticCullMeshes++;
  });
 }
 return{register};
};
