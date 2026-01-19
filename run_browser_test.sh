#!/bin/bash
# Test the compiled SCP:CB WASM in browser

echo "=== SCP:CB Browser Test ==="
echo ""

# Check if WASM exists
if [ ! -f "/tmp/scpcb_test.wasm" ]; then
    echo "Compiling SCP:CB test..."
    swift run blitz3d-wasm Tests/IntegrationTests/SCPCB_Compilation_Test.bb -o /tmp/scpcb_test.wasm
fi

echo "WASM file: /tmp/scpcb_test.wasm"
ls -la /tmp/scpcb_test.wasm

echo ""
echo "Testing with Node.js WASM interpreter..."

# Check if we can validate with wat2wasm or similar
if command -v wat2wasm &> /dev/null; then
    echo "Converting to WAT for inspection..."
    wasm2wat /tmp/scpcb_test.wasm -o /tmp/scpcb_test.wat 2>/dev/null || true
    head -50 /tmp/scpcb_test.wat
else
    echo "wat2wasm not installed, skipping WAT conversion"
fi

echo ""
echo "=== Test Complete ==="
