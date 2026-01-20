# Stack Balance Heuristics - Testing & Results

**Date**: January 20, 2026  
**Problem**: WASM if/else branches must have same stack effect, but we can't track this without function signatures  
**Baseline**: 72% pass rate (26/36 files) with NO stack balancing

---

## The Core Problem

WASM requires that both branches of an `if/else` leave the stack in the same state:

```wasm
(if (result)           ; Both branches must leave nothing
  (then ...)           ; Must end with []
  (else ...)           ; Must end with []
)

(if (result i32)       ; Both branches must leave i32
  (then ...)           ; Must end with [i32]
  (else ...)           ; Must end with [i32]
)
```

**Why It's Hard**: We can't track stack effects accurately because:
1. `.call` instructions need function signatures to know params/returns
2. We don't have a function signature database during codegen
3. Runtime functions are imported and not tracked

---

## Heuristic 1: Full WASM 3-Stack Validator

**Approach**: Implement the complete WASM validation algorithm from spec.

**Implementation**: `StackValidator.swift` (400 lines)
- Three stacks: `vals` (operand types), `ctrls` (control frames), `inits` (local init tracking)
- `validateInstruction()` for 50+ WASM instructions
- `calculateStackDelta()` to compute net stack effect

**Usage**:
```swift
let (thenDelta, _) = StackValidator.calculateStackDelta(thenBranch, 
    localTypes: localTypeCache, 
    globalTypes: globalTypeCache)
let (elseDelta, _) = StackValidator.calculateStackDelta(elseBranch, ...)

if thenDelta > elseDelta {
    // Add (thenDelta - elseDelta) drops to then branch
} else if elseDelta > thenDelta {
    // Add (elseDelta - thenDelta) drops to else branch
}
```

**Results**:
```
Pass rate: 22% (8/36 files) ❌
DROP errors: 11,551 (expected [any] but got [])
STACK errors: 10
TYPE errors: 11,707

Top failures:
- UpdateEvents.bb: 5,128 errors (99.7% DROP)
- NPCs.bb: 3,584 errors (99.4% DROP)
- Save.bb: 732 errors (85% DROP)
```

**Root Cause**: `calculateStackDelta()` encounters `.call` instructions but doesn't have function signatures:

```swift
case .call(let funcIdx):
    if let sig = context.functionSignature(at: funcIdx) {
        // Pop params, push results
    } else {
        // BUG: Does NOTHING - assumes zero stack effect
        // Stack depth becomes wildly inaccurate
    }
```

This causes massive over-counting of stack depth, leading to 11,551 spurious `.drop` instructions.

**Verdict**: ❌ **FAILED** - Can't work without function signatures

**Commits**:
- `191ade9` - Implemented validator
- `2686842` - Disabled validator, restored 72% pass rate

---

## Heuristic 2: Instruction-Pattern Matching

**Approach**: Scan last ~10 instructions of each branch, track stack effects heuristically.

**Implementation**: `ensureBlockBalanced()` in StatementGeneration.swift

```swift
func ensureBlockBalanced(_ instructions: [WASMInstruction], blockType: String) -> [WASMInstruction] {
    var needsDrops = 0
    
    // Scan last few instructions
    for instr in instructions.suffix(10) {
        switch instr {
        // Instructions that push values
        case .i32Const, .i64Const, .f32Const, .f64Const:
            needsDrops += 1
        case .localGet, .globalGet:
            needsDrops += 1
        
        // Instructions that consume values
        case .localSet, .globalSet:
            needsDrops = max(0, needsDrops - 1)
        case .i32Store, .f32Store, .i64Store, .f64Store:
            needsDrops = max(0, needsDrops - 2)
        case .drop:
            needsDrops = max(0, needsDrops - 1)
        
        // Control flow resets analysis
        case .if, .block, .loop, .br, .brIf, .return:
            needsDrops = 0
        
        // Calls - assume neutral (can't track)
        case .call, .callIndirect:
            break
        
        default:
            break  // Unknown - assume neutral
        }
    }
    
    // Add drops if we think there are leftovers
    if needsDrops > 0 {
        for _ in 0..<needsDrops {
            balanced.append(.drop)
        }
    }
    
    return balanced
}
```

**Usage**:
```swift
if enableStackValidation {
    balancedThen = ensureBlockBalanced(balancedThen, blockType: "then")
    if balancedElse != nil {
        balancedElse = ensureBlockBalanced(balancedElse!, blockType: "else")
    }
}
```

**Results**:
```
Pass rate: 19% (7/36 files) ❌
DROP errors: 9,090 (expected [any] but got [])
STACK errors: 24
TYPE errors: 9,260

Top failures:
- UpdateEvents.bb: 3,757 errors (99% DROP)
- NPCs.bb: 3,255 errors (99% DROP)
- Menu.bb: 649 errors (99% DROP)
```

