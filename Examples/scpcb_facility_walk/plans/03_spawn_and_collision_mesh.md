---
title: "Facility Walk Demo Plan 03 - Spawn and Collision Mesh Fidelity"
status: "draft"
---

# Goal

Ensure the demo spawns inside a walkable facility area and uses collision geometry consistent with SCP:CB.

# Scope

Use RMesh collision geometry and, where applicable, the dedicated hitbox meshes used in SCP:CB rooms. Normalize Blitz3D <-> Three.js coordinate conversions.

# Tasks

1) Coordinate conversions

- Centralize `blitzToThreePos`, `threeToBlitzPos`, and yaw conversions.
- Apply conversions consistently to RMesh vertices, entities, player position, and door placement.

2) Choose the demo map file

- Pick one non-zero RMesh with usable collision and spawn markers.
- Set a single `MAP_NAME` or mesh switcher default.

3) Asset staging

- Use `sync_assets.sh` to copy the RMesh and its textures into the demo assets.
- Fail fast if referenced textures are missing to avoid 404s.

4) Spawn selection order

- Prefer `playerstart` point entity.
- Else use the first `waypoint` entity.
- Else use a fallback based on collision mesh bounds plus a downward pick.

5) Ground snap validation

- Perform a `LinePick` downward to place the player on walkable triangles.
- Validate surface normal (avoid ceilings) before finalizing spawn.

6) Collision mesh sources

- Use the RMesh hidden collision mesh (invisible mesh block) for primary collision.
- Use the RMesh collision meshes attached to `collisionMeshes` pivot as additional surfaces.

7) Hitbox meshes (when required)

- Some rooms use `_hb.b3d` hitbox meshes; detect and optionally load those meshes.
- Start with a minimal list of rooms and add as needed when collision is sparse.

8) Mesh switcher support

- Add a map selection dropdown for swapping RMesh files at runtime.
- Rebuild collision index when the map changes.

# Acceptance

- Spawn is always inside the room, standing on the floor.
- Collision remains stable when walking off rails and stairs.
- Coordinate conversions are consistent across runtime and WASM.

# References

- RMesh collision mesh construction: `scpcb/MapSystem.bb:470` and `scpcb/MapSystem.bb:746`.
- Hitbox meshes used by rooms: `scpcb/MapSystem.bb:5221` and `scpcb/MapSystem.bb:5414`.
- Point entity parsing in RMesh loader: `scpcb/MapSystem.bb:792`.
