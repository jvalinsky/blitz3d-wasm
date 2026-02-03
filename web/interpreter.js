// ============================================
// Blitz3D Web Interpreter - Main Module
// ============================================

import * as THREE from "three";
import { Blitz3DCore } from "./src/runtime/core.ts";
import { Blitz3DFileIO } from "./src/runtime/fileio.ts";
import { Blitz3DGraphics } from "./src/runtime/graphics/index.ts";

// --- STATE ---
let compilerWASM = null;
let compiledModule = null;
let runtimeInstance = null;
let sharedCore = null;
let sharedFileIO = null;
let sharedGraphics = null;
let sharedInstance = null;
let sharedStepRaf = 0;
let sharedStopRequested = false;
let threeScene = null;
let threeRenderer = null;
let threeCamera = null;
let hudCtx = null;
const entities = new Map();
let nextEntityId = 1;
let isCompiling = false;
let compilerWorker = null;
let compilerWorkerReady = false;
let compilerInitPromise = null;
let compileReqId = 1;
let compileInFlight = null;
let demoRAF = null;
let isRunning = false;

const useLegacyGraphicsRuntime = new URLSearchParams(window.location.search)
  .has("legacy");

let ambientLight = null;
let fogMode = 0;
let fogColor = 0x000000;
let fogNear = 1;
let fogFar = 1000;
let fogDensity = 0.01;
let cameraViewport = null; // {x,y,w,h} in pixels
let draw2DColor = "rgb(255,255,255)";
let draw2DFont = "16px monospace";
let nextFontHandle = 1;
const fontHandles = new Map(); // handle -> css font string

let nextImageHandle = 1;
const imageHandles = new Map(); // handle -> { img, loaded, w,h, hx,hy }

let nextTextureHandle = 1;
const textureHandles = new Map(); // handle -> { tex, loaded, w,h }

let nextFileHandle = 1;
const fileHandles = new Map(); // handle -> { mode:'r'|'w'|'dir', path:string, bytes:Uint8Array, pos:number, out:number[], dirEntries?:string[], dirIndex?:number }

let nextBrushHandle = 1;
const brushHandles = new Map(); // handle -> { colorHex, alpha, blend }

let nextSurfaceId = 1;
const surfaces = new Map(); // surfaceId -> SurfaceRecord
const meshSurfaces = new Map(); // meshEntityId -> surfaceIds[]
const dirtySurfaceIds = new Set();

function ensureSurfaceGeometry(surfaceId) {
  const rec = surfaces.get(surfaceId);
  if (!rec || !rec.dirty) return;

  const geom = rec.geometry;
  geom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(rec.positions, 3),
  );
  if (rec.uvs.length) {
    geom.setAttribute("uv", new THREE.Float32BufferAttribute(rec.uvs, 2));
  }
  if (rec.indices.length) {
    geom.setIndex(rec.indices);
  }
  geom.computeBoundingSphere();
  rec.dirty = false;
  dirtySurfaceIds.delete(surfaceId);
}

// --- RNG (for Rnd/Rand/SeedRnd) ---
let rngState = 0x12345678;

function randU32() {
  // xorshift32
  let x = rngState | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  rngState = x | 0;
  return (x >>> 0);
}

function randFloat01() {
  // [0,1)
  return randU32() / 0x1_0000_0000;
}

// --- INPUT STATE (main thread only) ---
const keyDownSet = new Set();
const keyHitSet = new Set();
const keyQueue = [];
const mouseDownSet = new Set();
const mouseHitSet = new Set();
let mouseX = 0;
let mouseY = 0;
let mouseZ = 0;
let mouseXSpeed = 0;
let mouseYSpeed = 0;
let lastMouseMoveMs = 0;

// --- DOM ELEMENTS ---
const getEl = (id) => document.getElementById(id);
const editorEl = getEl("editor");
const outputEl = getEl("output");
const statusIndicatorEl = getEl("status-indicator");
const statusTextEl = getEl("status-text");
const canvasContainerEl = getEl("canvas-container");
const gameCanvasEl = getEl("game-canvas");
const hudCanvasEl = getEl("hud-canvas");
const runBtnEl = getEl("run-btn");
const stopBtnEl = getEl("stop-btn");
const exampleSelectEl = getEl("example-select");
const timeoutMsEl = getEl("timeout-ms");
const vfsUploadEl = getEl("vfs-upload");
const vfsPrefixEl = getEl("vfs-prefix");
const vfsListEl = getEl("vfs-list");
const vfsClearBtnEl = getEl("vfs-clear-btn");

// --- VFS (interpreter-only) ---
const vfs = new Map(); // normalizedPath -> { bytes:Uint8Array, mime:string }
const vfsObjectUrls = new Map(); // normalizedPath -> objectURL
let vfsCwd = "";

function normalizeVfsPath(path) {
  let p = String(path || "").trim();
  p = p.replace(/\\/g, "/");
  // collapse duplicate separators
  p = p.replace(/\/+/g, "/");
  p = p.replace(/^\.\//, "");
  p = p.replace(/^\/+/, "");
  // strip trailing slash
  p = p.replace(/\/+$/, "");
  return p;
}

function guessMime(path) {
  const p = String(path).toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".json")) return "application/json";
  if (p.endsWith(".txt") || p.endsWith(".ini")) return "text/plain";
  return "application/octet-stream";
}

function vfsPut(path, bytes, mime) {
  const key = normalizeVfsPath(path);
  // revoke any prior objectURL
  const prevUrl = vfsObjectUrls.get(key);
  if (prevUrl) URL.revokeObjectURL(prevUrl);
  vfsObjectUrls.delete(key);

  // If the incoming key normalizes differently than what exists in the map
  // (e.g. older uploads with double slashes), merge onto the normalized key.
  for (const existingKey of vfs.keys()) {
    const nk = normalizeVfsPath(existingKey);
    if (nk !== existingKey) {
      const prev = vfs.get(existingKey);
      vfs.delete(existingKey);
      if (prev) vfs.set(nk, prev);
      const prevObj = vfsObjectUrls.get(existingKey);
      if (prevObj) {
        vfsObjectUrls.delete(existingKey);
        vfsObjectUrls.set(nk, prevObj);
      }
    }
  }

  vfs.set(key, { bytes, mime: mime || guessMime(key) });
  renderVfsList();
}

function vfsGet(path) {
  const key = normalizeVfsPath(path);
  return vfs.get(key) || null;
}

function vfsGetObjectUrl(path) {
  const key = normalizeVfsPath(path);
  const existing = vfsObjectUrls.get(key);
  if (existing) return existing;
  const rec = vfs.get(key);
  if (!rec) return null;
  const url = URL.createObjectURL(new Blob([rec.bytes], { type: rec.mime }));
  vfsObjectUrls.set(key, url);
  return url;
}

function vfsClear() {
  for (const url of vfsObjectUrls.values()) URL.revokeObjectURL(url);
  vfsObjectUrls.clear();
  vfs.clear();
  renderVfsList();
}

function renderVfsList() {
  if (!vfsListEl) return;
  vfsListEl.innerHTML = "";
  const entries = [...vfs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "output-line info";
    empty.textContent = "VFS is empty.";
    vfsListEl.appendChild(empty);
    return;
  }
  for (const [path, rec] of entries) {
    const row = document.createElement("div");
    row.className = "vfs-item";

    const left = document.createElement("div");
    left.className = "vfs-path";
    left.textContent = path;
    left.title = "Click to copy path";
    left.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(path);
        printOutput(`Copied path: ${path}`, "info");
      } catch {
        // ignore
      }
    });

    const right = document.createElement("div");
    right.className = "vfs-meta";
    right.textContent = `${rec.bytes.byteLength} bytes`;

    row.appendChild(left);
    row.appendChild(right);
    vfsListEl.appendChild(row);
  }
}

function normalizeWasmBytes(input) {
  if (input instanceof ArrayBuffer) return input;
  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(
      input.byteOffset,
      input.byteOffset + input.byteLength,
    );
  }
  throw new Error("Invalid WASM bytes (expected ArrayBuffer or TypedArray)");
}

