import { join, relative } from "node:path";
import { copy, ensureDir, walkFiles } from "../Tools/fs.ts";

const publicRoot = new URL("./public/", import.meta.url).pathname;
const runtimeRoot = new URL("../Sources/Runtime/", import.meta.url).pathname;
const publicAssetsRoot = join(publicRoot, "assets");

console.log("Setting up dev environment in web/public...");

const convertAssets = Deno.args.includes("--convert");
const deleteSource = Deno.args.includes("--delete-source");

await ensureDir(publicRoot);
await ensureDir(publicAssetsRoot);

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

// Copy Assets from sibling scpcb directory if available
const scpcbRepo = new URL("../../scpcb/", import.meta.url).pathname;
const assetDirs = ["GFX", "SFX", "Data"];
const rootFiles = ["options.ini"];

console.log(`Looking for assets in ${scpcbRepo}...`);

try {
  for (const dir of assetDirs) {
    const src = join(scpcbRepo, dir);
    const dest = join(publicRoot, dir);

    // Check if source exists
    try {
      await Deno.stat(src);
    } catch {
      console.warn(`Missing source directory: ${src}`);
      continue;
    }

    console.log(`Copying ${dir}...`);
    await ensureDir(dest);
    await copy(src, dest, { overwrite: true });
  }
} catch (e) {
  console.error("Asset copy failed:", e);
}

// Ensure required root files exist and are in the manifest (e.g. options.ini used during module init)
for (const filename of rootFiles) {
  const dest = join(publicRoot, filename);
  const src = join(scpcbRepo, filename);
  try {
    await copy(src, dest, { overwrite: true });
    console.log(`Copied ${filename} from scpcb repo root.`);
  } catch {
    console.warn(
      `Missing required root file: ${filename} (looked for ${dest} and ${src})`,
    );
  }
}

// Web port: disable SCPCB's launcher by default (it is an interactive loop that blocks the thread).
// Users can still opt in via URL flag (`?launcher=1`) and/or by editing options.ini manually.
try {
  const path = join(publicRoot, "options.ini");
  const txt = await Deno.readTextFile(path);
  const normalized = txt.replace(
    /^\s*launcher enabled\s*=\s*(true|false|0|1)\s*$/gim,
    "launcher enabled = 0",
  );
  if (normalized !== txt) {
    await Deno.writeTextFile(path, normalized);
    console.log("Normalized options.ini: launcher enabled = 0");
  }
} catch {
  // ignore
}

// Check for compiled WASM
const wasmPath = join(publicRoot, "scpcb.wasm");
try {
  const stats = await Deno.stat(wasmPath);
  console.log(`Using existing scpcb.wasm (${stats.size} bytes)`);
} catch {
  console.warn("scpcb.wasm not found in public/, checking Runtime...");
  // Only copy if not present
  const runtimeWasm = join(runtimeRoot, "scpcb.wasm");
  try {
    await copy(runtimeWasm, wasmPath);
    const stats = await Deno.stat(wasmPath);
    console.log("Copied fallback scpcb.wasm from Runtime.");
  } catch {
    console.error("No scpcb.wasm found!");
  }
}

if (convertAssets) {
  console.log(
    `[setup] converting source model assets to .smpk (${
      deleteSource ? "and deleting sources" : "keeping sources"
    })...`,
  );
  const repoRoot = new URL("../", import.meta.url).pathname;
  const args = [
    "deno",
    "run",
    "-A",
    "Tools/assets_scpcb_convert.ts",
    "--root",
    "web/public",
    "--no-rewrite-manifest",
    "--no-validate-manifest",
  ];
  if (deleteSource) args.push("--delete-source");
  await run(args, repoRoot);
}

// Build file list after all mutations (copy, optional conversion, normalization).
const files: { path: string; size: number; type?: string }[] = [];
for await (const entry of walkFiles(publicRoot.replace(/\/+$/g, ""))) {
  const rel = relative(publicRoot, entry.path).replace(/\\/g, "/");
  const size = (await Deno.stat(entry.path)).size;
  const type = rel === "scpcb.wasm" ? "wasm" : undefined;
  files.push({ path: rel, size, type });
}

const manifest = {
  basePath: "/",
  groups: {
    boot: ["scpcb.wasm", ...rootFiles],
    // Minimal set needed for SCPCB init/config parsing.
    init: files
      .filter((f) => f.path === "options.ini" || f.path.startsWith("Data/"))
      .map((f) => f.path),
    facility_assets: files.filter((f) =>
      f.path.startsWith("assets/") || f.path.startsWith("GFX/") ||
      f.path.startsWith("SFX/") || f.path.startsWith("Data/")
    ).map((f) => f.path),
  },
  files,
};

const manifestText = JSON.stringify(manifest, null, 2);
await Deno.writeTextFile(join(publicRoot, "scpcb_manifest.json"), manifestText);
console.log(`Generated manifest with ${files.length} files.`);

console.log("Dev setup complete.");
