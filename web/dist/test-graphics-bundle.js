var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/runtime/graphics-api.ts
var BufferUsage = /* @__PURE__ */ ((BufferUsage2) => {
  BufferUsage2["Vertex"] = "vertex";
  BufferUsage2["Index"] = "index";
  BufferUsage2["Uniform"] = "uniform";
  return BufferUsage2;
})(BufferUsage || {});
var TextureFormat = /* @__PURE__ */ ((TextureFormat2) => {
  TextureFormat2["RGBA8"] = "rgba8";
  TextureFormat2["RGB8"] = "rgb8";
  TextureFormat2["Depth24Stencil8"] = "depth24stencil8";
  return TextureFormat2;
})(TextureFormat || {});
var CompareFunction = /* @__PURE__ */ ((CompareFunction2) => {
  CompareFunction2["Never"] = "never";
  CompareFunction2["Less"] = "less";
  CompareFunction2["Equal"] = "equal";
  CompareFunction2["LessEqual"] = "lequal";
  CompareFunction2["Greater"] = "greater";
  CompareFunction2["NotEqual"] = "notequal";
  CompareFunction2["GreaterEqual"] = "gequal";
  CompareFunction2["Always"] = "always";
  return CompareFunction2;
})(CompareFunction || {});
var BlendMode = /* @__PURE__ */ ((BlendMode2) => {
  BlendMode2["None"] = "none";
  BlendMode2["Alpha"] = "alpha";
  BlendMode2["Additive"] = "additive";
  BlendMode2["Multiply"] = "multiply";
  return BlendMode2;
})(BlendMode || {});
var CullMode = /* @__PURE__ */ ((CullMode2) => {
  CullMode2["None"] = "none";
  CullMode2["Front"] = "front";
  CullMode2["Back"] = "back";
  return CullMode2;
})(CullMode || {});
var GraphicsAPIError = class extends Error {
  constructor(message, apiName) {
    super(`[${apiName}] ${message}`);
    this.apiName = apiName;
    this.name = "GraphicsAPIError";
  }
};
var GraphicsNotSupportedError = class extends GraphicsAPIError {
  constructor(apiName) {
    super("Graphics API not supported in this browser", apiName);
    this.name = "GraphicsNotSupportedError";
  }
};
function toArrayBuffer(data) {
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  );
  return buffer;
}
function createStandardVertexLayout() {
  return {
    stride: 32,
    // 3 (pos) + 3 (normal) + 2 (uv) = 8 floats = 32 bytes
    attributes: [
      { location: 0, format: "float32x3", offset: 0 },
      // position
      { location: 1, format: "float32x3", offset: 12 },
      // normal
      { location: 2, format: "float32x2", offset: 24 }
      // uv
    ]
  };
}

