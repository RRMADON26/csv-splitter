#!/usr/bin/env python3
"""Local server for development: like `python3 -m http.server`, but tells the browser not to
reuse old copies, so a reload always shows your latest HTML, CSS and JS.

Usage:  python3 tools/serve.py [port]      (default 8765, serves the project folder)
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    handler = functools.partial(NoCacheHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("", port), handler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{port} (no caching). Ctrl+C to stop.")
        httpd.serve_forever()
