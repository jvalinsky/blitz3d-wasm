/**
 * Scene Renderer — renders the Swift engine's scene graph using WebGL2.
 *
 * Reads entity/camera/light data from the engine via EngineBridge,
 * sets up WebGL2 state (uniforms, textures, blend modes), and draws
 * meshes using the existing shaders and GPU resources.
 */

import type { EngineBridge } from "../engine/bridge.ts";
import type { CompiledProgram, Renderer } from "./renderer.ts";
import type { GPUResources } from "./gpu_resources.ts";

// FX flag bits (matching Blitz3D / Entity.swift)
const FX_FULLBRIGHT = 1;
const FX_VERTEXCOLOR = 2;
// const FX_FLATSHADE = 4;
const FX_NOFOG = 8;
const FX_NOCULL = 16;
const FX_NOZBUFFER = 32;

// Blend modes
const BLEND_ALPHA = 1;
// const BLEND_MULTIPLY = 2;
const BLEND_ADDITIVE = 3;

interface SurfaceGPU {
  vaoId: number;
  vboId: number;
  iboId: number;
  indexCount: number;
  /** Hash of vertex data byte length, used to detect changes. */
  vertexBytes: number;
}

/** Per-entity sort key for depth sorting. */
interface RenderItem {
  entityId: number;
  depth: number;
  blend: number;
}

/**
 * Computes the 3x3 normal matrix from the upper-left 3x3 of a 4x4 column-major
 * model matrix. This is the transpose of the inverse of the upper-left 3x3.
 * For uniform-scale transforms, the upper-left 3x3 itself works (it's orthogonal).
 * We compute the proper inverse-transpose for correctness with non-uniform scale.
 */
function normalMatrix3x3(m: Float32Array, out: Float32Array): void {
  const a00 = m[0], a01 = m[1], a02 = m[2];
  const a10 = m[4], a11 = m[5], a12 = m[6];
  const a20 = m[8], a21 = m[9], a22 = m[10];

  const det = a00 * (a11 * a22 - a12 * a21) -
    a01 * (a10 * a22 - a12 * a20) +
    a02 * (a10 * a21 - a11 * a20);

  if (Math.abs(det) < 1e-10) {
    // Degenerate — just use identity
    out[0] = 1;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    return;
  }

  const invDet = 1.0 / det;
  // cofactor matrix, transposed (= inverse-transpose of 3x3)
  out[0] = (a11 * a22 - a12 * a21) * invDet;
  out[1] = (a02 * a21 - a01 * a22) * invDet;
  out[2] = (a01 * a12 - a02 * a11) * invDet;
  out[3] = (a12 * a20 - a10 * a22) * invDet;
  out[4] = (a00 * a22 - a02 * a20) * invDet;
  out[5] = (a02 * a10 - a00 * a12) * invDet;
  out[6] = (a10 * a21 - a11 * a20) * invDet;
  out[7] = (a01 * a20 - a00 * a21) * invDet;
  out[8] = (a00 * a11 - a01 * a10) * invDet;
}

/**
 * Invert a 4x4 column-major matrix. Returns false if singular.
 */
function invert4x4(m: Float32Array, out: Float32Array): boolean {
  const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
  const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
  const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
  const m30 = m[12], m31 = m[13], m32 = m[14], m33 = m[15];

  const b00 = m00 * m11 - m01 * m10;
  const b01 = m00 * m12 - m02 * m10;
  const b02 = m00 * m13 - m03 * m10;
  const b03 = m01 * m12 - m02 * m11;
  const b04 = m01 * m13 - m03 * m11;
  const b05 = m02 * m13 - m03 * m12;
  const b06 = m20 * m31 - m21 * m30;
  const b07 = m20 * m32 - m22 * m30;
  const b08 = m20 * m33 - m23 * m30;
  const b09 = m21 * m32 - m22 * m31;
  const b10 = m21 * m33 - m23 * m31;
  const b11 = m22 * m33 - m23 * m32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 +
    b05 * b06;
  if (Math.abs(det) < 1e-10) return false;
  det = 1.0 / det;

  out[0] = (m11 * b11 - m12 * b10 + m13 * b09) * det;
  out[1] = (m02 * b10 - m01 * b11 - m03 * b09) * det;
  out[2] = (m31 * b05 - m32 * b04 + m33 * b03) * det;
  out[3] = (m22 * b04 - m21 * b05 - m23 * b03) * det;
  out[4] = (m12 * b08 - m10 * b11 - m13 * b07) * det;
  out[5] = (m00 * b11 - m02 * b08 + m03 * b07) * det;
  out[6] = (m32 * b02 - m30 * b05 - m33 * b01) * det;
  out[7] = (m20 * b05 - m22 * b02 + m23 * b01) * det;
  out[8] = (m10 * b10 - m11 * b08 + m13 * b06) * det;
  out[9] = (m01 * b08 - m00 * b10 - m03 * b06) * det;
  out[10] = (m30 * b04 - m31 * b02 + m33 * b00) * det;
  out[11] = (m21 * b02 - m20 * b04 - m23 * b00) * det;
  out[12] = (m11 * b07 - m10 * b09 - m12 * b06) * det;
  out[13] = (m00 * b09 - m01 * b07 + m02 * b06) * det;
  out[14] = (m31 * b01 - m30 * b03 - m32 * b00) * det;
  out[15] = (m20 * b03 - m21 * b01 + m22 * b00) * det;
  return true;
}

