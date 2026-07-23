# Plan 04 — Rendering/Input/Audio Parity (Gameplay Correctness)

Created: 2026-01-29 Last updated: 2026-02-04

Goal: match SCPCB gameplay feel and visuals closely enough that core loops and
navigation are correct.

## A) Rendering Parity

- [x] Lightmaps:
  - [x] ensure RMESH→SMPK uses `TEXCOORD_1` as `uv2`. (2026-01-29: converter
        emits `TEXCOORD_1`; loader maps it to `uv2`.)
  - [x] ensure SMPK loader binds `lightMap` correctly. (2026-01-29: loader reads
        `lightmapTexture` into `material.lightMap`.)
  - [x] verify blending/brightness in a known room (2026-01-29)
- [x] Fog:
  - [x] implement Blitz-style fog parameters and per-room overrides (2026-01-29:
        `web/src/runtime/graphics.ts`)
- [x] Alpha + sorting:
  - [x] correct handling for transparent materials (2026-01-29: `BrushAlpha` /
        `EntityAlpha` support)
- [ ] Performance:
  - [ ] frustum culling rules
  - [ ] instancing opportunities (later)

## B) Input

- [x] Keyboard mapping parity (edge cases: key repeat, focus loss). (2026-01-29:
      `web/src/runtime/graphics.ts` via physical scancodes)
- [x] Mouse:
  - [x] pointer lock support (2026-01-29: user gesture hook)
  - [x] sensitivity scaling and smoothing (2026-01-29)
- [ ] UI focus rules: avoid capturing input when in menus/chat/console.

## C) Audio

- [x] WebAudio backend:
  - [x] decode policy (preload vs streaming) (2026-01-29: `audio.ts`)
  - [x] mixing categories (music/sfx/ambience/voice) (2026-01-29)
  - [x] pause/resume on visibility change (2026-01-29)
- [x] Handle contract correctness (2026-02-04: sync IDs, pending play,
      stream/channel separation)
- [x] 3D audio:
  - [x] listener position/orientation updates (2026-01-29)
  - [x] distance attenuation model (2026-01-29: PannerNode)

Acceptance Criteria:

- [ ] Room lightmaps look correct (no flipped UV2, no missing textures).
- [ ] Mouse look + movement feel consistent with desktop SCPCB baseline.
- [ ] Audio plays with correct volume categories and no runaway AudioContext
      nodes.
