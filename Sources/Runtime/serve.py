#!/usr/bin/env python3
"""
Simple HTTP server for SCPCB Asset Viewer Demo
Serves files from the current directory on port 8080
"""

import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
    
    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {args[0]}")

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print(f"\n╔════════════════════════════════════════════════╗")
        print(f"║   SCPCB Asset Viewer Demo Server              ║")
        print(f"╠════════════════════════════════════════════════╣")
        print(f"║   Server running at:                          ║")
        print(f"║   http://localhost:{PORT}                       ║")
        print(f"╠════════════════════════════════════════════════╣")
        print(f"║   Demo: scpcb_asset_viewer.html               ║")
        print(f"╚════════════════════════════════════════════════╝\n")
        httpd.serve_forever()
