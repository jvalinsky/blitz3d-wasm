/**
 * Blitz3D Runtime Mesh Module
 * Handles procedural mesh generation and manipulation using Three.js BufferGeometry
 * Supports both JS meshes and WASM-backed meshes
 */

class Blitz3DSurface {
  constructor(mesh) {
    this.mesh = mesh;
    this.vertices = []; // [x, y, z, u, v, w, r, g, b, a]
    this.indices = [];
    this.dirty = true;

    // Geometry buffers
    this.geometry = new THREE.BufferGeometry();
    this.mesh.add(
      new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
        }),
      ),
    );
  }

  addVertex(x, y, z, u, v, w) {
    // Negate Z for Left-Handed -> Right-Handed conversion
    this.vertices.push(
      x,
      y,
      -z,
      u || 0,
      v || 0,
      255,
      255,
      255,
      255, // Default color white
    );
    this.dirty = true;
    return (this.vertices.length / 9) - 1;
  }

  addTriangle(v0, v1, v2) {
    // Reverse winding order for Left-Handed -> Right-Handed
    this.indices.push(v0, v2, v1);
    this.dirty = true;
    return (this.indices.length / 3) - 1;
  }

  vertexColor(v, r, g, b, a) {
    const index = v * 9 + 5;
    if (index < this.vertices.length) {
      this.vertices[index] = r;
      this.vertices[index + 1] = g;
      this.vertices[index + 2] = b;
      this.vertices[index + 3] = a || 255;
      this.dirty = true;
    }
  }

  setVertexUV(v, u, w) {
    // w parameter is ignored in Three.js (only u, v used)
    const index = v * 9 + 3;
    if (index < this.vertices.length) {
      this.vertices[index] = u;
      // w parameter would be stored here if we had space
      this.dirty = true;
    }
  }

  update() {
    if (!this.dirty) return;

    const vertexCount = this.vertices.length / 9;

    // Check if we have enough vertices
    if (vertexCount === 0) {
      console.log("Blitz3DSurface.update: No vertices to update");
      return;
    }

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const colors = new Float32Array(vertexCount * 4); // r,g,b,a 0-1 range

    for (let i = 0; i < vertexCount; i++) {
      const src = i * 9;
      const dst = i * 3;
      const dstUV = i * 2;
      const dstCol = i * 4;

      positions[dst] = this.vertices[src];
      positions[dst + 1] = this.vertices[src + 1];
      positions[dst + 2] = this.vertices[src + 2];

      uvs[dstUV] = this.vertices[src + 3];
      uvs[dstUV + 1] = this.vertices[src + 4];

      colors[dstCol] = this.vertices[src + 5] / 255.0;
      colors[dstCol + 1] = this.vertices[src + 6] / 255.0;
      colors[dstCol + 2] = this.vertices[src + 7] / 255.0;
      colors[dstCol + 3] = (this.vertices[src + 8] || 255) / 255.0;
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));

    if (this.indices.length > 0) {
      this.geometry.setIndex(this.indices);
    }

    this.geometry.computeVertexNormals();

    // Mark for upload
    if (this.geometry.attributes.position) {
      this.geometry.attributes.position.needsUpdate = true;
    }
    if (this.geometry.attributes.uv) {
      this.geometry.attributes.uv.needsUpdate = true;
    }
    if (this.geometry.attributes.color) {
      this.geometry.attributes.color.needsUpdate = true;
    }

    this.dirty = false;
    console.log(
      "Blitz3DSurface.update: Updated " + vertexCount + " vertices, " +
        (this.indices.length / 3) + " triangles",
    );
  }
}

/**
 * WASM-backed surface - reads mesh data directly from WASM memory
 * Zero-copy approach for maximum performance
 */
class Blitz3DWasmSurface {
  constructor(core, mesh, surfaceIdx) {
    this.core = core;
    this.mesh = mesh;
    this.surfaceIdx = surfaceIdx;

    // Get pointers from WASM
    this.vertexPtr =
      this.core.engineExports?.GetSurfaceVerticesPtr(mesh, surfaceIdx) || 0;
    this.indexPtr =
      this.core.engineExports?.GetSurfaceIndicesPtr(mesh, surfaceIdx) || 0;
    this.vertexCount =
      this.core.engineExports?.GetSurfaceVertexCount(mesh, surfaceIdx) || 0;
    this.indexCount =
      this.core.engineExports?.GetSurfaceIndexCount(mesh, surfaceIdx) || 0;

    // Create geometry
    this.geometry = new THREE.BufferGeometry();
    this.mesh.add(
      new THREE.Mesh(
        this.geometry,
        new THREE.MeshBasicMaterial({
          vertexColors: true,
          side: THREE.DoubleSide,
        }),
      ),
    );

    this.update();
  }

