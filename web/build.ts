import { build } from "npm:vite";
import { copy } from "https://deno.land/std@0.224.0/fs/copy.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";

await build({
  root: ".",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "esnext",
  },
});

const distRoot = new URL("../dist/", import.meta.url).pathname;
await ensureDir(distRoot);

const assetsToCopy = [
  {
    src: new URL("../Sources/Runtime/scpcb.wasm", import.meta.url).pathname,
    dest: new URL("../dist/scpcb.wasm", import.meta.url).pathname,
  },
  {
    src: new URL("./scpcb_manifest.json", import.meta.url).pathname,
    dest: new URL("../dist/scpcb_manifest.json", import.meta.url).pathname,
  },
];

for (const asset of assetsToCopy) {
  await copy(asset.src, asset.dest, { overwrite: true });
}
