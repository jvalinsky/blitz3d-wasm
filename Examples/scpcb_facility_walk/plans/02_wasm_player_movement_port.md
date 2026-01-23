---
title: "Facility Walk Demo Plan 02 - WASM Player Movement Port"
status: "draft"
---

# Goal

Run SCP:CB player movement and camera logic inside WASM using the original BB code.

# Scope

Port `MovePlayer()` and `MouseLook()` into the demo BB, keep JS runtime as the renderer and collision backend.

# Tasks

1) Extract movement code

- Copy `MovePlayer()` and `MouseLook()` from SCP:CB into `facility_walk.bb`.
- Include dependent globals/constants used by those functions (FPSfactor, DropSpeed, CurrSpeed, etc.).

2) Resolve dependencies

- Stub or replace non-essential dependencies (sound, HUD, injuries) while preserving movement logic.
- Keep logic that affects movement and collision (noclip, crouch, drop speed, collisions, picks).

3) Bind runtime inputs

- Map `KeyDown`, `KeyHit`, `MouseXSpeed`, `MouseYSpeed`, `MoveMouse`, and `MouseX/Y` into the JS runtime.
- Keep identical key constants where possible.

4) Maintain entity mapping

- Ensure `Collider` and `Camera` entities in BB map to the same runtime entity ids.
- `EntityX/Y/Z` should reflect runtime positions without double-applying transforms.

5) Remove JS-side movement

- Remove or disable JS movement integration to avoid double-applying translations.
- Keep JS only as a mirror of WASM positions and orientation.

6) NaN hardening

- Clamp `delta` and guard zero-length vector normalization.
- Log the first NaN event with inputs for diagnosis instead of masking errors.

# Acceptance

- Player can walk, sprint, crouch, and fall using only the BB logic.
- No JS-side movement is applied (JS only mirrors positions from WASM).
- Movement stability matches SCP:CB behavior.

# References

- Movement and collision logic: `scpcb/Main.bb:4200`.
- Camera update and pitch clamping: `scpcb/Main.bb:4430`.
