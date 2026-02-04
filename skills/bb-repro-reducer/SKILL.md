---
name: bb-repro-reducer
description: Reduce failing Blitz3D BASIC (.bb) programs to minimal repros using the repo’s Deno compile-and-run harness with timeouts. Use when a compiler bug, wasm-validate failure, or runtime hang occurs and you need a tiny fixture for `Tests/fixtures` or a focused bug report with a single failing construct.
---

# BB Repro Reducer

## Use the harness (fast feedback + hang protection)

Primary runner:

- `deno run -A Tools/bb_deno_compile_and_run.ts path/to/program.bb`

Helpful env vars:

- `BB_DENO_TIMEOUT_MS=2000` (default) — tighten/relax as needed
- `BB_DENO_DEBUG=1` — compile with debug hooks when available
- `BB_DENO_BBDBG_LOG=1` — emit bbdbg stmt trace to stdout (if debug build + hooks)
- `BLITZ3D_COMPILER=/abs/path/to/.build/debug/blitz3d-wasm` — override compiler binary

## Reduction workflow (ddmin-style, manual)

1. Confirm the failure is reproducible (same error bucket each run).
2. Delete large sections aggressively:
   - remove unrelated functions/types
   - remove assets/file IO unless required
   - collapse loops/branches
3. After each edit, re-run the harness and ensure the failure stays the same.
4. Once small:
   - rename to something descriptive (e.g. `parser_paren_args_mixed.bb` style)
   - move into `Tests/fixtures/` or `Tests/deno_smoke/` depending on intent

## Classify the failure (for routing)

- **Parse error**: likely `Sources/Compiler/Parser/*`
- **Compile crash / invalid lowering**: `Sources/Compiler/Lowering/*`
- **wasm-validate error**: codegen stack/control flow (`Sources/Compiler/CodeGen/*`)
- **Runtime hang**: likely infinite loop or missing import semantics; confirm timeout triggers and inspect bbdbg trace if available

## Output expectations

When you respond, include:

- The minimal `.bb` file path and how to run it (exact command/env).
- The observed failure text (first/most relevant lines).
- The suspected subsystem and the smallest next debugging step (file/symbol to inspect).

