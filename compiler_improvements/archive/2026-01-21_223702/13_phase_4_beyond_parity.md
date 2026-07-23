# Phase 4: Beyond the IR Foundation

With the core Typed IR pipeline operational and verified, we shift focus to
semantic completeness, multi-file builds, and runtime integration for SCPCB.

## 1. Semantic Completeness (The "Long Tail")

### 1.1 Default Argument Synthesis (P0)

- **Context**: Blitz3D allows calls like `Graphics3D(800, 600)`. Our current IR
  expects all 4 parameters.
- **Action**: Update `ASTLowering.lowerFunctionCall` to query
  `SignatureResolver` for default values.
- **Mechanism**: If `args.count < signature.params.count`, append `ConstI32` or
  `ConstF32` nodes for the missing tail.

### 1.2 Full "Object" Support (P1)

- **Context**: `New`, `Delete`, `First`, `Last`, `Before`, `After`, `Handle`,
  `Object`.
- **Action**:
  - Implement type-specific linked-list pointers in the WASM memory layout.
  - Lower `New(T)` to a runtime allocator call + initialization of hidden
    `next/prev` pointers.
  - Lower `Delete(obj)` to a runtime deallocator that unlinks the object.

### 1.3 `Select Case` with Ranges (P2)

- **Goal**: Handle `Case 1 To 10`.
- **Action**: Expand these into IR `If` chains or a optimized `br_table` if
  contiguous.

## 2. Multi-File and Scalability (P0)

### 2.1 Entrypoint-Driven Compilation

- **Goal**: Stop compiling files in isolation.
- **Action**:
  - Update `main.swift` to accept a single entry file.
  - Use the `Preprocessor` to build a single `ProgramNode` containing all
    symbols.
  - **Crucial**: Spans must track the source file name to enable multi-file
    source maps.

### 2.2 Global Initialization

- **Goal**: Correctly initialize `Global x = 100` across all files.
- **Action**: Create a `__bb_init_globals` WASM function that executes all
  top-level assignments before `Main`.

## 3. Tooling and DevX (P1)

### 3.1 Stack Tracing in Browser

- **Goal**: See "Error at Room.bb:45" instead of "Unreachable at offset 0x452".
- **Action**:
  - Generate `.wasm.map` files.
  - Add a JS-level "Source Mapper" to the browser runtime that intercepts WASM
    traps.

### 3.2 Regression Testing

- **Goal**: Ensure `scpcb/` files always validate.
- **Action**: Add a CI step that runs `blitz3d-wasm --use-ir --strict` on the
  entire `scpcb/` directory.

## 4. Immediate Roadmap (Next 3 Tasks)

1. **Default Arguments**: Implement in `ASTLowering` using `SignatureResolver`.
2. **String Literal Deduping**: Prevent memory bloat by hashing literals in
   `ASTLowering`.
3. **WASM Header/Memory Setup**: Refine `IREmitter` to export memory and define
   reasonable initial limits (currently hardcoded).

---

_Last Updated: Jan 23 2026_
