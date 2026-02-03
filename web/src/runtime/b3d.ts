/**
 * Blitz3D B3D Mesh Loader
 * Parses B3D format files and creates Three.js objects with animation support
 */

import * as THREE from "three";
import type { Blitz3DGraphicsInterface, GraphicsCore } from "./graphics/types.ts";
import type { Blitz3DFileIO } from "./fileio.ts";

type B3DTexture = {
  name: string;
  flags?: number;
  /** Blitz3D texture blend mode (0..3) as stored in TEXS. */
  blend?: number;
  position?: { u: number; v: number };
  scale?: { u: number; v: number };
  rotation?: number;
};

type B3DBrush = {
  name?: string;
  color: { r: number; g: number; b: number };
  alpha: number;
  shininess: number;
  blend: number;
  fx?: number;
  textureIds?: number[];
};

type B3DMeshData = {
  positions: number[];
  normals?: number[];
  colors?: number[];
  uvs?: number[][];
  indices?: number[];
  brushIndex: number;
};

type B3DParsedData = {
  textures: B3DTexture[];
  brushes: B3DBrush[];
  meshes: B3DMeshData[];
  animations: unknown[];
  bones: unknown[];
};

export class B3DLoader {
  private graphics: Blitz3DGraphicsInterface;
  private core: GraphicsCore & { fileIO: Blitz3DFileIO };
  private fileIO: Blitz3DFileIO;
  private debugMode: boolean;
  private logCount: number;

  // Internal parsing state
  private data: Uint8Array | null;
  private offset: number;
  private textures: B3DTexture[];
  private brushes: B3DBrush[];
  private meshes: B3DMeshData[];
  private animations: unknown[];
  private bones: unknown[];

  private _sourceFilePath: string | null;

  constructor(graphics: Blitz3DGraphicsInterface, core: GraphicsCore & { fileIO: Blitz3DFileIO }) {
    this.graphics = graphics;
    this.core = core;
    this.fileIO = core.fileIO;
    this.debugMode = true;
    this.logCount = 0;
    this._sourceFilePath = null;

    // Internal state
    this.data = null;
    this.offset = 0;
    this.textures = [];
    this.brushes = [];
    this.meshes = [];
    this.animations = [];
    this.bones = [];
  }

  log(message: string) {
    if (!this.debugMode) return;
    this.logCount++;
    if (this.logCount <= 50) {
      console.log(message);
    } else if (this.logCount === 51) {
      console.log("... (B3D logging truncated)");
    }
  }

  async loadFile(filePath: string, parentId: number, targetId?: number) {
    this.log(`[B3DLoader] Loading: ${filePath}`);
    this._sourceFilePath = filePath;

    const handle = this.fileIO.openFile(filePath);
    if (handle === 0) {
      this.log(`[B3DLoader] Failed to open file: ${filePath}`);
      return this.createPlaceholder(parentId, targetId);
    }

    try {
      const data = await this.readFile(handle, filePath);

      // Try WASM parser first if available
      const engineExports = (typeof window !== "undefined")
        ? (window.Blitz3D?.engineExports as Record<string, unknown> | undefined)
        : undefined;
      if (engineExports && typeof engineExports["ParseB3D"] === "function") {
        return await this.loadWithWasm(data, parentId);
      }

      const b3dData = this.parseBinaryData(data);
      const entityId = await this.createThreeJSObjects(
        b3dData,
        parentId,
        targetId,
      );
      this.log(`[B3DLoader] Created entity: ${entityId}`);
      return entityId;
    } catch (error: any) {
      console.error(`[B3DLoader] Error loading ${filePath}: ${error.message}`);
      return this.createPlaceholder(parentId, targetId);
    } finally {
      this.fileIO.closeFile(handle);
    }
  }

  private resolveTextureUrl(textureName: unknown): string | null {
    if (typeof textureName !== "string") return null;
    const nameRaw = textureName.trim();
    if (!nameRaw) return null;

    const norm = nameRaw.replace(/\\/g, "/");
    const leaf = norm.split("/").pop() || norm;

    const baseDir = (this._sourceFilePath ?? "")
      .replace(/\\/g, "/")
      .replace(/\/[^/]+$/, "");

    const candidates: string[] = [];
    const push = (p: string) => {
      const v = String(p || "").replace(/\\/g, "/").replace(/\/+/g, "/");
      if (!v) return;
      if (!candidates.includes(v)) candidates.push(v);
    };

    // Prefer the embedded name first (may already include a relative path).
    push(norm);
    // Many SCPCB source assets embed absolute Windows paths; try basename too.
    push(leaf);

    // Try relative to the model directory.
    if (baseDir) {
      push(`${baseDir}/${leaf}`);
      push(`${baseDir}/${norm}`);
    }

    // If we have a VFS URL resolver, prefer the first candidate it can resolve.
    const r = globalThis.__BLITZ3D_URL_RESOLVER;
    if (typeof r === "function") {
      for (const c of candidates) {
        try {
          const out = r(c);
          if (typeof out === "string" && out) return out;
        } catch {
          // ignore
        }
      }
    }

    return candidates[0] ?? null;
  }

