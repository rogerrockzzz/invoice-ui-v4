#!/usr/bin/env python3
"""Dev server for the prototype: sends no-cache headers so a browser reload
always picks up the latest edit instead of replaying a stale copy."""
import http.server, socketserver, os

PORT = 8765
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('127.0.0.1', PORT), NoCache) as httpd:
    print('Prototype: http://127.0.0.1:%d/invoice-prototype.html' % PORT)
    httpd.serve_forever()
