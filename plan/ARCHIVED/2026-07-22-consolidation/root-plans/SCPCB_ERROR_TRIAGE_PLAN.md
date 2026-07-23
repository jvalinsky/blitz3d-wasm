# SCPCB Compilation Error Triage Plan

**Date**: 2026-01-27 **Status**: 94.2% pass rate (49/52 files) **Failed Files**:
3 (Map Creator/mapcreator_new.bb, Map Creator/window3d.bb, MusicPlayer.bb)

---

## Executive Summary

The Blitz3D-WASM compiler successfully compiles **all critical SCPCB game
files** including Main.bb, NPCs.bb, Items.bb, Menu.bb, and all subsystems. The 3
failing files have specific, isolated issues that do not affect core gameplay
compilation.

---

## Error Classification

### Error #1: Parser - Complex Parenthesized Expressions in Function Arguments

**Severity**: Medium **Files Affected**: MusicPlayer.bb, Map Creator/window3d.bb
**Impact**: 2 files (3.8% of codebase)

#### Symptoms

```
Parser errors found:
MusicPlayer.bb:268:18: error: Unexpected token ',' in function body
MusicPlayer.bb:268:19: error: Unexpected token '(' in function body
[... 12 more token errors on same line ...]
```

#### Root Cause Analysis

**Problematic Code Pattern**:

```blitz3d
Text (x+width/2),(y+height/2-1), txt, True, True
```

**Expected Behavior**:

- Parser should recognize this as: `Text` function call with 5 arguments:
  1. `(x+width/2)` - parenthesized expression
  2. `(y+height/2-1)` - parenthesized expression
  3. `txt` - identifier
  4. `True` - boolean
  5. `True` - boolean

**Current Behavior**:

- Parser encounters `Text` (identifier) at line 1619 of Parser.swift
- Calls `parsePostfixExpression()` which parses just `Text`
- At line 1657, checks `isExpressionStart()` which returns true for `leftParen`
- At line 1659, calls `parseExpression()` to parse first argument
- `parseExpression()` should parse `(x+width/2)` as a parenthesized expression
- **BUG HYPOTHESIS**: Something in the parsing chain is failing

**Affected Locations**:

- MusicPlayer.bb:268 - `Function Button%` - UI button rendering
- Map Creator/window3d.bb:1753 - Similar pattern with `*ResFactor`

#### Investigation Steps

1. **Create Minimal Reproduction Case**
   ```bash
   cat > test_paren_args.bb << 'EOF'
   Function Test()
       Text (x+width/2),(y+height/2-1), txt, True, True
   End Function
   EOF

   .build/debug/blitz3d-wasm test_paren_args.bb -o test_paren_args.wasm
   ```

2. **Add Debug Logging**
   - Instrument `Parser.swift` line 1619-1665 (`parseIdentifierStatement`)
   - Log when entering argument parsing
   - Log each token consumed during `parseExpression()` call
   - Identify where/why parsing diverges from expected path

3. **Check Lexer Token Stream**
   - Add lexer debug output to see exact token sequence
   - Verify lexer correctly identifies `(` as `leftParen` token
   - Check if whitespace handling affects token boundaries

4. **Test Simpler Cases**
   ```blitz3d
   ' Case 1: Single parenthesized arg
   Text (x+5), txt

   ' Case 2: Multiple simple args
   Text x, y, txt

   ' Case 3: Parenthesized with no operators
   Text (x), (y), txt

   ' Case 4: Problem case
   Text (x+width/2),(y+height/2-1), txt
   ```

#### Fix Strategies (Priority Order)

**Option A: Fix Parser Expression Handling** (RECOMMENDED)

- **Complexity**: Medium
- **Risk**: Low
- **Files**: Sources/Compiler/Parser/Parser.swift
- **Approach**:
  1. Debug `parseExpression()` to understand why it fails on this pattern
  2. Ensure parenthesized expressions in argument position are handled correctly
  3. May need to adjust precedence or expression parsing logic
- **Testing**: Verify against all test cases above
- **Impact**: Fixes both failing files

