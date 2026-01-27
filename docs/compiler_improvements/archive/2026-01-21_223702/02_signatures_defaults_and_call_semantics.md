# 02 — Signatures, Defaults, and Call Semantics (Make Calls Boring)

## Implementation Status (2026-01-27)

**Core signature resolution: ✅ COMPLETE**

The unified signature resolution system was implemented as part of the WASM Validation Trilogy fixes:
- **SignatureResolver**: Centralized API wrapper over `functionDefinitions` and `functionDefinitionsByIndex`
- **Call generation**: Refactored to use resolved signatures consistently
- **Type conversion**: Argument type mismatches now converted correctly (f32↔i32)
- **Void handling**: Void calls in value contexts now emit diagnostics

**Related commits**: c957360, 116a27d, dc079ca (branch: `fix/wasm-validation-trilogy`)

**Remaining work**:
- Default argument expansion (requires IR or semantic pass)
- Overload resolution strategy
- Full test coverage for edge cases

## Lessons Learned (Jan 22 2026: Auto-Import Failure)

An attempt was made to implement "Auto-Imports" to stub missing functions automatically using heuristics. This failed validation and highlighted why a Typed IR (Plan 03) is strictly necessary.

**The Experiment:**
- A flag `--auto-import-map` loaded a list of missing function names.
- The compiler inferred signatures based on call sites (arity/types) and registered them on-the-fly.

**The Failure:**
1.  **Arity Conflicts:** Different call sites used different argument counts for the same function. One site would push 2 args, another 3. The inferred signature (max arity) caused the 2-arg call to underflow the stack or the 3-arg call to be padded incorrectly.
2.  **Stack Mismatches:** Calls used as statements (returning values) were not reliably dropped because the "voidness" was heuristic. This left values on the stack, breaking branch balancing in `If`/`While` blocks.
3.  **Validation Hell:** `wasm-validate` reported hundreds of errors, proving that "guessing" signatures during direct WASM generation is fragile.

**The Pivot:**
We will **not** proceed with heuristic auto-imports in the current codegen. Instead, Plan 03 (Typed IR) will handle this cleanly:
- **Lowering Phase:** Resolve all calls to a consistent internal signature *before* codegen.
- **Explicit Padding:** Insert explicit "Pad" or "Cast" nodes in the IR.
- **Explicit Drops:** Insert `Discard` nodes for unused return values.

## Goal

Make function calls deterministic and type-correct:
- Every call has an unambiguous target and a signature (params/results).
- Optional arguments/defaults are expanded in a single place.
- Array indexing vs function call ambiguity is resolved semantically (not during codegen guesswork).

This is the plan that prevents “drop-underflow” and “wrong type on stack” issues originating at call sites.

## Current State (observed)

- Imports are registered with explicit signatures:
  - `../../../Sources/Compiler/CodeGen/CodeGenerator.swift` (import list in `addImports()`)
- User function signatures are pre-registered:
  - `../../../Sources/Compiler/CodeGen/CodeGenerator.swift` (`registerFunctionSignatures`)
- Call generation contains fallback logic and mixed sources of truth:
  - `../../../Sources/Compiler/CodeGen/ExpressionGeneration.swift` (`generateFunctionCall`)
- Statement context drops results based on inferred `type` returned from expression generation:
  - `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`

## Plan Adjustment (based on current code state)

The repo already has two “signature stores” in practice:
- By name: `functionDefinitions` (and `functionIndexMap`) on `ModuleContext`
- By index: `functionDefinitionsByIndex` on `ModuleContext`

These are populated in:
- `addImports()` for imported/runtime functions (`../../../Sources/Compiler/CodeGen/CodeGenerator.swift`)
- `registerFunctionSignatures()` for user functions (`../../../Sources/Compiler/CodeGen/CodeGenerator.swift`)

So the right next step is to **wrap/centralize access** to these existing stores (one API), not to introduce another parallel structure that can drift.

**Progress note (completed)**
- Added `SignatureResolver` wrapper over `functionDefinitions` / `functionDefinitionsByIndex` / `functionIndexMap` and refactored call generation + statement drops to use it.
- Heuristic return-type inference for void calls was removed (no more dummy value insertion).
- Calls that resolve to `void` now warn + coerce to `i32Const 0` when used in value context (short-term safety to avoid stack underflow).

## Plan

### 1. Create a unified "signature database" (one source of truth) ✅ COMPLETE

**Action**
- Define a single model for callable symbols:
  - name (case-insensitive)
  - kind: import / user / intrinsic / runtime helper
  - params: typed list
  - results: typed list
  - defaults: optional per param
  - varargs/overload rules (if Blitz3D semantics require it)

**Where**
- Preferred: a thin API wrapper over existing `ModuleContext` maps
  - e.g. `Sources/Compiler/Semantics/Signatures.swift` (name resolution, index resolution, arity/default handling)
  - avoids duplicating state already populated by `CodeGenerator.swift`
  - **Status:** ✅ Implemented as `SignatureResolver` under `Sources/Compiler/CodeGen/SignatureResolver.swift`

