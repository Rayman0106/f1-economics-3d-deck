from pathlib import Path
import argparse, base64, hashlib, json, re

parser=argparse.ArgumentParser()
parser.add_argument('--base',default='F1-Economics-P05.html')
parser.add_argument('--output',default='F1-Economics-P05.html')
args=parser.parse_args()
here=Path(__file__).resolve().parent
html=Path(args.base).read_text()
html=re.sub(r'\n?<!-- BRIEFING_CSS_START -->[\s\S]*?<!-- BRIEFING_CSS_END -->\n?','',html)
html=re.sub(r'\n?<!-- BRIEFING_HTML_START -->[\s\S]*?<!-- BRIEFING_HTML_END -->\n?','',html)
html=re.sub(r'\n?<!-- BRIEFING_JS_START -->[\s\S]*?<!-- BRIEFING_JS_END -->\n?','',html)
html=re.sub(r'/\* CINEMATIC_ENGINE_START \*/[\s\S]*?/\* CINEMATIC_ENGINE_END \*/','',html)
html=re.sub(r'/\* F1_METAL_START \*/[\s\S]*?/\* F1_METAL_END \*/\n?','',html)
start=html.index('function m0(');end=html.index('function g0(',start)
html=html[:start]+(here/'camera-v10.js').read_text()+'\n'+html[end:]
start=html.index('function g0(');end=html.index('function b0(',start)
html=html[:start]+(here/'track-v10.js').read_text()+'\n'+html[end:]
start=html.index('function b0(');end=html.index('(()=>{"use strict";let s=U=>document.querySelector(U)',start)
html=html[:start]+(here/'blur-v10.js').read_text()+'\n'+html[end:]
html=html.replace('function p0(', '/* F1_METAL_START */\n'+(here/'material-v10.js').read_text()+'\nconst f1WheelMeasurements='+ (here/'wheel-calibration.json').read_text()+';\nfunction f1CalibrateWheel(root,wheel){let key;root.traverse(n=>{if(n.userData.assetSource)key=n.userData.assetSource;});const data=f1WheelMeasurements[key]?.[wheel.name];if(data)Object.assign(wheel.userData,data);}'+'\n/* F1_METAL_END */\nfunction p0(',1)
# Replace only the native wheel's texture shutter; leave GLBs and wheel pivots
# untouched. Shoulder/tread UV seams must never become an angular blur path.
wheel_start=html.index('function p0(');wheel_end=html.index('function u(f)',wheel_start)
wheel=html[wheel_start:wheel_end]
wheel=wheel.replace('varying vec3 vWheelPosition;', 'varying vec3 vWheelPosition;\nvarying vec3 vWheelNormal;')
wheel=wheel.replace('vWheelPosition=(wheelLocalFromMesh*vec4(position,1.0)).xyz;', 'vWheelPosition=(wheelLocalFromMesh*vec4(position,1.0)).xyz;\nvWheelNormal=normalize(mat3(wheelLocalFromMesh)*normal);')
wheel=re.sub(r'`#ifdef USE_MAP[\s\S]*?#endif`',lambda m:'`'+(here/'wheel-blur-v12.glsl').read_text()+'`',wheel,count=1)
wheel=wheel.replace('let p=new s.Box3().setFromObject(g,!0)', 'f1CalibrateWheel(f,g);let p=new s.Box3().setFromObject(g,!0)')
wheel=wheel.replace('f1-wheel-angular-blur-v1','f1-wheel-circular-sidewall-v12')
if 'conditioning>0.12' not in wheel:raise RuntimeError('Unexpected wheel shutter hook')
html=html[:wheel_start]+wheel+html[wheel_end:]
html=html.replace('let p=new s.Box3().setFromObject(g,!0)', 'f1CalibrateWheel(f,g);let p=new s.Box3().setFromObject(g,!0)',1)
metal_old='try{_=d(p)}';metal_new='try{f1FixMetalMaterials(s,p,n);_=d(p)}'
html=html.replace('try{f1FixMetalMaterials(s,p);_=d(p)}',metal_new,1)
if metal_old in html:html=html.replace(metal_old,metal_new,1)
elif metal_new not in html:raise RuntimeError('Unexpected GLB preparation hook')
ratio_old='let be=E?Math.min(Math.max(window.devicePixelRatio||1,1.5),2):Math.min(window.devicePixelRatio||1,1.3);'
ratio_new='let be=window.F1Cinematic?.pixelRatio()||Math.min(window.devicePixelRatio||1,1.3);'
if ratio_old in html:html=html.replace(ratio_old,ratio_new,1)
elif ratio_new not in html:raise RuntimeError('Unexpected pixel-ratio hook')
viewport_old='function Z(){let U=Math.min(window.innerWidth/1600,window.innerHeight/900);'
viewport_new='function Z(){let U=Math.min((window.visualViewport?.width||window.innerWidth)/1600,(window.visualViewport?.height||window.innerHeight)/900);'
if viewport_old in html:html=html.replace(viewport_old,viewport_new,1)
elif viewport_new not in html:raise RuntimeError('Unexpected stage-resize hook')
resize_hook='window.addEventListener("resize",Z)'
visual_old='window.visualViewport?.addEventListener("resize",Z),'+resize_hook
visual_hook='window.visualViewport?.addEventListener("resize",()=>{Z();window.F1Briefing?.refresh()}),'+resize_hook
html=html.replace(visual_old,visual_hook,1)
if visual_hook not in html:
 if resize_hook not in html:raise RuntimeError('Unexpected resize listener')
 html=html.replace(resize_hook,visual_hook,1)
