/**
 * Entry point for graphics test bundle
 * Re-exports everything needed by test pages
 */

// Graphics API
export {
  BlendMode,
  BufferUsage,
  CompareFunction,
  createStandardVertexLayout,
  CullMode,
  type GraphicsAPI,
  TextureFormat,
  toArrayBuffer,
  type VertexAttribute,
  type VertexLayout,
} from "./graphics-api.ts";

export {
  createGraphicsAPI,
  getGraphicsInfo,
  isWebGL2Supported,
  isWebGPUSupported,
} from "./graphics-factory.ts";

// WASM Loader
export { loadBlitz3DEngine, type LoadedEngine } from "./wasm-loader.ts";

// String helper
export { WasmStringHelper } from "./wasm-string-helper.ts";

// Camera
export { Camera } from "./camera.ts";
export { SimpleCamera } from "./camera-simple.ts";

// SMPK loader
export { loadSMPK, type SMPKMesh } from "./smpk-simple.ts";

// Types
export type {
  Blitz3DEngineExports,
  Blitz3DEngineImports,
} from "./wasm-types.ts";

console.log("✅ Graphics test bundle loaded");
