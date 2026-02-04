---
name: import-stub-hygiene
description: Audit, control, and safely evolve WebAssembly import surfaces and stubbed runtime functions in Blitz3D-WASM. Use when a module fails to instantiate due to missing imports, when you’re tempted to “just stub it”, when stubs might mask correctness bugs (especially SCPCB), or when you need to ensure import changes don’t silently break gameplay.
---

# Import / Stub Hygiene

## Goals

- Keep stubs **intentional** and **visible** (no silent correctness regressions).
- Avoid “fixing” missing logic by stubbing a function that should run inside WASM (import leaks).
- Make “unknown import” failures actionable: decide implement vs stub with a clear policy.

## Inventory the current import surface

1. Identify where imports are created:
   - `web/src/shared/wasm_imports.ts`
   - `web/src/runtime/wasm-loader.ts`
   - Interpreter-only paths: `web/interpreter.ts`

2. If an instantiation failure mentions an import name:
   - Search the codebase for that symbol and see whether it is:
     - already implemented,
     - stubbed (warns/returns 0), or
     - missing entirely.

## Decide: implement vs stub

- **Implement** when:
  - It affects game logic correctness (file IO return values, entity transforms, collision/picking, audio state, timing).
  - The module will keep calling it in hot loops (stubs will spam and hide performance issues).

- **Stub only** when:
  - The call is non-essential for current phase and you can prove safe fallback semantics.
  - You also add an explicit warning/telemetry hook so it can’t be forgotten.

## Guardrails (must run)

1. Prevent SCPCB function “import leaks” (a correctness bug, not a stub opportunity):
   - `deno run -A Tools/scpcb_import_leak_gate.ts --wasm web/public/scpcb.wasm --require-root`

2. Audit interpreter import behavior (helps catch accidental new stubs):
   - `deno task interpreter:audit`
   - `deno task interpreter:scpcb-coverage:check`

3. Prefer running the broader web build gate after import changes:
   - `deno task test:web:build`

## Stub quality bar

If you add/keep a stub:

- Make it **loud** (warn once + counter, not infinite console spam).
- Return a value that matches caller expectations (often `0` means “fail” in Blitz3D APIs).
- Add a short note in the skill response about why it’s safe and what real implementation will replace it.

