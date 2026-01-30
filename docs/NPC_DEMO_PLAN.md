# NPC Model Rendering Plan: Textures & Animation

## Current State

### What Works
- SMPK format loading (geometry, normals, UVs, bone weights)
- Static mesh display using `THREE.Mesh`
- Model switching with auto-scaling and orientation fix
- **Textures**: Full support - baseColor, normal, specular, emissive, lightmap
- **Brush Properties**: shininess→roughness, blendMode→alphaMode, FX flags
- **Multi-texturing**: texIds[0-7] mapped to detail/cube textures
- SCPCB-style lighting (brightness 140/255, warm flashlight, ceiling light)
- Camera controls: orbit, free, flashlight modes with view presets (1-6)
- Auto-detect normal/specular maps by texture name patterns

### What's Broken/Missing
- **Skeletal Animation**: `THREE.SkinnedMesh` causes mesh distortion
- **Animation Playback**: `SetAnimTime`/`Animate` not functional in demo

---

## Part 1: Texture Support (COMPLETED)

### 1.1 B3D to SMPK Material Export

The converter (`Tools/convert_b3d_to_smpk.ts`) now exports all brush properties:

| B3D Brush Field | SMPK Material Field | Notes |
|-----------------|---------------------|-------|
| name | name | Brush name |
| color[0-2] | color | RGB, defaults to white |
| alpha | alpha | 0-1, defaults to 1.0 |
| shininess | roughness, shininess | 1-shininess = roughness |
| blend | blendMode | B3D blend mode 0-7 |
| fx | fx | FX_* flags |
| texIds[0] | baseColorTexture | Diffuse/albedo |
| texIds[1] | detailTexture | Mapped to roughnessMap |
| texIds[2-3] | detailTexture2/3 | Logged, requires custom shader |
| texIds[7] | cubeTexture | Environment map, logged |

### 1.2 Auto-Detected Textures

Demo auto-detects textures based on base texture name patterns:

| Base Texture | Auto-Detected |
|--------------|---------------|
| 173texture.jpg | 173_Norm.jpg, 173_Spec.jpg |

Suffixes tried: `_Norm`, `_normal`, `_N`, `_Spec`, `_spec`, `_S`

### 1.3 Tasks: Textures

1. [x] Modify converter to export materials/textures - DONE
2. [x] Ensure texture files are in same directory - DONE
3. [x] Test with SCP-173 (173texture.jpg + 173_Norm.jpg + 173_Spec.jpg) - DONE
4. [x] Add texture loading error handling/fallback - DONE

---

## Part 5: Brush Properties (NEW)

### 5.1 Shininess to Roughness Mapping

B3D shininess is 0-1 where:
- 0 = no specular (matte)
- 1 = sharp specular (shiny)

Three.js roughness is inverted:
- roughness = 1 - shininess

```typescript
// From convert_b3d_to_smpk.ts
if (brush.shininess > 0 && brush.shininess < 1) {
  mat.shininess = brush.shininess;
  mat.roughness = 1 - brush.shininess;
} else if (brush.shininess >= 1) {
  mat.roughness = 0.05;  // Very shiny
} else {
  mat.roughness = 0.9;   // Very rough
}
```

### 5.2 Blend Mode to Alpha Mode

B3D blend modes:
| Value | Name | SMPK alphaMode | Three.js Behavior |
|-------|------|----------------|-------------------|
| 0 | NONE | OPAQUE | transparent=false, depthWrite=true |
| 1 | ALPHA | BLEND | transparent=true, depthWrite=false |
| 2 | ADD | BLEND | transparent=true, additive blending |
| 3 | MASK | MASK | alphaTest=0.5, depthWrite=true |
| 4 | MUL | OPAQUE | Multiplicative, handled as opaque |

```typescript
// From web/src/runtime/smpk.ts
if (!alphaMode && m.blendMode !== undefined) {
  if (m.blendMode === 1 || m.blendMode === 2) {
    alphaMode = "BLEND";
  } else if (m.blendMode === 3) {
    alphaMode = "MASK";
  }
}
```

### 5.3 FX Flags

B3D FX flags are bitmasks stored in `fx` field:
- Logged for debugging: `log(\`FX flags: 0x\${m.fx.toString(16)}\`)`
- Full implementation requires parsing individual bits

