Original prompt: Set up Playwright/Deno browser tests for `web/interpreter.html`, expand UI coverage, and fix Stop-during-compilation so cancellation doesn’t hang `compileSource()`.

## Status (2026-02-05)

- Interpreter browser tests: `deno task test:web:interpreter` (Playwright + Vite) now covers demo smoke + UI behavior steps.
- Compile cancellation: `web/interpreter.ts` rejects the in-flight `compileSource()` promise on Stop/timeout and cleans up worker listeners.
- Deterministic cancel testing: `web/compiler_worker.ts` supports `debugHoldMs` to hold results before posting (used by the Stop-during-compilation UI test).
- Favicon: `web/interpreter.html` references `/favicon.svg` (served from `web/public/favicon.svg`).

## TODO

- Add Phase 9 coverage gate test (`Tools/tests/scpcb_interpreter_coverage_gate.test.ts`) if still desired.
- Decide whether to commit and push the current batch (repo is `ahead 2`).
