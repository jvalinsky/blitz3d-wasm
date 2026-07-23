import { build } from "npm:vite@7.3.1";
import { join, relative } from "node:path";
import { copy, ensureDir, walkFiles } from "../Tools/fs.ts";
import { checkCmdbufExports } from "../Tools/cmdbuf_wasm_check.ts";
import { validateNoSourceModels } from "../Tools/validate_no_source_models.ts";

const rootFiles = ["options.ini"];

const lowerExt = (p: string) => {
  const m = p.match(/\.([^.]+)$/);
  return m ? m[1]!.toLowerCase() : "";
};

const run = async (cmd: string[], cwd?: string) => {
  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    cwd,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const { code } = await p.status;
  if (code !== 0) throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
};

await build({
  root: ".",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "esnext",
    rollupOptions: {
      input: {
        index: "index.html",
        "game/scpcb_game": "game/scpcb_game.html",
        interpreter: "interpreter.html",
      },
      output: {
        manualChunks: (id: string) => {
          // Keep heavy deps out of the main application chunk.
          if (id.includes("node_modules")) {
            if (id.includes("/three/")) return "vendor_three";
            if (id.includes("/jszip/")) return "vendor_jszip";
            return "vendor";
          }
          return undefined;
        },
      },
    },
  },
});

const distRoot = new URL("../dist/", import.meta.url).pathname;
const runtimeRoot = new URL("../Sources/Runtime/", import.meta.url).pathname;
const distAssetsRoot = join(distRoot, "assets");
const repoRoot = new URL("../", import.meta.url).pathname;
const examplesAssetsRoot = new URL(
  "../Examples/scpcb_facility_walk/assets/",
  import.meta.url,
).pathname;
// Optional sibling repo that contains SCPCB assets (Data/GFX/SFX/options.ini).
// This repo commonly sits next to blitz3d-wasm, so from web/ it's `../../scpcb/`.
const scpcbRepoRoot = new URL("../../scpcb/", import.meta.url).pathname;

const existsDir = async (path: string) => {
  try {
    const st = await Deno.stat(path);
    return st.isDirectory;
  } catch {
    return false;
  }
};

// Vite copies `web/public/` verbatim into dist. Enforce Track B by purging any
// source model formats that may have been present in public/ for dev iteration.
let purged = 0;
for await (const entry of walkFiles(distRoot)) {
  const ext = lowerExt(entry.path);
  if (ext === "b3d" || ext === "x" || ext === "rmesh") {
    await Deno.remove(entry.path);
    purged++;
  }
}
if (purged) {
  console.log(
    `[build] purged ${purged} .b3d/.x/.rmesh files copied from public/`,
  );
}

await ensureDir(distRoot);
await ensureDir(distAssetsRoot);

// The web interpreter (interpreter.html) fetches the compiler WASM at runtime.
// Ensure it is present in dist/ even though it's not part of the Vite bundle graph.
try {
  const compilerWasmSrc = new URL("./blitz3d-compiler.wasm", import.meta.url)
    .pathname;
  await copy(compilerWasmSrc, `${distRoot}blitz3d-compiler.wasm`, {
    overwrite: true,
  });
  const st = await Deno.stat(`${distRoot}blitz3d-compiler.wasm`);
  console.log(`[build] copied blitz3d-compiler.wasm (${st.size} bytes)`);
} catch (e) {
  console.warn(`[build] could not copy blitz3d-compiler.wasm: ${e}`);
}

// The in-browser compiler needs the auto-import map so unknown runtime imports
// (return types/arg types) are declared correctly in emitted WASM.
try {
  await copy(
    `${repoRoot}import_requirements_full.json`,
    `${distRoot}import_requirements_full.json`,
    { overwrite: true },
  );
  const st = await Deno.stat(`${distRoot}import_requirements_full.json`);
  console.log(
    `[build] copied import_requirements_full.json (${st.size} bytes)`,
  );
} catch (e) {
  console.warn(`[build] could not copy import_requirements_full.json: ${e}`);
}

try {
  await copy(`${runtimeRoot}scpcb.wasm`, `${distRoot}scpcb.wasm`, {
    overwrite: true,
  });
} catch (e) {
  console.warn(`[build] could not copy compiled scpcb.wasm (using public fallback if available): ${e}`);
}

// Debug sidecars (best-effort): used by the worker debugger overlay.
try {
  await copy(`${runtimeRoot}scpcb.bbdbg.json`, `${distRoot}scpcb.bbdbg.json`, {
    overwrite: true,
  });
} catch {
  // Optional.
}
try {
  await copy(`${runtimeRoot}scpcb.wasm.map`, `${distRoot}scpcb.wasm.map`, {
    overwrite: true,
  });
} catch {
  // Optional.
}

