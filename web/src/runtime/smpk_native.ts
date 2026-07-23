/**
 * Native SMPK loader — writes directly to Swift engine mesh storage.
 *
 * Replaces the Three.js-based SMPKLoader. Parses SMPK binary and creates
 * engine entities with mesh data via EngineBridge.
 */

import { EngineBridge, EntityType } from "../engine/bridge.ts";
import { loadTextureFromURL } from "../renderer/texture_loader.ts";
import type { GPUResources } from "../renderer/gpu_resources.ts";
import { decodeSmpk } from "./smpk.ts";

type SmpkAccessor = {
  name?: string;
  offset: number;
  count: number;
  componentType: string;
  type: string;
  byteStride?: number;
};

type SmpkJson = {
  version: 1;
  accessors: SmpkAccessor[];
  meshes: Array<{
    name?: string;
    primitives: Array<{
      attributes: Record<string, number>;
      indices?: number;
      material?: number;
    }>;
  }>;
  nodes: Array<{
    name?: string;
    parent?: number;
    children?: number[];
    translation?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    mesh?: number;
    skin?: number;
  }>;
  skins?: Array<{
    name?: string;
    joints: number[];
    inverseBindMatrices?: number;
  }>;
  animations?: Array<{
    name?: string;
    samplers: Array<{ input: number; output: number; interpolation?: string }>;
    channels: Array<{ sampler: number; targetNode: number; path: string }>;
    sequences?: Array<{ name: string; firstFrame: number; lastFrame: number }>;
    fps?: number;
  }>;
  materials?: Array<{
    name?: string;
    baseColorTexture?: string;
    color?: [number, number, number];
    alpha?: number;
    alphaMode?: "OPAQUE" | "BLEND" | "MASK";
    blendMode?: number;
    fx?: number;
    shininess?: number;
  }>;
  sceneRoots?: number[];
  extras?: any;
};

const accessorView = (bin: Uint8Array, acc: SmpkAccessor): ArrayBufferView => {
  const base = bin.byteOffset + acc.offset;
  const buf = bin.buffer;
  const count = acc.count;
  const ct = acc.componentType;
  const t = acc.type;

  const comps = t === "SCALAR"
    ? 1
    : t === "VEC2"
    ? 2
    : t === "VEC3"
    ? 3
    : t === "VEC4"
    ? 4
    : t === "MAT4"
    ? 16
    : 1;

  const n = count * comps;
  if (ct === "f32") return new Float32Array(buf, base, n);
  if (ct === "u16") return new Uint16Array(buf, base, n);
  if (ct === "u32") return new Uint32Array(buf, base, n);
  if (ct === "u8") return new Uint8Array(buf, base, n);
  if (ct === "i16") return new Int16Array(buf, base, n);
  if (ct === "i32") return new Int32Array(buf, base, n);
  return new Uint8Array(buf, base, n);
};

/**
 * Load an SMPK file into the Swift engine, creating entities and meshes.
 * Returns the root entity ID.
 */
