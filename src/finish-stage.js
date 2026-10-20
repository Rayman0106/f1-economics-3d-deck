/* Physical finish stripe and wind-driven cloth. Geometry is prepared at load.
   Deterministic animation also supports reverse and instant navigation. */
function createFinishStage(THREE,scene,worldRoots){
 const root=new THREE.Group();root.name='Monza_finish_ceremony';root.visible=false;scene.add(root);worldRoots.push(root);
 const roadMarks=new THREE.Group();roadMarks.name='Finish_line';root.add(roadMarks);
 const light=new THREE.MeshBasicMaterial({color:0xecebe2,fog:true}),dark=new THREE.MeshBasicMaterial({color:0x242b31,fog:true});
 for(let row=0;row<2;row++)for(let col=0;col<24;col++){
  const tile=new THREE.Mesh(new THREE.BoxGeometry(.32,.012,.5),(row+col)%2?dark:light);tile.position.set((row-.5)*.32,-.372,(col-11.5)*.5);roadMarks.add(tile);
 }
 const mast=new THREE.Group();mast.name='Chequered_flag_mast';root.add(mast);
 const steel=new THREE.MeshStandardMaterial({color:0xabb7bf,metalness:.82,roughness:.35});
 const pole=new THREE.Mesh(new THREE.CylinderGeometry(.038,.046,4.6,16),steel);pole.position.y=1.9;mast.add(pole);
 const foot=new THREE.Mesh(new THREE.BoxGeometry(.38,.12,.38),steel);foot.position.y=-.315;mast.add(foot);
 const flagGeometry=new THREE.PlaneGeometry(1.85,1.2,32,20),flagPosition=flagGeometry.attributes.position,uv=flagGeometry.attributes.uv;
 const flagMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.83,metalness:0,side:THREE.DoubleSide});
 flagMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat square=mod(floor(vUv.x*8.0)+floor(vUv.y*5.0),2.0);diffuseColor.rgb*=mix(vec3(.035),vec3(.94),square);');};
 flagMaterial.defines={USE_UV:''};
 const flag=new THREE.Mesh(flagGeometry,flagMaterial);flag.name='Waving_chequered_cloth';flag.position.set(.925,3.6,0);mast.add(flag);
 const seams=new THREE.Mesh(new THREE.CylinderGeometry(.007,.007,1.25,8),steel);seams.position.set(0,3.6,0);mast.add(seams);
 const particleCount=144,positions=new Float32Array(particleCount*3),colours=new Float32Array(particleCount*3),directions=[];
 for(let burst=0;burst<3;burst++)for(let k=0;k<48;k++){
  const index=burst*48+k,angle=k*2.39996323,vertical=1-2*(k+.5)/48,radius=Math.sqrt(1-vertical*vertical);directions.push([Math.cos(angle)*radius,vertical,Math.sin(angle)*radius]);colours.set(burst===1?[1,.88,.56]:[1,.59,.15],index*3);
 }
 const particleGeometry=new THREE.BufferGeometry();particleGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));particleGeometry.setAttribute('color',new THREE.BufferAttribute(colours,3));
 const sparkMaterial=new THREE.PointsMaterial({size:.14,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,opacity:1});
 sparkMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat disk=1.0-smoothstep(.12,.5,length(gl_PointCoord-.5));diffuseColor.a*=disk;');};
 const sparks=new THREE.Points(particleGeometry,sparkMaterial);sparks.name='Finish_gold_sparks';sparks.frustumCulled=false;root.add(sparks);
 let state=null;
 function frame(pose){
  const finish=pose.finish;root.visible=!!finish&&pose.track>0;if(!finish){state=null;return;}
  root.position.fromArray(finish.position);root.rotation.y=finish.heading;
  mast.position.set(0,0,-6.5);mast.rotation.y=.25;
  const t=pose.seconds;
  for(let k=0;k<flagPosition.count;k++){const u=uv.getX(k),v=uv.getY(k),wave=u*(.14*Math.sin(7.5*u-6.1*t)+.07*Math.sin(13*u-9.8*t+v*3));flagPosition.setXYZ(k,(u-.5)*1.85,(v-.5)*1.2+.08*u*Math.sin(6*u-5*t),wave);}
  flagPosition.needsUpdate=true;flagGeometry.computeVertexNormals();
  let active=0;
  for(let burst=0;burst<3;burst++){
   const age=t-(finish.crossing+.12+burst*.48),live=age>0&&age<1.8;if(live)active++;
   const size=live?3.2*age:0,fall=live?1.1*age*age:0;
   for(let k=0;k<48;k++){const index=burst*48+k,d=directions[index];positions[index*3]=-50+burst*5+d[0]*size;positions[index*3+1]=live?4.8+burst*.55+d[1]*size-fall:-100;positions[index*3+2]=8+d[2]*size;}
  }
  particleGeometry.attributes.position.needsUpdate=true;sparks.visible=active>0;
  state={visible:root.visible,crossing:finish.crossing,travel:finish.travel,lineStation:finish.station,flagVisible:root.visible,bursts:active};
 }
 return{root,frame,state:()=>state};
}
