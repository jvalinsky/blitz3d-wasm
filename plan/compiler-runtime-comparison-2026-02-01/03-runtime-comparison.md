# Swift Engine vs Blitz3D-NG Runtime

**Date**: February 1, 2026\
**Comparison**: Swift Engine (166 functions) vs Blitz3D-NG Runtime (750+
functions)

---

## Overview

The Swift Blitz3D engine provides **22% coverage** (166/750 functions) compared
to Blitz3D-NG's comprehensive runtime. Strong in scene graph management, but
missing critical functionality for asset loading, file I/O, math, and strings.

---

## Coverage by Category

### 1. Memory / Banks

**Coverage**: 11/30 functions (37%)

#### ✅ Implemented (Swift Engine)

**Location**: `Sources/Blitz3DEngine/Banks/`

```
CreateBank    - Allocate memory bank
FreeBank      - Release memory bank
BankSize      - Query bank size
GetBankPtr    - Get pointer to bank data
PeekByte      - Read byte from bank
PokeByte      - Write byte to bank
PeekInt       - Read i32 from bank
PokeInt       - Write i32 to bank
PeekFloat     - Read f32 from bank
PokeFloat     - Write f32 to bank
ResizeBankMaybe - Partial resize support
```

**Strengths**:

- ✅ Memory-safe with bounds checking
- ✅ Clean API
- ✅ Core functionality covered

#### ❌ Missing (Blitz3D-NG)

**Location**: `reference/blitz3d-ng/src/modules/bb/bank/commands.h`

```
ResizeBank    - Resize existing bank
CopyBank      - Copy bank data
PeekShort     - Read i16 from bank
PokeShort     - Write i16 to bank
PeekHandle    - Read pointer from bank
PokeHandle    - Write pointer to bank
ReadBytes     - Read from file to bank
WriteBytes    - Write bank to file
BankCapacity  - Query bank capacity
```

**Impact**: Limited but manageable. Short operations can be emulated. Stream
operations would be useful.

---

### 2. Graphics / Rendering

**Coverage**: 44/150 functions (29%)

#### ✅ Implemented (Swift Engine)

**Location**: `Sources/Blitz3DEngine/Graphics/`

**Texture Operations** (11 functions):

```
CreateTexture      - Generate texture
TextureBlend       - Set blend mode
TextureCoords      - Set UV coordinate mode
TextureFilter      - Set filtering
SetTextureFormat   - Configure format
TextureWidth       - Query width
TextureHeight      - Query height
TextureName        - Get identifier
FreeTexture        - Release texture
```

**Mesh Operations** (44 functions):

```
CreateMesh         - Generate empty mesh
AddMesh            - Combine meshes
CopyMesh           - Duplicate mesh
FreeMesh           - Release mesh
PaintMesh          - Apply material
AddMeshToEntity    - Attach to entity
MeshWidth          - Bounding box width
MeshHeight         - Bounding box height
MeshDepth          - Bounding box depth
UpdateNormals      - Recalculate normals
FlipMesh           - Reverse winding
PositionMesh       - Transform mesh
RotateMesh         - Rotate mesh
ScaleMesh          - Scale mesh
FitMesh            - Fit to bounds
```

**Surface/Vertex Operations** (20 functions):

```
CreateSurface      - Add surface to mesh
GetSurfaceFrom... - Query surface
FindSurface        - Lookup by index
ClearSurface       - Remove geometry
AddVertex          - Add vertex to surface
AddTriangle        - Add triangle indices
VertexCoords       - Set position
VertexNormal       - Set normal
VertexColor        - Set color
VertexTexCoords    - Set UVs
CountVertices      - Query count
CountTriangles     - Query count
VertexX/Y/Z        - Query position
VertexNX/NY/NZ     - Query normal
TriangleVertex     - Query indices
```

**Strengths**:

- ✅ Comprehensive mesh manipulation
- ✅ Good surface/vertex API
- ✅ Texture configuration

#### ❌ Critical Missing (Blitz3D-NG)

**Location**: `reference/blitz3d-ng/src/modules/bb/blitz3d/commands.h`

**Asset Loading** (0 functions implemented):

```
LoadMesh           - Load mesh from file (B3D, MD2, 3DS, X, BSP)
LoadTexture        - Load texture from image file
LoadImage          - Load image for 2D use
LoadBrush          - Load material/brush
LoadAnimMesh       - Load animated mesh
```

**Geometric Primitives** (0 functions):

