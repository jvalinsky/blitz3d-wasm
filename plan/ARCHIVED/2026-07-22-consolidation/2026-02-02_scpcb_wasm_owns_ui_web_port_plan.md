# SCPCB Web Port Plan (WASM-Owns-UI, Mod-Friendly)

Created: 2026-02-02\
Owner: Track B (WASM-first, thin JS runtime)

## Pros / Cons (WASM-Owns-UI)

### Pros

- **“Drop-in SCPCB + mods” compatibility**: existing SCPCB/menu/HUD logic stays
  in BB→WASM; mods that change UI logic keep working.
- **Single source of truth**: UI state remains in SCPCB globals/types; fewer
  JS↔WASM desync issues.
- **Lower refactor surface**: avoids rebuilding the menu/HUD in TypeScript/HTML
  and re-encoding all side effects (options, saves, new game flow).
- **Determinism & debugging**: UI behavior matches desktop SCPCB more closely;
  regressions are easier to attribute to runtime/API parity.

### Cons

- **Larger Blitz3D API surface**: requires correct 2D drawing/text/image/font
  behavior (and performance).
- **Blocking-loop pressure**: SCPCB’s original control flow assumes synchronous
  loops; web must enforce “no blocking loops” via explicit entrypoints.
- **Less web-native UX**: responsive layout/accessibility/DOM text features are
  harder (but optional overlays remain possible).

---

## Goal

From a local `~/Software/scpcb` checkout, produce a `dist/` that:

- boots without freezing the tab,
- shows SCPCB menu rendered by SCPCB code (not a JS reimplementation),
- can transition Menu → Gameplay → Menu repeatedly,
- supports mods “automagically” as long as they use the same Blitz3D APIs and
  asset layout conventions.

## Non-goals (initially)

- Web-native replacement UI (HTML settings screens, React, etc.).
- Perfect parity for every fringe Blitz3D behavior on day 1 (prioritize SCPCB’s
  actual call paths).
- Multiplayer/networking correctness beyond basic stubs.

---

## Architecture (ownership boundaries)

### WASM (SCPCB BB→WASM)

- Owns: menu/HUD drawing decisions, UI state, game state, transitions, save/load
  semantics, room/event logic.
- Exposes: **non-blocking** entrypoints for JS to call each frame (and per-mode
  enter/leave hooks).

### JS/TS runtime (thin “device driver”)

- Owns: WebGL/WebGPU draw submission, input events, audio decode/playback, async
  fetch, VFS preloading, watchdog/kill switch.
- Provides: Blitz3D-compatible imports and a **command-buffer drain** to batch
  updates.

---

## Current codebase reality (as of 2026-02-02)

This plan assumes we keep the existing Track B loader + worker harness and make
SCPCB conform via explicit entrypoints.

### Where the web “game page” lives

- Canonical game entry should be served at: `/game/scpcb_game.html` (Vite
  multi-page build).
- The runtime entrypoint script is `web/src/main.ts` (loaded by the game HTML
  page).
- Build wiring for multi-page inputs is in `web/build.ts`
  (`rollupOptions.input`).

### Loader expectations (JS-side)

- The loader is already set up for **safe-by-default** execution and manual
  stepping:
  - It prefers calling a non-blocking init export if present (`__WebInit%`,
    `__WebInit`, `WebInit`, `InitOnce`). See `web/src/main.ts` in
    `runInitIfPresent()`.
  - If `UpdateGame` exists, it expects to tick it from JS (RAF-driven). See
    `web/src/main.ts` in `startUpdateLoop()`.
  - It gates calling `Main()` behind URL flags (`?init=main` and `?run=main`)
    because Main can freeze the tab. See `web/src/main.ts`.
- There is also a worker harness for safe stepping and debugging:
  - `web/src/worker/scpcb_worker.ts` supports `init` (preload group +
    instantiate), `call`, and debug helpers.

### Current SCPCB wasm export gap (must fix)

- The shipped `web/public/scpcb.wasm` currently exports many SCPCB functions
  (e.g. `UpdateMainMenu`, `UpdateMusic`, `UpdateStreamSounds`) but **does not
  export `Main` or `UpdateGame`** (and does not export any
  `__WebInit*`/`__WebUpdate` entrypoints). This blocks “boot + tick” in the
  current loader architecture.
