# Directory: blitz3d-wasm/Sources/Compiler/Preprocessor

**Parent**: [../](..)

**Description**: The `Preprocessor` acts as the first pass of the compiler,
preparing raw source text for the Lexer. Its primary job is handling the file
system and inclusion hierarchy.

### Key Files

- **`Preprocessor.swift`**: Manages the inclusion logic.

### Core Responsibilities

1. **Recursive Includes**:
   - Processes `#Include "path/to/file.bb"`.
   - Maintains a stack of `rootDirectory` contexts. This ensures that an
     included file resolves _its_ includes relative to its own location, not the
     original entry point.
2. **Encoding normalization**:
   - Attempts to read files as UTF-8.
   - Falls back to **Windows-1252** (CP1252) if UTF-8 fails. This is critical
     for older Blitz3D codebases (like SCP:CB) that often contain legacy
     characters.
3. **Source Mapping**:
   - (Optional) Keeps track of original file lines for debug info generation.

### Usage

Called by the main driver before `Lexer`. Input: `File URL`. Output:
`Single String` (concatenated source).
