#!/usr/bin/env python3
"""Stand-in for llama-server used by tests. Serves /health and a canned
chat completion; ignores all flags except --port. --crash exits immediately."""
import argparse
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

parser = argparse.ArgumentParser()
parser.add_argument("--port", type=int, required=True)
parser.add_argument("--crash", action="store_true")
args, _unknown = parser.parse_known_args()

print("fake llama-server starting", flush=True)
if args.crash:
    print("fake: crashing on purpose", flush=True)
    sys.exit(1)


class Handler(BaseHTTPRequestHandler):
    def _send(self, body):
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._send(b'{"status":"ok"}')

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        if length:
            self.rfile.read(length)
        self._send(b'{"choices":[{"message":{"content":"hi from fake"}}],"usage":{"completion_tokens":3}}')

    def log_message(self, format, *args):
        pass


print("HTTP server listening", flush=True)
HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
