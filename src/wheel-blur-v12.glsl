#ifdef USE_MAP
  vec4 sampledDiffuseColor=texture2D(map,vMapUv);
  // The sidewall is approximately planar in the wheel's XY plane. Rotate
  // points on the circle before mapping them into UV space. A straight UV
  // tangent cuts across the coloured ring and can cross its atlas boundary.
  // Curved tread/shoulder surfaces keep the original anisotropic texture.
  float sidewall=smoothstep(0.80,0.96,abs(normalize(vWheelNormal).z));
  if(wheelShutterAngle>0.0001 && sidewall>0.001){
    vec2 dx=dFdx(vWheelPosition.xy),dy=dFdy(vWheelPosition.xy);
    vec2 ux=dFdx(vMapUv),uy=dFdy(vMapUv);
    float determinant=dx.x*dy.y-dy.x*dx.y;
    float conditioning=abs(determinant)/max(length(dx)*length(dy),0.000000001);
    if(abs(determinant)>0.00000001 && conditioning>0.12){
      vec2 uvX=(ux*dy.y-uy*dx.y)/determinant;
      vec2 uvY=(uy*dx.x-ux*dy.x)/determinant;
      vec4 sum=sampledDiffuseColor;
      float weight=1.0;
      for(int tap=0;tap<8;tap++){
        float part=(float(tap)+0.5)/8.0-0.5;
        float angle=part*wheelShutterAngle;
        float c=cos(angle),s=sin(angle);
        vec2 rotated=mat2(c,s,-s,c)*vWheelPosition.xy;
        vec2 delta=rotated-vWheelPosition.xy;
        vec2 uvDelta=uvX*delta.x+uvY*delta.y;
        // Reject poorly conditioned projections instead of sampling another
        // part of the tyre atlas. The physical wheel still rotates normally.
        if(length(uvDelta)<0.045){
          sum+=texture2D(map,vMapUv+uvDelta);weight+=1.0;
        }
      }
      sampledDiffuseColor=mix(sampledDiffuseColor,sum/weight,sidewall);
    }
  }
  diffuseColor*=sampledDiffuseColor;
#endif
