/* Dissolve the world as one image; keep its native depth and cutout semantics.
   W already contains the foreground F, so mix(F,W,a) preserves car edges. */
function createWorldDissolve(THREE,renderer,scene,camera,roots){
  const type=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const world=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,samples:Math.min(4,renderer.capabilities.maxSamples||0)});
  const foreground=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,samples:Math.min(4,renderer.capabilities.maxSamples||0)});
  // This renderer applies material tone mapping only on its display/XR path.
  // Use that colour-managed path for offscreen images, in linear display colour,
  // so Basic sky/chart materials and PBR cars keep exactly their native finish.
  for(const target of[world,foreground]){target.isXRRenderTarget=true;target.texture.colorSpace=THREE.LinearSRGBColorSpace;}
  const size=new THREE.Vector2(),screen=new THREE.Scene(),flat=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const uniforms={world:{value:world.texture},foreground:{value:foreground.texture},amount:{value:1}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,transparent:false,toneMapped:false,
    vertexShader:'varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D world,foreground;uniform float amount;varying vec2 uv0;
    void main(){vec4 image=mix(texture2D(foreground,uv0),texture2D(world,uv0),amount);
      gl_FragColor=vec4(image.rgb/max(image.a,0.00001),image.a);
      #include <colorspace_fragment>
      gl_FragColor.rgb*=gl_FragColor.a;
    }`});
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));let width=0,height=0;
  return{render(alpha,extraRoots=[]){
    const activeRoots=[...roots,...extraRoots];
    const visible=activeRoots.map(root=>root.visible),background=scene.background;
    const color=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
    if(alpha>=.999999){renderer.setRenderTarget(null);renderer.render(scene,camera);}
    else if(alpha<=.000001){
      activeRoots.forEach(root=>root.visible=false);scene.background=null;
      renderer.setRenderTarget(null);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
    }else{
      renderer.getDrawingBufferSize(size);if(size.x!==width||size.y!==height){width=size.x;height=size.y;world.setSize(width,height);foreground.setSize(width,height);}
      renderer.setClearColor(0,0);renderer.setRenderTarget(world);renderer.clear();renderer.render(scene,camera);
      activeRoots.forEach(root=>root.visible=false);scene.background=null;renderer.shadowMap.needsUpdate=false;
      renderer.setRenderTarget(foreground);renderer.clear();renderer.render(scene,camera);
      renderer.setRenderTarget(null);renderer.clear();uniforms.amount.value=alpha;renderer.render(screen,flat);
    }
    activeRoots.forEach((root,k)=>root.visible=visible[k]);scene.background=background;renderer.setClearColor(color,clearAlpha);
    window.__F1WorldDissolve={alpha,method:'composite-world-image',nativeDepth:true,passes:alpha>0&&alpha<1?2:1};
  }};
}
