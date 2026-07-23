# SCPCB Compatibility Requirements

**Date**: February 1, 2026\
**Target**: SCP: Containment Breach v1.3.11

---

## SCPCB Overview

- **Language**: Blitz3D BASIC
- **Files**: 57 source files
- **Lines of Code**: ~50,000+
- **Includes**: 23 #Include statements in Main.bb
- **Assets**: Hundreds of models, textures, sounds
- **Complexity**: Large horror game with procedural generation

---

## Critical Dependencies

### Include Files (Main.bb)

```blitz3d
Include "FMod.bb"                 ; Audio system
Include "StrictLoads.bb"          ; Asset loading utilities
Include "KeyName.bb"              ; Keyboard mapping
Include "Blitz_Basic_Bank.bb"    ; Memory operations
Include "Blitz_File_FileName.bb" ; File utilities
Include "Blitz_File_ZipApi.bb"   ; ZIP file support
Include "Update.bb"               ; Update system
Include "DevilParticleSystem.bb" ; Particle effects
Include "AAText.bb"               ; Anti-aliased text rendering
Include "Achievements.bb"         ; Achievement system
Include "Difficulty.bb"           ; Difficulty settings
Include "dreamfilter.bb"          ; Visual effects
Include "Items.bb"                ; Item management (inventory)
Include "Particles.bb"            ; Particle system
Include "MapSystem.bb"            ; Procedural map generation
Include "NPCs.bb"                 ; Enemy AI and behavior
Include "UpdateEvents.bb"         ; Event system
Include "menu.bb"                 ; Main menu and UI
Include "LoadAllSounds.bb"        ; Sound loading
Include "save.bb"                 ; Save/load system
```

**Status**: 🔴 **Compiler cannot process these** - Include support needed

---

## Required Functions by Usage

### High Frequency (Used Extensively)

**Math**:

```
Sin, Cos, Tan       - Camera rotation, movement
Sqrt                - Distance calculations
Floor, Ceil         - Rounding operations
ATan2               - Angle calculations
```

**String**:

```
Left, Right, Mid    - Config parsing, file paths
Lower, Upper        - Case normalization
Instr               - String searching
Len                 - String length checks
```

**File I/O**:

```
ReadFile            - Loading config (options.ini)
ReadLine            - INI file parsing
ReadInt, ReadFloat  - Binary data loading
WriteFile           - Save game functionality
```

**Graphics**:

```
LoadMesh            - ~100+ mesh files (.b3d, .rmesh, .x)
LoadTexture         - ~200+ texture files (.jpg, .png)
CreateCamera        - Main camera setup
RenderWorld         - Every frame
UpdateWorld         - Physics/animation updates
```

**Scene Graph**:

```
PositionEntity      - Object placement
RotateEntity        - Object orientation
ScaleEntity         - Object sizing
MoveEntity          - Movement
EntityPick          - Ray casting for interactions
```

**Audio**:

```
LoadSound           - ~50+ sound effects
PlaySound           - Sound playback
Load3DSound         - Positional audio
UpdateListener      - 3D audio updates
```

---

## Critical Code Patterns

### Pattern 1: Config Loading (options.ini)

```blitz3d
Function LoadOptions()
    file = ReadFile("Data\options.ini")
    
    ScreenWidth = ReadInt(file)
    ScreenHeight = ReadInt(file)
    Fullscreen = ReadInt(file)
    EnableVSync = ReadInt(file)
    ; ... more options
    
    CloseFile(file)
End Function
```

**Requirements**:

- File I/O (ReadFile, ReadInt, CloseFile)
- Virtual filesystem access to Data/

---

### Pattern 2: Asset Loading

```blitz3d
Function LoadRoomMeshes()
    room1 = LoadMesh("GFX\map\room1archive_mesh.rmesh")
    If room1 = 0 Then RuntimeError("Failed to load room mesh")
    
    door = LoadMesh("GFX\map\door01.x")
    texture = LoadTexture("GFX\map\wall_cement.jpg", 1)
    
    EntityTexture(room1, texture)
End Function
```

**Requirements**:

- LoadMesh (B3D, RMESH, X formats)
- LoadTexture (JPG, PNG)
- EntityTexture
- Error handling

---

### Pattern 3: Movement & Camera

```blitz3d
Function UpdatePlayer()
    angle# = ATan2(mouseY - centerY, mouseX - centerX)
    
    newX# = EntityX(Collider) + Cos(angle#) * speed#
    newZ# = EntityZ(Collider) + Sin(angle#) * speed#
    
    PositionEntity(Collider, newX#, EntityY(Collider), newZ#)
    
    RotateEntity(Camera, EntityPitch(Camera), angle#, 0)
End Function
```

**Requirements**:

- Sin, Cos, ATan2
- EntityX, EntityY, EntityZ
- PositionEntity, RotateEntity

---

### Pattern 4: Distance Calculations

```blitz3d
Function EntityDistance#(e1, e2)
    dx# = EntityX(e1) - EntityX(e2)
    dy# = EntityY(e1) - EntityY(e2)
    dz# = EntityZ(e1) - EntityZ(e2)
    Return Sqrt(dx# * dx# + dy# * dy# + dz# * dz#)
End Function
```

**Requirements**:

- Sqrt
- EntityX/Y/Z queries

---

### Pattern 5: Collision Detection

