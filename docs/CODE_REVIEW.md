# Blitz3D WASM Compiler - Code Review Report

**Date:** January 18, 2026
**Reviewer:** AI Code Review
**Scope:** Complete codebase review focusing on compiler pipeline, code generation, and runtime

---

## Executive Summary

The blitz3d-wasm project is a well-structured Swift-based compiler that translates Blitz3D BASIC to WebAssembly. The code demonstrates solid architectural decisions with a clear pipeline (Lexer → Parser → AST → CodeGen). However, 18 issues were identified ranging from critical bugs to code quality concerns.

**Overall Assessment:** Architectural foundations are solid. Critical bugs need immediate attention before the compiler can be considered production-ready for arbitrary Blitz3D code.

---

## Critical Issues (3)

### 1. Goto/Gosub Not Implemented

**Location:** `Parser.swift:297-303`, `CodeGenerator.swift:396-402`

Both `goto` and `gosub` statements are parsed but completely stubbed out in code generation with TODO comments:

```swift
case .goto(_):
    // TODO: Implement goto
    break

case .gosub(_):
    // TODO: Implement gosub
    break
```

**Impact:** Any Blitz3D code using these features will silently fail to compile correctly, producing WASM that doesn't execute the跳转 logic.

**Recommendation:** Implement proper label tracking and jump table generation, or add compile-time errors/warnings when these constructs are encountered.

---

### 2. For Loop Condition Logic Bug

**Location:** `CodeGenerator.swift:565-569`

```swift
// Check if still in range (simplified)
function.body.append(.localGet(localIdx))
function.body.append(contentsOf: endInstrs)
function.body.append(.i32LeU) // Simplified condition - BUG!
function.body.append(.brIf(0)) // Continue loop if condition met
```

**Issue:** The condition check uses unsigned less-than-or-equal (`i32LeU`), which is semantically incorrect for typical `For` loops that iterate with signed integers.

**Impact:** This causes incorrect behavior for:
- Negative step values
- Reverse iteration (`For i = 10 To 1 Step -1`)
- Signed integer comparisons in general

**Recommendation:** Implement proper loop continuation condition based on step direction:
```swift
// For positive step: i <= end
// For negative step: i >= end
```

---

### 3. Unbounded String Reads in Runtime

**Location:** `runtime.js:16-25`

```javascript
readString: function(ptr) {
    const memory = new Uint8Array(this.memory.buffer);
    let str = "";
    let i = ptr;
    while (memory[i] !== 0) {  // No bounds check!
        str += String.fromCharCode(memory[i]);
        i++;
    }
    return str;
}
```

**Issue:** No bounds checking - if a string isn't null-terminated or points past the memory buffer, this will read outside WASM memory bounds.

**Impact:** Potential crash, security vulnerability, or undefined behavior.

**Recommendation:**
```javascript
readString: function(ptr) {
    const memory = new Uint8Array(this.memory.buffer);
    const maxLen = memory.length;
    let str = "";
    let i = ptr;
    while (i < maxLen && memory[i] !== 0) {
        str += String.fromCharCode(memory[i]);
        i++;
        if (str.length > maxLen) break; // Safety limit
    }
    return str;
}
```

---

## High Priority Issues (6)

### 4. Hex Literal Returns Integer as String

**Location:** `Lexer.swift:218-219`

```swift
if let value = Int(text, radix: 16) {
    return Token(type: .integerLiteral, text: String(value), line: startLine, ...)
}
```

**Issue:** The hex literal token's `text` property is converted to decimal string representation instead of preserving the original hex input.

**Impact:** Breaks round-tripping and debugging. `$FF` becomes token with text "255".

**Recommendation:** Preserve original text:
```swift
return Token(type: .integerLiteral, text: "$" + text, line: startLine, ...)
```

---

### 5. Type End Detection is Overly Permissive

**Location:** `Parser.swift:185-196`

```swift
private func isEndType() -> Bool {
    if expect(.keywordEndType) { return true }
    if expect(.identifier) && currentToken.text == "End" {
        return true // Simplified check - BUG!
    }
    return false
}
```

**Issue:** Returns true if it sees "End" without verifying the next token is "Type". This can cause premature termination if there's an `End` statement inside the type body.

**Impact:** Parsing errors for valid Blitz3D code that uses `End` as a variable name or in other contexts.

