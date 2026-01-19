#!/bin/bash
# Build script for Blitz3DEngine WASM module
# Requires SwiftWasm SDK: https://swiftwasm.org/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building Blitz3DEngine.wasm..."

# Check if SwiftWasm is available
if ! command -v swift &> /dev/null; then
    echo "Error: Swift is not installed"
    echo "Install SwiftWasm from: https://swiftwasm.org/"
    exit 1
fi

# Check for WASM target
if ! swift --version | grep -q "wasm"; then
    echo "SwiftWasm SDK required. Install with:"
    echo "  swift sdk install https://github.com/swiftwasm/swift/releases/download/swift-wasm-6.2RELEASE/swift-wasm-6.2RELEASE-macos_arm64.tar.gz"
    exit 1
fi

# Build for WASM target
echo "Compiling for wasm32-unknown-none-wasm..."
swift build \
    --target Blitz3DEngine \
    --triple wasm32-unknown-none-wasm \
    --configuration release \
    -Xswiftc "-Xfrontend -disable-availability-checking" \
    -Xswiftc "-Xfrontend -disable-objc-attr-provided-by-modules"

# Find the output
WASM_OUTPUT=$(find . -name "*.wasm" -path "*/wasm32*" 2>/dev/null | head -1)

if [ -z "$WASM_OUTPUT" ]; then
    # Try alternate location
    WASM_OUTPUT=$(find . -name "Blitz3DEngine.wasm" 2>/dev/null | head -1)
fi

if [ -n "$WASM_OUTPUT" ] && [ -f "$WASM_OUTPUT" ]; then
    echo "Found: $WASM_OUTPUT"
    
    # Copy to dist if it exists
    if [ -d "dist" ]; then
        cp "$WASM_OUTPUT" dist/Blitz3DEngine.wasm
        echo "Copied to dist/Blitz3DEngine.wasm"
        ls -lh dist/Blitz3DEngine.wasm
    else
        echo "WASM binary: $WASM_OUTPUT"
    fi
else
    echo "WASM binary not found. Check build output."
    find . -name "*.wasm" 2>/dev/null
    find . -name "*.o" -path "*wasm*" 2>/dev/null
fi

echo "Build complete!"
