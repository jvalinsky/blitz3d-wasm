# Three.js Migration Review (Codebase Audit)

Date: 2026-01-31

This repo currently uses Three.js as both:

1) the *rendering backend* (WebGLRenderer + materials/textures), and
2) the *scene graph + math layer* (Object3D transforms, world matrices, raycasts, animation system).

If the goal is “migrate off Three.js”, the second point is the biggest source of coupling.

## Where Three.js is used (primary production path)

**Modern web runtime (`web/src/runtime/`)**

- `web/src/runtime/graphics.ts`
  - Owns `THREE.Scene`, active `THREE.Camera`, `THREE.WebGLRenderer`.
  - Stores game entities as `THREE.Object3D` instances (`this.entities[id] = obj`).
  - Implements most Blitz3D graphics-related WASM imports (entity lifecycle, transforms, materials-ish state, fog/lights, pick, etc.).
  - Uses Three.js world-space queries (`getWorldPosition`, `getWorldQuaternion`) and helpers (`Box3`, `Raycaster`, `Color`, etc.).
  - Has a “Swift engine dual storage (Phase 1)” mapping (`_engineIds`) but currently does not consume engine world matrices for rendering.

- `web/src/runtime/smpk.ts`
  - Builds renderable objects directly as Three.js objects (nodes as `Object3D`, meshes as `Mesh`/`SkinnedMesh`, textures via `TextureLoader`).
  - Uses Three’s skeletal animation types (`Bone`, `Skeleton`) and clip playback (`AnimationMixer`, `KeyframeTrack`).

- `web/src/runtime/mesh.ts`
  - Procedural surfaces are implemented as Three.js `BufferGeometry` + `MeshBasicMaterial`.
  - Also has a WASM-backed “zero-copy” surface but still uploads into Three geometry.

- `web/src/runtime/animation.ts`
  - Thin wrapper around Three’s animation playback (`LoopRepeat`, `LoopPingPong`, etc.) acting on `AnimationMixer`.

- `web/src/runtime/audio.ts`
  - Uses Three types for listener orientation math (`Vector3` from camera quaternion) and for 3D emitters (`Object3D.getWorldPosition`).

- `web/src/runtime/b3d.ts`, `web/src/runtime/xloader.ts`
  - Runtime mesh parsing paths that construct Three.js objects. (Some paths already refuse runtime source formats, but the code remains.)

**Engine bridge (important seam)**

- `web/src/engine/bridge.ts`
  - Typed wrapper for the Swift engine WASM exports (scene graph, transforms, fog/camera settings, collision helpers, etc.).
  - Includes `EngineGetWorldMatrix`, but it is not currently used by the renderer path.

## Other Three.js usage (non-production / legacy / demos)

If “off Three.js” means “remove dependency from the repo entirely”, these also need work:

- `Sources/Runtime/thin/*` demo HTML/JS uses Three.js directly.
- `Sources/Runtime/modules/*` and `Sources/Runtime/examples/*` are Three.js-based legacy runtime code.
- `web/public/*demo*.html` includes Three.js usage for demos.

If the migration target is the SCPCB web loader, you can likely leave these as demos/legacy for now and focus on `web/src/runtime/*`.

## What’s tightly coupled to Three.js today

### 1) Scene graph & transforms

The runtime assumes:

- hierarchical parenting via `Object3D.add/remove`,
- implicit transform propagation via `updateMatrixWorld`,
- world queries via `getWorldPosition/getWorldQuaternion`,
- and “entity handle == Object3D instance”.

Those are all Three.js abstractions, not just rendering.

### 2) Materials/FX semantics

Blitz3D concepts like `EntityFX`, `EntityBlend`, `EntityAlpha`, `EntityColor`, etc. are currently mapped onto:

- Three material properties (`opacity`, `transparent`, `blending`, `depthWrite`, `side`, etc.)
- and sometimes per-mesh cloning (`ensureUniqueMaterial`).

Any new renderer needs a compatibility layer that reproduces these semantics.

### 3) Animation playback and skinning

SMPK models rely on Three for:

- skeleton graph (`Bone` objects),
- binding (`SkinnedMesh.bind`),
- clip evaluation (`AnimationMixer` / tracks),
- and the per-frame update (`mixer.update(dt)`).

Replacing this is a major chunk of work (but also a clean place to define a renderer-agnostic representation).

### 4) Picking / collision helpers

`graphics.ts` uses `THREE.Raycaster` and `Box3().setFromObject` for some queries.

The Swift engine exports already include `LinePick` / `LinePickDistance` and collider APIs; those can become the replacement path, but they need to be wired into the runtime (and the runtime needs a consistent coordinate-space story).

### 5) Math types leaking across subsystems

Even subsystems that are “not rendering” (notably audio) import Three.js just for `Vector3`/`Quaternion` math.

This makes Three hard to remove incrementally.

## Existing migration seam: the Swift engine bridge

The presence of `web/src/engine/bridge.ts` + the “dual storage” mapping in `graphics.ts` suggests a good long-term direction:

- Use the Swift engine as the canonical scene graph + transform system.
- Render from engine world matrices (via `EngineGetWorldMatrix` and/or batched transform readback).
- Move picking/collision to engine exports (`LinePick`, colliders).

Right now, `graphics.ts` *sets* engine transforms but still *renders* from the Three scene graph.

## Migration blockers / risks

- `Blitz3DGraphics` is both the WebGL backend *and* the runtime import surface. Untangling this will touch many imports/env functions.
- Coordinate conversions are scattered (notably Z negation Blitz3D LH → Three RH). A new renderer/engine integration should centralize this conversion.
- SMPK loader currently builds Three objects directly; it needs a renderer-agnostic model format to support any non-Three backend.
- The “mock renderer” path in `init3D()` is used by headless tooling; a new backend should preserve deterministic headless behavior.
- There are multiple runtimes in the repo (thin/legacy/web). Be explicit whether the migration target is only `web/` production.

## Recommended phased plan (minimize churn)

### Phase 1 — Stop importing `three` outside the renderer module

Goal: make it possible to “swap renderer” without rewriting unrelated systems.

- Introduce a small math module (`Vec3/Quat/Mat4`) and remove `three` from:
  - `web/src/runtime/audio.ts` (listener forward/up math)
  - any other non-render systems that only need vectors/quats
- Introduce a `RendererBackend` interface and a `ThreeBackend` implementation.
  - Initially, `ThreeBackend` can be a thin wrapper that delegates to current Three.js behavior.
  - The key win is that `graphics.ts` stops directly referencing `THREE.*` outside of the backend.

### Phase 2 — Make loaders renderer-agnostic

Goal: decoders produce *data*, backend produces *GPU resources*.

- Refactor `web/src/runtime/smpk.ts` to return a `SmpkModel` (typed arrays + node graph + materials + animation channels),
  not a `THREE.Group`.
- Same direction for procedural geometry (`web/src/runtime/mesh.ts`) and any remaining runtime parsers.

### Phase 3 — Use engine transforms as source of truth

Goal: remove Three scene-graph dependence before removing Three renderer.

- Wire `EngineGetWorldMatrix` (or a batched equivalent) into the render loop.
- Render entities by applying engine world matrices to backend instances.
- Replace world queries (`getWorldPosition/getWorldQuaternion`) with engine readbacks.

### Phase 4 — Replace picking/collision with engine exports

- Implement picking via `LinePick`/`LinePickDistance` using engine mesh/collider data, not `THREE.Raycaster`.

### Phase 5 — Swap renderer backend (WebGL2 or WebGPU)

Once the codebase is structured around a backend + typed data, replacing Three becomes “just” implementing:

- mesh buffer uploads,
- texture uploads/samplers,
- a minimal material pipeline for Blitz3D semantics,
- skinning + animation evaluation strategy,
- and a draw loop.

## Suggested “first PR” scope (low-risk, high leverage)

- Remove Three-only math from `web/src/runtime/audio.ts` by introducing a tiny local `Quat -> forward/up` helper.
- Introduce a `RendererBackend` interface and move renderer creation (`WebGLRenderer` / mock renderer) behind it.
- Keep the functional behavior identical; the goal is purely architectural: isolate Three.js behind a boundary.