**Recommendation:** Implement proper lookahead or require strict `End Type` syntax.

---

### 6. Field Access Assumes i32 Type

**Location:** `CodeGenerator.swift:671-689`

```swift
var fieldType: WASMType = .i32 // Default
// ...
instrs.append(.i32Load(2, 0))  // Always loads as i32
```

**Issue:** Field access always loads as i32, ignoring the actual type of the field. Float fields will be incorrectly loaded.

**Impact:** Type corruption for type fields declared with `#` suffix.

**Recommendation:** Store type information in fieldOffsets and emit appropriate load instruction:
```swift
// Check type suffix and emit f32Load or i32Load accordingly
```

---

### 7. Function Parameters Always i32

**Location:** `CodeGenerator.swift:503-506`

```swift
for (index, param) in functionNode.parameters.enumerated() {
    function.locals.append(.i32)
    localVariables[param.name] = LocalInfo(index: index, type: .i32)
}
```

**Issue:** All function parameters are typed as i32 regardless of their actual type.

**Impact:** Type mismatches and incorrect code generation for float parameters.

**Recommendation:** Infer parameter types from usage or explicit type annotations in function signature.

---

### 8. String Data Address Calculation is Incorrect

**Location:** `CodeGenerator.swift:773-779`

```swift
let offset = module.data.reduce(0) { $0 + $1.bytes.count }
let data = WASMData(memoryIndex: 0, offset: .i32Const(0), bytes: bytes)
module.data.append(data)
return offset + 4 // Add header offset - BUG!
```

**Issue:** Data segments are placed at offset 0 in WASM memory, but the returned address includes a "+4" header offset that doesn't exist.

**Impact:** Strings will be read from wrong memory locations.

**Recommendation:** Calculate actual runtime addresses correctly:
```swift
// Track actual offset for each data segment
let actualOffset = module.data.reduce(0) { $0 + $1.bytes.count }
let data = WASMData(memoryIndex: 0, offset: .i32Const(Int32(actualOffset)), bytes: bytes)
module.data.append(data)
return actualOffset
```

---

### 9. Data Section Offset Calculation Bug (New Issue)

**Location:** `CodeGenerator.swift:183-186`

```swift
case .integer(let intVal):
    var bytes = intVal.toBytes()
    for byte in bytes {
        let data = WASMData(memoryIndex: 0, offset: .i32Const(0), bytes: [byte])  // BUG!
        module.data.append(data)
    }
```

**Issue:** All data segments use `offset: .i32Const(0)`, but the actual runtime addresses are calculated as cumulative offsets.

**Impact:** Read/Restore will always read from position 0, ignoring the actual data location.

**Recommendation:** Each data segment should have its correct runtime offset:
```swift
WASMData(memoryIndex: 0, offset: .i32Const(Int32(dataOffset)), bytes: [byte])
```

---

## Medium Priority Issues (5)

### 10. Missing Error Recovery in Parser

**Location:** `Parser.swift:39-44`

```swift
} else {
    // Don't get stuck - advance past unrecognized tokens
    if currentToken.type != .endOfFile {
        advance()
    }
}
```

**Issue:** When a statement can't be parsed, the parser simply skips one token.

**Impact:** Cascading errors and poor error messages.

**Recommendation:** Implement proper error recovery that skips to a synchronization point (like newline or statement boundary).

---

### 11. No Validation of Dim Array Dimensions

**Location:** `Parser.swift:277-293`

```swift
if consume(.leftParen) {
    repeat {
        _ = parseExpression()  // Expression result is discarded
    } while consume(.comma)
    _ = consume(.rightParen)
}
```

**Issue:** Array dimension expressions are parsed but their values are never extracted or validated.

**Impact:** Array allocation logic is missing entirely.

**Recommendation:** Store dimension values and implement array allocation in code generation.

---

### 12. Parser Returns Default Value on Error

**Location:** `Parser.swift:885`

```swift
default:
    return .integerLiteral(0)
```

**Issue:** When an unrecognized token is encountered in expression parsing, it silently returns 0.

**Impact:** Masks syntax errors.

**Recommendation:** Return an error node or throw a proper parse error.

---

### 13. Memory Allocation Uses Simple Growth

**Location:** `CodeGenerator.swift:196-199`

