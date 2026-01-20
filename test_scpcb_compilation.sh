#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCPCB_DIR="/Users/jack/Software/scp_port/scpcb"
COMPILER="/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm"
VALIDATOR="/opt/homebrew/bin/wasm-validate"
TEMP_DIR=$(mktemp -d)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$SCRIPT_DIR/compile_test_report_${TIMESTAMP}.txt"
BB_FILES="/tmp/bb_files.txt"
DETAILED_ERRORS_DIR="$TEMP_DIR/errors"
JSON_REPORT="$SCRIPT_DIR/compile_errors_${TIMESTAMP}.json"

mkdir -p "$DETAILED_ERRORS_DIR"

find "$SCPCB_DIR" -name "*.bb" -type f 2>/dev/null > "$BB_FILES"

cat > "$REPORT_FILE" << 'HEADER'
================================================================================
                    BLITZ3D-WASM SCPCB COMPILATION TEST REPORT
================================================================================
HEADER

echo "Date: $(date)" >> "$REPORT_FILE"
echo "Compiler: $COMPILER" >> "$REPORT_FILE"
echo "Validator: $VALIDATOR" >> "$REPORT_FILE"
echo "Source: $SCPCB_DIR" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

TOTAL=0
PASSED=0
FAILED=0
COMPILE_ERROR=0
VALIDATION_ERROR=0

TYPE_MISMATCH_COUNT=0
MISSING_RETURN_COUNT=0
LOCAL_VAR_RANGE_COUNT=0
GLOBAL_VAR_RANGE_COUNT=0
STACK_UNBALANCED_COUNT=0
INVALID_OPCODE_COUNT=0
TYPE_CONVERSION_COUNT=0
FUNCTION_SIGNATURE_COUNT=0
UNKNOWN_ERROR_COUNT=0

ERROR_FILES=""

increment_category() {
    local category="$1"
    case "$category" in
        "TYPE_MISMATCH") TYPE_MISMATCH_COUNT=$((TYPE_MISMATCH_COUNT + 1)) ;;
        "MISSING_RETURN") MISSING_RETURN_COUNT=$((MISSING_RETURN_COUNT + 1)) ;;
        "LOCAL_VAR_RANGE") LOCAL_VAR_RANGE_COUNT=$((LOCAL_VAR_RANGE_COUNT + 1)) ;;
        "GLOBAL_VAR_RANGE") GLOBAL_VAR_RANGE_COUNT=$((GLOBAL_VAR_RANGE_COUNT + 1)) ;;
        "STACK_UNBALANCED") STACK_UNBALANCED_COUNT=$((STACK_UNBALANCED_COUNT + 1)) ;;
        "INVALID_OPCODE") INVALID_OPCODE_COUNT=$((INVALID_OPCODE_COUNT + 1)) ;;
        "TYPE_CONVERSION") TYPE_CONVERSION_COUNT=$((TYPE_CONVERSION_COUNT + 1)) ;;
        "FUNCTION_SIGNATURE") FUNCTION_SIGNATURE_COUNT=$((FUNCTION_SIGNATURE_COUNT + 1)) ;;
        *) UNKNOWN_ERROR_COUNT=$((UNKNOWN_ERROR_COUNT + 1)) ;;
    esac
}

parse_validation_error() {
    local error_msg="$1"
    local category="UNKNOWN_ERROR"

    if echo "$error_msg" | grep -q "type mismatch"; then
        if echo "$error_msg" | grep -qE "(expected.*but got|initializer expression)"; then
            category="TYPE_CONVERSION"
        else
            category="TYPE_MISMATCH"
        fi
    elif echo "$error_msg" | grep -q "local variable out of range"; then
        category="LOCAL_VAR_RANGE"
    elif echo "$error_msg" | grep -q "global variable out of range"; then
        category="GLOBAL_VAR_RANGE"
    elif echo "$error_msg" | grep -qE "(expected.*but got|end of .* branch|end of loop)"; then
        category="STACK_UNBALANCED"
    elif echo "$error_msg" | grep -q "unknown opcode"; then
        category="INVALID_OPCODE"
    elif echo "$error_msg" | grep -q "function signature"; then
        category="FUNCTION_SIGNATURE"
    elif echo "$error_msg" | grep -qE "(expected \[\] but got|mismatch at end)"; then
        category="MISSING_RETURN"
    fi

    echo "$category"
}

