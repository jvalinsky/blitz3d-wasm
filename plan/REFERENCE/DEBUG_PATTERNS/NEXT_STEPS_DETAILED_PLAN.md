# Detailed Plan: Path to 100% SCPCB Compilation

**Current Status**: 80% (29/36 files passing)\
**Target**: 95%+ (34+/36 files passing)\
**Estimated Time**: 14-22 hours

---

## Phase 1: Fix Compiler Crashes (2-4 hours)

**Files**: Main.bb, MapSystem.bb\
**Priority**: HIGH (blocking files)

### Investigation Strategy

1. **Reproduce crash with minimal case** (30 min)
   ```bash
   # Run with lldb to get stack trace
   lldb -- swift run blitz3d-wasm ../scpcb/Main.bb -o /tmp/Main.wasm
   # Get backtrace at crash point
   ```

2. **Check Blitz3D reference** (30 min)
   - Look at `reference/blitz3d-ng/src/tools/compiler/` for how Main.bb patterns
     are handled
   - Check if there are special constructs we're missing

3. **Binary search the file** (1-2 hours)
   - Main.bb is 15,000+ lines - find exact line causing crash
   - Create minimal reproduction
   - Fix root cause

4. **Verify fix** (30 min)
   - Test both Main.bb and MapSystem.bb
   - Ensure no regressions in other files

**Expected Outcome**: +2 files (82% pass rate)

---

## Phase 2: Implement Optional Parameters (8-12 hours)

**Priority**: CRITICAL (blocks 4 files)\
**Complexity**: High (language feature, not bug fix)

### Design Phase (2 hours)

**Study Blitz3D reference implementation**:

```bash
# Find how Blitz3D handles optional parameters
grep -r "default.*param\|optional" reference/blitz3d-ng/src/tools/compiler/
# Check function declaration parsing
cat reference/blitz3d-ng/src/tools/compiler/tree/func/func.cpp
```

**Key Questions to Answer**:

1. How are default values stored in AST?
2. When are defaults applied - parse time or call time?
3. How does semantic analysis resolve calls?
4. What about multiple functions with same name?

**Design Document**: Create `docs/OPTIONAL_PARAMETERS_DESIGN.md` with:

- AST representation
- Parser changes needed
- Semantic analysis approach
- Code generation strategy

### Implementation Phase (4-6 hours)

**Step 1: Extend AST (1 hour)** [x] Done

```swift
// ... (AST.swift verified)
```

**Step 2: Extend Parser (2 hours)** [x] Done

```swift
// ... (Parser.swift verified)
```

**Step 3: Function Resolution (2 hours)**

```swift
// In CodeGenerator.swift - generate function call

// Store function signatures with parameter counts
var functionSignatures: [String: [Int: FunctionDefinition]] = [:]
// "entitytexture": [2: def1, 3: def2, 4: def3]

// On call:
let paramCount = call.arguments.count
let funcName = call.name.lowercased()
if let variants = functionSignatures[funcName] {
    if let matchingDef = variants[paramCount] {
        // Use this definition
    }
}
```

**Step 4: Code Generation (1-2 hours)** [/] Partial

- Current status: `ExpressionGeneration.swift` pads missing arguments with `0`
  or `0.0`.
- Missing: Logic to use `defaultValue` from AST instead of zeros.

**Step 5: Runtime Functions (1 hour)** [ ] Pending

```swift
// Add all EntityTexture variants:
("EntityTexture", "EntityTexture", [.i32, .i32], [], "env"),
("EntityTexture", "EntityTexture", [.i32, .i32, .i32], [], "env"),
("EntityTexture", "EntityTexture", [.i32, .i32, .i32, .i32], [], "env"),

// Survey SCPCB for all multi-arity functions
// Add all variants to runtime
```

### Testing Phase (2-3 hours)

**Unit Tests**:

```swift
func testOptionalParameterParsing()
func testOptionalParameterCodeGen()
func testMultiArityFunctionCalls()
func testDefaultValueEvaluation()
```

**Integration Tests**:

```blitz3d
Function Test(a%, b% = 10, c# = 5.5)
    Return a + b + c
End Function

Print Test(1)        ; Should call with b=10, c=5.5
Print Test(1, 20)    ; Should call with c=5.5
Print Test(1, 20, 3.5) ; Should call with all provided
```

**SCPCB Tests**:

- DevilParticleSystem.bb should now pass
- Check for regressions in other files

**Expected Outcome**: +1 file (83% pass rate) + unblocks future features

---

## Phase 3: Fix Type Inference (4-6 hours)

**Files**: NPCs.bb (16 errors), Save.bb (96 errors), UpdateEvents.bb (7 errors)\
**Priority**: HIGH\
**Pattern**: All errors are f32/i32 type mismatches

### Investigation Phase (1 hour)

**Analyze error patterns**:

```bash
# Get all type mismatch errors
for file in NPCs Save UpdateEvents; do
    echo "=== $file.bb ===" 
    wasm-validate /tmp/${file}.wasm 2>&1 | grep "type mismatch" | sort | uniq -c
done
```

**Common patterns to find**:

1. `local.set expected [f32] but got [i32]` - wrong variable type inferred
2. `i32.gt_s expected [i32, i32] but got [f32, i32]` - mixed comparison
3. `i32.add expected [i32, i32] but got [f32, i32]` - mixed arithmetic

**Check Blitz3D reference**:

```bash
# How does Blitz3D determine variable types?
cat reference/blitz3d-ng/src/tools/compiler/tree/var/ident_var.cpp
cat reference/blitz3d-ng/src/tools/compiler/tree/var/decl_var.cpp
```

### Root Cause Analysis (1 hour)

**Create minimal reproductions**:

```blitz3d
; Pattern 1: Auto-declared variable gets wrong type
Function Test1()
    timer = 0.0  ; Should infer timer# (float)
    timer = timer + 1  ; ERROR: treating as int
End Function

; Pattern 2: Forward reference with different suffix
Function Test2()
    x = 10      ; Declares x% (int)
    x# = 5.5    ; Should be same variable!
End Function

; Pattern 3: Mixed arithmetic
Function Test3()
    Local counter# = 0.0
    counter = counter + 1  ; Should promote to f32.add
End Function
```

### Implementation (2-3 hours)

**Fix 1: Improve TypeInference.swift** (1 hour)

```swift
// Current: Only scans forward in immediate scope
// Needed: Scan entire function body for all uses

func inferType(for variable: String, in function: FunctionNode) -> TypeSuffix {
    var usages: [TypeSuffix] = []
    
    // Scan ALL statements in function
    scanStatements(function.body) { stmt in
        if let assignment = stmt as? AssignmentNode {
            if assignment.target.name == variable {
                if let suffix = assignment.target.typeSuffix {
                    usages.append(suffix)
                }
            }
        }
    }
    
    // If any usage has float suffix, variable is float
    if usages.contains(.float) { return .float }
    if usages.contains(.string) { return .string }
    return .integer  // Default
}
```

**Fix 2: Variable Registration** (1 hour)

```swift
// In StatementGeneration.swift - auto-declaration
// Before registering, check if variable already exists with different suffix
// Blitz3D: x, x%, x# are THE SAME variable

func registerVariable(_ name: String, suffix: TypeSuffix?) {
    let baseName = name // Strip suffix if present
    
    // Check if already registered (any suffix)
    if let existing = lookupVariable(baseName) {
        // Already exists - verify types match
        if let suffix = suffix {
            let expectedType = wasmType(from: suffix)
            if existing.type != expectedType {
                // ERROR: Type mismatch
            }
        }
        return  // Use existing
    }
    
    // New variable - infer type
    let inferredType = inferType(for: baseName, in: currentFunction)
    registerLocal(baseName, type: wasmType(from: inferredType))
}
```

