# Plan 07 — Animation Playback (Frame-Based, Skeletal)

Created: 2026-01-30
Last updated: 2026-01-30

Goal: Implement frame-based skeletal animation playback in demo and runtime with proper bind pose handling.

---

## 7.1 Frame-Based Animation System

### 7.1.1 FPS Handling

Use model-specific FPS from SMPK `animations[].fps` field. Fall back to 30fps if missing.

### 7.1.2 Frame↔Time Conversion

```typescript
// Frame to Time
const time = frame / fps;

// Time to Frame (for display)
const frame = Math.round(time * fps);
```

Example (guard.smpk, fps=30):
```
Frame 284 → time 9.47s (start of walk)
Frame 333 → time 11.10s (end of walk)
```

### 7.1.3 Animation Sequences (SCPCB)

From SCPCB NPCs.bb:
| Animation | Frames | Duration | Notes |
|-----------|--------|----------|-------|
| Idle | 0-107 | 3.57s | Standing still |
| Walk | 284-333 | 1.63s | 49 frames |
| Run | 334-377 | 1.43s | 43 frames |

---

## 7.2 SkinnedMesh Bind Pose Fix

### 7.2.1 Problem

```typescript
// Current code causes distortion:
const sm = new THREE.SkinnedMesh(geo, mat);
sm.bind(skeleton);  // Bones NOT in bind pose → distorted mesh
```

### 7.2.2 Solution

Apply frame 0 transforms before binding:

```typescript
// web/src/runtime/smpk.ts (~line 416)

const mixer = new THREE.AnimationMixer(root);
const clips = root.animations || [];
if (clips.length > 0) {
  // Apply bind pose (frame 0) before creating SkinnedMesh
  const bindAction = mixer.clipAction(clips[0]);
  bindAction.time = 0;
  mixer.update(0);  // Bones now in bind pose
  
  const sm = new THREE.SkinnedMesh(geo, mat);
  sm.bind(skeleton);  // Correct: bones posed
}
```

---

## 7.3 Animation Modes (SCPCB-Compatible)

| Mode | Value | Three.js | Notes |
|------|-------|----------|-------|
| Stop | 0 | action.stop() | Freezes at current frame |
| Loop | 1 | LoopRepeat | Repeats from start |
| PingPong | 2 | LoopPingPong | Back-and-forth |
| OneShot | 3 | LoopOnce | Plays once, stops at end |

```typescript
function setAnimationMode(action, mode) {
  switch(mode) {
    case 0:  // Stop
      action.stop();
      break;
    case 1:  // Loop
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      break;
    case 2:  // PingPong
      action.setLoop(THREE.LoopPingPong, Infinity);
      action.play();
      break;
    case 3:  // OneShot
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      break;
  }
}
```

---

## 7.4 Demo Implementation

### 7.4.1 HTML Additions

```html
<!-- npc_smpk_demo.html -->
<div id="animControls" style="display:none; margin-top: 10px;">
  <select id="clipSelect">
    <option value="0">Walk</option>
    <!-- Populated from SMPK clips -->
  </select>
  
  <input type="range" id="frameSlider" min="0" max="1000" value="0" step="0.1" style="width: 300px;">
  <span id="frameDisplay">Frame: 0 / 1000 (0.00s)</span>
  
  <button id="btnPlay">▶ Play</button>
  <button id="btnPause">⏸ Pause</button>
  
  <select id="speedSelect">
    <option value="0.25">0.25x</option>
    <option value="0.5">0.5x</option>
    <option value="1.0" selected>1.0x</option>
    <option value="2.0">2.0x</option>
  </select>
  
  <select id="seqSelect">
    <option value="-1">All Frames</option>
    <!-- Populated from SMPK sequences -->
  </select>
</div>
```

### 7.4.2 Clip Loading

