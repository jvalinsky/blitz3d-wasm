# Thin Runtime Implementation Plan

## Goal

Create a minimal JavaScript runtime (~500 lines) that only provides browser API bindings.
All game logic runs in compiled BB -> WASM.

## Phase 1: Identify Core Primitives

Analyzing SCPCB's Particles.bb, we need these Blitz3D functions:

### Graphics Primitives (Three.js)
```
CreateSprite()      -> new THREE.Sprite()
CreatePivot()       -> new THREE.Object3D()
PositionEntity()    -> obj.position.set(x, y, z)
RotateEntity()      -> obj.rotation.set(pitch, yaw, roll)
MoveEntity()        -> obj.translateZ(z)
TranslateEntity()   -> obj.position.add(vec)
ScaleSprite()       -> sprite.scale.set(w, h, 1)
EntityX/Y/Z()       -> obj.position.x/y/z
EntityAlpha()       -> material.opacity = a
EntityBlend()       -> material.blending = mode
EntityFX()          -> material flags
EntityTexture()     -> material.map = texture
SpriteViewMode()    -> billboard mode
FreeEntity()        -> scene.remove(obj)
```

### Math (Native JS)
```
Rnd(lo, hi)         -> Math.random() * (hi - lo) + lo
Min(a, b)           -> Math.min(a, b)
Max(a, b)           -> Math.max(a, b)
```

### Type System (WASM internal)
```
New Type            -> allocate memory
Delete              -> free memory
For Each            -> iterate linked list
Field access        -> memory offset
```

## Phase 2: Minimal Runtime Structure

```javascript
// thin-runtime.js - ~500 lines total

class ThinRuntime {
    constructor(canvas) {
        this.canvas = canvas;
        this.entities = new Map();  // id -> Three.js object
        this.nextId = 1;
        
        // Three.js setup
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, w/h, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({canvas});
    }
    
    getImports() {
        return {
            env: {
                // ~50 essential functions
                CreateSprite: () => this.createSprite(),
                CreatePivot: () => this.createPivot(),
                PositionEntity: (e,x,y,z) => this.positionEntity(e,x,y,z),
                // ... etc
            }
        };
    }
    
    createSprite() {
        const sprite = new THREE.Sprite();
        const id = this.nextId++;
        this.entities.set(id, sprite);
        this.scene.add(sprite);
        return id;
    }
    
    // ... ~40 more simple methods
}
```

## Phase 3: Implementation Order

### Step 1: Core Entity System (Day 1)
- [ ] CreatePivot, CreateSprite, CreateMesh
- [ ] PositionEntity, RotateEntity, ScaleEntity
- [ ] EntityX, EntityY, EntityZ, EntityPitch, EntityYaw, EntityRoll
- [ ] FreeEntity, HideEntity, ShowEntity
- [ ] EntityParent

### Step 2: Sprite/Particle Support (Day 1)
- [ ] ScaleSprite, SpriteViewMode
- [ ] EntityAlpha, EntityBlend, EntityFX
- [ ] EntityTexture, EntityColor

### Step 3: Camera & Rendering (Day 2)
- [ ] CreateCamera, CameraRange, CameraZoom
- [ ] CameraViewport, CameraProjMode
- [ ] CreateLight, LightColor, LightRange
- [ ] RenderWorld, Flip, Cls

### Step 4: Textures (Day 2)
- [ ] LoadTexture, FreeTexture
- [ ] TextureWidth, TextureHeight
- [ ] CreateTexture

### Step 5: Input (Day 3)
- [ ] KeyDown, KeyHit
- [ ] MouseX, MouseY, MouseDown, MouseHit
- [ ] MoveMouse, HidePointer, ShowPointer

### Step 6: Audio (Day 3)
- [ ] LoadSound, FreeSound
- [ ] PlaySound, StopChannel
- [ ] ChannelVolume, ChannelPan

### Step 7: File I/O (Day 4)
- [ ] OpenFile, CloseFile, ReadFile, WriteFile
- [ ] ReadInt, ReadFloat, ReadString, ReadByte
- [ ] WriteInt, WriteFloat, WriteString
- [ ] Eof, FileSize, SeekFile

### Step 8: Math (Native - already done)
- [x] Sin, Cos, Tan, ASin, ACos, ATan, ATan2
- [x] Sqr, Abs, Floor, Ceil, Exp, Log
- [x] Rnd, Rand, SeedRnd
- [x] Min, Max

## Phase 4: Test with Particles.bb

```bash
# Compile
blitz3d-wasm particles_standalone.bb -o particles.wasm

# Run in browser with thin runtime
<script src="thin-runtime.js"></script>
<script>
const runtime = new ThinRuntime(canvas);
const imports = runtime.getImports();
const {instance} = await WebAssembly.instantiate(wasmBytes, imports);
instance.exports.Main();

// Game loop
function loop() {
    instance.exports.UpdateParticles();
    runtime.render();
    requestAnimationFrame(loop);
}
loop();
</script>
```

## Phase 5: Scale Up

Once particles work, add:
1. MapSystem.bb - room loading
2. Items.bb - inventory 
3. NPCs.bb - AI
4. UpdateEvents.bb - triggers

## File Sizes Comparison

| Component | Current | Target |
|-----------|---------|--------|
| runtime.js | 603 | - |
| graphics.js | 2327 | 400 |
| physics.js | 552 | 100 |
| audio.js | 366 | 150 |
| input.js | 158 | 100 |
| fileio.js | 611 | 200 |
| rmesh.js | 869 | 0 (WASM) |
| b3d.js | 876 | 0 (WASM) |
| room.js | 347 | 0 (WASM) |
| **Total JS** | **11095** | **~1000** |

## Success Criteria

1. Particles.bb runs correctly in browser
2. JS runtime < 1000 lines
3. All particle logic in WASM
4. 60 FPS with 100 particles