get_error_suggestion() {
    local category="$1"
    local suggestion=""

    case "$category" in
        "TYPE_MISMATCH")
            suggestion="Check operand types in expressions. Ensure integers and floats are not mixed in operations."
            ;;
        "TYPE_CONVERSION")
            suggestion="Add explicit type conversion using Float() or Int() functions before the operation."
            ;;
        "STACK_UNBALANCED")
            suggestion="Control flow branches (if/else/while) must leave the stack in the same state. Check all paths return/pop values correctly."
            ;;
        "MISSING_RETURN")
            suggestion="Function branches return different stack heights. Ensure all code paths properly clean up the stack before returning."
            ;;
        "LOCAL_VAR_RANGE")
            suggestion="Too many local variables in function. Consider splitting into smaller functions or using globals."
            ;;
        "GLOBAL_VAR_RANGE")
            suggestion="Too many global variables. Consider consolidating or using arrays for related data."
            ;;
        "INVALID_OPCODE")
            suggestion="Compiler generated an invalid WASM instruction. This may indicate an unsupported language feature."
            ;;
        "FUNCTION_SIGNATURE")
            suggestion="Function call arguments don't match expected types. Check parameter ordering and types."
            ;;
        *)
            suggestion="Review the error message and check for unsupported Blitz3D features."
            ;;
    esac

    echo "$suggestion"
}

extract_error_context() {
    local error_msg="$1"
    local context=""

    if echo "$error_msg" | grep -qE "(f32\.|i32\.|f64\.)"; then
        context=$(echo "$error_msg" | grep -oE "(f32\.[a-z]+|i32\.[a-z]+|f64\.[a-z]+)" | head -1)
    elif echo "$error_msg" | grep -qE "if (true|false)"; then
        context=$(echo "$error_msg" | grep -oE "if (true|false)" | head -1)
    elif echo "$error_msg" | grep -qE "loop"; then
        context="loop"
    fi

    echo "$context"
}

echo "Blitz3D-WASM SCPCB Compilation Test"
echo "===================================="
echo "Date: $(date)"
echo "Source: $SCPCB_DIR"
echo ""

while IFS= read -r bb_file; do
    TOTAL=$((TOTAL + 1))
    filename=$(basename "$bb_file")
    relative_path="${bb_file#$SCPCB_DIR/}"

    output_wasm="$TEMP_DIR/${filename%.bb}.wasm"
    error_json="$DETAILED_ERRORS_DIR/${filename%.bb}.json"

    echo "[$TOTAL] Testing: $relative_path"

    compiler_stderr=$($COMPILER "$bb_file" -o "$output_wasm" 2>&1) && compile_success=true || compile_success=false

    if $compile_success; then
        if [ -f "$output_wasm" ]; then
            validation_output=$($VALIDATOR "$output_wasm" 2>&1) && validate_success=true || validate_success=false

            if $validate_success; then
                echo "  ✓ PASS"
                echo "----------------------------------------" >> "$REPORT_FILE"
                echo "File: $relative_path" >> "$REPORT_FILE"
                echo "Status: PASS" >> "$REPORT_FILE"
                size_bytes=$(stat -f%z "$output_wasm" 2>/dev/null || stat -c%s "$output_wasm" 2>/dev/null || echo "unknown")
                echo "Size: $size_bytes bytes" >> "$REPORT_FILE"
                PASSED=$((PASSED + 1))
            else
                echo "  ✗ VALIDATION FAILED"
                echo "----------------------------------------" >> "$REPORT_FILE"
                echo "File: $relative_path" >> "$REPORT_FILE"
                echo "Status: VALIDATION_ERROR" >> "$REPORT_FILE"
                VALIDATION_ERROR=$((VALIDATION_ERROR + 1))
                FAILED=$((FAILED + 1))

                errors_json_lines=""
                errors_temp=$(mktemp)
                echo "$validation_output" | grep "error:" > "$errors_temp"
                while IFS= read -r error_line; do
                    if [ -n "$error_line" ]; then
                        category=$(parse_validation_error "$error_line")
                        increment_category "$category"
                        suggestion=$(get_error_suggestion "$category")
                        context=$(extract_error_context "$error_line")

                        escaped_error=$(echo "$error_line" | sed 's/"/\\"/g')
                        escaped_suggestion=$(echo "$suggestion" | sed 's/"/\\"/g')

                        errors_json_lines="${errors_json_lines}
  {\"error\":\"${escaped_error}\",\"category\":\"${category}\",\"context\":\"${context}\",\"suggestion\":\"${escaped_suggestion}\"},"

                        echo "  Category: $category" >> "$REPORT_FILE"
                        echo "  Error: $error_line" >> "$REPORT_FILE"
                        echo "  Suggestion: $suggestion" >> "$REPORT_FILE"
                        echo "" >> "$REPORT_FILE"
                    fi
                done < "$errors_temp"
                rm -f "$errors_temp"

                errors_json_lines=$(echo "$errors_json_lines" | sed '$ s/,$//')
                errors_json="[${errors_json_lines}
]"

                cat > "$error_json" << EOF
{
  "file": "$relative_path",
  "status": "validation_failed",
  "timestamp": "$(date -Iseconds)",
  "errors": $errors_json
}
EOF

                ERROR_FILES="${ERROR_FILES}
