# Entities: Doors, Items, NPCs

This doc maps the core entity Types and their creation/update responsibilities.

## Doors (Defined in Main.bb)

Primary source:

- `~/Software/scpcb/Main.bb` (after including `Items.bb`/`Particles.bb`)

`Type Doors` fields include:

- scene objects: `obj`, `obj2`, `frameobj`, `buttons[]`
- state: `locked`, `open`, `openstate`, `fastopen`, `timer`, `KeyCard`, `Code$`
- relations: `room.Rooms`, `LinkedDoor.Doors`
- elevator flags and extra behaviors (MTF close behavior, etc.)

Creation/cleanup:

- `CreateDoor(...)` constructs door meshes, assigns types/pick modes, parents to
  rooms, etc.
- `RemoveDoor(d.Doors)` unparents children, frees entities, deletes the Type
  instance.

Porting implication:

- door behavior is a mix of geometry transforms + gameplay rules + sound
  triggers, so you need both the 3D import surface and Type/field semantics
  working early.

## Items (Defined in Items.bb)

Primary source:

- `~/Software/scpcb/Items.bb`

Two-level model:

- `ItemTemplates` (not shown here) define:
  - names, meshes, inventory icons, scale, textures, sounds, etc.
- `Type Items` instances reference a template and include:
  - collider + model handles
  - per-instance states (`state/state2`, dropped/picked)
  - inventory UI linkage (`invimg`, `invSlots`, secondary inventory)

Creation:

- `CreateItem(name$, tempname$, x#, y#, z#, ...)`:
  - finds matching template
  - creates a collider pivot + copies the template mesh
  - sets pick mode / entity radius
  - handles special-cased items (e.g. cups, clipboard/wallet inventory slots)

## NPCs (Defined in NPCs.bb)

Primary source:

- `~/Software/scpcb/NPCs.bb`

`Type NPCs` is large and includes:

- multiple object handles (`obj/obj2/obj3/obj4`, `Collider`)
- physics state (gravity, dropspeed, coll radius)
- AI state machine vars (`State/State2/State3`, timers, target references)
- pathing (`Path.WayPoints[]`, status, timers)
- animation (`Frame`, bone manipulation fields)
- audio handles/channels (including stream flags)

Creation:

- `CreateNPC(NPCtype, x, y, z)` selects a case by type and loads models/textures
  using values from `Data/NPCs.ini` (scale/speed/etc).

Porting implication:

- NPCs are a “stress test” for the compiler and runtime:
  - heavy Type usage,
  - many branches,
  - animation timing,
  - pathfinding data structures.
