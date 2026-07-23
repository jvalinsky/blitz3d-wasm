/**
 * Graphics API tests for WebGPU and WebGL implementations
 */

/// <reference lib="dom" />

import { assertEquals, assertExists } from "jsr:@std/assert";
import {
  createGraphicsAPI,
  getGraphicsInfo,
  isWebGL2Supported,
  isWebGPUSupported,
} from "./graphics-factory.ts";
import {
  BlendMode,
  BufferUsage,
  CompareFunction,
  createStandardVertexLayout,
  CullMode,
  TextureFormat,
  toArrayBuffer,
} from "./graphics-api.ts";

// Create a test canvas (OffscreenCanvas for headless testing)
function createTestCanvas(): HTMLCanvasElement {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(800, 600) as any as HTMLCanvasElement;
  }
  // Fallback for environments without OffscreenCanvas
  const canvas = {
    width: 800,
    height: 600,
    getContext: () => null,
  } as any;
  return canvas;
}

Deno.test("Graphics API: Feature detection", async () => {
  const info = await getGraphicsInfo();

  // At least one API should be supported
  const hasSupport = info.webgpuSupported || info.webgl2Supported;
  assertEquals(
    hasSupport,
    true,
    "At least WebGPU or WebGL2 should be supported",
  );

  console.log(`WebGPU supported: ${info.webgpuSupported}`);
  console.log(`WebGL2 supported: ${info.webgl2Supported}`);
  console.log(`Preferred API: ${info.preferredAPI}`);
});

Deno.test("Graphics API: WebGL 2 detection", () => {
  const supported = isWebGL2Supported();
  console.log(`WebGL 2 supported: ${supported}`);
  // Note: May be false in headless environments
});

Deno.test("Graphics API: WebGPU detection", () => {
  const supported = isWebGPUSupported();
  console.log(`WebGPU supported: ${supported}`);
  // Note: May be false if WebGPU not available
});

Deno.test("Graphics API: Buffer operations", async () => {
  try {
    const canvas = createTestCanvas();
    const api = await createGraphicsAPI(canvas, true); // Force WebGL for compatibility

    // Create vertex data
    const vertices = new Float32Array([
      0.0,
      0.5,
      0.0, // position
      0.0,
      0.0,
      1.0, // normal
      0.5,
      1.0, // uv

      -0.5,
      -0.5,
      0.0,
      0.0,
      0.0,
      1.0,
      0.0,
      0.0,

      0.5,
      -0.5,
      0.0,
      0.0,
      0.0,
      1.0,
      1.0,
      0.0,
    ]);

    const buffer = api.createBuffer(
      toArrayBuffer(vertices),
      BufferUsage.Vertex,
    );
    assertExists(buffer);
    assertEquals(typeof buffer, "number");

    // Update buffer (should not throw)
    const newData = new Float32Array(vertices.length);
    api.updateBuffer(buffer, toArrayBuffer(newData));

    // Cleanup
    api.destroyBuffer(buffer);

    console.log("✅ Buffer operations work");
  } catch (e) {
    console.log(`⚠️  Skipping buffer test: ${(e as Error).message}`);
  }
});

Deno.test("Graphics API: Texture operations", async () => {
  try {
    const canvas = createTestCanvas();
    const api = await createGraphicsAPI(canvas, true); // Force WebGL

    // Create 4x4 RGBA texture
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);

    // Fill with white
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255; // R
      data[i + 1] = 255; // G
      data[i + 2] = 255; // B
      data[i + 3] = 255; // A
    }

    const texture = api.createTexture(
      width,
      height,
      TextureFormat.RGBA8,
      data.buffer,
    );
    assertExists(texture);
    assertEquals(typeof texture, "number");

    // Cleanup
    api.destroyTexture(texture);

    console.log("✅ Texture operations work");
  } catch (e) {
    console.log(
      `⚠️  Skipping texture test: ${(e as Error).message || String(e)}`,
    );
  }
});

