# Getting Started with Blitz3D-to-WebAssembly

**Audience:** Compiler Developers **Time to Complete:** 30 minutes
**Prerequisites:** Swift 5.5+, Deno 1.40+, modern web browser

## Quick Setup

### 1. Clone and Build

```bash
# Clone the repository
git clone https://github.com/your-repo/blitz3d-wasm.git
cd blitz3d-wasm

# Build the Swift compiler
swift build

# Verify installation
swift run blitz3d-wasm --help
```

### 2. Run Basic Test

```bash
# Compile a simple BlitzBasic program
echo 'Print "Hello, WebAssembly!"' > hello.bb
swift run blitz3d-wasm hello.bb -o hello.wasm

# Check output
ls -la hello.w*
```

### 3. Run Tests

```bash
# Run compiler unit tests
swift test

# Run integration tests
cd Tests/IntegrationTests
node run_tests.js
```

## Development Workflow

### Typical Development Cycle

1. **Make Code Changes**
   ```bash
   # Edit compiler source
   vim Sources/Compiler/CodeGen/ExpressionGeneration.swift
   ```

2. **Build and Test**
   ```bash
   # Incremental build (fast)
   swift build

   # Run specific tests
   swift test --filter testExpressionGeneration

   # Full test suite
   swift test
   ```

3. **Test with SCPB**
   ```bash
   # Compile SCPB NPC system (our test case)
   swift run blitz3d-wasm temp_npcs.bb -o temp_npcs.wasm

   # Check for compilation errors
   echo $?
   ```

4. **Validate Output**
   ```bash
   # Use WebAssembly validator
   wasm-validate temp_npcs.wasm && echo "Valid WASM!"

   # Generate WAT for inspection
   swift run blitz3d-wasm temp_npcs.bb -w -o temp_npcs.wat
   ```

### Development Tools

#### Essential Tools

- **Xcode** or **VS Code** with Swift extension
- **WebAssembly Binary Toolkit** (`wasm2wat`, `wasm-validate`)
- **Deno** for runtime testing
- **Chrome DevTools** for browser debugging

#### Recommended VS Code Extensions

- Swift Language Support
- WebAssembly Tools
- GitLens (for change tracking)

## Understanding the Architecture

### Compiler Pipeline Flow

```
BlitzBasic Source (.bb)
        ↓
    Swift Lexer
        ↓
    Swift Parser
        ↓
    AST Builder
        ↓
Swift Code Generator
        ↓
WebAssembly Binary (.wasm) + Debug (.wat)
        ↓
JavaScript Runtime
        ↓
Browser Execution (Three.js, Web Audio, etc.)
```

### Key Directories

```
Sources/
├── Compiler/           # Swift compiler implementation
│   ├── Lexer/         # Tokenization
│   ├── Parser/        # Syntax parsing
│   ├── AST/           # Abstract syntax tree
│   ├── CodeGen/       # WebAssembly generation
│   └── IR/            # Intermediate representation
├── Runtime/           # JavaScript browser runtime
│   ├── runtime.js    # Main entry point
│   ├── modules/      # Runtime modules
│   └── examples/     # Demo applications
└── Tests/             # Test infrastructure
    ├── IntegrationTests/  # SCPB compilation tests
    └── fixtures/          # Test data
```

## Working with SCPB

### Current Compatibility Status

| System             | Compatibility | Notes                                   |
| ------------------ | ------------- | --------------------------------------- |
| **Core Rendering** | ✅ 100%       | Graphics3D, CreateMesh, etc.            |
| **Basic NPCs**     | ✅ 90%        | Simple AI patterns work                 |
| **Physics**        | ✅ 95%        | Collision detection works               |
| **Audio**          | ✅ 85%        | Basic playback works                    |
| **Pathfinding**    | ⚠️ 50%        | Handle arrays block full implementation |
| **Save/Load**      | ⚠️ 70%        | Complex data structures fail            |
| **Advanced AI**    | ❌ 25%        | Object references needed                |

### Testing with SCPB Code

```bash
# Test compilation of real SCPB file
swift run blitz3d-wasm temp_npcs.bb -o test.wasm 2>&1 | head -20

# If compilation fails, check error patterns
# Common issues: handle arrays, complex expressions
```

## Common Development Tasks

### Adding a New BlitzBasic Feature

1. **Identify the syntax** in BlitzBasic specification
2. **Add token types** in `Sources/Compiler/Lexer/Token.swift`
3. **Extend parser** in `Sources/Compiler/Parser/Parser.swift`
4. **Add AST node** in `Sources/Compiler/AST/AST.swift`
5. **Implement code generation** in `Sources/Compiler/CodeGen/`
6. **Add tests** in `Tests/`
7. **Test with SCPB** code fragments

### Debugging Compilation Issues

1. **Generate WAT output** for inspection:
   ```bash
   swift run blitz3d-wasm input.bb -w -o debug.wat
   ```

2. **Check WebAssembly validity**:
   ```bash
   wasm-validate output.wasm
   ```

3. **Use runtime debugger** in browser DevTools

4. **Add debug logging** to compiler components:
   ```swift
   print("DEBUG: Parsing expression: \(tokenStream)")
   ```

### Performance Optimization

1. **Profile compilation speed**:
   ```bash
   time swift run blitz3d-wasm large_file.bb -o output.wasm
   ```

2. **Optimize hot paths** in CodeGen using Instruments

3. **Monitor WASM size**:
   ```bash
   ls -lh output.wasm
   ```

## Runtime Development

### Testing Runtime Features

```bash
# Start development server
cd Sources/Runtime
python3 -m http.server 8000

# Open in browser
open http://localhost:8000/index.html
```

### Modifying Runtime Modules

```javascript
// Example: Adding new graphics function
// In Sources/Runtime/modules/graphics.js
Blitz3D.Graphics3D.prototype.newFunction = function (param) {
  // Implementation using Three.js
  this.scene.add(new THREE.Object3D());
};
```

## Troubleshooting

### Common Issues

**"Command not found: swift"**

- Install Swift toolchain from swift.org
- Ensure PATH includes Swift binaries

**"WebAssembly validation error"**

- Check for stack corruption in code generation
- Verify type consistency in expressions
- Review function signatures

**"Runtime error in browser"**

- Check JavaScript console for errors
- Verify Three.js compatibility
- Test with simpler BlitzBasic code first

**"SCPB compilation fails"**

- Check for handle arrays: `Field items[10]`
- Look for complex object access: `obj\field[index]`
- Review Select statements with many cases

### Getting Help

1. **Check existing tests** in `Tests/` directory
2. **Review documentation** in `docs/` directory
3. **Examine runtime examples** in `Sources/Runtime/examples/`
4. **File issues** with specific error messages and code samples

## Next Steps

1. **Complete this tutorial** by compiling your first BlitzBasic program
2. **Explore the test files** to understand current capabilities
3. **Try compiling SCPB fragments** to see current limitations
4. **Read the architecture docs** for deeper understanding
5. **Start implementing a missing feature** from the gap analysis

---

**🎯 Ready to start developing? Run `swift test` to ensure everything is
working, then try compiling your first BlitzBasic program!**
