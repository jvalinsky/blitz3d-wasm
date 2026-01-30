type WorkerInitMessage = {
  cmd: "init";
  wasmUrl: string;
  manifestUrl: string;
  preloadGroup: string;
};

type WorkerCallMessage = {
  cmd: "call";
  callId?: number;
  exportName: string;
  args?: Array<number | string>;
};

type WorkerSetGlobalMessage = {
  cmd: "setGlobal";
  name: string;
  value: number;
};

type WorkerPrimeInputMessage = {
  cmd: "primeInput";
};

type WorkerTerminateMessage = {
  cmd: "dispose";
};

type WorkerMessage =
  | WorkerInitMessage
  | WorkerCallMessage
  | WorkerSetGlobalMessage
  | WorkerPrimeInputMessage
  | WorkerTerminateMessage;

type AssetManifestEntry = {
  path: string;
  url?: string;
  size?: number;
};

type AssetManifest = {
  basePath?: string;
  groups?: Record<string, string[]>;
  files?: AssetManifestEntry[];
};

type Status = {
  stage: string;
  preload?: { loaded: number; total: number; file?: string };
  fetch?: { loaded: number; total: number | null; file?: string };
  lastFileReq?: string;
  lastDebugLog?: string;
  counters?: Record<string, number>;
};

const status: Status = { stage: "boot" };

const counters: Record<string, number> = Object.create(null);
const bump = (k: string, n = 1) => {
  counters[k] = (counters[k] ?? 0) + n;
  status.counters = counters;
  // Keep main thread updated during tight loops; throttled inside maybePostStatus().
  try {
    maybePostStatus();
  } catch {}
};

const postStatus = () => {
  (self as any).postMessage({ type: "status", status: { ...status } });
};

let lastStatusPostMs = 0;
const maybePostStatus = () => {
  const now = performance.now();
  if (now - lastStatusPostMs < 100) return;
  lastStatusPostMs = now;
  postStatus();
};

const postLog = (...args: any[]) => {
  (self as any).postMessage({
    type: "log",
    message: args.map((a) => {
      try {
        return typeof a === "string" ? a : JSON.stringify(a);
      } catch {
        return String(a);
      }
    }).join(" "),
  });
};

const latin1Decoder = new TextDecoder("latin1");

const readString = (mem: WebAssembly.Memory, ptr: number) => {
  if (!ptr) return "";
  const u8 = new Uint8Array(mem.buffer);
  const maxLen = u8.length;
  try {
    if (ptr + 8 <= maxLen) {
      const view = new DataView(mem.buffer);
      const len = view.getInt32(ptr + 4, true);
      const start = ptr + 8;
      const end = start + len;
      const maxStringLen = 1024 * 1024;
      if (len >= 0 && len <= maxStringLen && end >= start && end <= maxLen) {
        bump("readString.struct");
        return latin1Decoder.decode(u8.subarray(start, end));
      }
    }
  } catch {}
  // C-string fallback
  bump("readString.cstr");
  let i = ptr;
  const maxStringLen = 1024 * 1024;
  const start = i;
  let end = start;
  let n = 0;
  while (end < maxLen && n < maxStringLen) {
    if (u8[end] === 0) break;
    end++;
    n++;
  }
  return latin1Decoder.decode(u8.subarray(start, end));
};

const writeString = (
  mem: WebAssembly.Memory,
  stringAlloc: ((len: number) => number) | null,
  str: string,
) => {
  if (!stringAlloc) return 0;
  const len = str.length | 0;
  const ptr = stringAlloc(len) | 0;
  if (!ptr) return 0;
  // `__StringAlloc` in this build is a simple bump allocator and may advance past the
  // current memory size (memory has max=512 pages). Grow memory on-demand so writes
  // don't fault with "offset is outside the bounds of the DataView".
  const needed = (ptr + 8 + len + 1) >>> 0;
  try {
    const cur = mem.buffer.byteLength >>> 0;
    if (needed > cur) {
      const delta = needed - cur;
      const pages = Math.ceil(delta / 65536);
      if (pages > 0) mem.grow(pages);
    }
  } catch {}

  const view = new DataView(mem.buffer);
  view.setInt32(ptr + 0, 1, true);
  view.setInt32(ptr + 4, len, true);
  const bytes = new Uint8Array(mem.buffer, ptr + 8, len + 1);
  for (let i = 0; i < len; i++) bytes[i] = str.charCodeAt(i) & 0xff;
  bytes[len] = 0;
  return ptr;
};

