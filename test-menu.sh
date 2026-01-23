#!/bin/bash
set -e

echo "Building compiler..."
swift build

echo "Compiling Menu.bb..."
swift run blitz3d-wasm ../scpcb/Menu.bb -o /tmp/menu.wasm

echo "Validating WASM..."
wasm-validate /tmp/menu.wasm && echo "SUCCESS: Valid WASM!" || echo "FAILED: Validation errors"
