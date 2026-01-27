# Debugging Report: WASM Validation and Control Flow Fixes

**Timestamp:** Sun Jan 18 18:09:05 EST 2026
**Reference Commit Hash:** f2dd13e52ef6fbfba9ab97e8de7005a27c13d065

## Executive Summary
This report documents the resolution of critical WebAssembly (WASM) generation bugs that caused produced binaries to fail validation. The fixes spanned control flow logic, type systems, and function call handling.

## 1. Control Flow Integrity
### Issues
- **Invalid Branch Targets:** `br` and `br_if` instructions were emitted without surrounding `block` or `loop` structures, causing "invalid branch depth" errors in WASM runtimes.
- **Instruction Leakage:** `generateStatementBlock` was incorrectly appending instructions to the parent function body during recursion, causing duplicate code to appear *before* the intended `if` or `loop` opcode.

### Solutions
- **Structural Wrapping:** Updated `while`, `for`, `repeat`, and `forEach` loops to correctly emit the `block` -> `loop` -> `body` hierarchy.
- **Depth Tracking:** Implemented a `currentDepth` and `loopExitDepths` stack in `StatementGeneration` to dynamically calculate the correct branch index for the Blitz3D `Exit` statement.
- **State Isolation:** Refactored block generation to use a temporary instruction buffer, preventing leakage into the main function body.

## 2. Type System and Stack Validation
### Issues
- **Type Mismatches:** Blitz3D allows implicit mixing of Integers and Floats. WASM requires explicit conversion (e.g., `f32.convert_i32_s`).
- **Stack Underflow/Overflow:** Function calls with missing optional arguments resulted in the wrong number of values on the WASM stack.
- **Case Sensitivity:** Blitz3D is case-insensitive, but the compiler's lookup tables were case-sensitive, leading to "function not found" errors and default (incorrect) type assumptions.

### Solutions
- **Implicit Conversion Logic:** Added a `convert(from:to:)` utility that automatically emits the necessary WASM conversion opcodes during assignments, binary operations, and function calls.
- **Function Signature Awareness:** Implemented a pre-pass in the `CodeGenerator` to register all function signatures (builtin and user-defined) into a `functionDefinitions` map.
- **Default Parameter Padding:** Updated the function call generator to automatically push `0` or `0.0` for any missing optional parameters defined in the signature.
- **Case-Insensitive Registry:** Standardized all function and variable lookups to use lowercased keys.

## 3. Tooling and Verification
### Issues
- Lack of automated validation for generated binaries.

### Solutions
- **Validation Script:** Created `validate_compiler.sh` which integrates `wasm-validate` (from WABT) into the build process.
- **Standardized Text Output:** Updated `WASMTextWriter` to use standard `end` keywords instead of non-standard parentheses, improving compatibility with third-party tools like `wat2wasm`.

## Final Results
All primary integration tests now pass full WASM validation:
- `hello.bb`: ✅ PASS
- `MainTest.bb`: ✅ PASS
- `Phase3Test.bb`: ✅ PASS
- `Animation_Test.bb`: ✅ PASS
- `FPS_Test.bb`: ✅ PASS
- `Lighting_Test.bb`: ✅ PASS