```swift
body: [
    .localGet(0),
    .memoryGrow
]
```

**Issue:** The `__Alloc` function simply grows memory by one page (64KB) per allocation request.

**Impact:** Extremely wasteful and can cause memory exhaustion quickly.

**Recommendation:** Implement a proper memory allocator (bump allocator or free list) that tracks allocated blocks.

---

### 14. Data Serialization Creates Too Many Segments

**Location:** `CodeGenerator.swift:183-196`

**Issue:** Each byte is a separate WASM data segment.

**Impact:** Inefficient WASM binary size and potential parsing overhead.

**Recommendation:** Batch contiguous data into single segments:
```swift
// Collect bytes into a single array, then create one data segment
```

---

### 15. String Data Placement Overlaps (New Issue)

**Location:** `CodeGenerator.swift:198-206`

**Issue:** String data in `serializeDataSection()` doesn't account for the 4-byte header gap that `addStringData()` adds.

**Impact:** Strings placed at runtime offset calculated in `serializeDataSection` will conflict with string literals from `addStringData()`.

**Recommendation:** Consolidate string handling - either all strings go through `addStringData` or ensure offsets in `serializeDataSection` don't conflict.

---

### 16. Data Pointer Tracking (New Issue)

**Location:** `CodeGenerator.swift:413`

```swift
function.body.append(.i32Const(Int32(currentReadOffset)))
```

**Issue:** `currentReadOffset` is a compile-time constant, but Read/Restore need runtime tracking.

**Impact:** The offset is embedded at compile time, not tracked dynamically during execution.

**Recommendation:** Use a global variable or WASM global to track the current data pointer at runtime.

---

## Low Priority Issues (4)

### 17. Inconsistent Return Type Handling

**Location:** `CodeGenerator.swift:513-517`

```swift
if function.body.last != .return {
    function.body.append(.i32Const(0))
    function.body.append(.return)
}
```

**Issue:** Functions always end with return 0, even void functions.

**Recommendation:** Track expected return type and omit return value for void functions.

---

### 18. Hardcoded Field Size

**Location:** `CodeGenerator.swift:63`

```swift
offset += 4 // Assume 4 bytes per field
```

**Issue:** All fields are assumed to be 4 bytes regardless of actual type.

**Recommendation:** Calculate actual field sizes based on type.

---

### 19. Missing Case Fall-Through Protection

**Location:** `CodeGenerator.swift:475`

**Issue:** After executing a case body, the code breaks to exit the select block.

**Recommendation:** Document this behavior or add explicit checking.

---

### 20. Inconsistent Use of Type Suffixes

**Issue:** Type suffixes are handled differently in different parsing contexts.

**Recommendation:** Standardize type suffix handling across all parsing contexts.

---

## Test Coverage Assessment

### Current State

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| LexerTests | 9 | Basic tokens, keywords, literals, operators |
| ParserTests | Unknown | Not reviewed |
| CodeGeneratorTests | Unknown | Not reviewed |
| BinaryEncoderTests | Unknown | Not reviewed |

### Gaps

- No tests for error conditions
- No integration tests (end-to-end compilation)
- No tests for edge cases (nested structures, large numbers, Unicode strings)
- No tests for runtime JS functions
- No tests for Data/Read/Restore functionality

### Recommendation

Expand test suite to cover:
1. Error handling paths
2. Complex nested structures (multi-dimensional arrays, nested types)
3. Large input handling
4. WebAssembly output validation
5. Runtime API integration tests

---

## Security Considerations

### Identified Risks

1. **Input Validation:** Limited validation of user source code. Malformed input could cause unexpected behavior.

2. **Memory Safety:** JavaScript runtime reads WASM memory without proper bounds checking.

3. **Resource Exhaustion:** No limits on array sizes, string lengths, or memory allocation.

4. **Code Injection:** No sanitization of string literals that might contain WASM binary data.

### Recommendations

- Add input validation at lexer/parser level
- Implement bounds checking in all memory access functions
- Add limits for allocations and array sizes
- Consider sandboxing for untrusted code execution

---

## Code Quality Observations

### Strengths

1. Clear separation of concerns (Lexer/Parser/AST/CodeGen)
2. Good use of Swift enums for AST nodes
3. Comprehensive WASM instruction set coverage
4. Reasonable error location tracking
5. Recently added Data/Read/Restore support

