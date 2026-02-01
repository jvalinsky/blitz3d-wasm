/**
 * WebGL 2 graphics implementation
 * Fallback renderer for browsers without WebGPU support
 */

/// <reference lib="dom" />

import type {
    GraphicsAPI,
    BufferHandle,
    TextureHandle,
    ShaderHandle,
    BufferUsage,
    TextureFormat,
    CompareFunction,
    BlendMode,
    CullMode,
    GraphicsCapabilities,
    VertexLayout,
    UniformValue,
} from './graphics-api.ts';
import { GraphicsAPIError, GraphicsNotSupportedError } from './graphics-api.ts';

export class WebGLGraphics implements GraphicsAPI {
    private gl!: WebGL2RenderingContext;
    
    // Resource tracking
    private buffers = new Map<BufferHandle, WebGLBuffer>();
    private textures = new Map<TextureHandle, WebGLTexture>();
    private programs = new Map<ShaderHandle, WebGLProgram>();
    
    private nextHandle = 1;
    
    // Current state
    private currentProgram: WebGLProgram | null = null;
    private currentShader: ShaderHandle | null = null;
    private currentVertexLayout: VertexLayout | null = null;
    
    async initialize(canvas: HTMLCanvasElement): Promise<void> {
        // Try to get WebGL 2 context
        this.gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
        if (!this.gl) {
            throw new GraphicsNotSupportedError('WebGL2');
        }
        
        // Enable common extensions
        this.gl.getExtension('EXT_color_buffer_float');
        this.gl.getExtension('OES_texture_float_linear');
        
        // Set default state
        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthFunc(this.gl.LESS);
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(this.gl.BACK);
        
        console.log('✅ WebGL 2 initialized successfully');
    }
    
