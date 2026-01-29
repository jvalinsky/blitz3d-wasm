/**
 * SMPK loader (static + skinned + basic animation).
 *
 * SMPK is a repo-local container: header + JSON + BIN (see Tools/smpk).
 * This loader deliberately does NOT parse .b3d/.x at runtime.
 */

import * as THREE from "three";

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
    rotation?: [number, number, number, number]; // xyzw
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
    lightmapTexture?: string;
    alphaMode?: string;
  }>;
  sceneRoots?: number[];
};

const MAGIC = [0x53, 0x4d, 0x50, 0x4b]; // "SMPK"

const decodeSmpk = (bytes: Uint8Array): { json: SmpkJson; bin: Uint8Array } => {
  if (bytes.byteLength < 16) throw new Error("SMPK too small");
  for (let i = 0; i < 4; i++) if (bytes[i] !== MAGIC[i]) throw new Error("Invalid SMPK magic");
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = dv.getUint32(4, true);
  if (version !== 1) throw new Error(`Unsupported SMPK version ${version}`);
  const jsonLen = dv.getUint32(8, true);
  const binLen = dv.getUint32(12, true);
  const headerLen = 16;
  const jsonStart = headerLen;
  const jsonEnd = jsonStart + jsonLen;
  const binStart = jsonEnd;
  const binEnd = binStart + binLen;
  if (binEnd > bytes.byteLength) throw new Error("SMPK truncated");
  const jsonText = new TextDecoder().decode(bytes.subarray(jsonStart, jsonEnd));
  const json = JSON.parse(jsonText) as SmpkJson;
  if (!json || json.version !== 1) throw new Error("Invalid SMPK JSON");
  const bin = bytes.subarray(binStart, binEnd);
  return { json, bin };
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

export class SMPKLoader {
  [key: string]: any;

  constructor(graphics: any, core: any) {
    this.graphics = graphics;
    this.core = core;
  }

  async loadFile(filePath: string, parentId: number) {
    const handle = this.core.fileIO.openFile(filePath);
    if (!handle) throw new Error(`SMPKLoader: failed to open ${filePath}`);
    try {
      const data = this.core.fileIO.readRemaining(handle);
      if (!data?.length) throw new Error(`SMPKLoader: empty ${filePath}`);
      return this.loadFromBytes(data, parentId, filePath);
    } finally {
      this.core.fileIO.closeFile(handle);
    }
  }

  loadFromBytes(bytes: Uint8Array, parentId: number, name?: string) {
    const { json, bin } = decodeSmpk(bytes);

    const root = new THREE.Group();
    root.name = name ?? "smpk";
    const rootId = this.graphics.nextEntityId++;
    this.graphics.entities[rootId] = root;
    root.userData.entityId = rootId;

    if (parentId) {
      const parent = this.graphics.entities[parentId];
      parent?.add?.(root);
    } else {
      this.graphics.scene?.add?.(root);
    }

    // Build Object3D nodes for the SMPK node graph
    const objs: THREE.Object3D[] = [];
    for (let i = 0; i < json.nodes.length; i++) {
      const n = json.nodes[i]!;
      const o = new THREE.Object3D();
      o.name = n.name ?? `node_${i}`;
      if (n.translation) o.position.set(n.translation[0], n.translation[1], n.translation[2]);
      if (n.rotation) o.quaternion.set(n.rotation[0], n.rotation[1], n.rotation[2], n.rotation[3]);
      if (n.scale) o.scale.set(n.scale[0], n.scale[1], n.scale[2]);
      objs.push(o);
    }
    for (let i = 0; i < json.nodes.length; i++) {
      const n = json.nodes[i]!;
      const o = objs[i]!;
      if (typeof n.parent === "number") objs[n.parent]?.add(o);
    }
    const sceneRoots = json.sceneRoots?.length ? json.sceneRoots : json.nodes.map((n, i) => (n.parent == null ? i : -1)).filter((i) => i >= 0);
    for (const r of sceneRoots) root.add(objs[r]!);

    const resolveAssetUrl = (rel: string) => {
      if (!rel) return rel;
      // Resolve textures relative to the SMPK file location when possible.
      if (typeof window === "undefined") return rel;
      try {
        return new URL(rel, new URL(name ?? "", window.location.href)).toString();
      } catch {
        return rel;
      }
    };

    // Materials
    const materials = (json.materials ?? []).map((m) => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: m.alphaMode === "BLEND",
      });
      mat.name = m.name ?? "";
      const loader = new THREE.TextureLoader();
      if (m.baseColorTexture) {
        loader.load(resolveAssetUrl(m.baseColorTexture), (t) => {
          mat.map = t;
          mat.needsUpdate = true;
        });
      }
      if (m.lightmapTexture) {
        loader.load(resolveAssetUrl(m.lightmapTexture), (t) => {
          mat.lightMap = t;
          mat.lightMapIntensity = 1.0;
          mat.needsUpdate = true;
        });
      }
      return mat;
    });

    // For each node with mesh, build geometry and attach
    for (let nodeIdx = 0; nodeIdx < json.nodes.length; nodeIdx++) {
      const n = json.nodes[nodeIdx]!;
      if (typeof n.mesh !== "number") continue;
      const meshDef = json.meshes[n.mesh]!;
      for (const prim of meshDef.primitives) {
        const geo = new THREE.BufferGeometry();
        const posAcc = json.accessors[prim.attributes["POSITION"]!]!;
        const pos = accessorView(bin, posAcc) as Float32Array;
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));

        const norIdx = prim.attributes["NORMAL"];
        if (typeof norIdx === "number") {
          const nor = accessorView(bin, json.accessors[norIdx]!) as Float32Array;
          geo.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        }

        const uvIdx = prim.attributes["TEXCOORD_0"];
        if (typeof uvIdx === "number") {
          const uv = accessorView(bin, json.accessors[uvIdx]!) as Float32Array;
          geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        }

        const uv2Idx = prim.attributes["TEXCOORD_1"];
        if (typeof uv2Idx === "number") {
          const uv2 = accessorView(bin, json.accessors[uv2Idx]!) as Float32Array;
          geo.setAttribute("uv2", new THREE.BufferAttribute(uv2, 2));
        }

        const jointsIdx = prim.attributes["JOINTS_0"];
        const weightsIdx = prim.attributes["WEIGHTS_0"];

        if (typeof jointsIdx === "number") {
          const jv = accessorView(bin, json.accessors[jointsIdx]!) as Uint16Array;
          geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(jv, 4));
        }
        if (typeof weightsIdx === "number") {
          const wv = accessorView(bin, json.accessors[weightsIdx]!) as Float32Array;
          geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(wv, 4));
        }

        if (typeof prim.indices === "number") {
          const idxAcc = json.accessors[prim.indices]!;
          const iv = accessorView(bin, idxAcc) as Uint32Array;
          geo.setIndex(new THREE.BufferAttribute(iv, 1));
        }

        const mat = materials[prim.material ?? 0] ?? new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });

        if (typeof n.skin === "number" && json.skins?.[n.skin]) {
          const skin = json.skins[n.skin]!;
          const bones: THREE.Bone[] = [];
          const boneInverses: THREE.Matrix4[] = [];

          for (const jointNodeIdx of skin.joints) {
            const o = objs[jointNodeIdx]!;
            // Promote to Bone
            const b = new THREE.Bone();
            b.name = o.name;
            b.position.copy(o.position);
            b.quaternion.copy(o.quaternion);
            b.scale.copy(o.scale);
            // Reattach children
            for (const c of [...o.children]) b.add(c);
            if (o.parent) {
              const p = o.parent;
              p.add(b);
              p.remove(o);
            }
            objs[jointNodeIdx] = b;
            bones.push(b);
          }

          if (typeof skin.inverseBindMatrices === "number") {
            const acc = json.accessors[skin.inverseBindMatrices]!;
            const m = accessorView(bin, acc) as Float32Array;
            for (let i = 0; i < skin.joints.length; i++) {
              const mat4 = new THREE.Matrix4();
              mat4.fromArray(m, i * 16);
              boneInverses.push(mat4);
            }
          }

          const sk = new THREE.Skeleton(bones, boneInverses.length ? boneInverses : undefined);
          const sm = new THREE.SkinnedMesh(geo, mat);
          sm.add(bones[0] ?? new THREE.Bone());
          sm.bind(sk);
          objs[nodeIdx]!.add(sm);
          root.userData.isAnimMesh = true;
        } else {
          objs[nodeIdx]!.add(new THREE.Mesh(geo, mat));
        }
      }
    }

    // Animations: attach mixer/action
    if (json.animations?.length) {
      const clips: THREE.AnimationClip[] = [];
      for (const a of json.animations) {
        const tracks: THREE.KeyframeTrack[] = [];
        for (const ch of a.channels) {
          const samp = a.samplers[ch.sampler]!;
          const tAcc = json.accessors[samp.input]!;
          const oAcc = json.accessors[samp.output]!;
          const times = accessorView(bin, tAcc) as Float32Array;
          const values = accessorView(bin, oAcc) as Float32Array;
          const target = objs[ch.targetNode]!;
          const path = ch.path;
          if (path === "translation") {
            tracks.push(new THREE.VectorKeyframeTrack(`${target.name}.position`, times, values));
          } else if (path === "scale") {
            tracks.push(new THREE.VectorKeyframeTrack(`${target.name}.scale`, times, values));
          } else if (path === "rotation") {
            tracks.push(new THREE.QuaternionKeyframeTrack(`${target.name}.quaternion`, times, values));
          }
        }
        clips.push(new THREE.AnimationClip(a.name ?? "clip", -1, tracks));
      }
      const mixer = new THREE.AnimationMixer(root);
      root.userData.mixer = mixer;
      root.userData.animationClips = clips;
      root.userData.action = mixer.clipAction(clips[0]!);
      root.userData.action.play();
      if (json.animations[0]?.sequences) root.userData.sequences = json.animations[0].sequences;
    }

    return rootId;
  }
}
