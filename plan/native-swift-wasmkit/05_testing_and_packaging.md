# Plan 05 — Testing and Packaging

Created: 2026-02-03

## Objective

Make the native host reliable to iterate on:

- tests for ABI/memory helpers,
- deterministic smoke runs for WASM modules,
- packaging strategy for distributing the app + assets.

## Tests

### Tasks

- [ ] Add unit tests for:
  - string decoding/encoding helpers,
  - memory bounds checks,
  - ABI version validation.
- [ ] Add a “smoke runner” mode:
  - load a `.wasm`,
  - call a fixed export N times,
  - assert no crashes and stable memory growth.
- [ ] Add import coverage reporting:
  - list unresolved imports for a module,
  - optionally compare to a “required imports” allowlist for target demos.

## Diagnostics

### Tasks

- [ ] Add structured logging categories (WASM instantiation, imports, render
      bridge, FS).
- [ ] Add per-frame timing metrics (tick time, render time, upload time if
      applicable).
- [ ] Add a watchdog trigger report when execution exceeds a threshold.

## Packaging

### Tasks

- [ ] Decide how to bundle:
  - host executable,
  - `.wasm` payload(s),
  - assets (if any).
- [ ] Document a “run from repo” workflow vs “bundle for distribution”.
- [ ] Add a simple CLI argument contract:
  - `--wasm path/to/module.wasm`
  - `--assets-root path`
  - `--manifest path` (optional)

## Acceptance criteria

- One command builds and runs the native host against a specified `.wasm`.
- Failing modules produce actionable output (missing import names, ABI mismatch,
  etc.).
- Basic stability: no unbounded memory growth in a short smoke run.