- The Track B ABI globals exist: `__CmdBufPtr`, `__CmdBufBytes`,
  `__CmdBufAbiVersion` are exported.

### Command buffer drain gap (must fix)

- The graphics runtime has a `DrainCommandBuffer` import wired to
  `drainCommandBuffer()`, but the implementation currently reads as a
  minimal/placeholder dispatcher. See `web/src/runtime/graphics/index.ts` in
  `drainCommandBuffer()`.
- The canonical opcode set is defined in `web/src/shared/command_buffer.ts` and
  dispatched via `web/src/runtime/command_executor.ts`.

---

## Critical contract: non-blocking web entrypoints

SCPCB must not run a tight loop in WASM that blocks the browser event loop.

### Required exports (names are suggestions; choose a stable convention)

1. `Web_InitOnce%()`
   - Initializes globals and performs any “startup” work that can run without
     blocking.
   - Must not include “press any key” or launcher loops.

2. `Web_EnterMenu%()` / `Web_LeaveMenu%()`
   - Allocates/releases menu entities/resources and sets global mode flags.

3. `Web_EnterGame%()` / `Web_LeaveGame%()`
   - Starts a new game or loads a save, allocates/releases gameplay resources.

4. `Web_Tick%(dt#)`
   - Single step update:
     - if in menu mode: runs one menu tick (calls existing SCPCB menu update
       functions).
     - if in gameplay mode: runs one gameplay tick (calls existing SCPCB update
       logic).

5. (Optional) `Web_RenderStep%()`
   - Only if rendering cannot be fully expressed as command-buffer writes during
     `Web_Tick`.

### How we should implement the exports (concrete)

**Prefer a wrapper entry file** so we don’t need to fork SCPCB heavily and so
mods remain drop-in:

- Add a small wrapper `.bb` (generated into `/tmp` by tooling, or stored
  in-repo) that:
  - `Include "Main.bb"` from the SCPCB root (and therefore pulls in all modded
    includes naturally),
  - defines `Web_*` entrypoint functions that call into SCPCB’s existing
    functions (menu tick, gameplay tick),
  - gates/disables known blocking loops by setting exported globals
    (`LauncherEnabled`, `WebPort`) and by avoiding direct calls to SCPCB
    `Main()` in the default path.
- Wire compilation to use that wrapper as the entry file:
  - Extend `Tools/compile_scpcb_main.ts` (currently compiles
    `../../scpcb/Main.bb`) to instead compile a wrapper path and pass
    `--scpcb-root` as needed.

This keeps the “drop `~/Software/scpcb` in” story intact: the wrapper doesn’t
replace SCPCB, it just provides a web-safe entry surface.

### Mode state (WASM)

- One authoritative global:
  - `WebMode% = WEBMODE_BOOT | WEBMODE_MENU | WEBMODE_GAME | WEBMODE_LOADING`
- All transitions happen through one module (avoid scattered
  `If MainMenuOpen Then ...` checks).

### JS call order (per frame)

1. `Web_Tick(dt)` (or `Web_Tick(0)` for fixed-step while debugging)
2. Drain command buffer once (`DrainCommandBuffer` import or TS-side drain on
   shared memory)
3. Render once

---

## UI rendering: “Blitz2D-over-canvas”

### Principle

Keep SCPCB menu/HUD code intact; implement the Blitz3D 2D API in the runtime and
render to a 2D canvas (or a composite pass).

### Minimum UI API subset (SCPCB-driven)

Implement/verify the subset SCPCB actually uses (prioritize call-path evidence):

- Text:
  - font load/select, `Text`, text width/height, alignment.
- Images:
  - `LoadImage`, `MaskImage`, `DrawImage/Rect`, `ScaleImage`, `HandleImage`,
    alpha.
- Primitives:
  - `Rect`, `Line`, `Plot`, `Color`, `ClsColor`, `Cls`, `Flip` semantics
    (non-blocking).
- Input:
  - key down/hit, mouse pos, mouse down/hit, wheel.
- Timing:
  - `MilliSecs` and clamping policy to avoid huge dt jumps after tab
    backgrounding.

### Integration approach

- Keep the existing 3D canvas for WebGL/WebGPU, and layer a 2D canvas over it
  for UI.
