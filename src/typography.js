/* The supplied B/C/F/G/J effects use a separate elapsed clock. Actual font
   glyphs supply the ink paths and particles; native text remains editable. */
window.F1Typography=(()=>{
  'use strict';
  const teams={{TYPE_TEAMS_JSON}},logos={{TYPE_LOGOS_JSON}},titles=new Map(),pageEffects=['roll','trail','ink','blade','particle','roll','sweep','trail'];
  const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},ease=x=>1-Math.pow(1-clamp(x),4),phase=(t,d=0,duration=.8)=>ease((t-d)/duration);
  const blend=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),rgb=hex=>hex.replace('#','').match(/../g).map(v=>parseInt(v,16)),color=a=>'rgb('+a.map(Math.round).join(',')+')';
  const motionOff=matchMedia('(prefers-reduced-motion: reduce)');
  let host,marks={},lastTrack=-1,editing=false,rowBirths=null;const backdrops={};
  function wrap(element,layers=3,characters=false){
    const base=document.createElement('span');base.className='type-base';base.dataset.typeRuntime='base';
    while(element.firstChild)base.append(element.firstChild);element.append(base);
    const walker=document.createTreeWalker(base,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    const words=[],chars=[];for(const node of nodes){const fragment=document.createDocumentFragment();for(const text of node.textContent.split(/(\s+)/)){if(!text)continue;if(/^\s+$/.test(text)){fragment.append(document.createTextNode(text));continue;}const word=document.createElement('span');word.className='type-word';word.dataset.typeRuntime='word';if(characters){for(const char of [...text]){const glyph=document.createElement('span');glyph.className='type-char';glyph.dataset.typeRuntime='char';glyph.textContent=char;word.append(glyph);chars.push(glyph);}}else word.textContent=text;fragment.append(word);words.push(word);}node.replaceWith(fragment);}
    const fx=[];for(let i=0;i<layers;i++){const copy=base.cloneNode(true);copy.className='type-fx';copy.dataset.typeRuntime='fx';copy.setAttribute('aria-hidden','true');element.append(copy);fx.push(copy);}
    return{element,base,fx,words,chars,last:null,raster:null};
  }
  function traceGlyph(mask,width,height){
    const stride=width+1,edges=new Map(),filled=(x,y)=>x>=0&&x<width&&y>=0&&y<height&&mask[(y*width+x)*4+3]>100;
    const edge=(ax,ay,bx,by)=>{const key=ay*stride+ax,list=edges.get(key)||[];list.push(by*stride+bx);edges.set(key,list);};
    for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(filled(x,y)){if(!filled(x,y-1))edge(x,y,x+1,y);if(!filled(x+1,y))edge(x+1,y,x+1,y+1);if(!filled(x,y+1))edge(x+1,y+1,x,y+1);if(!filled(x-1,y))edge(x,y+1,x,y);}
    const paths=[];while(edges.size){let key=edges.keys().next().value,start=key,points=[],guard=0;do{const old=key;points.push([key%stride,Math.floor(key/stride)]);const list=edges.get(old);if(!list)break;key=list.pop();if(!list.length)edges.delete(old);}while(key!==start&&guard++<20000);if(points.length<6)continue;
      const simple=points.filter((p,k)=>{const a=points[(k+points.length-1)%points.length],b=points[(k+1)%points.length];return(p[0]-a[0])*(b[1]-p[1])!==(p[1]-a[1])*(b[0]-p[0]);});if(simple.length>2)paths.push('M'+simple.map(p=>p.join(',')).join('L')+'Z');
    }return paths.join('');
  }
  function prepareRaster(record){
    if(!record||record.raster)return;
    const stage=document.getElementById('stage').getBoundingClientRect(),scale=stage.width/1600,title=record.element.getBoundingClientRect(),width=Math.ceil(title.width/scale),height=Math.ceil(title.height/scale),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),canvas=document.createElement('canvas');
    svg.classList.add('type-ink');svg.dataset.typeRuntime='raster';svg.setAttribute('aria-hidden','true');svg.setAttribute('viewBox','0 0 '+width+' '+height);canvas.className='type-particles';canvas.dataset.typeRuntime='raster';canvas.setAttribute('aria-hidden','true');canvas.width=width;canvas.height=height;
    const paths=[],points=[];
    for(const word of record.words){const style=getComputedStyle(word),box=word.getBoundingClientRect(),x=(box.x-title.x)/scale,y=(box.y-title.y)/scale,w=Math.ceil(box.width/scale)+4,h=Math.ceil(box.height/scale)+4,mask=document.createElement('canvas');mask.width=w;mask.height=h;const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.font=style.fontStyle+' '+style.fontWeight+' '+style.fontSize+' '+style.fontFamily;ctx.fontKerning='none';ctx.letterSpacing=style.letterSpacing;ctx.fillStyle='#fff';ctx.textBaseline='alphabetic';const metrics=ctx.measureText(word.textContent),ascent=metrics.fontBoundingBoxAscent||parseFloat(style.fontSize)*.85,descent=metrics.fontBoundingBoxDescent||parseFloat(style.fontSize)*.2,baseline=(parseFloat(style.lineHeight)-ascent-descent)/2+ascent;ctx.fillText(word.textContent,2,baseline+2);const pixels=ctx.getImageData(0,0,w,h).data;
      const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',traceGlyph(pixels,w,h));path.setAttribute('transform','translate('+(x-2)+' '+(y-2)+')');path.setAttribute('stroke',style.color);path.setAttribute('fill','none');path.setAttribute('stroke-width','1.55');path.setAttribute('stroke-linejoin','round');svg.append(path);paths.push(path);
      for(let py=1;py<h;py+=5)for(let px=1;px<w;px+=5)if(pixels[(py*w+px)*4+3]>140){const id=points.length,angle=id*2.399963,radius=70+(Math.sin(id*12.9898)*43758.5453%1+1)*60;points.push({x:x+px-2,y:y+py-2,dx:Math.cos(angle)*radius,dy:Math.sin(angle)*radius,color:style.color,delay:(id%13)*.012});}
    }
    record.element.append(svg,canvas);paths.forEach(path=>{const length=path.getTotalLength();path.style.strokeDasharray=String(length);path.dataset.length=String(length);});record.raster={svg,canvas,ctx:canvas.getContext('2d'),paths,points};
  }
  function render(record,t,effect){
    if(!record||record.last===t+'|'+effect)return;record.last=t+'|'+effect;
    const{base,fx,words,chars,raster}=record;
    Object.assign(base.style,{opacity:'1',transform:'none',clipPath:'none',filter:'none'});
    for(const layer of fx)Object.assign(layer.style,{opacity:'0',transform:'none',clipPath:'none',color:'inherit',filter:'none'});
    for(const word of words)Object.assign(word.style,{opacity:'1',transform:'none'});
    for(const char of chars)Object.assign(char.style,{opacity:'1',transform:'none'});
    if(raster){raster.svg.style.opacity='0';raster.canvas.style.opacity='0';}
    if(t>=2.1||motionOff.matches)return;
    if(effect==='roll'){
      chars.forEach((char,i)=>{const a=phase(t,.02+i*.018,.83);char.style.opacity=String(smooth((t-i*.018)/.22));char.style.transform='perspective(600px) translateX('+(65*(1-a))+'px) translateZ('+(90*(1-a))+'px) rotateY('+(-88*(1-a))+'deg)';});
    }else if(effect==='ink'&&raster){
      const draw=clamp((t-.04)/1.15),fill=smooth((t-1.05)/.55);base.style.opacity=String(fill);raster.svg.style.opacity=String(1-fill);raster.paths.forEach(path=>path.style.strokeDashoffset=String((1-draw)*+path.dataset.length));
    }else if(effect==='particle'&&raster){
      const fill=smooth((t-1.23)/.48),ctx=raster.ctx;ctx.clearRect(0,0,raster.canvas.width,raster.canvas.height);raster.canvas.style.opacity=String(1-fill);base.style.opacity=String(fill);
      for(const point of raster.points){const a=phase(t,.05+point.delay,1.12);ctx.fillStyle=point.color;ctx.globalAlpha=smooth((t-point.delay)/.32);ctx.fillRect(point.x+point.dx*(1-a),point.y+point.dy*(1-a),2.4,2.4);}ctx.globalAlpha=1;
    }else if(effect==='trail'){
      const converge=phase(t,.06,1.20),solid=smooth((t-1.18)/.42);base.style.opacity=String(solid);
      const colors=['#00b8dc','#ed5389','var(--orange)'];fx.forEach((layer,i)=>{const p=phase(t,.025+i*.075,1.08);Object.assign(layer.style,{color:colors[i],opacity:String((1-solid)*smooth((t-i*.075)/.2)),transform:'translate('+((-52-i*18)*(1-p))+'px,'+((i-1)*7*(1-converge))+'px)'});});
    }else if(effect==='blade'||effect==='sweep'){
      const a=phase(t,.06,effect==='blade'?1.05:.78);Object.assign(base.style,{clipPath:'polygon(0 0,'+(a*132)+'% 0,'+(a*132-24)+'% 100%,0 100%)',transform:'translateX('+(-(effect==='blade'?48:15)*(1-a))+'px) skewX('+(-(effect==='blade'?12:0)*(1-a))+'deg)'});
      if(effect==='sweep'){const glint=clamp((t-.2)/.7),center=glint*135-15;Object.assign(fx[0].style,{opacity:String(Math.sin(glint*Math.PI)*.8),color:'var(--sweep-glint)',clipPath:'polygon('+(center-12)+'% 0,'+(center+4)+'% 0,'+(center-7)+'% 100%,'+(center-23)+'% 100%)'});}
    }
  }
  function init(){
    if(editing)return;
    for(const title of document.querySelectorAll('.deck-slide h1[data-copy],.deck-slide h2[data-copy]'))if(!titles.has(title)){const label=title.cloneNode(true);for(const br of label.querySelectorAll('br'))br.replaceWith(document.createTextNode(' '));title.setAttribute('aria-label',label.textContent.replace(/\s+/g,' ').trim());title.classList.add('type-title');titles.set(title,wrap(title,3,true));}
    if(host)return;host=document.createElement('div');host.id='inspection-type';host.hidden=true;host.setAttribute('aria-hidden','true');document.querySelector('#stage').append(host);
    for(const[key,team]of Object.entries(teams)){
      const mark=document.createElement('div');mark.className='inspection-wordmark';mark.dataset.team=key;const row=document.createElement('p');row.className='inspection-row';mark.append(row);
      const logo=document.createElement('img');logo.className='inspection-logo';logo.src=logos[team.logo];logo.alt=team.name+' logo';mark.append(logo);
      const lines=team.lines.map((text,i)=>{const line=document.createElement('p');line.className='inspection-name';line.textContent=text;line.style.fontFamily=team.font+', CJK, sans-serif';line.style.fontWeight=String(team.weight);line.dataset.ink=team.colors[i]||team.tone;mark.append(line);return wrap(line,1);});
      const note=document.createElement('p');note.className='inspection-note';note.textContent='MONZA / TWO STAGGERED CARS / ILLUSTRATIVE ORDER';mark.append(note);host.append(mark);marks[key]={mark,row,logo,lines,note};
    }
  }
  function titleFor(index){return document.querySelector('.deck-slide[data-slide="'+index+'"] :is(h1,h2)[data-copy]');}
  function page(index,progress=1){if(!editing)render(titles.get(titleFor(index)),clamp(progress)*2.2,pageEffects[index]);}
  function clock(index,seconds){if(editing)return;const title=titleFor(index);title.style.opacity=String(smooth(seconds/.14));render(titles.get(title),Math.max(0,seconds),pageEffects[index]);}
  function settled(){for(let i=0;i<8;i++){page(i,1);titleFor(i).style.opacity='1';}hideInspection();tone(0);clearHalo();}
  function clearHalo(){document.getElementById('story-caption').style.setProperty('--caption-halo','0');document.getElementById('race-status').style.setProperty('--hud-halo','0');}
  function tone(track=0){
    track=smooth((track-.25)/.45);if(Math.abs(track-lastTrack)<.0001)return;lastTrack=track;const root=document.documentElement.style;
    root.setProperty('--scene-ink',color(blend(rgb('#eff3f4'),rgb('#142530'),track)));root.setProperty('--scene-muted',color(blend(rgb('#b8c7d0'),rgb('#243844'),track)));root.setProperty('--scene-accent',color(blend(rgb('#ffb45f'),rgb('#813c00'),track)));root.setProperty('--sweep-glint',color(blend(rgb('#f5f7fa'),rgb('#102c41'),track)));document.body.dataset.typeBackdrop=track>.5?'daylight':'dark';
  }
  function hideInspection(){if(host){host.hidden=true;host.style.opacity='0';}}
  function inspection(pose){
    if(!host)return;const t=pose.seconds,start=4,end=window.F1Story.entryFreeze-.5;if(t<start||t>end){hideInspection();return;}
    const row=Math.min(9,Math.round(pose.inspectionGrid.row)),key=t>=24?'cadillac':window.F1Story.gridOrder[row],record=marks[key];for(const[other,r]of Object.entries(marks))r.mark.classList.toggle('active',other===key);
    host.hidden=false;host.style.opacity=String(smooth((t-start)/.35)*(1-smooth((t-(end-.7))/.7)));record.row.textContent=key==='cadillac'?'11 / NEW ARRIVAL':String(row+1).padStart(2,'0')+' / MONZA GRID';record.note.textContent=key==='cadillac'?'CONCEPT ASSET / ILLUSTRATIVE':'TWO STAGGERED CARS / ILLUSTRATIVE ORDER';
    if(!rowBirths){rowBirths=[4];for(let index=1;index<10;index++){let low=4,high=24;for(let step=0;step<30;step++){const mid=(low+high)/2;if(window.F1Story.entry(mid).inspectionGrid.row<index-.5)low=mid;else high=mid;}rowBirths.push(high);}}
    const birth=key==='cadillac'?24:rowBirths[row],logoProgress=phase(t-birth,.02,.72);record.logo.style.opacity=String(logoProgress);record.logo.style.clipPath='inset(0 '+((1-logoProgress)*100)+'% 0 0)';record.logo.style.transform='translateX('+(-14*(1-logoProgress))+'px)';record.lines.forEach((line,i)=>{line.element.style.color=line.element.dataset.ink;render(line,Math.max(0,t-birth-i*.10),'sweep');});
  }
  function applyBackdrop(kind,t){
    const samples=backdrops[kind];if(!samples){clearHalo();const caption=document.getElementById('story-caption');caption.style.setProperty('--caption-ink','var(--scene-ink)');caption.style.setProperty('--caption-muted','var(--scene-muted)');return;}let i=0;while(i<samples.length-2&&samples[i+1].t<t)i++;const a=samples[i],b=samples[Math.min(i+1,samples.length-1)],p=clamp((t-a.t)/(b.t-a.t||1));
    for(const[key,id,prefix]of[['caption','story-caption','caption'],['hud','race-status','hud']]){const v=blend(a[key],b[key],p),el=document.getElementById(id),light=v[0]>=.5;el.style.setProperty('--'+prefix+'-ink',light?'#142530':'#f2f5f7');el.style.setProperty('--'+prefix+'-muted',light?'#243844':'#c4d1dc');el.style.setProperty('--'+prefix+'-halo','0');}
  }
  function frame(kind,pose){
    hideInspection();tone(pose.track||0);applyBackdrop(kind,pose.seconds);
    const index={overtake:1,costs:2,regulation:3,advantage:4,competition:5,entry:6,conclusion:7}[kind],birth={overtake:9.4,costs:12.3,regulation:4.25,advantage:.8,competition:15.8,entry:34.5,conclusion:20.5};
    if(index!==undefined)clock(index,pose.seconds-birth[kind]);if(kind==='entry')inspection(pose);
  }
  function opening(seconds,state){tone(state.track);clearHalo();clock(0,seconds-28.2);}
  function serialize(element){const clone=element.cloneNode(true);for(const fx of clone.querySelectorAll('[data-type-runtime="fx"],[data-type-runtime="raster"]'))fx.remove();for(const char of clone.querySelectorAll('[data-type-runtime="char"]'))char.replaceWith(document.createTextNode(char.textContent));for(const word of clone.querySelectorAll('[data-type-runtime="word"]'))word.replaceWith(document.createTextNode(word.textContent));for(const base of clone.querySelectorAll('[data-type-runtime="base"]'))base.replaceWith(...base.childNodes);return clone.innerHTML;}
  function setEditing(value){if(value){for(const title of titles.keys()){title.innerHTML=serialize(title);title.classList.remove('type-title');}titles.clear();editing=true;hideInspection();}else{editing=false;init();settled();for(const index of[2,4])prepareRaster(titles.get(titleFor(index)));}}
  async function prepare(){init();await Promise.all(Object.values(teams).map(team=>document.fonts.load(team.weight+' 32px '+team.font)));await document.fonts.load('800 64px Inter');await document.fonts.load('400 24px Inter');await document.fonts.ready;await Promise.all(Object.values(marks).map(record=>record.logo.decode()));settled();for(const index of[2,4])prepareRaster(titles.get(titleFor(index)));}
  async function prepareBackdrops(story){
    const classify=sample=>{return [sample.mean>.18?1:0,0];};
    for(const kind of['overtake','costs','competition','entry']){const list=[];for(let t=0;t<=story.durations[kind]+.01;t+=1.5){window.F1Cinematic.render(story[kind](t));list.push({t,caption:classify(window.F1Cinematic.sampleBackdrop({x:80,y:143,width:750,height:105})),hud:classify(window.F1Cinematic.sampleBackdrop({x:80,y:650,width:460,height:145}))});await window.F1Boot?.tick();}backdrops[kind]=list;}
    window.F1Cinematic.reset();
  }
  return Object.freeze({init,prepare,prepareBackdrops,page,settled,tone,frame,opening,hideInspection,setEditing,serialize,inspection,teamStyles:teams,pageEffects,backdropSamples:()=>backdrops,rasterState:()=>[...titles].filter(([,r])=>r.raster).map(([el,r])=>({key:el.dataset.copy,paths:r.raster.paths.length,particles:r.raster.points.length}))});
})();
