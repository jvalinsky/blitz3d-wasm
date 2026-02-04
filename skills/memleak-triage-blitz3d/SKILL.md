---
name: memleak-triage-blitz3d
description: Run and interpret Blitz3D-WASM’s repo-native memory leak tooling (scan/leakcheck/WebGPU smoke/SCPCB churn) and map findings to likely owners (RAF loops, event listeners, Three.js dispose, retained maps, WASM instances). Use when investigating freezes, rising memory, GPU leaks, retained handles, or when `deno task memleak:*` reports growth.
---

# Memleak Triage (Blitz3D-WASM)

## Run the right check

- Heuristic scan (fast, noisy):
  - `deno task memleak:scan`

- Create+dispose cycles (JS-side lifecycle):
  - `deno task memleak:run`

- WebGPU smoke (driver/backend sensitive):
  - `deno task memleak:webgpu`
  - Strict modes if you want failures to be hard:
    - `deno task memleak:webgpu:strict`
    - `deno task memleak:webgpu:strict-queue`

- SCPCB churn (exercises runtime imports via test export):
  - `deno task memleak:scpcb:compile`
  - `deno task memleak:scpcb:churn -- --wasm Main.leaktest.wasm --export \"__LeakTestStep%\" --steps 2000 --check-every 50`

## Interpret results → likely root cause

- **RAF/interval growth**: a loop wasn’t canceled on dispose/unload; check owners in web runtime/loader.
- **Listener growth**: `addEventListener` without removal; watch anonymous handlers.
- **Three.js GPU leak**: missing `.dispose()` on geometry/material/texture, or cloning materials repeatedly.
- **Retained maps**: caches keyed by id/path that are never cleared between runs.
- **WASM instance retention**: references to `WebAssembly.Instance/Module/Memory` or typed array views held globally.

## Fix strategy (minimal, correct)

1. Add/confirm a single runtime owner with an explicit dispose path.
2. Ensure dispose:
   - cancels RAF/intervals
   - removes all listeners
   - disposes Three.js resources and clears maps
   - drops references to WASM handles so GC can collect
3. Re-run the same memleak command to confirm improvement (don’t switch tests mid-stream).

## When to use the deeper checklist

If you need browser-side best practices beyond the repo tools, also use `js-wasm-memory-audit`.

