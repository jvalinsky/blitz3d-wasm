# Testing Strategy

**Date**: February 1, 2026  
**Purpose**: Validation approach for compiler and runtime changes

---

## Testing Pyramid

```
           /\
          /  \  E2E (SCPCB Integration)
         /────\
        /      \  Integration Tests
       /────────\
      /          \  Unit Tests
     /────────────\
```

---

## Unit Tests

### Compiler Tests

**Location**: `Tests/CompilerTests/`

**Categories**:
1. **Lexer Tests**
   - Tokenization correctness
   - Type suffix handling
   - Keyword recognition
   - String literal parsing

2. **Parser Tests**
   - Statement parsing
   - Expression parsing
   - Control flow structures
   - Type declarations
   - **Include file handling** (NEW)

3. **Type System Tests**
   - Type inference
   - Type suffix edge cases
   - Implicit variable declaration
   - Function return types

4. **CodeGen Tests**
   - WASM instruction generation
   - Stack balance validation
   - Import generation
   - Function signatures

**Example Test**:
```swift
func testIncludeFileHandling() {
    let source = """
    Include "test.bb"
    Print "Main"
    """
    
    let compiler = Compiler(source: source)
    let result = compiler.compile()
    
    XCTAssertTrue(result.success)
    XCTAssertEqual(result.includedFiles.count, 1)
    XCTAssertTrue(result.includedFiles.contains("test.bb"))
}
```

---

### Runtime Tests (TypeScript)

**Location**: `web/src/runtime/runtime.test.ts`

**Categories**:
1. **Math Functions**
   - Accuracy tests (compare to Math.*)
   - Edge cases (NaN, infinity)
   - Performance benchmarks

2. **String Functions**
   - Correctness tests
   - 1-based indexing validation
   - Memory leak detection
   - Empty string handling

3. **File I/O**
   - VFS read/write
   - Path resolution
   - Error handling

4. **Asset Loading**
   - Format parsing (B3D, RMESH, X)
   - Texture loading
   - Error handling

**Example Test**:
```typescript
Deno.test("Math: sin function accuracy", () => {
    for (let angle = 0; angle <= Math.PI * 2; angle += 0.1) {
        const result = mathFunctions.sin(angle);
        const expected = Math.sin(angle);
        assertAlmostEquals(result, expected, 0.0001);
    }
});

Deno.test("String: mid function 1-indexed", () => {
    const str = stringManager.allocate("Hello World");
    const result = stringFunctions.mid(str, 7, 5);  // "World"
    const resultStr = stringManager.get(result);
    assertEquals(resultStr, "World");
});
```

---

### Engine Tests (Swift)

**Location**: `Sources/Blitz3DEngine/Tests/`

**Categories**:
1. **Scene Graph**
   - Entity creation/destruction
   - Transform operations
   - Hierarchy management

2. **Collision**
   - LinePick ray casting
   - Collision detection
   - Normal calculation

3. **Memory**
   - Bank operations
   - Bounds checking
   - Memory leak detection

**Example Test**:
```swift
func testLinePick() {
    let mesh = createTestMesh()
    let origin = Vector3(0, 0, 0)
    let direction = Vector3(0, 0, 1)
    
    let hit = linePick(origin, direction, mesh)
    
    XCTAssertNotNil(hit)
    XCTAssertEqual(hit!.distance, 5.0, accuracy: 0.01)
}
```

---

## Integration Tests

### Fixture Tests

**Location**: `Tests/fixtures/`

**Strategy**: Compile and execute small Blitz3D programs

**Categories**:
- `control_flow/` - If, For, While, Repeat, Select
- `functions/` - Function declarations, calls, returns
- `types/` - Custom types, New, Delete, First, Last
- `math/` - Math function usage
- `strings/` - String operations
- `files/` - File I/O operations
- `includes/` - Include file tests (NEW)

**Example**:
```bash
# Tests/fixtures/includes/basic_include.bb
Print "Main file"
Include "helper.bb"
Print "Back to main"

# Tests/fixtures/includes/helper.bb
Print "Included file"
```

**Test Script**:
```bash
deno task test:fixtures
# Compiles all fixtures and validates output
```

---

### SCPCB Compilation Tests

**Location**: `Tests/IntegrationTests/scpcb/`

**Goal**: Ensure all 57 SCPCB files compile

**Test Suite**:
```typescript
Deno.test("SCPCB: All files compile", async () => {
    const scpcbPath = "/Users/jack/Software/scp_port/scpcb/";
    const files = await findBlitz3DFiles(scpcbPath);
    
    for (const file of files) {
        const result = await compileFile(file);
        assert(result.success, `Failed to compile: ${file}\n${result.errors}`);
    }
});

Deno.test("SCPCB: Main.bb with includes", async () => {
    const result = await compileFile("scpcb/Main.bb");
    
    assert(result.success);
    assertEquals(result.includedFiles.length, 23);
    assert(result.wasmOutput.length > 0);
});
```

---

## End-to-End Tests

### Browser Tests

**Tool**: Puppeteer or Playwright

**Location**: `Tests/e2e/`

**Test Cases**:
1. **Basic Rendering**
   ```typescript
   test("Renders triangle", async ({ page }) => {
       await page.goto("http://localhost:8000/test.html");
       await page.waitForSelector("canvas");
       
       const screenshot = await page.screenshot();
       expect(screenshot).toMatchSnapshot();
   });
   ```

