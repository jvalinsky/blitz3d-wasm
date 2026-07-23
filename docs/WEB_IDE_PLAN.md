# Web IDE Plan - Client-Side Blitz3D Compiler

## Vision

A fully client-side Blitz3D development environment that runs entirely in the
browser:

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client-Side)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐   compiles   ┌──────────────┐           │
│  │  Blitz3D     │────────────>  │  Game WASM   │           │
│  │  Source Code │               │  Binary      │           │
│  └──────────────┘               └──────────────┘           │
│         │                              │                    │
│         │                              │ runs with          │
│         v                              v                    │
│  ┌──────────────┐               ┌──────────────┐           │
│  │  Compiler    │               │  Runtime     │           │
│  │  WASM        │               │  (Three.js)  │           │
│  └──────────────┘               └──────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Non-negotiable reliability requirement (2026-02-02)

Any “web interpreter / IDE” must treat user/game WASM as potentially untrusted:

- Always execute compiled WASM in a **Web Worker** (never the UI thread).
- Provide a **Stop/Reset** control.
- Enforce a **watchdog timeout** (infinite loops must not freeze the tab).

Reference implementations in this repo:

- `web/interpreter.html` + `web/interpreter.js` (Stop + timeout; execution in
  Worker)
- `web/public/bb_wasm_runner_demo.html` (upload a `.wasm`, run with Worker +
  watchdog)

## Components

### 1. Compiler as WASM

**Goal**: Compile the Swift Blitz3D compiler to WebAssembly

**Status**: In Progress

**Challenges**:

- Foundation not available in WASM
- File I/O needs WASI or JS bridge
- Swift WASM support is still maturing

**Approaches**:

#### Approach A: Swift to WASM (Native)

✅ **Pros**:

- Reuse existing Swift compiler code
- Single source of truth
- Full Swift language features

❌ **Cons**:

- Foundation dependencies
- Large binary size (~5-10MB)
- WASI limitations
- Compilation complexity

#### Approach B: TypeScript Compiler (New Implementation)

✅ **Pros**:

- Native web platform
- Easy JS/browser integration
- Smaller bundle size
- Better debugging

❌ **Cons**:

- Need to port compiler logic
- Two implementations to maintain
- More development time

#### Approach C: Swift -> TypeScript Transpilation

✅ **Pros**:

- Automated conversion
- Maintain single codebase

❌ **Cons**:

- Complex tooling
- Limited viability

**Recommended**: **Approach B** - Implement TypeScript compiler

Reason: Better web integration, easier maintenance, smaller size.

### 2. Web IDE Interface

**Components**:

```typescript
interface WebIDE {
  editor: CodeEditor; // Monaco or CodeMirror
  compiler: Compiler; // TypeScript or WASM
  runtime: Runtime; // Existing Three.js runtime
  fileSystem: VirtualFS; // In-memory file system
  console: OutputConsole; // Compilation output
}
```

**Features**:

- ✅ Syntax highlighting (Blitz3D grammar)
- ✅ Code completion
- ✅ Error diagnostics
- ✅ Live compilation
- ✅ Instant preview
- ✅ Share snippets (URL-encoded)
- ✅ Load examples
- ✅ Download WASM

### 3. TypeScript Compiler Implementation

Port the Swift compiler to TypeScript:

```typescript
// Compiler Pipeline
class Blitz3DCompiler {
  // Lexer: Source -> Tokens
  lex(source: string): Token[];

  // Parser: Tokens -> AST
  parse(tokens: Token[]): Program;

  // Lowering: AST -> IR
  lower(ast: Program): IRModule;

  // Optimization: IR -> IR (optimized)
  optimize(ir: IRModule): IRModule;

  // CodeGen: IR -> WASM
  generate(ir: IRModule): Uint8Array;

  // All-in-one
  compile(source: string): CompileResult;
}

interface CompileResult {
  success: boolean;
  wasm?: Uint8Array;
  errors?: CompilerError[];
  warnings?: CompilerWarning[];
}
```

## Implementation Phases