// --- EXAMPLES ---
const examples = {
  hello: `Print "Hello from Blitz3D WASM!"
Print "This code is compiled and runs in your browser."`,

  languageBasics: `; Language Basics (prints only)
Local sum = 0
For i = 1 To 5
  sum = sum + i
Next

If sum = 15 Then
  Print "sum ok: " + sum
Else
  Print "sum wrong: " + sum
EndIf

Select sum
Case 14
  Print "case 14"
Case 15
  Print "case 15"
Default
  Print "default"
End Select`,

  arrays: `; Arrays + loops (prints only)
Dim a%(4)
For i = 0 To 4
  a(i) = i * i
Next

For i = 0 To 4
  Print "a(" + i + ")=" + a(i)
Next`,

  customTypes: `; Custom types + For Each (prints only)
Type Node
  Field id%
End Type

For i = 1 To 3
  Local n.Node = New Node
  n\\id = i
Next

For n.Node = Each Node
  Print "node id=" + n\\id
Next`,

  dataReadRestore: `; Data/Read/Restore (prints only)
Local a, b
Local s1$, s2$

Read a, b
Read s1, s2
Print "a=" + a
Print "b=" + b
Print "s1=" + s1
Print "s2=" + s2

Restore
Read a
Print "restored a=" + a

Data 10, 20
Data "hello", "world"`,

  stringsMath: `; Strings + math/random (prints only)
Print "abs=" + Abs(-3)
Print "min=" + Min(2, 5)
Print "max=" + Max(2, 5)
SeedRnd 123
Print "rnd=" + Rnd(1.0)
Print "rand=" + Rand(1, 3)

Local s$ = "AbCd"
Print "len=" + Len(s)
Print "left=" + Left(s, 2)
Print "right=" + Right(s, 2)
Print "mid=" + Mid(s, 2, 2)
Print "lower=" + Lower(s)
Print "upper=" + Upper(s)
Print "trim=" + Trim("  hi  ")
Print "replace=" + Replace("a-b-a", "-", "+")
Print "instr=" + Instr("abcd", "bc")
Print "chr=" + Chr(65)
Print "asc=" + Asc("Z")`,

  graphics: `; 3D Cube Demo (one-shot render)
Graphics3D 800, 600, 32, 2

; Create a simple cube and render one frame.
cube = CreateCube()
PositionEntity cube, 0, 0, 5

RenderWorld
Flip

Print "Cube created successfully!"
Print "Rendered one frame to the canvas."`,

  rotatingCube: `; Rotating Cube Demo (stepped, no loops)
;
; This demo avoids blocking loops by exporting a Step function that the
; interpreter calls once per animation frame.
;
; Click Stop to end.
Global cube

Graphics3D 800, 600, 32, 2
ClsColor 26, 26, 42

cube = CreateCube()
EntityColor cube, 30, 144, 255 ; blue faces
PositionEntity cube, 0, 0, 5

Print "Rotating cube demo running (stepped)."
Print "Click Stop to end."

Function __Step%()
  TurnEntity cube, 0, 1, 0
  RenderWorld
  Flip
End Function`,

  rotatingCubeEdges: `; Rotating Cube (Blue + Edges) Demo (stepped, no loops)
;
; Builds a blue cube and a slightly scaled wireframe copy for black edges.
; Click Stop to end.
Global cube
Global edges

Graphics3D 800, 600, 32, 2
ClsColor 26, 26, 42

cube = CreateCube()
EntityColor cube, 30, 144, 255 ; blue faces
PositionEntity cube, 0, 0, 5

edges = CopyEntity(cube)
EntityColor edges, 0, 0, 0 ; black edges
EntityFX edges, 1          ; wireframe (runtime-defined)
ScaleEntity edges, 1.02, 1.02, 1.02
EntityParent edges, cube

Print "Rotating cube (blue + edges) running (stepped)."
Print "Click Stop to end."

Function __Step%()
  TurnEntity cube, 0, 1, 0
  RenderWorld
  Flip
End Function`,

  rotatingCubeColor: `; Rotating Cube + Color Cycle Demo (stepped, no loops)
;
; Tints the cube over time using EntityColor.
; Click Stop to end.
Global cube

Graphics3D 800, 600, 32, 2
ClsColor 26, 26, 42

cube = CreateCube()
PositionEntity cube, 0, 0, 5

Print "Rotating cube + color cycle demo running (stepped)."
Print "Click Stop to end."

Function __Step%()
  Local t# = MilliSecs() / 1000.0
  Local r = Abs(Sin(t * 1.2)) * 255.0
  Local g = Abs(Sin(t * 0.9 + 1.0)) * 255.0
  Local b = Abs(Sin(t * 0.7 + 2.0)) * 255.0
  EntityColor cube, r, g, b

  TurnEntity cube, 0, 1, 0
  RenderWorld
  Flip
End Function`,

  hud2D: `; 2D HUD Demo (one-shot)
Graphics 800, 600, 0
ClsColor 0, 0, 0
Cls

Color 30, 144, 255
Rect 10, 10, 260, 120, True
Color 0, 0, 0
Rect 10, 10, 260, 120, False

Color 255, 255, 255
Text 20, 20, "HUD text", False
Line 20, 50, 240, 50
Oval 20, 60, 80, 40, False

Print "Drew HUD overlay. Switch to 3D Canvas tab."`,

  inputHud: `; Input HUD Demo (stepped, no loops)
;
; Shows mouse position and last key press in the HUD.
Global lastKey%
Global lastKeyName$
Global t0

Graphics 800, 600, 0
ClsColor 0, 0, 0
Cls
Color 255, 255, 255
Print "Move the mouse and press keys. Click Stop to end."

Function __Step%()
  Local k% = GetKey()
  If k <> 0 Then
    lastKey = k
    lastKeyName = Chr(k)
  EndIf

  ; clear HUD
  Cls
  Color 255, 255, 255
  Text 16, 16, "MouseX=" + MouseX() + " MouseY=" + MouseY(), False
  Text 16, 36, "LastKey=" + lastKey + " '" + lastKeyName + "'", False
  Text 16, 56, "KeyDown(32/space)=" + KeyDown(32), False
End Function`,

  image2D: `; 2D Image Demo (stepped, no loops)
;
; Note: LoadImage is async in the browser. This demo draws once the image is ready.
Global img
Global drawn%

Graphics 800, 600, 0
ClsColor 0, 0, 0
Cls
Color 255, 255, 255
Text 16, 16, "Loading assets/badge1.jpg ... (upload via VFS)", False

img = LoadImage("assets/badge1.jpg")
If img = 0 Then
  Print "LoadImage failed (returned 0)."
Else
  MidHandle img
  Print "Image requested. Waiting for decode..."
EndIf

Function __Step%()
  If drawn = 0 Then
    Cls
    If img <> 0 And ImageLoaded(img) <> 0 Then
      DrawImage img, 400, 300
      drawn = 1
      Color 255, 255, 255
      Text 16, 16, "Drew image. Switch to 3D Canvas tab.", False
      Print "Drew image."
    Else
      Color 255, 255, 255
      Text 16, 16, "Waiting for image decode...", False
    EndIf
  EndIf
End Function`,

  imageDebug: `; Image Debug Demo (stepped, no loops)
;
; Use this to verify PNG/JPG decoding from the VFS.
; Upload an image to VFS as assets/demo.png or assets/demo.jpg.
Global img
Global shown%

Graphics 800, 600, 0
ClsColor 0, 0, 0
Cls
Color 255, 255, 255
Text 16, 16, "Upload assets/demo.png (or .jpg) in VFS, then Run.", False

img = LoadImage("assets/demo.png")
If img = 0 Then
  Print "LoadImage failed (returned 0)."
Else
  Print "Requested image load: assets/demo.png"
EndIf

Function __Step%()
  If shown <> 0 Then Return

  If img <> 0 And ImageLoaded(img) <> 0 Then
    Local w = ImageWidth(img)
    Local h = ImageHeight(img)
    MidHandle img
    Cls
    DrawImage img, 400, 300
    Color 0, 255, 0
    Rect 400 - (w/2), 300 - (h/2), w, h, False
    Color 255, 255, 255
    Text 16, 16, "Loaded: " + w + "x" + h, False
    Print "Loaded image: " + w + "x" + h
    shown = 1
  Else
    Color 255, 255, 255
    Text 16, 36, "Waiting for decode...", False
  EndIf
End Function`,

  textureCube: `; Textured Cube Demo (stepped, no loops)
Global cube
Global tex
Global loaded%

Graphics3D 800, 600, 32, 2
ClsColor 26, 26, 42
cube = CreateCube()
EntityColor cube, 255, 255, 255 ; ensure texture isn't tinted dark
PositionEntity cube, 0, 0, 5

tex = LoadTexture("assets/badge1.jpg")
Print "Loading texture..."
Print "Click Stop to end."

Function __Step%()
  If loaded = 0 And TextureLoaded(tex) <> 0 Then
    EntityTexture cube, tex
    loaded = 1
  EndIf

  ; subtle tint shift (still visible through the texture)
  Local t# = MilliSecs() / 1000.0
  Local tint = 200.0 + Abs(Sin(t * 0.6)) * 55.0
  EntityColor cube, tint, tint, 255

  TurnEntity cube, 0, 1, 0
  RenderWorld
  Flip
End Function`,

  vfsFileIO: `; VFS File I/O Demo (read lines)
;
; Upload a text file to VFS as: assets/demo.txt
; Then run this script to read it back, 1 line per frame (no blocking loops).
Global f
Global done%
Global started%

Print "Upload assets/demo.txt in the VFS panel first."
Print "Reading one line per frame..."

Function __Step%()
  If done <> 0 Then Return

  If started = 0 Then
    f = ReadFile("assets/demo.txt")
    If f = 0 Then
      Print "ReadFile failed (returned 0). Check the VFS list for assets/demo.txt."
      done = 1
      Return
    EndIf
    started = 1
    Return
  EndIf

  If Eof(f) <> 0 Then
    CloseFile f
    Print "Done."
    done = 1
    Return
  EndIf

  Print ReadLine(f)
End Function`,

  fogCube: `; Fog Demo (stepped, no loops)
Global cube

Graphics3D 800, 600, 32, 2
ClsColor 26, 26, 42
FogColor 26, 26, 42
FogMode 1
FogRange 2, 8

cube = CreateCube()
EntityColor cube, 30, 144, 255
PositionEntity cube, 0, 0, 6

Print "Fog demo running (stepped)."
Print "Click Stop to end."

Function __Step%()
  TurnEntity cube, 0, 1, 0
  RenderWorld
  Flip
End Function`,

  proceduralMesh: `; Procedural Mesh Demo (stepped, no loops)
;
; Builds a single triangle using CreateMesh/CreateSurface/AddVertex/AddTriangle.
; Then rotates it in __Step%().
Global m

Graphics3D 800, 600, 32, 2
ClsColor 26, 26, 42

m = CreateMesh()
Local s = CreateSurface(m)

v0 = AddVertex(s, -1, -1, 0, 0, 0)
v1 = AddVertex(s,  1, -1, 0, 1, 0)
v2 = AddVertex(s,  0,  1, 0, 0.5, 1)
AddTriangle s, v0, v1, v2
UpdateNormals m

EntityColor m, 30, 144, 255
PositionEntity m, 0, 0, 5

Print "Procedural mesh demo running (stepped)."
Print "Click Stop to end."

Function __Step%()
  TurnEntity m, 0, 1, 0
  RenderWorld
  Flip
End Function`,
};

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  editorEl.value = examples.hello;
  runBtnEl.disabled = true;

  // Input listeners (used by KeyDown/MouseX/etc runtime imports).
  window.addEventListener("keydown", (e) => {
    const code = e.keyCode || e.which || 0;
    if (!keyDownSet.has(code)) keyHitSet.add(code);
    keyDownSet.add(code);
    if (typeof e.key === "string" && e.key.length === 1) {
      keyQueue.push(e.key);
    } else if (code) {
      keyQueue.push(String.fromCharCode(code));
    }
  });
  window.addEventListener("keyup", (e) => {
    const code = e.keyCode || e.which || 0;
    keyDownSet.delete(code);
  });

  const updateMouseFromEvent = (e) => {
    const now = performance.now();
    const dt = Math.max(1, now - lastMouseMoveMs);
    lastMouseMoveMs = now;

    const rect = gameCanvasEl?.getBoundingClientRect?.();
    const x = rect ? (e.clientX - rect.left) : e.clientX;
    const y = rect ? (e.clientY - rect.top) : e.clientY;

    mouseXSpeed = ((x - mouseX) / dt) * 1000;
    mouseYSpeed = ((y - mouseY) / dt) * 1000;
    mouseX = x;
    mouseY = y;
  };

  window.addEventListener("mousemove", updateMouseFromEvent);
  window.addEventListener("mousedown", (e) => {
    updateMouseFromEvent(e);
    const btn = e.button | 0;
    if (!mouseDownSet.has(btn)) mouseHitSet.add(btn);
    mouseDownSet.add(btn);
  });
  window.addEventListener("mouseup", (e) => {
    updateMouseFromEvent(e);
    mouseDownSet.delete(e.button | 0);
  });
  window.addEventListener(
    "wheel",
    (e) => {
      // Blitz3D MouseZ is typically a wheel accumulator.
      mouseZ += Math.sign(e.deltaY) * 1;
    },
    { passive: true },
  );

  if (THREE && useLegacyGraphicsRuntime) {
    printOutput("legacy=1: using interpreter legacy graphics runtime.", "warning");
    initThreeJS();
  } else {
    printOutput(`Three.js v${THREE.REVISION} loaded.`, "success");
    printOutput("Using shared SCPCB runtime for graphics.", "info");
  }

  await initCompiler();
  setupEventListeners();
});

function setupEventListeners() {
  runBtnEl.addEventListener("click", runCode);

  exampleSelectEl.addEventListener("change", (e) => {
    const example = e.target.value;
    if (example && examples[example]) {
      editorEl.value = examples[example];
    }
  });

  if (vfsClearBtnEl) {
    vfsClearBtnEl.addEventListener("click", () => {
      vfsClear();
      printOutput("VFS cleared.", "info");
    });
  }

  if (vfsUploadEl) {
    vfsUploadEl.addEventListener("change", async () => {
      const files = vfsUploadEl.files ? [...vfsUploadEl.files] : [];
      if (files.length === 0) return;
      const prefixRaw = vfsPrefixEl?.value ?? "";
      const prefix = normalizeVfsPath(prefixRaw);
      for (const f of files) {
        const bytes = new Uint8Array(await f.arrayBuffer());
        const path = normalizeVfsPath(
          prefix ? `${prefix}/${f.name}` : f.name,
        );
        vfsPut(path, bytes, f.type || guessMime(path));
      }
      printOutput(`Uploaded ${files.length} file(s) to VFS.`, "success");
      // Reset input so selecting the same file again still triggers change.
      vfsUploadEl.value = "";
    });
  }
}

// --- SAFE WASM RUNNER (Worker + watchdog) ---
let runnerWorker = null;
let runnerWatchdog = null;