  /**
   * Pick a reasonable "diffuse" texture for display, and optionally a normal map.
   *
   * Blitz3D supports multi-texturing; SCP:CB assets may use multiple stages for
   * lightmaps/detail/etc. For the interpreter demo we try to select a sensible
   * `map` and avoid accidentally showing a normal/lightmap as diffuse.
   */
  private selectBrushTextures(
    brush: B3DBrush,
    b3dData: B3DParsedData,
  ): { diffuse?: B3DTexture; normal?: B3DTexture } {
    const ids = (brush.textureIds ?? []).filter((id) => Number.isFinite(id) && id >= 0);
    const textures = ids
      .map((id) => b3dData.textures[id])
      .filter((t): t is B3DTexture => !!t && typeof t.name === "string");

    const classify = (t: B3DTexture) => {
      const name = t.name;
      const n = name.toLowerCase().replace(/\\/g, "/");
      const leaf = n.split("/").pop() ?? n;
      const base = leaf.replace(/\.[a-z0-9]+$/i, "");

      const isNormal = /(^|[_\-.])(normal|nrm|norm|_n)([_\-.]|$)/i.test(base) ||
        /normalmap/i.test(base);
      const isSpec = /(^|[_\-.])(spec|spc|gloss|rough|metal)([_\-.]|$)/i.test(base);
      const isLight = /(^|[_\-.])(light|lm|lightmap)([_\-.]|$)/i.test(base);
      const isDiffuse = /(^|[_\-.])(diffuse|albedo|basecolor|color|col|diff)([_\-.]|$)/i.test(
        base,
      );

      // Higher is better for "diffuse map" selection.
      let score = 10;
      if (isDiffuse) score += 50;
      if (isNormal) score -= 80;
      if (isLight) score -= 40;
      if (isSpec) score -= 30;

      // TEXS blend is a strong hint for multi-texture setups:
      // Multiply/add textures are frequently used as lightmaps/detail maps.
      const blend = Number(t.blend);
      if (Number.isFinite(blend)) {
        if (blend === 2) score -= 60; // multiply
        else if (blend === 3) score -= 40; // add
      }
      return { isNormal, score };
    };

    let bestDiffuse: B3DTexture | undefined;
    let bestDiffuseScore = -Infinity;
    let bestNormal: B3DTexture | undefined;
    let bestNormalScore = -Infinity;

    for (const t of textures) {
      const { isNormal, score } = classify(t);
      if (score > bestDiffuseScore) {
        bestDiffuseScore = score;
        bestDiffuse = t;
      }
      if (isNormal && score > bestNormalScore) {
        bestNormalScore = score;
        bestNormal = t;
      }
    }

    // If the best diffuse candidate is actually a strong normal candidate, drop it.
    if (bestDiffuse && classify(bestDiffuse).isNormal) {
      bestDiffuse = undefined;
    }

    return { diffuse: bestDiffuse, normal: bestNormal };
  }

