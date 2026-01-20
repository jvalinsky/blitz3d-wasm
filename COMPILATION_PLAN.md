# SCP:CB WASM Compilation - Detailed Plan

## Current Status (2026-01-19)
- **Total files:** 33
- **Passing:** 13 (39%)
- **Failing:** 20 (61%)
  - Compile errors: 1 (Map Creator - separate tool, not game code)
  - Validation errors: 19

## Root Cause Analysis

### 1. Stack Balancing Issues (PRIORITY: HIGH)
**Symptom:**
```
type mismatch at end of `if true` branch, expected [] but got [i32]
type mismatch at end of `if false` branch, expected [] but got [i32, i32]
type mismatch at end of loop, expected [] but got [i32, i32, i32]
```

**Root Cause:**
WASM requires that all branches of a control flow structure leave the stack in the same state. The compiler generates code that:
1. Leaves return values from function calls on the stack
2. Has different stack heights in if/else branches
3. Doesn't properly clean up intermediate values

**Affected Files:** Main.bb, Menu.bb, NPCs.bb, Items.bb, Achievements.bb

**Solution:**
Implement stack height tracking and automatic `.drop` insertion:
```swift
// In StatementGeneration.swift
func generateStatementBlock(_ stmts: [StatementNode], function: inout WASMFunction) -> [WASMInstruction] {
    var stackHeight = 0
    var result: [WASMInstruction] = []
    
    for stmt in stmts {
        let instrs = generateStatement(stmt, function: &function)
        let delta = calculateStackDelta(instrs)
        
        // If this is the last statement and function returns a value, don't drop
        if stackHeight > 0 && !isReturnValueFromLastStatement(stmt) {
            // Pad stack to match
            for _ in 0..<stackHeight {
                result.append(.drop)
            }
        }
        result.append(contentsOf: instrs)
        stackHeight = delta
    }
    return result
}
```

### 2. Type Promotion Issues (PRIORITY: HIGH)
**Symptom:**
```
type mismatch in i32.add, expected [i32, i32] but got [f32, i32]
type mismatch in f32.add, expected [f32, f32] but got [i32, f32]
type mismatch in global.set, expected [f32] but got [i32]
```

**Root Cause:**
The compiler doesn't properly promote types when:
1. Mixing integer and float literals in expressions
2. Assigning between integer and float variables
3. Passing arguments to functions with wrong expected types

**Solution:**
Enhance `commonType` and add type conversion instructions:
```swift
// In ExpressionGeneration.swift
func convertType(_ value: WASMType, to target: WASMType, _ instrs: inout [WASMInstruction]) {
    if value == target { return }
    
    switch (value, target) {
    case (.i32, .f32):
        instrs.append(.f32ConvertI32S)
    case (.f32, .i32):
        instrs.append(.i32TruncF32S)
    default:
        // Handle other conversions
    }
}

// When generating function call arguments:
for (i, arg) in call.arguments.enumerated() {
    let argResult = generateWithInfo(arg)
    instrs.append(contentsOf: argResult.instrs)
    
    if let def = def, i < def.params.count {
        convertType(argResult.type, to: def.params[i], &instrs)
    }
}
```

### 3. Function Call Return Values Not Dropped (PRIORITY: MEDIUM)
**Symptom:**
```
type mismatch at end of `if true` branch, expected [] but got [i32]
```

**Root Cause:**
When a function call with a return value is used as a statement (not capturing the result), the return value is left on the stack.

**Solution:**
In `StatementGeneration.swift`, when generating function call statements, check if the function returns a value and drop it:
```swift
case .functionCall(let call):
    if let funcIdx = context.functionIndexMap[lowerName] {
        function.body.append(contentsOf: argInstrs)
        function.body.append(.call(funcIdx))
        
        // Drop return value if function returns one and we're not using it
        if let def = context.functionDefinitions[lowerName], !def.results.isEmpty {
            function.body.append(.drop)
        }
    }
```

### 4. Missing Builtin Functions (PRIORITY: MEDIUM)
**Symptom:**
```
Function not found in map. Defaulting to 0.
```

**Currently Added:**
- OpenAL functions (alInit, alSourcePlay, etc.)

**Still Potentially Missing:**
Check `CodeGenerator.swift` for any functions used in scpcb but not defined.

## Implementation Plan

### Phase 1: Stack Balancing Fix (2-3 hours)
1. Add `calculateStackDelta` function to track stack effects
2. Modify `generateStatementBlock` to pad stack differences
3. Special handling for If/While/For statements
4. Test with single file (Items.bb) to verify fix

### Phase 2: Type Promotion Fix (2-3 hours)
1. Enhance `convertType` function for all WASMType conversions
2. Fix function argument type conversion order
3. Fix literal type inference based on context
4. Test with expression-heavy files (Difficulty.bb, Menu.bb)

### Phase 3: Function Call Cleanup (1 hour)
1. Ensure all void function calls don't push values
2. Ensure non-void function calls used as statements drop return values
3. Test with sound-heavy files (LoadAllSounds.bb, FMod.bb)

### Phase 4: Integration Testing (1 hour)
1. Run full test suite
2. Identify remaining failures
3. Fix individually

## Files to Modify

| File | Changes |
|------|---------|
| `Sources/Compiler/CodeGen/StatementGeneration.swift` | Stack balancing, function call drop |
| `Sources/Compiler/CodeGen/ExpressionGeneration.swift` | Type promotion, argument conversion |
| `Sources/Compiler/CodeGen/TypeHandling.swift` | Additional type conversions |
| `COMPILATION_STATUS.md` | Update with progress |

## Testing Strategy

1. **Start with simple files:** Difficulty.bb, KeyName.bb (already passing)
2. **Move to medium complexity:** Items.bb, NPCs.bb
3. **Final validation:** Main.bb (most complex)

## Expected Results

After Phase 1-3:
- **Passing files:** 25+ (75%+)
- **Remaining failures:** Complex edge cases in Main.bb

## Commands for Testing

```bash
# Test single file
cd /Users/jack/Software/scp_port/scpcb
/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm Items.bb -o /tmp/Items.wasm
/opt/homebrew/bin/wasm-validate /tmp/Items.wasm

# Run full test suite
cd /Users/jack/Software/scp_port/blitz3d-wasm
./test_compile_scpcb.sh

# Generate WAT for debugging
cd /Users/jack/Software/scp_port/scpcb
/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm Main.bb --wat -o /tmp/Main.wat
```

## Notes

- The Map Creator folder (`Map Creator/mapcreator_new.bb`) is a separate tool, not game code - it can be excluded from tests
- All _Strict functions are defined in `StrictLoads.bb` and included by Main.bb
- The 13 passing files are good baseline tests
- All 207 unit tests continue to pass during development
