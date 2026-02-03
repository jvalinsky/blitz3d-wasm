# Phase 3: SCPCB Integration - Detailed Plan
**Date**: February 1, 2026  
**Status**: Planning  
**Estimated Time**: 12-16 hours

---

## Overview

Phase 3 focuses on integrating the complete graphics system with SCPCB game assets and achieving first playable demo in browser.

**Goals**:
1. Render first 3D triangle in browser
2. Load and display SCPCB mesh
3. Implement camera controls
4. Get basic game scene rendering
5. Initial gameplay loop working

---

## Phase 3A: Basic Rendering (3-4 hours)

### Step 3A.1: Create Simple Test Page (1 hour)
**File**: `web/test-graphics.html`

**Tasks**:
- Create minimal HTML with canvas
- Load WASM engine with canvas parameter
- Initialize graphics API
- Draw single triangle

**Code Structure**:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Graphics Test</title>
</head>
<body>
    <canvas id="game-canvas" width="800" height="600"></canvas>
    <script type="module">
        import { loadBlitz3DEngine } from './dist/wasm-loader.js';
        import { createStandardVertexLayout } from './dist/graphics-api.js';
        
        const canvas = document.getElementById('game-canvas');
        const engine = await loadBlitz3DEngine('./dist/blitz3d-engine.wasm', canvas);
        
        // Test triangle rendering
        // ...
    </script>
</body>
</html>
```

**Success Criteria**:
- [ ] Canvas displays in browser
- [ ] Graphics API initializes (WebGPU or WebGL)
- [ ] Console shows API selection
- [ ] No JavaScript errors

---

### Step 3A.2: Triangle Rendering Test (1-2 hours)

**Tasks**:
1. Create vertex buffer with triangle data
2. Load basic shaders from files
3. Set up render loop
4. Draw triangle on screen

**Implementation**:
```typescript
// Create triangle vertices (position, normal, uv)
const vertices = new Float32Array([
    // x,    y,    z,   nx,   ny,   nz,   u,    v
    0.0,   0.5,  0.0,  0.0,  0.0,  1.0,  0.5,  1.0,  // top
   -0.5,  -0.5,  0.0,  0.0,  0.0,  1.0,  0.0,  0.0,  // bottom-left
    0.5,  -0.5,  0.0,  0.0,  0.0,  1.0,  1.0,  0.0,  // bottom-right
]);

const vbo = graphicsAPI.createBuffer(vertices.buffer, BufferUsage.Vertex);
graphicsAPI.setVertexLayout(createStandardVertexLayout());

// Load and compile shaders
const vertCode = await fetch('./shaders/basic.vert').then(r => r.text());
const fragCode = await fetch('./shaders/basic.frag').then(r => r.text());
const shader = graphicsAPI.createShader(vertCode, fragCode);

// Render loop
function render() {
    graphicsAPI.beginFrame();
    graphicsAPI.clear(0.2, 0.3, 0.4, 1.0);
    graphicsAPI.useShader(shader);
    graphicsAPI.drawTriangles(vbo, 3);
    graphicsAPI.endFrame();
    requestAnimationFrame(render);
}
render();
```

**Success Criteria**:
- [ ] White triangle visible on blue background
- [ ] No WebGPU/WebGL errors in console
- [ ] Render loop running at 60 FPS
- [ ] Works in both Chrome (WebGPU) and Firefox (WebGL)

**Debugging Checklist**:
- Check browser console for errors
- Verify shader compilation succeeded
- Validate vertex buffer creation
- Confirm vertex layout matches shader inputs
- Use browser DevTools to inspect WebGPU/WebGL calls

---

### Step 3A.3: Add Camera Transform (1 hour)

**Tasks**:
1. Implement basic camera matrix
2. Add uniform buffer for MVP matrix
3. Update shaders to use transforms
4. Add mouse controls for camera rotation

**Camera Implementation**:
```typescript
class Camera {
    position: [number, number, number] = [0, 0, -5];
    rotation: [number, number] = [0, 0]; // pitch, yaw
    
