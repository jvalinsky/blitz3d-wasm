#!/usr/bin/env python3
"""
SCPCB Asset Viewer HTTP Server

Serves the Blitz3D-WASM demo files and proxies requests to SCPCB assets.
Usage: python3 serve.py [port]
"""

import http.server
import socketserver
import os
import urllib.request
import urllib.error
from urllib.parse import urlparse

PORT = int(os.environ.get('PORT', 8080))
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCPCB_DIR = '/Users/jack/Software/scp_port/scpcb'

class SCPCBHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=SCRIPT_DIR, **kwargs)

    def translate_path(self, path):
        """Handle both local files and SCPCB asset proxying."""
        parsed = urlparse(path)
        url_path = parsed.path

        if url_path.startswith('/scpcb/'):
            scpcb_path = url_path[7:]
            return os.path.join(SCPCB_DIR, scpcb_path)
        elif url_path.startswith('/'):
            return super().translate_path(path)

        return super().translate_path(path)

    def do_GET(self):
        parsed = urlparse(self.path)
        url_path = parsed.path

        if url_path.startswith('/scpcb/'):
            scpcb_path = url_path[7:]
            local_path = os.path.join(SCPCB_DIR, scpcb_path)

            if os.path.isfile(local_path):
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(local_path))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'max-age=3600')

                with open(local_path, 'rb') as f:
                    content = f.read()
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                return
            else:
                self.send_error(404, f'SCPCB Asset not found: {url_path}')
                return

        if url_path == '/' or url_path == '/index.html':
            self.path = '/scpcb_asset_viewer.html'

        super().do_GET()

    def guess_type(self, path):
        """Guess MIME type based on file extension."""
        if path.endswith('.rmesh'):
            return 'application/octet-stream'
        elif path.endswith('.jpg') or path.endswith('.jpeg'):
            return 'image/jpeg'
        elif path.endswith('.png'):
            return 'image/png'
        elif path.endswith('.bmp'):
            return 'image/bmp'
        elif path.endswith('.b3d'):
            return 'application/octet-stream'
        elif path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.html'):
            return 'text/html'
        elif path.endswith('.svg'):
            return 'image/svg+xml'
        return 'application/octet-stream'

    def log_message(self, format, *args):
        """Custom logging."""
        print(f'[Server] {args[0]}')

class ReuseAddrTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

if __name__ == '__main__':
    print(f'=== SCPCB Asset Viewer Server ===')
    print(f'Serving demo from: {SCRIPT_DIR}')
    print(f'Proxying SCPCB assets from: {SCPCB_DIR}')
    print(f'')
    print(f'Server running at: http://localhost:{PORT}')
    print(f'')
    print(f'Access the viewer at: http://localhost:{PORT}/scpcb_asset_viewer.html')
    print(f'')
    print(f'Press Ctrl+C to stop the server')
    print(f'================================')

    try:
        with ReuseAddrTCPServer(('', PORT), SCPCBHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nServer stopped.')
    except Exception as e:
        print(f'Error: {e}')
