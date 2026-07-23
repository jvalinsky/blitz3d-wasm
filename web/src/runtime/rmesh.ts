/**
 * SCPCB RMESH loader (runtime / interpreter use).
 *
 * Track B normally converts `.rmesh` to `.smpk` offline. The interpreter is an
 * exploration harness, so it can optionally load raw `.rmesh` files directly
 * from the virtual filesystem for inspection and rendering.
 *
 * This parser is based on the same RMESH layout used by SCPCB:
 * - UTF-8 strings prefixed by an i32 byte length (little-endian)
 * - Surfaces contain positions, two UV sets (diffuse + lightmap), per-vertex RGB,
 *   and triangle indices
 */

import * as THREE from "three";
import type {
  Blitz3DGraphicsInterface,
  GraphicsCore,
} from "./graphics/types.ts";
import type { Blitz3DFileIO } from "./fileio.ts";

export type RMeshTexture = {
  slot: 0 | 1;
  /**
   * 0/1/2/3 as written by the SCPCB converter. This is treated as an opaque
   * "kind" value; the only semantic we currently use is that `3` means blend.
   */
  kind: number;
  /** Filename stored in RMESH (usually no path). */
  name?: string;
};

export type RMeshSurface = {
  textures: [RMeshTexture, RMeshTexture];
  positions: Float32Array; // 3*n
  uvs0: Float32Array; // 2*n (diffuse)
  uvs1: Float32Array; // 2*n (lightmap uv)
  colorsRgb: Uint8Array; // 3*n
  indices: Uint32Array; // 3*m
};

export type RMeshCollisionSurface = {
  positions: Float32Array; // 3*n
  indices: Uint32Array; // 3*m
};

export type RMeshTriggerBox = {
  name: string;
  surfaces: RMeshCollisionSurface[];
};

export type RMeshPointEntity =
  | { type: "screen"; x: number; y: number; z: number; imgPath: string }
  | { type: "waypoint"; x: number; y: number; z: number }
  | {
    type: "light";
    x: number;
    y: number;
    z: number;
    range: number;
    color: string;
    intensity: number;
  }
  | {
    type: "spotlight";
    x: number;
    y: number;
    z: number;
    range: number;
    color: string;
    intensity: number;
    angles: string;
    innerCone: number;
    outerCone: number;
  }
  | {
    type: "soundemitter";
    x: number;
    y: number;
    z: number;
    sound: number;
    range: number;
  }
  | { type: "playerstart"; x: number; y: number; z: number; angles: string }
  | {
    type: "model";
    file: string;
    x: number;
    y: number;
    z: number;
    pitch: number;
    yaw: number;
    roll: number;
    sx: number;
    sy: number;
    sz: number;
  }
  | { type: string; raw: unknown };

export type RMeshFile = {
  header: "RoomMesh" | "RoomMesh.HasTriggerBox";
  drawn: RMeshSurface[];
  collision: RMeshCollisionSurface[];
  triggers: RMeshTriggerBox[];
  entities: RMeshPointEntity[];
};

class Reader {
  private dv: DataView;
  private u8: Uint8Array;
  off = 0;

