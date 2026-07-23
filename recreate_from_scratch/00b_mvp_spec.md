# MVP Rebuild Spec (Short)

This is the minimum shippable “from scratch” rebuild that proves the
architecture.

## MVP Goal

Run a tiny Blitz3D BASIC program compiled to WASM in the browser such that:

- WASM executes game logic (a simple update loop exposed as a **single-tick**
  export).
- TS/JS provides only browser bindings (minimal graphics + logging).
- The page cannot freeze by default (Worker + watchdog).

## MVP Non-Goals

- SCPCB compatibility (assets, full import surface, mods).
- Full asset pipeline (SMPK conversion) beyond “load one texture”.
- Peak performance tuning (command buffer can be deferred until later).

## Deliverable Artifact

- A web page that shows a sprite/quad moving over time (or particle demo),
  driven by one exported tick function called repeatedly.

## Required Compiler Feature Set

- Locals/globals, arithmetic, `If`, `While`, `For`, function defs/calls.
- Strings sufficient for debug logging.
- Imports (call into `env.*` functions).
- (Optional for MVP) Arrays and Types — include only if the demo needs them.

## Required Runtime Feature Set

- Minimal imports:
  - `DebugLog`/`PrintString` equivalent
  - `CreateSprite` (or `CreateMesh`) + `PositionEntity` + `EntityAlpha`
    (minimal)
  - `Flip`/render function (or “render every RAF” on JS side)
- Deterministic dispose path (no leaking RAF/listeners/resources).

## Required Loader/Execution Model

- WASM instantiated in a Worker.
- Main thread calls exports via a request/response protocol.
- Every call uses a timeout watchdog and terminates the worker on hang.
- Default mode is paused; user must opt in to continuous ticking.

## MVP “Done When” Checklist

- ✅ `wasm-validate` passes on the MVP module.
- ✅ Running the demo for 2 minutes does not grow JS heap unboundedly in
  headless leakcheck.
- ✅ A deliberate infinite loop export is terminated by the watchdog (no-freeze
  gate).

## Code-First Starting Points (In This Repo)

- Compiler anchors: `docs/recreate_from_scratch/02_compiler_code_anchors.md`
- Runtime anchors: `docs/recreate_from_scratch/03_runtime_code_anchors.md`
- Loader/worker anchors:
  `docs/recreate_from_scratch/04_loader_worker_code_anchors.md`
- Acceptance tests and commands:
  `docs/recreate_from_scratch/06_testing_tooling_and_ci.md`
