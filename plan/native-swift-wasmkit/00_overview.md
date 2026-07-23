# Plan 00 — Overview (Native macOS Host via WasmKit)

Created: 2026-02-03

## Goal

Create a native macOS runner for BB→WASM output that:

- uses SwiftPM (no Xcode project),
- opens a window (AppKit),
- renders via Metal (MetalKit `MTKView`),
- executes game logic in WebAssembly via **WasmKit**, and
- stays responsive (no hard hangs) with clear diagnostics.

## Non-goals

- Replacing the existing web runtime/loader.
- Implementing full SCPCB parity in one pass.
- Solving all performance issues immediately (correctness + iteration speed
  first).

## Why this plan exists

- Faster iteration on runtime/ABI decisions without browser constraints.
- Easier profiling and debugging of WASM execution on desktop.
- A stepping stone toward “single-player native” builds and/or shared logic
  between web and native.

## Architecture sketch

```
BB (.bb)
  ↓ compile (existing Swift compiler)
WASM module (.wasm)
  ↓ executed by WasmKit
Native Host (SwiftPM executable)
  - AppKit window lifecycle
  - MetalKit MTKView draw loop
  - WasmKit module instance + imports
  - Bridges: input/audio/fs/render submission
```

## Critical design choice: render bridge

Pick one primary path (can support both later):

1. **Command Buffer (preferred long-term)**

- WASM writes a compact command stream into linear memory.
- Host reads + executes commands into a Metal renderer.
- Aligns with Track B philosophy (“coarse-grained boundary”).

2. **Framebuffer upload (fastest to bootstrap)**

- WASM writes a BGRA8/RGBA8 pixel buffer into linear memory.
- Host copies into a `MTLTexture` each frame and draws a fullscreen quad.
- Great for early bring-up; may be bandwidth-heavy for higher resolutions.

## Risks / known hard parts

- Import surface area: SCPCB and demo programs may call many Blitz3D functions.
- Determinism vs UI responsiveness: avoid calling a non-returning WASM function
  on the main thread.
- Memory growth & bridging: ensure correct handling if WasmKit grows memory or
  if the host caches pointers.
- Packaging: assets + VFS mapping must mirror enough of Track B conventions to
  be useful.

## Milestones

- M0: SwiftPM window + MTKView renders a clear color.
- M1: WasmKit loads a trivial `.wasm` and calls an export.
- M2: Stable string + memory helpers (read/write) work.
- M3: One render bridge works end-to-end (command buffer or framebuffer upload).
- M4: Input + timing imports work; update loop drives a WASM “tick”.
- M5: Run one real demo module (e.g. particle demo) with acceptable stability.

## Success criteria

- App launches with no Xcode project.
- Can load a `.wasm` from disk and call exports deterministically.
- Frame loop remains responsive; runaway code can be stopped (watchdog / time
  budget).
- Clear diagnostics on missing imports and contract violations.