  constructor(bytes: Uint8Array) {
    this.u8 = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  private ensure(n: number) {
    if (this.off + n > this.u8.byteLength) throw new Error("RMESH truncated");
  }

  readU8(): number {
    this.ensure(1);
    return this.u8[this.off++]!;
  }

  readI32LE(): number {
    this.ensure(4);
    const v = this.dv.getInt32(this.off, true);
    this.off += 4;
    return v;
  }

  readF32LE(): number {
    this.ensure(4);
    const v = this.dv.getFloat32(this.off, true);
    this.off += 4;
    return v;
  }

  readString(): string {
    const n = this.readI32LE();
    if (n < 0 || n > 1024 * 1024) throw new Error(`RMESH bad string len ${n}`);
    this.ensure(n);
    const s = new TextDecoder().decode(
      this.u8.subarray(this.off, this.off + n),
    );
    this.off += n;
    return s;
  }
}

const readCollisionSurface = (r: Reader): RMeshCollisionSurface => {
  const vCount = r.readI32LE();
  if (vCount < 0 || vCount > 10_000_000) {
    throw new Error(`RMESH bad vertexCount ${vCount}`);
  }
  const pos = new Float32Array(vCount * 3);
  for (let i = 0; i < vCount; i++) {
    pos[i * 3 + 0] = r.readF32LE();
    pos[i * 3 + 1] = r.readF32LE();
    pos[i * 3 + 2] = r.readF32LE();
  }
  const tCount = r.readI32LE();
  if (tCount < 0 || tCount > 10_000_000) {
    throw new Error(`RMESH bad triCount ${tCount}`);
  }
  const idx = new Uint32Array(tCount * 3);
  for (let i = 0; i < tCount; i++) {
    idx[i * 3 + 0] = r.readI32LE() >>> 0;
    idx[i * 3 + 1] = r.readI32LE() >>> 0;
    idx[i * 3 + 2] = r.readI32LE() >>> 0;
  }
  return { positions: pos, indices: idx };
};

export const parseRMesh = (bytes: Uint8Array): RMeshFile => {
  const r = new Reader(bytes);
  const header = r.readString();
  if (header !== "RoomMesh" && header !== "RoomMesh.HasTriggerBox") {
    throw new Error(`Invalid RMESH header: ${header}`);
  }

  const drawnCount = r.readI32LE();
  if (drawnCount < 0 || drawnCount > 100_000) {
    throw new Error(`RMESH bad drawnCount ${drawnCount}`);
  }
  const drawn: RMeshSurface[] = [];

  for (let s = 0; s < drawnCount; s++) {
    const tex0Kind = r.readU8();
    const tex0Name = tex0Kind ? r.readString() : undefined;
    const tex1Kind = r.readU8();
    const tex1Name = tex1Kind ? r.readString() : undefined;
    const vCount = r.readI32LE();
    if (vCount < 0 || vCount > 10_000_000) {
      throw new Error(`RMESH bad vertexCount ${vCount}`);
    }

    const positions = new Float32Array(vCount * 3);
    const uvs0 = new Float32Array(vCount * 2);
    const uvs1 = new Float32Array(vCount * 2);
    const colorsRgb = new Uint8Array(vCount * 3);

    for (let i = 0; i < vCount; i++) {
      positions[i * 3 + 0] = r.readF32LE();
      positions[i * 3 + 1] = r.readF32LE();
      positions[i * 3 + 2] = r.readF32LE();

      uvs0[i * 2 + 0] = r.readF32LE();
      uvs0[i * 2 + 1] = r.readF32LE();
      uvs1[i * 2 + 0] = r.readF32LE();
      uvs1[i * 2 + 1] = r.readF32LE();

      colorsRgb[i * 3 + 0] = r.readU8();
      colorsRgb[i * 3 + 1] = r.readU8();
      colorsRgb[i * 3 + 2] = r.readU8();
    }

    const tCount = r.readI32LE();
    if (tCount < 0 || tCount > 10_000_000) {
      throw new Error(`RMESH bad triCount ${tCount}`);
    }
    const indices = new Uint32Array(tCount * 3);
    for (let i = 0; i < tCount; i++) {
      indices[i * 3 + 0] = r.readI32LE() >>> 0;
      indices[i * 3 + 1] = r.readI32LE() >>> 0;
      indices[i * 3 + 2] = r.readI32LE() >>> 0;
    }

    drawn.push({
      textures: [
        { slot: 0, kind: tex0Kind, name: tex0Name },
        { slot: 1, kind: tex1Kind, name: tex1Name },
      ],
      positions,
      uvs0,
      uvs1,
      colorsRgb,
      indices,
    });
  }

  const collisionCount = r.readI32LE();
  if (collisionCount < 0 || collisionCount > 100_000) {
    throw new Error(`RMESH bad collisionCount ${collisionCount}`);
  }
  const collision: RMeshCollisionSurface[] = [];
  for (let i = 0; i < collisionCount; i++) {
    collision.push(readCollisionSurface(r));
  }

  const triggers: RMeshTriggerBox[] = [];
  if (header === "RoomMesh.HasTriggerBox") {
    const triggerCount = r.readI32LE();
    if (triggerCount < 0 || triggerCount > 10_000) {
      throw new Error(`RMESH bad triggerCount ${triggerCount}`);
    }
    for (let t = 0; t < triggerCount; t++) {
      const surfCount = r.readI32LE();
      if (surfCount < 0 || surfCount > 1_000_000) {
        throw new Error(`RMESH bad trigger surfCount ${surfCount}`);
      }
      const surfaces: RMeshCollisionSurface[] = [];
      for (let s = 0; s < surfCount; s++) {
        surfaces.push(readCollisionSurface(r));
      }
      const name = r.readString();
      triggers.push({ name, surfaces });
    }
  }

  const entityCount = r.readI32LE();
  if (entityCount < 0 || entityCount > 100_000) {
    throw new Error(`RMESH bad entityCount ${entityCount}`);
  }
  const entities: RMeshPointEntity[] = [];

  for (let i = 0; i < entityCount; i++) {
    const type = r.readString().toLowerCase();
    switch (type) {
      case "screen": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const imgPath = r.readString();
        entities.push({ type: "screen", x, y, z, imgPath });
        break;
      }
      case "waypoint": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        entities.push({ type: "waypoint", x, y, z });
        break;
      }
      case "light": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const range = r.readF32LE();
        const color = r.readString();
        const intensity = r.readF32LE();
        entities.push({ type: "light", x, y, z, range, color, intensity });
        break;
      }
      case "spotlight": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const range = r.readF32LE();
        const color = r.readString();
        const intensity = r.readF32LE();
        const angles = r.readString();
        const innerCone = r.readI32LE();
        const outerCone = r.readI32LE();
        entities.push({
          type: "spotlight",
          x,
          y,
          z,
          range,
          color,
          intensity,
          angles,
          innerCone,
          outerCone,
        });
        break;
      }
      case "soundemitter": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const sound = r.readI32LE();
        const range = r.readF32LE();
        entities.push({ type: "soundemitter", x, y, z, sound, range });
        break;
      }
      case "playerstart": {
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const angles = r.readString();
        entities.push({ type: "playerstart", x, y, z, angles });
        break;
      }
      case "model": {
        const file = r.readString();
        const x = r.readF32LE();
        const y = r.readF32LE();
        const z = r.readF32LE();
        const pitch = r.readF32LE();
        const yaw = r.readF32LE();
        const roll = r.readF32LE();
        const sx = r.readF32LE();
        const sy = r.readF32LE();
        const sz = r.readF32LE();
        entities.push({
          type: "model",
          file,
          x,
          y,
          z,
          pitch,
          yaw,
          roll,
          sx,
          sy,
          sz,
        });
        break;
      }
      default: {
        // Unknown entity type: keep raw payload for debugging.
        const raw = {
          // RMESH point entity payload is not uniform, so we cannot safely parse here.
          note: "unparsed",
        };
        entities.push({ type, raw });
        break;
      }
    }
  }

  return { header, drawn, collision, triggers, entities };
};

