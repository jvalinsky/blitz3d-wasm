import { build } from "npm:vite";
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
  const p = new Deno.Command(cmd[0]!, { args: cmd.slice(1), cwd, stdout: "inherit", stderr: "inherit" }).spawn();
  const { code } = await p.status;
  if (code !== 0) throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
};

await build({
  root: ".",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "esnext",
  },
});

const distRoot = new URL("../dist/", import.meta.url).pathname;
const runtimeRoot = new URL("../Sources/Runtime/", import.meta.url).pathname;
const assetsRoot = new URL("../Examples/scpcb_facility_walk/assets/", import.meta.url).pathname;
const distAssetsRoot = join(distRoot, "assets");
const repoRoot = new URL("../", import.meta.url).pathname;

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
if (purged) console.log(`[build] purged ${purged} .b3d/.x/.rmesh files copied from public/`);

await ensureDir(distRoot);
await ensureDir(distAssetsRoot);

await copy(`${runtimeRoot}scpcb.wasm`, `${distRoot}scpcb.wasm`, { overwrite: true });
{
  const wasmBytes = await Deno.readFile(`${distRoot}scpcb.wasm`);
  const r = checkCmdbufExports(wasmBytes);
  if (r.missing.length) {
    throw new Error(
      `[cmdbuf] dist/scpcb.wasm is not Track B. Missing exports: ${r.missing.join(", ")}. ` +
        `Rebuild scpcb.wasm with --cmdbuf (e.g. \`deno task scpcb:compile:main\`).`,
    );
  }
}

const files: { path: string; size: number; type?: string }[] = [];
files.push({ path: "scpcb.wasm", size: (await Deno.stat(`${runtimeRoot}scpcb.wasm`)).size, type: "wasm" });

for (const filename of rootFiles) {
  const path = join(distRoot, filename);
  try {
    const stats = await Deno.stat(path);
    files.push({ path: filename, size: stats.size });
  } catch {
    console.warn(`Missing ${filename} in dist output (expected at ${path})`);
  }
}

for await (const entry of walkFiles(assetsRoot)) {
  const rel = relative(assetsRoot, entry.path).replace(/\\/g, "/");
  const ext = lowerExt(rel);

  if (ext === "b3d" || ext === "x" || ext === "rmesh") {
    // Track B: convert offline during packaging and do NOT include source formats in dist.
    const srcStat = await Deno.stat(entry.path);
    if (srcStat.size === 0) {
      console.warn(`[build] skipping empty source asset: ${rel}`);
      continue;
    }
    const outRel = rel.replace(/\.b3d$/i, ".smpk").replace(/\.x$/i, ".smpk").replace(/\.rmesh$/i, ".smpk");
    const dest = join(distAssetsRoot, outRel);
    await ensureDir(join(dest, ".."));

    const tool = ext === "b3d"
      ? "Tools/convert_b3d_to_smpk.ts"
      : ext === "x"
      ? "Tools/convert_x_to_smpk.ts"
      : "Tools/convert_rmesh_to_smpk.ts";

    await run(["deno", "run", "-A", tool, entry.path, "-o", dest], repoRoot);
    const size = (await Deno.stat(dest)).size;
    files.push({ path: `assets/${outRel}`, size });
    continue;
  }

  const dest = join(distAssetsRoot, rel);
  await ensureDir(join(dest, ".."));
  await copy(entry.path, dest, { overwrite: true });
  const size = (await Deno.stat(dest)).size;
  files.push({ path: `assets/${rel}`, size });
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
  files
};

const manifestText = JSON.stringify(manifest, null, 2);
await Deno.writeTextFile(`${distRoot}scpcb_manifest.json`, manifestText);
await Deno.writeTextFile(new URL("./scpcb_manifest.json", import.meta.url).pathname, manifestText);

// Deploy contract: never ship .b3d/.x in dist.
await validateNoSourceModels({ rootDir: distRoot, manifestPath: `${distRoot}scpcb_manifest.json`, bannedExts: ["b3d", "x", "rmesh"] });

console.log("Copied scpcb.wasm + assets and generated scpcb_manifest.json");