### 5.4 Multi-Texture Slots

B3D brushes support up to 8 textures via `texIds[]`:
- texIds[0]: Base/diffuse texture (baseColorTexture)
- texIds[1-3]: Detail textures (detailTexture, detailTexture2, detailTexture3)
- texIds[4-6]: Reserved
- texIds[7]: Environment/cube map (cubeTexture)

Detail textures 2-3 and cube textures require custom shaders (not loaded by standard MeshStandardMaterial).

---

## Part 2: Skeletal Animation

### 2.1 Problem Analysis

Current `THREE.SkinnedMesh` binding causes mesh distortion because:

1. **Bind pose not applied**: Three.js requires skeleton to be in bind pose when `mesh.bind()` is called
2. **Inverse bind matrices**: May be computed incorrectly or not applied properly
3. **Bone hierarchy**: Bones need proper parent-child relationships established before binding

### 2.2 How SCPCB Does Animation

From `NPCs.bb` and `Main.bb`:

```blitz
; Load animated mesh
n\obj = LoadAnimMesh_Strict("GFX\npcs\guard.b3d")

; Set to specific frame (for static pose)
SetAnimTime(n\obj, 107)

; Animate between frames
Function AnimateNPC(n.NPCs, start#, quit#, speed#, loop=True)
  newTime = n\Frame + speed * FPSfactor
  If loop And newTime >= quit Then newTime = start
  SetAnimTime n\obj, newTime
  n\Frame = newTime
End Function

; Example usage:
AnimateNPC(n, 284, 333, n\CurrSpeed*43)  ; Walk animation frames 284-333
```

**Key insight**: Blitz3D animations are frame-based, not time-based. The runtime needs to:
1. Convert frame numbers to time (using FPS from SMPK)
2. Sample the animation at that time
3. Apply bone transforms

### 2.3 Solution: Fix SkinnedMesh Binding

**Option A: Compute proper bind pose (complex)**

Requires:
- Computing world transforms for all bones at frame 0
- Setting bone positions/rotations to match
- Creating skeleton with correct inverse bind matrices
- Calling `mesh.bind(skeleton)` after setup

**Option B: Use regular Mesh + manual bone transforms (simpler)**

For each frame:
1. Compute bone world transforms from animation data
2. Apply transforms to vertices on CPU
3. Update geometry buffer

**Option C: Hybrid - SkinnedMesh with pose reset**

```typescript
// After creating SkinnedMesh and binding:
const action = mixer.clipAction(clip);
action.play();
action.time = 0; // Frame 0 = bind pose
mixer.update(0); // Apply bind pose

// For SetAnimTime:
const setAnimTime = (entity, frame) => {
  const fps = entity.userData.fps || 30;
  const action = entity.userData.action;
  action.time = frame / fps;
  entity.userData.mixer.update(0);
};
```

### 2.4 Tasks: Animation

1. [ ] Investigate why SkinnedMesh distorts (compare inverse bind matrices)
2. [ ] Implement Option C (pose reset approach)
3. [ ] Add `SetAnimTime` implementation to demo
4. [ ] Add `Animate` loop mode support
5. [ ] Test with guard.smpk (has 38s of animation)

---

## Part 3: Demo Improvements (COMPLETED)

### 3.1 Lighting (SCPCB-Style)

Implemented in `npc_smpk_demo.html`:

| Setting | Value | Source |
|---------|-------|--------|
| Brightness | 140/255 (0.55) | SCPCB options.ini default |
| Ambient | Color(0.55, 0.55, 0.55) | Gray ambient |
| Flashlight | SpotLight(0xfff5e0, 8, 20, PI/5, 0.4, 1.5) | Warm white, held position |
| Room Light | PointLight(0xfff5e0, 1.5, 12, 1.5) | Ceiling lamp |
| Fog | FogExp2(0x0a0a12, 0.035) | Dark corridor atmosphere |
| Tone Mapping | ACESFilmic, exposure 0.7 | Dramatic falloff |

### 3.2 Camera Controls (IMPLEMENTED)

