# Deep Debugging Plan: Update.bb Type Mismatch

**Goal**: Fix 4 errors where f32 values are stored into i32 globals\
**Estimated Time**: 2-3 hours\
**Approach**: Systematic instrumentation and binary search

---

## Phase 1: Instrument the Compiler (30 min)

### 1.1: Add Comprehensive Logging

**File**: `Sources/Compiler/CodeGen/StatementGeneration.swift`

#### A. Assignment Entry Point (Line ~140)

```swift
case .assignment(let assign):
    guard let expressionGenerator = expressionGenerator else { break }
    
    print("DEBUG_ASSIGN_START: \(assign.target) = \(assign.value)")
    
    let valueResult = expressionGenerator.generateWithInfo(assign.value)
    let targetType = getTargetType(from: assign.target)
    
    print("DEBUG_ASSIGN_TYPES: target=\(assign.target) valueType=\(valueResult.type) targetType=\(targetType)")
    
    var finalInstrs = valueResult.instrs
    if valueResult.type != targetType {
        print("DEBUG_ASSIGN_CONVERT: Converting \(valueResult.type) → \(targetType)")
        print("  Instructions before convert: \(valueResult.instrs.suffix(5))")
        finalInstrs.append(contentsOf: convert(from: valueResult.type, to: targetType))
        print("  Instructions after convert: \(finalInstrs.suffix(5))")
    }
```

#### B. getTargetType() (Line ~1031)

```swift
private func getTargetType(from expr: ExpressionNode) -> WASMType {
    print("DEBUG_TARGET_TYPE: Analyzing \(expr)")
    
    switch expr {
    case .identifier(let id):
        print("  → Identifier: \(id.name), suffix: \(id.typeSuffix)")
        
        if let suffix = id.typeSuffix {
            let type = typeHandling.wasmType(from: suffix)
            print("  → From suffix: \(type)")
            return type
        }
        
        if let local = context.variableManagement.localInfo(for: id.name) {
            print("  → From local registry: \(local.type)")
            return local.type
        }
        if let global = context.variableManagement.globalInfo(for: id.name) {
            print("  → From global registry: \(global.type)")
            return global.type
        }
        print("  → Defaulting to: i32")
        
    case .arrayAccess, .fieldAccess:
        // ... existing code with logging
        
    default:
        print("  → Default case: i32")
    }
    return .i32
}
```

#### C. Auto-Declaration (Line ~164)

```swift
} else {
    print("DEBUG_AUTO_DECLARE: Variable '\(id.name)' not found")
    print("  targetType from getTargetType: \(targetType)")
    print("  valueResult.type: \(valueResult.type)")
    
    let wasmType = targetType
    print("  Registering as: \(wasmType)")
    
    let actualGlobalIdx = context.registerGlobalWithDefaultInit(type: wasmType, mutability: true)
    _ = context.variableManagement.registerGlobalWithIndex(id.name, type: wasmType, typeName: nil, wasmIndex: actualGlobalIdx)
    
    print("  Global index: \(actualGlobalIdx)")
    print("  Final instructions type: \(valueResult.type) (should match \(wasmType))")
}
```

**File**: `Sources/Compiler/CodeGen/ExpressionGeneration.swift`

#### D. generateFunctionCall() (Line ~670)

```swift
private func generateFunctionCall(_ call: FunctionCallNode) -> (instrs: [WASMInstruction], type: WASMType) {
    print("DEBUG_FUNC_CALL: \(call.name) with \(call.arguments.count) args")
    
    var instrs: [WASMInstruction] = []
    var internalName = call.name.lowercased()
    
    // Strip suffix
    if internalName.hasSuffix("$") || internalName.hasSuffix("#") || internalName.hasSuffix("%") {
        internalName = String(internalName.dropLast())
    }
    
    print("  Internal name: \(internalName)")
    
    // ... existing code ...
    
    print("DEBUG_FUNC_CALL_RESULT: \(call.name) returns \(returnType)")
    print("  Instruction count: \(instrs.count)")
    print("  Last 3 instructions: \(instrs.suffix(3))")
    
    return (instrs, returnType)
}
```

#### E. generateWithInfo() Binary Ops (Line ~280)

```swift
private func generateBinaryOp(_ binop: BinaryOpNode) -> (instrs: [WASMInstruction], type: WASMType) {
    print("DEBUG_BINOP: \(binop.op)")
    
    let (leftInstrs, leftType) = generateWithInfo(binop.left)
    let (rightInstrs, rightType) = generateWithInfo(binop.right)
    
    print("  Left: \(leftType), Right: \(rightType)")
    
    let resultType = typeHandling.commonType(leftType, rightType)
    print("  Result type: \(resultType)")
    
    // ... rest of function
}
```

