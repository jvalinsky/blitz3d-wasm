# Phase 3: Final Integration and Promotion Plan

This document outlines the final steps required to move the Typed IR pipeline
from "experimental" to "default," ensuring 100% semantic parity with Blitz3D and
robust WASM validation.

## 1. Logic Polishing (Functional Parity)

### 1.1 Complete Loop Semantics

- **Goal**: Ensure `For` loops behave exactly like Blitz3D (handling negative
  steps and floating point bounds).
- **Tasks**:
  - Update `IREmitter.forStmt` to check step sign at runtime (or compile time if
    constant).
  - Implement "Repeat...Until" and "Repeat...Forever" edge cases.
  - Verify `Exit` (Break) correctly targets the current innermost loop label in
    WASM.

### 1.2 Multi-dimensional Arrays

- **Goal**: Full support for `Dim A(10, 10)`.
- **Tasks**:
  - Implement array offset calculation in `IREmitter`:
    `address = base + (index1 * dim2_size + index2) * elementSize`.
  - Update `ASTLowering` to correctly lower multi-index `arrayAccess` nodes.

### 1.3 User-Defined Types (Objects)

- **Goal**: Stable pointer math for Blitz3D Types.
- **Tasks**:
  - Verify `New(Type)`, `Delete(obj)`, and `First(Type)` nodes.
  - Ensure `LoadField` and `StoreField` correctly handle type-checked offsets.
  - Implement `ObjectCast` and `Handle` logic.

### 1.4 String Literal Optimization

- **Goal**: Reduce binary size and ensure string safety.
- **Tasks**:
  - Implement string deduplication in `ASTLowering` (one data segment per unique
    literal).
  - Ensure all strings are null-terminated and 4-byte aligned in the data
    section.

## 2. Differential Integration Testing

### 2.1 The "SCPCB" Benchmark

- **Action**: Compile the following critical SCPCB modules using `--use-ir`:
  - [ ] `scpcb/UpdateEvents.bb`
  - [ ] `scpcb/NPCs.bb`
  - [x] `scpcb/MapSystem.bb` (attempted Jan 26 2026; currently fails
        `wasm-validate`)
- **Success Criteria**:
  - `wasm-validate` returns zero errors (guaranteed stack neutrality).
  - `StackValidator` confirms identical stack heights at all join points.

### 2.2 Behavior Verification

- **Action**: Run `Tests/IntegrationTests/simple.bb` in the JS runtime.
- **Action**: Manually verify that output matches the legacy pipeline for
  math-heavy code.

## 3. Migration and Cleanup

### 3.1 Default Switchover

- **Action**: Rename the existing `generate(from:)` method in
  `CodeGenerator.swift` to `generateLegacy(from:)`.
- **Action**: Promote `generateFromIR(from:)` to be the primary
  `generate(from:)` implementation.
- **Action**: Update the CLI so `--use-ir` is on by default, and add
  `--legacy-codegen` for fallback.

### 3.2 Code Removal

- **Action**: Delete `Sources/Compiler/CodeGen/ExpressionGeneration.swift`.
- **Action**: Delete `Sources/Compiler/CodeGen/StatementGeneration.swift`.
- **Reasoning**: These files are redundant once the IR pipeline is stable and
  contain the "guess-and-drop" heuristics we are eliminating.

## 4. Timeline and Ownership

| Task                 | Effort | Priority |
| -------------------- | ------ | -------- |
| Loop/Array Polishing | 4h     | CRITICAL |
| String Deduplication | 2h     | MEDIUM   |
| Type/Object Parity   | 4h     | HIGH     |
| SCPCB Validation     | 4h     | HIGH     |
| Legacy Cleanup       | 2h     | LOW      |

**Next Immediate Task**: Implement multi-dimensional array index lowering in
`ASTLowering.swift`.
