"""Build Final J from editable modules and immutable local assets.

Python standard library only; no historical workspace or network is required.
Large GLBs are base64-encoded in chunks, not concatenated in memory.
"""
import argparse
import base64
import json
from pathlib import Path
import re
import tempfile
import os
from common import ROOT, build_lock, read_json

INCLUDE = re.compile(r'@@F1_INCLUDE:([^@]+)@@')
MODEL = re.compile(r'<script\b([^>]*\bdata-src="/model/([^"]+)\.glb"[^>]*)>\s*</script>')


def assemble(check=False):
    html = (ROOT/'seed/final-j-shell.html').read_bytes().decode('utf8')
    def include(match):
        path = (ROOT/match[1]).resolve()
        if not path.is_relative_to(ROOT.resolve()):
            raise ValueError('Source include leaves the project')
        return path.read_bytes().decode('utf8')
    html = INCLUDE.sub(include, html)
    for placeholder, name in [('{{TYPE_TEAMS_JSON}}','type-teams.json'),
                              ('{{TYPE_LOGOS_JSON}}','type-logos.json'),
                              ('{{CONTENT_JSON}}','content.json')]:
        html = html.replace(placeholder, (ROOT/'src'/name).read_bytes().decode('utf8'))
    resources = read_json(ROOT/'assets/background-j/resources.json')
    table = {}
    for uri, record in resources.items():
        path = ROOT/record['path']
        if path.stat().st_size != record['bytes']:
            raise ValueError('Background resource size differs: '+uri)
        value = 'CHECK_ONLY' if check else base64.b64encode(path.read_bytes()).decode('ascii')
        table[uri] = 'data:'+record['mime']+';base64,'+value
    html = html.replace('@@F1_BACKGROUND_TABLE@@', json.dumps(table,separators=(',',':')))
    if INCLUDE.search(html) or '@@F1_' in html or '{{TYPE_' in html or '{{CONTENT_JSON}}' in html:
        raise ValueError('Unresolved build input')
    manifest = read_json(ROOT/'assets/manifest.json')
    models = {key: ROOT/record['path'] for section in ('models','scenery','grid')
              for key,record in manifest[section].items()}
    if {m[2] for m in MODEL.finditer(html)} != set(models):
        raise ValueError('Embedded model slots differ from manifest')
    if 'F1ReviewMode=true' in html or '/live-j.js' in html or '/perf-hooks.js' in html:
        raise ValueError('Development preview leaked into release')
    return html,models,resources


def build(output=None):
    with build_lock():
        html,models,resources = assemble()
        target = Path(output).resolve() if output else ROOT/'index.html'
        target.parent.mkdir(parents=True,exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w',encoding='utf8',newline='',
                                             dir=target.parent,delete=False) as stream:
                temporary = Path(stream.name)
                position = 0
                for match in MODEL.finditer(html):
                    stream.write(html[position:match.start()])
                    stream.write('<script'+re.sub(r'\s+data-src="[^"]+"','',match[1])+'>')
                    with models[match[2]].open('rb') as model:
                        while block := model.read(3*1024*1024):
                            stream.write(base64.b64encode(block).decode('ascii'))
                    stream.write('</script>')
                    position = match.end()
                stream.write(html[position:])
            os.replace(temporary,target)
        finally:
            if temporary:
                temporary.unlink(missing_ok=True)
        report = {'version':'Final-J','file':str(target),'bytes':target.stat().st_size,
                  'models':len(models),'backgroundResources':len(resources),'targetFps':60,
                  'defaultLook':'broadcast','developmentControls':False}
        (ROOT/'.build/last-build.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
        return report


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path)
    parser.add_argument('--check',action='store_true',help='validate sources without exporting large HTML')
    args=parser.parse_args()
    if args.check:
        _,models,resources=assemble(check=True)
        print(json.dumps({'status':'pass','models':len(models),'backgroundResources':len(resources)}))
    else:
        print(json.dumps(build(args.output)))
