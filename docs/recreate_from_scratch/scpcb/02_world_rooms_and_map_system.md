# World, Rooms, and MapSystem

This is the SCPCB “world model”: rooms, templates, waypoints, and world loading.

Primary source:
- `~/Software/scpcb/MapSystem.bb`

## `Rooms` Type (Core World Container)

`MapSystem.bb` defines `Type Rooms` with many fields:

- spatial: `x/y/z`, `angle`, `dist`, `Min*`/`Max*` bounds
- template link: `RoomTemplate.RoomTemplates`
- entity collections:
  - `Objects[]`, `Levers[]`, `RoomDoors[]`, `NPC[]`
  - `Lights[]` + intensities + sprites + flicker flags
  - `SoundEmitter*[]`
  - adjacency: `Adjacent[]`, `AdjDoor[]`
- gameplay: trigger boxes, room-local texture caches, “nonfreeable” entities, etc.

Porting implication:
- Rooms are “fat structs” with many arrays; your compiler/runtime must support:
  - custom Types with many fields,
  - array fields on Types,
  - frequent field access in hot paths.

## World Loading

`MapSystem.bb` implements:

- `LoadMaterials(file$)` (reads `Data/materials.ini` and preps textures/stepsounds)
- `LoadWorld(file$, rt.RoomTemplates)` (loads a world mesh, assigns collision/pick types, extracts nodes)
- `LoadRMesh(file$, rt.RoomTemplates)` (loads room geometry in `.rmesh`)

The loader uses:
- `LoadAnimMesh_Strict` and other StrictLoads helpers
- node metadata via `KeyValue(node, "classname")` to decide how to treat mesh nodes

## Grid / Hiding System

`MapSystem.bb` defines a `Grids` type with arrays sized to `gridsz*gridsz` and
includes update logic like `UpdateGrid(grid.Grids)` that hides/shows entities
based on player distance and `HideDistance`.

Porting implication:
- Visibility management is part of gameplay performance; it’s not “just rendering”.

## Waypoints and Cameras

`MapSystem.bb` also defines:

- `Type WayPoints` (used for pathing)
- `Type SecurityCams` (used for camera systems / monitoring)

These are referenced heavily from the main loop and event system.

