# Subplan 06 — Testing & CI

**Phase**: Continuous
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Code**: `Tests/` (Swift: Blitz3DCompilerTests, CompilerTests, IntegrationTests, Blitz3DEngineTests), `Tests/deno_smoke/`, `Tools/tests/`, `browser_tests.js`, memleak tooling
**Absorbs**: `ACTIVE/01_COMPILER_COMPLETION.md` + `ACTIVE/05_TEST_SUITE_UPDATE.md` (test-suite hygiene done — kept as protocol), Track B `05_build_deploy_ci_gates.md` + `06_testing_and_stability.md`

## Objective

A test pyramid where every layer of the toolchain fails loudly and locally before it fails in a browser, and CI gates make regressions structurally hard to merge.

## Test pyramid

| Layer | What | Command | Gate |
|---|---|---|---|
| 1. Swift unit | Lexer/parser/IR/codegen; engine subsystems | `swift test` | PR-blocking |
| 2. BB fixture suite | 57-file corpus compiles + wasm validates | `deno task test:all` (subset) | PR-blocking |
| 3. Deno smoke | BB→WASM compile-and-run semantics end-to-end | `Tools/tests/bb_deno_compile_and_run_smoke.test.ts` | PR-blocking |
| 4. Contract gates | Export names, ABI version, dist purity (no `.b3d/.x/.rmesh`), manifest validity | `deno task test:web:build` + A-M0 export gate | PR-blocking |
| 5. Browser gates | Scripted 300-frame scenes in headless browser: no exceptions, stable handles, no cmd-buffer overflow | `run_browser_test.sh` / puppeteer harness | PR-blocking once stable |
| 6. Soak/leak/perf | Mode-transition leak checks, 30-min soak, frame-time + memory-growth trend | scheduled/nightly | trend-tracked |
| 7. Differential (Phase B) | TS runtime vs Swift engine command-stream/frame equivalence | new harness (subplan 02.3) | PR-blocking during migration |

## Workstreams

### 6.1 Consolidate the entrypoint (near-term)

- [ ] `deno task test:all` is the single local baseline; document exactly what it covers in `Tests/README`
- [ ] Prune root-level ad-hoc `test_*.bb` / `test_*.html` files: promote the useful ones into `Tests/fixtures/`, delete the rest (they are drift hazards)
- [ ] Make browser gates runnable locally with one command and sensible timeouts

### 6.2 New gates required by Phase A

- [ ] A-M0 export-contract gate (subplan 05)
- [ ] Boot/menu/gameplay/round-trip scenario suite in a worker with timeouts (kill-switch verified — a hung test fails, never hangs CI)
- [ ] Memleak checks extended across mode transitions (menu↔game)
- [ ] Command-buffer stress fixture (overflow policy, handle churn)

### 6.3 Metrics discipline

- [ ] Compiler metrics only in `docs/COMPILER_STATUS_ANALYSIS.md`; CI recomputes and diffs so the doc can't silently drift from reality
- [ ] Perf metrics (frame time p95, memory growth/hour, boot time) recorded per nightly run; regressions > threshold open an issue automatically

### 6.4 Regression protocol (from retired ACTIVE/01 — keep practicing)

1. Smallest `.bb` repro → 2. classify layer → 3. targeted test first → 4. fix → 5. `deno task test:all` → 6. deciduous log + commit link

## Acceptance criteria

- Every Phase A/B milestone has an automated gate; "done" means the gate is green in CI, not a manual observation
- A hung wasm can never hang the suite (watchdogs everywhere)
- No stale metric numbers anywhere outside the canonical doc