### Phase 1: Core TypeScript Compiler (2-3 weeks)

**Goal**: Basic Blitz3D to WASM compilation in TypeScript

**Tasks**:

- [x] Set up TypeScript project structure
- [ ] Implement lexer (tokenization)
- [ ] Implement parser (AST generation)
- [ ] Implement IR lowering
- [ ] Implement WASM code generation
- [ ] Basic test suite

**Deliverable**: TypeScript compiler that can compile simple programs

**Example**:

```blitz3d
; Simple test program
For i = 0 To 10
    Print i
Next
```

### Phase 2: Web IDE (1 week)

**Goal**: Basic browser-based IDE

**Tasks**:

- [ ] Set up Monaco Editor
- [ ] Integrate TypeScript compiler
- [ ] Add compile button and output
- [ ] Show compilation errors
- [ ] Run compiled WASM with runtime

**Deliverable**: Working web IDE with compile + run

### Phase 3: Advanced Features (2 weeks)

**Goal**: Production-ready IDE

**Tasks**:

- [ ] Syntax highlighting for Blitz3D
- [ ] Code completion
- [ ] Error diagnostics (red squiggles)
- [ ] Example programs library
- [ ] Share/load from URL
- [ ] Download WASM button
- [ ] Performance optimizations

### Phase 4: Feature Parity (3 weeks)

**Goal**: Match Swift compiler features

**Tasks**:

- [ ] All language constructs
- [ ] Type system
- [ ] Include files
- [ ] Data/Read/Restore
- [ ] Optimization passes
- [ ] Source maps

## Technical Decisions

### Compiler Language: TypeScript

**Decision**: Implement new TypeScript compiler

**Rationale**:

1. Native web platform - no WASI complications
2. Easier debugging in browser devtools
3. Better integration with Monaco Editor
4. Smaller bundle size (vs WASM Swift compiler)
5. Faster iteration during development

### Editor: Monaco

