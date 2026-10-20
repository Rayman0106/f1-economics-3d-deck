"""Build, preview and watch the project. No npm packages required."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import socket
import sys
import threading
import time
from urllib.parse import urlsplit
import webbrowser

from common import ROOT, SOURCE, read_json
from build import build


def signature():
    paths = list(SOURCE.rglob("*")) + list((ROOT / "assets").rglob("*.glb")) + [ROOT / "project.json", ROOT / "assets/manifest.json", ROOT / "seed/engine-shell.html"]
    return tuple((str(path), path.stat().st_mtime_ns, path.stat().st_size) for path in sorted(paths) if path.is_file() and "__pycache__" not in path.parts and path.suffix != ".pyc")


def watch(stop):
    previous = signature()
    changed = None
    while not stop.wait(.5):
        current = signature()
        if current != previous:
            previous, changed = current, time.monotonic()
        elif changed is not None and time.monotonic() - changed > .35:
            try:
                build()
                print("Rebuilt index.html. Refresh the browser to view changes.", flush=True)
            except Exception as error:
                print("Build failed; previous index kept: " + str(error), file=sys.stderr, flush=True)
            changed = None


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.serve(True)

    def do_HEAD(self):
        self.serve(False)

    def serve(self, body):
        route = urlsplit(self.path).path
        if route == '/asset-library.html' or route.startswith('/assets/'):
            file=(ROOT/route.lstrip('/')).resolve()
            if not file.is_relative_to(ROOT.resolve()) or not file.is_file():self.send_error(404);return
            payload=file.read_bytes();content_type='text/html; charset=utf-8' if file.suffix=='.html' else 'model/gltf-binary' if file.suffix=='.glb' else 'application/octet-stream'
            self.send_response(200);self.send_header('Content-Type',content_type);self.send_header('Content-Length',str(len(payload)));self.end_headers()
            if body:self.wfile.write(payload)
            return
        if route not in ("/", "/index.html", "/health"):
            self.send_error(404)
            return
        if route == "/health":
            payload, content_type = b'{"ready":true}', "application/json"
        else:
            payload, content_type = (ROOT / "index.html").read_bytes(), "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if body:
            self.wfile.write(payload)


def main():
    settings = read_json(ROOT / "project.json")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=settings["port"])
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--no-watch", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build()), flush=True)
    try:
        server = ThreadingHTTPServer((args.host, args.port), Handler)
    except OSError as error:
        if args.port and error.errno in (48, 98, 10048):
            server = ThreadingHTTPServer((args.host, 0), Handler)
        else:
            raise
    display_host = "127.0.0.1" if args.host in ("0.0.0.0", "::") else args.host
    url = "http://" + display_host + ":" + str(server.server_port) + "/"
    print("Preview: " + url, flush=True)
    if args.host == "0.0.0.0":
        print("For iPad: use this computer's LAN IP and port " + str(server.server_port), flush=True)
    print("Source watching " + ("off" if args.no_watch else "on") + ". Ctrl+C to stop.", flush=True)
    stop = threading.Event()
    if not args.no_watch:
        threading.Thread(target=watch, args=(stop,), daemon=True).start()
    if not args.no_browser:
        threading.Timer(.3, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever(poll_interval=.3)
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        server.server_close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Preview failed: " + str(error), file=sys.stderr)
        sys.exit(1)
