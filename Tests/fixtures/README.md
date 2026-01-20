# Test Fixtures for Blitz3D → WASM Compiler

This directory contains minimal test cases for validating compiler behavior. Each test is a standalone `.bb` file that can be compiled and validated independently.

## Directory Structure

### `type_system/`
Tests related to type inference, type suffixes, and type conversions.

- **test_float_global.bb** - Basic global variable with float suffix
- **test_float_mismatch.bb** - Global with suffix, assigned without suffix
- **test_float_noinit.bb** - Global float without initializer
- **test_float_nosen.bb** - Use variable without suffix, then assign with suffix
- **test_global_int_init.bb** - Float global with integer literal initializer
- **test_suffix_same_var.bb** - Verify `x` and `x#` refer to same variable (Blitz3D semantics)
- **test_real_pattern.bb** - Real pattern from Menu.bb that was failing
- **test_convert.bb** - Type conversion between int and float
- **test_autodecl.bb** - Auto-declaration of implicit globals

### `stack_balance/`
Tests for WASM stack balancing in control flow structures.

- **test_balance.bb** - Basic stack balance test
- **test_balance2.bb** - More complex stack balance patterns

### `control_flow/`
Tests for if/else, loops, and control flow constructs.

- **test_complex_if_else.bb** - Nested if-else with multiple branches
- **test_if_else_func.bb** - Function calls in if-else branches

### `regression/`
Tests created during debugging sessions to reproduce specific bugs. These serve as regression tests to prevent bugs from reappearing.

## Usage

### Compile a single test:
```bash
swift run blitz3d-wasm Tests/fixtures/type_system/test_float_global.bb -o /tmp/test.wasm
```

### Validate the output:
```bash
wasm-validate /tmp/test.wasm
```

### Run all fixture tests:
```bash
for f in Tests/fixtures/**/*.bb; do
  echo "Testing $f..."
  swift run blitz3d-wasm "$f" -o /tmp/test.wasm 2>&1 | grep -q "Wrote WASM" && \
  wasm-validate /tmp/test.wasm && echo "✅ PASS" || echo "❌ FAIL"
done
```

## Test Categories

### Type System Issues (Fixed in Session 7)
- **Problem**: Variables with type suffixes (`#`, `%`, `$`) were not preserving type information
- **Solution**: Forward type inference + suffix-first lookup strategy
- **Tests**: All tests in `type_system/` directory

### Stack Balance Issues (Fixed in Session 6-7)
- **Problem**: Control flow structures leaving orphaned values on stack
- **Solution**: Implemented calculateStackDelta() and balanceStack() helpers
- **Tests**: All tests in `stack_balance/` directory

### Stack Overflow (Fixed in Session 7)
- **Problem**: Main.bb with 372 nesting levels caused Swift stack overflow
- **Solution**: Iterative if-chain processing + 256MB stack size
- **Note**: No specific fixture test (requires pathological nesting)

## Creating New Tests

When you encounter a bug:

1. Create a minimal reproduction case in the appropriate directory
2. Document what the test validates in this README
3. Add it to the test suite if automated testing is set up

Example:
```blitz3d
; test_new_bug.bb - Description of what this tests
Global x# = 5.5
Print x
```

## Notes

- All tests are minimal - they should be as small as possible while still reproducing the issue
- Tests should be self-contained (no includes or dependencies)
- Tests should either compile successfully or fail with a specific expected error
- Validation with `wasm-validate` is the source of truth for correctness
