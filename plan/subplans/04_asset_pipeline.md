# Subplan 04 — Asset Pipeline (drop-in `~/Software/scpcb` → `dist/assets`)

**Phase**: A (blocking A-M1/A-M2)
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Code**: `web/build.ts` (packaging + manifest), `web/src/shared/path_alias.ts` (path rewriting), `web/src/runtime/fileio.ts` (VFS), `Tools/scpcb_audit_gate.ts` + `docs/scpcb/scpcb_audit_baseline.json` (gates)
**Absorbs**: Track B `01_asset_pipeline.md` open items; legacy `plan_4c_asset_pipeline.md`

## Objective

From an unmodified local SCPCB checkout (plus mods), deterministically produce `dist/assets/**` + `scpcb_manifest.json` such that the browser runtime can satisfy Blitz3D's synchronous-IO expectations via preloaded groups. Mods must work with zero per-mod code changes.

## Invariants (already gated — keep them)

- **No source models ship**: no `.b3d/.x/.rmesh` in `dist` (CI gate exists — `Tools/scpcb_audit_gate.ts`)
- **Case-insensitive resolution** and centralized rewriting: `GFX\foo\Bar.b3d` → `assets/GFX/foo/bar.smpk`; every asset open goes through `path_alias.ts`
- **Deterministic output**: same input tree → byte-identical manifest (stable ordering, stable hashes)

## Workstreams

### 4.1 Manifest groups (mode-aligned preloading)

- [ ] Groups in `scpcb_manifest.json`: `boot` (wasm, `options.ini`, bootstrap files), `menu` (menu textures/fonts/sounds/videos), `gameplay_core` (common room assets), room/facility packs
- [ ] Group membership derived from SCPCB call-path evidence (trace file opens per mode), not guesses
- [ ] Loader API: `preloadAssetGroup(name)` returns progress events; `Web_Enter*` is gated on completion (subplan 03)
- [ ] D5 decision: start with one `facility_assets` pack; split per-room only if A-M2 load times demand it

### 4.2 Format conversion

- [ ] B3D/X/RMESH → SMPK conversion complete for all SCPCB-referenced models (pipeline exists; close remaining gaps)
- [ ] RMESH point-entities + triggers: extract into SMPK sidecar data so room logic (spawns, triggers, waypoints) survives conversion
- [ ] Textures: keep PNG/JPG + enforce mipmaps/caching for Phase A (D6); record sizes to inform a later KTX2 decision
- [ ] Video: `.avi → .mp4` mapping policy applied consistently; menu/startup videos skippable and never blocking
- [ ] Audio: verify all SCPCB formats decode via WebAudio; transcode outliers at build time

### 4.3 Integrity & mods

- [ ] Per-asset content hash in manifest; loader verifies on fetch (corruption → clear error, not silent garbage)
- [ ] Mod drop-in test: point the pipeline at a modded checkout; conversion + manifest generation succeed with no code changes (feeds A-M4)
- [ ] ZipApi decision D3: if implemented (JSZip), converted mod archives resolve through the same VFS layer

### 4.4 Delivery optimization (Phase C)

- [ ] Brotli/gzip for `.wasm` and binary assets; verify server config in deploy docs
- [ ] Service worker caches immutable assets + wasm keyed by content hash (fast reloads)
- [ ] Parallel conversion in `web/build.ts` for build-time speed

## Acceptance criteria

- `deno task test:web:build` green: dist contains no source-model extensions, manifest validates, all referenced assets resolve case-insensitively
- A-M1: `boot`+`menu` groups sufficient — zero mid-menu fetch stalls
- A-M4: two real mods convert and boot with pipeline unchanged
