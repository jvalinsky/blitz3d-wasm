# Phase 4A: Complete Runtime Coverage

**Duration**: 12-16 hours  
**Priority**: **CRITICAL** - Blocks SCPCB from running  
**Prerequisites**: Swift 6.0+, current engine builds successfully

---

## Goal

Implement ~15-20 high-priority runtime functions that SCPCB requires for basic gameplay.

---

## 4A.1: Collision System Expansion (3-4 hours)

**Functions to implement**:

### ClearCollisions
```swift
func ClearCollisions()
```
- Clear all collision pairs from previous frame
- Reset collision response data
- Called at start of each game tick

**Implementation**:
1. Extend `CollisionInfo` struct in `Sources/Blitz3DEngine/Collision.swift`
2. Add collision pair storage (array of entity pairs)
3. Clear array when called
4. Hook into runtime game loop

**Files**:
- `Sources/Blitz3DEngine/Collision.swift`
- `Sources/Runtime/GameLoop.swift`

### Collision Method Flags
```swift
enum CollisionMethod {
    case sphereToSphere    // 0
    case sphereToBox       // 1
    case sphereToPolygon   // 2
    case boxToBox          // 3
    case boxToPolygon      // 4
}
```

**Acceptance Criteria**:
- [ ] ClearCollisions removes all collision pairs
- [ ] Different collision methods selectable via Collisions()
- [ ] SCPCB player movement works with collisions
- [ ] No memory leaks

---

## 4A.2: Entity Picking System (3-4 hours)

**Functions to implement**:

### EntityPick
```swift
func EntityPick(entity: Entity, range: Float) -> Entity?
```
- Raycast from entity position in forward direction
- Return first hit entity within range
- Uses existing LinePick infrastructure

### CameraPick
```swift
func CameraPick(camera: Camera, x: Float, y: Float) -> Entity?
```
- Convert screen coordinates to world ray
- Cast ray through scene
- Return first hit entity
- **Currently stubbed** - needs full implementation

### Pick Result Getters
```swift
func PickedEntity() -> Entity?
func PickedX() -> Float
func PickedY() -> Float
func PickedZ() -> Float
func PickedNX() -> Float  // Normal
func PickedNY() -> Float
func PickedNZ() -> Float
func PickedTime() -> Float
```

**Implementation**:
1. Add ray-to-mesh intersection in `Raycast.swift`
2. Support AABB and triangle-level testing
3. Cache pick results
4. Screen-to-ray using camera matrices

**Files**:
- `Sources/Blitz3DEngine/Raycast.swift` (new)
- `Sources/Blitz3DEngine/Picking.swift`
- `Sources/Blitz3DEngine/Camera.swift`

**Acceptance Criteria**:
- [ ] EntityPick returns correct entity within range
- [ ] CameraPick works with screen coordinates
- [ ] Pick getters return valid data after pick
- [ ] Works with B3D and RMESH
- [ ] Performance: <1ms per operation

---

## 4A.3: Entity Parenting System (2-3 hours)

**Functions to implement**:

### EntityParent
```swift
func EntityParent(child: Entity, parent: Entity?, global: Bool = true)
```
- Set entity parent
- Handle local vs global transform conversion
- Update transform hierarchy
- Maintain child list

### Child Access
```swift
func CountChildren(parent: Entity) -> Int
func GetChild(parent: Entity, index: Int) -> Entity?
func FindChild(parent: Entity, name: String) -> Entity?
```

**Implementation**:
1. Extend `Entity` with `children: [Entity]` and `parent: Entity?`
2. Implement transform propagation
3. Support local/global coordinate systems
4. Handle reparenting cleanly

**Files**:
- `Sources/Blitz3DEngine/Entity.swift`
- `Sources/Blitz3DEngine/SceneGraph.swift`

**Acceptance Criteria**:
- [ ] EntityParent maintains proper hierarchy
- [ ] Child follows parent transform
- [ ] CountChildren/GetChild work correctly
- [ ] FindChild searches by name
- [ ] No memory leaks

---

## 4A.4: Camera Control Functions (2-3 hours)

**Functions to implement**:

### CameraZoom
```swift
func CameraZoom(camera: Camera, zoom: Float)
```
- Set zoom level (affects FOV)
- zoom > 1 = zoom in, zoom < 1 = zoom out

### CameraProject
```swift
func CameraProject(camera: Camera, x: Float, y: Float, z: Float) -> (screenX: Float, screenY: Float)
```
- Project 3D point to 2D screen coordinates
- **Currently stubbed** - needs matrix math
- Used for UI positioning, crosshairs

### CameraClsMode
```swift
func CameraClsMode(camera: Camera, clsColor: Bool, clsZBuffer: Bool)
```
- **Currently empty** - needs implementation
- Toggle color buffer clearing
- Toggle z-buffer clearing

**Implementation**:
1. Projection matrix math in `Math3D.swift`
2. Support perspective/orthographic modes
3. Handle viewport transformations

**Files**:
- `Sources/Blitz3DEngine/Camera.swift`
- `Sources/Blitz3DEngine/Math3D.swift`

**Acceptance Criteria**:
- [ ] CameraZoom affects FOV correctly
- [ ] CameraProject returns accurate screen coordinates
- [ ] Works at different resolutions
- [ ] ClsMode controls buffer clearing

---

## 4A.5: Advanced Audio System (2-3 hours)

**Functions to implement**:

### Channel Control
```swift
func ChannelVolume(channel: Int, volume: Float)
func ChannelPan(channel: Int, pan: Float)
func ChannelPitch(channel: Int, pitch: Float)
func StopChannel(channel: Int)
func PauseChannel(channel: Int)
func ResumeChannel(channel: Int)
```

### 3D Positional Audio
```swift
func EmitSound(sound: Sound, entity: Entity) -> Int  // Returns channel
func ChannelPos(channel: Int, x: Float, y: Float, z: Float)
```
- Distance attenuation based on listener position

### Music System
```swift
func PlayMusic(filename: String) -> Int
func StopMusic()
func MusicVolume(volume: Float)
```

**Implementation**:
1. Extend `AudioEngine` class
2. Use Web Audio API positional audio
3. Implement channel pool management
4. Support streaming for music

**Files**:
- `Sources/Blitz3DEngine/Audio.swift`
- `web/src/runtime/audio.ts`

**Acceptance Criteria**:
- [ ] All channel controls work
- [ ] 3D audio with distance attenuation
- [ ] Music streaming works
- [ ] No audio context issues

---

## Implementation Order

1. **Entity Parenting** (2h) - Easiest, needed for scene graph
2. **Camera Control** (2h) - Needed for UI projection
3. **Collision Expansion** (3h) - Critical for physics
4. **Picking System** (3h) - Critical for interaction
5. **Audio System** (2h) - Polish, can be deferred slightly

---

## Testing Strategy

Each function needs:
1. **Unit test** in `Tests/Blitz3DEngineTests/`
2. **Integration test** with actual SCPCB code
3. **Browser test** via web runtime

Run tests: `swift test`

---

## Next Phase

After completing 4A, proceed to:
- [Phase 4B: WASM Integration](./plan_4b_wasm_integration.md)

---

## References

- [Main Plan Index](./README.md)
- [SCPCB Web Port Plan (Track B)](../../../../docs/scpcb/WEB_PORT_PLAN_TRACK_B.md)
