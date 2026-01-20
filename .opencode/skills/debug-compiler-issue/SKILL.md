---
name: debug-compiler-issue
description: Use when WASM compilation fails or produces validation errors - systematically traces root causes using the analyzer tools, identifies the specific code patterns causing issues, and suggests targeted fixes
---

# Debug Compiler Issue

## Overview

When WASM compilation fails or produces validation errors, this skill provides systematic debugging to identify root causes and suggest fixes.

## When to Use

- WASM validation fails after compilation
- Runtime errors when running compiled code
- Type mismatches or stack balance errors
- Unexpected behavior in compiled output
- Need to understand why a specific file won't compile

## Pre-conditions

- Compilation output or WASM file must be available
- Original `.bb` source file should be provided if possible

## Action

1. **Gather Evidence**
   - Run WASM analyzer on the output
   - Extract error messages and validation failures
   - Correlate with source code if available

2. **Categorize Issues**
   - Stack balance: underflow, overflow, excess values
   - Type consistency: mismatches, wrong conversions
   - Control flow: invalid branches, unbalanced blocks
   - Code generation: missing instructions, wrong order

3. **Trace Root Causes**
   - Map WASM errors back to source patterns
   - Identify common problematic patterns
   - Use domain knowledge from stack balancing research

4. **Suggest Fixes**
   - Provide specific, actionable recommendations
   - Reference relevant compiler code locations
   - Generate test cases to verify fixes

## Common Issue Patterns

### Stack Balance Issues

**Excess values at end of if/else:**
```
Error: type mismatch at end of `if true` branch, expected [] but got [i32]

Cause: One branch leaves a value on stack, other doesn't
Fix: Ensure both branches have same stack effect
     Use result = SomeFunction() to capture return value
```

**Stack underflow:**
```
Error: Stack underflow at instruction N

Cause: Operation expects values that aren't on stack
Fix: Check expression generation order
     Verify function call argument pushing
```

**Function ends with values:**
```
Error: Function ends with N values on stack

Cause: Return value not consumed or missing return
Fix: Add proper return statement
     Drop unused return values
```

### Type Issues

**Argument type mismatch:**
```
Error: type mismatch in call, expected [i32, f32] but got [f32, i32]

Cause: Arguments pushed in wrong order or types
Fix: Check expression generation order
     Verify type conversion placement
```

**Literal type issues:**
```
Error: type mismatch, expected f32 but got i32

Cause: Integer literal used where float expected
Fix: Use explicit Float() conversion
     Change literal format (42 vs 42.0)
```

### Control Flow Issues

**Invalid branch depth:**
```
Error: Invalid branch depth: N

Cause: br/br_if targets non-existent block
Fix: Check depth calculation in code generation
     Review block/loop/if nesting
```

## Debugging Workflow

### Step 1: Analyze the WASM
```
Use /analyze-wasm on the failing file
Note: status, issue count, specific errors
```

### Step 2: Identify Pattern
```
Match error to common patterns above
Determine category: stack, type, control flow
```

### Step 3: Trace to Source
```
For stack issues: Check if/else branch balance
For type issues: Check function signatures
For control flow: Check nesting depth
```

### Step 4: Check Compiler Code
```
Stack issues: Sources/Compiler/CodeGen/StatementGeneration.swift
Type issues: Sources/Compiler/CodeGen/ExpressionGeneration.swift  
Control flow: Sources/Compiler/CodeGen/CodeGenerator.swift
```

### Step 5: Suggest Fix
```
Provide specific recommendation
Reference relevant code location
Create test case if helpful
```

## Example Debug Session

**Input:**
- File: UpdateEvents.bb
- Error: "type mismatch at end of `if true` branch, expected [] but got [i32]"
- 90 total errors

**Analysis:**
```
1. /analyze-wasm shows 83 stack issues, 7 type issues
2. Primary pattern: excess values at end of if branches
3. Root cause: Function calls returning i32 not dropped
```

**Fix Suggestion:**
```
In StatementGeneration.swift around line 150:
When generating call statements, ensure return value is dropped
unless it's used in an expression.

Current: generateFunctionCall() returns value but statement
        doesn't consume it

Fix: Add Drop instruction for unused call results
Location: StatementGeneration.swift:generateStatement() - call case
```

## Integration with Other Skills

- **/analyze-wasm**: Get detailed analysis first
- **/generate-fix**: Create targeted test cases
- **/verify-fix**: Confirm the fix works
- **/compare-builds**: Track if fix causes regressions

## Documentation References

- docs/stack-balancing-research.md: Stack algorithm details
- STACK_BALANCING_FINDINGS.md: Known issues and patterns
- COMPILATION_STATUS.md: Current compilation status
- Sources/Compiler/CodeGen/REFACTORING_PLAN.md: Code organization

## Output Format

The debug session returns:
- **issue_summary**: What went wrong
- **root_cause**: Underlying cause analysis  
- **affected_code**: Compiler locations to check
- **suggested_fix**: Specific recommendation
- **test_case**: Optional test to verify fix
- **related_issues**: Links to known issues if applicable
