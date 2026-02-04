---
name: scpcb-import-leak-gate
description: Fix SCPCB “import leaks” where SCPCB-defined functions end up as WASM imports. Use when Tools/scpcb_import_leak_gate.ts fails or when scpcb.wasm unexpectedly imports SCPCB helper functions (breaking gameplay correctness).
---

# SCPCB Import Leak Gate

Goal: ensure **no SCPCB user-defined function names** appear in the WASM function import list.

## Workflow

1) Run the gate and capture the leak list:
   - `deno run -A Tools/scpcb_import_leak_gate.ts --wasm web/public/scpcb.wasm --require-root`

2) Classify each leaked name:
   - **Built-in runtime import collision**: compiler is importing a symbol that SCPCB also defines.
   - **Missing function discovery**: SCPCB defines it, but the compiler didn’t include it in `ProgramNode.functions`.

3) If it’s a **collision**, fix at import registration time:
   - Ensure imports are added via `addImports(excluding:)` with *all* user-defined function names (including from includes).
   - Do not keep “game-specific helpers” (SCPCB DLL shims, math helpers, etc.) in the default runtime import allowlist unless they are *guaranteed* not to collide.

4) If it’s **missing discovery**, verify include + parse coverage:
   - Confirm SCPCB `Function` definitions from included files end up in `ProgramNode.functions` (not only nested in `.include` statements).
   - If needed, add a compiler-side debug mode that prints counts of discovered functions/types/globals per file.

5) Recompile and re-run the gate:
   - `deno task scpcb:compile:main`
   - `deno run -A Tools/scpcb_import_leak_gate.ts --wasm web/public/scpcb.wasm --require-root`

## Success criteria

- Gate reports `leaks=0`.
- `wasm-objdump -x web/public/scpcb.wasm` shows no imports matching SCPCB-defined function names.