**Acceptance**
- [x] Codegen never uses name-based heuristics to infer return types; it uses the unified signature API.
- [x] "WASM module type table" inspection (if kept) is *diagnostic only* (assertions/logs), not control flow.
- [x] Database is populated before any expression lowering runs.
- **Progress:** ✅ The call path now prefers registered/actual types; heuristics eliminated. Completed in commits c957360, 116a27d.

### 2. Implement default-argument expansion (builtins + user functions)

**Action**
- During semantic analysis (or AST->IR lowering):
  - For a call with N args but signature expects M args:
    - if missing params have defaults, synthesize them
    - otherwise emit a compile error with a helpful message

**Why**
- “Pad with 0” is rarely correct for Blitz3D, and it creates subtle runtime bugs.

**Acceptance**
- Calls with fewer args compile only when defaults are defined.
- The default values appear in the lowered IR as explicit expressions (so stack effect is known).

**Refs**
- Discussion already present in the repo roadmap:
  - `../../ROADMAP_TO_BROWSER.md`

### 3. Resolve call vs array indexing in the semantic phase

Blitz3D uses `name(expr)` for both:
- function call `Foo(x)`
- array indexing `arr(i)` (and multi-dim `arr(i,j)` depending on dialect)

**Action**
- Resolve based on the symbol table:
  - if `name` is a declared array: treat as indexing
  - else if `name` resolves to a function: treat as call
  - else error (or implicit declaration if BB semantics allow it, but be explicit)

**Acceptance**
- Codegen no longer “tries array first and otherwise drops”.
- This reduces stack hazards and makes errors discoverable earlier.

**Refs**
- Existing “treat call target as array assignment” logic exists in:
  - `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`

### 4. Overloads / variants strategy (pragmatic approach)

Blitz3D-like APIs often appear in “variant count” forms (e.g. 2-arg vs 4-arg).

**Recommended approach**
- Keep internal symbol uniqueness:
  - Map each variant to a unique internal name (e.g. `EntityTexture$arity2`, `EntityTexture$arity4`)
  - Lower calls to the correct internal name after overload resolution

**Alternative**
- Use a dispatcher wrapper (slower, but simpler) that switches on provided arg count.

**Acceptance**
- The compiler doesn’t rely on “drop extra args” to make arity mismatch compile.
- Any extra-arg evaluation is explicit (and can preserve side effects where required).

### 5. Make expression contexts explicit (value vs effect)

**Action**
- Introduce nodes in IR (or annotated AST):
  - `CallValue` (must return exactly one value)
  - `CallEffect` (must return void; or returns value that is discarded explicitly)

**Acceptance**
- Statement lowering never emits `.drop` unless the IR node is “discard value”.

**Related**
- See `03_typed_ir_and_effects.md`.

### 6. Make void-in-value-context strictly diagnosed ✅ COMPLETE

**Action**
- Replace the current warn+coerce path for void calls in value contexts with a compiler error in strict mode (optionally retain a permissive flag for legacy behavior).

**Acceptance**
- [x] Value contexts only compile when a result-producing call is present or when an explicit coercion is emitted; stack safety never depends on implicit padding.

**Progress** ✅ COMPLETE
- [x] Codegen now records diagnostics for void-returning calls used in value contexts, and the CLI stops compilation when diagnostics exist (stack-safe coercion remains only to let later diagnostics surface).
- [x] Added a concrete signature for `Animate2` (returns `f32`) to match usage in SCPCB and avoid void-in-value diagnostics for animation frame assignments.
- **Result**: Zero stack underflow errors in tested codebase (8/8 files validated)

## Deliverables

- [x] A signature DB used consistently in: ✅ COMPLETE (2026-01-27)
  - [x] call lowering (via `SignatureResolver`)
  - [x] stack effect computation (integrated with `StackValidator`)
  - [x] statement/value context handling (diagnostics for void-in-value)
- [ ] A test suite:
  - [ ] default args (requires semantic pass implementation)
  - [ ] overload selection (deferred - not blocking SCPCB)
  - [x] array/call disambiguation (Verified in `ASTLowering` via symbol table)
  - [x] type conversion (Verified in `test_arg_conversion.bb`, real-world files)

## "No Invalid Drop" Safety Rule (must hold even before IR exists) ✅ IMPLEMENTED

**Status**: ✅ COMPLETE (2026-01-27, commits: c957360, 116a27d, dc079ca)

This rule has been successfully implemented and validated:
- [x] A call statement is lowered as `call` + optional `drop` **only if** the resolved signature's result count is 1 (or >0).
- [x] If signature resolution fails, compilation fails in strict mode (or produces a diagnostic and compiles with no drop in permissive mode, but that should be a deliberate switch).

**Evidence**:
- StackValidator now guards against drops on empty/underflow stack
- Function argument types converted correctly with WASM module fallback
- Zero "type mismatch in drop" errors across 8 tested files (100% validation rate)

**Files**: `Sources/Compiler/CodeGen/StackValidator.swift`, `ExpressionGeneration.swift`, `StatementGeneration.swift`
