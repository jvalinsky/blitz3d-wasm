# Directory: blitz3d-wasm/Tools

**Parent**: [../](..)

**Children**:
- [analyzer](./analyzer)
- [wasm-cli](./wasm-cli)

## Key runner/test tools (2026-02-02)

- `Tools/bb_deno_compile_and_run.ts` — Compile `.bb` with the native compiler binary and execute the result in a Worker with a watchdog timeout (prevents infinite-loop hangs).
- `Tools/tests/bb_deno_compile_and_run_smoke.test.ts` — End-to-end smoke tests that run `Tests/deno_smoke/*.bb`.
