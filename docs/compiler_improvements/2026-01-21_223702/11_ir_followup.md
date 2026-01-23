# Detailed Execution Plan: Phase 2 - Verification and Polishing

## Current Progress (Jan 23 2026)
- ✅ **IR Infrastructure**: Types, Nodes, and Builder are complete.
- ✅ **Lowering**: AST → IR pass implemented.
- ✅ **Emitter**: Initial IR → WASM instruction emitter created.
- ✅ **Integration**: Wired into `CodeGenerator` and CLI with `--use-ir` flag.
- ✅ **Test Fixes**: `ParserTests.swift` syntax errors resolved.

## Phase 2: Verification (Blocked by Environment)

### 1. Build and Unit Test
- **Action**: Run `swift build` and `swift test` in a standard macOS terminal (non-nix).
- **Success Criteria**: 
  - Zero compilation errors.
  - `ParserTests` pass.
  - `IRTypeTests` (if added) pass.

### 2. IR Logic Polishing
- **For Loops**: Complete `forStmt` implementation in `IREmitter.swift`.
  - Need to look up local variable index for the loop variable.
  - Implement the `block` + `loop` + `br_if` + `br` structure.
- **String Literals**: Implement `allocateString` in `ASTLowering.swift`.
  - Must add the string to the data section.
  - Return the offset as `constStringPtr`.
- **Arrays**: Refine `assignArray` and `loadArray` in `IREmitter.swift`.
  - Ensure correct offset calculation (base + index * elementSize).

### 3. Integration Testing
- **Differential Testing**:
  - Compile `Tests/IntegrationTests/simple.bb` with and without `--use-ir`.
  - Verify both `.wasm` files validate using `wasm-validate`.
  - Verify behavior is identical using the JS runner.
- **Complexity Escalation**:
  - Test with `scpcb/UpdateEvents.bb`.
  - Verify stack neutrality using `StackValidator`.

## Roadmap to Default IR

1. **Verify Correctness**: Pass all integration tests with `--use-ir`.
2. **Handle Edge Cases**: User-defined types, multi-dimensional arrays, recursion.
3. **Deprecate Old Path**: Rename `generate()` to `generateDirectly()` and make `generateFromIR()` the primary `generate()` method.
4. **Optimization**: Add stack scheduling (Koopman) to the IR emitter output.

## Blockers
- **Nix SDK Mismatch**: `Apple Swift version 6.2.3` vs `14.4 SDK`. Need to run outside nix shell.
