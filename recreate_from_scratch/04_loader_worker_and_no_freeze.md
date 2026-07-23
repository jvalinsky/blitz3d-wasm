# Loader, Worker Harness, and No-Freeze Execution

The single most important browser constraint is:

**Never call a WASM entrypoint that can run forever on the UI thread.**

Legacy Blitz/SCPCB code uses blocking loops; a web port must provide a safe
execution model.

## Recommended Execution Model

- Instantiate WASM in a **Dedicated Worker**.
- Expose **single-step entrypoints**:
  - `InitStep()` or `InitOnce()`
  - `Tick()` / `UpdateGameOnce()`
- Provide a UI that defaults to:
  - “paused”,
  - manual step buttons,
  - opt-in continuous running.

This repo’s loader/worker architecture:

- Loader: `web/src/main.ts`
- Worker harness: `web/src/worker/scpcb_worker.ts`

## Watchdogs

Every cross-thread call should have a timeout:

- If the worker doesn’t respond by deadline:
  - terminate it,
  - surface a clear error,
  - keep diagnostics available.

## Safe Modes and Debug Flags

When rebuilding, define URL flags early; they pay for themselves:

- `?safe` — load/instantiate only; never call exports.
- `?tick=manual` — no RAF loop; only manual stepping.
- `?debug` / `?debughud=1` — show an on-screen log feed (no devtools required).
- `?nogl=1`, `?noassets=1`, `?noaudio=1` — isolate subsystems during triage.

## Worker Messaging Protocol (Shape)

Keep the protocol boring and explicit:

- request:
  - id, exportName, args, timeoutMs
- response:
  - id, ok, result | error

Avoid implicit state in the UI thread; keep worker state in the worker.

## Common Failure Modes (and what to build in)

- Tight loop hangs: watchdog termination + “last successful stage” reporting.
- Missing preloaded files: show which paths were requested and from where.
- Memory growth detaches typed arrays: detect and recreate views.
