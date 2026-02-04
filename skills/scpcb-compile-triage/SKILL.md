---
name: scpcb-compile-triage
description: Compile SCP: Containment Breach (SCPCB) Blitz3D sources to Track B command-buffer WASM and debug failures. Use when `Tools/compile_scpcb_main.ts` fails, when `web/public/scpcb.wasm` won’t instantiate, when SCPCB functions leak into WASM imports, or when you need bbdbg/source-map builds for freeze triage.
---

# SCPCB Compile Triage

## Compile (Track B default)

- `deno run -A Tools/compile_scpcb_main.ts`

Helpful flags:

- Debug hooks + bbdbg metadata:
  - `deno run -A Tools/compile_scpcb_main.ts --debug`
- Emit `.map` for wasm tooling:
  - `deno run -A Tools/compile_scpcb_main.ts --source-map`
- Verbose compiler output:
  - `deno run -A Tools/compile_scpcb_main.ts --verbose`

Outputs (defaults):

- Runtime output: `/tmp/scpcb_cmdbuf.wasm`
- Web loader artifact: `web/public/scpcb.wasm` (copied into dist on `deno task web:build`)

## Post-compile gates (catch silent breakage)

1. Ensure SCPCB user-defined functions did not become WASM imports:
   - `deno run -A Tools/scpcb_import_leak_gate.ts --wasm web/public/scpcb.wasm --require-root`

2. Ensure the module exposes the command buffer exports (Track B):
   - Use the cmdbuf check helper from `Tools/cmdbuf_wasm_check.ts` (or run the project’s `test:web:build` gate which will trip if incompatible).

3. If you touched runtime imports/stubs:
   - `deno task interpreter:audit`
   - `deno task interpreter:scpcb-coverage:check`

## Failure patterns → next action

- **Missing SCPCB root**: `Tools/compile_scpcb_main.ts` assumes `../../scpcb/` by default.
  - Re-run with `--scpcb-root <dir>` if needed.
- **WASM instantiation fails (unknown import)**:
  - Audit host-side import objects and intentional stubs:
    - `web/src/shared/wasm_imports.ts`
    - `web/src/runtime/wasm-loader.ts`
  - Prefer adding real implementations for core functions; only stub when explicitly intended.
- **“Import leak” gate fails**:
  - Treat as correctness bug: the SCPCB function should execute inside the module.
  - Investigate name collisions and lowering/codegen decisions rather than adding stubs.
- **Freeze during init**:
  - Prefer debug builds (`--debug`) and use bbdbg-aware paths in the web interpreter/loader.

