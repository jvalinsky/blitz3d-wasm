---
name: web-worker-debugging
description: Debug Web Worker behavior in Blitz3D-WASM’s web frontend (message protocols, transferables, worker lifecycle, status/log plumbing, asset preloads, and WASM execution in workers). Use when worker init hangs, messages are dropped/mis-typed, structured clone errors occur, worker-side exceptions are hard to see, or when SCPCB worker status/debug telemetry needs improvement.
---

# Web Worker Debugging (Blitz3D-WASM)

## Key worker code in this repo

- Worker implementation:
  - `web/src/worker/scpcb_worker.ts`
- Main-thread owner/boot logic:
  - `web/src/main.ts`
- Shared helpers:
  - `web/src/shared/path_alias.ts`
  - `web/src/shared/wasm_imports.ts`

## Common failure modes → fixes

- **Worker never reaches “ready”**:
  - Add/confirm status posts (see `postStatus` / `maybePostStatus` in
    `web/src/worker/scpcb_worker.ts`).
  - Ensure the main thread listens for `{ type: "status" }` and logs
    transitions.

- **“DataCloneError” / structured clone issues**:
  - Only send plain objects, numbers, strings, `ArrayBuffer`/typed arrays.
  - Prefer transferring buffers:
    - `worker.postMessage({ wasmBytes }, [wasmBytes.buffer])`

- **Silent worker exception**:
  - Add a worker-side `self.addEventListener("error", ...)` and forward via
    `postMessage({type:"log"/"error"})`.
  - Add a main-thread `worker.onerror` handler and surface the message
    prominently.

- **Asset preload mismatch**:
  - Verify manifest URL/basePath and the selected preload group.
  - Ensure worker path normalization matches runtime VFS expectations.

## Message protocol hygiene

1. Keep message types as discriminated unions (`cmd: "init" | "call" | ...`).
2. Version any breaking protocol changes (even a simple `version: 1` field).
3. Validate message payloads at the boundary (cheap `typeof` checks) so failures
   are early and readable.

## Debugging workflow

1. Reproduce with the simplest flow (init only, no game loop).
2. Capture:
   - worker status transitions,
   - last requested file path,
   - last debug log line (if available).
3. Only then step into WASM execution paths.
