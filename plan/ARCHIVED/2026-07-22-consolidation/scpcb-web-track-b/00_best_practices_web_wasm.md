# Plan 00 — Web/WASM Game Port Best Practices (Checklist)

Created: 2026-01-29
Last updated: 2026-01-29 15:31 EST

Goal: encode proven web/WASM game-port practices into actionable tasks for this repo.

## A) Performance Fundamentals

- [x] Keep the JS↔WASM boundary coarse-grained (batch calls, command buffer). (Done: 2026-01-29)
- [ ] Prefer streaming compilation/instantiation where available (avoid blocking on full download before compile); ensure server sets `Content-Type: application/wasm`.
- [ ] Avoid unbounded WASM memory growth; pick a realistic initial memory and grow intentionally.
- [ ] Use `WebAssembly.Memory` growth awareness (copy/clone buffers that must outlive growth).
- [ ] Minimize JS allocations on hot paths (reuse typed arrays, avoid per-frame object churn).
- [ ] Keep “data” in WASM linear memory and only send IDs/offsets across the boundary.

## B) Rendering Threading Model

- [ ] Consider `OffscreenCanvas` + Worker rendering for reduced main-thread jank.
- [ ] If using threads/SIMD (future):
  - [ ] ensure cross-origin isolation (COOP/COEP) is configured for `SharedArrayBuffer`
  - [ ] measure if threads actually help vs overhead for your workload
- [ ] Consider a split model: Worker runs WASM + sim tick; main thread only forwards input + presents UI overlays (or Worker renders via OffscreenCanvas).

## C) Asset Delivery + Caching

- [x] Use an explicit asset manifest and preload what must be synchronous for game init. (Done: 2026-01-29)
- [x] Prefer “packed” binary formats (`.smpk`) to minimize runtime parsing cost. (Done: 2026-01-29)
- [ ] Add caching layers for decoded textures/audio and enforce disposal to prevent leaks.
- [ ] Use a Service Worker (or Vite PWA) to cache large immutable assets + WASM for fast reloads.
- [ ] Enable compression (Brotli/gzip) for `.wasm` and binary assets.

## D) Main Loop + Input

- [ ] Use `requestAnimationFrame` (or a worker clock + messages) and clamp large `dt` spikes.
- [ ] Avoid blocking loops in WASM that starve the JS event loop (refactor init/game loops into steps).
- [ ] Implement pointer lock + focus rules (don’t steal input in menus/overlays).
- [ ] Make init resumable (step-based) and keep “work chunks” short to avoid long tasks.

## E) Audio

- [ ] Use WebAudio with explicit node lifecycle management (disconnect/dispose).
- [ ] Handle autoplay restrictions and resume AudioContext on user gesture.
- [ ] If audio latency/GC becomes an issue, consider `AudioWorklet` for mixing/streaming.

## F) Testing + Diagnostics

- [ ] Add “long-run” leak tests (already have tooling; expand coverage).
- [ ] Add perf regressions checks (frame time, memory growth) as tracked metrics.

## Sources (for later deep dives)

- MDN: WebAssembly JavaScript API (`compileStreaming` / `instantiateStreaming`) — https://developer.mozilla.org/en-US/docs/WebAssembly/JavaScript_interface
- web.dev: cross-origin isolation for `SharedArrayBuffer` (COOP/COEP) — https://web.dev/articles/coop-coep
- MDN: `OffscreenCanvas` — https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas
- Emscripten docs: “Optimizing WebGL” — https://emscripten.org/docs/optimizing/Optimizing-WebGL.html
- Mozilla Hacks: “WebAssembly — now in all major browsers” — https://hacks.mozilla.org/2017/03/webassembly-now-in-all-major-browsers/
