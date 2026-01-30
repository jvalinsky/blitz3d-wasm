# Plan 06 — Testing + Long-Run Stability (Leaks, Freezes, Regressions)

Created: 2026-01-29
Last updated: 2026-01-30

Goal: catch regressions early and ensure the port can run for long sessions without leaks or freezes.

## A) Deno Tests (Hermetic)

- [x] SMPK codec tests. (2026-01-29)
- [x] `.b3d/.x/.rmesh` conversion integration tests. (2026-01-29)
- [x] CMDB wasm export contract tests. (2026-01-29: `Tools/cmdbuf_wasm_check.ts` + `Tools/tests/cmdbuf_wasm_check.test.ts`)
- [x] Add tests for key build/runtime contracts. (2026-01-30)
  - [x] “manifest references exist on disk” (for dist build output) (2026-01-29: `Tools/validate_manifest_files.ts` + `Tools/tests/validate_manifest_files.test.ts`)
  - [x] “SMPK materials reference present textures” (policy-based) (2026-01-30: `Tools/validate_smpk_material_textures.ts` + `Tools/tests/smpk_material_textures_validator.test.ts`)

## B) Browser Integration Tests

- [ ] Add smoke test scenario:
  - [x] load WASM + manifest in a Worker and call an export repeatedly (protocol smoke). (2026-01-29: `Tools/tests/scpcb_worker_smoke_integration.test.ts`)
  - [x] preload a manifest group (boot-style preload) (2026-01-29: `Tools/tests/scpcb_worker_preload_step_integration.test.ts`)
  - [x] run `InitOnce()` (or equivalent) (2026-01-29: `Tools/tests/scpcb_worker_preload_step_integration.test.ts`)
  - [x] step `UpdateGame()` 300 frames (2026-01-29: `Tools/tests/scpcb_worker_preload_step_integration.test.ts`)
- [ ] Add “no tab freeze” watchdog:
  - [ ] fails test if RAF loop stalls unexpectedly

## C) Leak + Resource Lifetime Tests

- [ ] JS-side leak checks:
  - [ ] RAF loops not duplicated
  - [ ] event listeners cleaned up on reload
  - [ ] Three.js disposals for geometries/materials/textures
- [ ] WASM-side memory checks (best-effort):
  - [ ] repeated churn step doesn’t grow unbounded

## D) Diagnostics

- [ ] Add debug overlays:
  - [ ] current room name
  - [ ] entity counts (JS + WASM)
  - [ ] asset cache sizes
  - [ ] last N log lines (already partially present via `?debug`)

Acceptance Criteria:
- [ ] 30-minute idle + 30-minute roaming does not show unbounded growth in JS heap (within an allowed threshold).
- [ ] Repeated load/unload cycles do not accumulate event listeners/RAF loops.