- Ensure the 2D layer respects “UI focus” rules (menu captures input; gameplay
  can release pointer lock etc.).

### Concrete runtime entry points and files

- 2D rendering hooks live under `web/src/runtime/graphics/setup/2d.ts` (e.g.
  `js_Text`, `js_Rect`, `js_Line`, `AAText`, etc.).
- Input hooks live under `web/src/runtime/graphics/setup/input.ts` and are
  surfaced to WASM imports.
- File IO + manifest preload lives in `web/src/runtime/fileio.ts` and is used by
  `web/src/main.ts` (preload group logic).
- Path aliasing and `.b3d/.x/.rmesh → .smpk` rewrite is centralized in
  `web/src/shared/path_alias.ts` and should be used everywhere assets are
  opened.

---

## Asset strategy and “sync IO expectation”

SCPCB expects synchronous file IO for many init/menu/gameplay paths.

### Manifest groups (mode-aligned)

Define groups in `scpcb_manifest.json` to match mode transitions:

- `boot`: `scpcb.wasm`, `options.ini`, and any required bootstrap files
- `menu`: menu textures/fonts/sounds/videos used before starting a game
- `gameplay_core`: common assets used in most rooms
- `facility_assets` (or per-room packs): room meshes, props, NPCs, SFX, etc.

### Transition rule (hard requirement)

JS must preload the target mode’s required group(s) **before** calling
`Web_EnterMenu/Web_EnterGame`.

- If assets are missing, show a web overlay (“Loading…”) but do not enter WASM
  code that will spin.

### Source-model prohibition

- Continue enforcing “no `.b3d/.x/.rmesh` shipped” (Track B).
- Keep path rewriting and case-insensitive lookup centralized so mods still
  resolve paths:
  - `GFX\\foo\\bar.b3d` → `assets/GFX/foo/bar.smpk` etc.

---

## Menu → Gameplay → Menu (transition mechanics)

### Menu mode

- SCPCB draws menu/HUD via Blitz2D APIs.
- Menu tick calls:
  - `UpdateMainMenu` (and associated helpers).
- Menu “start game” action triggers:
  - `Web_RequestEnterGame(kind, params...)` or sets a global transition request
    struct.

### Loading mode (optional but recommended)

- A small “loading” state that:
  - requests JS preload of a specific group (e.g. room pack)
  - shows SCPCB loading screen (still rendered by SCPCB UI) without blocking
  - once JS signals ready, calls `Web_EnterGame` and switches mode

### Gameplay mode

- Runs normal SCPCB update step (`UpdateGame` or equivalent) as a **single
  tick** function.
- Gameplay HUD continues to render through the same Blitz2D path.
- Escape/back triggers `Web_RequestEnterMenu` and transitions through
  `Web_LeaveGame` → `Web_EnterMenu`.

---

## Runtime priorities (parity work that blocks gameplay)

### Must be correct early

- **Command buffer drain**: one drain per frame must fully apply entity/resource
  changes (otherwise nothing renders/moves).
- **Collisions**: implement `ClearCollisions` + collision query APIs used by
  SCPCB’s movement/AI.
- **Picking**: implement `PickedSurface/PickedTriangle` if SCPCB logic relies on
  them (don’t leave as stubs).
- **Audio**: minimum working 2D + 3D sound categories, stop/pause/resume; avoid
  runaway nodes.
- **Video**: startup/menu videos must not block; allow skipping.
- **No blocking loops**: entrypoints + watchdog controls.

### Decide “policy vs implementation” for legacy DLL-like systems

- `ZlibWapi_*` / ZipApi:
  - Either implement correctly using JSZip (preferred for “drop-in”), or ensure
    SCPCB web build never calls these paths.
- OpenAL (`al.*`):
  - Either map to WebAudio or ensure SCPCB never exercises OpenAL-only paths in
    web mode.

---

## Implementation milestones (with acceptance criteria)

### Milestone 0 — Contract validation (fast)

- Add a small “entry shim” BB file (or compiler option) that guarantees exports:
  - `Web_InitOnce`, `Web_Tick`, `Web_EnterMenu`, `Web_EnterGame`,
    `Web_LeaveMenu`, `Web_LeaveGame`
- Acceptance:
  - `WebAssembly.Module.exports(scpcb.wasm)` contains those names.

