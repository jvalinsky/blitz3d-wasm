---
name: wasm-validate-triage
description: Triage WebAssembly validation/instantiation failures in Blitz3D-WASM output. Use when `wasm-validate` fails, when validation errors are large/overwhelming, when you need to bucket failures (stack/type/control-flow), or when you want a minimal repro and a next-step fix plan.
---

# wasm-validate Triage

## Capture a clean failure log

1. Run validation on the exact artifact:
   - `wasm-validate /path/to/output.wasm`

2. If available, generate a digest/summary to avoid scrolling:
   - `python3 Tools/wasm_error_digest.py < /path/to/wasm-validate-output.txt`
   - If you don’t already have a saved log, re-run `wasm-validate` and redirect output.

## Bucket errors (fast routing)

- **Type mismatch / stack underflow**: usually codegen stack discipline (expression/statement lowering).
- **Invalid branch / unreachable / control stack**: usually structured control-flow emission (If/While/Select) or missing `drop`s.
- **Call signature mismatch**: often import/export signature drift or incorrect `call_indirect` table typing.
- **Memory/table/global issues**: incorrect declarations vs usage or platform-specific assumptions.

## Make it actionable

1. Identify the earliest error (often the root cause).
2. Find the responsible compiler stage:
   - Parser (syntax), lowering (AST→IR), codegen (WASM emission), or runtime/import surface.
3. If working with SCPCB:
   - Prefer compiling with source maps/bbdbg metadata when available (helps correlate failures to source).
4. Try to reduce to a small `.bb` repro:
   - Use existing fixtures patterns under `Tests/fixtures` or create a new minimal `.bb` that triggers the same validator bucket.

## Post-fix confirmation

- Re-run `wasm-validate` on the rebuilt wasm.
- If the wasm is intended for the web runtime, also run:
  - `deno task test:web:build`