// src/runtime/webgpu-graphics.ts
var WebGPUGraphics = class {
  constructor() {
    __publicField(this, "device");
    __publicField(this, "context");
    __publicField(this, "format");
    // Resource tracking
    __publicField(this, "buffers", /* @__PURE__ */ new Map());
    __publicField(this, "textures", /* @__PURE__ */ new Map());
    __publicField(this, "shaders", /* @__PURE__ */ new Map());
    __publicField(this, "pipelines", /* @__PURE__ */ new Map());
    __publicField(this, "nextHandle", 1);
    // Current state
    __publicField(this, "currentPipeline", null);
    __publicField(this, "currentShader", null);
    __publicField(this, "currentVertexLayout", null);
    __publicField(this, "inFrame", false);
    __publicField(this, "commandEncoder", null);
    __publicField(this, "renderPass", null);
  }
  async initialize(canvas) {
    if (!navigator.gpu) {
      throw new GraphicsNotSupportedError("WebGPU");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new GraphicsAPIError("Failed to get GPU adapter", "WebGPU");
    }
    this.device = await adapter.requestDevice();
    this.context = canvas.getContext("webgpu");
    if (!this.context) {
      throw new GraphicsAPIError("Failed to get WebGPU context", "WebGPU");
    }
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied"
    });
    console.log("\u2705 WebGPU initialized successfully");
  }
  getCapabilities() {
    const limits = this.device.limits;
    return {
      apiName: "WebGPU",
      maxTextureSize: limits.maxTextureDimension2D || 8192,
      maxVertexAttributes: limits.maxVertexAttributes || 16,
      maxUniformBuffers: limits.maxUniformBuffersPerShaderStage || 12,
      supportsDepthTextures: true,
      supportsFloatTextures: true
    };
  }
  beginFrame() {
    if (this.inFrame) {
      throw new GraphicsAPIError("Already in frame", "WebGPU");
    }
    this.inFrame = true;
    this.commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    this.renderPass = this.commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        loadOp: "clear",
        storeOp: "store",
        clearValue: { r: 0, g: 0, b: 0, a: 1 }
      }]
    });
  }
  endFrame() {
    if (!this.inFrame) {
      throw new GraphicsAPIError("Not in frame", "WebGPU");
    }
    if (this.renderPass) {
      this.renderPass.end();
      this.renderPass = null;
    }
    if (this.commandEncoder) {
      this.device.queue.submit([this.commandEncoder.finish()]);
      this.commandEncoder = null;
    }
    this.inFrame = false;
  }
  createBuffer(data, usage) {
    const handle = this.nextHandle++;
    let gpuUsage = GPUBufferUsage.COPY_DST;
    switch (usage) {
      case "vertex":
        gpuUsage |= GPUBufferUsage.VERTEX;
        break;
      case "index":
        gpuUsage |= GPUBufferUsage.INDEX;
        break;
      case "uniform":
        gpuUsage |= GPUBufferUsage.UNIFORM;
        break;
    }
    const buffer = this.device.createBuffer({
      size: data.byteLength,
      usage: gpuUsage,
      mappedAtCreation: true
    });
    new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data));
    buffer.unmap();
    this.buffers.set(handle, buffer);
    return handle;
  }
  updateBuffer(handle, data, offset = 0) {
    const buffer = this.buffers.get(handle);
    if (!buffer) {
      throw new GraphicsAPIError(`Buffer ${handle} not found`, "WebGPU");
    }
    this.device.queue.writeBuffer(buffer, offset, data);
  }
  destroyBuffer(handle) {
    const buffer = this.buffers.get(handle);
    if (buffer) {
      buffer.destroy();
      this.buffers.delete(handle);
    }
  }
  createTexture(width, height, format, data) {
    const handle = this.nextHandle++;
    let gpuFormat;
    switch (format) {
      case "rgba8":
        gpuFormat = "rgba8unorm";
        break;
      case "rgb8":
        gpuFormat = "rgba8unorm";
        break;
      case "depth24stencil8":
        gpuFormat = "depth24plus-stencil8";
        break;
      default:
        gpuFormat = "rgba8unorm";
        break;
    }
    const texture = this.device.createTexture({
      size: { width, height },
      format: gpuFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
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
  updateTexture(handle, data, level = 0) {
    const texture = this.textures.get(handle);
    if (!texture) {
      throw new GraphicsAPIError(`Texture ${handle} not found`, "WebGPU");
    }
    const width = texture.width;
    const height = texture.height;
    this.device.queue.writeTexture(
      { texture, mipLevel: level },
      data,
      { bytesPerRow: width * 4 },
      { width, height }
    );
  }
  destroyTexture(handle) {
    const texture = this.textures.get(handle);
    if (texture) {
      texture.destroy();
      this.textures.delete(handle);
    }
  }
  createShader(vertexCode, fragmentCode) {
    const handle = this.nextHandle++;
    const wgslCode = vertexCode === fragmentCode ? vertexCode : `${vertexCode}
${fragmentCode}`;
    const shaderModule = this.device.createShaderModule({
      code: wgslCode
    });
    this.shaders.set(handle, shaderModule);
    return handle;
  }
  useShader(handle) {
    const shader = this.shaders.get(handle);
    if (!shader) {
      throw new GraphicsAPIError(`Shader ${handle} not found`, "WebGPU");
    }
    if (!this.pipelines.has(handle)) {
      this.createPipeline(handle, shader);
    }
    this.currentShader = handle;
    this.currentPipeline = this.pipelines.get(handle);
  }
  createPipeline(handle, shader) {
    if (!this.currentVertexLayout) {
      throw new GraphicsAPIError("Vertex layout not set", "WebGPU");
    }
    const buffers = [{
      arrayStride: this.currentVertexLayout.stride,
      attributes: this.currentVertexLayout.attributes.map((attr) => ({
        shaderLocation: attr.location,
        format: attr.format,
        offset: attr.offset
      }))
    }];
    const pipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vs_main",
        buffers
      },
      fragment: {
        module: shader,
        entryPoint: "fs_main",
        targets: [{
          format: this.format
        }]
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back"
      }
    });
    this.pipelines.set(handle, pipeline);
  }
  setUniform(_name, _value) {
    console.warn("setUniform not yet implemented for WebGPU");
  }
  destroyShader(handle) {
    this.shaders.delete(handle);
    this.pipelines.delete(handle);
  }
  setViewport(x, y, width, height) {
    if (!this.renderPass) {
      throw new GraphicsAPIError("Not in render pass", "WebGPU");
    }
    this.renderPass.setViewport(x, y, width, height, 0, 1);
  }
  setDepthTest(_enabled, _compareFunc) {
    console.warn("setDepthTest requires pipeline recreation in WebGPU");
  }
  setBlendMode(_mode) {
    console.warn("setBlendMode requires pipeline recreation in WebGPU");
  }
  setCullMode(_mode) {
    console.warn("setCullMode requires pipeline recreation in WebGPU");
  }
  clear(r, g, b, a, _depth) {
    console.log(`Clear color: ${r}, ${g}, ${b}, ${a}`);
  }
  drawTriangles(vertexBuffer, count, offset = 0) {
    if (!this.renderPass) {
      throw new GraphicsAPIError("Not in render pass", "WebGPU");
    }
    if (!this.currentPipeline) {
      throw new GraphicsAPIError("No shader set", "WebGPU");
    }
    const buffer = this.buffers.get(vertexBuffer);
    if (!buffer) {
      throw new GraphicsAPIError(`Buffer ${vertexBuffer} not found`, "WebGPU");
    }
    this.renderPass.setPipeline(this.currentPipeline);
    this.renderPass.setVertexBuffer(0, buffer);
    this.renderPass.draw(count, 1, offset, 0);
  }
  drawIndexed(vertexBuffer, indexBuffer, count, offset = 0) {
    if (!this.renderPass) {
      throw new GraphicsAPIError("Not in render pass", "WebGPU");
    }
    if (!this.currentPipeline) {
      throw new GraphicsAPIError("No shader set", "WebGPU");
    }
    const vbo = this.buffers.get(vertexBuffer);
    const ibo = this.buffers.get(indexBuffer);
    if (!vbo || !ibo) {
      throw new GraphicsAPIError("Buffer not found", "WebGPU");
    }
    this.renderPass.setPipeline(this.currentPipeline);
    this.renderPass.setVertexBuffer(0, vbo);
    this.renderPass.setIndexBuffer(ibo, "uint16");
    this.renderPass.drawIndexed(count, 1, offset, 0, 0);
  }
  bindTexture(_slot, _handle) {
    console.warn("bindTexture not yet implemented for WebGPU");
  }
  setVertexLayout(layout) {
    this.currentVertexLayout = layout;
  }
};

