/**
 * Entry point for graphics test bundle
 * Re-exports everything needed by test pages
 */

// Graphics API
export { 
    type GraphicsAPI,
    type VertexLayout,
    type VertexAttribute,
    BufferUsage,
    TextureFormat,
    CompareFunction,
    BlendMode,
    CullMode,
    createStandardVertexLayout,
    toArrayBuffer,
} from './graphics-api.ts';

export {
    createGraphicsAPI,
    isWebGPUSupported,
    isWebGL2Supported,
    getGraphicsInfo,
} from './graphics-factory.ts';

// WASM Loader
export {
    loadBlitz3DEngine,
    type LoadedEngine,
} from './wasm-loader.ts';

// String helper
export { WasmStringHelper } from './wasm-string-helper.ts';

// Camera
export { Camera } from './camera.ts';
export { SimpleCamera } from './camera-simple.ts';

// SMPK loader
export { loadSMPK, type SMPKMesh } from './smpk-simple.ts';

// Types
export type {
    Blitz3DEngineExports,
    Blitz3DEngineImports,
} from './wasm-types.ts';

console.log('✅ Graphics test bundle loaded');