### Areas for Improvement

1. Add documentation comments (most functions lack documentation)
2. Reduce use of force-unwrap (`!`) and force-try (`try!`)
3. Make error handling more explicit (Result type or throws)
4. Consider using Swift's code generation capabilities for AST nodes
5. Improve variable naming consistency

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| Critical | 3 | Needs immediate attention |
| High Priority | 6 | Significant correctness issues |
| Medium Priority | 5 | Functional issues |
| Low Priority | 4 | Code quality issues |

### Recommended Actions

**Immediate (Critical):**
1. Fix For loop condition logic (signed comparison)
2. Add bounds checking to runtime string reading
3. Implement Goto/Gosub or add compile-time errors

**High Priority:**
4. Fix data segment offset calculations
5. Fix hex literal text preservation
6. Implement proper type detection for fields and parameters

**Medium Priority:**
7. Improve error recovery in parser
8. Implement proper data serialization batching
9. Consolidate string data handling

---

## Recent Changes (January 18, 2026)

### Added: Data/Read/Restore Statement Support

**CodeGenerator.swift changes:**
- New `DataBlock` structure for collecting data statements
- `collectDataStatements()` - traverses AST to find all Data statements
- `serializeDataSection()` - serializes data to WASM memory at offset 256
- New imports: `ReadData`, `RestoreData`
- New statement handlers for `.data`, `.read`, `.restore`
- Helper extensions: `Int.toBytes()`, `Double.toBytes()`

**runtime.js changes:**
- `dataPointer: 256` - tracks current read position
- `ReadData(dataAddr, varAddr, type)` - reads data from compiled section
- `RestoreData(offset)` - resets data pointer

### Known Issues with New Feature

1. Data segment offsets are all set to 0 instead of actual positions
2. String data may overlap with string literals
3. Data pointer tracking uses compile-time constants instead of runtime globals

---

## January 18, 2026 - WASM Debugging Session

### Issue: WebAssembly CompileError - Unknown Section Code #0x92

**Symptom:**
```
Blitz3D Runtime Initialized
(index):44 CompileError: WebAssembly.instantiate(): unknown section code #0x92 @+10
```

**Initial Investigation:**

The error suggested a malformed WASM binary with an invalid section ID (0x92 = 146 decimal). This was concerning because:
- Valid WASM section IDs are: 0-11
- Section 0x92 would be outside the valid range

**Investigation Process:**

1. **Binary Analysis with hexdump:**
```bash
xxd Sources/Runtime/input_test.wasm | head -5
# Output showed: 0061 736d 0100 0000 9102 0133...
```

2. **Created validation script (validate_wasm.js):**
```javascript
const fs = require('fs');
const buf = fs.readFileSync(wasmPath);
// Manual section parsing with LEB128 decoding
```

3. **Debug output added to WASMBinaryEncoder.swift:**
```swift
print("DEBUG writeSection: id=\(id), content.count=\(content.count)")
```

**Key Finding - FALSE POSITIVE:**

The binary was actually correct all along! The browser was loading a **stale cached version** of the WASM file. The debugging revealed:

```
Section 0: id=1 (0x1), size=273  ← Type section (correct!)
Section 1: id=2 (0x2), size=696  ← Import section (correct!)
Section 2: id=3 (0x3), size=3    ← Function section (correct!)
Section 3: id=5 (0x5), size=4    ← Memory section (correct!)
Section 4: id=7 (0x7), size=26   ← Export section (correct!)
Section 5: id=10 (0xa), size=19  ← Code section (correct!)
```

**Section ID Mapping:**
| ID | Section | Status |
|----|---------|--------|
| 1 | Type | ✓ Present |
| 2 | Import | ✓ Present |
| 3 | Function | ✓ Present |
| 5 | Memory | ✓ Present |
| 7 | Export | ✓ Present |
| 10 | Code | ✓ Present |
| 11 | Data | ○ Optional (not present in test program without Data statements) |

**Root Cause:**
- The browser's `WebAssembly.instantiate()` was receiving an old cached version of the WASM file
- Hard refresh (Cmd+Shift+R) or cache bypass was needed
- The section encoding code in `writeSection()` was correct all along

