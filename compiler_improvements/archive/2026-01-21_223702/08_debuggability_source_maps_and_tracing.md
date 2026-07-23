# 08 — Debuggability: Source Maps, Tracing, and Determinism

## Goal

Make it fast to debug both compiler bugs and game/runtime bugs:

- Errors should point to BB source spans, not WASM offsets.
- Developers should be able to trace execution with enough fidelity to diagnose
  logic errors.
- Determinism tools should make “replay the same bug” possible.

## Current State (observed)

- There is a source mapping generator and a compiler knob that disables
  optimization when mapping is enabled:
  - `../../../Sources/Compiler/CodeGen/SourceMapGenerator.swift`
  - `../../../Sources/Compiler/CodeGen/CodeGenerator.swift`
    (`enableSourceMapping`)

## Plan

### 1. End-to-end span propagation

**Action**

- Ensure spans survive:
  - Preprocessor include -> per-file spans
  - Parser -> AST spans
  - AST -> IR spans
  - IR -> WASM (instruction annotations or side tables)

**Acceptance**

- Any compiler error can print `file:line:col` and the relevant BB snippet.

**Progress**

- Preprocessor now has an opt-in `processWithMap` that returns merged source
  plus a line map back to original files/lines
  (`../../../Sources/Compiler/Preprocessor/Preprocessor.swift`).
- The CLI entry (`Tools/wasm-cli/main.swift`) now uses `processWithMap` and
  passes the line map into the parser/lexer so tokens reflect original
  file/line.
- **Next:** Reuse the line map in entrypoint/multi-file builds and thread it
  into source-map generation so merged includes keep correct spans.

### 2. WASM offset → BB span mapping

**Action**

- Add a build mode that emits:
  - a sidecar JSON map from function + instruction index (or PC range) to BB
    span
  - function name section for easier WAT debugging

### 3. Trace hooks (developer mode)

**Action**

- Provide optional runtime hooks:
  - log calls to selected functions (by name)
  - log variable reads/writes (for a narrow set)
  - log state machine transitions (useful for SCPCB)

### 4. Determinism controls

**Action**

- Ensure `SeedRnd` and any time-based functions can be controlled:
  - fixed seed
  - fixed tick delta

**Why**

- Debugging gameplay often depends on replaying the same random sequence.

## References

- System-call semantics guidance:
  - `../../../../docs/spec_system_calls.md`
