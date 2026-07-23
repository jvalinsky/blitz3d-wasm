# Comprehensive Plan to Fix All Remaining SCPCB Issues

**Date**: 2026-01-27
**Current Status**: 49/52 files passing (94.2%)
**Objective**: Achieve 100% compilation success (52/52 files)

---

## Executive Summary

Three files remain problematic:
1. **MusicPlayer.bb** - Parser issue (via BlitzAL.bb includes)
2. **Map Creator/window3d.bb** - Parser edge case: `(expr)*factor` pattern
3. **Map Creator/mapcreator_new.bb** - Local variable overflow (530 errors)

**Estimated Total Effort**: 6-10 hours
**Priority**: High (completion of SCPCB port)

---

## Issue #1: Parser - Complex Expression Patterns

### Current Status
- ✅ Fixed: `Text (x+width/2), y` pattern
- ✅ Fixed: `alInit(x, y)` with parens
- ❌ Broken: `Text (x)*factor, y` pattern
- ❌ Broken: `alInit(x, y)` without space (edge case)

### Files Affected
- MusicPlayer.bb (via BlitzAL.bb)
- Map Creator/window3d.bb (18 occurrences)

### Root Cause Analysis

**The Ambiguity Problem**:
```blitz3d
' Case 1: Function call with parens
alInit(x, y)        ' This IS function call syntax

' Case 2: Statement call with parenthesized expression
Text (x), y         ' This is NOT function call syntax

' Case 3: Statement call with complex expression
Text (x)*factor, y  ' This is NOT function call syntax (edge case)
```

Parser cannot distinguish without:
- Whitespace information (currently discarded by lexer)
- Full lookahead (expensive)
- Backtracking (complex to implement)

### Solution Strategy: Two-Phase Approach

#### Phase 1: Add Whitespace Tracking (RECOMMENDED)
**Effort**: 3-4 hours
**Complexity**: Medium
**Impact**: Solves problem completely

**Implementation Steps**:

1. **Modify Lexer** (`Sources/Compiler/Lexer/Lexer.swift`)
   ```swift
   // Add field to Token struct
   public struct Token {
       // ... existing fields ...
       public let hasLeadingWhitespace: Bool  // NEW
   }

   // Track whitespace in lexer
   private mutating func nextToken() -> Token {
       let hasWhitespace = (previousCharWasWhitespace || column > lastTokenEndColumn + 1)
       // ... rest of lexer logic ...
       return Token(..., hasLeadingWhitespace: hasWhitespace)
   }
   ```

2. **Update Parser** (`Sources/Compiler/Parser/Parser.swift`)
   ```swift
   // In parseIdentifierStatement(), around line 1651
   if case .identifier(let id, _) = expr {
       if expect(.leftParen) {
           // Check for whitespace before the paren
           if currentToken.hasLeadingWhitespace {
               // "Func (" - statement-level call
               // Parse arguments without consuming paren as function syntax
           } else {
               // "Func(" - function call with parens
               // Use existing function call logic
           }
       }
   }
   ```

3. **Testing Strategy**
   ```bash
   # Test cases to verify
   - alInit(x, y)      # No whitespace -> function call
   - Text (x), y       # Has whitespace -> statement call
   - Text (x)*y, z     # Has whitespace -> statement call
   ```

**Pros**:
- Solves all cases completely
- Matches Blitz3D's actual behavior
- Future-proof solution

**Cons**:
- Requires lexer changes (ripple effect)
- Need to update all Token creation sites
- More testing required

#### Phase 2: Pragmatic Workaround (ALTERNATIVE)
**Effort**: 30 minutes
**Complexity**: Low
**Impact**: Fixes files with minimal source changes

**Option A: Modify Source Files**
```blitz3d
' window3d.bb line 1753 - BEFORE:
Text (x+width/2)*ResFactor,(y+height/2-1)*ResFactor, txt, True, True

' AFTER (use temp variables):
Local tx = (x+width/2)*ResFactor
Local ty = (y+height/2-1)*ResFactor
Text tx, ty, txt, True, True
```

