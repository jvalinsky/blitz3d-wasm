# Stack Validator Integration Guide

## Phase 2: Integration (2-3 hours)

### Step 1: Add StackValidator to StatementGeneration

**File**: `Sources/Compiler/CodeGen/StatementGeneration.swift`

**Add property** (around line 28):
```swift
// Stack validation
private var stackValidator: StackValidator?
private var enableStackValidation: Bool = true  // Toggle for debugging
```

**Modify init** (around line 34):
```swift
public init(context: ModuleContext) {
    self.context = context
    self.stackValidator = StackValidator()
}
```

**Add validation method** (add new method):
```swift
/// Validate a sequence of instructions for stack balance
private func validateInstructions(_ instructions: [WASMInstruction]) -> [WASMInstruction] {
    guard enableStackValidation, let validator = stackValidator else {
        return instructions
    }
    
    // Validate each instruction
    for instr in instructions {
        validator.validateInstruction(instr)
    }
    
    // Check for errors
    if !validator.errors.isEmpty {
        print("DEBUG_STACK: Validation errors:")
        for error in validator.errors {
            print("  - \(error)")
        }
    }
    
    // If stack has excess values, insert drops
    var balanced = instructions
    let excessDepth = validator.stackDepth
    if excessDepth > 0 {
        print("DEBUG_STACK: Inserting \(excessDepth) drop(s) to balance stack")
        for _ in 0..<excessDepth {
            balanced.append(.drop)
        }
    }
    
    return balanced
}
```

### Step 2: Integrate into Control Flow

**Modify buildIfChain** (around line 280):

FIND:
```swift
// Balance if/else branches to have same stack effect
let (balancedThen, balancedElse) = balanceIfBranches(then: thenBody, else: elseBody)
```

REPLACE WITH:
```swift
// Validate and balance if/else branches
var balancedThen = thenBody
var balancedElse = elseBody

if let validator = stackValidator {
    // Create temporary validator for then branch
    let thenValidator = StackValidator()
    for instr in thenBody {
        thenValidator.validateInstruction(instr)
    }
    let thenDepth = thenValidator.stackDepth
    
    // Create temporary validator for else branch  
    var elseDepth = 0
    if let elseBody = elseBody {
        let elseValidator = StackValidator()
        for instr in elseBody {
            elseValidator.validateInstruction(instr)
        }
        elseDepth = elseValidator.stackDepth
    }
    
    // Balance to same depth
    if thenDepth > elseDepth {
        for _ in 0..<(thenDepth - elseDepth) {
            balancedThen.append(.drop)
        }
    } else if elseDepth > thenDepth {
        for _ in 0..<(elseDepth - thenDepth) {
            balancedElse!.append(.drop)
        }
    }
}
```

**Modify whileLoop** (around line 322):

AFTER:
```swift
var bodyInstrs = generateStatementBlock(whileNode.body, function: &function)
```

ADD:
```swift
// Validate and balance loop body
bodyInstrs = validateInstructions(bodyInstrs)
```

**Modify forLoop** (around line 430):

AFTER:
```swift
bodyInstrs = generateStatementBlock(forNode.body, function: &function)
```

ADD:
```swift
// Validate and balance loop body
bodyInstrs = validateInstructions(bodyInstrs)
```

**Modify repeatLoop** (around line 480):

AFTER:
```swift
var bodyInstrs = generateStatementBlock(repeatNode.body, function: &function)
```

ADD:
```swift
// Validate and balance loop body
bodyInstrs = validateInstructions(bodyInstrs)
```

### Step 3: Add Reset Between Functions

**File**: `Sources/Compiler/Compiler.swift`

FIND where you compile each function (search for "generateFunction"):

ADD BEFORE compiling function body:
```swift
// Reset stack validator for new function
if let stmtGen = statementGeneration {
    stmtGen.resetStackValidator()
}
```

**Add method to StatementGeneration**:
```swift
public func resetStackValidator() {
    stackValidator?.reset()
}
```

### Step 4: Enable Debug Logging

**Add to StatementGeneration**:
```swift
/// Get stack validation report
public func getStackValidationReport() -> [String] {
    return stackValidator?.errors ?? []
}

/// Check if stack validation passed
public func isStackValid() -> Bool {
    return stackValidator?.isValid ?? true
}
```

---

## Phase 3: Testing (1-2 hours)

### Test Case 1: Simple If Balance

**Create**: `blitz3d-wasm/test_stack_if.bb`
```blitz3d
Function Test()
    Local x
    If x Then
        Print("yes")
    EndIf
End Function
```

**Compile**:
```bash
.build/arm64-apple-macosx/debug/blitz3d-wasm test_stack_if.bb -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
```

**Expected**: No validation errors

### Test Case 2: If With Return Value

**Create**: `test_stack_if_return.bb`
```blitz3d
Function GetValue()
    Return 42
End Function

Function Test()
    Local x
    If x Then
        GetValue()  ; Returns value, needs drop
    EndIf
End Function
```

**Expected**: Auto-insert `.drop` after `GetValue()` call

### Test Case 3: Loop Balance

**Create**: `test_stack_loop.bb`
```blitz3d
Function Test()
    For i = 1 To 10
        Print(i)
    Next
End Function
```

**Expected**: Loop body balanced

### Test Case 4: Nested Control

