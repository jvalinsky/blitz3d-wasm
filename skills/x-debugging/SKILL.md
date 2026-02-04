---
name: x-debugging
description: Debug DirectX `.x` models (text, binary, and MSZIP-compressed variants) used by SCPCB in Blitz3D-WASM, including parse failures, skin weights/bone mapping issues, material+texture path/casing problems, and `.x`→`.smpk` conversion correctness.
---

# X Debugging

## Primary path (Track B): convert to SMPK

- `deno run -A Tools/convert_x_to_smpk.ts in.x -o out.smpk`

If the conversion fails:
- Parser entrypoint: `Tools/x/parse_x.ts`
  - Handles `txt `, `bin `, `tzip` and `bzip`.

## Common failure modes

- **“Unsupported X format” / header issues**
  - Verify the first 16 bytes start with `xof ` and the format is one of: `txt `, `bin `, `tzip`, `bzip`.
- **Rigid mesh (no skin)**
  - The converter only emits JOINTS/WEIGHTS when `SkinWeights` exist.
  - Missing/empty `SkinWeights` blocks produce static meshes.
- **Materials load but textures missing**
  - Fix via conversion-time texture name resolution (prefer basenames + on-disk casing).

## Validate output correctness

- `deno run -A Tools/validate_smpk_material_textures.ts dist`
- `deno run -A Tools/validate_no_source_models.ts --ban b3d,x,rmesh dist dist/scpcb_manifest.json`

## Runtime loaders (browser)

- X loader: `web/src/runtime/xloader.ts`
- SMPK loader: `web/src/runtime/smpk.ts`