**Root Cause**: 
1. **Window too narrow**: Only scanning last 10 instructions misses earlier stack effects
2. **No binary op tracking**: Didn't handle +, -, *, /, comparisons (all pop 2, push 1)
3. **Calls still unknown**: Assumed neutral, but they actually push/pop
4. **If statements nested**: Control flow within the window resets count prematurely

**Problems**:
```wasm
; Example that fails:
(then
    (local.get 0)     ; +1  (needsDrops = 1)
    (local.get 1)     ; +1  (needsDrops = 2)
    (i32.add)         ; -2, +1  (NOT TRACKED, needsDrops still = 2!)
    (drop)            ; -1  (needsDrops = 1)
)
; Heuristic thinks we need 1 drop, actually need 0!
```

**Verdict**: ❌ **FAILED** - Too imprecise, causes more spurious drops

**Status**: Disabled after testing

---

## Heuristic 3: Function Call Return Drop (Current Approach)

**Approach**: Only handle the most obvious case - function calls as statements.

**Implementation**: Already exists in `generateStatement()`:

```swift
case .functionCall(let call):
    let (instrs, type) = expressionGenerator.generateWithInfo(.functionCall(call))
    function.body.append(contentsOf: instrs)
    
    // If function returns a value but is used as statement, drop it
    if type != .void {
        function.body.append(.drop)
        print("DEBUG_STMT: Dropped return value of type \(type) for call statement")
    }
```

**How It Works**:
1. ExpressionGenerator knows the return type of each function
2. If function is called as statement (not in expression), drop the return
3. Void functions push dummy `i32.const 0`, which gets dropped

**Results**:
```
Pass rate: 72% (26/36 files) ✓
DROP errors: 0 ✓
STACK errors: 124 (real bugs in generated code)
TYPE errors: 270 (real bugs in generated code)
```

**Why It Works**:
- **Targeted**: Only drops when we KNOW a value is left (function return)
- **Conservative**: Doesn't try to guess stack effects of other instructions
- **Already implemented**: This has been working all along

**Verdict**: ✓ **WORKING** - Simple and effective for the common case

---

## Heuristic 4: Post-Compilation WASM Repair (Not Yet Tested)

**Approach**: Let compilation produce invalid WASM, then fix it with a separate pass.

**Tools**:
- `wasm-validate` to find exact error locations
- `wasm2wat` to see the problematic code
- Manual insertion of `.drop` at error locations

**Pseudocode**:
```python
def repair_wasm(wasm_file):
    errors = run_wasm_validate(wasm_file)
    
    for error in errors:
        if "expected [] but got [i32]" in error:
            # Parse error location
            offset = parse_offset(error)
            # Insert .drop at that location
            insert_instruction(wasm_file, offset, Drop())
        elif "expected [i32] but got []" in error:
            # Insert dummy value
            insert_instruction(wasm_file, offset, I32Const(0))
```

**Pros**:
- ✓ Works on actual WASM validation errors (100% accurate)
- ✓ No need for function signatures
- ✓ Can fix any stack imbalance

**Cons**:
- ❌ Requires parsing binary WASM
- ❌ Inserting instructions shifts all offsets
- ❌ Complex implementation
- ❌ Doesn't fix root cause in compiler

**Verdict**: 🤔 **NOT TESTED** - Possible last resort, but complex

---

## Heuristic 5: Runtime Function Signature Database

**Approach**: Build a database of all runtime function signatures so `calculateStackDelta()` can track them.

**Implementation**:

### Step 1: Extract Runtime Signatures
```swift
// In ModuleContext or FunctionGeneration
var functionSignatures: [Int: (params: [WASMType], results: [WASMType])] = [:]

// When importing runtime functions
for (idx, func) in runtimeFunctions.enumerated() {
    functionSignatures[idx] = (func.parameters.map { $0.type }, 
                                func.returnType.map { [$0] } ?? [])
}

// When compiling user functions
for (idx, func) in userFunctions.enumerated() {
    let userIdx = idx + runtimeFunctions.count
    functionSignatures[userIdx] = (func.parameters.map { $0.type },
                                    func.returnType.map { [$0] } ?? [])
}
```

### Step 2: Pass to calculateStackDelta
```swift
StackValidator.calculateStackDelta(
    instructions,
    localTypes: localTypeCache,
    globalTypes: globalTypeCache,
    functionSignatures: functionSignatures  // NEW!
)
```

