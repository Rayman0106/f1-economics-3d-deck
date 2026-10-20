"""Shared paths and integrity checks; Python standard library only."""
import base64
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import time

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src"
WORK = ROOT / ".build"


@contextmanager
def build_lock():
    """Serialize the watcher and CLI builds; OS releases the lock on exit."""
    WORK.mkdir(exist_ok=True)
    with (WORK / "build.lock").open("a+b") as handle:
        handle.seek(0)
        if not handle.read(1):
            handle.write(b"0")
            handle.flush()
        deadline = time.monotonic() + 120
        while True:
            try:
                handle.seek(0)
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError:
                if time.monotonic() >= deadline:
                    raise TimeoutError("Another build is still running")
                time.sleep(.1)
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def digest(data):
    return hashlib.sha256(data).hexdigest()


def atomic_text(path, text):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="", dir=path.parent, delete=False) as handle:
        handle.write(text)
        temporary = Path(handle.name)
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def asset_data(html, team):
    match = re.search(r'<script id="asset-' + re.escape(team) + r'"[^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise ValueError("Missing embedded model: " + team)
    return base64.b64decode(match[1].strip(), validate=True)


def check_models(html=None):
    manifest = read_json(ROOT / "assets/manifest.json")
    for team, record in {**manifest["models"],**manifest.get('scenery',{}),**manifest.get('grid',{})}.items():
        data = (ROOT / record["path"]).read_bytes()
        if len(data) != record["bytes"] or digest(data) != record["sha256"]:
            raise ValueError("GLB differs from manifest: " + team)
        if html is not None and asset_data(html, team) != data:
            raise ValueError("Embedded GLB differs from local asset: " + team)
    return manifest


def script_json(html, identifier):
    pattern = r'(<script\b[^>]*\bid=[\"\']' + re.escape(identifier) + r'[\"\'][^>]*>)(.*?)(</script>)'
    match = re.search(pattern, html, re.S)
    if not match:
        raise ValueError("Missing JSON script: " + identifier)
    return json.loads(match[2]), pattern


def validate_state(state):
    if not isinstance(state, dict):
        raise ValueError("deck-state must be an object")
    for key in ("text", "photos"):
        if not isinstance(state.get(key, {}), dict) or any(not isinstance(k, str) or not isinstance(v, str) for k, v in state.get(key, {}).items()):
            raise ValueError(key + " must contain string values")
    for key, value in state.get("photos", {}).items():
        if not value.startswith("data:image/") or ";base64," not in value:
            raise ValueError("Photo must be an embedded image: " + key)
        base64.b64decode(value.split(",", 1)[1], validate=True)
    return {"text": state.get("text", {}), "photos": state.get("photos", {}), "livery": "redbull"}
