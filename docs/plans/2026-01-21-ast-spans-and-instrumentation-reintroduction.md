---
title: "Plan: Re-introduce Source Spans + bbdbg Instrumentation (Safe Pass)"
status: "completed"
last_updated: "2026-01-21"
---

# Why this plan

This plan was written as a “safe pass” for reintroducing spans after a failed refactor.

As of `2026-01-21`, the migration has been completed and the compiler builds clean with:
- `StatementNode` and `ExpressionNode` carrying `SourceSpan` at the enum layer
- Parser and CodeGen updated to match the new case arity

For the implementation-level repair notes and failure modes (tuple-pattern matching, missing span args, arity mismatches), see:
- `blitz3d-wasm/plan/2026-01-21-span-carrying-ast-migration-repair.md`

# Goals

1) Add `SourceLocation` / `SourceSpan` tracking to AST + parser without breaking the build.
2) Align CodeGen to new shapes with minimal churn.
3) Leave room for bbdbg instrumentation (Phase 3 of the master plan) without destabilizing Phase 1.

# Constraints

Historical constraints (no longer true):
- “tree has no spans”
- “parser/codegen match no-span arity”

# Incremental steps (do in order)

All steps above are now complete in the codebase. The remaining work is to actually *use* spans for debugging output.

# Next steps (what remains for bbdbg)

1) Compiler `--debug` flag:
   - emit bbdbg event imports (`bbdbg.enter`, `bbdbg.stmt`, `bbdbg.leave`)
   - inject calls at statement boundaries (and optionally at block/function boundaries)
2) Emit `program.bbdbg.json`:
   - stable `stmtId` → `{ file, line, col }` from `SourceSpan`
   - optional `funcId` table with function names and spans
3) Ensure stepping semantics:
   - loops and branches produce correct event sequences
   - function calls/returns produce correctly nested enter/leave

Primary refs:
- `docs/plans/2026-01-21-bbdbg-live-events-integration.md`
- `docs/plans/2026-01-21-bb-wasm-debugger-visualizer.md`

# Risk mitigation

The migration phase had the highest churn risk. With spans integrated and the build green, the main risk moves to:
- emitting events without destabilizing stack/branch typing (keep instrumentation behind `--debug`)
- keeping `stmtId` stable (don’t base ids on WASM function index; base them on traversal order in the parsed AST)

# Acceptance for this pass

- Compiler builds clean with span-carrying AST enums.
- Parser emits spans for synthesized expressions and postfix constructs (field access, call, array access).
- CodeGen compiles clean with the new enum arity and can now consume spans for diagnostics and bbdbg mapping.

---

Checklist (to tick as we go):
- [x] Step 1: Struct spans added, default `.unknown`.
- [x] Step 2: Parser populates spans (but enums unchanged).
- [x] Step 3: Enums carry spans, CodeGen aligned.
- [x] Step 5: Sanity builds/tests on a small `.bb`.
