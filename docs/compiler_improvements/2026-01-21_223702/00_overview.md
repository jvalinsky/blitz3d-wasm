# Compiler Improvements Plan Set (2026-01-21_223702)

## Summary

This plan set focuses on making the Swift `blitz3d-wasm` compiler and its browser runtime:
1) **Correct by construction for WASM validation** (no “patch it with drops” heuristics)
2) **Semantically faithful** to Blitz3D BASIC (enough to run large projects)
3) **Practical for SCP: Containment Breach (SCPCB)** as the primary real-world benchmark

The immediate motivation for this plan set is the class of failures where we emit `.drop` without a value (validator errors like “type mismatch in drop … got []”), and the broader need to make call typing/signatures a single source of truth so stack/typing cannot drift.

## Pivot Status - Jan 22 2026

**Critical Update:** We have pivoted from "incremental patching" to **Plan 03 (Typed IR)** as the immediate priority.

**Why?**
The "Auto-Import" experiment (attempting to stub missing functions by guessing signatures) failed validation catastrophically. The current AST-to-WASM pipeline cannot reliably handle:
1.  **Stack Balancing:** `If`/`While` conditions leak values because the generator doesn't track "consumed vs produced" states.
2.  **Type Promotion:** `Float#` literals are incorrectly truncated to `i32` because type fidelity is lost during lowering.
3.  **Arity Mismatches:** Inferred signatures conflict across call sites, breaking stack integrity.

We determined that continuing to patch `StatementGeneration.swift` is unsustainable. A structured, Typed IR is required to guarantee stack-neutral statements and correct type conversions by construction.

## Current State (as observed in-repo)

- The compiler is a full pipeline:
  - Include preprocessor: `../../../Sources/Compiler/Preprocessor/Preprocessor.swift`
  - Lexer/parser: `../../../Sources/Compiler/Lexer/*`, `../../../Sources/Compiler/Parser/Parser.swift`
  - Codegen + imports: `../../../Sources/Compiler/CodeGen/*` (notably `CodeGenerator.swift`, `ExpressionGeneration.swift`, `StatementGeneration.swift`)
- There is already stack/type validation infrastructure in-tree:
  - Stack validator: `../../../Sources/Compiler/CodeGen/StackValidator.swift`
  - Stack optimization pass: `../../../Sources/Compiler/CodeGen/StackScheduler.swift`
  - Prior research/docs: `../../../docs/STACK_BALANCE_HEURISTICS.md`, `../../../../docs/COMPILER_STACK_BALANCING.md`

## Immediate Stabilization (recommended first step)

Before larger refactors (typed IR, full semantic pipeline), there are a few high-leverage correctness fixes suggested by the current code shape:

- [x] **Eliminate “return type heuristics” at call sites**
  - Today `generateFunctionCall` used a mix of sources-of-truth (registered defs, module type inspection, and name-based heuristics) and then reported a `type` upward to statement lowering (`../../../Sources/Compiler/CodeGen/ExpressionGeneration.swift`, `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`).
  - We now prefer registered signatures/actual WASM types and removed the dummy “void -> i32” insertion (commit: SignatureResolver + call drop hardening).

- [x] **Make “void vs value” explicit at the statement boundary**
  - Statement lowering now drops only when the *resolved signature* has results (or, if unknown, when the generated value is non-void).

- [x] **Use the existing signature maps, don’t add new parallel truth**
  - Added `SignatureResolver` wrapper over `functionDefinitions`/`functionDefinitionsByIndex`/`functionIndexMap` to centralize lookup (no new parallel map).

- [x] **Preprocessor/source mapping gap**
  - The `Preprocessor` now exposes `processWithMap` to produce merged source plus a map from merged offsets back to original files/lines (`../../../Sources/Compiler/Preprocessor/Preprocessor.swift`).
  - CLI builds route the map through the parser/lexer so tokens retain original file/line provenance.
  - **Next:** Apply the same plumbing to entrypoint/multi-file builds so includes compiled as one unit still carry accurate spans.

