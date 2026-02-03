# Plan Directory

Implementation roadmaps and phase plans.

## Current Phases

| Track | Location | Status |
|------:|----------|--------|
| A | `ACTIVE/` | Active workstreams |
| B | `scpcb-web-track-b/` | Active (SCPCB web port checklists) |
| — | `COMPLETED/` | Completed plan snapshots |
| — | `ARCHIVED/` | Historical/legacy plan snapshots |

## Long-term Plans

- `REFERENCE/SCPCB_STRATEGY/SCPCB_FULL_IMPLEMENTATION_PLAN.md` — Legacy comprehensive SCPCB strategy (reference)
- `ARCHIVED/legacy-scpcb/` — Superseded SCPCB deployment/technical plans (historical reference)
- `ARCHIVED/legacy-phases/` — Original phase plan set (historical reference)

## Archived

Old dated plans in `archive/`.

## 2026-02-02 note

- BB→WASM smoke tests live at `Tests/deno_smoke/` and are executed by `Tools/tests/bb_deno_compile_and_run_smoke.test.ts`.
- Web “safe runner” execution (Worker + watchdog timeout) is now the default for interpreter-style demos.
