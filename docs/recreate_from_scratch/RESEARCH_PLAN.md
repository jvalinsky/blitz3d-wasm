# Research Plan: Recreating Blitz3D-WASM From Scratch

This is a plan for building out the **multi-file documentation in this folder**
and for validating it against both the repo and external references.

## Goals

1. Capture a **rebuild recipe** that is realistic (incremental, testable).
2. Record the **high-value lessons learned** that reduce time-to-MVP.
3. Identify **stability constraints** (no blocking loops, no sync XHR) early.
4. Provide a **source-linked map**:
   - “Here’s the concept” → “Here’s where it lives in this repo” → “Here’s the
     external reference”.

## Audience

- “Future us” (or a new contributor) rebuilding the same system with a clean
  repo.
- Someone who wants to port another large Blitz3D game, not only SCPCB.

## Non-Goals

- Re-documenting every file in `docs/` (that already exists).
- Copying existing docs verbatim; this folder is an **integration +
  reconstruction** narrative.

## How To Expand This Docset (Workflow)

### Step 1: Inventory and MVP boundary (repo reading)

Produce/maintain `01_repo_map_and_components.md` by:

- Enumerating components, their responsibilities, and minimal interfaces.
- Identifying “MVP subset” (e.g. particle demo) vs “SCPCB-grade” features.

Repo reading targets:

- Compiler: `Sources/Compiler/` (Lexer/Parser/Lowering/IR/CodeGen)
- Runtime: `web/src/runtime/` and `web/src/shared/`
- Loader: `web/src/main.ts`, `web/src/worker/`
- Tests: `Tests/`, `Tools/tests/`
- Docs: `docs/ARCHITECTURE.md`, `docs/COMPILER_DESIGN.md`,
  `docs/COMMAND_BUFFER_SYSTEM.md`

### Step 2: Extract “thin vertical slices”

Update `00_rebuild_roadmap.md` with slices that always end in a runnable
artifact:

- Slice examples:
  - BB → WASM “hello world” (print/log) + validation
  - A tiny runtime import surface (PositionEntity/CreateSprite) + a demo scene
  - Worker harness + watchdog + “manual tick” controls
  - Command buffer drain + entity table readback
  - VFS manifest preload + one asset format end-to-end

### Step 3: Verify boundary rules (browser constraints)

Maintain `04_loader_worker_and_no_freeze.md` and `05_assets_and_vfs.md` with:

- Explicit “forbidden patterns” (e.g. tight infinite loops in WASM called from
  UI thread).
- Browser constraints that impacted architecture:
  - autoplay/user-gesture gating for audio,
  - synchronous XHR deprecation,
  - memory buffer detachment on `WebAssembly.Memory.grow()`.

External reading targets:

- WebAssembly JS API and memory behavior
- Worker messaging + transferables
- XHR sync deprecation notes/spec references
- Swift WASM toolchain docs (Swift SDK install, WASI target)

### Step 4: Capture correctness/perf gates

Expand `06_testing_tooling_and_ci.md` with:

- “You broke it if…” checks:
  - `wasm-validate` clean output,
  - deterministic command buffer decoding,
  - no leak growth in churn suites,
  - no unbounded worker pending calls/timeouts.

Repo reading targets:

- Deno tasks in `deno.json`
- Leak tools in `Tools/` and docs in `docs/MEMORY_LEAK_DETECTION.md`

### Step 5: Keep a running list of open questions

Maintain `91_open_questions.md` as decisions evolve:

- Where do we want to land long-term (WASM-owns-UI vs JS-owns-UI)?
- Which import surface is “standard library” vs “game-specific glue”?
- Which asset formats should be “runtime supports” vs “offline conversion
  required”?

## Deliverables (Files + Acceptance Criteria)

## Docset Outline Table (What to Extract + Where)

