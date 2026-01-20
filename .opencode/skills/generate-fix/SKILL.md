---
name: generate-fix
description: Use when a compiler issue is identified and needs a test case or fix - generates minimal test cases to reproduce issues, provides code modifications to try, and creates verification tests for proposed solutions
---

# Generate Fix for Compiler Issue

## Overview

When a compiler issue is identified, this skill generates targeted test cases and fix suggestions to verify and resolve the problem.

## When to Use

- After /debug-compiler-issue identifies root cause
- Need a minimal test case to reproduce the issue
- Want to test a proposed fix before applying it
- Need verification test for a fix

## Pre-conditions

- Issue description or error message must be available
- Optional: Reference to original source file
- Optional: Compiler code location for fix suggestion

## Action

1. **Generate Reproduction Test**
   - Create minimal BB code that triggers the issue
   - Include only necessary context
   - Make it easy to understand and modify

2. **Generate Fix Suggestion**
   - Propose specific code changes
   - Reference relevant compiler source files
   - Explain the reasoning

3. **Generate Verification Test**
   - Test that verifies the fix works
   - Can be used as regression test
   - Includes both positive and negative cases

## Test Types

### Reproduction Test

Minimal code that triggers the issue:
```blitz3d
' Test: if/else branch stack mismatch
Function TestFunc()
    If True Then
        result = SomeFunction()  ' Returns i32, not used
    Else
        result = 0
    End If
    Return result
End Function
```

### Fix Verification Test

Tests the fix works:
```blitz3d
' Test: Verify fix for stack mismatch
Function TestFix()
    Local x = 0
    If True Then
        x = SomeFunction()  ' Now properly captured
    Else
        x = 0
    End If
    Assert x = 42
End Function
```

### Regression Test

Ensures fix doesn't break other cases:
```blitz3d
' Test: No regression in stack handling
Function TestNoRegression()
    ' Test various patterns
    Local a = Func1()
    Local b = Func2()
    
    If True Then
        Local c = Func3()
    End If
    
    Return a + b
End Function
```

## Fix Categories

### Stack Balance Fixes

**Problem:** Excess values at if/else end
```
Fix: Capture or drop return values
Code: Local result = SomeFunction() instead of SomeFunction()
```

**Problem:** Stack underflow
```
Fix: Ensure operands pushed before operation
Code: Check expression generation order
```

### Type Fixes

**Problem:** Argument type mismatch
```
Fix: Reorder or convert arguments
Code: Float(x) before passing to float parameter
```

**Problem:** Literal type wrong
```
Fix: Use correct literal format
Code: 42.0 instead of 42 for float
```

### Control Flow Fixes

**Problem:** Invalid branch depth
```
Fix: Correct depth calculation
Code: Check block/loop nesting in code gen
```

## Output Format

Each generated fix returns:
- **test_case**: The reproduction test file
- **verification**: The verification test file  
- **fix_description**: What the fix does
- **code_change**: Specific code modification
- **location**: Where to apply in compiler
- **expected_result**: What should happen after fix

## Example

**Issue:** "type mismatch at end of if branch"

**Generated Test:**
```blitz3d
' test_if_stack_mismatch.bb
Function Test()
    If True Then
        x = SomeFunc()  ' Returns i32, not used
    Else
        x = 0
    End If
End Function
```

**Generated Fix:**
```
In StatementGeneration.swift around line 150:

Before: generateStatement() for CallExpr doesn't drop result
After:  Add Drop instruction for unused call results

Code change:
case .call(let expr):
    let result = generateFunctionCall(expr)
    if !isUsedInExpression {
        instructions.append(.drop)  // NEW LINE
    }
```

## Integration

- **/debug-compiler-issue**: Get issue analysis first
- **/analyze-wasm**: Verify test compiles correctly
- **/verify-fix**: Run the verification test
- **/compare-builds**: Ensure no regressions

## Generated Test Location

Tests are saved to: `Tests/Generated/test_*.bb`

Run generated tests:
```bash
swift run blitz3d-wasm Tests/Generated/test_name.bb -o /tmp/test.wasm
node Tools/analyzer/cli.js /tmp/test.wasm
```
