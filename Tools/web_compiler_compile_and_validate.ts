/**
 * Compile a Blitz3D BASIC snippet using the in-browser compiler WASM
 * (`web/blitz3d-compiler.wasm`) with the same auto-import allowlist used by
 * `web/compiler_worker.js`, and optionally validate the produced module.
 *
 * Usage:
 *   deno run -A Tools/web_compiler_compile_and_validate.ts <input.bb> [--out /tmp/out.wasm] [--validate]
 */

const usage = () => {
  console.log(
    "Usage: deno run -A Tools/web_compiler_compile_and_validate.ts <input.bb> [--out /tmp/out.wasm] [--validate]",
  );
};

const args = [...Deno.args];
const inputPath = args.find((a) => !a.startsWith("-"));
if (!inputPath) {
  usage();
  Deno.exit(2);
}

const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;
const shouldValidate = args.includes("--validate");

const source = await Deno.readTextFile(inputPath);

const compilerBytes = await Deno.readFile("web/blitz3d-compiler.wasm");

let wasmMemoryRef: WebAssembly.Memory | null = null;

const wasiImports = {
  args_get: () => 0,
  args_sizes_get: (argc: number, argv_buf_size: number) => {
    if (!wasmMemoryRef) return 0;
    const view = new DataView(wasmMemoryRef.buffer);
    view.setUint32(argc, 0, true);
    view.setUint32(argv_buf_size, 0, true);
    return 0;
  },
  environ_get: () => 0,
  environ_sizes_get: (envc: number, env_buf_size: number) => {
    if (!wasmMemoryRef) return 0;
    const view = new DataView(wasmMemoryRef.buffer);
    view.setUint32(envc, 0, true);
    view.setUint32(env_buf_size, 0, true);
    return 0;
  },
  fd_write: (fd: number, iovs: number, iovs_len: number, nwritten: number) => {
    if (!wasmMemoryRef) return 0;
    if (fd === 1 || fd === 2) {
      const view = new DataView(wasmMemoryRef.buffer);
      let written = 0;
      for (let i = 0; i < iovs_len; i++) {
        const len = view.getUint32(iovs + i * 8 + 4, true);
        written += len;
      }
      view.setUint32(nwritten, written, true);
    }
    return 0;
  },
  fd_read: () => 0,
  fd_close: () => 0,
  fd_seek: () => 0,
  fd_fdstat_get: () => 0,
  fd_fdstat_set_flags: () => 0,
  fd_prestat_get: () => 8,
  fd_prestat_dir_name: () => 8,
  path_open: () => 8,
  path_filestat_get: () => 8,
  proc_exit: (_code: number) => {},
  random_get: (buf: number, bufLen: number) => {
    if (!wasmMemoryRef) return 0;
    const mem = new Uint8Array(wasmMemoryRef.buffer);
    for (let i = 0; i < bufLen; i++) mem[buf + i] = (Math.random() * 256) | 0;
    return 0;
  },
  clock_time_get: (_id: number, _precision: bigint, time: number) => {
    if (!wasmMemoryRef) return 0;
    const view = new DataView(wasmMemoryRef.buffer);
    view.setBigUint64(time, BigInt(Date.now()) * 1_000_000n, true);
    return 0;
  },
  poll_oneoff: () => 0,
  sched_yield: () => 0,
  clock_res_get: () => 0,
  fd_filestat_get: () => 0,
  fd_filestat_set_size: () => 0,
  fd_pread: () => 0,
  fd_readdir: () => 0,
  fd_sync: () => 0,
  fd_tell: () => 0,
  path_create_directory: () => 0,
  path_filestat_set_times: () => 0,
  path_link: () => 0,
  path_readlink: () => 0,
  path_remove_directory: () => 0,
  path_rename: () => 0,
  path_symlink: () => 0,
  path_unlink_file: () => 0,
};

const { instance } = await WebAssembly.instantiate(compilerBytes, {
  env: {},
  wasi_snapshot_preview1: wasiImports,
});

