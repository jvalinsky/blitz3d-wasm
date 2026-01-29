# SCPCB Web Port Plan (Track B: WASM-First, Offline Assets)

Goal: best performance + maintainability with a **thin JS runtime** and **most gameplay logic in WASM**.
We **do not ship `.b3d` or `.x`** in the web build; those get converted offline into a web-native packed format.

## Guiding Principles

- **WASM owns the game**: simulation, AI, state, type system, and most file parsing that’s gameplay-facing.
- **JS owns the browser**: WebGL/WebGPU/Audio/Input/File fetch, plus a small “driver” loop.
- **Minimize the JS↔WASM boundary**: prefer *batch* calls, shared memory, and stable ABI over per-entity calls.
- **Offline conversion beats runtime parsing** for large/complex assets (models, animations, textures).
- **Version everything**: runtime ABI + packed asset formats must be explicitly versioned and validated in tests.

## Asset Strategy (No `.b3d` / `.x` on the Web)

### What SCPCB uses today

- **`.rmesh`**: room/world static geometry (SCPCB has BB code to read/write it).
- **`.b3d`**: Blitz3D model format (often animated / skinned; NPCs, items).
- **`.x`**: DirectX text meshes (static or skinned depending on exporter; many props).

### Where parsing happens in native Blitz3D

SCPCB’s BB code typically just calls `LoadMesh/LoadAnimMesh` etc; the actual `.b3d/.x` parsing is done inside the **engine** (Blitz3D / blitz3d-ng), not in BB scripts.

### Web approach (Track B)

1. **Offline convert `.b3d` + `.x` → `.smpk`** (single packed file: JSON metadata + BIN buffers).
2. **Runtime refuses `.b3d/.x`** and loads `.smpk` instead.
3. Optional follow-up: **offline convert `.rmesh` → `.smpk`** for faster loads + unified pipeline.

Repository tooling already in place:

- `Tools/convert_b3d_to_smpk.ts`
- `Tools/convert_x_to_smpk.ts`
- `Tools/assets_scpcb_convert.ts` (batch conversion + optional `--delete-source`)
- Runtime mapping: `.b3d/.x` → `.smpk` in `web/src/runtime/graphics.ts` and `web/src/runtime/animation.ts`

Recommended deploy rule:

- Convert in CI, then package **only** `.smpk` (+ textures/audio/ini) into `dist/`.
- If you keep sources in-repo for iteration, use `--delete-source` only on the deploy artifact, not on your working tree.

## Compiler Responsibilities (Swift BB→WASM)

**Do not make the compiler an asset converter.**

Keep the Swift compiler focused on correctness and performance of generated WASM.
Instead:

- Add a *build hint* mode (optional): emit a JSON “asset dependency report” from BB sources:
  - string literals with `.b3d/.x/.rmesh/.png/.ogg/...`
  - dynamic path sites that need manual review
- The Deno pipeline consumes that report to decide what to convert/preload.

Why:

- Asset conversion is IO-heavy, format-heavy, and evolves independently from codegen.
- You want reproducible tool outputs and fast incremental conversion.
- It keeps the compiler simpler and avoids “implicit build magic”.

## Runtime Responsibilities (Thin JS)

### Rendering + asset plumbing

- **JS**:
  - fetch + cache files from `scpcb_manifest.json`
  - decode textures/audio
  - create GPU resources (Three.js now; consider WebGPU later)
  - build meshes/skins/anims from `.smpk`

- **WASM**:
  - decides what to load, when to spawn entities, and which animation/state to play
  - can stay synchronous by using a preloaded in-memory file system (VFS)

### Reduce boundary overhead (critical for perf)

- Prefer a **command buffer**:
  - WASM writes compact draw/update commands into shared linear memory
  - JS reads and executes once per frame
- Prefer *IDs/handles*:
  - WASM stores integer handles; JS maps handles → real objects
  - define explicit lifetime + disposal paths (your memleak tooling is already set up)

### “Blocking loop” hardening

SCPCB contains blocking loops (launcher UI, “press any key”, etc.). Web must:

- keep default boot path *paused* or step-driven
- gate `Main()` behind explicit query flags
- make initialization resumable (event-driven) over time

## Format Notes

### `.smpk`

- Single file: header + JSON + BIN.
- Store:
  - vertex attributes (POSITION/NORMAL/UV/JOINTS/WEIGHTS)
  - index buffer
  - materials + texture paths
  - optional skin + animation tracks
- Keep it “GLB-like”: minimal parsing overhead at runtime.

## Testing (Deno, No Network)

### Unit tests

- `.smpk` codec: encode/decode roundtrip (`Tools/tests/smpk_codec.test.ts`)
- `.b3d` parser + conversion integration (`Tools/tests/b3d_*`)
- `.x` parser + conversion integration (`Tools/tests/x_*`)

Best practices:

- No `https://deno.land/...` imports in tests (offline + hermetic).
- Tests should validate:
  - non-empty buffers
  - expected counts (verts/indices)
  - stable conversion (e.g. deterministic ordering where possible)

### Integration (browser)

Keep your existing browser integration tests, but add one “asset contract” check:

- Assert that the deploy manifest contains **no `.b3d` / `.x`** paths.

## Execution Checklist (Recommended)

1. Run converter against your asset root(s):
   - `deno task assets:scpcb:convert -- --root web/public`
   - `deno task assets:scpcb:convert -- --root Examples/scpcb_facility_walk/assets`
2. For deploy packaging:
   - rerun with `--delete-source` on a staging copy of assets
3. Run Deno tests:
   - `deno task test:deno`
4. Run browser tests:
   - `deno task test:wasm`

## Follow-ups (Next High-Value Work)

- Add an `.rmesh → .smpk` offline converter (and then stop shipping `.rmesh` too).
- Texture pipeline: convert to `ktx2`/Basis (GPU-native) and update loader.
- Command-buffer ABI to collapse many runtime imports into a few per-frame calls.
- Extend `.x` support if you encounter binary `.xof` or additional template blocks.