function stopExecution() {
  mainThreadStopRequested = true;
  sharedStopRequested = true;
  stopDemoAnimation();
  disposeSharedRuntime();
  isRunning = false;
  if (runnerWatchdog !== null) {
    clearTimeout(runnerWatchdog);
    runnerWatchdog = null;
  }
  if (runnerWorker) {
    runnerWorker.terminate();
    runnerWorker = null;
  }
  stopBtnEl.disabled = true;
  setStatus("ready", "Ready");
}

function stopDemoAnimation() {
  if (demoRAF !== null) {
    cancelAnimationFrame(demoRAF);
    demoRAF = null;
  }
}

function disposeSharedRuntime() {
  sharedStopRequested = true;
  try {
    globalThis.__BLITZ3D_URL_RESOLVER = null;
  } catch {}
  if (sharedStepRaf) {
    try {
      cancelAnimationFrame(sharedStepRaf);
    } catch {}
    sharedStepRaf = 0;
  }
  try {
    sharedGraphics?.dispose?.();
  } catch {}
  try {
    sharedFileIO?.dispose?.({ clearCache: false });
  } catch {}
  try {
    sharedCore?.dispose?.();
  } catch {}
  sharedGraphics = null;
  sharedFileIO = null;
  sharedCore = null;
  sharedInstance = null;
}

function stopRun() {
  stopExecution();
}

function stopCompile() {
  if (compileInFlight?.timeoutId) {
    clearTimeout(compileInFlight.timeoutId);
  }
  compileInFlight = null;
  if (compilerWorker) {
    compilerWorker.terminate();
    compilerWorker = null;
  }
  compilerWorkerReady = false;
}

function shouldAbortMainThreadRun() {
  if (mainThreadStopRequested) return "Stopped";
  if (mainThreadRunDeadline > 0 && Date.now() > mainThreadRunDeadline) {
    return "Timed out";
  }
  return null;
}

function makeRunnerWorker() {
  const workerCode = `
      const entryPoints = ["main", "_start", "Main", "Main_", "__main"];

      const decodeB3DString = (ptr, memory) => {
        if (!ptr) return "";
        const buf = memory.buffer;
        if (ptr < 0 || ptr + 8 > buf.byteLength) return "<invalid_str_ptr:" + ptr + ">";
        const view = new DataView(buf);
        const len = view.getInt32(ptr + 4, true);
        if (len < 0 || ptr + 8 + len > buf.byteLength) return "<invalid_str_len:" + ptr + ":" + len + ">";
        const bytes = new Uint8Array(buf, ptr + 8, len);
        return new TextDecoder().decode(bytes);
      };

      const writeStringObj = (alloc, memory, text) => {
        const utf8 = new TextEncoder().encode(text);
        const ptr = alloc(utf8.length);
        const view = new DataView(memory.buffer);
        view.setInt32(ptr + 0, 1, true); // refcount
        view.setInt32(ptr + 4, utf8.length, true); // length
        new Uint8Array(memory.buffer, ptr + 8, utf8.length).set(utf8);
        new Uint8Array(memory.buffer, ptr + 8 + utf8.length, 1)[0] = 0;
        return ptr;
      };

      const stubMissingImports = (imports, module) => {
        for (const imp of WebAssembly.Module.imports(module)) {
          if (imp.module === "blitz3d" && imports.env && (imp.name in imports.env)) {
            if (!("blitz3d" in imports)) imports.blitz3d = {};
            if (!(imp.name in imports.blitz3d)) imports.blitz3d[imp.name] = imports.env[imp.name];
          }
          if (!(imp.module in imports)) imports[imp.module] = {};
          if (imp.name in imports[imp.module]) continue;
          if (imp.kind === "function") imports[imp.module][imp.name] = () => 0;
          else if (imp.kind === "global") imports[imp.module][imp.name] = 0;
          else if (imp.kind === "table") {
            imports[imp.module][imp.name] = new WebAssembly.Table({ initial: 0, element: "anyfunc" });
          } else if (imp.kind === "memory") {
            if (!imports[imp.module].memory) imports[imp.module].memory = imports.env.memory;
          }
        }
      };

      self.onmessage = async (ev) => {
        const { wasmBytes, maxLines } = ev.data;
        const send = (msg) => self.postMessage(msg);
        let emitted = 0;

        try {
          const module = await WebAssembly.compile(wasmBytes);
          const imports = { env: {}, blitz3d: {}, al: {} };
          imports.env.memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });

          /** @type {WebAssembly.Instance | null} */
          let inst = null;

          const emit = (line) => {
            emitted++;
            if (maxLines && emitted > maxLines) {
              throw new Error("Output limit exceeded (" + maxLines + " lines).");
            }
            send({ type: "stdout", line });
          };

          const printPtr = (ptr) => {
            if (!inst) return;
            const memory = inst.exports.memory;
            emit(decodeB3DString(ptr | 0, memory));
          };

          const intToString = (val) => {
            if (!inst) return 0;
            const alloc = inst.exports.__StringAlloc;
            const memory = inst.exports.memory;
            if (typeof alloc !== "function") return 0;
            return writeStringObj(alloc, memory, String(val | 0));
          };

          const floatToString = (val) => {
            if (!inst) return 0;
            const alloc = inst.exports.__StringAlloc;
            const memory = inst.exports.memory;
            if (typeof alloc !== "function") return 0;
            return writeStringObj(alloc, memory, String(val));
          };

          for (const ns of ["env", "blitz3d"]) {
            imports[ns].Print = printPtr;
            imports[ns].PrintString = printPtr;
            imports[ns].PrintInt = (v) => emit(String(v | 0));
            imports[ns].PrintFloat = (v) => emit(String(v));
            imports[ns].IntToString = intToString;
            imports[ns].FloatToString = floatToString;
          }

          stubMissingImports(imports, module);

          // When passing a pre-compiled Module, instantiate() returns an Instance (not { module, instance }).
          inst = await WebAssembly.instantiate(module, imports);

          let ran = false;
          for (const name of entryPoints) {
            const fn = inst.exports[name];
            if (typeof fn === "function") {
              fn();
              ran = true;
              break;
            }
          }

          if (!ran) {
            const names = Object.keys(inst.exports).slice(0, 20).join(", ");
            send({ type: "warn", line: "No entry point found. Exports: " + names + (Object.keys(inst.exports).length > 20 ? "..." : "") });
          }

          send({ type: "done" });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const stack = e instanceof Error ? e.stack : "";
          send({ type: "error", message: msg, stack });
        }
      };
    `;

  const blob = new Blob([workerCode], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url, { type: "module" });
  URL.revokeObjectURL(url);
  return w;
}

async function runWasmBytesInSandbox(
  wasmBytes,
  { timeoutMs = 2000, maxLines = 2000 } = {},
) {
  stopExecution();
  stopBtnEl.disabled = false;

  setStatus(
    "running",
    `Running...${timeoutMs > 0 ? ` (${timeoutMs}ms timeout)` : ""}`,
  );

  runnerWorker = makeRunnerWorker();
  let timeoutReject = null;

  if (timeoutMs > 0) {
    runnerWatchdog = setTimeout(() => {
      const msg =
        `Execution timed out after ${timeoutMs}ms (worker terminated).`;
      if (runnerWorker) runnerWorker.terminate();
      runnerWorker = null;
      runnerWatchdog = null;
      stopBtnEl.disabled = true;
      setStatus("error", `Timed out after ${timeoutMs}ms`);
      printOutput(msg, "error");
      if (typeof timeoutReject === "function") timeoutReject(new Error(msg));
    }, timeoutMs);
  }

  await new Promise((resolve, reject) => {
    timeoutReject = reject;
    runnerWorker.onmessage = (ev) => {
      const msg = ev.data;
      if (msg.type === "stdout") {
        printOutput(msg.line, "success");
        return;
      }
      if (msg.type === "warn") {
        printOutput(msg.line, "warning");
        return;
      }
      if (msg.type === "error") {
        printOutput(`Execution error: ${msg.message}`, "error");
        stopRun();
        reject(new Error(msg.message));
        return;
      }
      if (msg.type === "done") {
        stopRun();
        resolve();
      }
    };

    runnerWorker.onerror = (e) => {
      stopRun();
      reject(new Error(e.message));
    };

    const bytes = normalizeWasmBytes(wasmBytes);
    runnerWorker.postMessage({ wasmBytes: bytes, maxLines }, [bytes]);
  });
}

// Expose for inline HTML handlers (interpreter.html uses onclick)
window.stopRun = stopRun;

function initThreeJS() {
  printOutput(`Three.js v${THREE.REVISION} loaded.`, "success");

  threeScene = new THREE.Scene();
  threeScene.background = new THREE.Color(0x1a1a2a);

  threeCamera = new THREE.PerspectiveCamera(
    75,
    1,
    0.1,
    1000,
  );
  threeCamera.position.z = 5;

  threeRenderer = new THREE.WebGLRenderer({
    canvas: gameCanvasEl,
    antialias: true,
    alpha: false,
  });
  resizeThreeToContainer();
  threeRenderer.setPixelRatio(window.devicePixelRatio);

  if (hudCanvasEl) {
    hudCtx = hudCanvasEl.getContext("2d");
    if (hudCtx) {
      hudCtx.imageSmoothingEnabled = false;
      hudCtx.font = draw2DFont;
      hudCtx.fillStyle = draw2DColor;
      hudCtx.strokeStyle = draw2DColor;
      hudCtx.textBaseline = "top";
    }
  }

  window.addEventListener("resize", () => {
    if (!threeRenderer) return;
    resizeThreeToContainer();
  });

  renderVfsList();
}

function resizeThreeToContainer() {
  if (!threeRenderer || !threeCamera || !canvasContainerEl) return;
  const width = canvasContainerEl.clientWidth;
  const height = canvasContainerEl.clientHeight;

  // If the canvas tab is hidden, clientWidth/Height can be 0. Keep the last
  // known size in that case.
  if (width < 2 || height < 2) return;

  // Keep CSS sizing (100%) and only resize the drawing buffer.
  threeRenderer.setSize(width, height, false);
  threeCamera.aspect = width / height;
  threeCamera.updateProjectionMatrix();

  if (hudCanvasEl && hudCtx) {
    const dpr = window.devicePixelRatio || 1;
    hudCanvasEl.width = Math.max(1, Math.floor(width * dpr));
    hudCanvasEl.height = Math.max(1, Math.floor(height * dpr));
    hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function applyCameraViewport() {
  if (!threeRenderer) return;
  if (!cameraViewport) {
    threeRenderer.setScissorTest(false);
    return;
  }
  threeRenderer.setScissorTest(true);
  threeRenderer.setViewport(
    cameraViewport.x,
    cameraViewport.y,
    cameraViewport.w,
    cameraViewport.h,
  );
  threeRenderer.setScissor(
    cameraViewport.x,
    cameraViewport.y,
    cameraViewport.w,
    cameraViewport.h,
  );
}

function updateFog() {
  if (!threeScene) return;
  if (fogMode === 0) {
    threeScene.fog = null;
    return;
  }
  if (fogMode === 2) {
    threeScene.fog = new THREE.FogExp2(fogColor, fogDensity);
    return;
  }
  threeScene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
}

// --- COMPILER INITIALIZATION ---
async function initCompiler() {
  console.log("initCompiler started");
  printOutput("Starting compiler initialization...", "info");
  setStatus("loading", "Loading compiler...");
  runBtnEl.disabled = true;

  try {
    stopCompile();
    compilerWorker = new Worker(
      new URL("./compiler_worker.js", import.meta.url),
      {
        type: "module",
      },
    );

    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Compiler worker init timed out"));
      }, 10_000);

      compilerWorker.onmessage = (ev) => {
        const msg = ev.data || {};
        if (msg.type === "ready") {
          clearTimeout(timeoutId);
          compilerWorkerReady = true;
          resolve();
          return;
        }
        if (msg.type === "error") {
          clearTimeout(timeoutId);
          reject(new Error(msg.message || "Compiler worker error"));
        }
      };

      compilerWorker.onerror = (e) => {
        clearTimeout(timeoutId);
        reject(new Error(e.message));
      };

      compilerWorker.postMessage({ type: "init" });
    });

    printOutput("Blitz3D compiler loaded successfully! (worker)", "success");
    setStatus("ready", "Ready");
    runBtnEl.disabled = false;
    return true;
  } catch (error) {
    const errorMsg = `Failed to load compiler: ${error.message}`;
    printOutput(errorMsg, "error");
    setStatus("error", "Compiler load failed");
    runBtnEl.disabled = true;
    console.error("Compiler load error:", error);

    const outputDiv = document.getElementById("output");
    if (outputDiv) {
      const errorDiv = document.createElement("div");
      errorDiv.className = "output-line error";
      errorDiv.style.fontWeight = "bold";
      errorDiv.textContent = errorMsg;
      outputDiv.appendChild(errorDiv);
    }
    return false;
  }
}

