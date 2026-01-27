# Runtime Architecture: WASM vs JavaScript Boundary

## Principle

**Use compiled BB code (WASM) for game logic. Use JavaScript only for browser API bindings.**

SCPCB has extensive BB code for particles, physics, AI, file parsing, etc. We should compile and use that code rather than reimplementing it in JavaScript.

## Current State (Problematic)

We've reimplemented too much in JavaScript:

| JS Module | Lines | Should Be |
|-----------|-------|----------|
| rmesh.js | 869 | **WASM** - SCPCB has LoadRMesh in MapSystem.bb |
| physics.js | 552 | **Minimal JS** - only Three.js raycasting, game logic in WASM |
| b3d.js | 876 | **WASM** - B3D parsing is pure data processing |
| graphics.js | 2327 | **Split** - Three.js calls in JS, entity logic in WASM |
| room.js | 347 | **WASM** - SCPCB has room management in MapSystem.bb |
| animation.js | 150 | **Split** - Three.js animation API in JS, timing in WASM |

## Correct Architecture

### JavaScript Runtime (Thin Layer)

Only browser API bindings:

```
┌─────────────────────────────────────────────────────────┐
│                    JavaScript Runtime                    │
├─────────────────────────────────────────────────────────┤
│ WebGL/Three.js    │ Web Audio API  │ DOM Events         │
│ - CreateMesh()    │ - LoadSound()  │ - KeyDown()        │
│ - CreateTexture() │ - PlaySound()  │ - MouseX()         │
│ - RenderWorld()   │ - SetVolume()  │ - ReadFile() (VFS) │
│ - PositionEntity()│                │                    │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 WASM (Compiled BB Code)                  │
├─────────────────────────────────────────────────────────┤
│ Game Logic        │ File Parsers   │ Systems            │
│ - Main loop       │ - LoadRMesh()  │ - Particles        │
│ - NPC AI          │ - ParseB3D()   │ - Collision logic  │
│ - Events          │ - INI parsing  │ - Room management  │
│ - Inventory       │ - Save/Load    │ - Entity management│
└─────────────────────────────────────────────────────────┘
```

### What Stays in JavaScript

1. **Graphics Primitives** (calls to Three.js)
   - CreateCamera, CreateLight, CreateMesh, CreateSprite
   - LoadTexture, EntityTexture, EntityColor
   - PositionEntity, RotateEntity, ScaleEntity (just sets Three.js transforms)
   - RenderWorld (calls Three.js render)

2. **Audio Primitives** (calls to Web Audio)
   - LoadSound, PlaySound, StopChannel
   - ChannelVolume, ChannelPan

3. **Input** (DOM events)
   - KeyDown, KeyHit, MouseX, MouseY, MouseDown

4. **File I/O** (Virtual FS / fetch)
   - ReadFile, WriteFile, OpenFile, CloseFile
   - ReadInt, ReadFloat, ReadString, ReadByte

### What Should Be WASM (BB Code)

1. **File Parsers** - SCPCB already has these:
   - `LoadRMesh()` in MapSystem.bb (8750 lines)
   - B3D loading via Blitz3D's LoadAnimMesh
   - INI parsing throughout

2. **Game Systems** - Pure logic:
   - `Particles.bb` (288 lines) - CreateParticle, UpdateParticles
   - `DevilParticleSystem.bb` (421 lines)
   - `NPCs.bb` (7460 lines) - All AI
   - `UpdateEvents.bb` - Event triggers
   - `Items.bb` - Inventory system

3. **Entity Management**:
   - Type definitions (Rooms, NPCs, Items, Particles)
   - For/Each iteration
   - Field access

## Migration Plan

### Phase 1: Identify JS Code to Remove

```bash
# These JS modules duplicate BB functionality:
Sources/Runtime/modules/rmesh.js      # -> Use MapSystem.bb LoadRMesh
Sources/Runtime/modules/room.js       # -> Use MapSystem.bb room logic  
Sources/Runtime/modules/physics.js    # -> Keep only raycasting primitives
Sources/Runtime/modules/b3d.js        # -> Can stay (no BB equivalent)
```

### Phase 2: Thin JS Runtime

Reduce JS to ~50 essential functions:

```javascript
// graphics.js - only Three.js wrappers
CreateCamera() -> new THREE.PerspectiveCamera()
CreateMesh() -> new THREE.Mesh()
LoadTexture() -> textureLoader.load()
PositionEntity(e,x,y,z) -> entities[e].position.set(x,y,z)
RenderWorld() -> renderer.render(scene, camera)

// audio.js - only Web Audio wrappers  
LoadSound() -> fetch + audioContext.decodeAudioData()
PlaySound() -> source.start()

// input.js - only DOM event capture
KeyDown(k) -> keyStates[k]
MouseX() -> mouseState.x
```

### Phase 3: Compile SCPCB Systems

Compile these BB files to WASM:
1. MapSystem.bb (LoadRMesh, room loading)
2. Particles.bb (particle system)
3. NPCs.bb (AI, pathfinding)
4. Items.bb (inventory)
5. UpdateEvents.bb (triggers)

### Phase 4: Wire Up

WASM calls JS imports for rendering:
```
WASM: CreateParticle() 
  -> calls JS: CreateSprite()
  -> JS creates Three.js sprite
  -> returns handle to WASM

WASM: UpdateParticles()
  -> calls JS: PositionEntity(handle, x, y, z)
  -> JS updates Three.js position
```

## Benefits

1. **Authenticity** - Uses original SCPCB code, same behavior
2. **Less JS maintenance** - Don't reimplement complex logic
3. **Performance** - WASM is faster for tight loops
4. **Correctness** - BB code is battle-tested

## Example: Particle System

### Current (Wrong)
```javascript
// particles.js - 200 lines of JS reimplementing BB
class ParticleSystem {
    createParticle(x, y, z, ...) { ... }
    update() { ... }
}
```

### Correct
```javascript
// particles.js - 10 lines, just imports
imports.env.CreateSprite = (parent) => { return createThreeSprite(); };
imports.env.PositionEntity = (e, x, y, z) => { entities[e].position.set(x,y,z); };
imports.env.ScaleSprite = (e, w, h) => { ... };
// Actual particle logic is in compiled Particles.bb WASM
```

## Files to Review in SCPCB

| BB File | Lines | Contains |
|---------|-------|----------|
| MapSystem.bb | 8750 | LoadRMesh, LoadWorld, room management |
| NPCs.bb | 7460 | All NPC types and AI |
| UpdateEvents.bb | ~5000 | Room events, triggers |
| Items.bb | ~3000 | Inventory, item types |
| Particles.bb | 288 | Simple particle system |
| DevilParticleSystem.bb | 421 | Advanced particles |
| Menu.bb | ~2000 | Menu system |
| Save.bb | ~1000 | Save/load |
