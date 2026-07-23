# Documentation Directory

Technical documentation for the Blitz3D-WASM project.

## Main Documents

See [README.md](README.md) for the documentation index. See
[DOCS_CATALOG.md](DOCS_CATALOG.md) for a curated map of docs across the repo.

## Structure

- Root `.md` files - Main documentation
- `compiler/` - Compiler-specific docs
- `compiler_improvements/` - Improvement proposals
- `archive/` - Old session notes and dated files
- `plans/` - Planning docs
- `project/` - Project notes

## Key Documents

| Document                    | Purpose                |
| --------------------------- | ---------------------- |
| README.md                   | Documentation index    |
| DESIGN_CHOICES.md           | Architecture decisions |
| CODE_REVIEW.md              | Code quality notes     |
| SYSTEM_ARCHITECTURE.md      | System overview        |
| STACK_BALANCE_HEURISTICS.md | WASM stack management  |

## Recent doc updates (2026-02-02)

- Archived `deploy.sh` guidance (see `docs/archive/dated/2026-02-02_deploy.md`).
- Documented the BB→WASM smoke suite (`Tests/deno_smoke/` +
  `Tools/tests/bb_deno_compile_and_run_smoke.test.ts`).
- Documented the “safe runner” approach (Worker + watchdog timeout) used by
  `web/interpreter.html` and `web/public/bb_wasm_runner_demo.html`.