### 1.2: Rebuild

```bash
cd blitz3d-wasm
swift build
```

---

## Phase 2: Collect Diagnostic Data (15 min)

### 2.1: Compile Update.bb with Full Logging

```bash
cd blitz3d-wasm
.build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/Update.bb -o /tmp/update_debug.wasm 2>&1 | tee /tmp/update_debug.log
```

### 2.2: Extract Error Context

```bash
# Find all DEBUG_ASSIGN lines
grep "DEBUG_ASSIGN" /tmp/update_debug.log > /tmp/assignments.log

# Find all auto-declarations
grep "DEBUG_AUTO_DECLARE" /tmp/update_debug.log > /tmp/auto_declare.log

# Find all function calls
grep "DEBUG_FUNC_CALL" /tmp/update_debug.log > /tmp/func_calls.log

# Find all type conversions
grep "DEBUG_ASSIGN_CONVERT" /tmp/update_debug.log > /tmp/conversions.log
```

### 2.3: Correlate with WASM Errors

```bash
# Get the global indices that are failing
wasm-validate /tmp/update_debug.wasm 2>&1 | tee /tmp/wasm_errors.log

# Get WASM globals section
wasm-objdump -x /tmp/update_debug.wasm | grep "global\[" > /tmp/globals.log
```

---

## Phase 3: Identify the Bad Assignment (30 min)

### 3.1: Find Which Globals Are Failing

From wasm-validate output, we know there are 4 errors. We need to identify which
global indices.

**Script**: Create `Tools/find_bad_globals.py`

```python
import subprocess
import re

# Get validation errors
result = subprocess.run(['wasm-validate', '/tmp/update_debug.wasm'], 
                       capture_output=True, text=True)

# Extract offsets
offsets = re.findall(r'0x([0-9a-f]+): error: type mismatch in global.set', result.stderr)

# Disassemble and find global.set at those offsets
for offset in offsets:
    # Get surrounding context from objdump
    result = subprocess.run(['wasm-objdump', '-d', '/tmp/update_debug.wasm'],
                           capture_output=True, text=True)
    lines = result.stdout.split('\n')
    
    for i, line in enumerate(lines):
        if offset in line and 'global.set' in line:
            # Extract global index
            match = re.search(r'global\.set (\d+)', line)
            if match:
                global_idx = match.group(1)
                print(f"Offset {offset}: global.set {global_idx}")
                # Print context
                for j in range(max(0, i-10), min(len(lines), i+3)):
                    print(f"  {lines[j]}")
```

Run:

```bash
cd blitz3d-wasm
python3 Tools/find_bad_globals.py > /tmp/bad_globals.txt
```

### 3.2: Match Globals to Variables

**Script**: Create `Tools/match_globals.py`

```python
import re

# Read auto-declarations from log
with open('/tmp/auto_declare.log', 'r') as f:
    declarations = f.readlines()

# Read bad globals
with open('/tmp/bad_globals.txt', 'r') as f:
    bad_globals = f.read()

# Extract global indices from bad_globals
bad_indices = set(re.findall(r'global\.set (\d+)', bad_globals))

print("Bad global indices:", bad_indices)
print("\nSearching for their declarations...")

for line in declarations:
    # Look for "Global index: X"
    match = re.search(r'Global index: (\d+)', line)
    if match and match.group(1) in bad_indices:
        print("\nFOUND:", line.strip())
        # Find the variable name in surrounding context
        var_match = re.search(r"Variable '(\w+)'", line)
        if var_match:
            print(f"  Variable: {var_match.group(1)}")
```

Run:

```bash
python3 Tools/match_globals.py
```

### 3.3: Find the Assignment in Source

Once we know which variable(s), grep Update.bb:

```bash
# Example: if variable is "y"
grep -n "^[^;]*y[^a-zA-Z].*=" /Users/jack/Software/scp_port/scpcb/Update.bb
```

### 3.4: Trace the Assignment in Log

Search for the specific assignment in the debug log:

```bash
# Example: if assignment is "y = GetLineAmount2(...)"
grep -A 20 "DEBUG_ASSIGN_START.*y.*=" /tmp/update_debug.log
```

This should show:

- What type the expression returned
- What type the target was
- Whether a conversion happened
- What the conversion was

---

## Phase 4: Reproduce Minimally (30 min)

### 4.1: Create Minimal Test Case

Based on the failing assignment, create a minimal reproduction:

**File**: `/tmp/minimal_repro.bb`

```blitz3d
; Exact pattern from Update.bb that fails
Global y%  ; or whatever the variable is

; Exact expression that causes issue
y = [EXPRESSION_FROM_UPDATE_BB]

Function Test()
End Function
```