$relative_path"
            fi
        else
            echo "  ✗ NO OUTPUT FILE"
            echo "----------------------------------------" >> "$REPORT_FILE"
            echo "File: $relative_path" >> "$REPORT_FILE"
            echo "Status: NO_OUTPUT" >> "$REPORT_FILE"
            COMPILE_ERROR=$((COMPILE_ERROR + 1))
            FAILED=$((FAILED + 1))

            cat > "$error_json" << EOF
{
  "file": "$relative_path",
  "status": "no_output",
  "timestamp": "$(date -Iseconds)",
  "errors": [{"error": "Compiler completed but no output file was produced", "category": "COMPILER_ERROR", "suggestion": "Check compiler stderr for details"}]
}
EOF

            ERROR_FILES="${ERROR_FILES}
$relative_path"
        fi
    else
        echo "  ✗ COMPILATION FAILED"
        echo "----------------------------------------" >> "$REPORT_FILE"
        echo "File: $relative_path" >> "$REPORT_FILE"
        echo "Status: COMPILATION_FAILED" >> "$REPORT_FILE"
        echo "Compiler output:" >> "$REPORT_FILE"
        echo "$compiler_stderr" | head -20 >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
        COMPILE_ERROR=$((COMPILE_ERROR + 1))
        FAILED=$((FAILED + 1))

        compiler_error=$(echo "$compiler_stderr" | head -5 | sed 's/"/\\"/g' | tr '\n' ' ')
        cat > "$error_json" << EOF
{
  "file": "$relative_path",
  "status": "compilation_failed",
  "timestamp": "$(date -Iseconds)",
  "errors": [{"error": "${compiler_error}", "category": "COMPILER_ERROR", "suggestion": "Review compiler output for syntax errors in source"}]
}
EOF

        ERROR_FILES="${ERROR_FILES}
$relative_path"
    fi
    echo "" >> "$REPORT_FILE"
done < "$BB_FILES"

echo "" >> "$REPORT_FILE"
echo "================================================================================" >> "$REPORT_FILE"
echo "                              CATEGORY BREAKDOWN                                " >> "$REPORT_FILE"
echo "================================================================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

[ "$TYPE_MISMATCH_COUNT" -gt 0 ] && echo "  TYPE_MISMATCH: $TYPE_MISMATCH_COUNT" >> "$REPORT_FILE"
[ "$MISSING_RETURN_COUNT" -gt 0 ] && echo "  MISSING_RETURN: $MISSING_RETURN_COUNT" >> "$REPORT_FILE"
[ "$LOCAL_VAR_RANGE_COUNT" -gt 0 ] && echo "  LOCAL_VAR_RANGE: $LOCAL_VAR_RANGE_COUNT" >> "$REPORT_FILE"
[ "$GLOBAL_VAR_RANGE_COUNT" -gt 0 ] && echo "  GLOBAL_VAR_RANGE: $GLOBAL_VAR_RANGE_COUNT" >> "$REPORT_FILE"
[ "$STACK_UNBALANCED_COUNT" -gt 0 ] && echo "  STACK_UNBALANCED: $STACK_UNBALANCED_COUNT" >> "$REPORT_FILE"
[ "$INVALID_OPCODE_COUNT" -gt 0 ] && echo "  INVALID_OPCODE: $INVALID_OPCODE_COUNT" >> "$REPORT_FILE"
[ "$TYPE_CONVERSION_COUNT" -gt 0 ] && echo "  TYPE_CONVERSION: $TYPE_CONVERSION_COUNT" >> "$REPORT_FILE"
[ "$FUNCTION_SIGNATURE_COUNT" -gt 0 ] && echo "  FUNCTION_SIGNATURE: $FUNCTION_SIGNATURE_COUNT" >> "$REPORT_FILE"
[ "$UNKNOWN_ERROR_COUNT" -gt 0 ] && echo "  UNKNOWN_ERROR: $UNKNOWN_ERROR_COUNT" >> "$REPORT_FILE"

