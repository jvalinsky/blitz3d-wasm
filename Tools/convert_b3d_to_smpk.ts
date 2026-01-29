#!/usr/bin/env -S deno run -A
import { parseB3D } from "./b3d/parse.ts";
import { encodeSmpk } from "./smpk/codec.ts";
import type {
  SmpkAccessor,
  SmpkFile,
  SmpkJson,
} from "./smpk/types.ts";

type Args = {
  input: string;
  output: string;
  clipName: string;
};

const parseArgs = (): Args => {
  const input = Deno.args[0];
  if (!input) throw new Error("usage: Tools/convert_b3d_to_smpk.ts <input.b3d> [-o out.smpk] [--clip name]");
  const oIdx = Deno.args.findIndex((a) => a === "-o" || a === "--out");
  const output = oIdx >= 0 ? (Deno.args[oIdx + 1] ?? "") : input.replace(/\.b3d$/i, ".smpk");
  if (!output) throw new Error("missing -o output");
  const clipIdx = Deno.args.findIndex((a) => a === "--clip");
  const clipName = clipIdx >= 0 ? (Deno.args[clipIdx + 1] ?? "default") : "default";
  return { input, output, clipName };
};

const quatWxyzToXyzw = (w: number, x: number, y: number, z: number): [number, number, number, number] => [x, y, z, w];

const mat4FromTRS = (
  t: [number, number, number],
  qWxyz: [number, number, number, number],
  s: [number, number, number],
): Float32Array => {
  const [tx, ty, tz] = t;
  const [w, x, y, z] = qWxyz;
  const [sx, sy, sz] = s;

  const xx = x * x, yy = y * y, zz = z * z;
  const xy = x * y, xz = x * z, yz = y * z;
  const wx = w * x, wy = w * y, wz = w * z;

  // rotation matrix (row-major), then apply scale.
  const m00 = (1 - 2 * (yy + zz)) * sx;
  const m01 = (2 * (xy - wz)) * sx;
  const m02 = (2 * (xz + wy)) * sx;

  const m10 = (2 * (xy + wz)) * sy;
  const m11 = (1 - 2 * (xx + zz)) * sy;
  const m12 = (2 * (yz - wx)) * sy;

  const m20 = (2 * (xz - wy)) * sz;
  const m21 = (2 * (yz + wx)) * sz;
  const m22 = (1 - 2 * (xx + yy)) * sz;

  // Column-major output (WebGL/glTF style)
  return new Float32Array([
    m00, m10, m20, 0,
    m01, m11, m21, 0,
    m02, m12, m22, 0,
    tx, ty, tz, 1,
  ]);
};

const mat4Mul = (a: Float32Array, b: Float32Array): Float32Array => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[0 * 4 + r] * b[c * 4 + 0] +
        a[1 * 4 + r] * b[c * 4 + 1] +
        a[2 * 4 + r] * b[c * 4 + 2] +
        a[3 * 4 + r] * b[c * 4 + 3];
    }
  }
  return out;
};

const mat4Invert = (m: Float32Array): Float32Array => {
  // Minimal 4x4 inverse (adapted from common gl-matrix algorithm).
  const a = m;
  const out = new Float32Array(16);
  const a00 = a[0], a01 = a[4], a02 = a[8], a03 = a[12];
  const a10 = a[1], a11 = a[5], a12 = a[9], a13 = a[13];
  const a20 = a[2], a21 = a[6], a22 = a[10], a23 = a[14];
  const a30 = a[3], a31 = a[7], a32 = a[11], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return new Float32Array(m); // non-invertible; return copy
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[3] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[4] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[7] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[8] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[9] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[12] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[13] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[14] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
};

const gatherNodes = (b3d: ReturnType<typeof parseB3D>) => {
  const nodes: Array<{
    name: string;
    parent: number | null;
    children: number[];
    trs: { t: [number, number, number]; s: [number, number, number]; qWxyz: [number, number, number, number] };
    mesh?: any;
    bone?: any;
    keys?: any;
  }> = [];

  const walk = (n: any, parent: number | null) => {
    const idx = nodes.length;
    nodes.push({
      name: n.name,
      parent,
      children: [],
      trs: { t: n.translation, s: n.scale, qWxyz: n.rotationWxyz },
      mesh: n.mesh,
      bone: n.bone,
      keys: n.keys,
    });
    for (const c of n.children ?? []) {
      const cIdx = walk(c, idx);
      nodes[idx]!.children.push(cIdx);
    }
    return idx;
  };

  if (b3d.root) walk(b3d.root, null);
  return nodes;
};

