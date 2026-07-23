# Next Steps - Fixing the 10 Failing Files

**Current Status**: 72% pass rate (26/36 files) - VERIFIED ACCURATE\
**Remaining Work**: 10 files with 394 real WASM validation errors

> Note (2026-02-02): this document is a historical triage snapshot. Prefer
> `plan/README.md` and `plan/scpcb-web-track-b/README.md` for current status.

---

## What I Verified Today

### ✅ Test Accuracy

- **Passing files** (26/36): All have 0 WASM validation errors - completely
  valid
- **Failing files** (10/36): All have real WASM validation errors - not test
  artifacts
- **Compiler**: Successfully generates WASM for ALL 36 files
- **Errors**: Are post-compilation WASM validation errors, not compiler crashes

### ✅ Root Causes Identified

The errors are in two categories:

1. **TYPE errors (270)**: Missing f32 ↔ i32 conversions
2. **STACK errors (124)**: if/loop branches leaving values on stack

### ✅ Heuristics Documented

Tested 3 heuristics for stack balancing:

1. Full WASM validator → 22% (FAILED - needs function signatures)
2. Pattern matching → 19% (FAILED - too imprecise)
3. Simple call drops → 72% (WORKS - current baseline)

---

## The 10 Failing Files (Sorted by Difficulty)

### EASY (9 errors total - should take 1-2 hours)

**1. Update.bb - 4 TYPE errors**

```
All 4 errors: "global.set, expected [i32] but got [f32]"
Pattern: Storing f32 values to i32 globals without conversion
Likely cause: Expression returns f32 but we're not converting to i32
Fix: Find which expressions return f32 and add i32.trunc_f32_s
```

**2. Menu.bb - 5 TYPE errors**

```
Needs analysis (similar pattern expected)
```

### MEDIUM (22 errors - should take 2-3 hours)

**3. NPCs.bb - 22 TYPE errors**

```
From earlier analysis:
- Type mismatches in global.set (i32 vs f32)
- Type mismatches in f32.store (i32 vs f32)  
- Type mismatches in comparisons (i32.gt_s with mixed types)
- Type mismatches in function calls (wrong param types)

Pattern: Systematic type confusion between i32/f32
Fix: Audit all float/int operations in NPC code
```

### HARD (238 errors - should take 6-8 hours)

**4. UpdateEvents.bb - 90 errors (83 STACK)**

```
Pattern: "expected [] but got [i32]" - if branches leaving values
Cause: Event state machine has complex nested if statements
Fix: Need to balance if/else branches properly
Challenge: Without function signatures, hard to track stack effects
```

**5. Save.bb - 148 errors (40 STACK, 108 TYPE)**

```
Pattern: Mixed stack and type errors
- Stack: if branches leaving 1-2 values
- Type: f32/i32 mismatches in serialization code
Cause: Complex save/load logic with byte writes
Fix: Both type conversions AND stack balancing needed
```

**Plus 5 files that failed compilation** (not in the 10):

- Need to check why they fail to compile at all

---

## Recommended Approach

### Option A: Quick Wins (2-3 hours)

1. Fix Update.bb (4 errors) - add missing conversions
2. Fix Menu.bb (5 errors) - likely similar
3. Get to **~75% pass rate** (28/36 files)

### Option B: Medium Effort (5-6 hours)

1. Fix Update.bb + Menu.bb (9 errors total)
2. Fix NPCs.bb (22 errors) - systematic type audit
3. Get to **~78% pass rate** (29/36 files)

### Option C: Full Fix (12-15 hours)

1. Fix all easy + medium files (31 errors)
2. Implement function signature database (4-6h)
3. Use signatures to fix UpdateEvents.bb + Save.bb
4. Get to **~95%+ pass rate** (34-36/36 files)

---

## How to Fix Each Type of Error

### TYPE Errors: "expected [i32] but got [f32]"

**Root Cause**: Missing type conversions

**Debugging Steps**:

1. Find the error offset in WASM: `wasm-validate file.wasm`
2. Convert to WAT: `wasm2wat file.wasm > file.wat`
3. Find the instruction at that offset in WAT
4. Look for the pattern before global.set/local.set
5. Add conversion in source generation

**Fix Locations**:

- `StatementGeneration.swift` line 145: Assignment conversion
- `ExpressionGeneration.swift` line ~285: Binary op conversions
- Check if `getTargetType()` is returning correct type

