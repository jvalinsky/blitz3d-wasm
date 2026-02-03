---
title: "Compiler Architecture Overview"
type: technical
audience: developer
status: published
created: 2026-01-23
updated: 2026-01-23
related:
  - docs/compiler/architecture/pipeline.md
  - docs/compiler/runtime/overview.md
  - docs/compiler/gaps/compilation-gaps.md
  - docs/project/overview.md
tags: [compiler, architecture, swift, webassembly, blitzbasic]
---

# Compiler Architecture Overview

## Overview

This document provides a comprehensive technical overview of the Blitz3D-to-WebAssembly compiler architecture. The compiler is implemented in Swift and translates BlitzBasic source code to WebAssembly, with extensive testing against SCP: Containment Breach as the primary test case.

🔗 **Related:** [Pipeline Details](pipeline.md) | [Runtime System](../runtime/overview.md) | [Compilation Gaps](../gaps/compilation-gaps.md) | [Project Overview](../../project/overview.md)

## Key Achievements
- ✅ **Complete Compiler Pipeline**: Lexer → Parser → AST → CodeGen → WASM
- ✅ **SCPB Core Compatibility**: ~75% of SCP: Containment Breach compiles
- ✅ **WebAssembly Validation**: Always produces validator-compliant output
- ✅ **JavaScript Runtime**: Full Blitz3D API compatibility in browsers

## Project Summary

| Attribute | Value |
|-----------|-------|
| **Project Type** | BlitzBasic-to-WebAssembly Compiler |
| **Compiler Language** | Swift 5.x |
| **Runtime Language** | JavaScript (ES6+) with Three.js |
| **Target Format** | WebAssembly + JavaScript |
| **Test Case** | SCP: Containment Breach (~52K lines BlitzBasic) |
| **Compilation Success** | ~75% of SCPB codebase |
| **License** | MIT (compiler), CC BY-SA 3.0 (SCPB test case) |

## Directory Structure

