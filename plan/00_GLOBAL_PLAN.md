# Global Plan — Blitz3D Compiler & Engine in Swift → SCP:CB in the Browser

**Created**: 2026-07-22
**Status**: Canonical. This document supersedes all previous plan files (see [Plan Inventory](#plan-inventory) for the mapping). Subplans live in `plan/subplans/`.

---

## 1. Vision

Build a **professional, self-contained Swift** toolchain that:

1. **Compiles Blitz3D BASIC** (`.bb`) directly to WebAssembly — a full compiler written in Swift (lexer → parser → AST → IR → WASM codegen), no external compiler frameworks.
2. **Provides the Blitz3D engine/runtime in Swift** — scene graph, renderer, physics/collision, audio, 2D (Blitz2D), file I/O — compiled to WebAssembly via the SwiftWasm SDK.
3. **Runs SCP: Containment Breach in a web browser** — the original, unmodified game sources (plus mods) compiled and booted from a static `dist/`, with only a **minimal JavaScript bootstrap shim** for what the browser platform strictly requires (canvas/GL context creation, input events, audio unlock, `fetch`, `requestAnimationFrame`).

### What "self-contained Swift" means here

- All *intelligence* (compiler, engine logic, game state) is Swift or compiled-from-BB WASM.
- SwiftPM only; no Xcode project. Dependency budget: **JavaScriptKit only** (pinned `0.19.2`), and only for the wasm32 target.
- JavaScript/TypeScript is allowed only as a **device driver layer** (thin shim): it may forward events and submit draw calls, but must not own game or engine state. The current ~12K-line TS runtime is treated as *scaffolding* to be shrunk, not grown (see §4 Phase B).
- Professional bar: reproducible builds, tests at every layer, CI gates, accurate status docs, and decision logging via deciduous.

---

## 2. Current State (honest snapshot, 2026-07-22)

| Component | Location | Size | Status |
|---|---|---|---|
| **Compiler** (Swift) | `Sources/Compiler` | ~18.5K lines | 100% pass on 57-file suite; compiles SCPCB `Main.bb`; production-ready for current scope (`docs/COMPILER_STATUS_ANALYSIS.md` is canonical) |
| **Swift Engine** | `Sources/Blitz3DEngine` | ~9.2K lines | Builds to wasm via SwiftWasm 6.2.3 SDK (`build-engine-wasm.sh`, `Package.wasm.swift`); partial API coverage; graded A+ WASM-ready (`docs/SWIFTWASM_PORTING_ANALYSIS.md`) |
| **TS Web Runtime** | `web/`, `Sources/Runtime` | ~12K lines | Most mature runtime: command buffers, Three.js rendering, VFS, worker harness; powers all current demos |
| **Compiler-in-browser** | `compiler-wasm/` | — | Compiler itself compiled to wasm for web IDE use |
| **Asset pipeline** | `web/build.ts`, `Tools/` | — | B3D/X/RMESH → SMPK, manifest generation, no-source-model CI gate |
| **Native host (optional)** | `plan/subplans/08` | — | Proposed WasmKit + Metal macOS runner; not started |

### The two-runtime tension, resolved

The repo has been carrying two runtime tracks: the TypeScript runtime (Track B, most progress) and the Swift engine (aligned with project identity, less complete). **This plan resolves the tension by sequencing, not by choosing one and deleting the other:**

- **Phase A** ships a playable SCPCB in the browser on the *current* TS runtime — because a working game de-risks everything that is engine-language-independent (entrypoint contract, asset pipeline, ABI, freeze prevention), and every one of those artifacts carries forward.
- **Phase B** migrates runtime intelligence into the Swift engine *behind the same ABI*, subsystem by subsystem, using the TS runtime as a differential-testing oracle, until JS is reduced to the bootstrap shim.

### Known blockers (as of last recorded state)

1. ~~The shipped `web/public/scpcb.wasm` exports neither `Main`, `UpdateGame`, nor any `Web_*` entrypoints~~ — resolved 2026-07-23: A-M0 done, `scpcb.wasm` builds and exports all six `Web_*` entrypoints (see subplan 05).
2. `drainCommandBuffer()` in `web/src/runtime/graphics/index.ts` is a placeholder dispatcher — nothing fully renders from the command stream.
3. Collision/picking APIs used by SCPCB movement/AI are stubbed.
4. Freeze prevention exists only for interpreter demos, not the game page.
5. `deno task test:web:build` currently fails on `main` independent of any SCPCB work: `web/src/main.ts` imports `./runtime/debug_overlay.ts`, which was never added to the repo (introduced in commit `3861a35e`). Flagged as a separate task.

---

## 3. Target Architecture

```
                 ┌────────────────────────────────────────────────┐
  SCPCB .bb  ───►│  Swift Compiler (Sources/Compiler)             │
  + mods         │  lexer → parser → AST → IR → WASM codegen      │
                 └───────────────┬────────────────────────────────┘
                                 ▼
                        scpcb.wasm  (game logic; exports Web_* entrypoints;
                                     writes to command buffer in linear memory)
                                 │  shared ABI: command buffer + handle model
                                 ▼
                 ┌────────────────────────────────────────────────┐
                 │  Engine runtime                                │
                 │  Phase A: TS runtime (web/src) — scaffold      │
                 │  Phase B: Blitz3DEngine.wasm (Swift) — target  │
                 │  scene graph · renderer · collision · audio ·  │
                 │  Blitz2D · VFS · animation                     │
                 └───────────────┬────────────────────────────────┘
                                 ▼
                 ┌────────────────────────────────────────────────┐
                 │  JS bootstrap shim (minimal, permanent)        │
                 │  canvas/WebGL context · input events · audio   │
                 │  unlock · fetch→VFS preload · RAF · worker     │
                 │  watchdog / kill switch                        │
                 └────────────────────────────────────────────────┘
```

**Load-bearing contracts (frozen early, versioned):**

- **Entrypoint contract**: `Web_InitOnce%()`, `Web_Tick%(dt#)`, `Web_EnterMenu%()/Web_LeaveMenu%()`, `Web_EnterGame%()/Web_LeaveGame%()`, optional `Web_RenderStep%()`. No blocking loops in wasm, ever. (Subplan 05)
- **Command-buffer ABI**: `__CmdBufPtr`/`__CmdBufBytes`/`__CmdBufAbiVersion` exports; one drain per frame; fixed 32-bit encoding; explicit handle model with destroy calls. (Subplans 03, 02)
- **Asset manifest groups**: `boot` / `menu` / `gameplay_core` / room packs; JS preloads a group *before* the corresponding `Web_Enter*` call; no `.b3d/.x/.rmesh` ever ships. (Subplan 04)

Because both runtimes sit behind these same contracts, Phase B swaps implementations without touching the game wasm or the asset pipeline.

---

## 4. Roadmap

### Phase A — Playable SCPCB in the browser (current TS runtime)

Primary subplans: [05 SCPCB Integration](subplans/05_scpcb_integration.md), [03 Browser Shim & Boot](subplans/03_browser_shim.md), [04 Asset Pipeline](subplans/04_asset_pipeline.md)

| Milestone | Acceptance criteria |
|---|---|
| **A-M0: Entrypoint contract** | Built `dist/scpcb.wasm` exports all `Web_*` entrypoints; CI gate asserts it |
| **A-M1: Boot to menu** | Preload `boot`+`menu` groups → `Web_InitOnce` → `Web_EnterMenu` → 300 RAF frames of `Web_Tick(dt)`; menu visible, input works, tab never freezes, no leak growth |
| **A-M2: Menu → first room** | New game transition with preload gate; player spawns, camera + movement + collision work, audio plays |
| **A-M3: Round-trip stability** | Gameplay → Menu → Gameplay ×3; stable handle counts, no duplicated RAF loops/listeners, resources disposed |
| **A-M4: Mod smoke compatibility** | 2–3 real mods boot via the same `~/Software/scpcb` drop-in layout with zero per-mod code changes |

### Phase B — Self-contained Swift engine takeover

Primary subplan: [02 Swift Engine](subplans/02_engine_swift.md)

| Milestone | Acceptance criteria |
|---|---|
| **B-M0: Engine wasm boots in page** | `Blitz3DEngine.wasm` loads alongside game wasm; ABI version handshake passes |
| **B-M1: Differential harness** | Same `.bb` fixture run on TS runtime and Swift engine produces equivalent command streams / frame output |
| **B-M2: Subsystem swaps** | Math/scene-graph → Blitz2D → collision → animation → renderer → audio, each swapped behind the ABI with the differential harness green |
| **B-M3: JS reduced to shim** | JS layer ≤ ~1K lines: context creation, events, fetch, RAF, watchdog. All engine state in Swift |
| **B-M4: SCPCB parity on Swift engine** | Phase A milestones A-M1…A-M4 re-pass entirely on the Swift engine |

### Phase C — Production polish (continuous, finalized last)

Primary subplans: [06 Testing & CI](subplans/06_testing_ci.md), [07 Performance & Deployment](subplans/07_performance_deployment.md)

- Performance budgets met (boot < 10 s, 60 fps representative scene, stable memory over 30-min soak).
- Compressed, cache-friendly `dist/` on static hosting; service-worker caching for wasm + assets.
- Debug overlay, error recovery, documentation complete.

### Continuous workstream

- [01 Compiler](subplans/01_compiler.md) — maintenance mode: regression fixtures, import-surface alignment, diagnostics. The compiler is done *for current scope*; it re-enters active development only when SCPCB/mods surface new patterns.

---

## 5. Subplans

| # | Subplan | Phase | One-liner |
|---|---|---|---|
| 01 | [Compiler](subplans/01_compiler.md) | Continuous | Keep the Swift BB→WASM compiler correct, tested, and honest |
| 02 | [Swift Engine](subplans/02_engine_swift.md) | B | Grow `Blitz3DEngine` to SCPCB parity behind the shared ABI |
| 03 | [Browser Shim & Boot](subplans/03_browser_shim.md) | A | Non-blocking boot, worker watchdog, freeze prevention, minimal JS |
| 04 | [Asset Pipeline](subplans/04_asset_pipeline.md) | A | Drop-in `~/Software/scpcb` → converted, manifested, gated `dist/assets` |
| 05 | [SCPCB Integration](subplans/05_scpcb_integration.md) | A | Wrapper entry, `Web_*` exports, menu↔game milestones, mods |
| 06 | [Testing & CI](subplans/06_testing_ci.md) | Continuous | Test pyramid: Swift unit → Deno smoke → browser gates → soak/leak |
| 07 | [Performance & Deployment](subplans/07_performance_deployment.md) | C | Budgets, compression, caching, static hosting |
| 08 | [Native macOS Host](subplans/08_native_host.md) | Optional | WasmKit + Metal runner as a debugging oracle (pointer to `plan/native-swift-wasmkit/`) |

---

## 6. Open Decisions

Log each resolution as a deciduous `decision` node with options.

| ID | Decision | Options | Recommendation | Status |
|---|---|---|---|---|
| D1 | Game↔engine wasm linkage (Phase B) | (a) single linked module (b) two modules, shared memory via imports (c) two modules glued by JS shim | **(c)** first — lowest risk, ABI already JS-mediated; revisit (b) once stable | Open |
| D2 | `Web_*` export naming + ABI version freeze | — | Freeze at A-M0; bump `__CmdBufAbiVersion` on any change | Open |
| D3 | ZipApi (`ZlibWapi_*`) strategy | implement via JSZip vs. gate off in web builds | Implement (preserves mod drop-in) | Open |
| D4 | OpenAL (`al.*`) strategy | map to WebAudio vs. ensure never called | Map minimal subset used by SCPCB | Open |
| D5 | Room pack granularity | one `facility_assets` pack vs. per-room packs | Start coarse; split when A-M2 load times demand it | Open |
| D6 | Texture formats | keep PNG/JPG + mipmaps vs. KTX2/basis | Keep PNG/JPG for Phase A | Open |

---

## 7. Plan Governance

- **This file** holds vision, architecture, phases, milestones, and open decisions. Subplans hold task-level checklists and acceptance criteria.
- Checklist convention: `- [ ]` / `- [x]`, with a `YYYY-MM-DD` note on completion of significant items.
- Metrics have **one home**: compiler metrics in `docs/COMPILER_STATUS_ANALYSIS.md`; never quote numbers into plans (they go stale — the 94.2%/94.7%/100% drift already happened once).
- Log goals/decisions/actions/outcomes in deciduous **as they happen**; link commits with `--commit HEAD`.
- New plan documents go in `plan/subplans/`; superseded ones move to `plan/ARCHIVED/` — never delete, never let two "active" plans cover the same ground.

## Plan Inventory

Where the previous plans went (all content preserved; open items absorbed into subplans):

| Previous location | Disposition |
|---|---|
| `plan/ACTIVE/01…05` | Absorbed into subplans 01, 03, 06 → archived at `ARCHIVED/2026-07-22-consolidation/ACTIVE/` |
| `plan/2026-02-02_scpcb_wasm_owns_ui_web_port_plan.md` | Core of subplan 05 (architecture + milestones adopted wholesale) → archived |
| `plan/scpcb-web-track-b/00…08` | Open checkboxes absorbed into subplans 03–07; execution logs archived at `ARCHIVED/2026-07-22-consolidation/scpcb-web-track-b/` |
| `plan/native-swift-wasmkit/` | Kept in place; wrapped by subplan 08 (optional track) |
| `plan/compiler-runtime-comparison-2026-02-01/` | Kept as reference/analysis (read-only) |
| Root `SCPCB_ERROR_TRIAGE_PLAN.md`, `FIX_PLAN_SUMMARY.md`, `REMAINING_ISSUES_FIX_PLAN.md`, `ROADMAP_TO_BROWSER.md`, `NEXT_STEPS.md`, `REMAINING_WORK.md` | Stale/superseded → `ARCHIVED/2026-07-22-consolidation/root-plans/` |
| `plan/COMPLETED/`, `plan/ARCHIVED/`, `plan/archive/`, `docs/plans/` | Unchanged (historical record) |
