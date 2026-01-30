# Plan 03 — Boot/Init + Main Loop Refactor (No Tab Freezes)

Created: 2026-01-29
Last updated: 2026-01-30

Goal: prevent blocking loops; make initialization resumable; keep the tab responsive.

## A) Entry Points + Modes

- [ ] Define supported entrypoints for web:
  - [ ] `InitOnce()` (fast, no blocking loops)
  - [ ] `UpdateGame(dt)` (single step)
  - [ ] `RenderStep()` (optional, if split)
- [x] Keep unsafe entrypoints opt-in only. (2026-01-29)
  - [x] `Main()` behind `?run=main`/`?init=main` style flags / UI buttons (paused default). (2026-01-29)

## B) Preload + Sync IO Requirements

- [ ] Identify files required before init completes:
  - [x] `options.ini` (2026-01-30: in `web/public/scpcb_manifest.json` boot group)
  - [x] `Data/rooms.ini` and other room defs (2026-01-30: `Data/rooms.ini` in `web/public/scpcb_manifest.json` init group)
  - [ ] any early textures/fonts/sfx used during init
- [x] Ensure manifest groups cover these and preload completes before calling init steps. (2026-01-29: loader preloads `init` group before `Main()` when `?init=main` is used.)

## C) State Machine (JS-side)

- [x] Implement explicit boot state machine. (2026-01-29: `web/src/shared/boot_state_machine.ts` + `web/src/main.ts`)
  - [x] `LOAD_WASM` (2026-01-29)
  - [x] `PRELOAD_BOOT` (2026-01-29)
  - [x] `INIT` (modeled; still needs more SCPCB-safe init entrypoints) (2026-01-29)
  - [x] `PRELOAD_FACILITY_ASSETS` (optional incremental) (2026-01-29)
  - [x] `RUNNING` (2026-01-29)
  - [x] `PAUSED` (2026-01-29)
- [x] Add watchdogs: (2026-01-29)
  - [x] “no progress” timeout with diagnostics (2026-01-29: updates loader detail; logs `[boot] ...`)
  - [x] “max frame dt” clamp + warning (2026-01-29: clamps `MilliSecs/MilliSecs2` deltas in main thread + worker)

## D) Remove/Refactor Blocking UI

- [x] Default: launcher disabled (`LauncherEnabled=0`) unless explicitly enabled. (2026-01-29: forced unless `?launcher=1`.)
- [ ] Replace “press any key” loops with:
  - [ ] a single-step gate that checks an input flag
  - [x] JS can prime a synthetic input so init via `Main()` can exit tight loops. (2026-01-29)

Acceptance Criteria:
- [ ] Default page load never blocks; user can always open devtools and the UI stays responsive.
- [ ] Manual stepping works reliably for init debugging.