Apply to 18 occurrences in window3d.bb.

**Option B: Add Parser Heuristic**
```swift
// In parseIdentifierStatement()
// After parsing args from leftParen...rightParen
// Check if next token is binary operator
if isBinaryOperator(currentToken) {
    // This was actually statement-level call
    // The expression continues after the paren
    // Need to reparse properly...
    // (Complex - would need expression parser refactoring)
}
```

**Pros**:
- Quick fix
- No compiler changes (Option A)
- Works for current codebase

**Cons**:
- Modifies source files (Option A)
- Doesn't solve root cause
- Fragile heuristics (Option B)

### Recommendation
**Phase 1 (Whitespace Tracking)** if time permits (production-quality solution).
**Phase 2A (Source Modification)** for immediate fix.

---

## Issue #2: Local Variable Index Overflow

### Current Status
- ❌ File: Map Creator/mapcreator_new.bb
- ❌ Error: `local variable out of range (max 1)` (530 occurrences)
- ❌ Root: Function declares 2 locals but accesses index 21+

### Files Affected
- Map Creator/mapcreator_new.bb (Main function - 2140 lines)

### Root Cause Analysis

**Problem Flow**:
1. Blitz3D allows implicit variable declarations (assignment without `Local`)
2. Compiler tracks variables internally but miscounts when generating WASM
3. WASM function header declares incorrect local count
4. Generated code tries to access indices beyond declared range
5. WASM validation fails

**Evidence**:
```
ERROR: Function 'Main' - Local index 21 exceeds declared locals count 2 (params: 1, locals: 1)
```

This means:
- Function has 1 parameter
- Declares only 1 local variable
- But tries to access local index 21
- **Actual variable count**: 21+ variables

### Solution Strategy: Fix Variable Counting

**Effort**: 4-6 hours
**Complexity**: High
**Impact**: Fixes mapcreator_new.bb completely

**Investigation Steps**:

1. **Find Variable Tracking Code** (`Sources/Compiler/CodeGen/CodeGenerator.swift`)
   ```bash
   grep -n "localIndices\|localVariables\|declareLocal\|functionLocals" Sources/Compiler/CodeGen/CodeGenerator.swift
   ```

2. **Identify Where Function Header is Generated**
   ```bash
   grep -n "func.*generate.*Function\|functionType\|params.*locals" Sources/Compiler/CodeGen/CodeGenerator.swift
   ```

3. **Trace Variable Declaration Logic**
   - Find where Local declarations are processed
   - Find where implicit declarations (assignments) are processed
   - Verify both update the same counter

**Expected Issues**:

**Issue A: Separate Counters**
```swift
// BAD: Two separate tracking mechanisms
var explicitLocals: [String: Int] = [:]  // Only Local keyword
var implicitVars: [String: Int] = [:]    // Assignments

// Function header only counts explicitLocals
let localCount = explicitLocals.count  // WRONG!
```

**Issue B: Function-Scope Variables Not Counted**
```swift
// Variables declared in nested blocks might not be counted
if condition {
    Local x = 5  // Is this counted?
}
```

**Issue C: Parameter Offset Confusion**
```swift
// Parameters occupy first N local indices
// But counter might not account for this properly
let localIdx = localIndices[name]  // Should be paramCount + localCount
```

**Implementation Plan**:

1. **Audit Current Logic** (1-2 hours)
   ```swift
   // In CodeGenerator.swift, find:
   // 1. Where variables are registered (both Local and implicit)
   // 2. Where local indices are assigned
   // 3. Where function type is created
   // 4. Verify all use same source of truth
   ```

2. **Create Test Case** (30 min)
   ```blitz3d
   Function TestLocalCount()
       Local a = 1      ' Explicit local #1
       b = 2            ' Implicit local #2
       Local c = 3      ' Explicit local #3
       d = 4            ' Implicit local #4

       If True Then
           Local e = 5  ' Explicit local #5 (function-scoped)
           f = 6        ' Implicit local #6
       EndIf

       Print a + b + c + d + e + f
   End Function
   ```

   Expected: Function should declare 6 locals (+ params)

