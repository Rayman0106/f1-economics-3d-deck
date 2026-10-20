/* Physical, double-faced signal assembly. Local +X faces the grid (-s).
   No overlay, billboards, point lights or per-frame geometry rebuilding. */
function createStartGantry(THREE,parent,origin){
 const group=new THREE.Group();group.name='Physical_start_signal';group.position.copy(origin);parent.add(group);
 // Satin aluminium, coated housings and polished fasteners have distinct
 // responses to the same daylight environment. The fine finish is fixed.
 const finish=document.createElement('canvas');finish.width=128;finish.height=128;const ctx=finish.getContext('2d'),pixels=ctx.createImageData(128,128);
 for(let y=0;y<128;y++)for(let x=0;x<128;x++){const k=(y*128+x)*4,v=228+Math.round(8*Math.sin(y*2.4)+3*Math.sin(x*13+y*7));pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=v;pixels.data[k+3]=255;}ctx.putImageData(pixels,0,0);
 const finishMap=new THREE.CanvasTexture(finish);finishMap.wrapS=finishMap.wrapT=THREE.RepeatWrapping;finishMap.repeat.set(3,16);
 const steel=new THREE.MeshPhysicalMaterial({name:'Gantry_satin_aluminium',color:0x909ba4,metalness:.86,roughness:.34,roughnessMap:finishMap,clearcoat:.12,clearcoatRoughness:.42});
 const black=new THREE.MeshPhysicalMaterial({name:'Signal_powder_coat',color:0x111923,metalness:.12,roughness:.48,clearcoat:.28,clearcoatRoughness:.38});
 const dark=new THREE.MeshPhysicalMaterial({name:'Signal_convex_red_lens',color:0x240805,metalness:.02,roughness:.21,clearcoat:1,clearcoatRoughness:.12,emissive:0xdb1406,emissiveIntensity:0,toneMapped:false});
 const lights=[],ledsMaterials=[],boltMaterial=new THREE.MeshStandardMaterial({name:'Gantry_stainless_fasteners',color:0xc3cbd0,metalness:.95,roughness:.22});
 function box(name,x,y,z,sx,sy,sz,material=steel){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);m.name=name;m.position.set(x,y,z);group.add(m);return m;}
 function strut(a,b,r=.045){const axis=new THREE.Vector3().subVectors(b,a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,axis.length(),8),steel);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());group.add(m);}
 for(const z of[-9,9]){box('Gantry_foot',0,-.28,z,1.2,.26,1.2);box('Gantry_post',0,3.4,z,.22,7.5,.22);box('Post_base_plate',0,-.11,z,.72,.06,.72);for(const dx of[-.26,.26])for(const dz of[-.26,.26]){const bolt=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.09,6),boltMaterial);bolt.position.set(dx,-.04,z+dz);group.add(bolt);}}
 box('Gantry_upper_chord',0,7.35,0,.18,.18,18.25);box('Gantry_lower_chord',0,6.8,0,.18,.18,18.25);
 for(let k=0;k<12;k++){const z=-9+k*1.5;strut(new THREE.Vector3(0,6.8,z),new THREE.Vector3(0,7.35,z+1.5));}
 box('Signal_backplate',-.08,6.08,-.5,.13,1.58,4.72,black);
 box('Wiring_tray',-.24,6.89,-.5,.28,.12,5.05,black);
 for(const z of[-2.6,1.6]){box('Mounting_cleat',-.1,6.78,z,.32,.44,.13);strut(new THREE.Vector3(-.2,6.65,z),new THREE.Vector3(.08,7.25,z),.04);}
 for(let k=0;k<5;k++){
  const z=-.5+(k-2)*.91,material=dark.clone(),ledMaterial=new THREE.MeshStandardMaterial({name:'Signal_LED_emitters',color:0x350b05,metalness:.05,roughness:.32,emissive:0xff2408,emissiveIntensity:0,toneMapped:false});lights.push(material);ledsMaterials.push(ledMaterial);
  box('Signal_hanger_'+k,0,6.95,z,.08,.65,.08);box('Signal_housing_'+k,.15,6.1,z,.52,1.29,.75,black);
  box('Synchronous_back_housing_'+k,-.15,6.1,z,.52,1.29,.75,black);
  for(const face of[1,-1]){
  const ledPositions=[];
  for(const y of[5.81,6.39]){
   const rim=new THREE.Mesh(new THREE.TorusGeometry(.237,.029,12,40),boltMaterial);rim.rotation.y=face*Math.PI/2;rim.position.set(face*.435,y,z);group.add(rim);
   const recess=new THREE.Mesh(new THREE.CylinderGeometry(.229,.229,.06,32),black);recess.rotation.z=-face*Math.PI/2;recess.position.set(face*.411,y,z);group.add(recess);
   const lens=new THREE.Mesh(new THREE.SphereGeometry(.208,32,16),material);lens.name='Red_lens_'+k+'_'+face;lens.scale.set(.10,1,1);lens.position.set(face*.441,y,z);group.add(lens);
   box('Signal_hood_top',face*.55,y+.26,z,.4,.045,.55,black);
   for(const side of[-1,1])box('Signal_hood_cheek',face*.53,y+.15,z+side*.258,.33,.23,.035,black);
   // Tiny, non-emissive lens grid gives the disc a physical surface in daylight.
   for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++)if(row*row+col*col<6)ledPositions.push([face*.463,y+row*.068,z+col*.068]);
  }
  const leds=new THREE.InstancedMesh(new THREE.CircleGeometry(.021,8),ledMaterial,ledPositions.length),dummy=new THREE.Object3D();leds.name='Recessed_LED_array_'+k;for(const[p,index]of ledPositions.map((p,i)=>[p,i])){dummy.position.fromArray(p);dummy.rotation.y=face*Math.PI/2;dummy.updateMatrix();leds.setMatrixAt(index,dummy.matrix);}group.add(leds);
  }
 }
 let previous=-1;
 function setCount(count){if(count===previous)return;previous=count;lights.forEach((m,k)=>{m.color.setHex(k<count?0xa30d04:0x240805);m.emissiveIntensity=k<count?.65:0;ledsMaterials[k].color.setHex(k<count?0xff2408:0x350b05);ledsMaterials[k].emissiveIntensity=k<count?.50:0;});}
 return{group,setCount,materials:()=>[steel,black,dark,boltMaterial].map(m=>({name:m.name,type:m.type,roughness:m.roughness,metalness:m.metalness,clearcoat:m.clearcoat||0})),centers:lights.map((_,k)=>new THREE.Vector3(-.45,6.1,-.5+(k-2)*.91).add(origin))};
}
