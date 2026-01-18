#!/bin/bash

# validate_compiler.sh
# Compiles a Blitz3D (.bb) file to WASM and validates the output using wasm-validate.

# Check for wasm-validate
if ! command -v wasm-validate &> /dev/null; then
    echo "Error: wasm-validate not found. Please install WABT (brew install wabt)."
    exit 1
fi

if [ $# -eq 0 ]; then
    echo "Usage: $0 <input.bb>"
    exit 1
fi

INPUT_FILE=$1
# Create a temp directory for output
OUTPUT_WASM="temp_output.wasm"

echo "---------------------------------------------------"
echo "Testing: $INPUT_FILE"

# 1. Build the compiler (ensure it's up to date)
echo "Building compiler..."
swift build -c debug > /dev/null 2>&1

# 2. Compile .bb to .wasm
echo "Compiling to WASM..."
./.build/debug/blitz3d-wasm "$INPUT_FILE" -o "$OUTPUT_WASM" > compile_log.txt 2>&1

if [ $? -ne 0 ]; then
    echo "❌ Compiler Failed!"
    cat compile_log.txt
    rm -f "$OUTPUT_WASM" compile_log.txt
    exit 1
fi

# 3. Validate the output
echo "Validating WASM..."
VALIDATE_OUT=$(wasm-validate "$OUTPUT_WASM" 2>&1)

if [ $? -eq 0 ]; then
    echo "✅ Success: WASM is valid!"
else
    echo "❌ Validation Error!"
    echo "$VALIDATE_OUT"
    exit 1
fi

# Cleanup
rm -f "$OUTPUT_WASM" compile_log.txt
echo "---------------------------------------------------"
