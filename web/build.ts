import { build } from "npm:vite";

await build({
  root: ".",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    target: "esnext",
  },
});
