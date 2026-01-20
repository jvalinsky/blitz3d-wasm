# Remaining Work - Path to 95%+ Pass Rate

**Current Status**: 31/36 files (86%)  
**Remaining**: 5 files, 153 total errors (124 STACK + 29 TYPE)

---

## Priority 1: Easy Wins (2-3 hours)

### 1. NPCs.bb - 22 TYPE errors
**Pattern**: Type mismatches in global/field assignments
- Error: `global.set, expected [i32] but got [f32]`
- Error: `f32.store, expected [i32, f32] but got [i32, i32]`
- **Root cause**: Likely related to NPCs type fields or constant usage
- **Investigation needed**: Check field type assignments vs actual types
- **Impact**: Would bring us to 32/36 (89%)

### 2. DevilParticleSystem.bb - 1 STACK error
**Pattern**: Single unbalanced if statement
- Error: `type mismatch at end of 'if true' branch, expected [] but got [i32]`
- **Root cause**: Single-line if-else with function calls not balancing stack
- **Likely location**: Lines 310, 362, or 402 (single-line if-else patterns)
- **Impact**: Would bring us to 33/36 (92%)

---

## Priority 2: Medium Difficulty (4-6 hours)

### 3. UpdateEvents.bb - 90 errors (83 STACK + 7 TYPE)
**Breakdown**:
- 83 stack balancing errors
- 7 type mismatch errors

**Patterns**:
- `type mismatch at end of 'if true' branch, expected [] but got [i32]`
- `type mismatch at end of 'if true' branch, expected [] but got [i32, i32, i32]`
- Multiple orphaned values on stack

**Strategy**:
1. Fix the 7 TYPE errors first (similar to NPCs.bb)
2. Implement comprehensive stack balancing for complex if statements
3. Test incrementally

**Impact**: Would bring us to 34/36 (94%)

---

## Priority 3: Hard (6-8 hours)

### 4. Save.bb - 136 errors (96 TYPE + 40 STACK)
**Breakdown**:
- 96 type mismatch errors
- 40 stack balancing errors

**Patterns**:
- `local.set, expected [f32] but got [i32]`
- `i32.gt_s, expected [i32, i32] but got [f32, i32]`
- `i32.add, expected [i32, i32] but got [f32, i32]`
- Mixed type operations (float locals used in integer operations)

**Root cause**: Variables declared with wrong types, likely auto-declaration issues  
**Strategy**: Similar to Update.bb - forward type inference should help

**Impact**: Would bring us to 35/36 (97%)

---

## Technical Approaches

### For TYPE Errors

**Common patterns to fix**:
1. Field assignments with wrong types
2. Constants used in wrong context
3. Auto-declared variables with wrong inferred types
4. Mixed float/int operations

**Tools**:
- Type inference system (already implemented)
- Convert() helpers (already implemented)
- Enhanced logging to trace type flow

### For STACK Errors

**Common patterns**:
1. If statements leaving values on stack
2. Function calls returning values not consumed
3. Single-line if-else not balanced
4. Complex expressions in conditionals

**Tools needed**:
- Enhanced calculateStackDelta() for nested structures
- Automatic .drop insertion at block boundaries
- Stack state tracking through control flow

**Reference**: Stack balancing algorithms documented in `stack_balancing_algorithms` memory block

---

## Testing Strategy

### After Each Fix
```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm
swift build
.build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/[FILE].bb -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

### Full Regression Test
```bash
for f in ../scpcb/*.bb; do
  name=$(basename "$f" .bb)
  .build/arm64-apple-macosx/debug/blitz3d-wasm "$f" -o /tmp/test.wasm 2>&1 >/dev/null
  if wasm-validate /tmp/test.wasm 2>&1 >/dev/null; then
    echo "✓ $name"
  else
    echo "✗ $name"
  fi
done | grep -c "✓"
```

---

## Estimated Timeline

| Task | Time | Cumulative | Pass Rate |
|------|------|------------|-----------|
| NPCs.bb | 2h | 2h | 89% |
| DevilParticleSystem.bb | 1h | 3h | 92% |
| UpdateEvents.bb | 4h | 7h | 94% |
| Save.bb | 6h | 13h | 97% |

**Total to 97%**: ~13 hours

---

## Next Session Plan

**Recommended approach**:
1. Start with NPCs.bb (2h) - All TYPE errors, clear pattern
2. Fix DevilParticleSystem.bb (1h) - Single error, quick win
3. **Milestone**: 92% pass rate (33/36 files)
4. Break / Documentation
5. Tackle UpdateEvents.bb TYPE errors (1h)
6. Begin comprehensive stack balancing work (2-3h)

---

## Clean Up TODOs

- [ ] Remove DEBUG logging statements
- [ ] Document type inference system
- [ ] Add unit tests for edge cases
- [ ] Update architecture docs
- [ ] Performance profiling

---

## Success Metrics

- **90% pass rate**: Good progress, most files working
- **95% pass rate**: Excellent, ready for integration testing
- **97% pass rate**: Outstanding, only edge cases remaining
- **100% pass rate**: Perfect compilation, ready for production

**Current**: 86% (31/36)  
**Next milestone**: 92% (33/36) - NPCs + DevilParticleSystem

---

## Resources

- `SESSION_2_SUMMARY.md` - Progress summary
- `UPDATE_BUG_FINAL_ANALYSIS.md` - Debugging methodology
- `DEEP_DEBUG_PLAN.md` - Systematic approach
- `stack_balancing_algorithms` memory block - Technical reference
- `compiler_debugging` memory block - Debugging techniques
