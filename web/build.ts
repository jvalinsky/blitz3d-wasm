import { build } from "npm:vite";
import { copy } from "https://deno.land/std@0.224.0/fs/copy.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { join, relative } from "https://deno.land/std@0.224.0/path/mod.ts";

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

await ensureDir(distRoot);
await ensureDir(distAssetsRoot);

await copy(`${runtimeRoot}scpcb.wasm`, `${distRoot}scpcb.wasm`, { overwrite: true });

for await (const entry of walk(assetsRoot, { includeDirs: false })) {
  const rel = relative(assetsRoot, entry.path).replace(/\\/g, "/");
  const dest = join(distAssetsRoot, rel);
  await ensureDir(join(dest, ".."));
  await copy(entry.path, dest, { overwrite: true });
}

const files: { path: string; size: number; type?: string }[] = [];
files.push({ path: "scpcb.wasm", size: (await Deno.stat(`${runtimeRoot}scpcb.wasm`)).size, type: "wasm" });

for await (const entry of walk(assetsRoot, { includeDirs: false })) {
  const rel = relative(assetsRoot, entry.path).replace(/\\/g, "/");
  const size = (await Deno.stat(entry.path)).size;
  files.push({ path: `assets/${rel}`, size });
}

const manifest = {
  basePath: "/",
  groups: {
    boot: ["scpcb.wasm"],
    facility_assets: files.filter((f) => f.path.startsWith("assets/")).map((f) => f.path)
  },
  files
};

const manifestText = JSON.stringify(manifest, null, 2);
await Deno.writeTextFile(`${distRoot}scpcb_manifest.json`, manifestText);
await Deno.writeTextFile(new URL("./scpcb_manifest.json", import.meta.url).pathname, manifestText);

console.log("Copied scpcb.wasm + assets and generated scpcb_manifest.json");
