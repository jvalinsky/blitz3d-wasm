# Plan 01 — Asset Pipeline (Offline Conversion, No Source Formats Shipped)

Created: 2026-01-29
Last updated: 2026-01-30

Goal: all model/room assets are converted offline into `.smpk`, and the web build **never** serves `.b3d/.x/.rmesh`.

## A) Inventory + Coverage

- [x] Run `Tools/scpcb_audit.ts` on `../scpcb` and save a snapshot report (paths + callsites). (2026-01-29: `docs/scpcb/scpcb_audit_2026-01-29_1539.json`)
- [x] Classify load sites into: (2026-01-30: `docs/scpcb/scpcb_loadsite_classification_2026-01-30.md`)
  - [x] static string literals (convert automatically) (2026-01-30: `docs/scpcb/scpcb_loadsite_classification_2026-01-30.md`)
  - [x] dynamic path construction (needs manual mapping rules) (2026-01-30: `docs/scpcb/scpcb_loadsite_classification_2026-01-30.md`)
  - [ ] optional/unused content (can defer)
- [x] Add a CI gate that fails if new `.b3d/.x/.rmesh` literals are introduced without conversion rules. (2026-01-30: `Tools/scpcb_audit_gate.ts` + baseline `docs/scpcb/scpcb_audit_baseline.json` + task `deno task scpcb:audit`)

## B) Converters (B3D/X/RMESH → SMPK)

- [x] `.b3d → .smpk` converter exists (`Tools/convert_b3d_to_smpk.ts`). (2026-01-29)
- [x] `.x → .smpk` converter exists (`Tools/convert_x_to_smpk.ts`). (2026-01-29)
- [x] `.rmesh → .smpk` converter exists (`Tools/convert_rmesh_to_smpk.ts`). (2026-01-29)
- [ ] RMESH point-entities + triggers:
  - [x] Extend converter to encode room point-entities + trigger boxes into SMPK JSON (or a sidecar JSON) so runtime can spawn them without RMESH parsing. (2026-01-30: `Tools/convert_rmesh_to_smpk.ts` exports `json.extras.rmesh`)
  - [x] Add a migration path for existing room loading code to consume that metadata. (2026-01-30: implemented `ParseRMesh` in `graphics.ts` to spawn SMPK extras)

## C) Texture + Audio Pipeline (Web-Optimal)

- [ ] Decide texture target formats:
  - [ ] baseline: keep PNG/JPG but enforce caching + mipmaps
  - [ ] optimized: KTX2/BasisU for GPU-native upload (recommended)
- [ ] Add texture conversion step and update SMPK material references accordingly.
- [ ] Add audio conversion step (e.g. OGG/MP3 policy) and enforce via CI.

## D) Manifest + Preload Strategy

- [x] Ensure `scpcb_manifest.json` boot/init/facility grouping matches SCPCB init requirements (options.ini early, rooms.ini, etc.). (2026-01-29: `web/build.ts` generates groups; loader preloads `init` before `Main()` when opted in.)
- [x] Add runtime path aliasing so legacy SCPCB paths resolve to Track B outputs (`assets/` prefix + `.b3d/.x/.rmesh` → `.smpk`, case-insensitive VFS lookup). (2026-01-30: `web/src/runtime/fileio.ts` + `web/src/worker/scpcb_worker.ts` + `web/src/shared/path_alias.ts`)
- [ ] Ensure `.smpk` assets referenced at runtime are preloaded before calling into WASM init paths that expect sync IO.
  - Current: init-via-Main preloads `init` group; gameplay-time sync IO still needs audit. (2026-01-29)

## E) Deploy Contract

- [x] Web build enforces no `.b3d/.x/.rmesh` in `dist/` + manifest. (2026-01-29)
- [x] Add a “staging deploy” task that: (2026-01-30: `deno task deploy:staging`)
  - [x] runs conversion (2026-01-30)
  - [x] deletes source formats in the staging output (2026-01-30: enforced by `deno task test:web:build`)
  - [x] runs validator + size report (2026-01-30: `deno task test:web:build`)

Acceptance Criteria:
- [x] `dist/` contains 0 files matching `*.b3d|*.x|*.rmesh`. (2026-01-29: enforced by `deno task test:web:build`)
- [x] `dist/scpcb_manifest.json` contains 0 references to `*.b3d|*.x|*.rmesh`. (2026-01-29: enforced by `deno task test:web:build`)
- [ ] All room loads and model loads succeed using `.smpk` only.
