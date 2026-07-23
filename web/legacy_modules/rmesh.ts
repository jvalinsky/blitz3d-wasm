/**
 * Blitz3D RMesh Parser
 * Parses SCPCB room mesh files and converts to Three.js geometry
 */

const path = require("path");

class RMeshParser {
  constructor(graphics, fileIO, assetManager) {
    this.graphics = graphics;
    this.fileIO = fileIO;
    this.assetManager = assetManager;
    this.debugMode = true;
    this.logCount = 0;
  }

  /**
   * Parse an RMesh file and return Three.js objects
   * @param {string} filePath - Path to RMesh file
   * @returns {Object} Parsed room data with opaque, alpha, collision meshes and entities
   */
  async parseFile(filePath) {
    const startTime = performance.now();
    this.log(`Parsing RMesh: ${filePath}`);

    // Open file
    const handle = this.fileIO.openFile(filePath);
    if (handle === 0) {
      throw new Error(`Failed to open RMesh file: ${filePath}`);
    }

    try {
      // Read header
      const header = this.readString(handle);
      this.log(`  Header: ${header}`);

      if (header !== "RoomMesh" && header !== "RoomMesh.HasTriggerBox") {
        throw new Error(`Invalid RMesh format: ${header}`);
      }

      const hasTriggerBox = header === "RoomMesh.HasTriggerBox";

      // Extract base path for texture loading
      const basePath = filePath.substring(0, filePath.lastIndexOf("/") + 1);

      // Fast path: parse in WASM engine and build render geometry from pointers.
      // This avoids per-vertex callbacks and keeps parsing deterministic.
      const engine = (typeof window !== "undefined" && window.Blitz3D &&
          window.Blitz3D.engineExports)
        ? window.Blitz3D.engineExports
        : null;

      if (
        engine && typeof engine.ParseRMesh === "function" &&
        typeof engine.CreateBank === "function" &&
        typeof engine.GetBankPtr === "function"
      ) {
        // Rewind file and read full contents in one go
        if (typeof this.fileIO.seek === "function") {
          this.fileIO.seek(handle, 0);
        }

        const data = typeof this.fileIO.readRemaining === "function"
          ? this.fileIO.readRemaining(handle)
          : this.readAllBytesSlow(handle);

        const meshId = this.parseRMeshWithEngine(engine, data);

        const parseTime = performance.now() - startTime;
        this.log(`  Parsed (WASM) in ${parseTime.toFixed(2)}ms`);

        return {
          wasmMeshId: meshId,
          opaque: [],
          alpha: [],
          collision: [],
          triggerBoxes: [],
          entities: [],
          basePath,
          hasTriggerBox,
        };
      }

      // Fallback path: JS parser
      const opaqueMeshes = this.parseDrawnMeshes(handle, basePath, false);
      const alphaMeshes = this.parseDrawnMeshes(handle, basePath, true);
      const collisionMeshes = this.parseCollisionMeshes(handle, basePath);
      const triggerBoxes = hasTriggerBox
        ? this.parseTriggerBoxes(handle, basePath)
        : [];
      const pointEntities = this.parsePointEntities(handle, basePath);

      const result = {
        opaque: opaqueMeshes,
        alpha: alphaMeshes,
        collision: collisionMeshes,
        triggerBoxes: triggerBoxes,
        entities: pointEntities,
        basePath: basePath,
        hasTriggerBox: hasTriggerBox,
      };

      const parseTime = performance.now() - startTime;
      this.log(`  Parsed in ${parseTime.toFixed(2)}ms`);
      this.log(
        `  Opaque meshes: ${opaqueMeshes.length}, Alpha: ${alphaMeshes.length}`,
      );

      return result;
    } finally {
      this.fileIO.closeFile(handle);
    }
  }