const resolveUrl = (path: string): string => {
  const r = globalThis.__BLITZ3D_URL_RESOLVER;
  if (typeof r === "function") {
    try {
      const out = r(path);
      if (typeof out === "string" && out) return out;
    } catch {
      // ignore
    }
  }
  return path;
};

const computeNormals = (
  positions: Float32Array,
  indices: Uint32Array,
): Float32Array => {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i + 0]! * 3;
    const i1 = indices[i + 1]! * 3;
    const i2 = indices[i + 2]! * 3;
    const ax = positions[i0 + 0]!,
      ay = positions[i0 + 1]!,
      az = positions[i0 + 2]!;
    const bx = positions[i1 + 0]!,
      by = positions[i1 + 1]!,
      bz = positions[i1 + 2]!;
    const cx = positions[i2 + 0]!,
      cy = positions[i2 + 1]!,
      cz = positions[i2 + 2]!;
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    n[i0 + 0] += nx;
    n[i0 + 1] += ny;
    n[i0 + 2] += nz;
    n[i1 + 0] += nx;
    n[i1 + 1] += ny;
    n[i1 + 2] += nz;
    n[i2 + 0] += nx;
    n[i2 + 1] += ny;
    n[i2 + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const x = n[i + 0]!, y = n[i + 1]!, z = n[i + 2]!;
    const len = Math.hypot(x, y, z) || 1;
    n[i + 0] = x / len;
    n[i + 1] = y / len;
    n[i + 2] = z / len;
  }
  return n;
};

