# Blitz3D-WASM SCPCB Compilation Error Analysis

**Generated:** 2026-01-19 20:30:00 EST
**Test Run:** 2026-01-19 20:07:18 EST
**Files Tested:** 34
**Passed:** 10 (29.4%)
**Failed:** 24

---

## Summary of Errors

| Category | Count |
|----------|-------|
| TYPE_CONVERSION | 1220 |
| LOCAL_VAR_RANGE | 528 |
| UNKNOWN_ERROR | 1 |

---

## Root Cause Analysis

### 1. TYPE_CONVERSION Errors (1220)

**Two distinct issues:**

#### A. Stack Imbalance in If/Else Branches

**Symptom:** `type mismatch at end of 'if true' branch, expected [] but got [i32]`

**Root Cause:** Function calls used as statements leave return values on the stack, but `.drop` is only added when the function is found in `functionDefinitions`.

**Reference:** `Sources/Compiler/CodeGen/StatementGeneration.swift:252`

```swift
if let def = def, !def.results.isEmpty {
    function.body.append(.drop)
}
```

**Problem:** Many runtime functions aren't registered in `functionDefinitions`, so their return values aren't dropped.

**Evidence from test:**
```
error: type mismatch at end of `if true` branch, expected [] but got [i32]
error: type mismatch at end of `if true` branch, expected [] but got [i32, i32, i32]
error: type mismatch in call, expected [i32, f32, f32, f32, i32] but got [... i32, i32, f32, f32, i32]
```

#### B. Type Mismatches in Operations

**Symptom:** `type mismatch in f32.div, expected [f32, f32] but got [... f32, i32]`

**Root Cause:** The `commonType()` function uses `max()` on WASMType enum, but the enum's comparison order is incorrect for type promotion.

**Reference:** `Sources/Compiler/CodeGen/TypeHandling.swift:179`

```swift
public func commonType(_ type1: WASMType, _ type2: WASMType) -> WASMType {
    return max(type1, type2)
}
```

**Reference:** `Sources/Compiler/CodeGen/WASM.swift:22-29`

```swift
public static func < (lhs: WASMType, rhs: WASMType) -> Bool {
    let order: [WASMType] = [.i32, .f32, .i64, .f64, .v128, .void, .funcref, .externref]
    ...
}
```

**Problem:** `i32` > `f32` in this ordering, so mixing int and float doesn't promote to float correctly.

**Fix Required:** Change `commonType()` to properly handle i32/f32 promotion, or fix the type order.

---

### 2. LOCAL_VAR_RANGE Errors (528)

**Symptom:** `local variable out of range`

**Root Cause:** The compiler allocates local variables inefficiently:

1. Creates a new local for each intermediate expression result
2. Doesn't reuse local slots within functions
3. `local.get/set` indices exceed declared locals

**Investigation Required:** Check `VariableManagement` code for local slot tracking.

**Reference:** Likely in `Sources/Compiler/CodeGen/VariableManagement.swift` or similar.

---

## Affected Files

### Failed Files (24):
- Dreamfilter.bb
- UpdateEvents.bb
- CPU_Details.bb
- Map Creator/mapcreator_new.bb (compilation error)
- Map Creator/window3d.bb
- LightMapPNG.bb
- Save.bb
- Update.bb
- DevilParticleSystem.bb
- RMesh_Model_Viewer.bb
- Converter.bb
- Blitz_File_ZipApi.bb
- StrictLoads.bb
- MapSystem.bb
- MusicPlayer.bb
- BlitzAL.bb
- DrawPortals – Kopio.bb
- AAText.bb
- Particles.bb
- Menu.bb
- NPCs.bb
- Items.bb
- DrawPortals.bb
- Main.bb
- Achievements.bb

### Passed Files (10):
- FMod.bb
- Skybox.bb
- Difficulty.bb
- Blitz_File_FileName.bb
- KeyName.bb
- Blitz_Basic_Bank.bb
- fullscreen_window_fix.bb
- LoadAllSounds.bb
- TestLoadRMesh.bb

---

## Recommended Fixes

### Priority 1: Fix Function Call Return Value Handling

**Location:** `Sources/Compiler/CodeGen/StatementGeneration.swift:212-260`

**Change:** Always drop function call results when used as statements, not just when `def` exists.

```swift
case .functionCall(let call):
    let lowerName = call.name.lowercased()
    
    var argInstrs: [WASMInstruction] = []
    let def = context.functionDefinitions[lowerName]
    
    for (i, arg) in call.arguments.enumerated() {
        let argResult = expressionGenerator?.generateWithInfo(arg) ?? ([], .i32)
        argInstrs.append(contentsOf: argResult.instrs)
        
        if let def = def, i < def.params.count {
            argInstrs.append(contentsOf: convert(from: argResult.type, to: def.params[i]))
        }
    }
    
    if let funcIdx = context.functionIndexMap[lowerName] {
        function.body.append(contentsOf: argInstrs)
        function.body.append(.call(funcIdx))
        
        // FIX: Always drop if function returns a value, not just if def exists
        let returnsValue = def != nil && !(def?.results.isEmpty ?? true)
        if returnsValue {
            function.body.append(.drop)
        }
    }
```

### Priority 2: Fix Type Promotion Logic

**Location:** `Sources/Compiler/CodeGen/TypeHandling.swift:179-181`

**Option A:** Fix `commonType()` to handle i32/f32 correctly:

```swift
public func commonType(_ type1: WASMType, _ type2: WASMType) -> WASMType {
    if type1 == type2 { return type1 }
    // i32 + f32 = f32 (promote to float)
    if type1 == .i32 && type2 == .f32 { return .f32 }
    if type1 == .f32 && type2 == .i32 { return .f32 }
    // Use max for other numeric types
    return max(type1, type2)
}
```

**Option B:** Fix the WASMType enum comparison order in `WASM.swift:22-29`

### Priority 3: Investigate Local Variable Allocation

**Location:** `Sources/Compiler/CodeGen/VariableManagement.swift` (hypothetical)

**Investigation:** Trace local variable allocation to find where slot reuse fails.

---

## Test Reports

**Text Report:** `compile_test_report_20260119_200718.txt` (1.0 MB)
**JSON Report:** `compile_errors_20260119_200718.json`

Run tests with:
```bash
cd /Users/jack/Software/scp_port/blitz3d-wasm
./test_scpcb_compilation.sh
```

---

## Related Files

| File | Purpose |
|------|---------|
| `Sources/Compiler/CodeGen/CodeGenerator.swift` | Main code generator |
| `Sources/Compiler/CodeGen/ExpressionGeneration.swift` | Expression -> WASM |
| `Sources/Compiler/CodeGen/StatementGeneration.swift` | Statement -> WASM (line 212) |
| `Sources/Compiler/CodeGen/TypeHandling.swift` | Type system (line 179) |
| `Sources/Compiler/CodeGen/WASM.swift` | WASMType enum (line 22) |
| `Sources/Compiler/Parser/Parser.swift` | Parsing statements |
| `test_scpcb_compilation.sh` | Test runner script |