```
CreateCube         - Generate cube mesh
CreateSphere       - Generate sphere mesh
CreateCylinder     - Generate cylinder mesh
CreateCone         - Generate cone mesh
CreatePlane        - Generate plane mesh
```

**Display Management** (0 functions):

```
Graphics           - Set 2D graphics mode
Graphics3D         - Set 3D graphics mode
EndGraphics        - Close graphics
SetBuffer          - Select render target
Flip               - Present frame
Cls                - Clear screen
```

**2D Drawing** (0 functions):

```
Plot               - Draw pixel
Rect               - Draw rectangle
Oval               - Draw ellipse
Line               - Draw line
Text               - Draw text
DrawImage          - Draw image
```

**Camera Control** (missing):

```
CameraZoom         - Set FOV/zoom
CameraClsMode      - Set clear mode
CameraClsColor     - Set clear color
CameraRange        - Set near/far planes
CameraProjMode     - Orthographic/perspective
```

**Rendering** (minimal):

```
RenderWorld        - Render 3D scene (basic version exists)
UpdateWorld        - Update animations/physics
ClearWorld         - Clear scene
CaptureWorld       - Screenshot
```

**Impact**: 🔴 **Critical blocker for games**

- Cannot load assets → cannot display game content
- No geometric primitives → cannot prototype
- Limited rendering control

---

### 3. Scene Graph / Entities

**Coverage**: 51/80 functions (64%) ✅ **Strongest Area**

#### ✅ Implemented (Swift Engine)

**Location**: `Sources/Blitz3DEngine/SceneGraph/`

**Entity Lifecycle** (3):

```
CreateEntity       - Instantiate entity
FreeEntity         - Destroy entity
EntityType         - Get/set type
```

**Transform** (11):

```
PositionEntity     - Set world position
RotateEntity       - Set world rotation
ScaleEntity        - Set world scale
MoveEntity         - Translate relative
TurnEntity         - Rotate relative
TranslateEntity    - Move in local space
PointEntity        - Orient toward target
EntityX/Y/Z        - Query position
EntityPitch/Yaw/Roll - Query rotation
```

**Appearance** (7):

```
EntityColor        - Set color tint
EntityAlpha        - Set transparency
EntityShininess    - Set specular power
EntityFX           - Set rendering flags
EntityTexture      - Assign texture
EntityBlend        - Set blend mode
PaintEntity        - Apply material
```

**Visibility** (4):

```
HideEntity         - Make invisible
ShowEntity         - Make visible
EntityHidden       - Query visibility
EntityInView       - Frustum culling check
```

**Camera** (3):

```
CreateCamera       - Create camera entity
CameraViewport     - Set viewport rect
CameraProject      - Project 3D→2D
```

**Lighting** (4):

```
CreateLight        - Create light entity
LightColor         - Set RGB color
LightRange         - Set attenuation
AmbientLight       - Set global ambient
```

**Fog** (4):

```
CameraFogMode      - Set fog type
CameraFogRange     - Set fog distances
CameraFogColor     - Set fog color
EntityFogEnabled   - Per-entity fog toggle
```

**Queries** (15):

```
EntityX/Y/Z        - World position
EntityPitch/Yaw/Roll - World rotation
EntityScaleX/Y/Z   - World scale
GetMatElement      - Matrix access
EntityDistance     - Distance between entities
DeltaPitch/Yaw     - Angle to target
```

**Strengths**:

- ✅ Comprehensive entity management
- ✅ Good transform API
- ✅ Solid rendering properties
- ✅ Well-designed scene graph

#### ❌ Missing (Blitz3D-NG)

**Entity Operations**:

```
CopyEntity         - Duplicate entity with children
NameEntity         - Assign string name
EntityName         - Query name
FindChild          - Search by name
CountChildren      - Query child count
GetChild           - Get child by index
```

**Camera Advanced**:

```
CameraZoom         - FOV/zoom control
CameraProjMode     - Ortho/perspective
CameraClsMode      - Clear mode
CameraClsColor     - Clear color
```

**Picking**:

```
EntityPick         - Ray cast from entity
CameraPick         - Ray cast from screen coords
PickedEntity       - Query last picked
PickedX/Y/Z        - Query pick position
PickedNX/NY/NZ     - Query pick normal
PickedSurface      - Query pick surface
PickedTriangle     - Query pick triangle
```

**Impact**: ⚠️ **Medium** - Core functionality present, advanced features
missing

---

### 4. Input System

**Coverage**: 13/60 functions (22%)

#### ✅ Implemented (Swift Engine)

**Location**: `Sources/Blitz3DEngine/Input/`

**Keyboard** (3):

