#!/bin/bash
# Blitz3D WASM Demo Runner Script
# Clears caches, rebuilds everything, and starts the server

set -e

echo "========================================="
echo "Blitz3D WASM Demo Runner"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill any existing servers
echo -e "${YELLOW}Stopping any existing servers...${NC}"
pkill -f "python3 -m http.server" 2>/dev/null || true
pkill -f "python3 -c" 2>/dev/null || true
sleep 1

# Clear various caches
echo ""
echo -e "${YELLOW}Clearing caches...${NC}"
rm -rf .build/cache 2>/dev/null || true
rm -rf dist/runtime.bundle.js 2>/dev/null || true
rm -rf Sources/runtime.bundle.js 2>/dev/null || true
rm -f Tests/IntegrationTests/*.wasm 2>/dev/null || true
rm -f .wasm_cache* 2>/dev/null || true
echo -e "${GREEN}✓ Caches cleared${NC}"

# Clean rebuild Swift compiler
echo ""
echo -e "${YELLOW}Rebuilding compiler (release mode)...${NC}"
swift build -c release
echo -e "${GREEN}✓ Compiler rebuilt${NC}"

# Rebuild WASM demos
echo ""
echo -e "${YELLOW}Compiling demos...${NC}"
.build/release/blitz3d-wasm Tests/IntegrationTests/MeshTest.bb -o Tests/IntegrationTests/MeshTest.wasm
.build/release/blitz3d-wasm Tests/IntegrationTests/GraphicsDemo.bb -o Tests/IntegrationTests/GraphicsDemo.wasm
echo -e "${GREEN}✓ WASM demos compiled${NC}"

# Bundle JavaScript runtime
echo ""
echo -e "${YELLOW}Bundling JavaScript runtime...${NC}"
npx -y browserify Sources/Runtime/runtime.js -o dist/runtime.bundle.js
echo -e "${GREEN}✓ Runtime bundled${NC}"

# Verify bundles
echo ""
echo -e "${YELLOW}Verifying builds...${NC}"
if [ -f "dist/runtime.bundle.js" ]; then
    echo -e "${GREEN}✓ dist/runtime.bundle.js exists$NC"
else
    echo -e "${RED}✗ dist/runtime.bundle.js NOT FOUND${NC}"
    exit 1
fi

if [ -f "Tests/IntegrationTests/GraphicsDemo.wasm" ]; then
    echo -e "${GREEN}✓ Tests/IntegrationTests/GraphicsDemo.wasm exists${NC}"
else
    echo -e "${RED}✗ GraphicsDemo.wasm NOT FOUND${NC}"
    exit 1
fi

# Start server with no-cache headers
echo ""
echo -e "${YELLOW}Starting server on port 8000...${NC}"
cat > /tmp/blitz3d_server.py << 'PYEOF'
from http.server import HTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        pass  # Suppress log messages

HTTPServer(('', 8000), NoCacheHandler).serve_forever()
PYEOF

nohup python3 /tmp/blitz3d_server.py > /tmp/server.log 2>&1 &
sleep 2

# Verify server is running
if curl -s http://localhost:8000/index_demo.html > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running on port 8000${NC}"
else
    echo -e "${RED}✗ Server failed to start${NC}"
    cat /tmp/server.log
    exit 1
fi

# Print summary
echo ""
echo "========================================="
echo -e "${GREEN}BUILD COMPLETE${NC}"
echo "========================================="
echo ""
echo "Demos available:"
echo "  - Simple Mesh:  http://localhost:8000/index_mesh.html"
echo "  - Graphics Demo: http://localhost:8000/index_demo.html"
echo ""
echo "To test input in browser console:"
echo "  testBlitz3DInput()"
echo ""
echo -e "${YELLOW}IMPORTANT: Do a HARD REFRESH in your browser!${NC}"
echo "  Mac: Cmd+Shift+R"
echo "  Windows: Ctrl+Shift+F5"
echo ""
echo "Press Ctrl+C to stop the server when done."
echo ""

# Wait for user interrupt
trap "echo ''; echo 'Stopping server...'; pkill -f 'python3 /tmp/blitz3d_server.py' 2>/dev/null; exit" INT
while true; do
    sleep 1
done
