import { assert } from "./assert.ts";
import { CMDB_VERSION } from "../../web/src/shared/command_buffer.ts";
import { assertCmdBufAbi } from "../../web/src/shared/cmdbuf_abi.ts";

Deno.test("assertCmdBufAbi no-ops when module has no CMDB exports", () => {
  assertCmdBufAbi({});
});

Deno.test("assertCmdBufAbi accepts matching ABI version", () => {
  const exports: WebAssembly.Exports = {
    __CmdBufPtr: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
    __CmdBufBytes: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
    __CmdBufAbiVersion: new WebAssembly.Global({ value: "i32", mutable: false }, CMDB_VERSION),
  };
  assertCmdBufAbi(exports);
});

Deno.test("assertCmdBufAbi throws if ABI export missing", () => {
  const exports: WebAssembly.Exports = {
    __CmdBufPtr: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
  };
  let threw = false;
  try {
    assertCmdBufAbi(exports);
  } catch (e) {
    threw = true;
    assert(String(e).includes("__CmdBufAbiVersion"), "error must mention __CmdBufAbiVersion");
  }
  assert(threw, "must throw");
});

Deno.test("assertCmdBufAbi throws on mismatch", () => {
  const exports: WebAssembly.Exports = {
    __CmdBufPtr: new WebAssembly.Global({ value: "i32", mutable: true }, 0),
    __CmdBufAbiVersion: new WebAssembly.Global({ value: "i32", mutable: false }, (CMDB_VERSION + 1) | 0),
  };
  let threw = false;
  try {
    assertCmdBufAbi(exports);
  } catch (e) {
    threw = true;
    assert(String(e).includes("ABI mismatch"), "error must mention mismatch");
  }
  assert(threw, "must throw");
});