const main = async () => {
  const args = parseArgs();
  const inputBytes = await Deno.readFile(args.input);
  const b3d = parseB3D(new Uint8Array(inputBytes));
  if (!b3d.root) throw new Error("B3D has no root node");

  const flatNodes = gatherNodes(b3d);
  const jointNodeIndices = flatNodes
    .map((n, i) => (n.bone && n.bone.length ? i : -1))
    .filter((i) => i >= 0);

  // Select first mesh found as the skinned mesh source.
  const meshNodeIdx = flatNodes.findIndex((n) => n.mesh);
  if (meshNodeIdx < 0) throw new Error("No MESH found in B3D");
  const mesh = flatNodes[meshNodeIdx]!.mesh;

  // Build joint mapping: nodeIndex -> jointIndex
  const nodeToJoint = new Map<number, number>();
  for (let i = 0; i < jointNodeIndices.length; i++) nodeToJoint.set(jointNodeIndices[i]!, i);

  // Compute world bind matrices for all nodes (column-major)
  const localMats = flatNodes.map((n) => mat4FromTRS(n.trs.t, n.trs.qWxyz, n.trs.s));
  const worldMats: Float32Array[] = [];
  for (let i = 0; i < flatNodes.length; i++) {
    const p = flatNodes[i]!.parent;
    worldMats[i] = p == null ? localMats[i]! : mat4Mul(worldMats[p]!, localMats[i]!);
  }

  // Inverse bind matrices for joints
  const invBind = new Float32Array(jointNodeIndices.length * 16);
  for (let j = 0; j < jointNodeIndices.length; j++) {
    const nIdx = jointNodeIndices[j]!;
    invBind.set(mat4Invert(worldMats[nIdx]!), j * 16);
  }

  // Build per-vertex joint/weight (4 influences)
  const vCount = mesh.positions.length / 3;
  const jointIndices = new Uint16Array(vCount * 4);
  const jointWeights = new Float32Array(vCount * 4);

  const influences: Array<Array<{ j: number; w: number }>> = Array.from({ length: vCount }, () => []);
  for (const nIdx of jointNodeIndices) {
    const j = nodeToJoint.get(nIdx)!;
    for (const bw of flatNodes[nIdx]!.bone ?? []) {
      if (bw.vertex >= 0 && bw.vertex < vCount) influences[bw.vertex]!.push({ j, w: bw.weight });
    }
  }

  for (let v = 0; v < vCount; v++) {
    const inf = influences[v] ?? [];
    inf.sort((a, b) => b.w - a.w);
    const top = inf.slice(0, 4);
    let sum = 0;
    for (const t of top) sum += t.w;
    if (sum <= 0) sum = 1;
    for (let k = 0; k < 4; k++) {
      const t = top[k];
      jointIndices[v * 4 + k] = t ? t.j : 0;
      jointWeights[v * 4 + k] = t ? (t.w / sum) : 0;
    }
  }

  // BIN packing
  const binParts: Uint8Array[] = [];
  const accessors: SmpkAccessor[] = [];
  const currentBinOff = () => binParts.reduce((s, p) => s + p.byteLength, 0);
  const push = (
    name: string,
    buf: Uint8Array,
    componentType: any,
    type: any,
    count: number,
  ): number => {
    const off = currentBinOff();
    binParts.push(buf);
    accessors.push({ name, offset: off, componentType, type, count });
    return accessors.length - 1;
  };

  const f32 = (a: ArrayBufferView) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

  const posAcc = push("POSITION", f32(mesh.positions), "f32", "VEC3", vCount);
  const normAcc = push("NORMAL", f32(mesh.normals ?? new Float32Array(vCount * 3)), "f32", "VEC3", vCount);
  const uvAcc = push("TEXCOORD_0", f32(mesh.uvs0 ?? new Float32Array(vCount * 2)), "f32", "VEC2", vCount);
  const jointsAcc = push("JOINTS_0", f32(jointIndices), "u16", "VEC4", vCount);
  const weightsAcc = push("WEIGHTS_0", f32(jointWeights), "f32", "VEC4", vCount);
  const idxAcc = push("INDICES", f32(mesh.indices), "u32", "SCALAR", mesh.indices.length);
  const invBindAcc = push("inverseBindMatrices", f32(invBind), "f32", "MAT4", jointNodeIndices.length);

  const makeBin = () => {
    const total = currentBinOff();
    const out = new Uint8Array(total);
    let o = 0;
    for (const p of binParts) {
      out.set(p, o);
      o += p.byteLength;
    }
    return out;
  };

  // Nodes & skin
  const smpkNodes = flatNodes.map((n) => ({
    name: n.name,
    parent: n.parent ?? undefined,
    children: n.children.length ? n.children : undefined,
    translation: n.trs.t,
    rotation: quatWxyzToXyzw(n.trs.qWxyz[0], n.trs.qWxyz[1], n.trs.qWxyz[2], n.trs.qWxyz[3]),
    scale: n.trs.s,
    mesh: undefined as number | undefined,
    skin: undefined as number | undefined,
  }));

  const meshes = [{
    name: "mesh0",
    primitives: [{
      attributes: {
        POSITION: posAcc,
        NORMAL: normAcc,
        TEXCOORD_0: uvAcc,
        JOINTS_0: jointsAcc,
        WEIGHTS_0: weightsAcc,
      },
      indices: idxAcc,
    }],
  }];

  smpkNodes[meshNodeIdx]!.mesh = 0;

  const skins = [{
    name: "skin0",
    joints: jointNodeIndices,
    inverseBindMatrices: invBindAcc,
  }];

  smpkNodes[meshNodeIdx]!.skin = 0;

  // Animations (simple): build per-joint channels from KEYS frames if present.
  const animations = buildAnimations(args.clipName, flatNodes, b3d.animFps, accessors, binParts, currentBinOff);
  const bin2 = makeBin();

  const json: SmpkJson = {
    version: 1,
    generator: "blitz3d-wasm Tools/convert_b3d_to_smpk.ts",
    accessors,
    meshes,
    nodes: smpkNodes,
    skins,
    animations: animations.length ? animations.map((a) => ({
      ...a,
      sequences: b3d.sequences?.map((s) => ({
        name: s.name,
        firstFrame: s.firstFrame,
        lastFrame: s.lastFrame,
      })) ?? undefined,
      fps: b3d.animFps,
    })) : undefined,
    sceneRoots: [0],
  };

  const smpk: SmpkFile = { json, bin: bin2 };
  const outBytes = encodeSmpk(smpk);
  await Deno.writeFile(args.output, outBytes);
  console.log(`[smpk] wrote ${args.output} (${outBytes.byteLength} bytes)`);
};

