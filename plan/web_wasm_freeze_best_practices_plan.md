# Web WASM Freeze Mitigation Plan (SCPCB / Blitz3D-WASM)

Date: 2026-01-29

## Goal

Make the SCPCB web loader **never hard-freeze the browser tab** while still allowing:

- deterministic initialization,
- manual stepping (`tick=manual`) and controlled auto-run, and
- clear diagnostics when the WASM code enters a blocking loop.

## Non-goals

- “Fully play SCPCB in browser” in one step.
- Perfect feature parity with native Blitz3D runtime.
- Solving in-game performance (this plan focuses on *init and freeze safety*).

## Current Symptoms (Observed)

- Firefox/Chrome show “page is slowing down / stop this page” during `Main()` and/or early init.
- Even when assets are present, init can hang due to tight loops that assume:
  - synchronous file I/O,
  - `Delay/VWait/Flip` yielding,
  - launcher/menu loops,
  - “press any key” loops.

## Root Cause Hypotheses (Ordered)

1. **Non-resumable init**: SCPCB’s `Main()` contains blocking loops; calling it on the main thread will inevitably freeze.
2. **Yield assumptions**: SCPCB uses `Delay/VWait/Flip` as a yield/sleep mechanism; on the web these are effectively no-ops → tight spin.
3. **Sync I/O assumptions**: missing files returning `0` can trigger tight loops waiting for data; async fetch can’t satisfy loops without a yielding design.
4. **Large init workload**: init does heavy parsing/allocations and expects a native thread, not a UI thread.

## Best Practices Principles

1. **Never call non-resumable WASM entrypoints on the UI thread** unless explicitly “danger” mode.
2. **Prefer resumable init**: initialization should be broken into steps that return to JS frequently.
3. **Make file I/O semantics explicit**:
   - “Sync” reads must only happen after explicit preload guarantees.
   - “Async” reads must not return `0` if the caller will spin; instead design the caller to yield/retry.
4. **Always have a kill switch**: a runaway loop must be stoppable without reloading the tab.
5. **Measure + gate**: add timing budgets and fail-safes around exported calls.

## Plan (Phased)

### Phase 0 — Baseline Safety & Observability (1–2 days)

**Deliverables**
- A “safe mode” that only loads/instantiates WASM and never calls game entrypoints.
- A lightweight in-canvas debug HUD (already started) and a structured diagnostic state object:
  - `initStage`, `initDone`, `lastFileReq`, `currentInitFile`, `fetch bytes`, key globals (e.g. `WebPort`, `LauncherEnabled`, `MenuOpen`).
- Per-call timers for `Main()`, `UpdateGame()`, `UpdateMainMenu()`, etc. with:
  - start timestamp, end timestamp,
  - “killed by watchdog” reason,
  - last-known diagnostic snapshot.

**Expectations / Predictions**
- When init hangs, we can say *exactly* whether it’s:
  - still in JS preload,
  - in WASM `Main()` (non-returning),
  - in `UpdateGame()` (non-returning).

**Tests**
- Manual: open with `?debughud=1&safe` and verify no entrypoints called.
- Manual: click “Init (safe)” and confirm it never calls `Main()`.
- Regression: ensure existing demo/loader still loads without errors.

### Phase 1 — Resumable Init Entry Point in WASM (Preferred) (2–7 days)

**Approach**
- Modify the SCPCB BB build to export a dedicated init routine, e.g.:
  - `__WebInit%` (or similar), which:
    - disables launcher loops,
    - performs only the minimal initialization needed for safe stepping,
    - returns control to JS frequently (see step API below),
    - sets a global “init complete” flag when done.

**Step API design**
- Export one function:
  - `__WebInitStep%() : Int` returning:
    - `0` = still initializing,
    - `1` = init complete,
    - `<0` = error code / reason.
- Optional: `__WebInitStatus$()` returning a short status string for HUD.

**Best practices inside WASM init**
- Replace any `While ... Wend` “wait” loops with a state machine:
  - each call processes a small chunk and returns.
