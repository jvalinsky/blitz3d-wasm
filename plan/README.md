# Project Planning Index

**Start here**: [`00_GLOBAL_PLAN.md`](00_GLOBAL_PLAN.md) — vision, architecture,
phase roadmap (A: playable SCPCB on current runtime → B: self-contained Swift
engine takeover → C: production), milestones, and open decisions.

## Structure

```
plan/
├── 00_GLOBAL_PLAN.md          ← canonical master plan
├── subplans/
│   ├── 01_compiler.md             (continuous) Swift BB→WASM compiler maintenance
│   ├── 02_engine_swift.md         (Phase B)    Blitz3DEngine → SCPCB parity in Swift
│   ├── 03_browser_shim.md         (Phase A)    freeze-proof boot, watchdog, minimal JS
│   ├── 04_asset_pipeline.md       (Phase A)    drop-in scpcb checkout → dist/assets
│   ├── 05_scpcb_integration.md    (Phase A)    Web_* entrypoints, menu↔game milestones, mods
│   ├── 06_testing_ci.md           (continuous) test pyramid + CI gates
│   ├── 07_performance_deployment.md (Phase C)  budgets, compression, hosting
│   └── 08_native_host.md          (optional)   WasmKit/Metal runner pointer
├── native-swift-wasmkit/      ← detailed optional-track plans (wrapped by subplan 08)
├── compiler-runtime-comparison-2026-02-01/  ← reference analysis (read-only)
├── REFERENCE/                 ← architecture decisions, debug patterns
├── COMPLETED/                 ← finished plans (historical record)
└── ARCHIVED/                  ← superseded plans, incl. 2026-07-22-consolidation/
```

## Conventions

- Checklists: `- [ ]` / `- [x]`, add a `YYYY-MM-DD` note when completing
  significant items.
- Measurable acceptance criteria; "done" = the CI gate is green.
- Compiler metrics live **only** in `docs/COMPILER_STATUS_ANALYSIS.md` — link,
  never copy.
- Log goals/decisions/actions/outcomes in deciduous in real time; link commits
  (`--commit HEAD`).
- New plans go in `subplans/`; superseded plans move to `ARCHIVED/` (never
  deleted).

## History

- **2026-07-22**: All prior plans consolidated into the global plan + subplans.
  Previous active plans (`ACTIVE/`, `scpcb-web-track-b/`, the 2026-02-02
  WASM-owns-UI plan, root-level fix plans) are archived under
  `ARCHIVED/2026-07-22-consolidation/` with their open items absorbed into the
  subplans — see the Plan Inventory table in `00_GLOBAL_PLAN.md`.
- Earlier history: `COMPLETED/` (Phases 1–3, Feb 2026) and `ARCHIVED/legacy-*`.
