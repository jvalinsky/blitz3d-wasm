/**
 * WebGPU graphics implementation
 * Modern GPU API with compute shader support and better performance
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

export class WebGPUGraphics implements GraphicsAPI {
    private device!: GPUDevice;
    private context!: GPUCanvasContext;
    private format!: GPUTextureFormat;
    
    // Resource tracking
    private buffers = new Map<BufferHandle, GPUBuffer>();
    private textures = new Map<TextureHandle, GPUTexture>();
    private shaders = new Map<ShaderHandle, GPUShaderModule>();
    private pipelines = new Map<ShaderHandle, GPURenderPipeline>();
    
    private nextHandle = 1;
    
    // Current state
    private currentPipeline: GPURenderPipeline | null = null;
    private currentShader: ShaderHandle | null = null;
    private currentVertexLayout: VertexLayout | null = null;
    private inFrame = false;
    private commandEncoder: GPUCommandEncoder | null = null;
    private renderPass: GPURenderPassEncoder | null = null;
    
    async initialize(canvas: HTMLCanvasElement): Promise<void> {
        // Check for WebGPU support
        if (!navigator.gpu) {
            throw new GraphicsNotSupportedError('WebGPU');
        }
        
        // Request adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new GraphicsAPIError('Failed to get GPU adapter', 'WebGPU');
        }
        
        this.device = await adapter.requestDevice();
        
        // Configure canvas context
        this.context = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
        if (!this.context) {
            throw new GraphicsAPIError('Failed to get WebGPU context', 'WebGPU');
        }
        
        this.format = navigator.gpu.getPreferredCanvasFormat();
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'premultiplied',
        });
        
        console.log('✅ WebGPU initialized successfully');
    }
    
    getCapabilities(): GraphicsCapabilities {
        const limits = this.device.limits;
        return {
            apiName: 'WebGPU',
            maxTextureSize: limits.maxTextureDimension2D || 8192,
            maxVertexAttributes: limits.maxVertexAttributes || 16,
            maxUniformBuffers: limits.maxUniformBuffersPerShaderStage || 12,
            supportsDepthTextures: true,
            supportsFloatTextures: true,
        };
    }
    
    beginFrame(): void {
        if (this.inFrame) {
            throw new GraphicsAPIError('Already in frame', 'WebGPU');
        }
        
        this.inFrame = true;
        this.commandEncoder = this.device.createCommandEncoder();
        
        // Begin render pass
        const textureView = this.context.getCurrentTexture().createView();
        
        this.renderPass = this.commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
            }],
        });
    }
    
    endFrame(): void {
        if (!this.inFrame) {
            throw new GraphicsAPIError('Not in frame', 'WebGPU');
        }
        
        // End render pass
        if (this.renderPass) {
            this.renderPass.end();
            this.renderPass = null;
        }
        
        // Submit commands
        if (this.commandEncoder) {
            this.device.queue.submit([this.commandEncoder.finish()]);
            this.commandEncoder = null;
        }
        
        this.inFrame = false;
    }
    
    createBuffer(data: ArrayBuffer, usage: BufferUsage): BufferHandle {
        const handle = this.nextHandle++;
        
        // Map usage to GPU buffer usage flags
        let gpuUsage = GPUBufferUsage.COPY_DST;
        switch (usage) {
            case 'vertex':
                gpuUsage |= GPUBufferUsage.VERTEX;
                break;
            case 'index':
                gpuUsage |= GPUBufferUsage.INDEX;
                break;
            case 'uniform':
                gpuUsage |= GPUBufferUsage.UNIFORM;
                break;
        }
        
        const buffer = this.device.createBuffer({
            size: data.byteLength,
            usage: gpuUsage,
            mappedAtCreation: true,
        });
        
        new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
        buffer.unmap();
        
        this.buffers.set(handle, buffer);
        return handle;
    }
    
    updateBuffer(handle: BufferHandle, data: ArrayBuffer, offset = 0): void {
        const buffer = this.buffers.get(handle);
        if (!buffer) {
            throw new GraphicsAPIError(`Buffer ${handle} not found`, 'WebGPU');
        }
        
        this.device.queue.writeBuffer(buffer, offset, data);
    }
    
    destroyBuffer(handle: BufferHandle): void {
        const buffer = this.buffers.get(handle);
        if (buffer) {
            buffer.destroy();
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
        
        // Map format
        let gpuFormat: GPUTextureFormat;
        switch (format) {
            case 'rgba8':
                gpuFormat = 'rgba8unorm';
                break;
            case 'rgb8':
                gpuFormat = 'rgba8unorm'; // WebGPU doesn't have rgb8, use rgba8
                break;
            case 'depth24stencil8':
                gpuFormat = 'depth24plus-stencil8';
                break;
            default:
                gpuFormat = 'rgba8unorm';
                break;
        }
        
        const texture = this.device.createTexture({
            size: { width, height },
            format: gpuFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        
        // Upload data if provided
        if (data) {
            this.device.queue.writeTexture(
                { texture },
                data,
                { bytesPerRow: width * 4 },
                { width, height }
            );
        }
        
        this.textures.set(handle, texture);
        return handle;
    }
    
    updateTexture(handle: TextureHandle, data: ArrayBuffer, level = 0): void {
        const texture = this.textures.get(handle);
        if (!texture) {
            throw new GraphicsAPIError(`Texture ${handle} not found`, 'WebGPU');
        }
        
        // Get texture dimensions
        const width = texture.width;
        const height = texture.height;
        
        this.device.queue.writeTexture(
            { texture, mipLevel: level },
            data,
            { bytesPerRow: width * 4 },
            { width, height }
        );
    }
    
    destroyTexture(handle: TextureHandle): void {
        const texture = this.textures.get(handle);
        if (texture) {
            texture.destroy();
            this.textures.delete(handle);
        }
    }
    
    createShader(vertexCode: string, fragmentCode: string): ShaderHandle {
        const handle = this.nextHandle++;
        
        // For WGSL, if both codes are the same, it's a combined shader
        // Otherwise concatenate them
        const wgslCode = vertexCode === fragmentCode 
            ? vertexCode 
            : `${vertexCode}\n${fragmentCode}`;
        
        // Create shader module (WGSL code)
        const shaderModule = this.device.createShaderModule({
            code: wgslCode,
        });
        
        this.shaders.set(handle, shaderModule);
        return handle;
    }
    
    useShader(handle: ShaderHandle): void {
        const shader = this.shaders.get(handle);
        if (!shader) {
            throw new GraphicsAPIError(`Shader ${handle} not found`, 'WebGPU');
        }
        
        // Create pipeline if not exists
        if (!this.pipelines.has(handle)) {
            this.createPipeline(handle, shader);
        }
        
        this.currentShader = handle;
        this.currentPipeline = this.pipelines.get(handle)!;
    }
    
    private createPipeline(handle: ShaderHandle, shader: GPUShaderModule): void {
        if (!this.currentVertexLayout) {
            throw new GraphicsAPIError('Vertex layout not set', 'WebGPU');
        }
        
        // Convert vertex layout to GPU format
        const buffers: GPUVertexBufferLayout[] = [{
            arrayStride: this.currentVertexLayout.stride,
            attributes: this.currentVertexLayout.attributes.map(attr => ({
                shaderLocation: attr.location,
                format: attr.format as GPUVertexFormat,
                offset: attr.offset,
            })),
        }];
        
        const pipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shader,
                entryPoint: 'vs_main',
                buffers,
            },
            fragment: {
                module: shader,
                entryPoint: 'fs_main',
                targets: [{
                    format: this.format,
                }],
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back',
            },
        });
        
        this.pipelines.set(handle, pipeline);
    }
    
    setUniform(_name: string, _value: UniformValue): void {
        // TODO: Implement uniform buffers
        // WebGPU uses bind groups for uniforms
        console.warn('setUniform not yet implemented for WebGPU');
    }
    
    destroyShader(handle: ShaderHandle): void {
        this.shaders.delete(handle);
        this.pipelines.delete(handle);
    }
    
    setViewport(x: number, y: number, width: number, height: number): void {
        if (!this.renderPass) {
            throw new GraphicsAPIError('Not in render pass', 'WebGPU');
        }
        
        this.renderPass.setViewport(x, y, width, height, 0, 1);
    }
    
    setDepthTest(_enabled: boolean, _compareFunc?: CompareFunction): void {
        // Depth test configured in pipeline creation
        console.warn('setDepthTest requires pipeline recreation in WebGPU');
    }
    
    setBlendMode(_mode: BlendMode): void {
        // Blend mode configured in pipeline creation
        console.warn('setBlendMode requires pipeline recreation in WebGPU');
    }
    
    setCullMode(_mode: CullMode): void {
        // Cull mode configured in pipeline creation
        console.warn('setCullMode requires pipeline recreation in WebGPU');
    }
    
    clear(r: number, g: number, b: number, a: number, _depth?: number): void {
        // Clear happens at beginFrame via render pass descriptor
        // This is a no-op in WebGPU (would need to recreate render pass)
        console.log(`Clear color: ${r}, ${g}, ${b}, ${a}`);
    }
    
    drawTriangles(vertexBuffer: BufferHandle, count: number, offset = 0): void {
        if (!this.renderPass) {
            throw new GraphicsAPIError('Not in render pass', 'WebGPU');
        }
        
        if (!this.currentPipeline) {
            throw new GraphicsAPIError('No shader set', 'WebGPU');
        }
        
        const buffer = this.buffers.get(vertexBuffer);
        if (!buffer) {
            throw new GraphicsAPIError(`Buffer ${vertexBuffer} not found`, 'WebGPU');
        }
        
        this.renderPass.setPipeline(this.currentPipeline);
        this.renderPass.setVertexBuffer(0, buffer);
        this.renderPass.draw(count, 1, offset, 0);
    }
    
    drawIndexed(
        vertexBuffer: BufferHandle,
        indexBuffer: BufferHandle,
        count: number,
        offset = 0
    ): void {
        if (!this.renderPass) {
            throw new GraphicsAPIError('Not in render pass', 'WebGPU');
        }
        
        if (!this.currentPipeline) {
            throw new GraphicsAPIError('No shader set', 'WebGPU');
        }
        
        const vbo = this.buffers.get(vertexBuffer);
        const ibo = this.buffers.get(indexBuffer);
        
        if (!vbo || !ibo) {
            throw new GraphicsAPIError('Buffer not found', 'WebGPU');
        }
        
        this.renderPass.setPipeline(this.currentPipeline);
        this.renderPass.setVertexBuffer(0, vbo);
        this.renderPass.setIndexBuffer(ibo, 'uint16');
        this.renderPass.drawIndexed(count, 1, offset, 0, 0);
    }
    
    bindTexture(_slot: number, _handle: TextureHandle): void {
        // TODO: Implement texture binding via bind groups
        console.warn('bindTexture not yet implemented for WebGPU');
    }
    
    setVertexLayout(layout: VertexLayout): void {
        this.currentVertexLayout = layout;
    }
}