**Fix 3: Binary Operations** (30 min)

```swift
// In ExpressionGeneration.swift - generateBinaryOp
// Already promotes types, but verify it's working

// Check: Are we using typeHandling.commonType() correctly?
// Check: Are conversions applied in right order?
// Check: Do we handle all operator types?
```

### Testing Phase (1 hour)

**Unit Tests**:

```swift
func testVariableTypeInference_FloatUsage()
func testVariableTypeInference_MixedSuffixes()
func testMixedArithmeticTypePromotion()
func testAutoDeclarationWithFloat()
```

**SCPCB Tests**:

- NPCs.bb: 16 → 0 errors
- Save.bb: 96 → 0 errors
- UpdateEvents.bb: 7 → 0 errors

**Expected Outcome**: +3 files (86% pass rate)

---

## Phase 4: Verification & Cleanup (1-2 hours)

### Full Test Suite

```bash
# Run all tests
swift test
bash test_scpcb_fast.sh

# Check pass rate
# Target: 95%+ (34/36 files)
```

### Documentation Updates

1. Update SESSION_7_SUMMARY.md with results
2. Document optional parameter implementation
3. Update type inference documentation
4. Create LESSONS_LEARNED.md

### Memory Block Updates

1. Update `project` with new pass rate and remaining issues
2. Document any new patterns discovered
3. Update `blitz3d_language` with optional parameter notes

---

## Timeline Summary

| Phase     | Task            | Time       | Pass Rate       |
| --------- | --------------- | ---------- | --------------- |
| 0         | Current         | 0h         | 80% (29/36)     |
| 1         | Fix crashes     | 2-4h       | 82% (31/36)     |
| 2         | Optional params | 8-12h      | 83% (32/36)     |
| 3         | Type inference  | 4-6h       | 86% (35/36)     |
| 4         | Verification    | 1-2h       | 86%+            |
| **Total** |                 | **15-24h** | **86%+ target** |

---

## Risk Assessment

### High Risk

- **Optional parameters**: Complex feature, might take longer than estimated
- **Main.bb crash**: Could be deep architectural issue

### Medium Risk

- **Type inference**: Might need more cases than anticipated
- **Regressions**: Fixes might break currently passing files

### Low Risk

- **Testing**: Test infrastructure already solid
- **Documentation**: Well-established patterns

---

## Success Criteria

### Minimum Success (Phase 1-3)

- ✅ Main.bb and MapSystem.bb compile
- ✅ Optional parameters work for EntityTexture
- ✅ Type inference fixes at least 2 of 3 files
- **Result**: 85%+ pass rate

### Full Success (All Phases)

- ✅ All crashes fixed
- ✅ Optional parameters fully implemented
- ✅ Type inference fixes all 3 files
- ✅ 244+ unit tests passing
- ✅ Comprehensive documentation
- **Result**: 90%+ pass rate

### Stretch Goals

- Implement proper semantic analysis pass
- Add type inference caching
- Create debugging tools for type issues
- Survey and fix remaining edge cases
- **Result**: 95%+ pass rate

---

## Dependencies & Blockers

**None** - All work can proceed independently with resources available:

- ✅ Blitz3D C++ reference code available
- ✅ Test infrastructure ready
- ✅ SCPCB source code available
- ✅ Unit test framework working

---

## Next Session Start Point

1. **Read this plan thoroughly** (5 min)
2. **Start Phase 1**: Fix Main.bb crash
3. **Use reference code when stuck**:
   `/Users/jack/Software/scp_port/reference/blitz3d-ng/`
4. **Document as you go**: Update findings in real-time
5. **Test frequently**: After each fix, run test suite

**First Command**:

```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm
lldb -- swift run blitz3d-wasm ../scpcb/Main.bb -o /tmp/Main.wasm
```

---

**Remember**: Take your time, think deeply, and use the reference code!
