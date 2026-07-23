import { assert } from "./assert.ts";
import { checkCmdbufExports } from "../cmdbuf_wasm_check.ts";

Deno.test("checkCmdbufExports detects missing exports", () => {
  // Minimal wasm module:
  // (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
  const wasmB64 = "AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=";
  const wasmBytes = Uint8Array.from(atob(wasmB64), (c) => c.charCodeAt(0));
  const r = checkCmdbufExports(wasmBytes);
  assert(r.missing.length === 3, "must report all missing cmdbuf exports");
});

Deno.test("checkCmdbufExports passes when required exports exist", () => {
  // (module
  //   (global (export "__CmdBufPtr") (mut i32) (i32.const 0))
  //   (global (export "__CmdBufBytes") (mut i32) (i32.const 0))
  //   (global (export "__CmdBufAbiVersion") i32 (i32.const 1)))
  const wasmB64 =
    "AGFzbQEAAAAGEAN/AUEAC38BQQALfwBBAQsHNAMLX19DbWRCdWZQdHIDAA1fX0NtZEJ1ZkJ5dGVzAwESX19DbWRCdWZBYmlWZXJzaW9uAwI=";
  const wasmBytes = Uint8Array.from(atob(wasmB64), (c) => c.charCodeAt(0));
  const r = checkCmdbufExports(wasmBytes);
  assert(r.missing.length === 0, "must not report missing exports");
});
