# Stack Balancing Implementation Plan

**Status**: Infrastructure complete (Phase 1), Integration present but disabled (Phase 2), Optimization pending (Phase 3)
**Current Pass Rate**: 8/36 files (22%) in fast test
**Goal**: Implement proper stack validation + Koopman optimization

---

## Phase 1: Fix Instance Validator Integration (3-4 hours)

### Problem
Currently creating fresh `StackValidator()` instances for if/else branches, which loses:
- Local type information
- Global type information  
- Initialization state
- Function context

### Solution: Single Validator Per Function

#### Step 1.1: Store Current Function Locals

**File**: `Sources/Compiler/CodeGen/FunctionGeneration.swift`

After line 112 where we register goto state local, **add**:

```swift
// Register ALL function locals with stack validator
var allLocals: [(index: Int, type: WASMType)] = []

// Add parameters
for (index, param) in functionNode.parameters.enumerated() {
    let paramType = typeHandling.typeInfo(from: param.type?.rawValue ?? "Int")
    allLocals.append((index, paramType.wasmType))
}

// Add goto state local if present
if gotoStateLocalIdx >= 0 {
    allLocals.append((gotoStateLocalIdx, .i32))
}

// TODO: Add local variables declared in function body
// This requires tracking Local declarations during statement generation

// Initialize validator with all locals
statementGenerator?.initializeFunctionLocals(allLocals)
```

#### Step 1.2: Track Local Declarations

**File**: `Sources/Compiler/CodeGen/StatementGeneration.swift`

Find where local variables are registered (search for `registerLocal`). When a local is registered, also call:

```swift
registerLocalType(localIndex, type: localType)
```

#### Step 1.3: Remove Instance Validator from validateInstructions

**File**: `Sources/Compiler/CodeGen/StatementGeneration.swift` (line ~1280)

**REMOVE** the `validateInstructions()` method entirely - we're using static methods instead.

---

## Phase 2: Verify Static Methods Are Working (1 hour)

### Current Status

The static methods already work:
- `StackValidator.balanceBranches()` - balances if/else ✓
- `StackValidator.balanceToTarget()` - balances loops ✓
- `StackValidator.calculateStackDelta()` - tracks stack effect ✓

### Verification

**File**: `Sources/Compiler/CodeGen/StatementGeneration.swift`

Ensure these are called (already in place):

**If/Else** (line ~342):
```swift
if enableStackValidation {
    let (thenDrops, elseDrops) = StackValidator.balanceBranches(
        thenBranch: thenBody,
        elseBranch: elseBody ?? [],
        localTypes: localTypeCache,
        globalTypes: globalTypeCache
    )
    // Add drops...
}
```

**Loops** (line ~390, ~500, ~530, ~550):
```swift
if enableStackValidation {
    StackValidator.balanceToTarget(&bodyInstrs, targetDelta: 0, 
        localTypes: localTypeCache, globalTypes: globalTypeCache)
}
```

### Test

Enable validation:
```swift
private var enableStackValidation: Bool = true
```

Build and run fast test:
```bash
cd blitz3d-wasm
swift build
./test_scpcb_fast.sh | tail -5
```

**Expected**: Should maintain current pass rate or improve.

---

## Phase 3: Koopman Intra-Block Optimization (Optional, 6-8 hours)

### Background

From your research docs, Koopman's algorithm optimizes **within basic blocks** by:
1. Finding variables used multiple times
2. Keeping them on stack instead of reloading
3. Using DUP/OVER/SWAP instead of local.get

### When to Apply

**ONLY after Phase 1+2 are working!** This is an optimization, not a correctness fix.

### Implementation

#### Step 3.1: Identify Use-Reuse Pairs

**New File**: `Sources/Compiler/CodeGen/StackScheduler.swift` (already created!)

Implement the algorithm from your docs (line 826-944):

```swift
struct UseReusePair {
    let variable: String
    let firstUseIndex: Int
    let reuseIndex: Int
    let distance: Int
}

func findUseReusePairs(_ instructions: [WASMInstruction]) -> [UseReusePair] {
    var pairs: [UseReusePair] = []
    var lastRead: [Int: Int] = [:]  // localIndex -> instructionIndex
    
    for (i, instr) in instructions.enumerated() {
        if case .localGet(let idx) = instr {
            if let prevIndex = lastRead[idx] {
                let distance = i - prevIndex
                pairs.append(UseReusePair(
                    variable: "\(idx)",
                    firstUseIndex: prevIndex,
                    reuseIndex: i,
                    distance: distance
                ))
            }
            lastRead[idx] = i
        }
    }
    
    return pairs.sorted { $0.distance < $1.distance }
}
```

#### Step 3.2: Apply Scheduling

