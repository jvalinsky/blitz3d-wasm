# Subplan 07 — Performance & Deployment

**Phase**: C (budgets tracked from Phase A onward; finalized last)
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Absorbs**: perf/deploy items from Track B `00_best_practices_web_wasm.md`, legacy `plan_5_performance.md` + `plan_6_deployment.md`

## Objective

SCPCB in the browser meets explicit performance budgets and ships as a compressed, cache-friendly static `dist/` that any static host (GitHub Pages, nginx, CDN) can serve.

## Budgets (tracked from A-M1; enforced in Phase C)

| Metric | Budget | Measured by |
|---|---|---|
| Boot → interactive menu | < 10 s on mid-tier laptop, cold cache | browser gate timing |
| Frame rate, representative scene | 60 fps sustained (p95 frame < 20 ms) | nightly perf run |
| Memory growth | ~0 over 30-min soak (post-warmup) | soak test |
| `dist` transfer size (boot+menu groups) | record baseline, then ratchet down | build report |
| Long tasks after boot | none > 200 ms | browser gate |

## Workstreams

### 7.1 Runtime performance

- [ ] Per-frame import calls reduced to O(1): one command-buffer drain + a few timing/IO calls
- [ ] Zero per-frame JS object churn on hot paths (reuse typed arrays; profile allocation rate)
- [ ] Decoded texture/audio caches with enforced disposal (leak tooling verifies)
- [ ] Benchmark scene defined and versioned (the "representative scene" all numbers refer to)
- [ ] Measure-then-decide: OffscreenCanvas/worker rendering; threads/SIMD only with cross-origin isolation (COOP/COEP) and demonstrated wins

### 7.2 Delivery

- [ ] Brotli (fallback gzip) for `.wasm` + binary assets; `Content-Type: application/wasm` so streaming instantiation works
- [ ] Content-hashed filenames + service worker for immutable caching; instant warm reloads
- [ ] `dist/game/scpcb_game.html` is the canonical entry (Vite multi-page); `dist/index.html` optional launcher/redirect
- [ ] One-command deploy script + hosting doc (headers, compression, CORS/COOP/COEP if threads adopted)

### 7.3 Observability in production

- [ ] Debug overlay available behind `?debug` in production builds (frame time, handles, memory)
- [ ] Structured error reporting on boot failure (state machine state + cause visible to the user and copyable for bug reports)

## Acceptance criteria

- All budgets green on the benchmark scene and SCPCB menu/first-room path
- Fresh clone → `deno task test:web:build` → deploy script → playable URL, documented end-to-end
