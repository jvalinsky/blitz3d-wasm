---
title: "Overview Plan: SCPCB Browser Parity (Compiler + Runtime + Debugging)"
status: "draft"
created_at: "2026-01-21T18:48:14Z"
last_updated: "2026-01-21T23:10:00Z"
---

# Purpose

Single “master” overview that ties together:

- full SCP:CB browser parity execution plan,
- BB↔WASM debugging (bbdbg + mapping),
- standard WASM debug metadata (name/producers/build-id/source maps/DWARF),
- a practical sequencing and acceptance-gate structure (so we don’t do Phase 4 work on a Phase 1 foundation).

Primary supporting docs (read these first when implementing):
- `docs/plans/2026-01-21-scpcb-browser-100-percent-plan.md`
- `docs/plans/2026-01-21-compiler-debug-artifacts.md`
- `docs/plans/2026-01-21-bbdbg-live-events-integration.md`
- `docs/plans/2026-01-21-bb-wasm-debugger-visualizer.md`
- `docs/plans/2026-01-21-blitz3d-wasm-wasm-debug-info-implementation-checklist.md`
- Runtime/import surface context: `docs/plans/2026-01-21-wasm-runtime-100-percent-shim.md`
- Span migration repair notes (implementation-level): `blitz3d-wasm/plan/2026-01-21-span-carrying-ast-migration-repair.md`

# Key principles (non-negotiable)

1) **Always-valid WASM first**: validator/stack/type issues are Phase 1 blockers; don’t “shim around” invalid modules.
2) **Import ABI is a contract**: keep a single authoritative source of truth for signatures; avoid ad-hoc fixes in JS.
3) **Debug stepping v1 = bbdbg**: don’t block correct stepping on DWARF/browser support variability.
4) **Vertical slice integration**: keep one continuously-working demo target (walking + doors) as the integration harness.

# Current snapshot (evidence-based, as of timestamp)

## Repo artifacts / demos

- SCPCB compile run summaries exist: `blitz3d-wasm/compile_errors_*.json` (e.g. `blitz3d-wasm/compile_errors_20260120_210153.json`).
- Browser demos we should use as harnesses:
  - facility walk slice: `blitz3d-wasm/Examples/scpcb_facility_walk/`
  - debugger demo: `blitz3d-wasm/Examples/wasm-debugger-blitz3d/`
  - known-good movement reference: `blitz3d-wasm/Examples/site19_terminal/`
- Compiler span migration is now unblocked and builds clean:
  - `StatementNode` and `ExpressionNode` carry `SourceSpan` (enum-level).
  - Parser and CodeGen are aligned to the new arity.
  - Local build evidence: `/tmp/swift_build4.log` shows `Build of product 'blitz3d-wasm' complete!`.

## Compiler features we already have (important to not re-plan)

- Power operator is already tokenized and parsed:
  - token: `blitz3d-wasm/Sources/Compiler/Lexer/Token.swift` (`.power`)
  - parse: `blitz3d-wasm/Sources/Compiler/Parser/Parser.swift` (`parsePowerExpression`)
- Math keywords are already tokenized: `blitz3d-wasm/Sources/Compiler/Lexer/Token.swift` (`Abs`, `Sgn`, `Mod`, `Pi`).
- `^`/`Pow` codegen exists but currently relies on `context.functionIndexMap["pow"]` and has a weak fallback:
  - `blitz3d-wasm/Sources/Compiler/CodeGen/ExpressionGeneration.swift`
  - follow-up required: guarantee import exists and/or implement a correct fallback (no “half-built stack” returns).

# Immediate status update (what changed since the first draft)

The “spans + debugger foundations” work is no longer speculative. The compiler is back to a buildable state with span-carrying enums, so Phase 3 (bbdbg) can proceed without the previous structural churn risk.

Related doc note:
- `docs/plans/2026-01-21-ast-spans-and-instrumentation-reintroduction.md` is now **historical** (it describes an earlier incremental approach when spans were not yet integrated). Keep it as a record, but treat the current source tree as “spans are present”.

# Phased plan with gates

## Phase 0 — Baseline + scoreboard (1 day)

Goal: measurable progress and stable reproduction.

Deliverables:
- A single “scoreboard” report format:
  - % SCPCB files compiling
  - % validating (`wasm-validate`)
  - top error categories (parse/type/stack/import/runtime)
  - list of failing files with first failure reason
- Choose and freeze a **vertical slice** harness:
  - `blitz3d-wasm/Examples/scpcb_facility_walk/` (walking + collisions + doors)

Gate:
- Every change is validated against the vertical slice build + run path, even if full SCPCB still fails.

## Phase 1 — Compiler correctness: parse + types + stack discipline (must-pass)

Goal: “compiler produces valid WASM modules” for the target subset, and gives actionable errors for the rest.

Workstreams:

### 1A) Syntax/AST completion for SCPCB (only what SCPCB uses)
- Fix remaining SCPCB parse blockers (examples from compile logs; avoid speculative keyword additions).
- Harden identifier-as-statement handling (standalone engine calls) only when a compile log shows it failing.