    getViewMatrix(): Float32Array {
        // Calculate view matrix from position + rotation
        // Return 4x4 matrix as Float32Array
    }
    
    getProjectionMatrix(aspect: number): Float32Array {
        // Perspective projection
        // FOV 60°, near 0.1, far 1000
    }
    
    handleMouseMove(dx: number, dy: number) {
        this.rotation[0] += dy * 0.01; // pitch
        this.rotation[1] += dx * 0.01; // yaw
    }
}
```

**Updated Shaders**:
```glsl
// Vertex shader (GLSL)
uniform mat4 u_mvp;
in vec3 position;

void main() {
    gl_Position = u_mvp * vec4(position, 1.0);
}
```

**Success Criteria**:
- [ ] Triangle transforms with camera
- [ ] Mouse drag rotates view
- [ ] Perspective projection working
- [ ] No matrix math errors

---

## Phase 3B: Asset Loading (4-5 hours)

### Step 3B.1: SCPCB Asset Preparation (1 hour)

**Tasks**:
1. Locate SCPCB mesh files in `/Users/jack/Software/scp_port/scpcb`
2. Identify simplest test mesh (door, room section)
3. Convert to SMPK format if needed
4. Verify file structure

**Asset Candidates**:
- `GFX/map/room1archive/room1archive.rmesh` - Simple room
- `GFX/map/door01.x` - Basic door
- `GFX/map/camerapanel.x` - Small prop

**Commands**:
```bash
# Find SCPCB meshes
find /Users/jack/Software/scp_port/scpcb -name "*.rmesh" | head -5
find /Users/jack/Software/scp_port/scpcb -name "*.x" | head -5
find /Users/jack/Software/scp_port/scpcb -name "*.b3d" | head -5

# Check if SMPK converter exists
ls -la Tools/smpk-converter/
```

**Success Criteria**:
- [ ] Located test mesh files
- [ ] Mesh files accessible
- [ ] Conversion tool ready (if needed)

---

### Step 3B.2: Implement Mesh Loader (2-3 hours)

**File**: `web/src/runtime/mesh-loader.ts`

**Tasks**:
1. Read mesh file format (RMesh or B3D)
2. Parse vertices, indices, normals, UVs
3. Create GPU buffers
4. Store mesh metadata

**RMesh Parser** (if using RMesh format):
```typescript
interface Mesh {
    vertices: Float32Array;  // Interleaved pos+normal+uv
    indices: Uint16Array;
    materialId: number;
}

async function loadRMesh(path: string): Promise<Mesh> {
    const data = await fetch(path).then(r => r.arrayBuffer());
    const view = new DataView(data);
    
    // RMesh format:
    // - Header: "RMesh" magic (5 bytes)
    // - Vertex count (4 bytes)
    // - Triangle count (4 bytes)
    // - Vertices: [x, y, z, nx, ny, nz, u, v] * count
    // - Indices: [i0, i1, i2] * triCount
    
    let offset = 5; // Skip "RMesh"
    const vertexCount = view.getUint32(offset, true); offset += 4;
    const triangleCount = view.getUint32(offset, true); offset += 4;
    
    const vertices = new Float32Array(vertexCount * 8);
    for (let i = 0; i < vertexCount * 8; i++) {
        vertices[i] = view.getFloat32(offset, true);
        offset += 4;
    }
    
    const indices = new Uint16Array(triangleCount * 3);
    for (let i = 0; i < triangleCount * 3; i++) {
        indices[i] = view.getUint16(offset, true);
        offset += 2;
    }
    
    return { vertices, indices, materialId: 0 };
}
```

**B3D Parser** (if using B3D format):
```typescript
// Use existing Swift B3D parser in WASM engine
// Call wasm_LoadMesh() and get handle
// Query vertex/index data via WASM exports

