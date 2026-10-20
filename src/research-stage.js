/* Equal illustrative research resources; no team budget or outcome data. */
function createResearchStage(THREE,scene){
  const root=new THREE.Group();root.name='Research_choices_and_scope';scene.add(root);root.visible=false;
  const geometry=new THREE.BoxGeometry(1.02,.36,.62);
  const materials=[0xff8708,0x82b9cb,0xbdd0dc].map(color=>new THREE.MeshStandardMaterial({color,roughness:.48,metalness:.18,transparent:true,opacity:1,fog:false}));
  const rows=Object.fromEntries(['cadillac','ferrari'].map(key=>[key,Array.from({length:6},(_,index)=>{
    const mesh=new THREE.Mesh(geometry,materials[index<4?0:1]);mesh.name=key+'_resource_'+index;root.add(mesh);return mesh;
  })]));
  const additions=Array.from({length:2},(_,index)=>{const mesh=new THREE.Mesh(geometry,materials[2]);mesh.name='Newly_covered_cost_'+index;root.add(mesh);return mesh;});
  const boundaryMaterial=new THREE.LineBasicMaterial({color:0xdde6e9,transparent:true,opacity:0,depthWrite:false,toneMapped:false,fog:false});
  const boundaryGeometry=new THREE.BufferGeometry();boundaryGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(18),3));
  const boundary=new THREE.Line(boundaryGeometry,boundaryMaterial);boundary.name='Open_covered_cost_boundary';root.add(boundary);
  let state=null;
  function frame(pose){
    const chart=pose.research;root.visible=!!chart&&chart.opacity>.001;if(!chart){state=null;return;}
    root.position.fromArray(chart.position);root.rotation.set(0,chart.heading,0);root.scale.setScalar(1);
    materials.forEach(material=>material.opacity=chart.opacity);
    const relocate=chart.relocate||0,scope=chart.scope||0;
    for(const[key,blocks]of Object.entries(rows)){
      const row=key==='cadillac'?0:1,rowVisible=key!=='cadillac'||chart.pair;
      for(const[index,mesh]of blocks.entries()){
        mesh.visible=rowVisible;
        const from=index<4?-4.75+index*1.16:1.55+(index-4)*1.16;
        const to=index===3?3.87:from,t=key==='ferrari'&&index===3?relocate:0;
        mesh.position.set((row?14:0)+from+(to-from)*t,.22+.75*Math.sin(Math.PI*t),0);
        mesh.material=index===3&&key==='ferrari'&&relocate>.999?materials[1]:materials[index<4?0:1];
      }
    }
    additions.forEach((mesh,index)=>{mesh.visible=scope>.001;mesh.position.set(14+5.7+index*1.16,.22,0);mesh.scale.setScalar(scope);});
    const left=-5.42,right=4.55+(7.52-4.55)*(chart.boundaryExpand||0),front=2.15,back=3.25;
    const points=[14+left,.035,-.6,14+left,.035,.6,14+right,.035,.6,14+right,.035,-.6,14+right-.8,.035,-.6];
    const position=boundary.geometry.attributes.position;position.array.set(points);position.needsUpdate=true;boundary.geometry.setDrawRange(0,5);boundary.geometry.computeBoundingSphere();
    boundary.visible=(chart.boundary||0)>.001;boundaryMaterial.opacity=chart.opacity*(chart.boundary||0);
    root.updateMatrixWorld(true);
    state={totals:{cadillac:6,ferrari:6},allocation:{cadillac:[4,2],ferrari:relocate>.999?[3,3]:[4,2]},relocate,scope,coveredAdditionalCostGroups:scope>.999?2:0,boundaryExpand:chart.boundaryExpand||0,opacity:chart.opacity,position:chart.position,blockCount:12,conceptual:true};
  }
  return{root,frame,getState:()=>state,scopeAnchors:()=>additions.map(mesh=>mesh.getWorldPosition(new THREE.Vector3())),anchors(){return Object.fromEntries(Object.entries(rows).map(([key,blocks])=>[key,blocks.map(mesh=>mesh.getWorldPosition(new THREE.Vector3()))]));}};
}
