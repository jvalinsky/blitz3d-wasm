import "./runtime/globals.ts";

import { Blitz3DCore } from "./runtime/core.ts";
import { Blitz3DAudio } from "./runtime/audio.ts";
import { Blitz3DGraphics } from "./runtime/graphics/index.ts";
import { Blitz3DFileIO } from "./runtime/fileio.ts";
import { initCmdBuf } from "./shared/command_buffer.ts";
import { assertCmdBufAbi } from "./shared/cmdbuf_abi.ts";
import { EntityTableView } from "./shared/entity_table.ts";
import { BootStateMachine } from "./shared/boot_state_machine.ts";
import { stubMissingImports } from "./shared/wasm_imports.ts";

type LoaderElements = {
  overlay: HTMLElement;
  wasmBar: HTMLElement;
  wasmText: HTMLElement;
  assetsBar: HTMLElement;
  assetsText: HTMLElement;
  detail: HTMLElement;
  diagnostics: HTMLElement;
};

type LoaderUpdate = {
  section?: "wasm" | "assets";
  progress?: number;
  text?: string;
  detail?: string;
};

const BOOT_WASM_PATH = "/scpcb.wasm";
const BOOT_MANIFEST_PATH = "/scpcb_manifest.json";
const BOOT_ASSET_GROUP = "boot";
const LOADER_BUILD_ID = "2026-01-29.1";

let currentRuntime: { dispose: () => void } | null = null;
let unloadHookInstalled = false;
let currentHudCancel: (() => void) | null = null;
let currentWorker: Worker | null = null;
let currentWorkerWatchdog: number | null = null; // legacy (kept for compatibility); per-call timeouts are preferred.
let currentWorkerReady = false;
let currentWorkerUiRefresh: (() => void) | null = null;
let currentWorkerBbdbgUiRefresh: (() => void) | null = null;
let currentWorkerCallId = 1;
const currentWorkerPending = new Map<
  number,
  {
    exportName: string;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
    timeoutId: number;
  }
>();

let currentWorkerMemReqId = 1;
const currentWorkerMemPending = new Map<
  number,
  {
    resolve: (v: { addr: number; bytes: Uint8Array }) => void;
    reject: (e: unknown) => void;
    timeoutId: number;
  }
>();

let currentWorkerGlobalReqId = 1;
const currentWorkerGlobalPending = new Map<
  number,
  {
    resolve: (v: { name: string; value: number }) => void;
    reject: (e: unknown) => void;
    timeoutId: number;
  }
>();

let currentWorkerUpdateLoopCancel: (() => void) | null = null;
let currentWorkerUpdateLoopPausedReason: string | null = null;

type WorkerBbdbgSnapshot = {
  enabled: boolean;
  hasMetadata: boolean;
  exportName: string;
  location: { fileId: number; file: string; line: number } | null;
  stack: string[];
  trace: Array<{ fileId: number; file: string; line: number; depth: number }>;
  breakpointHits: Array<{ fileId: number; file: string; line: number }>;
};

type WorkerBbdbgState = {
  required: boolean;
  meta:
    | null
    | {
      ok: boolean;
      url: string;
      fileCount?: number;
      functionCount?: number;
      typeCount?: number;
      versions?: { bbdbgSchemaVersion: number; runtimeLayoutVersion: number };
      error?: string;
      files?: Array<{ id: number; path: string }>;
      functions?: Array<{
        id: number;
        name: string;
        signature: string;
        fileId: number;
        startLine: number;
        endLine: number;
      }>;
      types?: Array<{
        id: number;
        name: string;
        instanceSizeBytes: number;
        fields: Array<{
          name: string;
          offsetBytes: number;
          wasmType: string;
          declaredType: string;
          customTypeName?: string | null;
          dimensions?: number[] | null;
        }>;
      }>;
    };
  config: { enabled: boolean; traceMax: number } | null;
  lastSnapshot: WorkerBbdbgSnapshot | null;
};

const getUrlFlags = () => {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  return {
    debug: params.has("debug"),
    debugHud: params.get("debughud") === "1" || params.has("debughud"),
    worker: params.get("worker") === "1" || params.has("worker"),
    // Worker UX controls:
    // - `?allowmain=1`: show buttons that call `Main()` (can hang forever).
    // - `?autoprobe=1`: auto-run the probe sequence once the worker is ready.
    // - `?noprobes=1`: never auto-run probes (even if autoprobe is set elsewhere).
    allowMain: params.get("allowmain") === "1" || params.has("allowmain"),
    autoProbe: params.get("autoprobe") === "1" || params.has("autoprobe"),
    noProbes: params.get("noprobes") === "1" || params.has("noprobes"),
    safe: params.has("safe"),
    runMain: params.get("run") === "main",
    initMain: params.get("init") === "main",
    auto: params.get("auto") === "1",
    tickManual: params.get("tick") === "manual",
    launcher: params.get("launcher") === "1" || params.has("launcher"),
    noGL: params.get("nogl") === "1" || params.has("nogl"),
    noAssets: params.get("noassets") === "1" || params.has("noassets"),
    noAudio: params.get("noaudio") === "1" || params.has("noaudio"),
    fps: Number(params.get("fps") ?? "0") || 0,
  };
};

const terminateWorker = () => {
  if (currentWorkerUpdateLoopCancel) {
    try {
      currentWorkerUpdateLoopCancel();
    } catch { }
    currentWorkerUpdateLoopCancel = null;
  }
  currentWorkerUpdateLoopPausedReason = "terminated";
  if (currentWorkerWatchdog != null) {
    try {
      clearTimeout(currentWorkerWatchdog);
    } catch { }
    currentWorkerWatchdog = null;
  }
  const prevStatus = (window as any).__WORKER_STATUS;
  if (currentWorker) {
    try {
      currentWorker.terminate();
    } catch { }
  }
  currentWorker = null;
  // Keep last status for HUD/debugging after termination.
  (window as any).__WORKER_STATUS = prevStatus
    ? { ...prevStatus, stage: "terminated" }
    : { stage: "terminated" };
  currentWorkerReady = false;
  for (const [_id, p] of currentWorkerPending) {
    try {
      clearTimeout(p.timeoutId);
      p.reject(new Error("worker terminated"));
    } catch { }
  }
  currentWorkerPending.clear();
  for (const [_id, p] of currentWorkerMemPending) {
    try {
      clearTimeout(p.timeoutId);
      p.reject(new Error("worker terminated"));
    } catch { }
  }
  currentWorkerMemPending.clear();
  try {
    currentWorkerUiRefresh?.();
  } catch { }
  try {
    currentWorkerBbdbgUiRefresh?.();
  } catch { }
};

const formatMaybeNumber = (v: unknown) => {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return String(v);
    const iv = v | 0;
    return Math.abs(v - iv) < 1e-6 ? String(iv) : v.toFixed(4);
  }
  if (typeof v === "bigint") return `${v}n`;
  if (v == null) return "null";
  return String(v);
};

const getExportValue = (instance: WebAssembly.Instance | null, name: string) => {
  if (!instance) return undefined;
  try {
    const v: any = (instance.exports as any)[name];
    if (typeof v === "number" || typeof v === "bigint") return v;
    if (v && typeof v === "object" && "value" in v) return v.value;
  } catch { }
  return undefined;
};

const wrapHudText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) => {
  if (!text) return [""];
  // Split by spaces but fall back to hard wrapping for very long tokens.
  const words = text.split(/\s+/g);
  const lines: string[] = [];
  let line = "";
  const pushLine = (s: string) => {
    if (s) lines.push(s);
  };
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    // Current line is full; push it and start a new one.
    pushLine(line);
    line = "";
    if (ctx.measureText(w).width <= maxWidth) {
      line = w;
      continue;
    }
    // Hard wrap long token.
    let chunk = "";
    for (const ch of w) {
      const cand = chunk + ch;
      if (ctx.measureText(cand).width > maxWidth && chunk) {
        pushLine(chunk);
        chunk = ch;
      } else {
        chunk = cand;
      }
    }
    if (chunk) {
      line = chunk;
    }
  }
  pushLine(line);
  return lines.length ? lines : [text];
};

const drawDebugHud = (core: Blitz3DCore) => {
  const flags = (window as any).__BLITZ3D_FLAGS as ReturnType<
    typeof getUrlFlags
  > | undefined;
  if (!flags?.debugHud) return;

  const ctx: CanvasRenderingContext2D | null = (core as any).ctx2d ?? null;
  if (!ctx) return;
  const canvas: HTMLCanvasElement | null = (core as any).textCanvas ?? null;
  if (!canvas) return;

  // Avoid forcing layout every frame (getBoundingClientRect can be expensive in Firefox).
  // Throttle alignment updates and only apply style changes when geometry changes.
  const now = performance.now();
  const layout: any = (globalThis as any).__BLITZ3D_HUD_LAYOUT ??
    ((globalThis as any).__BLITZ3D_HUD_LAYOUT = {
      t: 0,
      left: 0,
      top: 0,
      w: 0,
      h: 0,
      dpr: 0,
    });

  // Keep HUD canvas aligned with the WebGL canvas; ensure it's visible above overlays.
  try {
    const glCanvas = core.canvas as HTMLCanvasElement | null;
    if (glCanvas && (now - (layout.t ?? 0) > 250 || layout.w === 0)) {
      const rect = glCanvas.getBoundingClientRect();
      const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      const pxW = Math.max(1, Math.floor(rect.width * dpr));
      const pxH = Math.max(1, Math.floor(rect.height * dpr));
      const left = Math.round(rect.left);
      const top = Math.round(rect.top);
      const cssW = Math.round(rect.width);
      const cssH = Math.round(rect.height);

      layout.t = now;
      if (layout.left !== left) {
        layout.left = left;
        canvas.style.left = `${left}px`;
      }
      if (layout.top !== top) {
        layout.top = top;
        canvas.style.top = `${top}px`;
      }
      if (layout.w !== cssW) {
        layout.w = cssW;
        canvas.style.width = `${cssW}px`;
      }
      if (layout.h !== cssH) {
        layout.h = cssH;
        canvas.style.height = `${cssH}px`;
      }
      if (layout.dpr !== dpr) {
        layout.dpr = dpr;
        // Force a resize of backing store on DPR changes.
        canvas.width = pxW;
        canvas.height = pxH;
      } else {
        if (canvas.width !== pxW) canvas.width = pxW;
        if (canvas.height !== pxH) canvas.height = pxH;
      }
      if (canvas.style.position !== "fixed") canvas.style.position = "fixed";
      if (canvas.style.display !== "block") canvas.style.display = "block";
      if (canvas.style.zIndex !== "100000") canvas.style.zIndex = "100000";
    }
  } catch { }

  const instance = (core as any).instance as WebAssembly.Instance | null;

  const workerStatus = (globalThis as any).__WORKER_STATUS as any;
  const lastFileReq = String(
    workerStatus?.lastFileReq ?? (globalThis as any).__SCPCB_LAST_FILE_REQ ?? "",
  );
  const initFile = String(
    workerStatus?.preload?.file ?? (globalThis as any).__SCPCB_INIT_FILE ?? "",
  );
  const preload = (workerStatus?.preload ??
    (globalThis as any).__SCPCB_ASSET_PRELOAD) as any;
  const fetchStatus = (workerStatus?.fetch ??
    (globalThis as any).__SCPCB_FETCH_STATUS) as any;
  const initStage = String(
    workerStatus?.stage ?? (globalThis as any).__SCPCB_INIT_STAGE ?? "",
  );
  const initDone = Boolean((globalThis as any).__SCPCB_INIT_DONE);

  const perf: any = core.getPerformanceStats?.() ?? {
    fps: "0.0",
    frameCount: 0,
    heapAllocations: 0,
    stringAllocations: 0,
    memoryUsage: "N/A",
  };
  const gfx: any = (core as any).graphics;

  const baseLines: string[] = [];
  baseLines.push(`Blitz3D HUD • v=${LOADER_BUILD_ID}`);
  baseLines.push(
    `initDone=${initDone} stage=${initStage || "(none)"} file=${lastFileReq ||
    "(none)"}`,
  );
  if (initFile || preload) {
    baseLines.push(
      `preload=${preload ? `${preload.loaded}/${preload.total}` : "(none)"} initFile=${initFile || "(none)"}`,
    );
  }
  if (fetchStatus?.file) {
    baseLines.push(
      `fetch=${formatMaybeNumber(fetchStatus.loaded)}/${formatMaybeNumber(fetchStatus.total)} ${String(fetchStatus.file)}`,
    );
  }
  if (workerStatus?.lastDebugLog) {
    baseLines.push(`workerLog=${String(workerStatus.lastDebugLog)}`);
  }
  if (workerStatus?.counters) {
    try {
      const c = workerStatus.counters as Record<string, number>;
      const keys = Object.keys(c).sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0)).slice(0, 6);
      if (keys.length) {
        baseLines.push(
          `workerCtr=${keys.map((k) => `${k}:${formatMaybeNumber(c[k])}`).join(" ")}`,
        );
      }
    } catch { }
  }
  baseLines.push(
    `fps=${perf.fps ?? "?"} mem=${perf.memoryUsage ?? "?"} heap=${perf.heapAllocations ?? "?"
    } str=${perf.stringAllocations ?? "?"}`,
  );
  baseLines.push(
    `entities=${gfx ? Object.keys(gfx.entities).length : "?"} render=${gfx?.renderer?.info?.render?.calls ?? "?"} draws=${gfx?.renderer?.info?.render?.triangles ?? "?"}`,
  );
  baseLines.push(
    `canvas=${core.canvas?.width ?? "?"}x${core.canvas?.height ?? "?"} overlay=${canvas.width}x${canvas.height}`,
  );
  baseLines.push(
    `three scene=${gfx?.scene ? "ok" : "missing"} camera=${gfx?.camera ? "ok" : "missing"
    } children=${gfx?.scene?.children?.length ?? "?"}`,
  );
  baseLines.push(
    `WebPort=${formatMaybeNumber(getExportValue(instance, "WebPort"))} LauncherEnabled=${formatMaybeNumber(getExportValue(instance, "LauncherEnabled"))
    } MenuOpen=${formatMaybeNumber(getExportValue(instance, "MenuOpen"))} MainMenuOpen=${formatMaybeNumber(getExportValue(instance, "MainMenuOpen"))
    }`,
  );
  baseLines.push(
    `Graphic=${formatMaybeNumber(getExportValue(instance, "GraphicWidth"))}x${formatMaybeNumber(getExportValue(instance, "GraphicHeight"))
    } Real=${formatMaybeNumber(getExportValue(instance, "RealGraphicWidth"))}x${formatMaybeNumber(getExportValue(instance, "RealGraphicHeight"))
    } MenuScale=${formatMaybeNumber(getExportValue(instance, "MenuScale"))} AR=${formatMaybeNumber(getExportValue(instance, "AspectRatioRatio"))
    }`,
  );
  baseLines.push(
    `player=${formatMaybeNumber(getExportValue(instance, "player"))} cam=${formatMaybeNumber(getExportValue(instance, "cam"))
    } Camera=${formatMaybeNumber(getExportValue(instance, "Camera"))}`,
  );

  // Keep rendering predictable even if game text draws elsewhere.
  const padding = 8;
  const lineH = 14;
  const w = Math.min(canvas.width, 1200);
  const maxTextWidth = Math.max(50, w - padding * 2);
  const lines: string[] = [];
  for (const l of baseLines) {
    lines.push(...wrapHudText(ctx, l, maxTextWidth));
  }
  const h = Math.min(canvas.height, padding * 2 + lines.length * lineH + 6);

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  ctx.fillStyle = "#e8e8e8";
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], padding, padding + (i + 1) * lineH);
  }
  ctx.restore();
};