export class RMeshLoader {
  private graphics: Blitz3DGraphicsInterface;
  private core: GraphicsCore & { fileIO: Blitz3DFileIO };
  private fileIO: Blitz3DFileIO;

  constructor(
    graphics: Blitz3DGraphicsInterface,
    core: GraphicsCore & { fileIO: Blitz3DFileIO },
  ) {
    this.graphics = graphics;
    this.core = core;
    this.fileIO = core.fileIO;
  }

  /**
   * Load an RMESH file from the virtual filesystem and render its drawn surfaces.
   *
   * If `targetId` is provided, the existing entity is reused and its children
   * are replaced. This is useful for `LoadMesh()` which must return a stable ID.
   */
  async loadFile(
    filePath: string,
    parentId: number,
    targetId?: number,
  ): Promise<number> {
    const handle = this.fileIO?.openFile?.(filePath) ?? 0;
    if (!handle) return 0;
    try {
      const bytes = (typeof (this.fileIO as any).readAllBytes === "function")
        ? ((this.fileIO as any).readAllBytes(handle) as Uint8Array)
        : (() => {
          const size =
            (typeof (this.fileIO as any).fileSizeFromHandle === "function")
              ? ((this.fileIO as any).fileSizeFromHandle(handle) as number)
              : this.fileIO.fileSize(filePath);
          const out = new Uint8Array(Math.max(0, size | 0));
          for (let i = 0; i < out.length; i++) {
            out[i] = this.fileIO.readByte(handle);
          }
          return out;
        })();
      const rm = parseRMesh(bytes);
      return await this.createThreeJSObjects(rm, parentId, filePath, targetId);
    } finally {
      try {
        this.fileIO.closeFile(handle);
      } catch {
        // ignore
      }
    }
  }

