---
name: bb-wasm-inspection
description: Inspect generated WebAssembly from Blitz3D BASIC (.bb) files and sanity-check that it “looks right” for this repo’s runtimes. Use when you compiled a .bb to `.wasm` and want to verify validity, imports/exports, debug metadata (bbdbg/source map), and whether the web runtime/interpreter likely has the needed imports implemented.
---

# BB→WASM Inspection

## Quick start (best signal per minute)

1. Produce a debug-friendly wasm + digest:
   - `Tools/ir_debug_compact.sh path/to/program.bb /tmp/program.wasm`

This compiles with `--use-ir -g -d` (source map + bbdbg) and prints:
- a compact `wasm-validate` digest (`Tools/wasm_error_digest.py`)
- a best-effort analyzer run (Tools/analyzer) if deps are installed

## Sanity checks (in order)

1. **Basic validity**
   - Prefer: `wasm-validate /tmp/program.wasm`
   - Fallback (parses module only): `deno run --allow-read Tools/wasm_validate.ts /tmp/program.wasm`

2. **Imports/exports are reasonable**
   - List what the web runtime/interpreter already implements vs what the module requires:
     - `deno run -A Tools/interpreter_import_audit.ts /tmp/program.wasm`

3. **Smoke-run in a watchdog harness (non-browser)**
   - `deno run -A Tools/bb_deno_compile_and_run.ts path/to/program.bb`
   - Use env vars when needed:
     - `BB_DENO_TIMEOUT_MS=2000` (hang protection)
     - `BB_DENO_DEBUG=1` / `BB_DENO_BBDBG_LOG=1` (debug tracing)

## What “looks correct” (heuristics)

- Module validates (or at least instantiates as a `WebAssembly.Module`).
- Export surface matches intent:
  - Typical: `memory` + entrypoint (`main` and/or `_start`)
  - Track B cmdbuf builds may also export `__CmdBufPtr/__CmdBufBytes/__CmdBufAbiVersion` (see `track-b-wasm-sanity-check` skill).
- Import surface doesn’t include unexpected game/user functions (import leaks are correctness bugs).
- Debug builds:
  - `.map` exists when compiled with `-g`
  - `.bbdbg.json` exists and/or the module imports `bbdbg.__bbdbg_enter/leave/stmt` when compiled with `-d`

## Output expectations

When you respond, include:

- The exact compile command used + output `.wasm` path
- `wasm-validate` (or parse) result summary
- Import audit summary (missing imports count + the top missing names)
- Whether debug metadata is present (map + bbdbg)

