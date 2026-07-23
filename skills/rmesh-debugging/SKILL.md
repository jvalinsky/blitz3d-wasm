---
name: rmesh-debugging
description: Debug SCPCB `.rmesh` room meshes in Blitz3D-WASM, including header/structure parsing, surface texture slot conventions (diffuse vs lightmap), UV channel mapping, trigger/entity extras, and RMESH→SMPK conversion correctness.
---

# RMESH Debugging

## Primary path (Track B): convert to SMPK

- `deno run -A Tools/convert_rmesh_to_smpk.ts in.rmesh -o out.smpk`

## Key RMESH conventions (SCPCB)

- Drawn surfaces store **two textures**:
  - slot0: lightmap
  - slot1: diffuse
- RMESH stores **two UV sets**:
  - `uvs0`: diffuse UV
  - `uvs1`: lightmap UV

If lighting/materials look wrong, confirm slot swapping in:

- `Tools/convert_rmesh_to_smpk.ts`

## Parse-level debug

- Parser: `Tools/rmesh/parse.ts`
- Validate basic counts:
  - `drawnCount`, `collisionCount`, optional `triggerCount`, `entityCount`
- Look for malformed “empty trigger surfaces” (converter tolerates them and
  emits a zero AABB for diagnostics).

## Validate output correctness

- `deno run -A Tools/validate_smpk_material_textures.ts dist`
- `deno run -A Tools/validate_no_source_models.ts --ban b3d,x,rmesh dist dist/scpcb_manifest.json`

## Runtime loaders (browser)

- RMESH loader: `web/src/runtime/rmesh.ts`
- SMPK loader: `web/src/runtime/smpk.ts`
