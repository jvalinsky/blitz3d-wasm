---
name: wasm-hosting-debug
description: Debug hosting Blitz3D-WASM modules in the browser/worker (imports, exports, memory, string marshaling, start functions, command buffer exports). Use when a `.wasm` fails to instantiate, traps at runtime, has missing exports, behaves differently in a Web Worker vs main thread, or when you need a reliable checklist for “why does this WASM behave weird?” in this repo.
---

# WASM Hosting Debug (Blitz3D-WASM)

## Where hosting happens in this repo

- Main-thread loader paths:
  - `web/src/runtime/wasm-loader.ts`
  - `web/src/shared/wasm_imports.ts`
- Worker harness (SCPCB):
  - `web/src/worker/scpcb_worker.ts`
- Interpreter (special-case host + stubs + bbdbg UI):
  - `web/interpreter.ts`

## Instantiation failure triage

1. **Unknown import** (most common):
   - Confirm whether the import is:
     - expected + implemented,
     - expected + intentionally stubbed, or
     - accidental (SCPCB import leak).
   - Use `import-stub-hygiene` guardrails for any change that adds stubs.

2. **Missing export** (host expects a symbol that isn’t there):
   - Inspect `WebAssembly.Module.exports(module)` for the built artifact.
   - For Track B command-buffer modules, ensure the cmdbuf exports exist:
     - `__CmdBufPtr`, `__CmdBufBytes`, `__CmdBufAbiVersion` (see
       `Tools/cmdbuf_wasm_check.ts`).

3. **Trap at runtime** (e.g. “out of bounds memory access”):
   - Look for stale typed-array/DataView caching across `memory.grow()`.
   - Recreate views after growth; avoid holding `new Uint8Array(memory.buffer)`
     globally across operations.

## String marshaling checklist (common pitfall)

- Identify the string ABI used by the module:
  - Structured `__StringAlloc` strings (header + len) vs C-string fallback.
- Ensure the host reads/writes with bounds checks and handles memory growth.
- Worker path already includes a conservative write helper (see
  `web/src/worker/scpcb_worker.ts`).

## Worker vs main-thread differences (must consider)

- Structured clone rules: only post plain data; use transferables for
  `ArrayBuffer`.
- `fetch` cache behavior and base paths can differ; confirm manifest/basePath
  and URL resolution.
- Console/debugger visibility differs; prefer worker->main
  `postMessage({type:"log"})` patterns when needed.

## Minimal debug instrumentation

- Log module imports/exports once (names only) before instantiation.
- Add a “stub called” counter + warn-once behavior rather than spamming per
  frame.
- If bbdbg hooks are present, capture trace/last location to correlate traps to
  code paths.