Concrete check:

- Add/extend a CI gate (Deno test) that loads the built wasm (`dist/scpcb.wasm`)
  and asserts the required exports exist.

### Milestone 1 — Boot to menu without freezing

- JS preloads `boot` + `menu`
- JS calls `Web_InitOnce` then `Web_EnterMenu`
- RAF calls `Web_Tick(dt)` for 300 frames
- Acceptance:
  - No hangs; menu is visible; input works; no runaway allocations detected by
    existing memleak tooling.

### Milestone 2 — Menu to new game (first room)

- From menu action, transition to loading/gameplay (with JS preloading required
  packs)
- Acceptance:
  - Player spawns, camera updates, basic movement works, collision doesn’t
    explode, audio plays.

### Milestone 3 — Round-trip stability

- Gameplay → Menu → Gameplay (repeat 3x)
- Acceptance:
  - No duplicated RAF loops/listeners, stable handle counts, textures/materials
    disposed appropriately.

### Milestone 4 — Mod smoke compatibility

- Pick 2–3 real mods (different assets + scripts) and boot them via the same
  `~/Software/scpcb` drop-in layout.
- Acceptance:
  - No code changes required per mod beyond “assets must be convertible” and
    manifest generation.

---

## Workstreams (detailed checklist)

### A) SCPCB entrypoints (BB-side)

- Introduce `WebMode%` and central transition functions.
- Replace/guard:
  - launcher loop
  - “press any key” tight loops
  - any “wait until file exists” loops (must become state machine checks)
- Provide a single `Web_Tick(dt)` dispatcher.

### B) Loader orchestration (JS-side)

- Map URL flags to safe behavior:
  - safe (no entrypoints)
  - step mode
  - auto-run mode
- Implement per-mode preload gates (boot/menu/gameplay packs).
- Ensure `dt` is clamped and stable.

Concrete code seams:

- The loader already has init-time preloading for `?init=main` in
  `web/src/main.ts` (`preloadAssetGroup("init" | "facility_assets")`).
- Extend this to explicit per-mode groups and explicit entrypoint calls (no
  reliance on `Main()` in the default path).

### C) UI API parity (runtime)

- Audit SCPCB menu/HUD call paths and make a “must-implement” function list.
- Implement missing 2D primitives and text/image edge cases as encountered.

### D) Asset pipeline (drop-in)

- Given `~/Software/scpcb`, generate `dist/assets/**` + stable
  `scpcb_manifest.json`.
- Enforce:
  - no source models shipped
  - case-insensitive path resolution
  - `.avi → .mp4` mapping policy for videos

Concrete tools involved:

- Packaging and conversion: `web/build.ts`
- Full SCPCB compile with Track B ABI: `Tools/compile_scpcb_main.ts` (extend to
  wrapper entry)
- SCPCB audit gate (prevents new source-model literals):
  `Tools/scpcb_audit_gate.ts` + `docs/scpcb/scpcb_audit_baseline.json`

### E) Stability tooling

- Add an automated “boot/menu/gameplay/roundtrip” gate test suite (worker +
  timeouts).
- Extend memleak checks to cover mode transitions.

---

## Open decisions (pick early)

- Entry export naming and ABI versioning (freeze it once tools/tests depend on
  it).
- ZipApi strategy: implement via JSZip vs gate off.
- OpenAL strategy: map to WebAudio vs gate off.
- Room pack granularity: `facility_assets` vs per-room group generation (trade
  preload time vs runtime latency).

---

## “Serve scpcb_game.html from game/ subfolder”

Implementation detail:

- Add `web/game/scpcb_game.html` as the canonical page that loads
  `web/src/main.ts`.
- Configure Vite multi-page output so the built artifact contains:
  - `dist/game/scpcb_game.html`
- Keep `dist/index.html` as either a redirect or a lightweight launcher page
  (optional), but do not require it for gameplay boot.

---

## Notes / References

- Track B plans: `plan/scpcb-web-track-b/README.md`
- Web loader: `web/src/main.ts`
- Worker harness: `web/src/worker/scpcb_worker.ts`
- Path aliasing: `web/src/shared/path_alias.ts`
- Build/manifest generator: `web/build.ts`
- SCPCB audit baseline: `docs/scpcb/scpcb_audit_baseline.json`