const exports = instance.exports as unknown as {
  memory: WebAssembly.Memory;
  malloc: (n: number) => number;
  free: (ptr: number) => void;
  _start?: () => void;
  compile_blitz3d: (
    sourcePtr: number,
    sourceLen: number,
    optionsPtr: number,
    optionsLen: number,
    resultPtrPtr: number,
    resultLenPtr: number,
  ) => number;
};

wasmMemoryRef = exports.memory;

if (typeof exports._start === "function") {
  try {
    exports._start();
  } catch {
    // ignore
  }
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const allocBytes = (bytes: Uint8Array) => {
  const ptr = exports.malloc(bytes.length + 1);
  if (!ptr) throw new Error("malloc failed");
  new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
  return ptr;
};

const allocU32 = () => {
  const ptr = exports.malloc(4);
  if (!ptr) throw new Error("malloc(4) failed");
  new DataView(exports.memory.buffer).setUint32(ptr, 0, true);
  return ptr;
};

// `web/compiler_worker.ts` is bundled by Vite for the web UI. We keep the
// authoritative `autoImports` list in the TS source (no checked-in JS
// artifact in this repo).
const workerSrc = await Deno.readTextFile("web/compiler_worker.ts");
const m = workerSrc.match(/const autoImports = \[(.*?)\];/s);
const autoImports = m
  ? Array.from(m[1].matchAll(/"([^"]+)"/g)).map((x) => x[1]!)
  : [];

const sourceBytes = textEncoder.encode(source);
const optionsJSON = JSON.stringify({
  optimize: true,
  debugInfo: false,
  sourceMap: false,
  commandBuffer: false,
  autoImports,
});
const optionsBytes = textEncoder.encode(optionsJSON);

const sourcePtr = allocBytes(sourceBytes);
const optionsPtr = allocBytes(optionsBytes);
const resultPtrPtr = allocU32();
const resultLenPtr = allocU32();

const rc = exports.compile_blitz3d(
  sourcePtr,
  sourceBytes.length,
  optionsPtr,
  optionsBytes.length,
  resultPtrPtr,
  resultLenPtr,
);

const view = new DataView(exports.memory.buffer);
const resultPtr = view.getUint32(resultPtrPtr, true);
const resultLen = view.getUint32(resultLenPtr, true);

if (rc !== 0) {
  throw new Error(`compile_blitz3d returned ${rc}`);
}
if (!resultPtr || !resultLen) {
  throw new Error(
    `compile_blitz3d returned empty result (ptr=${resultPtr}, len=${resultLen})`,
  );
}

const resultBytes = new Uint8Array(exports.memory.buffer, resultPtr, resultLen);
const resultText = textDecoder.decode(resultBytes);

const result = JSON.parse(resultText) as
  | { success: true; wasm: string; size: number }
  | { success: false; error: string };

if (!result.success) {
  console.error(result.error);
  Deno.exit(1);
}

const wasmBytes = Uint8Array.from(atob(result.wasm), (c) => c.charCodeAt(0));
console.log(`web compiler ok: wasm size = ${wasmBytes.byteLength} bytes`);

if (outPath) {
  await Deno.writeFile(outPath, wasmBytes);
  console.log(`wrote: ${outPath}`);
}

if (shouldValidate) {
  // Default temp dir on macOS is often under `/var/folders`, but many tasks/tests
  // run with `--allow-write=/tmp`. Prefer `/tmp` for the default output.
  const tmp = outPath ??
    await Deno.makeTempFile({ dir: "/tmp", suffix: ".wasm" });
  if (!outPath) await Deno.writeFile(tmp, wasmBytes);
  const p = new Deno.Command("wasm-validate", {
    args: [tmp],
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const { code } = await p.status;
  if (code !== 0) Deno.exit(code);
  console.log("wasm-validate ok");
}

try {
  exports.free(sourcePtr);
  exports.free(optionsPtr);
  exports.free(resultPtrPtr);
  exports.free(resultLenPtr);
} catch {
  // ignore
}