const buildAnimations = (
  clipName: string,
  nodes: any[],
  fps: number,
  accessors: SmpkAccessor[],
  binParts: Uint8Array[],
  currentBinOff: () => number,
) => {
  const animations: any[] = [];
  const samplers: any[] = [];
  const channels: any[] = [];

  const f32 = (a: ArrayBufferView) => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const pushAcc = (
    name: string,
    buf: Uint8Array,
    componentType: any,
    type: any,
    count: number,
  ): number => {
    const off = currentBinOff();
    binParts.push(buf);
    const idx = accessors.length;
    accessors.push({ name, offset: off, componentType, type, count });
    return idx;
  };

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex++) {
    const k = nodes[nodeIndex]?.keys;
    if (!k || !k.frames?.length) continue;

    const times = new Float32Array(k.frames.length);
    for (let i = 0; i < k.frames.length; i++) times[i] = (k.frames[i] ?? 0) / fps;
    const timeAcc = pushAcc(`anim:${clipName}:time:${nodeIndex}`, f32(times), "f32", "SCALAR", times.length);

    if (k.positions) {
      const out = new Float32Array(k.positions);
      const outAcc = pushAcc(`anim:${clipName}:t:${nodeIndex}`, f32(out), "f32", "VEC3", times.length);
      const s = samplers.length;
      samplers.push({ input: timeAcc, output: outAcc, interpolation: "LINEAR" });
      channels.push({ sampler: s, targetNode: nodeIndex, path: "translation" });
    }
    if (k.scales) {
      const out = new Float32Array(k.scales);
      const outAcc = pushAcc(`anim:${clipName}:s:${nodeIndex}`, f32(out), "f32", "VEC3", times.length);
      const s = samplers.length;
      samplers.push({ input: timeAcc, output: outAcc, interpolation: "LINEAR" });
      channels.push({ sampler: s, targetNode: nodeIndex, path: "scale" });
    }
    if (k.rotationsWxyz) {
      // Convert to xyzw for runtime consumption.
      const out = new Float32Array(times.length * 4);
      for (let i = 0; i < times.length; i++) {
        const w = k.rotationsWxyz[i * 4 + 0];
        const x = k.rotationsWxyz[i * 4 + 1];
        const y = k.rotationsWxyz[i * 4 + 2];
        const z = k.rotationsWxyz[i * 4 + 3];
        out.set([x, y, z, w], i * 4);
      }
      const outAcc = pushAcc(`anim:${clipName}:r:${nodeIndex}`, f32(out), "f32", "VEC4", times.length);
      const s = samplers.length;
      samplers.push({ input: timeAcc, output: outAcc, interpolation: "LINEAR" });
      channels.push({ sampler: s, targetNode: nodeIndex, path: "rotation" });
    }
  }

  if (channels.length) animations.push({ name: clipName, samplers, channels });
  return animations;
};

if (import.meta.main) {
  await main();
}
