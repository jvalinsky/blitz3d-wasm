/**
 * GPU Resource Manager
 *
 * Manages WebGL2 resources: VAOs, vertex/index buffers, and textures.
 * Resources are referenced by integer IDs in the GL command buffer.
 */

export interface GPUBuffer {
  glBuffer: WebGLBuffer;
  target: number; // gl.ARRAY_BUFFER or gl.ELEMENT_ARRAY_BUFFER
  byteLength: number;
}

export interface GPUTexture {
  glTexture: WebGLTexture;
  width: number;
  height: number;
}

export interface GPUVAO {
  vao: WebGLVertexArrayObject;
}

/**
 * Blitz3D standard vertex layout:
 *   location 0: vec3  position  (3 floats)
 *   location 1: vec3  normal    (3 floats)
 *   location 2: vec2  uv0       (2 floats)
 *   location 3: vec2  uv1       (2 floats)
 *   location 4: vec4  color     (4 floats, or ubyte4 normalized)
 *   location 5: vec4  boneWeights (4 floats)
 *   location 6: uvec4 boneIndices (4 unsigned ints)
 *
 * For the basic (non-skinned) case the stride is:
 *   3+3+2+2+4 = 14 floats = 56 bytes
 *
 * For the engine mesh format (11 floats: pos3 + normal3 + uv2 + rgba3):
 *   We provide a helper that maps that layout too.
 */
export const VERTEX_STRIDE_FULL = 14 * 4; // 56 bytes
export const VERTEX_STRIDE_ENGINE = 11 * 4; // 44 bytes (pos3+norm3+uv2+rgb3)

export class GPUResources {
  private gl: WebGL2RenderingContext;

  private buffers = new Map<number, GPUBuffer>();
  private textures = new Map<number, GPUTexture>();
  private vaos = new Map<number, GPUVAO>();
  private nextBufferId = 1;
  private nextTextureId = 1;
  private nextVAOId = 1;

