
window.F1Boot=(()=>{
 const start=performance.now(),events=[],decoded=new Set(),parsed=new Set();let decodedBytes=0,percent=0,phase='读取演示文件…';
 const bar=document.querySelector('#boot-progress .boot-track'),fill=bar.firstElementChild,label=document.getElementById('boot-phase'),number=document.getElementById('boot-number'),steps=[...document.querySelectorAll('#boot-progress .launch-steps li')];
 let visiblePhase='';
 function update(p,text){
  percent=Math.max(percent,Math.min(100,p));phase=text;fill.style.width=percent+'%';bar.setAttribute('aria-valuenow',String(Math.floor(percent)));number.textContent=Math.floor(percent)+'%';
  const step=percent<74?0:percent<96?1:2,message=percent>=100?'准备完成':step===0?'正在准备赛车与赛道…':step===1?'正在准备镜头与画面…':'即将准备完成…';
  if(message!==visiblePhase){visiblePhase=message;label.textContent=message;}
  steps.forEach((item,index)=>{item.classList.toggle('is-active',index===step&&percent<100);item.classList.toggle('is-complete',index<step||percent===100);});
  events.push({ms:Math.round(performance.now()-start),percent,phase});
 }
 async function tick(){await new Promise(requestAnimationFrame);await new Promise(resolve=>setTimeout(resolve,0));}
 return {update,tick,events,
  decoded(key,bytes){if(!decoded.has(key)){decoded.add(key);decodedBytes+=bytes;}update(6+40*Math.min(1,decodedBytes/293097364)+24*parsed.size/13,'读取模型 '+decoded.size+'/13');},
  parsed(key){parsed.add(key);update(6+40*Math.min(1,decodedBytes/293097364)+24*parsed.size/13,'准备模型 '+parsed.size+'/13');},
  finish(){update(100,'准备完成');const overlay=document.getElementById('boot-progress');overlay.setAttribute('aria-hidden','true');overlay.classList.add('done');setTimeout(()=>overlay.hidden=true,480);},
  fail(error){update(percent,'准备失败，请重新打开');label.textContent='暂时无法准备演示';document.querySelector('.boot-note').textContent='请关闭页面后重新打开。';console.error(error);},
  state(){return{percent,phase,elapsedMs:Math.round(performance.now()-start),decoded:[...decoded],parsed:[...parsed],events};}
 };
})();
