# WASM Export Fix Plan

_Created: February 1, 2026_

## Problem

Swift 6.2 WASM compiler doesn't automatically export `@_cdecl` functions as WASM
module exports. Functions exist in the binary but aren't accessible from
JavaScript.

**Evidence**:

```bash
$ wasm2wat blitz3d-engine.wasm | grep "(export"
  (export "memory" (memory 0))
  (export "swjs_call_host_function" (func ...))
  # Our wasm_CreateBank, wasm_Sin, etc. are missing!
```

## Solutions (Ordered by Viability)

### Solution 1: Linker Export Flags ⭐ (Try First)

Add linker flags to `Package.swift` to explicitly export functions.

**Implementation**:

```swift
.executableTarget(
    name: "Blitz3DEngineWASM",
    dependencies: ["Blitz3DEngine"],
    path: "Tools/engine-wasm",
    linkerSettings: [
        .unsafeFlags([
            "-Xlinker", "--export=wasm_malloc",
            "-Xlinker", "--export=wasm_free",
            "-Xlinker", "--export=wasm_CreateBank",
            "-Xlinker", "--export=wasm_FreeBank",
            "-Xlinker", "--export=wasm_BankSize",
            "-Xlinker", "--export=wasm_PeekByte",
            "-Xlinker", "--export=wasm_PokeByte",
            "-Xlinker", "--export=wasm_PeekInt",
            "-Xlinker", "--export=wasm_PokeInt",
            "-Xlinker", "--export=wasm_PeekFloat",
            "-Xlinker", "--export=wasm_PokeFloat",
            "-Xlinker", "--export=wasm_Sin",
            "-Xlinker", "--export=wasm_Cos",
            "-Xlinker", "--export=wasm_Sqrt",
            "-Xlinker", "--export=wasm_Abs",
            "-Xlinker", "--export=wasm_Floor",
            "-Xlinker", "--export=wasm_Ceil",
        ], .when(platforms: [.wasi]))
    ]
)
```

**Pros**:

- Clean, declarative
- No post-processing
- Integrates with Swift build system

**Cons**:

- Need to list all 166 exports manually
- Could automate with script

**Time**: 30-45 minutes (manual list) OR 15 minutes (script generation)

---

### Solution 2: Post-Process with wasm-ld

Use `wasm-ld` to re-link the WASM with export flags.

**Implementation**:

```bash
# Extract object files
wasm-ld \
    .build/wasm32-unknown-wasip1/release/Blitz3DEngine.build/*.o \
    --export=wasm_CreateBank \
    --export=wasm_FreeBank \
    # ... etc
    -o blitz3d-engine-exported.wasm
```

**Pros**:

- Don't touch Package.swift
- Can script easily

**Cons**:

- Manual build step
- Need to track all .o files
- Harder to integrate with CI

**Time**: 20-30 minutes

---

### Solution 3: Export All with Wildcard

Use `--export-all` or `--export-dynamic` linker flag.

**Implementation**:

```swift
linkerSettings: [
    .unsafeFlags(["-Xlinker", "--export-all"], .when(platforms: [.wasi]))
]
```

**Pros**:

- One line
- No manual listing

**Cons**:

- Exports EVERYTHING (bloat, security)
- May expose internal symbols
- Larger binary

**Time**: 5 minutes

**Risk**: Acceptable for development, but need selective exports for production

---

### Solution 4: C Header Bridge

Create a C header with explicit exports, compile as separate module.

**Implementation**:

```c
// exports.h
__attribute__((visibility("default")))
int wasm_CreateBank(int size);
```

**Pros**:

- Maximum control
- Works with all toolchains

**Cons**:

- Extra build complexity
- Need C/Swift interop
- More files to maintain

**Time**: 45-60 minutes

---

## Recommended Approach

**Phase 1A: Quick Win (5 min)** Try `--export-all` to validate everything works
end-to-end.

**Phase 1B: Proper Fix (30 min)** Generate selective export list script and add
to Package.swift.

## Implementation Plan

### Step 1: Try --export-all (5 minutes)

1. Edit Package.swift
2. Add `--export-all` linker flag
3. Rebuild
4. Run tests
5. Verify exports with wasm2wat