/**
 * Build a perspective projection matrix (column-major) matching the Swift
 * engine's convention.
 */
function perspectiveMatrix(
  fovDeg: number,
  aspect: number,
  near: number,
  far: number,
  out: Float32Array,
): void {
  const f = 1.0 / Math.tan((fovDeg * Math.PI) / 360.0);
  const nf = 1.0 / (near - far);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = 2.0 * far * near * nf;
  out[15] = 0;
}

export class SceneRenderer {
  private bridge: EngineBridge;
  private renderer: Renderer;
  private resources: GPUResources;

  /** GPU resource cache: keyed by "meshId_surfaceIdx". */
  private surfaceCache = new Map<string, SurfaceGPU>();

  // Pre-allocated scratch arrays to avoid per-frame allocations
  private _viewMatrix = new Float32Array(16);
  private _projMatrix = new Float32Array(16);
  private _normalMat = new Float32Array(9);
  private _modelCopy = new Float32Array(16);
  private _invWorld = new Float32Array(16);

  constructor(
    bridge: EngineBridge,
    renderer: Renderer,
    resources: GPUResources,
  ) {
    this.bridge = bridge;
    this.renderer = renderer;
    this.resources = resources;
  }

  /**
   * Render one frame from the engine's scene graph.
   */
  renderFrame(): void {
    const bridge = this.bridge;
    const gl = this.renderer.gl;

    // 1. Update all dirty world matrices
    bridge.updateTransforms();

    // 2. Find active camera
    const camId = bridge.getActiveCameraId();
    if (camId === 0) return; // No camera, nothing to render

    const camParams = bridge.getCameraParams(camId);
    const aspect = gl.canvas.width / gl.canvas.height;

    // Build view matrix (inverse of camera world matrix)
    const camWorld = bridge.getWorldMatrix(camId);
    if (!camWorld) return;
    // Copy since the bridge scratch buffer may be reused
    this._modelCopy.set(camWorld);
    if (!invert4x4(this._modelCopy, this._viewMatrix)) return;

    // Build projection matrix
    perspectiveMatrix(
      camParams.fov,
      aspect,
      camParams.near,
      camParams.far,
      this._projMatrix,
    );

    // Camera world position (column 3 of camera world matrix)
    const camX = this._modelCopy[12];
    const camY = this._modelCopy[13];
    const camZ = this._modelCopy[14];

    // 3. Read global state
    const ambient = bridge.getAmbientColor();
    const ambR = ambient[0], ambG = ambient[1], ambB = ambient[2];
    const fog = bridge.getFogState();

    // 4. Collect lights (up to 8)
    const lightIds = bridge.collectLights();
    const lightCount = Math.min(lightIds.length, 8);
    // We'll need per-light data: copy IDs since bridge scratch may be reused
    const lightIdsCopy = new Int32Array(lightCount);
    for (let i = 0; i < lightCount; i++) lightIdsCopy[i] = lightIds[i];

    // 5. Use standard program
    const prog = this.renderer.useProgram("standard");

    // 6. Set per-frame uniforms
    this.setUniformMat4(prog, "u_viewMatrix", this._viewMatrix);
    this.setUniformMat4(prog, "u_projMatrix", this._projMatrix);
    this.setUniform3f(prog, "u_ambientColor", ambR, ambG, ambB);
    this.setUniform3f(prog, "u_cameraPos", camX, camY, camZ);
    this.setUniform1i(prog, "u_fog_mode", fog.mode);
    if (fog.mode !== 0) {
      this.setUniform3f(prog, "u_fogColor", fog.r, fog.g, fog.b);
      this.setUniform1f(prog, "u_fogStart", fog.start);
      this.setUniform1f(prog, "u_fogEnd", fog.end);
      this.setUniform1f(prog, "u_fogDensity", fog.density);
    }
    this.setUniform1i(prog, "u_useSkinning", 0);
    this.setUniform1i(prog, "u_lightCount", lightCount);

    // Set light uniforms
    for (let i = 0; i < lightCount; i++) {
      const lid = lightIdsCopy[i];
      const prefix = `u_lights[${i}]`;

      const lType = bridge.getLightType(lid);
      this.setUniform1i(prog, `${prefix}.type`, lType);

      const lColor = bridge.getLightColor(lid);
      this.setUniform3f(
        prog,
        `${prefix}.color`,
        lColor[0],
        lColor[1],
        lColor[2],
      );

      this.setUniform1f(prog, `${prefix}.range`, bridge.getLightRange(lid));

      // Position and direction from world matrix
      const lWorld = bridge.getWorldMatrix(lid);
      if (lWorld) {
        // Position = column 3
        this.setUniform3f(
          prog,
          `${prefix}.position`,
          lWorld[12],
          lWorld[13],
          lWorld[14],
        );
        // Direction = column 2 (forward in Blitz3D convention)
        this.setUniform3f(
          prog,
          `${prefix}.direction`,
          lWorld[8],
          lWorld[9],
          lWorld[10],
        );
      }

      if (lType === 3) { // spot
        const cones = bridge.getLightCones(lid);
        this.setUniform1f(
          prog,
          `${prefix}.innerCone`,
          Math.cos(cones.inner * Math.PI / 180),
        );
        this.setUniform1f(
          prog,
          `${prefix}.outerCone`,
          Math.cos(cones.outer * Math.PI / 180),
        );
      } else {
        this.setUniform1f(prog, `${prefix}.innerCone`, 0);
        this.setUniform1f(prog, `${prefix}.outerCone`, -1);
      }
    }
    // Zero out unused light slots
    for (let i = lightCount; i < 8; i++) {
      this.setUniform1i(prog, `u_lights[${i}].type`, 0);
    }

    // 7. Collect renderables
    const entityIds = bridge.collectRenderables();
    // Copy since scratch may be reused during iteration
    const ids = new Int32Array(entityIds.length);
    ids.set(entityIds);

    // 8. Build sort list
    const items: RenderItem[] = [];
    for (let i = 0; i < ids.length; i++) {
      const eid = ids[i];
      const blend = bridge.getEntityBlend(eid);
      const alpha = bridge.getEntityAlpha(eid);
      const meshId = bridge.getEntityMeshId(eid);
      if (meshId === 0) continue; // No mesh attached

      // Compute view-space depth for sorting
      const w = bridge.getWorldMatrix(eid);
      if (!w) continue;
      // View-space Z of entity origin
      const vz = this._viewMatrix[2] * w[12] +
        this._viewMatrix[6] * w[13] +
        this._viewMatrix[10] * w[14] +
        this._viewMatrix[14];
      const isTransparent = blend === BLEND_ALPHA && alpha < 1.0 ||
        blend === BLEND_ADDITIVE;
      items.push({ entityId: eid, depth: vz, blend: isTransparent ? 1 : 0 });
    }

    // Sort: opaque front-to-back (depth ascending = less negative first),
    //        transparent back-to-front (depth descending)
    items.sort((a, b) => {
      if (a.blend !== b.blend) return a.blend - b.blend; // opaque first
      if (a.blend === 0) return b.depth - a.depth; // opaque: front-to-back (larger depth = closer in -Z)
      return a.depth - b.depth; // transparent: back-to-front
    });

    // 9. Render each entity
    let lastBlendState = -1;
    for (const item of items) {
      this.renderEntity(prog, gl, item, lastBlendState);
      lastBlendState = item.blend;
    }

    // Restore state
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
  }

