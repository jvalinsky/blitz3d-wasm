#!/usr/bin/env -S deno run -A
import { parseX } from "./x/parse_x.ts";
import { XFile, XMesh } from "./x/types.ts";
import { encodeSmpk } from "./smpk/codec.ts";
import { SmpkFile, SmpkMaterial, SmpkMesh, SmpkNode } from "./smpk/types.ts";
import {
  buildCaseInsensitiveMap,
  resolveTextureName,
} from "./texture_utils.ts";

type Args = {
  input: string;
  output: string;
  textureFormat?: string;
};

const parseArgs = (): Args => {
  const input = Deno.args[0];
  if (!input) {
    throw new Error(
      "usage: Tools/convert_x_to_smpk.ts <input.x> [-o out.smpk]",
    );
  }
  const oIdx = Deno.args.findIndex((a) => a === "-o" || a === "--out");
  const output = oIdx >= 0
    ? (Deno.args[oIdx + 1] ?? "")
    : input.replace(/\.x$/i, ".smpk");
  if (!output) throw new Error("missing -o output");

  const fmtIdx = Deno.args.findIndex((a) => a === "--texture-format");
  const textureFormat = fmtIdx >= 0 ? Deno.args[fmtIdx + 1] : undefined;

  return { input, output, textureFormat };
};

const quatFromRowMajorMat4 = (
  m: Float32Array,
): [number, number, number, number] => {
  // m is row-major 4x4; extract 3x3 rotation. Return xyzw.
  const m00 = m[0], m11 = m[5], m22 = m[10];
  const tr = m00 + m11 + m22;
  let x = 0, y = 0, z = 0, w = 1;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1.0) * 2;
    w = 0.25 * s;
    x = (m[9] - m[6]) / s;
    y = (m[2] - m[8]) / s;
    z = (m[4] - m[1]) / s;
  } else if ((m00 > m11) && (m00 > m22)) {
    const s = Math.sqrt(1.0 + m00 - m11 - m22) * 2;
    w = (m[9] - m[6]) / s;
    x = 0.25 * s;
    y = (m[1] + m[4]) / s;
    z = (m[2] + m[8]) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1.0 + m11 - m00 - m22) * 2;
    w = (m[2] - m[8]) / s;
    x = (m[1] + m[4]) / s;
    y = 0.25 * s;
    z = (m[6] + m[9]) / s;
  } else {
    const s = Math.sqrt(1.0 + m22 - m00 - m11) * 2;
    w = (m[4] - m[1]) / s;
    x = (m[2] + m[8]) / s;
    y = (m[6] + m[9]) / s;
    z = 0.25 * s;
  }
  return [x, y, z, w];
};

