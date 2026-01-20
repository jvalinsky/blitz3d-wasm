---
name: compare-builds
description: Use before and after making compiler changes to compare WASM outputs - analyzes differences in instruction counts, stack usage, error patterns, and validates that fixes don't introduce regressions
---

# Compare WASM Builds

## Overview

Compare two WASM compilation outputs to understand the impact of compiler changes, validate fixes, and detect regressions.

## When to Use

- Before and after fixing a compiler issue
- After modifying code generation logic
- To validate that a change improves output
- To detect unintended side effects
- During code review to understand changes

## Pre-conditions

Two WASM files to compare:
- `before.wasm`: Original/broken version
- `after.wasm`: Modified/fixed version

Optional: The BB source files for additional context

## Action

1. **Analyze Both Files**
   - Run /analyze-wasm on each
   - Extract metrics and issues

2. **Calculate Differences**
   - Instruction count delta
   - Function size changes
   - Stack usage changes
   - Error count changes

3. **Assess Impact**
   - Positive: Improvements in metrics
   - Negative: Regressions introduced
   - Neutral: No significant change

4. **Validate Fix**
   - Check errors decreased
   - Verify stack balance improved
   - Ensure no new issues

## Comparison Metrics

### Size Metrics
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Total instructions | N | N | ±N |
| Average function size | N | N | ±N |
| Largest function | N | N | ±N |

### Stack Metrics
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Max stack depth | N | N | ±N |
| Functions with issues | N | N | ±N |
| Stack errors | N | N | ±N |

### Quality Metrics
| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Type errors | N | N | ±N |
| Control flow errors | N | N | ±N |
| Warnings | N | N | ±N |

## Interpretation Guide

### Positive Changes (Good)
- Errors decreased
- Stack usage reduced
- Function sizes more uniform
- Instruction count stable or reduced

### Negative Changes (Warning)
- Errors increased
- Stack usage grew
- Function sizes became more variable
- Instruction count grew significantly

### Neutral Changes
- No significant metric changes
- May indicate no impact or balanced changes

## Example Comparison

**Before fix:**
```
summary: { totalFunctions: 4, totalInstructions: 66, stackValid: true, typeValid: false }
stackBalance: { valid: false, errors: [...] }
metrics: { maxStackObserved: 1 }
```

**After fix:**
```
summary: { totalFunctions: 4, totalInstructions: 62, stackValid: true, typeValid: true }
stackBalance: { valid: true, errors: [] }
metrics: { maxStackObserved: 0 }
```

**Comparison:**
```
✓ Type errors: 2 → 0 (FIXED)
✓ Instructions: 66 → 62 (-4% improvement)
✓ Stack issues: resolved
✓ No new issues introduced
VERDICT: Fix successful
```

## Output Format

The comparison returns:
- **summary**: Side-by-side metric comparison
- **changes**: Detailed delta analysis
- **improvements**: List of fixes that worked
- **regressions**: List of new issues
- **verdict**: Overall assessment (success/failure/mixed)
- **recommendation**: Next steps

## Verdict Categories

| Verdict | Meaning |
|---------|---------|
| **success** | All metrics improved or stable, no regressions |
| **partial** | Some improvements, some regressions |
| **failure** | More regressions than improvements |
| **no_change** | No significant difference |

## Common Comparison Scenarios

### Validating a Fix
1. Compile before fix → save as before.wasm
2. Apply fix
3. Compile after fix → save as after.wasm
4. Run /compare-builds
5. Verify "success" verdict

### Checking for Regressions
1. Before modifying compiler, save current output
2. Make changes
3. Compare old vs new
4. If "failure" or "partial", review regressions

### Optimizing Code Generation
1. Run baseline compilation
2. Apply optimization
3. Compare to verify:
   - No new errors
   - Instruction count stable or reduced
   - Stack usage not increased

## Command Usage

```
/compare-builds before.wasm after.wasm
/compare-builds before.wasm after.wasm --verbose
/compare-builds before.wasm after.wasm --source original.bb
```

## Integration

- **/analyze-wasm**: Individual file analysis
- **/debug-compiler-issue**: Debug before comparing
- **/generate-fix**: Create fix, then compare to validate
- **/verify-fix**: Alternative verification method

## Tips

- Use --verbose for detailed diff
- Compare same source file with different compiler versions
- Save before/after files with timestamps
- Include in PR description for reviewers
