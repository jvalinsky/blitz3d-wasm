---
name: analyze-wasm
description: Use after compiling BB code to WASM - analyzes the output and returns structured insights optimized for AI consumption including status, prioritized issues, function breakdown, and optimization suggestions
---

# Analyze WASM Compilation for LLM

## Overview

This skill analyzes compiled WASM modules and provides structured output
optimized for AI reasoning. It identifies compilation issues, prioritizes them
by severity, and suggests fixes.

## When to Use

- After compiling any `.bb` file:
  `swift run blitz3d-wasm input.bb -o output.wasm`
- When debugging compilation failures or validation errors
- When you need to understand what's happening in compiled code
- Before and after making compiler changes to compare results
- When the LLM needs actionable insights about compilation health

## Pre-conditions

- WASM file must exist at the provided path
- Optional: Original `.bb` source file for additional context

## Action

1. Run the LLM-optimized WASM analyzer on the file
2. Extract structured insights about compilation health
3. Prioritize issues by severity (critical → high → medium)
4. Provide actionable suggestions for each issue
5. Return function-level breakdown for targeted debugging

## Output Structure

The analyzer returns a JSON object with four main sections:

**Summary:**

- `status`: "healthy" or "issues (N checks failed)"
- `functions`: Total function count
- `instructions`: Total instruction count
- `stackValid`, `typeValid`, `controlFlowValid`: Individual check results
- `issueCount`, `warningsCount`: Problem counts

**Issues (prioritized):**

- `totalIssues`, `critical`, `high`, `medium`: Counts by severity
- `issues`: Array with severity, category, message, and suggestion for each

**Functions:**

- `total`, `passing`, `failing`: Function-level statistics
- `functions`: Per-function data with status, maxStack, errorCount

**Optimization:**

- `insights`: Array of potential improvement areas
- `topInstructions`: Most frequently used instructions
- `averageFunctionSize`, `largestFunction`: Code size metrics

## Severity Levels

| Level    | Meaning              | Action Required    |
| -------- | -------------------- | ------------------ |
| critical | Blocks compilation   | Fix immediately    |
| high     | Likely runtime error | Fix before release |
| medium   | Could cause issues   | Review and address |
| warning  | Non-critical         | Consider fixing    |

## Categories

- `stack_balance`: Stack underflow/overflow, excess values at end of blocks
- `control_flow`: Invalid branch depths, unbalanced blocks
- `type_consistency`: Type mismatches in calls, wrong conversions
- `warning`: Unused locals, suboptimal patterns

## Interpretation Guide

**Status = healthy:** All validation checks pass. Review optimization insights
for potential improvements.

**Status = issues (N checks failed):** Compilation has problems. Use the issues
array to address them in priority order.

**For stack balance issues:** Common causes are if/else branches leaving
different values on stack, or function calls returning values that aren't
dropped. Check the suggestion field for specific guidance.

**For control flow issues:** Usually means branch depths are incorrect or block
structure is invalid. Review nested if/loop structures.

**For type issues:** Check function signature matches and literal type
conversions.

## Example Output

```json
{
  "summary": {
    "status": "issues (1 checks failed)",
    "functions": 4,
    "instructions": 66,
    "stackValid": true,
    "typeValid": false,
    "controlFlowValid": true,
    "issueCount": 2,
    "warningsCount": 0
  },
  "issues": {
    "totalIssues": 2,
    "critical": 0,
    "high": 2,
    "medium": 0,
    "issues": [
      {
        "severity": "high",
        "category": "type_consistency",
        "message": "type mismatch in call...",
        "suggestion": "Check function call argument ordering..."
      }
    ]
  },
  "functions": {
    "total": 4,
    "passing": 3,
    "failing": 1,
    "functions": [...]
  },
  "optimization": {...}
}
```

## Common Issues and Fixes

**Type mismatch at end of if branch:** Cause: Function call return values not
being dropped Fix: Use result or explicitly drop: `result = SomeFunction()` or
`Drop(SomeFunction())`

**Stack underflow:** Cause: Required arguments not pushed before operation Fix:
Ensure expression generates correct stack state

**Invalid branch depth:** Cause: Branch targets non-existent control frame Fix:
Check depth calculation in br/br_if instructions

## Next Steps

1. **Critical issues present**: Focus on stack balance first (often resolves
   other issues)
2. **Type issues only**: Check function signatures and literal types
3. **All passing**: Review optimization insights for improvements
4. **Always**: Use the suggestion field as starting point for fixes

## Integration

Use with other skills:

- `/debug-issue`: For detailed root cause analysis
- `/generate-fix`: To create targeted test cases
- `/compare-builds`: To track compiler changes over time
