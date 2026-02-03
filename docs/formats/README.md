# Asset Formats (B3D / .X / RMESH)

This folder documents the **source** mesh formats encountered in SCP: Containment Breach (SCPCB) and how they map into this project’s runtime and asset pipeline.

Most production Track B flows should prefer **SMPK** (see `docs/SMPK_FORMAT.md`) and treat B3D/.X/RMESH as *inputs* for conversion or for exploration in `dist/interpreter.html`.

## Files

- `docs/formats/B3D.md` — Blitz3D “BB3D” chunked binary format.
- `docs/formats/X.md` — DirectX `.x` (focus on text `.xof ... txt`).
- `docs/formats/RMESH.md` — SCPCB room mesh format (`*.rmesh`).
- `docs/formats/SCPCB_ASSET_CONTEXT.md` — How SCPCB uses these formats and why Track B prefers SMPK.

## Where this shows up in the repo

- Interpreter demos: `web/interpreter.html`, `web/interpreter.ts`
- Loader entrypoint: `web/src/runtime/graphics/setup/3d.ts` (`LoadMesh`)
- Source loaders (interpreter-only): `web/src/runtime/b3d.ts`, `web/src/runtime/xloader.ts`, `web/src/runtime/rmesh.ts`
- SMPK format + pipeline: `docs/SMPK_FORMAT.md`, `docs/SMPK_SYSTEM.md`, `docs/ASSET_PIPELINE.md`

