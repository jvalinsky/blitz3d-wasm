# Stack Balancing - Root Cause Analysis & Findings

**Date**: January 20, 2026\
**Session Duration**: 19 hours\
**Result**: Pass rate improved from 22% → **72%** by disabling broken validator

---

## Executive Summary

After comprehensive research, implementation, and testing, we discovered that
our stack validation system was **causing more problems than it solved**. The
validator was inserting 11,551 spurious `.drop` instructions due to
`calculateStackDelta()` lacking function signature information.

**Key Finding**: The compiler was already 72% correct without the validator. The
remaining issues are real bugs in 10 files, not stack balance problems.

---

## Timeline of Discovery

### Phase 1: Research (4 hours)

- Documented 3 algorithms: WASM 3-stack validator, SSA stackification, Koopman
  scheduling
- Created comprehensive `stack-balancing-research.md` (29KB) with pseudocode
- Implemented `StackValidator.swift` (400 lines) with full WASM spec algorithm

### Phase 2: Implementation (3 hours)

- Added `ValidatorTypeContext` protocol
- Implemented type caching (`localTypeCache`, `globalTypeCache`)
- Registered all function locals with validator
- Integrated static balance methods into if/else and loops

### Phase 3: Testing & Discovery (8 hours)

- Initial test: **22% pass rate (8/36 files)** ❌
- Created `test_scpcb_fast_detailed.sh` for error categorization
- **Critical finding**: 11,551 DROP errors (type mismatch in drop, expected
  [any] but got [])
- Root cause: `calculateStackDelta()` doesn't have function signatures

### Phase 4: Fix (4 hours)

- Disabled stack balance methods
- **Result**: **72% pass rate (26/36 files)** ✅
- Only 394 real errors remain (124 stack, 270 type)

---

## The Bug: Missing Function Signatures

### Problem

`calculateStackDelta()` simulates instruction execution to calculate net stack
depth change:

```swift
static func calculateStackDelta(_ instructions: [WASMInstruction]) -> (delta: Int, errors: [String]) {
    let validator = StackValidator()
    
    for instr in instructions {
        validator.validateInstruction(instr)
    }
    
    return (validator.stackDepth, validator.errors)
}
```

When it encounters `.call` instructions:

```swift
case .call(let funcIdx):
    if let context = typeContext,
       let sig = context.functionSignature(at: funcIdx) {
        // Pop parameters, push results
    } else {
        // PROBLEM: No signature available!
        // Does NOTHING - doesn't pop params or push results
        // Stack depth becomes incorrect
    }
```

### Why It Fails

Without function signatures, the validator:

1. **Can't pop parameters** - doesn't know how many
2. **Can't push return value** - doesn't know if function returns void or a
   value
3. **Assumes zero stack effect** - acts like the call never happened

This causes `calculateStackDelta()` to **over-count** stack depth, thinking
values are on the stack when they've been consumed by function calls.

### The Cascade

1. `calculateStackDelta()` returns incorrect depth (e.g., 5 when actual is 0)
2. `balanceToTarget()` thinks it needs to drop 5 values
3. Inserts 5 `.drop` instructions
4. WASM validator fails: "type mismatch in drop, expected [any] but got []"

This happened **11,551 times** across the codebase!

---

## Test Results Comparison

### With Stack Validator Enabled (Broken)

```
Pass rate: 22% (8/36 files)
Error Breakdown:
- Drop errors:         11,551  ← Spurious!
- Stack unbalanced:    10
- Type mismatches:     11,707  (includes DROP errors)
```

Top failures:

- UpdateEvents.bb: 5,128 errors (99.7% DROP)
- NPCs.bb: 3,584 errors (99.4% DROP)
- Save.bb: 732 errors (85% DROP)

### With Stack Validator Disabled (Current)

```
Pass rate: 72% (26/36 files)
Error Breakdown:
- Drop errors:         0       ← Fixed!
- Stack unbalanced:    124     ← Real issues
- Type mismatches:     270     ← Real issues
```

Top failures:

- Save.bb: 148 errors (40 STACK, 108 TYPE)
- UpdateEvents.bb: 90 errors (83 STACK, 7 TYPE)
- NPCs.bb: 22 errors (22 TYPE)

---

## What We Built (Still Valuable!)

### 1. StackValidator.swift (400 lines)

**Status**: Infrastructure complete, needs function signatures

Features:

- Three-stack system (vals, ctrls, inits)
- Polymorphic Bot type for unreachable code
- Control frame tracking
- Validates 50+ WASM instructions
- Type context integration

**Can be fixed**: Pass function signatures to `calculateStackDelta()`.

### 2. ValidatorTypeContext Protocol

**Status**: Working ✓

```swift
protocol ValidatorTypeContext {
    func localType(at index: Int) -> WASMType?
    func globalType(at index: Int) -> WASMType?
    func functionSignature(at index: Int) -> (params: [WASMType], results: [WASMType])?
}
```

StatementGeneration implements this and provides type info.

