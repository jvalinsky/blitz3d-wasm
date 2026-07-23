# Directory: blitz3d-wasm/Sources/Compiler/Parser

**Parent**: [../](..)

**Description**: The `Parser` module implements a **Recursive Descent Parser**
for the Blitz3D BASIC language. It consumes tokens from the `Lexer` and produces
`StatementNode`s for the AST.

### Key Files

- **`Parser.swift`**: The main parser class. Contains methods like
  `parseStatement()`, `parseExpression()`, etc.

### Features & Responsibilities

- **Basic Syntax**: Parses standard Blitz3D control flow (`If`, `While`, `For`),
  functions, and types.
- **Extended Syntax (SCP:CB Support)**:
  - **Inline Arrays**: Handles `Local arr[N]` and `Global arr[N]` declarations
    (non-standard Blitz3D extension).
  - **Implicit Function Calls**: Handles subroutine-style function calls without
    parentheses (e.g., `Cls`, `LoadImage "foo.png"`).
- **Error Handling**: Provides source location tracking (`SourceSpan`) for
  syntax errors.

### Implementation Notes

- The parser is **context-free** regarding types; it does not resolve types or
  check validity, it purely structures the syntax.
- Operator precedence is handled via the standard `parseExpression` ->
  `parseTerm` -> `parseFactor` hierarchy.