// src/runtime/webgl-graphics.ts
var WebGLGraphics = class {
  constructor() {
    __publicField(this, "gl");
    // Resource tracking
    __publicField(this, "buffers", /* @__PURE__ */ new Map());
    __publicField(this, "textures", /* @__PURE__ */ new Map());
    __publicField(this, "programs", /* @__PURE__ */ new Map());
    __publicField(this, "nextHandle", 1);
    // Current state
    __publicField(this, "currentProgram", null);
    __publicField(this, "currentShader", null);
    __publicField(this, "currentVertexLayout", null);
  }
  async initialize(canvas) {
    this.gl = canvas.getContext("webgl2");
    if (!this.gl) {
      throw new GraphicsNotSupportedError("WebGL2");
    }
    this.gl.getExtension("EXT_color_buffer_float");
    this.gl.getExtension("OES_texture_float_linear");
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LESS);
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(this.gl.BACK);
    console.log("\u2705 WebGL 2 initialized successfully");
  }
  getCapabilities() {
    return {
      apiName: "WebGL2",
      maxTextureSize: this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE),
      maxVertexAttributes: this.gl.getParameter(this.gl.MAX_VERTEX_ATTRIBS),
      maxUniformBuffers: this.gl.getParameter(this.gl.MAX_UNIFORM_BUFFER_BINDINGS),
      supportsDepthTextures: true,
      supportsFloatTextures: this.gl.getExtension("OES_texture_float") !== null
    };
  }
  beginFrame() {
  }
  endFrame() {
  }
  createBuffer(data, usage) {
    const handle = this.nextHandle++;
    const buffer = this.gl.createBuffer();
    if (!buffer) {
      throw new GraphicsAPIError("Failed to create buffer", "WebGL2");
    }
    const target = usage === "index" ? this.gl.ELEMENT_ARRAY_BUFFER : this.gl.ARRAY_BUFFER;
    this.gl.bindBuffer(target, buffer);
    this.gl.bufferData(target, data, this.gl.STATIC_DRAW);
    this.gl.bindBuffer(target, null);
    this.buffers.set(handle, buffer);
    return handle;
  }
  updateBuffer(handle, data, offset = 0) {
    const buffer = this.buffers.get(handle);
    if (!buffer) {
      throw new GraphicsAPIError(`Buffer ${handle} not found`, "WebGL2");
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, offset, data);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
  }
  destroyBuffer(handle) {
    const buffer = this.buffers.get(handle);
    if (buffer) {
      this.gl.deleteBuffer(buffer);
      this.buffers.delete(handle);
    }
  }
  createTexture(width, height, format, data) {
    const handle = this.nextHandle++;
    const texture = this.gl.createTexture();
    if (!texture) {
      throw new GraphicsAPIError("Failed to create texture", "WebGL2");
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    let internalFormat;
    let glFormat;
    let type;
    switch (format) {
      case "rgba8":
        internalFormat = this.gl.RGBA8;
        glFormat = this.gl.RGBA;
        type = this.gl.UNSIGNED_BYTE;
        break;
      case "rgb8":
        internalFormat = this.gl.RGB8;
        glFormat = this.gl.RGB;
        type = this.gl.UNSIGNED_BYTE;
        break;
      case "depth24stencil8":
        internalFormat = this.gl.DEPTH24_STENCIL8;
        glFormat = this.gl.DEPTH_STENCIL;
        type = this.gl.UNSIGNED_INT_24_8;
        break;
      default:
        internalFormat = this.gl.RGBA8;
        glFormat = this.gl.RGBA;
        type = this.gl.UNSIGNED_BYTE;
    }
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
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    this.textures.set(handle, texture);
    return handle;
  }
  updateTexture(handle, data, level = 0) {
    const texture = this.textures.get(handle);
    if (!texture) {
      throw new GraphicsAPIError(`Texture ${handle} not found`, "WebGL2");
    }
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    console.warn("updateTexture implementation incomplete - needs texture metadata");
    this.gl.bindTexture(this.gl.TEXTURE_2D, null);
  }
  destroyTexture(handle) {
    const texture = this.textures.get(handle);
    if (texture) {
      this.gl.deleteTexture(texture);
      this.textures.delete(handle);
    }
  }
  createShader(vertexCode, fragmentCode) {
    const handle = this.nextHandle++;
    const vs = this.gl.createShader(this.gl.VERTEX_SHADER);
    if (!vs)
      throw new GraphicsAPIError("Failed to create vertex shader", "WebGL2");
    this.gl.shaderSource(vs, vertexCode);
    this.gl.compileShader(vs);
    if (!this.gl.getShaderParameter(vs, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(vs);
      this.gl.deleteShader(vs);
      throw new GraphicsAPIError(`Vertex shader compilation failed: ${error}`, "WebGL2");
    }
    const fs = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    if (!fs)
      throw new GraphicsAPIError("Failed to create fragment shader", "WebGL2");
    this.gl.shaderSource(fs, fragmentCode);
    this.gl.compileShader(fs);
    if (!this.gl.getShaderParameter(fs, this.gl.COMPILE_STATUS)) {
      const error = this.gl.getShaderInfoLog(fs);
      this.gl.deleteShader(vs);
      this.gl.deleteShader(fs);
      throw new GraphicsAPIError(`Fragment shader compilation failed: ${error}`, "WebGL2");
    }
    const program = this.gl.createProgram();
    if (!program)
      throw new GraphicsAPIError("Failed to create program", "WebGL2");
    this.gl.attachShader(program, vs);
    this.gl.attachShader(program, fs);
    this.gl.linkProgram(program);
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const error = this.gl.getProgramInfoLog(program);
      this.gl.deleteShader(vs);
      this.gl.deleteShader(fs);
      this.gl.deleteProgram(program);
      throw new GraphicsAPIError(`Program linking failed: ${error}`, "WebGL2");
    }
    this.gl.deleteShader(vs);
    this.gl.deleteShader(fs);
    this.programs.set(handle, program);
    return handle;
  }
  useShader(handle) {
    const program = this.programs.get(handle);
    if (!program) {
      throw new GraphicsAPIError(`Shader ${handle} not found`, "WebGL2");
    }
    this.gl.useProgram(program);
    this.currentProgram = program;
    this.currentShader = handle;
    if (this.currentVertexLayout) {
      this.setupVertexAttributes();
    }
  }
  setupVertexAttributes() {
    if (!this.currentProgram || !this.currentVertexLayout)
      return;
    for (const attr of this.currentVertexLayout.attributes) {
      const location = attr.location;
      this.gl.enableVertexAttribArray(location);
      const components = attr.format === "float32" ? 1 : attr.format === "float32x2" ? 2 : attr.format === "float32x3" ? 3 : 4;
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
  setUniform(name, value) {
    if (!this.currentProgram) {
      throw new GraphicsAPIError("No shader set", "WebGL2");
    }
    const location = this.gl.getUniformLocation(this.currentProgram, name);
    if (!location)
      return;
    switch (value.type) {
      case "float":
        this.gl.uniform1f(location, value.value);
        break;
      case "vec2":
        this.gl.uniform2fv(location, value.value);
        break;
      case "vec3":
        this.gl.uniform3fv(location, value.value);
        break;
      case "vec4":
        this.gl.uniform4fv(location, value.value);
        break;
      case "mat4":
        this.gl.uniformMatrix4fv(location, false, value.value);
        break;
    }
  }
  destroyShader(handle) {
    const program = this.programs.get(handle);
    if (program) {
      this.gl.deleteProgram(program);
      this.programs.delete(handle);
    }
  }
  setViewport(x, y, width, height) {
    this.gl.viewport(x, y, width, height);
  }
  setDepthTest(enabled, compareFunc) {
    const func = compareFunc || "less";
    if (enabled) {
      this.gl.enable(this.gl.DEPTH_TEST);
      const glFunc = {
        "never": this.gl.NEVER,
        "less": this.gl.LESS,
        "equal": this.gl.EQUAL,
        "lequal": this.gl.LEQUAL,
        "greater": this.gl.GREATER,
        "notequal": this.gl.NOTEQUAL,
        "gequal": this.gl.GEQUAL,
        "always": this.gl.ALWAYS
      }[func];
      this.gl.depthFunc(glFunc);
    } else {
      this.gl.disable(this.gl.DEPTH_TEST);
    }
  }
  setBlendMode(mode) {
    if (mode === "none") {
      this.gl.disable(this.gl.BLEND);
      return;
    }
    this.gl.enable(this.gl.BLEND);
    switch (mode) {
      case "alpha":
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
        break;
      case "additive":
        this.gl.blendFunc(this.gl.ONE, this.gl.ONE);
        break;
      case "multiply":
        this.gl.blendFunc(this.gl.DST_COLOR, this.gl.ZERO);
        break;
    }
  }
  setCullMode(mode) {
    if (mode === "none") {
      this.gl.disable(this.gl.CULL_FACE);
      return;
    }
    this.gl.enable(this.gl.CULL_FACE);
    this.gl.cullFace(mode === "front" ? this.gl.FRONT : this.gl.BACK);
  }
  clear(r, g, b, a, depth = 1) {
    this.gl.clearColor(r, g, b, a);
    this.gl.clearDepth(depth);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }
  drawTriangles(vertexBuffer, count, offset = 0) {
    if (!this.currentProgram) {
      throw new GraphicsAPIError("No shader set", "WebGL2");
    }
    const buffer = this.buffers.get(vertexBuffer);
    if (!buffer) {
      throw new GraphicsAPIError(`Buffer ${vertexBuffer} not found`, "WebGL2");
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.setupVertexAttributes();
    this.gl.drawArrays(this.gl.TRIANGLES, offset, count);
  }
  drawIndexed(vertexBuffer, indexBuffer, count, offset = 0) {
    if (!this.currentProgram) {
      throw new GraphicsAPIError("No shader set", "WebGL2");
    }
    const vbo = this.buffers.get(vertexBuffer);
    const ibo = this.buffers.get(indexBuffer);
    if (!vbo || !ibo) {
      throw new GraphicsAPIError("Buffer not found", "WebGL2");
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vbo);
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, ibo);
    this.setupVertexAttributes();
    this.gl.drawElements(this.gl.TRIANGLES, count, this.gl.UNSIGNED_SHORT, offset * 2);
  }
  bindTexture(slot, handle) {
    const texture = this.textures.get(handle);
    if (!texture) {
      throw new GraphicsAPIError(`Texture ${handle} not found`, "WebGL2");
    }
    this.gl.activeTexture(this.gl.TEXTURE0 + slot);
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
  }
  setVertexLayout(layout) {
    this.currentVertexLayout = layout;
  }
};

// src/runtime/graphics-factory.ts
async function createGraphicsAPI(canvas, forceWebGL = false) {
  if (!forceWebGL && "gpu" in navigator) {
    try {
      console.log("\u{1F50D} Attempting WebGPU initialization...");
      const api = new WebGPUGraphics();
      await api.initialize(canvas);
      const caps = api.getCapabilities();
      console.log(`\u2705 Using ${caps.apiName} (max texture: ${caps.maxTextureSize})`);
      return api;
    } catch (e) {
      console.warn("\u26A0\uFE0F  WebGPU initialization failed, falling back to WebGL 2:", e);
    }
  }
  try {
    console.log("\u{1F50D} Attempting WebGL 2 initialization...");
    const api = new WebGLGraphics();
    await api.initialize(canvas);
    const caps = api.getCapabilities();
    console.log(`\u2705 Using ${caps.apiName} (max texture: ${caps.maxTextureSize})`);
    return api;
  } catch (e) {
    console.error("\u274C WebGL 2 initialization failed:", e);
    throw new GraphicsNotSupportedError("No supported graphics API");
  }
}
function isWebGPUSupported() {
  return "gpu" in navigator;
}
function isWebGL2Supported() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return gl !== null;
  } catch {
    return false;
  }
}
async function getGraphicsInfo() {
  const webgpuSupported = isWebGPUSupported();
  const webgl2Supported = isWebGL2Supported();
  let preferredAPI;
  if (webgpuSupported) {
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (adapter) {
        preferredAPI = "WebGPU";
      } else {
        preferredAPI = webgl2Supported ? "WebGL2" : "None";
      }
    } catch {
      preferredAPI = webgl2Supported ? "WebGL2" : "None";
    }
  } else if (webgl2Supported) {
    preferredAPI = "WebGL2";
  } else {
    preferredAPI = "None";
  }
  return {
    webgpuSupported,
    webgl2Supported,
    preferredAPI
  };
}

