/* Native 3D scenery and a precomputed sky texture: no per-frame noise shader. */
function createF1Environment(THREE,renderer,scene,track,loader,readAsset){
  const group=new THREE.Group();group.name='Circuit_scenery';scene.add(group);
  const materials=[];let seed=481;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
  const ctx=canvas.getContext('2d'),skyGradient=ctx.createLinearGradient(0,0,0,1024);
  skyGradient.addColorStop(0,'#3273a2');skyGradient.addColorStop(.39,'#76accd');skyGradient.addColorStop(.51,'#a8c8d8');skyGradient.addColorStop(.64,'#aebcad');skyGradient.addColorStop(1,'#819484');
  ctx.fillStyle=skyGradient;ctx.fillRect(0,0,2048,1024);
  for(let cloud=0;cloud<90;cloud++){
    const x=random()*2048,y=180+random()*275,width=28+random()*130,height=8+random()*20;
    const gradient=ctx.createRadialGradient(x,y,0,x,y,width);
    gradient.addColorStop(0,'rgba(249,249,243,.20)');gradient.addColorStop(1,'rgba(249,249,243,0)');
    ctx.save();ctx.translate(x,y);ctx.scale(1,height/width);ctx.translate(-x,-y);ctx.fillStyle=gradient;ctx.fillRect(x-width,y-width,width*2,width*2);ctx.restore();
  }
  const sun=ctx.createRadialGradient(400,375,2,400,375,95);sun.addColorStop(0,'rgba(255,250,225,.94)');sun.addColorStop(.11,'rgba(255,249,227,.50)');sun.addColorStop(1,'rgba(255,249,227,0)');ctx.fillStyle=sun;ctx.fillRect(305,280,190,190);
  const skyMap=new THREE.CanvasTexture(canvas);skyMap.colorSpace=THREE.SRGBColorSpace;
  const skyMaterial=new THREE.MeshBasicMaterial({map:skyMap,side:THREE.BackSide,depthWrite:false,fog:false,transparent:true,toneMapped:false});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(850,32,16),skyMaterial);sky.name='Daylight_sky';sky.renderOrder=-20;scene.add(sky);
  const hemi=new THREE.HemisphereLight(0xc0dbee,0xa2a691,.55);scene.add(hemi);
  function mat(color,roughness=.8,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,transparent:false,...extra});materials.push({material:m,opacity:m.opacity,depthWrite:m.depthWrite});return m;}
  function boxes(name,geometry,material,placements){
    const mesh=new THREE.InstancedMesh(geometry,material,placements.length),dummy=new THREE.Object3D();mesh.name=name;
    placements.forEach((p,index)=>{dummy.position.copy(p.position);dummy.rotation.set(...(p.rotation||[0,p.heading||0,0]));if(p.quaternion)dummy.quaternion.copy(p.quaternion);dummy.scale.set(...(p.scale||[1,1,1]));dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);if(p.color)mesh.setColorAt(index,new THREE.Color(p.color));});if(placements.some(p=>p.treeId!==undefined))mesh.userData.treeIds=placements.map(p=>p.treeId??null);mesh.computeBoundingSphere();mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  // Hills beyond the circuit make the horizon continuous and give the camera scale.
  const hills=[];
  for(let index=0;index<28;index++){
    const angle=index/28*Math.PI*2,distance=980+random()*140;
    hills.push({position:new THREE.Vector3(-80+Math.cos(angle)*distance,-5,180+Math.sin(angle)*distance),scale:[35+random()*70,22+random()*38,40+random()*70]});
  }
  boxes('Distant_hills',new THREE.SphereGeometry(1,24,12),mat(0x8d9e98,.99),hills);
  const buildingCanvas=document.createElement('canvas');buildingCanvas.width=1024;buildingCanvas.height=256;
  const bctx=buildingCanvas.getContext('2d');bctx.fillStyle='#b6bfc0';bctx.fillRect(0,0,1024,256);
  for(let col=0;col<22;col++)for(let row=0;row<3;row++){
    const x=12+col*46,y=18+row*76;bctx.fillStyle=row===0?'#456273':'#344b5b';bctx.fillRect(x,y,36,55);
    bctx.fillStyle='#9bb2be66';bctx.fillRect(x+3,y+3,29,10);bctx.fillStyle='#d2d9d8';bctx.fillRect(x+17,y,2,55);bctx.fillRect(x,y+28,36,2);
    bctx.fillStyle='#e3e5df';bctx.fillRect(x,73+row*76,36,5);
  }
  for(let grain=0;grain<14000;grain++){bctx.fillStyle=random()>.5?'#ffffff0d':'#2537460d';bctx.fillRect(random()*1024,random()*256,1,1);}
  const buildingMap=new THREE.CanvasTexture(buildingCanvas);buildingMap.colorSpace=THREE.SRGBColorSpace;buildingMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const facades=[],roofs=[],awnings=[],supports=[],steps=[],seats=[];
  for(let station=-100;station<100;station+=25){
    const yaw=track.heading(station);
    facades.push({position:track.lane(station,-29,3.6),heading:yaw});
    roofs.push({position:track.lane(station,-29,7.1),heading:yaw});
    awnings.push({position:track.lane(station,-21.4,3.4),heading:yaw});
    for(const offset of[-10,10])supports.push({position:track.lane(station+offset,-19.7,1.45),heading:yaw});
  }
  boxes('Pit_buildings',new THREE.BoxGeometry(24,7.3,13),mat(0xffffff,.62,{map:buildingMap,metalness:.12}),facades);
  boxes('Pit_roofs',new THREE.BoxGeometry(25,.28,15),mat(0xe4e6df,.55,{metalness:.18}),roofs);
  boxes('Garage_awnings',new THREE.BoxGeometry(23,.15,4.5),mat(0x596773,.58),awnings);
  boxes('Awning_supports',new THREE.CylinderGeometry(.065,.09,3.5,6),mat(0x929da3,.35,{metalness:.6}),supports);
  const garageDoors=[],doorFrames=[],roofVents=[],pitRails=[];
  for(let station=-100;station<100;station+=25){
    const heading=track.heading(station);
    for(const slot of[-7,0,7]){
      garageDoors.push({position:track.lane(station+slot,-22.42,1.28),heading});
      for(const edge of[-2.6,2.6])doorFrames.push({position:track.lane(station+slot+edge,-22.32,1.3),heading,scale:[.1,2.8,.13]});
      doorFrames.push({position:track.lane(station+slot,-22.32,2.7),heading,scale:[5.3,.14,.13]});
      roofVents.push({position:track.lane(station+slot,-29,7.53),heading});
    }
    pitRails.push({position:track.lane(station,-22.0,4.08),heading,scale:[24,.08,.09]});
    for(let slot=-11;slot<=11;slot+=2)pitRails.push({position:track.lane(station+slot,-22.0,3.70),heading,scale:[.06,.8,.06]});
  }
  const shutterCanvas=document.createElement('canvas');shutterCanvas.width=128;shutterCanvas.height=128;const shutterCtx=shutterCanvas.getContext('2d');shutterCtx.fillStyle='#65727b';shutterCtx.fillRect(0,0,128,128);
  for(let row=0;row<128;row+=7){shutterCtx.fillStyle='#3a4954';shutterCtx.fillRect(0,row,128,1);shutterCtx.fillStyle='#aeb9bd';shutterCtx.fillRect(0,row+1,128,1);}
  const shutterMap=new THREE.CanvasTexture(shutterCanvas);shutterMap.colorSpace=THREE.SRGBColorSpace;
  boxes('Pit_garage_shutters',new THREE.BoxGeometry(5.1,2.55,.08),mat(0xffffff,.6,{map:shutterMap}),garageDoors);
  boxes('Garage_frames',new THREE.BoxGeometry(1,1,1),mat(0xd7dedc,.63),doorFrames);
  boxes('Roof_ventilation',new THREE.BoxGeometry(2,.55,1.4),mat(0x79858b,.48,{metalness:.35}),roofVents);
  boxes('Pit_balcony_rails',new THREE.BoxGeometry(1,1,1),mat(0xb0babd,.38,{metalness:.5}),pitRails);
  const standStation=track.turnStart+32;
  const standOrigin=track.lane(standStation,0,0),standYaw=track.heading(standStation),standForward=new THREE.Vector3(-Math.cos(standYaw),0,Math.sin(standYaw)),standLeft=new THREE.Vector3(Math.sin(standYaw),0,Math.cos(standYaw));
  const standLane=(station,side,y)=>standOrigin.clone().addScaledVector(standForward,station-standStation).addScaledVector(standLeft,side).setY(y);
  const seatBacks=[],crowdBodies=[],crowdHeads=[],crowdLegs=[],crowdCaps=[],stairs=[],railBeams=[];
  const standHeading=track.heading(standStation),shirtColors=[0xd2d7d4,0x364f63,0x526a7b,0xd29a69,0x9babad,0x263842,0xb8b7ad],seatColors=[0x597185,0x3c566e,0x81949e];
  const beam=(from,to,radius=.055)=>{const direction=to.clone().sub(from);return{position:from.clone().add(to).multiplyScalar(.5),quaternion:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.clone().normalize()),scale:[radius,direction.length(),radius]};};
  for(let row=0;row<10;row++){
    const tierHeight=.61+row*.43;steps.push({position:standLane(standStation,-24-row*.9,-.4+tierHeight/2),heading:standYaw,scale:[1,tierHeight,1]});
    for(let column=0;column<70;column++){
      const station=standStation-37+column*1.07,side=-24-row*.9,level=row*.43;
      if([10,11,27,28,44,45,61,62].includes(column)){stairs.push({position:standLane(station,side,level+.24),heading:standHeading});continue;}
      const color=seatColors[(Math.floor(column/12)+row)%seatColors.length];
      seats.push({position:standLane(station,side,level+.32),heading:standHeading,color});
      seatBacks.push({position:standLane(station,side-.22,level+.60),heading:standHeading,color});
      if(random()<.48){
        const shirt=shirtColors[Math.floor(random()*shirtColors.length)],lean=(random()-.5)*.12;
        crowdBodies.push({position:standLane(station,side+lean,level+.69),heading:standHeading,color:shirt,scale:[.95+random()*.1,.86+random()*.15,1]});
        crowdHeads.push({position:standLane(station,side+lean+.015,level+.98),color:[0xcfac89,0xc08a62,0x8e674f][Math.floor(random()*3)]});
        crowdLegs.push({position:standLane(station,side+.23,level+.27),heading:standHeading});
        if(random()<.38)crowdCaps.push({position:standLane(station,side+lean+.01,level+1.075),heading:standHeading,color:random()>.65?0xe09950:0xc6cecd});
      }
    }
  }
  boxes('Grandstand_steps',new THREE.BoxGeometry(78,1,.92),mat(0x8a9395,.93),steps);
  boxes('Grandstand_seat_cushions',new THREE.BoxGeometry(.65,.13,.45),mat(0xffffff,.88),seats);
  boxes('Grandstand_seat_backs',new THREE.BoxGeometry(.65,.45,.105),mat(0xffffff,.86),seatBacks);
  boxes('Grandstand_stairs',new THREE.BoxGeometry(1.02,.12,.88),mat(0xc0c6c3,.93),stairs);
  boxes('Spectator_jackets',new THREE.CylinderGeometry(.17,.20,.44,8),mat(0xffffff,.95),crowdBodies);
  boxes('Spectator_heads',new THREE.SphereGeometry(.115,10,7),mat(0xffffff,.99),crowdHeads);
  boxes('Spectator_legs',new THREE.BoxGeometry(.31,.29,.31),mat(0x34404c,.95),crowdLegs);
  boxes('Spectator_caps',new THREE.CylinderGeometry(.126,.12,.075,7),mat(0xffffff,.93),crowdCaps);
  for(const column of[10.5,27.5,44.5,61.5]){
    const station=standStation-37+column*1.07;
    railBeams.push(beam(standLane(station,-23.5,.9),standLane(station,-32.9,5.2),.035));
    for(let row=0;row<10;row+=2)railBeams.push(beam(standLane(station,-24-row*.9,row*.43+.15),standLane(station,-24-row*.9,row*.43+.98),.035));
  }
  const standRoof=new THREE.Mesh(new THREE.BoxGeometry(82,.20,13),mat(0xd9dcd6,.5,{metalness:.22}));standRoof.name='Grandstand_roof';standRoof.position.copy(standLane(standStation,-28,6.65));standRoof.rotation.y=track.heading(standStation);group.add(standRoof);
  const standColumns=[];for(let station=standStation-38;station<=standStation+38;station+=12)standColumns.push({position:standLane(station,-33,3),heading:track.heading(station)});
  boxes('Grandstand_columns',new THREE.CylinderGeometry(.10,.16,6.8,8),mat(0x848f96,.4,{metalness:.6}),standColumns);
  for(let station=standStation-38;station<=standStation+38;station+=12){
    railBeams.push(beam(standLane(station,-21.8,6.55),standLane(station,-34.1,6.55),.065));
    railBeams.push(beam(standLane(station,-33.0,5.05),standLane(station,-22.0,6.55),.05));
    railBeams.push(beam(standLane(station,-33.0,5.05),standLane(station,-34.1,6.55),.05));
  }
  for(const side of[-22,-28,-34])railBeams.push(beam(standLane(standStation-40,side,6.48),standLane(standStation+40,side,6.48),.07));
  boxes('Grandstand_roof_trusses_and_handrails',new THREE.CylinderGeometry(1,1,1,6),mat(0xa2adb1,.4,{metalness:.55}),railBeams);
  // A second fully modelled stand stays behind the racing action when the
  // near-side camera crosses the first stand. Share geometry and materials.
  const standPlacement=(matrix,far)=>{
    const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,rotation,scale);
    const delta=position.clone().sub(standOrigin),station=standStation+delta.dot(standForward),side=delta.dot(standLeft);
    position.copy(standLane(station,far?42-side:side-42,position.y));
    if(far)rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI));
    return new THREE.Matrix4().compose(position,rotation,scale);
  };
  for(const object of [...group.children])if(/^(Grandstand_|Spectator_)/.test(object.name)){
    const copy=object.clone();copy.name='Far_'+object.name;
    if(copy.isInstancedMesh){for(let index=0;index<copy.count;index++){const matrix=new THREE.Matrix4();object.getMatrixAt(index,matrix);copy.setMatrixAt(index,standPlacement(matrix,true));object.setMatrixAt(index,standPlacement(matrix,false));}copy.instanceMatrix.needsUpdate=true;object.instanceMatrix.needsUpdate=true;copy.computeBoundingSphere();object.computeBoundingSphere();}
    else{object.updateMatrix();standPlacement(object.matrix,true).decompose(copy.position,copy.quaternion,copy.scale);standPlacement(object.matrix,false).decompose(object.position,object.quaternion,object.scale);}
    group.add(copy);
  }
  const trees=[],trunks=[],branches=[],pines=[],bushes=[],leafColors=[0x536b51,0x637b5b,0x46654e,0x6b7e58,0x4e6e5c];
  const leafGeometry=new THREE.IcosahedronGeometry(1,2),leafVertices=leafGeometry.attributes.position;
  for(let index=0;index<leafVertices.count;index++){const p=new THREE.Vector3().fromBufferAttribute(leafVertices,index),roughness=1+.10*Math.sin(p.x*17+p.y*11+p.z*23);p.multiplyScalar(roughness);leafVertices.setXYZ(index,p.x,p.y,p.z);}leafGeometry.computeVertexNormals();
  for(const treeSide of[-1,1])for(let station=-140;station<track.raceMetres+950;station+=13.5+random()*7){
    // Keep the complete grove beyond the widest side-camera path (45 m),
    // moving trunks, branches and foliage together. Preserve forest density.
    const offset=92+random()*35,height=5+random()*4.2,base=track.lane(station,treeSide*offset,-.35),pine=random()<.22;
    const treeId=trunks.length;
    trunks.push({treeId,position:base.clone().add(new THREE.Vector3(0,height*.26,0)),scale:[.16+random()*.09,height*.52,.16+random()*.09],heading:random()*Math.PI});
    if(pine){
      for(let level=0;level<4;level++)pines.push({treeId,position:base.clone().add(new THREE.Vector3(0,height*(.43+level*.135),0)),scale:[height*(.31-level*.053),height*.42,height*(.31-level*.053)],heading:random()*Math.PI,color:leafColors[Math.floor(random()*leafColors.length)]});
    }else{
      for(let lobe=0;lobe<9;lobe++){
        const angle=lobe*2.399,radial=lobe===0?0:height*(.14+random()*.14),dy=height*(.49+random()*.30),position=base.clone().add(new THREE.Vector3(Math.cos(angle)*radial,dy,Math.sin(angle)*radial));
        trees.push({treeId,position,scale:[height*(.19+random()*.10),height*(.20+random()*.12),height*(.19+random()*.10)],rotation:[random()*.4,random()*6.28,random()*.4],color:leafColors[Math.floor(random()*leafColors.length)]});
        if(lobe<4)branches.push({...beam(base.clone().add(new THREE.Vector3(0,height*.27,0)),position,.055+random()*.03),treeId});
      }
    }
    if(random()<.6)bushes.push({position:track.lane(station+random()*5,treeSide*(76+random()*12),.25),scale:[1.1+random()*1.6,.6+random()*.5,.9+random()],color:leafColors[Math.floor(random()*leafColors.length)]});
  }
  boxes('Irregular_broadleaf_canopies',leafGeometry,mat(0xffffff,.98),trees);
  boxes('Tapered_tree_trunks',new THREE.CylinderGeometry(.64,1,1,6),mat(0x73644f,.99),trunks);
  boxes('Tree_branches',new THREE.CylinderGeometry(.6,1,1,5),mat(0x786b55,.98),branches);
  boxes('Layered_pine_canopies',new THREE.ConeGeometry(1,1,9),mat(0xffffff,.98),pines);
  boxes('Verge_shrubs',leafGeometry,mat(0xffffff,.99),bushes);
  window.__F1SceneryDetail={seats:2*seats.length,spectators:2*crowdBodies.length,steelMembers:2*railBeams.length,leafClusters:trees.length,pineLayers:pines.length,branches:branches.length,garages:garageDoors.length};
  group.traverse(object=>{object.updateMatrix();object.matrixAutoUpdate=false;});
  let opacity=-1,skyOpacity=-1;
  function update(alpha,camera,layers=null){
    const skyAlpha=alpha>0?1:0,sceneryAlpha=skyAlpha;
    sky.position.copy(camera.position);sky.visible=skyAlpha>.001;group.visible=sceneryAlpha>.001;
    if(skyAlpha!==skyOpacity){skyOpacity=skyAlpha;skyMaterial.opacity=skyAlpha;}
    if(sceneryAlpha===opacity)return;opacity=sceneryAlpha;
    for(const entry of materials){entry.material.opacity=entry.opacity;entry.material.depthWrite=entry.depthWrite;if(entry.transparent!==undefined)entry.material.transparent=entry.transparent;}
  }
  async function prepare(){
    const imported=await loader.parseAsync(await readAsset('monza-scenery'),'');window.F1Boot?.parsed('monza-scenery');await window.F1Boot?.tick();
    // Keep the established custom route and timing. Register real pit-straight
    // scenery along it rather than placing an unrelated full circuit below it.
    const sourceMeshes=[];imported.scene.traverse(mesh=>{if(mesh.isMesh)sourceMeshes.push(mesh);});
    const importedMaterials=new Set();
    for(const mesh of sourceMeshes)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])importedMaterials.add(material);
    let smoothedCutouts=0;
    for(const material of importedMaterials){
      material.forceSinglePass=true;material.roughness=Math.max(material.roughness||0,.72);
      // Separate from the coplanar-wall fix: keep fence and rail cutout edges
      // covered across MSAA samples while preserving the authored threshold.
      if(material.alphaTest>0){material.alphaToCoverage=true;material.needsUpdate=true;smoothedCutouts++;}
      materials.push({material,opacity:material.opacity,depthWrite:material.depthWrite,transparent:material.transparent});
      for(const value of Object.values(material))if(value?.isTexture)value.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
    }
    const oldPit=[];group.traverse(mesh=>{if(/^(Pit_|Garage_|Awning_|Roof_ventilation)/.test(mesh.name))oldPit.push(mesh);});oldPit.forEach(mesh=>mesh.removeFromParent());
    // The imported seating decks are thin surfaces over open steelwork. Give
    // their horizontal treads a solid concrete body below them; keep the real
    // seating, roof, textures and silhouettes rather than painting a backdrop.
    // Infill edges share planes with the author's existing concrete risers.
    // Keep the original textured facade in front; the added concrete still
    // closes the genuinely open steelwork underneath. A positive depth bias
    // prevents their different shades from winning alternate moving pixels.
    const standBodyMaterial=mat(0x92999a,.93,{polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:4}),standBodies=new Map();
    for(const original of sourceMeshes){
      if(!/^Imported_Monza_gstand(?:-alpha)?\d*_/.test(original.name))continue;
      const geometry=original.geometry,p=geometry.attributes.position,indices=geometry.index;
      geometry.computeBoundingBox();if(geometry.boundingBox.max.z>-20)continue;
      const top=[],edges=new Map(),faces=new Set(),token=v=>v.map(n=>Math.round(n*10000)).join(',');
      const append=(a,b,c)=>top.push(...a,...b,...c);
      for(let k=0;k<(indices?indices.count:p.count);k+=3){
        const tri=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,indices?indices.getX(k+j):k+j));
        const y=tri.reduce((sum,v)=>sum+v.y,0)/3,normal=tri[1].clone().sub(tri[0]).cross(tri[2].clone().sub(tri[0]));
        if(y<.15||y>12||normal.length()<.02||Math.abs(normal.normalize().y)<.8)continue;
        if(normal.y<0)[tri[1],tri[2]]=[tri[2],tri[1]];
        const vertices=tri.map(v=>[v.x,v.y-.025,v.z]),face=vertices.map(token).sort().join('|');if(faces.has(face))continue;faces.add(face);append(...vertices);
        for(let j=0;j<3;j++){const a=vertices[j],b=vertices[(j+1)%3],key=[token(a),token(b)].sort().join('|');if(edges.has(key))edges.delete(key);else edges.set(key,[a,b]);}
      }
      if(!top.length)continue;
      for(const[a,b]of edges.values()){const lowA=[a[0],-.37,a[2]],lowB=[b[0],-.37,b[2]];append(a,lowA,b);append(b,lowA,lowB);}
      const body=new THREE.BufferGeometry();body.setAttribute('position',new THREE.Float32BufferAttribute(top,3));body.computeVertexNormals();standBodies.set(original,body);
    }
    let importedTriangles=0,solidStandTriangles=0;
    for(let tile=-1;tile<3;tile++){await window.F1Boot?.tick();for(const original of sourceMeshes){
      const mesh=original.clone();mesh.geometry=original.geometry.clone();mesh.name=original.name+'_tile'+tile;
      const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,tangent=mesh.geometry.attributes.tangent;
      for(let index=0;index<position.count;index++){
        const station=-position.getX(index)-170+tile*520,y=position.getY(index),lateral=position.getZ(index),point=track.lane(station,lateral,y),heading=track.heading(station),cos=Math.cos(heading),sin=Math.sin(heading);
        position.setXYZ(index,point.x,point.y,point.z);
        for(const attribute of[normal,tangent])if(attribute){const x=attribute.getX(index),z=attribute.getZ(index);attribute.setXYZ(index,x*cos+z*sin,attribute.getY(index),-x*sin+z*cos);}
      }
      mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();mesh.receiveShadow=false;mesh.castShadow=false;mesh.matrixAutoUpdate=false;mesh.updateMatrix();group.add(mesh);importedTriangles+=(mesh.geometry.index?.count||position.count)/3;
      if(standBodies.has(original)){
        const geometry=standBodies.get(original).clone(),positions=geometry.attributes.position;
        for(let k=0;k<positions.count;k++){const station=-positions.getX(k)-170+tile*520,point=track.lane(station,positions.getZ(k),positions.getY(k));positions.setXYZ(k,point.x,point.y,point.z);}geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
        const solid=new THREE.Mesh(geometry,standBodyMaterial);solid.name=mesh.name.replace('gstand','gstand_structure');solid.matrixAutoUpdate=false;solid.updateMatrix();group.add(solid);solidStandTriangles+=positions.count/3;
      }
    }
    }for(const original of sourceMeshes)original.geometry.dispose();
    for(const geometry of standBodies.values())geometry.dispose();
    window.__F1SceneryDetail={...window.__F1SceneryDetail,importedSource:'Monza 2020 pit-straight remix',importedMeshes:sourceMeshes.length*4,importedTriangles,solidStandTriangles,standInfillDepthBias:{factor:1,units:4},smoothedCutouts};
    skyMap.mapping=THREE.EquirectangularReflectionMapping;
    const generator=new THREE.PMREMGenerator(renderer);generator.compileEquirectangularShader();
    const environment=generator.fromEquirectangular(skyMap);scene.environment=environment.texture;scene.environmentIntensity=.80;generator.dispose();
    // Restore the mapping used by the visible dome; the PMREM already owns a copy.
    skyMap.mapping=THREE.UVMapping;
  }
  return{group,sky,update,prepare};
}
