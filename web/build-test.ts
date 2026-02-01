#!/usr/bin/env -S deno run -A
/**
 * Build script for graphics test page
 * Bundles TypeScript runtime into browser-compatible JavaScript
 */

import * as esbuild from "npm:esbuild@0.20.0";

console.log("📦 Building graphics test bundle...");

const result = await esbuild.build({
    entryPoints: ["./src/runtime/test-entry.ts"],
    bundle: true,
    format: "esm",
    outfile: "./dist/test-graphics-bundle.js",
    platform: "browser",
    target: "es2020",
    sourcemap: true,
    minify: false, // Keep readable for debugging
    define: {
        // Define globals if needed
    },
    loader: {
        ".ts": "ts",
        ".wgsl": "text",
        ".vert": "text",
        ".frag": "text",
    },
});

console.log("✅ Build complete!");
console.log(`   Output: dist/test-graphics-bundle.js`);
console.log(`   Size: ${(await Deno.stat("./dist/test-graphics-bundle.js")).size} bytes`);

esbuild.stop();
