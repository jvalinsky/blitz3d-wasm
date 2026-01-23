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

## Phase 3: Integration and Promotion

### 1. IR Logic Polishing
- **For Loops**: Refine `forStmt` to handle negative steps and complex bounds.
- **String Literals**: Prevent duplicate allocations for identical literals.
- **Arrays**: Handle multi-dimensional arrays and proper bounds checking.

### 2. Differential Integration Testing
- **Action**: Compile `scpcb/UpdateEvents.bb` with `--use-ir` and verify with `wasm-validate`.
- **Action**: Run simple integration tests in the browser runtime using the IR-generated WASM.

### 3. Promotion to Default
- **Action**: Swap the primary `generate()` method to use the IR pipeline.
- **Action**: Rename legacy generator to `generateLegacy()`.
- **Action**: Remove `StatementGeneration.swift` and `ExpressionGeneration.swift` once all edge cases (Types, Globals) are parity-complete.

## Roadmap to Default IR

1. **Verify Correctness**: Pass all integration tests with `--use-ir`.
2. **Handle Edge Cases**: User-defined types, multi-dimensional arrays, recursion.
3. **Deprecate Old Path**: Rename `generate()` to `generateDirectly()` and make `generateFromIR()` the primary `generate()` method.
4. **Optimization**: Add stack scheduling (Koopman) to the IR emitter output.

## Blockers
- **Nix SDK Mismatch**: `Apple Swift version 6.2.3` vs `14.4 SDK`. Need to run outside nix shell.