```typescript
if (json.animations && json.animations.length > 0) {
  const anim = json.animations[0];
  const fps = anim.fps || 30;
  
  // Populate clip dropdown
  const clipSelect = document.getElementById('clipSelect');
  clipSelect.innerHTML = '';
  if (anim.clips) {
    anim.clips.forEach((clip, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = clip.name || `Clip ${idx + 1}`;
      clipSelect.appendChild(opt);
    });
  } else {
    const opt = document.createElement('option');
    opt.value = 0;
    opt.textContent = 'default';
    clipSelect.appendChild(opt);
  }
  
  // Update slider max
  const duration = anim.duration || 1;
  const maxFrame = Math.round(duration * fps);
  document.getElementById('frameSlider').max = maxFrame;
  document.getElementById('animControls').style.display = 'block';
  
  // Populate sequences
  if (anim.sequences) {
    const seqSelect = document.getElementById('seqSelect');
    anim.sequences.forEach((seq, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = `${seq.name}: ${seq.firstFrame}-${seq.lastFrame}`;
      seqSelect.appendChild(opt);
    });
  }
}
```

### 7.4.3 Frame Slider Handler

```typescript
document.getElementById('frameSlider').addEventListener('input', (e) => {
  const frame = parseFloat(e.target.value);
  const time = frame / fps;
  
  if (npcAction) {
    npcAction.time = time;
    mixer.update(0);
  }
  
  document.getElementById('frameDisplay').textContent = 
    `Frame: ${frame.toFixed(1)} / ${maxFrame} (${time.toFixed(2)}s)`;
});
```

### 7.4.4 Play/Pause Toggle

```typescript
document.getElementById('btnPlay').addEventListener('click', () => {
  if (isPlaying) {
    npcAction?.stop();
    document.getElementById('btnPlay').textContent = '▶ Play';
  } else {
    npcAction?.play();
    document.getElementById('btnPlay').textContent = '⏸ Pause';
  }
  isPlaying = !isPlaying;
});
```

### 7.4.5 Speed Control

```typescript
document.getElementById('speedSelect').addEventListener('change', (e) => {
  const speed = parseFloat(e.target.value);
  npcAction?.setEffectiveTimeScale(speed);
});
```

### 7.4.6 Clip Selection

```typescript
document.getElementById('clipSelect').addEventListener('change', (e) => {
  const clipIdx = parseInt(e.target.value);
  const clips = root.animations || [];
  if (clips[clipIdx]) {
    const newAction = mixer.clipAction(clips[clipIdx]);
    npcAction?.stop();
    npcAction = newAction;
    npcAction.play();
  }
});
```

---

## 7.5 Runtime Integration

### 7.5.1 Entry Points

| WASM Function | JS Handler |
|---------------|------------|
| `LoadAnimMesh(path$)` | `animation.loadAnimMesh` |
| `SetAnimTime(entity, time, seq)` | `animation.setAnimTime` |
| `Animate(entity, mode, speed, seq, trans)` | `animation.animate` |

### 7.5.2 Render Loop Update

```typescript
// web/src/runtime/graphics.ts
const dt = this.clock.getDelta();
for (const mixer of this.animMixers) {
  mixer.update(dt);
}
```

### 7.5.3 Animation Events

```typescript
action.getMixer().addEventListener('finished', (e) => {
  this.core.events.emit('AnimFinished', { entityId: entity.id });
});
```

---

## 7.6 Testing

| Model | Test | Expected |
|-------|------|----------|
| guard.smpk | Walk animation | No distortion |
| scp-049.smpk | OneShot | Plays once, stops |
| scp-939.smpk | Clip selection | Multiple clips |
| 173_2.smpk | No animation | Loads without error |

---

## 7.7 Files Modified

```
web/public/npc_smpk_demo.html
web/src/runtime/smpk.ts
web/src/runtime/animation.ts
web/src/runtime/graphics.ts
web/src/runtime/core.ts
```

---

## 7.8 Acceptance Criteria

- [ ] Guard model plays walking animation without distortion
- [ ] Frame slider scrubbing works (with decimals)
- [ ] Play/Pause toggles animation
- [ ] Speed control works
- [ ] Clip selection works
- [ ] All 4 animation modes work
- [ ] AnimFinished callback fires
- [ ] SCP-173 still works
