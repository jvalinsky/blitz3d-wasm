#!/usr/bin/env -S deno run -A --node-modules-dir=auto

import * as esbuild from "npm:esbuild@0.24";

await esbuild.build({
  entryPoints: ["web-ide/src/compiler/all.ts"],
  bundle: true,
  format: "iife",
  globalName: "Blitz3DCompiler",
  footer: { js: "window.Blitz3DCompiler = Blitz3DCompiler;" },
  target: "es2020",
  outfile: "web-ide/dist/compiler.bundle.js",
});

esbuild.stop();
console.log("Built compiler.bundle.js");
