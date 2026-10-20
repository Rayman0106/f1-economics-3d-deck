/* Preserve every authored triangle and attribute. The supplied Rear_Wing node
   contains decals; its connected physical endplates/flaps were left in Body. */
function completeMcLarenRearWing(THREE,car){
  const body=car.getObjectByName('Body'),rear=car.getObjectByName('Rear_Wing');
  if(!body||!rear)return;
  const meshes=[];body.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh);});
  const report=[];
  for(const mesh of meshes){
    const source=mesh.geometry,index=source.index?.array||Array.from({length:source.attributes.position.count},(_,k)=>k),p=source.attributes.position;
    const rest=[],wing=[];
    for(let k=0;k<index.length;k+=3){
      const ids=[index[k],index[k+1],index[k+2]],x=ids.reduce((s,id)=>s+p.getX(id),0)/3,y=ids.reduce((s,id)=>s+p.getY(id),0)/3;
      (x>1.72&&y>.535?wing:rest).push(...ids);
    }
    if(!wing.length)continue;
    const geometry=source.clone();geometry.setIndex(wing);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const physical=mesh.clone();physical.name=mesh.name+'_physical_rear_wing';physical.geometry=geometry;rear.add(physical);
    const remaining=source.clone();remaining.setIndex(rest);remaining.computeBoundingBox();remaining.computeBoundingSphere();mesh.geometry=remaining;
    report.push({material:Array.isArray(mesh.material)?mesh.material.map(m=>m.name).join(','):mesh.material.name,movedTriangles:wing.length/3,remainingTriangles:rest.length/3,originalTriangles:index.length/3});
  }
  window.__F1RearWingPartition=report;
}