async function loadB3DMesh(engine: LoadedEngine, path: string): Promise<number> {
    return engine.helpers.callWithString(
        (ptr) => engine.exports.wasm_LoadMesh(ptr, 0),
        path
    );
}
```

**Success Criteria**:
- [ ] Mesh file loads without errors
- [ ] Vertex data parsed correctly
- [ ] Index buffer populated
- [ ] Console logs vertex/triangle count

---

### Step 3B.3: Render SCPCB Mesh (1 hour)

**Tasks**:
1. Load test mesh
2. Create GPU buffers from mesh data
3. Render in place of triangle
4. Add basic lighting

**Integration**:
```typescript
// Load mesh
const mesh = await loadRMesh('./scpcb/room1archive.rmesh');

// Create GPU resources
const vbo = graphicsAPI.createBuffer(
    mesh.vertices.buffer,
    BufferUsage.Vertex
);
const ibo = graphicsAPI.createBuffer(
    mesh.indices.buffer,
    BufferUsage.Index
);

// Render loop
function render() {
    graphicsAPI.beginFrame();
    graphicsAPI.clear(0.2, 0.3, 0.4, 1.0);
    graphicsAPI.useShader(shader);
    graphicsAPI.drawIndexed(vbo, ibo, mesh.indices.length);
    graphicsAPI.endFrame();
    requestAnimationFrame(render);
}
```

**Basic Lighting Shader**:
```glsl
// Fragment shader
in vec3 v_normal;
out vec4 fragColor;

void main() {
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    float diffuse = max(dot(normalize(v_normal), lightDir), 0.0);
    vec3 color = vec3(0.8) * (0.3 + 0.7 * diffuse); // ambient + diffuse
    fragColor = vec4(color, 1.0);
}
```

**Success Criteria**:
- [ ] SCPCB mesh visible in browser
- [ ] Lighting shows mesh shape
- [ ] Camera rotation works
- [ ] No rendering glitches

---

## Phase 3C: Game Loop Integration (3-4 hours)

### Step 3C.1: SCPCB Main Compilation (1 hour)

**Tasks**:
1. Compile SCPCB Main.bb to WASM
2. Verify all includes load
3. Check function exports
4. Validate no missing runtime functions

**Commands**:
```bash
# Compile Main.bb
.build/release/blitz3d-wasm \
    /Users/jack/Software/scp_port/scpcb/Main.bb \
    -o web/dist/scpcb.wasm \
    --verbose

# Validate output
wasm-validate web/dist/scpcb.wasm
wasm2wat web/dist/scpcb.wasm | grep "(export" | head -20
```

**Expected Output**:
- WASM file ~500KB-2MB
- Exports: Main(), UpdateGame(), RenderGame(), etc.
- No compilation errors
- All includes resolved

**Troubleshooting**:
- Missing functions → Add to Swift engine
- Include errors → Check search paths
- Type errors → Verify type inference
- Stack overflow → Increase linker stack size

**Success Criteria**:
- [ ] Main.bb compiles successfully
- [ ] WASM validates
- [ ] Game functions exported
- [ ] Reasonable file size (<5MB)

---

### Step 3C.2: Create Game Harness (2 hours)

**File**: `web/scpcb-demo.html`

**Tasks**:
1. Load both engine WASM and game WASM
2. Initialize graphics before game starts
3. Call game Main() function
4. Set up update/render loop

**Harness Structure**:
```typescript
// Load engine
const engine = await loadBlitz3DEngine(
    './dist/blitz3d-engine.wasm',
    canvas
);

// Load game code
const gameWasm = await fetch('./dist/scpcb.wasm').then(r => r.arrayBuffer());
const gameModule = await WebAssembly.compile(gameWasm);
const gameInstance = await WebAssembly.instantiate(gameModule, {
    env: {
        // Link to engine functions
        CreateMesh: engine.exports.wasm_CreateMesh,
        LoadTexture: engine.exports.wasm_LoadTexture,
        // ... all other game imports
    }
});

// Game loop
let lastTime = performance.now();

function gameLoop() {
    const now = performance.now();
    const dt = (now - lastTime) / 1000; // Delta in seconds
    lastTime = now;
    
    // Update game logic
    gameInstance.exports.UpdateGame?.(dt);
    
    // Render
    graphicsAPI.beginFrame();
    gameInstance.exports.RenderGame?.();
    graphicsAPI.endFrame();
    
    requestAnimationFrame(gameLoop);
}