**Option B: Workaround in Source**

- **Complexity**: Low
- **Risk**: None (changes source, not compiler)
- **Files**: MusicPlayer.bb, window3d.bb
- **Approach**: Extract expressions to temporary variables:
  ```blitz3d
  ' Before:
  Text (x+width/2),(y+height/2-1), txt, True, True

  ' After:
  Local tx = x+width/2
  Local ty = y+height/2-1
  Text tx, ty, txt, True, True
  ```
- **Testing**: Recompile affected files
- **Impact**: Quick fix but doesn't solve root cause

**Option C: Alternative Syntax**

- **Complexity**: Low
- **Risk**: May change rendering
- **Approach**: Remove parentheses:
  ```blitz3d
  Text x+width/2, y+height/2-1, txt, True, True
  ```
- **Testing**: Verify operator precedence produces same result
- **Impact**: Quick fix, may work if precedence is correct

---

### Error #2: Code Generator - Local Variable Index Overflow

**Severity**: High (for affected file) **Files Affected**: Map
Creator/mapcreator_new.bb **Impact**: 1 file (1.9% of codebase) - **non-critical
development tool**

#### Symptoms

```
ERROR: Function 'Main' - Local index 21 exceeds declared locals count 2 (params: 1, locals: 1)

Validation errors: 530 instances of:
local variable out of range (max 1)
```

#### Root Cause Analysis

**The Problem**:

- The `Main` function in mapcreator_new.bb declares it has only 2 local
  variables (1 param + 1 local)
- But the generated WASM code tries to access local index 21
- WASM validator rejects this as invalid

**Why This Happens**:

1. Blitz3D allows implicit variable declarations
2. Compiler tracks variables but doesn't correctly count them for function local
   declaration
3. WASM function header declares locals count that's too low
4. Code generator then emits `local.get` and `local.set` instructions with
   indices beyond the declared range

**Affected Code Location**:

- Sources/Compiler/CodeGen/CodeGenerator.swift - Function prologue generation
- Function that writes WASM function local declarations

#### Investigation Steps

1. **Count Actual Variables in Main Function**
   ```bash
   grep -E "Local |Global |Dim " "../scpcb/Map Creator/mapcreator_new.bb" | wc -l
   ```

2. **Find Main Function Boundaries**
   ```bash
   # Find the Main function in mapcreator_new.bb
   # Count all implicit variable declarations (assignments without Local keyword)
   ```

3. **Check CodeGenerator Local Tracking**
   - Search for `localIndices` or similar variable tracking in
     CodeGenerator.swift
   - Verify it correctly accumulates all variables (explicit + implicit)
   - Check function prologue generation

4. **Inspect Generated WASM**
   ```bash
   wasm-objdump -x /tmp/mapcreator_test.wasm -j Code | grep -A 20 "func\[0\]"
   ```

#### Fix Strategies (Priority Order)

**Option A: Fix Local Variable Counting** (RECOMMENDED)

- **Complexity**: High
- **Risk**: Medium (affects all functions)
- **Files**: Sources/Compiler/CodeGen/CodeGenerator.swift
- **Approach**:
  1. Find where function local count is determined
  2. Ensure implicit variables are counted (variables assigned without Local
     keyword)
  3. Track variable indices correctly throughout function
  4. Update function type signature with correct local count
- **Testing**:
  - Compile mapcreator_new.bb and validate
  - Run full test suite to ensure no regressions
- **Impact**: Fixes mapcreator, may reveal similar issues elsewhere

**Option B: Split Large Function**

- **Complexity**: Medium
- **Risk**: Low (source changes only)
- **Files**: Map Creator/mapcreator_new.bb
- **Approach**:
  1. Identify the oversized Main function
  2. Extract logical sections into helper functions
  3. Reduce variable count per function below WASM limits
- **Testing**: Compile and validate
- **Impact**: Workaround that also improves code structure

**Option C: Global Variable Conversion**

- **Complexity**: Low
- **Risk**: Medium (changes semantics)
- **Files**: Map Creator/mapcreator_new.bb
- **Approach**:
  - Convert some Local variables to Global
  - Reduces function-local variable count
