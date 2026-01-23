---
title: "Facility Walk Demo Plan 01 - Collision API Runtime"
status: "draft"
---

# Goal

Expose the Blitz3D collision/picking API in the JS runtime so SCP:CB movement can run unmodified in WASM.

# Scope

Implement the minimal collision surface used by SCP:CB player movement and door interaction, plus runtime diagnostics to make missing engine hooks obvious.

# Tasks

1) Add runtime data structures

- Maintain per-entity state: type, pick mode, radius/ellipsoid, transform, and collision results buffer.
- Track collision pairs configured via `Collisions(typeA,typeB,method,response)`.
- Store a stable numeric entity id that matches WASM handles.

2) Implement API surface

Required functions (first pass):

- `Collisions(typeA, typeB, method, response)`
- `EntityType(entity, type)`
- `EntityPickMode(entity, mode)`
- `EntityRadius(entity, rx, ry, rz)`
- `ResetEntity(entity)`
- `CountCollisions(entity)`
- `CollisionX/Y/Z(entity, index)`
- `CollisionNX/NY/NZ(entity, index)`
- `CollisionEntity(entity, index)`
- `EntityPick(entity, range)`
- `LinePick(x,y,z,dx,dy,dz)`
- `PickedX/Y/Z()`
- `GetEntityType(entity)`

3) Collision response logic

- Implement ellipsoid-vs-triangle intersection and sliding for `(HIT_PLAYER, HIT_MAP)` with method=2, response=2.
- Cache collision manifold per frame for `CountCollisions` and `Collision*` queries.
- Ensure `ResetEntity` clears previous collision results and resets motion accumulation.

4) Entity picking

- `EntityPick` and `LinePick` should raycast against collision mesh triangles.
- Store the last pick result for `PickedX/Y/Z` and `GetEntityType` checks.

5) Wiring to RMesh

- Use collision triangles from the RMesh hidden collision mesh and collision mesh children (as in SCP:CB).
- Keep triangle data in a spatial index (BVH or grid) for acceptable performance.

6) Runtime diagnostics

- Add a debug HUD showing floor hits, velocity, and position.
- Add a collision mesh visibility toggle (key `C`).
- Replace silent import stubs with a whitelist and loud errors for unexpected imports.

# Acceptance

- WASM `MovePlayer()` can call `CountCollisions()` and get stable floor hits.
- `LinePick()` returns the same ground hit results the JS-only runtime currently uses.
- Missing imports fail fast with actionable errors.

# References

- Collision type registration: `scpcb/Main.bb:2697`.
- Player movement collision queries: `scpcb/Main.bb:4258`.
- RMesh collision mesh construction: `scpcb/MapSystem.bb:336` and `scpcb/MapSystem.bb:746`.
