#!/bin/bash

# 1. Compile MeshTest.bb to WASM
echo "Compiling MeshTest.bb..."
swift build -c debug
./.build/debug/blitz3d-wasm Tests/IntegrationTests/MeshTest.bb -o Tests/IntegrationTests/MeshTest.wasm

if [ $? -ne 0 ]; then
    echo "Compilation failed!"
    exit 1
fi

# 2. Bundle Runtime (runtime.js -> dist/runtime.bundle.js)
echo "Bundling Runtime..."
mkdir -p dist
# Use Deno to run browserify (via npm compat)
deno run -A npm:browserify Sources/Runtime/runtime.js -o dist/runtime.bundle.js

if [ $? -ne 0 ]; then
    echo "Bundling failed! Make sure Deno is installed."
    exit 1
fi

# 3. Serve
echo "Starting Server on port 8000..."
echo "Open http://localhost:8000/index_mesh.html in your browser."
python3 -m http.server 8000