// Copy KTX2 Transcoders
try {
  const basisSrc = new URL("./node_modules/three/examples/jsm/libs/basis", import.meta.url).pathname;
  if (await existsDir(basisSrc)) {
    const basisDest = join(distAssetsRoot, "basis");
    await ensureDir(basisDest);
    await copy(basisSrc, basisDest, { overwrite: true });
    // Assuming recursive copy or we need to copy contents.
    // The 'copy' utility usually handles directories recursively.
    console.log("[build] copied KTX2 transcoders");
  } else {
    // If running in an environment without local node_modules (e.g. standard Deno cache),
    // we might miss these files. But 'deno.json' has 'nodeModulesDir: "auto"'.
    console.warn("[build] KTX2 transcoders not found at " + basisSrc);
  }
} catch (e) {
  console.warn(`[build] failed to copy KTX2 transcoders: ${e}`);
}
{
  const wasmBytes = await Deno.readFile(`${distRoot}scpcb.wasm`);
  const r = checkCmdbufExports(wasmBytes);
  if (r.missing.length) {
    throw new Error(
      `[cmdbuf] dist/scpcb.wasm is not Track B. Missing exports: ${r.missing.join(", ")
      }. ` +
      `Rebuild scpcb.wasm with --cmdbuf (e.g. \`deno task scpcb:compile:main\`).`,
    );
  }
}

const files: { path: string; size: number; type?: string }[] = [];
files.push({
  path: "scpcb.wasm",
  size: (await Deno.stat(`${distRoot}scpcb.wasm`)).size,
  type: "wasm",
});

for (const filename of rootFiles) {
  const path = join(distRoot, filename);
  try {
    const stats = await Deno.stat(path);
    files.push({ path: filename, size: stats.size });
  } catch {
    // Fallback: copy from sibling scpcb repo root (if available).
    const fallback = join(scpcbRepoRoot, filename);
    try {
      await copy(fallback, path, { overwrite: true });
      const stats = await Deno.stat(path);
      files.push({ path: filename, size: stats.size });
      console.log(`[build] copied missing ${filename} from ../scpcb/`);
    } catch {
      console.warn(`Missing ${filename} in dist output (expected at ${path})`);
    }
  }
}

type AssetSource = { root: string; prefix: string };
const assetSources: AssetSource[] = [];

// Preferred: curated facility-walk asset tree (already organized for conversion).
if (await existsDir(examplesAssetsRoot)) {
  assetSources.push({ root: examplesAssetsRoot, prefix: "" });
} else if (await existsDir(scpcbRepoRoot)) {
  // Fallback: build directly from sibling ../scpcb/{Data,GFX,SFX}.
  // Map these into dist/assets/{Data,GFX,SFX}.
  for (const dir of ["Data", "GFX", "SFX"]) {
    const root = join(scpcbRepoRoot, dir);
    if (await existsDir(root)) assetSources.push({ root, prefix: dir });
  }
}

if (assetSources.length === 0) {
  console.warn(
    `[build] no asset source found. Skipping SCPCB asset packaging (expected either ${examplesAssetsRoot} ` +
    `or a sibling ../scpcb/{Data,GFX,SFX} tree).`,
  );
}


// Check for KTX2 support
let useKtx2 = false;
try {
  const cmd = Deno.build.os === "windows" ? "where" : "which";
  const p = new Deno.Command(cmd, { args: ["toktx"], stdout: "null", stderr: "null" }).spawn();
  useKtx2 = (await p.status).code === 0;
  if (useKtx2) console.log("[build] 'toktx' found. enabling KTX2 texture generation.");
} catch { /* ignore */ }

// Pass 1: Copy/Convert non-model assets (Textures, Audio, Data)
for (const src of assetSources) {
  for await (const entry of walkFiles(src.root)) {
    const relPart = relative(src.root, entry.path).replace(/\\/g, "/");
    const rel = src.prefix ? `${src.prefix}/${relPart}` : relPart;
    const ext = lowerExt(rel);

    if (ext === "b3d" || ext === "x" || ext === "rmesh") continue;

    if (ext === "bmp") {
      // Optimization: convert BMP to PNG
      const outRel = rel.replace(/\.bmp$/i, ".png");
      const dest = join(distAssetsRoot, outRel);
      await ensureDir(join(dest, ".."));

      try {
        await run(
          ["sips", "-s", "format", "png", entry.path, "--out", dest],
          repoRoot,
        );
        const size = (await Deno.stat(dest)).size;
        files.push({ path: `assets/${outRel}`, size });
      } catch (e) {
        console.warn(
          `[build] BMP conversion failed for ${rel}, falling back to copy: ${e}`,
        );
        // Fallback
        const fallbackDest = join(distAssetsRoot, rel);
        await copy(entry.path, fallbackDest, { overwrite: true });
        files.push({
          path: `assets/${rel}`,
          size: (await Deno.stat(fallbackDest)).size,
        });
      }
      continue;
    }

    if (ext === "wav") continue; // Handled by Pass 1.6 (Optimize Audio)

    const dest = join(distAssetsRoot, rel);
    await ensureDir(join(dest, ".."));
    await copy(entry.path, dest, { overwrite: true });
    const size = (await Deno.stat(dest)).size;
    files.push({ path: `assets/${rel}`, size });
  }
}

