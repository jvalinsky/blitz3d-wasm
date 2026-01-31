/**
 * Scene Manager — thin orchestrator that replaces WasmSceneManager.
 *
 * Wraps EngineBridge (entity/scene management), SceneRenderer (frame rendering),
 * and GPUResources (GPU state). Handles input syncing and camera picking without
 * any Three.js dependency.
 */

import { EngineBridge, EntityType } from "./bridge.ts";
import { Renderer } from "../renderer/renderer.ts";
import { GPUResources } from "../renderer/gpu_resources.ts";
import { SceneRenderer } from "../renderer/scene_renderer.ts";
import type { ShaderSources } from "../renderer/renderer.ts";

export class SceneManager {
  readonly bridge: EngineBridge;
  readonly canvas: HTMLCanvasElement;
  readonly glRenderer: Renderer;
  readonly resources: GPUResources;
  readonly sceneRenderer: SceneRenderer;

  // Pick modes per entity (for camera picking)
  pickModes = new Map<number, number>();

  // Input Buffer (allocated in WASM memory via a Bank)
  private inputBankId = 0;
  private inputKeysPtr = 0;

  constructor(bridge: EngineBridge, canvas: HTMLCanvasElement, shaderSources: ShaderSources) {
    this.bridge = bridge;
    this.canvas = canvas;

    // Initialize WebGL2 renderer
    this.glRenderer = new Renderer(canvas);
    this.glRenderer.initShaders(shaderSources);
    this.resources = new GPUResources(this.glRenderer.gl);
    this.sceneRenderer = new SceneRenderer(bridge, this.glRenderer, this.resources);

    // Initialize scratch buffers for bridge data readback
    bridge.initScratchBuffers();

    // Allocate Input Buffer (256 bytes for keys)
    this.inputBankId = bridge.createBank(256);
    this.inputKeysPtr = bridge.getBankPtr(this.inputBankId);
  }

  resize(width: number, height: number): void {
    this.glRenderer.resize(width, height);
  }

  // ------------------------------------------------------------------
  // Entity lifecycle (delegates to bridge)
  // ------------------------------------------------------------------

  createEntity(type: number, parentId = 0): number {
    return this.bridge.exports.EngineCreateEntity(type, parentId);
  }

  freeEntity(id: number): void {
    this.sceneRenderer.freeMeshGPU(this.bridge.getEntityMeshId(id));
    this.bridge.freeEntity(id);
    this.pickModes.delete(id);
  }

  // ------------------------------------------------------------------
  // Render loop
  // ------------------------------------------------------------------

  render(inputManager?: any): void {
    // 0. Sync Input
    if (inputManager && this.inputKeysPtr > 0) {
      const keys = this.bridge.getUint8View(this.inputKeysPtr, 256);
      keys.fill(0);
      for (const k in inputManager.keysDown) {
        if (inputManager.keysDown[k]) {
          const key = parseInt(k);
          if (key >= 0 && key < 256) {
            keys[key] = 1;
          }
        }
      }

      let buttons = 0;
      if (inputManager.mouseDown[1]) buttons |= 1;
      if (inputManager.mouseDown[2]) buttons |= 2;
      if (inputManager.mouseDown[3]) buttons |= 4;

      this.bridge.updateInput(
        inputManager.mouseX,
        inputManager.mouseY,
        inputManager.mouseZ,
        buttons,
        this.inputKeysPtr,
      );
    }

    // 1. Update gameplay logic (Swift)
    this.bridge.updateGameplay();

    // 2. Begin frame
    this.glRenderer.beginFrame();
    this.glRenderer.clear();

    // 3. Render scene
    this.sceneRenderer.renderFrame();
  }

  // ------------------------------------------------------------------
  // Picking
  // ------------------------------------------------------------------

  setPickMode(id: number, mode: number): void {
    if (mode === 0) {
      this.pickModes.delete(id);
    } else {
      this.pickModes.set(id, mode);
    }
  }