  private async createThreeJSObjects(
    rm: RMeshFile,
    parentId: number,
    filePath: string,
    targetId?: number,
  ): Promise<number> {
    const root = this.ensureTargetGroup(targetId);
    root.name = filePath.split("/").pop() || "rmesh";
    root.userData.isRMesh = true;
    root.userData.rmeshHeader = rm.header;
    root.userData.rmeshEntities = rm.entities;
    root.userData.rmeshTriggers = rm.triggers;

    if (!targetId) {
      if (parentId && this.graphics.entities[parentId]) {
        this.graphics.entities[parentId].add(root);
      } else if (this.graphics.scene) this.graphics.scene.add(root);
    }

    const textureLoader = new THREE.TextureLoader();
    const baseDir = filePath.replace(/\\/g, "/").replace(/\/[^/]+$/, "");
    const resolveTexPath = (name?: string): string | null => {
      if (!name) return null;
      const p = name.replace(/\\/g, "/");
      // RMESH references are typically filenames; resolve relative to the RMESH directory.
      const joined = baseDir ? `${baseDir}/${p}` : p;
      // Prefer the path verbatim; FileIO path aliasing can find assets/ as needed.
      return resolveUrl(joined);
    };

    const classifyTex = (name?: string): "lightmap" | "diffuse" | "unknown" => {
      const n = String(name || "").toLowerCase();
      if (!n) return "unknown";
      const leaf = n.split("/").pop() ?? n;
      const base = leaf.replace(/\.[a-z0-9]+$/i, "");
      if (
        /(^|[_\-.])(lm|lightmap|light)([_\-.]|$)/i.test(base) ||
        /_lm\b/i.test(base)
      ) {
        return "lightmap";
      }
      return "diffuse";
    };

    for (let s = 0; s < rm.drawn.length; s++) {
      const surf = rm.drawn[s]!;
      const vCount = surf.positions.length / 3;
      if (!vCount || !surf.indices.length) continue;

      const normals = computeNormals(surf.positions, surf.indices);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(surf.positions, 3),
      );
      geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute("uv", new THREE.BufferAttribute(surf.uvs0, 2));
      // Lightmaps in Three.js use UV2 by convention.
      if (surf.uvs1 && surf.uvs1.length === vCount * 2) {
        geometry.setAttribute("uv2", new THREE.BufferAttribute(surf.uvs1, 2));
      }
      geometry.setIndex(new THREE.BufferAttribute(surf.indices, 1));

      // Vertex colors in RMESH are RGB bytes.
      const colors = new Float32Array(vCount * 3);
      for (let i = 0; i < vCount; i++) {
        colors[i * 3 + 0] = surf.colorsRgb[i * 3 + 0]! / 255;
        colors[i * 3 + 1] = surf.colorsRgb[i * 3 + 1]! / 255;
        colors[i * 3 + 2] = surf.colorsRgb[i * 3 + 2]! / 255;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const t0 = surf.textures[0];
      const t1 = surf.textures[1];
      const t0Kind = classifyTex(t0?.name);
      const t1Kind = classifyTex(t1?.name);

      // Common SCPCB convention: one base texture + optional lightmap. We try
      // to pick correctly using both slot ordering and filename heuristics.
      const diffuseName = (t0Kind === "diffuse" && t1Kind === "lightmap")
        ? t0?.name
        : (t0Kind === "lightmap" && t1Kind === "diffuse")
        ? t1?.name
        // fallback: many writers store lightmap in slot0, diffuse in slot1
        : (t1?.name ?? t0?.name);

      const lightmapName = (t0Kind === "lightmap" && t1Kind !== "lightmap")
        ? t0?.name
        : (t1Kind === "lightmap" && t0Kind !== "lightmap")
        ? t1?.name
        : (t0?.name && classifyTex(t0.name) === "lightmap")
        ? t0.name
        : undefined;

      const diffuseTexUrl = resolveTexPath(diffuseName);
      const lightmapTexUrl = resolveTexPath(lightmapName);
      const alphaMode = surf.textures[0]?.kind === 3 ? "BLEND" : "OPAQUE";

      const material = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: alphaMode === "BLEND",
      });

      if (diffuseTexUrl) {
        try {
          const tex = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(diffuseTexUrl, resolve, undefined, reject);
          });
          tex.flipY = false;
          (tex as unknown as { colorSpace?: string }).colorSpace =
            THREE.SRGBColorSpace;
          material.map = tex;
          material.needsUpdate = true;
        } catch {
          // Texture is optional for inspection.
        }
      }

      if (lightmapTexUrl) {
        try {
          const lm = await new Promise<THREE.Texture>((resolve, reject) => {
            textureLoader.load(lightmapTexUrl, resolve, undefined, reject);
          });
          lm.flipY = false;
          material.lightMap = lm;
          material.lightMapIntensity = 1;
          material.needsUpdate = true;
        } catch {
          // optional
        }
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `rmesh_surface_${s}`;
      mesh.userData.isRMeshSurface = true;
      root.add(mesh);
    }

    return root.userData.entityId as number;
  }

  private ensureTargetGroup(targetId?: number): THREE.Group {
    if (typeof targetId === "number" && targetId > 0) {
      const existing = this.graphics.entities[targetId];
      if (existing instanceof THREE.Group) {
        // Replace contents but keep the object identity / id stable.
        while (existing.children.length) existing.remove(existing.children[0]!);
        existing.userData.entityId = targetId;
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