**Create**: `test_stack_nested.bb`
```blitz3d
Function Test()
    Local x, y
    If x Then
        While y
            Print("loop")
        Wend
    EndIf
End Function
```

**Expected**: Both if and while balanced

---

## Phase 4: Validation (1 hour)

### Run Full Test Suite

```bash
cd blitz3d-wasm
./test_scpcb_compilation.sh
```

**Track improvements**:
- Before: 40 passed (76.9%)
- Target: 45+ passed (86%+)

### Specific Files to Test

1. **UpdateEvents.bb** - Had most if/else errors
2. **Save.bb** - Complex control flow
3. **Update.bb** - Many nested blocks
4. **DevilParticleSystem.bb** - Loops and conditions
5. **Menu.bb** - State machine with many branches

---

## Phase 5: Refinement (2-3 hours)

### Issue 1: Function Calls

If function calls aren't tracked correctly:

**Fix in StackValidator**:
```swift
case .call(let funcIdx):
    // Get function signature from context
    if let sig = context.functionSignatures[funcIdx] {
        // Pop parameters
        for paramType in sig.params.reversed() {
            popVal(expect: paramType)
        }
        // Push results
        for resultType in sig.results {
            pushVal(resultType)
        }
    }
```

**Add context to StackValidator init**:
```swift
class StackValidator {
    private weak var context: ModuleContext?
    
    init(context: ModuleContext? = nil) {
        self.context = context
    }
}
```

### Issue 2: Type Context

If types aren't tracked correctly:

**Pass type info to validator**:
```swift
func pushVal(_ type: StackValueType, fromWASMType wasmType: WASMType) {
    let stackType: StackValueType
    switch wasmType {
    case .i32: stackType = .i32
    case .i64: stackType = .i64
    case .f32: stackType = .f32
    case .f64: stackType = .f64
    default: stackType = .i32
    }
    vals.append(stackType)
}
```

### Issue 3: Performance

If compilation slows down significantly:

**Add caching**:
```swift
private var validationCache: [String: Bool] = [:]

func validateInstructions(_ instructions: [WASMInstruction]) -> [WASMInstruction] {
    let key = instructions.map { "\($0)" }.joined()
    if let cached = validationCache[key] {
        return instructions
    }
    
    // ... validation logic ...
    
    validationCache[key] = true
    return balanced
}
```

---

## Expected Results

### Before Integration:
- 40/52 files pass (76.9%)
- 7 validation errors
- ~90 stack balance errors in failing files

### After Integration:
- **Target**: 45+/52 files pass (86%+)
- **Target**: 2-3 validation errors (complex edge cases)
- **Target**: ~30 stack balance errors (significant reduction)

### Files Expected to Fix:
1. ✅ UpdateEvents.bb (most if/else errors)
2. ✅ Save.bb (control flow)
3. ✅ Update.bb (nested blocks)
4. ⚠️ DevilParticleSystem.bb (may need custom handling)
5. ⚠️ Menu.bb (state machine - complex)

### Files Still Failing (Acceptable):
- Main.bb (Swift compiler crash - architectural issue)
- MapSystem.bb (too large)
- AAText.bb (DLL dependencies)

---

## Debugging Tips

### Enable Verbose Logging:
```swift
// Add to StackValidator
var verbose = true

func pushVal(_ type: StackValueType) {
    if verbose {
        print("STACK: push \(type), depth: \(vals.count + 1)")
    }
    vals.append(type)
}

func popVal() -> StackValueType {
    if verbose {
        print("STACK: pop, depth: \(vals.count - 1)")
    }
    // ... rest of method
}
```

### Check Stack State:
```swift
// Add to StatementGeneration after each block
if let validator = stackValidator {
    print("DEBUG_STACK: Current depth: \(validator.stackDepth)")
    if !validator.isValid {
        print("DEBUG_STACK: Errors: \(validator.errors)")
    }
}
```

### Test Individual Instructions:
```swift
// Create unit tests
let validator = StackValidator()
validator.pushVal(.i32)
validator.pushVal(.i32)
validator.validateInstruction(.i32Add)
assert(validator.stackDepth == 1)
```

---

## Success Criteria

✅ **Phase 2 Complete When**:
- StackValidator integrated into StatementGeneration
- Control flow uses validation
- No compilation errors

✅ **Phase 3 Complete When**:
- All 4 test cases pass
- wasm-validate shows no errors

✅ **Phase 4 Complete When**:
- Pass rate improves by 5%+ (40 → 42+ files)
- UpdateEvents.bb validates correctly

✅ **Phase 5 Complete When**:
- Pass rate improves by 10%+ (40 → 44+ files)
- All targeted files fixed or diagnosed

---

## Time Estimate: 8-12 Hours

- Phase 1 (Data Structures): ✅ DONE
- Phase 2 (Integration): 2-3 hours
- Phase 3 (Testing): 1-2 hours  
- Phase 4 (Validation): 1 hour
- Phase 5 (Refinement): 2-3 hours
- **Buffer**: 2-3 hours for edge cases

**Total**: 8-12 hours to fully working implementation

---

## Next Steps

1. **Build the compiler** to verify StackValidator compiles
2. **Add integration points** in StatementGeneration
3. **Test with simple case** (test_stack_if.bb)
4. **Run full test suite** and measure improvement
5. **Iterate on refinements** based on failures

Ready to start Phase 2?