### 1B) Stack/type discipline (validator blockers)
- Eliminate “blind drops” and type-mismatch-at-drop failures by construction.
- Add compiler diagnostics output to accelerate iteration:
  - error span (file/line/col),
  - stack effect expectation vs actual,
  - inferred type at the failing node,
  - chosen import signature at call sites.

References:
- `docs/COMPILER_STACK_BALANCING.md`
- `docs/plans/2026-01-21-scpcb-browser-100-percent-plan.md`

Gate:
- Vertical slice `.bb` compiles and `wasm-validate` succeeds.
- Compiler failures outside the slice include precise source spans and a stable error category.

## Phase 2 — Authoritative import registry + runtime-shim parity (continuous)

Goal: stop chasing import mismatches one-by-one.

Workstreams:

### 2A) Import discovery + registry
- Automated scan of `scpcb/**/*.bb` to produce “required imports” with call-site contexts.
- A single canonical signature table (compiler + runtime share it).
- CI-ish check: “required ⊆ provided” for the vertical slice.

### 2B) Runtime shim implementation (prioritized by vertical slice)
- Prioritize systems needed for facility-walk playability:
  - input → camera movement
  - collisions/physics → stable ground contact + gravity
  - doors → interaction + animation
  - asset I/O → meshes/textures/sounds

Reference:
- `docs/plans/2026-01-21-wasm-runtime-100-percent-shim.md`

Gate:
- Vertical slice instantiates with **no missing imports** and runs deterministically for 2+ minutes without NaNs/exploding state.

## Phase 3 — Debugging v1: bbdbg live stepping (unblocks hard logic bugs)

Goal: correct control-flow stepping (loops/calls/returns) in browser tools, not a “fake trace”.

Deliverables:
- Compiler `--debug` mode emits:
  - `program.wasm` instrumented with `bbdbg.enter/stmt/leave`
  - `program.bbdbg.json` mapping
  - `program.wat` (debug convenience)
- `wasm-debugger-blitz3d` consumes live events and implements:
  - Step / Step Over / Step Out / Continue
  - breakpoint by `stmtId` (line → stmt mapping)

References:
- `docs/plans/2026-01-21-compiler-debug-artifacts.md`
- `docs/plans/2026-01-21-bbdbg-live-events-integration.md`
- `docs/plans/2026-01-21-bb-wasm-debugger-visualizer.md`

Gate:
- Stepping follows real semantics for a non-trivial script (loops + function calls) compiled by our compiler.

Implementation pre-reqs now satisfied:
- AST spans are available at statement/expression granularity (compiler can emit stable `stmtId` + span mapping).
- Parser and CodeGen build clean with the new AST shape.

## Phase 4 — Vertical slice parity: “walking simulator + doors”

Goal: a genuinely playable in-browser facility segment that matches Blitz3D/SCP:CB behavior closely enough to be trustworthy.

Deliverables (minimum):
- robust spawn inside “real playable interior” geometry
- correct axis/coord system mapping (Blitz3D ↔ three.js) applied consistently
- stable collisions + gravity (no “float until move”, no tunneling through floor)
- interactable door buttons + door open/close state machine + animation

Reference:
- `docs/scpcb_facility_walk_demo.md`

Gate:
- Walk from point A → B, open/close at least one door, no clipping through floor during normal movement.

## Phase 5 — Expand to full-game parity (iterative)

Goal: broaden from the vertical slice to full SCPCB coverage with the debugger available.

Workstreams:
- map generation + room transitions
- UI/menu + inventory
- items + interactions
- NPCs + events + scripting
- audio + subtitles
- saves/loads

Reference:
- `docs/plans/2026-01-21-scpcb-browser-100-percent-plan.md`
- systems docs: `docs/scpcb_systems_doors_npcs_items.md`

Gate:
- Reach menu → start game → survive 10 minutes in a typical run without fatal errors.

## Phase 6 (optional) — Standard WASM debug info (name/producers/source maps/DWARF)

Goal: improve tooling interoperability and future-proofing; do not block Phase 3 bbdbg stepping.

Deliverables (recommended order):
1) `name` section (readable stack traces/disassembly)
2) `producers` + `build_id` (traceability)
3) offset capture in encoder (enables source maps/DWARF)
4) `sourceMappingURL` + `.wasm.map` (optional)
5) DWARF line tables (optional; large scope)

Reference:
- `docs/plans/2026-01-21-blitz3d-wasm-wasm-debug-info-implementation-checklist.md`

# “Next 7 days” concrete checklist (starter sprint)

1) Freeze vertical slice inputs/assets for `scpcb_facility_walk` (no more switching meshes mid-debug unless it’s the bug).
2) Add/maintain a scoreboard generated from `blitz3d-wasm/compile_errors_*.json`.
3) Make validator failures (especially drop/type mismatches) a hard gate for the slice.
4) Lock import signatures for the slice (stop runtime signature drift).
5) Get bbdbg `--debug` emission + live capture working end-to-end in `wasm-debugger-blitz3d`.