  update() {
    if (!this.core.memory || this.vertexPtr === 0 || this.indexPtr === 0) {
      return;
    }

    const memory = new Float32Array(this.core.memory.buffer);
    const indexMemory = new Int32Array(this.core.memory.buffer);

    const vertexCount = this.vertexCount;
    const indexCount = this.indexCount;

    if (vertexCount === 0 || indexCount === 0) {
      return;
    }

    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const colors = new Float32Array(vertexCount * 4);
    const indices = [];

    // Vertex format in WASM: x, y, z, nx, ny, nz, u, v, r, g, b, a (11 floats)
    const stride = 11;

    for (let i = 0; i < vertexCount; i++) {
      const offset = (this.vertexPtr / 4) + (i * stride);

      positions[i * 3] = memory[offset];
      positions[i * 3 + 1] = memory[offset + 1];
      positions[i * 3 + 2] = memory[offset + 2]; // Z is already in right-handed coords

      uvs[i * 2] = memory[offset + 6];
      uvs[i * 2 + 1] = memory[offset + 7];

      // Colors are 0-255, convert to 0-1
      colors[i * 4] = memory[offset + 8] / 255.0;
      colors[i * 4 + 1] = memory[offset + 9] / 255.0;
      colors[i * 4 + 2] = memory[offset + 10] / 255.0;
      colors[i * 4 + 3] = 1.0;
    }

    // Read indices
    for (let i = 0; i < indexCount; i++) {
      const offset = (this.indexPtr / 4) + i;
      indices.push(indexMemory[offset]);
    }

    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    this.geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    this.geometry.setIndex(indices);
    this.geometry.computeVertexNormals();
  }
}

// Blitz3DMesh is actually a constructor function that returns the module
function Blitz3DMesh(graphics) {
  const surfaces = {};

  return {
    Blitz3DSurface,
    Blitz3DWasmSurface,
    setupImports: function (imports) {
      // Mesh surface functions
      imports.env.CountSurfaces = (meshId) => {
        const entity = graphics.entities[meshId];
        return entity?.surfaces?.length || 0;
      };

      imports.env.GetSurface = (meshId, index) => {
        const entity = graphics.entities[meshId];
        return entity?.surfaces?.[index] || 0;
      };

      imports.env.FindSurface = (meshId, brushId) => {
        const entity = graphics.entities[meshId];
        if (entity?.surfaces) {
          for (let i = 0; i < entity.surfaces.length; i++) {
            if (entity.surfaces[i].brush === brushId) return i;
          }
        }
        return 0;
      };

      imports.env.ClearSurface = (surfaceId, clearVerts, clearTris) => {
        console.log("ClearSurface: surfaceId=" + surfaceId);
      };

      imports.env.AddVertexExtended = (
        surfaceId,
        x,
        y,
        z,
        u,
        v,
        w,
        nx,
        ny,
        nz,
      ) => {
        console.log(
          `AddVertexExtended: surface=${surfaceId} pos=(${x},${y},${z})`,
        );
        return 0; // Return vertex index
      };

      imports.env.SetSurfaceTexture = (surfaceId, textureId, frame, index) => {
        console.log(
          `SetSurfaceTexture: surface=${surfaceId} texture=${textureId}`,
        );
      };

      imports.env.SetSurfaceLightmap = (surfaceId, textureId) => {
        console.log(
          `SetSurfaceLightmap: surface=${surfaceId} lightmap=${textureId}`,
        );
      };

      imports.env.AddCollisionVertex = (surfaceId, x, y, z) => {
        return 0; // Return vertex index
      };

      imports.env.AddCollisionTriangle = (surfaceId, v0, v1, v2) => {
        return 0; // Return triangle index
      };

      // Simple mesh clone helper (geometry/material duplication is shallow)
      imports.env.CopyMesh = (meshId) => {
        const mesh = graphics.entities[meshId];
        if (mesh && mesh.clone) {
          const clone = mesh.clone(true);
          const id = graphics.nextEntityId++;
          graphics.entities[id] = clone;
          graphics.scene.add(clone);
          return id;
        }
        return 0;
      };
    },
  };
}

// Export to window for browser
if (typeof window !== "undefined") {
  window.Blitz3DMesh = Blitz3DMesh;
  window.Blitz3DSurface = Blitz3DSurface;
  window.Blitz3DWasmSurface = Blitz3DWasmSurface;
}

module.exports = Blitz3DMesh;
