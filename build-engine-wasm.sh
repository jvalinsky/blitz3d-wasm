#!/bin/bash
# Build only the Blitz3DEngine library target for WASM
# Uses temporary Package.wasm.swift with only libraries (no executables)

set -e

echo "Building Blitz3DEngine for WebAssembly..."

cd "$(dirname "$0")"

# Temporarily swap Package.swift to avoid building executables for WASM
if [ -f "Package.swift" ]; then
    mv Package.swift Package.swift.orig
fi
cp Package.wasm.swift Package.swift

# Build with WASM-only package manifest
# Use 6.2-RELEASE SDK (better compatibility than 6.2.3)
swift build \
  --swift-sdk 6.2-RELEASE-wasm32-unknown-wasip1 \
  -c release \
  -Xswiftc -enable-experimental-feature \
  -Xswiftc Extern \
  -Xlinker --export-all \
  -Xlinker --no-entry 2>&1

BUILD_RESULT=$?

# Restore original Package.swift
if [ -f "Package.swift.orig" ]; then
    mv Package.swift.orig Package.swift
fi

exit $BUILD_RESULT

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
