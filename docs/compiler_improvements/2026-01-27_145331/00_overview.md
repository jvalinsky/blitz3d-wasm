# Compiler Improvements Plan Set — 2026-01-27_145331

This plan set captures the current state of the Blitz3D BASIC → WASM compiler
and lays out the next steps to reach **reliably wasm-valid output** for
SCP:CB-scale code.

## Snapshot (Code State)

**Date**: 2026-01-27

**Known-good regressions (tests)**

- `swift test --filter CFGBuilderTests`
- `swift test --filter RelooperStateMachineTests`

**Recent correctness wins (already landed)**

- Control-flow graph construction is now deterministic and supports forward
  gotos + loop `break/continue` targets.
- Relooper lowering is a deterministic **state-machine** loop (no `br_table`
  expectation).
- IR emission pre-registers all function indices before emitting bodies (fixes
  forward calls).
- Calls/assignments are coerced/padded based on declared signatures to avoid
  stack/type drift.
- Several runtime / lowering issues were corrected (string concat symbol,
  dynamic array alloc, array index coercion).

## Current Blocking Issue (Still Failing wasm-tools Validate)

Compiling SCP:CB `MapSystem.bb` through the IR pipeline still produces a wasm
validation error:

- `type mismatch: expected i32, found f32`
- reported at `func 549` and `offset 0x27383` (in the last observed build)

This plan set focuses on turning that single “first failure” into a
**reproducible, diagnosable, and fixable** workflow until validation passes.

## Repro Commands (Reference Workflow)

From `blitz3d-wasm/`:

```bash
swift build -c debug
.build/arm64-apple-macosx/debug/blitz3d-wasm ../scpcb/MapSystem.bb --use-ir -o /tmp/MapSystem_ir.wasm
wasm-tools validate /tmp/MapSystem_ir.wasm
```

When validation fails, capture details:

```bash
wasm-tools validate /tmp/MapSystem_ir.wasm 2> /tmp/MapSystem_ir.validate.txt
# optional inspection helpers
wasm-tools print /tmp/MapSystem_ir.wasm > /tmp/MapSystem_ir.print.wat
wasm-objdump -x /tmp/MapSystem_ir.wasm > /tmp/MapSystem_ir.objdump.txt
```

## Next Milestones

1. **Make wasm-tools errors actionable**: map `(func index, byte offset)` to a
   _named compiler stage and IR node_.
2. **Add type-aware stack simulation** for IR→WASM lowering and emitter
   (debug-only, opt-in).
3. **Fix the first mismatch** and lock it in with a regression test that
   validates produced wasm.
4. Repeat until `MapSystem.bb` validates.

## Documents In This Plan Set

- `01_state_of_codebase.md` — what’s complete vs remaining; specific file
  touchpoints.
- `02_validation_debugging_workflow.md` — how to go from validate error →
  minimal repro.
- `03_next_fixes_queue.md` — prioritized queue of likely mismatch sources and
  the tests to add.
- `04_plan_maintenance.md` — ongoing doc hygiene (archiving, plan updates,
  AGENTs.md, etc.).
