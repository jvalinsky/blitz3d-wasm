# SCP:CB WASM Compilation - Remaining Issues

## Current Status (as of 2026-01-19)
- **Total files tested:** 33
- **Passing:** 13 (39%)
- **Failing:** 20 (61%)
  - Compile errors: 1 (Map Creator/mapcreator_new.bb)
  - Validation errors: 19

## Changes Since Last Update
- Added OpenAL function signatures to compiler (`CodeGenerator.swift`)
- Added BlitzAL.bb from scp-cbm reference repository
- MusicPlayer.bb now compiles (but doesn't validate due to type issues)

## Passing Files

### 1. Stack Balancing in Control Flow (HIGH PRIORITY)
**Affected files:** Main.bb, Menu.bb, NPCs.bb, Items.bb, Achievements.bb, AAText.bb, DrawPortals.bb, NPCs.bb, Achievements.bb

**Error pattern:**
```
type mismatch at end of `if true` branch, expected [] but got [i32]
type mismatch at end of `if false` branch, expected [] but got [i32, i32]
type mismatch at end of loop, expected [] but got [i32, i32, i32]
```

**Root cause:** Statement branches leave values on the WASM stack that aren't consumed. Common scenarios:
- Function calls with return values used as statements don't drop the result
- If/Else branches have different stack heights
- Multiple assignments in a row leave intermediate values

**Location:** `Sources/Compiler/CodeGen/StatementGeneration.swift`

### 2. Function Argument Type Ordering (HIGH PRIORITY)
**Affected files:** Items.bb, NPCs.bb, Achievements.bb

**Error pattern:**
```
type mismatch in call, expected [i32, f32, f32, f32] but got [... f32, f32, f32, i32]
```

**Root cause:** Some functions expect arguments in a specific order but the compiler generates them in wrong order. This happens when:
- Float literals are used where integers are expected
- Type conversion happens before argument passing

**Location:** `Sources/Compiler/CodeGen/ExpressionGeneration.swift:generateFunctionCall()`

### 3. Missing _Strict Functions (MEDIUM PRIORITY)
**Affected:** Main.bb, Menu.bb, and other complex files

SCP:CB uses many `_Strict` variants of standard functions:
- `LoadImage_Strict`
- `LoadMesh_Strict`
- `LoadAnimMesh_Strict`
- `LoadBrush_Strict`
- `LoadFont_Strict`
- `ResizeImage_Strict`
- `MaskImage_Strict`
- `HandleImage_Strict`
- `RotateImage_Strict`

**Current status:** These call the base function (e.g., `LoadImage`) but may have different signatures.

**Location:** `Sources/Compiler/CodeGen/CodeGenerator.swift` (builtin function registration)

### 4. Missing Include Files
**File:** Map Creator/mapcreator_new.bb

**Error:** Cannot find include files in Map Creator/ directory

**Status:** Need to add stubs or find actual include files for the Map Creator module.

## Technical Details

### Stack Balancing Algorithm Needed

WASM requires that all branches of an if/loop have the same stack effect. Currently:

```swift
// BAD - branches leave different values
function.body.append(.if(.void, thenBody, elseBody))
```

We need to track stack height:
1. Before generating each branch, record current stack depth
2. After generating branch, calculate stack delta
3. Pad the shorter branch with `.drop` instructions
4. Ensure both branches have identical stack effects

### Type Promotion for Literals

When generating function call arguments, type promotion should happen BEFORE pushing values:

```swift
// CURRENT - wrong order
instrs.append(.call(funcIdx))

// FIX NEEDED - convert argument types before call
for (i, arg) in call.arguments.enumerated() {
    let argResult = generateWithInfo(arg)
    instrs.append(contentsOf: argResult.instrs)
    // Convert to expected type BEFORE the call
    if let def = def, i < def.params.count {
        instrs.append(contentsOf: convert(from: argResult.type, to: def.params[i]))
    }
}
```

## Files Requiring Deep Investigation

1. **Main.bb** - 59 functions, complex control flow, most validation errors
2. **NPCs.bb** - Many nested if statements, type confusion in AI code
3. **Menu.bb** - Many function calls with return values not being dropped
4. **Items.bb** - Argument ordering issues in CreateItemTemplate function

## Testing Commands

```bash
# Test all files
cd /Users/jack/Software/scp_port/blitz3d-wasm
./test_compile_scpcb.sh

# Test specific file
cd /Users/jack/Software/scp_port/scpcb
/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm Main.bb -o /tmp/Main.wasm
/opt/homebrew/bin/wasm-validate /tmp/Main.wasm

# Generate WAT for debugging
/Users/jack/Software/scp_port/blitz3d-wasm/.build/arm64-apple-macosx/debug/blitz3d-wasm Main.bb --wat -o /tmp/Main.wat
```

## Next Steps

1. **Implement stack height tracking** in StatementGeneration.swift
2. **Add automatic branch padding** for if/while/for statements
3. **Fix argument type conversion order** in ExpressionGeneration.swift
4. **Add all _Strict function variants** to builtins
5. **Create stub for Map Creator** includes or find actual files

## Related Files Modified

- `Sources/Compiler/CodeGen/WASM.swift` - Added Comparable for type ordering
- `Sources/Compiler/CodeGen/ExpressionGeneration.swift` - Fixed function call returns
- `Sources/Compiler/CodeGen/StatementGeneration.swift` - Fixed elseIf handling, For loop step
- `scpcb/BlitzAL.bb` - Created stub for missing audio library
