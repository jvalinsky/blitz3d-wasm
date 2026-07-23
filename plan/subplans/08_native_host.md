# Subplan 08 — Native macOS Host (optional track)

**Phase**: Optional (not on the critical path to the browser goal)
**Parent**: [00_GLOBAL_PLAN.md](../00_GLOBAL_PLAN.md)
**Full plan set**: `plan/native-swift-wasmkit/` (kept in place — `00_overview.md` … `06_research_notes.md`)

## What it is

A SwiftPM-only (no Xcode) macOS runner: WasmKit executes the compiled BB→WASM, an AppKit + MTKView host provides imports (VFS, input, audio, render submission) and drives ~60 Hz. Pure Swift — fully aligned with the project's self-contained-Swift identity.

## Why it stays optional

It does not advance the browser milestone. Its value is as a **debugging oracle**: native execution with lldb, deterministic stepping, and no browser sandbox makes runtime-parity bugs (collision, animation, command-buffer semantics) much easier to isolate — the same role the differential harness plays in Phase B, from a different angle.

## Activation criteria (pick it up only if one of these holds)

- Phase A/B debugging is repeatedly bottlenecked on browser-only reproduction
- A desktop distribution of the project becomes a goal
- Contributor bandwidth exists that cannot be applied to Phases A–C

## If activated

- [ ] Execute `plan/native-swift-wasmkit/01…05` in order (SPM host → WasmKit integration → render contract → input/audio/FS → testing/packaging)
- [ ] Reuse the frozen entrypoint + command-buffer ABI (subplans 03/05) — the native host is a third implementation of the same contract, and must not fork it
- [ ] Wire the differential harness (subplan 02.3) to compare native vs browser runs
