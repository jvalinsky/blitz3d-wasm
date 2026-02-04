---
name: track-b-wasm-sanity-check
description: Verify Track B “command buffer” (cmdbuf) WASM output looks correct and is compatible with the web runtime. Use when inspecting `web/public/scpcb.wasm` or other Track B builds to ensure required cmdbuf exports exist, ABI versions match, and the runtime will be able to consume the command stream.
---

# Track B WASM Sanity Check (cmdbuf)

## Required exports

Track B modules that use the command buffer should export:
- `__CmdBufPtr`
- `__CmdBufBytes`
- `__CmdBufAbiVersion`

Quick check:
- `deno run --allow-read Tools/validate_cmdbuf_wasm.ts /path/to/module.wasm`

## ABI version compatibility

- Runtime-side ABI check lives in `web/src/shared/cmdbuf_abi.ts`.
- If `__CmdBufAbiVersion` doesn’t match, the runtime should fail fast rather than mis-decoding the stream.

## Import surface (don’t accidentally rely on stubs)

- `deno run -A Tools/interpreter_import_audit.ts /path/to/module.wasm`
- For SCPCB specifically (correctness guard):
  - `deno run -A Tools/scpcb_import_leak_gate.ts --wasm web/public/scpcb.wasm --require-root`

## Output expectations

When you respond, include:

- Whether cmdbuf exports are present (and which are missing)
- The ABI version observed vs runtime expected
- Any import-audit red flags that would prevent instantiation without stubs

