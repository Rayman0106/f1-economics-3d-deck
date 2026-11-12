/* H: trackside planting, empty stands and a shared environment for the race. */
window.F1ParkLayer=(()=>{
  let T,renderer,world,root,road,pairs,sky,mode='H',shot='opening',displaySky,skyRotation=0;
  const own=new Map(),byName=new Map(),newMaterials=new Map(),trees=[],openingTrees=[],understory=[];
  const counts={},groups=[[-638,-546,-454],[-312,-220]];
  const baseHeight=-.53,fieldHalf=1200,tileSize=300,gridStep=5;
  let active=true,shade,grassViewport,closeGrass,originalSkyMap,originalSkyRotation,roadSegments;
  const highSky={value:0};
  let switches={sky:true,near:true,distant:true,stands:true,terrain:true,grass:true};
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const noise=(x,z)=>Math.sin(x*.63+Math.sin(z*.71)*1.7)*.5+Math.sin(z*.39+x*.27)*.3+Math.sin(x*1.7-z*.83)*.2;
  function random(seed){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
  function copy(m){const c=m.clone();c.onBeforeCompile=m.onBeforeCompile;c.customProgramCacheKey=m.customProgramCacheKey.bind(m);return c;}
  function register(pair){for(const m of new Set(Object.values(pair).filter(m=>m?.isMaterial)))pairs.set(m,pair);}
  function onlyPark(material,layer='stands'){
    const hidden=copy(material);hidden.visible=false;
    register({original:hidden,enhanced:hidden,detailed:hidden,structured:hidden,refined:hidden,grounded:hidden,parked:material});
    newMaterials.set(material,layer);
    return material;
  }
  function hideInPark(mesh,layer=null,keepAtCorner=false){
    const pair=pairs.get(mesh.material);
    const base=window.F1GroundLayer.materialFor(mesh,'F')||window.F1RefineLayer.materialFor(mesh,'F')||pair?.grounded||pair?.refined||pair?.structured||pair?.detailed||pair?.enhanced||mesh.material;
    const park=copy(base);park.visible=false;
    pairs.set(park,pairs.get(base)||pair||{original:mesh.material,enhanced:base,grounded:base});
    const record={base,park,layer,keepAtCorner};own.set(mesh,record);byName.set(mesh.name,record);
  }
  function replaceVerge(mesh,material){
    hideInPark(mesh,'terrain');
    own.get(mesh).park=material;
  }
  function cleanPitScenery(){
    // The imported flags are separate from the poles in the hidden metal layer.
    // The low pit wing also has its roof ribs in a separate mesh family.
    const trims={Imported_Monza_box_M005_6_1:[1373,1301],Imported_Monza_walls005_0_0:[920,916]};
    let flags=0,roofParts=0,offcuts=0;
    for(const mesh of [...root.children]){
      const name=mesh.name.replace(/_tile-?\d+$/,'');
      if(/^Imported_Monza_flag[12]005_/.test(name)){hideInPark(mesh);flags++;continue;}
      if(/^Imported_Monza_box_M005_[0-5]_/.test(name)){hideInPark(mesh);roofParts++;continue;}
      // These two source tiles contain a trailing piece of the same low roof
      // and an isolated sliver at the end of the pit wall, respectively.
      const cut=trims[name];
      if(!cut||mesh.geometry.index?.count!==cut[0]*3)continue;
      const geometry=new T.BufferGeometry(),source=mesh.geometry;
      const used=[],remap=new Map(),indices=[];
      for(let k=0;k<cut[1]*3;k++){
        const vertex=source.index.getX(k);
        if(!remap.has(vertex)){remap.set(vertex,used.length);used.push(vertex);}
        indices.push(remap.get(vertex));
      }
      for(const [key,attribute] of Object.entries(source.attributes)){
        const size=attribute.itemSize,array=new attribute.array.constructor(used.length*size);
        used.forEach((vertex,i)=>array.set(attribute.array.subarray(vertex*size,(vertex+1)*size),i*size));
        geometry.setAttribute(key,new T.BufferAttribute(array,size,attribute.normalized));
      }
      geometry.setIndex(indices);geometry.computeBoundingBox();geometry.computeBoundingSphere();
      hideInPark(mesh);
      const material=onlyPark(copy(own.get(mesh).base));material.visible=true;
      const clean=mesh.clone();clean.name=mesh.name.replace('Imported_Monza_','Imported_Monza_H_clean_');
      clean.geometry=geometry;clean.material=material;root.add(clean);offcuts+=cut[0]-cut[1];
    }
    counts.pitCleanup={flagMeshes:flags,roofBatches:roofParts,trimmedFaces:offcuts};
  }
  function land(s,l,y=-.53,right=false){
    const q=Math.max(-690,Math.min(road.raceMetres+900,s)),h=road.heading(q),p=road.lane(q,0,0);
    p.addScaledVector(new T.Vector3(-Math.cos(h),0,Math.sin(h)),s-q);
    if(right){p.x-=Math.sin(h)*l;p.z=-p.z+Math.cos(h)*l;}else{p.x+=Math.sin(h)*l;p.z+=Math.cos(h)*l;}
    p.y=y;return p;
  }
  function makeRoadSegments(){
    const stations=[-700];
    for(let s=road.turnStart;s<road.turnEnd;s+=3)stations.push(s);
    stations.push(road.turnEnd,road.raceMetres+950);
    return stations.slice(1).map((end,i)=>{
      const start=stations[i],a=road.lane(start,0,0),b=road.lane(end,0,0);
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      return {start,end,x:a.x,z:a.z,dx,dz,length};
    });
  }
  function roadFrame(x,z,right=false){
    const localZ=right?-z:z;
    let best=Infinity,s=0,l=0;
    for(const a of roadSegments){
      const x0=x-a.x,z0=localZ-a.z;
      const t=Math.max(0,Math.min(1,(x0*a.dx+z0*a.dz)/(a.length*a.length)));
      const rx=x0-t*a.dx,rz=z0-t*a.dz,d=rx*rx+rz*rz;
      if(d>=best)continue;
      best=d;s=a.start+t*(a.end-a.start);l=(rx*a.dz-rz*a.dx)/a.length;
    }
    return {s,l:right?-l:l,distance:Math.sqrt(best)};
  }
  function standZone(s,l){return l< -26&&l> -61&&s>groups[0][0]-50&&s<groups[1].at(-1)+50;}
  function groundHeight(s,l){
    const a=Math.abs(l);
    const paved=smooth(-65,-61,l)*(1-smooth(-26,-22,l))*smooth(groups[0][0]-58,groups[0][0]-50,s)*(1-smooth(groups[1].at(-1)+50,groups[1].at(-1)+58,s));
    const cornerPad=(1-smooth(41,59,Math.abs(s-road.turnStart-32)))*smooth(32,38,a)*(1-smooth(80,88,a));
    const park=.08+.36*(noise(s/72,l/70)+1)*.5;
    const berm=(l<0?.68:.24)*smooth(32,49,a)*(1-smooth(72,105,a))*(1-smooth(215,255,s))*(.60+.40*Math.sin(s*.0107)**2);
    const shoulder=.18*smooth(14,23,a)*(1-smooth(35,47,a))*(.55+.45*noise(s/9,l/8));
    return baseHeight*(1-cornerPad)+(-.537)*cornerPad+(1-Math.max(paved,cornerPad))*(smooth(24,45,a)*park+berm+shoulder);
  }
  function groundAt(x,z,right=false){const p=roadFrame(x,z,right);return groundHeight(p.s,p.l);}
  function fieldSurface(x,z,right){
    const x0=Math.floor(x/gridStep)*gridStep,z0=Math.floor(z/gridStep)*gridStep;
    const u=(x-x0)/gridStep,v=(z-z0)/gridStep;
    const b=groundAt(x0+gridStep,z0,right),c=groundAt(x0,z0+gridStep,right);
    if(u+v<=1)return (1-u-v)*groundAt(x0,z0,right)+u*b+v*c;
    return (1-v)*b+(1-u)*c+(u+v-1)*groundAt(x0+gridStep,z0+gridStep,right);
  }
  function plantingSurface(x,z,right){
    const field=fieldSurface(x,z,right),a=roadFrame(x,z,right).distance;
    // Match Meadow_edge_grade_F: the 1.2 m grass shoulder slopes down from
    // the runoff to the field. Flat-field roots were buried under this strip.
    if(a<12||a>=13.2)return field;
    const grade=a<12.35?-.417-(a-12)*(.032/.35):-.449-(a-12.35)*(.081/.85);
    return Math.max(field,grade);
  }
  function grassSpread(width,distance){
    // Taper the shared clump footprint at the paved edge; blades stay on turf.
    return Math.min(width,Math.max(.1,(distance-12)/.36));
  }
  function forestClearing(x,z,radius){
    // Leave a clear view through the far end of the starting straight. The
    // 1-degree opening lens makes even small plants in this sector prominent.
    if(x>695-radius&&x<938+radius&&z> -117-radius&&z<29+radius)return true;
    for(const right of [false,true]){
      const p=roadFrame(x,z,right),inside=right?-p.l:p.l;
      if(p.distance<39+radius)return true;
      // The budget lens tracks down the inside of the right bend. Keep the
      // entire camera side open there, including clearance for crown width.
      if(p.s>road.turnStart-50&&p.s<road.raceMetres+420&&inside>0&&inside<175+radius)return true;
    }
    // Fixed opening camera and its fan of rays across the grid and straight.
    return x>-155-radius&&x<685+radius&&z>10-radius&&z<116+radius;
  }
  function baked(name,logical,index,material,{assembly=null}={}){
    const g=new T.BufferGeometry(),vertices=[],uv=[];
    for(let k=0;k<logical.length;k+=3){const [s,l,y]=logical.slice(k,k+3),p=land(s,l,y);vertices.push(p.x,p.y,p.z);uv.push(p.x/2400+.5,.5-p.z/2400);}
    g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('parkRoad',new T.Float32BufferAttribute(logical,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
    if(material.userData.parkTileMetres){
      const n=g.attributes.normal,tex=g.attributes.uv,tile=material.userData.parkTileMetres;
      for(let k=0;k<n.count;k++){
        const [s,l,y]=logical.slice(k*3,k*3+3);
        if(Math.abs(n.getY(k))>.65)tex.setXY(k,s/tile,l/tile);
        else if(Math.abs(n.getZ(k))>.65)tex.setXY(k,s/tile,y/tile);
        else tex.setXY(k,l/tile,y/tile);
      }
    }
    const mesh=new T.Mesh(g,material);mesh.name=name;mesh.castShadow=false;mesh.receiveShadow=false;mesh.matrixAutoUpdate=false;mesh.updateMatrix();
    mesh.userData.f1Park=true;if(assembly)mesh.userData.f1SceneryAssembly=assembly;root.add(mesh);return mesh;
  }
  function box(name,s,l,y,length,width,height,mat,assembly=null){
    const g=new T.BoxGeometry(length,height,width),p=g.attributes.position,logical=[],indices=Array.from(g.index.array);
    // Local +X maps to increasing station (-world X on the straight).
    // Reverse winding once for that handedness change, then recompute normals.
    for(let k=0;k<indices.length;k+=3)[indices[k+1],indices[k+2]]=[indices[k+2],indices[k+1]];
    for(let k=0;k<p.count;k++)logical.push(s+p.getX(k),l+p.getZ(k),y+p.getY(k));g.dispose();return baked(name,logical,indices,mat,{assembly});
  }
  function ribbon(name,s0,s1,l0,l1,height,mat,step=5){
    const logical=[],indices=[],n=Math.ceil((s1-s0)/step);
    for(let k=0;k<=n;k++)for(const l of[l0,l1]){const s=s0+(s1-s0)*k/n;logical.push(s,l,typeof height==='function'?height(s,l):height);}
    for(let k=0;k<n;k++){const a=k*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}return baked(name,logical,indices,mat);
  }
  function instances(name,geometry,material,items,{block=false,assembly=null,planar=false,parent=root,right=false}={}){
    if(!items.length)return null;const mesh=new T.InstancedMesh(geometry,material,items.length),o=new T.Object3D();mesh.name=name;
    const authored=items.map(p=>({s:p.s,l:p.l,y:p.y??groundHeight(p.s,p.l),yaw:p.yaw||0,xyz:p.xyz||[p.scale||1,p.scale||1,p.scale||1],attach:p.attach}));
    authored.forEach((p,k)=>{placeInstance(o,p,planar,right);mesh.setMatrixAt(k,o.matrix);if(items[k].color)mesh.setColorAt(k,items[k].color);});
    mesh.userData.f1Park=true;mesh.userData.f1ParkPlacements=authored;mesh.userData.f1ParkPlanar=planar;
    if(items[0].treeId!==undefined)mesh.userData.treeIds=items.map(p=>p.treeId);if(block)mesh.userData.f1SceneryBlock=true;if(assembly)mesh.userData.f1SceneryAssembly=assembly;
    mesh.castShadow=false;mesh.receiveShadow=false;mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.updateMatrix();parent.add(mesh);return mesh;
  }
  function placeInstance(object,p,planar,right){
    if(planar)object.position.set(-p.s,p.y,p.l);
    else object.position.copy(land(p.s,p.l,p.y,right));
    if(planar||p.attach)object.position.y+=plantingSurface(object.position.x,object.position.z,right)-baseHeight;
    object.rotation.set(0,p.yaw+(planar?0:(right?-1:1)*road.heading(p.s)),0);
    object.scale.fromArray(p.xyz);object.updateMatrix();
  }
  function cells(items,length=100,width=70){
    const map=new Map();
    for(const p of items){
      const key=Math.floor(p.s/length)+':'+Math.floor(p.l/width);
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(p);
    }
    return map;
  }
  function leafGeometry(source){
    const g=source.clone(),p=g.attributes.position,colors=[];
    for(let k=0;k<p.count;k++){
      const height=p.getY(k),radius=Math.hypot(p.getX(k),p.getZ(k));
      const light=.73+.17*smooth(.21,.88,height)+.10*smooth(.12,.44,radius);
      colors.push(light,light,light);
    }
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return g;
  }
  function reducedCrown(source,stride,leafScale){
    const position=source.attributes.position;
    const fields=Object.entries(source.attributes).map(([key,attribute])=>({key,attribute,values:[]}));
    const indices=[];
    for(let first=0;first+3<position.count;first+=4*stride){
      const base=indices.length/6*4,centre=new T.Vector3();
      for(let k=0;k<4;k++)centre.add(new T.Vector3().fromBufferAttribute(position,first+k));
      centre.multiplyScalar(.25);
      for(let k=0;k<4;k++)for(const {key,attribute,values} of fields){
        const i=first+k;
        if(key==='position'){
          const p=new T.Vector3().fromBufferAttribute(position,i).sub(centre).multiplyScalar(leafScale).add(centre);
          values.push(...p.toArray());
        }else for(let c=0;c<attribute.itemSize;c++)values.push(attribute.array[i*attribute.itemSize+c]);
      }
      indices.push(base,base+1,base+2,base,base+2,base+3);
    }
    const g=new T.BufferGeometry();
    for(const {key,attribute,values} of fields)g.setAttribute(key,new T.Float32BufferAttribute(values,attribute.itemSize));
    g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function mainBranches(source,minRadius){
    // EZ-Tree emits each branch as a separate indexed tube. Keep the thicker
    // tubes intact so the bark UVs and the original forks stay aligned.
    const index=source.index.array,positions=source.attributes.position;
    const retained=[];
    let end=-1,keep=false;
    for(let k=0;k<index.length;k+=3){
      const first=index[k];
      if(first>end){
        const halfRing=first+Math.floor((index[k+1]-first-1)/2);
        const diameter=Math.hypot(positions.getX(first)-positions.getX(halfRing),positions.getY(first)-positions.getY(halfRing),positions.getZ(first)-positions.getZ(halfRing));
        keep=diameter>=2*minRadius;
      }
      end=Math.max(end,index[k],index[k+1],index[k+2]);
      if(keep)retained.push(index[k],index[k+1],index[k+2]);
    }
    const g=new T.BufferGeometry();
    for(const [name,attribute] of Object.entries(source.attributes))g.setAttribute(name,attribute);
    g.setIndex(retained);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function woodland(){
    const rand=random(741590),templates=new Map();
    root.traverse(mesh=>{
      const match=mesh.name.match(/^Irregular_broadleaf_detail_([0-3])_(branches|leaves)_/);
      if(match&&!templates.has(match[1]+match[2]))templates.set(match[1]+match[2],mesh);
    });
    const near=Array.from({length:4},()=>[]),middle=Array.from({length:4},()=>[]),far=Array.from({length:4},()=>[]);
    const variant=(s,l)=>Math.min(3,Math.floor((noise(s/170,l/150)+1)*1.95));
    const tint=()=>new T.Color().setHSL(.221+rand()*.04,.17+rand()*.09,.65+rand()*.14);
    for(let attempt=0;attempt<6500&&trees.length<430;attempt++){
      const s=-1025+rand()*1700;
      let l=(rand()<.68?-1:1)*(64+rand()*121);
      if(attempt%5===0&&s>260)l=(rand()<.5?-1:1)*(145+rand()*340);
      const size=rand(),height=10.8+size*5.9;
      if(standZone(s,l)||forestClearing(-s,l,(12.5+size*8)*.53))continue;
      if(trees.some(p=>Math.abs(p.s-s)<15&&Math.hypot(p.s-s,p.l-l)<14))continue;
      if(rand()>.74+.24*noise(s/95,l/105))continue;
      const p={s,l,xyz:[height*.88,height,height*.86],height,y:baseHeight-.08,yaw:rand()*Math.PI*2,treeId:400000+trees.length,color:tint()};
      near[variant(s,l)].push(p);trees.push(p);
    }
    for(let s=-1110;s<=1060;s+=33)for(let l=-595;l<=595;l+=29){
      if(Math.abs(l)<121||rand()>.71+.23*noise(s/95,l/110))continue;
      const station=s+(rand()-.5)*18,lateral=l+(rand()-.5)*17,size=rand(),height=10.4+size*6.4;
      if(forestClearing(-station,lateral,(12.5+size*10)*.57))continue;
      if(trees.some(p=>Math.abs(p.s-station)<11&&Math.hypot(p.s-station,p.l-lateral)<11))continue;
      const tier=Math.abs(lateral)>316||station>690?far:middle;
      tier[variant(station,lateral)].push({s:station,l:lateral,height,y:baseHeight-.09,xyz:[height*.87,height,height*.86],yaw:rand()*6.28,color:tint()});
    }
    // The original pit and grandstand meshes end before x=692 m. Plant
    // staggered bands beyond them so the opening lens sees through the crowns
    // to the next band and to sky, with no foliage in front of the facilities.
    const bands=[
      {x:850,low:3.6,high:4.75,spacing:5.6},
      {x:938,low:4.65,high:5.75,spacing:4.8},
      {x:1023,low:5.55,high:6.70,spacing:4.2}
    ];
    const aerial=new T.Color(0xa5b8b5);
    for(const [depth,{x,low,high,spacing}] of bands.entries())for(let z=-130+depth*3;z<=-29;z+=spacing*(.76+rand()*.53)){
      const s=-x+(rand()-.5)*18,l=z+(rand()-.5)*spacing*.44,height=low+(high-low)*rand();
      const width=Math.min(6.35,height*(.99+rand()*.12)),color=tint().lerp(aerial,.12*depth);
      const species=Math.floor(rand()*2)+(rand()<.73?0:2);
      const p={s,l,height,y:baseHeight-.06,xyz:[width,height,width],yaw:rand()*Math.PI*2,color};
      // The long lens resolves these crowns even at the farthest band.
      middle[species].push(p);openingTrees.push(p);
    }
    const saplingSites=understorySites(rand,tint);
    const woodTints=[0xd6c8b0,0xc5b59f,0xd1ccbc,0xc2baab].map(color=>new T.Color(color));
    for(let v=0;v<4;v++)for(const part of['branches','leaves']){
      const src=templates.get(v+part);if(!src)continue;const m=onlyPark(copy(src.material),'near');m.name='Trackside '+part+' H';m.roughness=1;m.envMapIntensity=.29;
      if(part==='leaves'){
        m.color.setHex(0xa9bf93);m.vertexColors=true;m.alphaToCoverage=true;m.alphaTest=.38;
        const old=m.onBeforeCompile,key=m.customProgramCacheKey();
        m.onBeforeCompile=function(shader,render){old.call(this,shader,render);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight+=diffuseColor.rgb*.08;\n#include <opaque_fragment>');};
        m.customProgramCacheKey=()=>key+'-trackside-leaves-H1';
        window.F1MaterialJ.filterLeaves(m);
      }else{
        m.color.copy(woodTints[v]);m.normalScale.set(.43,.43);m.envMapIntensity=.36;
      }
      const g=part==='leaves'?leafGeometry(src.geometry):src.geometry;
      const bark=items=>items.map(p=>({...p,color:null}));
      for(const [cell,items]of cells(near[v],130,100))instances('Irregular_broadleaf_park_G_'+v+'_'+part+'_'+cell,g,m,part==='leaves'?items:bark(items),{planar:true});
      if(part==='leaves'){
        const middleMaterial=onlyPark(copy(m),'distant'),middleGeometry=reducedCrown(g,4,1.59);
        for(const [cell,items]of cells(middle[v],210,140))instances('Park_G_middle_canopy_'+v+'_'+cell,middleGeometry,middleMaterial,items,{planar:true});
        const farMaterial=onlyPark(copy(m),'distant'),farGeometry=reducedCrown(g,7,1.93);
        farMaterial.color.lerp(new T.Color(0xb7c5ac),.21);
        for(const [cell,items]of cells(far[v],230,180))instances('Park_G_distant_canopy_'+v+'_'+cell,farGeometry,farMaterial,items,{planar:true});
        const saplingGeometry=reducedCrown(g,4,1.27);
        // The distant grid lens sees below the crowns. A denser low leaf layer
        // at the back of that grove prevents a bare strip at the horizon.
        const gridGeometry=reducedCrown(g,2,1.28);gridGeometry.scale(1.07,1.12,1.07).translate(0,-.29,0);
        for(const [label,sites] of saplingSites)for(const [cell,items] of cells(sites.filter(p=>p.species===v),210,125)){
          const canopy=label==='grid_back'?gridGeometry:label==='woodland_back'?farGeometry:saplingGeometry;
          instances('Park_H_'+label+'_canopy_'+v+'_'+cell,canopy,middleMaterial,items,{planar:true});
        }
      }else{
        const trunks=onlyPark(copy(m),'distant');trunks.name='Textured woodland trunks and forks';
        const main=mainBranches(g,.0050),distant=mainBranches(g,.0105);
        for(const [cell,items]of cells(middle[v],210,140))instances('Park_H_middle_branches_'+v+'_'+cell,main,trunks,bark(items),{planar:true});
        for(const [cell,items]of cells(far[v],230,180))instances('Park_H_distant_branches_'+v+'_'+cell,distant,trunks,bark(items),{planar:true});
        for(const [label,sites] of saplingSites)for(const [cell,items] of cells(sites.filter(p=>p.species===v),210,125)){
          instances('Park_H_'+label+'_branches_'+v+'_'+cell,label==='woodland_back'?distant:main,trunks,bark(items),{planar:true});
        }
      }
    }
    counts.matureTrees=trees.length;counts.middleCanopies=middle.flat().length;counts.distantCanopies=far.flat().length;
    counts.treeHeightMetres={mature:[10.8,16.7],middleAndFar:[10.4,16.8]};
    counts.openingWoodland={trees:openingTrees.length,bands};
  }
  function understorySites(rand,tint){
    // Use the same irregular oak/ash branches and leaf silhouettes as the
    // larger trees, with varied height and aspect among neighbouring saplings.
    const edge=[],grid=[],woods=[],back=[];
    const plant=(s,l,height,width)=>({s,l,height,y:baseHeight-.08,xyz:[width,height,width*(.83+rand()*.16)],yaw:rand()*Math.PI*2,color:tint(),species:Math.floor(rand()*4)});
    for(const p of trees)if(rand()<.30){
      const s=p.s+(rand()-.5)*10,l=p.l-Math.sign(p.l)*(2+rand()*5),height=2.15+rand()*2.8;
      if(!forestClearing(-s,l,height*.54))edge.push(plant(s,l,height,height*(.89+rand()*.19)));
    }
    const rows=[
      {x:989,low:2.8,high:4.6,step:2.25},
      {x:1024,low:3.4,high:5.4,step:2.45},
      {x:1055,low:4.3,high:5.9,step:2.55}
    ];
    for(const [depth,{x,low,high,step}] of rows.entries()){
      for(let z=-155+depth*2.7;z<=-38;z+=step*(.84+rand()*.36)){
        const s=-x+(rand()-.5)*20,l=z+(rand()-.5)*3.6,height=low+(high-low)*rand();
        grid.push(plant(s,l,height,height*(1.35+rand()*.32)));
      }
    }
    for(const [row,lateral] of [-192,-278,221,321].entries()){
      for(let s=-1080+row*6;s<1060;s+=8.8+rand()*8.9){
        const l=lateral+(rand()-.5)*56,height=3.1+rand()*4.3,width=height*(.88+rand()*.29);
        if(!forestClearing(-s,l,width*.57))woods.push(plant(s,l,height,width));
      }
    }
    const air=new T.Color(0x9cae9b);
    for(const [row,lateral] of [-414,-505,414,507].entries()){
      for(let s=-1100+row*7;s<1080;s+=8.4+rand()*7.2){
        const l=lateral+(rand()-.5)*66,height=6.4+rand()*4.1,width=height*(.94+rand()*.25);
        if(forestClearing(-s,l,width*.55))continue;
        const p=plant(s,l,height,width);p.color.lerp(air,.15);back.push(p);
      }
    }
    understory.push(...edge,...grid,...woods,...back);
    counts.openingUnderstory={plants:grid.length,rows};counts.sharedUnderstory=woods.length;counts.edgeSaplings=edge.length;
    counts.backlineTrees=back.length;
    return [['forest_edge',edge],['grid_back',grid],['woodland_understory',woods],['woodland_back',back]];
  }
  function facilities(){
    const backs=root.getObjectByName('Far_Grandstand_detail_seat_backs'),cushions=root.getObjectByName('Far_Grandstand_detail_seat_cushions');
    const base=root.getObjectByName('Imported_Monza_cleanstand_groundbase_0')?.material;
    const concrete=onlyPark(base?copy(base):new T.MeshStandardMaterial({roughness:.97,envMapIntensity:.24}));
    concrete.name='Textured grandstand concrete H';concrete.color.setHex(0xbabbb2);concrete.userData.parkTileMetres=2.71;
    const endConcrete=onlyPark(copy(concrete));
    endConcrete.name='Pale precast grandstand end walls H';endConcrete.color.setHex(0xe1e4e7);
    endConcrete.envMapIntensity=.8;endConcrete.normalScale?.set(.12,.12);
    // A small baked diffuse fill keeps the sunless concrete legible. Reuse
    // its surface map, so the shade retains the precast texture.
    endConcrete.emissive.setHex(0xbbc5d0);endConcrete.emissiveIntensity=.70;
    endConcrete.emissiveMap=endConcrete.map;
    const roof=onlyPark(new T.MeshStandardMaterial({color:0xc5c9c5,roughness:.76,metalness:.12,envMapIntensity:.36}));
    const wrap=onlyPark(new T.MeshStandardMaterial({color:0x3c4c50,roughness:.92,envMapIntensity:.22})),seatsMat=onlyPark(new T.MeshStandardMaterial({color:0xd8dfd7,roughness:.84,envMapIntensity:.22}));
    for(const [groupIndex,stations]of groups.entries())for(const [local,station]of stations.entries()){
      const module=groupIndex*3+local,assembly='parkstand_'+module,logical=[],indices=[];
      // These groups sit entirely on the straight. A single closed shell per
      // module avoids hidden coplanar walls at each intermediate section.
      const profile=[[-35,-.55],[-35,.26]];
      for(let row=0;row<13;row++){
        const edge=-35-row*.92,height=.26+row*.42;
        profile.push([edge,height],[edge-.92,height]);
        if(row<12)profile.push([edge-.92,height+.42]);
      }
      profile.push([-46.96,-.55]);
      const shape=new T.Shape();profile.forEach(([l,y],i)=>i?shape.lineTo(l,y):shape.moveTo(l,y));shape.closePath();
      const solid=new T.ExtrudeGeometry(shape,{depth:90,bevelEnabled:false,steps:1}),p=solid.attributes.position;
      for(let k=0;k<p.count;k++)logical.push(station-45+p.getZ(k),p.getX(k),p.getY(k));
      if(solid.index)indices.push(...solid.index.array);else for(let k=0;k<p.count;k++)indices.push(k);
      solid.dispose();
      baked('Imported_Monza_park_G_stand_body_'+module,logical,indices,concrete,{assembly});
      box('Imported_Monza_park_G_canopy_'+module,station,-41.0,7.25,91.9,14,.20,roof,assembly);
      box('Imported_Monza_park_G_rear_wrap_'+module,station,-47.1,3.31,91,.16,7.70,wrap,assembly);
      // One continuous seating group: no opaque partitions at module seams.
      // A low sloping parapet caps each outside face, rather than an extra
      // tooth at every seating row. The wall stays below the roof.
      for(const side of [-1,1]){
        if(side<0?local!==0:local!==stations.length-1)continue;
        const capShape=new T.Shape();
        capShape.moveTo(-35,-.55);capShape.lineTo(-35,.66);
        capShape.lineTo(-46.96,5.70);capShape.lineTo(-46.96,-.55);
        capShape.closePath();
        const cap=new T.ExtrudeGeometry(capShape,{depth:.34,bevelEnabled:false,steps:1}),pos=cap.attributes.position,points=[],faces=[];
        const start=station+side*45.18-.17;
        for(let k=0;k<pos.count;k++)points.push(start+pos.getZ(k),pos.getX(k),pos.getY(k));
        if(cap.index)faces.push(...cap.index.array);else for(let k=0;k<pos.count;k++)faces.push(k);
        cap.dispose();
        baked('Imported_Monza_park_H_end_wall_'+groupIndex+'_'+side,points,faces,endConcrete,{assembly});
      }
      const b=[],c=[];
      for(let row=0;row<13;row++)for(let col=0;col<88;col++){
        if([21,22,65,66].includes(col))continue;const s=station-43.3+col*.98,l=-35.44-row*.92,y=.26+row*.42,color=new T.Color((Math.floor(col/22)+row)%7===0?0xb7c0bd:groupIndex?0x627c87:0x77959d);
        b.push({s,l:l-.22,y:y+.39,color});c.push({s,l,y:y+.10,color});
      }
      if(backs&&cushions){instances('Imported_Monza_park_G_seat_backs_'+module,backs.geometry,seatsMat,b,{block:true,assembly});instances('Imported_Monza_park_G_seat_cushions_'+module,cushions.geometry,seatsMat,c,{block:true,assembly});}
    }
    const asphalt=onlyPark(new T.MeshStandardMaterial({color:0x6e746e,roughness:1,envMapIntensity:.18,side:T.DoubleSide}));
    for(const [i,stations]of groups.entries()){
      const a=stations[0]-48,b=stations.at(-1)+48;
      ribbon('Park_G_service_ground_'+i,a,b,-47.3,-59,-.50,asphalt);
      ribbon('Park_G_spectator_access_'+i,a,b,-28.3,-34.9,-.505,asphalt);
      // A low continuous boundary links the precinct, behind the racing action.
      box('Imported_Monza_park_G_boundary_'+i,(a+b)/2,-25.0,-.11,b-a,.30,.85,concrete);
      box('Park_G_service_annex_'+i,(a+b)/2,-53.0,1.25,34,7,3.5,wrap);
      box('Park_G_service_roof_'+i,(a+b)/2,-53,3.05,36,8,.16,roof);
      for(let k=0;k<3;k++)box('Park_G_support_pavilion_'+i+'_'+k,a+18+k*29,-55.0,.89,11,5,2.8,k%2?roof:concrete);
    }
    // The inter-group opening is a tree-backed entrance into the shared site.
    const openingStart=groups[0].at(-1)+41,openingEnd=groups[1][0]-41;
    ribbon('Park_G_intergroup_access',openingStart,openingEnd,-31,-57,-.50,asphalt);
    box('Imported_Monza_park_G_access_building',(openingStart+openingEnd)/2,-48,1.05,22,8,3.16,concrete);
    // The entry building is already a closed solid. Its old overhanging
    // canopy projected across the gap as an unsupported horizontal plank.
    counts.standGroups=2;counts.standModules=5;counts.standEndWalls=4;counts.standInteriorPartitions=0;counts.spectators=0;counts.standStations=groups;
  }
  function groundShade(){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=2048;
    const c=canvas.getContext('2d'),pixels=canvas.width/(2*fieldHalf);
    c.fillStyle='#ffffff';c.fillRect(0,0,canvas.width,canvas.height);
    const coord=value=>(value+fieldHalf)*pixels;
    // Soft ground contact follows the planting on both versions of the road.
    for(const p of [...trees,...openingTrees,...understory]){
      const x=-p.s,z=p.l,rx=p.xyz[0]*.52*pixels,rz=p.xyz[2]*.48*pixels;
      c.save();c.translate(coord(x),coord(z));c.scale(rx,rz);
      const grad=c.createRadialGradient(0,0,.16,0,0,1);
      grad.addColorStop(0,'rgba(31,42,25,.64)');grad.addColorStop(.65,'rgba(38,52,30,.36)');grad.addColorStop(1,'rgba(38,52,30,0)');
      c.fillStyle=grad;c.fillRect(-1,-1,2,2);c.restore();
    }
    for(const stations of groups)for(const s of stations){
      c.fillStyle='rgba(33,39,29,.33)';c.fillRect(coord(-s-46),coord(-55),92*pixels,24*pixels);
    }
    shade=new T.CanvasTexture(canvas);shade.colorSpace=T.NoColorSpace;shade.generateMipmaps=true;shade.wrapS=shade.wrapT=T.ClampToEdgeWrapping;
    counts.staticShadeSize=[canvas.width,canvas.height];
  }
  // Sample the same turf, worn patches and contact shade for the ground and
  // its blades. This keeps tufts rooted in the photograph at grazing angles.
  const grassPalette=`
    uniform sampler2D parkVerge;
    uniform sampler2D parkShade;
    float parkHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float parkNoise(vec2 p){
      vec2 i=floor(p),f=smoothstep(vec2(0.),vec2(1.),fract(p));
      return mix(mix(parkHash(i),parkHash(i+vec2(1.,0.)),f.x),
        mix(parkHash(i+vec2(0.,1.)),parkHash(i+vec2(1.,1.)),f.x),f.y);
    }
    vec2 parkSecondTurf(vec2 uv){return mat2(.8,-.6,.6,.8)*uv*(2400./3.6)+vec2(.173,.613);}
    vec3 parkGrassTone(vec3 turf,vec2 uv,float footprint){
      vec2 metres=(uv-.5)*2400.;
      float resolved=1.-smoothstep(.22,1.20,footprint);
      float turfVariation=.61*parkNoise(metres*.18)+.39*parkNoise(metres*.62);
      float wear=.055+.18*smoothstep(.39,.82,turfVariation)*mix(.27,1.,resolved);
      vec3 verge=texture2D(parkVerge,uv*1200.).rgb*vec3(.80,.95,.79);
      float contact=texture2D(parkShade,uv).r;
      float pigment=1.+.12*(parkNoise(metres*.43)-.5)*resolved;
      return mix(turf,verge,wear)*mix(.59,1.,contact)*pigment;
    }
  `;
  function grassMaterial(base,verge){
    const m=base.clone();m.name='Meadow turf with short grass cover';m.color.setHex(0xb9cbb5);
    m.normalScale.set(.29,.29);
    m.onBeforeCompile=shader=>{
      shader.uniforms.parkShade={value:shade};shader.uniforms.parkVerge={value:verge};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 parkGrassUv;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nparkGrassUv=vec2(transformed.x,-transformed.z)/2400.+.5;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 parkGrassUv;\n'+grassPalette)
        .replace('#include <map_fragment>',`#include <map_fragment>
          vec2 alternateUv=parkSecondTurf(parkGrassUv);
          vec3 alternate=texture2D(map,alternateUv).rgb*diffuse;
          vec2 dx=dFdx(parkGrassUv)*2400.,dy=dFdy(parkGrassUv)*2400.;
          float footprint=max(length(dx),length(dy));
          float area=max(.000001,abs(dx.x*dy.y-dx.y*dy.x));
          float grazing=smoothstep(5.,22.,footprint*footprint/area);
          // The telephoto camera sees very long ground footprints. Average
          // colour across that footprint and let upright blades carry detail.
          float coarseLod=max(0.,log2(max(.001,footprint)*float(textureSize(map,0).x)/1.4)+.65);
          vec3 coarse=mix(textureLod(map,vMapUv,coarseLod).rgb,
                          textureLod(map,alternateUv,max(0.,coarseLod-1.36)).rgb,.36)*diffuse;
          vec3 turf=mix(mix(diffuseColor.rgb,alternate,.36),coarse,grazing);
          diffuseColor.rgb=parkGrassTone(turf,parkGrassUv,max(footprint,grazing*1.05));
        `).replace('#include <normal_fragment_maps>',`vec3 turfSurfaceNormal=normal;
          #include <normal_fragment_maps>
          normal=normalize(mix(normal,turfSurfaceNormal,grazing*.96));
        `);
    };
    m.customProgramCacheKey=()=> 'monza-meadow-H2';return m;
  }
  function terrainTile(x0,z0,right){
    const positions=[],uv=[],indices=[],n=tileSize/gridStep;
    for(let row=0;row<=n;row++)for(let col=0;col<=n;col++){
      const x=x0+col*gridStep,z=z0+row*gridStep,p=roadFrame(x,z,right),y=groundHeight(p.s,p.l);
      positions.push(x,y,z);uv.push(x/(2*fieldHalf)+.5,.5-z/(2*fieldHalf));
      counts.terrainMaxReliefMetres=Math.max(counts.terrainMaxReliefMetres||0,y-baseHeight);
    }
    for(let row=0;row<n;row++)for(let col=0;col<n;col++){
      const a=row*(n+1)+col,b=a+1,c=a+n+1,d=c+1;
      indices.push(a,c,b,b,c,d);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    g.setIndex(indices);g.computeVertexNormals();
    // Shared border heights and centred slope normals keep the tiles visually
    // continuous as the camera pans across the landscape.
    const normal=g.attributes.normal,direction=new T.Vector3();
    for(let row=0;row<=n;row++)for(let col=0;col<=n;col++){
      if(row>0&&row<n&&col>0&&col<n)continue;
      const x=x0+col*gridStep,z=z0+row*gridStep;
      const dx=groundAt(x+gridStep,z,right)-groundAt(x-gridStep,z,right);
      const dz=groundAt(x,z+gridStep,right)-groundAt(x,z-gridStep,right);
      direction.set(-dx,2*gridStep,-dz).normalize();normal.setXYZ(row*(n+1)+col,...direction.toArray());
    }
    g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function terrain(material){
    let count=0;
    for(let x=-fieldHalf;x<fieldHalf;x+=tileSize)for(let z=-fieldHalf;z<fieldHalf;z+=tileSize){
      const mesh=new T.Mesh(terrainTile(x,z,false),material);mesh.name='Park_G_terrain_'+x+'_'+z;
      mesh.userData.f1Park=true;mesh.userData.f1ParkTile=[x,z];mesh.matrixAutoUpdate=false;mesh.updateMatrix();root.add(mesh);count++;
    }
    counts.terrainCells=count;
  }
  function shortGrassGeometry(){
    const rand=random(290147),positions=[],colors=[],normals=[],indices=[];
    for(let blade=0;blade<18;blade++){
      const angle=blade*2.399963,spread=Math.sqrt(rand())*.305;
      const x=Math.cos(angle)*spread,z=Math.sin(angle)*spread;
      const yaw=angle+(rand()-.5)*2,dx=Math.cos(yaw),dz=Math.sin(yaw);
      const height=.037+rand()*.068,halfWidth=.004+rand()*.007,bend=.014+rand()*.035;
      const green=.77+rand()*.23,base=positions.length/3;
      for(const [side,h,lean,width,light] of [[-1,0,0,1,.77],[1,0,0,1,.77],[-1,.62,.37,.65,.93],[1,.62,.37,.65,.93],[0,1,1,0,1.10]]){
        positions.push(x+dx*bend*lean-dz*halfWidth*side*width,height*h,z+dz*bend*lean+dx*halfWidth*side*width);
        colors.push(green*light,green*light,green*light*.93);normals.push(dx*.21,.978,dz*.21);
      }
      indices.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4);
    }
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
    g.setIndex(indices);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function grassBlades(mat,turf,verge,close=false,middle=false){
    mat.onBeforeCompile=shader=>{
      shader.uniforms.parkDrawHeight=grassViewport;
      shader.uniforms.parkTurf={value:turf.map};shader.uniforms.parkTurfTint={value:turf.color};shader.uniforms.parkShade={value:shade};shader.uniforms.parkVerge={value:verge};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float parkDrawHeight;varying float parkTip;varying vec2 parkBase;').replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 parkLocal=instanceMatrix*vec4(0.,0.,0.,1.);
        vec4 parkRoot=modelMatrix*parkLocal;
        parkBase=vec2(parkLocal.x,-parkLocal.z)/2400.+.5;
        float parkScale=length(instanceMatrix[1].xyz);
        float parkDepth=max(.1,-(viewMatrix*parkRoot).z);
        float parkPixels=.11*parkScale*projectionMatrix[1][1]*parkDrawHeight/(2.*parkDepth);
        float parkAlive=smoothstep(.55,2.3,parkPixels)${close?'*(1.-smoothstep(48.,64.,length(cameraPosition-parkRoot.xyz)))':middle?'*smoothstep(32.,48.,length(cameraPosition-parkRoot.xyz))*(1.-smoothstep(120.,140.,length(cameraPosition-parkRoot.xyz)))':''};
        parkTip=clamp(transformed.y/.11,0.,1.);
        transformed.y=transformed.y*parkAlive-(1.-parkAlive)*.04;
      `);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float parkTip;varying vec2 parkBase;uniform sampler2D parkTurf;uniform vec3 parkTurfTint;\n'+grassPalette)
        .replace('#include <normal_fragment_begin>',T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;','/* retain upward blade lighting */'))
        .replace('#include <map_fragment>',`#include <map_fragment>
        vec3 turfReference=textureLod(parkTurf,parkBase*(2400./1.4),5.).rgb*parkTurfTint;
        vec3 grassTone=parkGrassTone(turfReference,parkBase,1.);
        #ifdef USE_MAP
          grassTone=mix(grassTone,diffuseColor.rgb*vec3(.89,1.03,.89),.44);
        #else
          grassTone*=.80+.20*clamp(dot(diffuseColor.rgb,vec3(.25,.6,.15)),.0,1.);
        #endif
        vec3 bladeLight=mix(vec3(.57,.70,.55),vec3(1.06,1.14,.94),smoothstep(.07,.96,parkTip));
        diffuseColor.rgb=grassTone*bladeLight;
      `).replace('#include <opaque_fragment>','outgoingLight+=diffuseColor.rgb*.066;\n#include <opaque_fragment>');
    };
    mat.customProgramCacheKey=()=> close?'monza-close-turf-H4':middle?'monza-middle-turf-H4':'monza-projected-grass-H3';
    return onlyPark(mat,'grass');
  }
  function meadow(turf,verge,closePlan){
    const src=root.children.find(m=>m.name.startsWith('Meadow_short_grass_F_'));if(!src)return;
    grassViewport={value:renderer.domElement.height};
    const shortGeometry=shortGrassGeometry();
    const shortMaterial=grassBlades(new T.MeshStandardMaterial({name:'Short verge grass blades',side:T.DoubleSide,vertexColors:true,roughness:1,envMapIntensity:.14}),turf,verge);
    const nearSward=grassBlades(copy(shortMaterial),turf,verge,true);nearSward.name='Shared dense curved turf H';
    const middleSward=grassBlades(copy(shortMaterial),turf,verge,false,true);middleSward.name='Shared middle-distance curved turf H';
    closeGrass={plan:closePlan,sward:{geometry:shortGeometry,material:nearSward},middle:{geometry:shortGeometry,material:middleSward}};
    const rand=random(89211),short=[],tall=[],trackside=[];
    const put=(arr,s,l,height)=>{
      if(standZone(s,l))return;
      const spread=.87+rand()*.59;
      arr.push({s,l,y:baseHeight-.013,yaw:rand()*6.28,xyz:[spread,height/.11,spread],attach:true});
    };
    // Physical blades carry past the straight and around both handed routes.
    for(let s=-692;s<road.raceMetres+260;s+=.74)for(const sign of[-1,1])for(let l=13.9;l<29;l+=.74){
      if(rand()<.67+.20*noise(s/19,sign*l/9)){
        const roughness=smooth(15,27,l);
        put(trackside,s+(rand()-.5)*.70,sign*(l+(rand()-.5)*.70),.064+rand()*.072+roughness*rand()*.067);
      }
    }
    // Fill the graded shoulder continuously in both directions, including
    // the long-lens opening. An independent seed preserves the accepted field.
    const shoulder=[],edgeRandom=random(613729),edgePitch=.36;
    for(let s=-692;s<road.raceMetres+260;s+=edgePitch)for(const sign of[-1,1])for(let l=12.16;l<13.9;l+=edgePitch){
      const lateral=l+(edgeRandom()-.5)*.14;
      const spread=grassSpread(.82+edgeRandom()*.24,lateral);
      shoulder.push({s:s+(edgeRandom()-.5)*edgePitch,l:sign*lateral,y:baseHeight-.008,
        yaw:edgeRandom()*Math.PI*2,xyz:[spread,(.055+edgeRandom()*.042)/.11,spread],attach:true});
    }
    // The fixed long lens sees this foreground well before the cars pass it.
    for(let s=-648;s<145;s+=.53)for(let l=29;l<88;l+=.54){
      const openingVerge=1-(1-smooth(-410,-185,s))*smooth(55,74,l);
      const cover=.62+.32*noise(s/9,l/7);
      if(rand()<openingVerge*cover)put(short,s+(rand()-.5)*.51,l+(rand()-.5)*.52,.055+rand()*.073+cover*rand()*.046);
    }
    for(let s=-310;s<215;s+=1.3)for(let l=89;l<158;l+=1.3){
      if(rand()<.56+.25*noise(s/13,l/11))put(short,s+(rand()-.5)*1.25,l+(rand()-.5)*1.25,.088+rand()*.145);
    }
    for(let s=-915;s< -450;s+=1.4)for(let l=-108;l< -29;l+=1.4){
      if(rand()<.52+.24*noise(s/11,l/8))put(short,s+(rand()-.5)*1.35,l+(rand()-.5)*1.35,.076+rand()*.103);
    }
    for(const p of trees){
      if(rand()>.50||Math.abs(p.l)>205)continue;
      for(let k=0;k<20;k++){
        const s=p.s+(rand()-.5)*8,l=p.l-Math.sign(p.l)*(rand()*4);
        if(roadFrame(-s,l).distance>43&&roadFrame(-s,l,true).distance>43)put(tall,s,l,.17+rand()*.15);
      }
    }
    for(const [label,items,geometry,material]of[['shoulder',shoulder,shortGeometry,shortMaterial],['verge',trackside,shortGeometry,shortMaterial],['short',short,shortGeometry,shortMaterial],['edge',tall,shortGeometry,shortMaterial]]){
      for(const [cell,list]of cells(items,68,42)){
        const mesh=instances('Park_G_'+label+'_grass_'+cell,geometry,material,list,{planar:label!=='verge'&&label!=='shoulder'});
        mesh.onBeforeRender=updateGrassViewport;
      }
    }
    counts.shortGrass=short.length;counts.tracksideGrass=trackside.length;counts.edgeGrass=tall.length;
    counts.shoulderGrass=shoulder.length;counts.shoulderGrassPitchMetres=edgePitch;counts.grassEdgeMetres=12;
    counts.grassBladesPerClump=18;counts.closeGrassPitchMetres=.24;
    counts.grassLod='shared curved blade model; near cover to 64 m, middle cover to 140 m, projected height 0.55–2.3 px';counts.grassHeightMetres={verge:[.064,.203],short:[.055,.233],edge:[.17,.32],near:[.048,.255]};
    counts.grassScenes=closePlan.byScene;
  }
  function grassSite(p){
    if(p.distance<12.08||standZone(p.s,p.l))return false;
    // Both corner stand forecourts are paved; never sprout through them.
    return !(Math.abs(p.s-road.turnStart-32)<52&&p.distance>32&&p.distance<88);
  }
  function plantCloseMeadow(parent,right){
    const {plan,sward}=closeGrass,side=right?'right':'left';
    const rand=random(right?86321:52903),center=new T.Vector3(),pitch=.24;
    let count=0,cells=0;
    for(const [x0,z0] of plan[side]){
      const low=[],high=[];
      for(let i=pitch*.5;i<plan.tileMetres;i+=pitch)for(let j=pitch*.5;j<plan.tileMetres;j+=pitch){
        const x=x0+i+(rand()-.5)*pitch,z=z0+j+(rand()-.5)*pitch,p=roadFrame(x,z,right);
        if(!grassSite(p))continue;
        const clump=.5+.5*noise(x/4.7,z/5.9);
        if(rand()>.94+.055*clump)continue;
        const unmown=smooth(14,29,p.distance);
        const height=.048+rand()*.044+unmown*(.018+.095*clump**1.5),width=grassSpread(.76+rand()*.52,p.distance);
        low.push({s:-x,l:z,y:baseHeight-.008,xyz:[width,height/.11,width],yaw:rand()*Math.PI*2});
        // Densify the low turf without multiplying the taller cutout clumps.
        if(unmown>.18&&rand()<(.10+.48*unmown*clump)*(pitch/.43)**2){
          const tuftWidth=1.27+rand()*.95,tuftHeight=height*(1.08+rand()*.16);
          high.push({s:-x,l:z,y:baseHeight-.012,xyz:[tuftWidth,tuftHeight/.11,tuftWidth],yaw:rand()*Math.PI*2});
        }
      }
      if(!low.length)continue;
      for(const [label,{geometry,material},plants] of [[side,sward,low],['tufts_'+side,sward,high]]){
        const tile=instances('Park_H_close_grass_'+label+'_'+x0+'_'+z0,geometry,material,plants,{planar:true,parent,right});
        if(!tile)continue;
        const range=64+tile.boundingSphere.radius,fullCount=tile.count;
        tile.onBeforeRender=(_renderer,_scene,camera)=>{
          updateGrassViewport();center.copy(tile.boundingSphere.center).applyMatrix4(tile.matrixWorld);
          // Opening retains its accepted long-lens field. These cells extend
          // that model into all the other physical circuit scenes.
          tile.count=shot!=='opening'&&center.distanceToSquared(camera.position)<range*range?fullCount:0;
        };
        count+=plants.length;
      }
      cells++;
    }
    (counts.closeMeadow??={})[side]={tiles:cells,tufts:count};
  }
  function plantMiddleMeadow(parent,right){
    const {plan,middle}=closeGrass,side=right?'right':'left',pitch=.53;
    const rand=random(right?924013:227915),center=new T.Vector3();let count=0,cells=0;
    for(const [x0,z0] of plan[side+'Middle']||[]){
      const plants=[];
      for(let x=pitch*.5;x<plan.tileMetres;x+=pitch)for(let z=pitch*.5;z<plan.tileMetres;z+=pitch){
        const px=x0+x+(rand()-.5)*pitch,pz=z0+z+(rand()-.5)*pitch,p=roadFrame(px,pz,right);
        if(!grassSite(p))continue;
        const cover=.62+.32*noise(px/9,pz/7);
        if(rand()>cover)continue;
        const height=.055+rand()*.073+cover*rand()*.046,spread=grassSpread(.87+rand()*.59,p.distance);
        plants.push({s:-px,l:pz,y:baseHeight-.013,yaw:rand()*Math.PI*2,xyz:[spread,height/.11,spread]});
      }
      if(!plants.length)continue;
      const tile=instances('Park_H_shared_grass_'+side+'_'+x0+'_'+z0,middle.geometry,middle.material,plants,{planar:true,parent,right});
      const range=140+tile.boundingSphere.radius,fullCount=tile.count;
      tile.onBeforeRender=(_renderer,_scene,camera)=>{
        updateGrassViewport();center.copy(tile.boundingSphere.center).applyMatrix4(tile.matrixWorld);
        tile.count=shot!=='opening'&&center.distanceToSquared(camera.position)<range*range?fullCount:0;
      };
      count+=plants.length;cells++;
    }
    (counts.middleMeadow??={})[side]={tiles:cells,tufts:count};
  }
  function updateGrassViewport(){grassViewport.value=renderer.domElement.height;}
  async function prepareSky(){
    const loader=new T.TextureLoader();
    const [base,atlas,detail]=await Promise.all([
      loader.loadAsync(window.F1BackgroundAssets("/structure-assets/venue-sky-base.jpg")),
      loader.loadAsync(window.F1BackgroundAssets("/structure-assets/venue-sky-atlas.jpg")),
      fetch(window.F1BackgroundAssets("/structure-assets/sky-detail.json")).then(r=>r.json())
    ]);
    displaySky=base;
    base.colorSpace=atlas.colorSpace=T.SRGBColorSpace;base.wrapS=T.RepeatWrapping;
    // SphereGeometry starts at -X. The captured panorama starts at +X.
    base.repeat.x=-1;base.offset.x=1;
    const material=sky.material,previous=material.onBeforeCompile,key=material.customProgramCacheKey();
    material.onBeforeCompile=function(shader,render){
      previous.call(this,shader,render);
      shader.uniforms.venueSkyAtlas={value:atlas};shader.uniforms.venueHighSky=highSky;
      shader.uniforms.venueSkyRows={value:new T.Vector4(detail.vLow,detail.vHigh,detail.rows,detail.gutter)};
      shader.uniforms.venueAtlasHeight={value:detail.atlasHeight};
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        uniform sampler2D venueSkyAtlas;
        uniform float venueHighSky,venueAtlasHeight;
        uniform vec4 venueSkyRows;
      `).replace('#include <map_fragment>',`#include <map_fragment>
        #ifdef USE_MAP
          vec2 skyDx=dFdx(vMapUv),skyDy=dFdy(vMapUv);
          if(venueHighSky>.5){
            float u=fract(vMapUv.x),v=vMapUv.y,halfU=fract(u*2.);
            float lo=venueSkyRows.x,hi=venueSkyRows.y,rows=venueSkyRows.z,gutter=venueSkyRows.w;
            float blend=smoothstep(lo,lo+.009,v)*(1.-smoothstep(hi-.016,hi,v));
            blend*=smoothstep(0.,.00055,min(halfU,1.-halfU));
            if(blend>0.){
              float tile=1.-step(.5,u);
              float row=gutter+.5+(v-lo)/(hi-lo)*(rows-1.)+tile*(rows+2.*gutter);
              vec2 scale=vec2(2.,(rows-1.)/((hi-lo)*venueAtlasHeight));
              vec3 detail=textureGrad(venueSkyAtlas,vec2(halfU,row/venueAtlasHeight),skyDx*scale,skyDy*scale).rgb;
              diffuseColor.rgb=mix(diffuseColor.rgb,detail,blend);
            }
            // Grade the photographed sky in linear light. Leave the brightest
            // cloud areas close to their captured colour and keep detail.
            vec3 captured=diffuseColor.rgb;
            float luma=dot(captured,vec3(.2126,.7152,.0722));
            float altitude=smoothstep(.5,.70,v);
            vec3 blueGain=mix(vec3(.99,1.18,1.40),vec3(.92,1.13,1.26),altitude);
            vec3 blueLift=mix(vec3(.003,.041,.060),vec3(.003,.021,.032),altitude);
            float grade=smoothstep(.479,.498,v)*(1.-.88*smoothstep(.33,.72,luma));
            diffuseColor.rgb=mix(captured,min(vec3(1.),captured*blueGain+blueLift),grade);
          }
        #endif
      `);
    };
    material.customProgramCacheKey=()=>key+'-monza-sky-atlas-daylight-H';material.needsUpdate=true;
    counts.sky={...detail,baseSize:[base.image.width,base.image.height],atlasSize:[atlas.image.width,atlas.image.height],sameCaptureAsLighting:true};
  }
  async function prepare(THREE,render,scene,scenery,track,registry){
    T=THREE;renderer=render;world=scene;root=scenery;road=track;pairs=registry.pairs;
    sky=registry.sky;skyRotation=registry.skyRotation;
    originalSkyMap=sky.material.map;originalSkyRotation=sky.rotation.clone();
    roadSegments=makeRoadSegments();
    root.traverse(mesh=>{
      if(!mesh.isMesh||Array.isArray(mesh.material))return;
      if(/^(?:Far_)?Grandstand_/.test(mesh.name))hideInPark(mesh,null,true);
      else if(/^(?:(?:Far_)?Spectator_|Imported_Monza_(?:cleanstand_|crowd)|Stand_|Meadow_short_grass_F_|Irregular_broadleaf_|Tapered_tree_|Tree_branches|Layered_pine_|Verge_shrubs|Distant_hills$)/.test(mesh.name))hideInPark(mesh);
    });
    cleanPitScenery();
    const ground=road.group.getObjectByName('Grass_infield'),turf=window.F1GroundLayer.materialFor(ground,'F')||ground.material;
    hideInPark(ground,'terrain');
    woodland();facilities();groundShade();
    const field=onlyPark(grassMaterial(turf,registry.vergeColor),'terrain');
    const closePlan=await fetch(window.F1BackgroundAssets("/structure-assets/meadow-close-plan.json"),{cache:'no-store'}).then(r=>r.json());
    terrain(field);meadow(field,registry.vergeColor,closePlan);
    const grade=onlyPark(copy(field),'terrain');grade.side=T.DoubleSide;
    root.traverse(mesh=>{if(mesh.name.startsWith('Meadow_edge_grade_F_'))replaceVerge(mesh,grade);});
    await prepareSky();
    counts.changedActors=false;counts.changedCamera=false;counts.battleSharesEnvironment=true;
  }
  function isCorner(kind){return kind==='competition'||kind==='advantage';}
  function setMode(value){
    mode=value;active=mode==='H';
    for(const [material,layer] of newMaterials)material.visible=active&&switches[layer];
    if(!displaySky)return;
    const showSky=active&&switches.sky;
    highSky.value=showSky?1:0;
    sky.material.map=showSky?displaySky:originalSkyMap;
    sky.rotation.copy(originalSkyRotation);
    if(showSky)sky.rotation.y-=skyRotation;
  }
  function frame(kind){
    if(shot===kind)return;
    const lookChanged=isCorner(shot)!==isCorner(kind);shot=kind;
    if(active&&lookChanged)window.F1Background.setLook('H');
  }
  function materialFor(mesh,value){
    const record=own.get(mesh)||byName.get(mesh.name);
    if(!record||value!=='H')return null;
    if((record.keepAtCorner&&isCorner(shot))||(record.layer&&!switches[record.layer]))return record.base;
    return record.park;
  }
  async function bindRoute(route){
    const object=new T.Object3D();let fixed=0;
    route.scenery.traverse(mesh=>{
      if(!mesh.userData.f1Park)return;
      if(mesh.isInstancedMesh){
        const planar=mesh.userData.f1ParkPlanar;
        mesh.userData.f1ParkPlacements.forEach((p,k)=>{placeInstance(object,p,planar,true);mesh.setMatrixAt(k,object.matrix);});
        if(mesh.name.includes('_grass_'))mesh.onBeforeRender=updateGrassViewport;
        mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
      }else if(mesh.userData.f1ParkTile){
        mesh.geometry=terrainTile(...mesh.userData.f1ParkTile,true);
      }else{
        mesh.geometry=mesh.geometry.clone();
        const p=mesh.geometry.attributes.position,auth=mesh.geometry.attributes.parkRoad;
        for(let k=0;k<p.count;k++){
          const v=land(auth.getX(k),auth.getY(k),auth.getZ(k),true);
          p.setXYZ(k,v.x,v.y,v.z);
        }
        p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
      }
      fixed++;
    });
    if(closeGrass){plantCloseMeadow(root,false);plantCloseMeadow(route.scenery,true);plantMiddleMeadow(root,false);plantMiddleMeadow(route.scenery,true);}
    counts.rightRouteAuthoredMeshes=fixed;await window.F1Boot?.tick();
  }
  function inspect(){return{mode,shot,active,switches,skyMaterial:sky?.material?.name,skyMap:sky?.material?.map?.image?.src,skyRotation:sky?.rotation?.toArray(),roots:world.children.filter(o=>/scenery|CIRCUIT/.test(o.name)).map(o=>({name:o.name,visible:o.visible,position:o.position.toArray(),rotation:o.rotation.toArray()}))};}
  async function reloadControls(){
    switches={...switches,...await fetch(window.F1BackgroundAssets("/structure-assets/park-controls.json"),{cache:'no-store'}).then(r=>r.json())};
    window.F1Background.setLook(mode);return inspect();
  }
  function state(){return{...counts,mode,shot,active,inspection:inspect()};}
  return{prepare,setMode,frame,materialFor,bindRoute,state,reloadControls,get sceneKind(){return shot;}};
})();
