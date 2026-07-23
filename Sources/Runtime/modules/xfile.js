/**
 * X File (DirectX) Loader
 * Parses text-format X files for static meshes
 */

class XFileLoader {
  constructor(graphics, core) {
    this.graphics = graphics;
    this.core = core;
    this.debugMode = true;
    this.logCount = 0;

    // X file format info
    this.version = "";
    this.floatSize = 64;
  }

  async loadFile(filePath, parentId) {
    this.log(`[XFileLoader] Loading: ${filePath}`);

    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      const result = this.parseText(text);

      if (!result) {
        return this.createPlaceholder(parentId);
      }

      const entityId = await this.createThreeJSObjects(result, parentId);
      this.log(`[XFileLoader] Created entity: ${entityId}`);
      return entityId;
    } catch (error) {
      console.error(
        `[XFileLoader] Error loading ${filePath}: ${error.message}`,
      );
      return this.createPlaceholder(parentId);
    }
  }

  parseText(text) {
    this.logCount = 0;
    this.version = "";
    this.floatSize = 64;

    const result = {
      materials: [],
      meshes: [],
      frames: [],
      textures: [],
    };

    let pos = 0;

    // Skip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
      text = text.slice(1);
      pos = 1;
    }

    // Parse header
    if (!text.startsWith("xof")) {
      console.error("[XFileLoader] Invalid X file - no xof header");
      return null;
    }

    const headerMatch = text.match(/xof\s+(\d+\.\d+)(txt|bin)\s+(\d+)/);
    if (headerMatch) {
      this.version = headerMatch[1];
      this.floatSize = parseInt(headerMatch[3], 10);
      this.log(
        `[XFileLoader] X file version: ${this.version}, float size: ${this.floatSize}`,
      );
    }

    // Find first newline after header
    let firstNewline = text.indexOf("\n");
    if (firstNewline === -1) firstNewline = text.indexOf("\r");
    pos = firstNewline >= 0 ? firstNewline + 1 : 0;

    // Parse tokens
    const tokens = this.tokenize(text.slice(pos));

    // Debug: log first few tokens
    const firstFew = tokens.slice(0, 15).map((t) => t === "\n" ? "\\n" : t)
      .join(" | ");
    this.log(`[XFileLoader] First tokens: ${firstFew}`);

    let index = 0;
    let meshCount = 0;
    let debugCount = 0;

    this.log(
      `[XFileLoader] Starting parse loop, tokens.length: ${tokens.length}`,
    );

    while (index < tokens.length) {
      this.log(
        `[XFileLoader] Loop iteration: index=${index}, token="${
          tokens[index]
        }"`,
      );
      const token = tokens[index];

      // Skip newlines and empty tokens

      if (token === "FrameTransformMatrix") {
        index = this.parseTransformMatrix(tokens, index + 1, frame);
      } else if (token === "Frame") {
        index = this.parseFrame(tokens, index + 1, frame.children);
      } else if (token === "Mesh") {
        index = this.parseMesh(tokens, index + 1, result, frame);
      } else {
        index++;
      }
    }

    result.frames.push(frame);
    if (tokens[index] === "}") index++;
    return index;
  }

  parseTransformMatrix(tokens, index, target) {
    // Skip newlines before opening brace
    while (index < tokens.length && tokens[index] === "\n") index++;

    if (tokens[index] !== "{") {
      this.log(
        `[XFileLoader] parseTransformMatrix: expected '{' but got "${
          tokens[index]
        }"`,
      );
      return index;
    }
    index++;

    // Skip newlines after opening brace
    while (index < tokens.length && tokens[index] === "\n") index++;

    // Read 16 floats for 4x4 matrix (values separated by commas)
    const values = [];
    let readCount = 0;
    while (values.length < 16 && index < tokens.length) {
      if (!isNaN(parseFloat(tokens[index]))) {
        values.push(parseFloat(tokens[index]));
      }
      index++;
      readCount++;
      if (readCount > 100) break; // Safety limit
    }

    this.log(
      `[XFileLoader] parseTransformMatrix: read ${values.length} values in ${readCount} iterations`,
    );

    if (values.length === 16) {
      target.transform = values;
    }

    // Skip to closing brace (skip commas, semicolons, newlines)
    while (index < tokens.length && tokens[index] !== "}") index++;
    if (index < tokens.length && tokens[index] === "}") index++;

    this.log(`[XFileLoader] parseTransformMatrix: returning index ${index}`);
    return index;
  }

  parseMesh(tokens, index, result, parentFrame = null) {
    // Mesh mesh_name { vertexCount; vertices...; faceCount; faces...; [normals] [UVs] }
    const name = tokens[index];
    index++;

    if (tokens[index] !== "{") return index;
    index++;

    // Skip newlines after opening brace
    while (index < tokens.length && tokens[index] === "\n") index++;

    const mesh = {
      name,
      positions: [],
      normals: [],
      uvs: [],
      indices: [],
      materialIndex: 0,
      vertexCount: 0,
      triangleCount: 0,
    };

    // Read vertex count
    if (!isNaN(parseFloat(tokens[index]))) {
      mesh.vertexCount = parseInt(tokens[index], 10);
      index++;
    }

    // Skip semicolon and any newlines
    while (
      index < tokens.length && (tokens[index] === ";" || tokens[index] === "\n")
    ) index++;

    // Read vertices - format: x;y;z;, or x;y;z;;
    let vertexRead = 0;
    while (vertexRead < mesh.vertexCount && index < tokens.length) {
      // Skip newlines and commas between vertices
      while (
        index < tokens.length &&
        (tokens[index] === "," || tokens[index] === "\n")
      ) index++;

      if (index >= tokens.length) break;

      // Check if we have a number (x coordinate)
      if (!isNaN(parseFloat(tokens[index]))) {
        const x = parseFloat(tokens[index]);
        index++;

        // Skip semicolon
        while (index < tokens.length && tokens[index] === ";") index++;

        // Read y
        const y = parseFloat(tokens[index]);
        index++;

        // Skip semicolon
        while (index < tokens.length && tokens[index] === ";") index++;

        // Read z
        const z = parseFloat(tokens[index]);
        index++;

        mesh.positions.push(x, y, z);
        vertexRead++;

        // Skip trailing semicolons and commas
        while (
          index < tokens.length &&
          (tokens[index] === ";" || tokens[index] === ",")
        ) index++;
      } else {
        index++;
      }
    }

    // Read face count
    // Skip newlines and semicolons between vertices and face count
    while (
      index < tokens.length && (tokens[index] === ";" || tokens[index] === "\n")
    ) index++;

    if (!isNaN(parseFloat(tokens[index]))) {
      mesh.triangleCount = parseInt(tokens[index], 10);
      index++;
    }

    // Skip semicolon and newlines
    while (
      index < tokens.length && (tokens[index] === ";" || tokens[index] === "\n")
    ) index++;

    // Read faces (triangles)
    let faceRead = 0;
    while (faceRead < mesh.triangleCount && index < tokens.length) {
      // Face format: n;v0,v1,v2,...;
      if (!isNaN(parseFloat(tokens[index]))) {
        const numVerts = parseInt(tokens[index], 10);
        index++;

        // Read vertex indices
        let vertsRead = 0;
        while (vertsRead < numVerts && index < tokens.length) {
          if (!isNaN(parseFloat(tokens[index]))) {
            const vi = parseInt(tokens[index], 10);
            // Convert to triangle list (X files can have quads, etc.)
            if (numVerts === 3) {
              mesh.indices.push(vi);
            } else if (numVerts === 4) {
              // Convert quad to two triangles
              if (vertsRead < 3) {
                mesh.indices.push(vi);
              } else {
                // Last vertex of quad - add final triangle
                const v0 = mesh.indices[mesh.indices.length - 3];
                const v1 = mesh.indices[mesh.indices.length - 2];
                mesh.indices.push(v0, vi);
              }
            }
            vertsRead++;
            index++;
          } else if (tokens[index] === ",") {
            index++;
          } else {
            index++;
          }
        }

        this.log(
          `[XFileLoader] Parse complete. Final index: ${index}, tokens.length: ${tokens.length}`,
        );
        this.log(
          `[XFileLoader] Parsed: ${result.materials.length} materials, ${result.meshes.length} meshes, ${result.textures.length} textures`,
        );
        return result;
        faceRead++;
      } else if (tokens[index] === ";") {
        index++;
      } else if (tokens[index] === ",") {
        index++;
      } else {
        index++;
      }
    }

    // Adjust triangle count for quads
    mesh.triangleCount = mesh.indices.length / 3;

    // Parse optional data: MeshNormals, MeshTextureCoords
    while (index < tokens.length && tokens[index] !== "}") {
      const token = tokens[index];

      if (token === "MeshNormals") {
        index = this.parseMeshNormals(tokens, index + 1, mesh);
      } else if (token === "MeshTextureCoords") {
        index = this.parseMeshTextureCoords(tokens, index + 1, mesh);
      } else if (token === "MeshMaterialList") {
        index = this.parseMeshMaterialList(tokens, index + 1, mesh, result);
      } else {
        index++;
      }
    }

    if (tokens[index] === "}") index++;
    result.meshes.push(mesh);
    return index;
  }

  parseMeshNormals(tokens, index, mesh) {
    if (tokens[index] !== "{") return index;
    index++;

    let normalCount = 0;
    if (!isNaN(parseFloat(tokens[index]))) {
      normalCount = parseInt(tokens[index], 10);
      index++;
    }

    if (tokens[index] === ";") index++;

    // Read normals
    let read = 0;
    while (read < normalCount && index < tokens.length) {
      if (!isNaN(parseFloat(tokens[index]))) {
        const nx = parseFloat(tokens[index]);
        const ny = parseFloat(tokens[index + 1]);
        const nz = parseFloat(tokens[index + 2]);
        mesh.normals.push(nx, ny, nz);
        read++;
        index += 3;
      } else if (tokens[index] === ";") {
        index++;
      } else if (tokens[index] === ",") {
        index++;
      } else {
        index++;
      }
    }

    // Skip face normals if present
    if (index < tokens.length && !isNaN(parseFloat(tokens[index]))) {
      const faceNormalCount = parseInt(tokens[index], 10);
      index++;
      // Skip face normals data
      for (let i = 0; i < faceNormalCount; i++) {
        if (tokens[index] !== "{") break;
        index++;
        for (let j = 0; j < 3 && index < tokens.length; j++) {
          if (tokens[index] === ";") break;
          index++;
        }
        if (tokens[index] === "}") index++;
      }
    }

    if (tokens[index] === "}") index++;
    return index;
  }

  parseMeshTextureCoords(tokens, index, mesh) {
    if (tokens[index] !== "{") return index;
    index++;

    let uvCount = 0;
    if (!isNaN(parseFloat(tokens[index]))) {
      uvCount = parseInt(tokens[index], 10);
      index++;
    }

    if (tokens[index] === ";") index++;

    // Read UVs
    let read = 0;
    while (read < uvCount && index < tokens.length) {
      if (!isNaN(parseFloat(tokens[index]))) {
        const u = parseFloat(tokens[index]);
        const v = parseFloat(tokens[index + 1]);
        mesh.uvs.push(u, v);
        read++;
        index += 2;
      } else if (tokens[index] === ";") {
        index++;
      } else if (tokens[index] === ",") {
        index++;
      } else {
        index++;
      }
    }

    if (tokens[index] === "}") index++;
    return index;
  }

  parseMeshMaterialList(tokens, index, mesh, result) {
    if (tokens[index] !== "{") return index;
    index++;

    // Read material count
    let materialCount = 0;
    if (!isNaN(parseFloat(tokens[index]))) {
      materialCount = parseInt(tokens[index], 10);
      index++;
    }

    // Read face-to-material mapping
    let faceMatCount = 0;
    if (!isNaN(parseFloat(tokens[index]))) {
      faceMatCount = parseInt(tokens[index], 10);
      index++;
    }

    // Skip material indices
    for (let i = 0; i < faceMatCount && index < tokens.length; i++) {
      if (!isNaN(parseFloat(tokens[index]))) {
        if (i === 0) mesh.materialIndex = parseInt(tokens[index], 10);
        index++;
      } else if (tokens[index] === ";" || tokens[index] === ",") {
        index++;
      } else {
        index++;
      }
    }

    if (tokens[index] === "}") index++;
    return index;
  }

  async createThreeJSObjects(x3dData, parentId) {
    const root = new THREE.Group();
    const rootId = this.graphics.nextEntityId++;
    this.graphics.entities[rootId] = root;
    root.userData.entityId = rootId;
    root.userData.isXFile = true;

    if (parentId) {
      const parent = this.graphics.entities[parentId];
      if (parent) parent.add(root);
    } else if (this.graphics.scene) {
      this.graphics.scene.add(root);
    }

    // Create meshes
    for (const meshData of x3dData.meshes) {
      if (meshData.positions.length === 0) continue;

      const mesh = await this.createMesh(meshData, x3dData);
      if (mesh) {
        root.add(mesh);
      }
    }

    return rootId;
  }

  async createMesh(meshData, x3dData) {
    if (meshData.positions.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(meshData.positions, 3),
    );

    if (meshData.normals.length > 0) {
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(meshData.normals, 3),
      );
    } else {
      geometry.computeVertexNormals();
    }

    if (meshData.uvs.length > 0) {
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(meshData.uvs, 2),
      );
    }

    if (meshData.indices.length > 0) {
      geometry.setIndex(meshData.indices);
    }

    // Create material
    let material;
    const matIndex = Math.min(
      meshData.materialIndex,
      x3dData.materials.length - 1,
    );
    if (matIndex >= 0) {
      const matData = x3dData.materials[matIndex];
      const materialOptions = {
        color: new THREE.Color(
          matData.color.r,
          matData.color.g,
          matData.color.b,
        ),
        opacity: matData.color.a,
        transparent: matData.color.a < 1,
        side: THREE.DoubleSide,
      };

      // Load texture if available
      if (
        matData.textureIndex >= 0 &&
        matData.textureIndex < x3dData.textures.length
      ) {
        const texName = x3dData.textures[matData.textureIndex];
        try {
          const texLoader = new THREE.TextureLoader();
          const texPath = texName.includes("\\")
            ? "/scpcb/GFX/" + texName.split("\\").join("/")
            : texName;
          materialOptions.map = await new Promise((resolve) => {
            texLoader.load(texPath, resolve, undefined, () => resolve(null));
          });
        } catch (e) {
          this.log(`[XFileLoader] Failed to load texture: ${texName}`);
        }
      }

      material = new THREE.MeshStandardMaterial(materialOptions);
    } else {
      material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        side: THREE.DoubleSide,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.meshName = meshData.name;
    mesh.userData.isXMesh = true;

    return mesh;
  }

  createPlaceholder(parentId) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const root = new THREE.Group();
    const rootId = this.graphics.nextEntityId++;
    this.graphics.entities[rootId] = root;
    root.userData.isXFile = true;
    root.add(mesh);

    if (parentId) {
      const parent = this.graphics.entities[parentId];
      if (parent) parent.add(root);
    } else if (this.graphics.scene) {
      this.graphics.scene.add(root);
    }

    return rootId;
  }

  log(message) {
    if (!this.debugMode) return;
    this.logCount++;
    if (this.logCount <= 20) {
      console.log(message);
    }
  }
}

// Expose to window for browser use
if (typeof window !== "undefined") {
  window.XFileLoader = XFileLoader;
}

module.exports = XFileLoader;
