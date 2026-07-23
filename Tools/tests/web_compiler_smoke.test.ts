import { assert } from "./assert.ts";

const errno = {
  success: 0,
  badf: 8,
  noent: 44,
  nosys: 52,
};

const wasiImports = {
  args_get: () => errno.success,
  args_sizes_get: () => errno.success,
  environ_get: () => errno.success,
  environ_sizes_get: () => errno.success,
  clock_res_get: () => errno.success,
  clock_time_get: () => errno.success,
  fd_close: () => errno.success,
  fd_fdstat_get: () => errno.success,
  fd_fdstat_set_flags: () => errno.success,
  fd_filestat_get: () => errno.success,
  fd_filestat_set_size: () => errno.success,
  fd_pread: () => errno.success,
  fd_prestat_get: () => errno.badf,
  fd_prestat_dir_name: () => errno.badf,
  fd_read: () => errno.success,
  fd_readdir: () => errno.success,
  fd_seek: () => errno.success,
  fd_sync: () => errno.success,
  fd_tell: () => errno.success,
  fd_write: () => errno.success,
  path_create_directory: () => errno.nosys,
  path_filestat_get: () => errno.noent,
  path_filestat_set_times: () => errno.nosys,
  path_link: () => errno.nosys,
  path_open: () => errno.noent,
  path_readlink: () => errno.nosys,
  path_remove_directory: () => errno.nosys,
  path_rename: () => errno.nosys,
  path_symlink: () => errno.nosys,
  path_unlink_file: () => errno.nosys,
  poll_oneoff: () => errno.success,
  proc_exit: () => errno.success,
  random_get: () => errno.success,
  sched_yield: () => errno.success,
};

const compileWithWebCompiler = async (source: string) => {
  const compilerBytes = await Deno.readFile("web/blitz3d-compiler.wasm");

  let wasmMemoryRef: WebAssembly.Memory | null = null;

  const wasi_snapshot_preview1 = {
    args_get: () => errno.success,
    args_sizes_get: (argc: number, argv_buf_size: number) => {
      if (!wasmMemoryRef) return errno.success;
      const view = new DataView(wasmMemoryRef.buffer);
      view.setUint32(argc, 0, true);
      view.setUint32(argv_buf_size, 0, true);
      return errno.success;
    },
    environ_get: () => errno.success,
    environ_sizes_get: (envc: number, env_buf_size: number) => {
      if (!wasmMemoryRef) return errno.success;
      const view = new DataView(wasmMemoryRef.buffer);
      view.setUint32(envc, 0, true);
      view.setUint32(env_buf_size, 0, true);
      return errno.success;
    },
    fd_write: (
      fd: number,
      iovs: number,
      iovs_len: number,
      nwritten: number,
    ) => {
      if (!wasmMemoryRef) return errno.success;
      if (fd === 1 || fd === 2) {
        const view = new DataView(wasmMemoryRef.buffer);
        let written = 0;
        for (let i = 0; i < iovs_len; i++) {
          const len = view.getUint32(iovs + i * 8 + 4, true);
          written += len;
        }
        view.setUint32(nwritten, written, true);
      }
      return errno.success;
    },
    fd_read: () => errno.success,
    fd_close: () => errno.success,
    fd_seek: () => errno.success,
    fd_fdstat_get: () => errno.success,
    fd_fdstat_set_flags: () => errno.success,
    fd_prestat_get: () => errno.badf,
    fd_prestat_dir_name: () => errno.badf,
    path_open: () => errno.noent,
    path_filestat_get: () => errno.noent,
    proc_exit: () => errno.success,
    random_get: (buf: number, bufLen: number) => {
      if (!wasmMemoryRef) return errno.success;
      const mem = new Uint8Array(wasmMemoryRef.buffer);
      for (let i = 0; i < bufLen; i++) mem[buf + i] = (Math.random() * 256) | 0;
      return errno.success;
    },
    clock_time_get: (_id: number, _precision: bigint, time: number) => {
      if (!wasmMemoryRef) return errno.success;
      const view = new DataView(wasmMemoryRef.buffer);
      view.setBigUint64(time, BigInt(Date.now()) * 1_000_000n, true);
      return errno.success;
    },
    poll_oneoff: () => errno.success,
    sched_yield: () => errno.success,
    clock_res_get: () => errno.success,
    fd_filestat_get: () => errno.success,
    fd_filestat_set_size: () => errno.success,
    fd_pread: () => errno.success,
    fd_readdir: () => errno.success,
    fd_sync: () => errno.success,
    fd_tell: () => errno.success,
    path_create_directory: () => errno.nosys,
    path_filestat_set_times: () => errno.nosys,
    path_link: () => errno.nosys,
    path_readlink: () => errno.nosys,
    path_remove_directory: () => errno.nosys,
    path_rename: () => errno.nosys,
    path_symlink: () => errno.nosys,
    path_unlink_file: () => errno.nosys,
  };

  const { instance } = await WebAssembly.instantiate(compilerBytes, {
    env: {},
    wasi_snapshot_preview1,
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

  const te = new TextEncoder();
  const td = new TextDecoder();

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

  const sourceBytes = te.encode(source);
  const optionsJSON = JSON.stringify({
    optimize: true,
    debugInfo: false,
    sourceMap: false,
    commandBuffer: false,
    autoImports,
  });
  const optionsBytes = te.encode(optionsJSON);

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
  if (rc !== 0) throw new Error(`compile_blitz3d returned ${rc}`);

  const view = new DataView(exports.memory.buffer);
  const resultPtr = view.getUint32(resultPtrPtr, true);
  const resultLen = view.getUint32(resultLenPtr, true);
  if (!resultPtr || !resultLen) {
    throw new Error(
      `compile_blitz3d returned empty result (ptr=${resultPtr}, len=${resultLen})`,
    );
  }

  const resultText = td.decode(
    new Uint8Array(exports.memory.buffer, resultPtr, resultLen),
  );
  const result = JSON.parse(resultText) as
    | { success: true; wasm: string; size: number }
    | { success: false; error: string };

  if (!result.success) throw new Error(result.error);

  return Uint8Array.from(atob(result.wasm), (ch) => ch.charCodeAt(0));
};

const validateWasm = async (wasm: Uint8Array) => {
  // Keep this test hermetic: CI runs with `--allow-run=deno` (no `wasm-validate`).
  // `WebAssembly.validate` catches structural issues; `new WebAssembly.Module`
  // provides a stronger parse-time check.
  const copy = new Uint8Array(wasm.byteLength);
  copy.set(wasm);
  const buf = copy.buffer;

  if (!WebAssembly.validate(buf)) {
    throw new Error("WebAssembly.validate failed");
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _mod = new WebAssembly.Module(buf);
  } catch (e) {
    throw new Error(`WebAssembly.Module parse failed: ${(e as Error).message}`);
  }
};

Deno.test("web compiler produces valid wasm (hello)", async () => {
  const wasm = await compileWithWebCompiler('Print "Hello from web compiler"');
  await validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("web compiler produces valid wasm (step comparisons)", async () => {
  const source = `
Global a
Function __Step%()
  If a = 0 And 1 <> 0 Then
    a = 1
  EndIf
  Return a
End Function
`;
  const wasm = await compileWithWebCompiler(source);
  await validateWasm(wasm);
  assert(wasm.byteLength > 0);
});
