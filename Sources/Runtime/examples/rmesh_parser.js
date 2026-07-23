/**
 * RMesh Parser for SCPCB Asset Viewer
 * Based on SCP-Containment-Breach RMesh format documentation
 * Format: B3D strings (4-byte len + string), 4-byte ints, 1-byte flags
 */

class RMeshParserBrowser {
  constructor() {
    this.textureCache = new Map();
  }

  async parseFile(filePath) {
    console.log(`[RMeshParser] Parsing: ${filePath}`);
    let response;
    try {
      response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.warn(`[RMeshParser] Cannot fetch ${filePath}, using fallback`);
      return this.createFallbackRoom(filePath);
    }
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    console.log(`[RMeshParser] Fetched ${data.length} bytes`);
    return this.parseBinaryData(data, filePath);
  }

  async loadTexture(texturePath) {
    if (this.textureCache.has(texturePath)) {
      return this.textureCache.get(texturePath);
    }
    const resolvedPath = this.resolveTexturePath(texturePath);
    try {
      const texture = await new Promise((resolve) => {
        const loader = new window.THREE.TextureLoader();
        loader.load(
          resolvedPath,
          (tex) => {
            tex.wrapS = window.THREE.RepeatWrapping;
            tex.wrapT = window.THREE.RepeatWrapping;
            resolve(tex);
          },
          undefined,
          () => {
            console.warn(`[RMeshParser] Failed to load: ${resolvedPath}`);
            resolve(null);
          },
        );
      });
      this.textureCache.set(texturePath, texture);
      return texture;
    } catch (err) {
      console.warn(`[RMeshParser] Error loading ${texturePath}:`, err);
      return null;
    }
  }

  resolveTexturePath(texturePath) {
    if (!texturePath || texturePath.length === 0) return null;

    // All textures (including lightmaps) are in the same directory as the RMesh
    // e.g., /scpcb/GFX/map/173.rmesh has textures at /scpcb/GFX/map/
    if (!texturePath.startsWith("/")) {
      const rmeshDir = this.currentRMeshDir || "";
      if (rmeshDir) {
        return rmeshDir + texturePath;
      }
    }

    // Absolute paths used rarely
    if (texturePath.startsWith("/")) {
      return texturePath;
    }

    // Default fallback
    return `/scpcb/GFX/${texturePath}`;
  }

  clearTextureCache() {
    this.textureCache.forEach((t) => {
      if (t?.image) t.dispose();
    });
    this.textureCache.clear();
  }

  // B3D string reading: 4-byte length prefix followed by string bytes
  readB3DString(data, offset) {
    if (offset + 4 > data.length) return { str: "", offset };
    const len = this.readInt32(data, offset);
    offset += 4;
    if (len < 0 || offset + len > data.length) return { str: "", offset };
    let str = "";
    for (let i = 0; i < len; i++) {
      str += String.fromCharCode(data[offset++]);
    }
    return { str, offset };
  }

  readInt8(data, offset) {
    if (offset >= data.length) return 0;
    return data[offset];
  }

  readInt32(data, offset) {
    if (offset + 4 > data.length) return 0;
    return new DataView(data.buffer).getInt32(offset, true);
  }

  readFloat32(data, offset) {
    if (offset + 4 > data.length) return 0;
    return new DataView(data.buffer).getFloat32(offset, true);
  }