```
blitz3d-wasm/
├── Sources/
│   ├── Compiler/              # Swift compiler implementation (~30 files)
│   │   ├── Lexer/             # Tokenization (4 files)
│   │   │   ├── Lexer.swift    # Main lexer
│   │   │   ├── Token.swift    # Token definitions
│   │   │   ├── SourceLocation.swift # Position tracking
│   │   │   └── Keywords.swift # BlitzBasic keywords
│   │   ├── Parser/            # Syntax parsing (1 file)
│   │   │   └── Parser.swift   # Recursive descent parser
│   │   ├── AST/               # Abstract syntax tree (2 files)
│   │   │   ├── AST.swift      # Node definitions
│   │   │   └── ASTLowering.swift # AST transformations
│   │   ├── IR/                # Intermediate representation (1 file)
│   │   │   └── Types.swift    # IR type system
│   │   ├── Preprocessor/      # Include handling (1 file)
│   │   │   └── Preprocessor.swift
│   │   └── CodeGen/           # WebAssembly generation (15+ files)
│   │       ├── CodeGenerator.swift     # Main code generation
│   │       ├── IREmitter.swift         # IR emission
│   │       ├── WASMBinaryEncoder.swift # Binary WASM output
│   │       ├── WASMTextWriter.swift    # Text WASM output
│   │       ├── TypeHandling.swift      # Type management
│   │       ├── VariableManagement.swift # Variable allocation
│   │       ├── FunctionGeneration.swift # Function compilation
│   │       ├── StatementGeneration.swift # Statement compilation
│   │       ├── ExpressionGeneration.swift # Expression compilation
│   │       ├── StackScheduler.swift    # Stack frame management
│   │       ├── StackValidator.swift    # Stack validation
│   │       ├── SignatureResolver.swift # Function signatures
│   │       ├── TypeInference.swift     # Type inference
│   │       ├── DataGeneration.swift    # Data segment generation
│   │       ├── DebugGenerator.swift    # Debug information
│   │       └── SourceMapGenerator.swift # Source maps
│   └── Runtime/               # JavaScript browser runtime (~25+ files)
│       ├── runtime.js         # Main entry point
│       ├── browser_compat.js  # Browser compatibility
│       ├── server.js          # Development server
│       ├── deno.json          # Deno configuration
│       ├── index.html         # Demo page
│       ├── modules/           # Runtime modules (18 files)
│       │   ├── core.js        # Core Blitz3D API
│       │   ├── graphics.js    # Three.js 3D graphics
│       │   ├── physics.js     # Collision detection
│       │   ├── input.js       # Keyboard/mouse input
│       │   ├── audio.js       # Web Audio API
│       │   ├── mesh.js        # 3D model loading
│       │   ├── texture.js     # Texture management
│       │   ├── material.js    # Material properties
│       │   ├── animation.js   # Animation system
│       │   ├── xloader.js     # DirectX model loading
│       │   ├── rmesh.js       # Room mesh format
│       │   ├── b3d.js         # Blitz3D format
│       │   ├── xfile.js       # X file format
│       │   ├── room.js        # Room management
│       │   ├── vfs_zip.js     # ZIP archive support
│       │   ├── fileio.js      # File I/O operations
│       │   ├── asset.js       # Asset management
│       │   └── bbdbg.js       # Debug utilities
│       ├── examples/          # Demo applications
│       │   ├── scpcb_asset_viewer.html
│       │   ├── room_viewer.html
│       │   ├── b3d_parser.js
│       │   ├── rmesh_parser.js
│       │   └── helpers.js
│       ├── docs/              # Runtime documentation
│       ├── tools/             # Development tools
│       └── *.wasm/*.wat       # Compiled test outputs
│       ├── debug.js           # Debug utilities
│       └── scpcb.wasm         # Generated SCPCB WASM module (do not commit; produced into `web/public/` + copied to `dist/`)
├── Tools/
│   └── wasm-cli/              # CLI compiler tool
├── Tests/
│   ├── CompilerTests/         # Swift XCTests
│   ├── IntegrationTests/      # Deno tests
│   │   ├── MainTest.bb
│   │   ├── FPS_Test.bb
│   │   ├── Animation_Test.bb
│   │   ├── Lighting_Test.bb
│   │   ├── MainMenu_Test.bb
│   │   └── Assets/
│   ├── Automation/            # Test infrastructure
│   └── CompilerTests/
├── Examples/
│   ├── hello/
│   └── scpcb-simple/
├── Assets/                    # Game assets
├── docs/                      # Documentation
└── notes/                     # Analysis notes (this file)
```

## Compiler Files Analysis

### File Sizes (Lines of Code)

| File | Lines | Complexity |
|------|-------|------------|
| Parser.swift | 1,162 | High |
| CodeGenerator.swift | 905 | High |
| WASMBinaryEncoder.swift | 640 | Medium |
| WASMTextWriter.swift | 516 | Medium |
| ExpressionGeneration.swift | 425 | Medium |
| Lexer.swift | 364 | Medium |
| TypeHandling.swift | 359 | Medium |
| FunctionGeneration.swift | 357 | Medium |
| AST.swift | 357 | Low |
| VariableManagement.swift | 258 | Low |
| StatementGeneration.swift | 253 | Low |
| Token.swift | 233 | Low |
| Preprocessor.swift | 99 | Low |

### Compiler Pipeline

```
Source (.bb) → Lexer → Parser → AST → CodeGen → WASM (.wasm)
```

1. **Lexer** (`Sources/Compiler/Lexer/Lexer.swift`)
   - Tokenizes BlitzBasic source code
   - Handles keywords, operators, literals, identifiers
   - ~364 lines

2. **Parser** (`Sources/Compiler/Parser/Parser.swift`)
   - Builds Abstract Syntax Tree from tokens
   - Handles all language constructs
   - ~1,162 lines (largest file)

3. **AST** (`Sources/Compiler/AST/AST.swift`)
   - Defines node types for statements and expressions
   - Supports user-defined types
   - ~357 lines

