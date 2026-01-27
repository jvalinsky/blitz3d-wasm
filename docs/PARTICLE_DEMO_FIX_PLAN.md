# Particle Demo Fix Plan

## Goal
Get SCPCB's Particles.bb running in browser with actual rendered particles.

## Current Status

### Working
- ✅ Thin runtime (517 lines JS)
- ✅ WASM loads and executes
- ✅ Global variables
- ✅ Simple functions (no Type system)
- ✅ Math operations (Sqr returns 5 for 3-4-5 triangle)
- ✅ Three.js rendering pipeline

### Not Working
1. **Type System** - `New`, `Delete`, `For Each` generate broken code
2. **Function Shadowing** - User functions shadowed by runtime imports
3. **String Concatenation** - `"text" + number` outputs blank

## Issue Analysis

### Issue 1: Type System Not Generating Code

**Symptom:** `GetParticleCount` returns 0, `CreateParticle` doesn't allocate

**Root Cause:** Compiler doesn't generate `bb_type_*` runtime calls

```wasm
;; Current (broken) - CreateParticle
local.get 7      ;; local 7 = 0 (never allocated!)
i32.const 76
i32.add
local.get 6
f32.store        ;; Writing to address 76 (wrong!)

;; Expected - should call bb_type_new
i32.const 1      ;; type ID for Particles
call $bb_type_new
local.set 7      ;; Now local 7 = allocated address
```

**Files to Fix:**
- `Sources/Compiler/CodeGen/CodeGenerator.swift` - Type instantiation
- `Sources/Compiler/CodeGen/StatementGeneration.swift` - New/Delete

### Issue 2: Function Name Shadowing

**Symptom:** `Distance#` calls runtime import instead of user function

**Root Cause:** Compiler exports runtime import, not user function

```wasm
;; Current (broken)
(export "Distance#" (func 204))  ;; func 204 = imported stub!

;; Expected
(export "Distance#" (func $Distance))  ;; User-defined function
```

**Files to Fix:**
- `Sources/Compiler/CodeGen/CodeGenerator.swift` - Export generation
- Need to check if user function exists before exporting import

### Issue 3: String + Number Concatenation

**Symptom:** `Print "Counter: " + counter` outputs blank

**Root Cause:** Missing `IntToString`/`FloatToString` conversion

**Files to Fix:**
- `Sources/Compiler/CodeGen/ExpressionGeneration.swift` - Binary `+` with string

## Fix Implementation Plan

### Phase 1: Type System (Critical)

#### Step 1.1: Add Type Runtime Imports
```swift
// In CodeGenerator.swift - ensure these imports exist:
// bb_type_new(typeId: i32) -> i32 (returns instance pointer)
// bb_type_delete(ptr: i32)
// bb_type_first(typeId: i32) -> i32
// bb_type_each_next(ptr: i32) -> i32
```

#### Step 1.2: Generate New Statement
```swift
// For: Local p.Particles = New Particles
// Generate:
//   i32.const <type_id_for_Particles>
//   call $bb_type_new
//   local.set <p_local_index>
```

#### Step 1.3: Generate Delete Statement
```swift
// For: Delete p
// Generate:
//   local.get <p_local_index>
//   call $bb_type_delete
```

#### Step 1.4: Generate For Each Loop
```swift
// For: For p.Particles = Each Particles
// Generate:
//   i32.const <type_id_for_Particles>
//   call $bb_type_first
//   local.set <p>
//   block $exit
//     loop $continue
//       local.get <p>
//       i32.eqz
//       br_if $exit
//       ;; loop body
//       local.get <p>
//       call $bb_type_each_next
//       local.set <p>
//       br $continue
//     end
//   end
```

#### Step 1.5: Implement JS Runtime Side
```javascript
// In thin/runtime.js
bb_type_new: (typeId) => {
    const size = self.typeSizes.get(typeId) || 64;
    const ptr = self.heapAlloc(size);
    // Add to linked list for this type
    self.typeInstances.get(typeId).push(ptr);
    return ptr;
},
bb_type_first: (typeId) => {
    const list = self.typeInstances.get(typeId);
    return list.length > 0 ? list[0] : 0;
},
bb_type_each_next: (ptr) => {
    // Find next in linked list
    // ...
}
```

### Phase 2: Function Shadowing Fix

