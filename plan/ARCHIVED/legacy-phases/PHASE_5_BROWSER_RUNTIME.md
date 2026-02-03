# Phase 5: Browser Runtime for Full SCPCB

## Goal
Run SCP: Containment Breach fully in the browser without crashing, using async asset loading, streaming, and stable memory behavior.

## Success Criteria
- Game boots to menu in browser.
- First playable room loads without blocking UI.
- Long sessions (>30 min) remain stable (no memory runaway).
- Asset loading is async and chunked; no single download blocks the main thread.
- Missing API coverage is known and tracked with priorities.

---

## Workstream A — Boot + Loader + Progress UI
**Goal:** Robust boot pipeline with visible progress and failure recovery.

### Tasks
1. **Create boot HTML/JS entrypoint**
   - Add a dedicated `web/` (or `Sources/Runtime/`) boot page for SCPCB.
   - Display a progress overlay.
   - Include error modal with logs.

2. **Implement staged loader**
   - Stage 0: runtime JS + WASM instantiation
   - Stage 1: boot assets (fonts, menu textures, UI sounds)
   - Stage 2: menu assets
   - Stage 3: gameplay chunk streaming

3. **Progress event hooks**
   - WASM instantiation progress
   - Asset download progress per chunk
   - Decode progress (if possible)

4. **Fail-safe mode**
   - If asset fails: fallback placeholder + log
   - Retry logic for transient errors

### Debugging Hints
- If boot hangs: check console for missing import names or fetch CORS errors.
- If progress stalls at 0%: ensure `Content-Length` and fetch streaming work (no opaque responses).

---

## Workstream B — Asset Manifest + Chunking
**Goal:** Prevent large synchronous loads and reduce peak memory.

### Tasks
1. **Generate asset manifest**
   - Write `scpcb_manifest.json` with `{ path, type, size, group }`.
   - Group by game area/room or feature set.

2. **Chunk definitions**
   - `boot` (fonts, menu assets)
   - `core` (player, UI, base sounds)
   - `zone_*` (rooms/areas)
   - `npc_*` (SCP assets)

3. **Loader interface**
   - `loadAssetGroup(name)` returns Promise
   - `unloadAssetGroup(name)` frees memory + handles

### Debugging Hints
- If memory spikes: confirm chunk boundaries; ensure large textures not in boot/core.
- If assets missing: verify manifest path normalization vs runtime paths.

---

## Workstream C — Async Asset Loading API
**Goal:** Blitz3D API calls must not block the main thread.

### Tasks
1. **Placeholder handles**
   - `LoadTexture/LoadMesh/LoadSound` return immediately.
   - Register asset request + placeholder object.

2. **Asset readiness API**
   - Add `IsAssetReady(handle)` / `WaitForAsset(handle)`
   - Update BB game logic where needed (non-blocking check loops).

3. **Deferred binding**
   - When asset resolves, update placeholder with actual resource.

### Debugging Hints
- If game logic assumes immediate availability: add warnings when assets accessed early.
- If placeholders render forever: check promise chain and worker completion.

---

## Workstream D — Decode + Parsing Off Main Thread
**Goal:** Heavy decodes don’t block frame rendering.

### Tasks
1. **Web Worker pipeline**
   - Texture decode worker (image -> RGBA / compressed)
   - Mesh parse worker (RMesh -> buffers)
   - Audio decode worker

2. **Transfer buffers**
   - Use `postMessage(..., [arrayBuffer])` to avoid copies.

3. **Worker pool**
   - Fixed-size pool (2-4) with queue and backpressure.

### Debugging Hints
- If workers fail: check MIME types and cross-origin isolation.
- If decode errors: verify expected format in worker vs actual assets.

---

## Workstream E — Runtime API Coverage
**Goal:** Identify and implement missing Blitz3D runtime imports required by SCPCB.

### Tasks
1. **API audit run**
   - Run SCPCB in debug mode and log missing imports.

2. **Prioritize missing APIs**
   - Critical path: collision, RMesh loader, audio spatialization, entity parenting, animation, input.

3. **Implement or stub**
   - Implement real calls for core gameplay.
   - Stub with warnings for non-blocking extras.

### Debugging Hints
- If game exits on boot: log missing imports and cross-check names.
- If gameplay glitches: trace back to missing entity transform calls.

---

## Workstream F — Memory + Cache Management
**Goal:** Long sessions without crashing or OOM.

### Tasks
1. **Track asset memory**
   - Maintain per-asset memory estimate.
   - Global budget (e.g., 512MB).

2. **LRU cache eviction**
   - When over budget, unload least-recently-used assets.

3. **Explicit unload hooks**
   - Add `FreeTexture`, `FreeSound`, `FreeMesh` where not already used.

### Debugging Hints
- If memory steadily climbs: check for JS references preventing GC.
- If unload causes crashes: ensure WASM handles invalidated safely.

---

## Workstream G — Streaming Gameplay
**Goal:** Smooth transitions between rooms/areas.

### Tasks
1. **Zone triggers**
   - Hook area transitions to load/unload asset groups.

2. **Preload next area**
   - Start downloading when player approaches transition.

3. **Fallback behavior**
   - If next area not ready, show loading overlay or delay entry.

### Debugging Hints
- If transitions stutter: check main thread decode or large GPU uploads.
- If missing props in new room: verify preload triggers and manifest group mapping.

---

## Workstream H — Build & Deployment
**Goal:** Stable production pipeline and caching.

### Tasks
1. **Build outputs**
   - `scpcb.wasm`, manifest, chunked assets.

2. **Compression**
   - Gzip/brotli for wasm + JSON.

3. **Service worker cache**
   - Cache static runtime + assets; keep manifest versioned.

### Debugging Hints
- If assets not updating: clear SW cache or bump manifest version.
- If wasm fails to load: check server MIME type (`application/wasm`).

---

## Milestones
1. **M1: Menu boot** (Boot loader + core assets)  
2. **M2: First room playable** (asset group streaming)  
3. **M3: Single SCP AI** (runtime API coverage + AI behavior)  
4. **M4: Full facility** (zone streaming + memory management)  
5. **M5: Full gameplay loop** (save/load + long sessions)

---

## Notes
- Keep assets external; do not embed in WASM.
- Always async load; avoid blocking calls inside main render loop.
- Add diagnostics overlay (asset counts, memory budget, active downloads).