### 4.2: Test Minimal Case

```bash
cd blitz3d-wasm
.build/arm64-apple-macosx/debug/blitz3d-wasm /tmp/minimal_repro.bb -o /tmp/minimal.wasm 2>&1 | tee /tmp/minimal.log
wasm-validate /tmp/minimal.wasm
```

**Expected outcomes**:

- ✓ **If it reproduces**: We have isolated the bug!
- ✗ **If it works**: The bug requires more context (multiple assignments,
  specific state)

### 4.3: Binary Search

If minimal case works, gradually add back context from Update.bb until it
breaks:

```bash
# Add globals one by one
# Add functions one by one
# Add preceding assignments one by one
```

Use git to track each iteration:

```bash
git add /tmp/minimal_repro.bb
git commit -m "Minimal repro iteration N: [description]"
```

---

## Phase 5: Analyze the Root Cause (30 min)

At this point, we should have:

1. **Exact variable name(s)** causing the issue
2. **Exact assignment(s)** that fail
3. **Debug trace** showing type flow
4. **Minimal reproduction** case

### 5.1: Hypothesize Based on Evidence

**Pattern Analysis**:

- Is the RHS a function call? Which function?
- Is it a binary operation?
- Is it a complex expression?
- Does it involve type conversions?

**Common Bug Patterns**:

#### Pattern A: Expression Type Inference Wrong

```
RHS expression incorrectly inferred as f32
→ getTargetType() sees undeclared variable, defaults to i32
→ Auto-declare as i32
→ Try to convert f32→i32
→ Conversion generates f32.convert_i32_s (WRONG DIRECTION!)
```

**Fix**: Check expression type inference in ExpressionGeneration.

#### Pattern B: getTargetType() Returns Wrong Type

```
Variable should be f32 (has # suffix in source)
→ Parser loses suffix information
→ getTargetType() defaults to i32
→ Register as i32
→ Later assignment provides f32
→ ERROR
```

**Fix**: Verify suffix preservation through AST.

#### Pattern C: Convert() Function Bug

```
Need to convert i32→f32
→ convert() called with (from: i32, to: f32)
→ Bug in convert() emits wrong instruction
→ Generates f32.convert_i32_s but places it wrong
```

**Fix**: Review convert() implementation.

#### Pattern D: Auto-Declaration Timing

```
First use of variable is in complex expression
→ Expression evaluated first (generates f32)
→ Then variable auto-declared based on targetType (i32)
→ Mismatch!
```

**Fix**: Auto-declare BEFORE evaluating RHS.

### 5.2: Check Each Hypothesis

For each pattern, add assertions:

```swift
// In assignment handling
assert(valueResult.type == targetType || 
       convert(from: valueResult.type, to: targetType).count > 0,
       "Type mismatch without conversion: \(valueResult.type) vs \(targetType)")
```

### 5.3: Examine AST

Add AST dumping:

```swift
// In Parser or CodeGenerator
func dumpAST(_ node: Any, indent: Int = 0) {
    let prefix = String(repeating: "  ", count: indent)
    print("\(prefix)\(node)")
    // Recursively dump children
}
```

Call before generating code for the problematic function.

---

## Phase 6: Implement Fix (30 min)

Based on root cause, implement the fix. Common fixes:

### Fix A: Correct Expression Type Inference

```swift
// In ExpressionGeneration.swift
// Ensure Int() function returns i32, not f32
case "int":
    returnType = .i32  // Force to i32
```

### Fix B: Preserve Type Suffix

```swift
// Verify in Parser.swift that type suffix is captured
// Verify in AST.swift that IdentifierNode stores it
// Verify in CodeGen that it's used
```

### Fix C: Fix convert() Function

```swift
// In StatementGeneration.swift
private func convert(from source: WASMType, to target: WASMType) -> [WASMInstruction] {
    print("CONVERT_DEBUG: \(source) → \(target)")
    if source == target { return [] }
    
    switch (source, target) {
    case (.i32, .f32): 
        print("  → f32.convert_i32_s")
        return [.f32ConvertI32S]
    case (.f32, .i32): 
        print("  → i32.trunc_f32_s")
        return [.i32TruncF32S]
    // ... etc
    }
}
```

### Fix D: Auto-Declare Earlier

```swift
// Move auto-declaration before RHS evaluation
case .assignment(let assign):
    // First, ensure target exists
    if case .identifier(let id) = assign.target {
        if !context.variableManagement.hasVariable(id.name) {
            // Auto-declare NOW
            let wasmType = getTargetType(from: assign.target)
            context.variableManagement.registerGlobalWithIndex(...)
        }
    }
    
    // Then evaluate RHS
    let valueResult = expressionGenerator.generateWithInfo(assign.value)
```

