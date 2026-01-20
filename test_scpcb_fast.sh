#!/bin/bash
# Fast SCPCB compilation test - just counts pass/fail

SCPCB_DIR="/Users/jack/Software/scp_port/scpcb"
COMPILER="/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm"
VALIDATOR="/opt/homebrew/bin/wasm-validate"
TEMP_DIR=$(mktemp -d)

echo "Blitz3D-WASM SCPCB Fast Test"
echo "============================"
date

TOTAL=0
PASSED=0
FAILED=0

for bb_file in "$SCPCB_DIR"/*.bb; do
    filename=$(basename "$bb_file")
    TOTAL=$((TOTAL + 1))
    
    printf "[%2d] %-30s " "$TOTAL" "$filename"
    
    wasm_output="$TEMP_DIR/${filename}.wasm"
    
    # Compile (suppress output)
    if ! "$COMPILER" "$bb_file" -o "$wasm_output" > /dev/null 2>&1; then
        echo "✗ COMPILE FAILED"
        FAILED=$((FAILED + 1))
        continue
    fi
    
    # Validate (just check exit code, don't parse errors)
    if "$VALIDATOR" "$wasm_output" > /dev/null 2>&1; then
        echo "✓ PASS"
        PASSED=$((PASSED + 1))
    else
        # Count errors quickly
        error_count=$("$VALIDATOR" "$wasm_output" 2>&1 | grep -c "error:")
        echo "✗ FAIL ($error_count errors)"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "Summary:"
echo "--------"
echo "Total:  $TOTAL"
echo "Passed: $PASSED ($(( PASSED * 100 / TOTAL ))%)"
echo "Failed: $FAILED"

rm -rf "$TEMP_DIR"
