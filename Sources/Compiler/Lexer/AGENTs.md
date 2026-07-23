# Directory: blitz3d-wasm/Sources/Compiler/Lexer

**Parent**: [../](..)

**Description**: The `Lexer` breaks raw source text into a stream of `Token`s.
It usually runs on the output of the `Preprocessor`.

### Key Files

- **`Lexer.swift`**: The main tokenizer implementation.
- **`Token.swift`**: Definitions of token types (`identifier`, `keyword`,
  `operator`, `literal`, etc.).

### Responsibilities

- **Case Insensitivity**: Blitz3D is case-insensitive. The Lexer normalizes
  keywords but preserves casing for string literals.
- **Suffix Handling**: Recognizes and tokenizes type suffixes (`%`, `#`, `$`)
  attached to identifiers.
- **Comments**: Strips out comments (`; ...`).
- **Line Tracking**: Maintains row/column information for every token to support
  `SourceSpan`s in the AST.