**Success Criteria**: Tests pass, can call wasm_CreateBank from JS

---

### Step 2: Generate Export List (15 minutes)

Create script to extract all `@_cdecl("wasm_*")` functions:

```bash
#!/bin/bash
# generate-exports.sh

grep -r "@_cdecl(\"wasm_" Sources/Blitz3DEngine Tools/engine-wasm | \
    sed -E 's/.*@_cdecl\("([^"]+)".*/\1/' | \
    sort -u | \
    awk '{print "            \"-Xlinker\", \"--export=" $1 "\","}'
```

Output:

```swift
"-Xlinker", "--export=wasm_CreateBank",
"-Xlinker", "--export=wasm_FreeBank",
...
```

**Time**: 10 minutes to write script, 5 minutes to integrate

---

### Step 3: Update Package.swift with Selective Exports (10 minutes)

Replace `--export-all` with generated list.

**Verification**:

```bash
wasm2wat blitz3d-engine.wasm | grep "(export" | wc -l
# Should show ~166 exports (not 1000+)
```

---

### Step 4: Add Missing Wrapper Functions (15 minutes)

Currently only ~10 functions wrapped. Need to wrap all 166.

**Auto-generate wrappers**:

```bash
# Generate from Exports.swift
grep "@_cdecl" Sources/Blitz3DEngine/Exports.swift | \
    # Parse function signatures
    # Generate wrapper code
    # Output to main.swift
```

**OR**: Use a template:

```swift
@_cdecl("wasm_\(funcName)")
@MainActor
public func wasm_\(funcName)(\(params)) -> \(returnType) {
    return \(funcName)(\(args))
}
```

**Time**: 15 minutes with script

---

## Testing Strategy

After each step:

1. **Rebuild**:
   ```bash
   swift build --swift-sdk swift-6.2.3-RELEASE_wasm -c release
   cp .build/wasm32-unknown-wasip1/release/blitz3d-engine.wasm web/dist/
   ```

2. **Verify Exports**:
   ```bash
   wasm2wat web/dist/blitz3d-engine.wasm | grep "(export.*wasm_"
   ```

3. **Run Tests**:
   ```bash
   deno test --allow-read --no-check web/src/runtime/wasm-engine.test.ts
   ```

4. **Check Results**:
   - ✅ "WASM engine loads successfully" passes
   - ✅ "Bank operations: CreateBank and BankSize" passes
   - ✅ "Math operations: Sin, Cos, Sqrt" passes

---

## Full Export List (For Reference)

Functions to export (from Phase 1 tests):

- `wasm_malloc` / `wasm_free`
- `wasm_CreateBank` / `wasm_FreeBank` / `wasm_BankSize`
- `wasm_PeekByte` / `wasm_PokeByte`
- `wasm_PeekInt` / `wasm_PokeInt`
- `wasm_PeekFloat` / `wasm_PokeFloat`
- `wasm_Sin` / `wasm_Cos` / `wasm_Tan`
- `wasm_Sqrt` / `wasm_Abs` / `wasm_Floor` / `wasm_Ceil`

Eventually need all 166 from:

- Banks (11 functions)
- Strings (4 functions)
- Math (17 functions)
- File I/O (27 functions)
- Graphics (38 functions)
- Entities (20 functions)
- Camera (5 functions)
- Input (13 functions)
- Audio (7 functions)
- etc.

---

## Time Estimate

- **Quick Path** (--export-all): 10 minutes total
- **Proper Path** (selective exports): 45 minutes total
  - Script generation: 15 min
  - Wrapper generation: 15 min
  - Integration & testing: 15 min

---

## Success Metrics

**Phase 1A Complete**:

- [ ] WASM exports `wasm_CreateBank`, `wasm_malloc`, etc.
- [ ] At least 3 tests pass
- [ ] Can call engine functions from JavaScript

**Phase 1 Fully Complete**:

- [ ] All 13 tests pass
- [ ] All critical functions exported
- [ ] No memory leaks in tests
- [ ] Ready for Phase 2 (real import implementations)

---

**Next Immediate Action**: Add `--export-all` to Package.swift and rebuild.
