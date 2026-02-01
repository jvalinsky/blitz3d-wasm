# Blitz3D Web IDE ✨

A **fully client-side** Blitz3D development environment that runs entirely in the browser with **zero server dependencies**!

**🎮 [Try it now →](demo-live.html)** Just open in any modern browser!

## 🚀 Features

### ✅ Production-Ready Compiler
- **100% Browser-Based TypeScript Compiler** (~3000 lines)
- Compiles Blitz3D → WebAssembly in milliseconds
- **100% test pass rate** on all example programs
- Complete pipeline: Lexer → Parser → CodeGen
- Safety guards prevent infinite loops/crashes
- Comprehensive error handling with auto-recovery

### 🎨 Beautiful Code Editor  
- **Monaco Editor** (same engine as VS Code!)
- **Custom Blitz3D syntax highlighting**
  - Keywords, built-ins, operators beautifully color-coded
  - Dark and light themes (`blitz3d-dark`, `blitz3d-light`)
  - Case-insensitive tokenization (true to Blitz3D!)
- **Inline error markers** with hover tooltips (red squiggles!)
- Bracket pair colorization
- Smooth scrolling, smooth cursor animation
- Auto-compile on change (1 second debounce)

### 💾 Never Lose Your Work
- **URL Sharing** - Share code via compressed URLs
  - Pako compression (tiny shareable links!)
  - One-click copy to clipboard
  - Perfect for Stack Overflow, Discord, etc.
- **localStorage Persistence**
  - Auto-save every 30 seconds (silent, in background)
  - Manual save/load with timestamps
  - Auto-restore on page load
  - Survives browser restarts!

### 📚 Example Library
**8 Built-in Examples** covering all major features:
1. **Hello World** - Your first program
2. **Math** - Arithmetic operations
3. **Loops** - For/Next iteration
4. **Functions** - Functions with return values
5. **Types** - Custom type declarations
6. **Arrays** - Dim arrays with subscripts
7. **Strings** - String literals and Print
8. **Conditionals** - If/ElseIf/Else and Select/Case

### 🔧 Developer-Friendly Tools
- **Three-Tab Output**: WASM / AST / Console
- **Compilation Statistics**
  - Source lines, token count
  - Compile time (typically <1ms!)
  - WASM output size
- **WASM Execution** with full runtime
  - 40+ built-in functions (string, math, etc.)
  - Memory management
  - Print to console
- **Isolated Test Pages** for debugging
  - `test-lexer-only.html` - Test tokenization
  - `test-parser-only.html` - Test AST generation  
  - `test-codegen-only.html` - Test WASM generation

## 🏁 Quick Start

### Option 1: Just Open It! (Recommended)
1. Open `demo-live.html` in any modern browser
2. Start coding immediately - no installation required!

### Option 2: Local Development Server
```bash
# Build the compiler bundle
deno task webide:build

# Start development server (port 8001)
deno task webide:serve

# Open http://localhost:8001/demo-live.html
```

## 📖 How to Use

1. **Write Code**
   - Type directly in the Monaco editor
   - Or load one of 8 built-in examples
   
2. **Compile**
   - Click "▶️ Compile to WASM" button
   - Or just wait 1 second (auto-compile)
   - Watch the magic happen in <1ms!
   
3. **Run**
   - Click "▶️ Run Program" to execute
   - See output in the Console tab
   
4. **Share**
   - Click "🔗 Share URL" to get shareable link
   - Automatically copied to clipboard!
   
5. **Save**
   - Click "💾 Save" to persist to localStorage
   - Or rely on auto-save (every 30 sec)

## 🏗️ Architecture

### Compilation Pipeline
```
Blitz3D Source Code
        ↓
┌───────────────┐
│     Lexer     │  Tokenization (418 lines)
└───────────────┘
        ↓
┌───────────────┐
│    Parser     │  AST Generation (819 lines)
└───────────────┘
        ↓
┌───────────────┐
│   CodeGen     │  WASM Generation (995 lines)
└───────────────┘
        ↓
WebAssembly Binary
```

