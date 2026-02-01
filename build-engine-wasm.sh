#!/bin/bash
# Build only the Blitz3DEngine library target for WASM
# Key: Remove --triple flag, let SDK determine the triple automatically

set -e

echo "Building Blitz3DEngine for WebAssembly..."

cd "$(dirname "$0")"

# Build with SDK auto-determining the triple (no --triple flag!)
swift build \
  --swift-sdk swift-6.2.3-RELEASE_wasm \
  -c release \
  -Xswiftc -enable-experimental-feature \
  -Xswiftc Extern \
  -Xlinker --export-all \
  -Xlinker --no-entry 2>&1

# The SDK determines the output path, check both possible locations
if [ -f ".build/wasm32-unknown-wasip1/release/libBlitz3DEngine.a" ]; then
    echo "✓ Build successful!"
    echo "Output: .build/wasm32-unknown-wasip1/release/libBlitz3DEngine.a"
    ls -lh .build/wasm32-unknown-wasip1/release/libBlitz3DEngine.a
elif [ -f ".build/wasm32-unknown-wasi/release/libBlitz3DEngine.a" ]; then
    echo "✓ Build successful!"
    echo "Output: .build/wasm32-unknown-wasi/release/libBlitz3DEngine.a"
    ls -lh .build/wasm32-unknown-wasi/release/libBlitz3DEngine.a
else
    echo "✗ Build failed or output not found"
    echo "Checking .build directory..."
    find .build -name "*.wasm" -o -name "libBlitz3DEngine.a" 2>/dev/null || echo "No WASM outputs found"
    exit 1
fi
