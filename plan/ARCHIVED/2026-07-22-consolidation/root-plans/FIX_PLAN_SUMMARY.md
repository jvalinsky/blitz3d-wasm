# Fix Plan Summary - Quick Reference

**Full Plan**: See `REMAINING_ISSUES_FIX_PLAN.md` for complete details

---

## Current Status

- **49/52 files passing** (94.2%)
- **3 files failing**: MusicPlayer.bb, window3d.bb, mapcreator_new.bb
- **All core gameplay files work**: Main.bb, NPCs.bb, Items.bb, Menu.bb ✅

---

## Two Main Issues

### 1. Parser: Complex Expression Patterns

**Files**: MusicPlayer.bb, window3d.bb **Problem**: Can't distinguish
`Func(x,y)` from `Func (x),y` **Fix Options**:

- **A. Whitespace Tracking** (3-4 hrs) - Permanent solution
- **B. Source Workaround** (30 min) - Quick fix

### 2. Local Variable Overflow

**Files**: mapcreator_new.bb **Problem**: Declares 2 locals but accesses index
21 **Fix**: Fix variable counting in CodeGenerator.swift (4-6 hrs)

---

## Three Approaches

### 🟢 PRAGMATIC (Recommended)

**Time**: 6-8 hours | **Risk**: Low | **Result**: 100% compilation

1. Apply source workarounds → window3d.bb works
2. Fix variable counting → mapcreator.bb works
3. **Result**: 52/52 files pass quickly

### 🟡 CONSERVATIVE

**Time**: 8-10 hours | **Risk**: Very Low

1. Source workarounds only
2. Fix variable counting
3. Document parser limitation
4. **Result**: 100% with minor source changes

### 🔴 AGGRESSIVE

**Time**: 10-15 hours | **Risk**: Medium

1. Fix parser with whitespace
2. Fix variable counting
3. Full validation
4. **Result**: 100%, zero workarounds

---

## Implementation Phases

### Phase 1: Quick Wins (2-3 hrs) → 98% Success

- Modify window3d.bb: extract complex expressions
- Test and validate

### Phase 2: Parser Fix (3-4 hrs) → Permanent Solution

- Add whitespace tracking to Lexer
- Update Parser to use whitespace
- Remove workarounds

### Phase 3: Variable Counting (4-6 hrs) → 100% Success

- Audit CodeGenerator variable tracking
- Fix local count in function headers
- Test mapcreator_new.bb

### Phase 4: Final Validation (1-2 hrs)

- Run full test suite
- Verify 52/52 pass
- Document results

---

## Quick Start Guide

### Option A: Get 100% Fast (Pragmatic)

```bash
# 1. Fix window3d.bb (30 min)
# Edit line 1753, use temp variables:
# Before: Text (x+width/2)*ResFactor, ...
# After:  Local tx=(x+width/2)*ResFactor; Text tx, ...

# 2. Fix variable counting (4-6 hrs)
# - Find: Sources/Compiler/CodeGen/CodeGenerator.swift
# - Fix: localIndices counting logic
# - Test: mapcreator_new.bb validates

# 3. Validate
./test_scpcb_compilation.sh  # Should show 52/52
```

### Option B: Complete Fix (Aggressive)

```bash
# 1. Add whitespace to Token struct
# 2. Track whitespace in Lexer
# 3. Use whitespace in Parser
# 4. Fix variable counting
# 5. Full testing
```

---

## Success Metrics

| Phase   | Files Passing | Status      |
| ------- | ------------- | ----------- |
| Current | 49/52 (94.2%) | ✅ Done     |
| Phase 1 | 51/52 (98.0%) | 🎯 Target   |
| Phase 3 | 52/52 (100%)  | 🏆 Complete |

---

## Files to Modify

### Parser Fix

- `Sources/Compiler/Lexer/Lexer.swift` - Add whitespace tracking
- `Sources/Compiler/Parser/Parser.swift` - Use whitespace for disambiguation
- OR `../scpcb/Map Creator/window3d.bb` - Source workaround

### Variable Counting Fix

- `Sources/Compiler/CodeGen/CodeGenerator.swift` - Fix local counting

---

## Testing Commands

```bash
# Test parser fixes
.build/debug/blitz3d-wasm "../scpcb/MusicPlayer.bb" -o /tmp/m.wasm
.build/debug/blitz3d-wasm "../scpcb/Map Creator/window3d.bb" -o /tmp/w.wasm

# Test variable counting
.build/debug/blitz3d-wasm "../scpcb/Map Creator/mapcreator_new.bb" -o /tmp/mc.wasm
wasm-validate /tmp/mc.wasm

# Full validation
./test_scpcb_compilation.sh
```

---

## Decision Matrix

| Criteria | Pragmatic        | Conservative    | Aggressive    |
| -------- | ---------------- | --------------- | ------------- |
| Time     | ⭐⭐⭐ (Fast)    | ⭐⭐ (Medium)   | ⭐ (Slow)     |
| Risk     | ⭐⭐⭐ (Low)     | ⭐⭐⭐ (Lowest) | ⭐⭐ (Medium) |
| Quality  | ⭐⭐ (Good)      | ⭐⭐ (Good)     | ⭐⭐⭐ (Best) |
| Result   | 100% compilation | 100% w/ changes | 100% perfect  |

**Recommendation**: **Pragmatic** - Best balance of speed, quality, and risk

---

## Next Action

1. ✅ Review this plan
2. ⏭️ Choose approach (Pragmatic recommended)
3. ⏭️ Start Phase 1 (source workarounds)
4. ⏭️ Continue to Phase 3 (variable counting)
5. ⏭️ Validate and commit

---

**Full Details**: `REMAINING_ISSUES_FIX_PLAN.md` (4000+ words) **Status**: Ready
to Execute **Estimated Completion**: 1-3 days depending on approach
