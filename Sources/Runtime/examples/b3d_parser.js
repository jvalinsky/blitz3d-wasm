/**
 * B3D Model Parser for SCPCB Asset Viewer
 * Based on Blitz3D B3D format specification
 * Chunks: 4-byte ID + 4-byte size (big-endian), null-terminated strings
 */

class B3DParser {
  constructor() {
    this.textures = [];
    this.brushes = [];
    this.meshes = [];
  }

  async parseFile(filePath) {
    console.log(`[B3DParser] Loading: ${filePath}`);
    let response;
    try {
      response = await fetch(filePath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.warn(`[B3DParser] Cannot fetch ${filePath}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    console.log(`[B3DParser] Fetched ${data.length} bytes`);
    return this.parseBinaryData(data);
  }

  parseBinaryData(data) {
    this.data = data;
    this.offset = 0;
    this.textures = [];
    this.brushes = [];
    this.meshes = [];

    const headerBytes = [];
    for (let i = 0; i < 4; i++) {
      headerBytes.push(this.data[this.offset++]);
    }
    const headerStr = String.fromCharCode(...headerBytes);
    console.log(`[B3DParser] Header: "${headerStr}"`);

    if (headerStr !== "BB3D") {
      console.error('[B3DParser] Invalid B3D header - expected "BB3D"');
      return null;
    }

    const version = this.readInt32LE();
    console.log(`[B3DParser] Version: 0x${version.toString(16)}`);

    let chunksRead = 0;
    const maxChunks = 1000;

    while (this.offset < this.data.length && chunksRead < maxChunks) {
      chunksRead++;

      if (this.offset + 8 > this.data.length) {
        console.log("[B3DParser] Reached end of file");
        break;
      }

      // Chunk ID and size are stored as little-endian 32-bit integers
      const chunkId = this.readInt32LE();
      const chunkSize = this.readInt32LE();
      const chunkStart = this.offset;

      const chunkName = String.fromCharCode(
        chunkId & 0xff,
        (chunkId >> 8) & 0xff,
        (chunkId >> 16) & 0xff,
        (chunkId >> 24) & 0xff,
      );

      if (chunksRead <= 10) {
        console.log(
          `[B3DParser] Chunk: ${chunkName} (0x${
            chunkId.toString(16)
          }), size: ${chunkSize}`,
        );
      } else if (chunksRead === 11) {
        console.log("[B3DParser] ... (more chunks)");
      }

      switch (chunkId) {
        case 0x54455853: // 'TEXS' (little-endian: 0x53='S', 0x58='X', 0x45='E', 0x54='T')
          this.readTextures(chunkSize);
          break;
        case 0x53555242: // 'BRUS'
          this.readBrushes(chunkSize);
          break;
        case 0x4D455348: // 'MESH'
          this.readMesh(chunkSize);
          break;
        default:
          this.skipChunk(chunkSize);
      }

      this.offset = chunkStart + chunkSize;
    }

    console.log(
      `[B3DParser] Parsed: ${this.textures.length} textures, ${this.brushes.length} brushes, ${this.meshes.length} meshes`,
    );
    return {
      textures: this.textures,
      brushes: this.brushes,
      meshes: this.meshes,
    };
  }

  readChunkIdBE() {
    return (this.data[this.offset++] << 24) |
      (this.data[this.offset++] << 16) |
      (this.data[this.offset++] << 8) |
      this.data[this.offset++];
  }

  readInt32BE() {
    return (this.data[this.offset++] << 24) |
      (this.data[this.offset++] << 16) |
      (this.data[this.offset++] << 8) |
      this.data[this.offset++];
  }

  readInt32LE() {
    return this.data[this.offset] |
      (this.data[this.offset + 1] << 8) |
      (this.data[this.offset + 2] << 16) |
      (this.data[this.offset + 3] << 24);
  }

  readFloat32() {
    const view = new DataView(
      this.data.buffer,
      this.data.byteOffset + this.offset,
      4,
    );
    const val = view.getFloat32(0, false);
    this.offset += 4;
    return val;
  }

  readNullTerminatedString() {
    let str = "";
    while (this.offset < this.data.length && this.data[this.offset] !== 0) {
      str += String.fromCharCode(this.data[this.offset++]);
    }
    this.offset++;
    return str;
  }

  skipChunk(size) {
    this.offset += size;
  }

  readTextures(chunkSize) {
    const endOffset = this.offset + chunkSize;
    while (this.offset < endOffset) {
      const name = this.readNullTerminatedString();
      const flags = this.readInt32LE();
      const blend = this.readInt32LE();
      const posU = this.readFloat32();
      const posV = this.readFloat32();
      const scaleU = this.readFloat32();
      const scaleV = this.readFloat32();
      const rotation = this.readFloat32();

      this.textures.push({
        name,
        flags,
        blend,
        position: { u: posU, v: posV },
        scale: { u: scaleU, v: scaleV },
        rotation,
      });
    }
    console.log(`[B3DParser] Read ${this.textures.length} textures`);
  }

  readBrushes(chunkSize) {
    const endOffset = this.offset + chunkSize;
    const numTexs = this.readInt32LE();

    while (this.offset < endOffset) {
      const name = this.readNullTerminatedString();
      const red = this.readFloat32();
      const green = this.readFloat32();
      const blue = this.readFloat32();
      const alpha = this.readFloat32();
      const shininess = this.readFloat32();
      const blend = this.readInt32LE();
      const fx = this.readInt32LE();

      const texIds = [];
      for (let i = 0; i < numTexs && this.offset < endOffset; i++) {
        texIds.push(this.readInt32LE());
      }

      this.brushes.push({
        name,
        color: { r: red, g: green, b: blue },
        alpha,
        shininess,
        blend,
        fx,
        textureIds: texIds,
      });
    }
    console.log(`[B3DParser] Read ${this.brushes.length} brushes`);
  }

  readMesh(chunkSize) {
    const endOffset = this.offset + chunkSize;
    const meshId = this.readInt32LE();
    const flags = this.readInt32LE();

    let vertices = [];
    let triangles = [];
    let brushIndex = -1;

    while (this.offset < endOffset) {
      const subChunkId = this.readInt32LE();
      const subChunkSize = this.readInt32LE();
      const subEndOffset = this.offset + subChunkSize;

      switch (subChunkId) {
        case 0x56525453: // 'VRTS' (little-endian)
          const vFlags = this.readInt32LE();
          const tcSets = this.readInt32LE();
          const tcSize = this.readInt32LE();

          while (this.offset < subEndOffset) {
            const x = this.readFloat32();
            const y = this.readFloat32();
            const z = this.readFloat32();

            let normal = null;
            if (vFlags & 1) {
              normal = {
                x: this.readFloat32(),
                y: this.readFloat32(),
                z: this.readFloat32(),
              };
            }

            let color = null;
            if (vFlags & 2) {
              color = {
                r: this.data[this.offset++],
                g: this.data[this.offset++],
                b: this.data[this.offset++],
                a: this.data[this.offset++],
              };
            }

            const uvs = [];
            for (let k = 0; k < tcSets && k < 2; k++) {
              uvs.push({ u: this.readFloat32(), v: 1 - this.readFloat32() }); // Flip V
            }

            vertices.push({ x, y, z, normal, color, uvs });
          }
          break;

        case 0x54524953: // 'TRIS'
          brushIndex = this.readInt32LE();

          while (this.offset < subEndOffset) {
            triangles.push({
              v0: this.readInt32LE(),
              v1: this.readInt32LE(),
              v2: this.readInt32LE(),
            });
          }
          break;

        default:
          this.offset = subEndOffset;
      }

      this.offset = subEndOffset;
    }

    this.meshes.push({ id: meshId, flags, vertices, triangles, brushIndex });
    console.log(
      `[B3DParser] Mesh: ${vertices.length} verts, ${triangles.length} tris`,
    );
  }
}

function createThreeJSFromB3D(b3dData, textureLoader) {
  if (!b3dData || !b3dData.meshes.length) return null;

  const group = new window.THREE.Group();
  console.log("[B3DParser] Creating Three.js from B3D");

  for (const meshData of b3dData.meshes) {
    if (meshData.vertices.length === 0 || meshData.triangles.length === 0) {
      continue;
    }

    const geometry = new window.THREE.BufferGeometry();
    const positions = [];
    const colors = [];
    const uvs = [];

    for (const v of meshData.vertices) {
      positions.push(v.x, v.y, v.z);
      if (v.color) {
        colors.push(v.color.r / 255, v.color.g / 255, v.color.b / 255);
      } else {
        colors.push(1, 1, 1);
      }
      if (v.uvs && v.uvs[0]) {
        uvs.push(v.uvs[0].u, 1 - v.uvs[0].v); // Flip V
      } else {
        uvs.push(0, 0);
      }
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
      new window.THREE.Float32BufferAttribute(uvs, 2),
    );

    const indices = [];
    for (const tri of meshData.triangles) {
      if (
        tri.v0 < meshData.vertices.length &&
        tri.v1 < meshData.vertices.length && tri.v2 < meshData.vertices.length
      ) {
        indices.push(tri.v0, tri.v1, tri.v2);
      }
    }

    if (indices.length === 0) {
      console.warn("[B3DParser] No valid triangles");
      continue;
    }

    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    let material;
    const brush = meshData.brushIndex >= 0
      ? b3dData.brushes[meshData.brushIndex]
      : null;

    if (brush) {
      const texture = brush.textureIds && brush.textureIds[0] >= 0 &&
          brush.textureIds[0] < b3dData.textures.length
        ? textureLoader(b3dData.textures[brush.textureIds[0]].name)
        : null;

      material = new window.THREE.MeshStandardMaterial({
        color: new window.THREE.Color(
          brush.color.r,
          brush.color.g,
          brush.color.b,
        ),
        opacity: brush.alpha,
        transparent: brush.alpha < 1,
        side: window.THREE.DoubleSide,
        map: texture,
      });
    } else {
      material = new window.THREE.MeshStandardMaterial({
        color: 0x888888,
        side: window.THREE.DoubleSide,
      });
    }

    group.add(new window.THREE.Mesh(geometry, material));
  }

  console.log(`[B3DParser] Created group with ${group.children.length} meshes`);
  return group;
}