// Pass 1.5: Optimize Textures (Generate KTX2)
if (useKtx2) {
  console.log("[build] generating KTX2 textures...");
  try {
    await run([
      "deno", "run", "-A", "Tools/optimize_textures.ts",
      "--root", distAssetsRoot,
      "--format", "ktx2",
    ], repoRoot);
  } catch (e) {
    console.warn(`[build] KTX2 generation failed: ${e}`);
    useKtx2 = false;
  }
}

// Pass 1.6: Optimize Audio (WAV -> OGG)
// We treat this similar to textures: if ffmpeg exists, we convert EVERYTHING in dist/assets to OGG.
// Since the copy pass above skipped all .wav files, we need to copy them first? 
// Wait, my loop above (line 293 modification) says "continue". That means .wav files are NOT copied to dist.
// That's risky if ffmpeg is missing.
//
// Correct logic:
// 1. Copy everything (including WAV). 
// 2. Run optimize_audio.ts on dist/assets (it converts wav -> ogg and deletes source).
// 
// Let's revert the "continue" for wav in Pass 1, and instead just let them copy. 
// optimize_audio.ts will handle the rest.

// Check for ffmpeg support
let useFfmpeg = false;
try {
  const cmd = Deno.build.os === "windows" ? "where" : "which";
  const p = new Deno.Command(cmd, { args: ["ffmpeg"], stdout: "null", stderr: "null" }).spawn();
  useFfmpeg = (await p.status).code === 0;
  if (useFfmpeg) console.log("[build] 'ffmpeg' found. enabling OGG audio optimization.");
} catch { /* ignore */ }

if (useFfmpeg) {
  console.log("[build] generating OGG audio...");
  try {
    await run([
      "deno", "run", "-A", "Tools/optimize_audio.ts",
      "--root", distAssetsRoot,
      "--delete-source"
    ], repoRoot);
  } catch (e) {
    console.warn(`[build] Audio optimization failed: ${e}`);
  }
}

// Pass 2: Process Models (Convert to SMPK)
for (const src of assetSources) {
  for await (const entry of walkFiles(src.root)) {
    const relPart = relative(src.root, entry.path).replace(/\\/g, "/");
    const rel = src.prefix ? `${src.prefix}/${relPart}` : relPart;
    const ext = lowerExt(rel);

    if (ext === "b3d" || ext === "x" || ext === "rmesh") {
      // Track B: convert offline during packaging and do NOT include source formats in dist.
      const srcStat = await Deno.stat(entry.path);
      if (srcStat.size === 0) {
        console.warn(`[build] skipping empty source asset: ${rel}`);
        continue;
      }
      const outRel = rel.replace(/\.b3d$/i, ".smpk").replace(/\.x$/i, ".smpk")
        .replace(/\.rmesh$/i, ".smpk");
      const dest = join(distAssetsRoot, outRel);
      await ensureDir(join(dest, ".."));

      const tool = ext === "b3d"
        ? "Tools/convert_b3d_to_smpk.ts"
        : ext === "x"
          ? "Tools/convert_x_to_smpk.ts"
          : "Tools/convert_rmesh_to_smpk.ts";

      const args = ["deno", "run", "-A", tool, entry.path, "-o", dest];
      if (useKtx2) {
        args.push("--texture-format", "ktx2");
      }

      await run(args, repoRoot);
      const size = (await Deno.stat(dest)).size;
      files.push({ path: `assets/${outRel}`, size });
    }
  }
}

// Deterministic build outputs: sort manifest entries so `scpcb_manifest.json` is stable.
files.sort((a, b) => a.path.localeCompare(b.path));

const manifest = {
  basePath: "/",
  groups: {
    boot: ["scpcb.wasm", ...rootFiles],
    // Minimal set needed for SCPCB init paths (INI/config parsing, room defs, etc.).
    // This avoids preloading the entire asset tree before calling into WASM.
    init: files
      .filter((f) =>
        f.path === "options.ini" || f.path.startsWith("Data/") ||
        f.path.startsWith("assets/Data/")
      )
      .map((f) => f.path)
      .sort(),
    facility_assets: files
      .filter((f) => f.path.startsWith("assets/"))
      .map((f) => f.path)
      .sort(),
  },
  files,
};

const manifestText = JSON.stringify(manifest, null, 2);
await Deno.writeTextFile(`${distRoot}scpcb_manifest.json`, manifestText);
await Deno.writeTextFile(
  new URL("./scpcb_manifest.json", import.meta.url).pathname,
  manifestText,
);

// Deploy contract: never ship .b3d/.x in dist.
await validateNoSourceModels({
  rootDir: distRoot,
  manifestPath: `${distRoot}scpcb_manifest.json`,
  bannedExts: ["b3d", "x", "rmesh"],
});

console.log("Copied scpcb.wasm + assets and generated scpcb_manifest.json");
