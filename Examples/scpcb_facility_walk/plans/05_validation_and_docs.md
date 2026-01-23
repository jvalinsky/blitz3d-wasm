---
title: "Facility Walk Demo Plan 05 - Validation and Documentation"
status: "draft"
---

# Goal

Make the demo reproducible with clear build steps, diagnostics, and a validation checklist.

# Scope

Document build/run workflow, asset sync, and define a short QA checklist for movement and doors.

# Tasks

1) Demo README

- Build steps: `./build.sh` and local server command.
- Controls: WASD, mouse, crouch, sprint, use.
- Debug toggles (collision mesh, HUD).

2) Asset staging notes

- Document how to run `sync_assets.sh` with a selected RMesh.
- Explain where textures are copied from in SCP:CB.

3) Validation checklist

- Spawn inside the room on the floor.
- Walk along a hallway without falling through.
- Door opens and closes, blocking passage when closed.
- No missing imports/assets in console.

4) Troubleshooting

- Missing collision: try `_hb.b3d` or switch RMesh.
- No floor contact: verify `Collisions` config and `EntityType` assignments.

5) Next improvements

- Multiple rooms stitched together (load multiple RMeshes, align transforms).
- Door sound hooks (open/close) driven by BB or JS.
- Basic interaction raycast (crosshair use).
- Better physics (capsule collisions, steps/slope handling).

# Acceptance

- Another developer can run the demo and reproduce results without digging into the code.

# References

- Asset loading path in SCP:CB: `scpcb/MapSystem.bb:336`.
- Collision setup: `scpcb/Main.bb:2697`.
