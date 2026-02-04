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

  // Physics / Dynamics
  EngineCollisions(srcType: number, destType: number, method: number, response: number): void;
  EngineUpdateWorld(step: number): void;
  EngineResetEntity(id: number): void;
  EngineEntityType(id: number, type: number): void;
  EngineEntityRadius(id: number, rx: number, ry: number): void;
  EngineEntityBox(id: number, x: number, y: number, z: number, w: number, h: number, d: number): void;
  EngineEntityCollided(id: number, typeIdx: number): number;
  EngineEntityPickMode(entityId: number, mode: number): void; // Added
  EngineCountCollisions(id: number): number;
  EngineCollisionX(id: number, index: number): number;
  EngineCollisionY(id: number, index: number): number;
  EngineCollisionZ(id: number, index: number): number;
  EngineCollisionNX(id: number, index: number): number;
  EngineCollisionNY(id: number, index: number): number;
  EngineCollisionNZ(id: number, index: number): number;
  EngineCollisionEntity(id: number, index: number): number;

  // World matrix readback
  EngineGetWorldMatrix(id: number, outPtr: number): number;

  // Entity enumeration for rendering
  EngineCollectRenderables(outPtr: number, maxCount: number): number;
  EngineCollectLights(outPtr: number, maxCount: number): number;
  EngineGetActiveCameraId(): number;

  // Per-entity property getters
  EngineGetEntityType(id: number): number;
  EngineGetEntityMeshId(id: number): number;
  EngineSetEntityMesh(id: number, meshId: number): void;
  EngineGetEntityBrushColor(id: number, outPtr: number): void;
  EngineGetEntityAlpha(id: number): number;
  EngineGetEntityFX(id: number): number;
  EngineGetEntityBlend(id: number): number;
  EngineGetEntityShininess(id: number): number;
  EngineGetEntityTextureId(id: number, slot: number): number;
  EngineGetEntityTextureBlend(id: number, slot: number): number;
  EngineGetEntityOrder(id: number): number;

  // Light property getters
  EngineGetLightType(id: number): number;
  EngineGetLightColor(id: number, outPtr: number): void;
  EngineGetLightRange(id: number): number;
  EngineGetLightCones(id: number, outPtr: number): void;

  // Camera property getter
  EngineGetCameraParams(id: number, outPtr: number): void;

  // Global state getters
  EngineGetFogState(outPtr: number): void;
  EngineGetAmbientColor(outPtr: number): void;

  // Light type/cone setters
  EngineSetLightType(id: number, type: number): void;
  EngineSetLightCones(id: number, inner: number, outer: number): void;
  EngineCameraAspect(camId: number, aspect: number): void;

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
  CollisionDepth(colliderId: number, meshId: number, surfaceIdx: number): number;
  CollisionNormalX(colliderId: number, meshId: number, surfaceIdx: number): number;
  CollisionNormalY(colliderId: number, meshId: number, surfaceIdx: number): number;
  CollisionNormalZ(colliderId: number, meshId: number, surfaceIdx: number): number;

  LinePick(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickDistance(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickX(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickY(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickZ(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickNX(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickNY(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;
  LinePickNZ(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number;

  EngineUpdateInput(mouseX: number, mouseY: number, mouseZ: number, buttons: number, keysPtr: number): void;

  // Gameplay
  EngineCreateFPSController(entityId: number): void;
  EngineUpdateGameplay(): void;

  CreateMesh(): number;
  CreateMeshWithName(namePtr: number): number;
  GetMeshName(meshId: number): number;
  AddSurface(meshId: number, vertexCount: number, indexCount: number): number;
  SetVertex(meshId: number, surfaceIdx: number, vertexIdx: number, x: number, y: number, z: number, u: number, v: number): void;
  SetTriangle(meshId: number, surfaceIdx: number, triIdx: number, v0: number, v1: number, v2: number): void;
  GetMeshSurfaceCount(meshId: number): number;
  GetSurfaceVertexCount(meshId: number, surfaceIdx: number): number;
  GetSurfaceIndexCount(meshId: number, surfaceIdx: number): number;
  GetSurfaceVerticesPtr(meshId: number, surfaceIdx: number): number;
  GetSurfaceIndicesPtr(meshId: number, surfaceIdx: number): number;
  GetSurfaceVertexStride(): number;

  GetSurfaceVertexX(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceVertexY(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceVertexZ(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceNormalX(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceNormalY(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceNormalZ(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceUVU(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceUVV(meshId: number, surfaceIdx: number, vertexIdx: number): number;
  GetSurfaceIndex(meshId: number, surfaceIdx: number, indexIdx: number): number;

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

  get memoryBuffer(): ArrayBuffer | SharedArrayBuffer {
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

  // ------------------------------------------------------------------
  // Physics / Dynamics
  // ------------------------------------------------------------------

  collisions(srcType: number, destType: number, method: number, response: number) {
    this.exports.EngineCollisions(srcType, destType, method, response);
  }

  updateWorld(step: number) {
    this.exports.EngineUpdateWorld(step);
  }

  resetEntity(id: number) {
    this.exports.EngineResetEntity(id);
  }

  entityType(id: number, type: number) {
    this.exports.EngineEntityType(id, type);
  }

  entityRadius(id: number, rx: number, ry: number) {
    this.exports.EngineEntityRadius(id, rx, ry);
  }

  entityBox(id: number, x: number, y: number, z: number, w: number, h: number, d: number) {
    this.exports.EngineEntityBox(id, x, y, z, w, h, d);
  }

  entityCollided(id: number, typeIdx: number): number {
    return this.exports.EngineEntityCollided(id, typeIdx);
  }

  countCollisions(id: number): number {
    return this.exports.EngineCountCollisions(id);
  }

  collisionX(id: number, index: number): number {
    return this.exports.EngineCollisionX(id, index);
  }

  collisionY(id: number, index: number): number {
    return this.exports.EngineCollisionY(id, index);
  }

  collisionZ(id: number, index: number): number {
    return this.exports.EngineCollisionZ(id, index);
  }

  collisionNX(id: number, index: number): number {
    return this.exports.EngineCollisionNX(id, index);
  }

  collisionNY(id: number, index: number): number {
    return this.exports.EngineCollisionNY(id, index);
  }

  collisionNZ(id: number, index: number): number {
    return this.exports.EngineCollisionNZ(id, index);
  }

  collisionEntity(id: number, index: number): number {
    return this.exports.EngineCollisionEntity(id, index);
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
  // Memory / Banks
  // ------------------------------------------------------------------

  createBank(size: number): number {
    return this.exports.CreateBank(size);
  }

  freeBank(id: number): void {
    this.exports.FreeBank(id);
  }

  getBankPtr(id: number): number {
    return this.exports.GetBankPtr(id);
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

  // ------------------------------------------------------------------
  // Detailed Picking & Collision
  // ------------------------------------------------------------------

  linePick(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePick(meshId, x, y, z, dx, dy, dz);
  }

  linePickDistance(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePickDistance(meshId, x, y, z, dx, dy, dz);
  }

  linePickX(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePickX(meshId, x, y, z, dx, dy, dz);
  }
  linePickY(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePickY(meshId, x, y, z, dx, dy, dz);
  }
  linePickZ(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePickZ(meshId, x, y, z, dx, dy, dz);
  }
  linePickNX(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePickNX(meshId, x, y, z, dx, dy, dz);
  }
  linePickNY(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePickNY(meshId, x, y, z, dx, dy, dz);
  }
  linePickNZ(meshId: number, x: number, y: number, z: number, dx: number, dy: number, dz: number): number {
    return this.exports.LinePickNZ(meshId, x, y, z, dx, dy, dz);
  }

  collisionDepth(colliderId: number, meshId: number, surfaceIdx: number): number {
    return this.exports.CollisionDepth(colliderId, meshId, surfaceIdx);
  }
  collisionNormal(colliderId: number, meshId: number, surfaceIdx: number): { x: number, y: number, z: number } {
    return {
      x: this.exports.CollisionNormalX(colliderId, meshId, surfaceIdx),
      y: this.exports.CollisionNormalY(colliderId, meshId, surfaceIdx),
      z: this.exports.CollisionNormalZ(colliderId, meshId, surfaceIdx)
    };
  }

  // ------------------------------------------------------------------
  // Gameplay
  // ------------------------------------------------------------------

  createFPSController(entityId: number) {
    this.exports.EngineCreateFPSController(entityId);
  }

  updateGameplay() {
    this.exports.EngineUpdateGameplay();
  }

  updateInput(mouseX: number, mouseY: number, mouseZ: number, buttons: number, keysPtr: number) {
    this.exports.EngineUpdateInput(mouseX, mouseY, mouseZ, buttons, keysPtr);
  }

  entityPickMode(entityId: number, mode: number) {
    this.exports.EngineEntityPickMode(entityId, mode);
  }

  // ------------------------------------------------------------------
  // Entity enumeration for rendering
  // ------------------------------------------------------------------

  /** Scratch buffer for writing entity IDs (max 4096 entities). */
  private _scratchBank = 0;
  private _scratchPtr = 0;
  private _scratchFloat3Bank = 0;
  private _scratchFloat3Ptr = 0;
  private _scratchFloat8Bank = 0;
  private _scratchFloat8Ptr = 0;
  private _scratchFloat4Bank = 0;
  private _scratchFloat4Ptr = 0;
  private _scratchFloat16Bank = 0;
  private _scratchFloat16Ptr = 0;

  /** Ensure scratch buffers exist. Call once after WASM is loaded. */
  initScratchBuffers(): void {
    // Int32 buffer for entity ID lists (4096 * 4 = 16KB)
    this._scratchBank = this.exports.CreateBank(4096 * 4);
    this._scratchPtr = this.exports.GetBankPtr(this._scratchBank);
    // Float buffer for 3-component readback (12 bytes)
    this._scratchFloat3Bank = this.exports.CreateBank(3 * 4);
    this._scratchFloat3Ptr = this.exports.GetBankPtr(this._scratchFloat3Bank);
    // Float buffer for 4-component readback (16 bytes)
    this._scratchFloat4Bank = this.exports.CreateBank(4 * 4);
    this._scratchFloat4Ptr = this.exports.GetBankPtr(this._scratchFloat4Bank);
    // Float buffer for 8-component readback (32 bytes)
    this._scratchFloat8Bank = this.exports.CreateBank(8 * 4);
    this._scratchFloat8Ptr = this.exports.GetBankPtr(this._scratchFloat8Bank);
    // Float buffer for 16-component readback (64 bytes)
    this._scratchFloat16Bank = this.exports.CreateBank(16 * 4);
    this._scratchFloat16Ptr = this.exports.GetBankPtr(this._scratchFloat16Bank);
  }

  /** Collect visible renderable entity IDs. */
  collectRenderables(): Int32Array {
    const count = this.exports.EngineCollectRenderables(this._scratchPtr, 4096);
    return new Int32Array(this.memoryBuffer, this._scratchPtr, count);
  }

  /** Collect visible light entity IDs. */
  collectLights(): Int32Array {
    const count = this.exports.EngineCollectLights(this._scratchPtr, 4096);
    return new Int32Array(this.memoryBuffer, this._scratchPtr, count);
  }

  /** Get the active camera entity ID, or 0 if none. */
  getActiveCameraId(): number {
    return this.exports.EngineGetActiveCameraId();
  }

  // ------------------------------------------------------------------
  // Per-entity property getters
  // ------------------------------------------------------------------

  getEntityType(id: number): number {
    return this.exports.EngineGetEntityType(id);
  }

  getEntityMeshId(id: number): number {
    return this.exports.EngineGetEntityMeshId(id);
  }

  setEntityMesh(id: number, meshId: number): void {
    this.exports.EngineSetEntityMesh(id, meshId);
  }

  getEntityBrushColor(id: number): Float32Array {
    this.exports.EngineGetEntityBrushColor(id, this._scratchFloat3Ptr);
    return new Float32Array(this.memoryBuffer, this._scratchFloat3Ptr, 3);
  }

  getEntityAlpha(id: number): number {
    return this.exports.EngineGetEntityAlpha(id);
  }

  getEntityFX(id: number): number {
    return this.exports.EngineGetEntityFX(id);
  }

  getEntityBlend(id: number): number {
    return this.exports.EngineGetEntityBlend(id);
  }

  getEntityShininess(id: number): number {
    return this.exports.EngineGetEntityShininess(id);
  }

  getEntityTextureId(id: number, slot: number): number {
    return this.exports.EngineGetEntityTextureId(id, slot);
  }

  getEntityTextureBlend(id: number, slot: number): number {
    return this.exports.EngineGetEntityTextureBlend(id, slot);
  }

  getEntityOrder(id: number): number {
    return this.exports.EngineGetEntityOrder(id);
  }

  // ------------------------------------------------------------------
  // Light property getters
  // ------------------------------------------------------------------

  getLightType(id: number): number {
    return this.exports.EngineGetLightType(id);
  }

  getLightColor(id: number): Float32Array {
    this.exports.EngineGetLightColor(id, this._scratchFloat3Ptr);
    return new Float32Array(this.memoryBuffer, this._scratchFloat3Ptr, 3);
  }

  getLightRange(id: number): number {
    return this.exports.EngineGetLightRange(id);
  }

  getLightCones(id: number): { inner: number; outer: number } {
    this.exports.EngineGetLightCones(id, this._scratchFloat3Ptr);
    const f = new Float32Array(this.memoryBuffer, this._scratchFloat3Ptr, 2);
    return { inner: f[0], outer: f[1] };
  }

  // ------------------------------------------------------------------
  // Camera property getter
  // ------------------------------------------------------------------

  getCameraParams(id: number): { fov: number; near: number; far: number; aspect: number } {
    this.exports.EngineGetCameraParams(id, this._scratchFloat4Ptr);
    const f = new Float32Array(this.memoryBuffer, this._scratchFloat4Ptr, 4);
    return { fov: f[0], near: f[1], far: f[2], aspect: f[3] };
  }

  // ------------------------------------------------------------------
  // Global state getters
  // ------------------------------------------------------------------

  getFogState(): { mode: number; r: number; g: number; b: number; start: number; end: number; density: number } {
    this.exports.EngineGetFogState(this._scratchFloat8Ptr);
    const f = new Float32Array(this.memoryBuffer, this._scratchFloat8Ptr, 8);
    return { mode: f[0], r: f[1], g: f[2], b: f[3], start: f[4], end: f[5], density: f[6] };
  }

  getAmbientColor(): Float32Array {
    this.exports.EngineGetAmbientColor(this._scratchFloat3Ptr);
    return new Float32Array(this.memoryBuffer, this._scratchFloat3Ptr, 3);
  }

  /** Read world matrix into the scratch buffer, returns 16-float view. */
  getWorldMatrix(id: number): Float32Array | null {
    const ok = this.exports.EngineGetWorldMatrix(id, this._scratchFloat16Ptr);
    if (!ok) return null;
    return new Float32Array(this.memoryBuffer, this._scratchFloat16Ptr, 16);
  }

  // ------------------------------------------------------------------
  // Light/camera setters
  // ------------------------------------------------------------------

  setLightType(id: number, type: number): void {
    this.exports.EngineSetLightType(id, type);
  }

  setLightCones(id: number, inner: number, outer: number): void {
    this.exports.EngineSetLightCones(id, inner, outer);
  }

  cameraAspect(camId: number, aspect: number): void {
    this.exports.EngineCameraAspect(camId, aspect);
  }

  // ------------------------------------------------------------------
  // Mesh data access
  // ------------------------------------------------------------------

  getMeshSurfaceCount(meshId: number): number {
    return this.exports.GetMeshSurfaceCount(meshId);
  }

  getSurfaceVertexCount(meshId: number, surfaceIdx: number): number {
    return this.exports.GetSurfaceVertexCount(meshId, surfaceIdx);
  }

  getSurfaceIndexCount(meshId: number, surfaceIdx: number): number {
    return this.exports.GetSurfaceIndexCount(meshId, surfaceIdx);
  }

  createMesh(): number {
    return this.exports.CreateMesh();
  }

  addSurface(meshId: number, vertexCount: number, indexCount: number): number {
    return this.exports.AddSurface(meshId, vertexCount, indexCount);
  }
}
