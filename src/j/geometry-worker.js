/* Pure CPU preparation kernels. No Three.js, DOM, model fetch or GPU context. */
(function(scope){
 'use strict';
 function bounds(p){
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let k=0;k<p.length;k+=3)for(let j=0;j<3;j++){min[j]=Math.min(min[j],p[k+j]);max[j]=Math.max(max[j],p[k+j]);}
  const center=min.map((v,j)=>(v+max[j])*.5);let radiusSq=0;
  for(let k=0;k<p.length;k+=3){const x=p[k]-center[0],y=p[k+1]-center[1],z=p[k+2]-center[2];radiusSq=Math.max(radiusSq,x*x+y*y+z*z);}
  return {min,max,center,radius:Math.sqrt(radiusSq)};
 }
 function simplify(source,cell){
  const attributes=Object.entries(source.attributes),p=source.attributes.position,normal=source.attributes.normal,uv=source.attributes.uv;
  const bins=new Map(),mapped=new Uint32Array(p.array.length/3),sums=[],counts=[];
  for(let k=0;k<mapped.length;k++){
   const token=[Math.round(p.array[k*3]/cell),Math.round(p.array[k*3+1]/cell),Math.round(p.array[k*3+2]/cell),
    ...(normal?[0,1,2].map(j=>Math.round(normal.array[k*normal.itemSize+j]*2)):[]),
    ...(uv?[Math.round(uv.array[k*uv.itemSize]*4096),Math.round(uv.array[k*uv.itemSize+1]*4096)]:[])].join(',');
   let slot=bins.get(token);
   if(slot===undefined){slot=counts.length;bins.set(token,slot);counts.push(0);sums.push(Object.fromEntries(attributes.map(([name,a])=>[name,Array(a.itemSize).fill(0)])));}
   mapped[k]=slot;counts[slot]++;
   for(const[name,a]of attributes)for(let j=0;j<a.itemSize;j++)sums[slot][name][j]+=a.array[k*a.itemSize+j];
  }
  const index=source.index,triangles=[],seen=new Set(),length=index?index.length:mapped.length;
  for(let k=0;k<length;k+=3){
   const t=[mapped[index?index[k]:k],mapped[index?index[k+1]:k+1],mapped[index?index[k+2]:k+2]];
   if(new Set(t).size<3)continue;const token=t.slice().sort((a,b)=>a-b).join(',');if(seen.has(token))continue;seen.add(token);triangles.push(...t);
  }
  const result={attributes:{}};
  for(const[name,a]of attributes){const array=new Float32Array(sums.length*a.itemSize);for(let k=0;k<sums.length;k++)for(let j=0;j<a.itemSize;j++)array[k*a.itemSize+j]=sums[k][name][j]/counts[k];result.attributes[name]={array,itemSize:a.itemSize};}
  if(result.attributes.normal){const n=result.attributes.normal.array;for(let k=0;k<n.length;k+=3){const inverse=1/(Math.sqrt(n[k]*n[k]+n[k+1]*n[k+1]+n[k+2]*n[k+2])||1);n[k]*=inverse;n[k+1]*=inverse;n[k+2]*=inverse;}}
  result.index=counts.length>65535?new Uint32Array(triangles):new Uint16Array(triangles);result.bounds=bounds(result.attributes.position.array);return result;
 }
 function merge(parts){
  let count=0,indices=0;for(const p of parts){count+=p.position.length/3;indices+=Math.floor(Math.min((p.index?.length??p.position.length/3)-p.start,p.count)/3)*3;}
  const position=new Float32Array(count*3),index=new Uint32Array(indices);let vertex=0,cursor=0;
  for(const part of parts){
   const p=part.position,e=part.matrix;
   for(let k=0;k<p.length;k+=3){const x=p[k],y=p[k+1],z=p[k+2],w=1/(e[3]*x+e[7]*y+e[11]*z+e[15]);
    position[vertex*3+k]=(e[0]*x+e[4]*y+e[8]*z+e[12])*w;
    position[vertex*3+k+1]=(e[1]*x+e[5]*y+e[9]*z+e[13])*w;
    position[vertex*3+k+2]=(e[2]*x+e[6]*y+e[10]*z+e[14])*w;
   }
   const end=Math.min(part.index?.length??p.length/3,part.start+part.count);
   for(let k=part.start;k+2<end;k+=3){const a=part.index?part.index[k]:k,b=part.index?part.index[k+1]:k+1,c=part.index?part.index[k+2]:k+2;index[cursor++]=vertex+a;index[cursor++]=vertex+(part.flip?c:b);index[cursor++]=vertex+(part.flip?b:c);}
   vertex+=p.length/3;
  }
  return {attributes:{position:{array:position,itemSize:3}},index,bounds:bounds(position)};
 }
 function rayBox(o,d,b,out){
  let tmin=-Infinity,tmax=Infinity;
  for(let j=0;j<3;j++){
   const inverse=1/d[j],low=(b[j]-o[j])*inverse,high=(b[j+3]-o[j])*inverse,a=inverse>=0?low:high,z=inverse>=0?high:low;
   if(tmin>z||a>tmax)return false;if(a>tmin||Number.isNaN(tmin))tmin=a;if(z<tmax||Number.isNaN(tmax))tmax=z;
  }
  if(tmax<0)return false;const t=tmin>=0?tmin:tmax;for(let j=0;j<3;j++)out[j]=o[j]+d[j]*t;return true;
 }
 function point(p,e,out){const x=p[0],y=p[1],z=p[2],w=1/(e[3]*x+e[7]*y+e[11]*z+e[15]);out[0]=(e[0]*x+e[4]*y+e[8]*z+e[12])*w;out[1]=(e[1]*x+e[5]*y+e[9]*z+e[13])*w;out[2]=(e[2]*x+e[6]*y+e[10]*z+e[14])*w;}
 function direction(p,e,out){const x=p[0],y=p[1],z=p[2];out[0]=e[0]*x+e[4]*y+e[8]*z;out[1]=e[1]*x+e[5]*y+e[9]*z;out[2]=e[2]*x+e[6]*y+e[10]*z;const inverse=1/(Math.sqrt(out[0]**2+out[1]**2+out[2]**2)||1);for(let j=0;j<3;j++)out[j]*=inverse;}
 function triangle(o,d,p,a,b,c,out){
  // The same signed-edge algorithm used by Three.js Ray.intersectTriangle.
  const e1x=p[b]-p[a],e1y=p[b+1]-p[a+1],e1z=p[b+2]-p[a+2],e2x=p[c]-p[a],e2y=p[c+1]-p[a+1],e2z=p[c+2]-p[a+2];
  const nx=e1y*e2z-e1z*e2y,ny=e1z*e2x-e1x*e2z,nz=e1x*e2y-e1y*e2x;let ddn=d[0]*nx+d[1]*ny+d[2]*nz,sign;
  if(ddn>0)sign=1;else if(ddn<0){sign=-1;ddn=-ddn;}else return false;
  const qx=o[0]-p[a],qy=o[1]-p[a+1],qz=o[2]-p[a+2];
  const b1=sign*(d[0]*(qy*e2z-qz*e2y)+d[1]*(qz*e2x-qx*e2z)+d[2]*(qx*e2y-qy*e2x));if(b1<0)return false;
  const b2=sign*(d[0]*(e1y*qz-e1z*qy)+d[1]*(e1z*qx-e1x*qz)+d[2]*(e1x*qy-e1y*qx));if(b2<0||b1+b2>ddn)return false;
  const qdn=-sign*(qx*nx+qy*ny+qz*nz);if(qdn<0)return false;const t=qdn/ddn;for(let j=0;j<3;j++)out[j]=o[j]+d[j]*t;return true;
 }
 const overlap=(a,b)=>a[0]<=b[3]&&a[3]>=b[0]&&a[1]<=b[4]&&a[4]>=b[1]&&a[2]<=b[5]&&a[5]>=b[2];
 function maskTree(rays){
  const chunks=[[],[]],fore=[];
  for(let k=0;k<rays.length;k+=9)if(rays[k])fore.push(k);else chunks[rays[k+1]?1:0].push(k);
  function tree(items){
   if(!items.length)return null;const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
   for(const item of items)for(let j=0;j<3;j++){box[j]=Math.min(box[j],item.box[j]);box[j+3]=Math.max(box[j+3],item.box[j+3]);}
   if(items.length<=4)return{box,items};const span=[0,1,2].map(j=>box[j+3]-box[j]),axis=span.indexOf(Math.max(...span));items.sort((a,b)=>(a.box[axis]+a.box[axis+3])-(b.box[axis]+b.box[axis+3]));const half=items.length>>1;return{box,left:tree(items.slice(0,half)),right:tree(items.slice(half))};
  }
  return{fore,roots:chunks.map(indices=>{
   const groups=[];for(let first=0;first<indices.length;first+=64){const keys=indices.slice(first,first+64),box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
    for(const k of keys)for(let j=0;j<3;j++){const a=rays[k+2+j],b=a+rays[k+5+j]*rays[k+8];box[j]=Math.min(box[j],a,b)-1e-7;box[j+3]=Math.max(box[j+3],a,b)+1e-7;}groups.push({keys,box});
   }return tree(groups);
  })};
 }
 function mask(data){
  const rays=data.rays,planes=data.planes,spatial=maskTree(rays),blocked=[],o=[0,0,0],d=[0,0,0],hit=[0,0,0],lo=[0,0,0],ld=[0,0,0],localHit=[0,0,0],worldHit=[0,0,0];
  for(const entry of data.entries){
   const b=entry.box;
   const test=k=>{
    if(!!rays[k+1]!==!!entry.right)return false;for(let j=0;j<3;j++){o[j]=rays[k+2+j];d[j]=rays[k+5+j];}const length=rays[k+8];
    if(rays[k]){
     if(!entry.foreground)return false;let intersects=true;
     for(let q=0;q<6;q++){const p=rays[k]-1+q*4;let distance=planes[p+3];for(let j=0;j<3;j++)distance+=planes[p+j]*(planes[p+j]>0?b[j+3]:b[j]);if(distance<0){intersects=false;break;}}
     let distanceSq=0;for(let j=0;j<3;j++){const diff=Math.max(b[j],Math.min(b[j+3],o[j]))-o[j];distanceSq+=diff*diff;}
     return intersects&&Math.sqrt(distanceSq)<length;
    }
    if(!rayBox(o,d,b,hit))return false;point(o,entry.inverse,lo);direction(d,entry.inverse,ld);if(!rayBox(lo,ld,entry.local,localHit))return false;
    let obstructs=false;
    if(entry.architectural){const p=entry.position,index=entry.index,count=index?index.length:p.length/3;
     for(let t=0;t<count;t+=3){if(!triangle(lo,ld,p,(index?index[t]:t)*3,(index?index[t+1]:t+1)*3,(index?index[t+2]:t+2)*3,localHit))continue;
      point(localHit,entry.world,worldHit);if(Math.sqrt((worldHit[0]-o[0])**2+(worldHit[1]-o[1])**2+(worldHit[2]-o[2])**2)<length-.8){obstructs=true;break;}}
    }else{point(localHit,entry.world,worldHit);obstructs=Math.sqrt((worldHit[0]-o[0])**2+(worldHit[1]-o[1])**2+(worldHit[2]-o[2])**2)<length-.8;}
    return obstructs;
   };
   function visit(node){if(!node||!overlap(b,node.box))return false;if(node.items){for(const group of node.items)if(overlap(b,group.box))for(const k of group.keys)if(test(k))return true;return false;}return visit(node.left)||visit(node.right);}
   if(visit(spatial.roots[entry.right?1:0])||(entry.foreground&&spatial.fore.some(test)))blocked.push(entry.id);
  }
  return new Uint32Array(blocked);
 }
 function execute(kind,data){if(kind==='lod')return data.cells.map(cell=>simplify(data.source,cell));if(kind==='shadow')return merge(data);if(kind==='mask')return mask(data);throw new Error('Unknown geometry job '+kind);}
 function buffers(value,result=[]){if(ArrayBuffer.isView(value)){if(!result.includes(value.buffer))result.push(value.buffer);}else if(value&&typeof value==='object')for(const item of Object.values(value))buffers(item,result);return result;}
 scope.F1GeometryKernel={execute,buffers};
 if(typeof scope.postMessage==='function'&&typeof scope.document==='undefined'){
  scope.onmessage=event=>{const{id,kind,data}=event.data,start=performance.now();try{const result=execute(kind,data);scope.postMessage({id,result,ms:performance.now()-start},buffers(result));}catch(error){scope.postMessage({id,error:String(error.stack||error)});}};
  scope.postMessage({ready:true});
 }
})(globalThis);