  async parseBinaryData(data, filePath) {
    let offset = 0;
    const yieldToEventLoop = () => new Promise((r) => setTimeout(r, 0));

    if (data.length < 12) {
      console.error(`[RMeshParser] File too small: ${data.length}`);
      return this.createFallbackRoom(filePath);
    }

    // Read header as B3D string
    const headerResult = this.readB3DString(data, offset);
    const header = headerResult.str;
    offset = headerResult.offset;

    console.log(`[RMeshParser] Header: "${header}" at offset ${offset}`);

    if (header !== "RoomMesh" && header !== "RoomMesh.HasTriggerBox") {
      console.error(`[RMeshParser] Invalid header: "${header}"`);
      return this.createFallbackRoom(filePath);
    }

    const hasTriggerBox = header === "RoomMesh.HasTriggerBox";

    // Read texture count (4-byte int)
    const textureCount = this.readInt32(data, offset);
    offset += 4;
    console.log(`[RMeshParser] Texture count: ${textureCount}`);

    const opaqueMeshes = [];
    const alphaMeshes = [];

    // Parse each texture
    for (let t = 0; t < textureCount; t++) {
      console.log(
        `[RMeshParser] Parsing texture ${
          t + 1
        }/${textureCount} at offset ${offset}`,
      );

      // Lightmap: 1-byte flag + B3D string
      const lightmapFlag = this.readInt8(data, offset++);
      const lightmapResult = this.readB3DString(data, offset);
      const lightmapPath = lightmapResult.str;
      offset = lightmapResult.offset;
      console.log(
        `[RMeshParser] Lightmap flag: ${lightmapFlag}, path: "${lightmapPath}"`,
      );

      // Actual texture: 1-byte flag + B3D string
      const textureFlag = this.readInt8(data, offset++);
      const textureResult = this.readB3DString(data, offset);
      const texturePath = textureResult.str;
      offset = textureResult.offset;
      console.log(
        `[RMeshParser] Texture flag: ${textureFlag}, path: "${texturePath}"`,
      );

      // Determine if this is an alpha/transparent texture
      const isAlpha = textureFlag === 3;

      // Read vertices
      const vertexCount = this.readInt32(data, offset);
      offset += 4;
      console.log(`[RMeshParser] Vertex count: ${vertexCount}`);

      if (vertexCount < 0 || vertexCount > 10000000) {
        console.error(
          `[RMeshParser] Invalid vertex count: ${vertexCount} at offset ${
            offset - 4
          }`,
        );
        // Skip this texture and continue
        continue;
      }

      const vertices = [];
      let lastYield = 0;
      for (let v = 0; v < vertexCount; v++) {
        if (offset + 31 > data.length) {
          console.error(
            `[RMeshParser] Unexpected end at vertex ${v}/${vertexCount}, offset ${offset}`,
          );
          break;
        }

        // Read vertex: 31 bytes
        // Position (3 floats = 12 bytes)
        const x = this.readFloat32(data, offset);
        const y = this.readFloat32(data, offset + 4);
        const z = this.readFloat32(data, offset + 8);
        offset += 12;

        // UV for texture (2 floats = 8 bytes)
        const u1 = this.readFloat32(data, offset);
        const v1 = this.readFloat32(data, offset + 4);
        offset += 8;

        // UV for lightmap (2 floats = 8 bytes)
        const u2 = this.readFloat32(data, offset);
        const v2 = this.readFloat32(data, offset + 4);
        offset += 8;

        // Color (3 bytes)
        const r = data[offset++];
        const g = data[offset++];
        const b = data[offset++];

        vertices.push({
          x,
          y,
          z: -z, // Flip Z for Three.js
          uvs: [{ u: u1, v: 1 - v1 }, { u: u2, v: 1 - v2 }], // Flip V for Three.js UV origin
          color: { r, g, b, a: 255 },
        });

        // Yield periodically
        if (v - lastYield >= 1000) {
          lastYield = v;
          await yieldToEventLoop();
        }
      }

      // Read triangles
      const triangleCount = this.readInt32(data, offset);
      offset += 4;
      console.log(`[RMeshParser] Triangle count: ${triangleCount}`);

      if (triangleCount < 0 || triangleCount > 10000000) {
        console.error(`[RMeshParser] Invalid triangle count: ${triangleCount}`);
        continue;
      }

      const triangles = [];
      const maxIndex = vertices.length - 1;
      let lastTriYield = 0;
      for (let tri = 0; tri < triangleCount; tri++) {
        if (offset + 12 > data.length) {
          console.error(
            `[RMeshParser] Unexpected end at triangle ${tri}/${triangleCount}`,
          );
          break;
        }

        const v0 = this.readInt32(data, offset);
        const v1 = this.readInt32(data, offset + 4);
        const v2 = this.readInt32(data, offset + 8);
        offset += 12;

        if (
          v0 <= maxIndex && v1 <= maxIndex && v2 <= maxIndex && v0 >= 0 &&
          v1 >= 0 && v2 >= 0
        ) {
          triangles.push({ v0, v1, v2 });
        }

        if (tri - lastTriYield >= 1000) {
          lastTriYield = tri;
          await yieldToEventLoop();
        }
      }

      const mesh = {
        textures: texturePath ? [{ path: texturePath, uvSet: 0 }] : [],
        lightmaps: lightmapPath ? [{ path: lightmapPath, uvSet: 1 }] : [],
        vertices,
        triangles,
        isAlpha,
        endOffset: offset,
      };

      if (isAlpha) {
        alphaMeshes.push(mesh);
      } else {
        opaqueMeshes.push(mesh);
      }

      await yieldToEventLoop();
    }

    // Read collision meshes
    const collisionMeshes = [];
    if (offset + 4 <= data.length) {
      const collisionCount = this.readInt32(data, offset);
      offset += 4;
      console.log(`[RMeshParser] Collision mesh count: ${collisionCount}`);

      if (collisionCount >= 0 && collisionCount <= 10000) {
        for (let i = 0; i < collisionCount; i++) {
          const mesh = await this.parseCollisionMesh(data, offset);
          offset = mesh.endOffset;
          collisionMeshes.push(mesh);
          await yieldToEventLoop();
        }
      }
    }

    // Read trigger boxes if present
    const triggerBoxes = [];
    if (hasTriggerBox && offset + 4 <= data.length) {
      const triggerCount = this.readInt32(data, offset);
      offset += 4;
      console.log(`[RMeshParser] Trigger box count: ${triggerCount}`);

      for (let i = 0; i < triggerCount; i++) {
        const box = await this.parseTriggerBox(data, offset);
        offset = box.endOffset;
        triggerBoxes.push(box);
        await yieldToEventLoop();
      }
    }

    // Read entities
    const entities = [];
    if (offset + 4 <= data.length) {
      const entityCount = this.readInt32(data, offset);
      offset += 4;
      console.log(`[RMeshParser] Entity count: ${entityCount}`);

      for (let i = 0; i < entityCount; i++) {
        const entity = await this.parsePointEntity(data, offset);
        offset = entity.endOffset;
        entities.push(entity);
        await yieldToEventLoop();
      }
    }

    console.log(
      `[RMeshParser] Parsed: ${opaqueMeshes.length} opaque, ${alphaMeshes.length} alpha, ${collisionMeshes.length} collision, ${entities.length} entities`,
    );

    return {
      header,
      hasTriggerBox,
      opaque: opaqueMeshes,
      alpha: alphaMeshes,
      collision: collisionMeshes,
      triggerBoxes,
      entities,
      sourcePath: filePath,
    };
  }