// src/runtime/wasm-string-helper.ts
var WasmStringHelper = class {
  constructor(memory, malloc, free) {
    this.memory = memory;
    this.malloc = malloc;
    this.free = free;
    __publicField(this, "textEncoder", new TextEncoder());
    __publicField(this, "textDecoder", new TextDecoder());
  }
  /**
   * Copy a JavaScript string into WASM linear memory
   * Returns pointer to null-terminated UTF-8 string
   * Caller is responsible for calling free() when done
   */
  copyStringToWasm(str) {
    const bytes = this.textEncoder.encode(str + "\0");
    const ptr = this.malloc(bytes.length);
    if (ptr === 0) {
      throw new Error("Failed to allocate WASM memory for string");
    }
    const view = new Uint8Array(this.memory.buffer, ptr, bytes.length);
    view.set(bytes);
    return ptr;
  }
  /**
   * Read a null-terminated UTF-8 string from WASM linear memory
   * Does NOT free the pointer - caller must manage lifecycle
   */
  readStringFromWasm(ptr) {
    if (ptr === 0) {
      return "";
    }
    const view = new Uint8Array(this.memory.buffer);
    let end = ptr;
    while (view[end] !== 0 && end < view.length) {
      end++;
    }
    if (end >= view.length) {
      throw new Error("String has no null terminator");
    }
    const bytes = view.slice(ptr, end);
    return this.textDecoder.decode(bytes);
  }
  /**
   * Copy a string to WASM, call a function with the pointer, then free it
   * Useful for passing string parameters to WASM functions
   */
  withString(str, fn) {
    const ptr = this.copyStringToWasm(str);
    try {
      return fn(ptr);
    } finally {
      this.free(ptr);
    }
  }
  /**
   * Read a string from WASM pointer and return it
   * Optionally free the pointer afterwards
   */
  takeString(ptr, shouldFree = false) {
    const str = this.readStringFromWasm(ptr);
    if (shouldFree) {
      this.free(ptr);
    }
    return str;
  }
  /**
   * Allocate and copy multiple strings to WASM
   * Returns array of pointers that must be freed
   */
  copyStringsToWasm(strings) {
    return strings.map((s) => this.copyStringToWasm(s));
  }
  /**
   * Free an array of string pointers
   */
  freeStrings(pointers) {
    for (const ptr of pointers) {
      this.free(ptr);
    }
  }
};

