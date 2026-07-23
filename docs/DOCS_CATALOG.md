# Docs Catalog (updated 2026-02-02)

This repository has a **lot** of Markdown across `docs/`, `plan/`, `notes/`, and
repo root. This file is a curated map so you can quickly find the right doc for
the job.

If you only read one page, start with:

- `docs/README.md` (documentation hub)
- `plan/README.md` (execution plan hub)

## Repo root docs

- `README.md` — Project overview and entry point.
- `AGENTS.md` — Working instructions for this repo (build/test/run conventions).
- `BUILD.md`, `BUILD_DOCKER.md` — Build workflows.
- `BROWSER_TEST_README.md`, `browser_tests.js` — Browser testing notes.
- `STATUS.md`, `CHANGELOG.md` — Status and change history.
- `plan/00_GLOBAL_PLAN.md` — High-level roadmap (former root roadmaps archived
  in `plan/ARCHIVED/2026-07-22-consolidation/root-plans/`).
- `STACK_VALIDATOR_INTEGRATION.md`, `STACK_BALANCING_*` — WASM stack
  validation/balancing work.
- `*_SUMMARY.md`, `*_ANALYSIS.md` — Session/triage summaries and investigations.

## `docs/` (primary technical documentation)

**Start here**

- `docs/README.md` — Documentation hub and major links.
- `docs/GETTING_STARTED.md` — Setup + first-run workflows.
- `docs/SYSTEM_INDEX.md` — Index of system docs.
- `docs/DOCUMENTATION_UPDATE_PLAN.md` — Dated doc change log / update plan.

**Architecture**

- `docs/SYSTEM_ARCHITECTURE.md` — Overall architecture.
- `docs/ARCHITECTURE.md` — Additional architecture notes.
- `docs/compiler_architecture.md` — Compiler pipeline details.
- `docs/RUNTIME_ARCHITECTURE.md` — TypeScript runtime architecture.

**Compiler**

- `docs/COMPILER_DESIGN.md` — Design goals and approach.
- `docs/COMPILER_STATUS_ANALYSIS.md` — Compiler metrics/status.
- `docs/STACK_BALANCE_HEURISTICS.md` — WASM stack requirements + balancing
  strategies.
- `docs/compiler/` — Compiler deep dives (subsystem-focused).
- `docs/compiler_improvements/INDEX.md` — Improvement proposals.

**Runtime / Web**

- `docs/COMMAND_BUFFER_SYSTEM.md` — Track B command buffer protocol.
- `docs/MEMORY_LEAK_DETECTION.md` — Leak/freeze tooling and how to run it.
- `docs/THREEJS_MIGRATION_REVIEW.md` — Notes about Three.js migration.
- `docs/WEB_IDE_PLAN.md` — Web IDE/interpreter planning.

**Assets**

- `docs/SMPK_FORMAT.md` and `docs/SMPK_SYSTEM.md` — SMPK format + asset
  pipeline.
- `docs/ASSET_PIPELINE.md` — Asset conversion and packaging strategy.
- `docs/FILE_FORMAT_LOADERS.md` — Loader formats (RMesh/B3D/etc).
- `docs/formats/README.md` — Deeper notes on B3D/.X/RMESH (source formats).

**SCPCB target analysis**

- `docs/CORE_SYSTEMS.md`, `docs/ENTITY_SYSTEMS.md`, `docs/GAME_MECHANICS.md` —
  Target game behavior.
- `docs/GRAPHICS_RENDERING_SYSTEMS.md`, `docs/AUDIO_SOUND_SYSTEMS.md`,
  `docs/UI_HUD_SYSTEMS.md` — Target systems.
- `docs/scpcb/` — Track B audits and SCPCB-specific notes.

**Testing / Tooling**

- `docs/deno-tests-documentation.md` — Deno-based test tooling overview.
- `docs/deno-tests-technical.md` — How the Deno tests are implemented.
- `docs/deno-tests-references.md` — Background links and references
  (non-authoritative).
- `docs/ci-documentation.md` — CI pipeline overview (aspirational in places).
- `docs/WASM_ANALYZER.md` — WASM analyzer tool.

**Dated research**

- `docs/debugging_research/README.md` — Index of recent debugging research
  notes.
- `docs/archive/` — Older sessions and dated reports (historical reference).

## `plan/` (execution plans)

- `plan/README.md` — Plan hub.
- `plan/00_GLOBAL_PLAN.md` — Track B execution plan (browser SCPCB port).
- `plan/subplans/` — Current active workstreams.
- `plan/COMPLETED/` and `plan/ARCHIVED/` — Historical plan snapshots.

## `notes/` (working notes)

- `notes/00_MASTER_INDEX.md` — Notes hub.
- `notes/archive/` — Older notes.

## Tests and smoke suites

- `Tests/deno_smoke/` — End-to-end BB→WASM runtime smoke scripts (runs via Deno
  runner).
- `Tools/tests/bb_deno_compile_and_run_smoke.test.ts` — Deno tests that execute
  the smoke scripts.
