# SCPCB WASM-First Audit (Jan 29, 2026)

Goal: keep SCPCB logic + parsing in BB→WASM, and shrink the JS side to a thin
“device driver” (GPU upload/draw, input events, audio decode/playback, async
fetch + persistence).

This doc captures:

- where SCPCB is still relying on Blitz3D engine loaders at runtime
  (`LoadMesh/LoadAnimMesh` of `.b3d`/`.x`)
- what the RMESH format’s “material byte” means (as written by SCPCB’s own
  converter)
- a concrete packed-mesh schema to let BB/WASM parse RMESH and hand a single
  buffer to JS for GPU upload

## 1) Inventory: remaining `.b3d` / `.x` runtime loads

SCPCB contains a full in-BB RMESH loader (`LoadRMesh`) in
`../scpcb/MapSystem.bb:336`, but it still loads many assets via Blitz3D’s
`LoadMesh/LoadAnimMesh`, including `.b3d` and `.x`.

Run the audit:

```bash
deno run -A Tools/scpcb_audit.ts
```

If your goal is “WASM-first parsing”, the high-level direction is:

- **prefer `.rmesh` everywhere at runtime**
- convert `.b3d` and `.x` offline into `.rmesh` (or another WASM-parseable
  format)

Practical hotspots to convert first:

- `../scpcb/Main.bb:8003`–`:8190` (core doors/buttons/items/monitors/lightcone)
- `../scpcb/Items.bb:217`+ (many item templates reference `.x`/`.b3d`)
- `../scpcb/NPCs.bb` (NPC models are mostly `.b3d`)

Even after converting constants, note there are **dynamic callsites** like
`LoadMesh(modelpath$)` (e.g. `../scpcb/Main.bb:11780`) where the runtime can
still request arbitrary mesh formats. Those need either:

- a hard policy: only allow `.rmesh`, or
- a JS/WASM loader for whatever formats remain.

## 2) RMESH “material byte” semantics (from SCPCB itself)

RMESH is written by SCPCB’s converter (`SaveRoomMesh`) and loaded by
`LoadRMesh`.

### 2.1 Writer: `isAlpha(tex)` in `../scpcb/Converter.bb:96`

`isAlpha(tex)` writes a single byte per texture slot:

- `0`: no texture in this slot
- `1`: opaque texture
- `2`: “lightmap” texture (detected by name containing `_lm`)
- `3`: texture has per-pixel alpha (PNG/TGA/TPIC scan finds alpha < 255)

This value is serialized into RMESH by `SaveRoomMesh()` in
`../scpcb/Converter.bb:123` at:

- `WriteByte(f, isAlpha(tex))` for brush slot 0
- `WriteByte(f, isAlpha(tex))` for brush slot 1

### 2.2 Loader: surface classification in `../scpcb/MapSystem.bb:336`

`LoadRMesh` reads those bytes (`temp1i = ReadByte(f)`) and:

- loads texture paths and stores two texture handles per surface
- marks the surface as “alpha” if **any** texture slot has byte `3`
- treats filenames containing `_lm` as lightmaps (also independently checked by
  substring)

So, if you preserve RMESH parsing in WASM, you only need a small material model:

- `diffusePath` (slot 0 or 1 depending on convention)
- `lightmapPath` (optional)
- `isTransparent` (any slot has byte `3`)

You can ignore a lot of Blitz3D brush/texture slot complexity in the web port as
long as visuals remain acceptable.

## 3) Packed RMESH → GPU schema (single buffer, WASM-produced)

The point of this schema is: **BB/WASM parses RMESH and emits one packed
buffer**. JS has _one_ import to upload it to GPU and return an opaque mesh
handle.

### 3.1 WASM export shape

Add/keep a BB-visible function like:

- `Web_LoadRMeshPacked%(path$)` → returns a pointer (i32) to a packed buffer in
  WASM memory

This function:

