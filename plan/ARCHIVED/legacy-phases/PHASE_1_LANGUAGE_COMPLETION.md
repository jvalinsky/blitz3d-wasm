# Phase 1: Language Completion (Infrastructure)

This phase focuses on core Blitz3D language features required for the SCP:CB
"infrastructure" code (like `StrictLoads.bb` and `Difficulty.bb`).

## 1. Type Field Arrays

SCP:CB frequently defines arrays within Types to store fixed-size data (e.g.,
bone indices, neighbor rooms).

### Tasks:

- [ ] **Parser:** Update `parseTypeDeclaration` in `Parser.swift` to handle
      optional `[expression]` after a field name.
- [ ] **AST:** Update `FieldNode` to include an optional `dimensions` property.
- [ ] **CodeGen:** Update `processTypeDeclarations` in `CodeGenerator.swift` to:
  - Evaluate the array size.
  - Multiply the field size by the array length when calculating offsets.
- [ ] **Statement Generation:** Update `generateFieldAccess` to support indexing
      if the field is an array.

## 2. Field Default Values

Initializes fields with values at the time of `New`.

### Tasks:

- [ ] **Parser:** Update `parseTypeDeclaration` to support optional
      `= expression` after field definitions.
- [ ] **AST:** Update `FieldNode` to store an optional `defaultValue`
      expression.
- [ ] **CodeGen:** Update the `New` opcode implementation (likely a helper
      function) to emit instructions that initialize fields with their default
      values upon allocation.

## 3. Object & Handle Casting

Allows instances to be treated as integers for passing through generic systems.

### Tasks:

- [ ] **CodeGen:** Implement `Handle(instance)`:
  - Return the memory pointer of the instance as an `i32`.
- [ ] **CodeGen:** Implement `Object.Type(handle)`:
  - Cast the `i32` handle back to a pointer of the specified Type.
  - Add safety check: Verify the `typeID` header at the handle matches the
    expected Type's `typeID`.

## 4. Multi-Value Case Statements

Support for `Case 1, 2, 3` and `Case x To y`.

### Tasks:

- [ ] **Parser:** Update `parseSelectStatement` to collect multiple expressions
      per `CaseNode`.
- [ ] **Statement Generation:** Update `generateSelect` to emit multiple
      equality checks (or a range check for `To`) for a single case block.

## Verification

- Validate `Difficulty.bb` from SCP:CB source.
- Create unit tests for Type Field Arrays and Handle/Object casting.
