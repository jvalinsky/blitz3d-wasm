# Phase 2: Graphics API Expansion

This phase adds support for the dynamic mesh manipulation and entity effects used by the room loading and NPC systems.

## 1. Dynamic Mesh API (RMESH)
Essential for custom room formats that construct geometry at runtime.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `CreateSurface(mesh, [brush])`
    - `AddVertex(surface, x, y, z, [u], [v], [w])`
    - `AddTriangle(surface, v0, v1, v2)`
    - `VertexColor(surface, index, r, g, b, [a])`
    - `VertexTexCoords(surface, index, u, v, [w], [coord_set])`
    - `UpdateNormals(mesh)`
- [ ] **Runtime (JS):** Implement these in `runtime.js` using Three.js `BufferGeometry` and `BufferAttribute` updates.

## 2. Advanced Entity Properties
Used for visual polish and AI perception.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `PointEntity(entity, target, [roll])`
    - `EntityAlpha(entity, alpha)`
    - `EntityColor(entity, r, g, b)`
    - `EntityFX(entity, fx)`
    - `EntityBlend(entity, blend)`
    - `NameEntity(entity, name$)`
    - `EntityName$(entity)`
- [ ] **Runtime (JS):** 
    - Map `PointEntity` to Three.js `lookAt`.
    - Map `EntityAlpha`/`Color` to material property updates.
    - Implement a name registry for entities to support `EntityName`.

## 3. Collision & Picking
Extended collision commands used by the player and NPC physics.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `CountCollisions(entity)`
    - `CollisionSurface(entity, index)`
    - `CollisionTriangle(entity, index)`
- [ ] **Runtime (JS):** Update the collision engine to expose surface and triangle indices from the physics world.

## Verification
- Compile and validate `MapSystem.bb` (partially).
- Create a test script that generates a procedural mesh and modifies its vertex colors.