4. **CodeGen** (`Sources/Compiler/CodeGen/`)
   - **CodeGenerator.swift**: Main orchestrator, manages WASM module creation
   - **ExpressionGeneration.swift**: Generates WASM for expressions
   - **FunctionGeneration.swift**: Generates WASM for functions
   - **StatementGeneration.swift**: Generates WASM for statements
   - **VariableManagement.swift**: Tracks local/global variables
   - **TypeHandling.swift**: Manages type information
   - **WASM.swift**: WASM structure definitions
   - **WASMBinaryEncoder.swift**: Binary WASM output
   - **WASMTextWriter.swift**: WAT debug output

## Runtime Files Analysis

### File Sizes (Lines of Code)

| File | Lines | Purpose |
|------|-------|---------|
| particles.js | 532 | Custom WebGL particle system |
| modules/runtime.js | 291 | Main integration module |
| modules/physics.js | 168 | Collision detection |
| modules/graphics.js | 152 | Three.js integration |
| modules/input.js | 105 | Input handling |
| bank.js | 138 | Memory bank management |
| ini.js | 103 | INI file parsing |
| vfs.js | 104 | Virtual file system |
| collision.js | 106 | Collision utilities |
| video.js | 143 | Video playback |
| debug.js | 95 | Debug utilities |
| modules/core.js | 89 | Core functionality |
| runtime.js | 36 | Entry point |

### Runtime Module Structure

```
runtime.js (entry point)
├── Blitz3DCore         → Canvas, memory, string handling
├── Blitz3DGraphics     → Three.js scene, camera, entities
├── Blitz3DPhysics      → Raycasting, collision detection
└── Blitz3DInput        → Keyboard, mouse, pointer lock
```

## Key Systems

### 1. Graphics System (`modules/graphics.js`)

```javascript
class Blitz3DGraphics {
    setupImports(imports) {
        imports.env.CreateCamera    // Create viewpoint
        imports.env.CreateLight     // Create light source
        imports.env.CreateMesh      // Create 3D mesh
        imports.env.PositionEntity  // Set position
        imports.env.RotateEntity    // Set rotation
        imports.env.ScaleEntity     // Set scale
        imports.env.ClsColor        // Clear color
        imports.env.Color           // Drawing color
    }
}
```

### 2. Physics System (`modules/physics.js`)

```javascript
class Blitz3DPhysics {
    setupImports(imports) {
        imports.env.EntityPick      // Raycast from entity
        imports.env.LinePick        // Raycast from point
        imports.env.Collisions      // Setup collision rules
        imports.env.CountCollisions // Get collision count
        imports.env.CollisionX/Y/Z  // Get collision position
        imports.env.CollisionEntity // Get collided entity
    }
}
```

### 3. Input System (`modules/input.js`)

```javascript
class Blitz3DInput {
    setupImports(imports) {
        imports.env.KeyDown      // Check key state
        imports.env.KeyHit       // Check key press
        imports.env.MouseX/Y    // Mouse position
        imports.env.MouseDown   // Mouse button
        imports.env.MouseHit    // Mouse click
        imports.env.EnablePointerLock // Mouse capture
    }
}
```

### 4. Core System (`modules/core.js`)

```javascript
class Blitz3DCore {
    setupImports(imports) {
        imports.env.Graphics3D   // Initialize 3D
        imports.env.Cls          // Clear screen
        imports.env.PrintInt     // Debug output
        imports.env.PrintString  // Debug string output
    }
}
```

## SCPB Game Systems

### Main Entry Points

- **Main.bb** - Game initialization and main loop
- **GameLoop()** - Per-frame update and render cycle

### Game Mechanics

| System | File | Description |
|--------|------|-------------|
| Blink System | Main.bb | Periodic eye blink to avoid SCP-173 |
| Stamina | Main.bb | Running depletes stamina |
| Inventory | Items.bb | Drag-drop and item combination |
| Sanity | Main.bb | Environmental effects on player |
| Save/Load | Save.bb | Game state serialization |

### SCP Entities