for old,new in [('F(1,.61,he),He=F(0,325,he),N=F(0,120,he)','F(1,.72,he),He=F(0,365,he),N=F(0,110,he)'),('1-z((U-.81)/.16)','1-z((U-.79)/.065)'),('1-z((U-.79)/.13)','1-z((U-.79)/.065)')]:
 if old in html:html=html.replace(old,new)
 elif new not in html:raise RuntimeError('Unexpected baseline render code: '+old)
# Yield before decoding and between 1 MiB chunks so the early loading overlay paints.
old_reader='function ve(U){let be=s("#asset-"+U).textContent.trim(),he=atob(be),Ee=new Uint8Array(he.length);for(let Pe=0;Pe<he.length;Pe++)Ee[Pe]=he.charCodeAt(Pe);return Ee.buffer}'
new_reader='async function ve(U){await window.F1Boot?.tick();const node=s("#asset-"+U);if(node.dataset.src){const response=await fetch(node.dataset.src);if(!response.ok)throw new Error("Asset "+U+": "+response.status);const buffer=await response.arrayBuffer();window.F1Boot?.decoded(U,buffer.byteLength);return buffer;}const be=node.textContent.trim(),size=be.length/4*3-(be.endsWith("==")?2:be.endsWith("=")?1:0),Ee=new Uint8Array(size);let cursor=0;for(let k=0;k<be.length;k+=1048576){const chunk=atob(be.slice(k,k+1048576));for(let j=0;j<chunk.length;j++)Ee[cursor++]=chunk.charCodeAt(j);if(k%4194304===0)await window.F1Boot?.tick();}window.F1Boot?.decoded(U,Ee.byteLength);return Ee.buffer;}'
if old_reader not in html:raise RuntimeError('Unexpected embedded asset reader')
html=html.replace(old_reader,new_reader,1)
html=html.replace('try{f1FixMetalMaterials(s,p,n);_=d(p)}','try{f1FixMetalMaterials(s,p,n);_=d(p);window.F1Boot?.parsed(f)}',1)
engine_patches=[
 ('function Be(U){if(!p)return;U=V(U),S=U;let be',
  'function Be(U){if(!p)return;U=V(U),S=U;const pagePose=window.__F1TransitionPose;let be'),
 ('le.rolling.rotation.z=E?0:we/le.radius,le.steer.rotation.y=E||!le.front?0:fa.clamp(Math.atan(m*W/(1-le.lateralOffset*W)),-.35,.35);',
  'if(pagePose?.active){if(le.pageSession!==pagePose.id){le.pageSession=pagePose.id;le.pageBaseRotation=le.rolling.rotation.z;le.pageInitialDistance=we;le.pageSteerStart=le.steer.rotation.y}le.rolling.rotation.z=le.pageBaseRotation+(we-le.pageInitialDistance)/le.radius}else le.rolling.rotation.z=E?0:we/le.radius;let wheelSteer=E||!le.front?0:fa.clamp(Math.atan(m*W/(1-le.lateralOffset*W)),-.35,.35);le.steer.rotation.y=pagePose?.active?F(le.pageSteerStart,wheelSteer,z(Math.min(1,pagePose.progress/.22))):wheelSteer;'),
 ('le.setBlur(E?0:Math.min(.38,ce/100))',
  'le.setBlur(E?0:Math.min(.38,ce/100)*(pagePose?.active?pagePose.motion:1))'),
 ('J.visible=!E&&U<.97,T.visible=!!E',
  'J.visible=!E&&(pagePose?.active?pagePose.track>.001:U<.97),T.visible=!!E'),
 ('let me=1-z((U-.79)/.065);Y.fade(me);',
  'let me=pagePose?.active?pagePose.track:1-z((U-.72)/.06);Y.fade(me);'),
 ('Fe.render(U,!E&&U<.94&&ge>8)',
  'Fe.render(U,!E&&U<.94&&ge>8&&(!pagePose?.active||pagePose.motion>.03))'),
 ('steering:u.map(U=>U.steer.rotation.y),wheels:u.length',
  'steering:u.map(U=>U.steer.rotation.y),wheelAngles:u.map(U=>U.rolling.rotation.z),wheels:u.length'),
]
for old,new in engine_patches:
 if new in html:continue
 if html.count(old)!=1:raise RuntimeError('Unexpected engine baseline: '+old)
 html=html.replace(old,new,1)
framing_hook='window.F1Cinematic?.frameOpening(Ee,!E),'
if framing_hook not in html:
 html=html.replace('Fe.render(U,!E&&',framing_hook+'Fe.render(U,!E&&',1)