| Input | Action |
|-------|--------|
| WASD/Arrows | Move camera (free mode) or orbit target |
| Q/E | Move up/down (free mode) |
| Right-drag | Orbit around model |
| Left-drag | Aim flashlight |
| Scroll | Zoom (orbit mode) |
| 1-6 | View presets: front/back/top/side/close/feet |
| M | Cycle modes: Free → Orbit → Flashlight |
| R | Reset view |
| SPACE | Toggle NPC auto-rotation |

Camera modes:
- **Free**: WASD movement, mouse look for flashlight
- **Orbit**: Right-drag to rotate around model, scroll to zoom
- **Flashlight**: Left-drag to aim flashlight beam

### 3.3 Model Auto-Scaling

Models are scaled to similar visual size based on bounding box:

```typescript
// From npc_smpk_demo.html
const targetRadius = Math.max(ORBIT_MIN, Math.min(ORBIT_MAX, maxDim * 0.35));
```

Reference: SCP-173 maxDim=22.15 → orbitRadius=7

### 3.4 Tasks: Demo

1. [x] SCPCB-style lighting - DONE
2. [x] Camera controls (orbit/free/flashlight modes) - DONE
3. [x] View presets (1-6) - DONE
4. [x] Auto-rotation toggle (SPACE) - DONE
5. [x] Texture loading status - DONE (loading manager)
6. [x] Model auto-scaling and orientation fix - DONE
7. [x] Auto-detect normal/specular textures - DONE

---

## Part 4: Integration with Full Runtime

### 4.1 Current Runtime Architecture

```
WASM (BB code) → imports.env.LoadAnimMesh → smpkLoader.loadFile
                → imports.env.SetAnimTime → animationSystem.setAnimTime
                → imports.env.Animate → animationSystem.animate
```

### 4.2 Required Changes

**File**: `web/src/runtime/animation.ts`

```typescript
setAnimTime(entityId: number, frame: number, seq: number) {
  const entity = this.graphics.entities[entityId];
  if (!entity?.userData.mixer) return;
  
  const fps = entity.userData.fps || 30;
  const action = entity.userData.action;
  
  if (seq > 0 && entity.userData.sequences) {
    // Handle sequence-relative frame
    const seqInfo = entity.userData.sequences[seq - 1];
    if (seqInfo) {
      frame = seqInfo.firstFrame + frame;
    }
  }
  
  action.time = frame / fps;
  entity.userData.mixer.update(0);
}
```

**File**: `web/src/runtime/graphics.ts`

Update render loop to tick all animation mixers:

```typescript
RenderWorld(tween) {
  const dt = this.clock.getDelta();
  
  // Update all animation mixers
  for (const mixer of this.animMixers) {
    mixer.update(dt);
  }
  
  this.renderer.render(this.scene, this.camera);
}
```

---

## Implementation Order

### Phase 1: Textures (Easiest)
1. Modify converter to export materials
2. Re-convert NPC models
3. Deploy and test

### Phase 2: Static Pose (Medium)
1. Fix SkinnedMesh binding with bind pose
2. Implement SetAnimTime for demo
3. Add frame slider to demo

### Phase 3: Animation Playback (Complex)
1. Implement Animate() with loop modes
2. Add mixer.update() to render loop
3. Test with walking guard animation

### Phase 4: Full Integration
1. Connect to WASM runtime
2. Test with actual SCPCB NPCs.bb code
3. Handle edge cases (CopyEntity, etc.)

---

## Test Models

| Model | Skeleton | Animation | Textures | Priority |
|-------|----------|-----------|----------|----------|
| 173_2.smpk | No | No | 173texture.jpg | High |
| guard.smpk | 34 bones | 38s | Multiple | High |
| scp-939.smpk | Yes | Yes | Yes | Medium |
| scp-049.smpk | Yes | Yes | Yes | Medium |
| classd.smpk | Yes | Yes | Yes | Low |

---

## References

- SCPCB source: `/home/exedev/Software/scpcb/NPCs.bb`, `Main.bb`
- B3D parser: `Tools/b3d/parse.ts`
- SMPK converter: `Tools/convert_b3d_to_smpk.ts`
- SMPK loader: `web/src/runtime/smpk.ts`
- Animation system: `web/src/runtime/animation.ts`
- Demo: `web/public/npc_smpk_demo.html`
