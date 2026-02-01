# Three.js Integration - Next Steps

## ✅ Completed

1. **Fixed Type Signatures** - Graphics functions now use f32 for coordinates
2. **Created Three.js Runtime** - `threejs-runtime.js` with full Blitz3D graphics API
3. **Added Module Import** - Runtime imported in demo-live.html

## 🔧 Remaining Work

### 1. Add Canvas Tab to UI

In demo-live.html, find the tabs section and add:
```html
<div class="tab" onclick="switchTab('canvas')">3D View</div>
```

And add the canvas content area:
```html
<div id="canvas-output" class="tab-content" style="background: #000;">
    <canvas id="renderCanvas" style="width: 100%; height: 100%;"></canvas>
</div>
```

### 2. Wire Graphics Functions to runWasm

In the `runWasm` function, add to the runtime imports object:

```javascript
// Graphics API
b3d_graphics3d: (w, h) => graphicsRuntime.graphics3d(w, h),
b3d_createcube: () => graphicsRuntime.createcube(),
b3d_createsphere: (s) => graphicsRuntime.createsphere(s),
b3d_createcamera: () => graphicsRuntime.createcamera(),
b3d_createlight: (t) => graphicsRuntime.createlight(t),
b3d_positionentity: (h, x, y, z) => graphicsRuntime.positionentity(h, x, y, z),
b3d_rotateentity: (h, p, y, r) => graphicsRuntime.rotateentity(h, p, y, r),
b3d_turnentity: (h, p, y, r) => graphicsRuntime.turnentity(h, p, y, r),
b3d_renderworld: () => graphicsRuntime.renderworld(),
b3d_flip: () => graphicsRuntime.flip(),
// ... add all other graphics functions
```

### 3. Initialize Graphics Runtime

Before the runtime imports, add:
```javascript
const canvas = document.getElementById('renderCanvas');
if (!graphicsRuntime) {
    graphicsRuntime = new window.Blitz3DGraphicsRuntime(canvas);
}
```

### 4. Handle Animation Loop

For While True loops, detect and use animation frame:
```javascript
// After WASM instantiation
if (compiledSource.includes('While True')) {
    // Auto-switch to canvas tab
    switchTab('canvas');
    
    // Start animation loop that calls main repeatedly
    graphicsRuntime.startAnimationLoop(() => {
        if (wasmInstance.instance.exports.main) {
            wasmInstance.instance.exports.main();
        }
    });
}
```

## 🎯 Testing

Once integrated, test with:
```blitz3d
Graphics3D 800, 600
cube = CreateCube()
camera = CreateCamera()
PositionEntity camera, 0, 0, -5

While True
    TurnEntity cube, 0.5, 1.0, 0.0
    RenderWorld
    Flip
Wend
```

Expected result: **Rotating green cube in 3D View tab!** 🎮

## 📊 Status

- ✅ Graphics API (33 functions) - Complete
- ✅ Type signatures fixed (f32) - Complete
- ✅ Three.js runtime class - Complete
- ⏳ UI integration - In progress
- ⏳ WASM runtime wiring - In progress
- ⏳ Animation loop handling - Pending

**Completion: 60%** 🎉