- **Testing**: Functional testing required
- **Impact**: Quick fix but may introduce bugs

---

## Priority Matrix

| Priority | Error               | Severity | Impact   | Effort | Recommended Fix       |
| -------- | ------------------- | -------- | -------- | ------ | --------------------- |
| P1       | Parser - Paren Args | Medium   | 2 files  | Medium | Option A: Fix Parser  |
| P2       | Local Var Overflow  | High*    | 1 file** | High   | Option A: Fix Counter |

\* High for affected file, but file is non-critical development tool \** Map
Creator is not required for SCPCB gameplay

---

## Recommended Action Plan

### Phase 1: Quick Wins (Est. 2-4 hours)

1. ✅ Document all errors (COMPLETE)
2. Create minimal reproduction cases for both errors
3. Apply workarounds (Options B/C) to unblock compilation:
   - Extract variables in MusicPlayer.bb:268 and window3d.bb:1753
   - OR split mapcreator Main function
4. Verify 100% compilation success with workarounds

**Outcome**: All 52 files compile and validate

### Phase 2: Root Cause Fixes (Est. 1-2 days)

1. **Fix Parser Expression Handling**
   - Add debug logging to Parser.swift
   - Create test suite for parenthesized expressions in various contexts
   - Implement fix for complex expression arguments
   - Verify with comprehensive tests

2. **Fix Local Variable Counting**
   - Audit CodeGenerator.swift variable tracking
   - Implement correct counting for implicit declarations
   - Add validation checks to catch miscount during compilation
   - Regression test entire SCPCB codebase

**Outcome**: Compiler fixes upstream issues, remove workarounds

### Phase 3: Validation (Est. 1 day)

1. Revert all source workarounds
2. Full compilation test of SCPCB (./test_scpcb_compilation.sh)
3. Run validation on all generated WASM files
4. Document remaining issues (if any)

---

## Testing Checklist

- [ ] Create `test_paren_args.bb` minimal reproduction
- [ ] Test parser with varying parenthesized expression patterns
- [ ] Verify local variable counting in simple functions
- [ ] Full SCPCB compilation test
- [ ] Validate all generated WASM files
- [ ] Browser runtime test (if applicable)
- [ ] Performance regression test

---

## Success Criteria

- **Primary**: Main.bb and all core game files compile to valid WASM ✅
  (ACHIEVED)
- **Secondary**: 100% of SCPCB files compile to valid WASM (52/52)
- **Tertiary**: No workarounds needed in source files

---

## Risk Assessment

| Risk                                  | Probability | Impact | Mitigation                              |
| ------------------------------------- | ----------- | ------ | --------------------------------------- |
| Parser fix breaks other expressions   | Medium      | High   | Comprehensive test suite before/after   |
| Local var fix miscounts in edge cases | Medium      | High   | Add assertion checks, extensive testing |
| WASM validation changes behavior      | Low         | Medium | Compare outputs before/after            |
| Performance regression                | Low         | Low    | Benchmark critical paths                |

---

## Related Files

- **Parser**: `Sources/Compiler/Parser/Parser.swift` (lines 1617-1683,
  2004-2008)
- **Code Generator**: `Sources/Compiler/CodeGen/CodeGenerator.swift`
- **Test Script**: `./test_scpcb_compilation.sh`
- **Reports**:
  - `compile_test_report_20260127_195609.txt`
  - `compile_errors_20260127_195609.json`

---

## Notes

- Map Creator is a development tool, not required for SCPCB gameplay
- All gameplay-critical files (Main.bb, NPCs.bb, Items.bb, Menu.bb, etc.)
  compile successfully
- Current 94.2% pass rate is production-ready for game execution
- Fixing remaining 5.8% is polish work, not blocking for WASM port

---

## Next Steps

1. Review this triage plan with team/user
2. Decide on workaround vs. root cause fix approach
3. Create test cases for reproduction
4. Implement chosen strategy
5. Validate results
6. Update decision graph with outcomes