  parseRMeshWithEngine(engine, data) {
    // Create a bank in engine memory and copy bytes in one shot.
    const bankId = engine.CreateBank(data.length);
    const ptr = engine.GetBankPtr(bankId);
    const dest = new Uint8Array(engine.memory.buffer, ptr, data.length);
    dest.set(data);

    const meshId = engine.ParseRMesh(bankId);
    engine.FreeBank(bankId);

    if (!meshId) {
      throw new Error("WASM ParseRMesh failed");
    }

    return meshId;
  }

  readAllBytesSlow(handle) {
    const out = [];
    while (this.fileIO.eof(handle) === 0) {
      const b = this.fileIO.readByte(handle);
      if (b < 0) break;
      out.push(b);
    }
    return new Uint8Array(out);
  }

  createThreeJSGroupFromWasm(engine, meshId) {
    const group = new THREE.Group();

    const surfaceCount = engine.GetMeshSurfaceCount(meshId);
    if (!surfaceCount) {
      return group;
    }

    const memory = engine.memory.buffer;
    const vertexStride = 11;

    for (let surfaceIdx = 0; surfaceIdx < surfaceCount; surfaceIdx++) {
      const vertexCount = engine.GetSurfaceVertexCount(meshId, surfaceIdx);
      const indexCount = engine.GetSurfaceIndexCount(meshId, surfaceIdx);
      const vertexPtr = engine.GetSurfaceVerticesPtr(meshId, surfaceIdx);
      const indexPtr = engine.GetSurfaceIndicesPtr(meshId, surfaceIdx);

      if (!vertexPtr || !indexPtr || !vertexCount || !indexCount) continue;

      // Clone into JS-owned buffers so future WASM memory growth doesn't invalidate geometry.
      const vertexView = new Float32Array(
        memory,
        vertexPtr,
        vertexCount * vertexStride,
      );
      const vertices = new Float32Array(vertexView);

      // Normalize vertex colors in-place (engine stores 0-255).
      for (let i = 0; i < vertexCount; i++) {
        const base = i * vertexStride;
        vertices[base + 8] = vertices[base + 8] / 255.0;
        vertices[base + 9] = vertices[base + 9] / 255.0;
        vertices[base + 10] = vertices[base + 10] / 255.0;
      }

      const indexView = new Int32Array(memory, indexPtr, indexCount);
      const indices = new Uint32Array(indexCount);
      for (let i = 0; i < indexCount; i++) indices[i] = indexView[i];

      const geometry = new THREE.BufferGeometry();
      const interleaved = new THREE.InterleavedBuffer(vertices, vertexStride);

      geometry.setAttribute(
        "position",
        new THREE.InterleavedBufferAttribute(interleaved, 3, 0),
      );
      geometry.setAttribute(
        "normal",
        new THREE.InterleavedBufferAttribute(interleaved, 3, 3),
      );
      geometry.setAttribute(
        "uv",
        new THREE.InterleavedBufferAttribute(interleaved, 2, 6),
      );
      geometry.setAttribute(
        "color",
        new THREE.InterleavedBufferAttribute(interleaved, 3, 8),
      );
      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      // If normals are missing/zeroed, compute them.
      geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
      });

