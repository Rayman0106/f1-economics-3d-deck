(() => {
  'use strict';
  const $=selector=>document.querySelector(selector),pages=[...document.querySelectorAll('.deck-slide')];
  const rootStyle=document.documentElement.style,pristine=document.documentElement.cloneNode(true);
  const saved=JSON.parse($('#deck-data').textContent),content={{CONTENT_JSON}},story=window.F1Story;
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const scene=$('#scene'),caption=$('#story-caption'),captionTitle=caption.querySelector('strong'),captionNote=caption.querySelector('span');
  const photo=$('.photo-wrap'),budget=$('.budget-track'),repair=$('.repair-segment');
  const costLabels=[...document.querySelectorAll('#cost-labels span')],costMorph=$('#cost-morph path');
  const regMorph=$('#regulation-morph'),regFill=regMorph.querySelector('.reg-fill'),regRest=regMorph.querySelector('.reg-rest'),regGhost=regMorph.querySelector('.reg-ghost'),regLimit=regMorph.querySelector('.reg-limit'),regDiagram=$('.regulation-diagram');
  const photoVector=$('#photo-vector'),photoSilhouette=photoVector.querySelector('.photo-silhouette'),photoOutline=photoVector.querySelector('.photo-outline'),budgetLabels=[...document.querySelectorAll('#budget-labels>span')];
  const feedbackNodes=[...document.querySelectorAll('[data-feedback]')],feedbackArcs=[...document.querySelectorAll('.feedback-arcs>path')],feedbackPulse=$('.feedback-pulse');
  let photoVectorData=null,entryVectorData=null;
  const iterationCaption=$('.iteration-caption'),iterationTitle=iterationCaption.querySelector('strong'),iterationNote=iterationCaption.querySelector('span');
  const competitionBenefits=[...document.querySelectorAll('[data-benefit]')],competitionConditions=$('.competition-conditions');
  const raceStatus=$('#race-status'),racePhase=raceStatus.querySelector('.race-phase'),raceSpeed=raceStatus.querySelector('b'),redSpeed=raceStatus.querySelector('.red-speed'),raceBar=raceStatus.querySelector('.race-speed-track span');
  const entryPhoto=$('.entry-photo'),entryBarriers=[...document.querySelectorAll('[data-barrier]')],entryTakeaway=$('.entry-takeaway');
  const entryVectors=$('#entry-vectors'),entryTeamLabels=$('#entry-team-labels');
  // Reuse the actual photo node, preserving its crop, edited source and credit.
  const entryPhotoHost=document.createElement('div');entryPhotoHost.className='entry-photo-host';$('#briefing').append(entryPhotoHost);entryPhotoHost.append(entryPhoto);
  function sharedEntryPhoto(move=0,opacity=0){
    entryPhoto.style.opacity=String(opacity);entryPhoto.style.visibility=opacity>0?'visible':'hidden';entryPhoto.setAttribute('aria-hidden',String(opacity<=0));
    entryPhoto.style.transform=`translate(${16*move}px,${18*move}px) scale(${1-.05*move})`;
  }

  // Trace of the visible McLaren in the supplied 2048×1152 news photograph.
  // Coordinates below refer to the inspection crop (1330,585), enlarged 2×.
  // The target uses the actual object-fit crop, rather than inflating the GLB.
  const photoEdge=[[117,375],[146,373],[151,348],[177,339],[194,328],[225,321],[226,296],[230,266],[244,241],[261,228],[283,222],[320,222],[346,227],[367,240],[382,263],[390,268],[485,237],[518,229],[532,210],[550,209],[559,217],[568,231],[609,228],[618,201],[633,193],[644,179],[666,169],[701,164],[748,167],[782,176],[797,170],[800,144],[818,131],[827,124],[825,115],[806,113],[802,111],[802,100],[820,98],[827,88],[831,91],[830,99],[848,95],[852,101],[879,100],[881,104],[869,109],[850,110],[841,117],[838,129],[896,129],[921,133],[946,138],[993,156],[1034,158],[1134,159],[1142,154],[1156,155],[1157,140],[1162,133],[1175,128],[1189,133],[1200,132],[1205,128],[1208,137],[1206,149],[1212,159],[1310,158],[1394,158],[1402,160],[1405,182],[1404,216],[1398,254],[1374,276],[1388,300],[1398,332],[1399,363],[1391,399],[1377,421],[1353,438],[1322,446],[1264,447],[1236,441],[1206,424],[1197,416],[1133,427],[1075,429],[1048,436],[1025,445],[977,451],[933,448],[907,438],[884,423],[867,402],[848,374],[805,382],[774,395],[757,429],[739,441],[706,441],[685,438],[664,440],[658,434],[666,416],[674,402],[661,390],[613,407],[529,407],[452,410],[413,405],[403,388],[394,401],[377,413],[343,426],[307,429],[280,421],[258,409],[241,391],[236,389],[224,394],[181,396],[151,394],[117,389],[113,383]];
  const polygonPath=points=>'M'+points.map(point=>point.map(value=>value.toFixed(2)).join(',')).join('L')+'Z';
  function sampleBoundary(points,count=256){
    const distances=[0];for(let k=0;k<points.length;k++){const a=points[k],b=points[(k+1)%points.length];distances.push(distances[k]+Math.hypot(b[0]-a[0],b[1]-a[1]));}
    let edge=0;return Array.from({length:count},(_,index)=>{const distance=distances.at(-1)*index/count;while(edge<points.length-1&&distances[edge+1]<distance)edge++;const p=points[edge],q=points[(edge+1)%points.length],t=(distance-distances[edge])/(distances[edge+1]-distances[edge]||1);return[story.mix(p[0],q[0],t),story.mix(p[1],q[1],t)];});
  }
  const arcPoint=angle=>[800+440*Math.cos(angle),550+155*Math.sin(angle)];
  for(const[index,angles]of[[-2.62,-1.95],[-1.19,-.52],[-.16,.67],[1.03,2.12],[2.48,3.303]].entries()){
    const first=arcPoint(angles[0]),last=arcPoint(angles[1]);feedbackArcs[index].setAttribute('d',`M${first.join(',')}A440,155 0 0,1 ${last.join(',')}`);feedbackArcs[index].setAttribute('pathLength','1');
  }
  const children=pages.map(page=>[...page.children]);
  let cachedBudget=null;
  let slide=0,editing=false,opening=false,ready=false,dirty=false,openingSeconds=0,awaitingStart=true,starting=false;
  let monitor=0,photoTarget=null,transition=null,pendingTarget=null,session=0,photoLayout=null,costReference=null;
  for(const element of document.querySelectorAll('[data-copy]')){
    if(Object.hasOwn(saved.text||{},element.dataset.copy))element.innerHTML=saved.text[element.dataset.copy];
    element.addEventListener('input',()=>dirty=true);
  }
  for(const element of document.querySelectorAll('[data-photo]'))if(saved.photos?.[element.dataset.photo])element.querySelector('img').src=saved.photos[element.dataset.photo];
  window.F1Typography.init();
  const targetIndex=index=>Math.max(0,Math.min(pages.length-1,Math.round(index)));
  const logicalIndex=()=>pendingTarget??transition?.to??slide;
  const coverLayout={x:589,y:236,scale:.72,angle:0},identityLayout={x:0,y:0,scale:1,angle:0};
  function setCarLayout(layout){
    const a=Math.cos(layout.angle||0)*layout.scale,b=Math.sin(layout.angle||0)*layout.scale;
    rootStyle.setProperty('--car-transform',`matrix(${a},${b},${-b},${a},${layout.x},${layout.y})`);
  }
  function mixLayout(first,last,t){return{x:story.mix(first.x,last.x,t),y:story.mix(first.y,last.y,t),scale:Math.exp(story.mix(Math.log(first.scale),Math.log(last.scale),t)),angle:story.mix(first.angle||0,last.angle||0,t)};}
  function busy(value){for(const id of['show-notes','edit-deck']){const button=$('#'+id);if(button)button.disabled=value;}$('#stage').setAttribute('aria-busy',String(value));}
  function activate(index){
    const previous=slide;slide=targetIndex(index);
    if(document.body.dataset.deckSlide!==String(slide)){
      document.body.dataset.deckSlide=String(slide);$('#slide-count').textContent=String(slide+1).padStart(2,'0')+' / '+String(pages.length).padStart(2,'0');
    }
    $('#previous-slide').disabled=awaitingStart||slide===0;$('#next-slide').disabled=awaitingStart||slide===pages.length-1;
    if(previous!==slide)document.dispatchEvent(new CustomEvent('f1-slide-change',{detail:{index:slide,previous}}));
  }
  function hideOverlays(){
    window.F1Typography.hideInspection();
    raceStatus.style.opacity='0';entryVectors.style.opacity='0';entryTeamLabels.style.opacity='0';sharedEntryPhoto();
    caption.style.opacity='0';for(const element of[...costLabels,costMorph,...regMorph.children])element.style.opacity='0';
    photoVector.style.opacity='0';budgetLabels.forEach(label=>label.style.opacity='0');
  }
  function preparePhotoVector(){
    window.F1Cinematic.makeWheelTables(story.overtake,story.durations.overtake);
    photoVectorData=window.F1Cinematic.captureSilhouette(story.overtake(story.freeze));
    const image=photo.querySelector('img'),scale=Math.max(photo.offsetWidth/(image.naturalWidth||2048),photo.offsetHeight/(image.naturalHeight||1152));
    const cropX=(photo.offsetWidth-(image.naturalWidth||2048)*scale)*.5,cropY=(photo.offsetHeight-(image.naturalHeight||1152)*scale)*.65;
    const target=photoEdge.map(([x,y])=>[80+cropX+(1330+x/2)*scale,photo.offsetTop+cropY+(585+y/2)*scale]);
    const first=sampleBoundary(photoVectorData.loops[0].points),last=sampleBoundary(target);let best=0,bestError=Infinity;
    for(let shift=0;shift<last.length;shift++){let error=0;for(let k=0;k<last.length;k++){const p=first[k],q=last[(k+shift)%last.length];error+=(p[0]-q[0])**2+(p[1]-q[1])**2;}if(error<bestError){bestError=error;best=shift;}}
    Object.assign(photoVectorData,{first,last:last.map((_,index)=>last[(index+best)%last.length]),targetPath:polygonPath(target),fit:-1});
    for(const element of[photoSilhouette,photoOutline])element.setAttribute('d',photoVectorData.path);
    photoVector.dataset.targetPath=photoVectorData.targetPath;
    const clip=photoVector.querySelector('rect');for(const[key,value]of Object.entries({x:80,y:photo.offsetTop,width:photo.offsetWidth,height:photo.offsetHeight}))clip.setAttribute(key,String(value));
  }
  function photoVectorFrame(fill,outline,fit=1){
    if(!photoVectorData)return;photoVector.style.opacity=fill||outline?'1':'0';photoSilhouette.style.opacity=String(fill);photoOutline.style.opacity=String(outline);
    if(fit!==photoVectorData.fit){
      const path=fit<=0?photoVectorData.path:fit>=1?photoVectorData.targetPath:polygonPath(photoVectorData.first.map((point,index)=>point.map((value,axis)=>story.mix(value,photoVectorData.last[index][axis],fit))));
      for(const element of[photoSilhouette,photoOutline])element.setAttribute('d',path);photoOutline.removeAttribute('transform');photoVectorData.fit=fit;photoVector.dataset.fit=String(fit);
    }
  }
  // Boundary traced in the 2048x1152 source photo. Concept geometry morphs
  // into the photographed car rather than pretending both models are identical.
  const entryPhotoEdge=[[900.0,40.0],[907.0,40.0],[914.0,40.0],[921.0,40.0],[928.0,40.0],[935.0,40.0],[942.0,40.0],[949.0,40.0],[955.3,39.0],[957.0,32.3],[958.8,25.5],[960.6,18.7],[966.2,16.4],[970.3,20.0],[972.4,26.6],[974.5,33.3],[976.7,40.0],[982.9,41.0],[989.9,41.0],[992.7,35.3],[994.8,28.6],[996.8,21.9],[1000.9,17.7],[1007.2,17.8],[1009.1,24.5],[1011.0,31.3],[1012.9,38.0],[1016.9,42.0],[1023.9,42.0],[1029.5,40.2],[1031.3,33.5],[1033.2,26.7],[1035.1,20.0],[1042.1,20.0],[1045.8,24.7],[1048.4,31.2],[1050.9,37.7],[1054.4,43.1],[1061.4,43.3],[1068.3,43.6],[1075.3,43.9],[1082.3,44.1],[1089.3,44.4],[1096.3,44.7],[1100.7,49.2],[1101.5,51.1],[1103.9,57.4],[1103.4,64.5],[1104.5,69.5],[1100.8,72.2],[1093.8,72.5],[1086.8,72.7],[1079.7,69.9],[1072.7,72.2],[1065.7,72.4],[1058.7,72.7],[1051.8,72.9],[1044.8,73.1],[1037.8,73.4],[1030.7,72.6],[1022.9,72.0],[1016.2,76.8],[1015.0,85.2],[1015.0,92.2],[1009.0,99.2],[1009.0,106.2],[1009.0,114.2],[1015.3,126.0],[1027.0,128.0],[1034.0,129.0],[1040.9,129.9],[1047.7,131.9],[1054.4,134.8],[1060.8,139.7],[1068.7,133.7],[1076.1,130.7],[1083.1,129.6],[1089.3,131.4],[1095.7,134.4],[1101.5,138.2],[1107.4,142.1],[1113.2,145.9],[1119.1,149.7],[1125.7,151.2],[1132.7,151.5],[1139.7,151.9],[1146.6,153.2],[1153.6,154.5],[1160.5,155.8],[1167.4,158.1],[1174.2,162.5],[1180.9,169.8],[1187.9,170.1],[1195.1,165.4],[1202.2,163.7],[1209.2,164.1],[1216.2,164.4],[1223.1,163.7],[1228.4,164.0],[1234.1,164.8],[1237.2,174.2],[1242.6,179.1],[1253.1,175.4],[1261.2,176.3],[1268.8,175.1],[1275.8,175.8],[1282.7,176.5],[1289.9,175.3],[1297.0,175.0],[1303.6,175.6],[1306.2,179.3],[1305.3,186.1],[1305.5,193.1],[1302.7,200.2],[1301.0,206.2],[1299.5,211.5],[1298.1,218.0],[1290.9,222.8],[1290.2,230.0],[1296.1,239.8],[1296.4,247.4],[1296.4,257.4],[1290.1,265.0],[1284.5,269.4],[1277.9,272.1],[1267.4,267.8],[1266.2,274.8],[1266.2,268.6],[1270.3,271.4],[1276.4,275.6],[1282.2,280.6],[1286.1,287.2],[1290.5,293.1],[1291.7,300.0],[1291.6,306.9],[1288.5,312.6],[1283.9,317.6],[1279.5,321.7],[1276.6,327.4],[1271.3,334.9],[1281.1,341.1],[1276.6,348.9],[1274.3,353.7],[1269.9,359.0],[1265.0,365.4],[1262.1,374.1],[1266.2,381.6],[1269.2,388.0],[1269.0,397.2],[1276.5,403.9],[1285.4,404.6],[1292.4,404.7],[1299.5,404.8],[1306.6,404.9],[1313.6,405.0],[1320.7,405.1],[1327.8,405.3],[1334.7,406.4],[1341.7,406.5],[1348.4,406.3],[1355.4,406.0],[1362.4,405.7],[1369.5,405.3],[1376.6,405.0],[1383.6,404.7],[1390.9,405.3],[1397.9,405.0],[1405.0,404.6],[1412.2,405.3],[1420.5,404.7],[1429.3,404.2],[1436.3,402.1],[1440.5,393.6],[1445.4,384.8],[1448.4,377.0],[1449.4,372.2],[1454.0,370.7],[1460.9,368.4],[1467.9,368.1],[1474.9,367.8],[1481.9,367.5],[1488.9,367.3],[1495.9,367.1],[1502.9,368.0],[1509.8,368.9],[1516.7,369.7],[1523.8,369.6],[1530.8,370.5],[1537.7,371.3],[1544.8,371.2],[1551.9,371.1],[1558.1,376.9],[1564.7,378.5],[1571.5,380.3],[1578.3,382.0],[1584.8,383.7],[1589.2,387.2],[1594.9,391.0],[1598.7,397.0],[1598.1,404.4],[1598.3,412.2],[1592.8,417.8],[1588.0,422.5],[1587.7,429.2],[1588.3,436.2],[1589.0,443.2],[1589.6,450.2],[1590.6,457.1],[1592.0,463.9],[1593.3,470.8],[1594.7,477.7],[1596.0,484.5],[1597.4,491.4],[1598.7,498.3],[1600.0,505.2],[1600.4,512.2],[1600.6,519.3],[1600.8,526.3],[1601.0,533.4],[1601.3,540.5],[1601.5,547.5],[1600.7,554.8],[1601.0,561.9],[1611.3,568.8],[1614.3,560.3],[1615.7,553.4],[1617.0,546.6],[1619.3,539.9],[1619.6,532.8],[1621.0,526.0],[1623.3,519.3],[1624.5,512.6],[1626.8,506.4],[1629.6,500.0],[1634.2,494.4],[1639.7,489.2],[1641.6,482.4],[1643.0,476.3],[1652.3,476.3],[1652.3,467.1],[1651.6,457.2],[1655.1,450.3],[1662.0,447.1],[1668.9,444.8],[1675.4,441.6],[1682.6,442.3],[1689.5,441.1],[1696.4,439.9],[1703.5,439.6],[1710.5,439.4],[1717.6,439.1],[1724.5,437.9],[1731.4,436.6],[1738.5,436.0],[1745.5,436.1],[1752.5,436.2],[1759.5,436.3],[1766.5,436.4],[1773.5,436.5],[1780.5,435.6],[1787.5,436.7],[1794.5,436.8],[1801.5,435.8],[1808.6,435.9],[1816.0,435.5],[1824.8,432.0],[1832.4,431.2],[1839.7,431.5],[1847.0,431.7],[1853.9,433.9],[1861.9,440.1],[1869.8,445.3],[1873.8,451.4],[1877.8,457.5],[1883.7,461.4],[1890.3,464.5],[1896.9,467.5],[1902.4,475.2],[1909.9,481.9],[1913.2,488.5],[1916.4,494.7],[1919.6,500.9],[1920.1,508.5],[1922.4,515.2],[1922.9,522.8],[1924.4,530.2],[1925.4,538.0],[1926.4,545.3],[1928.2,552.1],[1929.1,559.1],[1929.9,566.1],[1931.7,572.9],[1932.6,579.9],[1934.4,586.6],[1935.3,593.7],[1937.1,600.4],[1938.9,607.2],[1940.7,613.9],[1942.6,620.7],[1943.2,627.7],[1944.2,634.6],[1944.2,641.6],[1945.2,648.6],[1945.2,655.6],[1945.3,662.7],[1955.2,668.3],[1956.2,675.3],[1956.2,682.3],[1956.2,689.4],[1957.2,696.3],[1957.2,703.4],[1957.2,710.5],[1958.2,717.4],[1958.1,724.5],[1958.6,731.5],[1959.1,738.5],[1959.6,745.4],[1960.1,752.4],[1959.6,759.5],[1960.1,766.5],[1959.6,773.5],[1959.1,780.6],[1959.6,787.6],[1960.1,794.5],[1959.6,801.6],[1960.1,808.6],[1960.6,815.5],[1961.9,822.2],[1961.5,829.1],[1961.1,836.1],[1959.7,843.0],[1959.3,850.0],[1958.9,857.0],[1957.5,863.9],[1958.1,870.9],[1956.7,877.9],[1957.3,884.9],[1955.9,891.8],[1955.5,898.8],[1955.1,905.5],[1954.9,912.2],[1955.3,919.3],[1953.7,926.2],[1953.1,933.2],[1951.5,940.0],[1950.9,947.1],[1948.4,956.5],[1957.2,958.9],[1963.5,962.0],[1969.7,964.9],[1975.1,967.8],[1979.8,972.1],[1983.7,976.4],[1988.7,983.2],[1983.3,988.1],[1976.0,989.2],[1968.8,988.1],[1961.7,986.8],[1954.5,985.4],[1947.7,987.1],[1940.8,990.8],[1937.2,997.2],[1930.6,1000.1],[1927.4,1006.6],[1923.4,1012.5],[1918.0,1017.8],[1911.3,1021.1],[1904.6,1023.2],[1897.8,1025.4],[1890.7,1026.7],[1886.2,1035.4],[1878.5,1038.4],[1871.4,1039.8],[1864.5,1040.3],[1857.5,1041.7],[1850.6,1043.2],[1843.6,1043.6],[1836.6,1044.1],[1829.7,1045.5],[1821.4,1046.0],[1812.8,1046.6],[1805.4,1048.3],[1798.5,1047.0],[1792.9,1038.9],[1786.7,1033.7],[1780.2,1030.5],[1773.3,1028.2],[1766.9,1024.7],[1761.1,1020.7],[1754.8,1017.6],[1748.5,1014.6],[1742.2,1011.5],[1736.3,1007.9],[1733.3,1001.5],[1730.3,995.1],[1727.3,988.7],[1724.9,981.4],[1720.1,970.7],[1709.4,975.0],[1702.4,977.0],[1695.4,978.0],[1688.4,979.0],[1681.4,980.0],[1674.4,981.0],[1667.3,981.9],[1660.1,983.4],[1652.9,986.8],[1645.8,987.3],[1638.6,989.8],[1631.9,985.3],[1624.9,985.8],[1618.3,985.3],[1612.1,982.4],[1604.8,978.4],[1597.8,979.3],[1590.9,980.2],[1584.5,985.1],[1578.4,991.9],[1570.8,987.9],[1564.2,991.8],[1557.0,990.8],[1549.8,989.8],[1543.0,991.7],[1535.4,987.7],[1528.3,987.7],[1521.4,988.6],[1513.9,985.6],[1506.9,985.6],[1499.7,984.5],[1492.7,985.5],[1485.5,984.4],[1478.4,984.4],[1471.2,983.4],[1464.1,982.3],[1458.1,989.1],[1451.7,993.7],[1444.9,996.3],[1438.0,997.9],[1431.0,998.5],[1424.0,999.1],[1417.1,999.8],[1410.1,1000.4],[1403.1,1001.0],[1396.1,1001.6],[1389.2,1002.2],[1382.1,1001.8],[1375.1,1001.4],[1367.8,998.9],[1360.5,995.5],[1353.6,996.1],[1346.8,998.6],[1339.7,998.2],[1332.7,998.7],[1326.1,1003.3],[1319.4,1005.8],[1312.6,1006.6],[1305.6,1006.9],[1298.6,1006.3],[1291.8,1004.7],[1284.7,1005.0],[1277.7,1004.4],[1270.8,1003.7],[1263.8,1003.1],[1256.8,1002.5],[1249.9,1001.8],[1243.0,1000.2],[1236.2,997.6],[1229.0,998.0],[1221.9,997.8],[1214.9,997.5],[1208.0,996.3],[1201.0,995.1],[1194.0,994.9],[1187.0,994.7],[1180.0,996.5],[1172.9,997.3],[1165.9,998.1],[1158.8,999.9],[1151.8,1000.7],[1144.8,1002.4],[1137.7,1003.2],[1130.3,1005.0],[1122.6,1007.0],[1115.1,1008.9],[1107.9,1009.9],[1102.0,1002.0],[1095.7,997.0],[1089.0,994.0],[1082.3,992.0],[1075.5,990.0],[1068.6,988.9],[1061.6,987.9],[1054.9,985.9],[1047.9,984.9],[1041.0,983.9],[1034.1,982.8],[1027.3,980.8],[1020.5,978.8],[1014.1,974.8],[1007.7,972.7],[1001.1,971.2],[994.5,968.6],[987.9,966.0],[981.1,964.3],[974.3,962.7],[967.3,962.1],[960.2,961.4],[953.4,959.8],[946.6,958.2],[939.8,956.5],[932.5,956.8],[925.9,954.2],[918.8,953.7],[911.6,953.3],[904.6,952.9],[897.7,951.5],[890.5,952.1],[883.4,951.7],[876.5,950.3],[869.7,948.9],[862.8,947.6],[856.0,946.2],[849.1,944.9],[842.1,944.3],[835.1,943.8],[828.1,943.2],[821.2,942.6],[814.2,942.0],[807.2,941.4],[800.2,940.9],[793.3,940.3],[786.3,939.7],[779.3,939.1],[772.3,938.5],[765.4,937.9],[758.4,937.4],[751.4,937.3],[744.5,938.0],[737.5,938.8],[730.5,939.6],[723.6,940.3],[716.6,941.1],[709.7,941.8],[702.7,942.6],[695.7,943.4],[689.3,945.5],[683.8,949.8],[678.7,955.0],[671.6,956.7],[664.6,958.4],[658.0,961.0],[651.4,963.5],[644.9,965.0],[639.1,966.2],[632.5,965.4],[625.4,964.6],[618.2,963.8],[610.0,963.6],[603.5,969.0],[597.2,972.2],[590.2,973.6],[584.3,977.7],[578.3,981.7],[571.9,984.8],[565.2,986.8],[558.5,988.9],[551.7,990.0],[544.7,990.1],[537.7,990.2],[530.7,990.3],[523.7,990.4],[516.7,990.5],[509.7,990.6],[502.7,990.7],[495.7,990.8],[488.7,990.9],[481.7,990.9],[474.9,989.4],[468.0,987.8],[461.2,986.3],[454.4,984.7],[447.6,983.2],[440.7,981.7],[433.9,980.1],[427.5,977.7],[422.2,973.2],[416.8,968.7],[411.5,964.1],[406.1,959.6],[400.8,955.1],[395.3,951.1],[388.3,951.6],[381.3,952.1],[374.4,952.6],[367.4,953.1],[360.4,953.7],[354.4,952.0],[350.0,946.5],[345.6,941.1],[340.4,936.1],[336.7,929.9],[333.7,923.4],[330.8,916.9],[326.0,911.1],[320.1,905.5],[318.2,898.8],[314.3,892.7],[315.3,885.9],[317.2,878.0],[317.0,870.4],[314.1,864.1],[312.3,857.9],[305.8,860.0],[298.8,864.0],[291.3,864.8],[283.9,864.0],[277.0,863.2],[269.8,864.3],[262.9,863.5],[255.9,862.7],[248.8,862.9],[241.8,863.1],[234.7,864.3],[227.7,863.5],[220.7,863.8],[213.6,864.0],[206.6,863.3],[198.8,862.4],[191.1,853.4],[186.1,845.3],[181.5,839.7],[174.6,837.3],[167.1,835.9],[161.5,829.4],[157.0,822.0],[152.7,815.4],[149.5,809.1],[147.3,802.4],[145.1,795.8],[142.8,788.7],[142.1,781.0],[141.8,773.9],[140.6,767.0],[141.3,759.7],[141.0,752.7],[139.7,745.8],[139.4,738.7],[140.1,731.5],[139.8,724.4],[140.0,717.4],[140.9,710.5],[148.8,703.4],[148.7,696.4],[153.6,689.3],[154.6,682.3],[154.5,675.3],[142.4,668.4],[142.3,661.4],[142.2,654.4],[142.2,647.4],[142.1,640.4],[143.0,633.7],[142.7,627.0],[143.6,620.1],[144.4,613.1],[144.2,606.0],[145.0,599.1],[144.9,592.0],[144.7,584.9],[145.5,578.0],[146.3,571.0],[146.2,564.0],[147.0,557.0],[147.8,550.1],[148.6,543.1],[148.7,536.0],[149.9,529.1],[150.2,522.1],[150.5,515.0],[150.7,507.9],[152.0,501.1],[153.2,494.2],[153.5,487.1],[154.7,480.2],[155.0,473.1],[156.2,466.3],[156.5,459.2],[165.7,453.7],[167.0,446.9],[168.3,440.0],[170.6,433.3],[177.9,427.6],[178.2,420.5],[177.6,413.3],[178.9,406.4],[179.3,399.3],[178.6,392.2],[178.2,384.8],[178.2,377.2],[179.2,369.9],[179.2,362.3],[181.1,355.5],[184.6,347.8],[189.0,339.4],[194.3,333.5],[198.9,328.1],[206.9,326.4],[214.5,321.8],[222.8,319.9],[229.4,317.6],[237.0,318.2],[244.4,317.8],[251.8,317.8],[258.9,318.1],[266.0,318.3],[273.0,317.6],[280.0,317.8],[287.0,318.1],[293.8,318.0],[300.8,318.0],[307.8,318.0],[314.8,318.0],[321.8,318.0],[328.8,318.0],[335.6,320.0],[342.3,319.6],[349.3,319.4],[356.3,320.3],[363.2,321.1],[370.3,321.0],[377.2,321.8],[384.0,323.1],[391.2,322.6],[398.1,324.0],[405.1,324.5],[412.9,328.6],[418.4,320.8],[425.9,314.1],[428.3,307.3],[426.8,299.9],[425.0,292.5],[424.0,285.3],[424.0,278.3],[424.0,271.3],[423.0,264.3],[422.0,257.3],[419.0,250.3],[419.0,243.3],[419.0,236.3],[420.0,229.3],[419.0,222.4],[419.3,215.6],[418.8,208.7],[419.3,201.7],[418.9,194.6],[419.4,187.6],[418.9,180.6],[419.4,173.6],[420.0,166.6],[421.5,159.8],[422.8,156.7],[426.9,157.3],[433.3,150.6],[440.3,149.9],[447.4,150.3],[458.0,153.3],[461.4,149.2],[465.5,146.3],[472.0,140.6],[479.0,141.0],[486.1,141.3],[493.0,141.6],[498.0,141.3],[501.0,146.1],[506.3,151.9],[513.0,158.4],[520.4,159.1],[527.4,158.7],[534.4,159.3],[541.5,158.9],[548.4,159.5],[555.4,160.1],[562.5,159.7],[569.5,160.3],[576.5,159.9],[583.6,160.3],[590.6,159.7],[597.6,160.1],[604.6,160.5],[611.6,160.9],[618.6,161.3],[625.6,161.7],[632.6,162.0],[639.7,162.0],[646.7,162.0],[653.7,162.0],[660.7,162.0],[667.7,162.0],[674.7,163.0],[681.8,163.0],[688.9,162.6],[696.0,163.0],[703.0,163.4],[710.1,163.8],[717.0,164.3],[723.7,164.0],[730.6,165.0],[737.6,165.0],[744.6,165.0],[751.6,165.0],[758.6,165.0],[766.2,166.0],[774.3,165.8],[781.9,158.7],[789.2,153.1],[794.7,150.3],[793.9,148.6],[798.7,148.8],[805.8,152.7],[812.8,152.5],[819.8,154.4],[826.8,154.3],[833.8,154.2],[835.9,154.3],[836.2,154.3],[844.0,157.7],[857.9,161.5],[867.7,149.3],[861.0,140.1],[860.0,133.1],[861.0,126.1],[861.3,119.3],[860.5,111.8],[861.7,104.9],[865.1,97.8],[873.2,97.9],[878.0,100.5],[880.6,104.8],[883.6,107.8],[884.5,112.7],[886.8,121.8],[893.0,132.9],[903.0,134.7],[912.0,131.6],[921.0,127.8],[927.8,124.1],[934.6,122.5],[941.4,120.9],[948.3,119.7],[955.3,119.2],[962.3,118.7],[969.3,118.1],[976.2,117.6],[985.9,120.0],[991.7,110.9],[991.3,103.4],[989.0,96.5],[990.7,89.4],[991.3,82.3],[983.2,74.5],[975.0,71.6],[968.0,71.3],[961.1,70.9],[954.1,70.6],[947.1,70.2],[940.1,69.9],[933.1,69.5],[926.1,70.2],[919.1,69.8],[912.1,69.5],[906.2,69.4],[902.7,67.6],[902.3,60.9],[902.9,53.8],[904.4,46.7]];
  function prepareEntryVectors(){
    window.F1Cinematic.makeWheelTables(story.entry,story.durations.entry);
    const contour=window.F1Cinematic.captureSilhouette(story.entry(story.entryFreeze),'cadillac');
    for(const path of entryVectors.querySelectorAll('[data-entry-outline]'))path.setAttribute('d','');
    for(const label of entryTeamLabels.querySelectorAll('[data-entry-team]'))label.style.display='none';
    const image=entryPhoto.querySelector('img'),width=image.naturalWidth||2048,height=image.naturalHeight||1152,scale=Math.max(entryPhoto.offsetWidth/width,entryPhoto.offsetHeight/height);
    const cx=(entryPhoto.offsetWidth-width*scale)*.5,cy=(entryPhoto.offsetHeight-height*scale)*.5;
    const target=entryPhotoEdge.map(([x,y])=>[entryPhoto.offsetLeft+cx+x*scale,entryPhoto.offsetTop+cy+y*scale]);
    const first=sampleBoundary(contour.loops[0].points);let last=sampleBoundary(target);
    const winding=points=>points.reduce((area,p,k)=>{const q=points[(k+1)%points.length];return area+p[0]*q[1]-q[0]*p[1];},0);
    if(Math.sign(winding(first))!==Math.sign(winding(last)))last.reverse();
    let best=0,bestError=Infinity;
    for(let shift=0;shift<last.length;shift++){let error=0;for(let k=0;k<last.length;k++){const p=first[k],q=last[(k+shift)%last.length];error+=(p[0]-q[0])**2+(p[1]-q[1])**2;}if(error<bestError){bestError=error;best=shift;}}
    entryVectorData={...contour,first,last:last.map((_,k)=>last[(k+best)%last.length]),targetPath:polygonPath(target),fit:-1};
    entryVectors.dataset.targetPath=entryVectorData.targetPath;
    entryVectorFrame(0,0,0,0);
  }
  function entryVectorFrame(outline,labels,fit=1,fill=0){
    entryVectors.style.opacity=String(Math.max(outline,fill));entryTeamLabels.style.opacity='0';if(!entryVectorData)return;
    if(entryVectorData.fit!==fit){
      const path=fit<=0?entryVectorData.path:fit>=1?entryVectorData.targetPath:polygonPath(entryVectorData.first.map((point,k)=>point.map((value,axis)=>story.mix(value,entryVectorData.last[k][axis],fit))));
      entryVectors.querySelector('[data-entry-outline="cadillac"]').setAttribute('d',path);
      // The filled model contour dissolves in place. Only the thin outline
      // conforms to the photograph, avoiding a filled morphing blob.
      entryVectors.querySelector('.entry-silhouette').setAttribute('d',entryVectorData.path);entryVectorData.fit=fit;entryVectors.dataset.fit=String(fit);
    }
    entryVectors.querySelector('[data-entry-outline="cadillac"]').style.opacity=String(outline);entryVectors.querySelector('.entry-silhouette').style.opacity=String(fill);
  }
  function calibrateEntryPhoto(){
    // Match the photograph's near-frontal angle and fit projected bounds to its
    // car area. The final vector morph handles differences in concept geometry.
    const base={fov:32,roll:0,principal:[800,450],view:{forward:18,left:-2.8,height:1.25}};
    window.F1Cinematic.makeWheelTables(story.entry,story.durations.entry);
    story.configureEntryPhoto(base);const state=window.F1Cinematic.render(story.entry(story.entryFreeze),null,true),box=state.actorBounds.cadillac;
    const image=entryPhoto.querySelector('img'),width=image.naturalWidth||2048,height=image.naturalHeight||1152,scale=Math.max(entryPhoto.offsetWidth/width,entryPhoto.offsetHeight/height);
    const cropX=(entryPhoto.offsetWidth-width*scale)*.5,cropY=(entryPhoto.offsetHeight-height*scale)*.5;
    const xs=entryPhotoEdge.map(p=>p[0]),ys=entryPhotoEdge.map(p=>p[1]),minX=Math.min(...xs),minY=Math.min(...ys);
    const target={x:entryPhoto.offsetLeft+cropX+minX*scale,y:entryPhoto.offsetTop+cropY+minY*scale,width:(Math.max(...xs)-minX)*scale,height:(Math.max(...ys)-minY)*scale};
    const factor=Math.min(target.width/box.width,target.height/box.height),centre=[box.x+box.width/2,box.y+box.height/2],tc=[target.x+target.width/2,target.y+target.height/2];
    story.configureEntryPhoto({...base,fov:2*Math.atan(Math.tan(base.fov*Math.PI/360)/factor)*180/Math.PI,principal:[800*factor+tc[0]-centre[0]*factor,450*factor+tc[1]-centre[1]*factor]});
  }
  function feedbackFrame(pose){
    feedbackNodes.forEach((node,index)=>node.style.opacity=String(pose.nodes[index]));
    feedbackArcs.forEach((path,index)=>{const start=[1.65,7.6,8.7,9.75,10.65][index],progress=story.ease(start,start+.65,pose.seconds);path.style.opacity=String(.8*progress);path.style.strokeDasharray='1';path.style.strokeDashoffset=String(1-progress);});
    const point=arcPoint(-2.8+Math.PI*2*pose.loop);feedbackPulse.setAttribute('cx',point[0]);feedbackPulse.setAttribute('cy',point[1]);feedbackPulse.style.opacity=String(story.ease(1.65,2,pose.seconds)*(1-story.ease(11.2,11.8,pose.seconds)));
    const t=pose.seconds,text=t<2.35?['V01 / BASELINE','The next car starts with this one.']:t<4.25?['FRONT WING / REVISION 02','Revise the geometry. Fit the new assembly.']:t<5.55?['V02 / TEST & COMPARE','Track feedback shapes the next revision.']:t<7.55?['REAR AERO / REVISION 03','Refine another part of the same car.']:t<9?['V03 / TEST AGAIN','Evaluate the new configuration.']:['V01 → V02 → V03','Each iteration builds on the last.'];
    if(iterationTitle.textContent!==text[0])iterationTitle.textContent=text[0];if(iterationNote.textContent!==text[1])iterationNote.textContent=text[1];iterationCaption.style.opacity=String(story.ease(1.5,2.0,t));
  }
  function pageOpacity(index,opacity){
    const page=pages[index],visible=opacity>0;if(page.classList.contains('active')!==visible){page.classList.toggle('active',visible);page.style.visibility=visible?'visible':'hidden';page.setAttribute('aria-hidden',String(!visible));}
    if(page.style.opacity!==String(opacity))page.style.opacity=String(opacity);
  }
  function childOpacity(index,opacity,excludePhoto=false){
    for(const child of children[index])if(!excludePhoto||!child.classList.contains('photo-wrap'))if(child.style.opacity!==String(opacity))child.style.opacity=String(opacity);
  }
  function resetPages(){
    pages.forEach((page,index)=>{pageOpacity(index,index===slide?1:0);for(const child of page.children)child.style.opacity='';});
    $('.repair-segment').style.opacity='';
  }
  function stopMotion(){cancelAnimationFrame(monitor);monitor=0;window.APEXTransition.pause();window.F1Cinematic.setPlayback(false);window.F1Sound?.stop();transition=null;pendingTarget=null;opening=false;}
  function budgetRect(){return cachedBudget||(cachedBudget={x:80,y:budget.offsetTop,width:repair.offsetWidth,height:budget.offsetHeight});}
  function markerLayout(state){
    const rect=budgetRect(),box=state.bounds,scale=110/box.width;
    return{x:rect.x+rect.width-55-box.x*scale,y:rect.y-8-(box.y+box.height)*scale,scale,angle:0};
  }
  function budgetLayout(state){
    const rect=budgetRect(),[left,right]=state.budgetProjection.top,angle=-Math.atan2(right.y-left.y,right.x-left.x),scale=budget.offsetWidth/Math.hypot(right.x-left.x,right.y-left.y);
    const a=Math.cos(angle)*scale,b=Math.sin(angle)*scale;
    return{x:rect.x-(a*left.x-b*left.y),y:rect.y-(b*left.x+a*left.y),scale,angle};
  }
  function showSlideInstant(index,preserveScene=false){
    stopMotion();window.__F1TransitionPose=null;if(!preserveScene)window.F1Cinematic.reset();activate(index);
    document.body.classList.remove('deck-opening','deck-transitioning');document.body.classList.add('deck-static');
    delete document.body.dataset.transitionKind;rootStyle.setProperty('--race-copy','1');
    rootStyle.setProperty('--copy','1');rootStyle.setProperty('--page-opacity','1');rootStyle.setProperty('--page-y','0px');
    resetPages();hideOverlays();$('#scene').style.opacity=slide===1?'0':'1';
    if(slide===0&&!preserveScene){window.F1Cinematic.renderGridOpening(window.F1Cinematic.openingDuration);setCarLayout(identityLayout);}
    if(slide===1){setCarLayout(identityLayout);photoVectorFrame(0,1);}
    if(slide===2&&!preserveScene){window.F1Cinematic.makeWheelTables(story.costs,story.durations.costs);const state=window.F1Cinematic.render(story.costs(story.durations.costs));setCarLayout(budgetLayout(state));}
    if(slide===3&&!preserveScene){window.F1Cinematic.makeWheelTables(story.regulation,story.durations.regulation);window.F1Cinematic.render(story.regulation(story.durations.regulation));setCarLayout(identityLayout);}
    if(slide===4&&!preserveScene){window.F1Cinematic.makeWheelTables(story.advantage,story.durations.advantage);const pose=story.advantage(story.durations.advantage);window.F1Cinematic.render(pose);setCarLayout(identityLayout);feedbackFrame(pose);}
    if(slide===5&&!preserveScene){window.F1Cinematic.makeWheelTables(story.competition,story.durations.competition);window.F1Cinematic.render(story.competition(story.durations.competition));setCarLayout(identityLayout);}
    if(slide===6&&!preserveScene){window.F1Cinematic.makeWheelTables(story.entry,story.durations.entry);const pose=story.entry(story.durations.entry);window.F1Cinematic.render(pose);setCarLayout(identityLayout);scene.style.opacity=String(pose.canvas);entryVectorFrame(1,1);}
    if(slide===7){if(!preserveScene){window.F1Cinematic.makeWheelTables(story.conclusion,story.durations.conclusion);window.F1Cinematic.render(story.conclusion(story.durations.conclusion));}conclusionFrame(story.conclusion(story.durations.conclusion));}
    if(slide===4&&preserveScene)feedbackFrame(story.advantage(story.durations.advantage));
    if(slide===6&&preserveScene){scene.style.opacity='0';entryVectorFrame(1,1);}
    if(slide===6)sharedEntryPhoto(0,1);
    window.F1Typography.settled();
    busy(false);
  }
  function alignPhoto(state){
    const image=photo.querySelector('img');
    const naturalWidth=image.naturalWidth||2048,naturalHeight=image.naturalHeight||1152;
    const scale=Math.max(photo.offsetWidth/naturalWidth,photo.offsetHeight/naturalHeight);
    const cropX=(photo.offsetWidth-naturalWidth*scale)*.5,cropY=(photo.offsetHeight-naturalHeight*scale)*.65;
    const targetFront={x:80+cropX+naturalWidth*(1480/2048)*scale,y:photo.offsetTop+cropY+naturalHeight*(747/1152)*scale};
    const targetRear={x:80+cropX+naturalWidth*(1794/2048)*scale,y:photo.offsetTop+cropY+naturalHeight*(754/1152)*scale};
    const front=state.anchors.filter(p=>p.front).sort((a,b)=>b.lateral-a.lateral)[0],rear=state.anchors.filter(p=>!p.front).sort((a,b)=>b.lateral-a.lateral)[0];
    const angle=Math.atan2(targetRear.y-targetFront.y,targetRear.x-targetFront.x)-Math.atan2(rear.y-front.y,rear.x-front.x);
    const factor=Math.hypot(targetRear.x-targetFront.x,targetRear.y-targetFront.y)/Math.hypot(rear.x-front.x,rear.y-front.y),a=Math.cos(angle)*factor,b=Math.sin(angle)*factor;
    const targetFarRear={x:80+cropX+naturalWidth*(1972/2048)*scale,y:photo.offsetTop+cropY+naturalHeight*(754/1152)*scale};
    return{x:targetFront.x-(a*front.x-b*front.y),y:targetFront.y-(b*front.x+a*front.y),scale:factor,angle,targets:{front:targetFront,rear:targetRear,farRear:targetFarRear}};
  }
  function calibratePhoto(){
    // Two near wheel centres can fit an incorrect camera. Solve the view with
    // the far rear wheel as well, then register scale, roll and principal point.
    const radius=20.80865;let angle=39.0214*Math.PI/180,height=.60656;
    const sample=(angle,height)=>{
      const view={forward:-radius*Math.cos(angle),left:radius*Math.sin(angle),height};
      story.configurePhoto({fov:32,roll:0,principal:[800,450],view});
      const state=window.F1Cinematic.render(story.overtake(story.freeze),null,true),layout=alignPhoto(state),far=state.anchors.find(p=>!p.front&&p.lateral<0);
      const a=Math.cos(layout.angle)*layout.scale,b=Math.sin(layout.angle)*layout.scale;
      return{layout,view,error:[a*far.x-b*far.y+layout.x-layout.targets.farRear.x,b*far.x+a*far.y+layout.y-layout.targets.farRear.y]};
    };
    for(let iteration=0;iteration<6;iteration++){
      const base=sample(angle,height);if(Math.hypot(...base.error)<.001)break;
      const da=.0005,dh=.005,az=sample(angle+da,height),el=sample(angle,height+dh);
      const j00=(az.error[0]-base.error[0])/da,j10=(az.error[1]-base.error[1])/da,j01=(el.error[0]-base.error[0])/dh,j11=(el.error[1]-base.error[1])/dh,det=j00*j11-j01*j10;
      if(Math.abs(det)<1e-8)break;
      angle=Math.max(.25,Math.min(1.3,angle-(j11*base.error[0]-j01*base.error[1])/det));
      height=Math.max(.06,Math.min(3,height-(-j10*base.error[0]+j00*base.error[1])/det));
    }
    const {layout,view}=sample(angle,height);
    const a=Math.cos(layout.angle)*layout.scale,b=Math.sin(layout.angle)*layout.scale;
    const camera={fov:2*Math.atan(Math.tan(32*Math.PI/360)/layout.scale)*180/Math.PI,roll:layout.angle,view,
      principal:[a*800-b*450+layout.x,b*800+a*450+layout.y]};
    story.configurePhoto(camera);
    const registered=window.F1Cinematic.render(story.overtake(story.freeze),null,true),nearFront=registered.anchors.find(p=>p.front&&p.lateral>0),nearRear=registered.anchors.find(p=>!p.front&&p.lateral>0),farRear=registered.anchors.find(p=>!p.front&&p.lateral<0);
    const errors={};for(const[key,point]of Object.entries({front:nearFront,rear:nearRear,farRear}))errors[key]=Math.hypot(point.x-layout.targets[key].x,point.y-layout.targets[key].y);
    photoLayout={...layout,projection:camera,errors};
    if(ready)preparePhotoVector();
  }
  function beginTransition(from,to){
    cancelAnimationFrame(monitor);monitor=0;window.APEXTransition.pause();opening=false;
    const kind=['overtake','costs','regulation','advantage','competition','entry','conclusion'][Math.min(from,to)],reverse=to<from;document.body.dataset.transitionKind=kind;document.body.dataset.conclusionCopy='0';
    transition={from,to,kind,reverse,id:++session,seconds:0,progress:0,playing:false,duration:story.durations[kind]};
    // Cinematic frames own their complete pose. Avoid drawing the legacy
    // finale between two pages and uploading the furniture buffers twice.
    window.F1Cinematic.makeWheelTables(story[kind],transition.duration);
    activate(from);hideOverlays();document.body.classList.remove('deck-opening','deck-static');document.body.classList.add('deck-transitioning');
    rootStyle.setProperty('--copy','1');rootStyle.setProperty('--page-opacity','1');rootStyle.setProperty('--page-y','0px');busy(true);
  }
  function overtakeFrame(pose,state){
    pageOpacity(0,pose.cover);childOpacity(0,1);pageOpacity(1,1);pageOpacity(2,0);pageOpacity(3,0);pageOpacity(4,0);
    childOpacity(1,pose.copy,true);photo.style.opacity=String(pose.photo);
    photoVectorFrame(pose.silhouette,pose.outline,pose.photoFit);
    const beginning=identityLayout;
    setCarLayout(beginning);scene.style.opacity=String(pose.canvas);
    const title=pose.seconds<1.6?'McLaren leads after the start.':pose.seconds<4.1?'Brake and turn into the corner.':pose.seconds<story.freeze?'Time slows to a complete stop.':pose.seconds<story.freeze+.3?'Hold the car in place.':'From the frozen car to its outline';if(captionTitle.textContent!==title)captionTitle.textContent=title;
    if(captionNote.textContent!=='ILLUSTRATIVE TRANSITION / NOT A RECONSTRUCTION')captionNote.textContent='ILLUSTRATIVE TRANSITION / NOT A RECONSTRUCTION';
    caption.style.opacity=String(story.ease(.65,1,pose.seconds)*(1-story.ease(story.freeze-.85,story.freeze-.35,pose.seconds)));activate(pose.seconds<story.freeze+1.6?0:1);
  }
  function costsFrame(pose,state){
    const t=pose.budgetSeconds;
    pageOpacity(0,0);pageOpacity(1,pose.photo>0?1:0);childOpacity(1,pose.news,true);photo.style.opacity=String(pose.photo);pageOpacity(2,1);pageOpacity(3,0);pageOpacity(4,0);childOpacity(2,pose.copy);photoVectorFrame(pose.bridgeFill,pose.bridgeOutline,pose.bridgeFit);
    // The registered 3D face is opaque at handover; reveal the identical DOM
    // bar beneath it before fading the mesh, avoiding a double-alpha dark dip.
    budget.style.opacity=String(pose.budgetHandoff);repair.style.opacity='1';
    setCarLayout(pose.projection>0?mixLayout(identityLayout,budgetLayout(state),pose.projection):identityLayout);scene.style.opacity=String(pose.canvas);
    const title=pose.seconds<7?'The damage has a cost.':t<2.8?'Separate costs add up.':t<3.8?'Combine the repair costs.':'One budget. Two uses.';if(captionTitle.textContent!==title)captionTitle.textContent=title;
    const note=t<2.8?'HYPOTHETICAL / FOUR EXTRA REPAIR COSTS':'$0.25m + $0.40m + $0.60m + $0.75m = $2m';if(captionNote.textContent!==note)captionNote.textContent=note;
    caption.style.opacity=String(story.ease(.8,1.25,pose.seconds)*(1-story.ease(5.0,5.5,t)));
    state.costTrail.posts.forEach((post,index)=>{const label=costLabels[index],value='+$'+(post.amount*post.growth).toFixed(2)+'m';if(label.textContent!==value)label.textContent=value;label.style.left=post.point.x+'px';label.style.top=(post.point.y-14)+'px';label.style.opacity=String(pose.labels*post.growth);});
    const label=costLabels[4],tip=state.costTrail.tip,value='TOTAL $'+state.costTrail.total.toFixed(2)+'m';
    if(label.textContent!==value)label.textContent=value;
    label.style.left=tip.x+'px';label.style.top=(tip.y-14)+'px';label.style.opacity=String(pose.labels*story.ease(.25,.7,t));
    budgetLabels.forEach((label,index)=>{const point=state.budgetProjection.labels[index];label.style.left=point.x+'px';label.style.top=(point.y-24)+'px';label.style.opacity=String(pose.budgetLabels);});
    // The horizontal 3D budget is flattened and registered to the DOM bar.
    // There is no pre-projected SVG taking over while the budget is still 3D.
    costMorph.style.opacity='0';activate(t<5.4?1:2);
  }
  function regulationFrame(pose,state){
    pageOpacity(0,0);pageOpacity(1,0);pageOpacity(2,pose.budget);childOpacity(2,1);budget.style.opacity='0';pageOpacity(3,1);pageOpacity(4,0);
    for(const child of children[3])child.style.opacity=String(child===regDiagram?story.ease(3.9,4.65,pose.seconds):pose.copy);
    const rect=budgetRect(),morph=pose.morph,y=story.mix(rect.y,380,morph),height=story.mix(rect.height,48,morph),width=story.mix(budget.offsetWidth,820,morph),fill=story.mix(rect.width,820,morph);
    const alpha=1-story.ease(3.9,4.65,pose.seconds);
    Object.assign(regFill.style,{left:'80px',top:y+'px',width:fill+'px',height:height+'px',opacity:String(alpha)});
    Object.assign(regRest.style,{left:(80+fill+5*(1-morph))+'px',top:y+'px',width:Math.max(0,width-fill)+'px',height:height+'px',opacity:String(alpha*(1-morph))});
    Object.assign(regGhost.style,{left:'900px',top:y+'px',width:(150*pose.excess)+'px',height:height+'px',opacity:String(alpha*pose.excess)});
    Object.assign(regLimit.style,{left:'900px',top:(y-39)+'px',opacity:String(alpha*pose.cap)});
    const marker=markerLayout(state);marker.x+=460*story.ease(.35,1.95,pose.seconds);
    setCarLayout(mixLayout(marker,identityLayout,story.ease(1.55,4.65,pose.seconds)));scene.style.opacity='1';
    if(captionTitle.textContent!=='The spending has a limit.')captionTitle.textContent='The spending has a limit.';
    if(captionNote.textContent!=='REGULATION / TEAMS STILL CHOOSE HOW TO ALLOCATE THEIR BUDGET')captionNote.textContent='REGULATION / TEAMS STILL CHOOSE HOW TO ALLOCATE THEIR BUDGET';
    caption.style.opacity=String(story.ease(.65,1.2,pose.seconds)*(1-story.ease(3.55,4.25,pose.seconds)));activate(pose.seconds<3.5?2:3);
  }
  function advantageFrame(pose,state){
    pageOpacity(0,0);pageOpacity(1,0);pageOpacity(2,0);pageOpacity(3,pose.previous);childOpacity(3,1);pageOpacity(4,1);childOpacity(4,pose.copy);
    feedbackFrame(pose);setCarLayout(identityLayout);scene.style.opacity='1';activate(pose.seconds<1.2?3:4);
  }
  function competitionFrame(pose,state){
    for(let index=0;index<4;index++)pageOpacity(index,0);pageOpacity(4,pose.previous);childOpacity(4,1);pageOpacity(5,1);childOpacity(5,pose.copy);
    feedbackFrame(story.advantage(story.durations.advantage));
    competitionBenefits.forEach((element,index)=>element.style.opacity=String(pose.benefits[index]));competitionConditions.style.opacity=String(pose.conditions);
    setCarLayout(identityLayout);scene.style.opacity='1';rootStyle.setProperty('--race-copy',String(pose.copy));
    const title=pose.seconds<2.35?'Red Bull picks up the slipstream.':pose.seconds<3.9?'McLaren moves left to defend.':pose.seconds<5?'Red Bull edges ahead.':pose.seconds<6.5?'McLaren brakes too late.':pose.seconds<8.5?'The apex slips away. McLaren runs wide.':pose.seconds<12.4?'Red Bull takes the better exit.':'Red Bull / the better exit.';if(captionTitle.textContent!==title)captionTitle.textContent=title;
    const note='ILLUSTRATIVE RACING / NOT A MEASURED EFFECT OF THE COST CAP';if(captionNote.textContent!==note)captionNote.textContent=note;
    caption.style.opacity=String(story.ease(.8,1.2,pose.seconds)*(1-story.ease(11.1,11.6,pose.seconds)));
    raceStatus.style.opacity=String(pose.raceStatus);racePhase.textContent=pose.racingPhase;raceSpeed.textContent=String(Math.round(pose.raceSpeed));redSpeed.textContent=String(Math.round(pose.redSpeed));raceBar.style.transform=`scaleX(${Math.min(1,pose.raceSpeed/270)})`;
    activate(pose.seconds<12.5?4:5);
  }
  function entryFrame(pose,state){
    for(let index=0;index<5;index++)pageOpacity(index,0);pageOpacity(5,pose.previous);childOpacity(5,1);pageOpacity(6,1);childOpacity(6,pose.copy);
    sharedEntryPhoto(0,pose.photo);entryBarriers.forEach((element,index)=>element.style.opacity=String(pose.barriers[index]));entryTakeaway.style.opacity=String(pose.takeaway);
    entryVectorFrame(pose.outline,pose.gridLabels,pose.photoFit,pose.silhouette);
    const teamNames={redbull:'Red Bull',mclaren:'McLaren',ferrari:'Ferrari',mercedes:'Mercedes',aston:'Aston Martin',williams:'Williams',haas:'Haas',audi:'Audi',alpine:'Alpine',racingbulls:'Racing Bulls',cadillac:'Cadillac'};
    const row=Math.min(9,Math.round(pose.inspectionGrid.row)),team=story.gridOrder[row];
    captionTitle.textContent=pose.seconds<24?'':pose.seconds<story.entryFreeze?'Cadillac joins the eleventh row':'From Cadillac to the photograph';
    captionNote.textContent=pose.seconds<24?'ONE TEAM PER ROW / STAGGERED CARS / ILLUSTRATIVE ORDER':'CADILLAC CONCEPT / ILLUSTRATIVE ARRIVAL';caption.style.opacity=pose.seconds<story.entryFreeze-.5?'0':String(story.ease(1.2,2.4,pose.seconds)*(1-story.ease(story.entryFreeze-.85,story.entryFreeze,pose.seconds)));
    setCarLayout(identityLayout);scene.style.opacity=String(pose.canvas);activate(pose.seconds<2.6?5:6);
  }

  function conclusionFrame(pose){
    document.body.dataset.conclusionCopy=pose.seconds>=20.5?'1':'0';
    for(let k=0;k<pages.length;k++)pageOpacity(k,k===7?1:k===6?pose.previous:0);
    childOpacity(6,pose.previous,true);childOpacity(7,pose.title);
    $('.conclusion-reason').style.opacity=String(pose.reason);$('.conclusion-limitation').style.opacity=String(pose.limitation);
    pages[7].querySelector('.source-line').style.opacity=String(pose.limitation);
    sharedEntryPhoto(0,pose.photo);entryVectorFrame(pose.outline,0,pose.outlineFit,0);
    const state=window.F1Cinematic.getState(),view=pose.camera.target.map((v,i)=>v-pose.camera.position[i]);
    const visible=key=>{const actor=pose[key],box=state.actorBounds[key];if(!actor||!box||actor.position.reduce((sum,v,i)=>sum+(v-pose.camera.position[i])*view[i],0)<=0)return false;const area=Math.max(0,Math.min(1600,box.x+box.width)-Math.max(0,box.x))*Math.max(0,Math.min(900,box.y+box.height)-Math.max(0,box.y));return area/Math.max(1,box.width*box.height)>=.65;};
    const names={cadillac:'Cadillac',alpine:'Alpine',racingbulls:'Racing Bulls',haas:'Haas',mclaren:'McLaren',ferrari:'Ferrari',mercedes:'Mercedes',redbull:'Red Bull'},shown=Object.keys(names).filter(visible);
    const title=shown.map(key=>names[key]).join(' / ');if(captionTitle.textContent!==title)captionTitle.textContent=title;captionNote.textContent='ILLUSTRATIVE GROUP / NOT A STANDINGS ORDER';
    caption.style.opacity=shown.length?String(story.ease(.8,1.25,pose.seconds)*(1-story.ease(19.5,20.5,pose.seconds))):'0';
    setCarLayout(identityLayout);scene.style.opacity=String(pose.canvas);activate(pose.seconds<.8?6:7);
  }
  function transitionFrame(seconds){
    if(!transition)return;const phase=transition;phase.seconds=Math.max(0,Math.min(phase.duration,seconds));phase.progress=phase.seconds/phase.duration;
    const time=phase.reverse?phase.duration-phase.seconds:phase.seconds,pose=story[phase.kind](time),previous=story[phase.kind](Math.max(0,time-.012)).camera;
    const state=window.F1Cinematic.render(pose,previous);for(let i=0;i<pages.length;i++)if(i!==phase.from&&i!==phase.to)pageOpacity(i,0);if(phase.kind==='overtake')overtakeFrame(pose,state);else if(phase.kind==='costs')costsFrame(pose,state);else if(phase.kind==='regulation')regulationFrame(pose,state);else if(phase.kind==='advantage')advantageFrame(pose,state);else if(phase.kind==='competition')competitionFrame(pose,state);else if(phase.kind==='entry')entryFrame(pose,state);else conclusionFrame(pose);
    window.F1Typography.frame(phase.kind,pose);
    window.F1Sound?.frame(pose,phase.playing&&!phase.reverse);
    if(phase.progress===1){const next=pendingTarget;showSlideInstant(phase.to,true);pendingTarget=next;document.dispatchEvent(new CustomEvent('f1-slide-settled',{detail:{index:slide}}));}
  }
  function runTransition(from,to){
    const adjacent=from+(to>from?1:-1);pendingTarget=to!==adjacent?to:null;beginTransition(from,adjacent);transition.playing=true;window.F1Cinematic.setPlayback(true);transitionFrame(0);
    const started=performance.now();const tick=now=>{window.F1Cinematic.sampleFrame(now);transitionFrame((now-started)/1000);if(transition)monitor=requestAnimationFrame(tick);else{const next=pendingTarget;pendingTarget=null;if(next!==null&&next!==slide)runTransition(slide,next);}};monitor=requestAnimationFrame(tick);
  }
  function goToSlide(index,options={}){
    if(!ready||awaitingStart||!Number.isFinite(index))return;const target=targetIndex(index);
    if(options.instant||reducedMotion.matches||editing){showSlideInstant(target);return;}
    if(transition){pendingTarget=target===transition.to?null:target;return;}
    if(opening)showSlideInstant(0);if(target!==slide)runTransition(slide,target);
  }
  function seekTransition(from,to,seconds){
    if(!ready||awaitingStart||![from,to,seconds].every(Number.isFinite))return;from=targetIndex(from);to=targetIndex(to);cancelAnimationFrame(monitor);monitor=0;pendingTarget=null;window.F1Cinematic.setPlayback(false);
    window.F1Sound?.stop();if(from===to){showSlideInstant(to);return;}if(Math.abs(from-to)!==1)throw new Error('Seek adjacent acts separately.');
    if(!transition||transition.from!==from||transition.to!==to||seconds<transition.seconds){showSlideInstant(from);beginTransition(from,to);}transition.playing=false;transitionFrame(seconds);
  }
  function openingFrame(seconds,playing=false){
    if(!opening){transition=null;pendingTarget=null;activate(0);resetPages();hideOverlays();opening=true;busy(true);window.__F1TransitionPose=null;
      document.body.classList.remove('deck-static','deck-transitioning');document.body.classList.add('deck-opening');scene.style.opacity='1';setCarLayout(identityLayout);$('#telemetry').style.display='none';}
    openingSeconds=seconds;const state=window.F1Cinematic.renderGridOpening(seconds);rootStyle.setProperty('--copy',String(state.copy));window.F1Typography.opening(seconds,state);
    window.F1Sound?.frame(state,playing);
  }
  function seekOpening(seconds){
    if(!ready||awaitingStart||!Number.isFinite(seconds))return;stopMotion();window.F1Cinematic.reset();openingFrame(Math.max(0,Math.min(window.F1Cinematic.openingDuration,seconds)));if(seconds>=window.F1Cinematic.openingDuration)showSlideInstant(0);
  }
  function replayOpening(){
    if(!ready||awaitingStart)return;if(reducedMotion.matches){showSlideInstant(0);return;}stopMotion();window.F1Cinematic.reset();window.F1Cinematic.setPlayback(true);openingFrame(0,true);const started=performance.now();
    const tick=now=>{window.F1Cinematic.sampleFrame(now);const seconds=Math.min(window.F1Cinematic.openingDuration,(now-started)/1000);openingFrame(seconds,true);if(seconds>=window.F1Cinematic.openingDuration){showSlideInstant(0);return;}monitor=requestAnimationFrame(tick);};monitor=requestAnimationFrame(tick);
  }
  function refresh(){if(!ready)return;if(awaitingStart){window.F1Cinematic.renderGridOpening(0);return;}cachedBudget=null;budgetRect();if(editing)calibratePhoto();if(transition)transitionFrame(transition.seconds);else if(!opening)showSlideInstant(slide);}
  function showNotes(){
    if(transition)return;if(opening)showSlideInstant(0);const note=content.notes[slide];if(!note)return;
    $('#notes-title').textContent=note.title;$('#notes-body').replaceChildren();const p=document.createElement('p');p.textContent=note.body;$('#notes-body').append(p);
    for(const source of note.sources){const line=document.createElement('p'),link=document.createElement('a');link.href=source.url;link.textContent=source.label;link.target='_blank';link.rel='noopener';line.append(link);$('#notes-body').append(line);}$('#notes-dialog').showModal();
  }
  function toggleEditing(){
    if(transition)return;if(opening)showSlideInstant(0);editing=!editing;window.F1Typography.setEditing(editing);document.body.classList.toggle('deck-editing',editing);if($('#edit-deck'))$('#edit-deck').textContent=editing?'Done E':'Edit E';document.querySelectorAll('[data-copy]').forEach(element=>{element.contentEditable=String(editing);element.spellcheck=false;});
  }
  function saveDeck(){
    const text={},photos={};document.querySelectorAll('[data-copy]').forEach(element=>text[element.dataset.copy]=window.F1Typography.serialize(element));document.querySelectorAll('[data-photo]').forEach(element=>photos[element.dataset.photo]=element.querySelector('img').src);
    const root=pristine.cloneNode(true);root.querySelector('#deck-data').textContent=JSON.stringify({text,photos,livery:'redbull'}).replace(/</g,'\\u003c');root.querySelector('#page-data').textContent=JSON.stringify({text:{},image:null,livery:'redbull'});
    const url=URL.createObjectURL(new Blob(['<!doctype html>\n'+root.outerHTML],{type:'text/html;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='F1-Economics-Final.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);dirty=false;
  }
  async function startDeck(){
    if(!ready||!awaitingStart||starting)return;
    starting=true;$('#start-deck').disabled=true;$('#start-deck').setAttribute('aria-busy','true');$('#start-deck .launch-button-label').textContent='Starting…';
    // Unlock recorded audio inside the same user gesture as fullscreen.
    void window.F1Sound?.unlock();
    // Request within the original click/keyboard gesture, before yielding.
    try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.({navigationUI:'hide'});}
    catch(error){console.info('Fullscreen is unavailable in this browser; playing in the current window.',error.name);}
    // Settle the viewport and renderer before starting the animation clock.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    awaitingStart=false;starting=false;const gate=$('#start-gate');gate.classList.add('is-leaving');if(reducedMotion.matches)gate.hidden=true;else setTimeout(()=>gate.hidden=true,320);document.body.classList.remove('deck-await-start');
    if(reducedMotion.matches)showSlideInstant(0);else replayOpening();
  }
  $('#start-deck').onclick=startDeck;
  $('#close-notes').onclick=()=>$('#notes-dialog').close();
  $('#next-slide').onclick=()=>goToSlide(logicalIndex()+1);$('#previous-slide').onclick=()=>goToSlide(logicalIndex()-1);
  document.querySelectorAll('[data-photo]').forEach(element=>element.addEventListener('click',()=>{if(editing){photoTarget=element;$('#deck-photo-input').click();}}));
  $('#deck-photo-input').onchange=()=>{const file=$('#deck-photo-input').files[0];if(!file||!photoTarget)return;const target=photoTarget,reader=new FileReader();reader.onload=()=>{const image=target.querySelector('img');image.onload=()=>{if(target===photo)calibratePhoto();if(target===entryPhoto){calibrateEntryPhoto();prepareEntryVectors();}if(ready)showSlideInstant(slide);};image.src=reader.result;dirty=true;};reader.readAsDataURL(file);};
  document.addEventListener('keydown',event=>{
    if(event.target.isContentEditable||event.target.closest('input,select,textarea')||$('#notes-dialog').open)return;const key=event.key.toLowerCase();
    if(key==='m'){event.preventDefault();window.F1Sound?.toggle();return;}
    if(awaitingStart){if(ready&&(key==='enter'||key===' ')){event.preventDefault();startDeck();}return;}
    if(['arrowright','arrowleft',' ','r','n','e'].includes(key)){event.preventDefault();event.stopImmediatePropagation();}
    if(key==='arrowright'||key===' ')goToSlide(logicalIndex()+1);else if(key==='arrowleft')goToSlide(logicalIndex()-1);else if(key==='r')replayOpening();else if(key==='n')showNotes();else if(key==='e')toggleEditing();
  },true);
  let touchStart=null;
  $('#stage').addEventListener('touchstart',event=>{if(editing||event.target.closest('button,input,select'))return;touchStart=[event.changedTouches[0].clientX,event.changedTouches[0].clientY];},{passive:true});
  $('#stage').addEventListener('touchend',event=>{if(!touchStart)return;const point=event.changedTouches[0],dx=point.clientX-touchStart[0],dy=point.clientY-touchStart[1];touchStart=null;if(Math.abs(dx)>70&&Math.abs(dy)<50)goToSlide(logicalIndex()+(dx<0?1:-1));},{passive:true});
  document.addEventListener('fullscreenchange',refresh);window.addEventListener('resize',refresh);window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
  window.F1Briefing=Object.freeze({version:'Final-P42',slideCount:pages.length,durations:story.durations,goToSlide,transitionTo:goToSlide,replayOpening,seekOpening,seekTransition,showNotes,refresh,
    getState(){return{slide,editing,opening,openingSeconds,ready,awaitingStart,transitioning:!!transition,transition:transition?{...transition}:null,pendingTarget,animation:window.APEXTransition?.getState(),cinematic:window.F1Cinematic?.getState(),photoLayout};}});
  async function waitReady(){
    if(!window.APEXTransition||$('#scene').dataset.wheels!=='4'||!$('#loading').classList.contains('loaded')){requestAnimationFrame(waitReady);return;}
    try{
      $('#loading').classList.remove('loaded');$('#loading').textContent='Preparing cars, circuit and shaders…';
      await window.F1Typography.prepare();
      window.F1Boot?.update(8,'读取赛车与赛道');await window.F1Boot?.tick();await window.F1Cinematic.prepare();window.F1Boot?.update(74,'配准新闻照片');await window.F1Boot?.tick();story.setup(window.F1Cinematic.openingEnd(),window.F1Cinematic.circuit(),window.F1Cinematic.wheelInfo());
      const metrics=budgetRect();window.F1Cinematic.configureBudget({width:budget.offsetWidth,repairWidth:metrics.width,height:metrics.height,gap:parseFloat(getComputedStyle(budget).columnGap)||0});
      calibratePhoto();calibrateEntryPhoto();costReference=window.F1Cinematic.render(story.costs(9.8),null,true);
      await window.F1Cinematic.warmup(story);await window.F1Typography.prepareBackdrops(story);window.F1Boot?.update(96,'完成照片与轮廓配准');await window.F1Boot?.tick();preparePhotoVector();prepareEntryVectors();await window.F1Sound?.prepare();$('#loading').classList.add('loaded');ready=true;
      stopMotion();window.F1Cinematic.reset();openingFrame(0);opening=false;awaitingStart=true;document.body.classList.add('deck-await-start');$('#start-gate').hidden=false;for(const id of['previous-slide','next-slide'])$('#'+id).disabled=true;$('#start-deck').focus();
      // Reveal the first complete frame after the visible preparation stages.
      requestAnimationFrame(()=>{document.body.classList.remove('deck-boot');window.F1Boot?.finish();});
    }
    catch(error){window.F1Boot?.fail(error);$('#loading').dataset.error=String(error.stack||error);console.error(error);document.body.classList.remove('deck-boot');document.body.classList.add('deck-boot-failed');$('#loading').classList.remove('loaded');$('#loading').textContent='Unable to load story cars. Reload to try again.';}
  }requestAnimationFrame(waitReady);
})();
