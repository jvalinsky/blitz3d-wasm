# Plan 04 — Rendering/Input/Audio Parity (Gameplay Correctness)

Created: 2026-01-29
Last updated: 2026-01-29

Goal: match SCPCB gameplay feel and visuals closely enough that core loops and navigation are correct.

## A) Rendering Parity

- [ ] Lightmaps:
  - [x] ensure RMESH→SMPK uses `TEXCOORD_1` as `uv2`. (2026-01-29: converter emits `TEXCOORD_1`; loader maps it to `uv2`.)
  - [x] ensure SMPK loader binds `lightMap` correctly. (2026-01-29: loader reads `lightmapTexture` into `material.lightMap`.)
  - [ ] verify blending/brightness in a known room
- [ ] Fog:
  - [ ] implement Blitz-style fog parameters and per-room overrides
- [ ] Alpha + sorting:
  - [ ] correct handling for transparent materials
- [ ] Performance:
  - [ ] frustum culling rules
  - [ ] instancing opportunities (later)

## B) Input

- [ ] Keyboard mapping parity (edge cases: key repeat, focus loss).
- [ ] Mouse:
  - [ ] pointer lock support
  - [ ] sensitivity scaling and smoothing
- [ ] UI focus rules: avoid capturing input when in menus/chat/console.

## C) Audio

- [ ] WebAudio backend:
  - [ ] decode policy (preload vs streaming)
  - [ ] mixing categories (music/sfx/ambience/voice)
  - [ ] pause/resume on visibility change
- [ ] 3D audio:
  - [ ] listener position/orientation updates
  - [ ] distance attenuation model

Acceptance Criteria:
- [ ] Room lightmaps look correct (no flipped UV2, no missing textures).
- [ ] Mouse look + movement feel consistent with desktop SCPCB baseline.
- [ ] Audio plays with correct volume categories and no runaway AudioContext nodes.