  private async loadTextureFromUrl(
    url: string,
    opts: { srgb?: boolean } = {},
  ): Promise<THREE.Texture> {
    const loader = new THREE.TextureLoader();
    const texture = await new Promise<THREE.Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });
    texture.flipY = false;
    if (opts.srgb) {
      // Three r152+ uses `colorSpace` instead of `encoding`.
      (texture as unknown as { colorSpace?: string }).colorSpace = THREE.SRGBColorSpace;
    }
    return texture;
  }

  async loadWithWasm(data: Uint8Array, parentId: number) {
    if (typeof window === "undefined") return this.createPlaceholder(parentId);
    const engine = window.Blitz3D?.engineExports as Record<string, unknown> | undefined;
    if (!engine) return this.createPlaceholder(parentId);

    // 1. Create a bank in WASM memory for the file data
    const CreateBank = engine["CreateBank"] as ((n: number) => number) | undefined;
    const GetBankPtr = engine["GetBankPtr"] as ((bankId: number) => number) | undefined;
    const ParseB3D = engine["ParseB3D"] as ((bankId: number) => number) | undefined;
    const FreeBank = engine["FreeBank"] as ((bankId: number) => void) | undefined;
    const memory = engine["memory"] as WebAssembly.Memory | undefined;
    if (!CreateBank || !GetBankPtr || !ParseB3D || !FreeBank || !memory) {
      return this.createPlaceholder(parentId);
    }

    const bankId = CreateBank(data.length);

    // 2. Copy data to WASM memory efficiently
    const ptr = GetBankPtr(bankId);
    const dest = new Uint8Array(memory.buffer, ptr, data.length);
    dest.set(data);

    // 3. Parse in WASM
    const meshId = ParseB3D(bankId);
    if (meshId === 0) throw new Error("WASM B3D Parser failed");

    // 4. Create Three.js objects using shared memory
    const entityId = await this.createThreeJSFromWasm(engine, meshId, parentId);

    // 5. Cleanup bank
    FreeBank(bankId);

    return entityId;
  }

  async createThreeJSFromWasm(
    engine: Record<string, unknown>,
    meshId: number,
    parentId: number,
  ) {
    const GetMeshSurfaceCount =
      engine["GetMeshSurfaceCount"] as ((meshId: number) => number) | undefined;
    const GetSurfaceVertexCount =
      engine["GetSurfaceVertexCount"] as ((meshId: number, surfIndex: number) => number) | undefined;
    const GetSurfaceIndexCount =
      engine["GetSurfaceIndexCount"] as ((meshId: number, surfIndex: number) => number) | undefined;
    const GetSurfaceVerticesPtr =
      engine["GetSurfaceVerticesPtr"] as ((meshId: number, surfIndex: number) => number) | undefined;
    const GetSurfaceIndicesPtr =
      engine["GetSurfaceIndicesPtr"] as ((meshId: number, surfIndex: number) => number) | undefined;
    const memory = engine["memory"] as WebAssembly.Memory | undefined;
    if (
      !GetMeshSurfaceCount || !GetSurfaceVertexCount || !GetSurfaceIndexCount ||
      !GetSurfaceVerticesPtr || !GetSurfaceIndicesPtr || !memory
    ) {
      return this.createPlaceholder(parentId);
    }
    const root = new THREE.Group();
    const rootId = this.graphics.nextEntityId++;
    this.graphics.entities[rootId] = root;

    if (parentId) {
      const parent = this.graphics.entities[parentId];
      if (parent) parent.add(root);
    } else if (this.graphics.scene) {
      this.graphics.scene.add(root);
    }

    const surfCount = GetMeshSurfaceCount(meshId);
    for (let i = 0; i < surfCount; i++) {
      const vCount = GetSurfaceVertexCount(meshId, i);
      const iCount = GetSurfaceIndexCount(meshId, i);

      const vPtr = GetSurfaceVerticesPtr(meshId, i);
      const iPtr = GetSurfaceIndicesPtr(meshId, i);

      // Create views directly into WASM memory! (Zero-copy)
      const buf = memory.buffer;

      // Vertex data: x,y,z, nx,ny,nz, u,v, r,g,b (11 floats per vertex)
      const vertices = new Float32Array(buf, vPtr, vCount * 11);
      const indices = new Int32Array(buf, iPtr, iCount);

      const geometry = new THREE.BufferGeometry();

      // Extract attributes from the interleaved buffer
      const interleavedBuffer = new THREE.InterleavedBuffer(vertices, 11);

      geometry.setAttribute(
        "position",
        new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 0),
      );
      geometry.setAttribute(
        "normal",
        new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 3),
      );
      geometry.setAttribute(
        "uv",
        new THREE.InterleavedBufferAttribute(interleavedBuffer, 2, 6),
      );
      geometry.setAttribute(
        "color",
        new THREE.InterleavedBufferAttribute(interleavedBuffer, 3, 8),
      );

      geometry.setIndex(new THREE.BufferAttribute(indices, 1));

      const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      root.add(mesh);
    }

    return rootId;
  }

  async readFile(handle: number, filePath: string) {
    // Prefer the handle-based APIs (openFile() returns a handle).
    if (typeof (this.fileIO as any).readAllBytes === "function") {
      return (this.fileIO as any).readAllBytes(handle) as Uint8Array;
    }

    const size = (typeof (this.fileIO as any).fileSizeFromHandle === "function")
      ? ((this.fileIO as any).fileSizeFromHandle(handle) as number)
      : this.fileIO.fileSize(filePath);

    const buffer = new Uint8Array(Math.max(0, size | 0));
    for (let i = 0; i < buffer.length; i++) buffer[i] = this.fileIO.readByte(handle);
    return buffer;
  }

  parseBinaryData(data: Uint8Array): B3DParsedData {
    this.data = data;
    this.offset = 0;
    this.textures = [];
    this.brushes = [];
    this.meshes = [];
    this.animations = [];
    this.bones = [];

    const headerBytes = [];
    for (let i = 0; i < 4; i++) {
      headerBytes.push(this.data[this.offset++]);
    }
    const headerStr = String.fromCharCode(...headerBytes);

    if (headerStr !== "BB3D") {
      throw new Error(
        `Invalid B3D header: expected "BB3D", got "${headerStr}"`,
      );
    }

    // Read file size (4 bytes LE) - some files have this, some don't
    const fileSizeCheck = this.peekInt32LE();
    const remainingSize = this.data.length - this.offset;

    if (
      fileSizeCheck === remainingSize || fileSizeCheck === remainingSize - 4
    ) {
      // This looks like a file size field
      this.offset += 4;
    }

    const version = this.readInt32LE();
    this.log(`[B3DLoader] Version: 0x${version.toString(16)}`);

    let chunksRead = 0;
    const maxChunks = 2000;

    while (this.offset < this.data.length && chunksRead < maxChunks) {
      chunksRead++;

      if (this.offset + 8 > this.data.length) {
        break;
      }

      const chunkId = this.readInt32BE();
      const chunkSize = this.readInt32LE();
      const chunkStart = this.offset;

      const chunkName = String.fromCharCode(
        (chunkId >> 24) & 0xff,
        (chunkId >> 16) & 0xff,
        (chunkId >> 8) & 0xff,
        chunkId & 0xff,
      );

      if (this.logCount < 20) {
        this.log(
          `[B3DLoader] Chunk: "${chunkName}" (0x${
            chunkId.toString(16)
          }), size: ${chunkSize}, data at ${chunkStart}, ends at ${
            chunkStart + chunkSize
          }`,
        );
      }

      this.readChunk(chunkName, chunkId, chunkSize);

      const newOffset = chunkStart + chunkSize;
      this.offset = newOffset;
    }

    return {
      textures: this.textures,
      brushes: this.brushes,
      meshes: this.meshes,
      animations: this.animations,
      bones: this.bones,
    };
  }

  readChunk(chunkName: string, chunkId: number, chunkSize: number) {
    const endOffset = this.offset + chunkSize;

    switch (chunkName) {
      case "TEXS":
        this.readTextures(chunkSize);
        break;
      case "BRUS":
        this.readBrushes(chunkSize);
        break;
      case "MESH":
        this.readMesh(chunkSize);
        break;
      case "ANIM":
        this.readAnimation(chunkSize);
        break;
      case "NODE":
        this.readNode(chunkSize);
        break;
      case "BONE":
        this.readBone(chunkSize);
        break;
      case "VRTS":
        this.readVertices(chunkSize);
        break;
      case "TRIS":
        this.readTriangles(chunkSize);
        break;
      case "ANKS":
        this.readBoneKeys(chunkSize);
        break;
      case "SEQS":
        this.readSequences(chunkSize);
        break;
      default:
        // Skip unknown chunks
        if (this.logCount < 10) {
          this.log(
            `[B3DLoader] Skipping unknown chunk: ${chunkName} (0x${
              chunkId.toString(16)
            })`,
          );
        }
        this.offset = endOffset;
    }
  }

  readInt32LE() {
    if (!this.data) return 0;
    const val = this.data[this.offset] |
      (this.data[this.offset + 1] << 8) |
      (this.data[this.offset + 2] << 16) |
      (this.data[this.offset + 3] << 24);
    this.offset += 4;
    return val;
  }

  readInt32BE() {
    if (!this.data) return 0;
    const val = (this.data[this.offset] << 24) |
      (this.data[this.offset + 1] << 16) |
      (this.data[this.offset + 2] << 8) |
      this.data[this.offset + 3];
    this.offset += 4;
    return val;
  }

  peekInt32LE() {
    if (!this.data) return 0;
    return this.data[this.offset] |
      (this.data[this.offset + 1] << 8) |
      (this.data[this.offset + 2] << 16) |
      (this.data[this.offset + 3] << 24);
  }

  readFloat32() {
    if (!this.data) return 0;
    const view = new DataView(
      this.data.buffer,
      this.data.byteOffset + this.offset,
      4,
    );
    const val = view.getFloat32(0, true);
    this.offset += 4;
    return val;
  }

  readNullTerminatedString() {
    if (!this.data) return "";
    let str = "";
    while (this.offset < this.data.length && this.data[this.offset] !== 0) {
      str += String.fromCharCode(this.data[this.offset++]);
    }
    this.offset++;
    return str;
  }

  readTextures(chunkSize: number) {
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
  }

  readBrushes(chunkSize: number) {
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
  }

  readMesh(chunkSize: number) {
    const endOffset = this.offset + chunkSize;

    // Some B3D files have a 4-byte mesh ID or flags after MESH header
    if (!this.data) return;

    let meshId = -1;
    if (
      this.offset + 4 <= endOffset &&
      this.data[this.offset] === 0xff && this.data[this.offset + 1] === 0xff &&
      this.data[this.offset + 2] === 0xff && this.data[this.offset + 3] === 0xff
    ) {
      // Skip 4 bytes of 0xff
      meshId = this.readInt32LE();
    }

    const mesh: any = {
      vertices: [],
      triangles: [],
      positions: [],
      normals: [],
      colors: [],
      uvs: [[], []],
      indices: [],
      brushIndex: -1,
      vertexFlags: 0,
      texCoordSets: 0,
      texCoordSize: 0,
      vertexCount: 0,
      triangleCount: 0,
    };

    while (this.offset < endOffset - 8) {
      if (this.offset + 8 > endOffset) break;

      const subChunkId = this.readInt32BE();
      const subChunkSize = this.readInt32LE();
      const subEndOffset = this.offset + subChunkSize;

      const subChunkName = String.fromCharCode(
        (subChunkId >> 24) & 0xff,
        (subChunkId >> 16) & 0xff,
        (subChunkId >> 8) & 0xff,
        subChunkId & 0xff,
      );

      switch (subChunkName) {
        case "VRTS":
          mesh.vertexFlags = this.readInt32LE();
          mesh.texCoordSets = this.readInt32LE();
          mesh.texCoordSize = this.readInt32LE();
          this.readVerticesInternal(mesh, subEndOffset);
          this.offset = subEndOffset;
          break;
        case "TRIS":
          mesh.brushIndex = this.readInt32LE();
          this.readTrianglesInternal(mesh, subEndOffset);
          this.offset = subEndOffset;
          break;
        default:
          this.offset = subEndOffset;
      }
    }

    this.meshes.push(mesh);
    this.log(
      `[B3DLoader] Mesh: ${mesh.vertexCount} verts, ${mesh.triangleCount} tris`,
    );
  }

  readVerticesInternal(mesh: any, chunkEnd: number) {
    const positions = [];
    const normals = [];
    const colors = [];
    const uvs0 = [];
    const uvs1 = [];

    if (!this.data) return;

    while (this.offset < chunkEnd) {
      // Need at least 3 floats for position.
      if (this.offset + 12 > chunkEnd) break;

      const x = this.readFloat32();
      const y = this.readFloat32();
      const z = this.readFloat32();
      positions.push(x, y, z);

      if (mesh.vertexFlags & 1) {
        // Normals present
        if (this.offset + 12 > chunkEnd) break;
        normals.push(
          this.readFloat32(),
          this.readFloat32(),
          this.readFloat32(),
        );
      }

      if (mesh.vertexFlags & 2) {
        // Color present (RGBA as 4 float32 values).
        // See `Tools/b3d/parse.ts` for the reference parser.
        if (this.offset + 16 > chunkEnd) break;
        const r = this.readFloat32();
        const g = this.readFloat32();
        const b = this.readFloat32();
        // Alpha is handled via brush/material; ignore per-vertex alpha for now.
        this.readFloat32();
        colors.push(r, g, b);
      }

      // Texture coordinates
      // Each texcoord set contains `texCoordSize` floats (usually 2, but some
      // exporters include additional coords).
      const sets = Math.max(0, mesh.texCoordSets | 0);
      const size = Math.max(0, mesh.texCoordSize | 0);
      for (let tc = 0; tc < sets; tc++) {
        if (size < 2) break;
        if (this.offset + 8 > chunkEnd) break;
        const u = this.readFloat32();
        const v = this.readFloat32();

        // Skip extra per-vertex texcoord floats beyond U/V.
        for (let k = 2; k < size; k++) {
          if (this.offset + 4 > chunkEnd) break;
          this.readFloat32();
        }

        if (tc === 0) uvs0.push(u, 1 - v);
        else if (tc === 1) uvs1.push(u, 1 - v);
      }
    }

    mesh.positions = positions;
    mesh.normals = normals;
    mesh.colors = colors;
    mesh.uvs = [uvs0, uvs1];
    mesh.vertexCount = positions.length / 3;
  }

  readTrianglesInternal(mesh: any, chunkEnd: number) {
    const indices = [];

    // TRIS records are 3x u32 vertex indices.
    // (The brush index is read by the caller.)
    while (this.offset < chunkEnd) {
      if (this.offset + 12 > chunkEnd) break;

      const v0 = this.readInt32LE() >>> 0;
      const v1 = this.readInt32LE() >>> 0;
      const v2 = this.readInt32LE() >>> 0;

      indices.push(v0, v1, v2);

      // Skip control points if present (vertexFlags & 4)
      if (mesh.vertexFlags & 4) {
        if (this.offset + 12 > chunkEnd) break;
        this.readInt32LE(); // Skip control point 0
        this.readInt32LE(); // Skip control point 1
        this.readInt32LE(); // Skip control point 2
      }
    }

    mesh.indices = indices;
    mesh.triangleCount = indices.length / 3;
  }

  readAnimation(chunkSize: number) {
    const flags = this.readInt32LE();
    const frames = this.readInt32LE();
    const speed = this.readFloat32();

    this.animations.push({
      flags,
      frames,
      speed,
      tracks: [],
    });
  }

  readNode(chunkSize: number) {
    const endOffset = this.offset + chunkSize;
    const name = this.readNullTerminatedString();

    const node: any = {
      name,
      position: { x: 0, y: 0, z: 0 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      children: [],
      meshIndex: -1,
    };

    if (this.offset + 8 <= endOffset && this.data) {
      const nextBytes = this.data[this.offset] |
        (this.data[this.offset + 1] << 8);

      // If next 2 bytes look like a chunk ID prefix, it's child chunks
      if (nextBytes >= 0x4D45 && nextBytes <= 0x5A5A) {
        // Likely a chunk ID, skip to chunk parsing
      } else {
        // Try to read as floats
        try {
          // Check if we have position (3 floats)
          if (this.offset + 12 <= endOffset) {
            node.position.x = this.readFloat32();
            node.position.y = this.readFloat32();
            node.position.z = this.readFloat32();
          }

          // Check if we have scale (3 floats)
          if (this.offset + 12 <= endOffset) {
            node.scale.x = this.readFloat32();
            node.scale.y = this.readFloat32();
            node.scale.z = this.readFloat32();
          }

          // Check if we have rotation (4 floats - quaternion)
          if (this.offset + 16 <= endOffset) {
            node.rotation.w = this.readFloat32();
            node.rotation.x = this.readFloat32();
            node.rotation.y = this.readFloat32();
            node.rotation.z = this.readFloat32();
          }
        } catch (e) {
          // Failed to read as floats, reset offset
          this.offset = endOffset - chunkSize + name.length + 1;
        }
      }
    }

    this.log(
      `[B3DLoader] NODE "${name}" at offset ${
        endOffset - chunkSize
      }, end at ${endOffset}`,
    );

    // Parse child chunks
    while (this.offset < endOffset - 8) {
      if (this.offset + 8 > endOffset) break;

      const subChunkId = this.readInt32BE();
      const subChunkSize = this.readInt32LE();
      const subEndOffset = this.offset + subChunkSize;

      const subChunkName = String.fromCharCode(
        (subChunkId >> 24) & 0xff,
        (subChunkId >> 16) & 0xff,
        (subChunkId >> 8) & 0xff,
        subChunkId & 0xff,
      );

      if (this.logCount < 25) {
        this.log(
          `[B3DLoader]   Subchunk: "${subChunkName}" (0x${
            subChunkId.toString(16)
          }), size: ${subChunkSize}`,
        );
      }

      switch (subChunkName) {
        case "MESH":
          const meshIndex = this.meshes.length;
          this.log(`[B3DLoader]   Found MESH at index ${meshIndex}`);
          this.readMesh(subChunkSize);
          if (this.meshes.length > meshIndex) {
            node.meshIndex = meshIndex;
          }
          if (this.meshes.length > 0) {
            const maxMesh = this.meshes.length - 1;
            node.meshIndex = maxMesh; // Bind checking logic
          }
          break;
        case "NODE":
          this.readNode(subChunkSize);
          break;
        default:
          this.offset = subEndOffset;
      }

      this.offset = subEndOffset;
    }

    this.bones.push(node);
  }

  readBone(chunkSize: number) {
    const endOffset = this.offset + chunkSize;
    const name = this.readNullTerminatedString();
    const parentIndex = this.readInt32LE();

    const bone = {
      name,
      parentIndex,
      position: { x: 0, y: 0, z: 0 },
      rotation: { w: 1, x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    };

    while (this.offset < endOffset) {
      const subChunkId = this.readInt32LE();
      const subChunkSize = this.readInt32LE();
      const subEndOffset = this.offset + subChunkSize;

      switch (subChunkId) {
        case 0x54505320: // 'POS '
          bone.position.x = this.readFloat32();
          bone.position.y = this.readFloat32();
          bone.position.z = this.readFloat32();
          break;
        case 0x524F5420: // 'ROT'
          bone.rotation.w = this.readFloat32();
          bone.rotation.x = this.readFloat32();
          bone.rotation.y = this.readFloat32();
          bone.rotation.z = this.readFloat32();
          break;
        default:
          this.offset = subEndOffset;
      }

      this.offset = subEndOffset;
    }

    this.bones.push(bone);
  }

  readBoneKeys(chunkSize: number) {
    const endOffset = this.offset + chunkSize;
    const flags = this.readInt32LE();
    const frames: number[] = [];
    const positions: number[] = [];
    const scales: number[] = [];
    const rotationsWxyz: number[] = [];

    while (this.offset < endOffset) {
      if (this.offset + 4 > endOffset) break;
      const frame = this.readInt32LE();
      frames.push(frame);
      if (flags & 1) {
        if (this.offset + 12 > endOffset) break;
        positions.push(this.readFloat32(), this.readFloat32(), this.readFloat32());
      }
      if (flags & 2) {
        if (this.offset + 12 > endOffset) break;
        scales.push(this.readFloat32(), this.readFloat32(), this.readFloat32());
      }
      if (flags & 4) {
        if (this.offset + 16 > endOffset) break;
        rotationsWxyz.push(
          this.readFloat32(),
          this.readFloat32(),
          this.readFloat32(),
          this.readFloat32(),
        );
      }
    }

    if (this.animations.length > 0) {
      const anim = this.animations[this.animations.length - 1] as any;
      anim.boneKeys = { flags, frames, positions, scales, rotationsWxyz };
    }
    this.offset = endOffset;
  }

  readSequences(chunkSize: number) {
    const endOffset = this.offset + chunkSize;
    const numSeqs = this.readInt32LE();

    for (let i = 0; i < numSeqs && this.offset < endOffset; i++) {
      const name = this.readNullTerminatedString();
      const firstFrame = this.readInt32LE();
      const numFrames = this.readInt32LE();

      if (this.animations.length > 0) {
        const anim = this.animations[this.animations.length - 1];
        if (!anim.sequences) anim.sequences = [];
        anim.sequences.push({
          name,
          firstFrame,
          numFrames,
          lastFrame: firstFrame + numFrames - 1,
        });
      }
    }
  }

  async createThreeJSObjects(
    b3dData: B3DParsedData,
    parentId: number,
    targetId?: number,
  ) {
    const root = this.ensureTargetGroup(targetId);
    const rootId = root.userData.entityId as number;
    root.userData.isB3D = true;
    root.userData.bones = [];

    // If the caller supplied a targetId, assume it already has the correct
    // parent/scene attachment (e.g. created by LoadMesh()).
    if (!targetId) {
      if (parentId) {
        const parent = this.graphics.entities[parentId];
        if (parent) {
          parent.add(root);
          root.userData.parentId = parentId;
        }
      } else if (this.graphics.scene) {
        this.graphics.scene.add(root);
      }
    }

    for (let i = 0; i < b3dData.meshes.length; i++) {
      const meshData = b3dData.meshes[i];
      const mesh = await this.createMesh(meshData, b3dData, i);
      if (mesh) {
        root.add(mesh);
      }
    }

    if (b3dData.animations.length > 0) {
      this.setupAnimation(root, b3dData.animations[0]);
    }

    this.log(
      `[B3DLoader] Created ${b3dData.meshes.length} meshes, ${b3dData.bones.length} bones`,
    );
    return rootId;
  }

  async createMesh(meshData: B3DMeshData, b3dData: B3DParsedData, meshIndex: number) {
    if (!meshData.positions || meshData.positions.length === 0) {
      this.log(`[B3DLoader] Skipping empty mesh ${meshIndex}`);
      return null;
    }

    const geometry = new THREE.BufferGeometry();

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(meshData.positions, 3),
    );

    if (meshData.normals && meshData.normals.length > 0) {
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(meshData.normals, 3),
      );
    }

    if (meshData.colors && meshData.colors.length > 0) {
      geometry.setAttribute(
        "color",
        new THREE.Float32BufferAttribute(meshData.colors, 3),
      );
    }

    if (meshData.uvs && meshData.uvs[0] && meshData.uvs[0].length > 0) {
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(meshData.uvs[0], 2),
      );
    }

    if (meshData.indices && meshData.indices.length > 0) {
      geometry.setIndex(meshData.indices);
    }

    geometry.computeVertexNormals();

    let material;
    if (
      meshData.brushIndex >= 0 && meshData.brushIndex < b3dData.brushes.length
    ) {
      const brush = b3dData.brushes[meshData.brushIndex];
      material = await this.createMaterial(brush, b3dData);
    } else {
      material = new THREE.MeshPhongMaterial({
        color: 0x888888,
        side: THREE.DoubleSide,
      });
    }

    // If the mesh includes vertex colors, enable them on the material.
    if (meshData.colors && meshData.colors.length > 0) {
      (material as THREE.MeshPhongMaterial).vertexColors = true;
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.meshIndex = meshIndex;
    mesh.userData.isB3DMesh = true;

    return mesh;
  }

  async createMaterial(
    brush: B3DBrush,
    b3dData: B3DParsedData,
  ): Promise<THREE.MeshPhongMaterial> {
    let diffuse: THREE.Texture | undefined;
    let normal: THREE.Texture | undefined;

    const selected = this.selectBrushTextures(brush, b3dData);

    // Try to load the selected diffuse map first; if it fails, fall back to other stages.
    const stageNames = (brush.textureIds ?? [])
      .filter((id) => Number.isFinite(id) && id >= 0)
      .map((id) => b3dData.textures[id])
      .filter((t): t is B3DTexture => !!t && typeof t.name === "string");

    const diffuseCandidates: B3DTexture[] = [];
    if (selected.diffuse) diffuseCandidates.push(selected.diffuse);
    for (const t of stageNames) {
      if (!diffuseCandidates.includes(t)) diffuseCandidates.push(t);
    }

    for (const t of diffuseCandidates) {
      const url = this.resolveTextureUrl(t.name);
      if (!url) continue;
      try {
        diffuse = await this.loadTextureFromUrl(url, { srgb: true });
        break;
      } catch {
        // try next candidate
      }
    }

    if (selected.normal) {
      const url = this.resolveTextureUrl(selected.normal.name);
      if (url) {
        try {
          normal = await this.loadTextureFromUrl(url, { srgb: false });
        } catch {
          normal = undefined;
        }
      }
    }

    const materialOptions: THREE.MeshPhongMaterialParameters = {
      color: new THREE.Color(brush.color.r, brush.color.g, brush.color.b),
      opacity: brush.alpha,
      transparent: brush.alpha < 1,
      side: THREE.DoubleSide,
    };

    // Blitz3D brush shininess is roughly normalized; MeshPhongMaterial expects [0..100].
    const s = Number(brush.shininess);
    if (Number.isFinite(s)) {
      const clamped = Math.max(0, Math.min(1, s));
      materialOptions.shininess = clamped * 100;
      materialOptions.specular = new THREE.Color(0.2, 0.2, 0.2);
    }

    if (brush.blend === 1) {
      materialOptions.blending = THREE.AdditiveBlending;
    } else if (brush.blend === 2) {
      materialOptions.blending = THREE.MultiplyBlending;
    }

    if (diffuse) {
      materialOptions.map = diffuse;
    }
    if (normal) {
      materialOptions.normalMap = normal;
    }

    return new THREE.MeshPhongMaterial(materialOptions);
  }

  setupAnimation(root: THREE.Group, animation: any) {
    if (!animation.frames || animation.frames === 0) return;

    const mixer = new THREE.AnimationMixer(root);
    root.userData.mixer = mixer;
    this.graphics.animMixers.add(mixer);

    if (animation.sequences && animation.sequences.length > 0) {
      const tracks = this.createAnimationTracks(animation);

      if (tracks.length > 0) {
        const clip = new THREE.AnimationClip(
          "B3DAnimation",
          animation.frames / animation.speed || 1,
          tracks,
        );
        const action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopRepeat, Infinity);
        root.userData.action = action;
        root.userData.animationClip = clip;
      }
    }
  }

  createAnimationTracks(animation: any) {
    const tracks = [];

    if (animation.boneKeys && animation.boneKeys.length > 0) {
      for (const boneKey of animation.boneKeys) {
        const positionTrack = new THREE.VectorKeyframeTrack(
          boneKey.position.path || ".position",
          boneKey.position.times || [boneKey.frame / (animation.speed || 30)],
          boneKey.position.values ||
            [boneKey.position.x, boneKey.position.y, boneKey.position.z],
        );
        tracks.push(positionTrack);
      }
    }

    return tracks;
  }

  createPlaceholder(parentId: number, targetId?: number) {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const root = this.ensureTargetGroup(targetId);
    const rootId = root.userData.entityId as number;
    root.userData.isB3D = true;
    while (root.children.length) root.remove(root.children[0]);
    root.add(mesh);

    if (!targetId) {
      if (parentId) {
        const parent = this.graphics.entities[parentId];
        if (parent) parent.add(root);
      } else if (this.graphics.scene) {
        this.graphics.scene.add(root);
      }
    }

    this.log(`[B3DLoader] Created placeholder for failed load`);
    return rootId;
  }

  private ensureTargetGroup(targetId?: number): THREE.Group {
    if (typeof targetId === "number" && targetId > 0) {
      const existing = this.graphics.entities[targetId];
      if (existing instanceof THREE.Group) {
        existing.userData.entityId = targetId;
        // Clear existing children so repeated loads replace the model.
        while (existing.children.length) existing.remove(existing.children[0]!);
        return existing;
      }
      if (existing instanceof THREE.Object3D) {
        const root = new THREE.Group();
        root.userData.entityId = targetId;

        // Preserve transform/name and replace in the scene graph.
        root.name = existing.name;
        root.position.copy(existing.position);
        root.quaternion.copy(existing.quaternion);
        root.scale.copy(existing.scale);
        root.matrixAutoUpdate = existing.matrixAutoUpdate;
        root.userData = { ...existing.userData, entityId: targetId };

        const parent = existing.parent;
        if (parent) {
          parent.add(root);
          parent.remove(existing);
        } else if (this.graphics.scene) {
          // Best-effort: if it was a direct scene child, replace it.
          try {
            this.graphics.scene.remove(existing);
          } catch {
            // ignore
          }
          this.graphics.scene.add(root);
        }

        this.graphics.entities[targetId] = root;
        return root;
      }
      const root = new THREE.Group();
      this.graphics.entities[targetId] = root;
      root.userData.entityId = targetId;
      return root;
    }
    const root = new THREE.Group();
    const id = this.graphics.nextEntityId++;
    this.graphics.entities[id] = root;
    root.userData.entityId = id;
    return root;
  }
}
