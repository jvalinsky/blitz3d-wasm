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
- ✅ **Multi-dimensional Arrays**: Support for flattened indexing implemented and verified.
- ✅ **Phase 1 Verification**: `wasm-validate` passed on compiled `test_hello.bb`, `test_flow.bb`, and `test_arrays.bb`.

## Phase 3: Integration and Promotion

### 1. IR Logic Polishing
- **For Loops**: Refine `forStmt` to handle negative steps and complex bounds.
- **String Literals**: Prevent duplicate allocations for identical literals (Deduplication implemented).
- **Arrays**: Handle proper bounds checking.

### 2. Multi-File Symbol Resolution
- **Goal**: Treat `Include` files as part of a single compilation unit.
- **Action**: 
    - Aggregate all `TypeNode`s and `GlobalNode`s from all files into the `IRModule`.
    - Ensure `ASTLowering` can resolve symbols across file boundaries.

### 3. Differential Integration Testing
- **Action**: Compile `scpcb/UpdateEvents.bb` with `--use-ir` and verify with `wasm-validate`.
- **Action**: Run simple integration tests in the browser runtime using the IR-generated WASM.

### 4. Promotion to Default
- **Action**: Swap the primary `generate()` method to use the IR pipeline.
- **Action**: Rename legacy generator to `generateLegacy()`.
- **Action**: Remove `StatementGeneration.swift` and `ExpressionGeneration.swift` once all edge cases are parity-complete.