html=re.sub(r'<html lang="[^"]*">','<html lang="en">',html,count=1)
html=re.sub(r'<title>[^<]*</title>','<title>F1 Economics / P05 / Continuous Costs + Regulation</title>',html,count=1)
html=re.sub(r'(<meta name="apex-version" content=")[^"]*(")',r'\g<1>briefing-p05-four-acts-20261001\2',html,count=1)
launch_ui=(here/'boot-progress.html').read_text().replace('{{LAUNCH_CSS}}',(here/'launch-screen.css').read_text())
html=re.sub(r'<body[^>]*>','<body class="deck-boot">'+launch_ui,html,count=1)
html=re.sub(r'(<script id="page-data"[^>]*>)[\s\S]*?(</script>)',lambda m:m[1]+json.dumps({'text':{},'image':None,'livery':'redbull'})+m[2],html,count=1)
extension='/* CINEMATIC_ENGINE_START */\n(()=>{\n'+(here/'environment-v10.js').read_text()+'\n'+(here/'world-dissolve.js').read_text()+'\n'+(here/'complete-rear-wing.js').read_text()+'\n'+(here/'story-route.js').read_text()+'\n'+(here/'gemini-start-gantry.js').read_text()+'\n'+(here/'finish-stage.js').read_text()+'\n'+(here/'opening-grid.js').read_text()+'\n'+(here/'research-stage.js').read_text()+'\n'+(here/'cinematic-engine.js').read_text()+'\n})();\n/* CINEMATIC_ENGINE_END */'
html=html.replace('window.APEXTransition=Object.freeze(',extension+'window.APEXTransition=Object.freeze(',1)
font_css=(here/'type-fonts.css').read_text()
for font in (here/'fonts').glob('*.woff'):
 font_css=font_css.replace("fonts/"+font.name,'data:font/woff;base64,'+base64.b64encode(font.read_bytes()).decode('ascii'))
css='\n<!-- BRIEFING_CSS_START -->\n<style id="briefing-style">\n'+font_css+(here/'deck.css').read_text()+'\n'+(here/'typography.css').read_text()+'\n</style>\n<!-- BRIEFING_CSS_END -->\n'
html=html.replace('</head>',css+'</head>',1)
font_licenses=(here.parent/'docs/Font-Licenses.txt').read_text(encoding='utf-8').replace('</script','<\\/script')
html=html.replace('</body>','<script id="font-licenses" type="text/plain">'+font_licenses+'</script>\n</body>',1)
photo='data:image/webp;base64,'+base64.b64encode((here/'baku-news-photo.webp').read_bytes()).decode()
slides=(here/'slides.html').read_text().replace('{{BAKU_PHOTO}}',photo)
cadillac='data:image/webp;base64,'+base64.b64encode((here/'cadillac-news-photo.webp').read_bytes()).decode()
slides=slides.replace('{{CADILLAC_PHOTO}}',cadillac)
html=html.replace('<div id="stage">','<div id="stage">\n<!-- BRIEFING_HTML_START -->\n'+slides+'\n<!-- BRIEFING_HTML_END -->\n',1)
story_path=here/'story-scenes.js'
story=story_path.read_text() if story_path.exists() else ''
type_script=(here/'typography.js').read_text().replace('{{TYPE_TEAMS_JSON}}',(here/'type-teams.json').read_text()).replace('{{TYPE_LOGOS_JSON}}',(here/'type-logos.json').read_text())
sound_assets=here.parent/'assets/audio'
sound_manifest=json.loads((sound_assets/'manifest.json').read_text(encoding='utf-8'))
sound_tags='<script id="sound-manifest" type="application/json">'+json.dumps(sound_manifest,ensure_ascii=False).replace('<','\\u003c')+'</script>\n'
sound_license=(here.parent/'docs/Engine-Synthesis-License.txt').read_text(encoding='utf-8').replace('</script','<\\/script')
sound_tags+='<script id="engine-synthesis-license" type="text/plain">'+sound_license+'</script>\n'
for clip in sound_manifest['clips']:
 sound_file=sound_assets/clip['file']
 if hashlib.sha256(sound_file.read_bytes()).hexdigest()!=clip['sha256']:raise RuntimeError('Audio asset changed: '+clip['key'])
 sound_tags+='<script id="sound-'+clip['key']+'" type="application/octet-stream">'+base64.b64encode(sound_file.read_bytes()).decode('ascii')+'</script>\n'
html=html.replace('</body>',sound_tags+'</body>',1)
script=story+'\n'+type_script+'\n'+(here/'engine-synth.js').read_text()+'\n'+(here/'powertrain.js').read_text()+'\n'+(here/'sound.js').read_text()+'\n'+(here/'deck.js').read_text().replace('{{CONTENT_JSON}}',(here/'content.json').read_text())
html=html.replace('</body>','\n<!-- BRIEFING_JS_START -->\n<script id="briefing-script">\n'+script+'\n</script>\n<!-- BRIEFING_JS_END -->\n</body>',1)
target=Path(args.output);target.write_text(html)
print(json.dumps({'file':str(target),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}))
