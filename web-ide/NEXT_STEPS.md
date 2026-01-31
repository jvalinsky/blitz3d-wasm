# Blitz3D Web IDE - Next Steps

## Current Status

✅ **Completed**:
- TypeScript Compiler (2070 lines): Lexer, Parser, CodeGen
- esbuild bundler generating 47KB browser bundle
- Demo pages with Monaco Editor setup
- Example programs collection

⚠️ **Issue**: Browser crashes on test page (likely infinite loop)

## Priority 1: Fix Browser Crash

**Problem**: `test_bundle.html` crashes browser

**Actions**:
1. Add iteration guards to all `while` loops:
   ```typescript
   let safety = 0;
   while (condition && ++safety < 10000) { ... }
   ```

2. Test components separately:
   - Lexer only
   - Parser only  
   - CodeGen only

3. Files to fix:
   - `src/compiler/parser.ts` line 491 (`while(true)`)
   - `src/compiler/lexer.ts` (tokenization loops)
   - `src/compiler/codegen.ts` (generation loops)

## Priority 2: Get Demo Working

1. Fix crash from Priority 1
2. Complete `demo-live.html` integration
3. Test WAT → WASM conversion with wabt.js
4. Add error handling
5. Test all example programs

## Priority 3: Basic Runtime

Implement minimal WASM execution:
```javascript
const runtime = {
  env: {
    print_i32: (n) => output.textContent += n + '\n',
    print_str: (ptr) => output.textContent += readString(ptr) + '\n'
  }
};
WebAssembly.instantiate(wasm, runtime).then(...);
```

## Priority 4: Missing BB Features

- Arrays: `Dim arr%(10)`
- Types: `Type Player ... End Type`
- More built-ins

## Priority 5: Monaco Integration

- Custom BB language definition
- Syntax highlighting
- Auto-completion
- Error markers

## Priority 6: Polish

- URL code sharing
- Save/load (localStorage)
- Better UI/UX
- Examples gallery

## Files to Review

```
web-ide/
├── src/compiler/
│   ├── lexer.ts (412 lines)
│   ├── parser.ts (638 lines) ← CHECK LINE 491
│   ├── codegen.ts (617 lines)
│   └── ast.ts (346 lines)
├── demo-live.html ← Main demo
├── dist/compiler.bundle.js ← Built bundle
└── build.ts ← esbuild config
```

## Success Criteria

**This Week**:
- [ ] Browser doesn't crash
- [ ] Simple programs compile
- [ ] See WAT output

**This Month**:
- [ ] All examples work
- [ ] Monaco integrated
- [ ] Basic WASM execution
- [ ] "Hello World" runs

## Testing Plan

1. Create `test_simple.html` - test lexer only
2. Create `test_parser.html` - test parser only
3. Add safety guards to all loops
4. Test with increasing complexity
5. Add timeout (5 second max compilation)

## Resources

- Monaco Editor: https://microsoft.github.io/monaco-editor/
- wabt.js: https://github.com/AssemblyScript/wabt.js
- WebAssembly: https://webassembly.org/