| SCP | File | Behavior |
|-----|------|----------|
| SCP-173 | NPCs.bb | Moves when not observed, snaps necks |
| SCP-096 | NPCs.bb | Killer when viewed, unstoppable pursuit |
| SCP-106 | NPCs.bb | Corrosion attacks, pocket dimension |
| SCP-049 | NPCs.bb | "Cures" pestilence with lethal touch |
| SCP-939 | NPCs.bb | Mimics voices, pack behavior |

### Type System Pattern

```blitzbasic
Type TEntityName
    Field obj%              ; 3D object handle
    Field obj2%             ; Secondary object
    Field Collider%         ; Collision entity
    Field ID%               ; Unique identifier
    Field State#            ; Primary state
    Field State2#           ; Secondary state
    Field Speed#            ; Movement speed
End Type
```

## Test Files

### Integration Tests

```
Tests/IntegrationTests/
├── MainTest.bb              # Core functionality test
├── FPS_Test.bb              # Frame rate test
├── Animation_Test.bb        # Animation test
├── Lighting_Test.bb         # Lighting test
├── MainMenu_Test.bb         # Menu test
└── Assets/
    ├── test_audio.bb
    ├── test_banks.bb
    ├── test_data_loop.bb
    ├── test_multiple_types.bb
    ├── test_read_file.bb
    ├── test_restore.bb
    ├── test_string_data.bb
    └── test_zip.bb
```

### Test Coverage

- Type system (user-defined types)
- ForEach iteration over type collections
- DATA/READ/RESTORE statements
- File I/O and ZIP archives
- Memory banks
- Audio playback

## Configuration Files

The project uses INI-style configuration through `ini.js`:

```javascript
// Runtime support for INI parsing
class INIManager {
    load(path)     // Load INI file
    get(section, key)  // Get value
    set(section, key, value)  // Set value
    save(path)     // Save INI file
}
```

## Dependencies

### External Libraries

| Library | Purpose | Source |
|---------|---------|--------|
| Three.js | 3D graphics rendering | CDN/Deno |
| JSZip | ZIP file handling | Deno |
| Web Audio API | Audio playback | Browser native |
| WebGL | GPU rendering | Browser native |

### Compiler Dependencies

- Swift 6.0+ (for compiler)
- No external Swift dependencies (self-contained)

## Build System

### Swift Package Manager

```swift
// Package.swift
Package(
    name: "Blitz3DCompiler",
    products: [
        .executable(name: "blitz3d-wasm"),
        .library(name: "Blitz3DCompiler")
    ],
    targets: [
        .executableTarget(name: "blitz3d-wasm", path: "Tools/wasm-cli"),
        .target(name: "Blitz3DCompiler", path: "Sources/Compiler"),
        .testTarget(name: "CompilerTests", path: "Tests/CompilerTests")
    ]
)
```

### Build Commands

```bash
# Build the project
swift build

# Run all tests
swift test

# Run CLI with input file
swift run blitz3d-wasm input.bb -o output.wasm

# Compile with WAT output
swift run blitz3d-wasm input.bb -w -o output.wasm

# Run integration tests
cd Tests/IntegrationTests && node run_tests.js
```

## WASM Memory Model

```
Memory Layout (64KB initial, 128KB max):
┌─────────────────────────────────────┐
│ 0x000 - 0x100                       │ Data section (compiled DATA statements)
├─────────────────────────────────────┤
│ 0x100+                              │ Heap (managed by __Alloc)
└─────────────────────────────────────┘
```

## Critical Entry Points

### Compiler Entry

```swift
// Tools/wasm-cli/main.swift
main(args: [String]) {
    let source = readFile(args.input)
    let lexer = Lexer(source)
    let tokens = lexer.tokenize()
    let parser = Parser(tokens)
    let ast = parser.parse()
    
    var codeGenerator = CodeGenerator()
    let wasmModule = codeGenerator.generate(from: ast)
    
    writeWASM(wasmModule, args.output)
}
```

### Runtime Entry

