/* One scene pass plus a directional background filter. Cached whole-car bounds
   protect the rear wing as well as the nose without an extra car render pass. */
function b0(THREE,renderer,scene,camera,poseAt,duration){
  const supported=renderer.extensions.has('EXT_color_buffer_float');
  const target=new THREE.WebGLRenderTarget(1280,720,{type:supported?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true,samples:0});
  target.depthTexture=new THREE.DepthTexture(1280,720,THREE.UnsignedIntType);
  const previous=new THREE.PerspectiveCamera(camera.fov,camera.aspect,camera.near,camera.far);
  const protectedCars=new Map(),scratch=new THREE.Vector3();
  const screen=new THREE.Scene(),flatCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),size=new THREE.Vector2();
  const uniforms={image:{value:target.texture},depthMap:{value:target.depthTexture},inverseVP:{value:new THREE.Matrix4()},previousVP:{value:new THREE.Matrix4()},pixels:{value:new THREE.Vector2(1/1280,1/720)},focusDepth:{value:.99}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,transparent:true,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D image,depthMap;uniform mat4 inverseVP,previousVP;uniform vec2 pixels;uniform float focusDepth;varying vec2 vUv;
    void main(){vec4 original=texture2D(image,vUv);float depth=texture2D(depthMap,vUv).r;
      vec4 world=inverseVP*vec4(vUv*2.-1.,depth*2.-1.,1.);world/=world.w;vec4 old=previousVP*world;
      vec2 velocity=vUv-(old.xy/old.w*.5+.5);float len=length(velocity/pixels);velocity*=min(1.,24./max(len,.0001));
      float protect=1.-smoothstep(focusDepth,focusDepth+.00012,depth);
      vec4 sum=original*2.;float weight=2.;
      for(int index=0;index<4;index++){float part=float(index)/3.-.5;vec2 uv=clamp(vUv+velocity*part,.001,.999);float d=texture2D(depthMap,uv).r;float valid=step(focusDepth+.00012,d);float w=(1.-abs(part))*valid;sum+=texture2D(image,uv)*w;weight+=w;}
      gl_FragColor=mix(sum/weight,original,protect);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));let width=0,height=0;
  return{supported,markCar(group){
      if(protectedCars.has(group))return;
      group.updateWorldMatrix(true,true);
      const box=new THREE.Box3().setFromObject(group),inverse=group.matrixWorld.clone().invert(),corners=[];
      for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z])corners.push(new THREE.Vector3(x,y,z).applyMatrix4(inverse));
      protectedCars.set(group,corners);
    },
    render(time,enabled){
      if(!enabled||!supported){renderer.setRenderTarget(null);renderer.render(scene,camera);return;}
      renderer.getDrawingBufferSize(size);
      if(width!==size.x||height!==size.y){width=size.x;height=size.y;target.setSize(width,height);uniforms.pixels.value.set(1/width,1/height);}
      camera.updateMatrixWorld();uniforms.inverseVP.value.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).invert();
      const pose=poseAt(Math.max(0,time-.012/(duration/1000)));previous.position.copy(pose.position);previous.up.copy(pose.up);previous.lookAt(pose.target);previous.fov=pose.fov;previous.updateProjectionMatrix();
      if(pose.roll)previous.rotateZ(pose.roll);
      if(pose.principal){previous.projectionMatrix.elements[8]=-(pose.principal[0]-800)/800;previous.projectionMatrix.elements[9]=(pose.principal[1]-450)/450;}
      previous.updateMatrixWorld();uniforms.previousVP.value.multiplyMatrices(previous.projectionMatrix,previous.matrixWorldInverse);
      let farDepth=0,visibleCars=0;
      for(const[group,corners]of protectedCars){
        let visible=!!group.parent;for(let ancestor=group;ancestor&&visible;ancestor=ancestor.parent)visible=ancestor.visible;
        if(!visible)continue;group.updateWorldMatrix(true,false);visibleCars++;
        for(const corner of corners){scratch.copy(corner).applyMatrix4(group.matrixWorld).project(camera);farDepth=Math.max(farDepth,(scratch.z+1)*.5);}
      }
      const focus=window.__F1MotionFocus;
      uniforms.focusDepth.value=visibleCars?Math.min(.99999,farDepth+.00002):focus?(scratch.fromArray(focus).project(camera).z+1)*.5:.991;
      window.__F1BlurProtection={visibleCars,farDepth,protectedDepth:uniforms.focusDepth.value};
      renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.clear();renderer.render(screen,flatCamera);
    },dispose(){target.dispose();material.dispose();screen.children[0].geometry.dispose();}};
}
