# Detailed Execution Plan: Phase 3 - Final Integration and Promotion

## Current Progress (Jan 23 2026)

- ✅ **IR Infrastructure**: Complete with `indirect` recursion support.
- ✅ **Lowering**: AST → IR pass verified.
- ✅ **Emitter**: WASM instruction emitter verified for values and loops.
- ✅ **Integration**: CLI flag `--use-ir` verified.
- ✅ **Verification**:
  - `ParserTests`: 30/30 PASS.
  - `WASMValidationTests`: 39/39 PASS.
  - `IRPipelineTests`: 4/4 PASS (verified stack neutrality).
  - `IRTypeTests` & `IRBuilderTests`: 6/6 PASS.
- ✅ **Multi-dimensional Arrays**: Support for flattened indexing implemented
  and verified.
- ✅ **Phase 1 Verification**: `wasm-validate` passed on compiled
  `test_hello.bb`, `test_flow.bb`, and `test_arrays.bb`.

## Status Update (Jan 26 2026)

### What We Ran

- [x] Build compiler: `swift build -c debug`
- [x] Compile SCPCB `MapSystem.bb` with Typed IR:
  - `./.build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/MapSystem.bb --use-ir -o /tmp/MapSystem.wasm`
  - Output artifact: `/tmp/MapSystem.wasm` (sha256:
    `f54e6e992ec8a0f2672bdbff2a4da9aeb909206906cd2f99e07e1817cce3e2d0`)
- [x] Validate: `wasm-validate /tmp/MapSystem.wasm` **FAILED**

### What Failed (High-Level)

- Massive `wasm-validate` error output including:
  - `type mismatch in drop, expected [any] but got []` (dropping when stack is
    empty / void-value confusion)
  - `type mismatch in call, expected [...] but got []` (missing arguments due to
    earlier stack corruption)
  - `i32.*` fed `f32` / `f32.*` fed `i32` (missing or incorrect coercions, or
    wrong typed op selection)
  - `type mismatch ... at end of block` and `type mismatch in return`
    (inconsistent block results / missing return value)

## Phase 3: Integration and Promotion

### 1. IR Logic Polishing

- **For Loops**: Refine `forStmt` to handle negative steps and complex bounds.
- **String Literals**: Prevent duplicate allocations for identical literals
  (Deduplication implemented).
- **Arrays**: Handle proper bounds checking.

### 2. Multi-File Symbol Resolution

- **Goal**: Treat `Include` files as part of a single compilation unit.
- **Action**:
  - Aggregate all `TypeNode`s and `GlobalNode`s from all files into the
    `IRModule`.
  - Ensure `ASTLowering` can resolve symbols across file boundaries.

### 3. Differential Integration Testing

- **Action**: Compile `scpcb/UpdateEvents.bb` with `--use-ir` and verify with
  `wasm-validate`.
- **Action**: Run simple integration tests in the browser runtime using the
  IR-generated WASM.

### 4. Promotion to Default

- **Action**: Swap the primary `generate()` method to use the IR pipeline.
- **Action**: Rename legacy generator to `generateLegacy()`.
- **Action**: Remove `StatementGeneration.swift` and
  `ExpressionGeneration.swift` once all edge cases are parity-complete.
