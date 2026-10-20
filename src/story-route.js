/* A second, precomputed right-hand story route. Re-lay scenery in its local
   station/lane frame using proper rotations; do not reflect cars, UVs or signs. */
async function createStoryRouteVariant(THREE,track,roots){
 const samples=[];
 for(let s=-700;s<=track.raceMetres+950;s+=2){const p=track.lane(s,0,0);samples.push({s,x:p.x,z:p.z});}
 const squared=(p,k)=>{const q=samples[k];return(p.x-q.x)**2+(p.z-q.z)**2;};
 function station(p){
  let lo=0,hi=samples.length-1;
  while(hi-lo>2){const m=(lo+hi)>>1;if(squared(p,m)<squared(p,m+1))hi=m+1;else lo=m;}
  let best=lo;for(let k=lo+1;k<=hi;k++)if(squared(p,k)<squared(p,best))best=k;
  let result=samples[best].s,distance=Infinity;
  for(const k of[Math.max(0,best-1),Math.min(samples.length-2,best)]){
   const a=samples[k],b=samples[k+1],dx=b.x-a.x,dz=b.z-a.z,u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz))),d=(p.x-a.x-u*dx)**2+(p.z-a.z-u*dz)**2;
   if(d<distance){distance=d;result=a.s+(b.s-a.s)*u;}
  }return result;
 }
 const axis=new THREE.Vector3(0,1,0);
 function map(p){const s=station(p),h=track.heading(s),c=track.lane(s,0,0),l=(p.x-c.x)*Math.sin(h)+(p.z-c.z)*Math.cos(h);return{point:new THREE.Vector3(c.x-Math.sin(h)*l,p.y,-c.z+Math.cos(h)*l),yaw:-2*h};}
 const copies=[];
 for(const [index,root] of roots.entries()){
  root.updateMatrixWorld(true);const copy=root.clone(true);copy.name=index?'Monza_right_route_scenery':'Monza_right_route_road';
  const originals=[],clones=[];root.traverse(o=>{if(o.isMesh)originals.push(o);});copy.traverse(o=>{if(o.isMesh)clones.push(o);});
  for(const [index,source] of originals.entries()){
   const mesh=clones[index],inverse=source.matrixWorld.clone().invert();
   if(source.isInstancedMesh){
    mesh.instanceMatrix=source.instanceMatrix.clone();const instance=new THREE.Matrix4();
    for(let k=0;k<source.count;k++){
     source.getMatrixAt(k,instance);const world=source.matrixWorld.clone().multiply(instance),p=new THREE.Vector3().setFromMatrixPosition(world),mapped=map(p);
     world.premultiply(new THREE.Matrix4().makeRotationY(mapped.yaw));world.setPosition(mapped.point);mesh.setMatrixAt(k,inverse.clone().multiply(world));
    }mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
   }else if(source.name!=='Grass_infield'){
    const geometry=source.geometry.clone(),positions=geometry.attributes.position,normals=geometry.attributes.normal,normalMatrix=new THREE.Matrix3().getNormalMatrix(source.matrixWorld),inverseNormal=new THREE.Matrix3().getNormalMatrix(inverse);
    for(let k=0;k<positions.count;k++){
     const p=new THREE.Vector3().fromBufferAttribute(positions,k).applyMatrix4(source.matrixWorld),mapped=map(p);positions.setXYZ(k,...mapped.point.applyMatrix4(inverse).toArray());
     if(normals){const n=new THREE.Vector3().fromBufferAttribute(normals,k).applyMatrix3(normalMatrix).applyAxisAngle(axis,mapped.yaw).applyMatrix3(inverseNormal).normalize();normals.setXYZ(k,n.x,n.y,n.z);}
     if(k>0&&k%20000===0)await window.F1Boot?.tick();
    }geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
   }
   if(index%8===0)await window.F1Boot?.tick();
  }copy.visible=false;copies.push(copy);
 }
 return{road:copies[0],scenery:copies[1]};
}