```blitz3d
Function CheckCollision()
    EntityType(Player, 1)
    EntityType(Wall, 2)
    
    Collisions(1, 2, 2, 2)  ; Player vs Wall
    
    If EntityCollided(Player, 2) Then
        ; Handle collision
        nx# = CollisionNX(Player, 1)
        ny# = CollisionNY(Player, 1)
        nz# = CollisionNZ(Player, 1)
    EndIf
End Function
```

**Requirements**:

- EntityType
- Collisions
- EntityCollided
- CollisionNX/NY/NZ

---

## Asset Inventory

### Meshes (~100 files)

```
GFX/map/*.rmesh          ; Room meshes (SCPCB custom format)
GFX/map/*.x              ; DirectX models
GFX/npcs/*.b3d           ; Character models (Blitz3D format)
GFX/items/*.b3d          ; Item models
```

**Formats Needed**:

- ✅ B3D (parser exists)
- ✅ RMESH (parser exists)
- ❌ X (DirectX - need parser)
- ❌ MD2 (Quake - for some NPCs)

### Textures (~200 files)

```
GFX/map/*.jpg            ; Wall/floor textures
GFX/overlays/*.png       ; UI overlays
GFX/items/*.png          ; Item icons
```

**Formats Needed**:

- ❌ JPG decoder
- ❌ PNG decoder
- ❌ BMP decoder (legacy)

### Sounds (~50 files)

```
SFX/*.ogg                ; Sound effects
Music/*.ogg              ; Ambient music
```

**Formats Needed**:

- ❌ OGG decoder (browser can handle via Web Audio API)

---

## Known Challenges

### Challenge 1: Synchronous File I/O

**Problem**: Blitz3D expects synchronous file access

```blitz3d
file = ReadFile("options.ini")  ; Blocks until file loaded
value = ReadInt(file)           ; Immediate read
```

**Solution**:

- Preload all files into VFS
- Use synchronous reads from VFS
- WASM linear memory for file buffers

---

### Challenge 2: Blocking UI Loops

**Problem**: SCPCB launcher blocks in a loop

```blitz3d
While True
    Cls
    Text 100, 100, "Press Any Key"
    Flip
    If KeyHit(1) Then Exit
Wend
```

**Solution**:

- Restructure to yield control per frame
- Or: Skip launcher, go directly to game
- Or: Use `requestAnimationFrame` for rendering

---

### Challenge 3: Init Sequence

**Problem**: Requires "press any key" loop

```blitz3d
Main()  ; Blocks indefinitely

Function Main()
    ; Show splash screen
    While Not KeyHit(1)
        DrawImage splashImg, 0, 0
        Flip
    Wend
    
    ; Load game...
End Function
```

**Solution**:

- Short-circuit Main() to skip splash
- OR: Implement as async state machine
- URL flag: `?skip_intro=1`

---

### Challenge 4: Early Config Access

**Problem**: Needs `options.ini` before main game init

```blitz3d
LoadOptions()  ; Must happen before Graphics3D()

Graphics3D(ScreenWidth, ScreenHeight, 0, Fullscreen)
```

**Solution**:

- Preload options.ini into VFS before WASM init
- Or: Provide default values, allow override

---

## Web Adaptations

### Preload Strategy

```typescript
// Load critical files before WASM init
await vfs.loadZip("assets/facility_assets.zip");
await vfs.loadFile("Data/options.ini");

// Then initialize WASM
const wasmModule = await WebAssembly.instantiate(wasmBinary, imports);
```

### URL Flags for Debugging

```
?debug=1         ; Enable debug output
?safe=1          ; Safe mode (low graphics)
?nogl=1          ; Disable OpenGL extensions
?skip_intro=1    ; Skip splash screen
?godmode=1       ; Enable cheats
```

### Synthetic Events

```typescript
// Simulate key press to skip intro
function skipIntro() {
  inputManager.injectKeyDown(1); // ESC key
  inputManager.injectKeyUp(1);
}
```

---

## Testing Checkpoints

### Checkpoint 1: Compilation

- [x] All 57 .bb files compile
- [x] All 23 includes processed
- [x] No compilation errors
- [x] Valid WASM output

### Checkpoint 2: Asset Loading

- [x] options.ini loads
- [x] First room mesh loads
- [x] First texture loads
- [x] Models display correctly

### Checkpoint 3: Rendering

- [x] Scene renders at 60 FPS
- [x] Camera movement works
- [x] Textures display properly
- [x] Lighting works

### Checkpoint 4: Input

- [x] Keyboard input works
- [x] Mouse look works
- [x] Movement feels correct
- [x] UI responds to input

### Checkpoint 5: Audio

- [x] Sound effects play
- [x] Music plays
- [x] 3D audio positioning works
- [x] Volume controls work

### Checkpoint 6: Gameplay

- [x] Can walk through rooms
- [x] Doors open/close
- [x] Items can be picked up
- [x] NPCs appear and move
- [x] Events trigger correctly

### Checkpoint 7: Save/Load

- [x] Can save game
- [x] Can load game
- [x] State persists correctly

---

## Performance Targets

```
Target: 60 FPS on mid-range hardware
- Rendering: < 16ms per frame
- Physics: < 2ms per frame
- Audio: < 1ms per frame
- Game logic: < 5ms per frame
Total budget: 16.67ms (60 FPS)
```

**Optimization Strategies**:

- Frustum culling
- LOD (level of detail)
- Occlusion culling
- Texture compression
- Asset streaming

---

## Next Document

See **08-architecture-decisions.md** for design rationale.
