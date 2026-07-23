#!/usr/bin/env -S deno run --allow-read

if (Deno.args.length < 1) {
  console.error("Usage: wasm_validate.ts <file.wasm>");
  Deno.exit(2);
}

const path = Deno.args[0];
const bytes = Deno.readFileSync(path);
new WebAssembly.Module(bytes);
