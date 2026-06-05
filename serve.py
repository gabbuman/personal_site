"""Tiny static server with correct JS MIME types (for local testing only)."""
import http.server, socketserver, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".svg": "image/svg+xml",
    }

port = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
with socketserver.TCPServer(("", port), H) as httpd:
    print(f"serving on http://localhost:{port}")
    httpd.serve_forever()
