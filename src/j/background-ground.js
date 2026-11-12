/* F: connect grandstands to a spectator precinct; give turf ground-level depth.
   All geometry is static and uses the original road frame. No actor/camera edits. */
window.F1GroundLayer=(()=>{
  let T,renderer,world,root,road,pairs,mode='F',shot='opening';
  const owned=new Map(),named=new Map(),counts={},followers=[],bindings=[],shrubs=new Map(),pavedAreas=[];
  let bindingKey='',turfMaterial,turfUniforms;const turfMaterials=[];
  const clone=m=>{const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey.bind(m);return c;};
  function register(pair){for(const m of new Set(Object.values(pair).filter(m=>m?.isMaterial)))pairs.set(m,pair);return pair;}
  function onlyF(m){const hidden=clone(m);hidden.visible=false;register({original:hidden,enhanced:hidden,detailed:hidden,structured:hidden,refined:hidden,grounded:m});return m;}
  function fork(mesh){
    const p=pairs.get(mesh.material)||{original:mesh.material,enhanced:mesh.material};
    const pair=register({...p,grounded:clone(p.refined||p.structured||p.detailed||p.enhanced)});
    owned.set(mesh,pair);named.set(mesh.name,pair);mesh.material=pair.grounded;return pair.grounded;
  }
  async function texture(uri,color=false){
    const t=await new T.TextureLoader().loadAsync(window.F1BackgroundAssets(uri));t.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
    t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t;
  }
  function worldVertex(shader){
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 precinctWorld;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 precinctPosition=vec4(transformed,1.);
        #ifdef USE_INSTANCING
          precinctPosition=instanceMatrix*precinctPosition;
        #endif
        precinctWorld=(modelMatrix*precinctPosition).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 precinctWorld;');
  }
  const noiseGLSL=`
    float groundHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float groundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.,1.)),f.x),f.y);}
  `;
  function turf(trackRoots){
    for(const trackRoot of trackRoots){
      const mesh=trackRoot.getObjectByName('Grass_infield'),old=fork(mesh),pair=owned.get(mesh);
      // Grass is a diffuse fibrous cover, not a continuous glossy dielectric
      // sheet. StandardMaterial's fixed specular level washed the low-angle
      // field with blue sky reflections despite roughness=1.
      const m=new T.MeshPhysicalMaterial({name:'Low-sheen mown turf F',map:old.map,normalMap:old.normalMap,roughnessMap:old.roughnessMap,
        normalScale:new T.Vector2(.45,.45),roughness:1,metalness:0,specularIntensity:.075,envMapIntensity:.18,color:0xc5c9bb});
      pair.grounded=m;register(pair);mesh.material=m;turfMaterial??=m;turfMaterials.push(m);
      turfUniforms??={groundLow:{value:new T.Vector3(.82,.85,.76)},groundHigh:{value:new T.Vector3(.94,.98,.88)}};
      // Keep the authored blade texture. Broad density and colour changes must
      // survive mip filtering, while physical tufts supply the grazing silhouette.
      m.onBeforeCompile=shader=>{
        worldVertex(shader);
        Object.assign(shader.uniforms,turfUniforms);
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 groundLow;uniform vec3 groundHigh;\n'+noiseGLSL)
          .replace('#include <map_fragment>',`#include <map_fragment>
            vec2 groundP=precinctWorld.xz;
            float coarse=groundNoise(groundP*.028),middle=groundNoise(groundP*.22),fine=groundNoise(groundP*.92);
            vec2 rotated=mat2(.8,-.6,.6,.8)*vMapUv*.79+vec2(.173,.613);
            vec3 secondGrass=texture2D(map,rotated).rgb*diffuse;
            diffuseColor.rgb=mix(diffuseColor.rgb,secondGrass,.26);
            vec3 grassTone=mix(groundLow,groundHigh,smoothstep(.18,.82,coarse));
            float density=.91+.12*middle+.04*fine;
            float mow=.96+.035*sin(groundP.x*.58+groundNoise(groundP*.014)*.9);
            diffuseColor.rgb*=grassTone*density*mow;
          `);
      };
      m.customProgramCacheKey=()=> 'monza-grounded-turf-F-5';m.needsUpdate=true;
    }
    counts.grassSurface='authored 1.4 m turf + metre-scale variation + opaque curved blades';
  }
  function vergeGrades(){
    const grass=onlyF(clone(turfMaterial));
    turfMaterials.push(grass);
    for(const side of[-1,1]){
      const positions=[],uv=[],indices=[],start=-695,end=road.raceMetres+920,count=Math.ceil((end-start)/3);
      for(let k=0;k<=count;k++)for(const [l,y]of[[12.0,-.417],[12.35,-.449],[13.2,-.53]]){
        const p=road.lane(start+(end-start)*k/count,side*l,y);positions.push(p.x,p.y,p.z);uv.push(p.x/2400+.5,.5-p.z/2400);
      }
      for(let k=0;k<count;k++)for(let j=0;j<2;j++){const i=k*3+j;indices.push(i,i+3,i+1,i+1,i+3,i+4);}
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
      const mesh=new T.Mesh(g,grass);mesh.name='Meadow_edge_grade_F_'+side;mesh.matrixAutoUpdate=false;mesh.updateMatrix();root.add(mesh);
    }
    grass.side=T.DoubleSide;counts.gradedVergeWidthMetres=1.2;
  }
  function baked(name,g,m,point,follow=null){
    const p=g.attributes.position,n=g.attributes.normal,uv=[];
    for(let k=0;k<p.count;k++){
      const x=p.getX(k),y=p.getY(k),z=p.getZ(k);
      if(n&&Math.abs(n.getY(k))>.7)uv.push(x/2.71,z/2.71);
      else if(n&&Math.abs(n.getX(k))>.7)uv.push(z/2.71,y/2.71);
      else uv.push(x/2.71,y/2.71);
      const v=point(x,z,y);p.setXYZ(k,v.x,v.y,v.z);
    }
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    const mesh=new T.Mesh(g,m);mesh.name=name;mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.receiveShadow=false;mesh.castShadow=false;
    if(follow){mesh.userData.f1FollowStand=follow;followers.push(mesh);}
    root.add(mesh);return mesh;
  }
  function box(name,length,height,width,station,lateral,y,point,mat,follow=null){
    if(name.includes('forecourt'))noGrass(point,station-length/2,station+length/2,lateral-width/2,lateral+width/2);
    return baked(name,new T.BoxGeometry(length,height,width),mat,(x,z,h)=>point(station+x,lateral+z,y+h),follow);
  }
  function noGrass(point,start,end,left,right){
    const origin=point(start,left,0),along=point(end,left,0).sub(origin),across=point(start,right,0).sub(origin);
    pavedAreas.push({origin,along,across,length:along.length(),width:across.length()});along.normalize();across.normalize();
  }
  function rect(name,start,end,left,right,y,point,mat,follow=null){
    if(!mat.transparent)noGrass(point,start,end,left,right);
    const positions=[],uv=[],indices=[],steps=Math.max(1,Math.ceil((end-start)/4));
    for(let k=0;k<=steps;k++)for(const lateral of[left,right]){
      const station=start+(end-start)*k/steps,p=point(station,lateral,y);positions.push(p.x,p.y,p.z);uv.push(station/2.71,lateral/2.71);
    }
    for(let k=0;k<steps;k++){const a=k*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    // The local route reverses handedness on opposite verges. Keep the paved
    // surface two-sided, while every architectural solid retains closed faces.
    g.computeBoundingBox();g.computeBoundingSphere();const mesh=new T.Mesh(g,mat);mesh.name=name;
    mesh.matrixAutoUpdate=false;mesh.updateMatrix();if(follow){mesh.userData.f1FollowStand=follow;followers.push(mesh);}root.add(mesh);return mesh;
  }
  function concreteMaterial(maps,color){
    const m=onlyF(new T.MeshStandardMaterial({color,map:maps.color,normalMap:maps.normal,normalScale:new T.Vector2(.18,.18),roughnessMap:maps.rough,roughness:.97,envMapIntensity:.24,side:T.DoubleSide}));
    m.onBeforeCompile=shader=>{worldVertex(shader);shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float lowerWall=1.-.19*exp(-max(precinctWorld.y+.55,0.)*2.1);
      diffuseColor.rgb*=lowerWall;
    `);};m.customProgramCacheKey=()=> 'monza-precinct-concrete-F-1';return m;
  }
  function shadowTexture(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d'),data=c.createImageData(128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const edge=Math.min(x,127-x,y,127-y)/20,t=Math.max(0,Math.min(1,edge)),i=(y*128+x)*4;
      data.data[i]=data.data[i+1]=data.data[i+2]=26;data.data[i+3]=Math.round(115*t*t*(3-2*t));
    }c.putImageData(data,0,0);const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;return map;
  }
  function contact(name,start,end,front,back,point,follow,map){
    const m=onlyF(new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
    const mesh=rect(name,start,end,front,back,-.515,point,m,follow);
    const uv=mesh.geometry.attributes.uv;
    for(let k=0;k<uv.count;k++)uv.setXY(k,Math.floor(k/2)/(uv.count/2-1),k%2);
    mesh.renderOrder=1;
  }
  function stairs(name,station,front,width,side,base,top,depth,point,mat,follow){
    const n=Math.ceil((top-base)/.16),stepHeight=(top-base)/n,shape=new T.Shape();
    shape.moveTo(0,base-.10);shape.lineTo(0,base+stepHeight);
    for(let k=0;k<n;k++){shape.lineTo((k+1)*depth/n,base+(k+1)*stepHeight);if(k<n-1)shape.lineTo((k+1)*depth/n,base+(k+2)*stepHeight);}
    shape.lineTo(depth,base-.10);shape.closePath();
    const g=new T.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,steps:1,curveSegments:1});
    // Extrude coordinates: x=walking depth, z=stair width along road.
    return baked(name,g,mat,(x,z,y)=>point(station+z-width/2,front+side*x,y),follow);
  }
  function precincts(maps){
    const concrete=concreteMaterial(maps,0x979b91),paving=concreteMaterial(maps,0xd8d1bf),edge=concreteMaterial(maps,0x8c9286),shadow=shadowTexture();
    const regular=(s,l,y)=>road.lane(s,l,y);
    // A continuous shared concourse connects the five original E modules.
    rect('Spectator_concourse_F_straight',-620,120,-30.2,-34.8,-.475,regular,paving);
    rect('Spectator_concourse_F_straight_edge',-620,120,-29.8,-30.2,-.49,regular,edge);
    for(const [index,station]of[-570,-410,-250,-90,70].entries()){
      const yaw=road.heading(station),origin=road.lane(station,0,0),forward=new T.Vector3(-Math.cos(yaw),0,Math.sin(yaw)),left=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
      const point=(s,l,y)=>origin.clone().addScaledVector(forward,s).addScaledVector(left,l).setY(y);
      const anchor='Imported_Monza_cleanstand_body_'+index;
      box('Imported_Monza_cleanstand_groundbase_'+index,94,.34,13,0,-40.3,-.55,point,concrete,anchor);
      box('Imported_Monza_cleanstand_forecourt_'+index,100,.19,18.8,0,-38.8,-.535,point,paving,anchor);
      rect('Imported_Monza_cleanstand_frontwalk_'+index,-47,47,-30.2,-35,-.465,point,paving);
      contact('Stand_contact_F_straight_'+index,-50,50,-29,-48,point,anchor,shadow);
      for(const s of[-29.2,0,29.2])stairs('Imported_Monza_cleanstand_access_'+index+'_'+s,s,-32.2,1.65,-1,-.465,.26,2.8,point,concrete,anchor);
      // Hardscape side returns let the stairs connect to the shared concourse.
      for(const s of[-46,46])rect('Stand_return_F_'+index+'_'+s,s-1.0,s+1.0,-30.2,-47,-.475,point,paving);
    }
    const station=road.turnStart+32,yaw=road.heading(station),origin=road.lane(station,0,0),forward=new T.Vector3(-Math.cos(yaw),0,Math.sin(yaw)),left=new T.Vector3(Math.sin(yaw),0,Math.cos(yaw));
    const point=(s,l,y)=>origin.clone().addScaledVector(forward,s).addScaledVector(left,l).setY(y);
    for(const side of[-1,1]){
      const prefix=side>0?'Far_Grandstand_':'Grandstand_',anchor=prefix+'steps';
      // Native lowest treads/columns ended at -.40, above the -.53 turf.
      // This buried plinth overlaps them by 2 cm and reaches below ground.
      box(prefix+'buried_foundation_F',83,.34,13.2,0,side*70.7,-.55,point,concrete,anchor);
      box(prefix+'forecourt_F',96,.22,42,0,side*57.3,-.525,point,paving,anchor);
      rect(prefix+'concourse_F',-49,49,side*59.7,side*65.7,-.475,point,paving);
      rect(prefix+'concourse_border_F',-50,50,side*59.3,side*59.7,-.49,point,edge);
      contact(prefix+'contact_F',-46,46,side*58.5,side*79,point,anchor,shadow);
      for(const s of[-25.77,-7.58,10.61,28.8])stairs(prefix+'entry_F_'+s,s,side*63.3,1.7,side,-.475,.21,2.4,point,concrete,anchor);
      for(const s of[-41,41])rect(prefix+'sidewalk_F_'+s,s-1.6,s+1.6,side*59.7,side*78.5,-.475,point,paving);
      for(const s of[-42,42])rect(prefix+'connecting_walk_F_'+s,s-1.6,s+1.6,side*14.5,side*60,-.49,point,paving);
    }
    // Mask complete added stand assemblies. A seat/roof cannot survive its
    // concrete body being cleared along the camera-to-subject corridor.
    root.traverse(mesh=>{
      const hit=mesh.name.match(/^Imported_Monza_cleanstand_(?:body|seats|cushions|canopy|supports|groundbase)_(\d+)$/);
      if(hit)mesh.userData.f1SceneryAssembly='cleanstand_'+hit[1];
    });
    counts.precincts=7;counts.buriedFoundations=7;counts.accessStairs=23;counts.sharedConcourseMetres=740;
    counts.nativeGapFilledMetres=.13;
  }
  async function authoredTuft(){
    const [data,buffer,color,alpha,normal]=await Promise.all([
      fetch(window.F1BackgroundAssets("/structure-assets/grass-tufts.gltf")).then(r=>r.json()),fetch(window.F1BackgroundAssets("/structure-assets/grass-tufts.bin")).then(r=>r.arrayBuffer()),
      texture('/structure-assets/grass-blades-color.jpg',true),texture('/structure-assets/grass-blades-alpha.png'),texture('/structure-assets/grass-blades-normal.jpg')]);
    for(const map of[color,alpha,normal]){map.flipY=false;map.wrapS=map.wrapT=T.ClampToEdgeWrapping;}
    const positions=[],normals=[],uv=[],indices=[],colors=[];
    function read(id){const a=data.accessors[id],view=data.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3}[a.type],Type=a.componentType===5126?Float32Array:a.componentType===5123?Uint16Array:Uint32Array;return new Type(buffer,(view.byteOffset||0)+(a.byteOffset||0),a.count*size);}
    // Three authored medium tufts share one atlas and one instanced draw.
    // Their node translations only arrange the source asset library; root
    // positions here come from the original circuit's ground frame instead.
    for(const [slot,index]of[3,5,7].entries()){
      const spec=data.meshes[index].primitives[0],p=read(spec.attributes.POSITION),n=read(spec.attributes.NORMAL),t=read(spec.attributes.TEXCOORD_0),ix=read(spec.indices),base=positions.length/3;
      let minimum=Infinity,maximum=-Infinity;for(let k=1;k<p.length;k+=3){minimum=Math.min(minimum,p[k]);maximum=Math.max(maximum,p[k]);}
      const angle=slot*2.399963,c=Math.cos(angle),s=Math.sin(angle),scale=.11/(maximum-minimum);
      for(let k=0;k<p.length;k+=3){
        const x=p[k]*scale,z=p[k+2]*scale,y=(p[k+1]-minimum)*scale;
        positions.push(x*c+z*s+Math.cos(angle)*.027,y,-x*s+z*c+Math.sin(angle)*.027);
        normals.push(n[k]*c+n[k+2]*s,n[k+1],-n[k]*s+n[k+2]*c);
        const light=.68+.32*y/.11;colors.push(light,light,light);
      }
      uv.push(...t);for(const i of ix)indices.push(base+i);
    }
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const material=onlyF(new T.MeshStandardMaterial({name:'Poly Haven Bermuda grass / F',map:color,alphaMap:alpha,alphaTest:.4,alphaToCoverage:true,transparent:false,depthWrite:true,side:T.DoubleSide,forceSinglePass:true,normalMap:normal,normalScale:new T.Vector2(.12,.12),vertexColors:true,roughness:1,envMapIntensity:.24}));
    material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 grassRoot=vec4(0.,0.,0.,1.);
        #ifdef USE_INSTANCING
          grassRoot=instanceMatrix*grassRoot;
        #endif
        grassRoot=modelMatrix*grassRoot;
        float grassNear=1.-smoothstep(8.,28.,length(cameraPosition.xz-grassRoot.xz));
        transformed.xz*=1.25;
        transformed.y=transformed.y*.50*grassNear-(1.-grassNear)*.04;
      `);
      // A small two-sided diffuse contribution approximates light transmitted
      // through thin blades, avoiding black backfaces against the lit turf.
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=diffuseColor.rgb*.22;\n#include <opaque_fragment>');
    };material.customProgramCacheKey=()=> 'monza-close-grass-F-2';
    counts.authoredGrassSource='Poly Haven grass_bermuda_01 / Rico Cilliers / CC0';return{geometry,material};
  }
  async function grassTufts(){
    const {geometry:g,material:mat}=await authoredTuft();
    let seed=40271;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const cells=new Map(),end=road.raceMetres+180;
    const put=(s,l,scale)=>{
      const p=road.lane(s,l,-.531),key=Math.floor(p.x/80)+':'+Math.floor(p.z/80);
      for(const area of pavedAreas){const dx=p.x-area.origin.x,dz=p.z-area.origin.z,u=dx*area.along.x+dz*area.along.z,v=dx*area.across.x+dz*area.across.z;if(u>-.1&&u<area.length+.1&&v>-.1&&v<area.width+.1)return;}
      if(!cells.has(key))cells.set(key,[]);cells.get(key).push({p,scale,yaw:rand()*Math.PI*2,tone:rand()});
    };
    for(const side of[-1,1])for(let s=-680;s<end;s+=1.05){
      // Keep a crisp mown edge beside the runoff, then vary density farther out.
      for(let k=0;k<22;k++){
        const lateral=12.7+rand()*17.0,density=.55+.25*Math.sin(s*.037+lateral*.17);
        if(rand()>density)continue;put(s+(rand()-.5),side*lateral,.68+rand()*.52);
      }
      for(let k=0;k<12;k++){
        const l=31+rand()*23;if(side<0&&s<125)continue;
        if(rand()>.48+.18*Math.sin(s*.08))continue;put(s+(rand()-.5)*2,side*l,.85+rand()*.42);
      }
    }
    let total=0;const object=new T.Object3D();
    for(const [cell,items]of cells){
      const mesh=new T.InstancedMesh(g,mat,items.length);mesh.name='Meadow_short_grass_F_'+cell;mesh.userData.f1GroundGrass=true;
      for(const [k,p]of items.entries()){
        object.position.copy(p.p);object.rotation.set(0,p.yaw,0);object.scale.set(p.scale,p.scale,p.scale);object.updateMatrix();mesh.setMatrixAt(k,object.matrix);
        mesh.setColorAt(k,new T.Color().setHSL(.22+p.tone*.03,.08,.72+p.tone*.14));
      }
      mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);total+=items.length;
      if(total%3000<items.length)await window.F1Boot?.tick();
    }
    counts.grassTufts=total;counts.grassCardsPerTuft=3;counts.grassTriangles=total*g.index.count/3;counts.grassMaxHeightMetres=.11*1.27*.5;counts.grassCells=cells.size;counts.grassHeightLodMetres=[8,28];
  }
  function groundShrubs(){
    root.traverse(mesh=>{if(/^Irregular_broadleaf_detail_[67]_(branches|leaves)_/.test(mesh.name))shrubs.set(mesh.name,{original:mesh.geometry,grounded:mesh.geometry.clone().scale(.72,1.55,.72)});});
    counts.shrubAspectCorrected=121;
  }
  function setMode(value){mode=value;bindingKey='';world?.traverse(mesh=>{const pair=shrubs.get(mesh.name);if(pair)mesh.geometry=value==='F'?pair.grounded:pair.original;});}
  function frame(value){shot=value;}
  function inspect(camera){
    const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return o.material?.visible!==false;},structures=[];
    world.updateMatrixWorld(true);
    world.traverse(mesh=>{if(!mesh.isMesh||!/(?:forecourt|buried_foundation|Grandstand_concourse_F)/.test(mesh.name))return;
      const b=new T.Box3().setFromObject(mesh),centre=b.getCenter(new T.Vector3());
      structures.push({name:mesh.name,right:!!mesh.userData.f1RightRoute,visible:visible(mesh),objectVisible:mesh.visible,materialVisible:mesh.material.visible,bounds:{min:b.min.toArray(),max:b.max.toArray()},ndc:centre.clone().project(camera).toArray(),follow:mesh.userData.f1FollowStand});
    });
    return{...counts,structures};
  }
  function postFrame(){
    if(mode!=='F')return;const key=mode+':'+shot;if(bindingKey===key)return;
    if(!bindings.length){
      for(const scenery of[root,world.getObjectByName('Monza_right_route_scenery')].filter(Boolean))scenery.traverse(mesh=>{
        const name=mesh.userData.f1FollowStand;if(name){const anchor=scenery.getObjectByName(name);if(anchor)bindings.push({mesh,anchor});}
      });
    }
    for(const {mesh,anchor}of bindings){
      let alive=anchor.visible;
      if(alive&&anchor.isInstancedMesh){const a=anchor.instanceMatrix.array;alive=false;for(let i=0;i<a.length;i+=16)if(a[i]*a[i]+a[i+1]*a[i+1]+a[i+2]*a[i+2]>.0001){alive=true;break;}}
      mesh.visible=alive;
    }bindingKey=key;
  }
  function materialFor(mesh,value){const p=owned.get(mesh)||named.get(mesh.name);if(!p)return null;return value==='F'?p.grounded:value==='E'?(p.refined||p.structured||p.detailed||p.enhanced):value==='D'?(p.structured||p.detailed||p.enhanced):value==='C'?(p.detailed||p.enhanced):value==='B'?p.enhanced:p.original;}
  async function reloadPalette(){
    const palette=await fetch(window.F1BackgroundAssets("/structure-assets/ground-palette.json"),{cache:'no-store'}).then(r=>r.json());
    for(const m of turfMaterials)m.color.set(palette.tint);
    turfUniforms.groundLow.value.fromArray(palette.low);turfUniforms.groundHigh.value.fromArray(palette.high);counts.groundPalette=palette;
  }
  async function prepare(THREE,render,scene,scenery,track,registry){
    T=THREE;renderer=render;world=scene;root=scenery;road=track;pairs=registry.pairs;
    const [color,normal,rough]=await Promise.all([texture('/detail-assets/concrete-color.jpg',true),texture('/detail-assets/concrete-normal.jpg'),texture('/detail-assets/concrete-rough.jpg')]);
    precincts({color,normal,rough});turf(registry.trackRoots);vergeGrades();groundShrubs();await grassTufts();await reloadPalette();
  }
  return{prepare,setMode,frame,postFrame,materialFor,inspect,reloadPalette,state:()=>({...counts,mode,shot,actorsModified:false,cameraModified:false})};
})();
