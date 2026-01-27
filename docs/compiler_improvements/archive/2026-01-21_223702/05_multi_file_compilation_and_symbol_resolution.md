# 05 — Multi-File Compilation + Symbol Resolution (SCPCB Build Reality)

## Goal

Treat “a Blitz3D program” as a build unit, not a single file:
- Resolve `Include` statements into a deterministic compilation unit.
- Build global symbol tables for:
  - types + fields + layout
  - constants
  - globals
  - functions (including forward references)
- Generate one WASM module for the program entrypoint.

This is required for SCPCB because `Main.bb` includes nearly everything.

## Current State (observed)

- Include expansion is textual and recursive:
  - `../../../Sources/Compiler/Preprocessor/Preprocessor.swift`
- The compiler can compile individual `.bb` files, but cross-file type/field references can’t be resolved without compiling with includes.
- SCPCB include graph is deep and centralized:
  - `../../../../scpcb/Main.bb` (many `Include` lines)

## Progress

- CLI builds now call `Preprocessor.processWithMap` and pass line maps into the lexer/parser; this map can be reused when constructing merged-source units.
- Next: apply the same mapping + plumbing to an entrypoint/multi-file mode so include-expanded builds preserve spans and gain global symbol resolution.

## Plan

### 1. Formalize “compilation unit” construction

**Action**
- Add a compilation mode that:
  1) starts from entry file (e.g. `Main.bb`)
  2) resolves includes using:
     - entry directory
     - explicit include search paths (`-I`)
  3) produces a *file map*:
     - ordered list of sources (for determinism)
     - a merged source (optional) or multi-source parsing

**Why**
- Text concatenation alone makes it harder to preserve source mapping and to avoid accidental duplicate inclusion behaviors.
 - The current `Preprocessor` reads included files but does not appear to use its `includedFiles` set to prevent cycles or to provide diagnostics for repeated includes (`../../../Sources/Compiler/Preprocessor/Preprocessor.swift`).
 - Merged-source compilation also loses file/line provenance unless a mapping is maintained end-to-end (see `08_debuggability_source_maps_and_tracing.md`).

### 2. Two-phase analysis (collect, then lower)

**Phase A: Symbol collection**
- Parse all sources into ASTs.
- Collect:
  - type declarations (names, fields, dimensions, defaults)
  - function signatures (name, params, return)
  - globals and constants

**Phase B: Resolution + lowering**
- Resolve all references using the collected tables:
  - field offsets are known before codegen
  - function calls resolve to signatures (plan 02)
  - arrays resolve to array symbols

**Acceptance**
- Field access never falls back to “type resolution failed → drop pointer/value”.

### 3. Deterministic include behavior

Blitz3D include is “paste this text here”, but large projects often assume “include once” in practice.

**Action**
- Decide and document a policy:
  - strict textual semantics (include multiple times if written so)
  - or “include once” guard to avoid duplicate globals/types

**Recommendation**
- Start with strict textual semantics (most faithful), and add diagnostics for duplicates to help users.

**Practical compromise (often best for SCPCB-like projects)**
- Preserve textual semantics but add:
  - a cycle detector (error with include stack)
  - a “duplicate include” warning in dev mode (helps catch accidental double-include that redefines globals/types)

### 4. Source mapping across files

**Action**
- Ensure spans carry:
  - original filename
  - line/column in that file
  - and can be preserved through lowering (AST → IR → WASM)

**Refs**
- Source map support is present:
  - `../../../Sources/Compiler/CodeGen/SourceMapGenerator.swift`

### 5. SCPCB “one-command build”

**Action**
- Provide a documented command that builds SCPCB from `Main.bb` with includes.
- Store build artifacts and reports in a stable location.

**Cross-links**
- Runtime gaps needed after multi-file success:
  - `../../../../docs/BLITZ3D_RUNTIME_GAPS.md`
  - `../../../../docs/decls-compatibility.md`