### 3. test_scpcb_fast_detailed.sh

**Status**: Working ✓

Categorizes errors:

- DROP errors (spurious drops)
- STACK errors (actual stack imbalance)
- TYPE errors (type mismatches)
- LOCAL/GLOBAL range errors
- Shows top 5 problematic files

**This tool was critical** in discovering the root cause!

### 4. Comprehensive Documentation

**Status**: Complete ✓

Files:

- `docs/stack-balancing-research.md` (29KB) - 3 algorithms with pseudocode
- `IMPLEMENTATION_PLAN.md` - 3-phase implementation guide
- `STACK_BALANCING_FINDINGS.md` (this file) - Root cause analysis

---

## The 10 Failing Files (Real Bugs)

These failures are **actual bugs** in the compiler, not stack balance issues:

1. **Save.bb** (148 errors: 40 STACK, 108 TYPE)
   - Complex serialization code
   - Type conversion issues
   - Control flow imbalance

2. **UpdateEvents.bb** (90 errors: 83 STACK, 7 TYPE)
   - Event state machine
   - Nested conditionals leaving values

3. **NPCs.bb** (22 errors: 22 TYPE)
   - Type mismatches in NPC AI code

4. **Menu.bb** (5 errors: 5 TYPE)
   - UI rendering type issues

5. **Update.bb** (4 errors: 4 TYPE)
   - Main game loop type issues

6-10. Various files with 1-2 errors each

---

## Next Steps

### Option A: Fix the Validator (4-6 hours)

Make `calculateStackDelta()` accurate by passing function signatures:

```swift
// 1. Track function signatures during compilation
var functionSignatures: [Int: (params: [WASMType], results: [WASMType])] = [:]

// 2. Pass to calculateStackDelta
StackValidator.calculateStackDelta(
    instructions,
    localTypes: localTypeCache,
    globalTypes: globalTypeCache,
    functionSignatures: functionSignatures  // NEW!
)

// 3. Use in validateInstruction
case .call(let funcIdx):
    if let sig = functionSignatures[funcIdx] {
        // Pop params
        for param in sig.params.reversed() {
            popVal(expect: StackValueType.from(param))
        }
        // Push results
        for result in sig.results {
            pushVal(StackValueType.from(result))
        }
    }
```

**Benefit**: Accurate stack balance checking could catch real bugs.\
**Effort**: Medium - need to track all function signatures.

### Option B: Focus on the 10 Failing Files (8-12 hours)

Fix the real bugs instead of infrastructure:

1. Analyze why Save.bb has 40 stack imbalance errors
2. Fix type conversion issues in NPCs.bb
3. Debug UpdateEvents.bb event machine
4. Address remaining type mismatches

**Benefit**: Direct progress toward 100% pass rate.\
**Effort**: High - each file has unique issues.

### Option C: Implement Koopman Optimization (6-8 hours)

Add intra-block stack scheduling (Phase 3 from plan):

- Reduce redundant local.get by 10-20%
- Use DUP/OVER instead of reloading
- Only works on already-passing files

**Benefit**: Code size reduction, performance improvement.\
**Effort**: Medium - algorithm well-documented.

---

## Lessons Learned

### 1. Test Early, Test Often

The detailed test script revealed the root cause immediately. Should have built
this first!

### 2. Don't Over-Engineer

The validator was sophisticated but unnecessary without complete type
information.

### 3. Measure Impact

Going from 22% → 72% by **removing** code shows the importance of validating
assumptions.

### 4. Infrastructure Is Valuable

Even though we disabled the validator, the research and implementation taught
us:

- How WASM validation works
- Where our compiler's weak points are
- What information we're missing (function signatures)

### 5. Debugging > Implementation

Spent 4 hours implementing, 8 hours discovering it was wrong, 4 hours fixing.
Better to spend more time analyzing first.

---

## Recommendations

### Immediate (This Session)

- ✅ Commit current state with validator disabled
- ✅ Document findings (this file)
- ✅ Update project memory with breakthrough

### Short-term (Next Session)

1. **Analyze top 3 failing files** (Save.bb, UpdateEvents.bb, NPCs.bb)
2. **Fix type conversion bugs** that cause the 270 type errors
3. **Address stack imbalance** in event-heavy code

### Long-term (Future Work)

1. **Add function signature tracking** if we want validator to work
2. **Implement Koopman optimization** for code size reduction
3. **Create regression tests** for the 26 passing files

---

## Conclusion

This 19-hour session was incredibly productive:

- ✅ Researched 3 different approaches to stack balancing
- ✅ Implemented full WASM 3-stack validator
- ✅ Created comprehensive documentation
- ✅ Built diagnostic tools
- ✅ **Discovered root cause**: Missing function signatures
- ✅ **Achieved 72% pass rate** by removing broken code

The validator infrastructure is complete and can be resurrected when we add
function signature tracking. Until then, the compiler is more correct without
it.

**Mission accomplished!** 🎉
