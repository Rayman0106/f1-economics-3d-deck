/* Detail layer C. Scene layout and all actor/camera poses remain owned by the deck. */
window.F1DetailLayer=(()=>{
  let T,renderer,root,world,pairs;const counts={};
  function addVariant(original,detailed,family){
    const pair=pairs.get(original)||{original,enhanced:original,family};
    pair.detailed=detailed;
    for(const m of new Set([pair.original,pair.enhanced,detailed]))pairs.set(m,pair);
    counts[family]=(counts[family]||0)+1;
    return detailed;
  }
  function clone(material){
    const m=material.clone();m.onBeforeCompile=material.onBeforeCompile;
    m.customProgramCacheKey=material.customProgramCacheKey.bind(material);
    m.name=material.name+' / detail C';return m;
  }
  async function texture(file,color=false){
    const map=await new T.TextureLoader().loadAsync(window.F1BackgroundAssets((file==='concrete-height.jpg'?'/structure-assets/':'/detail-assets/')+file));
    map.colorSpace=color?T.SRGBColorSpace:T.NoColorSpace;
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=Math.min(12,renderer.capabilities.getMaxAnisotropy());
    map.minFilter=T.LinearMipmapLinearFilter;return map;
  }
  function worldVertex(shader){
    if(shader.vertexShader.includes('varying vec3 vBgWorld;'))return;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBgWorld;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
      vec4 bgPosition=vec4(transformed,1.0);
      #ifdef USE_INSTANCING
        bgPosition=instanceMatrix*bgPosition;
      #endif
      vBgWorld=(modelMatrix*bgPosition).xyz;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBgWorld;');
  }
  function surface(m,kind,maps){
    const previous=m.onBeforeCompile,oldKey=m.customProgramCacheKey();
    m.onBeforeCompile=function(shader,render){
      previous.call(this,shader,render);worldVertex(shader);
      Object.assign(shader.uniforms,{detailColor:{value:maps.color},detailHeight:{value:maps.height},detailRough:{value:maps.rough}});
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        uniform sampler2D detailColor;uniform sampler2D detailHeight;uniform sampler2D detailRough;
        vec3 dtWeights(vec3 p){vec3 n=abs(normalize(cross(dFdx(p),dFdy(p))));vec3 w=pow(n,vec3(5.));return w/max(dot(w,vec3(1.)),.0001);}
        vec4 dtSample(sampler2D image,vec3 p,vec3 w){return texture2D(image,p.yz)*w.x+texture2D(image,p.xz)*w.y+texture2D(image,p.xy)*w.z;}
      `).replace('#include <map_fragment>',`#include <map_fragment>
        vec3 dtW=dtWeights(vBgWorld),dtUV=vBgWorld/2.71;
        vec3 dtColor=dtSample(detailColor,dtUV,dtW).rgb;
        float dtTone=dot(dtColor,vec3(.2126,.7152,.0722));
        ${kind==='concrete'?`
        diffuseColor.rgb*=mix(.84,1.10,clamp(dtTone*1.8,0.,1.));
        float dtGround=1.0-.10*exp(-max(vBgWorld.y+.4,0.)*.50);
        diffuseColor.rgb*=dtGround;`:`
        diffuseColor.rgb*=mix(.94,1.05,clamp(dtTone*1.8,0.,1.));`}
      `).replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        vec3 dtRW=dtWeights(vBgWorld);float dtR=dtSample(detailRough,vBgWorld/2.71,dtRW).g;
        roughnessFactor=clamp(roughnessFactor*(.87+.22*dtR),.45,1.);
      `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        // Surface-gradient bump mapping in view space, with the oriented
        // determinant as in Three.js r180. Opposite faces keep consistent relief.
        vec3 dtNW=dtWeights(vBgWorld),dtP=vBgWorld/2.71;
        float dtH=dtSample(detailHeight,dtP,dtNW).r;
        vec3 dtSX=dFdx(-vViewPosition),dtSY=dFdy(-vViewPosition);
        vec3 dtR1=cross(dtSY,normal),dtR2=cross(normal,dtSX);
        float dtDet=dot(dtSX,dtR1)*faceDirection;
        vec3 dtGradient=sign(dtDet)*(dFdx(dtH)*dtR1+dFdy(dtH)*dtR2);
        normal=normalize(max(abs(dtDet),1e-10)*normal-dtGradient*${kind==='concrete'?'.002':'.0004'});
      `);
    };
    m.customProgramCacheKey=()=>oldKey+'-monza-surface-gradient-v3-'+kind;
  }
  function roadWear(m){
    const previous=m.onBeforeCompile,key=m.customProgramCacheKey();
    m.onBeforeCompile=function(shader,render){
      previous.call(this,shader,render);worldVertex(shader);
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        // Metre-scale rubber on the actual road UV frame, not floating decals.
        // Raw UV = metres*.13; Three.js vMapUv also includes repeat 1/(.13*2.1).
        // Therefore transformed vMapUv is metres/2.1. Undo that transform once.
        float dtLateral=vMapUv.x*2.1,dtStation=vMapUv.y*2.1;
        // Illustrative wheel wear, not measured telemetry or a regulatory width.
        float dtTrack=exp(-pow((dtLateral-.92)/.22,2.))+exp(-pow((dtLateral+.92)/.22,2.));
        float dtVariation=.65+.35*sin(dtStation*.005+sin(dtStation*.0017));
        diffuseColor.rgb*=1.-.095*dtTrack*dtVariation;
      `);
    };m.customProgramCacheKey=()=>key+'-roadwear-metre-v3';
  }
  function hiddenVariant(material){const hidden=clone(material);hidden.visible=false;return hidden;}
  function detailOnly(material){const hidden=hiddenVariant(material);addVariant(hidden,material,'vegetation-mesh');return material;}
  function roundedSeatPanel(width,height,depth){
    const s=new T.Shape(),x=-width/2,y=-height/2,r=.065;
    s.moveTo(x+r,y);s.lineTo(x+width-r,y);s.quadraticCurveTo(x+width,y,x+width,y+r);
    s.lineTo(x+width,y+height-r);s.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
    s.lineTo(x+r,y+height);s.quadraticCurveTo(x,y+height,x,y+height-r);
    s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);
    const bevel=.012,g=new T.ExtrudeGeometry(s,{depth:depth-2*bevel,steps:1,bevelEnabled:true,bevelSegments:2,bevelSize:bevel,bevelThickness:bevel,curveSegments:3});
    g.translate(0,0,-depth/2+bevel);g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function seats(){
    const backs=roundedSeatPanel(.626,.426,.105),cushions=roundedSeatPanel(.626,.426,.13);cushions.rotateX(-Math.PI/2);
    const originals=[];root.traverse(o=>{if(o.isInstancedMesh&&/^(?:Far_)?Grandstand_seat_(?:backs|cushions)$/.test(o.name))originals.push(o);});
    for(const original of originals){
      const back=original.name.endsWith('backs'),material=clone(original.material);material.roughness=.58;material.envMapIntensity=.48;
      const hidden=hiddenVariant(material);addVariant(hidden,material,'moulded-seat-material');
      const copy=original.clone();copy.geometry=back?backs:cushions;copy.material=material;copy.instanceMatrix=original.instanceMatrix.clone();
      copy.name=original.name.replace('seat_','detail_seat_');copy.userData.f1Detail=true;copy.computeBoundingSphere();copy.computeBoundingBox();root.add(copy);
      if(!pairs.get(original.material)?.detailed)addVariant(original.material,hiddenVariant(original.material),'replaced-seat-material');
      if(back)counts.mouldedSeats=(counts.mouldedSeats||0)+original.count;
    }
  }
  function makeLeaves(map){
    const m=new T.MeshStandardMaterial({name:'Leaf clusters C',map,color:0xa9be87,roughness:.96,metalness:0,
      side:T.DoubleSide,transparent:false,depthWrite:true,alphaTest:.44,alphaToCoverage:true,forceSinglePass:true,envMapIntensity:.45});
    // The geometry carries outward canopy normals; do not flip them per card.
    m.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>',
        T.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;','/* outward canopy normals */'));
    };m.customProgramCacheKey=()=> 'monza-rounded-leaves-v2';return detailOnly(m);
  }
  function unpack(spec,buffer){
    const g=new T.BufferGeometry();
    for(const [name,s]of Object.entries(spec.attributes))g.setAttribute(name,new T.BufferAttribute(new Float32Array(buffer,s.offset,s.bytes/4),s.itemSize));
    g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,spec.index.offset,spec.index.count),1));
    g.computeBoundingBox();g.computeBoundingSphere();return g;
  }
  function populate(geometry,material,placements,name){
    // Partition along the grove, so offscreen trees do not submit their leaves.
    const cells=new Map();
    for(const p of placements){const key=Math.floor(p.position.x/180)+':'+Math.floor(p.position.z/180);if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
    for(const [cell,items]of cells){
      const mesh=new T.InstancedMesh(geometry,material,items.length),dummy=new T.Object3D();mesh.name=name+'_'+cell;
      mesh.userData.treeIds=items.map(p=>p.treeId);mesh.userData.f1Detail=true;
      items.forEach((p,k)=>{dummy.position.copy(p.position);dummy.rotation.set(0,p.yaw,0);dummy.scale.copy(p.scale);dummy.updateMatrix();mesh.setMatrixAt(k,dummy.matrix);mesh.setColorAt(k,new T.Color().setHSL(.25+p.tone*.026,.13,.83+p.tone*.035));});
      mesh.computeBoundingBox();mesh.computeBoundingSphere();mesh.matrixAutoUpdate=false;mesh.updateMatrix();mesh.castShadow=false;mesh.receiveShadow=false;root.add(mesh);
    }
  }
  async function trees(textures,buffer,manifest){
    const trunks=root.getObjectByName('Tapered_tree_trunks'),pine=root.getObjectByName('Layered_pine_canopies'),bushes=root.getObjectByName('Verge_shrubs');
    const pineIds=new Set(pine.userData.treeIds),byVariant=Array.from({length:manifest.variants.length},()=>[]);
    const matrix=new T.Matrix4(),p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();
    for(let k=0;k<trunks.count;k++){
      trunks.getMatrixAt(k,matrix);matrix.decompose(p,q,s);const treeId=trunks.userData.treeIds[k],height=s.y/.52;
      const id=pineIds.has(treeId)?4+treeId%2:treeId%4;
      byVariant[id].push({treeId,position:new T.Vector3(p.x,-.53,p.z),scale:new T.Vector3(height,height,height),yaw:treeId*2.399963,tone:Math.sin(treeId*7.19)});
    }
    for(let k=0;k<bushes.count;k++){
      bushes.getMatrixAt(k,matrix);matrix.decompose(p,q,s);
      byVariant[6+k%2].push({treeId:100000+k,position:new T.Vector3(p.x,-.53,p.z),scale:new T.Vector3(s.x*2.2,s.y*1.8,s.z*2.2),yaw:k*2.399963,tone:Math.sin(k*3.7)});
    }
    const bark=detailOnly(new T.MeshStandardMaterial({name:'Bark C',map:textures.barkColor,normalMap:textures.barkNormal,
      normalScale:new T.Vector2(.32,.32),roughnessMap:textures.barkRough,roughness:1,color:0xb3aa97,envMapIntensity:.35}));
    const leafMaterials={oak:makeLeaves(textures.oak),ash:makeLeaves(textures.ash),pine:makeLeaves(textures.pine)};
    let instances=0,estimatedTriangles=0;
    for(const [k,variant]of manifest.variants.entries()){
      const group=byVariant[k];instances+=group.length;estimatedTriangles+=variant.triangles*group.length;
      const prefix=variant.kind==='pine'?'Layered_pine_detail_':'Irregular_broadleaf_detail_';
      for(const [part,spec]of Object.entries(variant.parts))populate(unpack(spec,buffer),part==='branches'?bark:leafMaterials[variant.kind==='bush'?'ash':variant.kind],group,prefix+k+'_'+part);
      await window.F1Boot?.tick();
    }
    for(const name of['Irregular_broadleaf_canopies','Tapered_tree_trunks','Tree_branches','Layered_pine_canopies','Verge_shrubs']){
      const m=root.getObjectByName(name).material;const pair=pairs.get(m),original=pair?.original||m;
      addVariant(original,hiddenVariant(pair?.enhanced||m),'replaced-vegetation');
    }
    counts.trees=trunks.count;counts.shrubs=bushes.count;counts.treeVariants=manifest.variants.length;counts.vegetationTriangles=estimatedTriangles;counts.vegetationInstances=instances;
  }
  async function prepare(THREE,render,scene,scenery,trackRoots,registry){
    T=THREE;renderer=render;world=scene;root=scenery;pairs=registry.pairs;
    const [concreteColor,concreteHeight,concreteRough,barkColor,barkNormal,barkRough,oak,ash,pine,manifest,buffer]=await Promise.all([
      texture('concrete-color.jpg',true),texture('concrete-height.jpg'),texture('concrete-rough.jpg'),
      texture('bark-color.jpg',true),texture('bark-normal.jpg'),texture('bark-rough.jpg'),texture('leaves-oak.png',true),texture('leaves-ash.png',true),texture('leaves-pine.png',true),
      fetch(window.F1BackgroundAssets("/detail-assets/trees.json?revision=dense-2")).then(r=>r.json()),fetch(window.F1BackgroundAssets("/detail-assets/trees.bin?revision=dense-2")).then(r=>r.arrayBuffer())
    ]);
    for(const m of[oak,ash,pine]){m.wrapS=m.wrapT=T.ClampToEdgeWrapping;m.anisotropy=4;}
    const maps={color:concreteColor,height:concreteHeight,rough:concreteRough};
    const processed=new Set();
    for(const group of[...trackRoots,root])group.traverse(o=>{
      if(!o.isMesh)return;
      for(const material of Array.isArray(o.material)?o.material:[o.material]){
        if(!material?.isMeshStandardMaterial||processed.has(material))continue;
        const pair=pairs.get(material),enhanced=pair?.enhanced||material;
        const name=material.name.toLowerCase();let detailed;
        if((/gstand_structure|Grandstand_steps|Grandstand_stairs|Concrete_wall|Wall_panel/.test(o.name))||(/wall/.test(name)&&!name.includes('alpha'))){
          detailed=clone(enhanced);surface(detailed,'concrete',maps);addVariant(pair?.original||material,detailed,'surface-concrete');
        }else if(/^(Imported_Monza_)/.test(o.name)&&/box|gstand|paddk/.test(name)&&!name.includes('alpha')){
          detailed=clone(enhanced);surface(detailed,'facade',maps);addVariant(pair?.original||material,detailed,'surface-facade');
        }else if(o.name==='Fine_asphalt'){
          detailed=clone(enhanced);roadWear(detailed);addVariant(pair?.original||material,detailed,'asphalt-wear');
        }
        processed.add(material);
      }
    });
    seats();await trees({barkColor,barkNormal,barkRough,oak,ash,pine},buffer,manifest);
    return counts;
  }
  return{prepare,state:()=>({...counts,precomputedGeometry:true,transparentVegetation:false,windAnimation:false})};
})();
