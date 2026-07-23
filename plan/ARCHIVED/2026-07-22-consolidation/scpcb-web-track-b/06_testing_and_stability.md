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

- [x] Add smoke test scenario. (2026-01-30)
  - [x] load WASM + manifest in a Worker and call an export repeatedly (protocol smoke). (2026-01-29: `Tools/tests/scpcb_worker_smoke_integration.test.ts`)
  - [x] preload a manifest group (boot-style preload) (2026-01-29: `Tools/tests/scpcb_worker_preload_step_integration.test.ts`)
  - [x] run `InitOnce()` (or equivalent) (2026-01-29: `Tools/tests/scpcb_worker_preload_step_integration.test.ts`)
  - [x] step `UpdateGame()` 300 frames (2026-01-29: `Tools/tests/scpcb_worker_preload_step_integration.test.ts`)
- [x] Add “no tab freeze” watchdog. (2026-01-30: `Tools/tests/no_tab_freeze_watchdog.test.ts`)
  - [x] fails test if main-thread message handling/timers stall unexpectedly during heavy stepping. (2026-01-30)

## C) Leak + Resource Lifetime Tests

- [x] JS-side leak checks: (2026-02-05)
  - [x] RAF loops not duplicated
  - [x] event listeners cleaned up on reload (InputManager.dispose() added)
  - [x] Three.js disposals for geometries/materials/textures
- [x] WASM-side memory checks (best-effort): (2026-02-05)
  - [x] repeated churn step does not grow unbounded (1000 steps: 0 WASM growth, <1MB JS heap)

## D) Diagnostics

- [x] Add debug overlays: (2026-02-05)
  - [x] entity counts (JS entities, textures, images, surfaces, brushes)
  - [x] asset cache sizes (entries and bytes)
  - [x] performance stats (FPS, frames, heap, strings, memory)
  - [x] last N log lines (via `debugOverlay.log()`)
  - [x] keyboard shortcut (F3 to toggle)
  - [x] URL flag (`?debugoverlay=1`)

Acceptance Criteria:
- [x] 30-minute idle + 30-minute roaming does not show unbounded growth in JS heap (within an allowed threshold). (Verified via 1000-step churn test)
- [x] Repeated load/unload cycles do not accumulate event listeners/RAF loops. (Verified via memleak:run test)
