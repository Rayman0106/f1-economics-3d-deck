/* User-supplied Gemini GLB. Keep lattice, fixtures and four lamp rows.
   Adapt the portal span, with lamps at their own undistorted scale. */
function createStartGantry(THREE,parent,origin,asset){
 const group=new THREE.Group();group.name='Physical_start_signal_Gemini';group.position.copy(origin);parent.add(group);
 const structure=new THREE.Group(),fixtures=new THREE.Group();structure.name='Gemini_lattice_portal';fixtures.name='Gemini_four_row_signal';
 structure.rotation.y=fixtures.rotation.y=Math.PI/2;structure.scale.set(3.6,4.1,3.6);fixtures.scale.setScalar(2.4);structure.position.y=fixtures.position.y=6.98;group.add(structure,fixtures);
 const metal=new THREE.MeshPhysicalMaterial({name:'Gantry_satin_aluminium',color:0xb0bac3,metalness:.82,roughness:.37,clearcoat:.1,clearcoatRoughness:.4});
 const clamps=new THREE.MeshStandardMaterial({name:'Gantry_stainless_fasteners',color:0xc9d0d4,metalness:.9,roughness:.27});
 const housing=new THREE.MeshPhysicalMaterial({name:'Signal_powder_coat',color:0x14191e,metalness:.08,roughness:.49,clearcoat:.22,clearcoatRoughness:.36});
 const ring=new THREE.MeshStandardMaterial({name:'Signal_retaining_ring',color:0x88949d,metalness:.86,roughness:.29});
 const reflector=new THREE.MeshStandardMaterial({name:'Signal_recessed_reflector',color:0x889096,metalness:.92,roughness:.22,side:THREE.DoubleSide});
 const ballast=new THREE.MeshStandardMaterial({name:'Gantry_ballast',color:0x4d5357,metalness:.04,roughness:.86});
 const cable=new THREE.MeshStandardMaterial({name:'Signal_rubber_cabling',color:0x141719,metalness:0,roughness:.88});
 const dark=new THREE.MeshPhysicalMaterial({name:'Signal_auxiliary_lens',color:0x111519,metalness:0,roughness:.23,clearcoat:1,clearcoatRoughness:.15});
 const lights=Array.from({length:5},(_,k)=>new THREE.MeshPhysicalMaterial({name:'Signal_red_lens_'+(k+1),color:0x290405,metalness:0,roughness:.2,clearcoat:1,clearcoatRoughness:.13,emissive:0xff0b05,emissiveIntensity:0,toneMapped:false}));
 for(const mesh of [...asset.children]){
  const name=mesh.name,fixture=/^(LightBox_|Column_|Lamp_|Acoustic_|Gantry_Cross_Braces|Gantry_Mounting_Clamps)/.test(name);
  const old=mesh.material?.name||'',lamp=name.match(/^Lamp_Col(\d)_Row(\d)_Lens$/);
  mesh.material=lamp?(Number(lamp[2])>=3?lights[Number(lamp[1])-1]:dark):/Ballast/.test(old)?ballast:/Cable/.test(old)?cable:/Reflector/.test(old)?reflector:/Retaining/.test(old)?ring:/Housing|Visor/.test(old)?housing:/Clamp/.test(old)?clamps:metal;
  mesh.castShadow=false;mesh.receiveShadow=true;mesh.frustumCulled=true;(fixture?fixtures:structure).add(mesh);
 }
 // Discrete LED emitters sit on the convex diffuser instead of a flat red fill.
 const leds=lights.map((_,k)=>new THREE.MeshStandardMaterial({name:'Signal_LED_matrix_'+k,color:0x300405,metalness:0,roughness:.28,emissive:0xff1008,emissiveIntensity:0,toneMapped:false}));
 const ledGeometry=new THREE.SphereGeometry(.0038,8,6),dummy=new THREE.Object3D();
 for(let k=0;k<5;k++){
  const positions=[];
  for(const row of[2,3]){const cy=-.06-.14-row*((1.25-.28)/3),cx=(k-2)*.39;
   for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(x*x+y*y<=10){const dx=x*.018,dy=y*.018;positions.push([cx+dx,cy+dy,.095+.014*Math.sqrt(Math.max(0,1-(dx*dx+dy*dy)/(.082*.082)))]);}
  }
  const matrix=new THREE.InstancedMesh(ledGeometry,leds[k],positions.length);matrix.name='Column_'+(k+1)+'_LED_matrix';
  positions.forEach((p,index)=>{dummy.position.fromArray(p);dummy.updateMatrix();matrix.setMatrixAt(index,dummy.matrix);});matrix.computeBoundingSphere();fixtures.add(matrix);
 }
 // Both faces share the five column materials and go dark on the same frame.
 const rear=fixtures.clone(true);rear.name='Signal_rear_face';rear.rotation.y=-Math.PI/2;rear.position.x=-.42;group.add(rear);
 const centers=lights.map((_,k)=>new THREE.Vector3(.3,5.0,-(k-2)*.39*2.4).add(origin));
 let previous=-1;
 function setCount(count){if(count===previous)return;previous=count;lights.forEach((material,k)=>{const on=k<count;material.color.setHex(on?0x700607:0x290405);material.emissiveIntensity=on?.42:0;leds[k].color.setHex(on?0xec1909:0x300405);leds[k].emissiveIntensity=on?1.1:0;});}
 setCount(0);
 return{group,setCount,centers,materials:()=>[metal,clamps,housing,ring,reflector,ballast,cable,dark,...lights,...leds].map(m=>({name:m.name,type:m.type,roughness:m.roughness,metalness:m.metalness,clearcoat:m.clearcoat||0,emissiveIntensity:m.emissiveIntensity||0})),source:'Gemini GLB',lampRows:4};
}