2. **Input Handling**
   ```typescript
   test("Keyboard input works", async ({ page }) => {
       await page.goto("http://localhost:8000/input_test.html");
       await page.keyboard.press("ArrowUp");
       
       const position = await page.evaluate(() => window.playerY);
       expect(position).toBeGreaterThan(0);
   });
   ```

3. **Audio Playback**
   ```typescript
   test("Plays sound", async ({ page }) => {
       await page.goto("http://localhost:8000/audio_test.html");
       await page.click("#play-button");
       
       const playing = await page.evaluate(() => window.audioPlaying);
       expect(playing).toBe(true);
   });
   ```

---

### SCPCB Functional Tests

**Goal**: Test actual gameplay

**Checkpoints**:
1. **Loading**
   - Assets load without errors
   - Intro screen appears
   - Can skip to game

2. **Movement**
   - WASD keys move player
   - Mouse look works
   - Collision prevents walking through walls

3. **Interaction**
   - Can pick up items
   - Doors open/close
   - UI responds to clicks

4. **Audio**
   - Ambient music plays
   - Sound effects trigger
   - 3D audio positioning works

5. **Performance**
   - Maintains 60 FPS
   - No memory leaks
   - Stable over time

**Test Script**:
```typescript
Deno.test("SCPCB: Basic gameplay", async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    await page.goto("http://localhost:8000/scpcb.html");
    await page.waitForSelector("#game-canvas");
    
    // Test movement
    await page.keyboard.press("w");
    await page.waitForTimeout(100);
    const moved = await page.evaluate(() => window.playerMoved);
    assert(moved);
    
    // Test FPS
    const fps = await page.evaluate(() => window.currentFPS);
    assert(fps >= 55, `FPS too low: ${fps}`);
    
    await browser.close();
});
```

---

## Performance Tests

### Benchmarks

**Location**: `Tests/benchmarks/`

**Categories**:
1. **Compilation Speed**
   ```typescript
   Deno.bench("Compile SCPCB Main.bb", async () => {
       await compileFile("scpcb/Main.bb");
   });
   ```

2. **Runtime Performance**
   ```typescript
   Deno.bench("Math: 1M sin() calls", () => {
       for (let i = 0; i < 1_000_000; i++) {
           mathFunctions.sin(i);
       }
   });
   ```

3. **Memory Usage**
   ```typescript
   Deno.test("Memory: No leaks in string operations", () => {
       const initialMemory = performance.memory.usedJSHeapSize;
       
       for (let i = 0; i < 10_000; i++) {
           const str = stringManager.allocate("test" + i);
           stringManager.free(str);
       }
       
       gc();  // Force GC
       const finalMemory = performance.memory.usedJSHeapSize;
       
       const leak = finalMemory - initialMemory;
       assert(leak < 1_000_000, `Memory leak detected: ${leak} bytes`);
   });
   ```

---

## Regression Tests

**Strategy**: Capture bugs as tests

**Example**:
```typescript
Deno.test("Regression: Type suffix optional", () => {
    // Bug: Compiler failed when suffix omitted
    const source = `
    x = 10
    y% = 20
    z = x + y  ; Mixed usage
    `;
    
    const result = compile(source);
    assert(result.success);
});
```

---

## Test Coverage Goals

### Unit Tests
- Compiler: 80%+ line coverage
- Runtime: 80%+ function coverage
- Engine: 70%+ coverage

### Integration Tests
- All 57 SCPCB files compile
- All major features tested

### E2E Tests
- SCPCB loads and runs
- No critical bugs
- 60 FPS performance

---

## Continuous Integration

**GitHub Actions Workflow**:
```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Swift
        uses: swift-actions/setup-swift@v1
        
      - name: Setup Deno
        uses: denoland/setup-deno@v1
      
      - name: Run Swift tests
        run: swift test
        
      - name: Run Deno tests
        run: deno task test:all
        
      - name: Compile SCPCB
        run: deno task scpcb:compile:main
        
      - name: Validate WASM
        run: deno task test:web:build
        
      - name: E2E tests
        run: deno task test:e2e
```

---

## Testing Checklist

### Before Each PR
- [ ] All unit tests pass
- [ ] No new compiler warnings
- [ ] WASM validation passes
- [ ] SCPCB compiles successfully

### Before Release
- [ ] All integration tests pass
- [ ] E2E tests pass
- [ ] Performance benchmarks acceptable
- [ ] No memory leaks detected
- [ ] SCPCB playable for 10+ minutes

---

## Next Steps

1. Implement include file support
2. Add unit tests for includes
3. Test with SCPCB Main.bb
4. Validate all 23 includes load correctly
5. Add integration tests for common patterns
6. Run E2E tests with actual gameplay

---

**End of Testing Strategy Document**

---

## Plan Complete

All 9 documents created:
1. ✅ 00-README.md - Plan overview
2. ✅ 01-executive-summary.md - High-level findings
3. ✅ 02-compiler-comparison.md - Swift vs Blitz3D-NG compiler
4. ✅ 03-runtime-comparison.md - Swift engine vs runtime (750+ functions)
5. ✅ 04-critical-issues.md - Blocking issues
6. ✅ 05-priority-matrix.md - Implementation priorities
7. ✅ 06-implementation-roadmap.md - Phased approach
8. ✅ 07-scpcb-compatibility.md - SCPCB requirements
9. ✅ 08-architecture-decisions.md - Design rationale
10. ✅ 09-testing-strategy.md - Validation approach

**Total Plan Size**: ~100 pages equivalent
**Timeline**: 6-12 months for full SCPCB compatibility
**Critical Path**: 7-11 weeks for P0 issues
