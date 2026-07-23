# Phase 2: Graphics Migration from Three.js to WebGPU/WebGL

**Date**: February 1, 2026\
**Status**: Starting implementation

## Architecture Decisions

### Graphics API Strategy: WebGPU + WebGL Fallback

**Rationale**:

- WebGPU: Modern, performant, future-proof
- WebGL 2: Broad compatibility, fallback for older browsers
- Feature detection to choose at runtime

**Browser Support**:

- WebGPU: Chrome 113+, Safari 18+, Edge 113+
- WebGL 2: 95%+ browser support (everything modern)

### Swift Export Strategy: Hybrid Approach

**Command Buffer** (for batched operations):

- Mesh updates, texture uploads, large state changes
- Write once, batch execute
- Reduces WASM↔JS boundary crossings

**Direct Calls** (for immediate operations):

- Single draw calls, state queries
- Low-latency operations
- Real-time interactions

## Implementation Plan (6-8 hours)

### Step 1: Graphics API Abstraction Layer (2 hours)

**Create**: `web/src/runtime/graphics-api.ts`

```typescript
interface GraphicsAPI {
  // Initialization
  initialize(canvas: HTMLCanvasElement): Promise<void>;

  // Buffer management
  createBuffer(data: ArrayBuffer, usage: BufferUsage): BufferHandle;
  updateBuffer(handle: BufferHandle, data: ArrayBuffer): void;
  destroyBuffer(handle: BufferHandle): void;

  // Texture management
  createTexture(
    width: number,
    height: number,
    format: TextureFormat,
  ): TextureHandle;
  updateTexture(handle: TextureHandle, data: ArrayBuffer): void;
  destroyTexture(handle: TextureHandle): void;

  // Shader management
  createShader(vertexCode: string, fragmentCode: string): ShaderHandle;
  useShader(handle: ShaderHandle): void;

  // Drawing
  drawTriangles(vertexBuffer: BufferHandle, count: number): void;
  clear(r: number, g: number, b: number, a: number): void;

  // State
  setViewport(x: number, y: number, width: number, height: number): void;
  setDepthTest(enabled: boolean): void;

  // Queries
  getCapabilities(): GraphicsCapabilities;
}
```

**Implementations**:

- `WebGPUGraphics` - Modern GPU path
- `WebGLGraphics` - Fallback path

### Step 2: WebGPU Implementation (2-3 hours)

**Create**: `web/src/runtime/webgpu-graphics.ts`

Key features:

- Pipeline state objects
- Bind groups for textures/uniforms
- Command encoder for batching
- Render pass management

**Example**:

```typescript
class WebGPUGraphics implements GraphicsAPI {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private renderPipeline: GPURenderPipeline;
  
  async initialize(canvas: HTMLCanvasElement) {
    const adapter = await navigator.gpu?.requestAdapter();
    this.device = await adapter!.requestDevice();
    this.context = canvas.getContext('webgpu')!;
    // Configure swap chain, create pipelines...
  }
  
  drawTriangles(vertexBuffer: BufferHandle, count: number) {
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({...});
    pass.setPipeline(this.renderPipeline);
    pass.setVertexBuffer(0, this.getBuffer(vertexBuffer));
    pass.draw(count);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }
}
```

### Step 3: WebGL 2 Fallback (1-2 hours)

**Create**: `web/src/runtime/webgl-graphics.ts`

Simpler implementation:

- Vertex/fragment shaders
- VAO/VBO management
- Texture units
- State caching for performance

**Example**:

```typescript
class WebGLGraphics implements GraphicsAPI {
  private gl: WebGL2RenderingContext;
  private currentShader: WebGLProgram | null = null;

  async initialize(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext("webgl2")!;
    if (!this.gl) throw new Error("WebGL 2 not supported");
    // Set up extensions, state...
  }

  drawTriangles(vertexBuffer: BufferHandle, count: number) {
    const vbo = this.getBuffer(vertexBuffer);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, count);
  }
}
```

### Step 4: Feature Detection & Selection (30 min)

**Create**: `web/src/runtime/graphics-factory.ts`

```typescript
export async function createGraphicsAPI(
  canvas: HTMLCanvasElement,
): Promise<GraphicsAPI> {
  // Try WebGPU first
  if ("gpu" in navigator) {
    try {
      const api = new WebGPUGraphics();
      await api.initialize(canvas);
      console.log("✅ Using WebGPU");
      return api;
    } catch (e) {
      console.warn("WebGPU initialization failed, falling back to WebGL", e);
    }
  }

  // Fallback to WebGL 2
  const api = new WebGLGraphics();
  await api.initialize(canvas);
  console.log("✅ Using WebGL 2");
  return api;
}
```

### Step 5: Wire to Swift Engine (1-2 hours)

**Update**: `web/src/runtime/wasm-loader.ts`

Add graphics import handlers:

```typescript
const graphicsImports = {
  // Immediate operations (hybrid approach)
  js_Graphics3D: (width: number, height: number, depth: number) => {
    const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
    canvas.width = width;
    canvas.height = height;
    graphicsAPI = await createGraphicsAPI(canvas);
    return 1; // Success
  },

  js_ClearScreen: (r: number, g: number, b: number) => {
    graphicsAPI.clear(r / 255, g / 255, b / 255, 1.0);
  },

  js_RenderWorld: () => {
    // Execute command buffer if any
    executeCommandBuffer();
    // Swap buffers (implicit in WebGPU/WebGL)
  },

  // Command buffer operations
  js_PushDrawCommand: (meshHandle: number, transform: number) => {
    // Add to command buffer for batch execution
    commandBuffer.push({ type: "draw", mesh: meshHandle, transform });
  },
};
```

### Step 6: Basic Shaders (1 hour)

**Create**: `web/src/runtime/shaders/`

**WGSL (WebGPU)**:

```wgsl
// basic.wgsl
struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
  @location(2) uv: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) uv: vec2<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
  var out: VertexOutput;
  out.position = vec4<f32>(in.position, 1.0);
  out.normal = in.normal;
  out.uv = in.uv;
  return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(1.0, 1.0, 1.0, 1.0); // White for now
}
```

**GLSL (WebGL)**:

```glsl
// basic.vert
#version 300 es
in vec3 position;
in vec3 normal;
in vec2 uv;

out vec3 v_normal;
out vec2 v_uv;

void main() {
  gl_Position = vec4(position, 1.0);
  v_normal = normal;
  v_uv = uv;
}

// basic.frag
#version 300 es
precision mediump float;

in vec3 v_normal;
in vec2 v_uv;
out vec4 fragColor;

void main() {
  fragColor = vec4(1.0, 1.0, 1.0, 1.0);
}
```

### Step 7: Testing (1 hour)

**Update**: `web/src/runtime/graphics-api.test.ts`

```typescript
Deno.test("Graphics API: WebGPU initialization", async () => {
  // Mock canvas with OffscreenCanvas
  const canvas = new OffscreenCanvas(800, 600);

  if ("gpu" in navigator) {
    const api = new WebGPUGraphics();
    await api.initialize(canvas as any);

    const caps = api.getCapabilities();
    assertEquals(caps.maxTextureSize > 0, true);
  }
});

Deno.test("Graphics API: WebGL fallback", async () => {
  const canvas = new OffscreenCanvas(800, 600);
  const api = new WebGLGraphics();
  await api.initialize(canvas as any);

  const buffer = api.createBuffer(new Float32Array([0, 0, 0]), "vertex");
  assertEquals(typeof buffer, "number");
  api.destroyBuffer(buffer);
});
```

## Migration Strategy

### Remove Three.js Dependencies

1. Delete Three.js imports from `graphics.ts`
2. Remove Three.js from import map
3. Delete web-ide Three.js runtime (270 lines)

### Preserve Existing Code

- Keep command buffer system (`docs/COMMAND_BUFFER_SYSTEM.md`)
- Keep asset loaders (B3D, RMESH parsers in Swift)
- Keep VFS and file I/O

### Incremental Testing

1. Test basic triangle rendering
2. Test texture loading
3. Test mesh rendering
4. Test SCPCB assets

## Benefits of WebGPU/WebGL Direct Approach

### Performance

- **No scene graph overhead**: Three.js maintains scene graph we don't need
- **Direct GPU access**: Minimal abstraction
- **Better batching**: Control over draw call grouping
- **Faster uploads**: Direct buffer management

### Control

- **Custom culling**: Implement Blitz3D-specific optimizations
- **Shader control**: Write exactly what we need
- **Memory management**: Explicit GPU memory lifecycle

### Size

- **Smaller bundle**: Remove ~600KB Three.js library
- **Faster load**: Fewer dependencies to parse

## Risk Mitigation

### Complexity

- Start with basic rendering (triangles, textures)
- Add features incrementally
- Keep WebGL as tested fallback

### Browser Support

- Feature detection before WebGPU
- Graceful fallback to WebGL 2
- Error messages for unsupported browsers

### Debugging

- Expose graphics API in console (dev mode)
- Validation layers in debug builds
- Screenshot comparison tests

## Timeline

| Phase     | Task                   | Time      |
| --------- | ---------------------- | --------- |
| 2.1       | Graphics API interface | 2h        |
| 2.2       | WebGPU implementation  | 2-3h      |
| 2.3       | WebGL fallback         | 1-2h      |
| 2.4       | Feature detection      | 30m       |
| 2.5       | Swift engine wiring    | 1-2h      |
| 2.6       | Basic shaders          | 1h        |
| 2.7       | Testing                | 1h        |
| **Total** |                        | **8-11h** |

## Success Criteria

- [ ] WebGPU renders basic triangle
- [ ] WebGL fallback works
- [ ] Feature detection chooses correct API
- [ ] Can load and display SCPCB mesh
- [ ] Command buffer integration works
- [ ] No Three.js dependencies remain
- [ ] Tests pass for both APIs

## Next Session

Start with Step 1: Graphics API abstraction layer.

---

_Ready to proceed with migration from Three.js to WebGPU/WebGL!_
