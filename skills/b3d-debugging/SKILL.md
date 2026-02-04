---
name: b3d-debugging
description: Debug Blitz3D `.b3d` model issues in Blitz3D-WASM and the SCPCB asset pipeline, including chunk parsing (TEXS/BRUS/NODE/MESH/VRTS/TRIS/BONE/KEYS/ANIM/SEQS), texture path/casing problems, skeleton/keyframe integrity, and B3D→SMPK conversion correctness.
---

# B3D Debugging

## Start with the converter (Track B)

- Primary path: convert B3D → SMPK
  - `deno run -A Tools/convert_b3d_to_smpk.ts in.b3d -o out.smpk`
- Then load the `.smpk` in the web runtime (preferred) instead of raw `.b3d`.

## Quick questions to answer

1. Does the file parse at all?
   - Parser: `Tools/b3d/parse.ts`
2. Are textures referenced with weird paths?
   - Common in SCPCB: embedded `D:\\...` absolute paths → you must normalize to basenames + on-disk casing during conversion.
3. Is there actually a skeleton?
   - Expect many `NODE`s with `BONE` + `KEYS` for NPCs.
4. Are animation globals sane?
   - `ANIM` provides `animLenFrames` and `animFps`; keep them through to SMPK.

## Validate output correctness (catch “it converted but looks wrong”)

- Check referenced textures exist in your dist/manifest:
  - `deno run -A Tools/validate_smpk_material_textures.ts dist`
- Confirm you didn’t ship source models:
  - `deno run -A Tools/validate_no_source_models.ts --ban b3d,x,rmesh dist dist/scpcb_manifest.json`

## Runtime loaders to inspect if the bug reproduces only in-browser

- SMPK loader: `web/src/runtime/smpk.ts`
- (Debug only) B3D loader: `web/src/runtime/b3d.ts`
- Animation playback: `web/src/runtime/animation.ts`

If the mesh loads but anim pose is wrong, treat it as:
- bone hierarchy traversal/binding, or
- frame→seconds mapping (fps).