const startDebugHudLoop = (core: Blitz3DCore) => {
  const flags = (window as any).__BLITZ3D_FLAGS as ReturnType<
    typeof getUrlFlags
  > | undefined;
  if (!flags?.debugHud) return () => { };

  let raf = 0;
  let running = true;
  const loop = () => {
    if (!running) return;
    try {
      drawDebugHud(core);
    } catch { }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    running = false;
    try {
      cancelAnimationFrame(raf);
    } catch { }
  };
};

const installOnscreenConsole = (elements: LoaderElements) => {
  try {
    elements.detail.style.whiteSpace = "pre-wrap";
    elements.detail.style.maxHeight = "40vh";
    elements.detail.style.overflow = "auto";
  } catch { }

  const lines: string[] = [];
  const max = 200;
  let raf = 0;
  let dirty = false;

  const flush = () => {
    raf = 0;
    if (!dirty) return;
    dirty = false;
    elements.detail.textContent = lines.slice(-30).join("\n");
  };

  const write = (prefix: string, args: unknown[]) => {
    const msg = args.map((a) => {
      try {
        if (typeof a === "string") return a;
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    }).join(" ");
    lines.push(`${prefix}${msg}`);
    if (lines.length > max) lines.splice(0, lines.length - max);
    // Avoid freezing the tab when many logs happen quickly (e.g. asset preload).
    // Coalesce DOM updates to at most 1 per animation frame.
    dirty = true;
    if (!raf) raf = requestAnimationFrame(flush);
  };

  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origErr = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    write("", args);
    origLog(...args as any);
  };
  console.warn = (...args: unknown[]) => {
    write("warn: ", args);
    origWarn(...args as any);
  };
  console.error = (...args: unknown[]) => {
    write("error: ", args);
    origErr(...args as any);
  };

  return () => {
    if (raf) {
      try {
        cancelAnimationFrame(raf);
      } catch { }
      raf = 0;
    }
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  };
};

const ensureControlBar = (elements: LoaderElements) => {
  const existing = document.getElementById("blitz3d-controls");
  if (existing) return existing as HTMLElement;
  const bar = document.createElement("div");
  bar.id = "blitz3d-controls";
  bar.style.position = "fixed";
  bar.style.bottom = "8px";
  bar.style.left = "8px";
  bar.style.right = "8px";
  bar.style.padding = "8px";
  bar.style.background = "rgba(0,0,0,0.7)";
  bar.style.color = "#fff";
  bar.style.font = "12px/1.4 system-ui, sans-serif";
  bar.style.zIndex = "99999";
  bar.style.display = "flex";
  bar.style.gap = "8px";
  bar.style.alignItems = "center";
  bar.style.borderRadius = "6px";
  elements.overlay.appendChild(bar);
  return bar;
};

const addButton = (bar: HTMLElement, label: string, onClick: () => void) => {
  const btn = document.createElement("button");
  btn.textContent = label;
  btn.style.padding = "6px 10px";
  btn.style.borderRadius = "6px";
  btn.style.border = "1px solid rgba(255,255,255,0.25)";
  btn.style.background = "rgba(255,255,255,0.1)";
  btn.style.color = "#fff";
  btn.style.cursor = "pointer";
  btn.onclick = () => onClick();
  bar.appendChild(btn);
  return btn;
};

const addLabel = (bar: HTMLElement, text: string) => {
  const el = document.createElement("div");
  el.textContent = text;
  el.style.opacity = "0.9";
  bar.appendChild(el);
  return el;
};

const setMutableGlobal = (
  instance: WebAssembly.Instance,
  name: string,
  value: number,
) => {
  try {
    const g = (instance.exports as any)[name];
    if (g && typeof g === "object" && "value" in g) {
      (g as WebAssembly.Global).value = value as any;
      return true;
    }
  } catch { }
  return false;
};

const getGlobalNumber = (instance: WebAssembly.Instance, name: string) => {
  try {
    const v = (instance.exports as any)[name];
    if (typeof v === "number") return v;
    if (v && typeof v === "object" && "value" in v) {
      const gv = (v as WebAssembly.Global).value as any;
      return typeof gv === "number" ? gv : Number(gv);
    }
  } catch { }
  return undefined as undefined | number;
};

const dumpScpcbScaleGlobals = (instance: WebAssembly.Instance) => {
  const names = [
    "GraphicWidth",
    "GraphicHeight",
    "RealGraphicWidth",
    "RealGraphicHeight",
    "AspectRatioRatio",
    "MenuScale",
  ];
  const obj: Record<string, number | undefined> = {};
  for (const n of names) obj[n] = getGlobalNumber(instance, n);
  console.log("[SCPCB] globals:", obj);
};

const ensureScpcbScaleGlobals = (core: Blitz3DCore, instance: WebAssembly.Instance) => {
  const cw = core.canvas?.width ?? 0;
  const ch = core.canvas?.height ?? 0;
  const gw = getGlobalNumber(instance, "GraphicWidth") ?? 0;
  const gh = getGlobalNumber(instance, "GraphicHeight") ?? 0;
  const rw = getGlobalNumber(instance, "RealGraphicWidth") ?? 0;
  const rh = getGlobalNumber(instance, "RealGraphicHeight") ?? 0;
  const ar = getGlobalNumber(instance, "AspectRatioRatio") ?? 0;

  // Only repair obviously-bad zero values. This avoids clobbering real config.
  if ((gw | 0) === 0 && cw) setMutableGlobal(instance, "GraphicWidth", cw);
  if ((gh | 0) === 0 && ch) setMutableGlobal(instance, "GraphicHeight", ch);
  if ((rw | 0) === 0 && cw) setMutableGlobal(instance, "RealGraphicWidth", cw);
  if ((rh | 0) === 0 && ch) setMutableGlobal(instance, "RealGraphicHeight", ch);
  if (!Number.isFinite(ar) || ar === 0) setMutableGlobal(instance, "AspectRatioRatio", 1.0);

  const ms = getGlobalNumber(instance, "MenuScale");
  if ((!Number.isFinite(ms) || ms === 0) && ch) {
    setMutableGlobal(instance, "MenuScale", ch / 1024.0);
  }
};

const callExport = (instance: WebAssembly.Instance, name: string) => {
  if (
    (name === "UpdateGame" || name === "UpdateMainMenu" ||
      name === "UpdateLauncher") && !(window as any).__SCPCB_INIT_DONE
  ) {
    console.warn(
      `refusing to call ${name}(): SCPCB init not run yet. Use 'Init via Main (danger)' (may hang) or provide a non-blocking init export.`,
    );
    return;
  }
  const fn = (instance.exports as any)[name];
  if (typeof fn !== "function") {
    console.warn(`Missing export function: ${name}`);
    return;
  }
  const t0 = performance.now();
  console.log(`call ${name}()...`);
  try {
    fn();
    const dt = performance.now() - t0;
    console.log(`ok ${name}() (${dt.toFixed(1)}ms)`);
  } catch (e) {
    console.error(`err ${name}():`, e);
    const msg = String((e as any)?.message ?? e);
    if (msg.includes("float unrepresentable in integer range")) {
      console.warn(
        "hint: this often means a NaN/Inf conversion to int (e.g. divide-by-zero). Dumping SCPCB scaling globals.",
      );
      dumpScpcbScaleGlobals(instance);
    }
  }
};

const getLoaderElements = (): LoaderElements => {
  const overlay = document.getElementById("loading") as HTMLElement | null;
  const wasmBar = document.getElementById("loading-bar-wasm") as
    | HTMLElement
    | null;
  const wasmText = document.getElementById("loading-text-wasm") as
    | HTMLElement
    | null;
  const assetsBar = document.getElementById("loading-bar-assets") as
    | HTMLElement
    | null;
  const assetsText = document.getElementById("loading-text-assets") as
    | HTMLElement
    | null;
  const detail = document.getElementById("loading-detail") as
    | HTMLElement
    | null;
  const diagnostics = document.getElementById("diagnostics") as
    | HTMLElement
    | null;

  if (
    !overlay || !wasmBar || !wasmText || !assetsBar || !assetsText || !detail ||
    !diagnostics
  ) {
    throw new Error("Missing loader UI elements");
  }

  return {
    overlay,
    wasmBar,
    wasmText,
    assetsBar,
    assetsText,
    detail,
    diagnostics,
  };
};

const updateLoader = (elements: LoaderElements, update: LoaderUpdate) => {
  if (update.section === "wasm") {
    if (typeof update.progress === "number") {
      const clamped = Math.max(0, Math.min(1, update.progress));
      elements.wasmBar.style.width = `${Math.round(clamped * 100)}%`;
    }
    if (update.text) elements.wasmText.textContent = update.text;
  } else if (update.section === "assets") {
    if (typeof update.progress === "number") {
      const clamped = Math.max(0, Math.min(1, update.progress));
      elements.assetsBar.style.width = `${Math.round(clamped * 100)}%`;
    }
    if (update.text) elements.assetsText.textContent = update.text;
  }

  if (update.detail) elements.detail.textContent = update.detail;
};

