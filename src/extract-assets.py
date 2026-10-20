from pathlib import Path
import argparse, base64, hashlib, json, re
p=argparse.ArgumentParser();p.add_argument('html');p.add_argument('--output',default='extracted-assets');a=p.parse_args()
s=Path(a.html).read_text();out=Path(a.output);out.mkdir(parents=True,exist_ok=True);manifest=[]
for team in ['ferrari','mclaren','mercedes','redbull']:
 m=re.search(r'<script id="asset-'+team+r'"[^>]*>([\s\S]*?)</script>',s)
 if not m:raise RuntimeError('Missing '+team)
 data=base64.b64decode(m[1].strip());target=out/(team+'.glb')
 if target.exists() and target.read_bytes()!=data:raise RuntimeError('Refusing to replace different asset: '+str(target))
 target.write_bytes(data);manifest.append({'file':target.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
scripts=list(re.finditer(r'<script([^>]*)>([\s\S]*?)</script>',s))
for i,m in enumerate(scripts):
 if len(m[2])>500000 and 'application/octet-stream' not in m[1]:
  (out/'f1-engine.js').write_text(m[2]);break
(out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest))
