---
title: "Facility Walk Demo Plan 04 - Doors and Interaction"
status: "draft"
---

# Goal

Provide functioning SCP:CB-style doors (open/close, collision blocking, button interaction).

# Scope

Use the SCP:CB door logic with WASM updates and runtime visuals/colliders.

# Tasks

1) Door entities

- Parse door entities from RMesh or provide a small JSON config per map.
- Store door base transform in Blitz coordinates for accurate distance checks.

2) Door state in WASM

- Add door creation and update functions in BB (`CreateDoor`, `UpdateDoors`).
- Keep `openState`, `fastopen`, and sound hooks as no-ops if needed.

3) Door placement strategy

Option A (fast, reliable): manual door config per map in `doors.json`.

Option B (later): infer doors from RMesh entities and metadata.

4) Runtime door animation

- Animate door meshes based on `openState` using the same `sin(openState)` curve as SCP:CB.
- Disable collider when open; enable when closed or closing.

5) Interaction mapping

- Use `E` to “use” doors within range.
- Let BB decide (distance check via `EntityX/Z` and `KeyHit`).
- Optionally add a raycast to ensure the player is facing a door button.

6) Debug tools

- Log last door id and its `openState` in the debug HUD.
- Add a visual marker for door collider bounds in debug mode.

# Acceptance

- Doors open/close reliably and block passage when closed.
- The same input and range check as SCP:CB governs interaction.

# References

- Door entity setup and collision types: `scpcb/Main.bb:1881` and `scpcb/Main.bb:2007`.
- Door movement curve logic: `scpcb/Main.bb:2122`.