  private renderEntity(
    prog: CompiledProgram,
    gl: WebGL2RenderingContext,
    item: RenderItem,
    lastBlendState: number,
  ): void {
    const bridge = this.bridge;
    const eid = item.entityId;

    // a. World matrix
    const worldMat = bridge.getWorldMatrix(eid);
    if (!worldMat) return;
    this._modelCopy.set(worldMat);
    this.setUniformMat4(prog, "u_modelMatrix", this._modelCopy);

    // Normal matrix
    normalMatrix3x3(this._modelCopy, this._normalMat);
    this.setUniformMat3(prog, "u_normalMatrix", this._normalMat);

    // b. Material properties
    const brushColor = bridge.getEntityBrushColor(eid);
    const alpha = bridge.getEntityAlpha(eid);
    this.setUniform4f(
      prog,
      "u_brushColor",
      brushColor[0],
      brushColor[1],
      brushColor[2],
      alpha,
    );

    const fx = bridge.getEntityFX(eid);
    this.setUniform1i(prog, "u_entityFX", fx);

    const shininess = bridge.getEntityShininess(eid);
    this.setUniform1f(prog, "u_brushShininess", shininess);

    const blend = bridge.getEntityBlend(eid);
    this.setUniform1i(prog, "u_blendMode", blend);

    // c. GL state from FX flags and blend mode
    if (item.blend !== lastBlendState) {
      if (item.blend === 1) {
        // Transparent pass
        gl.enable(gl.BLEND);
        gl.depthMask(false);
      } else {
        gl.disable(gl.BLEND);
        gl.depthMask(true);
      }
    }

    if (blend === BLEND_ADDITIVE) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    } else if (blend === BLEND_ALPHA) {
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    // Cull face
    if (fx & FX_NOCULL) {
      gl.disable(gl.CULL_FACE);
    } else {
      gl.enable(gl.CULL_FACE);
    }

    // Depth test
    if (fx & FX_NOZBUFFER) {
      gl.disable(gl.DEPTH_TEST);
    } else {
      gl.enable(gl.DEPTH_TEST);
    }

    // d. Textures
    const texId0 = bridge.getEntityTextureId(eid, 0);
    const texId1 = bridge.getEntityTextureId(eid, 1);

    if (texId0 > 0) {
      this.resources.bindTexture(0, texId0);
      this.setUniform1i(prog, "u_hasTexture0", 1);
      this.setUniform1i(prog, "u_texture0", 0);
      this.setUniform1i(
        prog,
        "u_textureBlend0",
        bridge.getEntityTextureBlend(eid, 0),
      );
    } else {
      this.resources.bindTexture(0, 0); // default
      this.setUniform1i(prog, "u_hasTexture0", 0);
    }

    if (texId1 > 0) {
      this.resources.bindTexture(1, texId1);
      this.setUniform1i(prog, "u_hasTexture1", 1);
      this.setUniform1i(prog, "u_texture1", 1);
      this.setUniform1i(
        prog,
        "u_textureBlend1",
        bridge.getEntityTextureBlend(eid, 1),
      );
    } else {
      this.setUniform1i(prog, "u_hasTexture1", 0);
    }

    // e. Draw each surface of the entity's mesh
    const meshId = bridge.getEntityMeshId(eid);
    const surfaceCount = bridge.getMeshSurfaceCount(meshId);
    for (let si = 0; si < surfaceCount; si++) {
      const gpu = this.ensureSurfaceGPU(meshId, si);
      if (!gpu || gpu.indexCount === 0) continue;

      this.resources.bindVAO(gpu.vaoId);
      gl.drawElements(gl.TRIANGLES, gpu.indexCount, gl.UNSIGNED_INT, 0);
    }

    this.resources.bindVAO(0);
  }

