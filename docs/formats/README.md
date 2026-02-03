# Asset Formats (B3D / .X / RMESH)

This folder documents the **source** mesh formats encountered in SCP: Containment Breach (SCPCB) and how they map into this project’s runtime and asset pipeline.

Most production Track B flows should prefer **SMPK** (see `docs/SMPK_FORMAT.md`) and treat B3D/.X/RMESH as *inputs* for conversion or for exploration in `dist/interpreter.html`.

## Production vs interpreter

This repo intentionally has two pathways:

- **Production (SCPCB web port)**: source formats are converted offline to `*.smpk` and loaded through the manifest/VFS.
- **Interpreter (exploration)**: source formats can be parsed client-side to help debug assets and runtime behavior.

Source format parsing is gated behind:
- `globalThis.__BLITZ3D_ALLOW_SOURCE_MODELS === true` (set by the interpreter)

## Support matrix (interpreter path)

This matrix describes what the interpreter loaders aim to support today (best-effort; not a promise of full fidelity):

| Format | Primary intent | In-scope | Out-of-scope (convert offline) |
| ------ | -------------- | -------- | ------------------------------ |
| `*.b3d` | NPC/props | Static meshes, basic materials/texture references, simple hierarchies | Full multi-texture shaders, perfect flag fidelity, all animation variants |
| `*.x` (text) | Props/static geometry | Text `.xof ... txt`, common mesh/material/texture patterns | Binary `.x`, full template engine, complex animation sets |
| `*.rmesh` | Rooms | “Drawn” geometry rendering + common SCPCB conventions (base + lightmap) | Room metadata beyond rendering unless needed for SCPCB runtime |

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