```
KeyDown            - Query key state
KeyHit             - Query key press (one-frame)
FlushKeys          - Clear key buffer
```

**Mouse** (10):

```
MouseX             - Query X position
MouseY             - Query Y position
MouseZ             - Query wheel delta
MouseXSpeed        - Query X velocity
MouseYSpeed        - Query Y velocity
MouseDown          - Query button state
MouseHit           - Query button press
FlushMouse         - Clear mouse buffer
HideMouse          - Hide cursor
ShowMouse          - Show cursor
```

#### ❌ Missing (Blitz3D-NG)

**Location**: `reference/blitz3d-ng/src/modules/bb/input/commands.h`

**Keyboard**:

```
GetKey             - Read ASCII character
WaitKey            - Block until key pressed
```

**Joystick/Gamepad** (25 functions):

```
CountJoys          - Query joystick count
JoyDown            - Query button state
JoyHit             - Query button press
JoyX/Y/Z           - Query axis values
JoyU/V/R           - Additional axes
JoyXDir/YDir/ZDir  - Digital directions
JoyPitch/Yaw/Roll  - 3D controller orientation
JoyHat             - Query hat/D-pad
FlushJoy           - Clear joystick buffer
WaitJoy            - Block until joystick input
EnableDirectInput  - Windows DirectInput
```

**Impact**: ⚠️ **Low** - Keyboard/mouse sufficient for SCPCB

---

### 5. Audio System

**Coverage**: 3/32 functions (9%) ❌ **Minimal**

#### ✅ Implemented (Swift Engine)

**Location**: `Sources/Blitz3DEngine/Audio/`

```
LoadSound          - Load sound file
PlaySound          - Play sound (returns channel?)
FreeSound          - Release sound
```

#### ❌ Critical Missing (Blitz3D-NG)

**Location**: `reference/blitz3d-ng/src/modules/bb/audio/commands.h`

**Sound Management**:

```
Load3DSound        - Load positional sound
LoopSound          - Set looping
SoundPitch         - Set pitch multiplier
SoundVolume        - Set volume
SoundPan           - Set stereo pan
```

**Playback Control**:

```
PlayMusic          - Play music file
PlayCDTrack        - Play CD audio
StopChannel        - Stop sound channel
PauseChannel       - Pause channel
ResumeChannel      - Resume channel
```

**Channel Queries**:

```
ChannelPlaying     - Is channel active?
ChannelVolume      - Set channel volume
ChannelPan         - Set channel pan
ChannelPitch       - Set channel pitch
```

**3D Audio**:

```
EmitSound          - Play at entity position
UpdateListener     - Update 3D audio listener
Sound3D            - Set 3D sound mode
ChannelDistance    - Query distance to listener
```

**Impact**: 🟠 **High for atmosphere** - SCPCB uses ambient music and 3D
positional audio

---

### 6. Physics / Collision

**Coverage**: 15/100+ functions (15%)

#### ✅ Implemented (Swift Engine)

**Location**: `Sources/Blitz3DEngine/Physics/`

**World Setup** (1):

```
CreateCollisionWorld - Initialize collision system
```

**Entity Configuration** (3):

```
EntityType         - Set collision type
EntityBox          - Set box collider
EntityRadius       - Set sphere collider
```

**Collision Queries** (7):

```
EntityCollided     - Check if entity collided
CollisionX/Y/Z     - Query collision position
CollisionNX/NY/NZ  - Query collision normal
CollisionTime      - Query collision time
CollisionEntity    - Query other entity
CollisionSurface   - Query surface hit
```

**Advanced** (4):

```
LinePick           - Ray-triangle intersection
TFormedX           - Transform point to entity space
TFormedY           - Transform point to entity space
TFormedZ           - Transform point to entity space
```

**Strengths**:

- ✅ Ray casting implemented
- ✅ Basic collision detection
- ✅ Good query API

#### ❌ Critical Missing (Blitz3D-NG)

**Location**: `reference/blitz3d-ng/src/modules/bb/ode/commands.h`

**ODE Physics Engine** (80+ functions):

```
CreateWorld        - Initialize physics world
SetWorldGravity    - Set gravity vector
StepWorld          - Advance simulation

CreateBody         - Create rigid body
SetBodyPosition    - Position body
SetBodyRotation    - Orient body
AddBodyForce       - Apply force
AddBodyTorque      - Apply torque
SetBodyMass        - Set mass properties

CreateGeom         - Create collision shape
GeomCollide        - Test intersection
SetGeomPosition    - Position geom
FreeGeom           - Destroy geom

CreateJoint        - Create constraint
JointAttach        - Connect bodies
SetJointParameter  - Configure joint
GetJointParameter  - Query joint

CreateSpace        - Create collision space
SpaceCollide       - Broad-phase detection
```