  /**
   * Lazily upload surface vertex/index data from WASM memory to GPU buffers.
   * Returns the cached GPU handles.
   */
  private ensureSurfaceGPU(
    meshId: number,
    surfaceIdx: number,
  ): SurfaceGPU | null {
    const key = `${meshId}_${surfaceIdx}`;
    const bridge = this.bridge;
    const gl = this.renderer.gl;

    const vertData = bridge.getSurfaceVertices(meshId, surfaceIdx);
    const idxData = bridge.getSurfaceIndices(meshId, surfaceIdx);
    if (
      !vertData || !idxData || vertData.length === 0 || idxData.length === 0
    ) return null;

    const existing = this.surfaceCache.get(key);
    if (existing && existing.vertexBytes === vertData.byteLength) {
      return existing;
    }

    // Need to create or re-upload
    if (existing) {
      // Re-upload
      this.resources.bindVAO(existing.vaoId);
      const vb = this.resources.getBuffer(existing.vboId);
      if (vb) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vb.glBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertData, gl.STATIC_DRAW);
      }
      const ib = this.resources.getBuffer(existing.iboId);
      if (ib) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib.glBuffer);
        // Convert Int32 indices to Uint32 for drawElements
        const uint32Indices = new Uint32Array(
          idxData.buffer,
          idxData.byteOffset,
          idxData.length,
        );
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, uint32Indices, gl.STATIC_DRAW);
      }
      existing.indexCount = idxData.length;
      existing.vertexBytes = vertData.byteLength;
      this.resources.bindVAO(0);
      return existing;
    }

    // Create new
    const vboId = this.resources.createBuffer(gl.ARRAY_BUFFER, vertData);
    // Convert Int32 indices to Uint32
    const uint32Indices = new Uint32Array(
      idxData.buffer,
      idxData.byteOffset,
      idxData.length,
    );
    const iboId = this.resources.createBuffer(
      gl.ELEMENT_ARRAY_BUFFER,
      uint32Indices,
    );
    const vaoId = this.resources.createEngineVAO(vboId, iboId);

    const gpu: SurfaceGPU = {
      vaoId,
      vboId,
      iboId,
      indexCount: idxData.length,
      vertexBytes: vertData.byteLength,
    };
    this.surfaceCache.set(key, gpu);
    return gpu;
  }

  /**
   * Free all cached GPU resources for a given mesh.
   */
  freeMeshGPU(meshId: number): void {
    for (const [key, gpu] of this.surfaceCache) {
      if (key.startsWith(`${meshId}_`)) {
        this.resources.freeVAO(gpu.vaoId);
        this.resources.freeBuffer(gpu.vboId);
        this.resources.freeBuffer(gpu.iboId);
        this.surfaceCache.delete(key);
      }
    }
  }

  /**
   * Invalidate the GPU cache entry for a surface so it gets re-uploaded next frame.
   */
  invalidateSurface(meshId: number, surfaceIdx: number): void {
    const key = `${meshId}_${surfaceIdx}`;
    const existing = this.surfaceCache.get(key);
    if (existing) existing.vertexBytes = -1; // force re-upload
  }

  destroy(): void {
    for (const [, gpu] of this.surfaceCache) {
      this.resources.freeVAO(gpu.vaoId);
      this.resources.freeBuffer(gpu.vboId);
      this.resources.freeBuffer(gpu.iboId);
    }
    this.surfaceCache.clear();
  }

  // ------------------------------------------------------------------
  // Uniform setter helpers (thin wrappers to avoid null-check boilerplate)
  // ------------------------------------------------------------------

  private setUniform1i(prog: CompiledProgram, name: string, v: number): void {
    const loc = prog.uniforms.get(name);
    if (loc !== undefined) this.renderer.gl.uniform1i(loc, v);
  }

  private setUniform1f(prog: CompiledProgram, name: string, v: number): void {
    const loc = prog.uniforms.get(name);
    if (loc !== undefined) this.renderer.gl.uniform1f(loc, v);
  }

  private setUniform3f(
    prog: CompiledProgram,
    name: string,
    x: number,
    y: number,
    z: number,
  ): void {
    const loc = prog.uniforms.get(name);
    if (loc !== undefined) this.renderer.gl.uniform3f(loc, x, y, z);
  }

  private setUniform4f(
    prog: CompiledProgram,
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
  ): void {
    const loc = prog.uniforms.get(name);
    if (loc !== undefined) this.renderer.gl.uniform4f(loc, x, y, z, w);
  }

  private setUniformMat3(
    prog: CompiledProgram,
    name: string,
    m: Float32Array,
  ): void {
    const loc = prog.uniforms.get(name);
    if (loc !== undefined) this.renderer.gl.uniformMatrix3fv(loc, false, m);
  }

  private setUniformMat4(
    prog: CompiledProgram,
    name: string,
    m: Float32Array,
  ): void {
    const loc = prog.uniforms.get(name);
    if (loc !== undefined) this.renderer.gl.uniformMatrix4fv(loc, false, m);
  }
}