- opens `path` via `ReadFile`
- parses RMESH (same structure as `LoadRMesh`)
- allocates a single contiguous block in WASM memory
- writes the packed structure
- returns pointer

JS import:

- `Gfx_CreateMeshFromPacked(ptr: number): number`

Optional:

- `Gfx_FreePacked(ptr: number)` (if you don’t want to keep it forever in WASM
  memory)

### 3.2 Binary layout (little-endian)

All offsets are byte offsets from `basePtr` (the pointer returned by
`Web_LoadRMeshPacked`).

Header (`PackedMeshHeader`, 64 bytes):

- `u32 magic` = `0x48534D42` (`"BMSH"`)
- `u16 version` = `1`
- `u16 submeshCount`
- `u32 collisionMeshCount`
- `u32 pointEntityCount`
- `u32 triggerBoxCount`
- `u32 stringsByteLen`
- `u32 submeshesOffset`
- `u32 collisionsOffset`
- `u32 pointEntitiesOffset`
- `u32 triggerBoxesOffset`
- `u32 stringsOffset`
- `u32 totalByteLen`

Strings blob:

- UTF-8, NUL-terminated strings concatenated
- paths are stored as offsets (`u32`) into this blob

Per-submesh (`PackedSubmesh`, fixed 48 bytes, repeated `submeshCount` times):

- `u32 materialFlags`
  - bit 0: `hasTex0`
  - bit 1: `hasTex1`
  - bit 2: `tex0IsLightmap` (from byte==2 or name contains `_lm`)
  - bit 3: `tex1IsLightmap`
  - bit 4: `isTransparent` (any slot byte==3)
- `u32 tex0PathOff` (0 if none)
- `u32 tex1PathOff` (0 if none)
- `u32 vertexCount`
- `u32 indexCount`
- `u32 vertexStride` (bytes; v1 = 32)
- `u32 vertexDataOff`
- `u32 indexType` (0 = u16, 1 = u32)
- `u32 indexDataOff`
- `u32 reserved0`
- `u32 reserved1`

Vertex format v1 (`vertexStride=32`):

- `f32 x,y,z` (12)
- `f32 u0,v0` (8)
- `f32 u1,v1` (8)
- `u8 r,g,b,a` (4) where `a=255` if RMESH doesn’t store alpha

Collision meshes (`PackedCollisionMesh`, repeated):

- `u32 vertexCount`
- `u32 triCount`
- `u32 vertexDataOff` (positions only: `f32 x,y,z` * vertexCount)
- `u32 indexDataOff` (u32 indices, 3*triCount)

Point entities (enough to preserve gameplay logic without JS):

- `u32 kind` enum:
  screen/waypoint/light/spotlight/soundemitter/playerstart/model
- `f32 x,y,z`
- `f32 a,b,c` (meaning depends on kind; e.g. angles or extra data)
- `u32 str0Off` (e.g. image path / model path)
- `u32 str1Off` (optional)
- `u32 i0` (e.g. sound id)
- `u32 flags`

Trigger boxes:

- `u32 nameOff`
- `u32 meshIndex` (index into collision meshes, or dedicated arrays)

### 3.3 Why this schema works for SCPCB

- RMESH already contains per-surface textures + UV0/UV1 + vertex color +
  triangles.
- SCPCB uses `_lm` naming and “alpha present” detection; both become
  `materialFlags`.
- JS no longer needs to implement `CreateSurface/AddVertex/AddTriangle`
  semantics; it just uploads buffers.

## 4) Next steps (milestones)

1. Add `Web_LoadRMeshPacked` (BB) for one test room and implement
   `Gfx_CreateMeshFromPacked` (JS).
2. Convert a few `.x` door/button meshes to `.rmesh` offline and remove runtime
   `.x` loads.
3. Gate runtime mesh loading: refuse `.b3d/.x` paths in web build; only allow
   `.rmesh`.
4. Iterate: items → props → NPCs, until `.b3d/.x` references are eliminated or
   moved to an offline pipeline.
