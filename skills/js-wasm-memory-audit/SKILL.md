---
name: js-wasm-memory-audit
description: Deep-dive checklist and workflow for finding and fixing memory leaks in browser JS + WebAssembly runtimes (Three.js/WebGL, Web Audio, event listeners, RAF loops, WASM memory views) with repo-oriented search patterns.
---

# JS/WASM Memory Audit

Use this skill when reviewing browser code that loads/hosts WebAssembly and
wraps Web APIs (Three.js/WebGL, Audio, input) and you need to identify memory
leaks, GPU leaks, and long-lived references.

## Workflow

1. **Find lifecycle boundaries**
   - Identify the entrypoint(s) that create the runtime and load `.wasm` (e.g.
     `WebAssembly.compile/instantiate`).
   - Confirm there is a single runtime owner and a **dispose/unload** path that
     cancels loops and releases resources.

2. **Search for long-lived callbacks**
   - `requestAnimationFrame` recursion without a stored handle / cancel path.
   - `setInterval`/`setTimeout` without clear.
   - `addEventListener` with anonymous functions (hard to remove).

   Suggested searches:
   - `rg -n "requestAnimationFrame\\(|setInterval\\(|setTimeout\\(|addEventListener\\(" web/src Sources/Runtime -S`

3. **Audit WebGL/Three.js resource ownership**
   - Any `new THREE.Texture/Material/Geometry/...` created in loops or
     repeatedly called API shims.
   - Ensure **dispose** happens for:
     - `geometry.dispose()`
     - `material.dispose()`
     - `texture.dispose()` (and detach from materials if needed)
     - `renderer.dispose()` / `renderer.forceContextLoss()` on shutdown
   - Watch for **material cloning** patterns that create unbounded materials.

   Suggested searches:
   - `rg -n "\\.clone\\(\\)|new THREE\\.|\\.dispose\\(" web/src/runtime -S`
   - `rg -n "Free(Entity|Texture|Image)|LoadTexture|CreateTexture" web/src/runtime -S`

4. **Audit Web Audio lifecycle**
   - `AudioContext` should be closed on shutdown.
   - Buffer sources, gain/pan nodes should be disconnected on stop.
   - Media element streams should pause, clear `src`, call `load()`, and
     disconnect nodes.

   Suggested searches:
   - `rg -n "AudioContext|create(BufferSource|Gain|StereoPanner|MediaElementSource)|decodeAudioData" web/src/runtime -S`

5. **WASM memory interaction checks**
   - Avoid caching `new Uint8Array(memory.buffer)` across possible memory
     growth; recreate views after growth.
   - Drop references to `WebAssembly.Instance/Module/Memory` on shutdown so GC
     can collect them.

6. **Classify issues**
   - **Hard leak**: resources never eligible for GC (listeners/RAF/global
     caches).
   - **GPU leak**: Three.js dispose missing (VRAM grows even if JS heap is
     stable).
   - **Churn**: allocation pressure (new vectors/material clones each frame)
     causing stutter.

## Fix patterns (preferred)

- **One runtime owner**: store runtime handles and implement `dispose()` that:
  - cancels RAF loops
  - removes event listeners
  - disposes Three.js resources
  - shuts down audio (`disconnect` + `close`)
  - clears caches/maps that retain large `Uint8Array` assets

- **Material mutation**: clone a shared material **once** (mark via `userData`)
  and mutate in place afterwards.

- **Async loads**: if a resource is freed before the load completes, dispose the
  loaded resource in the callback and bail.