  // 1x1 white texture used as default when no texture is bound
  defaultTexture!: WebGLTexture;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.createDefaultTexture();
  }

  private createDefaultTexture(): void {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([255, 255, 255, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.defaultTexture = tex;
  }

  // ------------------------------------------------------------------
  // Buffers
  // ------------------------------------------------------------------

  createBuffer(target: number, data: ArrayBufferView, usage?: number): number {
    const gl = this.gl;
    const glBuffer = gl.createBuffer()!;
    gl.bindBuffer(target, glBuffer);
    gl.bufferData(target, data, usage ?? gl.STATIC_DRAW);
    const id = this.nextBufferId++;
    this.buffers.set(id, { glBuffer, target, byteLength: data.byteLength });
    return id;
  }

  updateBuffer(id: number, data: ArrayBufferView, offset = 0): void {
    const buf = this.buffers.get(id);
    if (!buf) return;
    const gl = this.gl;
    gl.bindBuffer(buf.target, buf.glBuffer);
    gl.bufferSubData(buf.target, offset, data);
  }

  uploadBuffer(id: number, target: number, data: ArrayBufferView): void {
    let buf = this.buffers.get(id);
    const gl = this.gl;
    if (!buf) {
      const glBuffer = gl.createBuffer()!;
      buf = { glBuffer, target, byteLength: data.byteLength };
      this.buffers.set(id, buf);
    }
    gl.bindBuffer(target, buf.glBuffer);
    if (data.byteLength > buf.byteLength) {
      gl.bufferData(target, data, gl.DYNAMIC_DRAW);
      buf.byteLength = data.byteLength;
    } else {
      gl.bufferSubData(target, 0, data);
    }
  }

  getBuffer(id: number): GPUBuffer | undefined {
    return this.buffers.get(id);
  }

  bindBuffer(id: number): void {
    const buf = this.buffers.get(id);
    if (!buf) return;
    this.gl.bindBuffer(buf.target, buf.glBuffer);
  }

  freeBuffer(id: number): void {
    const buf = this.buffers.get(id);
    if (!buf) return;
    this.gl.deleteBuffer(buf.glBuffer);
    this.buffers.delete(id);
  }

  // ------------------------------------------------------------------
  // VAOs
  // ------------------------------------------------------------------

  createVAO(): number {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    const id = this.nextVAOId++;
    this.vaos.set(id, { vao });
    return id;
  }

  bindVAO(id: number): void {
    if (id === 0) {
      this.gl.bindVertexArray(null);
      return;
    }
    const v = this.vaos.get(id);
    if (!v) return;
    this.gl.bindVertexArray(v.vao);
  }

  getVAO(id: number): GPUVAO | undefined {
    return this.vaos.get(id);
  }

  freeVAO(id: number): void {
    const v = this.vaos.get(id);
    if (!v) return;
    this.gl.deleteVertexArray(v.vao);
    this.vaos.delete(id);
  }

  /**
   * Sets up vertex attribute pointers on the currently bound VAO for
   * the engine's 11-float vertex format (pos3+norm3+uv2+rgb3).
   * Assumes the vertex buffer is already bound.
   */
  setupEngineVertexAttribs(indexBufferId?: number): void {
    const gl = this.gl;
    const stride = VERTEX_STRIDE_ENGINE; // 44

    // location 0: position (3 floats)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);

    // location 1: normal (3 floats)
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);

    // location 2: uv0 (2 floats)
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);

    // location 3: uv1 -- not present in engine format, disable
    gl.disableVertexAttribArray(3);
    gl.vertexAttrib2f(3, 0, 0);

    // location 4: color (r,g,b from floats 8,9,10 -- 3 floats, pad alpha to 1)
    // The engine stores 3 floats for RGB. We read 3 floats and set alpha = 1.
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 32);
    // Note: since we declare a_color as vec4 but only supply 3 components,
    // the w component defaults to 1.0 per GL spec.

    // location 5: boneWeights -- not used in non-skinned, disable
    gl.disableVertexAttribArray(5);
    gl.vertexAttrib4f(5, 1, 0, 0, 0);

    // location 6: boneIndices -- not used in non-skinned, disable
    gl.disableVertexAttribArray(6);
    gl.vertexAttribI4ui(6, 0, 0, 0, 0);

    // Bind index buffer to VAO
    if (indexBufferId !== undefined) {
      const ib = this.buffers.get(indexBufferId);
      if (ib) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib.glBuffer);
    }
  }

  /**
   * Creates a VAO with vertex and index buffers configured for the
   * engine's 11-float vertex format.
   */
  createEngineVAO(vertexBufferId: number, indexBufferId: number): number {
    const vaoId = this.createVAO();
    this.bindVAO(vaoId);
    this.bindBuffer(vertexBufferId);
    this.setupEngineVertexAttribs(indexBufferId);
    this.bindVAO(0);
    return vaoId;
  }

  // ------------------------------------------------------------------
  // Textures
  // ------------------------------------------------------------------

  createTexture(
    image: ImageBitmap | HTMLImageElement | HTMLCanvasElement,
    flags?: number,
  ): number {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    // Blitz3D texture flags:
    // 1 = color, 2 = alpha, 4 = masked, 8 = mipmapped,
    // 16 = clamp_u, 32 = clamp_v, 64 = spheremap
    const f = flags ?? 0;
    const mipmap = (f & 8) !== 0;
    const clampU = (f & 16) !== 0;
    const clampV = (f & 32) !== 0;

    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      clampU ? gl.CLAMP_TO_EDGE : gl.REPEAT,
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      clampV ? gl.CLAMP_TO_EDGE : gl.REPEAT,
    );

    if (mipmap) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        gl.LINEAR_MIPMAP_LINEAR,
      );
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const id = this.nextTextureId++;
    this.textures.set(id, {
      glTexture: tex,
      width: "width" in image ? image.width : 0,
      height: "height" in image ? image.height : 0,
    });
    return id;
  }

  bindTexture(unit: number, id: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (id === 0) {
      gl.bindTexture(gl.TEXTURE_2D, this.defaultTexture);
      return;
    }
    const t = this.textures.get(id);
    if (!t) {
      gl.bindTexture(gl.TEXTURE_2D, this.defaultTexture);
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, t.glTexture);
  }

  getTexture(id: number): GPUTexture | undefined {
    return this.textures.get(id);
  }

  /** Register an externally-created WebGL texture for tracking. */
  registerTexture(
    glTexture: WebGLTexture,
    width: number,
    height: number,
  ): number {
    const id = this.nextTextureId++;
    this.textures.set(id, { glTexture, width, height });
    return id;
  }

  freeTexture(id: number): void {
    const t = this.textures.get(id);
    if (!t) return;
    this.gl.deleteTexture(t.glTexture);
    this.textures.delete(id);
  }

  // ------------------------------------------------------------------
  // Cleanup
  // ------------------------------------------------------------------

  destroy(): void {
    for (const [, b] of this.buffers) this.gl.deleteBuffer(b.glBuffer);
    for (const [, t] of this.textures) this.gl.deleteTexture(t.glTexture);
    for (const [, v] of this.vaos) this.gl.deleteVertexArray(v.vao);
    this.gl.deleteTexture(this.defaultTexture);
    this.buffers.clear();
    this.textures.clear();
    this.vaos.clear();
  }
}
