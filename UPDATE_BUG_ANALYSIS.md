# Update.bb - Bug Analysis (In Progress)

**File**: Update.bb\
**Errors**: 4 TYPE errors\
**Pattern**: `global.set, expected [i32] but got [f32]`

---

## What I Found

### Error Locations (WASM byte offsets)

```
/tmp/update.wasm:0004adb: error: type mismatch in global.set, expected [i32] but got [f32]
/tmp/update.wasm:0004b8b: error: type mismatch in global.set, expected [i32] but got [f32]
/tmp/update.wasm:0004d8a: error: type mismatch in global.set, expected [i32] but got [f32]
/tmp/update.wasm:0004e3a: error: type mismatch in global.set, expected [i32] but got [f32]
```

### Pattern in Disassembly

Found instances where we convert i32→f32 unnecessarily:

```wasm
f32.convert_i32_s    ; Convert i32 to f32
local.set 36          ; Store in local (f32 type)
i32.const 0
global.set 70         ; This works (i32)
```

But also found:

```wasm
f32.convert_i32_s
global.set 71         ; ERROR: global 71 is i32, trying to set with f32!
```

So the issue is that **some** globals are being assigned f32 values when they
should be i32.

---

## Verification Tests

### Simple Int() Works

```blitz3d
Global code%
code = Int(5.5)  → Compiles and validates ✓
```

### Int(Sector$()) Works

```blitz3d
Global code%
Global txt$
txt$ = "HTTP/1.1 200 OK"
code = Int(Sector$(txt$, " ", 1))  → Compiles and validates ✓
```

So the issue is NOT with `Int()` or `Sector$()` functions in general.

---

## Hypothesis

The issue might be with:

1. **Implicit globals** - Variables auto-declared without type suffix
2. **Complex expressions** - Multi-level function calls or operations
3. **Context-dependent** - Specific to Update.bb's code patterns

### Implicit Globals in Update.bb

From compile log:

```
DEBUG_COMPILER: Auto-declaring implicit variable 'variables' as global
DEBUG_COMPILER: Auto-declaring implicit variable 'httpheader' as global
DEBUG_COMPILER: Auto-declaring implicit variable 'txt' as global
DEBUG_COMPILER: Auto-declaring implicit variable 'code' as global
... (30+ more)
```

All of these default to i32 (correct), but something is assigning f32 values to
them.

---

## Code Locations in Update.bb

Source code assignments involving these variables:

```blitz3d
Line 76: code% = Int Sector$(txt$, " ", 1)
Line 93: this\code% = code%
Line 94: this\code% = "0"
Line 144: code% = Int Sector$(txt$, " ", 0)
```

---

## Debugging Strategy (Next Session)

### 1. Add Targeted Logging

In `StatementGeneration.swift` around line 145, add:

```swift
if valueResult.type != targetType {
    print("DEBUG_CONVERT: \(assign.target) - value:\(valueResult.type) target:\(targetType)")
    finalInstrs.append(contentsOf: convert(from: valueResult.type, to: targetType))
}
```

### 2. Create Minimal Repro

Start with Update.bb and remove code until error disappears, to isolate exact
pattern.

### 3. Check Global Registry

Add logging when auto-declaring globals:

```swift
print("DEBUG_GLOBAL: Registering '\(id.name)' as \(wasmType) (from getTargetType)")
```

### 4. Check Expression Types

For complex expressions like `Int Sector$(...)`, log what type the whole
expression returns.

---

## Possible Fixes

### If getTargetType() is wrong:

```swift
// In getTargetType(), when variable is undeclared:
// Current: return .i32
// Fix: Check if RHS is f32 and adjust?
// (But this seems wrong - target type should be independent of RHS)
```

### If convert() is wrong:

```swift
// Check convert() function - maybe it's doing wrong conversion?
// Current: i32→f32 uses f32.convert_i32_s
// Maybe it should be checking context?
```

### If auto-declaration is wrong:

```swift
// Line 165: let wasmType = targetType
// Maybe targetType is wrong here?
// Should we infer from RHS instead?
```

---

## Time Spent

- 30 minutes analyzing errors
- 15 minutes testing simple cases
- 45 minutes examining WASM disassembly
- Total: ~90 minutes (not solved yet)

---

## Status

**BLOCKED** - Need more targeted debugging. The issue is subtle and requires
tracing through a specific assignment to see where the wrong type comes from.

## Next Steps

1. Add comprehensive logging as outlined above
2. Recompile Update.bb with logging
3. Find the exact line where f32 is generated instead of i32
4. Fix the root cause
5. Test and verify all 4 errors are fixed