// Minimal VFS for init/config reads.
const vfs = new Map<string, Uint8Array>();
const vfsIndexLower = new Map<string, string>();
const openFiles = new Map<number, { data: Uint8Array; pos: number; path: string }>();
let nextHandle = 1;

// Headless image/texture tracking (to satisfy init code that expects non-zero handles and sizes).
let imageSizes = new Map<number, { w: number; h: number }>();

// Input shims (enough to satisfy SCPCB's early "press any key" logic).
const keysHit = new Map<number, number>();
const keysDown = new Map<number, boolean>();
const keyQueue: number[] = [];
const mouseHit = new Map<number, number>();
const mouseDown = new Map<number, boolean>();

const primeInput = () => {
  // DIK scan codes (Blitz3D) + common DOM keyCode fallbacks.
  // Enter: DIK_RETURN=28, DOM=13; Space: DIK_SPACE=57, DOM=32
  const bump = (m: Map<number, number>, k: number) =>
    m.set(k, (m.get(k) ?? 0) + 1);
  bump(keysHit, 28);
  bump(keysHit, 13);
  bump(keysHit, 57);
  bump(keysHit, 32);
  keysDown.set(28, true);
  keysDown.set(13, true);
  keysDown.set(57, true);
  keysDown.set(32, true);
  // ASCII-ish queue for GetKey/WaitKey
  keyQueue.push(13, 32);
  bump(mouseHit, 1);
  mouseDown.set(1, true);
};

const resolvePath = (p: string) =>
  String(p || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");

const rewriteSourceModelPath = (p: string) => p.replace(/\.(b3d|x|rmesh)$/i, ".smpk");

const openFileCandidates = (path: string): string[] => {
  const rp = resolvePath(path);
  const rpLower = rp.toLowerCase();
  const rewritten = rewriteSourceModelPath(rp);

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (p: string) => {
    const r = resolvePath(p);
    if (!r) return;
    const k = r.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(r);
  };

  push(rp);
  if (rewritten !== rp) push(rewritten);

  if (!rpLower.startsWith("assets/")) {
    push(`assets/${rp}`);
    if (rewritten !== rp) push(`assets/${rewritten}`);
  } else {
    const stripped = rp.slice("assets/".length);
    push(stripped);
    const strippedRewritten = rewriteSourceModelPath(stripped);
    if (strippedRewritten !== stripped) push(strippedRewritten);
  }

  // Dev convenience: some older manifests/servers place Data/* at root.
  if (rpLower.startsWith("data/")) {
    const stripped = rp.slice("data/".length);
    push(stripped);
    const strippedRewritten = rewriteSourceModelPath(stripped);
    if (strippedRewritten !== stripped) push(strippedRewritten);
    if (!rpLower.startsWith("assets/")) {
      push(`assets/${stripped}`);
      if (strippedRewritten !== stripped) push(`assets/${strippedRewritten}`);
    }
  }

  return out;
};

const vfsSet = (path: string, data: Uint8Array) => {
  const rp = resolvePath(path);
  vfs.set(rp, data);
  vfsIndexLower.set(rp.toLowerCase(), rp);
};

const vfsGet = (path: string): { key: string; data: Uint8Array } | null => {
  const rp = resolvePath(path);
  const exact = vfs.get(rp);
  if (exact) return { key: rp, data: exact };
  const actual = vfsIndexLower.get(rp.toLowerCase());
  if (!actual) return null;
  const data = vfs.get(actual);
  return data ? { key: actual, data } : null;
};

let instance: WebAssembly.Instance | null = null;
let module: WebAssembly.Module | null = null;
let memory: WebAssembly.Memory | null = null;
let stringAlloc: ((len: number) => number) | null = null;

const openFile = (path: string) => {
  const candidates = openFileCandidates(path);
  for (const rp of candidates) {
    const hit = vfsGet(rp);
    if (!hit) continue;
    const h = nextHandle++;
    openFiles.set(h, { data: hit.data, pos: 0, path: hit.key });
    status.lastFileReq = hit.key;
    maybePostStatus();
    return h;
  }
  status.lastFileReq = candidates[0] ?? resolvePath(path);
  maybePostStatus();
  return 0;
};

const readByte = (h: number) => {
  const f = openFiles.get(h);
  if (!f) return -1;
  if (f.pos >= f.data.length) return -1;
  return f.data[f.pos++]!;
};

const readInt = (h: number) => {
  const b1 = readByte(h);
  const b2 = readByte(h);
  const b3 = readByte(h);
  const b4 = readByte(h);
  if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) return 0;
  return (b1 | (b2 << 8) | (b3 << 16) | (b4 << 24)) | 0;
};

