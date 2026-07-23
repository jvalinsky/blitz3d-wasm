# Subplan 03 — Browser Shim & Boot (freeze-proof loading)

**Phase**: A (blocking A-M1)
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Code**: `web/src/main.ts` (loader), `web/src/worker/scpcb_worker.ts` (worker harness), `web/interpreter.{html,js}` (existing kill-switch pattern), `web/src/runtime/command_executor.ts`, `web/src/shared/command_buffer.ts`
**Absorbs**: `ACTIVE/02_WEB_FREEZE_MITIGATION.md`, Track B `00_best_practices_web_wasm.md` + `02_runtime_abi_and_command_buffer.md` + `03_boot_loop_and_main_refactor.md` (open items)

## Objective

The game page boots SCPCB without ever freezing the tab, with progressive loading feedback, a watchdog kill switch, and debug controls. This is also the layer that stays permanent as the "minimal JS bootstrap shim" in the Swift end-state — so keep it small and state-free.

## Non-negotiable rules

1. **Never run unknown wasm entrypoints on the UI thread by default.** Worker + watchdog is the baseline (already proven in `web/interpreter.js`).
2. **No blocking loops in wasm.** JS drives the loop: `Web_Tick(dt)` per RAF frame; drain command buffer once; render once.
3. **Preload before enter.** JS must finish preloading a mode's asset group before calling `Web_Enter*` (see subplan 04).
4. **dt is clamped** (e.g. max 100 ms) so backgrounded tabs don't cause simulation jumps.

## Workstreams

### 3.1 Boot state machine (A-M1 prerequisite)

- [ ] States: `LOADING_WASM → LOADING_MANIFEST → PRELOADING_BOOT → READY → RUNNING | ERROR`, with stall detection (10 s per state) and progress UI per state
- [ ] Prefer `WebAssembly.instantiateStreaming` (ensure `Content-Type: application/wasm` on the server)
- [ ] Recovery without page reload: retry / safe mode / debug mode choices on error
- [ ] Test with intentionally-broken wasm and slow-network throttling

### 3.2 Frame loop & entrypoint driving

- [ ] `runInitIfPresent()` / `startUpdateLoop()` in `web/src/main.ts` extended to the full `Web_*` contract (subplan 05 defines exports); `Main()` remains gated behind `?init=main&run=main` for debugging only
- [ ] One command-buffer drain per frame; **complete** the placeholder `drainCommandBuffer()` dispatcher so every opcode in `web/src/shared/command_buffer.ts` is applied (this is a recorded Phase A blocker)
- [ ] Command-buffer overflow policy: grow bounded, assert in debug, never silently drop critical commands
- [ ] Handle model: explicit destroy calls; leak guardrails ("no runaway allocations" check per 300-frame gate)

### 3.3 Watchdog & debug controls

- [ ] Extend worker+watchdog pattern from interpreter demos to the game page (step mode, stop button, timeout)
- [ ] URL flags (documented in one place): `?safe` (no auto-entrypoints), `?step`, `?auto`, `?timeout=ms`, `?debug` (overlay), `?fps=n`, `?engine=swift|ts|split` (Phase B)
- [ ] Debug overlay: boot state, frame time, handle counts, command-buffer occupancy, memory growth

### 3.4 Input, focus, audio unlock

- [ ] Pointer lock only during gameplay mode; menus/overlays release it
- [ ] Keyboard/mouse hit-vs-down semantics match Blitz3D (`KeyHit` consumes)
- [ ] AudioContext resume on first user gesture (autoplay policy); all audio nodes have explicit lifecycle/dispose

### 3.5 Later hardening (post A-M3, pre Phase C)

- [ ] Evaluate OffscreenCanvas + worker rendering for main-thread jank (measure first)
- [ ] Minimize per-frame JS allocations (reuse typed arrays; IDs/offsets across the boundary, not objects)
- [ ] Memory-growth awareness: re-acquire typed-array views after `WebAssembly.Memory` growth

## Acceptance criteria

- Default page load never blocks; devtools always reachable; Stop always works
- A-M1 gate: 300 frames of menu ticking with zero long tasks > 200 ms after boot completes
- All boot failures land in a recoverable UI state, not a dead tab
