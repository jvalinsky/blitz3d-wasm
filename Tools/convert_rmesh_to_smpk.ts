#!/usr/bin/env -S deno run -A
import { parseRMesh } from "./rmesh/parse.ts";
import { encodeSmpk } from "./smpk/codec.ts";
import type { SmpkAccessor, SmpkFile, SmpkJson, SmpkMaterial, SmpkPrimitive } from "./smpk/types.ts";

type Args = { input: string; output: string };

const normalizeRel = (p: string) => p.replace(/\\/g, "/");
const basename = (p: string) => {
  const n = normalizeRel(p);
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
};

const buildCaseInsensitiveMap = async (dir: string) => {
  const map = new Map<string, string>();
  try {
    for await (const e of Deno.readDir(dir)) {
      if (!e.isFile) continue;
      map.set(e.name.toLowerCase(), e.name);
    }
  } catch {
    // ignore
  }
  return map;
};

const resolveTextureName = async (
  dir: string,
  lowerNameToActual: Map<string, string>,
  rawName: string,
): Promise<string> => {
  const raw = (rawName ?? "").split("\0", 1)[0]!.trim();
  const cleaned = raw.replace(/[\u0000-\u001f\u007f]/g, "");
  if (!cleaned) return "";
  const base = basename(cleaned).replace(/[\u0000-\u001f\u007f]/g, "");
  if (!base) return "";

  const candidates: string[] = [base];
  // SCPCB assets sometimes ship as PNG while formats reference BMP.
  if (base.toLowerCase().endsWith(".bmp")) {
    candidates.push(base.replace(/\.bmp$/i, ".png"));
  }

  for (const c of candidates) {
    // Prefer the actual on-disk casing if we can find it (important on case-sensitive deploys,
    // and also avoids silently persisting wrong casing on case-insensitive dev filesystems).
    const actual = lowerNameToActual.get(c.toLowerCase());
    if (actual) return actual;

    try {
      const st = await Deno.stat(`${dir}/${c}`);
      if (st.isFile) return c;
    } catch {
      // fall through
    }
  }

  // Give up: keep the basename as-is (better error messages downstream).
  return base;
};

const parseArgs = (): Args => {
  const input = Deno.args[0];
  if (!input) throw new Error("usage: Tools/convert_rmesh_to_smpk.ts <input.rmesh> [-o out.smpk]");
  const oIdx = Deno.args.findIndex((a) => a === "-o" || a === "--out");
  const output = oIdx >= 0 ? (Deno.args[oIdx + 1] ?? "") : input.replace(/\.rmesh$/i, ".smpk");
  if (!output) throw new Error("missing -o output");
  return { input, output };
};

