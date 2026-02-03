# Plan 02 — WasmKit Runtime Integration

Created: 2026-02-03

## Objective

Load and execute our BB→WASM output using **WasmKit** from the native host, including:
- module loading (bytes from disk),
- instantiation with imports,
- export lookup/calls,
- linear-memory read/write helpers.

## Tasks

### 2.1 Dependency + module loading
- [ ] Add WasmKit as a SwiftPM dependency (pin a version/commit).
- [ ] Load a `.wasm` file from disk (CLI arg or app bundle resource).
- [ ] Validate: module parses; instantiate errors are actionable.

### 2.2 Imports contract (minimal bring-up)
- [ ] Define an imports layer that can:
  - provide basic timing (`MilliSecs` equivalent),
  - provide logging (`DebugLog` equivalent),
  - provide a minimal filesystem read path (even if stubbed initially).
- [ ] Ensure missing imports fail loudly with a list of missing symbols (no silent stubs by default).

### 2.3 Memory helpers
- [ ] Provide helper APIs for:
  - reading/writing `Int32/Float32` at offsets,
  - reading Blitz string layout (if applicable in your WASM output),
  - copying JS-like UTF-8 bytes into WASM memory where needed.
- [ ] Decide and document the canonical string ABI for native host:
  - either “Blitz string object layout” (recommended if matching existing runtime),
  - or `(ptr,len)` for host-only helper imports (avoid mixing silently).

### 2.4 Execution model + watchdog
- [ ] Decide how to enforce responsiveness:
  - time-bucket per frame (e.g. max N ms in WASM tick), and/or
  - run WASM tick on a worker thread and communicate back (harder on macOS UI thread; still feasible).
- [ ] Implement a “Stop” control / kill switch for runaway loops (debug builds at minimum).

## Acceptance criteria

- Can instantiate a trivial `.wasm` and call a known export.
- Can read/write WASM memory reliably and deterministically.
- Missing imports produce clear error output listing symbol names.

