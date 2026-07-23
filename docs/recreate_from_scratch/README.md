# Recreate Blitz3D-WASM From Scratch (Research Hub)

This folder is a **research + reconstruction notebook**: how we would rebuild
Blitz3D-WASM from zero today, using what we learned while building this repo.

It is intentionally **action-oriented** (phase-by-phase), and it links to the
existing deep docs in `docs/` plus a curated set of external references.

## Start Here

- `RESEARCH_PLAN.md` — How to expand this docset (what to read, what to extract,
  what to verify).
- `00_rebuild_roadmap.md` — The recommended rebuild order (thin vertical
  slices).
- `90_web_references.md` — External sources (WebAssembly/Workers/Swift
  WASM/XHR/audio policies).

## What “From Scratch” Means Here

- Rebuild **the architecture**, not a byte-for-byte identical implementation.
- Preserve the core principle: **WASM does game logic; TS/JS provides browser
  bindings.**
- Optimize for:
  - rapid iteration (thin vertical slices),
  - correctness (WASM validation + fixtures),
  - performance (batching; low JS↔WASM call overhead),
  - safety (no-freeze execution model; watchdogs),
  - maintainability (clear API boundary; testable subsystems).

## Repo Anchors (Primary Sources)

These are the “source of truth” locations we reference throughout:

- Compiler entry + pipeline: `Sources/Compiler/`
- Runtime (Track B): `web/src/runtime/`
- Loader + worker harness: `web/src/main.ts`, `web/src/worker/`
- Shared protocols/utilities: `web/src/shared/`
- Asset pipeline + formats: `Tools/`, `docs/SMPK_SYSTEM.md`,
  `docs/ASSET_PIPELINE.md`
- Testing + leak tooling: `Tools/tests/`, `docs/MEMORY_LEAK_DETECTION.md`

## Doc Map

- `00_rebuild_roadmap.md` — Rebuild phases and “definition of done” per phase.
- `00b_mvp_spec.md` — Minimal shippable rebuild target (“done when” checklist).
- `01_repo_map_and_components.md` — Component inventory + “minimum required
  subset” for MVP.
- `02_compiler_rebuild_notes.md` — Compiler architecture, implementation order,
  common traps.
- `02_compiler_code_anchors.md` — Code-first pointers for compiler behavior
  (prefer over docs).
- `02c_ir_design_tradeoffs.md` — IR design choices and tradeoffs (supplemented
  with external references).
- `03_runtime_rebuild_notes.md` — Runtime API surface, command buffer, entity
  table, disposal.
- `03_runtime_code_anchors.md` — Code-first pointers for runtime behavior
  (prefer over docs).
- `04_loader_worker_and_no_freeze.md` — Worker protocol, watchdogs, debug HUD,
  safe modes.
- `04_loader_worker_code_anchors.md` — Code-first pointers for loader/worker
  behavior (prefer over docs).
- `05_assets_and_vfs.md` — Manifest preloads, path aliasing, sync-IO
  constraints, SMPK.
- `06_testing_tooling_and_ci.md` — Test strategy, wasm validation gates, leak
  harnesses.
- `08_lessons_learned.md` — The “rules” that saved the most time.
- `90_web_references.md` — External references + why they matter.
- `91_open_questions.md` — Unresolved design questions / future research.
- `scpcb/README.md` — Code-first SCPCB game design/implementation notes (from
  `~/Software/scpcb`).
