# Blitz3D-WASM

A compiler and runtime that compiles Blitz3D BASIC to WebAssembly for browser execution.

## Project Status (January 2026)

**Compiler**: Working - compiles Blitz3D code to valid WASM  
**Runtime**: Thin runtime (~500 lines JS) for browser API bindings  
**Target**: Run SCP: Containment Breach in browser

### Working Demo

**https://blitz3d.exe.xyz:8000/test.html** - Particle system demo

- Particles fall with gravity
- Alpha fading and deletion
- All logic in compiled BB → WASM
- JS only provides Three.js rendering calls

## Architecture

**WASM does game logic. JS only wraps browser APIs.**

```
┌─────────────────────────────────────────────────────────────┐
│                   WASM (Compiled BB Code)                    │
├─────────────────────────────────────────────────────────────┤
│ • Type system (New, Delete, linked lists)                   │
│ • Field access (p\x, p\y, p\obj)                            │
│ • Physics/math (gravity, velocity, distance)                │
│ • Game logic (AI, events, state)                            │
│ • Control flow (If, While, For Each)                        │
│ • Memory management                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ imports ~10-50 functions
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   JS Runtime (~500 lines)                    │
├─────────────────────────────────────────────────────────────┤
│ • CreateSprite/Mesh → Three.js objects                      │
│ • PositionEntity → obj.position.set()                       │
│ • EntityAlpha → material.opacity                            │
│ • LoadSound/PlaySound → Web Audio                           │
│ • KeyDown/MouseX → DOM events                               │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
blitz3d-wasm/
├── Sources/
│   ├── Compiler/          # Swift compiler (14K lines)
│   │   ├── Lexer/         # Tokenizer
│   │   ├── Parser/        # Recursive descent (2K lines)
│   │   ├── AST/           # Syntax tree nodes
│   │   ├── IR/            # Intermediate representation
│   │   ├── Lowering/      # AST → IR
│   │   └── CodeGen/       # WASM generation (5K lines)
│   │
│   ├── Runtime/
│   │   ├── thin/          # Minimal runtime ← USE THIS
│   │   │   ├── runtime.js # ~500 lines, browser bindings
│   │   │   ├── test.html  # Working particle demo
│   │   │   └── particles.bb
│   │   ├── JS/            # TS/JS runtime bindings
│   │   └── modules/       # Legacy full runtime (11K lines)
│   │
│   └── Blitz3DEngine/     # Swift asset parsers
│
├── Tests/
│   ├── CompilerTests/     # Swift unit tests
│   ├── fixtures/          # Test .bb files
│   └── IntegrationTests/  # Browser tests
│
├── Tools/
│   ├── wasm-cli/          # CLI compiler
│   └── analyzer/          # WASM debugging
│
├── Examples/              # Demo projects
├── docs/                  # Documentation
│   ├── compiler/          # Compiler docs
│   └── archive/           # Old session notes
├── notes/                 # SCPCB analysis
├── plan/                  # Implementation phases
└── web/                   # Web frontend app
```

## Building

### Prerequisites
- Swift 6.0+ (`swift --version`)
- Node.js (for serving)
- wabt (for wasm-validate)

### Linux Note
Comment out the macOS linker flag in Package.swift:
```swift
// linkerSettings: [.unsafeFlags(["-Xlinker", "-stack_size", "-Xlinker", "0x10000000"])]
```

### Compile
```bash
# Build compiler
swift build

# Compile a .bb file
.build/debug/blitz3d-wasm input.bb -o output.wasm

# Validate output
wasm-validate output.wasm
```

### Run Demo
```bash
cd Sources/Runtime/thin
python3 -m http.server 8000
# Open http://localhost:8000/test.html
```

## Language Support

### Implemented ✅
- Variables (Local, Global, Const, Dim)
- Types (custom types with fields)
- Type operations (New, Delete, First, Last, After, Before)
- For Each iteration
- Functions with return types
- Control flow (If/Then/Else, For/Next, While/Wend, Select/Case)
- Operators (arithmetic, comparison, logical, string)
- Field access (obj\field)
- Include files

### Known Issues
- Function shadowing: user functions can't have same name as runtime imports
- For Each + Delete: use While loop with saved next pointer instead

## Key Files

| File | Purpose |
|------|---------|
| `Sources/Compiler/Parser/Parser.swift` | Main parser (2K lines) |
| `Sources/Compiler/CodeGen/CodeGenerator.swift` | WASM generation |
| `Sources/Compiler/CodeGen/StatementGeneration.swift` | Statement codegen |
| `Sources/Compiler/CodeGen/ExpressionGeneration.swift` | Expression codegen |
| `Sources/Runtime/thin/runtime.js` | Thin JS runtime |
| `Sources/Runtime/thin/particles.bb` | Working demo source |

## Recent Fixes (Jan 2026)

- Type system: `New` allocation, `Delete` linked list management
- Field access: case-insensitive lookups
- Function exports: user functions no longer shadowed by imports
- For Each: proper iteration over type instances
