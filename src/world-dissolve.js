/* Preserve H's linear-display world/foreground dissolve. I reads resolved
   world depth for contact AO; colour and DOM text remain at native resolution. */
function createWorldDissolve(THREE,renderer,scene,camera,roots){
  const type=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const makeTarget=()=>new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:true,samples:Math.min(4,renderer.capabilities.maxSamples||0)});
  const world=makeTarget(),foreground=makeTarget();
  const sky=roots.find(root=>root.name==='Daylight_sky');
  world.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
  for(const target of[world,foreground]){target.isXRRenderTarget=true;target.texture.colorSpace=THREE.LinearSRGBColorSpace;}
  const aoTarget=new THREE.WebGLRenderTarget(1,1,{type,depthBuffer:false});
  const size=new THREE.Vector2(),screen=new THREE.Scene(),flat=new THREE.OrthographicCamera(-1,1,1,-1,0,1),aoScreen=new THREE.Scene();
  const vertexShader='varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}';
  const aoUniforms={depthMap:{value:world.depthTexture},inverseProjection:{value:new THREE.Matrix4()},projection:{value:new THREE.Matrix4()},pixel:{value:new THREE.Vector2()}};
  const aoMaterial=new THREE.ShaderMaterial({uniforms:aoUniforms,depthTest:false,depthWrite:false,toneMapped:false,
    vertexShader,fragmentShader:`
    uniform sampler2D depthMap;uniform mat4 inverseProjection,projection;uniform vec2 pixel;varying vec2 uv0;
    vec3 positionAt(vec2 uv){float d=texture2D(depthMap,uv).r;vec4 p=inverseProjection*vec4(uv*2.-1.,d*2.-1.,1.);return p.xyz/p.w;}
    void main(){
      float d=texture2D(depthMap,uv0).r;
      if(d>.9999995){gl_FragColor=vec4(1.);return;}
      vec3 p=positionAt(uv0),left=positionAt(uv0-vec2(pixel.x,0.)),right=positionAt(uv0+vec2(pixel.x,0.));
      vec3 down=positionAt(uv0-vec2(0.,pixel.y)),up=positionAt(uv0+vec2(0.,pixel.y));
      vec3 dx=abs(left.z-p.z)<abs(right.z-p.z)?p-left:right-p;
      vec3 dy=abs(down.z-p.z)<abs(up.z-p.z)?p-down:up-p;
      vec3 n=normalize(cross(dx,dy));if(dot(n,-p)<0.)n=-n;
      float radius=.85,occ=0.;
      float reach=clamp(radius*projection[1][1]/max(.1,-2.*p.z),pixel.y*2.,pixel.y*22.);
      for(int j=0;j<16;j++){
        float angle=float(j)*2.39996323+.39,r=sqrt((float(j)+.5)/16.);
        vec2 offset=vec2(cos(angle)*pixel.x/pixel.y,sin(angle))*reach*r;
        vec2 sampleUV=clamp(uv0+offset,pixel,vec2(1.)-pixel);
        vec3 v=positionAt(sampleUV)-p;float distance=length(v);
        float horizon=max(0.,dot(n,v/max(.0001,distance))-.10);
        float falloff=(1.-smoothstep(.25*radius,radius,distance))*smoothstep(.025,.065,distance);
        occ+=horizon*falloff;
      }
      float ao=clamp(1.-occ*(2.6/16.),.62,1.);
      gl_FragColor=vec4(ao,ao,ao,1.);
    }`});
  aoScreen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),aoMaterial));
  const uniforms={jDaylightWeight:window.F1MaterialJ.daylightWeight,jBroadcastWeight:window.F1MaterialJ.broadcastWeight,jOpaqueWorld:{value:0},world:{value:world.texture},foreground:{value:foreground.texture},amount:{value:1},aoMap:{value:aoTarget.texture},depthMap:{value:world.depthTexture},aoEnabled:{value:0},aoPixel:{value:new THREE.Vector2()}};
  const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,transparent:false,toneMapped:false,vertexShader,
    fragmentShader:`uniform sampler2D world,foreground,aoMap,depthMap;uniform float amount,aoEnabled,jDaylightWeight,jBroadcastWeight,jOpaqueWorld;uniform vec2 aoPixel;varying vec2 uv0;
    void main(){
      vec4 w=texture2D(world,uv0);w.a=mix(w.a,1.,jOpaqueWorld);
      float shade=1.;float luminance=dot(w.rgb,vec3(.2126,.7152,.0722));
      if(aoEnabled>.5){
        float center=texture2D(depthMap,uv0).r,total=0.,weight=0.;
        for(int j=-1;j<=1;j++)for(int k=-1;k<=1;k++){
          vec2 uv=clamp(uv0+vec2(float(j),float(k))*aoPixel*.7,aoPixel,vec2(1.)-aoPixel);
          float d=texture2D(depthMap,uv).r;
          float valid=exp(-abs(d-center)*90000.)*(j==0&&k==0?2.:1.);
          total+=texture2D(aoMap,uv).r*valid;weight+=valid;
        }
        float aoStrength=.72-.40*jDaylightWeight*smoothstep(.28,.82,luminance);
        shade=mix(1.,total/max(.001,weight),aoStrength);
      }
      w.rgb*=shade;
      if(aoEnabled>.5){
        // Mild display-linear grade. Keep the native tone mapper's highlights;
        // exclude the editable DOM slides from this world-image treatment.
        float saturation=mix(1.09,1.,jDaylightWeight),contrast=mix(1.035,1.,jDaylightWeight);
        w.rgb=max(vec3(0.),(mix(vec3(luminance*shade),w.rgb,saturation)-.18)*contrast+.18);
        if(jBroadcastWeight>.0001){
          // Shape the displayed midtones while preserving deep black and sky whites.
          const vec3 luma=vec3(.2126,.7152,.0722);
          float y=dot(w.rgb,luma),peak=max(w.r,max(w.g,w.b));
          float mid=smoothstep(.035,.25,y)*(1.-smoothstep(.42,.92,peak));
          float shoulder=smoothstep(.66,1.,peak);
          float warmth=smoothstep(.20,.64,y)*smoothstep(-.11,.055,w.r-w.b)*(1.-shoulder);
          vec3 daylight=w.rgb*(1.+.14*mid)*mix(vec3(1.),vec3(1.022,1.004,.973),warmth);
          daylight=mix(daylight,vec3(dot(daylight,luma)),.075*shoulder);
          w.rgb=mix(w.rgb,daylight,jBroadcastWeight);
        }
      }
      vec4 image=amount>.999999?w:mix(texture2D(foreground,uv0),w,amount);
      gl_FragColor=vec4(image.rgb/max(image.a,.00001),image.a);
      #include <colorspace_fragment>
      gl_FragColor.rgb*=gl_FragColor.a;
    }`});
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));let width=0,height=0;
  return{render(alpha,extraRoots=[]){
    const enhanced=!!window.F1LightStudy?.enabled;window.F1LightStudy?.beforeRender(alpha);
    const activeRoots=[...roots,...extraRoots],visible=activeRoots.map(root=>root.visible),background=scene.background;
    const color=renderer.getClearColor(new THREE.Color()),clearAlpha=renderer.getClearAlpha();
    if(alpha>=.999999&&!enhanced){renderer.setRenderTarget(null);renderer.render(scene,camera);}
    else if(alpha<=.000001){
      activeRoots.forEach(root=>root.visible=false);scene.background=null;
      renderer.setRenderTarget(null);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
    }else{
      renderer.getDrawingBufferSize(size);
      if(size.x!==width||size.y!==height){
        width=size.x;height=size.y;world.setSize(width,height);foreground.setSize(width,height);
        aoTarget.setSize(Math.ceil(width/2),Math.ceil(height/2));
        // Touch the MSAA foreground target at resize, before its first dissolve.
        renderer.setRenderTarget(foreground);renderer.setClearColor(0,0);renderer.clear();
        aoUniforms.pixel.value.set(1/width,1/height);uniforms.aoPixel.value.set(1/aoTarget.width,1/aoTarget.height);
      }
      renderer.setClearColor(0,0);renderer.setRenderTarget(world);renderer.clear();
      const opaqueSky=!!(sky?.visible&&sky.material.visible&&!sky.material.transparent);
      // Coverage belongs to the leaf samples, not the opaque world image.
      uniforms.jOpaqueWorld.value=window.F1MaterialJ.renderWorld(camera,opaqueSky)?1:0;
      if(enhanced){
        aoUniforms.inverseProjection.value.copy(camera.projectionMatrix).invert();aoUniforms.projection.value.copy(camera.projectionMatrix);
        renderer.setRenderTarget(aoTarget);renderer.clear();renderer.render(aoScreen,flat);
      }
      if(alpha<.999999){
        activeRoots.forEach(root=>root.visible=false);scene.background=null;renderer.shadowMap.needsUpdate=false;
        renderer.setRenderTarget(foreground);renderer.clear();renderer.render(scene,camera);
      }
      renderer.setRenderTarget(null);renderer.clear();uniforms.amount.value=alpha;uniforms.aoEnabled.value=enhanced?1:0;renderer.render(screen,flat);
    }
    activeRoots.forEach((root,k)=>root.visible=visible[k]);scene.background=background;renderer.setClearColor(color,clearAlpha);
    window.__F1WorldDissolve={alpha,method:'composite-world-image',nativeDepth:true,passes:alpha>0&&alpha<1?2:1};
    window.__F1LightComposite={enabled:enhanced,ao:enhanced&&alpha>0,aoResolution:[aoTarget.width,aoTarget.height],colorResolution:[width,height],temporalAccumulation:false};
  }};
}