#### Step 2.1: Track User Functions
```swift
// In CodeGenerator - maintain set of user-defined function names
var userDefinedFunctions: Set<String> = []

// When parsing function definition:
userDefinedFunctions.insert(functionName)
```

#### Step 2.2: Fix Export Generation
```swift
// When generating exports:
for (name, funcIndex) in functionExports {
    // Skip if this is a runtime import AND user defined a function with same name
    if runtimeImports.contains(name) && userDefinedFunctions.contains(name) {
        // Export the user function instead
        let userFuncIndex = getUserFunctionIndex(name)
        exports.append(.function(name, userFuncIndex))
    } else {
        exports.append(.function(name, funcIndex))
    }
}
```

#### Step 2.3: Fix Call Sites
```swift
// When generating function call:
if userDefinedFunctions.contains(calledName) {
    // Call user function, not runtime import
    call getUserFunctionIndex(calledName)
} else {
    call getRuntimeImportIndex(calledName)
}
```

### Phase 3: String Concatenation

#### Step 3.1: Detect String + Number
```swift
// In ExpressionGeneration.swift - binary add:
if leftType == .string && rightType == .int {
    // Convert int to string first
    generateExpression(right)
    call $IntToString  // Returns string pointer
    generateExpression(left)
    call $bb_string_concat
}
```

#### Step 3.2: Implement Conversion Functions
```javascript
// In runtime
IntToString: (value) => {
    const str = value.toString();
    return self.allocString(str);
},
FloatToString: (value) => {
    const str = value.toFixed(4);
    return self.allocString(str);
}
```

### Phase 4: Visual Particle Demo

Once Types work, update test to show particles:

```javascript
// In test.html
async function main() {
    const runtime = new Blitz3DThinRuntime(canvas);
    const instance = await runtime.loadAndRun('particles.wasm');
    
    // Create camera
    const cam = instance.exports.CreateCamera(0);
    instance.exports.PositionEntity(cam, 0, 0, -5);
    
    // Create some particles
    for (let i = 0; i < 10; i++) {
        instance.exports['CreateParticle%'](
            Math.random() * 2 - 1,  // x
            Math.random() * 2,       // y
            0,                       // z
            0,                       // image
            0.1,                     // size
            0.5,                     // gravity
            200                      // lifetime
        );
    }
    
    // Game loop
    function loop() {
        instance.exports.UpdateParticles();
        runtime.render();
        requestAnimationFrame(loop);
    }
    loop();
}
```

## Testing Plan

### Test 1: Type Allocation
```blitz
Type Test
    Field value%
End Type

Local t.Test = New Test
t\value = 42
Print t\value  ; Should print 42
Delete t
```

### Test 2: For Each
```blitz
Type Item
    Field id%
End Type

New Item : First Item\id = 1
New Item : Last Item\id = 2
New Item : Last Item\id = 3

Local count% = 0
For i.Item = Each Item
    count = count + 1
Next
Print count  ; Should print 3
```

### Test 3: Full Particles
```blitz
; Create 5 particles
For i = 1 To 5
    CreateParticle(Float(i) * 0.5, 1.0, 0.0, 0, 0.1, 1.0, 100)
Next
Print GetParticleCount()  ; Should print 5

; Update and count
UpdateParticles()
Print GetParticleCount()  ; Should print 5 (or less if some expired)
```

## File Change Summary

| File | Changes |
|------|---------|
| `Sources/Compiler/CodeGen/CodeGenerator.swift` | Add type tracking, fix exports |
| `Sources/Compiler/CodeGen/StatementGeneration.swift` | New, Delete, For Each |
| `Sources/Compiler/CodeGen/ExpressionGeneration.swift` | String + number |
| `Sources/Runtime/thin/runtime.js` | Add bb_type_* implementations |
| `Sources/Runtime/thin/test.html` | Visual particle test |

## Success Criteria

1. `New Type` allocates memory and returns valid pointer
2. `Delete` frees memory
3. `For Each` iterates all instances
4. User functions override runtime imports
5. `"text" + number` produces correct string
6. Particles render visually in canvas
7. Particle count matches expected

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Phase 1: Type System | 4-6 hours |
| Phase 2: Function Shadowing | 1-2 hours |
| Phase 3: String Concat | 1 hour |
| Phase 4: Visual Demo | 1 hour |
| **Total** | **7-10 hours** |
