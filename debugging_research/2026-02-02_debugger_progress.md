# Debugger Implementation Progress Log

Date: 2026-02-02

This is a running log of concrete changes made to add source-aligned debugging
(BB ↔ WASM) to the modern web worker runtime, followed by a basic memory
inspector.

## Goals (short)

- Source stepping + breakpoints (Phase A)
- Memory inspector v1 (Phase B)
- Keep notes close to the code paths touched so future work can continue
  quickly.

## Progress

### 2026-02-02

- Started codebase review focusing on existing debug hooks:
  - Compiler already emits statement callbacks via `bbdbg` imports:
    `__bbdbg_enter`, `__bbdbg_leave`, `__bbdbg_stmt` (see
    `Sources/Compiler/CodeGen/StatementGeneration.swift` and
    `Sources/Compiler/CodeGen/CodeGenerator.swift`).
  - CLI supports `-d/--debug` and writes `*.bbdbg.json` metadata (see
    `Tools/wasm-cli/main.swift`).
  - Legacy web runtime has a bbdbg helper module (see
    `web/legacy_modules/bbdbg.ts` and `Sources/Runtime/modules/bbdbg.js`).
  - Modern worker runtime currently stubs missing imports and does not wire
    `bbdbg` into its import object (see `web/src/worker/scpcb_worker.ts`).

- Wired bbdbg into the modern worker runtime (best-effort, non-invasive):
  - Added `bbdbg` imports to the worker instantiation path and implemented hooks
    that capture call stack + statement traces.
  - Worker now attempts to fetch and parse sibling debug metadata
    (`.bbdbg.json`) after instantiation and reports metadata status to the main
    thread.
  - Worker posts a `bbdbgSnapshot` back to the main thread after each export
    call with last location + a bounded statement trace.
  - Added an overlay panel in the worker UI to display the last snapshot and
    trace; includes simple config controls (enable/disable, trace length).
  - Added a best-effort “Load sources…” flow so you can drop local `.bb` files
    into the panel and get an inline source preview around the current line
    (useful when compiled paths aren’t fetchable from the server).
  - Added basic breakpoint management in the overlay:
    - Breakpoints are set by `(fileId, line)` using `.bbdbg.json` metadata’s
      file table.
    - Current worker behavior is “report hits during the last call” (no attempt
      to pause mid-WASM-call yet).

- Added a minimal worker-mode memory inspector (read-only):
  - Main thread can request `addr,len` slices of the worker’s linear memory and
    render a small hex dump + basic i32/u32/f32 preview.
  - This is intended as the first building block for Blitz-specific semantic
    heap inspection later.

- Reviewed and improved `Tools/bb_deno_compile_and_run.ts` for debug builds:
  - Added `BB_DENO_DEBUG=1` to compile with `-d` and transfer `.bbdbg.json`
    metadata into the Deno worker run.
  - Added minimal `imports.bbdbg.__bbdbg_*` hooks so debug-instrumented WASM can
    execute in Deno without missing imports; optional per-statement logging via
    `BB_DENO_BBDBG_LOG=1`.

- Added a worker-side UpdateGame run loop on the UI:
  - New `Run UpdateGame` / `Stop UpdateGame` buttons in `?worker=1` mode.
  - The loop stops automatically when a breakpoint is hit (based on
    `bbdbgSnapshot.breakpointHits`), leaving you in a paused state to inspect
    traces/memory.

- Improved the memory inspector:
  - Added typed reads (`i32/u32/f32`) and a basic Blitz3D string decoder
    (`b3dstr`) based on the project’s string struct assumptions.
  - Added a small watch list (typed) so you can poll a set of addresses while
    stepping/running.

- Added a BBDBG metadata visualizer panel (worker UI):
  - Worker now includes truncated `files[]` and `functions[]` in its `bbdbgMeta`
    message (enough for browsing typical SCPCB units like `Menu.bb`).
  - Main thread overlay now has a searchable “BBDBG metadata (files/functions)”
    panel with a one-click “BP” button to load `(fileId,startLine)` into the
    breakpoint controls.