      group.add(new THREE.Mesh(geometry, material));
    }

    return group;
  }

  /**
   * Parse drawn meshes section (opaque and alpha)
   */
  parseDrawnMeshes(handle, basePath, isAlpha) {
    const count = this.fileIO.readInt(handle);
    const meshes = [];

    for (let i = 0; i < count; i++) {
      const mesh = this.parseSingleMesh(handle, basePath, isAlpha);
      meshes.push(mesh);
    }

    return meshes;
  }

  /**
   * Parse a single drawn mesh
   */
  parseSingleMesh(handle, basePath, isAlpha) {
    // Parse texture references
    const textures = [];
    let alphaFlag = 0;

    for (let j = 0; j < 2; j++) {
      const hasTexture = this.fileIO.readByte(handle);
      if (hasTexture !== 0) {
        const texturePath = this.readString(handle);
        const fullPath = basePath + texturePath;
        textures.push({
          path: texturePath,
          fullPath: fullPath,
          uvSet: j,
        });

        // Check texture flags from path
        if (texturePath.toLowerCase().includes("_lm")) {
          alphaFlag = 2; // Lightmap blend
        }
      }
    }

    // Determine alpha status from textures
    if (textures.length >= 2) {
      alphaFlag = 2; // Multi-texture
    } else if (textures.length === 1 && alphaFlag === 0) {
      // Single texture, check if already set as alpha
    }

    // Parse vertices
    const vertexCount = this.fileIO.readInt(handle);
    const vertices = [];

    for (let j = 0; j < vertexCount; j++) {
      const x = this.fileIO.readFloat(handle);
      const y = this.fileIO.readFloat(handle);
      const z = this.fileIO.readFloat(handle);

      // Texture coordinates for 2 UV sets
      const uvs = [];
      for (let k = 0; k < 2; k++) {
        const u = this.fileIO.readFloat(handle);
        const v = this.fileIO.readFloat(handle);
        uvs.push({ u, v });
      }

      // Vertex colors
      const r = this.fileIO.readByte(handle);
      const g = this.fileIO.readByte(handle);
      const b = this.fileIO.readByte(handle);

      vertices.push({
        x,
        y,
        z,
        uvs,
        color: { r, g, b, a: 255 },
      });
    }

    // Parse triangles
    const triangleCount = this.fileIO.readInt(handle);
    const triangles = [];

    for (let j = 0; j < triangleCount; j++) {
      const v0 = this.fileIO.readInt(handle);
      const v1 = this.fileIO.readInt(handle);
      const v2 = this.fileIO.readInt(handle);
      triangles.push({ v0, v1, v2 });
    }

    return {
      textures,
      vertices,
      triangles,
      isAlpha,
    };
  }

  /**
   * Parse collision meshes section
   */
  parseCollisionMeshes(handle, basePath) {
    const count = this.fileIO.readInt(handle);
    const meshes = [];

    for (let i = 0; i < count; i++) {
      // Parse vertices (no textures or UVs for collision)
      const vertexCount = this.fileIO.readInt(handle);
      const vertices = [];

      for (let j = 0; j < vertexCount; j++) {
        const x = this.fileIO.readFloat(handle);
        const y = this.fileIO.readFloat(handle);
        const z = this.fileIO.readFloat(handle);
        vertices.push({ x, y, z });
      }

      // Parse triangles (double-sided)
      const triangleCount = this.fileIO.readInt(handle);
      const triangles = [];

      for (let j = 0; j < triangleCount; j++) {
        const v0 = this.fileIO.readInt(handle);
        const v1 = this.fileIO.readInt(handle);
        const v2 = this.fileIO.readInt(handle);
        triangles.push({ v0, v1, v2 });
      }

      meshes.push({
        vertices,
        triangles,
        doubleSided: true,
      });
    }

    return meshes;
  }

  /**
   * Parse trigger boxes (optional)
   */
  parseTriggerBoxes(handle, basePath) {
    const count = this.fileIO.readInt(handle);
    const boxes = [];

    for (let i = 0; i < count; i++) {
      // Create mesh for trigger box
      const mesh = this.parseSingleMesh(handle, basePath, false);
      const name = this.readString(handle);

      boxes.push({
        mesh,
        name,
      });
    }

    return boxes;
  }

  /**
   * Parse point entities section
   */
  parsePointEntities(handle, basePath) {
    const count = this.fileIO.readInt(handle);
    const entities = [];

    for (let i = 0; i < count; i++) {
      const entityType = this.readString(handle);
      const entity = this.parsePointEntity(handle, entityType, basePath);
      entities.push(entity);
    }

    return entities;
  }

  /**
   * Parse a single point entity
   */
  parsePointEntity(handle, type, basePath) {
    const entity = {
      type,
      position: { x: 0, y: 0, z: 0 },
      rotation: { pitch: 0, yaw: 0, roll: 0 },
      data: {},
    };

    // Position (3 floats)
    entity.position.x = this.fileIO.readFloat(handle);
    entity.position.y = this.fileIO.readFloat(handle);
    entity.position.z = this.fileIO.readFloat(handle);

    // Rotation (3 floats) - pitch, yaw, roll in degrees
    entity.rotation.pitch = this.fileIO.readFloat(handle);
    entity.rotation.yaw = this.fileIO.readFloat(handle);
    entity.rotation.roll = this.fileIO.readFloat(handle);

    // Type-specific data
    switch (type) {
      case "screen":
        entity.data.screenTexture = this.readString(handle);
        break;

      case "waypoint":
        entity.data.nextWaypoint = this.readString(handle);
        break;

      case "light":
        entity.data.lightType = this.readString(handle);
        entity.data.color = {
          r: this.fileIO.readByte(handle),
          g: this.fileIO.readByte(handle),
          b: this.fileIO.readByte(handle),
        };
        entity.data.range = this.fileIO.readFloat(handle);
        break;

      case "spotlight":
        entity.data.color = {
          r: this.fileIO.readByte(handle),
          g: this.fileIO.readByte(handle),
          b: this.fileIO.readByte(handle),
        };
        entity.data.range = this.fileIO.readFloat(handle);
        entity.data.angle = this.fileIO.readFloat(handle);
        break;

      case "soundemitter":
        entity.data.soundFile = this.readString(handle);
        entity.data.loop = this.fileIO.readByte(handle) !== 0;
        entity.data.vol = this.fileIO.readFloat(handle);
        break;

      case "playerstart":
        entity.data.startType = this.readString(handle);
        break;

      case "model":
        entity.data.modelFile = this.readString(handle);
        entity.data.animType = this.readString(handle);
        break;

      default:
        this.log(`  Unknown entity type: ${type}`);
    }

    return entity;
  }

  /**
   * Convert parsed RMesh to Three.js objects
   */
  async createThreeJSObjects(roomData) {
    const result = {
      opaqueGroup: new THREE.Group(),
      alphaGroup: new THREE.Group(),
      collisionMeshes: [],
      triggerBoxes: [],
      entityObjects: [],
    };

    // WASM-backed mesh path: build geometry from engine memory pointers.
    if (roomData.wasmMeshId) {
      const engine = (typeof window !== "undefined" && window.Blitz3D &&
          window.Blitz3D.engineExports)
        ? window.Blitz3D.engineExports
        : null;
      if (!engine) {
        throw new Error(
          "roomData.wasmMeshId set but Blitz3D engine not available",
        );
      }

      const group = this.createThreeJSGroupFromWasm(
        engine,
        roomData.wasmMeshId,
      );
      result.opaqueGroup.add(group);
      return result;
    }

    // Create meshes from parsed data
    for (const meshData of roomData.opaque) {
      const mesh = await this.createThreeJSMesh(meshData, roomData.basePath);
      if (mesh) {
        result.opaqueGroup.add(mesh);
      }
    }

    for (const meshData of roomData.alpha) {
      const mesh = await this.createThreeJSMesh(meshData, roomData.basePath);
      if (mesh) {
        result.alphaGroup.add(mesh);
      }
    }

    // Create collision meshes
    for (const collisionData of roomData.collision) {
      const mesh = this.createCollisionMesh(collisionData);
      if (mesh) {
        result.collisionMeshes.push(mesh);
      }
    }

    // Create trigger boxes
    for (const triggerData of roomData.triggerBoxes) {
      const mesh = await this.createThreeJSMesh(
        triggerData.mesh,
        roomData.basePath,
      );
      if (mesh) {
        mesh.userData.triggerName = triggerData.name;
        result.triggerBoxes.push(mesh);
      }
    }

    // Create entity objects
    for (const entityData of roomData.entities) {
      const entity = await this.createEntityObject(entityData);
      if (entity) {
        result.entityObjects.push(entity);
      }
    }

    return result;
  }

  /**
   * Create a Three.js mesh from parsed mesh data
   */
  async createThreeJSMesh(meshData, basePath) {
    if (meshData.vertices.length === 0 || meshData.triangles.length === 0) {
      this.log("  Warning: Empty mesh data");
      return null;
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();

    // Build position array (convert from Blitz3D LH to Three.js RH)
    const positions = [];
    const uvs = [[], []];
    const colors = [];

    for (const vertex of meshData.vertices) {
      // Negate Z for coordinate conversion
      positions.push(vertex.x, vertex.y, -vertex.z);

      // UV coordinates for both texture units
      if (vertex.uvs && vertex.uvs.length >= 1) {
        uvs[0].push(vertex.uvs[0].u, vertex.uvs[0].v);
      } else {
        uvs[0].push(0, 0);
      }
      if (vertex.uvs && vertex.uvs.length >= 2) {
        uvs[1].push(vertex.uvs[1].u, vertex.uvs[1].v);
      } else {
        uvs[1].push(0, 0);
      }

      // Vertex colors (normalized to 0-1)
      if (vertex.color) {
        colors.push(
          vertex.color.r / 255,
          vertex.color.g / 255,
          vertex.color.b / 255,
        );
      } else {
        colors.push(1, 1, 1);
      }
    }

    // Build index array
    const indices = [];
    for (const triangle of meshData.triangles) {
      indices.push(triangle.v0, triangle.v1, triangle.v2);
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs[0], 2));
    geometry.setAttribute("uv2", new THREE.Float32BufferAttribute(uvs[1], 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Load textures
    const materials = await this.createMaterials(
      meshData.textures,
      basePath,
      meshData.isAlpha,
    );

    // Create mesh
    const mesh = new THREE.Mesh(geometry, materials);

    return mesh;
  }

  /**
   * Create Three.js materials from texture data
   */
  async createMaterials(textures, basePath, isAlpha) {
    const textureMaterials = [];

    for (const texData of textures) {
      let texture = null;

      // Try to load texture from asset manager
      if (this.assetManager) {
        texture = await this.assetManager.loadTexture(texData.fullPath);
      }

      if (!texture) {
        // Create placeholder texture
        texture = this.createPlaceholderTexture();
      }

      const material = new THREE.MeshPhongMaterial({
        map: texture,
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: isAlpha,
        opacity: isAlpha ? 0.5 : 1.0,
      });

      textureMaterials.push(material);
    }

    // Return first material or default
    if (textureMaterials.length > 0) {
      return textureMaterials[0];
    }

    return new THREE.MeshPhongMaterial({
      color: 0x808080,
      vertexColors: true,
      side: THREE.DoubleSide,
    });
  }

  /**
   * Create collision mesh (simpler, no textures)
   */
  createCollisionMesh(collisionData) {
    if (collisionData.vertices.length === 0) return null;

    const geometry = new THREE.BufferGeometry();

    const positions = [];
    for (const vertex of collisionData.vertices) {
      positions.push(vertex.x, vertex.y, -vertex.z);
    }

    const indices = [];
    for (const triangle of collisionData.triangles) {
      indices.push(triangle.v0, triangle.v1, triangle.v2);
      if (collisionData.doubleSided) {
        indices.push(triangle.v0, triangle.v2, triangle.v1);
      }
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const material = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      visible: false, // Hidden by default
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isCollisionMesh = true;

    return mesh;
  }

  /**
   * Create entity object from parsed entity data
   */
  async createEntityObject(entityData) {
    const position = new THREE.Vector3(
      entityData.position.x,
      entityData.position.y,
      -entityData.position.z,
    );

    const euler = new THREE.Euler(
      THREE.MathUtils.degToRad(entityData.rotation.pitch),
      THREE.MathUtils.degToRad(entityData.rotation.yaw),
      THREE.MathUtils.degToRad(entityData.rotation.roll),
      "YXZ",
    );

    let mesh = null;

    switch (entityData.type) {
      case "light":
        mesh = this.createLightObject(entityData);
        break;

      case "soundemitter":
        mesh = this.createSoundEmitterObject(entityData);
        break;

      case "playerstart":
        mesh = this.createPlayerStartObject(entityData);
        break;

      case "model":
        mesh = await this.createModelObject(entityData);
        break;

      case "waypoint":
        mesh = this.createWaypointObject(entityData);
        break;

      default:
        mesh = this.createGenericEntityObject(entityData);
    }

    if (mesh) {
      mesh.position.copy(position);
      mesh.rotation.copy(euler);
      mesh.userData.entityData = entityData;
    }

    return mesh;
  }

  /**
   * Create light entity object
   */
  createLightObject(entityData) {
    const color = entityData.data.color || { r: 255, g: 255, b: 255 };
    const range = entityData.data.range || 10;

    let light;
    const lightType = entityData.data.lightType;

    if (lightType === "spotlight") {
      light = new THREE.SpotLight(
        new THREE.Color(color.r / 255, color.g / 255, color.b / 255),
        1,
        range,
        THREE.MathUtils.degToRad(45),
        0.5,
        1,
      );
    } else {
      light = new THREE.PointLight(
        new THREE.Color(color.r / 255, color.g / 255, color.b / 255),
        1,
        range,
      );
    }

    light.userData.isLight = true;
    return light;
  }

  /**
   * Create sound emitter object
   */
  createSoundEmitterObject(entityData) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 0.5,
      }),
    );
    mesh.userData.isSoundEmitter = true;
    mesh.userData.soundFile = entityData.data.soundFile;
    mesh.userData.loop = entityData.data.loop;
    mesh.userData.volume = entityData.data.vol;
    return mesh;
  }

  /**
   * Create player start object
   */
  createPlayerStartObject(entityData) {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.5, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0x00ffff }),
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.userData.isPlayerStart = true;
    mesh.userData.startType = entityData.data.startType;
    return mesh;
  }

  /**
   * Create model entity object
   */
  async createModelObject(entityData) {
    // Placeholder for model loading
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true }),
    );
    mesh.userData.isModel = true;
    mesh.userData.modelFile = entityData.data.modelFile;
    mesh.userData.animType = entityData.data.animType;
    return mesh;
  }

  /**
   * Create waypoint object
   */
  createWaypointObject(entityData) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff00 }),
    );
    mesh.userData.isWaypoint = true;
    mesh.userData.nextWaypoint = entityData.data.nextWaypoint;
    return mesh;
  }

  /**
   * Create generic entity object
   */
  createGenericEntityObject(entityData) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
      }),
    );
    mesh.userData.entityType = entityData.type;
    return mesh;
  }

  /**
   * Create placeholder texture when texture loading fails
   */
  createPlaceholderTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    // Pink checkerboard pattern (SCPCB missing texture indicator)
    ctx.fillStyle = "#ff69b4";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#ff1493";
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Read null-terminated string from file
   */
  readString(handle) {
    let str = "";
    let bytesRead = 0;
    const maxLen = 65536;

    while (bytesRead < maxLen) {
      const byte = this.fileIO.readByte(handle);
      if (byte < 0) break;
      if (byte === 0) break;
      str += String.fromCharCode(byte);
      bytesRead++;
    }

    return str;
  }

  /**
   * Debug logging with rate limiting
   */
  log(message) {
    if (!this.debugMode) return;
    this.logCount++;
    if (this.logCount <= 50) {
      console.log(message);
    } else if (this.logCount === 51) {
      console.log("... (logging truncated)");
    }
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    this.logCount = 0;
  }
}

module.exports = RMeshParser;