    getCapabilities(): GraphicsCapabilities {
        return {
            apiName: 'WebGL2',
            maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
            maxVertexAttributes: this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS),
            maxUniformBuffers: this.gl.getParameter(this.gl.MAX_UNIFORM_BUFFER_BINDINGS),
            supportsDepthTextures: true,
            supportsFloatTextures: this.gl.getExtension('OES_texture_float') !== null,
        };
    }
    
    beginFrame(): void {
        // WebGL doesn't require explicit frame begin
    }
    
    endFrame(): void {
        // WebGL presents automatically
    }
    
    createBuffer(data: ArrayBuffer, usage: BufferUsage): BufferHandle {
        const handle = this.nextHandle++;
        const buffer = this.gl.createBuffer();
        
        if (!buffer) {
            throw new GraphicsAPIError('Failed to create buffer', 'WebGL2');
        }
        
        // Map usage to GL buffer usage
        const target = usage === 'index' ? this.gl.ELEMENT_ARRAY_BUFFER : this.gl.ARRAY_BUFFER;
        
        this.gl.bindBuffer(target, buffer);
        this.gl.bufferData(target, data, this.gl.STATIC_DRAW);
        this.gl.bindBuffer(target, null);
        
        this.buffers.set(handle, buffer);
        return handle;
    }
    
    updateBuffer(handle: BufferHandle, data: ArrayBuffer, offset = 0): void {
        const buffer = this.buffers.get(handle);
        if (!buffer) {
            throw new GraphicsAPIError(`Buffer ${handle} not found`, 'WebGL2');
        }
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset, data);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    }
    
    destroyBuffer(handle: BufferHandle): void {
        const buffer = this.buffers.get(handle);
        if (buffer) {
            this.gl.deleteBuffer(buffer);
            this.buffers.delete(handle);
        }
    }
    
    createTexture(
        width: number,
        height: number,
        format: TextureFormat,
        data?: ArrayBuffer
    ): TextureHandle {
        const handle = this.nextHandle++;
        const texture = this.gl.createTexture();
        
        if (!texture) {
            throw new GraphicsAPIError('Failed to create texture', 'WebGL2');
        }
        
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        
        // Map format
        let internalFormat: number;
        let glFormat: number;
        let type: number;
        
        switch (format) {
            case 'rgba8':
                internalFormat = this.gl.RGBA8;
                glFormat = this.gl.RGBA;
                type = this.gl.UNSIGNED_BYTE;
                break;
            case 'rgb8':
                internalFormat = this.gl.RGB8;
                glFormat = this.gl.RGB;
                type = this.gl.UNSIGNED_BYTE;
                break;
            case 'depth24stencil8':
                internalFormat = this.gl.DEPTH24_STENCIL8;
                glFormat = this.gl.DEPTH_STENCIL;
                type = this.gl.UNSIGNED_INT_24_8;
                break;
            default:
                internalFormat = this.gl.RGBA8;
                glFormat = this.gl.RGBA;
                type = this.gl.UNSIGNED_BYTE;
        }
        
        // Upload data
        this.gl.texImage2D(
            this.gl.TEXTURE_2D,
            0,
            internalFormat,
            width,
            height,
            0,
            glFormat,
            type,
            data ? new Uint8Array(data) : null
        );
        
        // Set default filtering
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        
        this.textures.set(handle, texture);
        return handle;
    }
    
    updateTexture(handle: TextureHandle, data: ArrayBuffer, level = 0): void {
        const texture = this.textures.get(handle);
        if (!texture) {
            throw new GraphicsAPIError(`Texture ${handle} not found`, 'WebGL2');
        }
        
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        // Note: This requires knowing the texture dimensions, format, etc.
        // For now, we'll assume RGBA8
        // In production, we'd store texture metadata
        console.warn('updateTexture implementation incomplete - needs texture metadata');
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }
    
    destroyTexture(handle: TextureHandle): void {
        const texture = this.textures.get(handle);
        if (texture) {
            this.gl.deleteTexture(texture);
            this.textures.delete(handle);
        }
    }
    
    createShader(vertexCode: string, fragmentCode: string): ShaderHandle {
        const handle = this.nextHandle++;
        
        // Compile vertex shader
        const vs = this.gl.createShader(this.gl.VERTEX_SHADER);
        if (!vs) throw new GraphicsAPIError('Failed to create vertex shader', 'WebGL2');
        
        this.gl.shaderSource(vs, vertexCode);
        this.gl.compileShader(vs);
        
        if (!this.gl.getShaderParameter(vs, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(vs);
            this.gl.deleteShader(vs);
            throw new GraphicsAPIError(`Vertex shader compilation failed: ${error}`, 'WebGL2');
        }
        
        // Compile fragment shader
        const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        if (!fs) throw new GraphicsAPIError('Failed to create fragment shader', 'WebGL2');
        
        this.gl.shaderSource(fs, fragmentCode);
        this.gl.compileShader(fs);
        
        if (!this.gl.getShaderParameter(fs, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(fs);
            this.gl.deleteShader(vs);
            this.gl.deleteShader(fs);
            throw new GraphicsAPIError(`Fragment shader compilation failed: ${error}`, 'WebGL2');
        }
        
        // Link program
        const program = this.gl.createProgram();
        if (!program) throw new GraphicsAPIError('Failed to create program', 'WebGL2');
        
        this.gl.attachShader(program, vs);
        this.gl.attachShader(program, fs);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            const error = this.gl.getProgramInfoLog(program);
            this.gl.deleteShader(vs);
            this.gl.deleteShader(fs);
            this.gl.deleteProgram(program);
            throw new GraphicsAPIError(`Program linking failed: ${error}`, 'WebGL2');
        }
        
        // Cleanup shaders (they're now part of the program)
        this.gl.deleteShader(vs);
        this.gl.deleteShader(fs);
        
        this.programs.set(handle, program);
        return handle;
    }
    
    useShader(handle: ShaderHandle): void {
        const program = this.programs.get(handle);
        if (!program) {
            throw new GraphicsAPIError(`Shader ${handle} not found`, 'WebGL2');
        }
        
        this.gl.useProgram(program);
        this.currentProgram = program;
        this.currentShader = handle;
        
        // Set up vertex attributes if layout is set
        if (this.currentVertexLayout) {
            this.setupVertexAttributes();
        }
    }
    
    private setupVertexAttributes(): void {
        if (!this.currentProgram || !this.currentVertexLayout) return;
        
        for (const attr of this.currentVertexLayout.attributes) {
            const location = attr.location;
            this.gl.enableVertexAttribArray(location);
            
            // Parse format (e.g., "float32x3" -> 3 components)
            const components = attr.format === 'float32' ? 1 :
                             attr.format === 'float32x2' ? 2 :
                             attr.format === 'float32x3' ? 3 : 4;
            
            this.gl.vertexAttribPointer(
                location,
                components,
                this.gl.FLOAT,
                false,
                this.currentVertexLayout.stride,
                attr.offset
            );
        }
    }
    
    setUniform(name: string, value: UniformValue): void {
        if (!this.currentProgram) {
            throw new GraphicsAPIError('No shader set', 'WebGL2');
        }
        
        const location = this.gl.getUniformLocation(this.currentProgram, name);
        if (!location) return; // Uniform not used or optimized out
        
        switch (value.type) {
            case 'float':
                this.gl.uniform1f(location, value.value as number);
                break;
            case 'vec2':
                this.gl.uniform2fv(location, value.value as Float32Array);
                break;
            case 'vec3':
                this.gl.uniform3fv(location, value.value as Float32Array);
                break;
            case 'vec4':
                this.gl.uniform4fv(location, value.value as Float32Array);
                break;
            case 'mat4':
                this.gl.uniformMatrix4fv(location, false, value.value as Float32Array);
                break;
        }
    }
    
    destroyShader(handle: ShaderHandle): void {
        const program = this.programs.get(handle);
        if (program) {
            this.gl.deleteProgram(program);
            this.programs.delete(handle);
        }
    }
    
    setViewport(x: number, y: number, width: number, height: number): void {
        this.gl.viewport(x, y, width, height);
    }
    
    setDepthTest(enabled: boolean, compareFunc: CompareFunction = 'less'): void {
        if (enabled) {
            this.gl.enable(this.gl.DEPTH_TEST);
            
            const glFunc = {
                'never': this.gl.NEVER,
                'less': this.gl.LESS,
                'equal': this.gl.EQUAL,
                'lequal': this.gl.LEQUAL,
                'greater': this.gl.GREATER,
                'notequal': this.gl.NOTEQUAL,
                'gequal': this.gl.GEQUAL,
                'always': this.gl.ALWAYS,
            }[compareFunc];
            
            this.gl.depthFunc(glFunc);
        } else {
            this.gl.disable(this.gl.DEPTH_TEST);
        }
    }
    
    setBlendMode(mode: BlendMode): void {
        if (mode === 'none') {
            this.gl.disable(this.gl.BLEND);
            return;
        }
        
        this.gl.enable(this.gl.BLEND);
        
        switch (mode) {
            case 'alpha':
                this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
                break;
            case 'additive':
                this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
                break;
            case 'multiply':
                this.gl.blendFunc(this.gl.DST_COLOR, this.gl.ZERO);
                break;
        }
    }
    
    setCullMode(mode: CullMode): void {
        if (mode === 'none') {
            this.gl.disable(this.gl.CULL_FACE);
            return;
        }
        
        this.gl.enable(this.gl.CULL_FACE);
        this.gl.cullFace(mode === 'front' ? this.gl.FRONT : this.gl.BACK);
    }
    
    clear(r: number, g: number, b: number, a: number, depth = 1.0): void {
        this.gl.clearColor(r, g, b, a);
        this.gl.clearDepth(depth);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }
    
    drawTriangles(vertexBuffer: BufferHandle, count: number, offset = 0): void {
        if (!this.currentProgram) {
            throw new GraphicsAPIError('No shader set', 'WebGL2');
        }
        
        const buffer = this.buffers.get(vertexBuffer);
        if (!buffer) {
            throw new GraphicsAPIError(`Buffer ${vertexBuffer} not found`, 'WebGL2');
        }
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.setupVertexAttributes();
        this.gl.drawArrays(this.gl.TRIANGLES, offset, count);
    }
    
    drawIndexed(
        vertexBuffer: BufferHandle,
        indexBuffer: BufferHandle,
        count: number,
        offset = 0
    ): void {
        if (!this.currentProgram) {
            throw new GraphicsAPIError('No shader set', 'WebGL2');
        }
        
        const vbo = this.buffers.get(vertexBuffer);
        const ibo = this.buffers.get(indexBuffer);
        
        if (!vbo || !ibo) {
            throw new GraphicsAPIError('Buffer not found', 'WebGL2');
        }
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);
        this.setupVertexAttributes();
        this.gl.drawElements(this.gl.TRIANGLES, count, this.gl.UNSIGNED_SHORT, offset * 2);
    }
    
    bindTexture(slot: number, handle: TextureHandle): void {
        const texture = this.textures.get(handle);
        if (!texture) {
            throw new GraphicsAPIError(`Texture ${handle} not found`, 'WebGL2');
        }
        
        this.gl.activeTexture(this.gl.TEXTURE0 + slot);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    }
    
    setVertexLayout(layout: VertexLayout): void {
        this.currentVertexLayout = layout;
    }
}