const eof = (h: number) => {
  const f = openFiles.get(h);
  if (!f) return 1;
  return f.pos >= f.data.length ? 1 : 0;
};

const readLineToWasmString = (h: number) => {
  const f = openFiles.get(h);
  if (!f || !memory) return 0;
  const max = 1024 * 1024;
  bump("ReadLine");
  const start = f.pos;
  let end = start;
  let n = 0;
  while (end < f.data.length && n < max) {
    const b = f.data[end]!;
    // LF
    if (b === 10) break;
    // CR
    if (b === 13) break;
    end++;
    n++;
  }
  // Advance pos past line ending.
  f.pos = end;
  if (f.pos < f.data.length) {
    const b = f.data[f.pos]!;
    if (b === 13) {
      f.pos++;
      if (f.pos < f.data.length && f.data[f.pos] === 10) f.pos++;
    } else if (b === 10) {
      f.pos++;
    }
  }
  maybePostStatus();
  return writeString(memory, stringAlloc, latin1Decoder.decode(f.data.subarray(start, end)));
};

const stubMissingImports = (imports: any, m: WebAssembly.Module) => {
  const required = WebAssembly.Module.imports(m);
  for (const imp of required) {
    if (!(imp.module in imports)) imports[imp.module] = {};
    if (!(imp.name in imports[imp.module])) {
      if (imp.kind === "function") {
        const key = `missing:${imp.module}.${imp.name}`;
        imports[imp.module][imp.name] = (..._args: any[]) => {
          bump(key);
          maybePostStatus();
          return 0;
        };
      }
    }
  }
};

