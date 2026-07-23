# Plan 03 — Rendering Contracts (Metal Presentation)

Created: 2026-02-03

## Objective

Define and implement the rendering bridge between WASM and the native Metal
renderer.

## Option A: Framebuffer Upload (bootstrap path)

### Contract

- WASM exports:
  - `GetFrameBufferPtr%()` (or equivalent) → pointer to pixel buffer
  - `GetFrameBufferWidth%()`, `GetFrameBufferHeight%()`
  - `Tick%(dt#)` (or equivalent)
- Pixel format:
  - pick one: BGRA8 (preferred for Metal) or RGBA8 (more common in WASM
    examples)
  - document row stride and orientation

### Tasks

- [ ] Allocate a `MTLTexture` sized to framebuffer dims.
- [ ] Each frame:
  - call WASM tick export,
  - copy bytes from WASM memory into texture (`replaceRegion` or a staging
    buffer),
  - render a fullscreen quad.

### Pros / Cons

- ✅ fastest bring-up; minimal GPU pipeline complexity
- ❌ heavy bandwidth; not ideal for complex 3D long-term

## Option B: Command Buffer (preferred parity with web Track B)

### Contract

- WASM writes commands into a linear-memory ring/region:
  - `__CmdBufPtr`, `__CmdBufBytes`, `__CmdBufAbiVersion` (or native equivalents)
- Host drains commands once per frame and submits Metal draw calls.

### Tasks

- [ ] Define the opcode set to reuse from web Track B (or translate one-to-one).
- [ ] Implement a Metal command executor:
  - resource creation (buffers/textures),
  - transforms, draw submissions,
  - state changes.
- [ ] Add validation:
  - bounds checks,
  - ABI version match,
  - opcode/length sanity.

### Pros / Cons

- ✅ scalable, aligns with “WASM owns game; host is device driver”
- ❌ more work up front; requires renderer design

## Decision

- [ ] Choose initial bridge for v1 bring-up (A or B).
- [ ] Choose shader build workflow:
  - Precompiled `.metallib` (CLI `xcrun metal` / `xcrun metallib`), or
  - SwiftPM `MetalCompilerPlugin` (see `06_research_notes.md`).
- [ ] Document the chosen ABI and how it maps to Track B (if applicable).

## Acceptance criteria

- Visual output updates at frame rate without UI jank.
- Bridge errors are diagnosable (bad pointer/size/ABI -> clear log + safe
  abort).