const main = async () => {
  const args = parseArgs();

  let x: any; // parseX returns XFile.

  try {
    const data = await Deno.readFile(args.input);
    const xFile = await parseX(data);
    x = xFile;
  } catch (e) {
    throw new Error(`Failed to parse ${args.input}: ${e}`);
  }

  // existing logic uses 'x' variable.
  // x.root, x.meshes.
  const mesh = findFirstMesh(x) ?? x.meshes[0];
  if (!mesh) throw new Error("No Mesh found in X file");

  const vCount = mesh.positions.length / 3;

  // Build JOINTS/WEIGHTS if SkinWeights exist
  const skins = mesh.skins ?? [];
  const boneNames = [...new Set(skins.map((s) => s.boneName))];
  const boneNameToIndex = new Map<string, number>();
  for (let i = 0; i < boneNames.length; i++) {
    boneNameToIndex.set(boneNames[i]!, i);
  }

  const influences: Array<Array<{ j: number; w: number }>> = Array.from({
    length: vCount,
  }, () => []);
  const invBind = new Float32Array(Math.max(1, boneNames.length) * 16);
  if (boneNames.length) {
    for (const sw of skins) {
      const j = boneNameToIndex.get(sw.boneName)!;
      // matrixOffset in X is the inverse bind matrix (offset)
      invBind.set(sw.matrixOffset, j * 16);
      for (let i = 0; i < sw.vertexIndices.length; i++) {
        const v = sw.vertexIndices[i]!;
        if (v < vCount) influences[v]!.push({ j, w: sw.weights[i]! });
      }
    }
  } else {
    // identity
    invBind.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 0);
  }

  const joints0 = new Uint16Array(vCount * 4);
  const weights0 = new Float32Array(vCount * 4);
  if (boneNames.length) {
    for (let v = 0; v < vCount; v++) {
      const inf = influences[v] ?? [];
      inf.sort((a, b) => b.w - a.w);
      const top = inf.slice(0, 4);
      let sum = 0;
      for (const t of top) sum += t.w;
      if (sum <= 0) sum = 1;
      for (let k = 0; k < 4; k++) {
        const t = top[k];
        joints0[v * 4 + k] = t ? t.j : 0;
        weights0[v * 4 + k] = t ? (t.w / sum) : 0;
      }
    }
  }

  const binParts: Uint8Array[] = [];
  const accessors: SmpkAccessor[] = [];
  const currentBinOff = () => binParts.reduce((s, p) => s + p.byteLength, 0);
  const push = (
    name: string,
    view: ArrayBufferView,
    componentType: any,
    type: any,
    count: number,
  ): number => {
    const off = currentBinOff();
    const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    binParts.push(u8);
    accessors.push({ name, offset: off, componentType, type, count });
    return accessors.length - 1;
  };

  const posAcc = push("POSITION", mesh.positions, "f32", "VEC3", vCount);
  const norAcc = push(
    "NORMAL",
    mesh.normals ?? new Float32Array(vCount * 3),
    "f32",
    "VEC3",
    vCount,
  );
  const uvAcc = push(
    "TEXCOORD_0",
    mesh.uvs0 ?? new Float32Array(vCount * 2),
    "f32",
    "VEC2",
    vCount,
  );
  const idxAcc = push(
    "INDICES",
    mesh.indices,
    "u32",
    "SCALAR",
    mesh.indices.length,
  );

  const attrs: Record<string, number> = {
    POSITION: posAcc,
    NORMAL: norAcc,
    TEXCOORD_0: uvAcc,
  };
  let skinsArr: any[] | undefined;
  let invBindAcc: number | undefined;
  if (boneNames.length) {
    const jointsAcc = push("JOINTS_0", joints0, "u16", "VEC4", vCount);
    const weightsAcc = push("WEIGHTS_0", weights0, "f32", "VEC4", vCount);
    invBindAcc = push(
      "inverseBindMatrices",
      invBind,
      "f32",
      "MAT4",
      boneNames.length,
    );
    attrs.JOINTS_0 = jointsAcc;
    attrs.WEIGHTS_0 = weightsAcc;
    skinsArr = [{ name: "skin0", joints: [], inverseBindMatrices: invBindAcc }];
  }

  // Nodes: build a flat node list for frames + bones.
  const nodes: any[] = [];
  const addFrame = (f: any, parent?: number) => {
    const idx = nodes.length;
    const t = f.transform;
    let translation: [number, number, number] | undefined;
    let rotation: [number, number, number, number] | undefined;
    let scale: [number, number, number] | undefined;
    if (t && t.length === 16) {
      // X matrix is row-major; translation at m[12..14] (as written in many exporters)
      translation = [t[12]!, t[13]!, t[14]!];
      rotation = quatFromRowMajorMat4(t);
      scale = [1, 1, 1];
    }
    nodes.push({
      name: f.name,
      parent,
      children: [],
      translation,
      rotation,
      scale,
      mesh: undefined,
      skin: undefined,
    });
    for (const c of f.children ?? []) {
      const cIdx = addFrame(c, idx);
      nodes[idx]!.children.push(cIdx);
    }
    return idx;
  };
  const rootIdx = addFrame(x.root, undefined);

  const inputDir = args.input.replace(/\\/g, "/").replace(/\/[^/]+$/, "") ||
    ".";
  const lowerNameToActual = await buildCaseInsensitiveMap(inputDir);

  const materials = [];
  for (let i = 0; i < (mesh.materials ?? []).length; i++) {
    const m = mesh.materials[i];
    materials.push({
      name: m.name ?? `mat${i}`,
      baseColorTexture: await resolveTextureName(
        inputDir,
        lowerNameToActual,
        m.texture,
        args.textureFormat,
      ),
      alphaMode: (m.diffuse[3] ?? 1) < 1 ? "BLEND" : "OPAQUE",
    });
  }

  // Attach mesh to root
  nodes[rootIdx]!.mesh = 0;
  if (boneNames.length) {
    // Ensure a bone node exists for each bone name (as child of root).
    const boneNodeIndices: number[] = [];
    for (const bn of boneNames) {
      const idx = nodes.length;
      nodes.push({
        name: bn,
        parent: rootIdx,
        children: [],
        translation: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      });
      nodes[rootIdx]!.children.push(idx);
      boneNodeIndices.push(idx);
    }
    skinsArr![0]!.joints = boneNodeIndices;
    nodes[rootIdx]!.skin = 0;
  }

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

  const json: SmpkJson = {
    version: 1,
    generator: "blitz3d-wasm Tools/convert_x_to_smpk.ts",
    accessors,
    meshes: [{
      name: mesh.name ?? "mesh0",
      primitives: [{
        attributes: attrs,
        indices: idxAcc,
        material: materials.length ? 0 : undefined,
      }],
    }],
    nodes,
    skins: skinsArr,
    animations: undefined,
    materials: materials.length ? materials : undefined,
    sceneRoots: [rootIdx],
  };

  const smpk: SmpkFile = { json, bin: makeBin() };
  const outBytes = encodeSmpk(smpk);
  await Deno.writeFile(args.output, outBytes);
  console.log(`[smpk] wrote ${args.output} (${outBytes.byteLength} bytes)`);
};

const findFirstMeshInFrame = (f: any): any => {
  if (f.mesh) return f.mesh;
  for (const c of f.children ?? []) {
    const m = findFirstMeshInFrame(c);
    if (m) return m;
  }
  return null;
};

const findFirstMesh = (x: any): any => {
  return findFirstMeshInFrame(x.root) ??
    (x.meshes && x.meshes.length ? x.meshes[0] : null);
};

if (import.meta.main) {
  await main();
}
