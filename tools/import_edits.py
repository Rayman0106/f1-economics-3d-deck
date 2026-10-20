"""Move Save HTML text back into source and retain embedded photo overrides."""
import argparse
import base64
from datetime import datetime
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil
import sys
import uuid

from common import ROOT, SOURCE, WORK, atomic_text, read_json, script_json, validate_state
from build import build


class CopyRanges(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text, self.stack, self.ranges, self.photos = text, [], {}, set()
        self.starts = [0]
        for index, char in enumerate(text):
            if char == "\n":
                self.starts.append(index + 1)

    def absolute_offset(self):
        line, col = self.getpos()
        return self.starts[line - 1] + col

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "data-photo" in attrs:
            self.photos.add(attrs["data-photo"])
        key = attrs.get("data-copy")
        if tag in self.VOID:
            if key:
                raise ValueError("data-copy cannot be a void tag: " + key)
            return
        self.stack.append((tag, key, self.absolute_offset() + len(self.get_starttag_text())))

    def handle_startendtag(self, tag, attrs):
        if "data-copy" in dict(attrs):
            raise ValueError("data-copy must have content")

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                _, key, start = self.stack[index]
                if key:
                    if key in self.ranges:
                        raise ValueError("Duplicate data-copy: " + key)
                    self.ranges[key] = (start, self.absolute_offset())
                del self.stack[index:]
                break


def import_edits(file, compile_output=True):
    saved = Path(file).read_text(encoding="utf-8-sig")
    state, _ = script_json(saved, "deck-data")
    state = validate_state(state)
    source_path, state_path = SOURCE / "slides.html", SOURCE / "deck-state.json"
    source = source_path.read_text(encoding="utf-8")
    parser = CopyRanges(source)
    parser.feed(source)
    unknown = set(state["text"]) - set(parser.ranges)
    unknown_photos = set(state["photos"]) - parser.photos
    if unknown or unknown_photos:
        raise ValueError("Unmapped saved keys; no files changed: " + ", ".join(sorted(unknown | unknown_photos)))
    changes = []
    for key, text in state["text"].items():
        start, end = parser.ranges[key]
        if source[start:end] != text:
            changes.append((start, end, text))
    for start, end, text in sorted(changes, reverse=True):
        source = source[:start] + text + source[end:]
    previous = validate_state(read_json(state_path))
    photos = dict(previous["photos"])
    default_baku = "data:image/webp;base64," + base64.b64encode((SOURCE / "baku-news-photo.webp").read_bytes()).decode("ascii")
    for key, value in state["photos"].items():
        if key == "baku" and value == default_baku:
            photos.pop(key, None)
        else:
            photos[key] = value
    backup = WORK / "import-backups" / (datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6])
    backup.mkdir(parents=True)
    for path in (source_path, state_path):
        shutil.copyfile(path, backup / path.name)
    atomic_text(source_path, source)
    atomic_text(state_path, json.dumps({"text": {}, "photos": photos, "livery": "redbull"}, ensure_ascii=False, indent=2) + "\n")
    if compile_output:
        build()
    return {"text_fields_updated": len(changes), "photos": list(photos), "backup": str(backup.relative_to(ROOT)), "rebuilt": compile_output}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("saved_html")
    parser.add_argument("--no-build", action="store_true")
    args = parser.parse_args()
    try:
        print(json.dumps(import_edits(args.saved_html, not args.no_build)))
    except Exception as error:
        print("Import failed: " + str(error), file=sys.stderr)
        sys.exit(1)