```javascript
// Sources/Runtime/modules/runtime.js
const Blitz3D = {
    init(canvasId) {
        this.core = new Blitz3DCore()
        this.core.init(canvasId)
        
        this.graphics = new Blitz3DGraphics(this.core)
        this.graphics.init3D()
        
        this.physics = new Blitz3DPhysics(this.core, this.graphics)
        this.input = new Blitz3DInput(this.core, this.graphics)
    },
    
    async load(wasmUrl) {
        const result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), this.imports)
        this.core.instance = result.instance
        this.core.memory = result.instance.exports.memory
        
        // Call main or Main function
        if (result.instance.exports.main) {
            result.instance.exports.main()
        }
    }
}
```

## Largest Files Analysis

### 1. Parser.swift (1,162 lines)
- Complex recursive descent parser
- Handles all BlitzBasic syntax
- Largest file due to many language constructs

### 2. CodeGenerator.swift (905 lines)
- WASM module orchestration
- User type support
- GOTO/Label handling
- Data section management

### 3. WASMBinaryEncoder.swift (640 lines)
- Binary WASM format encoding
- Instruction encoding
- Section writing

### 4. particles.js (532 lines)
- Custom WebGL particle system
- Shader-based rendering
- Instanced particle rendering

### 5. WASMTextWriter.swift (516 lines)
- Human-readable WAT output
- Debugging tool for WASM generation

## File Dependencies

```
Lexer.swift → Token.swift
Parser.swift → AST.swift, Token.swift
CodeGenerator.swift → AST.swift, WASM.swift, ExpressionGeneration.swift,
                      FunctionGeneration.swift, StatementGeneration.swift,
                      VariableManagement.swift, TypeHandling.swift
ExpressionGeneration.swift → WASM.swift, TypeHandling.swift
FunctionGeneration.swift → WASM.swift, TypeHandling.swift
StatementGeneration.swift → WASM.swift
VariableManagement.swift → WASM.swift
TypeHandling.swift → AST.swift

runtime.js → modules/runtime.js
modules/runtime.js → modules/core.js, modules/graphics.js,
                     modules/physics.js, modules/input.js
modules/core.js → (standalone)
modules/graphics.js → Three.js (external)
modules/physics.js → Three.js (external)
modules/input.js → (standalone)
```

## Configuration Files

No .ini files found in the current repository, but the runtime supports:

- **rooms.ini** - Room definitions (in original SCPB)
- **events.ini** - Event triggers (in original SCPB)
- **NPCs.ini** - NPC spawn data (in original SCPB)
- **SCP-294.ini** - Drink recipes (in original SCPB)
- **materials.ini** - Material properties (in original SCPB)

## Key Functions by System

### Compiler

| Function | File | Purpose |
|----------|------|---------|
| `tokenize()` | Lexer.swift | Convert source to tokens |
| `parse()` | Parser.swift | Build AST from tokens |
| `generate(from:)` | CodeGenerator.swift | Create WASM from AST |
| `generateExpression(_:)` | ExpressionGeneration.swift | WASM for expressions |
| `generateStatement(_:)` | StatementGeneration.swift | WASM for statements |
| `generateFunction(_:)` | FunctionGeneration.swift | WASM for functions |

### Runtime

| Function | File | Purpose |
|----------|------|---------|
| `init()` | modules/core.js | Initialize core |
| `init3D()` | modules/graphics.js | Setup Three.js |
| `setupImports()` | Each module | Register WASM imports |
| `setupEventListeners()` | modules/input.js | Bind input events |
| `updateCollisions()` | modules/physics.js | Physics processing |

## Summary

The SCPB codebase in this repository is primarily a **Blitz3D-to-WASM compiler infrastructure** with:

1. **Compiler** - Swift-based toolchain converting BlitzBasic to WebAssembly
2. **Runtime** - JavaScript library providing browser APIs (Three.js, WebGL, Web Audio)
3. **Test Suite** - Integration tests validating compilation and runtime
4. **SCP Content** - Reference documentation for the original game systems

The project demonstrates:
- Language virtualization (BlitzBasic → WASM)
- Graphics API wrapping (Three.js for Blitz3D compatibility)
- Modular architecture (separated compiler and runtime concerns)
- Cross-platform compilation (macOS Swift → WASM target)