// src/runtime/wasm-loader.ts
function createJavaScriptKitStubs() {
  return {
    swjs_call_new: () => 0,
    swjs_set_prop: () => {
    },
    swjs_get_prop: () => 0,
    swjs_set_subscript: () => {
    },
    swjs_instanceof: () => 0,
    swjs_get_subscript: () => 0,
    swjs_call_function_with_this_no_catch: () => 0,
    swjs_i64_to_bigint_slow: () => 0,
    swjs_release: () => {
    },
    swjs_create_function: () => 0,
    swjs_call_function_no_catch: () => 0,
    swjs_decode_string: () => 0,
    swjs_encode_string: () => 0,
    swjs_load_string: () => {
    },
    swjs_call_function_with_this: () => 0,
    swjs_call_function: () => 0,
    swjs_call_throwing_new: () => 0,
    swjs_create_typed_array: () => 0,
    swjs_load_typed_array: () => {
    }
  };
}
function createWasiStubs() {
  return {
    args_get: () => 0,
    args_sizes_get: () => 0,
    environ_get: () => 0,
    environ_sizes_get: () => 0,
    clock_res_get: () => 0,
    clock_time_get: () => 0,
    fd_advise: () => 0,
    fd_allocate: () => 0,
    fd_close: () => 0,
    fd_datasync: () => 0,
    fd_fdstat_get: () => 0,
    fd_fdstat_set_flags: () => 0,
    fd_fdstat_set_rights: () => 0,
    fd_filestat_get: () => 0,
    fd_filestat_set_size: () => 0,
    fd_filestat_set_times: () => 0,
    fd_pread: () => 0,
    fd_prestat_get: () => 0,
    fd_prestat_dir_name: () => 0,
    fd_pwrite: () => 0,
    fd_read: () => 0,
    fd_readdir: () => 0,
    fd_renumber: () => 0,
    fd_seek: () => 0,
    fd_sync: () => 0,
    fd_tell: () => 0,
    fd_write: () => 0,
    path_create_directory: () => 0,
    path_filestat_get: () => 0,
    path_filestat_set_times: () => 0,
    path_link: () => 0,
    path_open: () => 0,
    path_readlink: () => 0,
    path_remove_directory: () => 0,
    path_rename: () => 0,
    path_symlink: () => 0,
    path_unlink_file: () => 0,
    poll_oneoff: () => 0,
    proc_exit: () => {
    },
    proc_raise: () => 0,
    random_get: () => 0,
    sched_yield: () => 0,
    sock_accept: () => 0,
    sock_recv: () => 0,
    sock_send: () => 0,
    sock_shutdown: () => 0
  };
}
var graphicsAPI = null;
if (typeof window !== "undefined") {
  window.graphicsAPI = null;
}
function createEngineImports() {
  return {
    env: {
      // === Graphics Imports (Phase 2 - IMPLEMENTED) ===
      js_Graphics3D: (width, height, depth, mode) => {
        console.log(`Graphics3D(${width}x${height}, ${depth}bit, mode ${mode})`);
        if (!graphicsAPI) {
          console.error("Graphics API not initialized!");
          return 0;
        }
        return 1;
      },
      js_ClearScreen: () => {
        if (!graphicsAPI)
          return;
        graphicsAPI.clear(0, 0, 0, 1);
      },
      js_RenderWorld: (tween) => {
        if (!graphicsAPI)
          return;
        console.log(`RenderWorld(tween: ${tween})`);
        graphicsAPI.endFrame();
        graphicsAPI.beginFrame();
      },
      js_Flip: (vsync) => {
        if (!graphicsAPI)
          return;
        console.log(`Flip(vsync: ${vsync})`);
        graphicsAPI.endFrame();
      },
      js_SetBuffer: (buffer) => {
        console.log(`SetBuffer(${buffer})`);
      },
      // === Audio Stubs (Phase 2 - TODO) ===
      js_LoadSound: (pathPtr, flags) => {
        console.warn("js_LoadSound stub called");
        return 0;
      },
      js_PlaySound: (sound, volume, pan, rate, loop) => {
        console.warn("js_PlaySound stub called");
        return 0;
      },
      js_FreeSound: (sound) => {
        console.warn("js_FreeSound stub called");
      },
      js_StopChannel: (channel) => {
        console.warn("js_StopChannel stub called");
      },
      js_ChannelPitch: (channel, pitch) => {
        console.warn("js_ChannelPitch stub called");
      },
      js_ChannelVolume: (channel, volume) => {
        console.warn("js_ChannelVolume stub called");
      },
      js_ChannelPan: (channel, pan) => {
        console.warn("js_ChannelPan stub called");
      }
    },
    javascript_kit: createJavaScriptKitStubs(),
    wasi_snapshot_preview1: createWasiStubs()
  };
}
async function loadBlitz3DEngine(wasmPath, canvas) {
  console.log(`Loading Blitz3D Engine from ${wasmPath}...`);
  if (canvas) {
    console.log("Initializing graphics API...");
    graphicsAPI = await createGraphicsAPI(canvas);
    const caps = graphicsAPI.getCapabilities();
    console.log(`Graphics: ${caps.apiName}, max texture: ${caps.maxTextureSize}`);
    if (typeof window !== "undefined") {
      window.graphicsAPI = graphicsAPI;
    }
  }
  let wasmBytes;
  if (typeof Deno !== "undefined" && Deno.readFile) {
    wasmBytes = await Deno.readFile(wasmPath);
  } else {
    const response = await fetch(wasmPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }
    wasmBytes = new Uint8Array(await response.arrayBuffer());
  }
  console.log(`Loaded ${wasmBytes.byteLength} bytes of WASM`);
  const imports = createEngineImports();
  const module = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(module, imports);
  console.log("WASM instantiated successfully");
  const _start = instance.exports._start;
  if (_start) {
    try {
      _start();
      console.log("Swift runtime initialized");
    } catch (e) {
      console.warn("_start threw error (this may be expected):", e);
    }
  }
  const exports = instance.exports;
  if (!exports.memory) {
    throw new Error("WASM module does not export memory");
  }
  if (typeof exports.wasm_malloc !== "function") {
    console.warn("WASM module does not export wasm_malloc");
  }
  if (typeof exports.wasm_free !== "function") {
    console.warn("WASM module does not export wasm_free");
  }
  const strings = new WasmStringHelper(
    exports.memory,
    exports.wasm_malloc || (() => {
      throw new Error("wasm_malloc not exported");
    }),
    exports.wasm_free || (() => {
      throw new Error("wasm_free not exported");
    })
  );
  const helpers = {
    callWithString(fn, str) {
      return strings.withString(str, fn);
    },
    readString(ptr, free = false) {
      return strings.takeString(ptr, free);
    }
  };
  console.log("Blitz3D Engine loaded successfully");
  console.log(`Memory: ${exports.memory.buffer.byteLength} bytes`);
  return {
    instance,
    exports,
    strings,
    helpers
  };
}

