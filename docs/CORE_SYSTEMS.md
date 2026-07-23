# Core Systems Documentation

## Overview

Core systems form the foundation of the SCP: Containment Breach game engine.
These systems provide the fundamental infrastructure that all other game systems
build upon. They handle rendering, input, audio, and physics - the essential
components for any interactive 3D game.

## Rendering System

### Purpose

The rendering system provides 3D graphics capabilities using WebGL and Three.js,
creating the immersive horror environment of the SCP facility.

### Architecture

- **Three.js Integration**: WebGL-based 3D rendering pipeline
- **Entity Management**: Hierarchical 3D object system
- **Camera System**: First-person perspective with field-of-view control
- **Lighting System**: Dynamic lighting for horror atmosphere
- **Material System**: Texture mapping and surface properties
- **Animation System**: Skeletal animation for NPCs and player

### Key Functions

```blitzbasic
; Core rendering functions
Graphics3D(width, height, depth)           ; Initialize 3D rendering context
CreateCamera(parent%)                       ; Create player viewpoint
CreateMesh(parent%)                        ; Create 3D object
CreatePivot(parent%)                        ; Create transform node
CreateSprite(parent%)                       ; Create 2D sprite in 3D space

; Entity transformation
PositionEntity(entity, x#, y#, z#)         ; Set entity position
RotateEntity(entity, pitch#, yaw#, roll#)  ; Set entity rotation
ScaleEntity(entity, scaleX#, scaleY#, scaleZ#) ; Set entity scale
MoveEntity(entity, moveX#, moveY#, moveZ#) ; Relative movement
TranslateEntity(entity, x#, y#, z#)         ; Absolute movement

; Material and texture
EntityTexture(entity, texture%, frame%)     ; Apply texture
EntityColor(entity, red#, green#, blue#)   ; Set entity color
EntityAlpha(entity, alpha#)                ; Set transparency
EntityShininess(entity, shininess#)        ; Set surface shininess

; Rendering control
RenderWorld()                               ; Main render loop
UpdateWorld()                               ; Update animations
CameraViewport(camera, x, y, width, height) ; Set viewport
CameraRange(camera, near#, far#)            ; Set clipping planes
CameraZoom(camera, zoom#)                   ; Set zoom level
```

### Integration Points