### Step 3: Use in validateInstruction
```swift
case .call(let funcIdx):
    if let sig = functionSignatures[funcIdx] {
        // Pop parameters (right to left)
        for param in sig.params.reversed() {
            popVal(expect: StackValueType.from(param))
        }
        // Push results
        for result in sig.results {
            pushVal(StackValueType.from(result))
        }
    } else {
        // Still no signature - log warning
        errors.append("Unknown function signature for call \(funcIdx)")
    }
```

**Estimated Effort**: 4-6 hours
- 1 hour: Build signature database during compilation
- 2 hours: Thread it through all validation call sites
- 1 hour: Update StackValidator to use it
- 1-2 hours: Test and fix edge cases

**Expected Results**:
```
Pass rate: 85-95%+ (30-34/36 files)
DROP errors: 0
STACK errors: <50 (real bugs)
TYPE errors: <100 (real bugs)
```

**Pros**:
- ✓ Makes Heuristic 1 (full validator) actually work
- ✓ Accurate stack tracking
- ✓ Can catch real bugs

**Cons**:
- ⚠️ Medium implementation effort
- ⚠️ Need to track function indices carefully

**Verdict**: 🎯 **RECOMMENDED** - This is the "proper fix"

---

## Heuristic 6: Binaryen wasm-opt Post-Processing

**Approach**: Use Binaryen's optimizer to fix stack issues automatically.

**Tools**: `wasm-opt` from Binaryen toolkit

**Usage**:
```bash
# After compilation
blitz3d-wasm input.bb -o output_raw.wasm
wasm-opt output_raw.wasm -o output_fixed.wasm --optimize-level 0 --converge

# wasm-opt will:
# - Insert drops where needed
# - Balance control flow
# - Fix type mismatches
```

**Pros**:
- ✓ Zero implementation effort
- ✓ Industry-standard tool (used by Emscripten)
- ✓ Handles all edge cases

**Cons**:
- ❌ External dependency
- ❌ Doesn't fix root cause
- ⚠️ May not handle all our errors (designed for optimizing, not repairing)

**Verdict**: 🤔 **WORTH TRYING** - Could be quick win, but may not work

---

## Comparison Table

| Heuristic | Pass Rate | DROP Errors | Effort | Status | Recommendation |
|-----------|-----------|-------------|--------|--------|----------------|
| **None (baseline)** | **72%** | **0** | 0h | ✓ Active | Current default |
| **Full validator** | 22% | 11,551 | 12h (done) | ❌ Disabled | Don't use |
| **Pattern matching** | 19% | 9,090 | 2h (done) | ❌ Disabled | Don't use |
| **Call drop** | 72% | 0 | 0h (exists) | ✓ Active | Keep using |
| **Post-repair** | ? | ? | 8-12h | ⏸️ Not tested | Low priority |
| **Signature DB** | ~90%? | 0 | 4-6h | ⏸️ Not tested | **BEST** |
| **Binaryen** | ? | ? | 1h | ⏸️ Not tested | Worth trying |

---

## Recommended Approach

### Short-term (Next Session)
1. ✅ **Keep baseline** (72% pass rate with call drops only)
2. 🎯 **Test Binaryen wasm-opt** (1 hour) - might be a quick win
3. 🎯 **Implement signature database** (4-6 hours) if Binaryen doesn't work

### Long-term
1. **Fix the 10 failing files** by analyzing their specific bugs
2. **Implement signature database** for future-proofing
3. **Consider Koopman optimization** for code size reduction

---

## Lessons Learned

### 1. Simple is Better
The "call drop" approach (already implemented) beats both sophisticated heuristics because it's:
- **Conservative**: Only acts when certain
- **Targeted**: Addresses the most common case
- **Proven**: Actually works in practice

### 2. Don't Guess Stack Effects
Both failed heuristics tried to guess stack effects without complete information. This leads to:
- **False positives**: Inserting drops when stack is already empty
- **False negatives**: Missing actual imbalances
- **Cascading errors**: One wrong guess affects everything after

### 3. Fix Root Causes
The real fix is **function signatures**, not heuristics. Heuristics are band-aids that:
- Make the code more complex
- Add maintenance burden
- Don't actually solve the problem

### 4. Measure Everything
Without `test_scpcb_fast_detailed.sh`, we wouldn't have known:
- Exactly how many DROP errors (11,551!)
- Where the errors are (which files)
- What types of errors (DROP vs STACK vs TYPE)

Diagnostic tools are as important as the code itself.

---

## Conclusion

**Current state**: 72% pass rate with simple call drops is GOOD ENOUGH for now.

**Next step**: Implement function signature database (Heuristic 5) to properly fix stack validation and reach 90%+ pass rate.

**Don't do**: More heuristics without complete information - they make things worse.
