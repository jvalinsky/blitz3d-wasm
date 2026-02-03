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

export class XLoader {
  private graphics: Blitz3DGraphicsInterface;
  private core: GraphicsCore & { fileIO: Blitz3DFileIO };
  private fileIO: Blitz3DFileIO;
  private debug: boolean;

  constructor(
    graphics: Blitz3DGraphicsInterface,
    core: GraphicsCore & { fileIO: Blitz3DFileIO },
    fileIO: Blitz3DFileIO,
  ) {
    this.graphics = graphics;
    this.core = core;
    this.fileIO = fileIO;
    this.debug = true;
  }

  log(...args: unknown[]) {
    if (this.debug) console.log("[XLoader]", ...args);
  }

  /**
   * Load an X file and return a Three.js entity ID
   */
  async loadFile(filePath: string, parentId = 0, targetId?: number) {
    this.log(`Loading: ${filePath}`);

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
      let cleaned = block.replace(/\/\/[^\n]*/g, "").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
      );

      // Parse vertices
      const vertexMatch = cleaned.match(/^\s*(\d+)\s*;([\s\S]*?)(\d+)\s*;/);
      if (!vertexMatch) {
        this.log("Could not find vertex data");
        return null;
      }

      const vertexCount = parseInt(vertexMatch[1]);
      const vertexData = vertexMatch[2];
      const faceCount = parseInt(vertexMatch[3]);

      this.log(`Parsing ${vertexCount} vertices, ${faceCount} faces`);

      // Extract vertices
      const vertices = this.parseVertices(vertexData, vertexCount);
      if (vertices.length !== vertexCount * 3) {
        this.log(
          `Vertex count mismatch: expected ${
            vertexCount * 3
          }, got ${vertices.length}`,
        );
      }

      // Find and parse faces (after vertex section)
      const afterVertices = cleaned.substring(
        vertexMatch.index! + vertexMatch[0].length,
      );
      const faces = this.parseFaces(afterVertices, faceCount);

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

  parseVertices(data: string, count: number): number[] {
    const vertices = [];
    // Match patterns like: x;y;z;, or x;y;z;;
    const regex = /(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;/g;
    let match;

    while ((match = regex.exec(data)) !== null && vertices.length < count * 3) {
      vertices.push(parseFloat(match[1]));
      vertices.push(parseFloat(match[2]));
      vertices.push(parseFloat(match[3]));
    }

    return vertices;
  }

  parseFaces(data: string, count: number): number[] {
    const faces = [];
    // Match patterns like: 3;v0,v1,v2;,
    const regex = /(\d+)\s*;\s*([\d,\s]+)\s*;/g;
    let match;

    while ((match = regex.exec(data)) !== null && faces.length / 3 < count) {
      const numVerts = parseInt(match[1]);
      const indices = match[2].split(",").map((s) => parseInt(s.trim()));

      if (numVerts === 3) {
        // Triangle
        faces.push(indices[0], indices[1], indices[2]);
      } else if (numVerts === 4) {
        // Quad - split into two triangles
        faces.push(indices[0], indices[1], indices[2]);
        faces.push(indices[0], indices[2], indices[3]);
      }
    }

    return faces;
  }

  parseTextureCoords(block: string): number[] {
    const uvs: number[] = [];
    // First number is count
    const countMatch = block.match(/^\s*(\d+)\s*;/);
    if (!countMatch) return uvs;

    const count = parseInt(countMatch[1]);
    const data = block.substring(countMatch.index! + countMatch[0].length);

    // Match u;v; patterns
    const regex = /(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;/g;
    let match;

    while ((match = regex.exec(data)) !== null && uvs.length < count * 2) {
      uvs.push(parseFloat(match[1]));
      uvs.push(parseFloat(match[2]));
    }

    return uvs;
  }

  parseMeshNormals(block: string): number[] {
    const normals: number[] = [];
    // First number is count
    const countMatch = block.match(/^\s*(\d+)\s*;/);
    if (!countMatch) return normals;

    const count = parseInt(countMatch[1]);
    const data = block.substring(countMatch.index! + countMatch[0].length);

    // Match x;y;z; patterns
    const regex = /(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*;/g;
    let match;

    while ((match = regex.exec(data)) !== null && normals.length < count * 3) {
      normals.push(parseFloat(match[1]));
      normals.push(parseFloat(match[2]));
      normals.push(parseFloat(match[3]));
    }

    return normals;
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
    if (meshData.uvs.length > 0) {
      geometry.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(meshData.uvs, 2),
      );
    }

    // Set normals if available, otherwise compute
    if (meshData.normals.length > 0) {
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
      // Load texture relative to X file path
      const basePath = filePath.substring(0, filePath.lastIndexOf("/") + 1);
      const texturePath = basePath + meshData.textureName;

      try {
        const textureLoader = new THREE.TextureLoader();
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          const r = globalThis.__BLITZ3D_URL_RESOLVER;
          const resolved = typeof r === "function"
            ? (r(texturePath) ?? texturePath)
            : texturePath;
          textureLoader.load(resolved, resolve, undefined, reject);
        });
        texture.flipY = false;
        material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
        });
        this.log(`Loaded texture: ${texturePath}`);
      } catch {
        this.log(`Failed to load texture: ${texturePath}`);
        material = new THREE.MeshStandardMaterial({
          color: 0x888888,
          side: THREE.DoubleSide,
        });
      }
    } else {
      material = new THREE.MeshStandardMaterial({
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
