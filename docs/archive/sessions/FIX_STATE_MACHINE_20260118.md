# Debugging Report: State Machine and WASM Validation Fixes

**Timestamp:** Sun Jan 18 19:08:37 EST 2026 **Reference Commit Hash:**
989000afcf4d9e3192a9e64ec58cc0c4182f7b52

## 1. Issue: CodeGenerator.swift Corruption

### Problem

A previous coding session left redundant code fragments and top-level
expressions in `Sources/Compiler/CodeGen/CodeGenerator.swift`. This prevented
the project from compiling and caused extraneous code to be emitted into the
`Main` function.

### Fix

Manually cleaned up the file by removing redundant `generateMainFunction`,
`generateFunction`, and `addAllocFunction` implementations. Standardized the
`Main` entry point to use a `void` return type.

## 2. Issue: `__StringAlloc` Stack Imbalance

### Problem

The internal helper function `__StringAlloc` was pushing the base pointer to the
stack before performing arithmetic, but then failing to consume all intermediate
values. This left an extra value on the WebAssembly stack, causing validation
failure (`stack overflow` or `type mismatch`).

### Fix

Corrected the instruction sequence in `addAllocFunction` and `addStringAlloc` to
ensure all intermediate values are consumed by `i32.add` or `global.set`,
leaving exactly one return value on the stack.

## 3. Issue: State Machine Branch Depth

### Problem

The state machine used to handle Blitz3D `Goto` and `Gosub` was failing
validation with `invalid depth` errors.

- **Inconsistent Nesting:** `br 1` was being used to target a loop that was only
  0 or 1 levels deep depending on whether an `if` block was present.
- **Leakage:** Functions without `Goto` were still trying to emit state machine
  transition code, resulting in branches to non-existent blocks.

### Fix

- **Structured Nesting:** Wrapped the state machine in a explicit `block` ->
  `loop` hierarchy.
- **Targeted Branching:** Updated `generateChunk` to use `br 1` to target the
  surrounding dispatcher loop specifically.
- **Termination State:** Added a check for `gotoState == -1` at the head of the
  loop to allow clean exiting of the state machine.
- **Conditional Activation:** Modified `StatementGeneration.swift` to only emit
  `Return` and `Goto` logic if a `gotoStateLocalIdx` is actually registered for
  that function.

## 4. Results

All key test cases now pass full `wasm-validate` verification:

- `Tests/GotoTest.bb`: ✅ PASS (Structured state machine)
- `Tests/SimpleTest.bb`: ✅ PASS (Clean entry point)
- `Examples/hello/hello.bb`: ✅ PASS (Standard control flow)
- Integration Tests: ✅ PASS (4/4)
