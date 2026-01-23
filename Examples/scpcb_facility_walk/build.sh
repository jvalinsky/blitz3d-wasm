#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$SCRIPT_DIR/../.."

swift run blitz3d-wasm "$SCRIPT_DIR/facility_walk.bb" -o "$SCRIPT_DIR/facility_walk.wasm"

if command -v wasm-validate &> /dev/null; then
    wasm-validate "$SCRIPT_DIR/facility_walk.wasm" && echo "SUCCESS: Valid WASM" || echo "FAILED: Validation errors"
fi

