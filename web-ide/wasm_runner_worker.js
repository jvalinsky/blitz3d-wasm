/* Killable WASM runner for web-ide (safe mode).
 *
 * Runs compiled WASM in a Web Worker so infinite loops can't freeze the UI.
 * The main thread owns the watchdog timeout and terminates the worker if needed.
 *
 * This worker implements a minimal Blitz3D-ish import surface used by the TS
 * compiler demo. Graphics calls are stubbed (no rendering) in safe mode.
 */

let memory = null;
let wasmInstance = null;

function readStr(ptr) {
  if (!memory) return "";
  const view = new Uint8Array(memory.buffer);
  let s = "";
  while (ptr < view.length && view[ptr] !== 0) {
    s += String.fromCharCode(view[ptr]);
    ptr++;
  }
  return s;
}

function allocStr(str) {
  if (!memory || !wasmInstance) return 0;
  const heapPtrGlobal = wasmInstance.exports.__heap_ptr;
  let ptr = heapPtrGlobal ? heapPtrGlobal.value : 4096;
  const view = new Uint8Array(memory.buffer);
  for (let i = 0; i < str.length; i++) {
    view[ptr + i] = str.charCodeAt(i) & 0xff;
  }
  view[ptr + str.length] = 0;
  const result = ptr;
  ptr += str.length + 1;
  ptr = (ptr + 3) & ~3;
  if (heapPtrGlobal) heapPtrGlobal.value = ptr;
  return result;
}

function stdout(text) {
  self.postMessage({ kind: "stdout", text });
}

function makeImports() {
  const stubHandle = (() => {
    let next = 1;
    return () => next++;
  })();

  return {
    env: {
      print: (value) => stdout(String(value) + "\n"),
      printFloat: (value) => stdout(String(value) + "\n"),
      printString: (ptr) => stdout(readStr(ptr) + "\n"),

      // String built-ins
      b3d_len: (ptr) => readStr(ptr).length,
      b3d_left: (ptr, n) => allocStr(readStr(ptr).substring(0, n)),
      b3d_right: (ptr, n) => {
        const s = readStr(ptr);
        return allocStr(s.substring(s.length - n));
      },
      b3d_mid: (ptr, start, len) =>
        allocStr(readStr(ptr).substring(start - 1, start - 1 + len)),
      b3d_instr: (ptr1, ptr2, start) => {
        const s = readStr(ptr1);
        const find = readStr(ptr2);
        const idx = s.indexOf(find, (start || 1) - 1);
        return idx === -1 ? 0 : idx + 1; // Blitz is 1-based
      },
      b3d_upper: (ptr) => allocStr(readStr(ptr).toUpperCase()),
      b3d_lower: (ptr) => allocStr(readStr(ptr).toLowerCase()),
      b3d_trim: (ptr) => allocStr(readStr(ptr).trim()),
      b3d_chr: (code) => allocStr(String.fromCharCode(code)),
      b3d_asc: (ptr) => {
        const s = readStr(ptr);
        return s.length > 0 ? s.charCodeAt(0) : 0;
      },
      b3d_str: (val) => allocStr(String(val)),
      b3d_string: (ptr, count) => allocStr(readStr(ptr).repeat(count)),
      b3d_replace: (ptr, findPtr, replPtr) =>
        allocStr(readStr(ptr).split(readStr(findPtr)).join(readStr(replPtr))),

      // Math (degrees trig)
      b3d_abs: (x) => Math.abs(x),
      b3d_sgn: (x) => (x > 0 ? 1 : x < 0 ? -1 : 0),
      b3d_sin: (x) =>
        (Math.round(Math.sin((x * Math.PI) / 180) * 1000) / 1000) | 0,
      b3d_cos: (x) =>
        (Math.round(Math.cos((x * Math.PI) / 180) * 1000) / 1000) | 0,
      b3d_tan: (x) =>
        (Math.round(Math.tan((x * Math.PI) / 180) * 1000) / 1000) | 0,
      b3d_asin: (x) => Math.round((Math.asin(x) * 180) / Math.PI) | 0,
      b3d_acos: (x) => Math.round((Math.acos(x) * 180) / Math.PI) | 0,
      b3d_atan: (x) => Math.round((Math.atan(x) * 180) / Math.PI) | 0,
      b3d_atan2: (y, x) =>
        Math.round((Math.atan2(y, x) * 180) / Math.PI) | 0,
      b3d_sqr: (x) => Math.sqrt(x) | 0,
      b3d_floor: (x) => Math.floor(x),
      b3d_ceil: (x) => Math.ceil(x),
      b3d_log: (x) => Math.log(x) | 0,
      b3d_exp: (x) => Math.exp(x) | 0,

      // Conversion
      b3d_int: (x) => x | 0,
      b3d_float: (x) => x,

      // Random
      b3d_rand: (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo,
      b3d_rnd: (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo,
      b3d_seedrnd: (_seed) => {},

      // System
      b3d_millisecs: () => Date.now() | 0,
      b3d_pow: (base, exp) => Math.pow(base, exp) | 0,

      // Graphics (stubbed)
      b3d_graphics3d: (_w, _h) => {},
      b3d_graphics: (_w, _h) => {},
      b3d_createsphere: (_s) => stubHandle(),
      b3d_createcube: () => stubHandle(),
      b3d_createmesh: () => stubHandle(),
      b3d_createsurface: (_m) => stubHandle(),
      b3d_createcamera: () => stubHandle(),
      b3d_createlight: (_t) => stubHandle(),
      b3d_positionentity: (_h, _x, _y, _z) => {},
      b3d_rotateentity: (_h, _p, _y, _r) => {},
      b3d_turnentity: (_h, _p, _y, _r) => {},
      b3d_scaleentity: (_h, _x, _y, _z) => {},
      b3d_entityx: (_h) => 0,
      b3d_entityy: (_h) => 0,
      b3d_entityz: (_h) => 0,
      b3d_entitydistance: (_h1, _h2) => 0,
      b3d_pointentity: (_h, _t) => {},
      b3d_lightcolor: (_h, _r, _g, _b) => {},
      b3d_entitycolor: (_h, _r, _g, _b) => {},
      b3d_entitytexture: (_h, _t) => {},
      b3d_renderworld: () => {},
      b3d_flip: () => {},
      b3d_cls: () => {},
      b3d_loadtexture: (_p) => stubHandle(),
      b3d_loadimage: (_p) => stubHandle(),
      b3d_loadmesh: (_p) => stubHandle(),
      b3d_drawimage: (_i, _x, _y) => {},
      b3d_addvertex: (_s, _x, _y, _z) => 0,
      b3d_addtriangle: (_s, _v0, _v1, _v2) => {},
      b3d_animate: (_e, _m, _s, _f) => {},
      b3d_createplane: () => stubHandle(),
      b3d_createskybox: (_t) => stubHandle(),

      // Input (stubbed)
      b3d_keydown: (_k) => 0,
    },
  };
}

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  if (msg.kind !== "run") return;

  try {
    memory = null;
    wasmInstance = null;

    const imports = makeImports();
    const wasmBytes = msg.wasmBytes;
    const module = await WebAssembly.instantiate(wasmBytes, imports);
    wasmInstance = module.instance;
    memory = wasmInstance.exports.memory || null;

    if (wasmInstance.exports.main) {
      wasmInstance.exports.main();
    }

    self.postMessage({ kind: "done" });
  } catch (e) {
    self.postMessage({
      kind: "error",
      message: e?.message ? String(e.message) : String(e),
      stack: e?.stack ? String(e.stack) : "",
    });
  }
};