// src/runtime/camera.ts
var Camera = class {
  constructor() {
    // Position in world space
    __publicField(this, "position", [0, 0, -5]);
    // Rotation (pitch, yaw) in radians
    __publicField(this, "rotation", [0, 0]);
    // Projection parameters
    __publicField(this, "fov", 60);
    // Field of view in degrees
    __publicField(this, "near", 0.1);
    __publicField(this, "far", 1e3);
    __publicField(this, "aspect", 1);
  }
  /**
   * Get view matrix (world to camera space)
   * Simple lookAt-style matrix
   */
  getViewMatrix() {
    const eye = this.position;
    const center = [0, 0, 0];
    const up = [0, 1, 0];
    const f = [
      center[0] - eye[0],
      center[1] - eye[1],
      center[2] - eye[2]
    ];
    const fLen = Math.sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]);
    f[0] /= fLen;
    f[1] /= fLen;
    f[2] /= fLen;
    const r = [
      f[1] * up[2] - f[2] * up[1],
      f[2] * up[0] - f[0] * up[2],
      f[0] * up[1] - f[1] * up[0]
    ];
    const rLen = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]);
    r[0] /= rLen;
    r[1] /= rLen;
    r[2] /= rLen;
    const u = [
      r[1] * f[2] - r[2] * f[1],
      r[2] * f[0] - r[0] * f[2],
      r[0] * f[1] - r[1] * f[0]
    ];
    const mat = new Float32Array(16);
    mat[0] = r[0];
    mat[1] = u[0];
    mat[2] = -f[0];
    mat[3] = 0;
    mat[4] = r[1];
    mat[5] = u[1];
    mat[6] = -f[1];
    mat[7] = 0;
    mat[8] = r[2];
    mat[9] = u[2];
    mat[10] = -f[2];
    mat[11] = 0;
    mat[12] = -(r[0] * eye[0] + r[1] * eye[1] + r[2] * eye[2]);
    mat[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
    mat[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
    mat[15] = 1;
    return mat;
  }
  /**
   * Get projection matrix (perspective)
   */
  getProjectionMatrix() {
    const mat = new Float32Array(16);
    const fovRad = this.fov * Math.PI / 180;
    const f = 1 / Math.tan(fovRad / 2);
    const nf = 1 / (this.near - this.far);
    mat[0] = f / this.aspect;
    mat[5] = f;
    mat[10] = (this.far + this.near) * nf;
    mat[11] = -1;
    mat[14] = 2 * this.far * this.near * nf;
    return mat;
  }
  /**
   * Get combined MVP matrix (Model-View-Projection)
   */
  getMVPMatrix(modelMatrix) {
    const view = this.getViewMatrix();
    const proj = this.getProjectionMatrix();
    const model = modelMatrix || this.identity();
    const vp = this.multiply(proj, view);
    return this.multiply(vp, model);
  }
  /**
   * Handle mouse movement for camera rotation
   */
  handleMouseMove(dx, dy, sensitivity = 2e-3) {
    this.rotation[1] += dx * sensitivity;
    this.rotation[0] += dy * sensitivity;
    this.rotation[0] = Math.max(
      -Math.PI / 2 + 0.1,
      Math.min(Math.PI / 2 - 0.1, this.rotation[0])
    );
  }
  /**
   * Update aspect ratio (call when canvas resizes)
   */
  updateAspect(width, height) {
    this.aspect = width / height;
  }
  // Helper: 4x4 identity matrix
  identity() {
    const mat = new Float32Array(16);
    mat[0] = 1;
    mat[5] = 1;
    mat[10] = 1;
    mat[15] = 1;
    return mat;
  }
  // Helper: multiply two 4x4 matrices
  multiply(a, b) {
    const result = new Float32Array(16);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let i = 0; i < 4; i++) {
          sum += a[row * 4 + i] * b[i * 4 + col];
        }
        result[row * 4 + col] = sum;
      }
    }
    return result;
  }
};

