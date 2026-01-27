# Directory: blitz3d-wasm/Sources/Compiler/Lowering

**Parent**: [../](..)

**Description**:
The `Lowering` module is the bridge between the high-level AST and the low-level IR. It is where most of the "compiler magic" (desugaring, semantic analysis) happens.

### Key Files
-   **`ASTLowering.swift`**: The main visitor that traverses the AST and builds the `IRModule`.

### Key Features
1.  **Type Coercion (`coerce`)**:
    -   Blitz3D is "permissive". It allows passing `Int` to `Float` functions, or assigning `Float` to `Int` variables.
    -   WASM is strict. `ASTLowering` automatically injects `.convert` instructions (e.g., `i32.trunc_f32_s`) to satisfy the type system.
2.  **Desugaring**:
    -   **Loops**: Transforms `For`, `While`, `Repeat` into generic IR `Loop` and `Block` structures.
    -   **Arrays**: Transforms `Dim` and `Local arr[N]` into memory allocation (`__Alloc`) and pointer arithmetic.
    -   **WaitTimer**: Lowers `WaitTimer` to runtime calls.
3.  **Symbol Resolution**:
    -   Builds the `SymbolTable` to map variable names to memory locations (Locals vs Globals).
    -   Handles `Const` propagation (resolving constant expressions at compile time).
4.  **Shadow Stack**:
    -   Implements `Gosub` support by maintaining a software stack pointer and dispatch tables, as WASM flow control is structured.