- Make “press any key” loops conditional or auto-satisfied for web build.
- Avoid calling `Main()`’s infinite loops in init.

**Expectations / Predictions**
- `__WebInitStep%` returns within **< 5ms** in typical cases (goal), never >50ms.
- JS can `requestAnimationFrame` tick init steps until complete.
- `UpdateGame()` becomes callable after init complete with no hard freeze.

**Tests**
- Unit-ish (headless): add a Deno script that repeatedly calls `__WebInitStep%` for N steps and asserts it finishes.
- Browser integration: `?tick=manual` “Step Init” button calls `__WebInitStep%`.
- Performance: record distribution of step duration; fail if p95 > 20ms.

### Phase 2 — Worker Isolation (Fallback / Defense-in-Depth) (3–10 days)

Even with resumable init, regressions happen. A Worker-based runtime prevents tab death.

**Approach**
- Add a `?worker=1` mode:
  - Instantiate WASM in a Web Worker.
  - Proxy a minimal set of imports needed for init (or stub more aggressively).
  - Forward logs (`DebugLog`) and diagnostic snapshots to the main thread.
  - The main thread UI stays responsive; add a “Terminate worker” button.

**Constraints**
- WebGL must remain on the main thread; in worker mode, disable rendering (`nogl`) or use OffscreenCanvas if feasible.
- Audio often requires main thread user gesture; worker init should run with audio stubs by default.

**Expectations / Predictions**
- A hung init no longer freezes the tab; user can stop it and inspect last logs/state.
- Enables automated “hang detector” tests in CI-like environments.

**Tests**
- Browser integration: worker init + terminate works repeatedly.
- Memory: repeated create/terminate cycles do not leak listeners/handles.

### Phase 3 — Formalize Yield Semantics (`Delay/Flip/VWait`) (2–5 days)

**Goal**
Stop the most common “native assumption” loops from becoming CPU spins.

**Options**
1. Keep imports as no-ops but ban their use for yielding (requires code changes in WASM/BB).
2. Add a cooperative “yield requested” flag:
   - `Delay(ms)` sets `__yieldRequested = true` and returns.
   - JS checks this flag between steps and yields appropriately.
3. If in worker mode, use Atomics.wait (SharedArrayBuffer) to actually block *in worker* (not main thread), if COOP/COEP is configured.

**Expectations / Predictions**
- Fewer tight loops, especially around menu screens and “loading” screens.

**Tests**
- Add a small fixture BB program with `Delay` in a loop and verify it does not freeze, either via step API or worker mode.

### Phase 4 — Asset/IO Contract Hardening (ongoing)

**Approach**
- Define a “boot/init” manifest group that is always available before any init step runs.
- Make file access predictable:
  - If a file is not in the init preload set, any attempt to read it during init should:
    - return a non-success sentinel that the init step recognizes and yields on,
    - OR be forbidden (fail fast with diagnostics), not spin.

**Expectations / Predictions**
- Eliminate “missing file returns 0 → tight loop” class of hangs.

**Tests**
- Add a test harness that intentionally removes a required init asset and asserts we get a clean failure message, not a hang.

## Acceptance Criteria

- Opening `/?tick=manual` never hard-freezes the tab.
- All exported “step” actions have a per-call timeout guard and produce a diagnostic snapshot when exceeded.
- `__WebInitStep%` exists (or worker mode exists) so init can proceed without calling `Main()` on the UI thread.
- A hung init can be terminated without reloading the page (worker mode or equivalent).

## Concrete Predictions (What should change)

- Firefox “slowing down” warning frequency goes to ~0 in normal debug workflows.
- `Init (safe)` + “Step Init” can progress deterministically.
- `UpdateGame()` step either:
  - completes within a bounded time, or
  - is stopped by a watchdog with a readable reason and last-known state.

## Suggested Immediate Next Work Items

1. Add `__WebInitStep%` to the SCPCB web build and wire a “Step Init” button.
2. Add a watchdog timer around `UpdateGame()` calls (manual step and RAF tick).
3. Implement `?worker=1` runtime mode as a safety net.

