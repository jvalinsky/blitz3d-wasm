# Plan 04 — Input, Audio, and Filesystem Bridges

Created: 2026-02-03

## Objective

Provide enough native host functionality to run non-trivial programs:

- keyboard/mouse input,
- audio output,
- filesystem access compatible with our existing expectations (VFS/manifest-ish
  model where possible).

## Input

### Tasks

- [ ] Translate NSEvent key/mouse events into the same logical input model used
      by the web runtime where possible.
- [ ] Define stable imports:
  - `KeyDown(keyCode)` / `GetKey()` / `WaitKey()` equivalents
  - `MouseX()`, `MouseY()`, `MouseDown(btn)` / delta speed equivalents
- [ ] Add focus + cursor behavior rules (avoid stealing input in
      menus/overlays).

### Acceptance criteria

- Input-driven demo responds correctly (movement, click, basic UI interaction).

## Audio

### Strategy options

1. Minimal: stub imports but keep runtime stable (no crashes).
2. Native playback: use CoreAudio/AVFoundation with explicit lifecycle.

### Tasks

- [ ] Decide baseline (stub vs minimal playback).
- [ ] Define/implement imports for the minimum viable subset used by target
      demos.
- [ ] Ensure audio start follows platform policies (macOS is permissive vs
      browsers, but still handle device init failures).
- [ ] Research candidate libraries/frameworks for implementation choices (see
      `06_research_notes.md`).

## Filesystem / VFS

### Strategy options

1. Direct disk access:

- Allow WASM to request file reads by path; host reads from disk and returns
  bytes.

2. Manifest/VFS (preferred for parity):

- Keep a manifest of allowed files (similar to `scpcb_manifest.json`).
- Resolve path aliasing and case-insensitivity like web runtime.

### Tasks

- [ ] Choose strategy (direct disk vs manifest-backed).
- [ ] Implement path normalization rules.
- [ ] Define imports:
  - open/read/close primitives, or
  - a “read whole file” API for bring-up.
- [ ] Add caching and explicit disposal rules to avoid runaway memory.

### Acceptance criteria

- A demo that loads textures/models can read assets reliably using a documented
  root.