// Start game
gameInstance.exports.Main?.();
gameLoop();
```

**Challenges**:
- **Blocking loops**: SCPCB may have `While True` loops
  - **Solution**: Restructure to per-frame update
  - **Alternative**: Use SharedArrayBuffer + Worker
  
- **Synchronous file I/O**: `OpenFile()` blocks
  - **Solution**: Preload all assets in VFS
  - **Alternative**: Async file API with Asyncify

- **Init sequence**: Game expects "press any key"
  - **Solution**: Auto-inject synthetic key event
  - **Alternative**: Skip launcher, jump to Main()

**Success Criteria**:
- [ ] Game WASM loads
- [ ] Main() function calls
- [ ] No import errors
- [ ] Game loop runs

---

### Step 3C.3: Debug and Fix Issues (1-2 hours)

**Common Issues**:

1. **Missing Runtime Functions**
   - Error: `WebAssembly.LinkError: import object field 'funcName' is not a Function`
   - Solution: Add stub or implement function
   
2. **Stack Overflow**
   - Error: `RuntimeError: memory access out of bounds`
   - Solution: Increase stack size in linker flags
   
3. **Blocking Loops**
   - Symptom: Browser hangs, no rendering
   - Solution: Restructure game loop or use Workers
   
4. **File I/O Failures**
   - Error: File not found, access denied
   - Solution: Preload to VFS, check paths

**Debugging Tools**:
```typescript
// Enable verbose logging
const DEBUG = true;

// Wrap all WASM imports with logging
function wrapImport(name: string, fn: Function) {
    return (...args: any[]) => {
        if (DEBUG) console.log(`[WASM] ${name}(${args.join(', ')})`);
        const result = fn(...args);
        if (DEBUG) console.log(`[WASM] ${name} -> ${result}`);
        return result;
    };
}

// Apply to all imports
const wrappedEnv = {};
for (const [name, fn] of Object.entries(env)) {
    wrappedEnv[name] = wrapImport(name, fn);
}
```

**Success Criteria**:
- [ ] All runtime imports satisfied
- [ ] No WASM errors in console
- [ ] Game progresses past init
- [ ] Rendering starts

---

## Phase 3D: Polish and Optimization (2-3 hours)

### Step 3D.1: Performance Profiling (1 hour)

**Tasks**:
1. Measure frame times
2. Identify bottlenecks
3. Check memory usage
4. Verify no leaks

**Profiling Code**:
```typescript
class PerformanceMonitor {
    frameTimes: number[] = [];
    
    startFrame() {
        this.frameStart = performance.now();
    }
    
    endFrame() {
        const time = performance.now() - this.frameStart;
        this.frameTimes.push(time);
        
        if (this.frameTimes.length > 60) {
            const avg = this.frameTimes.reduce((a, b) => a + b) / 60;
            const fps = 1000 / avg;
            console.log(`FPS: ${fps.toFixed(1)}, Frame: ${avg.toFixed(2)}ms`);
            this.frameTimes = [];
        }
    }
}
```

**Chrome DevTools**:
- Performance tab → Record
- Look for long tasks (>16ms)
- Check JavaScript heap size
- Verify GPU memory usage

**Success Criteria**:
- [ ] 60 FPS on desktop
- [ ] <16ms frame time
- [ ] No memory leaks
- [ ] Reasonable GPU usage (<500MB)

---

### Step 3D.2: Error Handling (1 hour)

**Tasks**:
1. Add try-catch around WASM calls
2. Display user-friendly errors
3. Graceful degradation
4. Recovery mechanisms

**Error Display**:
```typescript
function showError(message: string, details?: string) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #f44; color: white; padding: 20px; border-radius: 8px;
        font-family: monospace; max-width: 600px;
    `;
    errorDiv.innerHTML = `
        <h2>❌ Error</h2>
        <p>${message}</p>
        ${details ? `<pre>${details}</pre>` : ''}
        <button onclick="location.reload()">Reload</button>
    `;
    document.body.appendChild(errorDiv);
}

window.addEventListener('error', (e) => {
    showError('JavaScript Error', e.message);
});

window.addEventListener('unhandledrejection', (e) => {
    showError('Promise Rejection', e.reason);
});
```

