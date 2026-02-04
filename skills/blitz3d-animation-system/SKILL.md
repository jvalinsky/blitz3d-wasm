---
name: blitz3d-animation-system
description: Implement and debug Blitz3D skeletal animation semantics in Blitz3D-WASM and the SCPCB web port, including frame-based SetAnimTime/AnimTime behavior, Animate/UpdateWorld-style playback, SMPK animation metadata (fps/sequences), and correct Three.js mixer/action integration across main thread and Web Worker runtimes.
---

# Blitz3D Animation System (SCPCB-focused)

## Ground truth: how SCPCB drives animation

- SCPCB advances animation **in game logic** using frame units and `FPSfactor`, then calls `SetAnimTime entity, frame`.
  - See `../scpcb/Main.bb` functions `AnimateNPC`, `SetNPCFrame`, `Animate2`.
- SCPCB reads the pose cursor back via `AnimTime(entity)` (primarily for branching/comparisons).
- SCPCB does **not** rely on Blitz3D `Animate()` auto-advancing for NPCs in the common paths; a minimal correct port needs `SetAnimTime` + `AnimTime` first.

## Required semantics (what your runtime must make true)

- Treat `time` passed to `SetAnimTime(entity, time, seq)` as **frames**, not seconds.
- `AnimTime(entity)` should return the **current frame cursor** (ideally exactly what was set, modulo clamping).
- `AnimLength(entity)` should return the total **length in frames** for the active clip/sequence.
- If you implement `Animate()` auto-play:
  - Ensure the system advances animation state during the engine tick (Blitz3D advances on `UpdateWorld`).

## Mapping frames ↔ Three.js time

SMPK stores:
- `root.userData.fps` (from `web/src/runtime/smpk.ts`)
- `root.userData.sequences` (optional, from B3D `SEQS`)

Implement these conversions:

- `SetAnimTime(entity, frame)`:
  - `action.time = frame / fps`
  - `mixer.update(0)` to force evaluation
- `AnimTime(entity)`:
  - `return action.time * fps`
- `AnimLength(entity)`:
  - `return action.getClip().duration * fps`

Avoid hard-coding `30` — use `entity.userData.fps || 30`.

## Where to wire imports (this repo)

Both the main-thread loader and the SCPCB worker currently call `stubMissingImports(...)`, so missing animation imports will silently degrade unless implemented.

- Main thread instantiation:
  - `web/src/main.ts` (look for `instantiateWasm` and `buildImports`)
- Worker instantiation:
  - `web/src/worker/scpcb_worker.ts` (look for `buildImports` and `instantiate`)

Add/import-bind these functions (at minimum):
- `SetAnimTime`
- `AnimTime`
- `AnimLength`

Optionally (if you want to support broader Blitz3D programs):
- `Animate`
- `Animating`
- `ExtractAnimSeq` / `AddAnimSeq` / `AnimSeq`

## Debug checklist (fast)

1. Confirm the module actually calls animation imports:
   - Run and watch the `missing:env.SetAnimTime` counters in the worker (see `stubMissingImports` `onCallMissingFunction` hook).
2. Confirm the entity you’re animating has an SMPK mixer/action:
   - `root.userData.mixer` and `root.userData.action` must exist.
3. Confirm you advance mixers somewhere:
   - If relying on `Animate()` auto-play, call `mixer.update(deltaSeconds)` per tick.
   - For SCPCB’s manual stepping via `SetAnimTime`, you still need to `mixer.update(0)` after setting time.
4. If pose looks wrong:
   - Verify bone hierarchy and `SkinnedMesh.bind(...)` behavior in `web/src/runtime/smpk.ts` (bones must remain in original hierarchy).

