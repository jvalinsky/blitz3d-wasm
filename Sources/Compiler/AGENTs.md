# Directory: blitz3d-wasm/Sources/Compiler

**Parent**: [../](..)

**Description**: The `Compiler` directory contains the implementation of the
Blitz3D-to-WebAssembly compiler. It is structured as a standard multi-pass
compiler pipeline.

### Compilation Pipeline

1. **Preprocessing** (`Preprocessor/`): Handles source file inclusion and
   encoding normalization.
2. **Lexing** (`Lexer/`): Tokenizes the source code.
3. **Parsing** (`Parser/`): Constructs a high-level Abstract Syntax Tree (AST)
   from tokens.
4. **Lowering** (`Lowering/`): Transforms the AST into a flattened Intermediate
   Representation (IR), handling type coercion, desugaring (e.g., loops to
   blocks), and symbol resolution.
5. **Code Generation** (`CodeGen/`): Emits the final WebAssembly (WASM) binary
   or WAT text from the IR.

### Key Shared Components

- **AST**: Definitions of the source language nodes.
- **IR**: Definitions of the intermediate language nodes.
- **Symbols**: Symbol tables are managed during Lowering to resolve variable and
  function scopes.

**Children**:

- [AST](./AST) - Abstract Syntax Tree definitions
- [CodeGen](./CodeGen) - WASM emission logic
- [IR](./IR) - Intermediate Representation definitions
- [Lexer](./Lexer) - Tokenizer
- [Lowering](./Lowering) - AST to IR transformation
- [Parser](./Parser) - Recursive descent parser
- [Preprocessor](./Preprocessor) - Source file handling
