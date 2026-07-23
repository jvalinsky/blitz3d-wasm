#!/usr/bin/env -S deno run --allow-read

import { checkCmdbufExports } from "./cmdbuf_wasm_check.ts";

if (Deno.args.length < 1) {
  console.error("Usage: validate_cmdbuf_wasm.ts <file.wasm>");
  Deno.exit(2);
}

const path = Deno.args[0]!;
const bytes = Deno.readFileSync(path);
const r = checkCmdbufExports(bytes);
if (r.missing.length) {
  console.error(`[cmdbuf] missing exports: ${r.missing.join(", ")}`);
  Deno.exit(1);
}
console.log(`[cmdbuf] ok: ${r.present.join(", ")}`);
