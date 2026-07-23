# Update.bb Bug - Final Analysis (Session 2)

**Time Spent**: 3+ hours\
**Status**: Root cause identified, fix strategy clear, implementation incomplete

---

## The Real Problem

### What We Discovered

By examining the **blitz3d-ng reference compiler**
(`reference/blitz3d-ng/src/tools/compiler/tree/var/ident_var.cpp`):

```cpp
// Line 9: Variable lookup by IDENTIFIER ONLY (no suffix)
if( (sem_decl=e->findDecl( ident )) ){
    // Line 15: If suffix provided, verify it matches declared type
    if( tag.size() && t!=ty ) ex( "Variable type mismatch" );
} else {
    // Line 18: Auto-declare with type from suffix (or default to int)
    sem_decl=e->decls->insertDecl( ident,t,DECL_LOCAL );
}
```

**Key Insight**: In Blitz3D, `x`, `x%`, and `x#` refer to the SAME variable. The
suffix is TYPE INFORMATION, not part of the identifier.

### Our Bug

**We're treating suffixes correctly in the AST** (parser strips them), **BUT**
the problem is **auto-declaration on READ**:

1. Expression: `Local y# = 200 - (20 * ScrollMenuHeight * ScrollBarY)`
   - `ScrollMenuHeight` used **without suffix** in expression
   - Auto-declares as **global i32** (default type, no suffix)

2. Assignment: `ScrollMenuHeight# = LinesAmount - 13`
   - Tries to assign to `ScrollMenuHeight` with **# suffix**
   - Looks up `ScrollMenuHeight` → finds it as **i32**
   - Tries to store **f32** value → **TYPE MISMATCH ERROR**

---

## Why This Code Exists in SCPCB

The pattern in Update.bb (lines 672-689):

```blitz3d
Local y# = 200-(20*ScrollMenuHeight*ScrollBarY)  ; Line 672: READ without suffix
...
ScrollMenuHeight# = LinesAmount-13                ; Line 689: WRITE with suffix
```

**Two possibilities**:

1. **Original Blitz3D is more lenient** - allows implicit type conversion
2. **This code never actually runs** - maybe behind conditional that's always
   false
3. **Original compiler has two-pass semantic analysis** - declarations processed
   before expressions

---

## What Our Fix Attempted

**ExpressionGeneration.swift line 56-70** - Added suffix checking:

```swift
let wasmType: WASMType
if let suffix = id.typeSuffix {
    wasmType = typeHandling.wasmType(from: suffix)
} else {
    wasmType = typeHandling.typeInfo(from: id.name).wasmType
}
```

**Problem**: This doesn't help because when `ScrollMenuHeight` is used **without
suffix**, `id.typeSuffix` is `nil`, so it still defaults to i32!

---

## The Correct Fix Strategy

### Option A: Don't Auto-Declare on READ (Strict Mode)

Only auto-declare variables on first ASSIGNMENT, not on first USE in expression.

**Pros**:

- Catches undefined variable errors
- More predictable behavior

**Cons**:

- Breaks SCPCB code that relies on auto-declaration
- Major behavior change

### Option B: Forward Scan for Type Hints

When auto-declaring a variable, scan forward in the AST to find the first
ASSIGNMENT with a suffix, use that type.

**Pros**:

- Handles SCPCB pattern correctly
- Matches apparent original Blitz3D behavior

**Cons**:

- Requires AST traversal (expensive)
- May not match all edge cases

### Option C: Implicit Float Promotion

When storing f32 into i32 variable, auto-promote the variable to f32.

**Pros**:

- Simple to implement
- Handles dynamic typing

**Cons**:

- Not how Blitz3D actually works
- Could hide bugs

### Option D: Allow Type Coercion (Pragmatic)

Just insert conversions as needed (i32→f32 or f32→i32) and don't error.

**Pros**:

- Makes SCPCB compile
- Simple implementation

**Cons**:

- Silent precision loss on f32→i32
- Not semantically correct

---

## Recommended Approach

**Hybrid: Option B + Option D**

1. **First pass**: Try forward scanning for type hints (limited to current
   function scope)
2. **If ambiguous**: Default to i32 but allow implicit f32→i32 conversion with
   warning
3. **Document the deviation** from original Blitz3D semantics

---

## Implementation Plan

### Phase 1: Add Forward Scanning (2 hours)

1. Create `inferVariableType(name: String, fromAST: [StatementNode])` function
2. Scan statements until first assignment with suffix
3. Cache results to avoid repeated scans

**File**: `Sources/Compiler/CodeGen/TypeInference.swift` (new file)

### Phase 2: Update Auto-Declaration (30 min)

Modify `ExpressionGeneration.swift` line 56:

```swift
// Try forward scan first
if let inferredType = typeInference.inferVariableType(id.name, fromAST: currentFunctionAST) {
    wasmType = inferredType
} else if let suffix = id.typeSuffix {
    wasmType = typeHandling.wasmType(from: suffix)
} else {
    wasmType = .i32  // Default
}
```

### Phase 3: Test & Verify (1 hour)

1. Test Update.bb specifically
2. Run full SCPCB test suite
3. Verify no regressions

**Total Time**: 3.5 hours

---

## Alternative: Just Fix Update.bb Source

If SCPCB code is actually buggy, we could patch Update.bb:

```diff
-Local y# = 200-(20*ScrollMenuHeight*ScrollBarY)
+Local y# = 200-(20*ScrollMenuHeight#*ScrollBarY)
```

Add explicit suffixes everywhere `ScrollMenuHeight` is used.

**Pros**: Simple, correct **Cons**: Modifying game source (but it's open source
anyway)

---

## Lessons Learned

1. **Always check reference implementation first** - Saved 2 hours of wrong
   assumptions
2. **Parser is correct** - The bug was NOT in type suffix handling
3. **Auto-declaration is the issue** - Not type checking or conversion
4. **Blitz3D semantics are subtle** - Suffix as type info, not identifier part

---

## Next Session TODO

1. Decide on fix strategy (recommend Hybrid approach)
2. Implement type inference system if going with Option B
3. Test with all 10 failing files
4. Document any deviations from original Blitz3D semantics