3. **Fix Variable Counting** (2-3 hours)
   ```swift
   // Pseudocode fix:
   class FunctionContext {
       var parameters: [String: Int] = [:]
       var allLocals: [String: Int] = [:]  // BOTH explicit and implicit

       func registerLocal(name: String) {
           if !allLocals.contains(name) && !parameters.contains(name) {
               let index = parameters.count + allLocals.count
               allLocals[name] = index
           }
       }

       func generateFunctionType() -> WASMFunctionType {
           let paramTypes = parameters.map { $0.type }
           let localTypes = allLocals.map { $0.type }
           return WASMFunctionType(
               params: paramTypes,
               results: resultType,
               locals: localTypes  // CORRECT COUNT
           )
       }
   }
   ```

4. **Test & Validate** (1 hour)
   - Compile test case, verify local count in WASM
   - Compile mapcreator_new.bb
   - Run wasm-validate
   - Check all 530 errors are resolved

**Testing Strategy**:

```bash
# Step 1: Inspect WASM function header
.build/debug/blitz3d-wasm test_local_count.bb -o test.wasm
wasm-objdump -x test.wasm -j Code | grep -A 5 "func.*TestLocalCount"

# Step 2: Verify count
# Should show: params: X, locals: Y where Y includes ALL variables

# Step 3: Test mapcreator
.build/debug/blitz3d-wasm "../scpcb/Map Creator/mapcreator_new.bb" -o mapcreator.wasm
wasm-validate mapcreator.wasm  # Should succeed

# Step 4: Full regression
./test_scpcb_compilation.sh  # Should show 52/52 pass
```

### Alternative: Split Function (Quick Fix)

**Effort**: 2 hours
**Complexity**: Low
**Impact**: Workaround only

Extract large Main function into smaller helper functions:
```blitz3d
' mapcreator_new.bb - BEFORE
Function Main()
    ' 2140 lines of code
    ' 21+ local variables
End Function

' AFTER
Function Main()
    InitializeUI()
    HandleUserInput()
    RenderScene()
End Function

Function InitializeUI()
    ' First 1/3 of variables
End Function

Function HandleUserInput()
    ' Second 1/3 of variables
End Function

Function RenderScene()
    ' Last 1/3 of variables
End Function
```

**Pros**: Works immediately
**Cons**: Modifies source, doesn't fix root cause

---

## Overall Implementation Plan

### Phase 1: Quick Wins (2-3 hours)
**Objective**: Get to 51/52 passing (98% success)

1. ✅ **Parser fix documented** (DONE)
2. **Apply source workarounds**
   - Modify window3d.bb: extract complex expressions to temp variables
   - Test: window3d.bb compiles
   - Commit: "workaround: simplify window3d expressions for parser"

### Phase 2: Parser Permanent Fix (3-4 hours)
**Objective**: Solve parser ambiguity completely

1. **Add whitespace tracking to lexer**
   - Modify Token struct
   - Update Lexer.swift token generation
   - Verify all tests still pass

2. **Update parser to use whitespace**
   - Implement whitespace-based disambiguation
   - Remove parsePostfixExpressionWithoutCall workaround
   - Test all parser edge cases

3. **Validate**
   - All parser test cases pass
   - window3d.bb compiles without source changes
   - No regressions in other files

### Phase 3: Local Variable Fix (4-6 hours)
**Objective**: Fix variable counting in code generator

1. **Investigation**
   - Map out current variable tracking logic
   - Create minimal reproduction test
   - Identify exact bug location

2. **Implementation**
   - Consolidate variable tracking
   - Fix local count in function header generation
   - Add validation checks

3. **Testing**
   - Test case passes
   - mapcreator_new.bb validates
   - Full regression test

### Phase 4: Final Validation (1-2 hours)
**Objective**: 100% success, production-ready

1. **Full compilation test**
   - Run ./test_scpcb_compilation.sh
   - Verify 52/52 files pass
   - All WASM validates