// src/runtime/camera-simple.ts
var SimpleCamera = class {
  constructor() {
    __publicField(this, "position", [0, 0, 5]);
    __publicField(this, "target", [0, 0, 0]);
    __publicField(this, "up", [0, 1, 0]);
    __publicField(this, "fov", 45);
    // degrees
    __publicField(this, "aspect", 1);
    __publicField(this, "near", 0.1);
    __publicField(this, "far", 2e4);
  }
  // Increased for large rooms (was 100)
  /**
   * Get MVP matrix (combines model, view, projection)
   * Model is assumed to be identity
   */
  getMVP() {
    const proj = this.perspective();
    const view = this.lookAt();
    return this.multiplyMat4(proj, view);
  }
  /**
   * Standard perspective projection matrix
   * https://www.khronos.org/opengl/wiki/GluPerspective_code
   */
  perspective() {
    const mat = new Float32Array(16);
    const f = 1 / Math.tan(this.fov * Math.PI / 180 / 2);
    mat[0] = f / this.aspect;
    mat[1] = 0;
    mat[2] = 0;
    mat[3] = 0;
    mat[4] = 0;
    mat[5] = f;
    mat[6] = 0;
    mat[7] = 0;
    mat[8] = 0;
    mat[9] = 0;
    mat[10] = (this.far + this.near) / (this.near - this.far);
    mat[11] = -1;
    mat[12] = 0;
    mat[13] = 0;
    mat[14] = 2 * this.far * this.near / (this.near - this.far);
    mat[15] = 0;
    return mat;
  }
  /**
   * Standard lookAt view matrix
   * https://www.khronos.org/opengl/wiki/GluLookAt_code
   */
  lookAt() {
    const eye = this.position;
    const center = this.target;
    const up = this.up;
    const fx = center[0] - eye[0];
    const fy = center[1] - eye[1];
    const fz = center[2] - eye[2];
    const flen = Math.sqrt(fx * fx + fy * fy + fz * fz);
    const f = [fx / flen, fy / flen, fz / flen];
    const sx = f[1] * up[2] - f[2] * up[1];
    const sy = f[2] * up[0] - f[0] * up[2];
    const sz = f[0] * up[1] - f[1] * up[0];
    const slen = Math.sqrt(sx * sx + sy * sy + sz * sz);
    const s = [sx / slen, sy / slen, sz / slen];
    const ux = s[1] * f[2] - s[2] * f[1];
    const uy = s[2] * f[0] - s[0] * f[2];
    const uz = s[0] * f[1] - s[1] * f[0];
    const mat = new Float32Array(16);
    mat[0] = s[0];
    mat[1] = ux;
    mat[2] = -f[0];
    mat[3] = 0;
    mat[4] = s[1];
    mat[5] = uy;
    mat[6] = -f[1];
    mat[7] = 0;
    mat[8] = s[2];
    mat[9] = uz;
    mat[10] = -f[2];
    mat[11] = 0;
    mat[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
    mat[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2]);
    mat[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
    mat[15] = 1;
    return mat;
  }
  /**
   * Multiply two 4x4 matrices (column-major order)
   */
  multiplyMat4(a, b) {
    const result = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        result[i * 4 + j] = a[0 * 4 + j] * b[i * 4 + 0] + a[1 * 4 + j] * b[i * 4 + 1] + a[2 * 4 + j] * b[i * 4 + 2] + a[3 * 4 + j] * b[i * 4 + 3];
      }
    }
    return result;
  }
  /**
   * Rotate camera around target by mouse drag
   */
  rotateAroundTarget(dx, dy, sensitivity = 5e-3) {
    const rx = this.position[0] - this.target[0];
    const ry = this.position[1] - this.target[1];
    const rz = this.position[2] - this.target[2];
    const radius = Math.sqrt(rx * rx + ry * ry + rz * rz);
    let theta = Math.atan2(rx, rz);
    let phi = Math.acos(ry / radius);
    theta -= dx * sensitivity;
    phi -= dy * sensitivity;
    phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));
    this.position[0] = this.target[0] + radius * Math.sin(phi) * Math.sin(theta);
    this.position[1] = this.target[1] + radius * Math.cos(phi);
    this.position[2] = this.target[2] + radius * Math.sin(phi) * Math.cos(theta);
  }
};

