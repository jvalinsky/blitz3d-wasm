# NPC Model Rendering Plan: Textures & Animation

## Current State

### What Works
- SMPK format loading (geometry, normals, UVs, bone weights)
- Static mesh display using `THREE.Mesh`
- Model switching in demo (after button re-enable fix)
- Basic node hierarchy reconstruction

### What's Broken/Missing
- **Textures**: Not loading or displaying
- **Skeletal Animation**: `THREE.SkinnedMesh` causes mesh distortion
- **Animation Playback**: `SetAnimTime`/`Animate` not functional in demo

---

## Part 1: Texture Support

### 1.1 Problem Analysis

The B3D converter (`Tools/convert_b3d_to_smpk.ts`) currently **does not export texture/material info**:
- B3D files contain `TEXS` (texture names) and `BRUS` (brushes with texture IDs)
- The converter parses these (`textures[]`, `brushes[]`) but doesn't include them in SMPK output
- SMPK JSON has `materials` field that supports `baseColorTexture`, but it's empty

### 1.2 Solution: Extend Converter

**File**: `Tools/convert_b3d_to_smpk.ts`

```typescript
// After building meshes[], add materials:
const materials = brushes.map((brush, i) => {
  const mat: any = {
    name: brush.name || `material_${i}`,
    color: brush.color,
    alpha: brush.alpha,
  };
  // Link texture if brush references one
  if (brush.texIds.length > 0 && brush.texIds[0] >= 0) {
    const texIdx = brush.texIds[0];
    if (textures[texIdx]) {
      mat.baseColorTexture = textures[texIdx].name;
    }
  }
  return mat;
});

// In JSON output:
const json: SmpkJson = {
  // ... existing fields ...
  materials,
};

// In mesh primitives, link material index:
meshes[0].primitives[0].material = mesh.brushId >= 0 ? mesh.brushId : undefined;
```

### 1.3 Runtime Texture Loading

**File**: `web/src/runtime/smpk.ts` - Already has texture loading logic:

```typescript
if (m.baseColorTexture) {
  loader.load(resolveAssetUrl(m.baseColorTexture), (t) => {
    mat.map = t;
    mat.needsUpdate = true;
  });
}
```

**Issue**: Texture paths in B3D are relative (e.g., `173texture.jpg`).
- `resolveAssetUrl()` tries to resolve relative to SMPK file location
- Textures need to be in same directory as SMPK or path needs adjustment

### 1.4 Tasks: Textures

1. [ ] Modify `Tools/convert_b3d_to_smpk.ts` to export materials/textures
2. [ ] Ensure texture files are copied alongside SMPK files
3. [ ] Test with SCP-173 (has `173texture.jpg`)
4. [ ] Add texture loading error handling/fallback

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

## Part 3: Demo Improvements

### 3.1 Current Demo Issues

- Toggle Animation button disabled
- Speed buttons non-functional
- No frame slider
- Model rotates automatically (distracting)

### 3.2 Proposed Demo Features

```html
<select id="modelSelect">...</select>
<button id="btnLoad">Load</button>
<input type="range" id="frameSlider" min="0" max="1000" value="0">
<span id="frameDisplay">Frame: 0</span>
<button id="btnPlay">Play</button>
<button id="btnPause">Pause</button>
<select id="animSeq">
  <option value="">All Frames</option>
  <!-- Populated from SMPK sequences -->
</select>
```

### 3.3 Tasks: Demo

1. [ ] Add frame slider for `SetAnimTime`
2. [ ] Display animation sequences from SMPK
3. [ ] Enable animation playback toggle
4. [ ] Remove auto-rotation when animation active
5. [ ] Show texture loading status

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
