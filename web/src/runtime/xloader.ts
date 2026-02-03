/**
 * DirectX X Mesh Loader
 * Parses text-format DirectX .x files and creates Three.js objects
 */

import * as THREE from "three";
import type { Blitz3DGraphicsInterface, GraphicsCore } from "./graphics/types.ts";
import type { Blitz3DFileIO } from "./fileio.ts";

type XMeshData = {
  vertices: number[];
  faces: number[];
  uvs: number[];
  normals: number[];
  textureName: string | null;
};

type XFileData = {
  meshes: XMeshData[];
  // Reserved for future: MeshMaterialList parsing could populate these.
  materials: unknown[];
  textures: string[];
};

class XScanner {
  private s: string;
  i = 0;

  constructor(s: string) {
    this.s = s;
  }

  private skipString() {
    // Skip a quoted string: "..."
    if (this.s[this.i] !== "\"") return;
    this.i++;
    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      this.i++;
      if (c === "\"") break;
      // X text format doesn't have standard escapes; treat backslash as literal.
    }
  }

  skipJunk() {
    while (this.i < this.s.length) {
      const c = this.s[this.i]!;
      if (c === "\"") {
        this.skipString();
        continue;
      }
      // separators / whitespace
      if (c <= " " || c === "," || c === ";" || c === "{" || c === "}") {
        this.i++;
        continue;
      }
      // identifiers / keywords inside blocks
      if ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z") || c === "_") {
        this.i++;
        continue;
      }
      break;
    }
  }

  readNumber(): number {
    this.skipJunk();
    const rest = this.s.slice(this.i);
    const m = rest.match(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (!m) throw new Error(`Expected number at offset ${this.i}`);
    this.i += m[0].length;
    return Number(m[0]);
  }

  readInt(): number {
    return this.readNumber() | 0;
  }

  readFloat(): number {
    return Number(this.readNumber());
  }
}

export class XLoader {
  private graphics: Blitz3DGraphicsInterface;
  private core: GraphicsCore & { fileIO: Blitz3DFileIO };
  private fileIO: Blitz3DFileIO;
  private debug: boolean;
  private _sourceFilePath: string | null;

  constructor(
    graphics: Blitz3DGraphicsInterface,
    core: GraphicsCore & { fileIO: Blitz3DFileIO },
    fileIO: Blitz3DFileIO,
  ) {
    this.graphics = graphics;
    this.core = core;
    this.fileIO = fileIO;
    this.debug = true;
    this._sourceFilePath = null;
  }

  log(...args: unknown[]) {
    if (this.debug) console.log("[XLoader]", ...args);
  }

