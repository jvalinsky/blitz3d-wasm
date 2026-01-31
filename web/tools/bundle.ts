import * as esbuild from "deno_esbuild";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.9.0/mod.ts";

const isDev = Deno.args.includes("--dev");

const ctx = await esbuild.context({
    plugins: [...denoPlugins()],
    entryPoints: ["src/main.ts"],
    outfile: "dist/blitz3d.js",
    bundle: true,
    format: "esm",
    sourcemap: isDev ? "inline" : true,
    minify: !isDev,
    define: {
        "process.env.NODE_ENV": isDev ? '"development"' : '"production"',
    },
    logLevel: "info",
});

if (isDev) {
    await ctx.watch();
    console.log("Watching for changes...");
} else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("Build complete.");
}
