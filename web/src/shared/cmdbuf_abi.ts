import { CMDB_VERSION } from "./command_buffer.ts";

export const CMDB_ABI_VERSION = CMDB_VERSION;

const readI32Global = (exports: WebAssembly.Exports, name: string): number | null => {
  const v = (exports as any)[name];
  if (!(v instanceof WebAssembly.Global)) return null;
  const value = v.value;
  if (typeof value === "bigint") return Number(value) | 0;
  return (value as number) | 0;
};

export const assertCmdBufAbi = (exports: WebAssembly.Exports) => {
  const hasPtr = readI32Global(exports, "__CmdBufPtr") !== null;
  const hasBytes = readI32Global(exports, "__CmdBufBytes") !== null;
  if (!hasPtr && !hasBytes) return;

  const abi = readI32Global(exports, "__CmdBufAbiVersion");
  if (abi === null) {
    throw new Error("CMDB: module exports __CmdBufPtr/__CmdBufBytes but not __CmdBufAbiVersion");
  }
  if (abi !== CMDB_ABI_VERSION) {
    throw new Error(`CMDB: ABI mismatch (wasm=${abi} runtime=${CMDB_ABI_VERSION})`);
  }
};