**Decision**: Use Monaco Editor (VS Code's editor)

**Rationale**:

1. Excellent TypeScript/language server integration
2. Rich API for diagnostics and completion
3. Professional UI
4. Good performance

**Alternative**: CodeMirror 6

- More lightweight
- Simpler API
- Good for embedded use

### File System: Virtual

**Decision**: In-memory virtual file system

**Rationale**:

1. No server needed
2. Fast access
3. Easy to implement
4. Can persist to LocalStorage

### Sharing: URL Encoding

**Decision**: Encode programs in URL

**Rationale**:

1. No backend needed
2. Easy to share
3. Works offline
4. Privacy-friendly

**Implementation**:

```typescript
// Compress and encode
const compressed = pako.deflate(source);
const base64 = btoa(String.fromCharCode(...compressed));
const url = `https://blitz3d.exe.xyz/ide#code=${base64}`;

// Decode and decompress
const base64 = location.hash.slice(6); // Remove '#code='
const compressed = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
const source = pako.inflate(compressed, { to: "string" });
```

## Architecture

### Project Structure

```
web-ide/
├── src/
│   ├── compiler/
│   │   ├── lexer.ts          # Tokenization
│   │   ├── parser.ts         # AST generation
│   │   ├── ast.ts            # AST node types
│   │   ├── ir.ts             # IR types
│   │   ├── lowering.ts       # AST -> IR
│   │   ├── optimizer.ts      # IR optimizations
│   │   ├── codegen.ts        # IR -> WASM
│   │   └── compiler.ts       # Main compiler class
│   │
│   ├── editor/
│   │   ├── Monaco.tsx        # Monaco wrapper
│   │   ├── theme.ts          # Blitz3D theme
│   │   ├── language.ts       # Language definition
│   │   └── completion.ts     # Code completion
│   │
│   ├── runtime/
│   │   └── bridge.ts         # Runtime integration
│   │
│   ├── ui/
│   │   ├── IDE.tsx           # Main IDE component
│   │   ├── Editor.tsx        # Editor panel
│   │   ├── Output.tsx        # Console output
│   │   ├── Preview.tsx       # Game preview
│   │   └── Examples.tsx      # Example programs
│   │
│   └── App.tsx               # Root component
│
├── public/
│   ├── examples/             # Example programs
│   └── runtime/              # Runtime assets
│
└── package.json
```

### Data Flow

```
┌──────────┐
│  User    │
│  Types   │
└────┬─────┘
     │
     v
┌──────────────────┐
│  Monaco Editor   │  <-- Syntax highlighting
│                  │  <-- Code completion
│                  │  <-- Error diagnostics
└────┬─────────────┘
     │ On change (debounced)
     v
┌──────────────────┐
│  TypeScript      │  Lexer -> Parser -> IR -> WASM
│  Compiler        │
└────┬─────────────┘
     │
     ├──> Errors/Warnings ─┐
     │                      │
     v                      v
┌──────────────────┐   ┌─────────────┐
│  WASM Binary     │   │  Console    │
└────┬─────────────┘   └─────────────┘
     │
     v
┌──────────────────┐
│  Runtime         │  Three.js + Web Audio
│  (Existing)      │
└────┬─────────────┘
     │
     v
┌──────────────────┐
│  Canvas          │  Game output
└──────────────────┘
```

## Minimal Viable Product (MVP)

**Goal**: Prove the concept works

**Scope**:

- Parse simple Blitz3D programs
- Generate WASM
- Run in browser
- Basic UI

**Example Program**:

```blitz3d
; MVP Test Program
Global x = 100
Global y = 100

For i = 0 To 10
    x = x + 10
    Print x
Next
```

**Timeline**: 1 week

## Next Steps

### Immediate (This Week)

1. **Create TypeScript compiler skeleton**
   - Set up project
   - Implement basic lexer
   - Start parser

2. **Prototype web UI**
   - Monaco Editor integration
   - Compile button
   - Output display

3. **Test with simple program**
   - Compile "Hello World"
   - Run in runtime
   - Verify end-to-end

### Short Term (Next 2 Weeks)

1. **Complete core compiler**
   - Full parser
   - IR generation
   - WASM codegen

2. **Working IDE**
   - Professional UI
   - Error display
   - Run programs

3. **Examples library**
   - 5-10 example programs
   - Load from UI

### Long Term (1-2 Months)

1. **Feature parity**
   - Match Swift compiler
   - All language features

2. **Polish**
   - Syntax highlighting
   - Code completion
   - Share functionality

3. **Documentation**
   - User guide
   - API docs
   - Tutorials

## Success Metrics

### MVP Success

- [ ] Compile simple program in browser
- [ ] Run compiled WASM
- [ ] See output on canvas
- [ ] No backend required

### Beta Success

- [ ] Compile SCPCB demo programs
- [ ] Professional IDE UI
- [ ] Share programs via URL
- [ ] Good performance (<1s compilation)

### Production Success

- [ ] Full Blitz3D language support
- [ ] Optimizations working
- [ ] Excellent user experience
- [ ] Community adoption

## Resources

### Reference Implementations

- Swift compiler: `Sources/Compiler/`
- Existing runtime: `web/src/runtime/`
- Parser reference: Original Blitz3D-NG

### Tools & Libraries

- **Monaco Editor**: https://microsoft.github.io/monaco-editor/
- **WASM Binaryen**: https://github.com/WebAssembly/binaryen (if needed)
- **Pako**: https://github.com/nodeca/pako (compression for URL sharing)

### Learning Resources

- Crafting Interpreters: https://craftinginterpreters.com/
- WASM Spec: https://webassembly.github.io/spec/
- Relooper: Emscripten algorithm

## Conclusion

A client-side Blitz3D IDE is achievable and valuable:

✅ **Benefits**:

- Instant gratification (no setup)
- Educational tool
- Easy sharing
- Community building
- Portfolio piece

✅ **Feasible**:

- TypeScript compiler is doable
- Runtime already works
- Monaco provides great UX
- All client-side (no backend costs)

**Recommended Path**: Start with TypeScript compiler MVP, prove concept, then
build out full IDE.