const computeNormals = (positions: Float32Array, indices: Uint32Array): Float32Array => {
  const n = new Float32Array(positions.length);
  for (let i = 0; i < indices.length; i += 3) {
    const i0 = indices[i + 0]! * 3;
    const i1 = indices[i + 1]! * 3;
    const i2 = indices[i + 2]! * 3;
    const ax = positions[i0 + 0]!, ay = positions[i0 + 1]!, az = positions[i0 + 2]!;
    const bx = positions[i1 + 0]!, by = positions[i1 + 1]!, bz = positions[i1 + 2]!;
    const cx = positions[i2 + 0]!, cy = positions[i2 + 1]!, cz = positions[i2 + 2]!;
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    n[i0 + 0] += nx; n[i0 + 1] += ny; n[i0 + 2] += nz;
    n[i1 + 0] += nx; n[i1 + 1] += ny; n[i1 + 2] += nz;
    n[i2 + 0] += nx; n[i2 + 1] += ny; n[i2 + 2] += nz;
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

const main = async () => {
  const args = parseArgs();
  const st = await Deno.stat(args.input);
  if (st.size === 0) throw new Error(`RMESH is empty: ${args.input}`);

  const inputDir = args.input.replace(/\\/g, "/").replace(/\/[^/]+$/, "") || ".";
  const lowerNameToActual = await buildCaseInsensitiveMap(inputDir);

  const bytes = await Deno.readFile(args.input);
  const rm = parseRMesh(bytes);

  const extrasRmeshTriggers = rm.triggers.length
    ? rm.triggers.map((t) => {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (const s of t.surfaces) {
        const p = s.positions;
        for (let i = 0; i < p.length; i += 3) {
          const x = p[i + 0]!;
          const y = p[i + 1]!;
          const z = p[i + 2]!;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }
      }
      // Tolerate malformed trigger surfaces (empty): keep a zero AABB for diagnostics.
      if (!Number.isFinite(minX)) minX = minY = minZ = 0;
      if (!Number.isFinite(maxX)) maxX = maxY = maxZ = 0;
      return {
        name: t.name,
        aabb: { min: [minX, minY, minZ] as [number, number, number], max: [maxX, maxY, maxZ] as [number, number, number] },
      };
    })
    : undefined;

  const extrasRmeshEntities = rm.entities.length
    ? rm.entities.map((e: any) => {
      if (e?.type === "model" && typeof e.file === "string") {
        return {
          ...e,
          // Convenience: Track B expects `.smpk` at runtime (path aliasing also exists, but make it explicit).
          smpkFile: String(e.file).replace(/\.(b3d|x|rmesh)$/i, ".smpk"),
        };
      }
      return e;
    })
    : undefined;

  const binParts: Uint8Array[] = [];
  const accessors: SmpkAccessor[] = [];
  const currentBinOff = () => binParts.reduce((s, p) => s + p.byteLength, 0);
  const push = (name: string, view: ArrayBufferView, componentType: any, type: any, count: number): number => {
    const off = currentBinOff();
    const u8 = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    binParts.push(u8);
    accessors.push({ name, offset: off, componentType, type, count });
    return accessors.length - 1;
  };
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

  const materials: SmpkMaterial[] = [];
  const primitives: SmpkPrimitive[] = [];

  for (let s = 0; s < rm.drawn.length; s++) {
    const surf = rm.drawn[s]!;
    const vCount = surf.positions.length / 3;
    if (!vCount || !surf.indices.length) continue;

    const normals = computeNormals(surf.positions, surf.indices);

    const posAcc = push(`POSITION_s${s}`, surf.positions, "f32", "VEC3", vCount);
    const norAcc = push(`NORMAL_s${s}`, normals, "f32", "VEC3", vCount);
    const uv0Acc = push(`TEXCOORD_0_s${s}`, surf.uvs0, "f32", "VEC2", vCount);
    const uv1Acc = push(`TEXCOORD_1_s${s}`, surf.uvs1, "f32", "VEC2", vCount);
    const idxAcc = push(`INDICES_s${s}`, surf.indices, "u32", "SCALAR", surf.indices.length);

    // Materials: slot0 is base, slot1 is lightmap (in SCPCB convention).
    const tex0 = await resolveTextureName(inputDir, lowerNameToActual, surf.textures[0].name);
    const tex1 = await resolveTextureName(inputDir, lowerNameToActual, surf.textures[1].name);
    const alphaMode = surf.textures[0].kind === 3 ? "BLEND" : "OPAQUE";
    const matIdx = materials.length;
    materials.push({
      name: `surf_${s}`,
      baseColorTexture: tex0,
      lightmapTexture: tex1,
      alphaMode,
    });

    primitives.push({
      attributes: { POSITION: posAcc, NORMAL: norAcc, TEXCOORD_0: uv0Acc, TEXCOORD_1: uv1Acc },
      indices: idxAcc,
      material: matIdx,
    });
  }

  const json: SmpkJson = {
    version: 1,
    generator: "blitz3d-wasm Tools/convert_rmesh_to_smpk.ts",
    accessors,
    meshes: [{ name: "rmesh", primitives }],
    nodes: [{ name: "root", children: [], mesh: 0 }],
    materials: materials.length ? materials : undefined,
    sceneRoots: [0],
    extras: (extrasRmeshTriggers || extrasRmeshEntities) ? { rmesh: { triggers: extrasRmeshTriggers, entities: extrasRmeshEntities } } : undefined,
  };

  const smpk: SmpkFile = { json, bin: makeBin() };
  const outBytes = encodeSmpk(smpk);
  await Deno.writeFile(args.output, outBytes);
  console.log(`[smpk] wrote ${args.output} (${outBytes.byteLength} bytes)`);
};

if (import.meta.main) await main();
