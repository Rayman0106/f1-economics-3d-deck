"""Build the local 13-asset viewer with the project's bundled Three.js."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def build():
    sources=json.loads((ROOT/'assets/asset-sources.json').read_text(encoding='utf-8'))['assets'];rows=[]
    for a in sources:
        record=dict(a['adaptation']);record.update(id=a['id'],source=a['source'],author=a['author'],license=a['license'],kind='track' if a['id'] in ['monza-2020','spa-2022'] else 'car')
        evidence=json.loads((ROOT/'docs/evidence/P22'/f'{a["id"]}-adaptation.json').read_text(encoding='utf-8'))
        if 'focus_bounds' in evidence:record['focus_bounds']=evidence['focus_bounds']
        rows.append(record)
    seed=(ROOT/'seed/engine-shell.html').read_text(encoding='utf-8');start=seed.index('<script>')+len('<script>');end=seed.index('(()=>{"use strict";let s=U=>document.querySelector(U)')
    bundled=seed[start:end]+'\n'+(ROOT/'src/material-v10.js').read_text(encoding='utf-8')
    markup='''<!doctype html><html lang="zh"><meta charset="utf-8"><title>F1 2026 · 本地资产库</title><style>*{box-sizing:border-box}body{margin:0;background:#13232d;color:#ecf0f1;font:14px Arial,"Microsoft YaHei";overflow:hidden}header{position:absolute;top:0;left:0;right:0;padding:16px 24px;background:#13232dee;display:flex;align-items:center;gap:14px;z-index:2}h1{margin:0;font-size:20px}select,button{padding:8px;background:#294250;border:1px solid #67818d;color:white;border-radius:3px}select{min-width:230px}button:focus-visible,select:focus-visible{outline:2px solid #ff8708}canvas{width:100vw;height:100vh;display:block}aside{position:absolute;left:24px;bottom:22px;max-width:770px;line-height:1.7;background:#13232dee;padding:12px 18px;z-index:2}a{color:#a1d6ff}#status{color:#ffb05e}#info{white-space:pre-line;color:#c4d5dd}</style><header><h1>2026 F1 资产库</h1><select id="asset" aria-label="选择资产"></select><button id="load">加载</button><select id="view" aria-label="视角"><option value="quarter">后侧 3/4</option><option value="side">正侧面</option><option value="front">前方</option><option value="top">俯视</option></select><button id="zoom-in">放大</button><button id="zoom-out">缩小</button><button id="rotate">转动 30°</button></header><canvas id="viewer" aria-label="资产三维预览"></canvas><aside><div id="status">请选择资产</div><div id="info"></div><a id="source" target="_blank" rel="noopener">作者来源</a> · <a href="index.html">返回十页演示</a><div>赛车为社区模型；赛道年份：Monza 2020 / Spa 2022。GP4 两车使用补充轮胎，详见署名文件。</div></aside><script id="library-data" type="application/json">{{ASSET_DATA}}</script><script>{{BUNDLED_ENGINE}}\n{{LIBRARY_LOGIC}}\n})();</script></html>'''
    html=markup.replace('{{ASSET_DATA}}',json.dumps(rows,ensure_ascii=False).replace('<','\\u003c')).replace('{{BUNDLED_ENGINE}}',bundled).replace('{{LIBRARY_LOGIC}}',(ROOT/'tools/library-viewer.js').read_text(encoding='utf-8'))
    (ROOT/'asset-library.html').write_text(html,encoding='utf-8');print('asset-library.html',len(html.encode()),len(rows),'assets')
if __name__=='__main__':build()