---

## Phase 7: Verify Fix (15 min)

### 7.1: Test Minimal Reproduction

```bash
cd blitz3d-wasm
swift build
.build/arm64-apple-macosx/debug/blitz3d-wasm /tmp/minimal_repro.bb -o /tmp/test.wasm
wasm-validate /tmp/test.wasm
# Should: PASS ✓
```

### 7.2: Test Update.bb

```bash
.build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/Update.bb -o /tmp/update.wasm
wasm-validate /tmp/update.wasm
# Should: 4 errors → 0 errors ✓
```

### 7.3: Test All Files

```bash
./test_scpcb_fast_detailed.sh
# Should: 26/36 passing → 27/36 passing ✓
```

### 7.4: Verify No Regressions

Check that passing files still pass:

```bash
for file in BlitzAL.bb Difficulty.bb Dreamfilter.bb; do
    echo "Testing $file..."
    .build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/$file -o /tmp/test.wasm
    wasm-validate /tmp/test.wasm && echo "  ✓ PASS" || echo "  ✗ FAIL"
done
```

---

## Phase 8: Document & Commit (15 min)

### 8.1: Document the Fix

**File**: `UPDATE_BUG_FIX.md`

```markdown
# Update.bb Bug Fix

## Root Cause

[Describe what was wrong]

## The Fix

[Show the code change]

## Why It Happened

[Explain the logic error]

## How to Prevent

[Suggestions for preventing similar bugs]
```

### 8.2: Remove Debug Logging

Either:

- A) Remove all DEBUG prints
- B) Put behind a flag: `if debugLogging { print(...) }`

### 8.3: Commit

```bash
git add -A
git commit -m "fix: Update.bb type mismatch (4 errors → 0)

Root cause: [DESCRIPTION]

The issue was that [EXPLANATION].

Fixed by [SOLUTION].

Pass rate: 72% → 75% (27/36 files)

Fixes #[issue number if applicable]

🎮 Generated with [Letta Code](https://letta.com)

Co-Authored-By: Letta <noreply@letta.com>"
```

---

## Debugging Toolkit

### Useful Scripts

**1. Compare WASM outputs**:

```bash
# Generate WAT for before/after
wasm2wat /tmp/update_before.wasm > /tmp/before.wat
wasm2wat /tmp/update_after.wasm > /tmp/after.wat
diff /tmp/before.wat /tmp/after.wat
```

**2. Find specific instruction patterns**:

```bash
wasm-objdump -d file.wasm | grep -B5 -A5 "f32.convert_i32_s.*global.set"
```

**3. Extract function by name**:

```bash
wasm-objdump -d file.wasm | sed -n '/func.*<OpenRemoteFile>/,/^$/p'
```

### Debugging Checklist

Before diving in:

- [ ] Can reproduce error consistently
- [ ] Have clean git state
- [ ] Have logging infrastructure ready
- [ ] Know expected vs actual behavior
- [ ] Have test case prepared

During debugging:

- [ ] Collect data before theorizing
- [ ] Test hypotheses with minimal cases
- [ ] Document findings as you go
- [ ] Take breaks if stuck >1 hour

After fixing:

- [ ] Verify fix with original case
- [ ] Test for regressions
- [ ] Document root cause
- [ ] Add test if possible

---

## Estimated Timeline

| Phase | Task                    | Time   | Running Total |
| ----- | ----------------------- | ------ | ------------- |
| 1     | Instrument compiler     | 30 min | 0:30          |
| 2     | Collect diagnostic data | 15 min | 0:45          |
| 3     | Identify bad assignment | 30 min | 1:15          |
| 4     | Reproduce minimally     | 30 min | 1:45          |
| 5     | Analyze root cause      | 30 min | 2:15          |
| 6     | Implement fix           | 30 min | 2:45          |
| 7     | Verify fix              | 15 min | 3:00          |
| 8     | Document & commit       | 15 min | 3:15          |

**Total**: 3 hours 15 minutes

**Contingency**: Add 1 hour for unexpected issues → **4 hours total**

---

## Success Criteria

- [x] Update.bb compiles with 0 errors
- [x] wasm-validate passes
- [x] Pass rate increases from 72% to 75%+
- [x] No regressions in other files
- [x] Root cause documented
- [x] Fix committed with clear message

---

## Escape Hatches

If stuck after 2 hours:

1. **Post to Discord**: Share UPDATE_BUG_ANALYSIS.md + debug log
2. **Try Menu.bb instead**: Skip Update.bb, come back later
3. **Use Binaryen**: Try wasm-opt as post-processor to fix automatically
4. **Ask for pair programming**: Fresh perspective might spot it immediately

Don't spend more than 4 hours total on one 4-error file.