- [ ] **Audit known “stack consumer” sequences in statement lowering**
  - Some statement lowering patterns can accidentally consume a value intended for a later instruction (e.g., emitting a `.drop` and then emitting another instruction that expects to consume the same condition).
  - These are best addressed by making conditions and stack effects explicit (Plan 03), but they’re also good immediate audits in `../../../Sources/Compiler/CodeGen/StatementGeneration.swift`.

## Near-Term Next Steps (Superseded by Plan 03)

- **[CANCELLED]** Audit statement lowering for stack hazards in complex control-flow paths (condition reuse, nested branches) to prevent accidental value consumption. (Moved to IR Lowering)
- **[COMPLETED]** Tighten diagnostics for `void` calls in value contexts: move from warn+coerce to a hard error or a strict/permissive switch. **Done:** codegen now emits a diagnostic for void-in-value contexts and the CLI aborts when diagnostics are present (stack-safe coercion retained only to keep generation progressing).
- **[COMPLETED]** Run a targeted compile/validate on a previously failing SCPCB file (e.g., `scpcb/UpdateEvents.bb`) to confirm drop-related validator errors are reduced. **Update:** passes `wasm-validate` after fixing typed `for` lowering and wiring correct signatures/imports/runtime stubs for SCPCB helpers.
- **[DEFERRED]** Start plumbing `processWithMap` into an entrypoint/multi-file compilation mode so includes are resolved as one unit with global symbol resolution and preserved spans.

## High-Level Roadmap

This plan set is structured in dependency order:

1.  **[ACTIVE] Introduce a typed IR + effect system** (Was #3)
    - Eliminate “expression vs statement” ambiguity.
    - Ensure all statements have net stack effect 0 (by construction).
    - Plan: `03_typed_ir_and_effects.md`

2.  **Make WASM validity an invariant** (Was #1)
    - A module either compiles to valid WASM or the compiler reports a specific error with a source span.
    - No “guess and drop” behavior.
    - Plan: `01_wasm_validity_as_an_invariant.md`

3.  **Unify call typing: signatures + defaults + call semantics** (Was #2)
    - Every call site uses a resolved signature.
    - Optional args/defaults are expanded before emitting WASM.
    - Plan: `02_signatures_defaults_and_call_semantics.md`

4.  **Harden parser + error recovery**
   - Single-line `If` + `:` chains + `ElseIf` should parse deterministically.
   - Plan: `04_parser_hardening_and_error_recovery.md`

5. **Multi-file compilation and symbol resolution**
   - Treat SCPCB as “Main.bb + includes” as a single build unit.
   - Plan: `05_multi_file_compilation_and_symbol_resolution.md`

6. **Runtime conformance plan**
   - Systematically implement the runtime surface SCPCB needs (VFS/ZIP, picking, audio, particles).
   - Plan: `06_runtime_conformance_and_scpcb_priorities.md`

7. **Testing + fuzzing + differential**
   - Plan: `07_testing_fuzzing_and_differential.md`

8. **Debuggability**
   - Source maps, tracing, determinism tooling.
   - Plan: `08_debuggability_source_maps_and_tracing.md`

9. **Optimization (only after correctness)**
   - Plan: `09_optimization_pipeline_after_correctness.md`

## Milestones (with acceptance criteria)

### Milestone A — “Always wasm-valid”
- The compiler emits *no invalid WASM* for the supported feature set.
- All `.drop` instructions are proven-correct (never “drop from empty stack”).
- CI/test runner classifies failures as: parse error, semantic error, unsupported feature, runtime missing import — not wasm-validator errors.

### Milestone B — “SCPCB compiles as one unit”
- `scpcb/Main.bb` (with includes) compiles into a single module with stable results.
- Type layouts, fields, constants, and function declarations resolve across files.

### Milestone C — “SCPCB boots in browser”
- Assets load (ZIP/VFS), menu renders, input works.

## References

See `99_references.md` for the full reference list used in this plan set.
