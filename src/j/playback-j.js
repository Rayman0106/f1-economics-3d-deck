/* Submit at a chosen cadence. Story time always remains the native wall clock. */
window.F1PlaybackJ=(()=>{
 let target=60,submitted=0,skipped=0;
 function makeClock(start=performance.now()){
  let rate=target,deadline=start+(rate?1000/rate:0);
  return function(now,force=false){
   if(rate!==target){rate=target;deadline=now;}
   if(!rate){submitted++;return true;}
   const step=1000/rate;
   if(!force&&now+.35<deadline){skipped++;return false;}
   // Advance to a future slot; never run a burst of catch-up renders.
   deadline+=Math.max(1,Math.floor((now-deadline)/step)+1)*step;
   if(deadline<=now+.35)deadline+=step;
   submitted++;return true;
  };
 }
 return{makeClock,setTarget(value){if([0,60,120].includes(Number(value)))target=Number(value);},state(){return{targetFps:target,frameBudgetMs:target?1000/target:null,submitted,skipped,storyClock:'native elapsed seconds',displayRefreshChanged:false};}};
})();