**Example Fix**:

```swift
// If storing to i32 global but value is f32:
if targetType == .i32 && valueResult.type == .f32 {
    finalInstrs.append(.i32TruncF32S)  // Add conversion
}
```

### STACK Errors: "expected [] but got [i32]"

**Root Cause**: if/loop branches leaving values

**Debugging Steps**:

1. Find which if statement in source code
2. Check if it contains function calls as statements
3. Check if both then/else branches are balanced

**Fix Without Function Signatures**:

```swift
// After generating if branch:
let thenBody = generateStatementBlock(...)

// Check if last instruction is a call (heuristic)
if thenBody.last == .call(...) {
    thenBody.append(.drop)  // Add drop
}
```

**Proper Fix (needs function signatures)**:

```swift
// Calculate actual stack effect
let (thenDelta, _) = calculateStackDelta(thenBody, signatures: functionSigs)
let (elseDelta, _) = calculateStackDelta(elseBody, signatures: functionSigs)

// Balance
if thenDelta > elseDelta {
    for _ in 0..<(thenDelta - elseDelta) {
        thenBody.append(.drop)
    }
}
```

---

## Tools for Debugging

### 1. Error Location

```bash
wasm-validate file.wasm 2>&1 | head -10
```

### 2. Convert to WAT

```bash
wasm2wat file.wasm -o file.wat
# Then search in file.wat for the error offset
```

### 3. Check Compiler Output

```bash
blitz3d-wasm input.bb -o output.wasm 2>&1 | grep "DEBUG_ASSIGN\|DEBUG_TRACE"
```

### 4. Test Single File

```bash
blitz3d-wasm ../scpcb/Update.bb -o /tmp/test.wasm && wasm-validate /tmp/test.wasm
```

---

## Time Estimates

| Task                | Effort       | Pass Rate After | Files Fixed    |
| ------------------- | ------------ | --------------- | -------------- |
| **Update.bb**       | 30 min       | 72% → 73%       | 1              |
| **Menu.bb**         | 30 min       | 73% → 75%       | 2              |
| **NPCs.bb**         | 2 hours      | 75% → 78%       | 3              |
| **Function Sigs**   | 4 hours      | -               | Infrastructure |
| **UpdateEvents.bb** | 2 hours      | 78% → 81%       | 4              |
| **Save.bb**         | 3 hours      | 81% → 84%       | 5              |
| **Remaining 5**     | 4 hours      | 84% → 98%+      | 10             |
| **TOTAL**           | **16 hours** | **98%+**        | **All 10**     |

---

## Current Blocker

The STACK errors (124 total) are hard to fix without function signatures
because:

1. Can't track `.call` instruction stack effects
2. `calculateStackDelta()` assumes zero effect for calls
3. This makes it calculate wrong stack depths

**Solution**: Implement function signature database (Task 3)

---

## Status

- [x] Researched stack balancing algorithms
- [x] Implemented StackValidator infrastructure

## 2026-02-02 updates (reliability + regression prevention)

- Added BB→WASM end-to-end smoke tests (`Tests/deno_smoke/` +
  `Tools/tests/bb_deno_compile_and_run_smoke.test.ts`) to catch
  control-flow/type/ABI regressions quickly.
- Added web-side “safe runner” execution (Worker + watchdog timeout + Stop
  control) so infinite loops never freeze the tab (`web/interpreter.html`,
  `web/interpreter.js`, `web/public/bb_wasm_runner_demo.html`).
- [x] Verified test accuracy
- [x] Documented heuristics
- [ ] Fix Update.bb (4 errors) ← START HERE
- [ ] Fix Menu.bb (5 errors)
- [ ] Fix NPCs.bb (22 errors)
- [ ] Implement function signature database
- [ ] Fix UpdateEvents.bb (90 errors)
- [ ] Fix Save.bb (148 errors)

---

## Recommendation

**START SIMPLE**: Fix Update.bb and Menu.bb first (30 min each = 1 hour total)
to verify the approach works. Then tackle NPCs.bb (2 hours). That gets us to 78%
pass rate (29/36 files) in ~3 hours total.

After that, reassess whether to:

- A) Implement function signature database (proper fix)
- B) Try manual heuristics for remaining files
- C) Use Binaryen wasm-opt as post-processor