  linePick(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
  ): { id: number; t: number; nx: number; ny: number; nz: number } | null {
    let closestId = 0;
    let closestT = Infinity;

    for (const [id] of this.pickModes) {
      const t = this.bridge.exports.LinePickDistance(id, x, y, z, dx, dy, dz);
      if (t > 0.001 && t < closestT) {
        closestT = t;
        closestId = id;
      }
    }

    if (closestId > 0) {
      const nx = this.bridge.exports.LinePickNX(closestId, x, y, z, dx, dy, dz);
      const ny = this.bridge.exports.LinePickNY(closestId, x, y, z, dx, dy, dz);
      const nz = this.bridge.exports.LinePickNZ(closestId, x, y, z, dx, dy, dz);
      return { id: closestId, t: closestT, nx, ny, nz };
    }
    return null;
  }

  /**
   * Camera pick: unproject screen coordinates to a world ray and perform line pick.
   * Replaces Three.js Raycaster with manual NDC → ray math.
   */
  cameraPick(
    camId: number,
    screenX: number,
    screenY: number,
  ): { id: number; x: number; y: number; z: number; nx: number; ny: number; nz: number } | null {
    const bridge = this.bridge;

    // NDC coordinates
    const ndcX = (screenX / this.canvas.width) * 2 - 1;
    const ndcY = -((screenY / this.canvas.height) * 2 - 1);

    // Get camera world matrix and params
    const camWorld = bridge.getWorldMatrix(camId);
    if (!camWorld) return null;
    const camParams = bridge.getCameraParams(camId);
    const aspect = this.canvas.width / this.canvas.height;

    // Build projection matrix
    const proj = new Float32Array(16);
    const fovRad = (camParams.fov * Math.PI) / 180;
    const f = 1.0 / Math.tan(fovRad / 2);
    const nf = 1.0 / (camParams.near - camParams.far);
    proj[0] = f / aspect; proj[5] = f;
    proj[10] = (camParams.far + camParams.near) * nf; proj[11] = -1;
    proj[14] = 2 * camParams.far * camParams.near * nf;

    // Build view matrix (inverse of camera world matrix)
    const camWorldCopy = new Float32Array(camWorld);
    const view = new Float32Array(16);
    if (!this.invert4x4(camWorldCopy, view)) return null;

    // Inverse of (proj * view)
    const projView = this.mul4x4(proj, view);
    const invProjView = new Float32Array(16);
    if (!this.invert4x4(projView, invProjView)) return null;

    // Unproject near point (NDC z = -1) and far point (NDC z = 1)
    const nearPt = this.transformPoint(invProjView, ndcX, ndcY, -1);
    const farPt = this.transformPoint(invProjView, ndcX, ndcY, 1);

    // Ray direction
    const dx = farPt[0] - nearPt[0];
    const dy = farPt[1] - nearPt[1];
    const dz = farPt[2] - nearPt[2];

    const hit = this.linePick(nearPt[0], nearPt[1], nearPt[2], dx, dy, dz);
    if (hit) {
      // Compute hit point: origin + normalize(dir) * t
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const ndx = dx / len, ndy = dy / len, ndz = dz / len;
      return {
        id: hit.id,
        x: nearPt[0] + ndx * hit.t,
        y: nearPt[1] + ndy * hit.t,
        z: nearPt[2] + ndz * hit.t,
        nx: hit.nx,
        ny: hit.ny,
        nz: hit.nz,
      };
    }
    return null;
  }

  updateWorld(step: number): void {
    this.bridge.updateWorld(step);
  }

  destroy(): void {
    this.sceneRenderer.destroy();
    this.resources.destroy();
    this.glRenderer.destroy();
  }

  // ------------------------------------------------------------------
  // Matrix math helpers (private)
  // ------------------------------------------------------------------

  private invert4x4(m: Float32Array, out: Float32Array): boolean {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
    const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
    const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
    const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
    const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (Math.abs(det) < 1e-10) return false;
    det = 1.0 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return true;
  }

  private mul4x4(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[c * 4 + r] =
          a[0 * 4 + r] * b[c * 4 + 0] +
          a[1 * 4 + r] * b[c * 4 + 1] +
          a[2 * 4 + r] * b[c * 4 + 2] +
          a[3 * 4 + r] * b[c * 4 + 3];
      }
    }
    return out;
  }

  private transformPoint(m: Float32Array, x: number, y: number, z: number): [number, number, number] {
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [
      (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
      (m[1] * x + m[5] * y + m[9] * z + m[13]) / w,
      (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
    ];
  }
}