  /**
   * Load an X file and return a Three.js entity ID
   */
  async loadFile(filePath: string, parentId = 0, targetId?: number) {
    this.log(`Loading: ${filePath}`);
    this._sourceFilePath = filePath;

    try {
      const data = await this.readTextFile(filePath);
      if (!data) return 0;

      // Parse the X file
      const xData = this.parseXFile(data);
      if (!xData || !xData.meshes.length) {
        this.log(`No meshes found in: ${filePath}`);
        return 0;
      }

      // Create Three.js objects
      const entityId = await this.createThreeJSObjects(
        xData,
        parentId,
        filePath,
        targetId,
      );
      this.log(`Created entity: ${entityId}`);
      return entityId;
    } catch (error: any) {
      console.error(`[XLoader] Error loading ${filePath}:`, error);
      return 0;
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

    // As written in the file.
    push(norm);
    // Many assets embed Windows paths; try basename.
    push(leaf);
    // Relative to the .x directory.
    if (baseDir) {
      push(`${baseDir}/${leaf}`);
      push(`${baseDir}/${norm}`);
    }

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

  async readTextFile(filePath: string): Promise<string | null> {
    // Prefer VFS access via FileIO, since interpreter uploads live there.
    try {
      const handle = this.fileIO?.openFile?.(filePath) ?? 0;
      if (handle) {
        const bytes = (typeof (this.fileIO as any).readAllBytes === "function")
          ? ((this.fileIO as any).readAllBytes(handle) as Uint8Array)
          : (() => {
            const size = (typeof (this.fileIO as any).fileSizeFromHandle === "function")
              ? ((this.fileIO as any).fileSizeFromHandle(handle) as number)
              : this.fileIO.fileSize(filePath);
            const out = new Uint8Array(Math.max(0, size | 0));
            for (let i = 0; i < out.length; i++) out[i] = this.fileIO.readByte(handle);
            return out;
          })();
        try {
          this.fileIO.closeFile(handle);
        } catch {
          // ignore
        }
        return new TextDecoder().decode(bytes);
      }
    } catch {
      // ignore
    }

    // Fallback to fetch for dev convenience.
    try {
      const response = await fetch(filePath);
      if (response.ok) return await response.text();
    } catch {
      // ignore
    }
    return null;
  }

  /**
   * Parse X file text content
   */
  parseXFile(content: string): XFileData {
    this.log("Parsing X file...");

    // Validate header
    if (
      !content.startsWith("xof 0303txt") && !content.startsWith("xof 0302txt")
    ) {
      throw new Error("Invalid X file header - only text format supported");
    }

    const result: XFileData = {
      meshes: [],
      materials: [],
      textures: [],
    };

    // Find all Mesh blocks
    const meshBlocks = this.findBlocks(content, "Mesh");
    this.log(`Found ${meshBlocks.length} Mesh blocks`);

    for (const block of meshBlocks) {
      const mesh = this.parseMeshBlock(block);
      if (mesh) {
        result.meshes.push(mesh);
      }
    }

    return result;
  }

  /**
   * Find all blocks of a given type in content
   */
  findBlocks(content: string, blockType: string): string[] {
    const blocks = [];
    const regex = new RegExp(`\\b${blockType}\\s*\\{`, "g");
    let match;

    while ((match = regex.exec(content)) !== null) {
      const start = match.index + match[0].length;
      const block = this.extractBlock(content, start);
      if (block) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  /**
   * Extract content between matching braces starting at position
   */
  extractBlock(content: string, start: number): string | null {
    let depth = 1;
    let i = start;

    while (i < content.length && depth > 0) {
      if (content[i] === "{") depth++;
      else if (content[i] === "}") depth--;
      i++;
    }

    if (depth === 0) {
      return content.substring(start, i - 1);
    }
    return null;
  }

  /**
   * Parse a Mesh block
   */
  parseMeshBlock(block: string): XMeshData | null {
    try {
      // Clean the block - remove comments and normalize whitespace
      const cleaned = block.replace(/\/\/[^\n]*/g, "").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );

      const scan = new XScanner(cleaned);

      const vertexCount = scan.readInt();
      if (!Number.isFinite(vertexCount) || vertexCount <= 0 || vertexCount > 20_000_000) {
        this.log("Bad vertex count:", vertexCount);
        return null;
      }

      const vertices: number[] = new Array(vertexCount * 3);
      for (let i = 0; i < vertexCount; i++) {
        const base = i * 3;
        vertices[base + 0] = scan.readFloat();
        vertices[base + 1] = scan.readFloat();
        vertices[base + 2] = scan.readFloat();
      }

      const faceCount = scan.readInt();
      if (!Number.isFinite(faceCount) || faceCount < 0 || faceCount > 20_000_000) {
        this.log("Bad face count:", faceCount);
        return null;
      }

      this.log(`Parsing ${vertexCount} vertices, ${faceCount} faces`);

      const faces: number[] = [];
      for (let i = 0; i < faceCount; i++) {
        const n = scan.readInt();
        if (!Number.isFinite(n) || n < 3 || n > 16) {
          // skip invalid polygon
          for (let j = 0; j < Math.max(0, n | 0); j++) scan.readInt();
          continue;
        }
        const idx: number[] = new Array(n);
        let ok = true;
        for (let j = 0; j < n; j++) {
          const v = scan.readInt();
          idx[j] = v;
          if (v < 0 || v >= vertexCount) ok = false;
        }
        if (!ok) continue;
        // triangulate as a fan
        const a = idx[0]!;
        for (let j = 1; j + 1 < idx.length; j++) {
          faces.push(a, idx[j]!, idx[j + 1]!);
        }
      }

      // Parse MeshTextureCoords if present
      let uvs: number[] = [];
      const texCoordsBlock = this.findBlocks(cleaned, "MeshTextureCoords");
      if (texCoordsBlock.length > 0) {
        uvs = this.parseTextureCoords(texCoordsBlock[0]);
      }

      // Parse MeshNormals if present
      let normals: number[] = [];
      const normalsBlock = this.findBlocks(cleaned, "MeshNormals");
      if (normalsBlock.length > 0) {
        normals = this.parseMeshNormals(normalsBlock[0]);
      }

      // Parse MeshMaterialList for texture references
      let textureName: string | null = null;
      const materialBlock = this.findBlocks(cleaned, "MeshMaterialList");
      if (materialBlock.length > 0) {
        textureName = this.extractTextureName(materialBlock[0]);
      }

      this.log(
        `Parsed: ${vertices.length / 3} verts, ${faces.length / 3} tris, ${
          uvs.length / 2
        } UVs`,
      );

      return {
        vertices,
        faces,
        uvs,
        normals,
        textureName,
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.log(`Error parsing mesh block: ${msg}`);
      return null;
    }
  }

  parseTextureCoords(block: string): number[] {
    const uvs: number[] = [];
    try {
      const scan = new XScanner(block);
      const count = scan.readInt();
      if (!Number.isFinite(count) || count <= 0 || count > 50_000_000) return uvs;
      for (let i = 0; i < count; i++) {
        uvs.push(scan.readFloat(), scan.readFloat());
      }
      return uvs;
    } catch {
      return uvs;
    }
  }

  parseMeshNormals(block: string): number[] {
    const normals: number[] = [];
    try {
      const scan = new XScanner(block);
      const count = scan.readInt();
      if (!Number.isFinite(count) || count <= 0 || count > 50_000_000) return normals;
      for (let i = 0; i < count; i++) {
        normals.push(scan.readFloat(), scan.readFloat(), scan.readFloat());
      }
      // Skip face-normal index data (not needed if we have per-vertex normals)
      return normals;
    } catch {
      return normals;
    }
  }

  extractTextureName(block: string): string | null {
    // Look for TextureFilename block
    const match = block.match(/TextureFilename\s*\{\s*"([^"]+)"\s*;?\s*\}/);
    if (match) {
      return match[1];
    }
    return null;
  }

  /**
   * Create Three.js objects from parsed X data
   */
  async createThreeJSObjects(
    xData: XFileData,
    parentId: number,
    filePath: string,
    targetId?: number,
  ) {
    const root = this.ensureTargetGroup(targetId);
    root.name = filePath.split("/").pop() || "x_mesh";
    root.userData.isXMesh = true;

    // Process each mesh
    for (const meshData of xData.meshes) {
      const mesh = await this.createMesh(meshData, filePath);
      if (mesh) {
        root.add(mesh);
      }
    }

    const id = root.userData.entityId as number;
    if (!targetId) {
      // Add to parent or scene
      if (parentId && this.graphics.entities[parentId]) {
        this.graphics.entities[parentId].add(root);
      } else {
        this.graphics.scene.add(root);
      }
    }

    return id;
  }

  async createMesh(meshData: XMeshData, filePath: string): Promise<THREE.Mesh | null> {
    if (!meshData.vertices.length || !meshData.faces.length) {
      this.log("Empty mesh data");
      return null;
    }

    const vCount = (meshData.vertices.length / 3) | 0;

    // Create indexed geometry
    const geometry = new THREE.BufferGeometry();

    // Set positions
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(meshData.vertices, 3),
    );

    // Set indices
    geometry.setIndex(meshData.faces);

    // Set UVs if available
    if (meshData.uvs.length === vCount * 2) {
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(meshData.uvs, 2),
      );
    }

    // Set normals if available, otherwise compute
    if (meshData.normals.length === vCount * 3) {
      geometry.setAttribute(
        "normal",
        new THREE.Float32BufferAttribute(meshData.normals, 3),
      );
    } else {
      geometry.computeVertexNormals();
    }

    // Create material
    let material;
    if (meshData.textureName) {
      const resolved = this.resolveTextureUrl(meshData.textureName);

      try {
        const textureLoader = new THREE.TextureLoader();
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          textureLoader.load(resolved ?? meshData.textureName!, resolve, undefined, reject);
        });
        texture.flipY = false;
        (texture as unknown as { colorSpace?: string }).colorSpace = THREE.SRGBColorSpace;
        material = new THREE.MeshPhongMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });
        this.log(`Loaded texture: ${meshData.textureName}`);
      } catch {
        this.log(`Failed to load texture: ${meshData.textureName}`);
        material = new THREE.MeshPhongMaterial({
          color: 0x888888,
          side: THREE.DoubleSide,
        });
      }
    } else {
      material = new THREE.MeshPhongMaterial({
        color: 0xcccccc,
        side: THREE.DoubleSide,
      });
    }

    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.isXMesh = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.log(
      `Created mesh: ${meshData.vertices.length / 3} verts, ${
        meshData.faces.length / 3
      } tris`,
    );
    return mesh;
  }

  private ensureTargetGroup(targetId?: number): THREE.Group {
    if (typeof targetId === "number" && targetId > 0) {
      const existing = this.graphics.entities[targetId];
      if (existing instanceof THREE.Group) {
        existing.userData.entityId = targetId;
        while (existing.children.length) existing.remove(existing.children[0]!);
        return existing;
      }
      if (existing instanceof THREE.Object3D) {
        const root = new THREE.Group();
        root.userData.entityId = targetId;

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
