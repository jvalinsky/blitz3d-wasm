# B3D (Blitz3D “BB3D”) format

## Summary

B3D is Blitz3D’s native, chunk-based binary 3D model format. Files typically start with the ASCII signature `BB3D`, followed by a version field and a tree of tagged chunks.¹

In SCPCB, B3D is commonly used for NPCs and item models.

## On-disk structure (high level)

Common top-level chunk tags include:
- `TEXS` — textures (names + flags)
- `BRUS` — brushes/materials
- `NODE` — hierarchy of nodes (transforms + child chunks)

Within a mesh node you typically see:
- `MESH` — mesh container
  - `VRTS` — vertex data (positions, optional normals/colors, texcoords)
  - `TRIS` — triangle indices and a brush/material reference

Many exporters also emit animation-related chunks:
- `ANIM`, `BONE`, `KEYS`, `SEQS` (names vary by exporter/version)

For a detailed chunk-by-chunk layout (including `BB3D`, `TEXS`, `BRUS`, `NODE`, `VRTS`, `TRIS`, and animation chunks), see the Luanti “Blitz3d file format specification”.¹

## Textures, flags, and multi-texturing

Blitz3D supports multiple “texture stages” per brush/material. In B3D this is represented by:
- `TEXS` (texture table): filename + flags + blend mode + UV transform parameters
- `BRUS` (brush table): `texture_id[n_texs]` linking to one or more entries in `TEXS`

Two practical implications for SCPCB assets:
- A brush may reference multiple textures (e.g. base + lightmap/detail). A runtime renderer needs to decide how to map those stages into its own material system.
- `TEXS.flags` correspond to Blitz3D’s texture flags (color/alpha/mipmapping/clamping/etc.). Many community docs describe these flags via the Blitz3D `LoadTexture`/`CreateTexture` commands.

## How this maps into Blitz3D concepts

- **Entity hierarchy**: `NODE` chunks represent the scene graph (local transforms + children).
- **Meshes/surfaces**: `MESH` + `TRIS` map naturally to Blitz3D’s mesh + surfaces/material groups.
- **Brush/material**: `BRUS` maps to a Blitz3D brush (diffuse color, alpha, blend, texture stages).

## What it can contain (conceptual)

- Geometry: vertices and triangle indices (often multiple surfaces/materials)
- Materials: brush parameters, blend modes, and texture references
- Hierarchy: nodes with local transforms
- Optional animation: bones + keyframes (skeletal)

## SCPCB-specific realities / gotchas

- Texture paths embedded in B3D can be “Windowsy” (backslashes, drive letters, etc.). A loader usually needs path normalization + aliasing.
- Exporters differ: some include additional UV dimensions (`texCoordSize > 2`) or store vertex colors as floats instead of bytes; loaders should follow the writer’s declared layout.

## Where it’s handled in this repo

- Interpreter/source loader: `web/src/runtime/b3d.ts`
- Production pipeline: convert to SMPK (see `docs/SMPK_FORMAT.md` and `docs/ASSET_PIPELINE.md`)

## References

- ¹ Luanti “Blitz3d file format specification”: https://docs.luanti.org/for-creators/models/b3d-spec/
- Blitz3D texture flags reference (`LoadTexture`): https://kippykip.com/b3ddocs/commands/3d_commands/LoadTexture.htm
