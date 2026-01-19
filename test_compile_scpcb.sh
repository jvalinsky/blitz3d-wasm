#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCPCB_DIR="/Users/jack/Software/scp_port/scpcb"
COMPILER="/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm"
VALIDATOR="/opt/homebrew/bin/wasm-validate"
TEMP_DIR=$(mktemp -d)
REPORT_FILE="$SCRIPT_DIR/compile_test_report.txt"
BB_FILES="/tmp/bb_files.txt"

find "$SCPCB_DIR" -name "*.bb" -type f 2>/dev/null > "$BB_FILES"

echo "Blitz3D WASM Compilation Test Report" > "$REPORT_FILE"
echo "=====================================" >> "$REPORT_FILE"
echo "Date: $(date)" >> "$REPORT_FILE"
echo "Source: $SCPCB_DIR" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

TOTAL=0
PASSED=0
FAILED=0
COMPILE_ERROR=0
VALIDATION_ERROR=0
TYPE_MISMATCH=0
MISSING_RETURN=0
LOCAL_VAR_RANGE=0

while IFS= read -r bb_file; do
    TOTAL=$((TOTAL + 1))
    filename=$(basename "$bb_file")

    output_wasm="$TEMP_DIR/${filename%.bb}.wasm"
    stderr_output="$TEMP_DIR/${filename%.bb}.stderr"

    echo "Testing: $filename"

    compiler_output=$($COMPILER "$bb_file" -o "$output_wasm" 2>&1) && compile_success=true || compile_success=false

    if $compile_success; then
        if [ -f "$output_wasm" ]; then
            validation_output=$($VALIDATOR "$output_wasm" 2>&1) && validate_success=true || validate_success=false
            if $validate_success; then
                echo "  ✓ Compilation successful, WASM valid"
                echo "----------------------------------------" >> "$REPORT_FILE"
                echo "File: $bb_file" >> "$REPORT_FILE"
                echo "Result: PASS" >> "$REPORT_FILE"
                PASSED=$((PASSED + 1))
            else
                echo "  ✗ WASM validation failed"
                echo "----------------------------------------" >> "$REPORT_FILE"
                echo "File: $bb_file" >> "$REPORT_FILE"
                echo "Result: VALIDATION FAILED" >> "$REPORT_FILE"
                VALIDATION_ERROR=$((VALIDATION_ERROR + 1))
                FAILED=$((FAILED + 1))

                if echo "$validation_output" | grep -q "type mismatch"; then
                    TYPE_MISMATCH=$((TYPE_MISMATCH + 1))
                    echo "Category: TYPE MISMATCH" >> "$REPORT_FILE"
                fi
                if echo "$validation_output" | grep -q "expected.*but got"; then
                    MISSING_RETURN=$((MISSING_RETURN + 1))
                    echo "Category: MISSING RETURN" >> "$REPORT_FILE"
                fi
                if echo "$validation_output" | grep -q "local variable out of range"; then
                    LOCAL_VAR_RANGE=$((LOCAL_VAR_RANGE + 1))
                    echo "Category: LOCAL VAR RANGE" >> "$REPORT_FILE"
                fi

                echo "Sample errors:" >> "$REPORT_FILE"
                echo "$validation_output" | grep "error:" | head -3 >> "$REPORT_FILE"
            fi
        else
            echo "  ✗ Output file not created"
            echo "----------------------------------------" >> "$REPORT_FILE"
            echo "File: $bb_file" >> "$REPORT_FILE"
            echo "Result: NO OUTPUT" >> "$REPORT_FILE"
            FAILED=$((FAILED + 1))
        fi
    else
        echo "  ✗ Compilation failed"
        echo "----------------------------------------" >> "$REPORT_FILE"
        echo "File: $bb_file" >> "$REPORT_FILE"
        echo "Result: COMPILATION FAILED" >> "$REPORT_FILE"
        COMPILE_ERROR=$((COMPILE_ERROR + 1))
        FAILED=$((FAILED + 1))
    fi
    echo "" >> "$REPORT_FILE"
done < "$BB_FILES"

rm -rf "$TEMP_DIR"

echo "" >> "$REPORT_FILE"
echo "=====================================" >> "$REPORT_FILE"
echo "Summary" >> "$REPORT_FILE"
echo "=====================================" >> "$REPORT_FILE"
echo "Total files tested: $TOTAL" >> "$REPORT_FILE"
echo "Passed: $PASSED" >> "$REPORT_FILE"
echo "Failed: $FAILED" >> "$REPORT_FILE"
echo "  - Compile errors: $COMPILE_ERROR" >> "$REPORT_FILE"
echo "  - Validation errors: $VALIDATION_ERROR" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Validation error breakdown:" >> "$REPORT_FILE"
echo "  Type mismatches: $TYPE_MISMATCH" >> "$REPORT_FILE"
echo "  Missing returns: $MISSING_RETURN" >> "$REPORT_FILE"
echo "  Local var range: $LOCAL_VAR_RANGE" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "Passing files:" >> "$REPORT_FILE"
grep -B1 "Result: PASS" "$REPORT_FILE" | grep "File:" | sed 's/.*File: //' | sort -u >> "$REPORT_FILE"

echo ""
echo "====================================="
echo "Summary"
echo "====================================="
echo "Total files tested: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "  - Compile errors: $COMPILE_ERROR"
echo "  - Validation errors: $VALIDATION_ERROR"
echo ""
echo "Validation error breakdown:"
echo "  Type mismatches: $TYPE_MISMATCH"
echo "  Missing returns: $MISSING_RETURN"
echo "  Local var range: $LOCAL_VAR_RANGE"
echo ""
echo "Passing files:"
grep -B1 "Result: PASS" "$REPORT_FILE" | grep "File:" | sed 's/.*File: //' | sort -u

echo ""
echo "Full report: $REPORT_FILE"