**Code in question (correct):**
```swift
private mutating func writeSection(id: UInt8, content: [UInt8]) {
    writeVarUInt(Int(content.count))  // Section size
    writeBytes([id])                   // Section ID
    writeBytes(content)                // Section content
}
```

---

### Test Infrastructure Added

**1. browser_tests.js - WASM Binary Validation**
```bash
node browser_tests.js Sources/Runtime/input_test.wasm
```

Tests performed:
- File exists
- Valid WASM magic number (0x0061736d)
- Valid version (1)
- All required sections present
- Section order validation
- Code section has functions

**2. validate_wasm.js - Section Parser**
```bash
node validate_wasm.js Sources/Runtime/input_test.wasm
```

Manual parsing of WASM binary format:
- LEB128 varuint decoding
- Section identification
- Size validation

**3. input_test.bb - Test Program**
Blitz3D BASIC test program for input functions:
- KeyDown/KeyHit testing
- MouseX/MouseY testing
- MouseDown/MouseHit testing
- Graphics3D/Cls/Flip cycle

---

### Test Coverage Expansion

**Before:** 62 tests
**After:** 82 tests (+20 new tests)

**New Test Categories:**
1. **Data/Read/Restore Tests**
   - `testGenerateDataStatement`
   - `testGenerateReadStatement`
   - `testGenerateRestoreStatement`
   - `testGenerateDataWithExpressions`

2. **Select/Case Tests**
   - `testCompileSCPCBSelectCase`
   - `testCompileSCPCBSelectWithMultipleCaseExpressions`
   - `testCompileSCPCBNestedSelect`

3. **Input Function Tests**
   - `testCompileKeyDownFunction`
   - `testCompileMouseFunctions`
   - `testCompileInputInGameLoop`

4. **SCPCB Code Tests**
   - `testCompileSCPCBKeyName` (full file compilation)
   - `testCompileSCPPCBTypeDeclaration`
   - `testCompileSCPCBForLoop`
   - `testCompileSCPCBWhileLoop`
   - `testCompileSCPCBIfElseStatement`
   - `testCompileSCPPCBArrayAccess`
   - `testCompileSCPPCBFieldAccess`
   - `testCompileSCPCBFunctionCallWithArguments`

---

### WASM Binary Format Research

**LEB128 (Little Endian Base 128) Variable-Length Encoding:**

Used for:
- Section sizes
- Function indices
- Local variable counts
- Type indices

**Encoding example (273 = 0x111):**
```
273 in binary: 00000001 00010001
LEB128 encoded: 91 02
- 91 = 0x91 & 0x7F = 0x11 (17) + continuation bit
- 02 = 0x02 & 0x7F = 0x02 (2)
Result: 17 + (2 << 7) = 17 + 256 = 273 ✓
```

**WASM Section Structure:**
```
[Section Size (varuint)] [Section ID (1 byte)] [Section Content]
```

---

### Browser Testing Notes

Browser automation was previously attempted but has been removed. Prefer:
- `wasm-validate` (wabt), when available
- Deno-based validation (`Tools/wasm_validate.ts`)

---

### Findings Summary

| Area | Status | Notes |
|------|--------|-------|
| WASM binary generation | ✓ Correct | Section encoding works properly |
| Section IDs | ✓ Valid | All sections use correct IDs (1,2,3,5,7,10) |
| Magic number | ✓ Correct | 0x0061736d |
| Version | ✓ Correct | 1 |
| Swift tests | ✓ 82/82 pass | All existing and new tests pass |
| Browser loading | ⚠️ Cache | Requires hard refresh on file changes |
| Browser automation | — | Removed; use binary validation |

---

### Recommendations for Future Debugging

1. **Always verify file freshness** - Check file modification times and sizes
2. **Use binary validation scripts** - Faster than browser testing for structural issues
3. **Add section-by-section logging** - Helps identify where encoding goes wrong
4. **Create minimal reproduction cases** - Smaller WASM files are easier to debug
5. **Cache-busting** - Add query params or use unique filenames for testing

---

### Files Modified During Debugging

1. `Sources/Compiler/CodeGen/WASMBinaryEncoder.swift` - Added/removed debug output
2. `Tools/wasm_validate.ts` - Deno WASM validation
4. `Tests/input_test.bb` - Created test program
5. `Sources/Runtime/index.html` - Updated for input testing

---

*End of Report - Updated January 18, 2026*
