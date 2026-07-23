# Plan Directory

Implementation roadmaps and phase plans.

**Canonical entry point**: `00_GLOBAL_PLAN.md` (vision, architecture, Phase
A/B/C roadmap, milestones, open decisions). Task-level checklists live in
`subplans/01…08`.

## Layout

| Location                                  | Status                                                                                                                     |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `00_GLOBAL_PLAN.md`                       | Canonical master plan (2026-07-22)                                                                                         |
| `subplans/`                               | Active subplans 01–08 (compiler, Swift engine, browser shim, assets, SCPCB integration, testing, perf/deploy, native host) |
| `native-swift-wasmkit/`                   | Optional-track detail plans (wrapped by `subplans/08_native_host.md`)                                                      |
| `compiler-runtime-comparison-2026-02-01/` | Reference analysis (read-only)                                                                                             |
| `REFERENCE/`                              | Architecture decisions, debug patterns, legacy SCPCB strategy                                                              |
| `COMPLETED/`                              | Completed plan snapshots                                                                                                   |
| `ARCHIVED/`                               | Superseded plans — incl. `2026-07-22-consolidation/` (former `ACTIVE/`, `scpcb-web-track-b/`, root fix plans)              |
| `archive/`                                | Old dated plans                                                                                                            |

## Notes

- BB→WASM smoke tests live at `Tests/deno_smoke/` and are executed by
  `Tools/tests/bb_deno_compile_and_run_smoke.test.ts`.
- Web "safe runner" execution (Worker + watchdog timeout) is the default for
  interpreter-style demos.