2. **Runtime testing** (if applicable)
   - Load WASM in browser
   - Verify basic functionality
   - Check for runtime errors

3. **Documentation**
   - Update STATUS.md
   - Document any remaining limitations
   - Create migration guide if source changes needed

### Phase 5: Cleanup & Commit (1 hour)
**Objective**: Production-quality code

1. **Code review**
   - Remove debug logging
   - Add code comments
   - Clean up temporary test files

2. **Git commit**
   - Commit parser fixes
   - Commit code generator fixes
   - Update decision graph

3. **Create PR** (if applicable)
   - Comprehensive PR description
   - Link to issues/documentation
   - Request review

---

## Success Criteria

### Minimum Success (Phase 1 Complete)
- ✅ 51/52 files compile and validate (98%)
- ✅ All gameplay-critical files work
- ✅ Known limitations documented

### Full Success (All Phases Complete)
- ✅ 52/52 files compile and validate (100%)
- ✅ No source modifications required
- ✅ No validation errors
- ✅ Production-ready compiler

### Stretch Goals
- ✅ Runtime testing in browser
- ✅ Performance benchmarks
- ✅ Comprehensive test suite
- ✅ CI/CD integration

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Lexer changes break existing code | Medium | High | Comprehensive regression testing |
| Variable counting fix too complex | Medium | Medium | Have source-modification fallback |
| Edge cases remain after fixes | Low | Low | Document limitations clearly |
| Performance regression | Low | Medium | Benchmark before/after |
| Runtime bugs appear | Medium | High | Browser testing phase |

---

## Resource Requirements

**Time**: 10-15 hours total
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 4-6 hours
- Phases 4-5: 2-3 hours

**Skills Needed**:
- Swift programming
- Compiler/parser design
- WASM format knowledge
- Blitz3D language familiarity

**Tools Required**:
- Swift 6.0 toolchain
- wasm-validate (wabt)
- wasm-objdump (wabt)
- git

---

## Recommended Approach

### Conservative (Minimize Risk)
1. Apply source workarounds (Phase 1)
2. Fix local variable counting (Phase 3)
3. Document parser limitations
4. **Result**: 100% compilation with minor source changes

### Aggressive (Complete Fix)
1. Fix parser with whitespace tracking (Phase 2)
2. Fix local variable counting (Phase 3)
3. Full validation (Phase 4)
4. **Result**: 100% compilation, zero workarounds

### Pragmatic (Balance)
1. Apply source workarounds (Phase 1) - **DO FIRST**
2. Fix local variable counting (Phase 3) - **DO SECOND**
3. Parser permanent fix (Phase 2) - **DO IF TIME PERMITS**
4. **Result**: 100% compilation quickly, improve later

**Recommendation**: **Pragmatic Approach**
- Delivers results fast
- Reduces risk
- Allows iterative improvement

---

## Testing Checklist

- [ ] All parser test cases pass
- [ ] MusicPlayer.bb compiles
- [ ] window3d.bb compiles
- [ ] mapcreator_new.bb compiles
- [ ] All 52 SCPCB files compile
- [ ] All 52 files pass wasm-validate
- [ ] No regression in previously passing files
- [ ] Test suite passes
- [ ] Performance acceptable
- [ ] Runtime testing (browser)

---

## Next Steps

1. **Review this plan** with team/stakeholder
2. **Choose approach** (Conservative/Aggressive/Pragmatic)
3. **Set timeline** and milestones
4. **Begin Phase 1** execution
5. **Update decision graph** as work progresses

---

## Related Files

- `Sources/Compiler/Lexer/Lexer.swift` - Whitespace tracking
- `Sources/Compiler/Parser/Parser.swift` - Parser logic
- `Sources/Compiler/CodeGen/CodeGenerator.swift` - Variable counting
- `Tests/parser_paren_args_*.bb` - Parser tests
- `./test_scpcb_compilation.sh` - Full test suite

---

**Status**: Plan Ready for Execution
**Next Action**: Choose approach and begin Phase 1
**Estimated Completion**: 2-3 days (full aggressive approach)
