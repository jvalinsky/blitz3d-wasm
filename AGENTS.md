# Blitz3D-WASM

A compiler and runtime that compiles Blitz3D BASIC to WebAssembly for browser execution.

## Project Status (January 2026)

**Compiler**: Working - compiles Blitz3D code to valid WASM  
**Runtime**: JavaScript implementation of Blitz3D API (Three.js for 3D)  
**Target**: Run SCP: Containment Breach in browser

### Recent Progress
- Typed IR pipeline with Relooper state machine
- Multi-dimensional array support
- Branch balancing for if/else statements
- Function argument type conversion
- WASM validation improvements

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Blitz3D (.bb)  │────▶│  Swift Compiler │────▶│   WASM Module   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │                       │
        │                       ▼                       ▼
        │               ┌───────────────┐       ┌───────────────┐
        │               │ Lexer/Parser  │       │ JS Runtime    │
        │               │ AST/IR/CodeGen│       │ (Three.js)    │
        │               └───────────────┘       └───────────────┘
        │
        ▼
┌─────────────────┐
│ Include Files   │
│ Type Defs       │
│ Functions       │
└─────────────────┘
```

## Directory Structure

### Sources/
- **Compiler/** (14.7K lines Swift) - Blitz3D to WASM compiler
  - `Lexer/` - Tokenizer for Blitz3D syntax
  - `Parser/` - Recursive descent parser (2K lines)
  - `AST/` - Abstract syntax tree nodes
  - `IR/` - Typed intermediate representation
  - `Lowering/` - AST to IR conversion
  - `CodeGen/` - WASM binary generation
- **Runtime/** (11K lines JS) - Browser runtime
  - `modules/` - Modular API implementations
  - Core, Graphics, Input, Audio, Physics, VFS
- **Blitz3DEngine/** - Swift asset parsers (B3D, RMesh)

### Tests/
- `CompilerTests/` - Swift unit tests
- `fixtures/` - Test .bb files by category
- `IntegrationTests/` - Browser-based tests
- `Automation/` - Puppeteer test harness

### Tools/
- `wasm-cli/` - Command-line compiler
- `analyzer/` - WASM analysis and debugging

### Examples/
- `hello/` - Minimal test
- `walking_sim/` - 3D walking demo
- `scpcb_*` - SCP:CB related demos

### docs/
Technical documentation. See `docs/README.md`.

### notes/
SCP:CB analysis notes for understanding the target game.

### plan/
Implementation phases and roadmaps.

## Building

### Prerequisites
- Swift 6.0+ (`swift --version`)
- Node.js (for runtime bundling)
- wabt (for wasm-validate)

### Compile
```bash
# Build compiler
swift build

# Compile a .bb file
.build/debug/blitz3d-wasm input.bb -o output.wasm

# With debug info
.build/debug/blitz3d-wasm input.bb -o output.wasm -g -d
```

### Linux Note
The Package.swift has a macOS-specific linker flag. On Linux, comment out:
```swift
linkerSettings: [
    .unsafeFlags(["-Xlinker", "-stack_size", "-Xlinker", "0x10000000"])
]
```

## Testing

```bash
# Run compiler tests
swift test

# Validate WASM output
wasm-validate output.wasm

# Integration tests
cd Tests/IntegrationTests && npm test
```

## Key Files

| File | Purpose |
|------|--------|
| `Package.swift` | Swift package definition |
| `Tools/wasm-cli/main.swift` | CLI entry point |
| `Sources/Compiler/Parser/Parser.swift` | Main parser |
| `Sources/Compiler/CodeGen/CodeGenerator.swift` | WASM generation |
| `Sources/Runtime/modules/runtime.js` | Runtime entry |

## Blitz3D Language Support

### Implemented
- Variables (Local, Global, Const, Dim)
- Types (custom types with fields)
- Functions with return types
- Control flow (If/Then/Else, For/Next, While/Wend, Select/Case)
- Operators (arithmetic, comparison, logical)
- String operations
- Include files

### In Progress
- Goto/Gosub (via Relooper)
- Data/Read/Restore
- Full type system with object references

## Import Modules

The generated WASM requires these import modules:
- `env` - Core Blitz3D functions (400+ imports)
- `blitz3d` - Bank operations, mesh parsing
- `al` - OpenAL audio bindings

## Documentation Index

- [docs/README.md](docs/README.md) - Documentation hub
- [docs/DESIGN_CHOICES.md](docs/DESIGN_CHOICES.md) - Architecture decisions
- [docs/CODE_REVIEW.md](docs/CODE_REVIEW.md) - Code quality notes
- [plan/](plan/) - Implementation phases
- [notes/](notes/) - SCP:CB analysis