const buildImports = () => {
  const imports: any = {
    env: {
      __indirect_function_table: new WebAssembly.Table({
        initial: 0,
        element: "anyfunc",
      }),
    },
    blitz3d: {},
    al: {},
  };

  // File I/O
  imports.env.OpenFile = (pathPtr: number) => {
    if (!memory) return 0;
    const p = readString(memory, pathPtr);
    bump("OpenFile");
    return openFile(p);
  };
  imports.env.ReadFile = (pathPtr: number) => {
    if (!memory) return 0;
    const p = readString(memory, pathPtr);
    bump("ReadFile");
    return openFile(p);
  };
  imports.env.CloseFile = (h: number) => {
    bump("CloseFile");
    openFiles.delete(h);
  };
  imports.env.ReadByte = (h: number) => readByte(h);
  imports.env.ReadInt = (h: number) => readInt(h);
  imports.env.Eof = (h: number) => eof(h);
  imports.env.FilePos = (h: number) => {
    const f = openFiles.get(h);
    bump("FilePos");
    return f ? (f.pos | 0) : 0;
  };
  imports.env.SeekFile = (h: number, pos: number) => {
    const f = openFiles.get(h);
    bump("SeekFile");
    if (!f) return;
    const p = Math.max(0, Math.min(f.data.length, pos | 0));
    f.pos = p;
  };
  imports.env.FileType = (pathPtr: number) => {
    if (!memory) return 0;
    const req = resolvePath(readString(memory, pathPtr));
    const candidates = openFileCandidates(req);
    for (const p of candidates) {
      const hit = vfsGet(p);
      if (hit) {
        status.lastFileReq = hit.key;
        maybePostStatus();
        return 1;
      }
    }
    status.lastFileReq = candidates[0] ?? req;
    maybePostStatus();
    return 0;
  };
  imports.env.FileSize = (pathPtr: number) => {
    if (!memory) return 0;
    const req = resolvePath(readString(memory, pathPtr));
    const candidates = openFileCandidates(req);
    for (const p of candidates) {
      const hit = vfsGet(p);
      if (hit) {
        status.lastFileReq = hit.key;
        maybePostStatus();
        return hit.data.length ?? 0;
      }
    }
    status.lastFileReq = candidates[0] ?? req;
    maybePostStatus();
    return 0;
  };
  imports.env.ReadString = (h: number) => {
    if (!memory) return 0;
    // SCPCB uses ReadString/ReadLine primarily for text parsing during init.
    // Treat as line-oriented read (like native Blitz3D ReadLine).
    return readLineToWasmString(h);
  };
  imports.env.ReadLine = (h: number) => {
    if (!memory) return 0;
    return readLineToWasmString(h);
  };

  // String helpers (used heavily by INI parsing / UI logic).
  // All functions use the Blitz3D string struct layout and return new allocated strings.
  imports.env.StringEqual = (aPtr: number, bPtr: number) => {
    if (!memory) return 0;
    bump("StringEqual");
    return readString(memory, aPtr) === readString(memory, bPtr) ? 1 : 0;
  };
  imports.env.StringConcat = (aPtr: number, bPtr: number) => {
    if (!memory) return 0;
    bump("StringConcat");
    return writeString(
      memory,
      stringAlloc,
      readString(memory, aPtr) + readString(memory, bPtr),
    );
  };
  imports.env.Len = (sPtr: number) => {
    if (!memory) return 0;
    bump("Len");
    return readString(memory, sPtr).length | 0;
  };
  imports.env.Left = (sPtr: number, n: number) => {
    if (!memory) return 0;
    bump("Left");
    const s = readString(memory, sPtr);
    const nn = Math.max(0, n | 0);
    if (nn >= s.length) return sPtr | 0;
    return writeString(memory, stringAlloc, s.slice(0, nn));
  };
  imports.env.Right = (sPtr: number, n: number) => {
    if (!memory) return 0;
    bump("Right");
    const s = readString(memory, sPtr);
    const nn = Math.max(0, n | 0);
    if (nn >= s.length) return sPtr | 0;
    return writeString(memory, stringAlloc, s.slice(s.length - nn));
  };
  imports.env.Mid = (sPtr: number, start1: number, n: number) => {
    if (!memory) return 0;
    bump("Mid");
    const s = readString(memory, sPtr);
    const start = Math.max(1, start1 | 0) - 1; // 1-based
    const nn = Math.max(0, n | 0);
    if (start <= 0 && nn >= s.length) return sPtr | 0;
    return writeString(memory, stringAlloc, s.slice(start, start + nn));
  };
  imports.env.Trim = (sPtr: number) => {
    if (!memory) return 0;
    bump("Trim");
    const s = readString(memory, sPtr);
    const t = s.trim();
    if (t === s) return sPtr | 0;
    return writeString(memory, stringAlloc, t);
  };
  imports.env.LTrim = (sPtr: number) => {
    if (!memory) return 0;
    bump("LTrim");
    return writeString(
      memory,
      stringAlloc,
      readString(memory, sPtr).replace(/^\s+/, ""),
    );
  };
  imports.env.RTrim = (sPtr: number) => {
    if (!memory) return 0;
    bump("RTrim");
    return writeString(
      memory,
      stringAlloc,
      readString(memory, sPtr).replace(/\s+$/, ""),
    );
  };
  imports.env.Lower = (sPtr: number) => {
    if (!memory) return 0;
    bump("Lower");
    const s = readString(memory, sPtr);
    const t = s.toLowerCase();
    if (t === s) return sPtr | 0;
    return writeString(memory, stringAlloc, t);
  };
  imports.env.Upper = (sPtr: number) => {
    if (!memory) return 0;
    bump("Upper");
    const s = readString(memory, sPtr);
    const t = s.toUpperCase();
    if (t === s) return sPtr | 0;
    return writeString(memory, stringAlloc, t);
  };
  imports.env.Replace = (sPtr: number, findPtr: number, replPtr: number) => {
    if (!memory) return 0;
    bump("Replace");
    const s = readString(memory, sPtr);
    const find = readString(memory, findPtr);
    const repl = readString(memory, replPtr);
    if (!find) return writeString(memory, stringAlloc, s);
    return writeString(memory, stringAlloc, s.split(find).join(repl));
  };
  imports.env.Instr = (sPtr: number, findPtr: number, start1: number) => {
    if (!memory) return 0;
    bump("Instr");
    const s = readString(memory, sPtr);
    const find = readString(memory, findPtr);
    const start = Math.max(1, start1 | 0) - 1;
    if (!find) return 0;
    const idx = s.indexOf(find, start);
    return idx >= 0 ? (idx + 1) | 0 : 0;
  };

  // Logs / errors
  imports.env.DebugLog = (msgPtr: number) => {
    if (!memory) return;
    const msg = readString(memory, msgPtr);
    status.lastDebugLog = msg;
    postLog(`[BB Debug] ${msg}`);
  };
  imports.env.RuntimeError = (msgPtr: number) => {
    if (!memory) throw new Error("RuntimeError");
    const msg = readString(memory, msgPtr);
    throw new Error(msg);
  };
  imports.env.End = () => {
    const err: any = new Error("__BLITZ3D_END__");
    err.__blitz3dEnd = true;
    throw err;
  };

  // Time
  // Clamp large jumps (tab background/resume) so SCPCB timing doesn't explode.
  const maxDeltaMs = 100;
  let lastNowMs = performance.now();
  let virtualNowMs = lastNowMs;
  let clampWarns = 0;
  const millisClamped = () => {
    const now = performance.now();
    let delta = now - lastNowMs;
    lastNowMs = now;
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > maxDeltaMs) {
      if (clampWarns < 3) {
        postLog(
          `[Time] clamping MilliSecs delta ${delta.toFixed(1)}ms -> ${maxDeltaMs}ms`,
        );
        clampWarns++;
      }
      delta = maxDeltaMs;
    }
    virtualNowMs += delta;
    return (virtualNowMs | 0) & 0x7fffffff;
  };
  imports.env.MilliSecs = () => {
    bump("MilliSecs");
    return millisClamped();
  };
  imports.env.MilliSecs2 = () => {
    bump("MilliSecs2");
    return millisClamped();
  };
  imports.env.MilliCSecs = () => {
    bump("MilliCSecs");
    return (performance.now() | 0);
  };

  // Yield-related (no-ops in worker; watchdog kills if spun)
  imports.env.Delay = (_ms: number) => {
    bump("Delay");
    return 0;
  };
  imports.env.VWait = (_n: number) => {
    bump("VWait");
    return 0;
  };
  imports.env.Flip = (_vwait: number) => {
    bump("Flip");
    return 0;
  };

  // Math
  imports.env.Sin = (v: number) => Math.sin(v * Math.PI / 180);
  imports.env.Cos = (v: number) => Math.cos(v * Math.PI / 180);
  imports.env.Tan = (v: number) => Math.tan(v);
  imports.env.ATan2 = (y: number, x: number) => Math.atan2(y, x);
  imports.env.Sqrt = (v: number) => Math.sqrt(v);
  imports.env.Sqr = (v: number) => Math.sqrt(v);
  imports.env.Floor = (v: number) => Math.floor(v);
  imports.env.Ceil = (v: number) => Math.ceil(v);
  imports.env.Abs = (v: number) => Math.abs(v);
  imports.env.Min = (a: number, b: number) => Math.min(a, b);
  imports.env.Max = (a: number, b: number) => Math.max(a, b);
  imports.env.Mod = (a: number, b: number) => a % b;
  imports.env.Pow = (a: number, b: number) => Math.pow(a, b);
  imports.env.Log = (x: number) => Math.log(x);
  imports.env.Log10 = (x: number) => Math.log10(x);

  // Minimal stubs for graphics/audio (headless).
  let nextObj = 1;
  const newHandle = () => (nextObj++ | 0);
  const noop = () => {};
  const zero = () => 0;
  const one = () => 1;

  imports.env.Graphics3D = (_w: number, _h: number, _d: number, _m: number) => {};
  imports.env.CreateCamera = () => newHandle();
  imports.env.CameraClsColor = noop;
  imports.env.CameraFogMode = noop;
  imports.env.CameraFogRange = noop;
  imports.env.CameraFogColor = noop;
  imports.env.CameraZoom = noop;
  imports.env.PositionEntity = noop;
  imports.env.RotateEntity = noop;
  imports.env.ScaleEntity = noop;
  imports.env.ShowEntity = noop;
  imports.env.HideEntity = noop;
  imports.env.RenderWorld = noop;
  imports.env.UpdateWorld = noop;
  imports.env.Cls = noop;
  imports.env.Color = noop;
  imports.env.Text = noop;

  // Images/textures/fonts (return non-zero handles so init code doesn't spin on failures).
  const defaultImageW = 512;
  const defaultImageH = 512;
  const allocImage = (w = defaultImageW, h = defaultImageH) => {
    const id = newHandle();
    imageSizes.set(id, { w, h });
    return id;
  };

  imports.env.LoadImage = (_pathPtr: number) => allocImage();
  imports.env.LoadImage_Strict = (_pathPtr: number) => allocImage();
  imports.env.CreateImage = (_w: number, _h: number) => allocImage();
  imports.env.FreeImage = (_img: number) => {};
  imports.env.ImageWidth = (img: number) => imageSizes.get(img | 0)?.w ?? defaultImageW;
  imports.env.ImageHeight = (img: number) => imageSizes.get(img | 0)?.h ?? defaultImageH;
  imports.env.HandleImage = noop;
  imports.env.MidHandle = noop;
  imports.env.ScaleImage = noop;
  imports.env.ResizeImage = (_img: number, w: number, h: number) => {
    const id = _img | 0;
    if (imageSizes.has(id)) imageSizes.set(id, { w: w | 0, h: h | 0 });
  };
  imports.env.ResizeImage2 = imports.env.ResizeImage;
  imports.env.MaskImage = noop;
  imports.env.DrawImage = noop;
  imports.env.DrawImageRect = noop;
  imports.env.DrawBlock = noop;
  imports.env.TileImage = noop;
  imports.env.TextWidth = (_strPtr: number) => 0;
  imports.env.TextHeight = () => 0;
  imports.env.StringWidth = (_strPtr: number) => 0;
  imports.env.StringHeight = () => 0;

  imports.env.LoadTexture = (_pathPtr: number, _flags: number = 0) => allocImage();
  imports.env.LoadTexture_Strict = (_pathPtr: number, _flags: number = 0) => allocImage();
  imports.env.FreeTexture = (_tex: number) => {};
  imports.env.TextureWidth = (tex: number) => imageSizes.get(tex | 0)?.w ?? defaultImageW;
  imports.env.TextureHeight = (tex: number) => imageSizes.get(tex | 0)?.h ?? defaultImageH;
  imports.env.BrushTexture = noop;
  imports.env.TextureBlend = noop;
  imports.env.TextureCoords = noop;
  imports.env.TextureBuffer = zero;
  imports.env.TextureName = (_tex: number) => 0;
  imports.env.BrushAlpha = noop;
  imports.env.BrushColor = noop;
  imports.env.BrushShininess = noop;
  imports.env.BrushBlend = noop;
  imports.env.BrushFX = noop;

  imports.env.LoadFont = (_pathPtr: number, _size: number = 0, _bold: number = 0, _italic: number = 0, _underline: number = 0) =>
    newHandle();
  imports.env.LoadFont_Strict = imports.env.LoadFont;
  imports.env.SetFont = noop;
  imports.env.FreeFont = noop;

  // Input
  imports.env.KeyDown = (k: number) => keysDown.get(k | 0) ? 1 : 0;
  imports.env.KeyHit = (k: number) => {
    const key = k | 0;
    bump("KeyHit");
    const n = keysHit.get(key) ?? 0;
    if (n) keysHit.set(key, 0);
    return n | 0;
  };
  imports.env.GetKey = () => {
    bump("GetKey");
    const v = keyQueue.length ? (keyQueue.shift() ?? 0) : 0;
    return v | 0;
  };
  imports.env.WaitKey = imports.env.GetKey;
  imports.env.FlushKeys = () => {
    keysHit.clear();
    keysDown.clear();
    keyQueue.length = 0;
  };
  imports.env.MouseDown = (b: number) => mouseDown.get((b | 0)) ? 1 : 0;
  imports.env.MouseHit = (b: number) => {
    const btn = b | 0;
    const n = mouseHit.get(btn) ?? 0;
    if (n) mouseHit.set(btn, 0);
    return n | 0;
  };
  imports.env.MouseX = zero;
  imports.env.MouseY = zero;
  imports.env.MouseZ = zero;
  imports.env.MouseXSpeed = zero;
  imports.env.MouseYSpeed = zero;
  imports.env.MouseZSpeed = zero;

  // Window sizing
  imports.env.WindowWidth = () => 800;
  imports.env.WindowHeight = () => 600;

  // Audio stubs
  imports.env.FSOUND_Init = one;
  imports.env.FSOUND_Close = noop;
  imports.env.LoadSound = zero;
  imports.env.LoadSound_Strict = zero;
  imports.env.PlaySound = zero;
  imports.env.PlaySound_Strict = zero;
  imports.env.FreeSound = noop;
  imports.env.ChannelPlaying = zero;
  imports.env.StopChannel = noop;
  imports.env.ChannelVolume = noop;
  imports.env.ChannelPan = noop;
  imports.env.ChannelPaused = noop;
  imports.env.PauseChannel = noop;
  imports.env.ResumeChannel = noop;

  // Some SCPCB-specific stubs
  imports.env.UpdateSoundOrigin = noop;
  imports.env.UpdateSoundOrigin2 = noop;
  imports.env.LoadEventSound = zero;
  imports.env.PlayAnnouncement = noop;
  imports.env.KeyName = (_k: number) => 0;

  // blitz3d namespace helpers used by some builds
  imports.blitz3d.CreateBank = (_size: number) => 0;
  imports.blitz3d.FreeBank = noop;
  imports.blitz3d.BankSize = (_id: number) => 0;
  imports.blitz3d.PeekInt = (_bank: number, _offset: number) => 0;
  imports.blitz3d.PokeInt = (_bank: number, _offset: number, _value: number) => 0;

  return imports;
};