Only works if:
- Stack depth at use point ≤ 3
- Stack depth at reuse point ≤ 2
- No control flow between use/reuse

```swift
func scheduleIntraBlock(_ instructions: inout [WASMInstruction]) {
    let pairs = findUseReusePairs(instructions)
    
    for pair in pairs where pair.distance <= 5 {  // Only nearby pairs
        let useDepth = calculateStackDepthAt(pair.firstUseIndex, in: instructions)
        let reuseDepth = calculateStackDepthAt(pair.reuseIndex, in: instructions)
        
        guard useDepth <= 3 && reuseDepth <= 2 else { continue }
        
        // Insert DUP/OVER at use point
        let copyOp = selectCopyOperation(depth: useDepth)
        instructions.insert(copyOp, at: pair.firstUseIndex + 1)
        
        // Replace local.get at reuse with NOP/SWAP/ROT
        let retrieveOp = selectRetrieveOperation(depth: reuseDepth)
        instructions[pair.reuseIndex] = retrieveOp
    }
}

func selectCopyOperation(depth: Int) -> WASMInstruction {
    switch depth {
    case 0: return .dup         // (a -- a a)
    case 1: return .over        // (a b -- a b a)
    case 2: return .pick(2)     // (a b c -- a b c a)
    default: return .localGet(0) // Fallback
    }
}
```

#### Step 3.3: Measure Impact

Before enabling, run benchmark:
```bash
cd blitz3d-wasm
swift build -c release

# Count local.get instructions before
./test_scpcb_fast.sh > before.txt 2>&1
grep "local.get" before.txt | wc -l

# Enable Koopman, rebuild
# Count local.get instructions after
./test_scpcb_fast.sh > after.txt 2>&1
grep "local.get" after.txt | wc -l
```

**Expected**: 10-20% reduction in local.get instructions for passing files.

---

## Success Criteria

### Phase 1 Complete When:
- [x] All function locals registered with validator
- [x] Type information flows through validation
- [x] No "used before initialization" errors (Blitz3D defaults to 0)
- [x] Compile with no errors

### Phase 2 Complete When:
- ✅ Pass rate maintains 22% or improves
- ✅ Static balance methods correctly insert drops
- ✅ If/else branches balanced
- ✅ Loop bodies balanced

### Phase 3 Complete When:
- ✅ Use-reuse pairs identified correctly
- ✅ DUP/OVER inserted for nearby reuses
- ✅ 10-20% reduction in local.get count
- ✅ Pass rate maintains (optimization doesn't break anything)

---

## Debugging Tips

### Enable Verbose Logging

**File**: `Sources/Compiler/CodeGen/StackValidator.swift`

Set at top of `calculateStackDelta`:
```swift
let verbose = true  // Set to true for debugging
if verbose {
    print("STACK_DELTA: Calculating for \(instructions.count) instructions")
}
```

### Check Stack Delta

Add after each balance call:
```swift
let (delta, _) = StackValidator.calculateStackDelta(bodyInstrs, 
    localTypes: localTypeCache, globalTypes: globalTypeCache)
print("DEBUG: Loop body delta = \(delta)")
```

### Validate Individual Files

```bash
cd blitz3d-wasm
.build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/Difficulty.bb -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

---

## Timeline Estimate

| Phase | Description | Time | Risk |
|-------|-------------|------|------|
| **Phase 1** | Fix instance validator | 3-4h | Low |
| **Phase 2** | Verify static methods | 1h | Very Low |
| **Phase 3** | Koopman optimization | 6-8h | Medium |
| **Total** | End-to-end | **10-13h** | Low |

---

## Current File State

```
✅ StackValidator.swift - Complete (400 lines)
✅ StatementGeneration.swift - Has static calls (currently disabled/commented out)
✅ FunctionGeneration.swift - Needs local registration logic verification
✅ ValidatorTypeContext protocol - Complete
⚠️  StackScheduler.swift - Created but empty, for Phase 3
```

---

## Quick Start

1. **Disable validation for now**:
   ```swift
   private var enableStackValidation: Bool = false
   ```

2. **Implement Phase 1** (register locals)

3. **Re-enable and test**:
   ```swift
   private var enableStackValidation: Bool = true
   ```

4. **If pass rate improves**, continue to Phase 3

5. **If pass rate stays same**, investigate specific failing files

---

## Reference

- Your docs: `docs/stack-balancing-research.md` (29KB, complete algorithm pseudocode)
- WASM spec: https://webassembly.github.io/spec/core/appendix/algorithm.html
- Koopman paper: https://users.ece.cmu.edu/~koopman/stack_compiler/stack_co.html

---

**Ready to implement!** Start with Phase 1, verify with Phase 2, optimize with Phase 3.