- **[Physics System](#physics-system)**: Provides collision detection for entity
  interactions
- **[Lighting System](../GRAPHICS_RENDERING_SYSTEMS.md#lighting-system)**:
  Creates atmospheric horror effects
- **[Material System](../GRAPHICS_RENDERING_SYSTEMS.md#material-system)**:
  Manages surface properties
- **[Animation System](../ENTITY_SYSTEMS.md#entity-state-system)**: Drives
  character animations

### Performance Considerations

- **Frustum Culling**: Only render visible entities
- **LOD System**: Use lower-detail models for distant objects
- **Batch Rendering**: Group similar objects for GPU efficiency
- **Texture Compression**: Reduce memory usage and improve loading

---

## Input System

### Purpose

The input system handles keyboard and mouse input, providing the foundation for
player control and UI interaction.

### Architecture

- **Keyboard Input**: Full key state tracking with hit detection
- **Mouse Input**: Position tracking and button states
- **Pointer Lock**: Mouse capture for first-person control
- **Input Mapping**: Configurable control scheme

### Key Functions

```blitzbasic
; Keyboard input
KeyDown(keyCode%)            ; Returns true if key is currently held
KeyHit(keyCode%)             ; Returns true if key was pressed this frame
GetKey()                     ; Returns last pressed key code

; Mouse input
MouseX()                     ; Current mouse X position
MouseY()                     ; Current mouse Y position
MouseZ()                     ; Mouse wheel position
MouseDown(button%)           ; Returns true if mouse button is held
MouseHit(button%)            ; Returns true if button was pressed this frame
MouseSpeed()                 ; Mouse movement speed
MouseXSpeed()                ; Horizontal mouse movement
MouseYSpeed()                ; Vertical mouse movement

; Pointer lock control
EnablePointerLock()          ; Capture mouse for first-person control
DisablePointerLock()         ; Release mouse cursor
PointerLocked()              ; Check if mouse is captured

; Input mapping (custom functions)
LoadControls configFile$      ; Load control scheme from file
SaveControls configFile$      ; Save current control scheme
MapAction(action$, keyCode%)  ; Map keyboard key to game action
```

### Input Mapping Example

```blitzbasic
; Control configuration
Type ControlMap
    Field action$           ; Action name ("forward", "backward", etc.)
    Field keyCode%          ; Keyboard key code
    Field mouseButton%      ; Mouse button (-1 if not used)
End Type

; Check mapped input
Function ActionDown(action$)
    For cm.ControlMap = Each ControlMap
        If cm\action = action Then
            If cm\keyCode > 0 And KeyDown(cm\keyCode) Then Return True
            If cm\mouseButton >= 0 And MouseDown(cm\mouseButton) Then Return True
        EndIf
    Next
    Return False
End Function
```

### Integration Points

- **[Player Control System](../GAME_MECHANICS.md#player-control-system)**:
  Primary consumer of input events
- **[UI/HUD Systems](../UI_HUD_SYSTEMS.md)**: Handle menu and inventory
  interactions
- **[Camera System](#rendering-system)**: Mouse look for first-person view

### Performance Considerations

- **Event Polling**: Efficient input state checking
- **Debouncing**: Prevent multiple rapid-fire inputs
- **Buffer Management**: Smooth mouse movement tracking

---

## Audio System

### Purpose

The audio system provides comprehensive sound support using the Web Audio API,
creating immersive audio experiences with positional 3D sound.

### Architecture

- **Web Audio API**: FMOD emulation layer
- **Sound Management**: Sample loading and playback
- **Stream System**: Background music and ambient audio
- **3D Audio**: Positional sound for immersion
- **Channel Management**: Multiple simultaneous sounds
- **Audio Effects**: Reverb, echo, and other effects

### Key Functions

```blitzbasic
; System initialization
FSOUND_Init(driver, mixrate, flags)        ; Initialize audio system
FSOUND_Close()                             ; Shutdown audio system
FSOUND_SetVolume(volume%)                  ; Set master volume

; Sound loading and management
LoadSound(filename$)                       ; Load sound effect
LoadSoundBank(filename$)                   ; Load sound bank
FreeSound(sound%)                          ; Free sound resource

; Sound playback
PlaySound(sound%, channel%)                ; Play sound on channel
LoopSound(sound%, channel%)                ; Loop sound on channel
StopSound(channel%)                        ; Stop sound on channel
PauseSound(channel%)                       ; Pause sound
ResumeSound(channel%)                      ; Resume paused sound
SoundVolume(channel%, volume%)             ; Set channel volume
SoundPan(channel%, pan#)                   ; Set stereo panning

; 3D positional audio
Sound3D(sound%, x#, y#, z#, range#)        ; Create 3D positioned sound
UpdateSound3D(channel%, listenerX#, listenerY#, listenerZ#) ; Update 3D position
Sound3DMinDistance(channel%, distance#)    ; Set minimum hearing distance
Sound3DMaxDistance(channel%, distance#)    ; Set maximum hearing distance

; Streaming (for music and long audio)
FSOUND_Stream_Open(filename$, mode%)        ; Open audio stream
FSOUND_Stream_Play(stream%)                 ; Play stream
FSOUND_Stream_SetVolume(stream%, volume%)   ; Set stream volume
FSOUND_Stream_Stop(stream%)                 ; Stop stream

; Audio effects
SetReverb(roomType%, volume#, delay#, decay#) ; Set reverb effect
SetEcho(delay#, decay#)                    ; Set echo effect
```

### 3D Audio Implementation

```blitzbasic
Type Sound3D
    Field sound%               ; Sound resource
    Field channel%            ; Playback channel
    Field x#, y#, z#          ; World position
    Field range#              ; Hearing range
    Field volume#             ; Base volume
    Field minDist#            ; Minimum distance
    Field maxDist#            ; Maximum distance
End Type

Function Update3DSounds()
    Local listenerX# = EntityX(Camera)
    Local listenerY# = EntityY(Camera)
    Local listenerZ# = EntityZ(Camera)
    
    For s3d.Sound3D = Each Sound3D
        ; Calculate distance to listener
        dist# = Sqr((s3d\x - listenerX)^2 + (s3d\y - listenerY)^2 + (s3d\z - listenerZ)^2)
        
        ; Calculate volume based on distance
        If dist < s3d\minDist Then
            volume# = s3d\volume
        ElseIf dist > s3d\maxDist Then
            volume# = 0
        Else
            volume# = s3d\volume * (1.0 - (dist - s3d\minDist) / (s3d\maxDist - s3d\minDist))
        EndIf
        
        SoundVolume(s3d\channel, volume)
        
        ; Update stereo panning
        pan# = (s3d\x - listenerX) / s3d\range
        SoundPan(s3d\channel, pan)
    Next
End Function
```

### Integration Points

- **[Sound Effect System](../AUDIO_SOUND_SYSTEMS.md#sound-effect-system)**:
  Manages game-specific sounds
- **[Music System](../AUDIO_SOUND_SYSTEMS.md#music-system)**: Handles dynamic
  soundtrack
- **[Voice System](../AUDIO_SOUND_SYSTEMS.md#voice-system)**: Manages NPC
  dialogue
- **[Entity Systems](../ENTITY_SYSTEMS.md)**: Provides positional audio for NPCs

### Performance Considerations

- **Channel Pooling**: Reuse audio channels for efficiency
- **Distance Culling**: Don't play distant sounds
- **Audio Streaming**: Stream large audio files instead of loading entirely
- **Compression**: Use compressed audio formats (OGG, MP3)

---

## Physics System

### Purpose

The physics system provides collision detection and basic physics simulation,
enabling realistic object interactions and spatial queries for the game world.

### Architecture

- **Collision Detection**: Raycasting and entity collisions
- **Entity Picking**: Mouse-based selection
- **Collision Rules**: Configurable collision groups
- **Spatial Queries**: Distance and visibility checks
- **Physics Simulation**: Basic physics for objects

### Key Functions

```blitzbasic
; Collision setup
Collisions(sourceType%, destType%, method%, response%)  ; Setup collision rules
ResetCollisions()                                      ; Clear collision rules
ClearCollisions()                                       ; Clear all collisions

; Entity collision detection
EntityPick(range#, entity%)                            ; Raycast collision
CountCollisions(entity%)                               ; Get collision count
CollisionX(entity%, collisionIndex%)                   ; Get collision X position
CollisionY(entity%, collisionIndex%)                   ; Get collision Y position
CollisionZ(entity%, collisionIndex%)                   ; Get collision Z position
CollisionNX(entity%, collisionIndex%)                  ; Get collision normal X
CollisionNY(entity%, collisionIndex%)                  ; Get collision normal Y
CollisionNZ(entity%, collisionIndex%)                  ; Get collision normal Z
CollisionEntity(entity%, collisionIndex%)              ; Get collided entity
CollisionSurface(entity%, collisionIndex%)             ; Get collision surface
CollisionTriangle(entity%, collisionIndex%)            ; Get collision triangle

; Spatial queries
EntityDistance(entity1%, entity2%)                     ; Distance between entities
EntityVisible(entity1%, entity2%)                      ; Line of sight check
EntitiesWithinRange(entity%, range#)                    ; Find entities in range
PickEntity(x#, y#, z#, dx#, dy#, dz#, range#)          ; Raycast from point

; Physics properties
EntityRadius(entity%, radius#)                         ; Set collision sphere radius
EntityBox(entity%, width#, height#, depth#)            ; Set collision box dimensions
EntityType(entity%, type%, recursive%)                 ; Set entity collision type
EntityPickMode(entity%, mode%)                          ; Set picking mode
```

### Collision Types and Methods

```blitzbasic
; Collision types
Const COLLISION_NONE% = 0           ; No collision
Const COLLISION_SPHERE% = 1         ; Sphere collision
Const COLLISION_BOX% = 2            ; Box collision
Const COLLISION_POLYGON% = 3       ; Polygon collision

; Collision methods
Const COLLISION_METHOD_DISC% = 0    ; Discrete collision
Const COLLISION_METHOD_CONT% = 1   ; Continuous collision

; Collision responses
Const COLLISION_RESPONSE_NONE% = 0 ; No response
Const COLLISION_RESPONSE_SLIDE% = 1 ; Slide along surface
Const COLLISION_RESPONSE_STOP% = 2  ; Stop movement
```

### Collision Setup Example

```blitzbasic
; Setup collision system for SCP:CB
Function SetupCollisions()
    ; Player collisions
    Collisions(1, 2, 2, 3)  ; Player (type 1) vs Walls (type 2)
    Collisions(1, 3, 2, 2)  ; Player vs Doors
    Collisions(1, 4, 2, 1)  ; Player vs Items
    
    ; NPC collisions
    Collisions(10, 2, 2, 2)  ; NPCs vs Walls
    Collisions(10, 1, 2, 2)  ; NPCs vs Player
    Collisions(10, 10, 2, 2) ; NPCs vs NPCs
    
    ; Projectile collisions
    Collisions(20, 2, 1, 0)  ; Bullets vs Walls (stop)
    Collisions(20, 10, 1, 0) ; Bullets vs NPCs (stop)
    Collisions(20, 1, 1, 0)  ; Bullets vs Player (stop)
End Function
```

### Integration Points

- **[Player Control System](../GAME_MECHANICS.md#player-control-system)**:
  Movement collision detection
- **[NPC AI System](../ENTITY_SYSTEMS.md#npc-ai-system)**: Navigation and
  collision avoidance
- **[Rendering System](#rendering-system)**: Entity picking for interaction
- **[Event/Trigger Systems](../EVENT_TRIGGER_SYSTEMS.md)**: Spatial trigger
  detection

### Performance Considerations

- **Collision Optimization**: Use simple collision shapes when possible
- **Spatial Partitioning**: Group objects by location for faster queries
- **Collision Culling**: Skip unnecessary collision checks
- **Collision Cache**: Cache recent collision results

---

## System Integration

### Data Flow

```
Input System → Player Control → Physics System → Rendering System
     ↓               ↓                ↓                ↓
UI/HUD System  → Game Logic → Entity States → Audio System
```

### Initialization Sequence

```blitzbasic
Function InitializeCoreSystems()
    ; 1. Initialize rendering
    Graphics3D(1024, 768, 32)
    
    ; 2. Initialize physics
    SetupCollisions()
    
    ; 3. Initialize audio
    FSOUND_Init(44100, 32, 0)
    
    ; 4. Initialize input
    LoadControls("controls.cfg")
    EnablePointerLock()
End Function
```

### Main Game Loop

```blitzbasic
Function MainGameLoop()
    While Not KeyHit(KEY_ESCAPE)
        ; Input processing
        UpdateInput()
        
        ; Game logic updates
        UpdateGameLogic()
        
        ; Physics simulation
        UpdatePhysics()
        
        ; Audio updates
        Update3DSounds()
        
        ; Render frame
        RenderWorld()
        Flip()
    Wend
End Function
```

### Error Handling

```blitzbasic
Function HandleCoreErrors()
    ; Graphics errors
    If GraphicsLost() Then
        RestoreGraphicsContext()
    EndIf
    
    ; Audio errors
    If AudioDeviceLost() Then
        ReinitializeAudio()
    EndIf
    
    ; Input errors
    If Not PointerWorking() Then
        RecapturePointer()
    EndIf
End Function
```

## Performance Optimization

### Rendering Optimizations

- **Frustum Culling**: Only render visible entities
- **Occlusion Culling**: Skip hidden objects
- **Batch Rendering**: Group similar objects
- **Level of Detail**: Use simpler models for distant objects

### Physics Optimizations

- **Simple Collision**: Use spheres/boxes instead of polygons
- **Collision Filtering**: Skip unnecessary collision checks
- **Spatial Partitioning**: Use grid/quadtree for spatial queries
- **Collision Cache**: Store and reuse collision results

### Audio Optimizations

- **Distance Culling**: Skip distant sounds
- **Channel Pooling**: Reuse audio channels
- **Audio Streaming**: Stream large audio files
- **Compression**: Use efficient audio formats

### Input Optimizations

- **Event Polling**: Use efficient input checking
- **Input Buffering**: Smooth out input timing
- **Custom Mapping**: Cache input mappings for fast lookup

---

_These core systems provide the foundation for all other game systems in SCP:
Containment Breach. Their proper integration and optimization are crucial for
maintaining the game's performance and immersive experience._
