# Loader + Worker Harness: Code Anchors (Prefer This Over Docs)

This is the “no-freeze” layer: bootstrapping, running WASM in a Worker, and
guarding every call with timeouts.

## Loader (Main Thread)

- Loader entrypoint and UI controls: `web/src/main.ts`
  - Worker lifecycle:
    - `terminateWorker()` tears down worker + clears pending calls + updates
      status.
  - Single in-flight call policy + watchdog:
    - `workerCall(exportName, timeoutMs, args)` enforces “only one pending call”
      and terminates the worker on timeout.
  - Update loop:
    - `startWorkerUpdateLoop()` repeatedly calls `UpdateGame` with yields and
      strict idle checks.
  - Probe sequence:
    - `runWorkerProbe()` calls a curated list of SCPCB exports with per-export
      timeouts.

## Worker (Dedicated Thread)

- Worker harness: `web/src/worker/scpcb_worker.ts`
  - Message protocol types:
    - `cmd: "init"` (fetch wasm + manifest, preload group)
    - `cmd: "call"` (invoke an export)
    - `cmd: "setGlobal"` (set exported global by name)
    - `cmd: "primeInput"` (synthetic input for “press any key” loops)
    - `cmd: "dispose"` (terminate/cleanup)
    - Debug tooling: `dbg*` messages (read memory/global, breakpoints, config)
  - Status reporting:
    - `postStatus()` / `maybePostStatus()` posts throttled status snapshots for
      the HUD.
  - String ABI helpers (must match compiler/runtime):
    - `readString(mem, ptr)` prefers the headered Blitz string layout and falls
      back to C-strings.
    - `writeString(mem, __StringAlloc, str)` grows memory on-demand before
      writing.

## Path Resolution in the Worker

- Worker imports path utilities: `web/src/shared/path_alias.ts`
  - `normalizePath(...)`, `openFileCandidates(...)`

## Import Stubbing (Worker-Side)

- Worker uses stubbing for missing imports in some paths:
  - `web/src/shared/wasm_imports.ts`
  - This is useful for demo/debug flows but should be treated as “dev-only
    safety net”.
