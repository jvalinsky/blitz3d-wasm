# Rebuild Roadmap (Thin Vertical Slices)

This roadmap is a practical sequence for rebuilding the project from zero while
staying shippable at every step.

Each phase ends in a **runnable artifact** and a set of **validation gates**.

## Phase 0 — Baseline Repo Skeleton

**Deliverable**
- A repo that builds:
  - `swift build` produces a compiler binary
  - `deno task web:dev` (or equivalent) runs a minimal web page

**Exit criteria**
- CI (even minimal) runs “build + unit tests” without network flakiness.

## Phase 1 — Minimal BB → WASM “Hello”

**Deliverable**
- Compile a trivial `.bb` to a `.wasm` that can:
  - call an imported `DebugLog`/`Print`,
  - return cleanly (no infinite loops).

**Required subsystems**
- Lexer, parser, AST, basic codegen for:
  - globals/locals, integer math, function call, return.

**Validation gates**
- `wasm-validate` passes on output.
- A Deno/browser harness instantiates and invokes a known export.

## Phase 2 — Strings, Arrays, and “Real” Control Flow

**Deliverable**
- A test fixture suite that covers:
  - string allocation + printing,
  - array access `arr(i)` load/store,
  - `If/Else`, `While/Wend`, `For/Next`.

**Why this phase exists**
- These are the first major “semantic traps” in Blitz3D syntax and codegen.

## Phase 3 — Types (New/Delete/For Each) and Deterministic Memory Layout

**Deliverable**
- A demo that creates many Type instances, mutates fields, iterates `For Each`,
  and deletes without corrupting the list.

**Validation gates**
- Leak-churn style: repeated create/update/delete cycles do not grow memory
  unboundedly (within expected linear memory growth rules).

## Phase 4 — Runtime MVP (Tiny Import Surface)

**Deliverable**
- A tiny TS/JS runtime implementing only the imports needed for one demo:
  - graphics: `CreateSprite`, `PositionEntity`, `EntityAlpha`, `FreeEntity`
  - timing/input: minimal `Millisecs`, `KeyDown` (optional)

**Exit criteria**
- A particle or sprite demo runs at interactive framerate without heavy boundary overhead.

## Phase 5 — No-Freeze Execution Model (Worker + Watchdog)

**Deliverable**
- WASM runs in a Worker.
- The UI thread:
  - never calls a “run forever” entrypoint by default,
  - can step a single “tick” function manually,
  - has watchdog timeouts for any call.

**Rationale**
- Legacy BB code often uses tight loops that will freeze the browser if called directly.

## Phase 6 — Performance Infrastructure (Command Buffer + Entity Table)

**Deliverable**
- A shared-memory/binary protocol for batching high-frequency operations.
- A “WASM-authoritative” entity transform table for cheap getters.

**Exit criteria**
- Profiling shows reduced JS↔WASM call overhead on common hot paths.

## Phase 7 — VFS + Manifest Preloads (Sync-IO Compatibility)

**Deliverable**
- A virtual filesystem backed by:
  - manifest lists (preload groups like `boot` / `init` / `facility_assets`),
  - fetch + caching,
  - path aliasing and case-insensitive lookups.

**Exit criteria**
- A “known init path” never blocks on missing files because required assets are preloaded.

## Phase 8 — Asset Pipeline (Offline Conversion) + Format Loaders

**Deliverable**
- A repeatable offline conversion pipeline:
  - source assets → web-optimized package (SMPK or equivalent)
- Runtime loads at least one real model/map end-to-end.

## Phase 9 — SCPCB-Grade Integration

**Deliverable**
- Compile and run a curated SCPCB subset with:
  - deterministic init steps,
  - controlled update ticks,
  - clear “unsupported feature” stubs (tracked as issues).

**Exit criteria**
- The port is testable without relying on manual browser debugging.

