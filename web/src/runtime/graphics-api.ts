/**
 * Graphics API abstraction layer for WebGPU/WebGL rendering
 * Provides unified interface for both modern (WebGPU) and fallback (WebGL 2) paths
 */

/// <reference lib="dom" />

// Handle types (opaque integers)
export type BufferHandle = number;
export type TextureHandle = number;
export type ShaderHandle = number;
export type RenderPassHandle = number;

// Enums
export enum BufferUsage {
    Vertex = 'vertex',
    Index = 'index',
    Uniform = 'uniform',
}

export enum TextureFormat {
    RGBA8 = 'rgba8',
    RGB8 = 'rgb8',
    Depth24Stencil8 = 'depth24stencil8',
}

export enum CompareFunction {
    Never = 'never',
    Less = 'less',
    Equal = 'equal',
    LessEqual = 'lequal',
    Greater = 'greater',
    NotEqual = 'notequal',
    GreaterEqual = 'gequal',
    Always = 'always',
}

export enum BlendMode {
    None = 'none',
    Alpha = 'alpha',
    Additive = 'additive',
    Multiply = 'multiply',
}

export enum CullMode {
    None = 'none',
    Front = 'front',
    Back = 'back',
}

// Capabilities
export interface GraphicsCapabilities {
    apiName: 'WebGPU' | 'WebGL2';
    maxTextureSize: number;
    maxVertexAttributes: number;
    maxUniformBuffers: number;
    supportsDepthTextures: boolean;
    supportsFloatTextures: boolean;
}

// Vertex format
export interface VertexAttribute {
    location: number;
    format: 'float32' | 'float32x2' | 'float32x3' | 'float32x4';
    offset: number;
}

export interface VertexLayout {
    stride: number;
    attributes: VertexAttribute[];
}

// Shader uniforms
export interface UniformValue {
    type: 'float' | 'vec2' | 'vec3' | 'vec4' | 'mat4';
    value: number | Float32Array;
}

// Main graphics API interface
export interface GraphicsAPI {
    // Initialization
    initialize(canvas: HTMLCanvasElement): Promise<void>;
    getCapabilities(): GraphicsCapabilities;
    
    // Frame management
    beginFrame(): void;
    endFrame(): void;
    
    // Buffer management
    createBuffer(data: ArrayBuffer, usage: BufferUsage): BufferHandle;
    updateBuffer(handle: BufferHandle, data: ArrayBuffer, offset?: number): void;
    destroyBuffer(handle: BufferHandle): void;
    
    // Texture management
    createTexture(
        width: number,
        height: number,
        format: TextureFormat,
        data?: ArrayBuffer
    ): TextureHandle;
    updateTexture(handle: TextureHandle, data: ArrayBuffer, level?: number): void;
    destroyTexture(handle: TextureHandle): void;
    
    // Shader management
    createShader(vertexCode: string, fragmentCode: string): ShaderHandle;
    useShader(handle: ShaderHandle): void;
    setUniform(name: string, value: UniformValue): void;
    destroyShader(handle: ShaderHandle): void;
    
    // Render state
    setViewport(x: number, y: number, width: number, height: number): void;
    setDepthTest(enabled: boolean, compareFunc?: CompareFunction): void;
    setBlendMode(mode: BlendMode): void;
    setCullMode(mode: CullMode): void;
    
    // Drawing operations
    clear(r: number, g: number, b: number, a: number, depth?: number): void;
    drawTriangles(
        vertexBuffer: BufferHandle,
        count: number,
        offset?: number
    ): void;
    drawIndexed(
        vertexBuffer: BufferHandle,
        indexBuffer: BufferHandle,
        count: number,
        offset?: number
    ): void;
    
    // Texture binding
    bindTexture(slot: number, handle: TextureHandle): void;
    
    // Vertex layout
    setVertexLayout(layout: VertexLayout): void;
}

// Factory function type
export type GraphicsAPIFactory = (canvas: HTMLCanvasElement) => Promise<GraphicsAPI>;

// Error types
export class GraphicsAPIError extends Error {
    constructor(message: string, public readonly apiName: string) {
        super(`[${apiName}] ${message}`);
        this.name = 'GraphicsAPIError';
    }
}

export class GraphicsNotSupportedError extends GraphicsAPIError {
    constructor(apiName: string) {
        super('Graphics API not supported in this browser', apiName);
        this.name = 'GraphicsNotSupportedError';
    }
}

// Utility: Convert typed arrays to ArrayBuffer
export function toArrayBuffer(data: Float32Array | Uint16Array | Uint32Array): ArrayBuffer {
    const buffer = data.buffer.slice(
        data.byteOffset,
        data.byteOffset + data.byteLength
    );
    return buffer as ArrayBuffer;
}

// Utility: Create vertex layout for standard mesh format
export function createStandardVertexLayout(): VertexLayout {
    return {
        stride: 32, // 3 (pos) + 3 (normal) + 2 (uv) = 8 floats = 32 bytes
        attributes: [
            { location: 0, format: 'float32x3', offset: 0 },  // position
            { location: 1, format: 'float32x3', offset: 12 }, // normal
            { location: 2, format: 'float32x2', offset: 24 }, // uv
        ],
    };
}
