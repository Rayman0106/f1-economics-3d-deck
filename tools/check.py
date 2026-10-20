"""Check model preservation, src/slide wiring and offline output."""
from html.parser import HTMLParser
import base64
import json
import re
import sys

from common import ROOT, SOURCE, check_models, digest, read_json, script_json, validate_state


class DeckStructure(HTMLParser):
    def __init__(self):
        super().__init__()
        self.slides, self.copy, self.photos, self.external = [], [], [], []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "section" and "deck-slide" in attrs.get("class", "").split():
            self.slides.append(attrs.get("data-slide"))
        if "data-copy" in attrs:
            self.copy.append(attrs["data-copy"])
        if "data-photo" in attrs:
            self.photos.append(attrs["data-photo"])
        src = attrs.get("src", "")
        if tag in ("script", "img", "audio", "video") and src and not src.startswith("data:"):
            self.external.append(src)


def check():
    target = ROOT / "index.html"
    if not target.exists():
        raise ValueError("Run python tools/build.py first")
    html = target.read_text(encoding="utf-8")
    check_models(html)
    structure = DeckStructure()
    structure.feed(html)
    count = len(structure.slides)
    if structure.slides != [str(i) for i in range(count)] or not count:
        raise ValueError("Slide IDs must be contiguous from zero")
    if len(read_json(SOURCE / "content.json")["notes"]) != count:
        raise ValueError("Slide count and speaker-note count differ")
    for name, values in (("data-copy", structure.copy), ("data-photo", structure.photos)):
        if len(values) != len(set(values)):
            raise ValueError("Duplicate " + name)
    deck = (SOURCE / "deck.js").read_text(encoding="utf-8")
    match = re.search(r"const kind=\[(.*?)\]\[Math.min", deck)
    if not match:
        raise ValueError("Review transition mapping after changing deck.js")
    kinds = re.findall(r"['\"]([^'\"]+)['\"]", match[1])
    if len(kinds) != count - 1:
        raise ValueError("Every adjacent page pair needs a transition mapping")
    story = (SOURCE / "story-scenes.js").read_text(encoding="utf-8")
    duration_block = re.search(r"const durations=\{(.*?)\}", story)
    durations = dict(re.findall(r"(\w+)\s*:\s*([\d.]+)", duration_block[1]))
    for kind in kinds:
        if kind not in durations or float(durations[kind]) <= 0 or not re.search(r"function\s+" + re.escape(kind) + r"\(", story):
            raise ValueError("Missing scene or duration: " + kind)
    for name in ("CSS", "HTML", "JS"):
        if html.count("<!-- BRIEFING_" + name + "_START -->") != 1:
            raise ValueError("Duplicate or missing briefing module: " + name)
    for name in ("CINEMATIC_ENGINE", "F1_METAL"):
        if html.count("/* " + name + "_START */") != 1:
            raise ValueError("Duplicate or missing engine module: " + name)
    if structure.external:
        raise ValueError("Output has non-embedded runtime resources: " + ", ".join(structure.external))
    compiled_state, _ = script_json(html, "deck-data")
    if compiled_state != validate_state(read_json(SOURCE / "deck-state.json")):
        raise ValueError("Compiled photo state is stale; rebuild")
    audio=read_json(ROOT/'assets/audio/manifest.json')
    compiled_audio,_=script_json(html,'sound-manifest')
    if compiled_audio!=audio or {clip['key'] for clip in audio['clips']}!={'lights'}:
        raise ValueError('Compiled audio manifest is incomplete or stale')
    synthesis=audio.get('synthesis',{})
    synth_source=(SOURCE/'engine-synth.js').read_bytes()
    if synthesis.get('kind')!='procedural-v6' or synthesis.get('sampleRecordings') is not False or digest(synth_source)!=synthesis.get('sha256') or synth_source.decode('utf-8') not in html:
        raise ValueError('Compiled procedural engine renderer is incomplete or stale')
    if not (ROOT/'docs/Engine-Synthesis-License.txt').exists():
        raise ValueError('Engine synthesis license is missing')
    for clip in audio['clips']:
        if '/' in clip['file'] or '\\' in clip['file']:raise ValueError('Unexpected sound filename')
        data=(ROOT/'assets/audio'/clip['file']).read_bytes()
        match=re.search(r'<script id="sound-'+re.escape(clip['key'])+'"[^>]*>(.*?)</script>',html,re.S)
        if not match or base64.b64decode(match[1],validate=True)!=data or digest(data)!=clip['sha256'] or len(data)!=clip['bytes']:
            raise ValueError('Embedded audio differs from the recorded asset: '+clip['key'])
    return {"status": "pass", "slides": count, "transitions": kinds, "embedded_models_match_manifest": True, "embedded_audio_matches_manifest":True,"offline_resources": True}


if __name__ == "__main__":
    try:
        print(json.dumps(check()))
    except Exception as error:
        print("Check failed: " + str(error), file=sys.stderr)
        sys.exit(1)