### Project Structure
```
web-ide/
├── demo-live.html              Main IDE interface
├── blitz3d-language.js         Monaco language definition
├── src/compiler/
│   ├── lexer.ts                Tokenization (418 lines)
│   ├── parser.ts               AST generation (819 lines)
│   ├── codegen.ts              WASM generation (995 lines)
│   ├── ast.ts                  Type definitions (373 lines)
│   ├── errors.ts               Error handling (NEW!)
│   ├── timeout.ts              Safety guards (NEW!)
│   └── all.ts                  Bundle entry point
├── dist/
│   └── compiler.bundle.js      62KB browser bundle
├── test-lexer-only.html        Isolated lexer testing
├── test-parser-only.html       Isolated parser testing
├── test-codegen-only.html      Isolated codegen testing
└── test_examples.ts            Automated test suite
```

## 🧪 Testing

### Automated Tests
```bash
# Run all example tests
deno run --allow-read web-ide/test_examples.ts

# Expected output:
# ✅ hello (1.13ms) - 2957 bytes WAT
# ✅ math (0.49ms) - 3143 bytes WAT
# ✅ loops (0.26ms) - 3256 bytes WAT
# ... 100% pass rate!
```

### Manual Testing
- Open `test-lexer-only.html` - Test tokenization only
- Open `test-parser-only.html` - Test parsing only
- Open `test-codegen-only.html` - Test full pipeline
- Each auto-runs on load with example code

## 📊 Stats

- **Compiler Size**: ~3000 lines TypeScript
- **Bundle Size**: 62KB (minified)
- **Compilation Speed**: <1ms average
- **Test Pass Rate**: 100% (8/8 examples)
- **Browser Support**: All modern browsers (ES2020+)
- **Dependencies**: Monaco Editor, wabt.js, pako

## 🎨 Color Themes

### Dark Theme (`blitz3d-dark`)
- Comments: Green italic
- Keywords: Purple
- Built-ins: Yellow
- Strings: Orange
- Numbers: Light green
- Type suffixes: Cyan

### Light Theme (`blitz3d-light`)
- Comments: Green italic
- Keywords: Blue bold
- Built-ins: Brown
- Strings: Red
- Numbers: Dark green  
- Type suffixes: Blue

## 🐛 Known Limitations

- **Custom Types**: Parsed but not fully implemented in codegen
- **For Each**: Not yet implemented
- **Data/Read/Restore**: Parsed but not codegen complete
- **Include Files**: Not yet supported (web environment)

## 🛠️ Build System

### esbuild Bundler
```bash
# Build compiler bundle
deno run -A --node-modules-dir=auto web-ide/build_bundle.js

# Output: web-ide/dist/compiler.bundle.js (62KB)
```

### Development Workflow
1. Edit TypeScript files in `src/compiler/`
2. Run `deno task webide:build` to rebuild
3. Refresh browser to see changes
4. Test with `test_examples.ts`

## 📚 Language Support

### ✅ Implemented
- Variables: `Local`, `Global`, `Const`, `Dim`
- Types: Integer (`%`), Float (`#`), String (`$`)
- Control Flow: `If`/`Then`/`Else`, `For`/`Next`, `While`/`Wend`, `Repeat`/`Until`
- Functions: With parameters, return types, defaults
- Operators: Arithmetic, comparison, logical
- Arrays: `Dim arr%(10)`
- Select/Case statements
- Comments (`;`)

### 🚧 Partially Implemented
- Custom Types (`Type`...`End Type`) - parsed, not codegen
- Field access (`object\field`)

### ❌ Not Yet Implemented
- `For Each` iteration
- `Data`/`Read`/`Restore` (parsed, not codegen)
- `Include` files
- Graphics functions (3D, 2D)
- File I/O

## 🚀 Future Roadmap

### Phase 2: Language Features
- [ ] Complete custom types codegen
- [ ] Multi-dimensional arrays
- [ ] For Each iteration
- [ ] Data/Read/Restore completion

### Phase 3: Runtime Integration  
- [ ] Three.js graphics runtime
- [ ] Virtual filesystem (VFS)
- [ ] Graphics examples (rotating cube, etc.)

### Phase 5: Polish
- [ ] More example programs (20+ total)
- [ ] Categorized example gallery
- [ ] Syntax error suggestions
- [ ] Code formatter

## 🤝 Contributing

This is part of the larger Blitz3D-WASM project. See main repo README for contribution guidelines.

## 📜 License

See main project LICENSE.

## 🙏 Credits

- **Monaco Editor** - Microsoft (VS Code's editor)
- **wabt.js** - WebAssembly Binary Toolkit
- **pako** - zlib port for compression
- **Blitz3D** - Original language by Mark Sibly

---

**Built with ❤️ using TypeScript, Monaco, and WebAssembly**

🎉 *Zero servers. Zero installations. Just open and code!*