echo "" >> "$REPORT_FILE"
echo "================================================================================" >> "$REPORT_FILE"
echo "                              FILES WITH ERRORS                                 " >> "$REPORT_FILE"
echo "================================================================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

echo "$ERROR_FILES" | grep -v "^$" | while IFS= read -r file; do
    echo "  - $file" >> "$REPORT_FILE"
done

echo "" >> "$REPORT_FILE"
echo "================================================================================" >> "$REPORT_FILE"
echo "                              DETAILED ERROR REPORTS                            " >> "$REPORT_FILE"
echo "================================================================================" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"

for error_file in "$DETAILED_ERRORS_DIR"/*.json; do
    if [ -f "$error_file" ]; then
        filename=$(basename "$error_file")
        echo "--- $filename ---" >> "$REPORT_FILE"
        cat "$error_file" >> "$REPORT_FILE"
        echo "" >> "$REPORT_FILE"
    fi
done

failed_files_json=$(echo "$ERROR_FILES" | grep -v "^$" | while read -r f; do echo "\"$f\""; done | tr '\n' ',' | sed 's/,$//')

cat > "$JSON_REPORT" << EOF
{
  "test_run": {
    "timestamp": "$(date -Iseconds)",
    "compiler": "$COMPILER",
    "validator": "$VALIDATOR",
    "source_directory": "$SCPCB_DIR"
  },
  "summary": {
    "total_files": $TOTAL,
    "passed": $PASSED,
    "failed": $FAILED,
    "compile_errors": $COMPILE_ERROR,
    "validation_errors": $VALIDATION_ERROR
  },
  "error_categories": {
    "TYPE_MISMATCH": $TYPE_MISMATCH_COUNT,
    "MISSING_RETURN": $MISSING_RETURN_COUNT,
    "LOCAL_VAR_RANGE": $LOCAL_VAR_RANGE_COUNT,
    "GLOBAL_VAR_RANGE": $GLOBAL_VAR_RANGE_COUNT,
    "STACK_UNBALANCED": $STACK_UNBALANCED_COUNT,
    "INVALID_OPCODE": $INVALID_OPCODE_COUNT,
    "TYPE_CONVERSION": $TYPE_CONVERSION_COUNT,
    "FUNCTION_SIGNATURE": $FUNCTION_SIGNATURE_COUNT,
    "UNKNOWN_ERROR": $UNKNOWN_ERROR_COUNT
  },
  "failed_files": [${failed_files_json}]
}
EOF

rm -rf "$TEMP_DIR"

pass_rate=$(echo "scale=1; $PASSED * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")

echo ""
echo "====================================="
echo "           TEST RESULTS             "
echo "====================================="
echo "Total files tested: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "  - Compile errors: $COMPILE_ERROR"
echo "  - Validation errors: $VALIDATION_ERROR"
echo ""
echo "Pass rate: $pass_rate%"
echo ""
echo "Error categories:"
[ "$TYPE_MISMATCH_COUNT" -gt 0 ] && echo "  TYPE_MISMATCH: $TYPE_MISMATCH_COUNT"
[ "$MISSING_RETURN_COUNT" -gt 0 ] && echo "  MISSING_RETURN: $MISSING_RETURN_COUNT"
[ "$LOCAL_VAR_RANGE_COUNT" -gt 0 ] && echo "  LOCAL_VAR_RANGE: $LOCAL_VAR_RANGE_COUNT"
[ "$GLOBAL_VAR_RANGE_COUNT" -gt 0 ] && echo "  GLOBAL_VAR_RANGE: $GLOBAL_VAR_RANGE_COUNT"
[ "$STACK_UNBALANCED_COUNT" -gt 0 ] && echo "  STACK_UNBALANCED: $STACK_UNBALANCED_COUNT"
[ "$INVALID_OPCODE_COUNT" -gt 0 ] && echo "  INVALID_OPCODE: $INVALID_OPCODE_COUNT"
[ "$TYPE_CONVERSION_COUNT" -gt 0 ] && echo "  TYPE_CONVERSION: $TYPE_CONVERSION_COUNT"
[ "$FUNCTION_SIGNATURE_COUNT" -gt 0 ] && echo "  FUNCTION_SIGNATURE: $FUNCTION_SIGNATURE_COUNT"
[ "$UNKNOWN_ERROR_COUNT" -gt 0 ] && echo "  UNKNOWN_ERROR: $UNKNOWN_ERROR_COUNT"
echo ""
echo "Reports:"
echo "  - Text report: $REPORT_FILE"
echo "  - JSON report: $JSON_REPORT"
