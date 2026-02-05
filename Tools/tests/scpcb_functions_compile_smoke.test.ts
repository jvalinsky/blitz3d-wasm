/// <reference lib="deno.ns" />

/**
 * BB compilation smoke tests for SCPCB-critical functions.
 *
 * Each test compiles a short BB snippet using the web compiler WASM
 * and validates the output is structurally valid WASM.
 *
 * Run: deno test --allow-read Tools/tests/scpcb_functions_compile_smoke.test.ts
 */

import { assert } from "./assert.ts";

const errno = {
  success: 0,
  badf: 8,
  noent: 44,
  nosys: 52,
};

let cachedCompiler: {
  compile: (source: string) => Uint8Array;
} | null = null;

async function getCompiler() {
  if (cachedCompiler) return cachedCompiler;

  const compilerBytes = await Deno.readFile("web/blitz3d-compiler.wasm");
  let wasmMemoryRef: WebAssembly.Memory | null = null;

  const wasi_snapshot_preview1: Record<string, (...args: any[]) => any> = {
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
    fd_write: (fd: number, iovs: number, iovs_len: number, nwritten: number) => {
      if (!wasmMemoryRef) return errno.success;
      if (fd === 1 || fd === 2) {
        const view = new DataView(wasmMemoryRef.buffer);
        let written = 0;
        for (let i = 0; i < iovs_len; i++) {
          written += view.getUint32(iovs + i * 8 + 4, true);
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
    try { exports._start(); } catch { /* ignore */ }
  }

  // Read autoImports from compiler_worker.ts
  const workerSrc = await Deno.readTextFile("web/compiler_worker.ts");
  const m = workerSrc.match(/const autoImports = \[(.*?)\];/s);
  const autoImports = m
    ? Array.from(m[1].matchAll(/"([^"]+)"/g)).map((x) => x[1]!)
    : [];

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

  const compile = (source: string): Uint8Array => {
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
      sourcePtr, sourceBytes.length,
      optionsPtr, optionsBytes.length,
      resultPtrPtr, resultLenPtr,
    );
    if (rc !== 0) throw new Error(`compile_blitz3d returned ${rc}`);

    const view = new DataView(exports.memory.buffer);
    const resultPtr = view.getUint32(resultPtrPtr, true);
    const resultLen = view.getUint32(resultLenPtr, true);
    if (!resultPtr || !resultLen) {
      throw new Error(`compile_blitz3d returned empty result`);
    }

    const resultText = td.decode(new Uint8Array(exports.memory.buffer, resultPtr, resultLen));
    const result = JSON.parse(resultText) as
      | { success: true; wasm: string; size: number }
      | { success: false; error: string };

    if (!result.success) throw new Error((result as any).error);
    return Uint8Array.from(atob((result as any).wasm), (ch) => ch.charCodeAt(0));
  };

  cachedCompiler = { compile };
  return cachedCompiler;
}

function validateWasm(wasm: Uint8Array) {
  // Create an ArrayBuffer-backed view to satisfy TS (BufferSource excludes SharedArrayBuffer).
  const bytes = new Uint8Array(wasm);
  if (!WebAssembly.validate(bytes)) throw new Error("WebAssembly.validate failed");
  try {
    new WebAssembly.Module(bytes);
  } catch (e) {
    throw new Error(`WebAssembly.Module parse failed: ${(e as Error).message}`);
  }
}

Deno.test("3D visibility and blend functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
cam = CreateCamera()
cube = CreateCube()
EntityBlend cube, 1
HideEntity cube
ShowEntity cube
v = EntityVisible(cube)
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("Fog functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
FogMode 1
FogColor 128, 128, 128
FogRange 1, 100
FogDensity 0.5
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("Camera functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
cam = CreateCamera()
CameraRange cam, 0.1, 1000
CameraZoom cam, 2
CameraViewport cam, 0, 0, 400, 300
CameraClsColor cam, 0, 0, 0
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("Pixel buffer functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
tex = CreateTexture(256, 256)
buf = TextureBuffer(tex)
LockBuffer buf
; 0xFFFF0000 as signed 32-bit int
WritePixelFast 0, 0, -65536, buf
c = ReadPixelFast(0, 0, buf)
UnlockBuffer buf
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("Audio functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
snd = LoadSound("test.wav")
ch = PlaySound(snd)
ChannelVolume ch, 0.5
ChannelPitch ch, 44100
p = ChannelPlaying(ch)
StopChannel ch
FreeSound snd
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("SCPCB-specific functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
v = GetINIInt("options.ini", "graphics", "width", 800)
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("Entity hierarchy functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
cam = CreateCamera()
cube = CreateCube()
NameEntity cube, "myCube"
n$ = EntityName$(cube)
c = CountChildren(cube)
EntityAutoFade cube, 1.0, 100.0
EntityOrder cube, 1
d# = EntityDistance(cube, cam)
MoveEntity cube, 1, 0, 0
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("Sprite functions compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
s = CreateSprite()
ScaleSprite s, 2.0, 2.0
SpriteViewMode s, 2
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});

Deno.test("DeltaPitch/DeltaYaw/Memory compile", async () => {
  const { compile } = await getCompiler();
  const wasm = compile(`
Graphics3D 800, 600, 32, 2
cam = CreateCamera()
cube = CreateCube()
PositionEntity cube, 10, 5, 10
p# = DeltaPitch(cam, cube)
y# = DeltaYaw(cam, cube)
m = Memory()
`);
  validateWasm(wasm);
  assert(wasm.byteLength > 0);
});
