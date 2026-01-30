import { decodeSmpk } from "./smpk/codec.ts";
import { walkFiles } from "./fs.ts";

type MissingTextureRef = {
  smpkRelPath: string;
  materialIndex: number;
  materialName: string;
  field: "baseColorTexture" | "detailTexture" | "detailTexture2" | "detailTexture3" | "cubeTexture" | "normalTexture" | "emissiveTexture" | "lightmapTexture";
  texture: string;
};

const usage = () => {
  console.error(
    "usage: Tools/validate_smpk_material_textures.ts <distDir> [--smpk-root <dir>]",
  );
};

const normalizeRel = (p: string) =>
  p.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\/+/g, "/");

const basename = (p: string) => {
  const n = normalizeRel(p);
  const i = n.lastIndexOf("/");
  return i >= 0 ? n.slice(i + 1) : n;
};

const fileExists = async (absPath: string) => {
  try {
    const st = await Deno.stat(absPath);
    return st.isFile;
  } catch {
    return false;
  }
};

const main = async () => {
  const distDir = Deno.args[0];
  if (!distDir) {
    usage();
    Deno.exit(2);
  }

  let smpkRoot = `${distDir}/assets`;
  for (let i = 1; i < Deno.args.length; i++) {
    const a = Deno.args[i]!;
    if (a === "--smpk-root") {
      smpkRoot = Deno.args[i + 1] ?? "";
      i++;
      continue;
    }
  }
  if (!smpkRoot) {
    usage();
    Deno.exit(2);
  }

  const distRootNorm = distDir.replace(/\/+$/, "");

  // Index all files in dist so we can resolve either full relative paths or bare basenames.
  const relPathSet = new Set<string>();
  const basenameSet = new Set<string>();
  for await (const entry of walkFiles(distRootNorm)) {
    const rel = normalizeRel(entry.path.slice(distRootNorm.length));
    if (!rel) continue;
    relPathSet.add(rel);
    basenameSet.add(basename(rel));
  }

  const missing: MissingTextureRef[] = [];
  let smpkCount = 0;
  let materialCount = 0;
  let textureRefCount = 0;

  const smpkRootNorm = smpkRoot.replace(/\/+$/, "");
  if (!(await fileExists(smpkRootNorm)) && !(await (async () => {
    try {
      const st = await Deno.stat(smpkRootNorm);
      return st.isDirectory;
    } catch {
      return false;
    }
  })())) {
    console.error(`[smpk-textures] missing smpk root dir: ${smpkRootNorm}`);
    Deno.exit(2);
  }

  for await (const entry of walkFiles(smpkRootNorm)) {
    if (!entry.path.toLowerCase().endsWith(".smpk")) continue;
    smpkCount++;

    const smpkBytes = await Deno.readFile(entry.path);
    const smpk = decodeSmpk(smpkBytes);

    const relFromDist = normalizeRel(entry.path.slice(distRootNorm.length));
    const mats = smpk.json.materials ?? [];
    materialCount += mats.length;

    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i]!;
      const matName = mat.name ?? `material_${i}`;
      const refs: Array<{ field: "baseColorTexture" | "detailTexture" | "detailTexture2" | "detailTexture3" | "cubeTexture" | "normalTexture" | "emissiveTexture" | "lightmapTexture"; tex: string | undefined }> = [
        { field: "baseColorTexture", tex: mat.baseColorTexture },
        { field: "detailTexture", tex: mat.detailTexture },
        { field: "detailTexture2", tex: mat.detailTexture2 },
        { field: "detailTexture3", tex: mat.detailTexture3 },
        { field: "cubeTexture", tex: mat.cubeTexture },
        { field: "normalTexture", tex: mat.normalTexture },
        { field: "emissiveTexture", tex: mat.emissiveTexture },
        { field: "lightmapTexture", tex: mat.lightmapTexture },
      ];

      for (const r of refs) {
        const texRaw = (r.tex ?? "").trim();
        if (!texRaw) continue;
        textureRefCount++;
        const texNorm = normalizeRel(texRaw);

        let ok = false;
        if (texNorm.includes("/")) {
          // Path-like reference: accept if it exists either at dist root, or under dist/assets.
          const relA = texNorm;
          const relB = normalizeRel(`assets/${texNorm}`);
          ok = relPathSet.has(relA) || relPathSet.has(relB);
        } else {
          // Basename reference: accept if any file in dist matches that basename.
          ok = basenameSet.has(texNorm);
        }

        if (!ok) {
          missing.push({
            smpkRelPath: relFromDist,
            materialIndex: i,
            materialName: matName,
            field: r.field,
            texture: texRaw,
          });
        }
      }
    }
  }

  if (missing.length) {
    console.error(
      `[smpk-textures] FAIL: ${missing.length} missing texture refs across ${smpkCount} smpk files (${textureRefCount} refs, ${materialCount} materials)`,
    );
    for (const m of missing.slice(0, 50)) {
      console.error(
        `  ${m.smpkRelPath} material[${m.materialIndex}](${m.materialName}).${m.field} -> ${m.texture}`,
      );
    }
    if (missing.length > 50) {
      console.error(`  ... and ${missing.length - 50} more`);
    }
    Deno.exit(1);
  }

  console.log(
    `[smpk-textures] ok: ${smpkCount} smpk files, ${materialCount} materials, ${textureRefCount} texture refs`,
  );
};

if (import.meta.main) {
  await main();
}

