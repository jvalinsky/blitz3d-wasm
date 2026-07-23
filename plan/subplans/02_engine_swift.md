# Subplan 02 — Swift Engine (`Blitz3DEngine` → wasm)

**Phase**: B (the strategic centerpiece — this is what makes the project "self-contained Swift")
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Code**: `Sources/Blitz3DEngine` (~9.2K lines: SceneGraph, Renderer, Graphics, Physics, Audio, Animation, Banks, FileIO, Input, Math, Parsers, Strings, System, Platform, Gameplay, Misc, Utils)
**Build**: `build-engine-wasm.sh` + `Package.wasm.swift`, SwiftWasm 6.2.3 SDK, JavaScriptKit 0.19.2 (pinned — 0.20+ pulls SwiftSyntax which cannot compile for wasm)
**Prior analysis**: `docs/SWIFTWASM_PORTING_ANALYSIS.md` (A+ wasm-readiness; Foundation + JavaScriptKit only)

## Objective

Grow the Swift engine to SCPCB parity **behind the same ABI the TS runtime implements today** (entrypoint contract + command buffer + handle model), then swap it in subsystem-by-subsystem until JavaScript is reduced to a ≤ ~1K-line bootstrap shim. End state: compiler in Swift, engine in Swift, game logic in compiled BB — all wasm.

## Strategy: oracle-driven incremental takeover

Do **not** big-bang rewrite. The TS runtime is the behavioral oracle:

1. Build a **differential harness**: run the same `.bb` fixture against the TS runtime and the Swift engine; compare emitted command streams (and later, rendered frames via pixel hash) per tick.
2. Swap one subsystem at a time behind the ABI. A swap is done when the differential harness and the Phase A browser gates are green with the Swift implementation active.
3. Keep a runtime flag (`?engine=swift|ts|split`) so any regression bisects to a subsystem in minutes.

Swap order (dependency-driven, lowest-risk first):

| Order | Subsystem | Notes |
|---|---|---|
| 1 | Math + string/bank ops | Pure logic, no browser APIs — easiest differential wins |
| 2 | Scene graph + entity/handle model | Owns transforms, hierarchy, `PositionEntity`/`RotateEntity`/parenting |
| 3 | Blitz2D (Text/Rect/DrawImage/fonts) | SCPCB menu/HUD path; render via command buffer or direct WebGL through JavaScriptKit |
| 4 | Collision + picking | `ClearCollisions`, collision queries, `PickedSurface/PickedTriangle` — currently stubbed in TS too; consider implementing here *first* so effort lands in the end-state engine (coordinate with subplan 05 blockers) |
| 5 | Animation playback | B3D sequences, `Animate`/`SetAnimTime` (absorbs open Track B `07_animation_playback.md` items) |
| 6 | Renderer (WebGL calls from Swift) | Replaces Three.js; largest chunk — meshes, materials, textures, lights, cameras, render-to-texture as needed by SCPCB |
| 7 | Audio (WebAudio via JavaScriptKit) | 2D + 3D sound categories, stop/pause/resume, node lifecycle |
| 8 | VFS / FileIO | Reads from JS-preloaded linear-memory VFS; keeps sync-IO semantics |

## Workstreams

### 2.1 Build & packaging hygiene

- [ ] Replace the `Package.swift` swap hack (`Package.wasm.swift` + mv) with SwiftPM traits or a documented, scripted flow that cannot leave the repo in a swapped state on failure
- [ ] Replace `--export-all` with an explicit export list (`@_expose(wasm)` / linker export file) — professional binary hygiene, smaller module
- [ ] Measure and budget wasm binary size (target: record baseline, then < 10 MB uncompressed; track in CI)
- [ ] Revisit initial/max memory (currently 64 MB/128 MB) against SCPCB asset working set
- [ ] CI job builds engine wasm on every PR (compile-only gate first, then tests)

### 2.2 API coverage matrix

- [ ] Generate the list of Blitz3D functions SCPCB actually calls (reuse `used_functions.txt` / `import_requirements_full.json` tooling) and produce a coverage matrix: engine-implemented / TS-only / stubbed / missing
- [ ] Publish the matrix as a generated doc; CI fails if a game build references a function in "missing"
- [ ] Prioritize implementation strictly by SCPCB call-path evidence, not API completeness

### 2.3 Differential harness (B-M1)

- [ ] Deno/browser test: load both runtimes, run N ticks of a fixture, assert equivalent command streams (allow documented float tolerances)
- [ ] Add frame-hash comparison once the Swift renderer lands (subsystem 6)
- [ ] Wire into `deno task test:all`

### 2.4 Subsystem swaps (B-M2) — one checklist item per swap, in order

- [ ] 1. Math/strings/banks behind ABI, differential green
- [ ] 2. Scene graph + handles
- [ ] 3. Blitz2D
- [ ] 4. Collision + picking
- [ ] 5. Animation
- [ ] 6. Renderer
- [ ] 7. Audio
- [ ] 8. VFS/FileIO

### 2.5 Shim reduction (B-M3)

- [ ] Inventory remaining JS after swaps; everything that isn't context-creation / event forwarding / fetch / RAF / watchdog gets a removal task
- [ ] Final shim ≤ ~1K lines, zero game/engine state, documented in one file

## Acceptance criteria

- B-M4: All Phase A milestones (A-M1…A-M4, subplan 05) re-pass with `?engine=swift`
- Engine builds warning-clean with the pinned SwiftWasm SDK; no Xcode required
- No dependency beyond Foundation + JavaScriptKit (wasm targets only)

## Risks

| Risk | Mitigation |
|---|---|
| JavaScriptKit call overhead on hot render path | Batch via command buffer / typed-array bridges; profile before optimizing |
| Swift wasm binary size / allocator behavior | Size budget in CI; prefer `Array`-based storage over `Dictionary` on hot paths (lesson already learned in Phase 1 work) |
| Two-runtime maintenance burden during migration | Differential harness makes divergence cheap to detect; subsystem flags keep bisection fast |
| JavaScriptKit pin blocks SDK upgrades | Track SwiftWasm releases; the pin is an ADR — revisit deliberately, not incidentally |
