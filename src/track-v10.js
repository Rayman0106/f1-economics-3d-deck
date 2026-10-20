/* Detailed, batched circuit. The original route and distance units are retained. */
function g0(THREE,renderer) {
  const group=new THREE.Group();group.name='APEX_CIRCUIT_V10';
  const start=-700,end=_u+950,step=.75,turnStart=20+as(3),turnEnd=20+as(4.8);
  const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  const heading=station=>1.38*smooth((station-turnStart)/(turnEnd-turnStart));
  const points=[];let x=-start,z=0;
  for(let station=start;station<=end+step;station+=step){points.push(new THREE.Vector3(x,0,z));const yaw=heading(station+step/2);x-=Math.cos(yaw)*step;z+=Math.sin(yaw)*step;}
  const centre=station=>{const index=Math.max(0,Math.min(points.length-2,Math.floor((station-start)/step)));return points[index].clone().lerp(points[index+1],Math.max(0,Math.min(1,(station-start)/step-index)));};
  const lane=(station,lateral=0,y=-.4)=>{const point=centre(station),yaw=heading(station);point.x+=Math.sin(yaw)*lateral;point.z+=Math.cos(yaw)*lateral;point.y=y;return point;};
  const racingPoints=[],apex=20+as(3.82);
  for(let station=0;station<=_u+42;station+=1.4)racingPoints.push(lane(station,-1.8+6.05*Math.exp(-Math.pow((station-apex)/35,2)),0));
  const racingLine=new THREE.CatmullRomCurve3(racingPoints,false,'centripetal');racingLine.arcLengthDivisions=1800;racingLine.updateArcLengths();
  const textures=[],materials=new Map();let seed=93;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const canvas=(width,height)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
  function texture(image,color=true){const map=new THREE.CanvasTexture(image);map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());textures.push(map);return map;}
  function material(color,roughness=.85,extra={}){const value=new THREE.MeshStandardMaterial({color,roughness,metalness:0,...extra});materials.set(value,value.opacity);return value;}
  const asphaltCanvas=canvas(512,512),context=asphaltCanvas.getContext('2d'),data=context.createImageData(512,512);
  for(let yy=0;yy<512;yy++)for(let xx=0;xx<512;xx++){
    const index=(yy*512+xx)*4,value=143+(random()-.5)*8+1.2*Math.sin(xx*.12)*Math.cos(yy*.09);
    data.data[index]=value;data.data[index+1]=value;data.data[index+2]=value+1;data.data[index+3]=255;
  }context.putImageData(data,0,0);
  const asphaltMap=texture(asphaltCanvas),bumpMap=texture(asphaltCanvas,false);
  const asphalt=material(0x55585c,.92,{map:asphaltMap,bumpMap,bumpScale:.006});
  const paint=material(0xe6e6de,.78,{polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const runoff=material(0x66706c,.95,{map:asphaltMap});
  const grass=material(0x768571,.99),concrete=material(0xa8adb0,.9),steel=material(0x838c92,.35,{metalness:.65});
  function strip(name,from,to,profile,mat,resolution=1.8){
    const vertices=[],uv=[],indices=[],count=Math.ceil((to-from)/resolution);
    for(let row=0;row<=count;row++){
      const station=from+(to-from)*row/count;
      for(const[lateral,y]of profile){const point=lane(station,lateral,y);vertices.push(point.x,point.y,point.z);uv.push(lateral*.13,station*.13);}
    }
    const width=profile.length;
    for(let row=0;row<count;row++)for(let col=0;col<width-1;col++){const a=row*width+col,b=a+1,c=a+width,d=c+1;indices.push(a,c,b,b,c,d);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400),grass);ground.name='Grass_infield';ground.rotation.x=-Math.PI/2;ground.position.y=-.53;group.add(ground);
  strip('Fine_asphalt',start,end,[[-6.3,-.4],[6.3,-.4]],asphalt);
  for(const side of[-1,1]){
    const profile=values=>side>0?values.map(([l,y])=>[l*side,y]):values.map(([l,y])=>[l*side,y]).reverse();
    strip('Runoff_'+side,start,end,profile([[7.15,-.413],[12,-.413]]),runoff);
    strip('Edge_line_'+side,start,end,profile([[6.02,-.393],[6.13,-.393]]),paint);
    strip('Concrete_wall_'+side,start,end,profile([[11.9,-.42],[11.9,.26],[12.06,.36],[12.28,.36],[12.3,-.42]]),concrete);
    strip('Safety_rail_'+side,start,end,profile([[11.82,.5],[11.72,.57],[11.82,.67],[11.72,.76],[11.82,.86]]),steel);
  }
  const curbPositions=[],curbColors=[],red=new THREE.Color(0xbb3832),white=new THREE.Color(0xd8d7ce);
  for(const side of[-1,1])for(let station=start,index=0;station<end;station+=1.6,index++){
    const profile=[[6.3,-.398],[6.43,-.348],[7.02,-.348],[7.15,-.413]].map(([l,y])=>[l*side,y]);if(side<0)profile.reverse();
    const color=index%2?white:red;
    for(let col=0;col<profile.length-1;col++){
      const a=lane(station,...profile[col]),b=lane(Math.min(end,station+1.6),...profile[col]),c=lane(station,...profile[col+1]),d=lane(Math.min(end,station+1.6),...profile[col+1]);
      for(const p of[a,b,c,c,b,d]){curbPositions.push(p.x,p.y,p.z);curbColors.push(color.r,color.g,color.b);}
    }
  }
  const curbGeometry=new THREE.BufferGeometry();curbGeometry.setAttribute('position',new THREE.Float32BufferAttribute(curbPositions,3));curbGeometry.setAttribute('color',new THREE.Float32BufferAttribute(curbColors,3));curbGeometry.computeVertexNormals();
  const curbs=new THREE.Mesh(curbGeometry,material(0xffffff,.86,{vertexColors:true}));curbs.name='Bevelled_kerbs';curbs.receiveShadow=true;group.add(curbs);
  const rubber=new THREE.MeshBasicMaterial({color:0x14191b,transparent:true,opacity:.085,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});materials.set(rubber,.085);
  for(const offset of[-1.4,1.4])strip('Racing_rubber_'+offset,turnStart-90,turnEnd+20,[[offset-.18,-.39],[offset+.18,-.39]],rubber);
  function instances(name,geometry,mat,placements){
    const mesh=new THREE.InstancedMesh(geometry,mat,placements.length),dummy=new THREE.Object3D();mesh.name=name;
    placements.forEach((placement,index)=>{dummy.position.copy(placement.position);dummy.rotation.set(0,placement.heading||0,0);dummy.scale.set(...(placement.scale||[1,1,1]));dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);});
    mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);return mesh;
  }
  const posts=[],joints=[],lamps=[],heads=[];
  for(const side of[-1,1])for(let station=start;station<end;station+=5){
    posts.push({position:lane(station,side*12.35,1.02),heading:heading(station)});
    joints.push({position:lane(station,side*11.895,-.04),heading:heading(station)});
    if(Math.round((station-start)/5)%9===0){lamps.push({position:lane(station,side*14,3.6),heading:heading(station)});heads.push({position:lane(station,side*13.1,7.2),heading:heading(station)});}
  }
  instances('Fence_posts',new THREE.CylinderGeometry(.038,.05,2.9,6),steel,posts);
  instances('Wall_panel_joints',new THREE.BoxGeometry(.032,.58,.018),material(0x677176,.97),joints);
  instances('Lighting_poles',new THREE.CylinderGeometry(.055,.095,7.7,6),steel,lamps);
  instances('Lamp_heads',new THREE.BoxGeometry(.38,.08,1.9),material(0xe5e5dd,.46),heads);
  const fenceCanvas=canvas(128,128),fenceContext=fenceCanvas.getContext('2d');fenceContext.strokeStyle='rgba(105,117,125,.54)';fenceContext.lineWidth=.75;
  for(let offset=-128;offset<256;offset+=24){fenceContext.beginPath();fenceContext.moveTo(offset,0);fenceContext.lineTo(offset+128,128);fenceContext.moveTo(offset,0);fenceContext.lineTo(offset-128,128);fenceContext.stroke();}
  const fenceMap=texture(fenceCanvas),fenceMaterial=new THREE.MeshBasicMaterial({map:fenceMap,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide});materials.set(fenceMaterial,.5);
  for(const side of[-1,1]){
    const fence=strip('Catch_fence_'+side,start,end,[[side*12.34,.85],[side*12.34,2.48]],fenceMaterial,3);
    const uv=fence.geometry.attributes.uv,position=fence.geometry.attributes.position;
    for(let index=0;index<uv.count;index++)uv.setXY(index,index/2*.32,position.getY(index)*.7);
  }
  const bannerCanvas=canvas(1024,128),bannerContext=bannerCanvas.getContext('2d');bannerContext.fillStyle='#20272d';bannerContext.fillRect(0,0,1024,128);bannerContext.fillStyle='#dd3e35';bannerContext.fillRect(0,0,12,128);bannerContext.fillStyle='#e8e9e5';bannerContext.font='italic 900 65px Arial';bannerContext.fillText('MONZA / AUTODROMO',40,88);bannerContext.fillStyle='#97a5ae';bannerContext.font='20px Arial';bannerContext.fillText('MOTORSPORT',760,77);
  const bannerMaterial=new THREE.MeshBasicMaterial({map:texture(bannerCanvas),side:THREE.DoubleSide});materials.set(bannerMaterial,1);
  for(const side of[-1,1]){
    const panel=strip('Circuit_panels_'+side,start,end,[[side*11.88,-.28],[side*11.88,.24]],bannerMaterial,4);
    const uv=panel.geometry.attributes.uv;for(let index=0;index<uv.count;index++)uv.setXY(index,(side>0?1:-1)*Math.floor(index/2)*4/22,index%2);
  }
  const boardMaterials=[];
  for(const number of[200,150,100,50]){
    const c=canvas(256,192),ctx=c.getContext('2d');ctx.fillStyle='#ebede7';ctx.fillRect(0,0,256,192);ctx.fillStyle='#22282e';ctx.font='900 115px Arial';ctx.textAlign='center';ctx.fillText(String(number),128,139);
    const mat=new THREE.MeshBasicMaterial({map:texture(c),side:THREE.DoubleSide});materials.set(mat,1);boardMaterials.push(mat);
    const board=new THREE.Mesh(new THREE.PlaneGeometry(2.0,1.5),mat);board.name='Braking_board_'+number;board.position.copy(lane(turnStart-number,-11.4,1.03));board.rotation.y=heading(turnStart-number)+Math.PI/2;group.add(board);
  }
  // Thin dashed markings add parallax without another full surface pass.
  const dashPositions=[];
  for(let station=start;station<turnStart-100;station+=12)dashPositions.push({position:lane(station,-3.95,-.386),heading:heading(station),scale:[5.5,1,1]});
  instances('Pit_entry_dashes',new THREE.BoxGeometry(1,.009,.095),paint,dashPositions);
  group.traverse(object=>{if(object.material)for(const mat of Array.isArray(object.material)?object.material:[object.material]){if(!materials.has(mat))materials.set(mat,mat.opacity);mat.forceSinglePass=true;}object.updateMatrix();object.matrixAutoUpdate=false;});
  let alpha=-1;
  return{group,racingLine,distance:racingLine.getLength(),lane,heading,turnStart,turnEnd,raceMetres:_u,
    fade(value){if(value===alpha)return;alpha=value;for(const[mat,original]of materials)mat.opacity=original;},
    dispose(){group.traverse(object=>object.geometry?.dispose());for(const mat of materials.keys())mat.dispose();textures.forEach(map=>map.dispose());}};
}
