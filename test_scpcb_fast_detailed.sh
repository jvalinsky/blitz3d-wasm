#!/usr/bin/env bash
# Fast SCPCB compilation test with detailed error categorization

SCPCB_DIR="/Users/jack/Software/scp_port/scpcb"
COMPILER="/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm"
VALIDATOR="/opt/homebrew/bin/wasm-validate"
TEMP_DIR=$(mktemp -d)

echo "Blitz3D-WASM SCPCB Fast Test (Detailed)"
echo "========================================"
date
echo ""

# Error category counters
TYPE_MISMATCH_COUNT=0
STACK_UNBALANCED_COUNT=0
DROP_ERRORS=0
LOCAL_VAR_RANGE_COUNT=0
GLOBAL_VAR_RANGE_COUNT=0
INVALID_OPCODE_COUNT=0
FUNCTION_SIGNATURE_COUNT=0
UNREACHABLE_CODE_COUNT=0
UNKNOWN_ERROR_COUNT=0

TOTAL=0
PASSED=0
FAILED=0
COMPILE_FAILED=0

# Store results for summary (using temp file for compatibility)
RESULTS_FILE="$TEMP_DIR/results.txt"
touch "$RESULTS_FILE"

for bb_file in "$SCPCB_DIR"/*.bb; do
    filename=$(basename "$bb_file")
    TOTAL=$((TOTAL + 1))
    
    printf "[%2d] %-30s " "$TOTAL" "$filename"
    
    wasm_output="$TEMP_DIR/${filename}.wasm"
    
    # Compile (suppress output)
    if ! "$COMPILER" "$bb_file" -o "$wasm_output" > /dev/null 2>&1; then
        echo "✗ COMPILE FAILED"
        FAILED=$((FAILED + 1))
        COMPILE_FAILED=$((COMPILE_FAILED + 1))
        echo "9999 $filename COMPILE_FAILED" >> "$RESULTS_FILE"
        continue
    fi
    
    # Validate and categorize errors
    validation_output=$("$VALIDATOR" "$wasm_output" 2>&1)
    
    if [ -z "$validation_output" ]; then
        echo "✓ PASS"
        PASSED=$((PASSED + 1))
        continue
    fi
    
    # Count total errors
    error_count=$(echo "$validation_output" | grep -c "error:")
    
    # Categorize errors
    type_mismatch=$(echo "$validation_output" | grep -c "type mismatch")
    drop_errors=$(echo "$validation_output" | grep -c "type mismatch in drop")
    stack_unbalanced=$(echo "$validation_output" | grep -c "expected \[\] but got \[")
    local_range=$(echo "$validation_output" | grep -c "local variable out of range")
    global_range=$(echo "$validation_output" | grep -c "global variable out of range")
    invalid_opcode=$(echo "$validation_output" | grep -c "invalid opcode")
    func_sig=$(echo "$validation_output" | grep -c "function signature mismatch")
    unreachable=$(echo "$validation_output" | grep -c "unreachable")
    
    # Update global counters
    TYPE_MISMATCH_COUNT=$((TYPE_MISMATCH_COUNT + type_mismatch))
    DROP_ERRORS=$((DROP_ERRORS + drop_errors))
    STACK_UNBALANCED_COUNT=$((STACK_UNBALANCED_COUNT + stack_unbalanced))
    LOCAL_VAR_RANGE_COUNT=$((LOCAL_VAR_RANGE_COUNT + local_range))
    GLOBAL_VAR_RANGE_COUNT=$((GLOBAL_VAR_RANGE_COUNT + global_range))
    INVALID_OPCODE_COUNT=$((INVALID_OPCODE_COUNT + invalid_opcode))
    FUNCTION_SIGNATURE_COUNT=$((FUNCTION_SIGNATURE_COUNT + func_sig))
    UNREACHABLE_CODE_COUNT=$((UNREACHABLE_CODE_COUNT + unreachable))
    
    # Determine primary error category
    primary_error=""
    if [ $drop_errors -gt 0 ]; then
        primary_error="DROP($drop_errors)"
    elif [ $stack_unbalanced -gt 0 ]; then
        primary_error="STACK($stack_unbalanced)"
    elif [ $type_mismatch -gt 0 ]; then
        primary_error="TYPE($type_mismatch)"
    elif [ $local_range -gt 0 ]; then
        primary_error="LOCAL($local_range)"
    elif [ $global_range -gt 0 ]; then
        primary_error="GLOBAL($global_range)"
    elif [ $unreachable -gt 0 ]; then
        primary_error="UNREACH($unreachable)"
    else
        primary_error="OTHER"
        UNKNOWN_ERROR_COUNT=$((UNKNOWN_ERROR_COUNT + error_count))
    fi
    
    echo "✗ FAIL ($error_count errors: $primary_error)"
    FAILED=$((FAILED + 1))
    echo "$error_count $filename $primary_error" >> "$RESULTS_FILE"
done

echo ""
echo "Summary:"
echo "--------"
echo "Total:          $TOTAL"
echo "Passed:         $PASSED ($(( PASSED * 100 / TOTAL ))%)"
echo "Failed:         $FAILED"
echo "  Compile:      $COMPILE_FAILED"
echo "  Validation:   $((FAILED - COMPILE_FAILED))"
echo ""
echo "Error Breakdown:"
echo "----------------"
echo "Drop errors:         $DROP_ERRORS  (expected [any] but got [])"
echo "Stack unbalanced:    $STACK_UNBALANCED_COUNT  (expected [] but got [...])"
echo "Type mismatches:     $TYPE_MISMATCH_COUNT  (all other type errors)"
echo "Local var range:     $LOCAL_VAR_RANGE_COUNT"
echo "Global var range:    $GLOBAL_VAR_RANGE_COUNT"
echo "Invalid opcodes:     $INVALID_OPCODE_COUNT"
echo "Function sig:        $FUNCTION_SIGNATURE_COUNT"
echo "Unreachable code:    $UNREACHABLE_CODE_COUNT"
echo "Unknown errors:      $UNKNOWN_ERROR_COUNT"
echo ""

# Show top 5 most problematic files
echo "Most Problematic Files:"
echo "-----------------------"
if [ -f "$RESULTS_FILE" ]; then
    grep -v "COMPILE_FAILED" "$RESULTS_FILE" | sort -rn | head -5 | while read count file category; do
        echo "$count errors - $file ($category)"
    done
fi

rm -rf "$TEMP_DIR"
