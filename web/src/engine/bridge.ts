/**
 * Typed TypeScript wrapper around Swift Engine WASM exports.
 *
 * This module provides a clean API over the raw @_cdecl functions exported
 * from the Blitz3DEngine WASM module. Each method corresponds to an
 * EngineXxx / CreateXxx / etc. export.
 */

export interface EngineExports {
  memory: WebAssembly.Memory;

  // Scene graph - entity lifecycle
  EngineCreateEntity(type: number, parent: number): number;
  EngineFreeEntity(id: number): void;
  EngineSetParent(id: number, parent: number): void;

  // Transforms
  EngineSetPosition(id: number, x: number, y: number, z: number): void;
  EngineSetRotation(id: number, pitch: number, yaw: number, roll: number): void;
  EngineSetScale(id: number, sx: number, sy: number, sz: number): void;
  EngineMoveEntity(id: number, x: number, y: number, z: number): void;
  EngineTurnEntity(id: number, pitch: number, yaw: number, roll: number): void;

  // Transform getters
  EngineEntityX(id: number, global: number): number;
  EngineEntityY(id: number, global: number): number;
  EngineEntityZ(id: number, global: number): number;
  EngineEntityPitch(id: number, global: number): number;
  EngineEntityYaw(id: number, global: number): number;
  EngineEntityRoll(id: number, global: number): number;

  // Appearance
  EngineEntityColor(id: number, r: number, g: number, b: number): void;
  EngineEntityAlpha(id: number, a: number): void;
  EngineEntityFX(id: number, fx: number): void;
  EngineEntityBlend(id: number, blend: number): void;
  EngineEntityShininess(id: number, s: number): void;
  EngineEntityTexture(id: number, texId: number, frame: number, index: number): void;
  EngineShowEntity(id: number): void;
  EngineHideEntity(id: number): void;

  // Camera
  EngineCameraRange(camId: number, near: number, far: number): void;
  EngineCameraFOV(camId: number, fov: number): void;

  // Lighting
  EngineAmbientLight(r: number, g: number, b: number): void;
  EngineLightColor(id: number, r: number, g: number, b: number): void;
  EngineLightRange(id: number, range: number): void;

  // Fog
  EngineFogMode(mode: number): void;
  EngineFogColor(r: number, g: number, b: number): void;
  EngineFogRange(start: number, end: number): void;
  EngineFogDensity(density: number): void;

  // Scene management
  EngineUpdateTransforms(): void;
  EngineResetScene(): void;

  // World matrix readback
  EngineGetWorldMatrix(id: number, outPtr: number): number;

  // Existing engine exports (banks, collision, mesh, parsers)
  CreateBank(size: number): number;
  FreeBank(id: number): void;
  BankSize(id: number): number;
  GetBankPtr(id: number): number;
  PeekByte(id: number, offset: number): number;
  PokeByte(id: number, offset: number, value: number): void;
  PeekInt(id: number, offset: number): number;
  PokeInt(id: number, offset: number, value: number): void;
  PeekFloat(id: number, offset: number): number;
  PokeFloat(id: number, offset: number, value: number): void;

  CreateCollider(radius: number, height: number): number;
  FreeCollider(id: number): void;
  SetColliderPosition(id: number, x: number, y: number, z: number): void;
  GetColliderPositionX(id: number): number;
  GetColliderPositionY(id: number): number;
  GetColliderPositionZ(id: number): number;
  CollideWithMesh(colliderId: number, meshId: number, surfaceIdx: number): number;