const fetchManifest = async (manifestUrl: string) => {
  const res = await fetch(manifestUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
  return (await res.json()) as AssetManifest;
};

const fetchFile = async (basePath: string, entry: AssetManifestEntry) => {
  const url = entry.url ?? `${basePath}${basePath.endsWith("/") ? "" : "/"}${entry.path}`;
  status.fetch = { loaded: 0, total: entry.size ?? null, file: entry.path };
  postStatus();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`asset HTTP ${res.status} ${entry.path}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  status.fetch = { loaded: buf.byteLength, total: buf.byteLength, file: entry.path };
  postStatus();
  return buf;
};

const preloadGroup = async (manifest: AssetManifest, group: string) => {
  const files = manifest.groups?.[group] ?? [];
  const byPath = new Map<string, AssetManifestEntry>();
  for (const e of manifest.files ?? []) byPath.set(resolvePath(e.path), e);
  const list = files.map((p) => byPath.get(resolvePath(p))).filter(Boolean) as AssetManifestEntry[];
  status.stage = `preload:${group}`;
  status.preload = { loaded: 0, total: list.length, file: "" };
  postStatus();
  const base = manifest.basePath ?? "/";
  for (let i = 0; i < list.length; i++) {
    const e = list[i]!;
    status.preload = { loaded: i, total: list.length, file: e.path };
    postStatus();
    const data = await fetchFile(base, e);
    vfsSet(e.path, data);
    // Yield to keep worker responsive for status updates.
    await new Promise((r) => setTimeout(r, 0));
  }
  status.preload = { loaded: list.length, total: list.length, file: "" };
  postStatus();
};

const instantiate = async (wasmUrl: string) => {
  status.stage = "fetch:wasm";
  postStatus();
  const res = await fetch(wasmUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`wasm HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  status.stage = "compile:wasm";
  postStatus();
  module = await WebAssembly.compile(buffer);
  const imports = buildImports();
  stubMissingImports(imports, module);
  status.stage = "instantiate:wasm";
  postStatus();
  instance = await WebAssembly.instantiate(module, imports);
  memory = (instance.exports as any).memory as WebAssembly.Memory;
  stringAlloc = (instance.exports as any).__StringAlloc
    ? ((instance.exports as any).__StringAlloc as any)
    : null;
  try {
    const exports = Object.keys(instance.exports ?? {}).sort();
    (self as any).postMessage({
      type: "exports",
      exports,
      hasMain: exports.includes("Main"),
      hasUpdateGame: exports.includes("UpdateGame"),
    });
  } catch {}
  status.stage = "ready";
  postStatus();
};

const callExport = (name: string, args: Array<number | string> = []) => {
  if (!instance) throw new Error("not initialized");
  const fn: any = (instance.exports as any)[name];
  if (typeof fn !== "function") throw new Error(`missing export ${name}`);
  status.stage = `call:${name}`;
  postStatus();
  try {
    const argv: number[] = [];
    for (const a of args) {
      if (typeof a === "string") {
        if (!memory) argv.push(0);
        else argv.push(writeString(memory, stringAlloc, a) | 0);
      } else {
        argv.push((a as number) | 0);
      }
    }
    return fn(...argv);
  } catch (e: any) {
    if (e?.__blitz3dEnd || e?.message === "__BLITZ3D_END__") {
      status.stage = "done:End";
      postStatus();
      return 0;
    }
    status.stage = `error:${name}`;
    postStatus();
    throw e;
  }
};

const setExportedGlobal = (name: string, value: number) => {
  if (!instance) return false;
  try {
    const exp: any = (instance.exports as any)[name];
    if (exp && typeof exp === "object" && "value" in exp) {
      (exp as WebAssembly.Global).value = value as any;
      return true;
    }
  } catch {}
  return false;
};

const dispose = () => {
  instance = null;
  module = null;
  memory = null;
  stringAlloc = null;
  vfs.clear();
  vfsIndexLower.clear();
  openFiles.clear();
  nextHandle = 1;
  keysHit.clear();
  keysDown.clear();
  keyQueue.length = 0;
  mouseHit.clear();
  mouseDown.clear();
  try {
    imageSizes.clear();
  } catch {}
  for (const k of Object.keys(counters)) delete counters[k];
  status.counters = {};
  status.stage = "disposed";
  postStatus();
};

self.onmessage = async (ev: MessageEvent<WorkerMessage>) => {
  const msg = ev.data;
  try {
    if (msg.cmd === "dispose") {
      dispose();
      return;
    }

    if (msg.cmd === "primeInput") {
      primeInput();
      postStatus();
      return;
    }

    if (msg.cmd === "setGlobal") {
      if (!instance) throw new Error("not initialized");
      setExportedGlobal(msg.name, msg.value);
      postStatus();
      return;
    }

    if (msg.cmd === "init") {
      dispose();
      status.stage = "init";
      postStatus();
      const manifest = await fetchManifest(msg.manifestUrl);
      await preloadGroup(manifest, msg.preloadGroup);
      await instantiate(msg.wasmUrl);
      // Prime input by default so early key-wait loops can progress.
      primeInput();
      // Default SCPCB web-mode toggles.
      setExportedGlobal("WebPort", 1);
      setExportedGlobal("LauncherEnabled", 0);
      (self as any).postMessage({ type: "ready" });
      postStatus();
      return;
    }

    if (msg.cmd === "call") {
      const callId = (msg as any).callId ?? 0;
      (self as any).postMessage({
        type: "callStart",
        callId,
        exportName: msg.exportName,
      });
      const result = callExport(msg.exportName, msg.args ?? []);
      (self as any).postMessage({
        type: "callDone",
        callId,
        exportName: msg.exportName,
        result,
      });
      return;
    }
  } catch (e: any) {
    postLog("worker error:", String(e?.message ?? e));
    (self as any).postMessage({
      type: "error",
      callId: (msg as any)?.callId ?? 0,
      exportName: (msg as any)?.exportName ?? "",
      error: String(e?.stack ?? e),
    });
  }
};

// (handler above)
