# Parser Bug Fix Plan: Early Termination After ~50 Items

## Problem Statement

**Critical Bug**: Parser stops after processing ~50 top-level items, missing
Global declarations that appear after function definitions.

**Evidence**:

- Menu.bb has 23 Global declarations, parser only finds 16
- Missing: 7 Globals on lines 1992-1994, 2266, 2525-2527
- Parser processes exactly 50 items then stops (file has 2636 lines)
- Missing Globals are auto-declared as i32 when first read
- Causes 67+ global.set type mismatch errors across multiple files

## Research Findings

### 1. Recursive Descent Parser Best Practices (Source: GeeksforGeeks, Bison docs)

**Error Recovery Strategies**:

- **Panic Mode**: Skip tokens until synchronization point (delimiter like `;` or
  `}`)
- **Statement Mode**: Skip to next statement on error
- **Never fail completely**: Parser should ALWAYS produce output, even with
  errors

**Key Principle**: "Parsing should _never_ fail. If some kind of syntax tree
isn't produced, it's considered a bug in the parser."

**Synchronization Points**:

- After semicolons
- After statement keywords (Function, End, Global)
- At block boundaries

### 2. WASM Global Variable Requirements (Source: WebAssembly Spec 3.0)

**Module Structure**:

- Globals must be defined in Global section BEFORE code section
- "Sequences of globals are handled incrementally, such that each definition has
  access to previous definitions"
- Global types validated before usage
- Each global stores single value of specified type

**Validation Rules**:

- Type must be specified (i32, f32, i64, f64, v128)
- Mutability flag required (mutable/immutable)
- Exports reference globals by index

### 3. Parser Loop Issues (Source: StackOverflow, Elm Discourse)

**Common Causes of Early Termination**:

1. **Missing advance() call** - parser stuck reading same token forever
2. **Unhandled error returns nil** - loop exits when parseTopLevelStatement()
   returns nil
3. **Infinite loop protection gone wrong** - synchronize() called when not
   needed
4. **EOF detection too early** - token type incorrectly set to EOF

**Our Specific Issue**:

- Parser loop exits when `parseTopLevelStatement()` returns `nil`
- After 50 items, something causes nil return
- No errors logged, so it's silent failure

### 4. Blitz BASIC Language Rules (Source: BlitzMax docs)

**Global Declaration Rules**:

- "Global declarations of variables and functions may be interleaved"
- "Every function call or occurrence of a variable must be preceded by its
  declaration"
- Globals exist for entire program lifetime
- Can appear anywhere at top level (before, between, after functions)

**This is VALID Blitz3D**:

```blitz3d
Global x%               ; Initial globals
Function Foo()
    Print x
End Function
Global y#               ; More globals after function! ✓
Function Bar()
    Print y
End Function
```

## Root Cause Analysis

### Hypothesis 1: synchronize() Called After Error ❌

**Test**: Check if synchronize() is being called

```bash
grep -n "synchronize()" Parser.swift
```

**Result**: synchronize() is called in error handler (line 354)

**But**: No errors are being reported! So this shouldn't be the issue.

### Hypothesis 2: parseTopLevelStatement() Returns nil Unexpectedly ✅ **LIKELY**

**Current Code** (Parser.swift:367):

```swift
private mutating func parseTopLevelStatement() -> StatementNode? {
    switch currentToken.type {
    case .keywordFunction:
        return parseFunction()
    case .keywordType:
        return parseType()
    case .keywordGlobal:
        return parseGlobalDeclaration()
    // ... other cases ...
    default:
        return nil  // <-- PROBLEM!
    }
}
```

**Issue**: After processing ~50 items, something causes `currentToken.type` to
not match any case, returns `nil`, loop exits.

### Hypothesis 3: Function Parsing Consumes Too Many Tokens ✅ **VERY LIKELY**

**Observation**: All 16 Globals found are "after 0 functions" **Implication**:
First function is parsed, then parser never recovers

**Possible Cause**:

- `parseFunction()` parses function body
- Body contains many statements/expressions
- After parsing function, currentToken is NOT at next top-level item
- currentToken is somewhere inside or past the function
- Next call to parseTopLevelStatement() sees unexpected token → returns nil

### Hypothesis 4: Newline Handling Issue ✅ **POSSIBLE**

**Code** (Parser.swift:294-297):

```swift
while currentToken.type != .endOfFile {
    if currentToken.type == .newline {
        advance()
        continue  // <-- Skips newline, tries again
    }
```

**But**: After processing 50 items, if currentToken is NOT newline and NOT a
known keyword, parseTopLevelStatement() returns nil, loop exits.

## The Fix: Multiple Approaches

### Approach A: Never Return Nil (Recommended) ⭐⭐⭐⭐⭐

**Strategy**: Make parseTopLevelStatement() resilient - never fail completely

**Changes**:

```swift
private mutating func parseTopLevelStatement() -> StatementNode? {
    switch currentToken.type {
    case .keywordFunction:
        return parseFunction()
    case .keywordType:
        return parseType()
    case .keywordGlobal:
        return parseGlobalDeclaration()
    case .keywordConst:
        return parseConstantDeclaration()
    case .keywordData:
        return parseData()
    case .newline:
        advance()
        return .empty  // Return empty statement, don't exit loop
    case .endOfFile:
        return nil  // Only valid reason to exit
    default:
        // CHANGE: Don't return nil! Try to recover.
        print("WARNING: Unexpected token '\(currentToken.text)' at top level, skipping")
        // Skip this line and try next
        while currentToken.type != .newline && currentToken.type != .endOfFile {
            advance()
        }
        if currentToken.type == .newline {
            advance()
        }
        return .empty  // Return empty statement, continue parsing
    }
}
```

**Benefits**:

- ✅ Parser never gives up
- ✅ Continues through entire file
- ✅ Reports warnings but doesn't stop
- ✅ Aligns with modern parser best practices

**Risks**:

- May mask real syntax errors
- Need good warning messages

### Approach B: Fix Token Position After Function Parsing ⭐⭐⭐

**Strategy**: Ensure parseFunction() leaves currentToken at correct position

**Investigation Needed**:

1. Add logging to track currentToken before/after parseFunction()
2. Check if parseFunction() consumes extra tokens
3. Verify End Function is properly consumed

**Changes**:

```swift
private mutating func parseFunction() -> StatementNode? {
    print("DEBUG: Entering parseFunction at token '\(currentToken.text)'")
    // ... existing function parsing ...
    
    // After End Function, verify position
    print("DEBUG: Exiting parseFunction at token '\(currentToken.text)'")
    
    // Ensure we're at a good position for next top-level item
    while currentToken.type == .newline {
        advance()
    }
    
    return .function(funcNode)
}
```

**Benefits**:

- ✅ Targets specific problem
- ✅ Maintains existing error handling

**Risks**:

- May not fix the root cause if issue is elsewhere

### Approach C: Add Synchronization Points ⭐⭐⭐⭐

**Strategy**: After any parse error, skip to next known synchronization point

**Implementation**:

```swift
private mutating func synchronizeToTopLevel() {
    // Skip until we find a top-level keyword or EOF
    while currentToken.type != .endOfFile {
        switch currentToken.type {
        case .keywordFunction, .keywordGlobal, .keywordType, .keywordConst:
            return  // Found synchronization point
        default:
            advance()
        }
    }
}

// In parse() loop:
if let statement = parseTopLevelStatement() {
    // ... process statement ...
} else {
    // Failed to parse - synchronize and continue
    synchronizeToTopLevel()
    if currentToken.type != .endOfFile {
        continue  // Try again from synchronized position
    }
}
```

**Benefits**:

- ✅ Robust error recovery
- ✅ Continues parsing after errors
- ✅ Industry-standard approach

**Risks**:

- More complex implementation

## Recommended Implementation Plan

### Phase 1: Diagnostic Enhancement (30 min)

**Goal**: Understand exact cause of early exit

1. Add detailed logging to parse() loop:

```swift
while currentToken.type != .endOfFile {
    let startToken = currentToken
    
    if let statement = parseTopLevelStatement() {
        // ... process ...
        print("DEBUG: Processed item #\(statementCount), now at '\(currentToken.text)'")
    } else {
        print("ERROR: parseTopLevelStatement() returned nil!")
        print("  Token: type=\(currentToken.type) text='\(currentToken.text)'")
        print("  Position: After \(functionCount) functions, \(globalCount) globals")
        break  // Exit to prevent infinite loop
    }
}
```

2. Run on Menu.bb, capture exactly where it stops

3. Examine what token causes nil return

### Phase 2: Implement Fix (1-2 hours)

**Based on diagnostic results, implement Approach A + C combo**:

1. **Make parseTopLevelStatement() never return nil unless EOF**:
   - Add default case that recovers instead of failing
   - Log warnings for unexpected tokens
   - Continue parsing

2. **Add explicit synchronization**:
   - Implement synchronizeToTopLevel()
   - Call after nil return (shouldn't happen anymore, but safety net)

3. **Verify token positions**:
   - Add assertions after each parse function
   - Ensure currentToken is at expected position

### Phase 3: Testing (1 hour)

1. **Test on known failing files**:
   - Menu.bb (23 Globals, currently finds 16)
   - Main.bb (should find all Globals now)
   - Update.bb

2. **Verify Global counts**:

```bash
for f in Menu.bb Main.bb Update.bb; do
    expected=$(grep -c "^Global" scpcb/$f)
    found=$(swift run blitz3d-wasm ../scpcb/$f -o /tmp/test.wasm 2>&1 | grep "DEBUG_GLOBAL:" | wc -l)
    echo "$f: Expected $expected, Found $found"
done
```

3. **Run full test suite**:

```bash
bash test_scpcb_fast.sh
swift test
```

### Phase 4: Validation (30 min)

1. **Remove debug logging** (keep only essential warnings)

2. **Test validation errors**:
   - Menu.bb should drop from 5 → 0 global.set errors
   - Main.bb should drop from 67 → 0 global.set errors
   - Update.bb should drop from 4 → 0 global.set errors

3. **Commit with detailed explanation**

## Success Criteria

✅ Parser processes ENTIRE file (all 2636 lines of Menu.bb) ✅ All 23 Global
declarations found in Menu.bb\
✅ All 7 missing Globals now registered (lines 1992-1994, 2266, 2525-2527) ✅
Global.set type mismatch errors eliminated ✅ No new errors introduced ✅ All
unit tests pass ✅ All SCPCB files compile successfully

## Rollback Plan

If fix causes new issues:

1. Git revert to commit before changes
2. Analyze what went wrong
3. Try alternative approach (B or C instead of A)

## Timeline Estimate

- Phase 1 (Diagnostics): [x] Done (Added in Parser.swift)
- Phase 2 (Implementation): [x] Done (Approach C implemented: `synchronize()`
  calls added)
- Phase 3 (Testing): [ ] Pending
- Phase 4 (Validation): [ ] Pending

**Total: 3-4 hours**

## References

1. [Recursive Descent Parser - GeeksforGeeks](https://www.geeksforgeeks.org/compiler-design/recursive-descent-parser/)
2. [Error Recovery - GNU Bison](https://www.gnu.org/s/bison/manual/html_node/Error-Recovery.html)
3. [WebAssembly Validation Algorithm](https://webassembly.github.io/spec/core/appendix/algorithm.html)
4. [Parser Error Recovery - Eyal Kalderon](https://eyalkalderon.com/blog/nom-error-recovery/)
5. [BlitzMax Variables Documentation](https://blitzmax.org/docs/en/language/variables)

## Next Steps

After parser is fixed:

1. Remove debug instrumentation
2. Fix remaining type promotion issues (UpdateEvents.bb, NPCs.bb, Save.bb)
3. Implement optional parameter support (86 errors in Main.bb)
4. Address final stack balance issues (DevilParticleSystem.bb, MapSystem.bb)
