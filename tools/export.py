"""Export a portable HTML and optionally a source handoff ZIP."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import zipfile

from common import ROOT, read_json
from build import build
from check import check


def project_archive(target):
    descriptor, temporary_name = tempfile.mkstemp(prefix=".project-", suffix=".tmp", dir=target.parent)
    os.close(descriptor)
    temporary = Path(temporary_name)
    try:
        with zipfile.ZipFile(temporary, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for folder in ("source", "assets", "seed", "tools", "docs", "speaker"):
                for path in sorted((ROOT / folder).rglob("*")):
                    if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc":
                        archive.write(path, "f1-local-workflow/" + str(path.relative_to(ROOT)).replace("\\", "/"))
            for name in ("README.md", "AGENTS.md", "CODEX_HANDOFF.md", "project.json", "start-local.bat", "start-local.sh", ".gitignore"):
                archive.write(ROOT / name, "f1-local-workflow/" + name)
            archive.write(ROOT/'asset-library.html','f1-local-workflow/asset-library.html')
            archive.write(ROOT/'index.html','f1-local-workflow/index.html')
        with zipfile.ZipFile(temporary) as archive:
            if archive.testzip() is not None:
                raise ValueError("ZIP CRC verification failed")
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", action="store_true", help="also package the reconstructable local project")
    args = parser.parse_args()
    try:
        build()
        verified = check()
        config = read_json(ROOT / "project.json")
        stem = config["name"] + "-" + config["version"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", stem):
            raise ValueError("Export name must use ASCII letters, numbers, underscores or hyphens")
        directory = ROOT / "exports"
        directory.mkdir(exist_ok=True)
        target = directory / (stem + ".html")
        shutil.copyfile(ROOT / "index.html", target)
        outputs = [str(target.relative_to(ROOT))]
        if args.project:
            target = directory / (stem + "-Local-Workflow.zip")
            project_archive(target)
            outputs.append(str(target.relative_to(ROOT)))
        print(json.dumps({"files": outputs, "check": verified}))
    except Exception as error:
        print("Export failed: " + str(error), file=sys.stderr)
        sys.exit(1)