  async parseCollisionMesh(data, offset) {
    const vertexCount = this.readInt32(data, offset);
    offset += 4;
    console.log(`[RMeshParser] Collision vertex count: ${vertexCount}`);

    const vertices = [];
    if (vertexCount >= 0 && vertexCount <= 1000000) {
      let lastYield = 0;
      for (let i = 0; i < vertexCount; i++) {
        if (offset + 12 > data.length) break;
        vertices.push({
          x: this.readFloat32(data, offset),
          y: this.readFloat32(data, offset + 4),
          z: -this.readFloat32(data, offset + 8), // Flip Z for Three.js
        });
        offset += 12;

        if (i - lastYield >= 1000) {
          lastYield = i;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    const triangleCount = this.readInt32(data, offset);
    offset += 4;

    const triangles = [];
    const maxIndex = vertices.length - 1;
    if (triangleCount >= 0 && triangleCount <= 1000000) {
      let lastYield = 0;
      for (let i = 0; i < triangleCount; i++) {
        if (offset + 12 > data.length) break;
        const v0 = this.readInt32(data, offset);
        const v1 = this.readInt32(data, offset + 4);
        const v2 = this.readInt32(data, offset + 8);
        offset += 12;

        if (
          v0 <= maxIndex && v1 <= maxIndex && v2 <= maxIndex && v0 >= 0 &&
          v1 >= 0 && v2 >= 0
        ) {
          triangles.push({ v0, v1, v2 }, { v0, v2, v1 });
        }

        if (i - lastYield >= 1000) {
          lastYield = i;
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    return { vertices, triangles, doubleSided: true, endOffset: offset };
  }

  async parseTriggerBox(data, offset) {
    // Trigger box has same structure as a mesh
    const surfaceCount = this.readInt32(data, offset);
    offset += 4;
    console.log(`[RMeshParser] Trigger box surface count: ${surfaceCount}`);

    // Parse each surface
    for (let s = 0; s < surfaceCount; s++) {
      const vertexCount = this.readInt32(data, offset);
      offset += 4;

      for (let v = 0; v < vertexCount; v++) {
        offset += 12; // Skip vertex position
      }

      const triangleCount = this.readInt32(data, offset);
      offset += 4;
      offset += triangleCount * 12; // Skip triangle indices
    }

    // Read trigger box name as B3D string
    const nameResult = this.readB3DString(data, offset);
    offset = nameResult.offset;

    return { mesh: null, name: nameResult.str, endOffset: offset };
  }

  async parsePointEntity(data, offset) {
    const typeResult = this.readB3DString(data, offset);
    const type = typeResult.str;
    offset = typeResult.offset;

    const position = {
      x: this.readFloat32(data, offset),
      y: this.readFloat32(data, offset + 4),
      z: this.readFloat32(data, offset + 8),
    };
    offset += 12;

    const rotation = {
      pitch: this.readFloat32(data, offset),
      yaw: this.readFloat32(data, offset + 4),
      roll: this.readFloat32(data, offset + 8),
    };
    offset += 12;

    const dataObj = {};

    switch (type) {
      case "screen":
        const screenTex = this.readB3DString(data, offset);
        dataObj.screenTexture = screenTex.str;
        offset = screenTex.offset;
        break;
      case "light":
        dataObj.lightType = "point";
        dataObj.color = {
          r: data[offset],
          g: data[offset + 1],
          b: data[offset + 2],
        };
        offset += 3;
        dataObj.range = this.readFloat32(data, offset);
        offset += 4;
        break;
      case "soundemitter":
        const soundFile = this.readB3DString(data, offset);
        dataObj.soundFile = soundFile.str;
        offset = soundFile.offset;
        dataObj.loop = data[offset++] !== 0;
        dataObj.vol = this.readFloat32(data, offset);
        offset += 4;
        break;
      case "waypoint":
        const nextWP = this.readB3DString(data, offset);
        dataObj.nextWaypoint = nextWP.str;
        offset = nextWP.offset;
        break;
    }

    return { type, position, rotation, data: dataObj, endOffset: offset };
  }

  createFallbackRoom(filePath) {
    const roomName = filePath.split("/").pop().replace(".rmesh", "");
    return {
      header: "RoomMesh",
      hasTriggerBox: false,
      opaque: [{
        textures: [],
        vertices: this.generatePlaceholderVertices(100),
        triangles: this.generatePlaceholderTriangles(50),
        isAlpha: false,
      }],
      alpha: [],
      collision: [{
        vertices: this.generatePlaceholderVertices(30),
        triangles: this.generatePlaceholderTriangles(15),
        doubleSided: true,
      }],
      triggerBoxes: [],
      entities: [],
      sourcePath: filePath,
      fallback: true,
      roomName,
    };
  }

  generatePlaceholderVertices(count) {
    const vertices = [];
    for (let i = 0; i < count; i++) {
      vertices.push({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 10,
        z: (Math.random() - 0.5) * 20,
        uvs: [{ u: Math.random(), v: 1 - Math.random() }, {
          u: Math.random(),
          v: 1 - Math.random(),
        }],
        color: { r: 128, g: 128, b: 128, a: 255 },
      });
    }
    return vertices;
  }

  generatePlaceholderTriangles(count) {
    const triangles = [];
    const vertexCount = count * 3;
    for (let i = 0; i < count; i++) {
      const base = Math.floor(Math.random() * (vertexCount - 3));
      triangles.push({ v0: base, v1: base + 1, v2: base + 2 });
    }
    return triangles;
  }
}

function createThreeJSFromRMesh(roomData, textureLoader) {
  const group = new window.THREE.Group();

  for (const meshData of roomData.opaque) {
    const mesh = createThreeJSMesh(meshData, textureLoader);
    if (mesh) group.add(mesh);
  }

  for (const meshData of roomData.alpha) {
    const mesh = createThreeJSMesh(meshData, textureLoader, true);
    if (mesh) group.add(mesh);
  }

  group.userData.collisionMeshes = roomData.collision;
  group.userData.entities = [];

  for (const entity of roomData.entities) {
    const entityMesh = createEntityMesh(entity);
    if (entityMesh) {
      group.add(entityMesh);
      group.userData.entities.push(entityMesh);
    }
  }

  return group;
}

function createThreeJSMesh(meshData, textureLoader, isAlpha = false) {
  if (!meshData.vertices.length || !meshData.triangles.length) return null;

  const geometry = new window.THREE.BufferGeometry();
  const positions = [];
  const colors = [];
  const uvs = [[], []];

  for (const v of meshData.vertices) {
    positions.push(v.x, v.y, v.z);
    colors.push(v.color.r / 255, v.color.g / 255, v.color.b / 255);
    uvs[0].push(v.uvs[0].u, v.uvs[0].v);
    uvs[1].push(v.uvs[1].u, v.uvs[1].v);
  }

  geometry.setAttribute(
    "position",
    new window.THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute(
    "color",
    new window.THREE.Float32BufferAttribute(colors, 3),
  );
  geometry.setAttribute(
    "uv",
    new window.THREE.Float32BufferAttribute(uvs[0], 2),
  );
  geometry.setAttribute(
    "uv2",
    new window.THREE.Float32BufferAttribute(uvs[1], 2),
  );

  const indices = [];
  const maxVertexIndex = meshData.vertices.length - 1;
  for (const tri of meshData.triangles) {
    if (
      tri.v0 <= maxVertexIndex && tri.v1 <= maxVertexIndex &&
      tri.v2 <= maxVertexIndex
    ) {
      indices.push(tri.v0, tri.v1, tri.v2);
    }
  }

  if (indices.length === 0) {
    console.warn(`[RMeshParser] No valid triangles`);
    return null;
  }

  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const texture = meshData.textures && meshData.textures[0]
    ? meshData.textures[0].texture
    : null;
  const lightmap = meshData.lightmaps && meshData.lightmaps[0]
    ? meshData.lightmaps[0].texture
    : null;

  // Debug: check vertex validity
  const firstVert = meshData.vertices[0];
  console.log(
    "[RMeshParser] Mesh:",
    meshData.vertices.length,
    "verts,",
    meshData.triangles.length,
    "tris, texture:",
    texture ? "yes" : "no",
    "lightmap:",
    lightmap ? "yes" : "no",
  );

  const material = new window.THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: false, // Disable - textures provide color
    side: window.THREE.DoubleSide,
    transparent: isAlpha,
    opacity: isAlpha ? 0.7 : 1.0,
    map: texture || null,
    lightMap: lightmap || null,
    lightMapIntensity: 1.5,
  });

  const mesh = new window.THREE.Mesh(geometry, material);
  return mesh;
}

function createThreeJSFromRMesh(roomData, textureLoader) {
  const group = new window.THREE.Group();
  console.log(
    "[RMeshParser] Creating room group, opaque:",
    roomData.opaque.length,
    "alpha:",
    roomData.alpha.length,
  );

  let meshCount = 0;
  for (const meshData of roomData.opaque) {
    const mesh = createThreeJSMesh(meshData, textureLoader);
    if (mesh) {
      group.add(mesh);
      meshCount++;
    }
  }

  for (const meshData of roomData.alpha) {
    const mesh = createThreeJSMesh(meshData, textureLoader, true);
    if (mesh) {
      group.add(mesh);
      meshCount++;
    }
  }

  console.log("[RMeshParser] Added", meshCount, "meshes to group");
  console.log("[RMeshParser] Group children:", group.children.length);

  group.userData.collisionMeshes = roomData.collision;
  group.userData.entities = [];

  for (const entity of roomData.entities) {
    const entityMesh = createEntityMesh(entity);
    if (entityMesh) {
      group.add(entityMesh);
      group.userData.entities.push(entityMesh);
    }
  }

  console.log("[RMeshParser] Total group children:", group.children.length);
  return group;
}

function createEntityMesh(entity) {
  const { type, position, data } = entity;

  switch (type) {
    case "light":
      const color = data.color || { r: 255, g: 255, b: 255 };
      const light = new window.THREE.PointLight(
        new window.THREE.Color(color.r / 255, color.g / 255, color.b / 255),
        1,
        data.range || 20,
      );
      light.position.copy(position);
      light.userData.entityType = "light";
      return light;

    case "waypoint":
      const wp = new window.THREE.Mesh(
        new window.THREE.SphereGeometry(0.3, 8, 8),
        new window.THREE.MeshBasicMaterial({ color: 0xffff00 }),
      );
      wp.position.copy(position);
      wp.userData.entityType = "waypoint";
      return wp;

    case "soundemitter":
      const se = new window.THREE.Mesh(
        new window.THREE.BoxGeometry(0.5, 0.5, 0.5),
        new window.THREE.MeshBasicMaterial({
          color: 0x00ff00,
          transparent: true,
          opacity: 0.5,
        }),
      );
      se.position.copy(position);
      se.userData.entityType = "soundemitter";
      return se;

    default:
      const generic = new window.THREE.Mesh(
        new window.THREE.SphereGeometry(0.3, 8, 8),
        new window.THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.5,
        }),
      );
      generic.position.copy(position);
      generic.userData.entityType = type;
      return generic;
  }
}