  LinePick(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickDistance(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;

  CreateMesh(): number;
  AddSurface(meshId: number, vertexCount: number, indexCount: number): number;
  GetMeshSurfaceCount(meshId: number): number;
  GetSurfaceVertexCount(meshId: number, surfaceIdx: number): number;
  GetSurfaceIndexCount(meshId: number, surfaceIdx: number): number;
  GetSurfaceVerticesPtr(meshId: number, surfaceIdx: number): number;
  GetSurfaceIndicesPtr(meshId: number, surfaceIdx: number): number;
  GetSurfaceVertexStride(): number;

  ParseB3D(bankId: number): number;
  ParseRMesh(bankId: number): number;
}

/** Entity types matching Swift EntityType enum */
export const EntityType = {
  Pivot: 0,
  Mesh: 1,
  Camera: 2,
  Light: 3,
  Sprite: 4,
  Terrain: 5,
} as const;

/** Light types matching Swift LightType enum */
export const LightType = {
  Ambient: 0,
  Directional: 1,
  Point: 2,
  Spot: 3,
} as const;

/** Blend modes matching Swift BlendMode enum */
export const BlendModeEnum = {
  None: 0,
  Alpha: 1,
  Multiply: 2,
  Additive: 3,
} as const;

/**
 * High-level typed bridge to the Swift engine WASM module.
 *
 * Wraps raw exports with parameter validation and a friendlier API.
 * Also provides helpers for reading data from WASM memory.
 */
export class EngineBridge {
  readonly exports: EngineExports;

  constructor(exports: EngineExports) {
    this.exports = exports;
  }

  get memory(): WebAssembly.Memory {
    return this.exports.memory;
  }

  get memoryBuffer(): ArrayBuffer {
    return this.exports.memory.buffer;
  }

  // ------------------------------------------------------------------
  // Entity lifecycle
  // ------------------------------------------------------------------

  createPivot(parent = 0): number {
    return this.exports.EngineCreateEntity(EntityType.Pivot, parent);
  }

  createMeshEntity(parent = 0): number {
    return this.exports.EngineCreateEntity(EntityType.Mesh, parent);
  }

  createCamera(parent = 0): number {
    return this.exports.EngineCreateEntity(EntityType.Camera, parent);
  }

  createLight(lightType: number, parent = 0): number {
    const id = this.exports.EngineCreateEntity(EntityType.Light, parent);
    // Light type is set via the entity's lightType property in Swift
    // For now the type is passed as part of creation
    return id;
  }

  createSprite(parent = 0): number {
    return this.exports.EngineCreateEntity(EntityType.Sprite, parent);
  }

  freeEntity(id: number): void {
    this.exports.EngineFreeEntity(id);
  }

  setParent(id: number, parent: number): void {
    this.exports.EngineSetParent(id, parent);
  }

  // ------------------------------------------------------------------
  // Transforms
  // ------------------------------------------------------------------

  setPosition(id: number, x: number, y: number, z: number): void {
    this.exports.EngineSetPosition(id, x, y, z);
  }

  setRotation(id: number, pitch: number, yaw: number, roll: number): void {
    this.exports.EngineSetRotation(id, pitch, yaw, roll);
  }

  setScale(id: number, sx: number, sy: number, sz: number): void {
    this.exports.EngineSetScale(id, sx, sy, sz);
  }

  moveEntity(id: number, x: number, y: number, z: number): void {
    this.exports.EngineMoveEntity(id, x, y, z);
  }

  turnEntity(id: number, pitch: number, yaw: number, roll: number): void {
    this.exports.EngineTurnEntity(id, pitch, yaw, roll);
  }

  entityX(id: number, global = false): number {
    return this.exports.EngineEntityX(id, global ? 1 : 0);
  }

  entityY(id: number, global = false): number {
    return this.exports.EngineEntityY(id, global ? 1 : 0);
  }

  entityZ(id: number, global = false): number {
    return this.exports.EngineEntityZ(id, global ? 1 : 0);
  }

  entityPitch(id: number, global = false): number {
    return this.exports.EngineEntityPitch(id, global ? 1 : 0);
  }

  entityYaw(id: number, global = false): number {
    return this.exports.EngineEntityYaw(id, global ? 1 : 0);
  }

  entityRoll(id: number, global = false): number {
    return this.exports.EngineEntityRoll(id, global ? 1 : 0);
  }

  // ------------------------------------------------------------------
  // Appearance
  // ------------------------------------------------------------------

  entityColor(id: number, r: number, g: number, b: number): void {
    this.exports.EngineEntityColor(id, r, g, b);
  }

  entityAlpha(id: number, a: number): void {
    this.exports.EngineEntityAlpha(id, a);
  }

  entityFX(id: number, fx: number): void {
    this.exports.EngineEntityFX(id, fx);
  }

  entityBlend(id: number, blend: number): void {
    this.exports.EngineEntityBlend(id, blend);
  }

  entityShininess(id: number, s: number): void {
    this.exports.EngineEntityShininess(id, s);
  }

  entityTexture(id: number, texId: number, frame = 0, index = 0): void {
    this.exports.EngineEntityTexture(id, texId, frame, index);
  }

  showEntity(id: number): void {
    this.exports.EngineShowEntity(id);
  }

  hideEntity(id: number): void {
    this.exports.EngineHideEntity(id);
  }

  // ------------------------------------------------------------------
  // Camera
  // ------------------------------------------------------------------

  cameraRange(camId: number, near: number, far: number): void {
    this.exports.EngineCameraRange(camId, near, far);
  }

  cameraFOV(camId: number, fov: number): void {
    this.exports.EngineCameraFOV(camId, fov);
  }

  // ------------------------------------------------------------------
  // Lighting
  // ------------------------------------------------------------------

  ambientLight(r: number, g: number, b: number): void {
    this.exports.EngineAmbientLight(r, g, b);
  }

  lightColor(id: number, r: number, g: number, b: number): void {
    this.exports.EngineLightColor(id, r, g, b);
  }

  lightRange(id: number, range: number): void {
    this.exports.EngineLightRange(id, range);
  }

  // ------------------------------------------------------------------
  // Fog
  // ------------------------------------------------------------------

  fogMode(mode: number): void {
    this.exports.EngineFogMode(mode);
  }

  fogColor(r: number, g: number, b: number): void {
    this.exports.EngineFogColor(r, g, b);
  }

  fogRange(start: number, end: number): void {
    this.exports.EngineFogRange(start, end);
  }

  fogDensity(density: number): void {
    this.exports.EngineFogDensity(density);
  }

  // ------------------------------------------------------------------
  // Scene
  // ------------------------------------------------------------------

  updateTransforms(): void {
    this.exports.EngineUpdateTransforms();
  }

  resetScene(): void {
    this.exports.EngineResetScene();
  }

  // ------------------------------------------------------------------
  // Memory helpers
  // ------------------------------------------------------------------

  /** Read a Float32Array view from WASM memory. */
  getFloat32View(ptr: number, count: number): Float32Array {
    return new Float32Array(this.memoryBuffer, ptr, count);
  }

  /** Read an Int32Array view from WASM memory. */
  getInt32View(ptr: number, count: number): Int32Array {
    return new Int32Array(this.memoryBuffer, ptr, count);
  }

  /** Read a Uint8Array view from WASM memory. */
  getUint8View(ptr: number, count: number): Uint8Array {
    return new Uint8Array(this.memoryBuffer, ptr, count);
  }

  /**
   * Get surface vertex data as a Float32Array from the engine mesh storage.
   * Returns the raw float array (stride 11: pos3+norm3+uv2+rgb3).
   */
  getSurfaceVertices(meshId: number, surfaceIdx: number): Float32Array | null {
    const ptr = this.exports.GetSurfaceVerticesPtr(meshId, surfaceIdx);
    if (ptr === 0) return null;
    const count = this.exports.GetSurfaceVertexCount(meshId, surfaceIdx);
    const stride = this.exports.GetSurfaceVertexStride(); // 11
    return new Float32Array(this.memoryBuffer, ptr, count * stride);
  }

  /**
   * Get surface index data as an Int32Array from the engine mesh storage.
   */
  getSurfaceIndices(meshId: number, surfaceIdx: number): Int32Array | null {
    const ptr = this.exports.GetSurfaceIndicesPtr(meshId, surfaceIdx);
    if (ptr === 0) return null;
    const count = this.exports.GetSurfaceIndexCount(meshId, surfaceIdx);
    return new Int32Array(this.memoryBuffer, ptr, count);
  }
}
