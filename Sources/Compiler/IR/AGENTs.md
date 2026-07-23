# Directory: blitz3d-wasm/Sources/Compiler/IR

**Parent**: [../](..)

**Description**: Defines the **Intermediate Representation (IR)**. This is a
simplified, typed, and structured representation of the program that sits
between the AST and the final WASM output.

### Key Components

- **`IRModule`**: Represents the whole program. Contains Lists of `IRFunction`s,
  `Global`s, `Type` definitions, and `Data` segments.
- **`IRFunction`**: A compiled function with a simplified list of `IREffect`s
  (statements).
- **`IREffect`**: Represents side-effecting operations (Assignments, Loops,
  Control Flow). Unlike AST nodes, these are often lower-level (e.g.,
  `assignArray` instead of just "assignment").
- **`IRValue`**: Represents expression results.

### Purpose

The IR abstracts away the syntactic sugar of BASIC. For example, a `For` loop in
the AST becomes a standard logic loop in IR. This makes the final CodeGen step
much simpler, as it only has to worry about emitting instructions for a small
set of IR primitives.
