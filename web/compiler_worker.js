// Web Worker: runs the Blitz3D compiler WASM off the UI thread.
//
// Protocol:
// - main -> worker: { type: "init" }
// - worker -> main: { type: "ready" } | { type: "error", message, stack? }
// - main -> worker: { type: "compile", id, source }
// - worker -> main: { type: "compile_result", id, ok, error?, wasmBytes?, size? }

let compilerInstance = null;
let memory = null;
let optionsPtr = 0;
let optionsLen = 0;

function postError(message, stack = "") {
  self.postMessage({ type: "error", message, stack });
}

function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function initCompiler() {
  // This URL is resolved at runtime from the bundled worker location.
  // Vite doesn't see the file at build time (it's copied by web/build.ts).
  const wasmUrl = /* @vite-ignore */ new URL(
    "../blitz3d-compiler.wasm",
    import.meta.url,
  );
  const response = await fetch(wasmUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch compiler: ${response.status} ${response.statusText}`,
    );
  }
  const bytes = await response.arrayBuffer();

  let wasmMemoryRef = null;
  const wasiImports = {
    args_get: () => 0,
    args_sizes_get: (argc, argv_buf_size) => {
      if (!wasmMemoryRef) return 0;
      const view = new DataView(wasmMemoryRef.buffer);
      view.setUint32(argc, 0, true);
      view.setUint32(argv_buf_size, 0, true);
      return 0;
    },
    environ_get: () => 0,
    environ_sizes_get: (envc, env_buf_size) => {
      if (!wasmMemoryRef) return 0;
      const view = new DataView(wasmMemoryRef.buffer);
      view.setUint32(envc, 0, true);
      view.setUint32(env_buf_size, 0, true);
      return 0;
    },
    fd_write: (fd, iovs, iovs_len, nwritten) => {
      if (!wasmMemoryRef) return 0;
      if (fd === 1 || fd === 2) {
        const view = new DataView(wasmMemoryRef.buffer);
        const bytes = new Uint8Array(wasmMemoryRef.buffer);
        let written = 0;
        for (let i = 0; i < iovs_len; i++) {
          const ptr = view.getUint32(iovs + i * 8, true);
          const len = view.getUint32(iovs + i * 8 + 4, true);
          // Intentionally ignore stdout/stderr output from the compiler (it can be noisy).
          written += len;
          void bytes;
          void ptr;
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
    proc_exit: (_code) => {},
    random_get: (buf, bufLen) => {
      if (!wasmMemoryRef) return 0;
      const mem = new Uint8Array(wasmMemoryRef.buffer);
      for (let i = 0; i < bufLen; i++) {
        mem[buf + i] = Math.floor(Math.random() * 256);
      }
      return 0;
    },
    clock_time_get: (_id, _precision, time) => {
      if (!wasmMemoryRef) return 0;
      const view = new DataView(wasmMemoryRef.buffer);
      view.setBigUint64(time, BigInt(Date.now()) * BigInt(1000000), true);
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

  const wasm = await WebAssembly.instantiate(bytes, {
    env: {},
    wasi_snapshot_preview1: wasiImports,
  });

  compilerInstance = wasm.instance;
  wasmMemoryRef = compilerInstance.exports.memory;
  memory = compilerInstance.exports.memory;

  // Provide an allowlist for auto-importing unknown runtime functions so calls
  // like `cube = CreateCube()` are correctly treated as expression-valued
  // imports (and don't produce invalid WASM).
  //
  // Note: keep this list in sync with the runtime stubs in interpreter.js.
  const autoImports = [
    "print",
    "printstring",
    "printint",
    "printfloat",
    "millisecs",
    "millicsecs",
    "filetype",
    "filesize",
    "currentdir",
    "changedir",
    "readdir",
    "nextfile",
    "morefiles",
    "readfile",
    "openfile",
    "writefile",
    "closefile",
    "eof",
    "filepos",
    "seekfile",
    "readbyte",
    "readshort",
    "readint",
    "readfloat",
    "readstring",
    "readline",
    "writeline",
    "writestring",
    "writebyte",
    "writeshort",
    "writeint",
    "writefloat",
    "abs",
    "ceil",
    "floor",
    "sqr",
    "sqrt",
    "sin",
    "cos",
    "tan",
    "atan2",
    "min",
    "max",
    "seedrnd",
    "rnd",
    "rand",
    "len",
    "left",
    "right",
    "mid",
    "lower",
    "upper",
    "trim",
    "replace",
    "instr",
    "chr",
    "asc",
    "inttostring",
    "floattostring",
    "graphics",
    "graphics3d",
    "cls",
    "flip",
    "clscolor",
    "color",
    "getcolor",
    "getkey",
    "keydown",
    "keyhit",
    "mousex",
    "mousey",
    "mousez",
    "mousedown",
    "mousehit",
    "mousexspeed",
    "mouseyspeed",
    "movemouse",
    "flushkeys",
    "flushmouse",
    "hidepointer",
    "showpointer",
    "createcube",
    "createsphere",
    "createplane",
    "createcamera",
    "createlight",
    "ambientlight",
    "lightcolor",
    "lightrange",
    "fogmode",
    "fogcolor",
    "fogrange",
    "fogdensity",
    "positionentity",
    "entitycolor",
    "rotateentity",
    "turnentity",
    "scaleentity",
    "entityx",
    "entityy",
    "entityz",
    "entityyaw",
    "entitypitch",
    "entityroll",
    "entityvisible",
    "hideentity",
    "showentity",
    "freeentity",
    "entityparent",
    "getparent",
    "renderworld",
    "createbrush",
    "brushcolor",
    "brushalpha",
    "brushblend",
    "freebrush",
    "entityalpha",
    "entityblend",
    "entityfx",
    "loadtexture",
    "textureloaded",
    "texturewidth",
    "textureheight",
    "entitytexture",
    "createmesh",
    "createsurface",
    "countsurfaces",
    "getsurface",
    "addvertex",
    "addvertexextended",
    "addtriangle",
    "updatenormals",
    "rect",
    "oval",
    "line",
    "text",
    "backbuffer",
    "frontbuffer",
    "setbuffer",
    "stringwidth",
    "stringheight",
    "loadfont",
    "setfont",
    "freefont",
    "loadimage",
    "imageloaded",
    "createimage",
    "drawimage",
    "drawimagerect",
    "drawblock",
    "tileimage",
    "imagewidth",
    "imageheight",
    "midhandle",
    "automidhandle",
    "handleimage",
    "maskimage",
    "scaleimage",
    "resizeimage",
    "rotateimage",
    "freeimage",
    "cameraclscolor",
    "camerarange",
    "camerazoom",
    "cameraviewport",
  ];

  const optionsJSON = JSON.stringify({
    optimize: true,
    debugInfo: false,
    sourceMap: false,
    commandBuffer: false,
    autoImports,
  });

  const optionsBytes = new TextEncoder().encode(optionsJSON);
  const malloc = compilerInstance.exports.malloc;
  if (typeof malloc === "function" && memory) {
    optionsLen = optionsBytes.length;
    optionsPtr = malloc(optionsLen);
    new Uint8Array(memory.buffer, optionsPtr, optionsLen).set(optionsBytes);
  }

  // Best-effort Swift runtime init.
  try {
    compilerInstance.exports._start();
  } catch {
    // ignore
  }
}

function compileSource(source) {
  if (!compilerInstance) throw new Error("Compiler not initialized");

  const exports = compilerInstance.exports;
  const malloc = exports.malloc;
  const free = exports.free;

  const compileFunc = exports.compile_blitz3d || exports._compile_blitz3d ||
    exports.compileBlitz3D;
  if (!compileFunc) {
    throw new Error(
      "compile_blitz3d function not found. Available: " +
        Object.keys(exports).join(", "),
    );
  }

  const encoder = new TextEncoder();
  const sourceBytes = encoder.encode(source);

  const sourcePtr = malloc(sourceBytes.length + 1);
  if (sourcePtr === 0) throw new Error("Failed to allocate source buffer");

  try {
    new Uint8Array(memory.buffer, sourcePtr, sourceBytes.length).set(
      sourceBytes,
    );

    const resultPtrPtr = malloc(4);
    const resultLenPtr = malloc(4);
    if (resultPtrPtr === 0 || resultLenPtr === 0) {
      throw new Error("Failed to allocate result pointers");
    }

    try {
      const ret = compileFunc(
        sourcePtr,
        sourceBytes.length,
        optionsPtr ? optionsPtr : 0,
        optionsLen | 0,
        resultPtrPtr,
        resultLenPtr,
      );
      if (ret !== 0) throw new Error(`Compilation failed (exit ${ret})`);

      const resultPtr = new Uint32Array(memory.buffer, resultPtrPtr, 1)[0];
      const resultLen = new Uint32Array(memory.buffer, resultLenPtr, 1)[0];
      if (!resultPtr || !resultLen) {
        throw new Error("Compilation returned empty result");
      }

      const resultView = new Uint8Array(memory.buffer, resultPtr, resultLen);
      const resultJSON = new TextDecoder().decode(resultView);
      const result = JSON.parse(resultJSON);

      if (exports.free_result) exports.free_result(resultPtr);

      if (result && result.success && typeof result.wasm === "string") {
        const wasmBytes = base64ToBytes(result.wasm);
        // Reduce message size: don't ship the base64 back to main.
        delete result.wasm;
        return {
          ok: true,
          result: {
            ...result,
            size: wasmBytes.byteLength,
          },
          wasmBytes,
        };
      }

      return { ok: true, result };
    } finally {
      free(resultPtrPtr);
      free(resultLenPtr);
    }
  } finally {
    free(sourcePtr);
  }
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  try {
    if (msg.type === "init") {
      if (!compilerInstance) await initCompiler();
      self.postMessage({ type: "ready" });
      return;
    }

    if (msg.type === "compile") {
      const id = msg.id;
      const source = String(msg.source ?? "");
      const compiled = compileSource(source);
      if (compiled.wasmBytes) {
        // Send a detached, exact-length ArrayBuffer (avoid TypedArray view quirks).
        const buf = compiled.wasmBytes.buffer.slice(
          compiled.wasmBytes.byteOffset,
          compiled.wasmBytes.byteOffset + compiled.wasmBytes.byteLength,
        );
        self.postMessage(
          {
            type: "compile_result",
            id,
            ok: true,
            result: compiled.result,
            wasmBytes: buf,
          },
          [buf],
        );
      } else {
        self.postMessage({
          type: "compile_result",
          id,
          ok: true,
          result: compiled.result,
        });
      }
      return;
    }
  } catch (e) {
    const message = e?.message ? String(e.message) : String(e);
    const stack = e?.stack ? String(e.stack) : "";
    if (msg.type === "compile") {
      self.postMessage({
        type: "compile_result",
        id: msg.id,
        ok: false,
        error: message,
        stack,
      });
      return;
    }
    postError(message, stack);
  }
};