// src/runtime/smpk-simple.ts
var MAGIC = [83, 77, 80, 75];
async function loadSMPK(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) {
      throw new Error("Invalid SMPK magic number");
    }
  }
  const dv = new DataView(bytes.buffer);
  const version = dv.getUint32(4, true);
  if (version !== 1) {
    throw new Error(`Unsupported SMPK version: ${version}`);
  }
  const jsonLen = dv.getUint32(8, true);
  const binLen = dv.getUint32(12, true);
  const jsonStart = 16;
  const jsonEnd = jsonStart + jsonLen;
  const binStart = jsonEnd;
  const jsonText = new TextDecoder().decode(bytes.subarray(jsonStart, jsonEnd));
  const json = JSON.parse(jsonText);
  const bin = bytes.subarray(binStart);
  if (!json.meshes || json.meshes.length === 0) {
    throw new Error("No meshes in SMPK file");
  }
  const mesh = json.meshes[0];
  const primitives = [];
  for (const primitive of mesh.primitives) {
    const positionIdx = primitive.attributes.POSITION;
    const normalIdx = primitive.attributes.NORMAL;
    const texcoordIdx = primitive.attributes.TEXCOORD_0;
    const indicesIdx = primitive.indices;
    let positions;
    let normals;
    let uvs;
    let indices;
    if (positionIdx !== void 0) {
      positions = readAccessor(bin, json.accessors[positionIdx]);
    }
    if (normalIdx !== void 0) {
      normals = readAccessor(bin, json.accessors[normalIdx]);
    }
    if (texcoordIdx !== void 0) {
      uvs = readAccessor(bin, json.accessors[texcoordIdx]);
    }
    if (indicesIdx !== void 0) {
      indices = readAccessor(bin, json.accessors[indicesIdx]);
    }
    if (!positions) {
      continue;
    }
    let texturePath;
    if (primitive.material !== void 0 && json.materials) {
      const material = json.materials[primitive.material];
      if (material?.baseColorTexture) {
        texturePath = material.baseColorTexture;
      }
    }
    primitives.push({
      positions,
      normals,
      uvs,
      indices,
      vertexCount: positions.length / 3,
      indexCount: indices ? indices.length : 0,
      texturePath
    });
  }
  return { primitives };
}
function readAccessor(bin, accessor) {
  const { offset, count, componentType, type } = accessor;
  let componentCount = 1;
  if (type === "VEC2")
    componentCount = 2;
  else if (type === "VEC3")
    componentCount = 3;
  else if (type === "VEC4")
    componentCount = 4;
  const totalCount = count * componentCount;
  const dv = new DataView(bin.buffer, bin.byteOffset + offset);
  if (componentType === "f32") {
    const result = new Float32Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      result[i] = dv.getFloat32(i * 4, true);
    }
    return result;
  } else if (componentType === "u16") {
    const result = new Uint16Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      result[i] = dv.getUint16(i * 2, true);
    }
    return result;
  } else if (componentType === "u32") {
    const result = new Uint32Array(totalCount);
    for (let i = 0; i < totalCount; i++) {
      result[i] = dv.getUint32(i * 4, true);
    }
    return result;
  } else {
    throw new Error(`Unsupported component type: ${componentType}`);
  }
}

// src/runtime/test-entry.ts
console.log("\u2705 Graphics test bundle loaded");
export {
  BlendMode,
  BufferUsage,
  Camera,
  CompareFunction,
  CullMode,
  SimpleCamera,
  TextureFormat,
  WasmStringHelper,
  createGraphicsAPI,
  createStandardVertexLayout,
  getGraphicsInfo,
  isWebGL2Supported,
  isWebGPUSupported,
  loadBlitz3DEngine,
  loadSMPK,
  toArrayBuffer
};
//# sourceMappingURL=test-graphics-bundle.js.map
