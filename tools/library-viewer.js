(() => {
  const THREE=xa, rows=JSON.parse(document.getElementById('library-data').textContent),select=document.getElementById('asset'),view=document.getElementById('view'),status=document.getElementById('status');
  rows.forEach(row=>{const option=document.createElement('option');option.value=row.id;option.textContent=row.id;select.append(option);});
  const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('viewer'),antialias:true});renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x9eb5c2);
  // The supplied Haas/Williams paint is metallic. A neutral local reflection
  // environment preserves that PBR material without making it appear black.
  const studio=new THREE.Scene();studio.background=new THREE.Color(0xaab5bd);
  const ceiling=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:0xe4ebef,side:THREE.DoubleSide}));ceiling.rotation.x=Math.PI/2;ceiling.position.y=25;studio.add(ceiling);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({color:0x646e74,side:THREE.DoubleSide}));ground.rotation.x=-Math.PI/2;ground.position.y=-20;studio.add(ground);
  const pmrem=new THREE.PMREMGenerator(renderer),reflections=pmrem.fromScene(studio,.08,.1,120);scene.environment=reflections.texture;pmrem.dispose();ceiling.geometry.dispose();ceiling.material.dispose();ground.geometry.dispose();ground.material.dispose();
  const hemi=new THREE.HemisphereLight(0xddeef7,0x75654d,2.2);scene.add(hemi);const sun=new THREE.DirectionalLight(0xfff4dd,3);sun.position.set(-30,40,25);scene.add(sun);const fill=new THREE.DirectionalLight(0xd5e6ff,1.8);fill.position.set(25,15,-20);scene.add(fill);
  const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.05,20000),loader=new gu();let asset=null,row=null,centre=new THREE.Vector3(),span=6,zoom=1,yaw=.7;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:0x87949a,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.005;scene.add(floor);
  function pose(){
    let direction=new THREE.Vector3(Math.sin(yaw),.42,Math.cos(yaw));
    if(view.value==='side')direction.set(0,.13,1);if(view.value==='front')direction.set(-1,.18,.001);if(view.value==='top')direction.set(.001,1,.001);
    if(row?.kind==='track'&&view.value==='quarter')direction.set(.2,.9,1);
    const distance=span/(2*Math.tan(camera.fov*Math.PI/360))*1.32*zoom;camera.position.copy(centre).addScaledVector(direction.normalize(),distance);camera.near=Math.max(.025,span/10000);camera.far=Math.max(200,span*15);camera.up.set(0,view.value==='top'?0:1,view.value==='top'?-1:0);camera.lookAt(centre);camera.updateProjectionMatrix();renderer.render(scene,camera);
  }
  function dispose(object){object.traverse(o=>{o.geometry?.dispose();if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});}
  function output(state){let e=document.getElementById('library-state');if(!e){e=document.createElement('script');e.id='library-state';e.type='application/json';document.body.append(e);}e.textContent=JSON.stringify(state);}
  async function load(){
    if(select.disabled)return;select.disabled=true;status.textContent='加载 '+select.value+'…';output({status:'loading',id:select.value});
    try{
      row=rows.find(r=>r.id===select.value);const gltf=await loader.loadAsync(row.path,event=>{if(event.total)status.textContent='加载 '+row.id+' · '+Math.round(event.loaded/event.total*100)+'%';});
      hemi.intensity=row.kind==='track'?0.9:2.2;sun.intensity=row.kind==='track'?1.4:3;fill.intensity=row.kind==='track'?0.3:1.8;renderer.toneMappingExposure=row.kind==='track'?0.9:1.1;
      if(asset){scene.remove(asset);dispose(asset);}asset=gltf.scene;if(row.kind==='car')f1FixMetalMaterials(THREE,asset);scene.add(asset);asset.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(asset),focus=row.focus_bounds?new THREE.Box3(new THREE.Vector3(...row.focus_bounds[0]),new THREE.Vector3(...row.focus_bounds[1])):bounds;
      focus.getCenter(centre);const size=focus.getSize(new THREE.Vector3());span=Math.max(size.x,size.y,size.z);zoom=row.kind==='track'?1.6:1;yaw=.7;floor.visible=row.kind==='car';view.value=row.kind==='track'?'top':'quarter';
      let triangles=0,meshes=0,materials=new Set(),images=new Set(),wheels=[];
      asset.traverse(o=>{if(o.name.endsWith('_Wheel'))wheels.push(o.name);if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)images.add(v.image);}});
      document.getElementById('info').textContent=row.author+' · '+row.license+'\n'+Math.round(triangles).toLocaleString()+' triangles · '+meshes+' meshes · '+materials.size+' materials · '+images.size+' textures';document.getElementById('source').href=row.source;
      pose();status.textContent=row.id+' · 已加载';output({status:'loaded',id:row.id,triangles,meshes,materials:materials.size,textures:images.size,wheels,bounds:[bounds.min.toArray(),bounds.max.toArray()],sha256:row.sha256});
    }catch(error){status.textContent='加载失败：'+error.message;output({status:'error',id:select.value,error:error.message});}finally{select.disabled=false;}
  }
  document.getElementById('load').onclick=load;view.onchange=pose;document.getElementById('zoom-in').onclick=()=>{zoom=Math.max(.1,zoom*.72);pose();};document.getElementById('zoom-out').onclick=()=>{zoom=Math.min(8,zoom/ .72);pose();};document.getElementById('rotate').onclick=()=>{yaw+=Math.PI/6;view.value='quarter';pose();};
  function resize(){renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.3));renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;pose();}window.addEventListener('resize',resize);resize();select.value='redbull-rb22';load();
})();