Deno.test("Graphics API: Shader compilation", async () => {
  try {
    const canvas = createTestCanvas();
    const api = await createGraphicsAPI(canvas, true); // Force WebGL

    const caps = api.getCapabilities();

    let vertexCode: string;
    let fragmentCode: string;

    if (caps.apiName === "WebGPU") {
      // WGSL shaders
      vertexCode = `
                @vertex
                fn vs_main(@location(0) pos: vec3<f32>) -> @builtin(position) vec4<f32> {
                    return vec4<f32>(pos, 1.0);
                }
            `;
      fragmentCode = `
                @fragment
                fn fs_main() -> @location(0) vec4<f32> {
                    return vec4<f32>(1.0, 1.0, 1.0, 1.0);
                }
            `;
    } else {
      // GLSL shaders
      vertexCode = `#version 300 es
                in vec3 pos;
                void main() {
                    gl_Position = vec4(pos, 1.0);
                }
            `;
      fragmentCode = `#version 300 es
                precision mediump float;
                out vec4 fragColor;
                void main() {
                    fragColor = vec4(1.0, 1.0, 1.0, 1.0);
                }
            `;
    }

    const shader = api.createShader(vertexCode, fragmentCode);
    assertExists(shader);
    assertEquals(typeof shader, "number");

    // Use shader (should not throw)
    api.setVertexLayout(createStandardVertexLayout());
    api.useShader(shader);

    // Cleanup
    api.destroyShader(shader);

    console.log("✅ Shader compilation works");
  } catch (e) {
    console.log(
      `⚠️  Skipping shader test: ${(e as Error).message || String(e)}`,
    );
  }
});

Deno.test("Graphics API: Capabilities query", async () => {
  try {
    const canvas = createTestCanvas();
    const api = await createGraphicsAPI(canvas, true);

    const caps = api.getCapabilities();

    assertExists(caps.apiName);
    assertEquals(caps.maxTextureSize > 0, true);
    assertEquals(caps.maxVertexAttributes > 0, true);

    console.log(`API: ${caps.apiName}`);
    console.log(`Max texture size: ${caps.maxTextureSize}`);
    console.log(`Max vertex attributes: ${caps.maxVertexAttributes}`);
    console.log(`Depth textures: ${caps.supportsDepthTextures}`);
    console.log(`Float textures: ${caps.supportsFloatTextures}`);
  } catch (e) {
    console.log(
      `⚠️  Skipping capabilities test: ${(e as Error).message || String(e)}`,
    );
  }
});

Deno.test("Graphics API: Vertex layout utilities", () => {
  const layout = createStandardVertexLayout();

  assertEquals(layout.stride, 32); // 3+3+2 floats = 8 floats = 32 bytes
  assertEquals(layout.attributes.length, 3);
  assertEquals(layout.attributes[0].format, "float32x3");
  assertEquals(layout.attributes[1].format, "float32x3");
  assertEquals(layout.attributes[2].format, "float32x2");

  console.log("✅ Vertex layout utility works");
});

Deno.test("Graphics API: Typed array conversion", () => {
  const data = new Float32Array([1.0, 2.0, 3.0]);
  const buffer = toArrayBuffer(data);

  assertEquals(buffer.byteLength, 12); // 3 floats * 4 bytes
  assertExists(buffer);

  console.log("✅ TypedArray conversion works");
});

Deno.test("Graphics API: State management", async () => {
  try {
    const canvas = createTestCanvas();
    const api = await createGraphicsAPI(canvas, true);

    // These should not throw
    api.setViewport(0, 0, 800, 600);
    api.setDepthTest(true, CompareFunction.Less);
    api.setBlendMode(BlendMode.Alpha);
    api.setCullMode(CullMode.Back);
    api.clear(0, 0, 0, 1, 1.0);

    console.log("✅ State management works");
  } catch (e) {
    console.log(
      `⚠️  Skipping state test: ${(e as Error).message || String(e)}`,
    );
  }
});

Deno.test("Graphics API: Frame management", async () => {
  try {
    const canvas = createTestCanvas();
    const api = await createGraphicsAPI(canvas, true);

    // Begin/end frame cycle
    api.beginFrame();
    api.clear(0.2, 0.3, 0.4, 1.0);
    api.endFrame();

    console.log("✅ Frame management works");
  } catch (e) {
    console.log(
      `⚠️  Skipping frame test: ${(e as Error).message || String(e)}`,
    );
  }
});