const formatDiagnostics = (entries: Record<string, string | number>) => {
  return Object.entries(entries)
    .map(([key, value]) => `<div><strong>${key}:</strong> ${value}</div>`)
    .join("");
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const streamFetchWithProgress = async (
  url: string,
  onProgress: (
    loaded: number,
    total: number | null,
    rate: number | null,
  ) => void,
) => {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Failed to load ${url}: ${response.status} ${response.statusText}`,
    );
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress(buffer.byteLength, buffer.byteLength, null);
    return buffer;
  }

  const contentLength = response.headers.get("Content-Length");
  const total = contentLength ? Number(contentLength) : null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;

  let lastUpdate = performance.now();
  let lastLoaded = 0;
  let start = lastUpdate;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    if (value) {
      chunks.push(value);
      loaded += value.length;

      const now = performance.now();
      const dt = now - lastUpdate;

      // Throttle updates to ~60fps (16ms) to avoid blocking UI
      // Also yield to event loop if processing takes too long
      if (dt > 32) {
        const elapsed = (now - start) / 1000;
        const rate = elapsed > 0 ? loaded / elapsed : 0;

        onProgress(loaded, total, rate);
        lastUpdate = now;
        lastLoaded = loaded;

        // Explicitly yield to let browser render
        await new Promise((r) => setTimeout(r, 0));
      }
    }
  }

  // Final update
  onProgress(loaded, total, null);

  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  return buffer.buffer;
};

const setupImports = (
  core: Blitz3DCore,
  graphics: Blitz3DGraphics,
  fileIO: Blitz3DFileIO,
  flags: ReturnType<typeof getUrlFlags>,
) => {
  const imports: any = {
    env: {
      __indirect_function_table: new WebAssembly.Table({
        initial: 0,
        element: "anyfunc",
      }),
    },
    blitz3d: {},
  };

  if (core.setupCommonImports) core.setupCommonImports(imports);
  if (graphics.setupImports) graphics.setupImports(imports);
  if (fileIO.setupImports) fileIO.setupImports(imports);

  // Ensure a few SCPCB-specific imports exist even if HMR/caching gets weird.
  // These are safe no-ops/basic stubs.
  if (!imports.env.UpdateSoundOrigin) imports.env.UpdateSoundOrigin = () => { };
  if (!imports.env.UpdateSoundOrigin2) {
    imports.env.UpdateSoundOrigin2 = () => { };
  }
  if (!imports.env.LoadEventSound) imports.env.LoadEventSound = () => 0;
  if (!imports.env.PlayAnnouncement) imports.env.PlayAnnouncement = () => { };
  if (!imports.env.KeyName) imports.env.KeyName = (_k: number) => 0;
  if (!imports.env.FlipMesh) imports.env.FlipMesh = () => { };
  if (!imports.env.MeshCullBox) imports.env.MeshCullBox = () => { };
  if (!imports.env.LightConeAngles) imports.env.LightConeAngles = () => { };

  if (flags.noAudio) {
    console.warn("noaudio=1: stubbing audio imports");
    const noop = () => { };
    const zero = () => 0;
    imports.env.FSOUND_Init = () => 1;
    imports.env.FSOUND_Close = noop;
    imports.env.LoadSound = (_p: number) => 0;
    imports.env.LoadSound_Strict = (_p: number) => 0;
    imports.env.PlaySound = (_s: number) => 0;
    imports.env.PlaySound_Strict = (_s: number) => 0;
    imports.env.FreeSound = noop;
    imports.env.ChannelPlaying = zero;
    imports.env.StopChannel = noop;
    imports.env.ChannelVolume = noop;
    imports.env.ChannelPan = noop;
    imports.env.ChannelPaused = noop;
    imports.env.PauseChannel = noop;
    imports.env.ResumeChannel = noop;
  }

  if (flags.noAssets) {
    console.warn(
      "noassets=1: stubbing heavy asset loaders (mesh/texture/image/font)",
    );
    const createImage = imports.env.CreateImage
      ? (w: number, h: number) => (imports.env.CreateImage as Function)(w, h, 1)
      : () => 0;
    const createTexture = imports.env.CreateTexture
      ? (w: number, h: number) => (imports.env.CreateTexture as Function)(w, h, 0)
      : () => 0;

    imports.env.LoadTexture = (_pathPtr: number, _flags: number) =>
      createTexture(1, 1);
    imports.env.LoadTexture_Strict = (_pathPtr: number, _flags: number) =>
      createTexture(1, 1);
    imports.env.LoadImage = (_pathPtr: number) => createImage(1, 1);
    imports.env.LoadImage_Strict = (_pathPtr: number) => createImage(1, 1);
    imports.env.LoadMesh = (_pathPtr: number, _parent: number) => 0;
    imports.env.LoadMesh_Strict = (_pathPtr: number) => 0;
    imports.env.LoadAnimMesh = (_pathPtr: number, _parent: number) => 0;
    imports.env.LoadAnimMesh_Strict = (_pathPtr: number) => 0;
    imports.env.LoadFont = (
      _namePtr: number,
      _h: number,
      _bold: number,
      _italic: number,
      _underline: number,
    ) => 0;
  }

  return imports;
};

const instantiateWasm = async (
  buffer: ArrayBuffer,
  imports: any,
  onProgress: (ratio: number, detail: string) => void,
): Promise<{ module: WebAssembly.Module; instance: WebAssembly.Instance }> => {
  onProgress(0.85, "Compiling WASM");
  // Yield before heavy compilation
  await new Promise((r) => setTimeout(r, 10));

  const wasmModule = await WebAssembly.compile(buffer);
  const callCounts: Record<string, number> = {};
  stubMissingImports(imports, wasmModule, {
    caseInsensitive: true,
    onStub: ({ module, name, kind }) => {
      if (kind === "function") {
        console.warn(`[Runtime] Stubbing missing import: ${module}.${name}`);
      } else if (kind === "memory") {
        console.warn(`[Runtime] Missing memory import: ${module}.${name}`);
      }
    },
    onCallMissingFunction: ({ key }) => {
      callCounts[key] = (callCounts[key] ?? 0) + 1;
      if (callCounts[key] === 1) {
        console.warn(`[WASM] Called missing function: ${key}`);
      }
    },
  });

  onProgress(0.95, "Instantiating WASM");
  // Yield before instantiation
  await new Promise((r) => setTimeout(r, 10));

  const instance = await WebAssembly.instantiate(wasmModule, imports);
  onProgress(1, "WASM ready");
  return { module: wasmModule, instance };
};

const attachRuntime = (
  core: Blitz3DCore,
  fileIO: Blitz3DFileIO,
  instance: WebAssembly.Instance,
) => {
  core.memory = instance.exports.memory as WebAssembly.Memory;
  core.instance = instance;
  core.exports = instance.exports;
  core.cmdBufPtr = 0;
  core.cmdBufBytes = 0;

  core.allocString = (str: string) => {
    if (instance.exports.__StringAlloc) {
      const ptr = (instance.exports.__StringAlloc as Function)(str.length);
      const view = new DataView(core.memory.buffer);
      // [refCount:i32][length:i32][bytes...][0]
      view.setInt32(ptr + 0, 1, true);
      view.setInt32(ptr + 4, str.length, true);
      const mem = new Uint8Array(core.memory.buffer, ptr + 8, str.length + 1);
      for (let i = 0; i < str.length; i++) mem[i] = str.charCodeAt(i) & 0xff;
      mem[str.length] = 0;
      return ptr;
    }
    return 0;
  };

  // Command buffer & Entity Table (Track B): allocate shared regions in WASM memory if `__StringAlloc` exists.
  assertCmdBufAbi(instance.exports);
  try {
    const stringAlloc = (instance.exports as any).__StringAlloc;
    const mem = core.memory;
    if (typeof stringAlloc === "function" && mem) {
      // 1. Command Buffer
      const cmdbBytes = 256 * 1024;
      const cmdbObj = (stringAlloc as Function)(cmdbBytes) | 0;
      if (cmdbObj) {
        const base = (cmdbObj + 8) >>> 0;
        initCmdBuf(mem.buffer, base, cmdbBytes);
        core.cmdBufPtr = base;
        core.cmdBufBytes = cmdbBytes;
        setMutableGlobal(instance, "__CmdBufPtr", base);
        setMutableGlobal(instance, "__CmdBufBytes", cmdbBytes);
        console.log(`[CMDB] allocated ptr=${base} bytes=${cmdbBytes}`);
      }

      // 2. Entity Table (Shared Transforms)
      const ENTITY_LIMIT = 8192;
      const tableBytes = ENTITY_LIMIT * 9 * 4; // 9 floats per entity, 4 bytes each
      const tableObj = (stringAlloc as Function)(tableBytes) | 0;
      if (tableObj) {
        const base = (tableObj + 8) >>> 0;
        core.entityTable = new EntityTableView(mem.buffer, base, tableBytes);
        setMutableGlobal(instance, "__EntityTablePtr", base);
        console.log(`[EntityTable] allocated ptr=${base} limit=${ENTITY_LIMIT}`);
      }
    }
  } catch (e) {
    console.warn("[ABI] shared memory allocation skipped/failed:", e);
  }

  fileIO.setMemory(core.memory);
};

const startGameLoop = (core: Blitz3DCore, instance: WebAssembly.Instance) => {
  let rafHandle = 0;
  let lastTime = performance.now();
  const updateGame = (instance.exports.UpdateGame || (instance.exports as any).__WebUpdate) as Function | undefined;

  const loop = (time: number) => {
    rafHandle = requestAnimationFrame(loop);

    const dt = (time - lastTime) / 1000;
    lastTime = time;

    try {
      // 1. Update Game Logic (WASM)
      if (updateGame) {
        updateGame(dt);
      }

      // 2. Synchronize State (CMDB -> Three.js)
      if (core.graphics && typeof (core.graphics as any).drainCommandBuffer === 'function') {
        (core.graphics as any).drainCommandBuffer();
      }

      // 3. Render Visuals (JS)
      if (core.graphics && typeof (core.graphics as any).render === 'function') {
        (core.graphics as any).render(time);
      }

    } catch (e) {
      console.error("[Loop] Error:", e);
      cancelAnimationFrame(rafHandle);
    }
  };

  rafHandle = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(rafHandle);
};

const startMain = (instance: WebAssembly.Instance, core: Blitz3DCore) => {
  if (instance.exports.UpdateGame || (instance.exports as any).__WebUpdate) {
    console.log("[main] Starting unified game loop (non-blocking)...");
    return startGameLoop(core, instance);
  }

  let raf = 0;
  if (instance.exports.Main) {
    console.log("Starting Blitz3D Main (Async)...");
    raf = requestAnimationFrame(() => {
      try {
        (instance.exports.Main as Function)();
      } catch (e) {
        if (
          (e as any)?.__blitz3dEnd || (e as any)?.message === "__BLITZ3D_END__"
        ) {
          console.log("[Blitz3D] End (non-fatal)");
          return;
        }
        console.error("Blitz3D Execution Error:", e);
      }
    });
    return () => {
      try {
        cancelAnimationFrame(raf);
      } catch { }
    };
  } else if (instance.exports._start) {
    console.log("Starting WASI _start...");
    (instance.exports._start as Function)();
    return () => { };
  } else {
    console.warn("No Main/Update found, assuming auto-start or library mode");
    return () => { };
  }
};

const runInitIfPresent = async (
  core: Blitz3DCore,
  fileIO: Blitz3DFileIO,
  instance: WebAssembly.Instance,
  loader?: LoaderElements,
  options: { forceMain?: boolean } = {},
) => {
  const mainFn = (instance.exports as any).Main;
  const flags = (window as any).__BLITZ3D_FLAGS as ReturnType<
    typeof getUrlFlags
  > | undefined;

  // Prefer a non-blocking web init export if present.
  for (const name of ["__WebInit%", "__WebInit", "WebInit", "__InitWeb%", "InitOnce"]) {
    const fn = (instance.exports as any)[name];
    if (typeof fn === "function") {
      console.log(`[Blitz3D] calling ${name}()...`);
      try {
        fn();
      } catch (e) {
        console.error(`[Blitz3D] ${name} error:`, e);
      }
      (window as any).__SCPCB_INIT_DONE = true;
      (window as any).__SCPCB_INIT_STAGE = `done:${name}`;
      ensureScpcbScaleGlobals(core, instance);

      // After a non-blocking init, we should automatically start the game loop
      // if UpdateGame/WebUpdate is present.
      if (instance.exports.UpdateGame || (instance.exports as any).__WebUpdate) {
        (window as any).__GAME_LOOP_STOP = startMain(instance, core);
      }
      return;
    }
  }

  // If a caller explicitly sets `forceMain` to false (e.g. "Init (safe)"), it must
  // override the URL flag `?init=main`.
  const shouldForceMain = (options.forceMain ?? !!flags?.initMain) === true;
  if (!shouldForceMain) {
    console.log(
      "[Blitz3D] Init (safe): not calling Main(). Use 'Init via Main (danger)' or `?init=main` when auto-running.",
    );
    // IMPORTANT: UpdateGame is not safe to call unless SCPCB's init ran.
    // Keep init flag false to prevent callers from stepping into UpdateGame with uninitialized globals.
    (window as any).__SCPCB_INIT_DONE = false;
    (window as any).__SCPCB_INIT_STAGE = "done:safe-skip-main";
    ensureScpcbScaleGlobals(core, instance);
    return;
  }

  if (typeof mainFn !== "function") return;
  // Web build: opt into SCPCB's web short-circuit paths when present.
  // Some builds gate non-blocking behavior behind a `WebPort` global.
  setMutableGlobal(instance, "WebPort", 1);
  // SCPCB's launcher is an interactive UI loop that will block the thread.
  // Disable it by default for the web port. Opt-in via `?launcher=1`.
  if (!flags?.launcher) {
    setMutableGlobal(instance, "LauncherEnabled", 0);
  }
  // SCPCB's init shows a "PRESS ANY KEY" loading screen at 100% (tight loop).
  // WASM runs synchronously, so the JS event loop can't deliver new input while inside the loop.
  // Prime a synthetic key + mouse hit so those loops can exit immediately.
  // Note: SCPCB doesn't import Blitz3D `GetKey` here; it polls `KeyHit`/`MouseHit`,
  // so we seed those maps directly.
  try {
    const g: any = (core as any).graphics;
    if (g) {
      g.keyQueue = g.keyQueue ?? [];
      // GetKey/WaitKey (ASCII-ish)
      g.keyQueue.push(13); // Enter
      g.keyQueue.push(32); // Space
      g.keysHit = g.keysHit ?? {};
      // KeyHit/KeyDown (Blitz3D/DIK scan codes + common DOM keyCode fallbacks)
      // Enter: DIK_RETURN=28, DOM Enter=13
      g.keysHit[28] = (g.keysHit[28] ?? 0) + 1;
      g.keysHit[13] = (g.keysHit[13] ?? 0) + 1;
      // Space: DIK_SPACE=57, DOM Space=32
      g.keysHit[57] = (g.keysHit[57] ?? 0) + 1;
      g.keysHit[32] = (g.keysHit[32] ?? 0) + 1;
      g.keysDown = g.keysDown ?? {};
      g.keysDown[28] = true;
      g.keysDown[13] = true;
      g.keysDown[57] = true;
      g.keysDown[32] = true;
      g.mouseHit = g.mouseHit ?? {};
      g.mouseHit[1] = (g.mouseHit[1] ?? 0) + 1;
      g.mouseDown = g.mouseDown ?? {};
      g.mouseDown[1] = true;
    }
  } catch { }
  // Guard against divide-by-zero traps if options/config didn't load.
  ensureScpcbScaleGlobals(core, instance);

  // IMPORTANT: SCPCB init expects synchronous file IO. In the web runtime, missing files
  // trigger async fetch-and-register and return 0, which can cause tight loops/hangs in BB code.
  // For init via Main, preload *minimal* init data up-front to avoid that mismatch.
  try {
    (window as any).__SCPCB_INIT_STAGE = "preload:init";
    const group =
      fileIO.assetManifest?.groups && (fileIO.assetManifest.groups as any).init
        ? "init"
        : "facility_assets";
    console.log(`[Blitz3D] Preloading ${group} assets before Main()...`);
    let last = 0;
    let lastFile = "";
    let lastLog = 0;
    await fileIO.preloadAssetGroup(group, {
      concurrency: 4,
      onProgress: (loaded: number, total: number | null, file?: string) => {
        const now = performance.now();
        if (now - last < 50 && loaded !== total) return;
        last = now;
        if (loader && total) {
          updateLoader(loader, {
            section: "assets",
            text: "Preloading (init)",
            progress: loaded / total,
            detail: file ?? "",
          });
        }
        // Avoid spamming logs during init; keep a periodic marker instead.
        const f = file ?? "";
        if (loaded === total || now - lastLog > 750 || f !== lastFile) {
          lastLog = now;
          lastFile = f;
          console.log(`[assets:init] ${loaded}/${total ?? "?"} ${f}`);
        }
      },
    });
    console.log("[Blitz3D] init asset preload done");
  } catch (e) {
    console.warn("[Blitz3D] init asset preload failed (continuing):", e);
  }

  try {
    (window as any).__SCPCB_INIT_STAGE = "call:Main";
    if (loader) {
      updateLoader(loader, {
        section: "wasm",
        text: "Init (Main)",
        progress: 1,
        detail: "Calling Main() once (may freeze if init is not resumable)",
      });
    }
  } catch { }

  // Yield once so loader/logs can paint before calling into potentially heavy WASM init.
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  } catch { }

  try {
    mainFn();
  } catch (e) {
    if ((e as any)?.__blitz3dEnd || (e as any)?.message === "__BLITZ3D_END__") {
      console.log("[Blitz3D] Init ended via End (expected)");
      (window as any).__SCPCB_INIT_DONE = true;
      (window as any).__SCPCB_INIT_STAGE = "done:End";
      ensureScpcbScaleGlobals(core, instance);
      return;
    }
    console.error("[Blitz3D] Init error:", e);
  }
  (window as any).__SCPCB_INIT_DONE = true;
  (window as any).__SCPCB_INIT_STAGE = "done:return";
  ensureScpcbScaleGlobals(core, instance);
};

const startUpdateLoop = (core: Blitz3DCore) => {
  if (!core.exports || typeof core.exports.UpdateGame !== "function") {
    console.warn("No UpdateGame export found; skipping tick loop");
    return () => { };
  }

  let raf = 0;
  let running = true;
  let lastTickMs = 0;
  let longTickCount = 0;
  const longTickLimitMs = 50;
  const maxConsecutiveLongTicks = 3;
  const tick = () => {
    if (!running) return;
    // Never call UpdateGame until init completed; otherwise SCPCB will run with uninitialized globals
    // and may hang the tab in a tight loop.
    if (!(window as any).__SCPCB_INIT_DONE) {
      raf = requestAnimationFrame(tick);
      return;
    }
    try {
      const t0 = performance.now();
      (core.exports.UpdateGame as Function)();
      lastTickMs = performance.now() - t0;
      if (lastTickMs > longTickLimitMs) {
        longTickCount++;
        console.warn(
          `warn: long UpdateGame tick ${lastTickMs.toFixed(1)
          }ms (${longTickCount}/${maxConsecutiveLongTicks})`,
        );
        if (longTickCount >= maxConsecutiveLongTicks) {
          running = false;
          console.error(
            `FAIL-SAFE: paused UpdateGame after ${maxConsecutiveLongTicks} long ticks (> ${longTickLimitMs}ms).`,
          );
          return;
        }
      } else {
        longTickCount = 0;
      }
    } catch (e) {
      console.error("UpdateGame error:", e);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    running = false;
    try {
      cancelAnimationFrame(raf);
    } catch { }
  };
};

const startRenderLoop = (core: Blitz3DCore) => {
  let raf = 0;
  let running = true;
  const loop = () => {
    if (!running) return;
    try {
      core.graphics?.drainCommandBuffer?.();
    } catch { }
    core.beginFrame();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    running = false;
    try {
      cancelAnimationFrame(raf);
    } catch { }
  };
};

async function init() {
  if (currentRuntime) {
    try {
      currentRuntime.dispose();
    } catch { }
    currentRuntime = null;
  }
  if (currentHudCancel) {
    try {
      currentHudCancel();
    } catch { }
    currentHudCancel = null;
  }
  if (currentWorker) {
    terminateWorker();
  }

  const loader = getLoaderElements();
  const flags = getUrlFlags();
  (window as any).__BLITZ3D_DEBUG = flags.debug;
  (window as any).__BLITZ3D_FLAGS = flags;
  const boot = new BootStateMachine({
    nowMs: () => performance.now(),
    noProgressMs: 12_000,
  });
  (window as any).__BOOT = boot;
  let bootWatchdogId: number | null = null;
  const stopBootWatchdog = () => {
    if (bootWatchdogId == null) return;
    try {
      clearInterval(bootWatchdogId);
    } catch { }
    bootWatchdogId = null;
  };
  const startBootWatchdog = () => {
    stopBootWatchdog();
    bootWatchdogId = setInterval(() => {
      const stall = boot.checkNoProgress();
      if (!stall) return;
      const snap = boot.getSnapshot();
      const msg =
        `No progress for ${(stall.msSinceProgress / 1000).toFixed(1)}s ` +
        `(phase=${snap.phase}, stage=${snap.message || "?"})`;
      console.warn("[boot]", msg);
      try {
        updateLoader(loader, { detail: msg });
      } catch { }
    }, 250) as unknown as number;
  };
  console.log(`[Blitz3D] loader build ${LOADER_BUILD_ID}`, flags);
  const uninstallOnscreen = flags.debug
    ? installOnscreenConsole(loader)
    : () => { };
  updateLoader(loader, {
    section: "wasm",
    text: "Initializing...",
    progress: 0.1,
  });

  const core = new Blitz3DCore();
  core.init("canvas");
  // HUD should work even in paused/manual mode (before starting any WASM entrypoints).
  currentHudCancel = startDebugHudLoop(core);

  const graphics = new Blitz3DGraphics(core);
  const fileIO = new Blitz3DFileIO(core);
  // SCPCB init expects synchronous file IO; enable best-effort sync on-demand loads when opting into `?init=main`.
  (fileIO as any).syncFetchEnabled = !!flags.initMain;

  core.graphics = graphics;
  core.fileIO = fileIO;
  if (!flags.noAudio) {
    graphics.audioSystem = new Blitz3DAudio(core);
  }

  // WebGL can crash/hang the tab in some driver states. Allow disabling it.
  if (!flags.noGL && !flags.safe) {
    graphics.init3D();
    console.log(
      "Graphics init3D done. Scene:",
      graphics.scene ? "ok" : "missing",
    );
  } else {
    console.warn("Graphics init3D skipped (nogl/safe)");
  }

  try {
    updateLoader(loader, {
      section: "wasm",
      text: "Connecting...",
      progress: 0.1,
    });
    boot.setPhase("LOAD_WASM", "connecting");
    startBootWatchdog();

    const diagnosticsState: Record<string, string | number> = {
      "WASM": "starting",
      "Assets": "pending",
      "Downloads": 0,
    };

    let bootPreload: Promise<unknown> | null = null;

    // Parallelize WASM fetch and Manifest fetch
    const wasmPromise = streamFetchWithProgress(
      BOOT_WASM_PATH,
      (loaded, total, rate) => {
        const ratio = total ? loaded / total : 0;
        const sizeLabel = total
          ? `${formatBytes(loaded)} / ${formatBytes(total)}`
          : formatBytes(loaded);
        const rateLabel = rate ? `${formatBytes(rate)}/s` : "";
        diagnosticsState.WASM = rateLabel
          ? `${sizeLabel} (${rateLabel})`
          : sizeLabel;
        loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
        boot.setProgress("wasm", loaded, total, rateLabel || sizeLabel);
        updateLoader(loader, {
          section: "wasm",
          text: "Downloading",
          progress: ratio,
          detail: rateLabel ? `${sizeLabel} • ${rateLabel}` : sizeLabel,
        });
      },
    );

    const manifestPromise = fileIO.loadAssetManifest(BOOT_MANIFEST_PATH).then(
      (success: boolean) => {
        boot.setPhase("LOAD_MANIFEST", success ? "loaded" : "failed");
        if (success) {
          console.log("Manifest loaded early");
          // Start preloading BOOT assets as soon as manifest is ready.
          // NOTE: Some SCPCB globals are computed at WASM module init time from `options.ini`,
          // so we must ensure boot assets are actually registered before instantiation.
          diagnosticsState.Assets = "streaming";
          boot.setPhase("PRELOAD_BOOT", BOOT_ASSET_GROUP);

          // Initialize asset streaming in background
          let lastUpdate = 0;
          bootPreload = fileIO.preloadAssetGroup(BOOT_ASSET_GROUP, {
            concurrency: 4,
            onProgress: (loaded: number, total: number | null, file?: string) => {
              const now = performance.now();
              if (now - lastUpdate > 32 || loaded === total) {
                const ratio = total ? loaded / total : 0;
                diagnosticsState.Assets = `${loaded}/${total ?? "?"}`;
                diagnosticsState.Downloads = Math.max(
                  diagnosticsState.Downloads as number,
                  loaded,
                );
                loader.diagnostics.innerHTML = formatDiagnostics(
                  diagnosticsState,
                );

                boot.setProgress(
                  "assets",
                  loaded,
                  total ?? null,
                  file ?? "",
                );
                updateLoader(loader, {
                  section: "assets",
                  text: "Streaming",
                  progress: ratio,
                  detail: file ?? "",
                });
                lastUpdate = now;
              }
            },
          });

          bootPreload?.catch((err: unknown) => {
            console.error("Boot asset preload failed:", err);
            diagnosticsState.Assets = "error";
            loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
          });
        }
        return success;
      },
    );

    const [buffer, manifestLoaded] = await Promise.all([
      wasmPromise,
      manifestPromise,
    ]);

    // If boot preload was started, ensure it finished before instantiating WASM.
    if (bootPreload) {
      await bootPreload;
    }

    updateLoader(loader, { section: "wasm", text: "Imports...", progress: 1 });
    boot.setPhase("INSTANTIATE_WASM", "imports");
    const imports = setupImports(core, graphics, fileIO, flags);

    const { module, instance } = await instantiateWasm(
      buffer as ArrayBuffer,
      imports,
      (ratio, detail) => {
        boot.setProgress("wasm", Math.round(ratio * 1000), 1000, detail);
        updateLoader(loader, {
          section: "wasm",
          text: detail,
          progress: ratio,
        });
      },
    );

    boot.setPhase("ATTACH_RUNTIME", "attach");
    attachRuntime(core, fileIO, instance);

    // Call the non-blocking Init variants and start the loop if possible.
    boot.setPhase("INIT", "calling web init");
    await runInitIfPresent(core, fileIO, instance, loader);

    boot.setPhase("READY", "wasm ready");
    stopBootWatchdog();

    // Default auto-running if ?auto=1 or no Main/Update found
    const exportsList = WebAssembly.Module.exports(module).map((e) => e.name);
    const hasUpdateGame = exportsList.includes("UpdateGame") || exportsList.includes("__WebUpdate");
    const hasMain = exportsList.includes("Main");

    if (!(window as any).__GAME_LOOP_STOP && (hasUpdateGame || hasMain)) {
      if (flags.auto || !hasMain) {
        boot.setPhase("RUNNING", "auto-starting");
        (window as any).__GAME_LOOP_STOP = startMain(instance, core);
      }
    }
    // In `?worker=1` mode, keep the main thread paused to avoid freezes.
    const shouldAutoRun = flags.auto && !flags.safe && !flags.worker;
    if (!shouldAutoRun) {
      try {
        boot.setPhase("PAUSED", "no auto-run");
        stopBootWatchdog();
      } catch { }
      updateLoader(loader, {
        section: "wasm",
        text: "Paused (no auto-run)",
        progress: 1,
        detail: `Exports: ${exportsList.slice(0, 80).join(", ")}${exportsList.length > 80 ? ", ..." : ""
          }`,
      });
      loader.overlay.style.display = "block";

      const bar = ensureControlBar(loader);
      bar.innerHTML = "";
      addLabel(
        bar,
        `${flags.worker ? "worker-ui • " : ""}paused • v=${LOADER_BUILD_ID} • add ?auto=1 to run • add ?tick=manual to step • exports: ${hasUpdateGame ? "UpdateGame" : ""
        }${hasMain ? " Main" : ""}`,
      );
      if (flags.worker && !flags.allowMain) {
        addLabel(
          bar,
          "worker: dangerous Main() buttons hidden (add ?allowmain=1 to show)",
        );
      }

      const groupForInit = (fileIO.assetManifest?.groups as any)?.init
        ? "init"
        : "facility_assets";

      const workerDangerEnabled = !!(flags.worker && flags.allowMain);
      const workerAutoProbeEnabled = !!(
        flags.worker && !flags.noProbes && (flags.autoProbe || !flags.allowMain)
      );
      let workerAutoProbePending = workerAutoProbeEnabled;

      const guardedButtons: Array<{
        btn: HTMLButtonElement;
        requiresWorkerReady?: boolean;
        requiresWorkerIdle?: boolean;
      }> = [];
      let workerRunUpdateBtn: HTMLButtonElement | null = null;
      let workerStopUpdateBtn: HTMLButtonElement | null = null;

      const setButtonEnabled = (btn: HTMLButtonElement, enabled: boolean) => {
        btn.disabled = !enabled;
        btn.style.opacity = enabled ? "1" : "0.45";
        btn.style.cursor = enabled ? "pointer" : "not-allowed";
      };

      const refreshWorkerButtons = () => {
        const busy = currentWorkerPending.size > 0;
        const ready = currentWorkerReady;
        for (const b of guardedButtons) {
          const okReady = !b.requiresWorkerReady || ready;
          const okIdle = !b.requiresWorkerIdle || !busy;
          setButtonEnabled(b.btn, okReady && okIdle);
        }
        if (workerRunUpdateBtn) {
          const enabled = ready && !busy && !currentWorkerUpdateLoopCancel;
          setButtonEnabled(workerRunUpdateBtn, enabled);
        }
        if (workerStopUpdateBtn) {
          const enabled = ready && !!currentWorkerUpdateLoopCancel;
          setButtonEnabled(workerStopUpdateBtn, enabled);
        }
      };
      currentWorkerUiRefresh = refreshWorkerButtons;

      const addGuardedButton = (
        label: string,
        onClick: () => void,
        guards: { requiresWorkerReady?: boolean; requiresWorkerIdle?: boolean } = {},
      ) => {
        const btn = addButton(bar, label, onClick) as HTMLButtonElement;
        guardedButtons.push({ btn, ...guards });
        refreshWorkerButtons();
        return btn;
      };

      const ensureWorker = () => {
        if (currentWorker) return currentWorker;
        const w = new Worker(new URL("./worker/scpcb_worker.ts", import.meta.url), {
          type: "module",
        });
        currentWorker = w;
        currentWorkerReady = false;
        (window as any).__WORKER_STATUS = { stage: "starting" };
        (window as any).__WORKER_EXPORTS = [];
        (window as any).__WORKER_BBDBG = {
          required: false,
          meta: null,
          config: null,
          lastSnapshot: null,
        } satisfies WorkerBbdbgState;
        w.onmessage = (ev: MessageEvent<any>) => {
          const m = ev.data;
          if (m?.type === "status") {
            (window as any).__WORKER_STATUS = m.status;
          } else if (m?.type === "log") {
            console.log(`[worker] ${m.message}`);
          } else if (m?.type === "exports") {
            (window as any).__WORKER_EXPORTS = Array.isArray(m.exports) ? m.exports : [];
            try {
              const n = (window as any).__WORKER_EXPORTS.length;
              console.log(`[worker] exports: ${n}`);
            } catch { }
          } else if (m?.type === "bbdbgRequired") {
            const st = ((window as any).__WORKER_BBDBG ?? {}) as WorkerBbdbgState;
            st.required = !!m.required;
            (window as any).__WORKER_BBDBG = st;
            try {
              currentWorkerBbdbgUiRefresh?.();
            } catch { }
          } else if (m?.type === "bbdbgMeta") {
            const st = ((window as any).__WORKER_BBDBG ?? {}) as WorkerBbdbgState;
            const files = Array.isArray(m.files)
              ? (m.files as Array<any>).map((f) => ({
                id: Number(f?.id ?? 0) | 0,
                path: String(f?.path ?? ""),
              })).filter((f) => f.id > 0 && !!f.path)
              : undefined;
            const functions = Array.isArray(m.functions)
              ? (m.functions as Array<any>).map((fn) => ({
                id: Number(fn?.id ?? 0) | 0,
                name: String(fn?.name ?? ""),
                signature: String(fn?.signature ?? ""),
                fileId: Number(fn?.fileId ?? 0) | 0,
                startLine: Number(fn?.startLine ?? 0) | 0,
                endLine: Number(fn?.endLine ?? 0) | 0,
              })).filter((fn) => fn.id >= 0 && !!fn.name)
              : undefined;
            const types = Array.isArray(m.types)
              ? (m.types as Array<any>).map((t) => ({
                id: Number(t?.id ?? 0) | 0,
                name: String(t?.name ?? ""),
                instanceSizeBytes: Number(t?.instanceSizeBytes ?? 0) | 0,
                fields: Array.isArray(t?.fields)
                  ? (t.fields as Array<any>).map((f) => ({
                    name: String(f?.name ?? ""),
                    offsetBytes: Number(f?.offsetBytes ?? 0) | 0,
                    wasmType: String(f?.wasmType ?? ""),
                    declaredType: String(f?.declaredType ?? ""),
                    customTypeName: f?.customTypeName == null ? null : String(f?.customTypeName ?? ""),
                    dimensions: Array.isArray(f?.dimensions)
                      ? (f.dimensions as Array<any>).map((n) => Number(n) | 0).filter((n) => n > 0)
                      : null,
                  })).filter((f) => !!f.name && (f.offsetBytes | 0) >= 0)
                  : [],
              })).filter((t) => (t.id | 0) > 0 && !!t.name && (t.instanceSizeBytes | 0) > 0)
              : undefined;
            const versions = m.versions && typeof m.versions === "object"
              ? {
                bbdbgSchemaVersion: Number(m.versions?.bbdbgSchemaVersion ?? 0) | 0,
                runtimeLayoutVersion: Number(m.versions?.runtimeLayoutVersion ?? 0) | 0,
              }
              : undefined;
            st.meta = {
              ok: !!m.ok,
              url: String(m.url ?? ""),
              fileCount: Number(m.fileCount ?? 0),
              functionCount: Number(m.functionCount ?? 0),
              typeCount: Number(m.typeCount ?? 0),
              versions,
              error: m.error ? String(m.error) : undefined,
              files,
              functions,
              types,
            };
            (window as any).__WORKER_BBDBG = st;
            try {
              currentWorkerBbdbgUiRefresh?.();
            } catch { }
          } else if (m?.type === "bbdbgConfig") {
            const st = ((window as any).__WORKER_BBDBG ?? {}) as WorkerBbdbgState;
            st.config = {
              enabled: !!m.enabled,
              traceMax: Number(m.traceMax ?? 0) | 0,
            };
            (window as any).__WORKER_BBDBG = st;
            try {
              currentWorkerBbdbgUiRefresh?.();
            } catch { }
          } else if (m?.type === "bbdbgSnapshot") {
            const st = ((window as any).__WORKER_BBDBG ?? {}) as WorkerBbdbgState;
            st.lastSnapshot = (m.snapshot ?? null) as WorkerBbdbgSnapshot | null;
            (window as any).__WORKER_BBDBG = st;
            try {
              const hits = st.lastSnapshot?.breakpointHits?.length ?? 0;
              if (hits > 0 && currentWorkerUpdateLoopCancel) {
                stopWorkerUpdateLoop(`breakpoint hit (${hits})`);
              }
            } catch { }
            try {
              currentWorkerBbdbgUiRefresh?.();
            } catch { }
          } else if (m?.type === "dbgMemory") {
            const id = Number(m.reqId ?? 0) | 0;
            const pending = currentWorkerMemPending.get(id);
            if (pending) {
              currentWorkerMemPending.delete(id);
              try {
                clearTimeout(pending.timeoutId);
                const addr = Number(m.addr ?? 0) >>> 0;
                const bytes = m.bytes instanceof Uint8Array ? m.bytes : new Uint8Array(m.bytes ?? []);
                pending.resolve({ addr, bytes });
              } catch (e) {
                pending.reject(e);
              }
            }
          } else if (m?.type === "dbgMemoryError") {
            const id = Number(m.reqId ?? 0) | 0;
            const pending = currentWorkerMemPending.get(id);
            if (pending) {
              currentWorkerMemPending.delete(id);
              try {
                clearTimeout(pending.timeoutId);
                pending.reject(new Error(String(m.error ?? "dbgMemoryError")));
              } catch { }
            }
          } else if (m?.type === "dbgGlobal") {
            const id = Number(m.reqId ?? 0) | 0;
            const pending = currentWorkerGlobalPending.get(id);
            if (pending) {
              currentWorkerGlobalPending.delete(id);
              try {
                clearTimeout(pending.timeoutId);
                pending.resolve({
                  name: String(m.name ?? ""),
                  value: Number(m.value ?? 0) >>> 0,
                });
              } catch (e) {
                pending.reject(e);
              }
            }
          } else if (m?.type === "dbgGlobalError") {
            const id = Number(m.reqId ?? 0) | 0;
            const pending = currentWorkerGlobalPending.get(id);
            if (pending) {
              currentWorkerGlobalPending.delete(id);
              try {
                clearTimeout(pending.timeoutId);
                pending.reject(new Error(String(m.error ?? "dbgGlobalError")));
              } catch { }
            }
          } else if (m?.type === "ready") {
            console.log("[worker] ready");
            currentWorkerReady = true;
            refreshWorkerButtons();
            try {
              // Query bbdbg config immediately (best-effort; no-op if worker doesn't support it).
              w.postMessage({ cmd: "dbgConfig" });
            } catch { }
            if (workerAutoProbePending) {
              workerAutoProbePending = false;
              // Defer so the UI updates before starting probe calls.
              setTimeout(() => {
                try {
                  const btnHint = flags.allowMain ? "" : " (add ?noprobes=1 to disable)";
                  console.log(`[worker] auto-probe starting${btnHint}...`);
                } catch { }
                void runWorkerProbe();
              }, 0);
            }
          } else if (m?.type === "callStart") {
            console.log(`[worker] call ${m.exportName}()...`);
          } else if (m?.type === "callDone") {
            console.log(`[worker] ok ${m.exportName}()`);
            const id = Number(m.callId ?? 0);
            const pending = currentWorkerPending.get(id);
            if (pending) {
              currentWorkerPending.delete(id);
              try {
                clearTimeout(pending.timeoutId);
                pending.resolve(m.result);
              } catch { }
            }
            refreshWorkerButtons();
          } else if (m?.type === "error") {
            console.error("[worker] error:", m.error);
            const id = Number(m.callId ?? 0);
            const pending = currentWorkerPending.get(id);
            if (pending) {
              currentWorkerPending.delete(id);
              try {
                clearTimeout(pending.timeoutId);
                pending.reject(new Error(String(m.error ?? "worker error")));
              } catch { }
            }
            refreshWorkerButtons();
          }
        };
        w.onerror = (e) => {
          console.error("[worker] onerror:", e);
          // On raw worker errors, fail any in-flight call and keep status.
          for (const [_id, p] of currentWorkerPending) {
            try {
              clearTimeout(p.timeoutId);
              p.reject(new Error("worker error"));
            } catch { }
          }
          currentWorkerPending.clear();
          refreshWorkerButtons();
        };
        refreshWorkerButtons();
        return w;
      };

      const workerInit = (preloadGroup: string) => {
        if (currentWorkerPending.size > 0) {
          const inflight = [...currentWorkerPending.values()][0]?.exportName ?? "?";
          console.warn(
            `[worker] cannot init while busy (in-flight: ${inflight}). Click 'Terminate Worker' first.`,
          );
          return;
        }
        const w = ensureWorker();
        currentWorkerReady = false;
        workerAutoProbePending = workerAutoProbeEnabled;
        refreshWorkerButtons();
        w.postMessage({
          cmd: "init",
          wasmUrl: BOOT_WASM_PATH,
          manifestUrl: BOOT_MANIFEST_PATH,
          preloadGroup,
        });
      };

      const workerSetupScpcb = () => {
        const w = ensureWorker();
        // Encourage SCPCB web short-circuit paths + disable launcher loop.
        w.postMessage({ cmd: "setGlobal", name: "WebPort", value: 1 });
        w.postMessage({ cmd: "setGlobal", name: "LauncherEnabled", value: 0 });
        // Prime input so "press any key" loops can complete.
        w.postMessage({ cmd: "primeInput" });
      };

      const workerCall = (
        exportName: string,
        timeoutMs: number,
        args: Array<number | string> = [],
      ) => {
        if (!currentWorker || !currentWorkerReady) {
          console.warn(
            `[worker] not ready yet; click 'Worker Init (init)' first and wait for '[worker] ready'`,
          );
          return Promise.reject(new Error("worker not ready"));
        }
        if (currentWorkerPending.size > 0) {
          const inflight = [...currentWorkerPending.values()][0]?.exportName ?? "?";
          console.warn(
            `[worker] busy (in-flight: ${inflight}). Wait or click 'Terminate Worker' to abort.`,
          );
          return Promise.reject(new Error("worker busy"));
        }
        const w = ensureWorker();
        const callId = currentWorkerCallId++;
        workerSetupScpcb();
        const p = new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            const snap = (window as any).__WORKER_STATUS as any;
            let snapSummary = "";
            try {
              const c = (snap?.counters ?? {}) as Record<string, number>;
              const keys = Object.keys(c)
                .sort((a, b) => (c[b] ?? 0) - (c[a] ?? 0))
                .slice(0, 6);
              snapSummary = JSON.stringify(
                {
                  stage: snap?.stage,
                  file: snap?.lastFileReq,
                  top: keys.reduce((acc: any, k) => {
                    acc[k] = c[k];
                    return acc;
                  }, {}),
                },
                null,
                0,
              );
            } catch { }
            console.error(
              `[worker] watchdog: ${exportName} exceeded ${timeoutMs}ms; terminating worker${snapSummary ? ` snapshot=${snapSummary}` : ""}`,
            );
            terminateWorker();
          }, timeoutMs) as any;
          currentWorkerPending.set(callId, { exportName, resolve, reject, timeoutId });
        });
        refreshWorkerButtons();
        w.postMessage({ cmd: "call", callId, exportName, args });
        return p;
      };

      const stopWorkerUpdateLoop = (reason?: string) => {
        if (currentWorkerUpdateLoopCancel) {
          try {
            currentWorkerUpdateLoopCancel();
          } catch { }
          currentWorkerUpdateLoopCancel = null;
        }
        currentWorkerUpdateLoopPausedReason = reason ? String(reason) : null;
        try {
          currentWorkerBbdbgUiRefresh?.();
        } catch { }
        try {
          refreshWorkerButtons();
        } catch { }
      };

      const startWorkerUpdateLoop = () => {
        if (!currentWorker || !currentWorkerReady) return;
        if (currentWorkerUpdateLoopCancel) return;
        let running = true;
        currentWorkerUpdateLoopPausedReason = null;

        const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
        const loop = async () => {
          while (running) {
            if (!currentWorker || !currentWorkerReady) {
              stopWorkerUpdateLoop("worker not ready");
              return;
            }
            // Ensure strict single in-flight call semantics.
            if (currentWorkerPending.size > 0) {
              await delay(10);
              continue;
            }
            try {
              await workerCall("UpdateGame", 500);
            } catch (e: any) {
              stopWorkerUpdateLoop(`UpdateGame failed: ${String(e?.message ?? e)}`);
              return;
            }
            // Yield to keep UI responsive.
            await delay(0);
          }
        };
        void loop();
        currentWorkerUpdateLoopCancel = () => {
          running = false;
        };
        try {
          currentWorkerBbdbgUiRefresh?.();
        } catch { }
        try {
          refreshWorkerButtons();
        } catch { }
      };

      const workerCallUI = (
        exportName: string,
        timeoutMs: number,
        args: Array<number | string> = [],
      ) => {
        if (!currentWorker || !currentWorkerReady) {
          console.warn(
            `[worker] not ready yet; click 'Worker Init (init)' first and wait for '[worker] ready'`,
          );
          return;
        }
        if (currentWorkerPending.size > 0) {
          const inflight = [...currentWorkerPending.values()][0]?.exportName ?? "?";
          console.warn(
            `[worker] busy (in-flight: ${inflight}). Wait or click 'Terminate Worker' to abort.`,
          );
          return;
        }
        void workerCall(exportName, timeoutMs, args).catch((e) => {
          // Avoid unhandled promise rejections from UI buttons.
          console.warn(`[worker] ${exportName} call failed:`, e);
        });
      };

      const runWorkerProbe = async () => {
        if (!currentWorkerReady) {
          console.warn("[worker] probe requires worker to be ready");
          return;
        }
        if (currentWorkerPending.size > 0) {
          const inflight = [...currentWorkerPending.values()][0]?.exportName ?? "?";
          console.warn(`[worker] probe blocked: worker is busy (in-flight: ${inflight})`);
          return;
        }
        const exportSet = new Set<string>(
          ((window as any).__WORKER_EXPORTS ?? []) as string[],
        );
        const probes = [
          "InitAAFont",
          "InitLoadingScreens",
          "LoadMaterials",
          "LoadEntities",
          "LoadRoomTemplates",
          "LoadRoomMeshes",
          "InitWayPoints",
          "InitItemTemplates",
          "InitEvents",
          "InitNewGame",
          "UpdateMainMenu",
        ];
        const timeoutByExport: Record<string, number> = {
          InitAAFont: 1500,
          // Ini parsing + string work can be slow in worker mode; give it more budget.
          InitLoadingScreens: 10_000,
          LoadMaterials: 4000,
          LoadEntities: 4000,
          LoadRoomTemplates: 6000,
          LoadRoomMeshes: 10_000,
          InitWayPoints: 4000,
          InitItemTemplates: 4000,
          InitEvents: 4000,
          InitNewGame: 6000,
          UpdateMainMenu: 2000,
        };
        console.log("[worker] probe starting:", probes.join(", "));
        for (const name of probes) {
          if (exportSet.size > 0 && !exportSet.has(name)) continue;
          try {
            const args: Array<number | string> =
              name === "InitLoadingScreens" ? ["Data/events.ini"] : [];
            await workerCall(name, timeoutByExport[name] ?? 1500, args);
            console.log(`[worker] probe ok: ${name}`);
          } catch (e) {
            console.error(`[worker] probe failed/hung at: ${name}`, e);
            return;
          }
        }
        console.log("[worker] probe done");
      };

      if (flags.worker) {
        addGuardedButton("Worker Init (init)", () => workerInit(groupForInit), {
          requiresWorkerIdle: true,
        });
        addGuardedButton(
          "Worker Init (facility_assets)",
          () => workerInit("facility_assets"),
          { requiresWorkerIdle: true },
        );
        addGuardedButton("Worker Probe Init", () => {
          void runWorkerProbe();
        }, { requiresWorkerReady: true, requiresWorkerIdle: true });
        addGuardedButton("Worker Setup SCPCB", () => workerSetupScpcb(), {
          requiresWorkerReady: true,
        });
        if (hasMain && workerDangerEnabled) {
          addGuardedButton("Worker Call Main (danger)", () => {
            workerCallUI("Main", 10_000);
          }, { requiresWorkerReady: true, requiresWorkerIdle: true });
        }
        addGuardedButton(
          "Terminate Worker",
          () => {
            terminateWorker();
            refreshWorkerButtons();
          },
          {},
        );
        if (hasUpdateGame) {
          workerRunUpdateBtn = addButton(bar, "Run UpdateGame", () => {
            startWorkerUpdateLoop();
          }) as HTMLButtonElement;
          workerStopUpdateBtn = addButton(bar, "Stop UpdateGame", () => {
            stopWorkerUpdateLoop("stopped");
          }) as HTMLButtonElement;
          // Managed by refreshWorkerButtons() special-casing above.
          refreshWorkerButtons();
        }

        // BBDBG panel (best-effort). Requires a debug build compiled with `-d/--debug` so
        // the WASM imports `bbdbg.__bbdbg_*` and a sibling `.bbdbg.json` exists.
        const dbgWrap = document.createElement("details");
        dbgWrap.open = false;
        dbgWrap.style.marginTop = "8px";
        dbgWrap.style.padding = "6px";
        dbgWrap.style.border = "1px solid rgba(255,255,255,0.12)";
        dbgWrap.style.borderRadius = "6px";
        const dbgSum = document.createElement("summary");
        dbgSum.textContent = "Worker BBDBG (source trace)";
        dbgSum.style.cursor = "pointer";
        dbgWrap.appendChild(dbgSum);
        const dbgBar = document.createElement("div");
        dbgBar.style.display = "flex";
        dbgBar.style.gap = "6px";
        dbgBar.style.flexWrap = "wrap";
        dbgBar.style.margin = "6px 0";
        dbgWrap.appendChild(dbgBar);
        const bbdbgSources = new Map<string, string>();
        const dbgFileInput = document.createElement("input");
        dbgFileInput.type = "file";
        dbgFileInput.multiple = true;
        dbgFileInput.accept = ".bb,.b3d,.txt";
        dbgFileInput.style.display = "none";
        dbgFileInput.addEventListener("change", async () => {
          const files = Array.from(dbgFileInput.files ?? []);
          for (const f of files) {
            try {
              const text = await f.text();
              bbdbgSources.set(f.name, text);
            } catch { }
          }
          try {
            refreshBbdbgPanel();
          } catch { }
          // Allow re-selecting the same file(s).
          try {
            dbgFileInput.value = "";
          } catch { }
        });
        dbgWrap.appendChild(dbgFileInput);

        // Breakpoints (worker-side currently treats them as "hits during the last call";
        // we don't attempt to pause inside a WASM call).
        const bbdbgBreakpointsByFileId = new Map<number, Set<number>>();
        const bpFileSelect = document.createElement("select");
        bpFileSelect.style.maxWidth = "260px";
        bpFileSelect.style.fontSize = "12px";
        bpFileSelect.title = "Breakpoint file (from .bbdbg.json metadata)";
        const bpLineInput = document.createElement("input");
        bpLineInput.type = "number";
        bpLineInput.min = "1";
        bpLineInput.step = "1";
        bpLineInput.placeholder = "line";
        bpLineInput.style.width = "90px";
        bpLineInput.style.fontSize = "12px";
        bpLineInput.title = "Breakpoint line number";
        dbgBar.appendChild(bpFileSelect);
        dbgBar.appendChild(bpLineInput);

        // Metadata browser (files + functions) from `.bbdbg.json`.
        const metaWrap = document.createElement("details");
        metaWrap.open = false;
        metaWrap.style.marginTop = "8px";
        const metaSum = document.createElement("summary");
        metaSum.textContent = "BBDBG metadata (files/functions)";
        metaSum.style.cursor = "pointer";
        metaWrap.appendChild(metaSum);
        const metaBar = document.createElement("div");
        metaBar.style.display = "flex";
        metaBar.style.gap = "6px";
        metaBar.style.flexWrap = "wrap";
        metaBar.style.margin = "6px 0";
        metaWrap.appendChild(metaBar);
        const metaSearch = document.createElement("input");
        metaSearch.type = "text";
        metaSearch.placeholder = "filter (file or function name)";
        metaSearch.style.width = "260px";
        metaSearch.style.fontSize = "12px";
        const metaLimit = document.createElement("select");
        metaLimit.style.fontSize = "12px";
        for (const n of [50, 200, 800]) {
          const opt = document.createElement("option");
          opt.value = String(n);
          opt.textContent = `limit=${n}`;
          metaLimit.appendChild(opt);
        }
        metaBar.appendChild(metaSearch);
        metaBar.appendChild(metaLimit);
        const metaFiles = document.createElement("pre");
        metaFiles.style.margin = "0";
        metaFiles.style.maxHeight = "160px";
        metaFiles.style.overflow = "auto";
        metaFiles.style.whiteSpace = "pre";
        metaFiles.style.fontSize = "12px";
        metaFiles.style.borderTop = "1px solid rgba(255,255,255,0.08)";
        metaFiles.style.paddingTop = "6px";
        metaWrap.appendChild(metaFiles);
        const metaFuncs = document.createElement("div");
        metaFuncs.style.marginTop = "6px";
        metaFuncs.style.maxHeight = "260px";
        metaFuncs.style.overflow = "auto";
        metaFuncs.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
        metaFuncs.style.fontSize = "12px";
        metaFuncs.style.borderTop = "1px solid rgba(255,255,255,0.08)";
        metaFuncs.style.paddingTop = "6px";
        metaWrap.appendChild(metaFuncs);
        dbgWrap.appendChild(metaWrap);

        const dbgPre = document.createElement("pre");
        dbgPre.style.margin = "0";
        dbgPre.style.maxHeight = "280px";
        dbgPre.style.overflow = "auto";
        dbgPre.style.whiteSpace = "pre";
        dbgPre.style.fontSize = "12px";
        dbgWrap.appendChild(dbgPre);

        // Memory inspector (worker mode only): reads slices of linear memory via worker RPC.
        const memWrap = document.createElement("details");
        memWrap.open = false;
        memWrap.style.marginTop = "8px";
        const memSum = document.createElement("summary");
        memSum.textContent = "Memory inspector (read-only)";
        memSum.style.cursor = "pointer";
        memWrap.appendChild(memSum);
        const memBar = document.createElement("div");
        memBar.style.display = "flex";
        memBar.style.gap = "6px";
        memBar.style.flexWrap = "wrap";
        memBar.style.margin = "6px 0";
        memWrap.appendChild(memBar);
        const memAddrInput = document.createElement("input");
        memAddrInput.type = "text";
        memAddrInput.placeholder = "addr (e.g. 0x1000)";
        memAddrInput.style.width = "160px";
        memAddrInput.style.fontSize = "12px";
        const memLenInput = document.createElement("input");
        memLenInput.type = "number";
        memLenInput.min = "1";
        memLenInput.step = "1";
        memLenInput.value = "256";
        memLenInput.style.width = "90px";
        memLenInput.style.fontSize = "12px";
        const memTypeSelect = document.createElement("select");
        memTypeSelect.style.fontSize = "12px";
        for (const v of ["hex", "i32", "u32", "f32", "b3dstr"]) {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          memTypeSelect.appendChild(opt);
        }
        memBar.appendChild(memAddrInput);
        memBar.appendChild(memLenInput);
        memBar.appendChild(memTypeSelect);
        const memPre = document.createElement("pre");
        memPre.style.margin = "0";
        memPre.style.maxHeight = "280px";
        memPre.style.overflow = "auto";
        memPre.style.whiteSpace = "pre";
        memPre.style.fontSize = "12px";
        memWrap.appendChild(memPre);

        const watchBar = document.createElement("div");
        watchBar.style.display = "flex";
        watchBar.style.gap = "6px";
        watchBar.style.flexWrap = "wrap";
        watchBar.style.margin = "6px 0";
        const watchLabelInput = document.createElement("input");
        watchLabelInput.type = "text";
        watchLabelInput.placeholder = "watch label";
        watchLabelInput.style.width = "140px";
        watchLabelInput.style.fontSize = "12px";
        const watchTypeSelect = document.createElement("select");
        watchTypeSelect.style.fontSize = "12px";
        for (const v of ["i32", "u32", "f32", "b3dstr"]) {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = v;
          watchTypeSelect.appendChild(opt);
        }
        watchBar.appendChild(watchLabelInput);
        watchBar.appendChild(watchTypeSelect);
        memWrap.appendChild(watchBar);
        const watchPre = document.createElement("pre");
        watchPre.style.margin = "0";
        watchPre.style.maxHeight = "220px";
        watchPre.style.overflow = "auto";
        watchPre.style.whiteSpace = "pre";
        watchPre.style.fontSize = "12px";
        memWrap.appendChild(watchPre);

        const typeDecodeBar = document.createElement("div");
        typeDecodeBar.style.display = "flex";
        typeDecodeBar.style.gap = "6px";
        typeDecodeBar.style.flexWrap = "wrap";
        typeDecodeBar.style.margin = "8px 0 6px 0";
        const typePtrInput = document.createElement("input");
        typePtrInput.type = "text";
        typePtrInput.placeholder = "type ptr (hex like 0x1234)";
        typePtrInput.style.width = "220px";
        typePtrInput.style.fontSize = "12px";
        const typeSelect = document.createElement("select");
        typeSelect.style.maxWidth = "260px";
        typeSelect.style.fontSize = "12px";
        typeSelect.title = "Decode as Blitz Type (from .bbdbg.json)";
        typeDecodeBar.appendChild(typePtrInput);
        typeDecodeBar.appendChild(typeSelect);
        memWrap.appendChild(typeDecodeBar);
        const typePre = document.createElement("pre");
        typePre.style.margin = "0";
        typePre.style.maxHeight = "260px";
        typePre.style.overflow = "auto";
        typePre.style.whiteSpace = "pre";
        typePre.style.fontSize = "12px";
        memWrap.appendChild(typePre);
        dbgWrap.appendChild(memWrap);
        loader.overlay.appendChild(dbgWrap);

        const basename = (p: string) => {
          const s = String(p ?? "");
          const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
          return i >= 0 ? s.slice(i + 1) : s;
        };

        const refreshMetaViz = () => {
          const st = ((window as any).__WORKER_BBDBG ?? null) as WorkerBbdbgState | null;
          const files = st?.meta?.files ?? [];
          const funcs = st?.meta?.functions ?? [];
          const q = String(metaSearch.value ?? "").trim().toLowerCase();
          const lim = Math.max(10, Math.min(5000, Number(metaLimit.value ?? "200") | 0));

          const fileLines: string[] = [];
          fileLines.push(`files (${files.length}${files.length > 500 ? "+ (truncated in worker)" : ""})`);
          const fileRows = q
            ? files.filter((f) => String(f.path ?? "").toLowerCase().includes(q))
            : files;
          for (const f of fileRows.slice(0, 30)) {
            fileLines.push(`  ${String(f.id).padStart(4, " ")}  ${f.path}`);
          }
          if (fileRows.length > 30) fileLines.push(`  ... (${fileRows.length - 30} more)`);
          metaFiles.textContent = fileLines.join("\n");

          metaFuncs.textContent = "";
          const title = document.createElement("div");
          title.textContent = `functions (${funcs.length}${funcs.length > 2000 ? "+ (truncated in worker)" : ""})`;
          title.style.marginBottom = "6px";
          metaFuncs.appendChild(title);

          const fnRows = q
            ? funcs.filter((fn) => {
              const name = String(fn.name ?? "").toLowerCase();
              const sig = String(fn.signature ?? "").toLowerCase();
              const file = files.find((f) => (f.id | 0) === (fn.fileId | 0))?.path ?? "";
              return name.includes(q) || sig.includes(q) || String(file).toLowerCase().includes(q);
            })
            : funcs;
          const list = fnRows.slice(0, lim);
          for (const fn of list) {
            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.gap = "8px";
            row.style.alignItems = "baseline";
            row.style.padding = "2px 0";

            const btn = document.createElement("button");
            btn.textContent = "BP";
            btn.style.fontSize = "11px";
            btn.style.padding = "1px 6px";
            btn.dataset.fileId = String(fn.fileId | 0);
            btn.dataset.line = String(fn.startLine | 0);
            btn.title = "Set breakpoint at function startLine";

            const filePath = files.find((f) => (f.id | 0) === (fn.fileId | 0))?.path ?? `file_${fn.fileId | 0}`;
            const label = document.createElement("div");
            label.style.flex = "1";
            label.textContent =
              `${String(fn.id).padStart(4, " ")}  ${fn.name}  ` +
              `[${basename(filePath)}:${fn.startLine}..${fn.endLine}]  ` +
              `${fn.signature}`;
            row.appendChild(btn);
            row.appendChild(label);
            metaFuncs.appendChild(row);
          }
          if (fnRows.length > lim) {
            const more = document.createElement("div");
            more.textContent = `... (${fnRows.length - lim} more; refine filter)`;
            more.style.marginTop = "6px";
            metaFuncs.appendChild(more);
          }
        };

        const refreshTypeDecodeSelect = () => {
          const st = ((window as any).__WORKER_BBDBG ?? null) as WorkerBbdbgState | null;
          const types = st?.meta?.types ?? [];
          const cur = String(typeSelect.value ?? "");
          typeSelect.textContent = "";
          const opt0 = document.createElement("option");
          opt0.value = "";
          opt0.textContent = types.length ? "(choose type)" : "(no bbdbg types)";
          typeSelect.appendChild(opt0);

          const rank = (name: string) => {
            const n = name.toLowerCase();
            if (n === "npcs") return 0;
            if (n === "items") return 1;
            if (n.includes("npc")) return 2;
            if (n.includes("item")) return 3;
            return 10;
          };
          const sorted = [...types].sort((a, b) => {
            const ra = rank(a.name);
            const rb = rank(b.name);
            if (ra !== rb) return ra - rb;
            return a.name.localeCompare(b.name);
          });
          for (const t of sorted) {
            const opt = document.createElement("option");
            opt.value = String(t.id | 0);
            opt.textContent = `${t.name} (id=${t.id | 0}, ${t.instanceSizeBytes | 0} bytes)`;
            typeSelect.appendChild(opt);
          }
          if (cur) typeSelect.value = cur;
        };

        const getSelectedType = () => {
          const st = ((window as any).__WORKER_BBDBG ?? null) as WorkerBbdbgState | null;
          const types = st?.meta?.types ?? [];
          const id = Number(typeSelect.value ?? "0") | 0;
          if (id <= 0) return null;
          return types.find((t) => (t.id | 0) === id) ?? null;
        };

        const selectTypeByName = (name: string) => {
          const st = ((window as any).__WORKER_BBDBG ?? null) as WorkerBbdbgState | null;
          const types = st?.meta?.types ?? [];
          const want = name.toLowerCase();
          const hit = types.find((t) => String(t.name ?? "").toLowerCase() === want);
          if (!hit) return false;
          typeSelect.value = String(hit.id | 0);
          return true;
        };

        const parseU32 = (s: string): number | null => {
          const t = String(s ?? "").trim();
          if (!t) return null;
          const n = t.startsWith("0x") || t.startsWith("0X")
            ? Number.parseInt(t.slice(2), 16)
            : Number.parseInt(t, 10);
          if (!Number.isFinite(n)) return null;
          return (n >>> 0) as number;
        };

        const latin1 = new TextDecoder("latin1");

        const readWorkerMemory = (addr: number, len: number) => {
          if (!currentWorker || !currentWorkerReady) {
            return Promise.reject(new Error("worker not ready"));
          }
          const reqId = (currentWorkerMemReqId++ | 0) >>> 0;
          return new Promise<{ addr: number; bytes: Uint8Array }>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              currentWorkerMemPending.delete(reqId);
              reject(new Error("dbgReadMemory timeout"));
            }, 1500) as any as number;
            currentWorkerMemPending.set(reqId, { resolve, reject, timeoutId });
            currentWorker!.postMessage({ cmd: "dbgReadMemory", reqId, addr, len });
          });
        };

        const readWorkerGlobal = (name: string) => {
          if (!currentWorker || !currentWorkerReady) {
            return Promise.reject(new Error("worker not ready"));
          }
          const reqId = (currentWorkerGlobalReqId++ | 0) >>> 0;
          return new Promise<{ name: string; value: number }>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              currentWorkerGlobalPending.delete(reqId);
              reject(new Error("dbgReadGlobal timeout"));
            }, 1500) as any as number;
            currentWorkerGlobalPending.set(reqId, { resolve, reject, timeoutId });
            currentWorker!.postMessage({ cmd: "dbgReadGlobal", reqId, name });
          });
        };

        const readU32le = async (addr: number) => {
          const { bytes } = await readWorkerMemory(addr, 4);
          if (bytes.byteLength < 4) throw new Error("short read");
          return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0, true) >>> 0;
        };

        const readI32le = async (addr: number) => {
          const { bytes } = await readWorkerMemory(addr, 4);
          if (bytes.byteLength < 4) throw new Error("short read");
          return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(0, true) | 0;
        };

        const readF32le = async (addr: number) => {
          const { bytes } = await readWorkerMemory(addr, 4);
          if (bytes.byteLength < 4) throw new Error("short read");
          return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getFloat32(0, true);
        };

        const readB3DString = async (ptr: number) => {
          const maxStringLen = 1024 * 1024;
          const head = await readWorkerMemory(ptr >>> 0, 8);
          const hb = head.bytes;
          if (hb.byteLength < 8) return `<invalid_str_ptr:0x${(ptr >>> 0).toString(16)}>`;
          const hv = new DataView(hb.buffer, hb.byteOffset, hb.byteLength);
          const len = hv.getInt32(4, true) | 0;
          if (len < 0 || len > maxStringLen) {
            return `<invalid_str_len:0x${(ptr >>> 0).toString(16)}:${len}>`;
          }
          const body = await readWorkerMemory(((ptr + 8) >>> 0), len);
          const b = body.bytes;
          const text = latin1.decode(b.subarray(0, Math.min(b.length, len)));
          return b.length < len ? `${text}<...truncated ${len - b.length}>` : text;
        };

        const typeSizeBytes = (wasmType: string) => {
          const t = wasmType.toLowerCase();
          if (t === "i64" || t === "f64") return 8;
          return 4;
        };

        const readScalarFrom = (dv: DataView, wasmType: string, off: number) => {
          const t = wasmType.toLowerCase();
          try {
            if (t === "f32") return String(dv.getFloat32(off, true));
            if (t === "f64") return String(dv.getFloat64(off, true));
            if (t === "i64") return String(dv.getBigInt64(off, true));
            if (t === "u64") return String(dv.getBigUint64(off, true));
          } catch {
            // Fall through to i32 below.
          }
          return String(dv.getInt32(off, true));
        };

        const fmtHex32 = (v: number) => `0x${(v >>> 0).toString(16).padStart(8, "0")}`;

        const decodeTypeInstance = async (
          ptr: number,
          typeInfo: NonNullable<ReturnType<typeof getSelectedType>>,
        ) => {
          const size = Math.max(0, Math.min(16 * 1024, typeInfo.instanceSizeBytes | 0));
          if (size <= 0) throw new Error("invalid instance size");
          const { bytes } = await readWorkerMemory(ptr >>> 0, size);
          const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const lines: string[] = [];
          lines.push(
            `Type ${typeInfo.name} (id=${typeInfo.id | 0}) @ ${fmtHex32(ptr >>> 0)} size=${size} bytes`,
          );
          lines.push("");

          let decodedStrings = 0;
          const maxStringDecodes = 8;

          for (const f of typeInfo.fields ?? []) {
            const off = f.offsetBytes | 0;
            if (off < 0 || off >= dv.byteLength) continue;
            const dims = Array.isArray(f.dimensions) ? f.dimensions : null;
            const elemSize = typeSizeBytes(String(f.wasmType ?? "i32"));
            const isString = String(f.declaredType ?? "").toLowerCase() === "string";
            const isPtr = isString || !!f.customTypeName;

            const label =
              `${String(f.name ?? "").padEnd(18, " ")} +${String(off).padStart(5, " ")}  ` +
              `${String(f.wasmType ?? "").padEnd(4, " ")}`;
            if (dims && dims.length) {
              const count = dims.reduce((a, b) => a * Math.max(1, b | 0), 1) | 0;
              const maxElems = Math.max(1, Math.min(8, count));
              const vals: string[] = [];
              for (let i = 0; i < maxElems; i++) {
                const at = off + i * elemSize;
                if (at + elemSize > dv.byteLength) break;
                const v = readScalarFrom(dv, String(f.wasmType ?? "i32"), at);
                vals.push(v);
              }
              const tail = count > maxElems ? `, ... (${count} total)` : "";
              lines.push(`${label}  [${dims.join(",")}] = [${vals.join(", ")}${tail}]`);
              continue;
            }

            if (off + elemSize > dv.byteLength) continue;
            if (!isPtr) {
              const raw = readScalarFrom(dv, String(f.wasmType ?? "i32"), off);
              lines.push(`${label}  = ${raw}`);
              continue;
            }

            const p = dv.getUint32(off, true) >>> 0;
            const hint = isString ? "String" : (f.customTypeName ? `.${String(f.customTypeName)}` : "ptr");
            let extra = "";
            if (isString && p !== 0 && decodedStrings < maxStringDecodes) {
              decodedStrings++;
              try {
                const s = await readB3DString(p);
                extra = `  "${String(s).slice(0, 120)}${String(s).length > 120 ? "…" : ""}"`;
              } catch { }
            }
            lines.push(`${label}  = ${fmtHex32(p)} (${hint})${extra}`);
          }

          return lines.join("\n");
        };

        const hexDump = (addr: number, bytes: Uint8Array) => {
          const lines: string[] = [];
          const row = 16;
          const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          // Typed preview at start.
          if (bytes.byteLength >= 4) {
            const i32 = view.getInt32(0, true);
            const u32 = view.getUint32(0, true);
            const f32 = view.getFloat32(0, true);
            lines.push(`@0x${addr.toString(16)} i32=${i32} u32=${u32} f32=${Number.isFinite(f32) ? f32.toFixed(6) : String(f32)}`);
          } else {
            lines.push(`@0x${addr.toString(16)} len=${bytes.byteLength}`);
          }
          lines.push("");
          for (let off = 0; off < bytes.length; off += row) {
            const chunk = bytes.subarray(off, Math.min(bytes.length, off + row));
            const hex = Array.from(chunk).map((b) => b.toString(16).padStart(2, "0")).join(" ");
            const ascii = Array.from(chunk).map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ".")).join("");
            lines.push(`0x${(addr + off).toString(16).padStart(8, "0")}  ${hex.padEnd(row * 3 - 1, " ")}  |${ascii}|`);
          }
          return lines.join("\n");
        };

        const memWatches: Array<{ addr: number; kind: string; label: string }> = [];
        const refreshWatches = async () => {
          if (!memWatches.length) {
            watchPre.textContent = "(no watches)";
            return;
          }
          const lines: string[] = [];
          for (const w of memWatches) {
            try {
              let v = "";
              if (w.kind === "i32") v = String(await readI32le(w.addr));
              else if (w.kind === "u32") v = `0x${(await readU32le(w.addr)).toString(16)}`;
              else if (w.kind === "f32") {
                const f = await readF32le(w.addr);
                v = Number.isFinite(f) ? f.toFixed(6) : String(f);
              } else if (w.kind === "b3dstr") {
                v = JSON.stringify(await readB3DString(w.addr));
              } else v = "(unknown)";
              lines.push(`${w.label || w.kind}@0x${w.addr.toString(16)} = ${v}`);
            } catch (e: any) {
              lines.push(`${w.label || w.kind}@0x${w.addr.toString(16)} = <error: ${String(e?.message ?? e)}>`);
            }
          }
          watchPre.textContent = lines.join("\n");
        };

        const syncBreakpoints = () => {
          if (!currentWorker || !currentWorkerReady) return;
          const out: Record<string, number[]> = {};
          for (const [fileId, set] of bbdbgBreakpointsByFileId) {
            const list = [...set].filter((n) => Number.isFinite(n) && (n | 0) > 0).sort((a, b) => a - b);
            if (list.length) out[String(fileId | 0)] = list.map((n) => n | 0);
          }
          currentWorker.postMessage({ cmd: "dbgSetBreakpoints", breakpointsByFileId: out });
        };

        const refreshBreakpointFiles = () => {
          const st = ((window as any).__WORKER_BBDBG ?? null) as WorkerBbdbgState | null;
          const files = st?.meta?.files ?? [];
          const cur = Number(bpFileSelect.value ?? "0") | 0;
          bpFileSelect.textContent = "";
          const opt0 = document.createElement("option");
          opt0.value = "0";
          opt0.textContent = files.length ? "(choose file)" : "(no bbdbg files)";
          bpFileSelect.appendChild(opt0);
          for (const f of files.slice(0, 200)) {
            const opt = document.createElement("option");
            opt.value = String(f.id | 0);
            opt.textContent = `${f.id | 0}: ${basename(f.path)}`;
            opt.title = f.path;
            bpFileSelect.appendChild(opt);
          }
          if (cur > 0) bpFileSelect.value = String(cur);
        };

        const refreshBbdbgPanel = () => {
          try {
            refreshBreakpointFiles();
            refreshMetaViz();
            refreshTypeDecodeSelect();
          } catch { }
          const st = ((window as any).__WORKER_BBDBG ?? null) as WorkerBbdbgState | null;
          const snap = st?.lastSnapshot ?? null;
          const lines: string[] = [];
          lines.push(`required=${st?.required ? "1" : "0"}`);
          if (st?.meta) {
            lines.push(
              st.meta.ok
                ? `meta=ok files=${st.meta.fileCount ?? 0} funcs=${st.meta.functionCount ?? 0}`
                : `meta=error ${st.meta.error ?? "unknown"}`,
            );
          } else {
            lines.push("meta=(none yet)");
          }
          if (st?.config) {
            lines.push(
              `config enabled=${st.config.enabled ? "1" : "0"} traceMax=${st.config.traceMax | 0}`,
            );
          } else {
            lines.push("config=(unknown; click Toggle once to query)");
          }
          if (bbdbgBreakpointsByFileId.size > 0) {
            const parts: string[] = [];
            const fileName = (id: number) =>
              st?.meta?.files?.find((f) => (f.id | 0) === (id | 0))?.path ?? `file_${id | 0}`;
            for (const [fileId, set] of bbdbgBreakpointsByFileId) {
              const list = [...set].sort((a, b) => a - b);
              parts.push(`${basename(fileName(fileId))}:${list.join(",")}`);
            }
            lines.push(`breakpoints set: ${parts.join(" | ")}`);
          } else {
            lines.push("breakpoints set: (none)");
          }
          if (currentWorkerUpdateLoopCancel) {
            lines.push("UpdateGame loop: running");
          } else if (currentWorkerUpdateLoopPausedReason) {
            lines.push(`UpdateGame loop: paused (${currentWorkerUpdateLoopPausedReason})`);
          } else {
            lines.push("UpdateGame loop: stopped");
          }
          if (!snap) {
            lines.push("last=(none yet) — call an export like UpdateGame");
            dbgPre.textContent = lines.join("\n");
            return;
          }
          lines.push(`last export=${snap.exportName}`);
          if (snap.location) {
            lines.push(`at ${snap.location.file}:${snap.location.line} (fileId=${snap.location.fileId})`);
          } else {
            lines.push("at (unknown)");
          }
          if (snap.stack?.length) lines.push(`stack: ${snap.stack.join(" -> ")}`);
          if (snap.breakpointHits?.length) {
            lines.push(
              `breakpoints hit: ${snap.breakpointHits.map((h) => `${h.file}:${h.line}`).join(", ")}`,
            );
          }
          if (snap.trace?.length) {
            lines.push("");
            lines.push("trace (most recent):");
            for (const t of snap.trace.slice(-80)) {
              const pad = "  ".repeat(Math.min(8, t.depth | 0));
              lines.push(`${pad}${t.file}:${t.line}`);
            }
          }

          // Best-effort source preview: user can drag in / select .bb files locally.
          if (snap.location?.file && snap.location.line > 0) {
            const want = String(snap.location.file);
            const src = bbdbgSources.get(want) ?? bbdbgSources.get(basename(want)) ?? null;
            if (src) {
              const all = src.split(/\r?\n/);
              const cur = snap.location.line | 0;
              const start = Math.max(1, cur - 5);
              const end = Math.min(all.length, cur + 5);
              const width = String(end).length;
              lines.push("");
              lines.push(`source: ${basename(want)} (loaded locally)`);
              for (let ln = start; ln <= end; ln++) {
                const mark = ln === cur ? ">" : " ";
                const num = String(ln).padStart(width, " ");
                lines.push(`${mark} ${num} | ${all[ln - 1] ?? ""}`);
              }
            } else {
              lines.push("");
              lines.push(`source: not loaded for ${basename(want)} (use "Load sources…")`);
            }
          }
          dbgPre.textContent = lines.join("\n");
        };
        currentWorkerBbdbgUiRefresh = refreshBbdbgPanel;
        refreshBreakpointFiles();
        refreshMetaViz();
        refreshTypeDecodeSelect();
        refreshBbdbgPanel();

        const postDbgConfig = (patch: { enabled?: boolean; traceMax?: number }) => {
          if (!currentWorker || !currentWorkerReady) return;
          currentWorker.postMessage({ cmd: "dbgConfig", ...patch });
        };

        const btnToggle = addButton(dbgBar, "Toggle", () => {
          const st = ((window as any).__WORKER_BBDBG ?? null) as WorkerBbdbgState | null;
          const cur = st?.config?.enabled ?? true;
          postDbgConfig({ enabled: !cur });
        }) as HTMLButtonElement;
        const btnLoadSources = addButton(dbgBar, "Load sources…", () => {
          try {
            dbgFileInput.click();
          } catch { }
        }) as HTMLButtonElement;
        const btnMemRead = addButton(memBar, "Read", () => {
          const addr = parseU32(memAddrInput.value);
          const len = Number(memLenInput.value ?? "256") | 0;
          if (addr == null || len <= 0) {
            memPre.textContent = "invalid addr/len";
            return;
          }
          memPre.textContent = "reading...";
          const mode = String(memTypeSelect.value ?? "hex");
          if (mode === "i32") {
            void readI32le(addr).then((v) => {
              memPre.textContent = `i32@0x${addr.toString(16)} = ${v}`;
            }).catch((e) => {
              memPre.textContent = `read failed: ${String((e as any)?.message ?? e)}`;
            });
          } else if (mode === "u32") {
            void readU32le(addr).then((v) => {
              memPre.textContent = `u32@0x${addr.toString(16)} = 0x${v.toString(16)}`;
            }).catch((e) => {
              memPre.textContent = `read failed: ${String((e as any)?.message ?? e)}`;
            });
          } else if (mode === "f32") {
            void readF32le(addr).then((v) => {
              memPre.textContent = `f32@0x${addr.toString(16)} = ${Number.isFinite(v) ? v.toFixed(6) : String(v)}`;
            }).catch((e) => {
              memPre.textContent = `read failed: ${String((e as any)?.message ?? e)}`;
            });
          } else if (mode === "b3dstr") {
            void readB3DString(addr).then((s) => {
              memPre.textContent = `b3dstr@0x${addr.toString(16)} = ${s}`;
            }).catch((e) => {
              memPre.textContent = `read failed: ${String((e as any)?.message ?? e)}`;
            });
          } else {
            void readWorkerMemory(addr, len).then(({ addr: a, bytes }) => {
              memPre.textContent = hexDump(a, bytes);
            }).catch((e) => {
              memPre.textContent = `read failed: ${String((e as any)?.message ?? e)}`;
            });
          }
        }) as HTMLButtonElement;
        const btnWatchAdd = addButton(watchBar, "Add watch", () => {
          const addr = parseU32(memAddrInput.value);
          if (addr == null) return;
          const kind = String(watchTypeSelect.value ?? "i32");
          const label = String(watchLabelInput.value ?? "");
          memWatches.push({ addr, kind, label });
          void refreshWatches();
        }) as HTMLButtonElement;
        const btnWatchRefresh = addButton(watchBar, "Refresh", () => {
          void refreshWatches();
        }) as HTMLButtonElement;
        const btnWatchClear = addButton(watchBar, "Clear", () => {
          memWatches.length = 0;
          void refreshWatches();
        }) as HTMLButtonElement;
        const btnTypeNPCs = addButton(typeDecodeBar, "NPCs", () => {
          refreshTypeDecodeSelect();
          selectTypeByName("NPCs");
        }) as HTMLButtonElement;
        const btnTypeItems = addButton(typeDecodeBar, "Items", () => {
          refreshTypeDecodeSelect();
          selectTypeByName("Items");
        }) as HTMLButtonElement;
        const btnTypeUseFirst = addButton(typeDecodeBar, "Use First", () => {
          const t = getSelectedType();
          if (!t) {
            typePre.textContent = "choose a type first";
            return;
          }
          const exportName = `__bbdbg_first_${String(t.name ?? "").replace(/[^A-Za-z0-9_]/g, "_")}`;
          typePre.textContent = `reading ${exportName}...`;
          void readWorkerGlobal(exportName).then(({ value }) => {
            const hex = `0x${(value >>> 0).toString(16)}`;
            typePtrInput.value = hex;
            memAddrInput.value = hex;
            typePre.textContent = `${exportName} = ${hex}`;
          }).catch((e) => {
            typePre.textContent = `read failed: ${String((e as any)?.message ?? e)}`;
          });
        }) as HTMLButtonElement;
        const btnTypeUseLast = addButton(typeDecodeBar, "Use Last", () => {
          const t = getSelectedType();
          if (!t) {
            typePre.textContent = "choose a type first";
            return;
          }
          const exportName = `__bbdbg_last_${String(t.name ?? "").replace(/[^A-Za-z0-9_]/g, "_")}`;
          typePre.textContent = `reading ${exportName}...`;
          void readWorkerGlobal(exportName).then(({ value }) => {
            const hex = `0x${(value >>> 0).toString(16)}`;
            typePtrInput.value = hex;
            memAddrInput.value = hex;
            typePre.textContent = `${exportName} = ${hex}`;
          }).catch((e) => {
            typePre.textContent = `read failed: ${String((e as any)?.message ?? e)}`;
          });
        }) as HTMLButtonElement;
        const btnTypeDecode = addButton(typeDecodeBar, "Decode Type", () => {
          const addr =
            parseU32(typePtrInput.value) ??
            parseU32(memAddrInput.value);
          const t = getSelectedType();
          if (addr == null || !t) {
            typePre.textContent = "need ptr + type (debug build must provide .bbdbg.json)";
            return;
          }
          typePre.textContent = "decoding...";
          void decodeTypeInstance(addr, t).then((s) => {
            typePre.textContent = s;
          }).catch((e) => {
            typePre.textContent = `decode failed: ${String((e as any)?.message ?? e)}`;
          });
        }) as HTMLButtonElement;
        const btnAddBp = addButton(dbgBar, "Add BP", () => {
          const fileId = Number(bpFileSelect.value ?? "0") | 0;
          const line = Number(bpLineInput.value ?? "0") | 0;
          if (fileId <= 0 || line <= 0) return;
          const set = bbdbgBreakpointsByFileId.get(fileId) ?? new Set<number>();
          set.add(line);
          bbdbgBreakpointsByFileId.set(fileId, set);
          syncBreakpoints();
          try {
            refreshBbdbgPanel();
          } catch { }
        }) as HTMLButtonElement;
        const btnClearBp = addButton(dbgBar, "Clear BPs", () => {
          bbdbgBreakpointsByFileId.clear();
          syncBreakpoints();
          try {
            refreshBbdbgPanel();
          } catch { }
        }) as HTMLButtonElement;
        const btnTrace300 = addButton(
          dbgBar,
          "traceMax=300",
          () => postDbgConfig({ traceMax: 300 }),
        ) as HTMLButtonElement;
        const btnTrace1000 = addButton(
          dbgBar,
          "traceMax=1000",
          () => postDbgConfig({ traceMax: 1000 }),
        ) as HTMLButtonElement;
        guardedButtons.push({ btn: btnToggle, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnLoadSources });
        guardedButtons.push({ btn: btnMemRead, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnWatchAdd, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnWatchRefresh, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnWatchClear, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnTypeNPCs, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnTypeItems, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnTypeUseFirst, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnTypeUseLast, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnTypeDecode, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnAddBp, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnClearBp, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnTrace300, requiresWorkerReady: true });
        guardedButtons.push({ btn: btnTrace1000, requiresWorkerReady: true });

        metaSearch.addEventListener("input", () => {
          try {
            refreshMetaViz();
          } catch { }
        });
        metaLimit.addEventListener("change", () => {
          try {
            refreshMetaViz();
          } catch { }
        });
        metaFuncs.addEventListener("click", (ev) => {
          const t = ev.target as any;
          const btn = t && typeof t === "object" && "dataset" in t ? t as HTMLButtonElement : null;
          const fileId = btn?.dataset?.fileId ? Number(btn.dataset.fileId) | 0 : 0;
          const line = btn?.dataset?.line ? Number(btn.dataset.line) | 0 : 0;
          if (fileId <= 0 || line <= 0) return;
          bpFileSelect.value = String(fileId);
          bpLineInput.value = String(line);
          try {
            // Keep focus on the breakpoint controls for quick repeated additions.
            bpLineInput.focus();
            bpLineInput.select?.();
          } catch { }
          try {
            refreshBbdbgPanel();
          } catch { }
        });
      }

      if (hasUpdateGame) {
        if (!flags.worker) {
          addButton(bar, "Init (safe, no Main)", () => {
            void runInitIfPresent(core, fileIO, instance, loader, {
              forceMain: false,
            });
          });
          addButton(bar, "Dump SCPCB globals", () =>
            dumpScpcbScaleGlobals(instance)
          );
        }
        addGuardedButton(
          "Step UpdateGame",
          () =>
            flags.worker ? workerCallUI("UpdateGame", 500) : callExport(instance, "UpdateGame"),
          flags.worker ? { requiresWorkerReady: true, requiresWorkerIdle: true } : {},
        );
        addGuardedButton(
          "Step UpdateMainMenu",
          () =>
            flags.worker
              ? workerCallUI("UpdateMainMenu", 1500)
              : callExport(instance, "UpdateMainMenu"),
          flags.worker ? { requiresWorkerReady: true, requiresWorkerIdle: true } : {},
        );
        addGuardedButton(
          "Step UpdateMusic",
          () =>
            flags.worker
              ? workerCallUI("UpdateMusic", 1500)
              : callExport(instance, "UpdateMusic"),
          flags.worker ? { requiresWorkerReady: true, requiresWorkerIdle: true } : {},
        );
        addGuardedButton(
          "Step UpdateStreamSounds",
          () =>
            flags.worker
              ? workerCallUI("UpdateStreamSounds", 1500)
              : callExport(instance, "UpdateStreamSounds"),
          flags.worker ? { requiresWorkerReady: true, requiresWorkerIdle: true } : {},
        );

        if (!flags.worker) {
          addButton(bar, "Force MenuOpen=1", () => {
            const ok = setMutableGlobal(instance, "MenuOpen", 1);
            console.log(ok ? "set MenuOpen=1" : "failed to set MenuOpen");
          });
          addButton(bar, "Force MainMenuOpen=1", () => {
            const ok = setMutableGlobal(instance, "MainMenuOpen", 1);
            console.log(ok ? "set MainMenuOpen=1" : "failed to set MainMenuOpen");
          });
        }
      }
      if (hasMain && (!flags.worker || workerDangerEnabled)) {
        addButton(bar, "Init via Main (danger, may freeze)", () => {
          if (flags.worker) {
            workerCallUI("Main", 10_000);
          } else {
            void runInitIfPresent(core, fileIO, instance, loader, {
              forceMain: true,
            });
          }
        });
        addButton(bar, "Run Main (danger)", () => {
          if (flags.worker) {
            workerCallUI("Main", 10_000);
          } else {
            startMain(instance, core);
          }
        });
      }
      addButton(bar, "Hide overlay", () => {
        loader.overlay.style.display = "none";
      });
      // Keep on-screen logs installed.
      return;
    }

    // Safe mode: never run WASM entrypoints. Useful when the browser freezes too early to inspect.
    if (flags.safe) {
      updateLoader(loader, {
        section: "wasm",
        text: "Safe mode (not starting WASM)",
        progress: 1,
        detail: `Exports: ${exportsList.slice(0, 80).join(", ")}${exportsList.length > 80 ? ", ..." : ""
          }`,
      });
      loader.overlay.style.display = "block";
      uninstallOnscreen();
      return;
    }

    // Start Game Loop (non-blocking by default)
    // If only `Main()` exists, it may contain a tight loop that will freeze the tab in WASM.
    // Require an explicit URL opt-in: `?run=main`.
    let cancelMain = () => { };
    if (hasUpdateGame) {
      // Modules that export UpdateGame are expected to be JS-ticked.
      // Default is safe init (no Main). Opt into forcing Main via `?init=main`.
      void runInitIfPresent(core, fileIO, instance, loader, {
        forceMain: !!flags.initMain,
      });
    } else if (hasMain && flags.runMain) {
      cancelMain = startMain(instance, core);
    } else if (hasMain) {
      updateLoader(loader, {
        section: "wasm",
        text: "Blocked Main() (may freeze)",
        progress: 1,
        detail:
          "Add `?run=main` to force calling Main(), or export UpdateGame for JS-driven ticks.",
      });
      loader.overlay.style.display = "block";
      uninstallOnscreen();
      return;
    }

    // If tick=manual, don't start the RAF update loop.
    const cancelUpdate = flags.tickManual ? () => { } : startUpdateLoop(core);

    // Optional FPS limiter for render loop: `?fps=10` (or disable entirely with `?nogl=1`)
    const cancelRender = flags.noGL ? () => { } : flags.fps > 0
      ? (() => {
        let raf = 0;
        let running = true;
        const frameMs = 1000 / flags.fps;
        let last = 0;
        const loop = (t: number) => {
          if (!running) return;
          if (t - last >= frameMs) {
            last = t;
            core.beginFrame();
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => {
          running = false;
          try {
            cancelAnimationFrame(raf);
          } catch { }
        };
      })()
      : startRenderLoop(core);

    currentRuntime = {
      dispose: () => {
        try {
          cancelMain();
        } catch { }
        try {
          cancelUpdate();
        } catch { }
        try {
          cancelRender();
        } catch { }
        // HUD loop is managed globally so it can run in paused mode too.
        try {
          graphics.dispose?.();
        } catch { }
        try {
          fileIO.dispose?.({ clearCache: true });
        } catch { }
        try {
          core.dispose?.();
        } catch { }
        try {
          uninstallOnscreen();
        } catch { }
      },
    };

    if (!unloadHookInstalled) {
      window.addEventListener("beforeunload", () => {
        try {
          currentRuntime?.dispose();
        } catch { }
      });
      unloadHookInstalled = true;
    }

    // Hide loader immediately to show game
    try {
      boot.setPhase("RUNNING", "started");
    } catch { }
    updateLoader(loader, { section: "wasm", text: "Running", progress: 1 });
    loader.overlay.style.display = "none";

    // Launch Thin Client Demo if active
    if (graphics.wasmManager) {
      runThinClientDemo(graphics);
    }

    // Continue with facility assets if available
    if (
      manifestLoaded && fileIO.assetManifest?.groups?.facility_assets?.length
    ) {
      const totalAssets = fileIO.assetManifest.groups.facility_assets.length;
      let loadedAssets = 0;
      let lastUpdate = 0;

      fileIO.preloadAssetGroup("facility_assets", {
        concurrency: 2, // Reduced concurrency
        onProgress: (loaded: number, total: number | null, file?: string) => {
          loadedAssets = loaded;
          const now = performance.now();

          // Throttle UI updates to 10fps (100ms)
          if (now - lastUpdate > 100 || loaded === total) {
            diagnosticsState.Assets = `${loadedAssets}/${totalAssets}`;
            diagnosticsState.Downloads = Math.max(
              diagnosticsState.Downloads as number,
              loadedAssets,
            );
            loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
            updateLoader(loader, {
              section: "assets",
              text: "Streaming",
              progress: total ? loadedAssets / total : 0,
              detail: file ?? "",
            });
            lastUpdate = now;
          }
        },
      }).catch((err: unknown) => console.error("Facility asset preload failed:", err));
    }
  } catch (e: any) {
    console.error("Game Launch Error:", e);
    try {
      boot.setPhase("ERROR", e?.message ?? String(e));
    } catch { }
    try {
      stopBootWatchdog();
    } catch { }
    try {
      currentRuntime?.dispose();
    } catch { }
    currentRuntime = null;
    try {
      graphics.dispose?.();
    } catch { }
    try {
      fileIO.dispose?.({ clearCache: true });
    } catch { }
    try {
      core.dispose?.();
    } catch { }
    try {
      uninstallOnscreen();
    } catch { }
    updateLoader(loader, {
      section: "wasm",
      text: "Error",
      progress: 1,
      detail: e?.message ?? String(e),
    });
    loader.detail.style.color = "#ff5252";
  }
}

// Demo Scene (Thin Client)
function runThinClientDemo(graphics: Blitz3DGraphics) {
  console.log("Starting Thin Client Demo (Physics Verification)...");
  const bridge = graphics.wasmManager!.bridge;

  // 1. Create Camera (Player)
  const cam = bridge.createCamera(0);
  bridge.setPosition(cam, 0, 5, -20);
  bridge.cameraRange(cam, 0.1, 100);
  bridge.entityRadius(cam, 1, 1);
  bridge.entityType(cam, 1); // Type 1 = Player
  bridge.collisions(1, 2, 2, 2); // Player(1) -> Level(2) : Method 2 (Poly), Response 2 (Slide)

  // 2. Attach FPS Controller
  bridge.createFPSController(cam);

  // 3. Create Light
  const light = bridge.createLight(2, 0); // Point light
  bridge.setPosition(light, 0, 20, 0);
  bridge.lightRange(light, 50);

  // 4. Create Floor (Manual Mesh)
  const floor = bridge.createMeshEntity(0);
  const surf = bridge.exports.AddSurface(floor, 4, 6);
  // Manual quad (indices 0,1,2,3)
  const size = 50;
  bridge.exports.SetVertex(floor, surf, 0, -size, 0, -size, 0, 0);
  bridge.exports.SetVertex(floor, surf, 1, size, 0, -size, 1, 0);
  bridge.exports.SetVertex(floor, surf, 2, size, 0, size, 1, 1);
  bridge.exports.SetVertex(floor, surf, 3, -size, 0, size, 0, 1);

  // Triangles (indices 0,1)
  bridge.exports.SetTriangle(floor, surf, 0, 0, 2, 1);
  bridge.exports.SetTriangle(floor, surf, 1, 0, 3, 2);

  bridge.entityType(floor, 2); // Level
  bridge.entityColor(floor, 100, 100, 100); // Gray

  // 5. Create "Corner" (2 Walls)
  const wall = bridge.createMeshEntity(0);
  const wSurf = bridge.exports.AddSurface(wall, 4 + 4, 6 + 6);

  // Wall 1 (X-axis face)
  bridge.exports.SetVertex(wall, wSurf, 0, -10, 0, 5, 0, 0);
  bridge.exports.SetVertex(wall, wSurf, 1, 10, 0, 5, 1, 0);
  bridge.exports.SetVertex(wall, wSurf, 2, 10, 10, 5, 1, 1);
  bridge.exports.SetVertex(wall, wSurf, 3, -10, 10, 5, 0, 1);
  bridge.exports.SetTriangle(wall, wSurf, 0, 0, 2, 1);
  bridge.exports.SetTriangle(wall, wSurf, 1, 0, 3, 2);

  // Wall 2 (Z-axis face, forming a corner) at x=5
  bridge.exports.SetVertex(wall, wSurf, 4, 10, 0, 5, 0, 0);
  bridge.exports.SetVertex(wall, wSurf, 5, 10, 0, 25, 1, 0);
  bridge.exports.SetVertex(wall, wSurf, 6, 10, 10, 25, 1, 1);
  bridge.exports.SetVertex(wall, wSurf, 7, 10, 10, 5, 0, 1); // Overlaps with Wall 1
  bridge.exports.SetTriangle(wall, wSurf, 2, 4, 6, 5); // Index offset for triangles? No, raw indices
  bridge.exports.SetTriangle(wall, wSurf, 3, 4, 7, 6);

  bridge.entityType(wall, 2); // Level
  bridge.entityColor(wall, 200, 50, 50); // Red

  console.log("Demo setup complete. Use WASD to move into the red corner and verify sliding.");
}

// 6. Test Sound (Async stub)
// bridge.exports.EngineLoadSound(...) // Not exposed in bridge class yet, use exports
// const snd = bridge.exports.EngineLoadSound(ptr...);
// Skipped for now to keep demo simple.
init();