async function ensureCompilerReady() {
  if (compilerWorker && compilerWorkerReady) return;
  if (!compilerInitPromise) {
    compilerInitPromise = initCompiler();
    compilerInitPromise.finally(() => {
      compilerInitPromise = null;
    });
  }
  await compilerInitPromise;
  if (!compilerWorker || !compilerWorkerReady) {
    throw new Error("Compiler worker not loaded yet");
  }
}

// --- COMPILATION ---
async function compileSource(source) {
  await ensureCompilerReady();

  const id = compileReqId++;
  const timeoutMs = Math.max(250, Number(timeoutMsEl?.value ?? "2000") || 2000);

  return await new Promise((resolve, reject) => {
    if (compileInFlight) {
      reject(new Error("Compile already in progress"));
      return;
    }

    const timeoutId = setTimeout(() => {
      stopCompile();
      reject(new Error(`Compilation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    compileInFlight = { id, timeoutId };

    const onMessage = (ev) => {
      const msg = ev.data || {};
      if (msg.type !== "compile_result" || msg.id !== id) return;
      compilerWorker.removeEventListener("message", onMessage);
      clearTimeout(timeoutId);
      compileInFlight = null;

      if (!msg.ok) {
        reject(new Error(msg.error || "Compilation failed"));
        return;
      }

      const result = msg.result ||
        { success: false, error: "Empty compile result" };
      if (msg.wasmBytes) result.wasmBytes = normalizeWasmBytes(msg.wasmBytes);
      resolve(result);
    };

    compilerWorker.addEventListener("message", onMessage);
    compilerWorker.postMessage({ type: "compile", id, source });
  });
}

// --- CODE EXECUTION ---
async function runCode() {
  const source = editorEl.value.trim();

  if (!source) {
    printOutput("Please enter some code to compile.", "error");
    return;
  }

  if (isCompiling) {
    printOutput("Compilation already in progress...", "warning");
    return;
  }

  // If the user stopped compilation earlier (or the worker crashed), re-init.
  if (!compilerWorker || !compilerWorkerReady) {
    printOutput("Compiler not ready yet — reinitializing...", "warning");
    const ok = await initCompiler();
    if (!ok) return;
  }

  // Stop any prior run before compiling a new module.
  stopExecution();

  isCompiling = true;
  runBtnEl.disabled = true;
  stopBtnEl.disabled = true;
  runBtnEl.textContent = "Compiling...";
  setStatus("compiling", "Compiling...");
  clearOutput();
  printOutput("Compiling Blitz3D code...", "info");

  try {
    const result = await compileSource(source);

    if (result.success) {
      printOutput(`Compilation successful!`, "success");
      printOutput(`WASM size: ${result.size || 0} bytes`, "info");

      if (result.wasmBytes) {
        const runResult = await executeCompiledWASMBytes(
          result.wasmBytes,
          { forceMainThread: sourceLikelyNeedsGraphics(source) },
        );
        if (runResult?.startedStepping) isRunning = true;
      } else if (result.wasm) {
        await executeCompiledWASM(result.wasm);
      }
    } else {
      printOutput(`Compilation failed:`, "error");
      printOutput(result.error || "Unknown error", "error");
    }
  } catch (error) {
    printOutput(`Error: ${error.message}`, "error");
    console.error("Run code error:", error);
  } finally {
    isCompiling = false;
    runBtnEl.disabled = false;
    runBtnEl.textContent = "Run";
    if (!isRunning) setStatus("ready", "Ready");
  }
}

async function executeCompiledWASM(wasmBase64) {
  try {
    printOutput("Loading compiled module...", "info");

    const wasmBytes = base64ToBytes(wasmBase64);
    await executeCompiledWASMBytes(wasmBytes);
  } catch (error) {
    printOutput(`Execution error: ${error.message}`, "error");
    console.error("Execution error:", error);
  }
}

function sourceLikelyNeedsGraphics(source) {
  // Our WASM currently imports many graphics fns even if unused, so inspecting
  // module imports is too conservative. Use a simple source heuristic instead.
  return /\b(Graphics3D|Graphics|RenderWorld|Flip|Cls|ClsColor|Color|Rect|Oval|Line|Text|LoadFont|SetFont|StringWidth|StringHeight|LoadImage|DrawImage|DrawBlock|TileImage|LoadTexture|EntityTexture|FogMode|FogColor|FogRange|FogDensity|CreateCube|CreateSphere|CreatePlane|CreateMesh|CreateSurface|AddVertex|AddTriangle|UpdateNormals|CreateCamera|CreateLight|AmbientLight|PositionEntity|RotateEntity|TurnEntity|ScaleEntity|EntityColor|EntityAlpha|EntityBlend|EntityFX)\b/i
    .test(source);
}

async function executeCompiledWASMBytes(wasmBytes, { forceMainThread } = {}) {
  try {
    printOutput("Loading compiled module...", "info");

    const bytes = normalizeWasmBytes(wasmBytes);
    const magic = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
    if (
      magic.byteLength < 4 || magic[0] !== 0x00 || magic[1] !== 0x61 ||
      magic[2] !== 0x73 || magic[3] !== 0x6d
    ) {
      throw new Error(
        `Invalid WASM magic header: [${Array.from(magic).join(", ")}]`,
      );
    }
    const timeoutMs = Number(timeoutMsEl?.value ?? "2000") || 0;

    const needsGraphics = typeof forceMainThread === "boolean"
      ? forceMainThread
      : wasmLikelyNeedsGraphics(bytes);

    if (needsGraphics) {
      printOutput(
        "Graphics imports detected: running on main thread (Stop/timeout are best-effort).",
        "info",
      );
      const runResult = await runWasmBytesOnMainThread(bytes, { timeoutMs });
      if (runResult?.startedStepping) {
        printOutput("Execution started (stepping). Click Stop to end.", "success");
        return runResult;
      }
    } else {
      await runWasmBytesInSandbox(bytes, { timeoutMs, maxLines: 2000 });
    }
    printOutput("Execution completed.", "success");
  } catch (error) {
    printOutput(`Execution error: ${error.message}`, "error");
    console.error("Execution error:", error);
  }
  return { startedStepping: false };
}

function base64ToBytes(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

const graphicsImportNames = new Set([
  "Graphics",
  "Graphics3D",
  "Flip",
  "RenderWorld",
  "Cls",
  "ClsColor",
  "CreateCube",
  "CreateCamera",
  "CreateLight",
  "CreateSphere",
  "CreateMesh",
  "CreateSurface",
  "PositionEntity",
  "RotateEntity",
  "TurnEntity",
  "ScaleEntity",
  "EntityX",
  "EntityY",
  "EntityZ",
  "EntityColor",
]);

function wasmLikelyNeedsGraphics(wasmBytes) {
  try {
    const module = new WebAssembly.Module(normalizeWasmBytes(wasmBytes));
    for (const imp of WebAssembly.Module.imports(module)) {
      if (graphicsImportNames.has(imp.name)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function stubMissingImports(imports, module) {
  for (const imp of WebAssembly.Module.imports(module)) {
    // Prefer real implementations if they exist under env but the module requests blitz3d.
    if (imp.module === "blitz3d" && imports.env && (imp.name in imports.env)) {
      if (!("blitz3d" in imports)) imports.blitz3d = {};
      if (!(imp.name in imports.blitz3d)) {
        imports.blitz3d[imp.name] = imports.env[imp.name];
      }
    }
    if (!(imp.module in imports)) imports[imp.module] = {};
    if (imp.name in imports[imp.module]) continue;
    if (imp.kind === "function") imports[imp.module][imp.name] = () => 0;
    else if (imp.kind === "global") imports[imp.module][imp.name] = 0;
    else if (imp.kind === "table") {
      imports[imp.module][imp.name] = new WebAssembly.Table({
        initial: 0,
        element: "anyfunc",
      });
    } else if (imp.kind === "memory") {
      if (!imports[imp.module].memory) {
        imports[imp.module].memory = imports.env?.memory;
      }
    }
  }
}

let mainThreadRunDeadline = 0;
let mainThreadStopRequested = false;

async function runWasmBytesOnMainThread(wasmBytes, { timeoutMs = 2000 } = {}) {
  stopExecution();
  stopBtnEl.disabled = false;
  setStatus("running", "Running (main thread)...");

  mainThreadStopRequested = false;
  sharedStopRequested = false;

  // Ensure the canvas tab is visible before measuring sizing in core.init().
  showTab("canvas");

  // Best-effort deadline for init. In stepped mode, we disable this and treat
  // timeoutMs as a per-step budget hint.
  mainThreadRunDeadline = timeoutMs > 0 ? Date.now() + timeoutMs : 0;

  const module = new WebAssembly.Module(normalizeWasmBytes(wasmBytes));

  sharedCore = new Blitz3DCore();
  sharedCore.init("game-canvas");
  sharedGraphics = new Blitz3DGraphics(sharedCore);
  sharedFileIO = new Blitz3DFileIO(sharedCore);
  sharedFileIO.init("", null, null);
  let registerIntoRuntime = (p, data) => sharedFileIO.registerFile(p, data);
  // Keep writes performed by WASM visible in the interpreter VFS UI.
  try {
    const origRegister = sharedFileIO.registerFile.bind(sharedFileIO);
    registerIntoRuntime = origRegister;
    sharedFileIO.registerFile = (p, data) => {
      origRegister(p, data);
      try {
        vfsPut(p, data, guessMime(p));
      } catch {}
    };
  } catch {}

  // Mirror interpreter VFS into the shared runtime VFS.
  // (This enables LoadImage/LoadTexture/ReadFile for uploaded assets.)
  for (const [path, rec] of vfs.entries()) {
    try {
      registerIntoRuntime(path, rec.bytes);
    } catch (e) {
      console.warn("[interpreter] failed to register VFS file:", path, e);
    }
  }

  // Let the shared runtime resolve VFS paths (assets/foo.png) to blob: URLs.
  try {
    globalThis.__BLITZ3D_URL_RESOLVER = (p) => vfsGetObjectUrl(p) || null;
  } catch {}

  const imports = { env: {}, blitz3d: {} };
  // Ensure table import exists for indirect calls.
  imports.env.__indirect_function_table = new WebAssembly.Table({
    initial: 0,
    element: "anyfunc",
  });

  if (sharedCore.setupCommonImports) sharedCore.setupCommonImports(imports);
  if (sharedGraphics.setupImports) sharedGraphics.setupImports(imports);
  if (sharedFileIO.setupImports) sharedFileIO.setupImports(imports);

  // Route Print/DebugLog to the interpreter output pane.
  imports.env.Print = (ptr) => {
    const s = sharedCore.readString(ptr | 0);
    printOutput(s, "output");
  };
  imports.env.DebugLog = (ptr) => {
    const s = sharedCore.readString(ptr | 0);
    printOutput(`[DebugLog] ${s}`, "info");
  };

  stubMissingImports(imports, module);

  const instance = await WebAssembly.instantiate(module, imports);
  sharedInstance = instance;
  runtimeInstance = instance; // keep legacy helpers (decode/alloc) working if referenced

  // Wire memory & allocString
  sharedCore.memory = instance.exports.memory;
  sharedCore.instance = instance;
  sharedCore.module = module;
  sharedCore.exports = instance.exports;
  if (typeof instance.exports.__StringAlloc === "function" && sharedCore.memory) {
    const alloc = instance.exports.__StringAlloc;
    const mem = sharedCore.memory;
    sharedCore.allocString = (text) => {
      const utf8 = new TextEncoder().encode(String(text));
      const ptr = alloc(utf8.length) | 0;
      if (!ptr) return 0;
      const view = new DataView(mem.buffer);
      view.setInt32(ptr + 0, 1, true); // refcount
      view.setInt32(ptr + 4, utf8.length, true); // length
      new Uint8Array(mem.buffer, ptr + 8, utf8.length).set(utf8);
      new Uint8Array(mem.buffer, ptr + 8 + utf8.length, 1)[0] = 0;
      return ptr;
    };
  }
  try {
    sharedFileIO.setMemory(sharedCore.memory);
  } catch {}

  const exports = instance.exports || {};
  const step = exports.__Step || exports["__Step%"] || exports.Step ||
    exports["Step%"];

  // Prefer stepping (non-blocking) if present.
  if (typeof step === "function") {
    mainThreadRunDeadline = 0;
    isRunning = true;

    const tick = () => {
      if (mainThreadStopRequested || sharedStopRequested) {
        isRunning = false;
        return;
      }

      const started = performance.now();
      try {
        step();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if ((e && e.__blitz3dEnd) || msg === "__BLITZ3D_END__") {
          printOutput("Program ended.", "success");
          stopExecution();
          return;
        }
        printOutput(`Execution error: ${msg}`, "error");
        stopExecution();
        return;
      }

      const elapsed = performance.now() - started;
      if (timeoutMs > 0 && elapsed > timeoutMs) {
        printOutput(
          `Step exceeded budget (${Math.round(elapsed)}ms > ${timeoutMs}ms). Stopping.`,
          "error",
        );
        stopExecution();
        return;
      }

      sharedStepRaf = requestAnimationFrame(tick);
    };

    sharedStepRaf = requestAnimationFrame(tick);
    return { startedStepping: true };
  }

  // Fallback: run entrypoint directly (can freeze if user wrote a tight loop).
  const entry = exports.main || exports._start || exports.Main;
  if (typeof entry === "function") {
    try {
      entry();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if ((e && e.__blitz3dEnd) || msg === "__BLITZ3D_END__") {
        printOutput("Program ended.", "success");
        stopExecution();
        return { startedStepping: false };
      }
      printOutput(`Execution error: ${msg}`, "error");
      stopExecution();
      return { startedStepping: false };
    }
  }

  return { startedStepping: false };
}

// --- RUNTIME IMPORTS FOR COMPILED CODE ---
function createRuntimeImports() {
  const imports = {
    env: {},
    blitz3d: {},
    al: {},
  };

  const decodeB3DStringObj = (ptr) => {
    if (!ptr || !runtimeInstance?.exports?.memory) return "";
    const buf = runtimeInstance.exports.memory.buffer;
    if (ptr < 0 || ptr + 8 > buf.byteLength) return `<invalid_str_ptr:${ptr}>`;
    const view = new DataView(buf);
    const len = view.getInt32(ptr + 4, true);
    if (len < 0 || ptr + 8 + len > buf.byteLength) {
      return `<invalid_str_len:${ptr}:${len}>`;
    }
    const bytes = new Uint8Array(buf, ptr + 8, len);
    return new TextDecoder().decode(bytes);
  };

  const allocB3DStringObj = (text) => {
    const alloc = runtimeInstance?.exports?.__StringAlloc;
    const mem = runtimeInstance?.exports?.memory;
    if (typeof alloc !== "function" || !mem) return 0;
    const utf8 = new TextEncoder().encode(String(text));
    const ptr = alloc(utf8.length);
    if (!ptr) return 0;
    const view = new DataView(mem.buffer);
    view.setInt32(ptr + 0, 1, true); // refcount
    view.setInt32(ptr + 4, utf8.length, true); // length
    new Uint8Array(mem.buffer, ptr + 8, utf8.length).set(utf8);
    new Uint8Array(mem.buffer, ptr + 8 + utf8.length, 1)[0] = 0;
    return ptr;
  };

  const resolveVfsPath = (rawPath) => {
    const p0 = normalizeVfsPath(decodeB3DStringObj(rawPath | 0));
    if (!p0) return "";
    if (!vfsCwd) return p0;
    // If the path looks absolute (already rooted), keep it.
    if (p0.startsWith("/") || /^[a-z]+:\/\//i.test(p0)) return p0;
    // Treat as VFS-relative.
    return normalizeVfsPath(vfsCwd ? `${vfsCwd}/${p0}` : p0);
  };

  const vfsIsDir = (path) => {
    const p = normalizeVfsPath(path);
    if (!p) return false;
    const prefix = p.endsWith("/") ? p : `${p}/`;
    for (const k of vfs.keys()) {
      if (k.startsWith(prefix)) return true;
    }
    return false;
  };

  const vfsListDir = (path) => {
    const p = normalizeVfsPath(path);
    const prefix = p ? (p.endsWith("/") ? p : `${p}/`) : "";
    const out = new Set();
    for (const k of vfs.keys()) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      const first = rest.split("/")[0];
      if (first) out.add(first);
    }
    return [...out].sort((a, b) => a.localeCompare(b));
  };

  const readU8 = (h) => {
    const rec = fileHandles.get(h | 0);
    if (!rec || rec.mode !== "r") return null;
    if (rec.pos >= rec.bytes.length) return null;
    const v = rec.bytes[rec.pos] ?? 0;
    rec.pos += 1;
    return v;
  };

  const readU16LE = (h) => {
    const rec = fileHandles.get(h | 0);
    if (!rec || rec.mode !== "r") return null;
    if (rec.pos + 2 > rec.bytes.length) return null;
    const v = (rec.bytes[rec.pos] | (rec.bytes[rec.pos + 1] << 8)) >>> 0;
    rec.pos += 2;
    return v;
  };

  const readI32LE = (h) => {
    const rec = fileHandles.get(h | 0);
    if (!rec || rec.mode !== "r") return null;
    if (rec.pos + 4 > rec.bytes.length) return null;
    const view = new DataView(
      rec.bytes.buffer,
      rec.bytes.byteOffset,
      rec.bytes.byteLength,
    );
    const v = view.getInt32(rec.pos, true);
    rec.pos += 4;
    return v;
  };

  const readF32LE = (h) => {
    const rec = fileHandles.get(h | 0);
    if (!rec || rec.mode !== "r") return null;
    if (rec.pos + 4 > rec.bytes.length) return null;
    const view = new DataView(
      rec.bytes.buffer,
      rec.bytes.byteOffset,
      rec.bytes.byteLength,
    );
    const v = view.getFloat32(rec.pos, true);
    rec.pos += 4;
    return v;
  };

  const functions = {
    // Blitz3D strings are objects: [refcount:int32][len:int32][utf8 bytes...]
    // The compiler passes a pointer to that object for Print/PrintString.
    Print: (ptr) => printOutput(decodeB3DStringObj(ptr | 0), "success"),
    PrintInt: (val) => printOutput(String(val), "success"),
    PrintFloat: (val) => printOutput(String(val), "success"),
    PrintString: (ptr) => printOutput(decodeB3DStringObj(ptr | 0), "success"),
    // Time (milliseconds)
    MilliSecs: () => Date.now() | 0,
    MilliCSecs: () => Date.now() | 0,
    // Math/random (pure)
    Abs: (x) => Math.abs(Number(x)),
    Ceil: (x) => Math.ceil(Number(x)),
    Floor: (x) => Math.floor(Number(x)),
    Sqr: (x) => Number(x) * Number(x),
    Sqrt: (x) => Math.sqrt(Number(x)),
    Sin: (x) => Math.sin(Number(x)),
    Cos: (x) => Math.cos(Number(x)),
    Tan: (x) => Math.tan(Number(x)),
    ATan2: (y, x) => Math.atan2(Number(y), Number(x)),
    Min: (a, b) => Math.min(Number(a), Number(b)),
    Max: (a, b) => Math.max(Number(a), Number(b)),
    SeedRnd: (seed) => {
      // Blitz semantics differ; for interpreter determinism, any integer seed is fine.
      rngState = (seed | 0) || 0x12345678;
    },
    Rnd: (x = 1.0) => {
      const v = Number(x);
      if (!Number.isFinite(v)) return 0;
      if (v === 0) return randFloat01();
      if (v < 0) return -randFloat01() * Math.abs(v);
      return randFloat01() * v;
    },
    Rand: (a, b) => {
      let lo = a | 0;
      let hi = b | 0;
      if (hi < lo) [lo, hi] = [hi, lo];
      const span = (hi - lo + 1) >>> 0;
      // Avoid modulo bias for small spans is overkill here; keep it simple.
      return (lo + (randU32() % span)) | 0;
    },
    // Strings (Blitz3D string objects)
    Len: (sPtr) => decodeB3DStringObj(sPtr | 0).length | 0,
    Left: (sPtr, n) => {
      const s = decodeB3DStringObj(sPtr | 0);
      const k = Math.max(0, n | 0);
      return allocB3DStringObj(s.slice(0, k));
    },
    Right: (sPtr, n) => {
      const s = decodeB3DStringObj(sPtr | 0);
      const k = Math.max(0, n | 0);
      return allocB3DStringObj(s.slice(Math.max(0, s.length - k)));
    },
    Mid: (sPtr, start, count) => {
      const s = decodeB3DStringObj(sPtr | 0);
      // Blitz uses 1-based indexing for Mid/Instr.
      const i0 = Math.max(0, (start | 0) - 1);
      const n = count === undefined ? s.length : Math.max(0, count | 0);
      return allocB3DStringObj(s.slice(i0, i0 + n));
    },
    Lower: (sPtr) => allocB3DStringObj(decodeB3DStringObj(sPtr | 0).toLowerCase()),
    Upper: (sPtr) => allocB3DStringObj(decodeB3DStringObj(sPtr | 0).toUpperCase()),
    Trim: (sPtr) => allocB3DStringObj(decodeB3DStringObj(sPtr | 0).trim()),
    Replace: (sPtr, findPtr, replPtr) => {
      const s = decodeB3DStringObj(sPtr | 0);
      const f = decodeB3DStringObj(findPtr | 0);
      const r = decodeB3DStringObj(replPtr | 0);
      // Blitz Replace replaces all occurrences.
      return allocB3DStringObj(s.split(f).join(r));
    },
    Instr: (sPtr, subPtr) => {
      const s = decodeB3DStringObj(sPtr | 0);
      const sub = decodeB3DStringObj(subPtr | 0);
      const idx = s.indexOf(sub);
      return idx === -1 ? 0 : (idx + 1);
    },
    Chr: (code) => allocB3DStringObj(String.fromCharCode(code | 0)),
    Asc: (sPtr) => {
      const s = decodeB3DStringObj(sPtr | 0);
      return s.length ? s.charCodeAt(0) : 0;
    },
    IntToString: (val) => allocB3DStringObj(String(val | 0)),
    FloatToString: (val) => allocB3DStringObj(String(Number(val))),
    // VFS-backed file I/O (minimal Blitz3D-style)
    FileType: (pathPtr) => {
      const p = resolveVfsPath(pathPtr | 0);
      if (!p) return 0;
      if (vfsGet(p)) return 1;
      if (vfsIsDir(p)) return 2;
      return 0;
    },
    FileSize: (pathPtr) => {
      const p = resolveVfsPath(pathPtr | 0);
      const rec = p ? vfsGet(p) : null;
      return rec ? (rec.bytes.byteLength | 0) : 0;
    },
    CurrentDir: () => allocB3DStringObj(vfsCwd || ""),
    ChangeDir: (pathPtr) => {
      const p = resolveVfsPath(pathPtr | 0);
      if (!p) return 0;
      if (!vfsIsDir(p)) return 0;
      vfsCwd = normalizeVfsPath(p);
      return 1;
    },
    ReadDir: (pathPtr) => {
      const p = resolveVfsPath(pathPtr | 0);
      if (p && !vfsIsDir(p)) return 0;
      const h = nextFileHandle++;
      fileHandles.set(h, {
        mode: "dir",
        path: p,
        bytes: new Uint8Array(),
        pos: 0,
        out: [],
        dirEntries: vfsListDir(p),
        dirIndex: 0,
      });
      return h;
    },
    MoreFiles: (dirHandle) => {
      const rec = fileHandles.get(dirHandle | 0);
      if (!rec || rec.mode !== "dir") return 0;
      const i = rec.dirIndex ?? 0;
      const list = rec.dirEntries ?? [];
      return i < list.length ? 1 : 0;
    },
    NextFile: (dirHandle) => {
      const rec = fileHandles.get(dirHandle | 0);
      if (!rec || rec.mode !== "dir") return 0;
      const i = rec.dirIndex ?? 0;
      const list = rec.dirEntries ?? [];
      if (i >= list.length) return allocB3DStringObj("");
      const name = list[i];
      rec.dirIndex = i + 1;
      return allocB3DStringObj(name);
    },
    ReadFile: (pathPtr) => {
      const p = resolveVfsPath(pathPtr | 0);
      const rec = p ? vfsGet(p) : null;
      if (!rec) return 0;
      const h = nextFileHandle++;
      fileHandles.set(h, {
        mode: "r",
        path: p,
        bytes: rec.bytes,
        pos: 0,
        out: [],
      });
      return h;
    },
    OpenFile: (pathPtr) => functions.ReadFile(pathPtr | 0),
    WriteFile: (pathPtr) => {
      const p = resolveVfsPath(pathPtr | 0);
      if (!p) return 0;
      const h = nextFileHandle++;
      fileHandles.set(h, {
        mode: "w",
        path: p,
        bytes: new Uint8Array(),
        pos: 0,
        out: [],
      });
      return h;
    },
    CloseFile: (handle) => {
      const h = handle | 0;
      const rec = fileHandles.get(h);
      if (!rec) return 0;
      if (rec.mode === "w") {
        const bytes = new Uint8Array(rec.out);
        vfsPut(rec.path, bytes, guessMime(rec.path));
      }
      fileHandles.delete(h);
      return 1;
    },
    Eof: (handle) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "r") return 1;
      return rec.pos >= rec.bytes.length ? 1 : 0;
    },
    FilePos: (handle) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "r") return 0;
      return rec.pos | 0;
    },
    SeekFile: (handle, pos) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "r") return 0;
      const p = Math.max(0, Math.min(rec.bytes.length, pos | 0));
      rec.pos = p;
      return 1;
    },
    ReadByte: (handle) => {
      const v = readU8(handle | 0);
      return v === null ? 0 : (v | 0);
    },
    ReadShort: (handle) => {
      const v = readU16LE(handle | 0);
      return v === null ? 0 : ((v << 16) >> 16); // sign-extend
    },
    ReadInt: (handle) => {
      const v = readI32LE(handle | 0);
      return v === null ? 0 : (v | 0);
    },
    ReadFloat: (handle) => {
      const v = readF32LE(handle | 0);
      return v === null ? 0 : v;
    },
    ReadString: (handle) => {
      // Blitz3D WriteString/ReadString are typically length-prefixed (int32).
      const n = readI32LE(handle | 0);
      if (n === null || n <= 0) return allocB3DStringObj("");
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "r") return allocB3DStringObj("");
      if (rec.pos + n > rec.bytes.length) return allocB3DStringObj("");
      const bytes = rec.bytes.slice(rec.pos, rec.pos + n);
      rec.pos += n;
      return allocB3DStringObj(new TextDecoder().decode(bytes));
    },
    ReadLine: (handle) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "r") return allocB3DStringObj("");
      if (rec.pos >= rec.bytes.length) return allocB3DStringObj("");
      const start = rec.pos;
      let end = start;
      while (end < rec.bytes.length) {
        const c = rec.bytes[end];
        if (c === 0x0a || c === 0x0d) break;
        end++;
      }
      const lineBytes = rec.bytes.slice(start, end);
      // Consume newline(s)
      if (end < rec.bytes.length && rec.bytes[end] === 0x0d) end++;
      if (end < rec.bytes.length && rec.bytes[end] === 0x0a) end++;
      rec.pos = end;
      return allocB3DStringObj(new TextDecoder().decode(lineBytes));
    },
    WriteLine: (handle, textPtr) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "w") return 0;
      const s = decodeB3DStringObj(textPtr | 0);
      const bytes = new TextEncoder().encode(s + "\n");
      for (const b of bytes) rec.out.push(b);
      return 1;
    },
    WriteString: (handle, textPtr) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "w") return 0;
      const s = decodeB3DStringObj(textPtr | 0);
      const bytes = new TextEncoder().encode(s);
      // length-prefixed
      const len = bytes.length | 0;
      rec.out.push(len & 0xff, (len >> 8) & 0xff, (len >> 16) & 0xff, (len >> 24) & 0xff);
      for (const b of bytes) rec.out.push(b);
      return 1;
    },
    WriteByte: (handle, v) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "w") return 0;
      rec.out.push((v | 0) & 0xff);
      return 1;
    },
    WriteShort: (handle, v) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "w") return 0;
      const x = (v | 0) & 0xffff;
      rec.out.push(x & 0xff, (x >> 8) & 0xff);
      return 1;
    },
    WriteInt: (handle, v) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "w") return 0;
      const x = v | 0;
      rec.out.push(x & 0xff, (x >> 8) & 0xff, (x >> 16) & 0xff, (x >> 24) & 0xff);
      return 1;
    },
    WriteFloat: (handle, v) => {
      const rec = fileHandles.get(handle | 0);
      if (!rec || rec.mode !== "w") return 0;
      const buf = new ArrayBuffer(4);
      new DataView(buf).setFloat32(0, Number(v), true);
      const bytes = new Uint8Array(buf);
      for (const b of bytes) rec.out.push(b);
      return 1;
    },
    // Input
    KeyDown: (code) => (keyDownSet.has(code | 0) ? 1 : 0),
    KeyHit: (code) => {
      const c = code | 0;
      if (!keyHitSet.has(c)) return 0;
      keyHitSet.delete(c);
      return 1;
    },
    GetKey: () => {
      if (keyQueue.length === 0) return 0;
      const ch = keyQueue.shift();
      return ch ? ch.charCodeAt(0) : 0;
    },
    MouseX: () => mouseX | 0,
    MouseY: () => mouseY | 0,
    MouseZ: () => mouseZ | 0,
    MouseXSpeed: () => mouseXSpeed | 0,
    MouseYSpeed: () => mouseYSpeed | 0,
    MouseDown: (btn) => (mouseDownSet.has(btn | 0) ? 1 : 0),
    MouseHit: (btn) => {
      const b = btn | 0;
      if (!mouseHitSet.has(b)) return 0;
      mouseHitSet.delete(b);
      return 1;
    },
    MoveMouse: (x, y) => {
      // Browsers can't warp the system cursor. Treat this as a virtual mouse.
      mouseX = x | 0;
      mouseY = y | 0;
      mouseXSpeed = 0;
      mouseYSpeed = 0;
    },
    FlushKeys: () => {
      keyHitSet.clear();
      keyQueue.length = 0;
    },
    FlushMouse: () => {
      mouseHitSet.clear();
    },
    HidePointer: () => {
      if (canvasContainerEl) canvasContainerEl.style.cursor = "none";
    },
    ShowPointer: () => {
      if (canvasContainerEl) canvasContainerEl.style.cursor = "default";
    },
    Graphics: (width, height, depth) => {
      printOutput(`Graphics ${width}x${height}x${depth}`, "info");
      showTab("canvas");
      if (threeRenderer && threeCamera) {
        threeRenderer.setSize(width, height, false);
        threeCamera.aspect = width / height;
        threeCamera.updateProjectionMatrix();
      }
    },
    Graphics3D: (width, height, depth, mode) => {
      printOutput(
        `Graphics3D ${width}x${height}x${depth} mode ${mode}`,
        "info",
      );
      showTab("canvas");
      if (threeRenderer && threeCamera) {
        threeRenderer.setSize(width, height, false);
        threeCamera.aspect = width / height;
        threeCamera.updateProjectionMatrix();
      }
    },
    Cls: () => {
      printOutput("Clear screen", "info");
      threeScene.background = new THREE.Color(0x000000);
      threeRenderer.clear();
      if (hudCtx && hudCanvasEl) {
        hudCtx.save();
        hudCtx.setTransform(1, 0, 0, 1, 0, 0);
        hudCtx.clearRect(0, 0, hudCanvasEl.width, hudCanvasEl.height);
        hudCtx.restore();
      }
    },
    Flip: () => {
      const abortReason = shouldAbortMainThreadRun();
      if (abortReason) throw new Error(abortReason);
      applyCameraViewport();
      for (const sid of dirtySurfaceIds) ensureSurfaceGeometry(sid);
      threeRenderer.render(threeScene, threeCamera);
    },
    ClsColor: (red, green, blue) => {
      const color = new THREE.Color(red / 255, green / 255, blue / 255);
      threeScene.background = color;
    },
    Color: (red, green, blue) => {
      const r = red | 0;
      const g = green | 0;
      const b = blue | 0;
      draw2DColor = `rgb(${r},${g},${b})`;
      if (hudCtx) {
        hudCtx.fillStyle = draw2DColor;
        hudCtx.strokeStyle = draw2DColor;
      }
    },
    GetColor: () => 0,
    CreateCamera: (type = 1) => {
      if (!THREE || !threeScene) return 0;
      // Type is ignored for now; use a basic perspective camera.
      void type;
      const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      cam.position.z = 0;
      const id = nextEntityId++;
      entities.set(id, cam);
      threeCamera = cam;
      resizeThreeToContainer();
      return id;
    },
    CameraRange: (cameraId, near, far) => {
      const cam = entities.get(cameraId);
      if (!cam || !(cam instanceof THREE.PerspectiveCamera)) return 0;
      cam.near = Math.max(0.001, Number(near));
      cam.far = Math.max(cam.near + 0.001, Number(far));
      cam.updateProjectionMatrix();
      return 1;
    },
    CameraZoom: (cameraId, zoom) => {
      const cam = entities.get(cameraId);
      if (!cam || !(cam instanceof THREE.PerspectiveCamera)) return 0;
      cam.zoom = Math.max(0.01, Number(zoom));
      cam.updateProjectionMatrix();
      return 1;
    },
    CameraViewport: (_cameraId, x, y, width, height) => {
      // Interpret as pixel-space viewport on our single canvas.
      cameraViewport = {
        x: x | 0,
        y: y | 0,
        w: Math.max(1, width | 0),
        h: Math.max(1, height | 0),
      };
      applyCameraViewport();
      return 1;
    },
    CameraClsColor: (_cameraId, r, g, b) => {
      // We only have a single global clear color right now.
      const c = new THREE.Color((r | 0) / 255, (g | 0) / 255, (b | 0) / 255);
      threeScene.background = c;
      return 1;
    },
    CreateLight: (type = 1) => {
      if (!THREE || !threeScene) return 0;
      let light = null;
      const t = type | 0;
      if (t === 2) {
        light = new THREE.PointLight(0xffffff, 1.0, 0);
      } else {
        light = new THREE.DirectionalLight(0xffffff, 1.0);
        light.position.set(0, 1, 0);
      }
      const id = nextEntityId++;
      entities.set(id, light);
      threeScene.add(light);
      return id;
    },
    AmbientLight: (r, g, b) => {
      if (!THREE || !threeScene) return 0;
      const c = new THREE.Color((r | 0) / 255, (g | 0) / 255, (b | 0) / 255);
      if (!ambientLight) {
        ambientLight = new THREE.AmbientLight(c, 1.0);
        threeScene.add(ambientLight);
      } else {
        ambientLight.color.copy(c);
      }
      return 1;
    },
    LightColor: (lightId, r, g, b) => {
      const light = entities.get(lightId);
      if (!light || !light.color) return 0;
      light.color.setRGB((r | 0) / 255, (g | 0) / 255, (b | 0) / 255);
      return 1;
    },
    LightRange: (lightId, range) => {
      const light = entities.get(lightId);
      if (!light) return 0;
      // PointLight has distance; DirectionalLight ignores this.
      if (typeof light.distance === "number") {
        light.distance = Math.max(0, Number(range));
        return 1;
      }
      return 0;
    },
    FogMode: (mode) => {
      fogMode = mode | 0;
      updateFog();
      return 1;
    },
    FogColor: (r, g, b) => {
      fogColor = new THREE.Color((r | 0) / 255, (g | 0) / 255, (b | 0) / 255)
        .getHex();
      updateFog();
      return 1;
    },
    FogRange: (near, far) => {
      fogNear = Number(near);
      fogFar = Number(far);
      updateFog();
      return 1;
    },
    FogDensity: (density) => {
      fogDensity = Math.max(0, Number(density));
      updateFog();
      return 1;
    },
    // Brush/material (minimal)
    CreateBrush: () => {
      const handle = nextBrushHandle++;
      brushHandles.set(handle, {
        colorHex: 0xffffff,
        alpha: 1.0,
        blend: 1,
      });
      return handle;
    },
    BrushColor: (brush, r, g, b) => {
      const rec = brushHandles.get(brush | 0);
      if (!rec) return 0;
      rec.colorHex = new THREE.Color(
        (r | 0) / 255,
        (g | 0) / 255,
        (b | 0) / 255,
      ).getHex();
      return 1;
    },
    BrushAlpha: (brush, a) => {
      const rec = brushHandles.get(brush | 0);
      if (!rec) return 0;
      rec.alpha = Math.max(0, Math.min(1, Number(a)));
      return 1;
    },
    BrushBlend: (brush, mode) => {
      const rec = brushHandles.get(brush | 0);
      if (!rec) return 0;
      rec.blend = mode | 0;
      return 1;
    },
    FreeBrush: (brush) => {
      brushHandles.delete(brush | 0);
      return 1;
    },
    EntityAlpha: (id, a) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      const mesh = /** @type {any} */ (entity);
      const material = mesh.material;
      const mats = Array.isArray(material) ? material : [material];
      const alpha = Math.max(0, Math.min(1, Number(a)));
      for (const m of mats) {
        if (!m) continue;
        m.transparent = alpha < 1;
        m.opacity = alpha;
        m.needsUpdate = true;
      }
      return 1;
    },
    EntityBlend: (id, mode) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      const mesh = /** @type {any} */ (entity);
      const material = mesh.material;
      const mats = Array.isArray(material) ? material : [material];
      const m = mode | 0;
      let threeBlend = THREE.NormalBlending;
      if (m === 3) threeBlend = THREE.AdditiveBlending;
      if (m === 2) threeBlend = THREE.MultiplyBlending;
      for (const mat of mats) {
        if (!mat) continue;
        mat.blending = threeBlend;
        mat.needsUpdate = true;
      }
      return 1;
    },
    EntityFX: (id, flags) => {
      // Minimal subset: toggle wireframe when bit 1 is set.
      const entity = entities.get(id);
      if (!entity) return 0;
      const mesh = /** @type {any} */ (entity);
      const material = mesh.material;
      const mats = Array.isArray(material) ? material : [material];
      const f = flags | 0;
      const wire = (f & 1) !== 0;
      for (const mat of mats) {
        if (!mat) continue;
        if ("wireframe" in mat) mat.wireframe = wire;
        mat.needsUpdate = true;
      }
      return 1;
    },
    // Textures (async)
    LoadTexture: (file, _flags = 0) => {
      const path = decodeB3DStringObj(file | 0);
      if (!path) return 0;
      const handle = nextTextureHandle++;
      const rec = { tex: null, loaded: false, w: 0, h: 0 };
      textureHandles.set(handle, rec);
      const loader = new THREE.TextureLoader();
      const url = (() => {
        const v = vfsGetObjectUrl(path);
        if (v) return v;
        try {
          return new URL(path, window.location.href).toString();
        } catch {
          return path;
        }
      })();
      loader.load(
        url,
        (tex) => {
          rec.tex = tex;
          rec.loaded = true;
          rec.w = tex.image?.width | 0;
          rec.h = tex.image?.height | 0;
        },
        undefined,
        () => {
          printOutput(`LoadTexture failed: ${path}`, "error");
          textureHandles.delete(handle);
        },
      );
      return handle;
    },
    TextureLoaded: (texHandle) => {
      const rec = textureHandles.get(texHandle | 0);
      return rec?.loaded ? 1 : 0;
    },
    TextureWidth: (texHandle) => {
      const rec = textureHandles.get(texHandle | 0);
      return rec?.w ? rec.w : 0;
    },
    TextureHeight: (texHandle) => {
      const rec = textureHandles.get(texHandle | 0);
      return rec?.h ? rec.h : 0;
    },
    EntityTexture: (id, texHandle, _frame = 0, _index = 0) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      const rec = textureHandles.get(texHandle | 0);
      if (!rec || !rec.loaded || !rec.tex) return 0;
      const mesh = /** @type {any} */ (entity);
      const material = mesh.material;
      const mats = Array.isArray(material) ? material : [material];
      for (const mat of mats) {
        if (!mat) continue;
        mat.map = rec.tex;
        mat.needsUpdate = true;
      }
      return 1;
    },
    // Mesh/surface authoring (minimal)
    CreateMesh: () => {
      if (!THREE || !threeScene) return 0;
      const group = new THREE.Group();
      const id = nextEntityId++;
      entities.set(id, group);
      threeScene.add(group);
      meshSurfaces.set(id, []);
      return id;
    },
    CreateSurface: (meshId, _brush = 0) => {
      const meshEntity = entities.get(meshId | 0);
      if (!meshEntity) return 0;
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
      });
      const submesh = new THREE.Mesh(geometry, material);
      meshEntity.add(submesh);

      const surfaceId = nextSurfaceId++;
      surfaces.set(surfaceId, {
        meshId: meshId | 0,
        geometry,
        mesh: submesh,
        positions: [],
        uvs: [],
        indices: [],
        dirty: true,
      });
      const list = meshSurfaces.get(meshId | 0) || [];
      list.push(surfaceId);
      meshSurfaces.set(meshId | 0, list);
      dirtySurfaceIds.add(surfaceId);
      return surfaceId;
    },
    CountSurfaces: (meshId) => (meshSurfaces.get(meshId | 0)?.length || 0) | 0,
    GetSurface: (meshId, index) => {
      const list = meshSurfaces.get(meshId | 0);
      if (!list) return 0;
      const i = index | 0;
      if (i < 0 || i >= list.length) return 0;
      return list[i] | 0;
    },
    AddVertex: (surfaceId, x, y, z, u = 0, v = 0, _w = 1.0) => {
      const rec = surfaces.get(surfaceId | 0);
      if (!rec) return 0;
      const idx = (rec.positions.length / 3) | 0;
      rec.positions.push(Number(x), Number(y), Number(z));
      rec.uvs.push(Number(u), Number(v));
      rec.dirty = true;
      dirtySurfaceIds.add(surfaceId | 0);
      return idx;
    },
    AddVertexExtended: (
      surfaceId,
      x,
      y,
      z,
      u = 0,
      v = 0,
      r = 255,
      g = 255,
      b = 255,
      a = 255,
    ) => {
      // Ignore per-vertex color for now; map to AddVertex.
      void r;
      void g;
      void b;
      void a;
      return functions.AddVertex(surfaceId, x, y, z, u, v, 1.0);
    },
    AddTriangle: (surfaceId, v0, v1, v2) => {
      const rec = surfaces.get(surfaceId | 0);
      if (!rec) return 0;
      rec.indices.push(v0 | 0, v1 | 0, v2 | 0);
      rec.dirty = true;
      dirtySurfaceIds.add(surfaceId | 0);
      return 1;
    },
    UpdateNormals: (meshId) => {
      const list = meshSurfaces.get(meshId | 0);
      if (!list) return 0;
      for (const sid of list) {
        ensureSurfaceGeometry(sid);
        const rec = surfaces.get(sid);
        if (rec?.geometry) rec.geometry.computeVertexNormals();
      }
      return 1;
    },
    CreateCube: () => {
      if (!THREE || !threeScene) {
        printOutput("Error: 3D graphics not available", "error");
        return 0;
      }
      const geometry = new THREE.BoxGeometry(1, 1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        transparent: true,
        opacity: 1,
      });
      const cube = new THREE.Mesh(geometry, material);

      // Add black edges for clarity (nice default for demos).
      const edges = new THREE.EdgesGeometry(geometry);
      const edgeLines = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x000000 }),
      );
      cube.add(edgeLines);

      const id = nextEntityId++;
      entities.set(id, cube);
      threeScene.add(cube);
      printOutput(`Created cube (entity ${id})`, "success");
      return id;
    },
    CreateSphere: (segments = 16) => {
      if (!THREE || !threeScene) return 0;
      const seg = Math.max(3, segments | 0);
      const geometry = new THREE.SphereGeometry(0.5, seg, seg);
      const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const sphere = new THREE.Mesh(geometry, material);
      const id = nextEntityId++;
      entities.set(id, sphere);
      threeScene.add(sphere);
      return id;
    },
    CreatePlane: () => {
      if (!THREE || !threeScene) return 0;
      const geometry = new THREE.PlaneGeometry(1, 1, 1, 1);
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(geometry, material);
      const id = nextEntityId++;
      entities.set(id, plane);
      threeScene.add(plane);
      return id;
    },
    EntityColor: (id, red, green, blue) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      const color = new THREE.Color(red / 255, green / 255, blue / 255);
      const mesh = /** @type {any} */ (entity);
      const material = mesh.material;
      if (material?.color?.copy) material.color.copy(color);
      return 1;
    },
    PositionEntity: (id, x, y, z) => {
      const entity = entities.get(id);
      if (entity) {
        // Blitz3D and Three.js use opposite forward-Z conventions. Map +Z (Blitz forward)
        // to -Z (Three forward) for a more intuitive demo.
        entity.position.set(x, y, -z);
      }
    },
    ScaleEntity: (id, x, y, z, _global = 0) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      entity.scale.set(Number(x), Number(y), Number(z));
      return 1;
    },
    EntityX: (id, _global = 0) => {
      const entity = entities.get(id);
      return entity ? Number(entity.position.x) : 0;
    },
    EntityY: (id, _global = 0) => {
      const entity = entities.get(id);
      return entity ? Number(entity.position.y) : 0;
    },
    EntityZ: (id, _global = 0) => {
      const entity = entities.get(id);
      return entity ? Number(-entity.position.z) : 0;
    },
    EntityPitch: (id, _global = 0) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      return entity.rotation.x * (180 / Math.PI);
    },
    EntityYaw: (id, _global = 0) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      return entity.rotation.y * (180 / Math.PI);
    },
    EntityRoll: (id, _global = 0) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      return entity.rotation.z * (180 / Math.PI);
    },
    HideEntity: (id) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      entity.visible = false;
      return 1;
    },
    ShowEntity: (id) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      entity.visible = true;
      return 1;
    },
    EntityVisible: (id) => {
      const entity = entities.get(id);
      return entity && entity.visible ? 1 : 0;
    },
    GetParent: (id) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      const p = entity.parent;
      if (!p) return 0;
      // Find the id of the parent if it is tracked.
      for (const [eid, obj] of entities.entries()) {
        if (obj === p) return eid;
      }
      return 0;
    },
    EntityParent: (childId, parentId, _global = 0) => {
      const child = entities.get(childId);
      if (!child) return 0;
      if (parentId === 0) {
        threeScene?.add(child);
        return 1;
      }
      const parent = entities.get(parentId);
      if (!parent) return 0;
      parent.add(child);
      return 1;
    },
    FreeEntity: (id) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      if (entity === threeCamera) {
        // Keep the active camera alive; just detach from scene graph.
        if (entity.parent) entity.parent.remove(entity);
        entities.delete(id);
        return 1;
      }
      if (entity.parent) entity.parent.remove(entity);
      entities.delete(id);

      // Best-effort resource disposal for meshes.
      const disposeObj = (obj) => {
        if (obj.geometry && typeof obj.geometry.dispose === "function") {
          obj.geometry.dispose();
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            if (m?.map && typeof m.map.dispose === "function") m.map.dispose();
            if (typeof m?.dispose === "function") m.dispose();
          }
        }
      };
      disposeObj(entity);
      if (entity.children?.length) {
        for (const ch of entity.children) disposeObj(ch);
      }
      return 1;
    },
    RotateEntity: (id, pitch, yaw, roll, _global = 0) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      const toRad = Math.PI / 180;
      entity.rotation.set(pitch * toRad, yaw * toRad, roll * toRad);
      return 1;
    },
    TurnEntity: (id, pitch, yaw, roll, _global = 0) => {
      const entity = entities.get(id);
      if (!entity) return 0;
      const toRad = Math.PI / 180;
      entity.rotation.x += pitch * toRad;
      entity.rotation.y += yaw * toRad;
      entity.rotation.z += roll * toRad;
      return 1;
    },
    RenderWorld: () => {
      const abortReason = shouldAbortMainThreadRun();
      if (abortReason) throw new Error(abortReason);
      if (threeRenderer && threeScene && threeCamera) {
        applyCameraViewport();
        for (const sid of dirtySurfaceIds) ensureSurfaceGeometry(sid);
        threeRenderer.render(threeScene, threeCamera);
      }
    },
    Rect: (x, y, width, height, solid) => {
      if (!hudCtx) return 0;
      const sx = Number(x);
      const sy = Number(y);
      const w = Number(width);
      const h = Number(height);
      if (solid | 0) hudCtx.fillRect(sx, sy, w, h);
      else hudCtx.strokeRect(sx, sy, w, h);
      return 1;
    },
    Oval: (x, y, width, height, solid) => {
      if (!hudCtx) return 0;
      const cx = Number(x) + Number(width) / 2;
      const cy = Number(y) + Number(height) / 2;
      const rx = Math.abs(Number(width)) / 2;
      const ry = Math.abs(Number(height)) / 2;
      hudCtx.beginPath();
      hudCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (solid | 0) hudCtx.fill();
      else hudCtx.stroke();
      return 1;
    },
    Line: (x1, y1, x2, y2) => {
      if (!hudCtx) return 0;
      hudCtx.beginPath();
      hudCtx.moveTo(Number(x1), Number(y1));
      hudCtx.lineTo(Number(x2), Number(y2));
      hudCtx.stroke();
      return 1;
    },
    Text: (x, y, text, centered) => {
      if (!hudCtx) return 0;
      const s = decodeB3DStringObj(text | 0);
      const tx = Number(x);
      const ty = Number(y);
      if (centered | 0) {
        const w = hudCtx.measureText(s).width;
        hudCtx.fillText(s, tx - w / 2, ty);
      } else {
        hudCtx.fillText(s, tx, ty);
      }
      return 1;
    },
    StringWidth: (textPtr) => {
      if (!hudCtx) return 0;
      const s = decodeB3DStringObj(textPtr | 0);
      return hudCtx.measureText(s).width;
    },
    StringHeight: (_textPtr) => {
      if (!hudCtx) return 0;
      const metrics = hudCtx.measureText("Mg");
      const ascent = metrics.actualBoundingBoxAscent ?? 12;
      const descent = metrics.actualBoundingBoxDescent ?? 4;
      return ascent + descent;
    },
    BackBuffer: () => 1,
    FrontBuffer: () => 1,
    SetBuffer: (_buf) => 1,
    LoadFont: (font, height, bold, italic, underline) => {
      const name = decodeB3DStringObj(font | 0) || "monospace";
      const h = Math.max(6, height | 0);
      const css = [
        (italic | 0) ? "italic" : "",
        (bold | 0) ? "bold" : "",
        `${h}px`,
        name,
      ].filter(Boolean).join(" ");
      void underline;
      const handle = nextFontHandle++;
      fontHandles.set(handle, css);
      return handle;
    },
    SetFont: (fontHandle) => {
      const css = fontHandles.get(fontHandle | 0);
      if (!css) return 0;
      draw2DFont = css;
      if (hudCtx) hudCtx.font = css;
      return 1;
    },
    FreeFont: (fontHandle) => {
      fontHandles.delete(fontHandle | 0);
      return 1;
    },
    LoadImage: (file, mask, flags) => {
      void mask;
      void flags;
      const path = decodeB3DStringObj(file | 0);
      if (!path) return 0;
      const handle = nextImageHandle++;
      const rec = {
        img: new Image(),
        loaded: false,
        w: 0,
        h: 0,
        hx: 0,
        hy: 0,
      };
      imageHandles.set(handle, rec);

      rec.img.onload = () => {
        rec.loaded = true;
        rec.w = rec.img.naturalWidth | 0;
        rec.h = rec.img.naturalHeight | 0;
      };
      rec.img.onerror = () => {
        printOutput(`LoadImage failed: ${path}`, "error");
        imageHandles.delete(handle);
      };

      // Prefer interpreter VFS if present; otherwise fall back to relative URL.
      const vfsUrl = vfsGetObjectUrl(path);
      if (vfsUrl) {
        rec.img.src = vfsUrl;
      } else {
        try {
          rec.img.src = new URL(path, window.location.href).toString();
        } catch {
          rec.img.src = path;
        }
      }
      return handle;
    },
    CreateImage: (width, height, frames) => {
      void frames;
      // Create a blank offscreen image backed by a canvas.
      const w = Math.max(1, width | 0);
      const h = Math.max(1, height | 0);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const handle = nextImageHandle++;
      imageHandles.set(handle, {
        img: canvas,
        loaded: true,
        w,
        h,
        hx: 0,
        hy: 0,
      });
      return handle;
    },
    DrawImage: (image, x, y, frame) => {
      void frame;
      if (!hudCtx) return 0;
      const rec = imageHandles.get(image | 0);
      if (!rec || !rec.loaded) return 0;
      hudCtx.drawImage(
        rec.img,
        Number(x) - rec.hx,
        Number(y) - rec.hy,
      );
      return 1;
    },
    DrawImageRect: (image, x, y, frame) => {
      // Simplified: treat as DrawImage until we implement clip rect args variant.
      return functions.DrawImage(image, x, y, frame);
    },

    DrawBlock: (image, x, y, frame) => {
      return functions.DrawImage(image, x, y, frame);
    },
    TileImage: (image, x, y, frame) => {
      void frame;
      if (!hudCtx || !hudCanvasEl) return 0;
      const rec = imageHandles.get(image | 0);
      if (!rec || !rec.loaded) return 0;
      const w = rec.w || rec.img.naturalWidth || 1;
      const h = rec.h || rec.img.naturalHeight || 1;
      const startX = Number(x) - (Number(x) % w);
      const startY = Number(y) - (Number(y) % h);
      const dpr = window.devicePixelRatio || 1;
      const maxX = hudCanvasEl.width / dpr;
      const maxY = hudCanvasEl.height / dpr;
      for (let yy = startY; yy < maxY; yy += h) {
        for (let xx = startX; xx < maxX; xx += w) {
          hudCtx.drawImage(rec.img, xx, yy);
        }
      }
      return 1;
    },
    ImageWidth: (image) => {
      const rec = imageHandles.get(image | 0);
      return rec?.w ? rec.w : 0;
    },
    ImageHeight: (image) => {
      const rec = imageHandles.get(image | 0);
      return rec?.h ? rec.h : 0;
    },
    ImageLoaded: (image) => {
      const rec = imageHandles.get(image | 0);
      return rec?.loaded ? 1 : 0;
    },
    HandleImage: (image, x, y) => {
      const rec = imageHandles.get(image | 0);
      if (!rec) return 0;
      rec.hx = x | 0;
      rec.hy = y | 0;
      return 1;
    },
    MidHandle: (image) => {
      const rec = imageHandles.get(image | 0);
      if (!rec || !rec.loaded) return 0;
      rec.hx = (rec.w / 2) | 0;
      rec.hy = (rec.h / 2) | 0;
      return 1;
    },
    AutoMidHandle: () => 0,
    MaskImage: (_image, _r, _g, _b) => 1,
    ScaleImage: (_image, _x, _y) => 0,
    ResizeImage: (_image, _w, _h) => 0,
    RotateImage: (_image, _ang) => 0,
    FreeImage: (image) => {
      imageHandles.delete(image | 0);
      return 1;
    },
  };

  // Add all functions to both env and blitz3d modules
  for (const [name, func] of Object.entries(functions)) {
    imports.env[name] = func;
    imports.blitz3d[name] = func;
  }

  // Add audio stubs to al module
  Object.assign(imports.al, {
    CreateSound: () => 0,
    PlaySound: () => 0,
    StopSound: () => 0,
    LoadSound: () => 0,
    FreeSound: () => 0,
  });

  // Add memory to env
  imports.env.memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });

  return imports;
}

// --- UI HELPERS ---
function printOutput(text, type = "info") {
  const line = document.createElement("div");
  line.className = `output-line ${type}`;
  line.textContent = text;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function clearOutput() {
  outputEl.innerHTML = "";
}

function setStatus(state, text) {
  statusIndicatorEl.className = "status-indicator " + state;
  statusTextEl.textContent = text;
}

function showTab(tabName) {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
    if (tab.textContent.toLowerCase().includes(tabName)) {
      tab.classList.add("active");
    }
  });

  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  const targetTab = document.getElementById(tabName + "-tab");
  if (targetTab) {
    targetTab.classList.add("active");
  }

  if (tabName === "canvas" && threeRenderer) {
    // Ensure layout has updated before measuring container size.
    requestAnimationFrame(() => {
      resizeThreeToContainer();
      threeRenderer.render(threeScene, threeCamera);
    });
  }
}

// Expose functions to global scope for inline onclick handlers
window.showTab = showTab;
window.clearOutput = clearOutput;

console.log("Blitz3D Interpreter loaded");
