export const REQUIRED_CMDBUF_EXPORTS = [
  "__CmdBufPtr",
  "__CmdBufBytes",
  "__CmdBufAbiVersion",
] as const;

export type CmdbufCheckResult = {
  missing: string[];
  present: string[];
};

export const checkCmdbufExports = (wasmBytes: Uint8Array): CmdbufCheckResult => {
  const mod = new WebAssembly.Module(wasmBytes as unknown as BufferSource);
  const exported = new Set(WebAssembly.Module.exports(mod).map((e) => e.name));
  const missing: string[] = [];
  const present: string[] = [];
  for (const name of REQUIRED_CMDBUF_EXPORTS) {
    if (exported.has(name)) present.push(name);
    else missing.push(name);
  }
  return { missing, present };
};
