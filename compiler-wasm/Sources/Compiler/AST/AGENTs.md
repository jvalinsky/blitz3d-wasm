# Directory: blitz3d-wasm/Sources/Compiler/AST

**Parent**: [../](..)

**Description**:
Defines the **Abstract Syntax Tree** nodes. These struct and enum definitions represent the structure of a Blitz3D program as understood by the Parser.

### Key Components
-   **`ProgramNode`**: The root of the AST, containing top-level statements, functions, types, and data.
-   **`StatementNode`**: Enum covering all executable statements (`If`, `While`, `Dim`, `Function`, `Local`, etc.).
-   **`ExpressionNode`**: Enum covering value-producing nodes (`BinaryOp`, `FunctionCall`, `Literal`, `Identifier`, etc.).

### Important Details
-   **`IdentifierNode`**: Represents a variable or function name. Now includes `dimensions: [ExpressionNode]` to support standard and non-standard array declarations.
-   **`TypeSuffix`**: Logic for handling the classic BASIC type suffixes (`%` Int, `#` Float, `$` String).
-   **Source Spans**: Almost all nodes carry a `SourceSpan` to map them back to the original file/line for error reporting.