**Impact**: 🟠 **High for realistic physics** - SCPCB uses collision but may not
need full dynamics

---

### 7. Animation

**Coverage**: 4/18 functions (22%)

#### ✅ Implemented (Swift Engine)

**Location**: `Sources/Blitz3DEngine/Animation/`

```
Animate            - Play animation
SetAnimTime        - Set animation frame
AnimSeq            - Query current sequence
AnimTime           - Query current time
```

#### ❌ Missing (Blitz3D-NG)

```
LoadAnimMesh       - Load animated mesh
AddAnimSeq         - Define animation sequence
ExtractAnimSeq     - Extract subsequence
AnimLength         - Query sequence length
Animating          - Is entity animating?
SetAnimKey         - Keyframe animation
LoadAnimSeqMD2     - Load MD2 animation
```

**Impact**: ⚠️ **Medium** - Basic animation works, sequences would be useful

---

### 8. File I/O

**Coverage**: 0/30 functions (0%) 🔴 **Missing Entirely**

#### ❌ Not Implemented

**Location**: `reference/blitz3d-ng/src/modules/bb/filesystem/commands.h`

**File Operations**:

```
OpenFile           - Open file for reading/writing
ReadFile           - Open for reading
WriteFile          - Open for writing
CloseFile          - Close file handle
FilePos            - Query position
SeekFile           - Set position
Eof                - End of file?

ReadByte           - Read byte
WriteByte          - Write byte
ReadShort          - Read i16
WriteShort         - Write i16
ReadInt            - Read i32
WriteInt           - Write i32
ReadFloat          - Read f32
WriteFloat         - Write f32
ReadString         - Read string
WriteString        - Write string
ReadLine           - Read text line
WriteLine          - Write text line
```

**Directory Operations**:

```
FileType           - Check file/dir/nothing
FileSize           - Query size in bytes
CurrentDir         - Get working directory
CreateDir          - Make directory
DeleteDir          - Remove directory
ChangeDir          - Set working directory
ReadDir            - Open directory
NextFile           - Iterate files
CloseDir           - Close directory
```

**Impact**: 🔴 **Critical blocker**

- SCPCB loads config files (`options.ini`)
- Cannot save games
- Cannot read data files

**Note**: TypeScript runtime may provide file I/O via browser APIs (FileSystem
API, virtual filesystem)

---

### 9. String Operations

**Coverage**: 0/28 functions (0%) 🔴 **Missing Entirely**

#### ❌ Not Implemented

**Location**: `reference/blitz3d-ng/src/modules/bb/string/commands.h`

```
Len                - String length
Mid                - Substring
Left               - Left N characters
Right              - Right N characters
Replace            - Find and replace
Instr              - Find substring index
Chr                - ASCII to character
Asc                - Character to ASCII
Upper              - Convert to uppercase
Lower              - Convert to lowercase
Trim               - Remove whitespace
LSet               - Pad left
RSet               - Pad right
String             - Repeat character
Hex                - Convert to hex string
Bin                - Convert to binary string
```

**Impact**: 🟠 **High for UI/parsing**

- SCPCB likely uses string manipulation for UI, config parsing
- Can be provided by TypeScript runtime or WASM standard library

---

### 10. Math Functions

**Coverage**: 0/29 functions (0%) 🔴 **Missing Entirely**

#### ❌ Not Implemented

**Location**: `reference/blitz3d-ng/src/modules/bb/math/commands.h`

**Trigonometry**:

```
Sin                - Sine
Cos                - Cosine
Tan                - Tangent
ASin               - Arcsine
ACos               - Arccosine
ATan               - Arctangent
ATan2              - Two-argument arctangent
```

**Arithmetic**:

```
Sqrt               - Square root
Sqr                - Square (x²)
Abs                - Absolute value
Sgn                - Sign (-1, 0, 1)
Floor              - Round down
Ceil               - Round up
Exp                - e^x
Log                - Natural log
Log10              - Base-10 log
```

**Random**:

```
Rand               - Random integer
Rnd                - Random float [0,1)
SeedRnd            - Seed RNG
```

**Other**:

```
Min                - Minimum
Max                - Maximum
Mod                - Modulo
```

**Impact**: 🔴 **Critical blocker**

- SCPCB uses trigonometry for transformations, camera control
- Missing Sqrt breaks distance calculations
- **Can be provided by WASM standard library** (faster than implementing in
  Swift)

