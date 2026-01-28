# Blitz3D WASM Integration Tests

This directory contains integration tests for the Blitz3D WASM compiler and runtime.

## Test Structure

```
Tests/
├── IntegrationTests/
│   ├── IntegrationTests.swift    # Swift XCTests for compiler
│   ├── run_tests.js              # Deno test runner
│   ├── runtime_test.js           # Runtime simulation tests
│   ├── integration_tests.html    # Browser-based test UI
│   ├── test_read_file.bb         # Test BASIC file
│   └── Assets/
│       ├── output/               # Generated WASM files
│       ├── test_string_data.bb
│       ├── test_multiple_types.bb
│       ├── test_data_loop.bb
│       └── test_restore.bb
```

## Running Tests

### Swift XCTests

```bash
cd /path/to/blitz3d-wasm
swift test
```

This runs all unit tests including:
- Lexer tests
- Parser tests  
- Code generator tests
- Binary encoder tests
- NEW: Integration tests for data/asset compilation

### Deno Integration Tests

```bash
cd Tests/IntegrationTests
node run_tests.js
```

This compiles test BASIC files and verifies:
- Successful WASM compilation
- Valid WASM binary structure
- Data section generation

### Browser Tests

Open `integration_tests.html` in a browser to run visual tests.

## Test Cases

### Swift Tests (IntegrationTests.swift)

1. **Asset Compilation Tests**
   - `testCompileWithEmbeddedData` - Compile code with embedded string data
   - `testCompileWithMultipleDataStatements` - Compile multiple data types
   - `testCompileWithDataAndReadLoop` - Compile Data/Read with For loops
   - `testCompileWithRestoreStatement` - Compile Restore functionality

2. **WAT Output Tests**
   - `testGenerateWATWithDataSection` - Verify WAT contains data sections
   - `testWATDataSectionFormat` - Verify data section format

3. **Binary Encoding Tests**
   - `testBinaryEncodeDataSection` - Verify WASM binary structure
   - `testAssetManifestGeneration` - Verify manifest generation

4. **Multi-file Project Tests**
   - `testCompileWithIncludeStatement` - Test Include statements

### Deno Tests (run_tests.js)

1. `test_string_data.bb` - Embedded string data
2. `test_multiple_types.bb` - Multiple data types (int, float, string)
3. `test_data_loop.bb` - Data with loop
4. `test_restore.bb` - Restore statement

## Adding New Tests

### Adding Swift Tests

Add new test methods to `IntegrationTests.swift`:

```swift
func testMyNewFeature() throws {
    let source = """
    Function Main()
        ' Your test code here
    End Function
    """
    var parser = Parser(source: source)
    let program = parser.parse()
    
    var codeGen = CodeGenerator()
    let module = codeGen.generate(from: program)
    
    // Add assertions
    XCTAssertGreaterThan(module.code.count, 0)
}
```

### Adding Deno Tests

Add to the `tests` array in `run_tests.js`:

```javascript
{
    name: "Test Name",
    file: "test_file.bb",
    expectedOutput: ["expected", "output"]
}
```

Then create the corresponding `.bb` file in `Assets/`.

## Test Results

Current test results:
- **Swift XCTests**: 82 tests, 0 failures
- **Deno Integration**: 4 tests, 0 failures

## CI Integration

Add to your CI pipeline:

```yaml
- name: Run Swift Tests
  run: swift test

- name: Run Integration Tests
  run: |
    cd Tests/IntegrationTests
    node run_tests.js
```
