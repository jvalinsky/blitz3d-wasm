# Subplan 05 — SCPCB Integration (WASM-owns-UI, mod-friendly)

**Phase**: A (this is Phase A's spine — milestones A-M0…A-M4 live here)
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Adopted from**: `2026-02-02_scpcb_wasm_owns_ui_web_port_plan.md` (architecture and milestones carried over wholesale; see archive for the full pros/cons analysis)
**Code**: `Tools/compile_scpcb_main.ts` (SCPCB build), `web/src/main.ts`, `web/src/runtime/graphics/setup/2d.ts` (Blitz2D), `web/game/scpcb_game.html` (canonical page)

## Architecture decision (settled)

**WASM owns the UI.** SCPCB's own menu/HUD code renders via the Blitz2D API; JS never reimplements game UI. This preserves drop-in mod compatibility and keeps UI state in SCPCB globals — the runtime's job is API parity, not UI logic.

## The entrypoint contract (freeze at A-M0 — decision D2)

```
Web_InitOnce%()                 startup work, no blocking loops, no "press any key"
Web_EnterMenu%() / Web_LeaveMenu%()
Web_EnterGame%() / Web_LeaveGame%()
Web_Tick%(dt#)                  one tick, dispatched on WebMode%
Web_RenderStep%()               optional, only if render can't ride the command buffer
```

- One authoritative mode global: `WebMode% = BOOT | MENU | LOADING | GAME`; all transitions through one module.
- JS per-frame order: `Web_Tick(dt)` → drain command buffer once → render once.
- Transitions requested from BB side via `Web_RequestEnterGame/Menu` globals; JS observes, preloads the target asset group, then calls `Web_Enter*`.

## Implementation approach: wrapper entry file (no SCPCB fork)

A small wrapper `.bb` that `Include`s SCPCB's `Main.bb` (pulling in mod includes naturally), defines the `Web_*` functions calling existing SCPCB update functions (`UpdateMainMenu`, `UpdateGame`, …), and gates known blocking loops (launcher, "press any key", wait-for-file spins) behind web-mode globals. `Tools/compile_scpcb_main.ts` compiles the wrapper instead of `Main.bb` directly, with `--scpcb-root` pointing at the checkout.

## Milestones & workstreams

### A-M0 — Contract validation ⚠ current blocker

The shipped `scpcb.wasm` exports many SCPCB functions but **neither `Main`, `UpdateGame`, nor any `Web_*` entrypoints**. Nothing can boot until this lands.

- [x] Write wrapper entry `.bb` (in-repo, versioned) with all six `Web_*` exports (2026-07-22: `Tools/scpcb_wrapper.bb`)
- [x] Extend `Tools/compile_scpcb_main.ts` to compile the wrapper (2026-07-22: added `--wrapper` flag, Web_* export validation, removed stub aliases)
- [x] CI gate (Deno test): `WebAssembly.Module.exports(dist/scpcb.wasm)` contains all required names + `__CmdBuf*` ABI globals (2026-07-22: `Tools/tests/scpcb_web_exports.test.ts` — passes on wrapper .bb source; WASM validation pending compiler crash fix)
- [x] Freeze export names + ABI version (log as deciduous decision, closes D2) (2026-07-22: decision node 8 in deciduous; `Tools/web_export_contract.ts` is the single source of truth)

### A-M1 — Boot to menu without freezing

- [ ] Replace launcher/"press any key"/wait-loops with single-step state checks in the wrapper (guarded, not deleted — desktop path untouched)
- [ ] Blitz2D parity audit: enumerate the menu/HUD call paths (font load/select, `Text` + width/height, `LoadImage`/`MaskImage`/`DrawImage`/`ScaleImage`/`HandleImage`, `Rect`/`Line`/`Plot`/`Color`/`Cls`/`ClsColor`, non-blocking `Flip`) and close gaps in `setup/2d.ts`
- [ ] 2D canvas layered over the 3D canvas; menu captures input, gameplay pointer-locks
- [ ] Acceptance: preload boot+menu → `Web_InitOnce` → `Web_EnterMenu` → 300 frames of `Web_Tick(dt)`; menu visible and interactive; no hangs; memleak tooling clean

### A-M2 — Menu → new game (first room)

Runtime parity items that block gameplay (implement, don't stub):

- [ ] Collisions: `ClearCollisions` + the collision/movement queries SCPCB's player/AI use — *coordinate with subplan 02: prefer implementing in the Swift engine and bridging, so the work lands in the end-state* (decide when reached; log outcome)
- [ ] Picking: `PickedSurface`/`PickedTriangle` and friends where SCPCB logic reads them
- [ ] Audio: working 2D + 3D categories, stop/pause/resume, no runaway nodes
- [ ] Loading mode: SCPCB loading screen renders (SCPCB-drawn) while JS preloads the room pack; `Web_EnterGame` only after ready
- [ ] Acceptance: player spawns, camera updates, movement + collision behave, audio plays

### A-M3 — Round-trip stability

- [ ] `Web_LeaveGame` → `Web_EnterMenu` → `Web_EnterGame` ×3
- [ ] Acceptance: no duplicated RAF loops/listeners; handle counts return to baseline; textures/materials/sounds disposed

### A-M4 — Mod smoke compatibility

- [ ] 2–3 real mods (different assets + scripts) via the same drop-in layout
- [ ] Acceptance: zero per-mod code changes beyond asset conversion + manifest generation

### Legacy DLL-surface decisions (resolve during A-M2)

- [ ] D3 ZipApi (`ZlibWapi_*`): implement via JSZip (recommended — preserves mod drop-in) or gate off; log decision
- [ ] D4 OpenAL (`al.*`): map the SCPCB-used subset to WebAudio or prove the web build never reaches those paths; log decision

## Non-goals (Phase A)

- Web-native replacement UI (HTML/React menus)
- Fringe Blitz3D behaviors outside SCPCB's actual call paths
- Multiplayer/networking beyond stubs