---

### 11. System / Networking

**Coverage**: 0/45 functions (0%)

#### ❌ Not Implemented

**System** (`system/commands.h`):

```
MilliSecs          - Current time in ms
CurrentDate        - Get date string
CurrentTime        - Get time string
CommandLine        - Get program arguments
SystemProperty     - Query system info
GetEnv             - Read environment variable
SetEnv             - Set environment variable
RuntimeStats       - Profiling data
RuntimeError       - Trigger error
```

**Networking** (`sockets/commands.h`):

```
CreateTCPServer    - Listen for connections
CreateTCPSocket    - Connect to server
CreateUDPStream    - Open UDP socket
CloseTCPServer     - Close server
CloseTCPSocket     - Close socket
CloseUDPStream     - Close UDP
TCPAccept          - Accept connection
TCPConnect         - Connect to host
ReadTCPStream      - Read data
WriteTCPStream     - Write data
```

**Timers** (`timer/commands.h`):

```
CreateTimer        - Create timer
FreeTimer          - Destroy timer
WaitTimer          - Block until tick
```

**Impact**: ⚠️ **Low for SCPCB** (single-player game, no networking needed)

---

## Coverage Summary

| Category     | Implemented | Total    | Coverage | Priority | Status           |
| ------------ | ----------- | -------- | -------- | -------- | ---------------- |
| Scene Graph  | 51          | 80       | 64%      | P1       | ✅ Strong        |
| Memory/Banks | 11          | 30       | 37%      | P2       | ⚠️ Partial       |
| Graphics     | 44          | 150      | 29%      | P0       | ⚠️ Limited       |
| Input        | 13          | 60       | 22%      | P2       | ⚠️ Basic         |
| Animation    | 4           | 18       | 22%      | P2       | ⚠️ Basic         |
| Physics      | 15          | 100      | 15%      | P1       | ❌ Minimal       |
| Audio        | 3           | 32       | 9%       | P1       | ❌ Minimal       |
| File I/O     | 0           | 30       | 0%       | P0       | 🔴 Blocking      |
| Strings      | 0           | 28       | 0%       | P0       | 🔴 Blocking      |
| Math         | 0           | 29       | 0%       | P0       | 🔴 Blocking      |
| System       | 0           | 12       | 0%       | P3       | ⚠️ Low priority  |
| Networking   | 0           | 21       | 0%       | P3       | ⚠️ Low priority  |
| **TOTAL**    | **166**     | **~750** | **22%**  | -        | **Insufficient** |

---

## Strengths

✅ **Well-Designed Architecture**

- Clean modular structure
- Singleton managers
- Memory-safe operations

✅ **Strong Scene Graph** (64% coverage)

- Comprehensive entity management
- Good transform API
- Solid rendering properties

✅ **Good Foundation**

- Core mesh/surface operations
- Basic collision detection
- Ray-triangle intersection (LinePick)

✅ **Custom Features**

- B3D/RMesh parsers
- Command buffer system
- WASM-optimized design

---

## Critical Gaps (Blocking SCPCB)

🔴 **Asset Loading** (0 functions)

- No LoadMesh, LoadTexture, LoadImage
- Cannot load game content

🔴 **File I/O** (0/30 functions)

- Cannot read config files
- Cannot save/load games
- Cannot access data files

🔴 **Math Library** (0/29 functions)

- No trigonometry (Sin, Cos, Tan)
- No Sqrt (breaks distance calculations)
- No Floor, Ceil, Abs

🔴 **String Operations** (0/28 functions)

- Cannot parse strings
- Cannot build UI text
- Cannot format output

---

## Recommendations

### Priority 0 (Immediate)

1. Add math library (use WASM standard library)
2. Add string operations (use WASM std or TypeScript)
3. Implement asset loading (LoadMesh, LoadTexture, LoadImage)
4. Add file I/O (via TypeScript runtime + virtual filesystem)

### Priority 1 (Short term)

5. Expand audio system (channel management, 3D audio)
6. Add geometric primitives (CreateCube, CreateSphere, etc.)
7. Improve physics (may not need full ODE, but better collision)

### Priority 2 (Medium term)

8. Complete animation system (sequences)
9. Expand input (joystick support via Gamepad API)
10. Add missing entity operations (CopyEntity, naming, picking)

### Priority 3 (Long term)

11. System functions (timers, profiling)
12. Networking (if multiplayer desired)

---

## Next Document

See **04-critical-issues.md** for detailed breakdown of blocking issues.
