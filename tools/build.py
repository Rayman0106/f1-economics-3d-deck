"""Compile editable source and local GLBs into one portable index.html."""
import base64
import json
import re
import subprocess
import sys

from common import ROOT, SOURCE, WORK, atomic_text, build_lock, check_models, digest, read_json, script_json, validate_state


def build():
    with build_lock():
        return compile_project()


def compile_project():
    manifest = check_models()
    from build_library import build as build_asset_library
    build_asset_library()
    project = read_json(ROOT / "project.json")
    version, name = project["version"], project["name"]
    if not re.fullmatch(r"[A-Za-z0-9_-]+", name + "-" + version):
        raise ValueError("Project name and version must use ASCII letters, numbers, underscores or hyphens")
    state = validate_state(read_json(SOURCE / "deck-state.json"))
    if state["text"]:
        raise ValueError("Import text into slides.html using tools/import_edits.py; text overrides would hide source edits.")
    shell = (ROOT / "seed/engine-shell.html").read_text(encoding="utf-8")
    if digest(shell.encode()) != manifest["seed_sha256"]:
        raise ValueError("Native engine shell changed; review that change and update its fingerprint explicitly.")
    for team, record in manifest["models"].items():
        token = "__F1_ASSET_" + team.upper() + "__"
        if team == 'cadillac' and token not in shell:
            embedded = base64.b64encode((ROOT / record["path"]).read_bytes()).decode("ascii")
            shell = shell.replace('</body>', '<script id="asset-cadillac" type="application/octet-stream">' + embedded + '</script>\n</body>', 1)
            continue
        if shell.count(token) != 1:
            raise ValueError("Invalid model placeholder: " + team)
        shell = shell.replace(token, base64.b64encode((ROOT / record["path"]).read_bytes()).decode("ascii"))
    for asset_name,record in {**manifest.get('scenery',{}),**manifest.get('grid',{})}.items():
        embedded=base64.b64encode((ROOT/record['path']).read_bytes()).decode('ascii')
        shell=shell.replace('</body>','<script id="asset-'+asset_name+'" type="application/octet-stream">'+embedded+'</script>\n</body>',1)
    WORK.mkdir(exist_ok=True)
    base = WORK / "assembled-base.html"
    output = WORK / "index-next.html"
    base.write_text(shell, encoding="utf-8")
    run = subprocess.run([sys.executable, "-X", "utf8", str(SOURCE / "build.py"), "--base", str(base), "--output", str(output)], cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    if run.returncode:
        raise RuntimeError(run.stderr.strip() or run.stdout.strip())
    html = output.read_text(encoding="utf-8").replace("四队 F1 赛车三维动画", "2026 F1 社区赛车模型三维动画")
    _, pattern = script_json(html, "deck-data")
    payload = json.dumps(state, separators=(",", ":"), ensure_ascii=False).replace("<", "\\u003c")
    html = re.sub(pattern, lambda m: m[1] + payload + m[3], html, count=1, flags=re.S)
    if version != manifest["baseline"]:
        html = re.sub(r"<title>[^<]*</title>", "<title>F1 Economics / " + version + "</title>", html, count=1)
        html = re.sub(r'(<meta name="apex-version" content=")[^"]*(")', lambda m: m[1] + "briefing-" + version.lower() + "-local" + m[2], html, count=1)
        html = re.sub(r"(window\.F1Briefing=Object\.freeze\(\{version:')[^']*(')", lambda m: m[1] + version + "-local-workflow" + m[2], html, count=1)
        html = re.sub(r"(link\.download=')[^']*(')", lambda m: m[1] + name + "-" + version + ".html" + m[2], html, count=1)
    check_models(html)
    # Only replace the visible entry after a successful, verified build.
    atomic_text(ROOT / "index.html", html)
    result = {"file": "index.html", "version": version, "bytes": len(html.encode("utf-8")), "sha256": digest(html.encode("utf-8")), "models": len(manifest["models"])}
    atomic_text(WORK / "last-build.json", json.dumps(result, indent=2) + "\n")
    # These verified intermediates are reproducible; keep only the live output.
    base.unlink(missing_ok=True)
    output.unlink(missing_ok=True)
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(build()))
    except Exception as error:
        print("Build failed: " + str(error), file=sys.stderr)
        sys.exit(1)
