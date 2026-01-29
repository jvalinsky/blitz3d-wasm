# Fix Plan Decision Tree

```
START: 49/52 files passing (94.2%)
│
├─ Question: What's your priority?
│  │
│  ├─ "Get 100% compilation ASAP" (6-8 hours)
│  │  → PRAGMATIC APPROACH
│  │     ├─ Phase 1: Source workarounds (30 min) → 98%
│  │     ├─ Phase 3: Fix variable counting (4-6 hrs) → 100%
│  │     └─ Result: ✅ 52/52 files, minor source changes
│  │
│  ├─ "Minimize compiler changes" (8-10 hours)
│  │  → CONSERVATIVE APPROACH
│  │     ├─ Phase 1: Source workarounds (2 hrs)
│  │     ├─ Phase 3: Fix variable counting (4-6 hrs)
│  │     └─ Result: ✅ 52/52 files, documented limitations
│  │
│  └─ "Perfect solution, no compromises" (10-15 hours)
│     → AGGRESSIVE APPROACH
│        ├─ Phase 2: Add whitespace tracking (3-4 hrs)
│        ├─ Phase 3: Fix variable counting (4-6 hrs)
│        ├─ Phase 4: Full validation (2 hrs)
│        └─ Result: ✅ 52/52 files, zero workarounds
│
└─ RECOMMENDATION: PRAGMATIC
   - Fastest path to 100%
   - Low risk
   - Can improve later
```

## Quick Decision Guide

### Choose PRAGMATIC if:
- ✅ You need results fast
- ✅ Minor source changes are acceptable
- ✅ You can refine later
- ✅ You want lowest risk

### Choose CONSERVATIVE if:
- ✅ You want to minimize all changes
- ✅ Documentation is acceptable
- ✅ Source changes are OK
- ✅ Parser fix can wait

### Choose AGGRESSIVE if:
- ✅ You want production-perfect code
- ✅ You have time for thorough work
- ✅ No source changes allowed
- ✅ Long-term maintainability priority

## Implementation Order

### PRAGMATIC Path (Recommended)
```
Day 1 Morning:
  ├─ 1. Apply window3d.bb workaround (30 min)
  └─ 2. Test: window3d compiles ✓

Day 1 Afternoon - Day 2:
  ├─ 3. Investigate variable counting bug (2 hrs)
  ├─ 4. Implement fix in CodeGenerator (2-3 hrs)
  └─ 5. Test: mapcreator_new validates ✓

Day 2 Evening:
  ├─ 6. Run full test suite (30 min)
  ├─ 7. Verify 52/52 pass ✓
  └─ 8. Commit and document (1 hr)

DONE: 100% compilation achieved ✅
```

### AGGRESSIVE Path (Complete)
```
Day 1:
  ├─ 1. Add Token.hasLeadingWhitespace (1 hr)
  ├─ 2. Update Lexer whitespace tracking (2 hrs)
  └─ 3. Test: Lexer changes don't break anything ✓

Day 2:
  ├─ 4. Update Parser to use whitespace (2 hrs)
  ├─ 5. Test all parser cases (1 hr)
  └─ 6. Verify window3d + MusicPlayer compile ✓

Day 3:
  ├─ 7. Fix variable counting (4-6 hrs)
  ├─ 8. Test mapcreator_new ✓
  └─ 9. Full validation (2 hrs)

DONE: Perfect solution ✅
```

## Risk Assessment by Approach

### PRAGMATIC
```
Risk Level: 🟢 LOW
├─ Source changes: Isolated to 1 file, 18 lines
├─ Compiler changes: Well-understood (variable counting)
└─ Testing burden: Medium (need full regression)
```

### CONSERVATIVE
```
Risk Level: 🟢 VERY LOW
├─ Source changes: Minimal
├─ Compiler changes: Single-purpose fix
└─ Testing burden: Low (fewer moving parts)
```

### AGGRESSIVE
```
Risk Level: 🟡 MEDIUM
├─ Source changes: None
├─ Compiler changes: Lexer + Parser + CodeGen (ripple effects)
└─ Testing burden: High (extensive regression needed)
```

## Success Probability

| Approach | Phase 1 | Phase 3 | Overall |
|----------|---------|---------|---------|
| Pragmatic | 95% | 90% | 85%+ |
| Conservative | 99% | 90% | 90%+ |
| Aggressive | 85% | 90% | 75%+ |

## Rollback Plan

If things go wrong:
```
├─ Pragmatic: Revert source changes (5 min)
├─ Conservative: Revert source changes (5 min)
└─ Aggressive: Revert git commits (10 min)
```

All approaches have easy rollback!

## When to Choose What

```
Current Situation              → Recommended Approach
─────────────────────────────────────────────────────
Production deadline tomorrow   → PRAGMATIC
Open source project            → AGGRESSIVE
Internal tool                  → CONSERVATIVE
Learning exercise              → AGGRESSIVE
Time-critical bug fix          → PRAGMATIC
Long-term maintenance project  → AGGRESSIVE
```

## Bottom Line

**Default Choice**: PRAGMATIC
- 6-8 hours to 100%
- Low risk
- Can always improve later with Phase 2

**When to override**: Only if zero source changes is a hard requirement (→ AGGRESSIVE)
