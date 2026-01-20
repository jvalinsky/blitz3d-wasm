#!/bin/bash
# Start HTTP server for browser testing

echo "🚀 Starting HTTP server for Blitz3D WASM testing..."
echo ""
echo "Server will be available at:"
echo "  http://localhost:8000/test_runtime.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m SimpleHTTPServer 8000
else
    echo "Error: Python not found. Please install Python or use another HTTP server."
    exit 1
fi
