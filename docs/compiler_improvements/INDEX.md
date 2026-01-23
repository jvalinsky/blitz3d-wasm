# Blitz3D-WASM Compiler Improvements — Master Index

This directory contains long-form planning documents for improving the Blitz3D BASIC → WASM compiler and browser runtime, with an emphasis on:
- Always producing *WASM-valid* output
- High compatibility with real-world Blitz3D code (SCP:CB in particular)
- Clear, testable milestones
- Traceable references to the current codebase and existing research/docs

## Latest Plan Set

- `2026-01-21_223702/` — “State-of-the-art compiler + WASM correctness plan” (current)
  - Start here: `2026-01-21_223702/00_overview.md`

## How These Plans Are Organized

Each timestamped folder is a coherent “plan set” created at a specific point in time. Inside a plan set:
- `00_overview.md` explains the goals, scope, and milestones
- `0x_*.md` files are actionable plans grouped by theme
- `99_references.md` collects citations (repo docs, code locations, external specs)

## Categories (What To Read First)

### Correctness (WASM validity + typing)
- `2026-01-21_223702/01_wasm_validity_as_an_invariant.md`
- `2026-01-21_223702/02_signatures_defaults_and_call_semantics.md`
- `2026-01-21_223702/03_typed_ir_and_effects.md`

### Coverage (BB language completeness)
- `2026-01-21_223702/04_parser_hardening_and_error_recovery.md`
- `2026-01-21_223702/05_multi_file_compilation_and_symbol_resolution.md`

### Runtime parity (browser engine + DLL shims)
- `2026-01-21_223702/06_runtime_conformance_and_scpcb_priorities.md`

### Tooling (tests, fuzzing, diagnostics)
- `2026-01-21_223702/07_testing_fuzzing_and_differential.md`
- `2026-01-21_223702/08_debuggability_source_maps_and_tracing.md`

### Optimization (after correctness)
- `2026-01-21_223702/09_optimization_pipeline_after_correctness.md`