**Success Criteria**:
- [ ] Errors display to user
- [ ] Stack traces logged
- [ ] Reload button works
- [ ] No silent failures

---

### Step 3D.3: Documentation (1 hour)

**Files to Create**:

1. **`docs/BROWSER_DEMO.md`** - How to run demo
2. **`web/README.md`** - Web runtime docs
3. **`TROUBLESHOOTING.md`** - Common issues

**Browser Demo Docs**:
```markdown
# Running SCPCB in Browser

## Quick Start

1. Build the project:
   ```bash
   swift build -c release
   deno task web:build
   ```

2. Start web server:
   ```bash
   deno task web:serve
   ```

3. Open browser:
   ```
   http://localhost:8000/scpcb-demo.html
   ```

## Controls

- **WASD**: Move camera
- **Mouse**: Look around
- **Esc**: Pause menu
- **E**: Interact

## Browser Support

- ✅ Chrome 113+ (WebGPU)
- ✅ Firefox 100+ (WebGL 2)
- ✅ Safari 18+ (WebGPU)
- ⚠️  Safari 17 (WebGL 2 only)

## Troubleshooting

See TROUBLESHOOTING.md
```

**Success Criteria**:
- [ ] Docs complete
- [ ] Setup instructions tested
- [ ] Screenshots added
- [ ] Troubleshooting guide

---

## Risk Mitigation

### High Risk Items

1. **SCPCB Blocking Loops** (HIGH)
   - **Risk**: `While True` blocks browser
   - **Mitigation**: 
     - Use Workers + SharedArrayBuffer
     - Restructure loops to yield
     - Add frame budget (16ms max)
   
2. **File I/O Synchronous** (HIGH)
   - **Risk**: `OpenFile()` can't block in browser
   - **Mitigation**:
     - Preload all files to VFS
     - Use manifest for required files
     - Implement async file API
   
3. **Memory Usage** (MEDIUM)
   - **Risk**: WASM + GPU memory → OOM
   - **Mitigation**:
     - Monitor memory usage
     - Implement texture streaming
     - Free unused resources

4. **Missing Runtime Functions** (MEDIUM)
   - **Risk**: Game calls unimplemented function
   - **Mitigation**:
     - Audit all SCPCB calls
     - Implement stubs that log
     - Progressive enhancement

### Low Risk Items

1. **Performance** - WebGPU is fast, unlikely bottleneck
2. **Browser Support** - WebGL 2 fallback covers >95%
3. **Graphics Bugs** - Comprehensive tests written

---

## Success Criteria (Phase 3)

### Minimum Viable Demo (MVP)
- [ ] Triangle renders in browser
- [ ] SCPCB mesh loads and displays
- [ ] Camera rotation with mouse
- [ ] Basic lighting visible
- [ ] 30+ FPS on desktop

### Full Demo
- [ ] Game Main() executes
- [ ] Multiple meshes render
- [ ] Player movement working
- [ ] Textures loading
- [ ] 60 FPS stable

### Stretch Goals
- [ ] Full gameplay loop
- [ ] Menu system functional
- [ ] Save/load working
- [ ] Mobile support

---

## Timeline

| Phase | Tasks | Time |
|-------|-------|------|
| 3A | Basic rendering | 3-4h |
| 3B | Asset loading | 4-5h |
| 3C | Game integration | 3-4h |
| 3D | Polish | 2-3h |
| **Total** | | **12-16h** |

**Optimistic**: 12 hours  
**Realistic**: 14 hours  
**Pessimistic**: 18 hours (with major issues)

---

## Next Session Checklist

Before starting Phase 3:
- [ ] Review this plan
- [ ] Ensure Phase 1-2 tests still pass
- [ ] Verify WASM builds correctly
- [ ] Check browser DevTools setup
- [ ] Prepare SCPCB asset directory

**First Task**: Step 3A.1 - Create test page

---

*Plan created: February 1, 2026*  
*Ready to execute: YES ✅*
