---
name: asset-format-triage
description: Parse, understand, convert, and debug SCPCB asset formats in Blitz3D-WASM: Blitz3D `.b3d`, DirectX `.x` (text/binary/mszip), and `.rmesh`. Use when conversions to `.smpk` fail, when models load with wrong materials/UVs/skins, when textures are missing due to path/casing, or when runtime/interpreter loaders behave differently than offline converters.
---

# Asset Format Triage (B3D / X / RMESH)

## First decision: do you need raw loading or SMPK?

- Track B web runtime prefers **offline conversion** to `.smpk`.
- Raw loaders exist mainly for the interpreter / debugging harness.

## Conversion entrypoints (repo)

- B3D → SMPK: `Tools/convert_b3d_to_smpk.ts` (parser: `Tools/b3d/parse.ts`)
- X → SMPK: `Tools/convert_x_to_smpk.ts` (parsers: `Tools/x/parse_*.ts`)
- RMESH → SMPK: `Tools/convert_rmesh_to_smpk.ts` (parser:
  `Tools/rmesh/parse.ts`)

## Runtime loaders (debug harness)

- B3D: `web/src/runtime/b3d.ts`
- X: `web/src/runtime/xloader.ts`
- RMESH: `web/src/runtime/rmesh.ts`

## Minimal debug commands (offline)

- Convert one file and inspect failures:
  - `deno run -A Tools/convert_b3d_to_smpk.ts in.b3d -o out.smpk`
  - `deno run -A Tools/convert_x_to_smpk.ts in.x -o out.smpk`
  - `deno run -A Tools/convert_rmesh_to_smpk.ts in.rmesh -o out.smpk`

## Validate the output (catch “it converted but is wrong”)

- Texture references exist:
  - `deno run -A Tools/validate_smpk_material_textures.ts dist`
- Ensure you didn’t ship source models:
  - `deno run -A Tools/validate_no_source_models.ts --ban b3d,x,rmesh dist dist/scpcb_manifest.json`

## Format-specific gotchas

### `.rmesh`

- SCPCB convention: RMESH texture slot0 is often **LIGHTMAP**, slot1 is
  **DIFFUSE**.
  - The converter swaps these (`Tools/convert_rmesh_to_smpk.ts`).
- If materials look wrong, confirm slot mapping and texture name resolution
  (case-insensitive maps).

### `.x`

- Can be text, binary, or MSZIP-compressed variants.
- Skin weights require correct bone name mapping; missing/empty SkinWeights
  often means rigid mesh output.
- Texture paths in materials are frequently relative and case-sensitive in
  practice; fix via conversion-time mapping.

### `.b3d`

- Must start with `BB3D` and a supported version.
- Bone weights + keyframes require correct node hierarchy; verify “root exists”
  and that at least one MESH node is found.
- Texture naming in B3D can be inconsistent; prioritize conversion-time texture
  name normalization.

## When the issue is “missing textures”

1. Treat it as a path/casing problem first.
2. Prefer fixing on disk/manifest/conversion over adding runtime aliases.
3. If you do add aliasing, keep it narrow and test with
   `validate_smpk_material_textures`.