export async function loadSmpkNative(
  bytes: Uint8Array,
  bridge: EngineBridge,
  resources: GPUResources,
  parentId: number,
  name?: string,
): Promise<number> {
  const { json, bin } = decodeSmpk(bytes);

  // Create root pivot entity
  const rootId = bridge.exports.EngineCreateEntity(EntityType.Pivot, parentId);

  // Create engine entities for each node
  const entityIds: number[] = [];
  for (let i = 0; i < json.nodes.length; i++) {
    const n = json.nodes[i]!;
    const hasMesh = typeof n.mesh === "number";
    const entityType = hasMesh ? EntityType.Mesh : EntityType.Pivot;
    // Parent will be set after all entities are created
    const eid = bridge.exports.EngineCreateEntity(entityType, 0);
    entityIds.push(eid);

    // Set transform
    if (n.translation) {
      bridge.setPosition(
        eid,
        n.translation[0],
        n.translation[1],
        n.translation[2],
      );
    }
    if (n.rotation) {
      // SMPK stores rotation as quaternion [x,y,z,w]
      // Convert to Euler for the engine (Blitz3D order: Ry*Rx*Rz)
      const [qx, qy, qz, qw] = n.rotation;
      const euler = quatToEuler(qx, qy, qz, qw);
      bridge.setRotation(eid, euler.pitch, euler.yaw, euler.roll);
    }
    if (n.scale) {
      bridge.setScale(eid, n.scale[0], n.scale[1], n.scale[2]);
    }
  }

  // Set up parent-child relationships
  for (let i = 0; i < json.nodes.length; i++) {
    const n = json.nodes[i]!;
    if (typeof n.parent === "number") {
      bridge.setParent(entityIds[i], entityIds[n.parent]);
    }
  }

  // Attach scene roots to root pivot
  const sceneRoots = json.sceneRoots?.length
    ? json.sceneRoots
    : json.nodes.map((n, i) => (n.parent == null ? i : -1)).filter((i) =>
      i >= 0
    );
  for (const r of sceneRoots) {
    bridge.setParent(entityIds[r], rootId);
  }

  // Load materials and textures (async, but we don't need to wait for rendering)
  const materialTextures: number[] = [];
  if (json.materials) {
    for (const mat of json.materials) {
      if (mat.baseColorTexture) {
        try {
          const resolvedUrl = resolveUrl(mat.baseColorTexture, name);
          const texId = await loadTextureFromURL(resolvedUrl, resources, 8); // mipmapped
          materialTextures.push(texId);
        } catch {
          materialTextures.push(0);
        }
      } else {
        materialTextures.push(0);
      }
    }
  }

  // Build meshes for each node that has one
  for (let nodeIdx = 0; nodeIdx < json.nodes.length; nodeIdx++) {
    const n = json.nodes[nodeIdx]!;
    if (typeof n.mesh !== "number") continue;

    const meshDef = json.meshes[n.mesh]!;
    const entityId = entityIds[nodeIdx];

    // Create engine mesh
    const meshId = bridge.createMesh();

    for (const prim of meshDef.primitives) {
      const posAcc = json.accessors[prim.attributes["POSITION"]!]!;
      const pos = accessorView(bin, posAcc) as Float32Array;
      const vertexCount = posAcc.count;

      let normals: Float32Array | null = null;
      const norIdx = prim.attributes["NORMAL"];
      if (typeof norIdx === "number") {
        normals = accessorView(bin, json.accessors[norIdx]!) as Float32Array;
      }

      let uvs: Float32Array | null = null;
      const uvIdx = prim.attributes["TEXCOORD_0"];
      if (typeof uvIdx === "number") {
        uvs = accessorView(bin, json.accessors[uvIdx]!) as Float32Array;
      }

      let indices: Uint32Array | Uint16Array | null = null;
      let indexCount = 0;
      if (typeof prim.indices === "number") {
        const idxAcc = json.accessors[prim.indices]!;
        const iv = accessorView(bin, idxAcc);
        indexCount = idxAcc.count;
        if (iv instanceof Uint32Array) {
          indices = iv;
        } else if (iv instanceof Uint16Array) {
          // Convert to Uint32
          indices = new Uint32Array(iv.length);
          for (let i = 0; i < iv.length; i++) indices[i] = iv[i];
        }
      }

      // Add surface to the engine mesh
      const surfIdx = bridge.addSurface(meshId, vertexCount, indexCount);
      if (surfIdx < 0) continue;

      // Write vertex data into WASM memory
      // Engine format: 11 floats per vertex (pos3+norm3+uv2+rgb3)
      const vertPtr = bridge.exports.GetSurfaceVerticesPtr(meshId, surfIdx);
      if (vertPtr > 0) {
        const stride = 11; // floats per vertex
        const vertView = new Float32Array(
          bridge.memoryBuffer,
          vertPtr,
          vertexCount * stride,
        );
        for (let v = 0; v < vertexCount; v++) {
          const off = v * stride;
          // Position
          vertView[off + 0] = pos[v * 3 + 0];
          vertView[off + 1] = pos[v * 3 + 1];
          vertView[off + 2] = pos[v * 3 + 2];
          // Normal
          vertView[off + 3] = normals ? normals[v * 3 + 0] : 0;
          vertView[off + 4] = normals ? normals[v * 3 + 1] : 1;
          vertView[off + 5] = normals ? normals[v * 3 + 2] : 0;
          // UV
          vertView[off + 6] = uvs ? uvs[v * 2 + 0] : 0;
          vertView[off + 7] = uvs ? uvs[v * 2 + 1] : 0;
          // RGB (default white)
          vertView[off + 8] = 1;
          vertView[off + 9] = 1;
          vertView[off + 10] = 1;
        }
      }

      // Write index data into WASM memory
      if (indices && indexCount > 0) {
        const idxPtr = bridge.exports.GetSurfaceIndicesPtr(meshId, surfIdx);
        if (idxPtr > 0) {
          const idxView = new Int32Array(
            bridge.memoryBuffer,
            idxPtr,
            indexCount,
          );
          for (let i = 0; i < indexCount; i++) {
            idxView[i] = indices[i];
          }
        }
      }
    }

    // Attach mesh to entity
    bridge.setEntityMesh(entityId, meshId);

    // Apply material properties
    const matIdx = meshDef.primitives[0]?.material ?? 0;
    if (json.materials && matIdx < json.materials.length) {
      const mat = json.materials[matIdx]!;
      if (mat.color) {
        bridge.entityColor(
          entityId,
          mat.color[0] * 255,
          mat.color[1] * 255,
          mat.color[2] * 255,
        );
      }
      if (mat.alpha !== undefined) {
        bridge.entityAlpha(entityId, mat.alpha);
      }
      if (mat.fx !== undefined) {
        bridge.entityFX(entityId, mat.fx);
      }
      if (mat.blendMode !== undefined) {
        bridge.entityBlend(entityId, mat.blendMode);
      }
      if (mat.shininess !== undefined) {
        bridge.entityShininess(entityId, mat.shininess);
      }
      // Apply texture
      if (materialTextures[matIdx] > 0) {
        bridge.entityTexture(entityId, materialTextures[matIdx], 0, 0);
      }
    }
  }

  return rootId;
}

/** Convert quaternion (x,y,z,w) to Euler angles (pitch, yaw, roll) in degrees. */
function quatToEuler(
  x: number,
  y: number,
  z: number,
  w: number,
): { pitch: number; yaw: number; roll: number } {
  // Blitz3D Euler order: Y*X*Z (yaw * pitch * roll)
  const sinp = 2 * (w * x - y * z);
  let pitch: number;
  if (Math.abs(sinp) >= 1) {
    pitch = Math.sign(sinp) * 90;
  } else {
    pitch = Math.asin(sinp) * (180 / Math.PI);
  }

  const siny = 2 * (w * y + x * z);
  const cosy = 1 - 2 * (x * x + y * y);
  const yaw = Math.atan2(siny, cosy) * (180 / Math.PI);

  const sinr = 2 * (w * z + x * y);
  const cosr = 1 - 2 * (x * x + z * z);
  const roll = Math.atan2(sinr, cosr) * (180 / Math.PI);

  return { pitch, yaw, roll };
}

function resolveUrl(rel: string, base?: string): string {
  if (!rel) return rel;
  if (typeof globalThis.window === "undefined") return rel;
  try {
    return new URL(rel, new URL(base ?? "", globalThis.window.location.href))
      .toString();
  } catch {
    return rel;
  }
}