| Doc                                 | Main Questions                                                               | Repo “primary sources” to read                                                                                                                           | External refs                                      |
| ----------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `00_rebuild_roadmap.md`             | What are the rebuild phases and exit criteria?                               | `docs/GETTING_STARTED.md`, `docs/ARCHITECTURE.md`, `plan/scpcb-web-track-b/README.md`                                                                    | WebAssembly + Worker docs                          |
| `00b_mvp_spec.md`                   | What is the minimum shippable rebuild target?                                | `Tools/wasm-cli/main.swift`, `web/src/main.ts`, `web/src/worker/scpcb_worker.ts`                                                                         | (optional)                                         |
| `01_repo_map_and_components.md`     | What are the subsystems and MVP boundary?                                    | `Sources/Compiler/`, `web/src/runtime/`, `web/src/worker/`, `Tools/`                                                                                     | (none required)                                    |
| `02_compiler_rebuild_notes.md`      | What minimal language subset ships an MVP? What are codegen traps?           | `Sources/Compiler/Parser/`, `Sources/Compiler/CodeGen/`, `docs/STACK_BALANCE_HEURISTICS.md`                                                              | WebAssembly spec (validation rules)                |
| `03_runtime_rebuild_notes.md`       | What imports exist and which must be batched? How do we avoid leaks?         | `web/src/runtime/`, `web/src/shared/command_buffer.ts`, `docs/MEMORY_LEAK_DETECTION.md`                                                                  | MDN WebAssembly.Memory                             |
| `04_loader_worker_and_no_freeze.md` | How do we prevent hangs and debug safely?                                    | `web/src/main.ts`, `web/src/worker/scpcb_worker.ts`                                                                                                      | MDN Worker messaging                               |
| `03_runtime_code_anchors.md`        | Where is runtime behavior defined in code?                                   | `web/src/runtime/core.ts`, `web/src/runtime/graphics/index.ts`, `web/src/runtime/fileio.ts`, `web/src/shared/*`                                          | (optional)                                         |
| `04_loader_worker_code_anchors.md`  | Where is no-freeze behavior defined in code?                                 | `web/src/main.ts`, `web/src/worker/scpcb_worker.ts`                                                                                                      | (optional)                                         |
| `05_assets_and_vfs.md`              | How do we satisfy legacy sync-IO assumptions?                                | `web/src/runtime/fileio.ts`, `web/public/scpcb_manifest.json`, `docs/SMPK_SYSTEM.md`                                                                     | XHR sync deprecation refs                          |
| `06_testing_tooling_and_ci.md`      | What must run in CI to prevent regressions?                                  | `deno.json`, `Tools/tests/`, `Tests/`                                                                                                                    | (optional)                                         |
| `90_web_references.md`              | What external sources are worth keeping handy?                               | (curation)                                                                                                                                               | WebAssembly / Worker / Swift WASM / XHR / autoplay |
| `91_open_questions.md`              | What decisions are still unsettled?                                          | (ongoing)                                                                                                                                                | (as needed)                                        |
| `scpcb/README.md`                   | How is SCPCB implemented (code-first map) and what does it imply for a port? | `~/Software/scpcb/Main.bb`, `~/Software/scpcb/MapSystem.bb`, `~/Software/scpcb/NPCs.bb`, `~/Software/scpcb/Items.bb`, `~/Software/scpcb/UpdateEvents.bb` | (optional)                                         |

### `00_rebuild_roadmap.md`

Must include:

- 6–10 phases; each phase has:
  - deliverable artifact (what runs),
  - required code subsystems,
  - validation gates (tests/commands),
  - exit criteria.

### `02_compiler_rebuild_notes.md`

Must include:

- Minimal language subset for first demo.
- Implementation order (Lexer → Parser → AST → IR → CodeGen).
- “Gotchas” list derived from this repo (arrays, strings, stack balancing,
  includes, suffix typing).

### `03_runtime_rebuild_notes.md`

Must include:

- Runtime import taxonomy (graphics/audio/input/fileio/debug).
- Command buffer and entity table principles (when/why).
- Resource lifecycle / disposal rules.

### `04_loader_worker_and_no_freeze.md`

Must include:

- Worker protocol shape (requests, responses, timeouts).
- “Safe modes” and recommended debug flags.
- Anti-freeze patterns (watchdogs, manual stepping, opt-in `Main()`).

### `05_assets_and_vfs.md`

Must include:

- Manifest design (preload groups).
- Path aliasing rationale.
- Sync-IO assumptions in legacy BB and how we handle them.

### `06_testing_tooling_and_ci.md`

Must include:

- Test pyramid (unit/integration/browser/headless).
- Leak testing workflow and thresholds.
- `wasm-validate` and other static checks.

### `90_web_references.md`

Must include:

- A curated link list with 1–2 lines of “why this matters” per link.
