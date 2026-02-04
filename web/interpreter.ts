/**
 * Blitz3D Web Interpreter (browser demo).
 *
 * This entrypoint powers `web/interpreter.html` and is bundled by Vite.
 *
 * Responsibilities:
 * - Compile Blitz3D BASIC to WASM in a Worker (`compiler_worker.ts`)
 * - Execute the compiled module in a killable sandbox worker when possible
 * - Run graphics-capable modules on the main thread using the shared SCPCB runtime
 * - Provide a small, in-page VFS for uploading assets used by `LoadImage`/`LoadTexture`/file I/O
 *
 * Note: This module is intentionally UI-driven and not exported as a library.
 */

import * as THREE from "three";
import "./src/runtime/globals.ts";

// Some runtime modules still reference window.THREE for instanceof checks.
// Ensure it exists when running the interpreter.
try {
  const g = globalThis as typeof globalThis & { THREE?: typeof THREE };
  if (!g.THREE) g.THREE = THREE;
} catch {}

import { Blitz3DCore } from "./src/runtime/core.ts";
import { Blitz3DFileIO } from "./src/runtime/fileio.ts";
import { Blitz3DGraphics } from "./src/runtime/graphics/index.ts";
import { stubMissingImports } from "./src/shared/wasm_imports.ts";
import { highlightBlitzBasicToHtml } from "./interpreter_syntax.ts";
import {
  formatHexDump,
  isAllZero,
  parseByteOffset,
} from "./interpreter_memory.ts";

// Interpreter-only: allow loading raw source model formats from the in-page VFS.
// Track B production builds should still prefer `.smpk` at runtime.
globalThis.__BLITZ3D_ALLOW_SOURCE_MODELS = true;
globalThis.__BLITZ3D_INTERPRETER_AUTOFRAME = true;

type TabName = "output" | "debug" | "canvas";
type OutputLineKind = "info" | "success" | "warning" | "error" | "output";

type VfsRecord = { bytes: Uint8Array; mime: string };

type CompileInFlight = { id: number; timeoutId: number } | null;

type ExampleInfo = {
  title: string;
  /**
   * Paths you should upload into the interpreter VFS for the example to work.
   * Use these exact strings in BB source (they are copy/paste targets).
   */
  requires?: string[];
  /** Optional extra files that improve the demo (textures, etc). */
  optional?: string[];
  /** Small notes that help avoid common gotchas. */
  notes?: string[];
  prefersTab?: TabName;
  defaultTimeoutMs?: number;
};

type CompileResult = {
  success: boolean;
  error?: string;
  wasm?: string;
  wasmBytes?: ArrayBuffer;
  size?: number;
  bbdbg?: unknown;
  wat?: string;
};

type CompilerInitMessage = { type: "init" };
type CompilerReadyMessage = { type: "ready" };
type CompilerErrorMessage = { type: "error"; message: string; stack?: string };
type CompilerCompileMessage = {
  type: "compile";
  id: number;
  source: string;
  emitWat?: boolean;
};
type CompilerCompileResultMessage =
  | {
    type: "compile_result";
    id: number;
    ok: true;
    result: CompileResult;
    wasmBytes?: ArrayBuffer;
  }
  | {
    type: "compile_result";
    id: number;
    ok: false;
    error: string;
    stack?: string;
  };

type CompilerWorkerMessage =
  | CompilerReadyMessage
  | CompilerErrorMessage
  | CompilerCompileResultMessage;

type RunnerWorkerToMainMessage =
  | { type: "stdout"; line: string }
  | { type: "warn"; line: string }
  | { type: "error"; message: string; stack?: string }
  | {
    type: "debug_state";
    stepping: boolean;
    paused: boolean;
    reason?: string;
    fileId?: number;
    line?: number;
  }
  | {
    type: "wasm_diag";
    importsTotal: number;
    bbdbgImports: string[];
    hasBbdbgEnter: boolean;
    hasBbdbgLeave: boolean;
    hasBbdbgStmt: boolean;
    importsMemory: boolean;
    exportsMemory: boolean;
  }
  | {
    type: "bbdbg";
    fileId: number;
    line: number;
    stack: number[];
  }
  | {
    type: "mem_info";
    totalBytes: number;
    pages: number;
    heapBase?: number;
    dataEnd?: number;
    stackPtr?: number;
    suggestOffset?: number;
  }
  | {
    type: "mem";
    id: number;
    offset: number;
    len: number;
    bytes: ArrayBuffer;
    totalBytes: number;
    pages: number;
  }
  | {
    type: "stubs";
    total: number;
    shown: string[];
    called: Array<
      { key: string; count: number; fileId?: number; line?: number }
    >;
  }
  | { type: "done" };

type StubCall = { key: string; count: number; fileId?: number; line?: number };
type RuntimeGapsState = {
  source: "worker" | "main" | null;
  total: number;
  shown: string[];
  called: Map<string, number>;
  callSites: Map<string, string>;
  updatedAt: number;
};

type BbdbgFileInfo = { id: number; path: string };
type BbdbgFunctionInfo = { id: number; name: string };
type BbdbgMetadata = {
  files?: BbdbgFileInfo[];
  functions?: BbdbgFunctionInfo[];
};

let bbdbgMeta: {
  fileById: Map<number, string>;
  funcById: Map<number, string>;
} = { fileById: new Map(), funcById: new Map() };
let bbdbgRaw: unknown = null;
let bbdbgLastFileId = 0;
let bbdbgLastLine = 0;
let bbdbgStack: string[] = [];
let bbdbgTrace: Array<{ fileId: number; line: number; stack: string[] }> = [];
let bbdbgRenderQueued = false;
let bbdbgEnabled = true;
let bbdbgSavedWasmSha256: string | null = null;
let bbdbgSavedAtMs: number | null = null;
let bbdbgBreakpointsByFileId = new Map<number, Set<number>>();
let bbdbgBreakpointHitThisStep = false;
let bbdbgBreakpointLastHit: { fileId: number; line: number } | null = null;

let debugSteppingActive = false;
let debugSteppingPaused = false;
let debugSteppingStepOnce = false;
let debugSteppingTick: (() => void) | null = null;

let watTextFull: string | null = null;
const WAT_PREVIEW_MAX_CHARS = 200_000;

type StoredBbdbgRecord = {
  wasmSha256: string;
  createdAtMs: number;
  bbdbgJson: string;
  sourceSha256?: string;
};

const BBDBG_DB_NAME = "blitz3d-wasm";
const BBDBG_DB_VERSION = 1;
let bbdbgDbPromise: Promise<IDBDatabase> | null = null;

function openBbdbgDb(): Promise<IDBDatabase> {
  if (bbdbgDbPromise) return bbdbgDbPromise;
  bbdbgDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(BBDBG_DB_NAME, BBDBG_DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("bbdbg")) {
        const store = db.createObjectStore("bbdbg", { keyPath: "wasmSha256" });
        store.createIndex("createdAtMs", "createdAtMs", { unique: false });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
  return bbdbgDbPromise;
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = () =>
      reject(req.error ?? new Error("IndexedDB request failed"));
    req.onsuccess = () => resolve(req.result);
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB tx failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB tx aborted"));
  });
}

async function sha256Hex(
  bytes: ArrayBuffer | ArrayBufferView,
): Promise<string> {
  const u8 = normalizeWasmBytes(bytes);
  const digest = await crypto.subtle.digest("SHA-256", u8);
  const out = new Uint8Array(digest);
  let hex = "";
  for (const b of out) hex += b.toString(16).padStart(2, "0");
  return hex;
}

async function persistBbdbgToIdb(
  wasmBytes: ArrayBuffer | ArrayBufferView,
  bbdbg: unknown,
): Promise<string> {
  const wasmSha = await sha256Hex(wasmBytes);
  const bbdbgJson = JSON.stringify(bbdbg ?? {}, null, 2);
  const record: StoredBbdbgRecord = {
    wasmSha256: wasmSha,
    createdAtMs: Date.now(),
    bbdbgJson,
  };

  const db = await openBbdbgDb();
  const tx = db.transaction(["bbdbg", "meta"], "readwrite");
  const bbdbgStore = tx.objectStore("bbdbg");
  const metaStore = tx.objectStore("meta");
  bbdbgStore.put(record);
  metaStore.put({ key: "bbdbg_latest", wasmSha256: wasmSha });
  await idbTxDone(tx);
  return wasmSha;
}

async function loadLatestBbdbgFromIdb(): Promise<StoredBbdbgRecord | null> {
  const db = await openBbdbgDb();
  const tx = db.transaction(["bbdbg", "meta"], "readonly");
  const metaStore = tx.objectStore("meta");
  const meta = await idbReq<any>(metaStore.get("bbdbg_latest"));
  const wasmSha = meta?.wasmSha256 ? String(meta.wasmSha256) : "";
  if (!wasmSha) return null;
  const bbdbgStore = tx.objectStore("bbdbg");
  const rec = await idbReq<any>(bbdbgStore.get(wasmSha));
  await idbTxDone(tx);
  if (!rec || typeof rec !== "object") return null;
  return rec as StoredBbdbgRecord;
}

const setBbdbgMetadata = (bbdbg: unknown): void => {
  bbdbgMeta = { fileById: new Map(), funcById: new Map() };
  bbdbgRaw = bbdbg;
  bbdbgLastFileId = 0;
  bbdbgLastLine = 0;
  bbdbgStack = [];
  bbdbgTrace = [];

  if (!bbdbg || typeof bbdbg !== "object") {
    scheduleBbdbgRender();
    return;
  }
  const meta = bbdbg as BbdbgMetadata;
  const files = Array.isArray(meta.files) ? meta.files : [];
  for (const f of files) {
    const id = Number((f as any)?.id ?? 0) | 0;
    const path = String((f as any)?.path ?? "");
    if (id > 0 && path) bbdbgMeta.fileById.set(id, path);
  }
  const funcs = Array.isArray(meta.functions) ? meta.functions : [];
  for (const fn of funcs) {
    const id = Number((fn as any)?.id ?? -1) | 0;
    const name = String((fn as any)?.name ?? "");
    if (id >= 0 && name) bbdbgMeta.funcById.set(id, name);
  }
  scheduleBbdbgRender();
};

const bbdbgPrimaryFileId = (): number => {
  if (bbdbgMeta.fileById.size === 1) {
    const first = bbdbgMeta.fileById.keys().next();
    if (!first.done && typeof first.value === "number") return first.value | 0;
  }
  if (bbdbgLastFileId > 0) return bbdbgLastFileId | 0;
  const next = bbdbgMeta.fileById.keys().next();
  if (!next.done && typeof next.value === "number") return next.value | 0;
  return 1;
};

const bbdbgBreakpointSetForPrimaryFile = (): Set<number> | null => {
  const fid = bbdbgPrimaryFileId();
  return bbdbgBreakpointsByFileId.get(fid) ?? null;
};

const toggleBreakpointAtLine = (line: number): void => {
  const ln = line | 0;
  if (ln <= 0) return;
  const fid = bbdbgPrimaryFileId();
  const existing = bbdbgBreakpointsByFileId.get(fid);
  const set = existing ? new Set(existing) : new Set<number>();
  if (set.has(ln)) set.delete(ln);
  else set.add(ln);
  if (set.size > 0) bbdbgBreakpointsByFileId.set(fid, set);
  else bbdbgBreakpointsByFileId.delete(fid);
  postRunnerWorkerBreakpoints();
  scheduleBbdbgRender();
  scheduleEditorDecorRender();
};

const clearAllBreakpoints = (): void => {
  bbdbgBreakpointsByFileId.clear();
  postRunnerWorkerBreakpoints();
  scheduleBbdbgRender();
  scheduleEditorDecorRender();
};

const serializeBreakpointsByFileId = (): Record<string, number[]> => {
  const out: Record<string, number[]> = {};
  for (const [fid, set] of bbdbgBreakpointsByFileId.entries()) {
    out[String(fid | 0)] = [...set].map((n) => n | 0).filter((n) => n > 0)
      .sort((a, b) => a - b);
  }
  return out;
};

const postRunnerWorkerBreakpoints = (): void => {
  if (!runnerWorker) return;
  if (getActiveMemory()) return; // main-thread run uses local hooks
  runnerWorker.postMessage({
    type: "debug_breakpoints",
    breakpointsByFileId: serializeBreakpointsByFileId(),
  });
};

const updateBbdbgButtons = (): void => {
  const active = debugSteppingActive || workerDebugSteppingActive;
  const paused = debugSteppingActive
    ? debugSteppingPaused
    : (workerDebugSteppingActive ? workerDebugPaused : false);
  bbdbgPauseBtnEl.disabled = !active || paused;
  bbdbgContinueBtnEl.disabled = !active || !paused;
  bbdbgStepBtnEl.disabled = !active || !paused;
};

const bbdbgLocString = (fileId: number, line: number): string => {
  const fid = fileId | 0;
  const l = line | 0;
  const file = bbdbgMeta.fileById.get(fid) ?? `file_${fid}`;
  return `${file}:${l}`;
};

function pauseStepping(reason: string): void {
  if (!debugSteppingActive || debugSteppingPaused) return;
  debugSteppingPaused = true;
  if (sharedStepRaf) {
    try {
      cancelAnimationFrame(sharedStepRaf);
    } catch {}
    sharedStepRaf = 0;
  }
  setStatus("paused", reason || "Paused");
  updateBbdbgButtons();
  scheduleBbdbgRender();
}

function resumeStepping(): void {
  if (!debugSteppingActive || !debugSteppingPaused) return;
  debugSteppingPaused = false;
  setStatus("running", "Running (main thread)...");
  updateBbdbgButtons();
  if (debugSteppingTick) sharedStepRaf = requestAnimationFrame(debugSteppingTick);
}

function stepOnce(): void {
  if (!debugSteppingActive || !debugSteppingPaused) return;
  debugSteppingStepOnce = true;
  debugSteppingPaused = false;
  setStatus("running", "Stepping...");
  updateBbdbgButtons();
  if (debugSteppingTick) sharedStepRaf = requestAnimationFrame(debugSteppingTick);
}

function requestWorkerDebugPause(): void {
  if (!runnerWorker) return;
  runnerWorker.postMessage({ type: "debug_pause" });
}

function requestWorkerDebugContinue(): void {
  if (!runnerWorker) return;
  runnerWorker.postMessage({ type: "debug_continue" });
}

function requestWorkerDebugStep(): void {
  if (!runnerWorker) return;
  runnerWorker.postMessage({ type: "debug_step" });
}

function requestDebugPause(): void {
  if (debugSteppingActive) pauseStepping("Paused");
  else if (workerDebugSteppingActive) requestWorkerDebugPause();
}

function requestDebugContinue(): void {
  if (debugSteppingActive) resumeStepping();
  else if (workerDebugSteppingActive) requestWorkerDebugContinue();
}

function requestDebugStep(): void {
  if (debugSteppingActive) stepOnce();
  else if (workerDebugSteppingActive) requestWorkerDebugStep();
}

const renderBbdbgPanel = (): void => {
  bbdbgRenderQueued = false;
  const fileCount = bbdbgMeta.fileById.size;
  const funcCount = bbdbgMeta.funcById.size;
  const hasMeta = fileCount > 0 || funcCount > 0;
  const lastLoc = (bbdbgLastFileId > 0 && bbdbgLastLine > 0)
    ? bbdbgLocString(bbdbgLastFileId, bbdbgLastLine)
    : "";
  const bp = bbdbgBreakpointSetForPrimaryFile();
  const bpCount = bp?.size ?? 0;
  const mode = debugSteppingActive
    ? (debugSteppingPaused
      ? " Debug: paused (main thread)."
      : " Debug: running (main thread).")
    : workerDebugSteppingActive
    ? (workerDebugPaused
      ? " Debug: paused (sandbox worker)."
      : " Debug: running (sandbox worker).")
    : " Debug: idle (Pause/Step require a program that exports __Step%()).";

  const saved = bbdbgSavedWasmSha256
    ? ` Saved: ${bbdbgSavedWasmSha256.slice(0, 12)}${
      bbdbgSavedAtMs ? ` @${new Date(bbdbgSavedAtMs).toLocaleTimeString()}` : ""
    }.`
    : "";

  bbdbgSummaryEl.textContent = hasMeta
    ? `Metadata loaded: files=${fileCount}, functions=${funcCount}. Last: ${
      lastLoc || "(none)"
    }. Breakpoints: ${bpCount}.${mode}${saved}`
    : `No debug metadata loaded. Last: ${lastLoc || "(none)"}. Breakpoints: ${bpCount}.${mode}${saved}`;

  if (!bpCount) {
    bbdbgBreakpointsEl.textContent =
      "Breakpoints: (none) — click the line gutter to toggle.";
    bbdbgBreakpointsEl.classList.add("empty");
  } else {
    bbdbgBreakpointsEl.classList.remove("empty");
    const lines = [...(bp ?? [])].sort((a, b) => a - b).slice(0, 200);
    bbdbgBreakpointsEl.innerHTML = lines
      .map((ln) => `<button class="bbdbg-bp" data-line="${ln}">${ln}</button>`)
      .join("");
  }

  const stack = bbdbgStack.length ? bbdbgStack.slice().reverse() : [];
  if (!stack.length) {
    bbdbgStackEl.textContent = "Stack: (empty)";
    bbdbgStackEl.classList.add("empty");
  } else {
    bbdbgStackEl.classList.remove("empty");
    bbdbgStackEl.textContent = `Stack:\n${stack.join(" -> ")}`;
  }

  const traceLines = bbdbgTrace.slice(-30).map((t) => {
    const loc = (t.fileId > 0 && t.line > 0)
      ? bbdbgLocString(t.fileId, t.line)
      : "(unknown)";
    const st = t.stack.length ? ` stack=${t.stack.join(" -> ")}` : "";
    return `${loc}${st}`;
  });
  if (!traceLines.length) {
    bbdbgTraceEl.textContent = "Trace: (empty)";
    bbdbgTraceEl.classList.add("empty");
  } else {
    bbdbgTraceEl.classList.remove("empty");
    bbdbgTraceEl.textContent = `Trace (last ${
      Math.min(30, bbdbgTrace.length)
    }):\n${traceLines.join("\n")}`;
  }

  setEditorExecLine(bbdbgEnabled ? bbdbgLastLine : 0);
  updateBbdbgButtons();
};

const scheduleBbdbgRender = (): void => {
  if (bbdbgRenderQueued) return;
  bbdbgRenderQueued = true;
  requestAnimationFrame(renderBbdbgPanel);
};

const resetBbdbgState = (): void => {
  bbdbgLastFileId = 0;
  bbdbgLastLine = 0;
  bbdbgStack = [];
  bbdbgTrace = [];
  renderBbdbgPanel();
  setEditorExecLine(0);
};

function setWatText(next: string | null): void {
  watTextFull = next ? String(next) : null;
  renderWatPanel();
}

function renderWatPanel(): void {
  const enabled = Boolean(watEnabledEl.checked);
  const text = watTextFull;

  if (!enabled && !text) {
    watSummaryEl.textContent =
      "WAT capture disabled. Enable “Emit on compile” and click Run.";
    watCodeEl.textContent = "";
    watCopyBtnEl.disabled = true;
    watDownloadBtnEl.disabled = true;
    return;
  }

  if (!text) {
    watSummaryEl.textContent = enabled
      ? "No WAT yet. Click Run to compile with WAT enabled."
      : "No WAT yet.";
    watCodeEl.textContent = "";
    watCopyBtnEl.disabled = true;
    watDownloadBtnEl.disabled = true;
    return;
  }

  const truncated = text.length > WAT_PREVIEW_MAX_CHARS;
  const preview = truncated ? text.slice(0, WAT_PREVIEW_MAX_CHARS) : text;
  watSummaryEl.textContent = truncated
    ? `WAT: ${text.length} chars (showing first ${WAT_PREVIEW_MAX_CHARS}).`
    : `WAT: ${text.length} chars.`;
  watCodeEl.textContent = preview;
  watCopyBtnEl.disabled = false;
  watDownloadBtnEl.disabled = false;
}

async function copyWat(): Promise<void> {
  if (!watTextFull) {
    printOutput("No WAT to copy.", "warning");
    return;
  }
  try {
    await navigator.clipboard.writeText(watTextFull);
    printOutput("WAT copied to clipboard.", "success");
  } catch (err) {
    printOutput(`Copy failed: ${errorMessage(err)}`, "error");
  }
}

function downloadWat(): void {
  if (!watTextFull) {
    printOutput("No WAT to download.", "warning");
    return;
  }
  downloadTextFile("program.wat", watTextFull, "text/plain");
}

const copyBbdbgSnapshot = async (): Promise<void> => {
  try {
    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      enabled: bbdbgEnabled,
      meta: {
        files: bbdbgMeta.fileById.size,
        functions: bbdbgMeta.funcById.size,
      },
      last: (bbdbgLastFileId > 0 && bbdbgLastLine > 0)
        ? bbdbgLocString(bbdbgLastFileId, bbdbgLastLine)
        : null,
      stack: bbdbgStack.slice().reverse(),
      trace: bbdbgTrace.slice(-200).map((t) => ({
        loc: (t.fileId > 0 && t.line > 0)
          ? bbdbgLocString(t.fileId, t.line)
          : null,
        stack: t.stack,
      })),
    };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    printOutput("bbdbg snapshot copied to clipboard.", "success");
  } catch (err) {
    printOutput(`Copy failed: ${errorMessage(err)}`, "error");
  }
};

function downloadTextFile(
  filename: string,
  text: string,
  mime = "text/plain",
): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 250);
  }
}

async function downloadBbdbgMetadata(): Promise<void> {
  try {
    const obj = bbdbgRaw;
    if (!obj || typeof obj !== "object") {
      printOutput("No bbdbg metadata loaded.", "warning");
      return;
    }
    const json = JSON.stringify(obj, null, 2);
    downloadTextFile("program.bbdbg.json", json, "application/json");
    printOutput("Downloaded program.bbdbg.json.", "success");
  } catch (err) {
    printOutput(`Download failed: ${errorMessage(err)}`, "error");
  }
}

async function loadSavedBbdbgMetadata(): Promise<void> {
  try {
    const rec = await loadLatestBbdbgFromIdb();
    if (!rec) {
      printOutput("No saved bbdbg found in IndexedDB.", "warning");
      return;
    }
    const obj = JSON.parse(String(rec.bbdbgJson || "{}"));
    bbdbgSavedWasmSha256 = String(rec.wasmSha256 || "") || null;
    bbdbgSavedAtMs = Number(rec.createdAtMs || 0) || null;
    setBbdbgMetadata(obj);
    printOutput(
      `Loaded saved bbdbg (${
        bbdbgSavedWasmSha256?.slice(0, 12) ?? "unknown"
      }).`,
      "success",
    );
  } catch (err) {
    printOutput(`Load failed: ${errorMessage(err)}`, "error");
  }
}

const errorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  return String(err);
};

const errorStack = (err: unknown): string | undefined => {
  if (err instanceof Error) return err.stack;
  return undefined;
};

const installGlobalErrorHandlers = (): void => {
  window.addEventListener("error", (e) => {
    try {
      console.error("Global error:", e.error ?? e.message);
      printOutput(`Error: ${String(e.message)}`, "error");
    } catch {
      // Ignore handler errors.
    }
  });
  window.addEventListener("unhandledrejection", (e) => {
    try {
      console.error("Unhandled rejection:", e.reason);
      printOutput(`Promise rejection: ${String(e.reason)}`, "error");
      const st = errorStack(e.reason);
      if (showStacks && st) printOutput(String(st), "error");
    } catch {
      // Ignore handler errors.
    }
  });
};

const summarizeRuntimeGaps = (): string => {
  if (runtimeGaps.total <= 0) return "No stubbed imports yet.";
  const source = runtimeGaps.source ? ` (${runtimeGaps.source})` : "";
  const calledCount = runtimeGaps.called.size;
  return `Stubbed imports: ${runtimeGaps.total}${source}. Called: ${calledCount}.`;
};

const renderRuntimeGaps = (): void => {
  runtimeGapsRenderQueued = false;
  stubsSummaryEl.textContent = summarizeRuntimeGaps();

  const shown = runtimeGaps.shown;
  if (shown.length === 0) {
    stubsListEl.textContent = "No stubbed imports captured.";
    stubsListEl.classList.add("empty");
  } else {
    stubsListEl.classList.remove("empty");
    stubsListEl.textContent = shown.slice(0, 50).join("\n");
  }

  const calledList = Array.from(runtimeGaps.called.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([key, count]) => {
      const loc = runtimeGaps.callSites.get(key);
      return loc ? `${key} ×${count} @${loc}` : `${key} ×${count}`;
    });
  if (calledList.length === 0) {
    stubsCalledEl.textContent = "No stubbed calls observed.";
    stubsCalledEl.classList.add("empty");
  } else {
    stubsCalledEl.classList.remove("empty");
    stubsCalledEl.textContent = calledList.join("\n");
  }
};

const scheduleRuntimeGapsRender = (): void => {
  if (runtimeGapsRenderQueued) return;
  runtimeGapsRenderQueued = true;
  requestAnimationFrame(renderRuntimeGaps);
};

const resetRuntimeGaps = (): void => {
  runtimeGaps = {
    source: null,
    total: 0,
    shown: [],
    called: new Map(),
    callSites: new Map(),
    updatedAt: Date.now(),
  };
  renderRuntimeGaps();
};

const applyRuntimeGapsReport = (
  source: RuntimeGapsState["source"],
  total: number,
  shown: string[],
  called: StubCall[],
): void => {
  runtimeGaps.source = source;
  runtimeGaps.total = Math.max(total | 0, 0);
  runtimeGaps.shown = shown.slice(0, 200);
  runtimeGaps.called = new Map(
    called.map((c) => [c.key, Math.max(0, c.count | 0)]),
  );
  const mergedSites = new Map<string, string>();
  for (const c of called) {
    const fileId = Number(c.fileId ?? 0) | 0;
    const line = Number(c.line ?? 0) | 0;
    if (fileId > 0 && line > 0) {
      mergedSites.set(c.key, bbdbgLocString(fileId, line));
      continue;
    }
    const prev = runtimeGaps.callSites.get(c.key);
    if (prev) mergedSites.set(c.key, prev);
  }
  runtimeGaps.callSites = mergedSites;
  runtimeGaps.updatedAt = Date.now();
  renderRuntimeGaps();
};

const buildRuntimeGapsPayload = () => {
  const called = Array.from(runtimeGaps.called.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      key,
      count,
      loc: runtimeGaps.callSites.get(key) ?? null,
    }));
  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    source: runtimeGaps.source,
    total: runtimeGaps.total,
    shown: runtimeGaps.shown.slice(0, 200),
    called,
  };
};

const exportRuntimeGaps = (): void => {
  const json = JSON.stringify(buildRuntimeGapsPayload(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blitz3d-runtime-gaps-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const copyRuntimeGaps = async (): Promise<void> => {
  try {
    const json = JSON.stringify(buildRuntimeGapsPayload(), null, 2);
    await navigator.clipboard.writeText(json);
    printOutput("Runtime gaps JSON copied to clipboard.", "success");
  } catch (err) {
    printOutput(`Copy failed: ${errorMessage(err)}`, "error");
  }
};

// --- STATE ---
let sharedCore: Blitz3DCore | null = null;
let sharedFileIO: Blitz3DFileIO | null = null;
let sharedGraphics: Blitz3DGraphics | null = null;
let sharedInstance: WebAssembly.Instance | null = null;
let sharedStepRaf = 0;
let sharedStopRequested = false;
let isCompiling = false;
let compilerWorker: Worker | null = null;
let compilerWorkerReady = false;
let compilerInitPromise: Promise<boolean> | null = null;
let compileReqId = 1;
let compileInFlight: CompileInFlight = null;
let isRunning = false;
let runtimeGaps: RuntimeGapsState = {
  source: null,
  total: 0,
  shown: [],
  called: new Map(),
  callSites: new Map(),
  updatedAt: 0,
};
let runtimeGapsRenderQueued = false;

const showStacks = new URLSearchParams(window.location.search)
  .has("stack");

// --- DOM ELEMENTS ---
const mustGetEl = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el as T;
};

const editorEl = mustGetEl<HTMLTextAreaElement>("editor");
const editorGutterEl = mustGetEl<HTMLDivElement>("editor-gutter");
const editorHighlightEl = mustGetEl<HTMLPreElement>("editor-highlight");
const outputEl = mustGetEl<HTMLDivElement>("output");
const statusIndicatorEl = mustGetEl<HTMLSpanElement>("status-indicator");
const statusTextEl = mustGetEl<HTMLSpanElement>("status-text");
const canvasContainerEl = mustGetEl<HTMLDivElement>("canvas-container");
const gameCanvasEl = mustGetEl<HTMLCanvasElement>("game-canvas");
const hudCanvasEl = mustGetEl<HTMLCanvasElement>("hud-canvas");
const stubsSummaryEl = mustGetEl<HTMLDivElement>("stubs-summary");
const stubsListEl = mustGetEl<HTMLDivElement>("stubs-list");
const stubsCalledEl = mustGetEl<HTMLDivElement>("stubs-called");
const stubsClearBtnEl = mustGetEl<HTMLButtonElement>("stubs-clear-btn");
const stubsCopyBtnEl = mustGetEl<HTMLButtonElement>("stubs-copy-btn");
const stubsExportBtnEl = mustGetEl<HTMLButtonElement>("stubs-export-btn");
const bbdbgSummaryEl = mustGetEl<HTMLDivElement>("bbdbg-summary");
const bbdbgBreakpointsEl = mustGetEl<HTMLDivElement>("bbdbg-breakpoints");
const bbdbgStackEl = mustGetEl<HTMLDivElement>("bbdbg-stack");
const bbdbgTraceEl = mustGetEl<HTMLDivElement>("bbdbg-trace");
const bbdbgEnabledEl = mustGetEl<HTMLInputElement>("bbdbg-enabled");
const bbdbgPauseBtnEl = mustGetEl<HTMLButtonElement>("bbdbg-pause-btn");
const bbdbgContinueBtnEl = mustGetEl<HTMLButtonElement>("bbdbg-continue-btn");
const bbdbgStepBtnEl = mustGetEl<HTMLButtonElement>("bbdbg-step-btn");
const bbdbgClearBpsBtnEl = mustGetEl<HTMLButtonElement>("bbdbg-clear-bps-btn");
const bbdbgClearBtnEl = mustGetEl<HTMLButtonElement>("bbdbg-clear-btn");
const bbdbgCopyBtnEl = mustGetEl<HTMLButtonElement>("bbdbg-copy-btn");
const bbdbgDownloadMetaBtnEl = mustGetEl<HTMLButtonElement>(
  "bbdbg-download-meta-btn",
);
const bbdbgLoadSavedBtnEl = mustGetEl<HTMLButtonElement>(
  "bbdbg-load-saved-btn",
);
const runBtnEl = mustGetEl<HTMLButtonElement>("run-btn");
const stopBtnEl = mustGetEl<HTMLButtonElement>("stop-btn");
const clearBtnEl = mustGetEl<HTMLButtonElement>("clear-btn");
const exampleSelectEl = mustGetEl<HTMLSelectElement>("example-select");
const timeoutMsEl = mustGetEl<HTMLInputElement>("timeout-ms");
const vfsUploadEl = mustGetEl<HTMLInputElement>("vfs-upload");
const vfsPrefixEl = mustGetEl<HTMLInputElement>("vfs-prefix");
const vfsListEl = mustGetEl<HTMLDivElement>("vfs-list");
const vfsClearBtnEl = mustGetEl<HTMLButtonElement>("vfs-clear-btn");
const exampleReqEl = mustGetEl<HTMLDivElement>("example-req");
const memOffsetEl = mustGetEl<HTMLInputElement>("mem-offset");
const memLenEl = mustGetEl<HTMLInputElement>("mem-len");
const memAutoEl = mustGetEl<HTMLInputElement>("mem-auto");
const memRefreshBtnEl = mustGetEl<HTMLButtonElement>("mem-refresh-btn");
const memSummaryEl = mustGetEl<HTMLDivElement>("mem-summary");
const memDumpEl = mustGetEl<HTMLPreElement>("mem-dump");
const watEnabledEl = mustGetEl<HTMLInputElement>("wat-enabled");
const watClearBtnEl = mustGetEl<HTMLButtonElement>("wat-clear-btn");
const watCopyBtnEl = mustGetEl<HTMLButtonElement>("wat-copy-btn");
const watDownloadBtnEl = mustGetEl<HTMLButtonElement>("wat-download-btn");
const watSummaryEl = mustGetEl<HTMLDivElement>("wat-summary");
const watCodeEl = mustGetEl<HTMLPreElement>("wat-code");

let editorDecorQueued = false;
let editorExecLine = 0;
let memAutoTimer: number | null = null;
let memOffsetTouched = false;
let workerMemReqId = 1;
let workerMemInFlight = false;
let workerMemSnapshot: {
  id: number;
  offset: number;
  len: number;
  bytes: Uint8Array;
  totalBytes: number;
  pages: number;
  updatedAtMs: number;
} | null = null;
let workerMemInfo: {
  totalBytes: number;
  pages: number;
  heapBase?: number;
  dataEnd?: number;
  stackPtr?: number;
  suggestOffset?: number;
} | null = null;
let workerBbdbgLast: {
  fileId: number;
  line: number;
  stack: number[];
  updatedAtMs: number;
} | null = null;
let workerDebugSteppingActive = false;
let workerDebugPaused = false;

// --- VFS (interpreter-only) ---
const vfs = new Map<string, VfsRecord>(); // normalizedPath -> bytes/mime
const vfsObjectUrls = new Map<string, string>(); // normalizedPath -> objectURL
let vfsCwd = "";

/** Normalize a user-provided VFS path into a stable key. */
function normalizeVfsPath(path: unknown): string {
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

/** Best-effort MIME guess for uploaded VFS files. */
function guessMime(path: string): string {
  const p = String(path).toLowerCase();
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".json")) return "application/json";
  if (p.endsWith(".txt") || p.endsWith(".ini")) return "text/plain";
  return "application/octet-stream";
}

/** Add/replace a file in the interpreter VFS. */
function vfsPut(path: string, bytes: Uint8Array, mime?: string): void {
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

function vfsGet(path: string): VfsRecord | null {
  const key = normalizeVfsPath(path);
  return vfs.get(key) || null;
}

function vfsGetObjectUrl(path: string): string | null {
  const raw = normalizeVfsPath(path);

  const candidates: string[] = [];
  const push = (p: string) => {
    const k = normalizeVfsPath(p);
    if (!k) return;
    if (!candidates.includes(k)) candidates.push(k);
  };

  // Exact
  push(raw);

  // Common SCPCB/Blitz patterns: implicit `assets/` prefix and basename lookups.
  if (!raw.toLowerCase().startsWith("assets/")) push(`assets/${raw}`);
  const leaf = raw.split("/").pop();
  if (leaf && leaf !== raw) {
    push(leaf);
    push(`assets/${leaf}`);
  }

  // Case-insensitive match: many assets come from Windows paths.
  const byLower = new Map<string, string>();
  for (const k of vfs.keys()) byLower.set(k.toLowerCase(), k);
  for (const c of [...candidates]) {
    const hit = byLower.get(c.toLowerCase());
    if (hit) candidates.unshift(hit);
  }

  for (const key of candidates) {
    const existing = vfsObjectUrls.get(key);
    if (existing) return existing;
    const rec = vfs.get(key);
    if (!rec) continue;
    // Deno's DOM lib types require ArrayBuffer-backed views for BlobParts.
    // `Uint8Array` can be backed by a `SharedArrayBuffer`, so copy first.
    const safeBytes = new Uint8Array(rec.bytes.byteLength);
    safeBytes.set(rec.bytes);
    const url = URL.createObjectURL(new Blob([safeBytes], { type: rec.mime }));
    vfsObjectUrls.set(key, url);
    return url;
  }

  return null;
}

function vfsClear(): void {
  for (const url of vfsObjectUrls.values()) URL.revokeObjectURL(url);
  vfsObjectUrls.clear();
  vfs.clear();
  renderVfsList();
}

function renderVfsList(): void {
  vfsListEl.innerHTML = "";
  const entries = [...vfs.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "output-line info";
    empty.textContent = "VFS is empty.";
    vfsListEl.appendChild(empty);
    return;
  }

  const header = document.createElement("div");
  header.className = "output-line info";
  header.textContent = `Uploaded: ${entries.length} file(s)`;
  vfsListEl.appendChild(header);

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

function normalizeWasmBytes(input: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input;
  if (ArrayBuffer.isView(input)) {
    // `input.buffer` may be a SharedArrayBuffer; ensure we return a real ArrayBuffer.
    const view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    return view.slice().buffer;
  }
  throw new Error("Invalid WASM bytes (expected ArrayBuffer or TypedArray)");
}

// --- EXAMPLES ---
const examples: Record<string, string> = {
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

  debugCallStack: `; Debug: Call Stack + Trace (prints only)
;
; This example is meant to exercise bbdbg function enter/leave and statement trace.
; It also allocates many strings (useful for the WASM Memory panel).

Global g_i% = 1
Global g_total% = 0
Global g_inited% = 0

Function Init%()
  SeedRnd 123
  g_i = 1
  g_total = 0
  g_inited = 1
End Function

Function Add%(a%, b%)
  Return a + b
End Function

Function MakeMsg$(i%)
  Local s$ = "i=" + i
  s$ = s$ + " sum=" + Add(i, i * 2)
  s$ = s$ + " rnd=" + Rand(1, 9)
  Return s$
End Function

Function __Step%()
  If g_inited = 0 Then Init()
  If g_i <= 25 Then
    g_total = g_total + g_i
    Print MakeMsg(g_i)
    g_i = g_i + 1
    Return 0
  EndIf
  Print "total=" + g_total
  End
End Function`,

  debugStubs: `; Debug: Runtime Gaps (prints only)
;
; Intentionally call unknown functions so they become stubbed imports.
; When bbdbg stmt hooks are enabled, the stubs panel should attribute call sites.

Print "About to call missing imports..."
MissingFuncA 123
MissingFuncB "hello"
Print "If you see this, the stubs returned 0 and execution continued."`,

  memoryArray: `; Debug: Memory (Array Fill) (prints only)
;
; Fills a large integer array so the heap contains non-zero data beyond strings.
; (Avoids edge-case operators that may not be supported in all builds.)

; Oversize by 1 to avoid ambiguity in Dim semantics (0..n vs 0..n-1).
Dim a%(2048)
Local i%
For i = 0 To 2047
  a(i) = i * 37 + i * 2 + 123
Next

Print "a(0)=" + a(0)
Print "a(1)=" + a(1)
Print "a(1024)=" + a(1024)
Print "a(2047)=" + a(2047)

; Also allocate some strings to create readable patterns in memory dumps.
Local s$ = ""
Local idx% = 1
For i = 1 To 120
  s$ = s$ + Chr(64 + idx)
  idx% = idx% + 1
  If idx% > 26 Then idx% = 1
Next
Print "slen=" + Len(s$)`,

  graphics: `; 3D Cube Demo (one-shot render)
Graphics3D 800, 600, 32, 2

; Create camera + cube and render one frame.
cam = CreateCamera()
cube = CreateCube()
PositionEntity cube, 0, 0, 0

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

cam = CreateCamera()
cube = CreateCube()
EntityColor cube, 30, 144, 255 ; blue faces
PositionEntity cube, 0, 0, 0

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

cam = CreateCamera()
cube = CreateCube()
EntityColor cube, 30, 144, 255 ; blue faces
PositionEntity cube, 0, 0, 0

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

cam = CreateCamera()
cube = CreateCube()
PositionEntity cube, 0, 0, 0

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
cam = CreateCamera()
cube = CreateCube()
EntityColor cube, 255, 255, 255 ; ensure texture isn't tinted dark
PositionEntity cube, 0, 0, 0

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
FogRange 2, 12

cam = CreateCamera()
cube = CreateCube()
EntityColor cube, 30, 144, 255
PositionEntity cube, 0, 0, 0

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

cam = CreateCamera()

m = CreateMesh()
Local s = CreateSurface(m)

v0 = AddVertex(s, -1, -1, 0, 0, 0)
v1 = AddVertex(s,  1, -1, 0, 1, 0)
v2 = AddVertex(s,  0,  1, 0, 0.5, 1)
AddTriangle s, v0, v1, v2
UpdateNormals m

EntityColor m, 30, 144, 255
PositionEntity m, 0, 0, 0

Print "Procedural mesh demo running (stepped)."
Print "Click Stop to end."

	Function __Step%()
	  TurnEntity m, 0, 1, 0
	  RenderWorld
	  Flip
	End Function`,

  b3dInspectRender: `; B3D inspect + render (upload a .b3d file to VFS first)
; Suggested path: assets/173_2.b3d (SCPCB) or assets/model.b3d
; Optional textures can also be uploaded (same folder). If your model references
; textures by basename only, upload them into the same VFS folder.

Local path$ = "assets/173_2.b3d"

Print "== B3D Inspect =="
Print "Path: " + path$
Print "FileType:"
Print FileType(path$)

; Peek 4-byte signature: should be "BB3D"
Local h% = ReadFile(path$)
If h = 0 Then
  Print "Failed to open file. Upload it to VFS as " + path$
  End
EndIf

Local b0% = ReadByte(h)
Local b1% = ReadByte(h)
Local b2% = ReadByte(h)
Local b3% = ReadByte(h)
CloseFile h

Print "Sig: " + Chr(b0) + Chr(b1) + Chr(b2) + Chr(b3)

Graphics3D 800, 600, 0, 2
ClsColor 10, 10, 14
AmbientLight 60, 60, 70

Local cam% = CreateCamera()
PositionEntity cam, 0, 1.3, -3

Local light% = CreateLight()
LightColor light, 255, 255, 255
LightRange light, 25
PositionEntity light, 2, 4, -2

; Fill light (directional)
Local sun% = CreateLight(0)
LightColor sun, 220, 220, 255
PositionEntity sun, 0, 10, -10

Local m% = LoadMesh(path$, 0)
PositionEntity m, 0, 0, 0

Print "Loaded entity id: " + m
Print "If you only see a placeholder, the loader couldn't parse the file."
Print "Click Stop to end."

Function __Step%()
  TurnEntity m, 0, 0.7, 0
  RenderWorld
  Flip
End Function`,

  xInspectRender: `; DirectX .x inspect + render (text format)
; Suggested path: assets/cup.x (SCPCB) or assets/model.x

Local path$ = "assets/cup.x"

Print "== X Inspect =="
Print "Path: " + path$
Print "FileType:"
Print FileType(path$)

Local h% = ReadFile(path$)
If h = 0 Then
  Print "Failed to open file. Upload it to VFS as " + path$
  End
EndIf

; Read first 12 bytes for header "xof 0303txt"
Local hdr$ = ""
For i = 1 To 12
  hdr$ = hdr$ + Chr(ReadByte(h))
Next
CloseFile h

Print "Header: " + hdr$

Graphics3D 800, 600, 0, 2
ClsColor 10, 10, 14
AmbientLight 60, 60, 70

Local cam% = CreateCamera()
PositionEntity cam, 0, 1.3, -3

Local light% = CreateLight()
LightColor light, 255, 255, 255
LightRange light, 25
PositionEntity light, 2, 4, -2

; Fill light (directional)
Local sun% = CreateLight(0)
LightColor sun, 220, 220, 255
PositionEntity sun, 0, 10, -10

Local m% = LoadMesh(path$, 0)
PositionEntity m, 0, 0, 0

Print "Loaded entity id: " + m
Print "Click Stop to end."

Function __Step%()
  TurnEntity m, 0, 0.7, 0
  RenderWorld
  Flip
End Function`,

  rmeshInspectRender: `; RMESH inspect + render (SCPCB room mesh)
; Suggested path: assets/checkpoint2_opt.rmesh (SCPCB) or assets/room.rmesh
; If you upload using SCPCB's original paths, use the same in LoadMesh (e.g. "GFX/map/room1.rmesh").

Local path$ = "assets/checkpoint2_opt.rmesh"

Print "== RMESH Inspect =="
Print "Path: " + path$
Print "FileType:"
Print FileType(path$)

; RMESH begins with an i32 length, then the header string ("RoomMesh" or "RoomMesh.HasTriggerBox")
Function ReadI32LE%(h%)
  Local b0% = ReadByte(h)
  Local b1% = ReadByte(h)
  Local b2% = ReadByte(h)
  Local b3% = ReadByte(h)
  Return (b0) Or (b1 Shl 8) Or (b2 Shl 16) Or (b3 Shl 24)
End Function

Function ReadLenString$(h%)
  Local n% = ReadI32LE(h)
  If n < 0 Or n > 1048576 Then Return "<bad_len:" + n + ">"
  Local s$ = ""
  For i = 1 To n
    s$ = s$ + Chr(ReadByte(h))
  Next
  Return s$
End Function

Local h% = ReadFile(path$)
If h = 0 Then
  Print "Failed to open file. Upload it to VFS as " + path$
  End
EndIf
Local header$ = ReadLenString(h)
CloseFile h
Print "Header: " + header$

Graphics3D 1000, 700, 0, 2
ClsColor 10, 10, 14
AmbientLight 60, 60, 70

Local cam% = CreateCamera()
PositionEntity cam, 0, 1.6, -4

Local light% = CreateLight()
LightColor light, 255, 255, 255
LightRange light, 35
PositionEntity light, 2, 5, -2

; Fill light (directional)
Local sun% = CreateLight(0)
LightColor sun, 220, 220, 255
PositionEntity sun, 0, 12, -10

Local room% = LoadMesh(path$, 0)
PositionEntity room, 0, 0, 0

Print "Loaded entity id: " + room
Print "Click Stop to end."

Function __Step%()
  TurnEntity room, 0, 0.2, 0
  RenderWorld
  Flip
End Function`,
};

const exampleInfo: Record<string, ExampleInfo> = {
  hello: { title: "Hello World", prefersTab: "output" },
  languageBasics: { title: "Language Basics", prefersTab: "output" },
  arrays: { title: "Arrays", prefersTab: "output" },
  customTypes: { title: "Custom Types + For Each", prefersTab: "output" },
  dataReadRestore: { title: "Data/Read/Restore", prefersTab: "output" },
  stringsMath: { title: "Strings + Math", prefersTab: "output" },
  debugCallStack: {
    title: "Debug: Call Stack",
    prefersTab: "debug",
    notes: [
      "Watch the Debug (bbdbg) panel update with a stack + recent trace.",
      "The WASM Memory panel should also show changing heap contents.",
    ],
  },
  debugStubs: {
    title: "Debug: Runtime Gaps",
    prefersTab: "debug",
    notes: [
      "This intentionally calls unknown functions to generate stubbed imports.",
      "If bbdbg stmt hooks are present, the stubs panel should capture call sites.",
    ],
  },
  memoryArray: {
    title: "Debug: Memory (Array Fill)",
    prefersTab: "debug",
    notes: [
      "This fills a large integer array so memory dumps show non-zero data.",
      "Try the WASM Memory panel with Auto enabled while it runs.",
    ],
  },
  graphics: {
    title: "Graphics Demo",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
  },
  rotatingCube: {
    title: "Rotating Cube Demo",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
  },
  rotatingCubeEdges: {
    title: "Rotating Cube (Blue + Edges)",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
  },
  rotatingCubeColor: {
    title: "Rotating Cube + Color Cycle",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
  },
  hud2D: { title: "2D HUD Demo", prefersTab: "canvas", defaultTimeoutMs: 0 },
  inputHud: {
    title: "Input HUD Demo",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
  },
  image2D: {
    title: "2D Image Demo",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
    requires: ["assets/badge1.jpg"],
    notes: ["Upload a JPG/PNG into the VFS as the required path."],
  },
  imageDebug: {
    title: "Image Debug (PNG/JPG)",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
    requires: ["assets/demo.png (or assets/demo.jpg)"],
    notes: [
      "This demo is useful to confirm decoding + alpha in the VFS pipeline.",
    ],
  },
  textureCube: {
    title: "Textured Cube Demo",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
    requires: ["assets/ws_in_the_chat_fd_signifier_clip.gif"],
    optional: ["assets/wafrn-logo.png"],
    notes: ["GIF decoding may be slower than PNG/JPG depending on browser."],
  },
  vfsFileIO: {
    title: "VFS File I/O Demo",
    prefersTab: "output",
    defaultTimeoutMs: 0,
    requires: ["assets/demo.txt"],
    notes: ["Uses ReadFile/ReadLine to show Blitz-style file IO over the VFS."],
  },
  fogCube: { title: "Fog Demo", prefersTab: "canvas", defaultTimeoutMs: 0 },
  proceduralMesh: {
    title: "Procedural Mesh Demo",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
  },
  b3dInspectRender: {
    title: "B3D: Inspect + Render",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
    requires: ["assets/173_2.b3d (or assets/model.b3d)"],
    optional: ["Any referenced textures (same folder or basename-matched)"],
    notes: [
      "If the model references Windows paths, upload the texture by basename (e.g. guard_diffuse.jpg).",
      "The interpreter tries to pick a sensible diffuse texture stage, but multi-texture materials may still look off.",
    ],
  },
  xInspectRender: {
    title: "X: Inspect + Render",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
    requires: ["assets/cup.x (or assets/model.x)"],
    optional: ["Any referenced textures (same folder or basename-matched)"],
    notes: [
      "Only text .x is supported in the interpreter path (header like xof 0303txt).",
    ],
  },
  rmeshInspectRender: {
    title: "RMESH: Inspect + Render",
    prefersTab: "canvas",
    defaultTimeoutMs: 0,
    requires: ["assets/checkpoint2_opt.rmesh (or assets/room.rmesh)"],
    optional: ["Room textures + optional lightmaps, if referenced"],
    notes: [
      "RMESH variants differ across SCPCB forks; this is a best-effort exploration loader.",
    ],
  },
};

function renderExampleRequirements(exampleKey: string): void {
  const info = exampleInfo[exampleKey];
  if (!info) {
    exampleReqEl.innerHTML =
      `<strong>Example requirements</strong>: select an example to see required VFS paths.`;
    return;
  }

  const parts: string[] = [];
  parts.push(`<strong>Example</strong>: ${escapeHtml(info.title)}`);

  if (info.requires && info.requires.length > 0) {
    parts.push(
      `<strong>Required uploads</strong>:` + renderPathList(info.requires),
    );
  } else {
    parts.push(`<strong>Required uploads</strong>: none`);
  }

  if (info.optional && info.optional.length > 0) {
    parts.push(`<strong>Optional</strong>:` + renderPathList(info.optional));
  }

  if (info.notes && info.notes.length > 0) {
    parts.push(`<strong>Notes</strong>:` + renderNoteList(info.notes));
  }

  exampleReqEl.innerHTML = parts.join("<br/>");
}

function renderPathList(items: string[]): string {
  return `<ul>` +
    items.map((p) => `<li><code>${escapeHtml(p)}</code></li>`).join("") +
    `</ul>`;
}

function renderNoteList(items: string[]): string {
  return `<ul>` + items.map((p) => `<li>${escapeHtml(p)}</li>`).join("") +
    `</ul>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- EDITOR (syntax highlighting + line numbers) ---
// (Syntax highlighting implementation lives in interpreter_syntax.ts)

function enableEditorEnhancements(): void {
  document.body.classList.add("editor-enhanced");
  scheduleEditorDecorRender();
}

function scheduleEditorDecorRender(): void {
  if (editorDecorQueued) return;
  editorDecorQueued = true;
  requestAnimationFrame(() => {
    editorDecorQueued = false;
    renderEditorDecor();
  });
}

function renderEditorDecor(): void {
  const { html, lineCount } = highlightBlitzBasicToHtml(editorEl.value ?? "");
  editorHighlightEl.innerHTML = html;
  renderEditorGutter(lineCount);
  syncEditorScroll();
}

function renderEditorGutter(lineCount: number): void {
  const n = Math.max(1, lineCount | 0);
  const bps = bbdbgBreakpointSetForPrimaryFile();
  const parts: string[] = [];
  for (let i = 1; i <= n; i++) {
    const isExec = i === editorExecLine;
    const isBp = Boolean(bps && bps.has(i));
    const cls = [
      "editor-linenum",
      isExec ? "exec" : "",
      isBp ? "breakpoint" : "",
    ].filter(Boolean).join(" ");
    parts.push(`<div class="${cls}" data-line="${i}">${i}</div>`);
  }
  editorGutterEl.innerHTML = parts.join("");
}

function syncEditorScroll(): void {
  editorHighlightEl.scrollTop = editorEl.scrollTop;
  editorHighlightEl.scrollLeft = editorEl.scrollLeft;
  editorGutterEl.scrollTop = editorEl.scrollTop;
}

function setEditorExecLine(line: number): void {
  const next = Math.max(0, line | 0);
  if (next === editorExecLine) return;
  editorExecLine = next;
  scheduleEditorDecorRender();
}

function jumpToEditorLine(line: number): void {
  const target = Math.max(1, line | 0);
  const text = editorEl.value ?? "";
  let pos = 0;
  let current = 1;
  while (current < target && pos < text.length) {
    const nl = text.indexOf("\n", pos);
    if (nl === -1) break;
    pos = nl + 1;
    current++;
  }
  editorEl.focus();
  editorEl.setSelectionRange(pos, pos);
  scheduleEditorDecorRender();
}

// --- WASM MEMORY VIEWER (main-thread runtime only) ---
function getActiveMemory(): WebAssembly.Memory | null {
  const mem: WebAssembly.Memory | undefined =
    sharedCore?.memory ||
    (sharedInstance ? (sharedInstance.exports as any)?.memory : undefined);
  return mem instanceof WebAssembly.Memory ? mem : null;
}

function resetWorkerMemSnapshot(): void {
  workerMemInFlight = false;
  workerMemSnapshot = null;
}

function requestWorkerMemorySnapshot(force = false): void {
  if (!runnerWorker) return;
  if (workerMemInFlight && !force) return;

  const offset = Math.max(0, parseByteOffset(memOffsetEl.value));
  const wantLen = Math.min(
    16384,
    Math.max(16, Number(memLenEl.value || 256) | 0),
  );
  const id = workerMemReqId++;
  workerMemInFlight = true;
  runnerWorker.postMessage({
    type: "mem_request",
    id,
    offset,
    len: wantLen,
  });
}

function postWorkerMemConfig(): void {
  if (!runnerWorker) return;
  if (getActiveMemory()) return;
  const offset = Math.max(0, parseByteOffset(memOffsetEl.value));
  const wantLen = Math.min(
    16384,
    Math.max(16, Number(memLenEl.value || 256) | 0),
  );
  runnerWorker.postMessage({
    type: "mem_config",
    auto: Boolean(memAutoEl.checked),
    offset,
    len: wantLen,
    intervalMs: 250,
  });
}

function renderMemoryPanel(): void {
  const mem = getActiveMemory();
  if (!mem) {
    if (runnerWorker) {
      const offset = Math.max(0, parseByteOffset(memOffsetEl.value));
      const wantLen = Math.min(
        16384,
        Math.max(16, Number(memLenEl.value || 256) | 0),
      );
      const snap = workerMemSnapshot;
      const matches = snap && snap.offset === offset && snap.len === wantLen;

      postWorkerMemConfig();
      if (!matches) requestWorkerMemorySnapshot();

      if (!snap) {
        memSummaryEl.textContent =
          `worker: waiting for snapshot @${offset} len=${wantLen}`;
        memDumpEl.textContent = "";
        return;
      }

      if (
        !memOffsetTouched &&
        offset === 0 &&
        isAllZero(snap.bytes) &&
        workerMemInfo?.heapBase &&
        workerMemInfo.heapBase > 0
      ) {
        memOffsetEl.value = `0x${workerMemInfo.heapBase.toString(16)}`;
        requestWorkerMemorySnapshot(true);
        memSummaryEl.textContent =
          `worker: @0x0 was all zeros; jumping to heap @0x${
            workerMemInfo.heapBase.toString(16)
          }`;
        memDumpEl.textContent = "";
        return;
      }

      const ageMs = Math.max(0, Date.now() - snap.updatedAtMs);
      const hints: string[] = [];
      if (workerMemInfo?.heapBase) hints.push(`heap=0x${workerMemInfo.heapBase.toString(16)}`);
      if (workerMemInfo?.dataEnd) hints.push(`data_end=0x${workerMemInfo.dataEnd.toString(16)}`);
      if (workerMemInfo?.stackPtr) hints.push(`sp=0x${workerMemInfo.stackPtr.toString(16)}`);
      const hintStr = hints.length ? `; ${hints.join(" ")}` : "";

      memSummaryEl.textContent =
        `worker: memory=${snap.pages} page(s) (${snap.totalBytes} bytes), ` +
        `dump @${snap.offset} len=${snap.len} (age ${ageMs}ms)${hintStr}`;
      memDumpEl.textContent = formatHexDump(snap.bytes, snap.offset);
      return;
    }

    if (workerMemSnapshot) {
      const snap = workerMemSnapshot;
      const ageMs = Math.max(0, Date.now() - snap.updatedAtMs);
      memSummaryEl.textContent =
        `worker: last snapshot (stale) memory=${snap.pages} page(s) (${snap.totalBytes} bytes), ` +
        `dump @${snap.offset} len=${snap.len} (age ${ageMs}ms)`;
      memDumpEl.textContent = formatHexDump(snap.bytes, snap.offset);
      return;
    }

    memSummaryEl.textContent = "No active module memory yet.";
    memDumpEl.textContent = "";
    return;
  }

  const totalBytes = mem.buffer.byteLength;
  const pages = Math.floor(totalBytes / 65536);
  const offset = Math.max(0, parseByteOffset(memOffsetEl.value));
  const wantLen = Math.min(
    16384,
    Math.max(16, Number(memLenEl.value || 256) | 0),
  );
  const start = Math.min(offset, Math.max(0, totalBytes - 1));
  const len = Math.min(wantLen, Math.max(0, totalBytes - start));

  memSummaryEl.textContent =
    `memory=${pages} page(s) (${totalBytes} bytes), dump @${start} len=${len}`;

  const view = new Uint8Array(mem.buffer, start, len);
  memDumpEl.textContent = formatHexDump(view, start);
}

function stopMemoryAutoRefresh(): void {
  if (memAutoTimer !== null) {
    clearInterval(memAutoTimer);
    memAutoTimer = null;
  }
}

function applyMemoryAutoRefresh(): void {
  stopMemoryAutoRefresh();
  if (!memAutoEl.checked) return;
  renderMemoryPanel();
  memAutoTimer = setInterval(() => {
    try {
      if (getActiveMemory()) {
        renderMemoryPanel();
        return;
      }
      if (runnerWorker) {
        requestWorkerMemorySnapshot();
        return;
      }
    } catch {
      // keep best-effort
    }
  }, 250) as unknown as number;
}

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", async () => {
  installGlobalErrorHandlers();
  // Interpreter runs are stepped/cooperative; disable the graphics module's internal RAF loop
  // so Pause/Step actually freeze rendering and `RenderWorld()` can be the explicit draw hook.
  (globalThis as any).__BLITZ3D_NO_AUTO_RAF = true;
  // Surface async loader failures (B3D/X/RMesh) in the Output pane instead of only the devtools console.
  (globalThis as any).__BLITZ3D_INTERPRETER_ASYNC_ERROR = (msg: unknown) => {
    try {
      const s = typeof msg === "string" ? msg : String(msg);
      printOutput(s, "error");
    } catch {
      // ignore
    }
  };
  editorEl.value = examples.hello;
  enableEditorEnhancements();
  renderExampleRequirements("hello");
  runBtnEl.disabled = true;
  printOutput(`Three.js v${THREE.REVISION} loaded.`, "success");
  printOutput("Using shared SCPCB runtime for graphics.", "info");
  resetRuntimeGaps();
  bbdbgEnabled = true;
  bbdbgEnabledEl.checked = true;
  resetBbdbgState();
  renderMemoryPanel();
  renderWatPanel();
  updateBbdbgButtons();

  setupEventListeners();
  await initCompiler();
});

function setupEventListeners() {
  runBtnEl.addEventListener("click", runCode);
  stopBtnEl.addEventListener("click", () => stopExecution());
  clearBtnEl.addEventListener("click", () => clearOutput());
  editorEl.addEventListener("input", () => scheduleEditorDecorRender());
  editorEl.addEventListener("scroll", () => syncEditorScroll());
  editorGutterEl.addEventListener("click", (e) => {
    const ev = e as MouseEvent;
    const target = e.target as HTMLElement | null;
    const lineEl = target?.closest?.(".editor-linenum") as HTMLElement | null;
    const raw = lineEl?.getAttribute?.("data-line") ?? "";
    const line = Number(raw) | 0;
    if (line <= 0) return;
    if (ev.metaKey || ev.ctrlKey) {
      jumpToEditorLine(line);
      return;
    }
    toggleBreakpointAtLine(line);
  });
  stubsClearBtnEl.addEventListener("click", () => resetRuntimeGaps());
  stubsCopyBtnEl.addEventListener("click", () => void copyRuntimeGaps());
  stubsExportBtnEl.addEventListener("click", () => exportRuntimeGaps());
  bbdbgEnabledEl.addEventListener("change", () => {
    bbdbgEnabled = Boolean(bbdbgEnabledEl.checked);
    scheduleBbdbgRender();
  });
  bbdbgPauseBtnEl.addEventListener("click", () => requestDebugPause());
  bbdbgContinueBtnEl.addEventListener("click", () => requestDebugContinue());
  bbdbgStepBtnEl.addEventListener("click", () => requestDebugStep());
  bbdbgClearBpsBtnEl.addEventListener("click", () => clearAllBreakpoints());
  bbdbgClearBtnEl.addEventListener("click", () => resetBbdbgState());
  bbdbgCopyBtnEl.addEventListener("click", () => void copyBbdbgSnapshot());
  bbdbgDownloadMetaBtnEl.addEventListener(
    "click",
    () => void downloadBbdbgMetadata(),
  );
  bbdbgLoadSavedBtnEl.addEventListener(
    "click",
    () => void loadSavedBbdbgMetadata(),
  );
  bbdbgBreakpointsEl.addEventListener("click", (e) => {
    const ev = e as MouseEvent;
    const target = e.target as HTMLElement | null;
    const btn = target?.closest?.(".bbdbg-bp") as HTMLElement | null;
    const raw = btn?.getAttribute?.("data-line") ?? "";
    const line = Number(raw) | 0;
    if (line <= 0) return;
    if (ev.metaKey || ev.ctrlKey) {
      toggleBreakpointAtLine(line);
      return;
    }
    jumpToEditorLine(line);
  });
  memRefreshBtnEl.addEventListener("click", () => {
    if (runnerWorker && !getActiveMemory()) requestWorkerMemorySnapshot(true);
    postWorkerMemConfig();
    renderMemoryPanel();
  });
  memOffsetEl.addEventListener("change", () => {
    memOffsetTouched = true;
    postWorkerMemConfig();
    renderMemoryPanel();
  });
  memOffsetEl.addEventListener("input", () => {
    memOffsetTouched = true;
  });
  memLenEl.addEventListener("change", () => {
    postWorkerMemConfig();
    renderMemoryPanel();
  });
  memAutoEl.addEventListener("change", () => {
    postWorkerMemConfig();
    applyMemoryAutoRefresh();
  });
  watEnabledEl.addEventListener("change", () => renderWatPanel());
  watClearBtnEl.addEventListener("click", () => setWatText(null));
  watCopyBtnEl.addEventListener("click", () => void copyWat());
  watDownloadBtnEl.addEventListener("click", () => downloadWat());

  for (const tabBtn of document.querySelectorAll<HTMLButtonElement>(".tab")) {
    tabBtn.addEventListener("click", () => {
      const tab = (tabBtn.dataset.tab ?? "") as TabName | "";
      if (tab === "output" || tab === "debug" || tab === "canvas") showTab(tab);
    });
  }

  exampleSelectEl.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement | null;
    const example = target?.value ?? "";
    if (example && examples[example]) {
      editorEl.value = examples[example];
      scheduleEditorDecorRender();
      renderExampleRequirements(example);

      const info = exampleInfo[example];
      if (info?.prefersTab) showTab(info.prefersTab);
      if (typeof info?.defaultTimeoutMs === "number") {
        timeoutMsEl.value = String(
          Math.max(0, Math.floor(info.defaultTimeoutMs)),
        );
      }
    }
  });

  vfsClearBtnEl.addEventListener("click", () => {
    vfsClear();
    printOutput("VFS cleared.", "info");
  });

  vfsUploadEl.addEventListener("change", async () => {
    const files = Array.from(vfsUploadEl.files ?? []);
    if (files.length === 0) return;
    const prefixRaw = vfsPrefixEl.value ?? "";
    const prefix = normalizeVfsPath(prefixRaw);
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const path = normalizeVfsPath(prefix ? `${prefix}/${f.name}` : f.name);
      vfsPut(path, bytes, f.type || guessMime(path));
    }
    printOutput(`Uploaded ${files.length} file(s) to VFS.`, "success");
    // Reset input so selecting the same file again still triggers change.
    vfsUploadEl.value = "";
  });
}

// --- SAFE WASM RUNNER (Worker + watchdog) ---
let runnerWorker: Worker | null = null;
let runnerWatchdog: number | null = null;

function stopExecution() {
  mainThreadStopRequested = true;
  sharedStopRequested = true;
  stopMemoryAutoRefresh();
  disposeSharedRuntime();
  isRunning = false;
  debugSteppingActive = false;
  debugSteppingPaused = false;
  debugSteppingStepOnce = false;
  debugSteppingTick = null;
  bbdbgBreakpointHitThisStep = false;
  bbdbgBreakpointLastHit = null;
  workerDebugSteppingActive = false;
  workerDebugPaused = false;
  updateBbdbgButtons();
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
  renderMemoryPanel();
}

function disposeSharedRuntime() {
  sharedStopRequested = true;
  stopMemoryAutoRefresh();
  globalThis.__BLITZ3D_URL_RESOLVER = undefined;
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

function makeRunnerWorker(): Worker {
  const workerCode = `
      const entryPoints = ["main", "_start", "Main", "Main_", "__main"];
      let bbdbgCurrentFileId = 0;
      let bbdbgCurrentLine = 0;
      /** @type {WebAssembly.Instance | null} */
      let inst = null;
      /** @type {WebAssembly.Memory | null} */
      let envMem = null;
      let memAutoEnabled = false;
      let memAutoOffset = 0;
      let memAutoLen = 256;
      let memAutoIntervalMs = 250;
      let memAutoLastSent = 0;
      let memAutoSeq = 1;
      let memSuggestOverride = null;
      let bbdbgStack = [];
      let bbdbgLastFileId = 0;
      let bbdbgLastLine = 0;
      let bbdbgLastSent = 0;
      let debugStepping = false;
      let debugPaused = false;
      let debugStepOnce = false;
      let debugLooping = false;
      let debugEntryFn = null;
      let debugStepFn = null;
      let debugBreakpointHit = false;
      let debugBreakpointFileId = 0;
      let debugBreakpointLine = 0;
      const breakpointsByFileId = new Map();
      const send = (msg, transfer) => {
        try {
          if (Array.isArray(transfer) && transfer.length) self.postMessage(msg, transfer);
          else self.postMessage(msg);
        } catch {
          self.postMessage(msg);
        }
      };

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

      const getActiveMemory = () => {
        const m = (inst && inst.exports && inst.exports.memory instanceof WebAssembly.Memory)
          ? inst.exports.memory
          : (envMem instanceof WebAssembly.Memory ? envMem : null);
        return m || null;
      };

      const maybeSendMemAuto = () => {
        if (!memAutoEnabled) return;
        const now = Date.now();
        if (now - memAutoLastSent < memAutoIntervalMs) return;
        const mem = getActiveMemory();
        if (!mem) return;

        memAutoLastSent = now;
        const totalBytes = mem.buffer.byteLength;
        const pages = Math.floor(totalBytes / 65536);
        const offset = Math.max(0, memAutoOffset | 0);
        const wantLen = Math.min(16384, Math.max(16, memAutoLen | 0));
        const start = Math.min(offset, Math.max(0, totalBytes - 1));
        const len = Math.min(wantLen, Math.max(0, totalBytes - start));
        const snap = mem.buffer.slice(start, start + len);
        send({
          type: "mem",
          id: memAutoSeq++,
          offset: start,
          len,
          bytes: snap,
          totalBytes,
          pages,
        }, [snap]);
      };

      const getExportedGlobalNumber = (name) => {
        try {
          const v = inst && inst.exports ? inst.exports[name] : null;
          if (v instanceof WebAssembly.Global) {
            const val = v.value;
            if (typeof val === "number") return val | 0;
          }
        } catch {}
        return null;
      };

      const sendMemInfo = () => {
        try {
          const mem = getActiveMemory();
          if (!mem) return;
          const totalBytes = mem.buffer.byteLength;
          const pages = Math.floor(totalBytes / 65536);
          const heapBase = getExportedGlobalNumber("__heap_base");
          const dataEnd = getExportedGlobalNumber("__data_end");
          const stackPtr = getExportedGlobalNumber("__stack_pointer");
          const guessNonZeroOffset = () => {
            try {
              const candidates = [
                0x0,
                0x200,
                0x300,
                0x380,
                0x400,
                0x500,
                0x1000,
                0x4000,
                0x8000,
                0x10000,
                0x20000,
                0x40000,
                0x80000,
                0x100000,
                0x200000,
              ];
              for (const off of candidates) {
                if (off < 0 || off >= totalBytes) continue;
                const len = Math.min(256, totalBytes - off);
                const view = new Uint8Array(mem.buffer, off, len);
                for (let i = 0; i < view.length; i++) {
                  if (view[i] !== 0) return off | 0;
                }
              }

              // Fall back to scanning each page start (cheap heuristic that finds
              // non-zero content even when the "interesting" region isn't one
              // of the common hard-coded candidates).
              for (let p = 0; p < pages; p++) {
                const off = (p * 65536) | 0;
                if (off < 0 || off >= totalBytes) continue;
                const len = Math.min(p === 0 ? 4096 : 256, totalBytes - off);
                const view = new Uint8Array(mem.buffer, off, len);
                for (let i = 0; i < view.length; i++) {
                  if (view[i] !== 0) return off | 0;
                }
              }
            } catch {}
            return null;
          };
          const suggestOffset =
            (heapBase !== null && heapBase > 0) ? (heapBase | 0)
            : (dataEnd !== null && dataEnd > 0) ? (dataEnd | 0)
            : (memSuggestOverride !== null && (memSuggestOverride | 0) > 0)
              ? (memSuggestOverride | 0)
            : guessNonZeroOffset();
          send({
            type: "mem_info",
            totalBytes,
            pages,
            heapBase: heapBase !== null ? heapBase : undefined,
            dataEnd: dataEnd !== null ? dataEnd : undefined,
            stackPtr: stackPtr !== null ? stackPtr : undefined,
            suggestOffset: suggestOffset !== null ? suggestOffset : undefined,
          });
        } catch {}
      };

      const sendBbdbg = (force) => {
        const now = Date.now();
        if (!force && now - bbdbgLastSent < 50) return;
        bbdbgLastSent = now;
        try {
          send({
            type: "bbdbg",
            fileId: bbdbgLastFileId | 0,
            line: bbdbgLastLine | 0,
            stack: bbdbgStack.slice(0, 64),
          });
        } catch {}
      };
      const maybeSendBbdbg = () => sendBbdbg(false);
      const sendBbdbgNow = () => sendBbdbg(true);

      const sendDebugState = (reason) => {
        try {
          send({
            type: "debug_state",
            stepping: Boolean(debugStepping),
            paused: Boolean(debugPaused),
            reason: reason ? String(reason) : "",
            fileId: bbdbgLastFileId | 0,
            line: bbdbgLastLine | 0,
          });
        } catch {}
      };

      const setBreakpoints = (bpObj) => {
        breakpointsByFileId.clear();
        try {
          const entries = Object.entries(bpObj || {});
          for (const [k, arr] of entries) {
            const fid = Number(k) | 0;
            if (fid <= 0) continue;
            const set = new Set();
            const list = Array.isArray(arr) ? arr : [];
            for (const ln of list) {
              const n = Number(ln) | 0;
              if (n > 0) set.add(n);
            }
            if (set.size > 0) breakpointsByFileId.set(fid, set);
          }
        } catch {}
      };

      const tick = () => {
        debugLooping = false;
        if (!debugStepping || typeof debugStepFn !== "function") return;
        if (debugPaused) {
          try { sendDebugState(""); } catch {}
          return;
        }

        debugBreakpointHit = false;
        debugBreakpointFileId = 0;
        debugBreakpointLine = 0;

        try {
          debugStepFn();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const stack = e instanceof Error ? e.stack : "";
          if ((e && e.__blitz3dEnd) || msg === "__BLITZ3D_END__") {
            debugStepping = false;
            debugPaused = false;
            debugStepOnce = false;
            debugStepFn = null;
            debugEntryFn = null;
            try { sendDebugState("ended"); } catch {}
            send({ type: "done" });
            return;
          }
          send({ type: "error", message: msg, stack });
          return;
        }

        try { maybeSendMemAuto(); } catch {}
        try { maybeSendBbdbg(); } catch {}

        if (debugStepOnce || debugBreakpointHit) {
          debugStepOnce = false;
          debugPaused = true;
          try { sendDebugState(debugBreakpointHit ? "breakpoint" : "step"); } catch {}
          return;
        }

        debugLooping = true;
        setTimeout(tick, 0);
      };

      const stubMissingImports = (imports, module) => {
        const stubbedLimit = 200;
        const shown = [];
        let total = 0;
        const called = new Map();
        const firstSite = new Map();

        for (const imp of WebAssembly.Module.imports(module)) {
          if (imp.module === "blitz3d" && imports.env && (imp.name in imports.env)) {
            if (!("blitz3d" in imports)) imports.blitz3d = {};
            if (!(imp.name in imports.blitz3d)) imports.blitz3d[imp.name] = imports.env[imp.name];
          }
          if (!(imp.module in imports)) imports[imp.module] = {};
          if (imp.name in imports[imp.module]) continue;
          const key = imp.module + "." + imp.name;
          total++;
          if (shown.length < stubbedLimit) shown.push(key);

          if (imp.kind === "function") {
            imports[imp.module][imp.name] = (..._args) => {
              called.set(key, (called.get(key) || 0) + 1);
              if (!firstSite.has(key)) {
                firstSite.set(key, { fileId: bbdbgCurrentFileId | 0, line: bbdbgCurrentLine | 0 });
              }
              try { maybeSendMemAuto(); } catch {}
              return 0;
            };
          }
          else if (imp.kind === "global") imports[imp.module][imp.name] = 0;
          else if (imp.kind === "table") {
            imports[imp.module][imp.name] = new WebAssembly.Table({ initial: 0, element: "anyfunc" });
          } else if (imp.kind === "memory") {
            if (!imports[imp.module].memory) imports[imp.module].memory = imports.env.memory;
          }
        }

        return { total, shown, called, firstSite };
      };

      self.onmessage = async (ev) => {
        if (ev.data && ev.data.type === "mem_config") {
          memAutoEnabled = Boolean(ev.data.auto);
          memAutoOffset = Math.max(0, Number(ev.data.offset || 0) | 0);
          memAutoLen = Math.min(16384, Math.max(16, Number(ev.data.len || 256) | 0));
          memAutoIntervalMs = Math.max(50, Number(ev.data.intervalMs || 250) | 0);
          // If we already have an instance, send a snapshot immediately.
          try { maybeSendMemAuto(); } catch {}
          return;
        }

        if (ev.data && ev.data.type === "mem_request") {
          try {
            const mem = getActiveMemory();
            if (!mem) {
              send({ type: "warn", line: "[mem] no active memory yet" });
              return;
            }
            const totalBytes = mem.buffer.byteLength;
            const pages = Math.floor(totalBytes / 65536);
            const offset = Math.max(0, Number(ev.data.offset || 0) | 0);
            const wantLen = Math.min(16384, Math.max(16, Number(ev.data.len || 256) | 0));
            const start = Math.min(offset, Math.max(0, totalBytes - 1));
            const len = Math.min(wantLen, Math.max(0, totalBytes - start));
            const snap = mem.buffer.slice(start, start + len);
            send({
              type: "mem",
              id: Number(ev.data.id || 0) | 0,
              offset: start,
              len,
              bytes: snap,
              totalBytes,
              pages,
            }, [snap]);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            send({ type: "warn", line: "[mem] snapshot failed: " + msg });
          }
          return;
        }

        if (ev.data && ev.data.type === "debug_breakpoints") {
          try {
            setBreakpoints(ev.data.breakpointsByFileId);
          } catch {}
          return;
        }

        if (ev.data && ev.data.type === "debug_pause") {
          if (debugStepping) {
            debugPaused = true;
            sendDebugState("");
          }
          return;
        }

        if (ev.data && ev.data.type === "debug_continue") {
          if (debugStepping) {
            debugPaused = false;
            debugStepOnce = false;
            sendDebugState("");
            const kick = () => {
              if (!debugStepping || !debugStepFn || debugPaused || debugLooping) return;
              debugLooping = true;
              setTimeout(tick, 0);
            };
            kick();
          }
          return;
        }

        if (ev.data && ev.data.type === "debug_step") {
          if (debugStepping) {
            debugPaused = false;
            debugStepOnce = true;
            sendDebugState("");
            const kick = () => {
              if (!debugStepping || !debugStepFn || debugPaused || debugLooping) return;
              debugLooping = true;
              setTimeout(tick, 0);
            };
            kick();
          }
          return;
        }

        const { wasmBytes, maxLines } = ev.data;
        let emitted = 0;
        debugStepping = false;
        debugPaused = false;
        debugStepOnce = false;
        debugLooping = false;
        debugStepFn = null;
        debugEntryFn = null;
        debugBreakpointHit = false;
        debugBreakpointFileId = 0;
        debugBreakpointLine = 0;

        try {
          const module = await WebAssembly.compile(wasmBytes);
          try {
            const importsList = WebAssembly.Module.imports(module);
            const exportsList = WebAssembly.Module.exports(module);
            const bbdbg = importsList.filter((i) => i.module === "bbdbg").map((i) => String(i.name));
            const has = (name) => bbdbg.includes(name);
            const hasBbdbgEnter = has("enter") || has("__bbdbg_enter");
            const hasBbdbgLeave = has("leave") || has("__bbdbg_leave");
            const hasBbdbgStmt = has("stmt") || has("__bbdbg_stmt");
            const importsMemory = importsList.some((i) => i.kind === "memory");
            const exportsMemory = exportsList.some((e) => e.kind === "memory");
            send({
              type: "wasm_diag",
              importsTotal: importsList.length | 0,
              bbdbgImports: bbdbg.slice(0, 16),
              hasBbdbgEnter: Boolean(hasBbdbgEnter),
              hasBbdbgLeave: Boolean(hasBbdbgLeave),
              hasBbdbgStmt: Boolean(hasBbdbgStmt),
              importsMemory: Boolean(importsMemory),
              exportsMemory: Boolean(exportsMemory),
            });
          } catch {}
          const imports = { env: {}, blitz3d: {}, al: {}, bbdbg: {} };
          imports.env.memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });
          envMem = imports.env.memory;
          const bbdbgEnter = (funcId) => {
            const id = funcId | 0;
            bbdbgStack.push(id);
            if (bbdbgStack.length > 64) bbdbgStack.splice(0, bbdbgStack.length - 64);
            bbdbgCurrentFileId = bbdbgLastFileId | 0;
            bbdbgCurrentLine = bbdbgLastLine | 0;
            try { maybeSendBbdbg(); } catch {}
          };
          const bbdbgLeave = (_funcId) => {
            bbdbgStack.pop();
            try { maybeSendBbdbg(); } catch {}
          };
          const bbdbgStmt = (fileId, line) => {
            bbdbgCurrentFileId = fileId | 0;
            bbdbgCurrentLine = line | 0;
            bbdbgLastFileId = bbdbgCurrentFileId | 0;
            bbdbgLastLine = bbdbgCurrentLine | 0;
            try {
              const bp = breakpointsByFileId.get(bbdbgLastFileId | 0);
              if (bp && bp.has(bbdbgLastLine | 0)) {
                debugBreakpointHit = true;
                debugBreakpointFileId = bbdbgLastFileId | 0;
                debugBreakpointLine = bbdbgLastLine | 0;
              }
            } catch {}
            try { maybeSendBbdbg(); } catch {}
          };

          // Support both naming conventions (some builds import bbdbg.enter vs bbdbg.__bbdbg_enter).
          imports.bbdbg.__bbdbg_enter = bbdbgEnter;
          imports.bbdbg.__bbdbg_leave = bbdbgLeave;
          imports.bbdbg.__bbdbg_stmt = bbdbgStmt;
          imports.bbdbg.enter = bbdbgEnter;
          imports.bbdbg.leave = bbdbgLeave;
          imports.bbdbg.stmt = bbdbgStmt;

          const emit = (line) => {
            emitted++;
            if (maxLines && emitted > maxLines) {
              throw new Error("Output limit exceeded (" + maxLines + " lines).");
            }
            try { maybeSendMemAuto(); } catch {}
            send({ type: "stdout", line });
          };

          const printPtr = (ptr) => {
            if (!inst) return;
            const memory = inst.exports.memory;
            emit(decodeB3DString(ptr | 0, memory));
            if (memAutoOffset === 0 && memSuggestOverride === null && (ptr | 0) > 0) {
              const hb = getExportedGlobalNumber("__heap_base");
              if (hb !== null && hb > 0) return;
              memSuggestOverride = Math.max(0, (ptr | 0) - 128);
              memAutoOffset = memSuggestOverride | 0;
              try { sendMemInfo(); } catch {}
            }
          };

          const getStringAlloc = () => {
            const ex = inst?.exports;
            if (typeof ex?.__StringAlloc === "function") return ex.__StringAlloc;
            if (typeof ex?.["__StringAlloc%"] === "function") return ex["__StringAlloc%"];
            if (typeof ex?.__StringAlloc_ === "function") return ex.__StringAlloc_;
            if (typeof ex?.["__StringAlloc_%"] === "function") return ex["__StringAlloc_%"];
            try {
              for (const k of Object.keys(ex || {})) {
                if (!/stringalloc/i.test(k)) continue;
                const v = ex[k];
                if (typeof v === "function") return v;
              }
            } catch {}
            return null;
          };

          // Minimal non-graphics builtins so print-only examples work in the sandbox runner.
          // These are best-effort and only cover the most common signatures used in demos.
          let rngState = 0x12345678 | 0;
          const rngNextU32 = () => {
            rngState = (rngState * 1103515245 + 12345) | 0;
            return rngState >>> 0;
          };
          const rngNextF = () => rngNextU32() / 0x100000000;

          const readStr = (ptr) => {
            if (!inst) return "";
            const memory = inst.exports.memory;
            return decodeB3DString(ptr | 0, memory);
          };
          const allocStr = (text) => {
            if (!inst) return 0;
            const alloc = getStringAlloc();
            const memory = inst.exports.memory;
            if (typeof alloc !== "function") return 0;
            const p = writeStringObj(alloc, memory, String(text));
            if (memAutoOffset === 0 && memSuggestOverride === null && (p | 0) > 0) {
              const hb = getExportedGlobalNumber("__heap_base");
              if (hb !== null && hb > 0) return p;
              memSuggestOverride = Math.max(0, (p | 0) - 128);
              memAutoOffset = memSuggestOverride | 0;
              try { sendMemInfo(); } catch {}
            }
            return p;
          };

          const StringConcat = (aPtr, bPtr) => {
            const out = readStr(aPtr) + readStr(bPtr);
            const ptr = allocStr(out);
            try { maybeSendMemAuto(); } catch {}
            return ptr;
          };
          const ModInt = (a, b) => {
            const aa = Number(a) | 0;
            const bb = Number(b) | 0;
            if (bb === 0) return 0;
            return (aa % bb) | 0;
          };
          const ModFloat = (a, b) => {
            const aa = Number(a);
            const bb = Number(b);
            if (!Number.isFinite(aa) || !Number.isFinite(bb) || bb === 0) return 0;
            return aa % bb;
          };
          const Abs = (v) => Math.abs(Number(v));
          const Min = (a, b) => Math.min(Number(a), Number(b));
          const Max = (a, b) => Math.max(Number(a), Number(b));
          const SeedRnd = (seed) => {
            rngState = (Number(seed) | 0) || 1;
            return 0;
          };
          const Rnd = (max) => {
            const m = Number(max);
            return rngNextF() * (Number.isFinite(m) ? m : 1);
          };
          const Rand = (a, b) => {
            const lo = Number(a) | 0;
            const hi = Number(b) | 0;
            const min = Math.min(lo, hi);
            const max = Math.max(lo, hi);
            const span = (max - min + 1) | 0;
            if (span <= 0) return min | 0;
            return (min + (rngNextU32() % span)) | 0;
          };

          const Len = (ptr) => readStr(ptr).length | 0;
          const Left = (ptr, n) => {
            const s = readStr(ptr);
            const nn = Math.max(0, Number(n) | 0);
            const out = s.slice(0, nn);
            const p = allocStr(out);
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Right = (ptr, n) => {
            const s = readStr(ptr);
            const nn = Math.max(0, Number(n) | 0);
            const out = nn >= s.length ? s : s.slice(s.length - nn);
            const p = allocStr(out);
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Mid = (ptr, start, count) => {
            const s = readStr(ptr);
            let st = (Number(start) | 0) - 1;
            if (st < 0) st = 0;
            const hasCount = typeof count === "number" && Number.isFinite(count);
            const nn = hasCount ? (Number(count) | 0) : s.length;
            const out = hasCount ? s.slice(st, st + Math.max(0, nn)) : s.slice(st);
            const p = allocStr(out);
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Lower = (ptr) => {
            const p = allocStr(readStr(ptr).toLowerCase());
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Upper = (ptr) => {
            const p = allocStr(readStr(ptr).toUpperCase());
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Trim = (ptr) => {
            const p = allocStr(readStr(ptr).trim());
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Replace = (srcPtr, fromPtr, toPtr) => {
            const src = readStr(srcPtr);
            const from = readStr(fromPtr);
            const to = readStr(toPtr);
            const out = from ? src.split(from).join(to) : src;
            const p = allocStr(out);
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Instr = (hayPtr, needlePtr) => {
            const hay = readStr(hayPtr);
            const needle = readStr(needlePtr);
            if (!needle) return 0;
            const idx = hay.indexOf(needle);
            return idx >= 0 ? (idx + 1) | 0 : 0;
          };
          const Chr = (code) => {
            const c = String.fromCharCode((Number(code) | 0) & 0xff);
            const p = allocStr(c);
            try { maybeSendMemAuto(); } catch {}
            return p;
          };
          const Asc = (ptr) => {
            const s = readStr(ptr);
            return s.length ? (s.charCodeAt(0) | 0) : 0;
          };

          // Bind to both env and blitz3d namespaces (the compiler/runtime mix these).
          for (const ns of ["env", "blitz3d"]) {
            imports[ns].StringConcat = StringConcat;
            imports[ns].Abs = Abs;
            imports[ns].Min = Min;
            imports[ns].Max = Max;
            imports[ns].SeedRnd = SeedRnd;
            imports[ns].Rnd = Rnd;
            imports[ns].Rand = Rand;
            imports[ns].Len = Len;
            imports[ns].Left = Left;
            imports[ns].Right = Right;
            imports[ns].Mid = Mid;
            imports[ns].Lower = Lower;
            imports[ns].Upper = Upper;
            imports[ns].Trim = Trim;
            imports[ns].Replace = Replace;
            imports[ns].Instr = Instr;
            imports[ns].Chr = Chr;
            imports[ns].Asc = Asc;
          }
          // Separate Mod bindings: integer vs float signatures differ by namespace in practice.
          imports.blitz3d.Mod = ModInt;
          imports.env.Mod = ModFloat;

          const intToString = (val) => {
            if (!inst) return 0;
            const alloc = getStringAlloc();
            const memory = inst.exports.memory;
            if (typeof alloc !== "function") return 0;
            return writeStringObj(alloc, memory, String(val | 0));
          };

          const floatToString = (val) => {
            if (!inst) return 0;
            const alloc = getStringAlloc();
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

          const stubReport = stubMissingImports(imports, module, {
            preferEnvForBlitz3d: true,
            caseInsensitive: true,
            ensureEnvMemory: true,
            stubGlobals: true,
            stubTables: true,
            stubMemory: true,
          });

          // When passing a pre-compiled Module, instantiate() returns an Instance (not { module, instance }).
          inst = await WebAssembly.instantiate(module, imports);
          // Send at least one snapshot + debug update once the instance exists.
          try { maybeSendMemAuto(); } catch {}
          try { sendMemInfo(); } catch {}
          try {
            const mem = getActiveMemory();
            if (mem) {
              const totalBytes = mem.buffer.byteLength;
              const pages = Math.floor(totalBytes / 65536);
              const offset = Math.max(0, memAutoOffset | 0);
              const wantLen = Math.min(16384, Math.max(16, memAutoLen | 0));
              const start = Math.min(offset, Math.max(0, totalBytes - 1));
              const len = Math.min(wantLen, Math.max(0, totalBytes - start));
              const snap = mem.buffer.slice(start, start + len);
              send({
                type: "mem",
                id: 0,
                offset: start,
                len,
                bytes: snap,
                totalBytes,
                pages,
              }, [snap]);
            }
          } catch {}
          try { maybeSendBbdbg(); } catch {}

          const entry = inst.exports.main || inst.exports._start || inst.exports.Main || inst.exports.Main_ || inst.exports.__main;
          const stepFn = inst.exports.__Step || inst.exports["__Step%"] || inst.exports.Step || inst.exports["Step%"];

          if (typeof stepFn === "function") {
            debugEntryFn = entry;
            debugStepFn = stepFn;
            debugStepping = true;
            debugPaused = false;
            debugStepOnce = false;
            try { sendDebugState(""); } catch {}

            if (typeof debugEntryFn === "function") {
              try {
                debugEntryFn();
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                const stack = e instanceof Error ? e.stack : "";
                if ((e && e.__blitz3dEnd) || msg === "__BLITZ3D_END__") {
                  debugStepping = false;
                  debugPaused = false;
                  debugStepOnce = false;
                  debugStepFn = null;
                  debugEntryFn = null;
                  try { sendDebugState("ended"); } catch {}
                  send({ type: "done" });
                  return;
                }
                send({ type: "error", message: msg, stack });
                return;
              }
            }

            debugLooping = true;
            setTimeout(tick, 0);
            return;
          }

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

          // Ensure the UI sees a post-run snapshot even for very fast programs
          // (throttled updates may never fire before execution completes).
          try { sendMemInfo(); } catch {}
          try {
            const mem = getActiveMemory();
            if (mem) {
              const totalBytes = mem.buffer.byteLength;
              const pages = Math.floor(totalBytes / 65536);
              const offset = Math.max(0, memAutoOffset | 0);
              const wantLen = Math.min(16384, Math.max(16, memAutoLen | 0));
              const start = Math.min(offset, Math.max(0, totalBytes - 1));
              const len = Math.min(wantLen, Math.max(0, totalBytes - start));
              const snap = mem.buffer.slice(start, start + len);
              send({
                type: "mem",
                id: memAutoSeq++,
                offset: start,
                len,
                bytes: snap,
                totalBytes,
                pages,
              }, [snap]);
            }
          } catch {}
          try { sendBbdbgNow(); } catch {}

          try {
            const calledList = Array.from((stubReport?.called ?? new Map()).entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 50)
              .map(([key, count]) => {
                const site = (stubReport?.firstSite && stubReport.firstSite.get) ? stubReport.firstSite.get(key) : null;
                return {
                  key,
                  count,
                  fileId: site && typeof site.fileId === "number" ? (site.fileId | 0) : 0,
                  line: site && typeof site.line === "number" ? (site.line | 0) : 0,
                };
              });
            send({
              type: "stubs",
              total: Number(stubReport?.total ?? 0) || 0,
              shown: Array.isArray(stubReport?.shown) ? stubReport.shown : [],
              called: calledList,
            });
          } catch {}

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
  wasmBytes: ArrayBuffer | ArrayBufferView,
  { timeoutMs = 2000, maxLines = 2000 }: {
    timeoutMs?: number;
    maxLines?: number;
  } = {},
): Promise<{ startedStepping: boolean }> {
  stopExecution();
  resetWorkerMemSnapshot();
  workerBbdbgLast = null;
  workerMemInfo = null;
  memOffsetTouched = false;
  stopBtnEl.disabled = false;
  workerDebugSteppingActive = false;
  workerDebugPaused = false;

  setStatus(
    "running",
    `Running...${timeoutMs > 0 ? ` (${timeoutMs}ms timeout)` : ""}`,
  );

  const w = makeRunnerWorker();
  runnerWorker = w;
  renderMemoryPanel();
  applyMemoryAutoRefresh();
  let timeoutReject: ((reason?: unknown) => void) | null = null;
  let resolvedForStepping = false;

      if (timeoutMs > 0) {
        runnerWatchdog = setTimeout(() => {
          const msg =
            `Execution timed out after ${timeoutMs}ms (worker terminated).`;
          if (runnerWorker) runnerWorker.terminate();
          runnerWorker = null;
          runnerWatchdog = null;
          stopBtnEl.disabled = true;
          stopMemoryAutoRefresh();
          renderMemoryPanel();
          setStatus("error", `Timed out after ${timeoutMs}ms`);
          printOutput(msg, "error");
          if (typeof timeoutReject === "function") timeoutReject(new Error(msg));
        }, timeoutMs);
      }

  return await new Promise<{ startedStepping: boolean }>((resolve, reject) => {
    timeoutReject = reject;
    w.onmessage = (ev: MessageEvent<RunnerWorkerToMainMessage>) => {
      const msg = ev.data;
      if (msg.type === "debug_state") {
        workerDebugSteppingActive = Boolean(msg.stepping);
        workerDebugPaused = Boolean(msg.paused);
        scheduleBbdbgRender();
        updateBbdbgButtons();
        const reason = String(msg.reason || "");
        if (workerDebugSteppingActive && runnerWatchdog !== null) {
          // Interactive stepping should not be killed by the overall watchdog.
          clearTimeout(runnerWatchdog);
          runnerWatchdog = null;
        }
        if (workerDebugSteppingActive) {
          const fileId = typeof msg.fileId === "number" ? (msg.fileId | 0) : 0;
          const line = typeof msg.line === "number" ? (msg.line | 0) : 0;
          const loc = (fileId > 0 && line > 0) ? bbdbgLocString(fileId, line) : "";
          if (workerDebugPaused) {
            setStatus("paused", reason || (loc ? `Paused at ${loc}` : "Paused"));
          } else {
            setStatus(
              "running",
              `Running (sandbox worker)...${loc ? ` @${loc}` : ""}`,
            );
          }
          if (!resolvedForStepping) {
            resolvedForStepping = true;
            resolve({ startedStepping: true });
          }
        }
        return;
      }
      if (msg.type === "wasm_diag") {
        const hooks =
          (msg.hasBbdbgEnter && msg.hasBbdbgLeave && msg.hasBbdbgStmt)
            ? "bbdbg hooks present"
            : (msg.bbdbgImports.length
              ? `bbdbg imports present but incomplete (enter=${msg.hasBbdbgEnter ? "y" : "n"} leave=${
                msg.hasBbdbgLeave ? "y" : "n"
              } stmt=${msg.hasBbdbgStmt ? "y" : "n"})`
              : "no bbdbg imports");
        printOutput(
          `[wasm] imports=${msg.importsTotal} (${hooks}); memory: import=${
            msg.importsMemory ? "y" : "n"
          } export=${msg.exportsMemory ? "y" : "n"}`,
          msg.bbdbgImports.length ? "info" : "warning",
        );
        return;
      }
      if (msg.type === "mem_info") {
        workerMemInfo = {
          totalBytes: msg.totalBytes | 0,
          pages: msg.pages | 0,
          heapBase: typeof msg.heapBase === "number" ? (msg.heapBase | 0) : undefined,
          dataEnd: typeof msg.dataEnd === "number" ? (msg.dataEnd | 0) : undefined,
          stackPtr: typeof msg.stackPtr === "number" ? (msg.stackPtr | 0) : undefined,
          suggestOffset: typeof msg.suggestOffset === "number"
            ? (msg.suggestOffset | 0)
            : undefined,
        };
        if (!memOffsetTouched) {
          const current = Math.max(0, parseByteOffset(memOffsetEl.value));
          const suggested = workerMemInfo.suggestOffset ?? 0;
          if (current === 0 && suggested > 0) {
            memOffsetEl.value = `0x${suggested.toString(16)}`;
            requestWorkerMemorySnapshot(true);
          }
        }
        renderMemoryPanel();
        return;
      }
      if (msg.type === "bbdbg") {
        try {
          workerBbdbgLast = {
            fileId: msg.fileId | 0,
            line: msg.line | 0,
            stack: Array.isArray(msg.stack) ? msg.stack.map((n) => n | 0) : [],
            updatedAtMs: Date.now(),
          };
          // Update the existing bbdbg UI state so the panel renders for worker runs too.
          bbdbgLastFileId = workerBbdbgLast.fileId;
          bbdbgLastLine = workerBbdbgLast.line;
          const names = (workerBbdbgLast.stack || [])
            .slice()
            .reverse()
            .map((id) => bbdbgMeta.funcById.get(id) ?? `func_${id}`);
          bbdbgStack = names;

          if (bbdbgLastFileId > 0 && bbdbgLastLine > 0) {
            const stackSnap = bbdbgStack.slice();
            const last = bbdbgTrace.length ? bbdbgTrace[bbdbgTrace.length - 1]! : null;
            if (!last || last.fileId !== bbdbgLastFileId || last.line !== bbdbgLastLine) {
              bbdbgTrace.push({ fileId: bbdbgLastFileId, line: bbdbgLastLine, stack: stackSnap });
              if (bbdbgTrace.length > 200) {
                bbdbgTrace.splice(0, bbdbgTrace.length - 200);
              }
            }
          }
          scheduleBbdbgRender();
        } catch {}
        return;
      }
      if (msg.type === "mem") {
        try {
          workerMemSnapshot = {
            id: msg.id | 0,
            offset: msg.offset | 0,
            len: msg.len | 0,
            bytes: new Uint8Array(msg.bytes),
            totalBytes: msg.totalBytes | 0,
            pages: msg.pages | 0,
            updatedAtMs: Date.now(),
          };
          workerMemInFlight = false;
          renderMemoryPanel();
        } catch {
          workerMemInFlight = false;
        }
        return;
      }
      if (msg.type === "stubs") {
        const shown = (msg.shown || []).slice(0, 30);
        const called = (msg.called || []).slice(0, 10);
        applyRuntimeGapsReport(
          "worker",
          msg.total || 0,
          msg.shown || [],
          msg.called || [],
        );
        if (msg.total > 0) {
          printOutput(
            `[stubs] stubbed ${msg.total} missing import(s) (showing ${shown.length})`,
            "info",
          );
          if (shown.length) {
            printOutput(`[stubs] ${shown.join(", ")}`, "info");
          }
        }
        if (called.length) {
          printOutput(
            `[stubs] called: ${
              called.map((c) => `${c.key}×${c.count}`).join(", ")
            }`,
            "warning",
          );
        }
        return;
      }
      if (msg.type === "stdout") {
        printOutput(msg.line, "output");
        return;
      }
      if (msg.type === "warn") {
        const line = String(msg.line || "");
        if (line.startsWith("[mem]")) {
          workerMemInFlight = false;
          return;
        }
        printOutput(line, "warning");
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
        resolve({ startedStepping: false });
      }
    };

    w.onerror = (e) => {
      stopRun();
      reject(new Error((e as ErrorEvent).message));
    };

    const bytes = normalizeWasmBytes(wasmBytes);
    postRunnerWorkerBreakpoints();
    w.postMessage({ wasmBytes: bytes, maxLines }, [bytes]);
  });
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
      new URL("./compiler_worker.ts", import.meta.url),
      {
        type: "module",
      },
    );

    const w = compilerWorker;
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Compiler worker init timed out"));
      }, 10_000);

      w.onmessage = (ev: MessageEvent<CompilerWorkerMessage>) => {
        const msg = ev.data || ({} as CompilerWorkerMessage);
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

      w.onerror = (e) => {
        clearTimeout(timeoutId);
        reject(new Error((e as ErrorEvent).message));
      };

      w.postMessage({ type: "init" } satisfies CompilerInitMessage);
    });

    printOutput("Blitz3D compiler loaded successfully! (worker)", "success");
    setStatus("ready", "Ready");
    runBtnEl.disabled = false;
    return true;
  } catch (error: unknown) {
    const errorMsg = `Failed to load compiler: ${errorMessage(error)}`;
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
async function compileSource(source: string): Promise<CompileResult> {
  await ensureCompilerReady();

  const id = compileReqId++;
  const timeoutMs = Math.max(250, Number(timeoutMsEl.value ?? "2000") || 2000);
  const emitWat = Boolean(watEnabledEl.checked);

  return await new Promise<CompileResult>((resolve, reject) => {
    if (compileInFlight) {
      reject(new Error("Compile already in progress"));
      return;
    }

    const timeoutId = setTimeout(() => {
      stopCompile();
      reject(new Error(`Compilation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    compileInFlight = { id, timeoutId };

    const w = compilerWorker!;
    const onMessage = (ev: MessageEvent<CompilerWorkerMessage>) => {
      const msg = ev.data || ({} as CompilerWorkerMessage);
      if (msg.type !== "compile_result" || msg.id !== id) return;
      w.removeEventListener("message", onMessage as EventListener);
      clearTimeout(timeoutId);
      compileInFlight = null;

      if (!msg.ok) {
        reject(new Error(msg.error || "Compilation failed"));
        return;
      }

      const result: CompileResult = msg.result ??
        { success: false, error: "Empty compile result" };
      if (msg.wasmBytes) result.wasmBytes = normalizeWasmBytes(msg.wasmBytes);
      resolve(result);
    };

    w.addEventListener("message", onMessage as EventListener);
    w.postMessage(
      { type: "compile", id, source, emitWat } satisfies CompilerCompileMessage,
    );
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
  resetRuntimeGaps();
  resetBbdbgState();
  setWatText(null);
  printOutput("Compiling Blitz3D code...", "info");

  try {
    const result = await compileSource(source);
    setBbdbgMetadata(result.bbdbg);
    setWatText(typeof result.wat === "string" ? result.wat : null);
    bbdbgSavedWasmSha256 = null;
    bbdbgSavedAtMs = null;

    if (result.success && result.wasmBytes && result.bbdbg) {
      try {
        const sha = await persistBbdbgToIdb(result.wasmBytes, result.bbdbg);
        bbdbgSavedWasmSha256 = sha;
        bbdbgSavedAtMs = Date.now();
        scheduleBbdbgRender();
      } catch (err) {
        printOutput(
          `[bbdbg] save failed (IndexedDB): ${errorMessage(err)}`,
          "warning",
        );
      }
    }

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
  } catch (error: unknown) {
    printOutput(`Error: ${errorMessage(error)}`, "error");
    console.error("Run code error:", error);
  } finally {
    isCompiling = false;
    runBtnEl.disabled = false;
    runBtnEl.textContent = "Run";
    if (!isRunning) setStatus("ready", "Ready");
  }
}

async function executeCompiledWASM(wasmBase64: string): Promise<void> {
  try {
    printOutput("Loading compiled module...", "info");

    const wasmBytes = base64ToBytes(wasmBase64);
    await executeCompiledWASMBytes(wasmBytes);
  } catch (error: unknown) {
    printOutput(`Execution error: ${errorMessage(error)}`, "error");
    const st = errorStack(error);
    if (showStacks && st) {
      try {
        printOutput(String(st), "error");
      } catch {}
    }
    console.error("Execution error:", error);
  }
}

function sourceLikelyNeedsGraphics(source: string): boolean {
  // Our WASM currently imports many graphics fns even if unused, so inspecting
  // module imports is too conservative. Use a simple source heuristic instead.
  return /\b(Graphics3D|Graphics|RenderWorld|Flip|Cls|ClsColor|Color|Rect|Oval|Line|Text|LoadFont|SetFont|StringWidth|StringHeight|LoadImage|DrawImage|DrawBlock|TileImage|LoadTexture|EntityTexture|FogMode|FogColor|FogRange|FogDensity|CreateCube|CreateSphere|CreatePlane|CreateMesh|CreateSurface|AddVertex|AddTriangle|UpdateNormals|CreateCamera|CreateLight|AmbientLight|PositionEntity|RotateEntity|TurnEntity|ScaleEntity|EntityColor|EntityAlpha|EntityBlend|EntityFX)\b/i
    .test(source);
}

async function executeCompiledWASMBytes(
  wasmBytes: ArrayBuffer | ArrayBufferView,
  opts: { forceMainThread?: boolean } = {},
): Promise<{ startedStepping: boolean } | undefined> {
  try {
    printOutput("Loading compiled module...", "info");

    const { forceMainThread } = opts;
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
    const timeoutMs = Number(timeoutMsEl.value ?? "2000") || 0;

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
        printOutput(
          "Execution started (stepping). Click Stop to end.",
          "success",
        );
        return runResult;
      }
    } else {
      const runResult = await runWasmBytesInSandbox(bytes, {
        timeoutMs,
        maxLines: 2000,
      });
      if (runResult?.startedStepping) {
        printOutput(
          "Execution started (stepping in sandbox worker). Click Stop to end.",
          "success",
        );
        return runResult;
      }
    }
    printOutput("Execution completed.", "success");
  } catch (error: unknown) {
    printOutput(`Execution error: ${errorMessage(error)}`, "error");
    console.error("Execution error:", error);
  }
  return { startedStepping: false };
}

function base64ToBytes(base64: string): ArrayBuffer {
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

function wasmLikelyNeedsGraphics(
  wasmBytes: ArrayBuffer | ArrayBufferView,
): boolean {
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

let mainThreadRunDeadline = 0;
let mainThreadStopRequested = false;

async function runWasmBytesOnMainThread(
  wasmBytes: ArrayBuffer | ArrayBufferView,
  { timeoutMs = 2000 }: { timeoutMs?: number } = {},
): Promise<{ startedStepping: boolean }> {
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

  if (!sharedCore || !sharedGraphics || !sharedFileIO) {
    throw new Error("Failed to initialize shared runtime");
  }
  const core = sharedCore;
  const graphics = sharedGraphics;
  const fileIO = sharedFileIO;

  // Match the SCPCB loader wiring: some runtime helpers expect `core.fileIO` / `core.graphics`.
  (core as any).graphics = graphics;
  (core as any).fileIO = fileIO;
  let registerIntoRuntime = (p, data) => fileIO.registerFile(p, data);
  // Keep writes performed by WASM visible in the interpreter VFS UI.
  try {
    const origRegister = fileIO.registerFile.bind(fileIO);
    registerIntoRuntime = origRegister;
    fileIO.registerFile = (p, data) => {
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
  globalThis.__BLITZ3D_URL_RESOLVER = (p: string) => vfsGetObjectUrl(p) || null;

  const imports: any = { env: {}, blitz3d: {} };
  imports.bbdbg = {};
  // Ensure table import exists for indirect calls.
  imports.env.__indirect_function_table = new WebAssembly.Table({
    initial: 0,
    element: "anyfunc",
  });

  // Some builds import `__StringAlloc` (or a mangled variant) instead of exporting it.
  // Provide a fallback bump allocator that writes into the module's memory once the
  // instance exists. This unblocks StringConcat/Chr/ReadLine/etc for interpreter demos.
  let instRef: WebAssembly.Instance | null = null;
  let bumpPtr = 0;
  const allocStringObjPtr = (len: number): number => {
    const l = Math.max(0, len | 0);
    const mem: WebAssembly.Memory | undefined =
      (instRef?.exports as any)?.memory ||
      imports.env.memory;
    if (!mem) return 0;
    const bytesNeeded = (8 + l + 1) >>> 0;
    const align = 4;
    const curBytes = mem.buffer.byteLength >>> 0;
    if (!bumpPtr) {
      bumpPtr = curBytes;
    }
    bumpPtr = (bumpPtr + (align - 1)) & ~(align - 1);
    const needed = (bumpPtr + bytesNeeded) >>> 0;
    if (needed > curBytes) {
      try {
        const delta = needed - curBytes;
        const pages = Math.ceil(delta / 65536);
        if (pages > 0) mem.grow(pages);
      } catch {
        return 0;
      }
    }
    const ptr = bumpPtr | 0;
    bumpPtr = (bumpPtr + bytesNeeded) >>> 0;
    return ptr;
  };

  // Provide allocator imports under common names (the compiler may request any of these).
  imports.env.__StringAlloc = (len) => allocStringObjPtr(len);
  imports.env["__StringAlloc%"] = (len) => allocStringObjPtr(len);
  imports.blitz3d.__StringAlloc = imports.env.__StringAlloc;
  imports.blitz3d["__StringAlloc%"] = imports.env["__StringAlloc%"];

  if (core.setupCommonImports) core.setupCommonImports(imports);
  if (graphics.setupImports) graphics.setupImports(imports);
  if (fileIO.setupImports) fileIO.setupImports(imports);

  // The shared runtime is optimized for the SCPCB loader (its own RAF loop), but the interpreter
  // runs cooperatively via `__Step%()`. Provide `RenderWorld()` so classic Blitz3D loops work,
  // and so demos can render once per step while paused/resumed.
  imports.env.RenderWorld = (_tween: number) => {
    try {
      const abort = shouldAbortMainThreadRun();
      if (abort) throw new Error(abort);
      graphics.render?.(performance.now());
    } catch (e) {
      throw e;
    }
  };

  // Route Print/PrintString/PrintInt/PrintFloat/DebugLog to the interpreter output pane.
  const tryDecodeStringObj = (ptr: number): string | null => {
    const mem = core.memory;
    if (!mem || !ptr) return null;
    const bufLen = mem.buffer.byteLength >>> 0;
    const p = ptr | 0;
    if (p < 0 || p + 8 > bufLen) return null;
    try {
      const view = new DataView(mem.buffer);
      const len = view.getInt32(p + 4, true) | 0;
      const start = (p + 8) >>> 0;
      const end = (start + (len >>> 0)) >>> 0;
      const maxStringLen = 1024 * 1024;
      if (len < 0 || len > maxStringLen || end > bufLen) return null;
      const bytes = new Uint8Array(mem.buffer, start, len >>> 0);
      // Latin-1 for Blitz strings.
      const s = new TextDecoder("latin1").decode(bytes);
      return s;
    } catch {
      return null;
    }
  };

  imports.env.Print = (ptr: number) => {
    const s = core.readString(ptr | 0);
    printOutput(s, "output");
  };
  imports.env.PrintString = (ptr: number) => {
    const s = core.readString(ptr | 0);
    printOutput(s, "output");
  };
  imports.env.PrintInt = (val: number) => {
    // Some functions (e.g. ReadLine) are sometimes typed as numeric during compilation
    // even though they return a Blitz string object pointer. If this looks like a
    // valid string object, print it as text; otherwise print the integer.
    const asPtr = val | 0;
    const s = tryDecodeStringObj(asPtr);
    if (typeof s === "string") {
      printOutput(s, "output");
      return;
    }
    printOutput(String(asPtr), "output");
  };
  imports.env.PrintFloat = (val: number) => {
    printOutput(String(val), "output");
  };
  imports.env.DebugLog = (ptr: number) => {
    const s = core.readString(ptr | 0);
    printOutput(`[DebugLog] ${s}`, "info");
  };

  // String conversion helpers used by implicit string concatenation.
  // Without these, expressions like `"x=" + 123` can end up as empty strings
  // when `IntToString` is imported but stubbed.
  const allocB3DString = (text: string): number => {
    try {
      const fn = core.allocString;
      if (typeof fn === "function") return fn(String(text));
    } catch {}
    return 0;
  };
  const intToString = (val: number) => allocB3DString(String(val | 0));
  const floatToString = (val: number) => allocB3DString(String(Number(val)));
  for (const ns of ["env", "blitz3d"] as const) {
    imports[ns].IntToString = intToString;
    imports[ns].FloatToString = floatToString;
  }

  // bbdbg hooks (enabled when the module imports `bbdbg.__bbdbg_*`).
  // These are used to attribute stubbed runtime calls to a source line.
  bbdbgLastFileId = 0;
  bbdbgLastLine = 0;
  bbdbgStack = [];
  imports.bbdbg.__bbdbg_enter = (funcId: number) => {
    if (!bbdbgEnabled) return;
    const id = funcId | 0;
    const name = bbdbgMeta.funcById.get(id) ?? `func_${id}`;
    bbdbgStack.push(name);
    scheduleBbdbgRender();
  };
  imports.bbdbg.__bbdbg_leave = (_funcId: number) => {
    if (!bbdbgEnabled) return;
    bbdbgStack.pop();
    scheduleBbdbgRender();
  };
  imports.bbdbg.__bbdbg_stmt = (fileId: number, line: number) => {
    if (!bbdbgEnabled) return;
    bbdbgLastFileId = fileId | 0;
    bbdbgLastLine = line | 0;
    const stackSnap = bbdbgStack.slice().reverse();
    const last = bbdbgTrace.length ? bbdbgTrace[bbdbgTrace.length - 1]! : null;
    const fid = bbdbgLastFileId | 0;
    const ln = bbdbgLastLine | 0;
    const bp = bbdbgBreakpointsByFileId.get(fid);
    if (bp && bp.has(ln)) {
      bbdbgBreakpointHitThisStep = true;
      bbdbgBreakpointLastHit = { fileId: fid, line: ln };
    }
    if (!last || last.fileId !== fid || last.line !== ln) {
      bbdbgTrace.push({ fileId: fid, line: ln, stack: stackSnap });
      if (bbdbgTrace.length > 200) {
        bbdbgTrace.splice(0, bbdbgTrace.length - 200);
      }
    }
    scheduleBbdbgRender();
  };
  // Some builds import `bbdbg.enter/leave/stmt` instead of `bbdbg.__bbdbg_*`.
  (imports.bbdbg as any).enter = (funcId: number) => {
    (imports.bbdbg as any).__bbdbg_enter?.(funcId);
  };
  (imports.bbdbg as any).leave = (funcId: number) => {
    (imports.bbdbg as any).__bbdbg_leave?.(funcId);
  };
  (imports.bbdbg as any).stmt = (fileId: number, line: number) => {
    (imports.bbdbg as any).__bbdbg_stmt?.(fileId, line);
  };

  const stubbedKeys: string[] = [];
  let stubbedTotal = 0;
  const calledMissing = new Map<string, number>();
  let calledNotices = 0;
  const calledNoticeLimit = 10;

  stubMissingImports(imports, module, {
    preferEnvForBlitz3d: true,
    caseInsensitive: true,
    ensureEnvMemory: true,
    stubGlobals: true,
    stubTables: true,
    stubMemory: true,
    onStub: (info) => {
      stubbedTotal++;
      const key = `${info.module}.${info.name}`;
      if (stubbedKeys.length < 200) stubbedKeys.push(key);
    },
    onCallMissingFunction: ({ key }) => {
      const next = (calledMissing.get(key) ?? 0) + 1;
      calledMissing.set(key, next);
      runtimeGaps.called.set(key, next);
      if (
        !runtimeGaps.callSites.has(key) && bbdbgLastFileId > 0 &&
        bbdbgLastLine > 0
      ) {
        const loc = bbdbgLocString(bbdbgLastFileId, bbdbgLastLine);
        const stack = bbdbgStack.length
          ? ` stack=${bbdbgStack.slice().reverse().join(" -> ")}`
          : "";
        runtimeGaps.callSites.set(key, `${loc}${stack}`);
      }
      scheduleRuntimeGapsRender();
      if (next !== 1) return;
      calledNotices++;
      if (calledNotices <= calledNoticeLimit) {
        printOutput(`[stub] called ${key}`, "warning");
        if (calledNotices === calledNoticeLimit) {
          printOutput("[stub] more stub calls suppressed", "warning");
        }
      }
    },
  });

  if (stubbedTotal > 0) {
    const shown = stubbedKeys.slice(0, 30);
    applyRuntimeGapsReport(
      "main",
      stubbedTotal,
      stubbedKeys,
      Array.from(calledMissing.entries()).map(([key, count]) => ({
        key,
        count,
      })),
    );
    printOutput(
      `[stubs] stubbed ${stubbedTotal} missing import(s) (showing ${shown.length})`,
      "info",
    );
    printOutput(`[stubs] ${shown.join(", ")}`, "info");
  }

  const instance = await WebAssembly.instantiate(module, imports);
  sharedInstance = instance;
  instRef = instance;

  // Wire memory & allocString
  core.memory = (instance.exports as any).memory;
  core.instance = instance;
  core.module = module;
  core.exports = instance.exports;
  renderMemoryPanel();
  applyMemoryAutoRefresh();
  const stringAllocExport = (() => {
    const ex = instance.exports as Record<string, any>;
    if (typeof ex?.__StringAlloc === "function") return ex.__StringAlloc;
    if (typeof ex?.["__StringAlloc%"] === "function") {
      return ex["__StringAlloc%"];
    }
    if (typeof ex?.__StringAlloc_ === "function") return ex.__StringAlloc_;
    if (typeof ex?.["__StringAlloc_%"] === "function") {
      return ex["__StringAlloc_%"];
    }
    try {
      for (const k of Object.keys(ex || {})) {
        if (!/stringalloc/i.test(k)) continue;
        const v = ex[k];
        if (typeof v === "function") return v;
      }
    } catch {}
    return null;
  })();
  const alloc = (typeof stringAllocExport === "function")
    ? stringAllocExport
    : allocStringObjPtr;
  if (core.memory) {
    const mem = core.memory;
    core.allocString = (text) => {
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
    fileIO.setMemory(core.memory);
  } catch {}

  const exports = (instance.exports || {}) as Record<string, any>;

  // If the program exports a __Step function, we still need to run the program
  // entrypoint once so global initialization executes (Blitz semantics).
  // WARNING: if user init contains a blocking loop, this will still freeze the tab.
  const entry = exports.main || exports._start || exports.Main;
  const step = exports.__Step || exports["__Step%"] || exports.Step ||
    exports["Step%"];

  if (typeof step === "function" && typeof entry === "function") {
    try {
      entry();
    } catch (e) {
      const msg = errorMessage(e);
      if (((e as any)?.__blitz3dEnd) || msg === "__BLITZ3D_END__") {
        printOutput("Program ended.", "success");
        stopExecution();
        return { startedStepping: false };
      }
      // If init fails, surface it and stop before starting RAF.
      printOutput(`Execution error: ${msg}`, "error");
      const st = errorStack(e);
      if (showStacks && st) {
        try {
          printOutput(String(st), "error");
        } catch {}
      }
      stopExecution();
      return { startedStepping: false };
    }
  }

  // Prefer stepping (non-blocking) if present.
  if (typeof step === "function") {
    mainThreadRunDeadline = 0;
    isRunning = true;
    debugSteppingActive = true;
    debugSteppingPaused = false;
    debugSteppingStepOnce = false;
    bbdbgBreakpointHitThisStep = false;
    bbdbgBreakpointLastHit = null;
    updateBbdbgButtons();

    const tick = () => {
      if (mainThreadStopRequested || sharedStopRequested) {
        isRunning = false;
        debugSteppingActive = false;
        debugSteppingPaused = false;
        debugSteppingStepOnce = false;
        debugSteppingTick = null;
        updateBbdbgButtons();
        return;
      }
      if (debugSteppingPaused) return;

      const started = performance.now();
      bbdbgBreakpointHitThisStep = false;
      try {
        step();
      } catch (e) {
        const msg = errorMessage(e);
        if (((e as any)?.__blitz3dEnd) || msg === "__BLITZ3D_END__") {
          printOutput("Program ended.", "success");
          stopExecution();
          return;
        }
        printOutput(`Execution error: ${msg}`, "error");
        const st = errorStack(e);
        if (showStacks && st) {
          try {
            printOutput(String(st), "error");
          } catch {}
        }
        stopExecution();
        return;
      }

      const elapsed = performance.now() - started;
      if (timeoutMs > 0 && elapsed > timeoutMs) {
        printOutput(
          `Step exceeded budget (${
            Math.round(elapsed)
          }ms > ${timeoutMs}ms). Stopping.`,
          "error",
        );
        stopExecution();
        return;
      }

      if (debugSteppingStepOnce || bbdbgBreakpointHitThisStep) {
        debugSteppingStepOnce = false;
        const loc = bbdbgBreakpointLastHit
          ? bbdbgLocString(
            bbdbgBreakpointLastHit.fileId,
            bbdbgBreakpointLastHit.line,
          )
          : "";
        pauseStepping(loc ? `Paused at ${loc}` : "Paused");
        return;
      }

      sharedStepRaf = requestAnimationFrame(tick);
    };

    debugSteppingTick = tick;
    sharedStepRaf = requestAnimationFrame(tick);
    return { startedStepping: true };
  }

  // Fallback: run entrypoint directly (can freeze if user wrote a tight loop).
  if (typeof entry === "function") {
    try {
      entry();
    } catch (e) {
      const msg = errorMessage(e);
      if (((e as any)?.__blitz3dEnd) || msg === "__BLITZ3D_END__") {
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

/**
 * Legacy (pre-shared-runtime) import stubs used by early interpreter prototypes.
 *
 * The current interpreter prefers the shared SCPCB runtime (`Blitz3DCore`,
 * `Blitz3DGraphics`, `Blitz3DFileIO`) for main-thread graphics execution and a
 * small sandbox worker for non-graphics execution. This function is intentionally
 * unused but kept as a reference when adding new stubs.
 *
 * @deprecated Not used by current interpreter.
 * @internal
 */
function createLegacyRuntimeImports_UNUSED(): Record<
  string,
  Record<string, any>
> {
  const imports: Record<string, Record<string, any>> = {
    env: {},
    blitz3d: {},
    al: {},
  };

  // Local placeholders: this function is intentionally unused but kept as
  // reference. Keep it type-checkable in module context.
  const runtimeInstance: any = null;
  const fileHandles = new Map<number, any>();
  let nextFileHandle = 1;
  const randU32 = (): number => (Math.random() * 0x100000000) >>> 0;
  const randFloat01 = (): number => Math.random();
  let draw2DColor = "#ffffff";
  let draw2DFont = "16px sans-serif";
  const hudCtx = hudCanvasEl.getContext("2d");
  const fontHandles = new Map<number, string>();
  let nextFontHandle = 1;
  const imageHandles = new Map<number, any>();
  let nextImageHandle = 1;
  let rngState = 0x12345678;
  const keyDownSet = new Set<number>();
  const keyHitSet = new Set<number>();
  const keyQueue: number[] = [];
  let mouseX = 0;
  let mouseY = 0;
  let mouseZ = 0;
  let mouseXSpeed = 0;
  let mouseYSpeed = 0;
  const mouseDownSet = new Set<number>();
  const mouseHitSet = new Set<number>();
  const entities = new Map<number, any>();
  let nextEntityId = 1;
  const surfaces = new Map<number, any>();
  let nextSurfaceId = 1;
  const meshSurfaces = new Map<number, any>();
  const dirtySurfaceIds = new Set<number>();
  const ensureSurfaceGeometry = (_surfaceId: number): void => {};
  const textureHandles = new Map<number, any>();
  let nextTextureHandle = 1;
  const brushHandles = new Map<number, any>();
  let nextBrushHandle = 1;
  let threeRenderer: any = null;
  let threeScene: any = null;
  let threeCamera: any = null;
  let cameraViewport: any = null;
  const applyCameraViewport = (): void => {};
  const resizeThreeToContainer = (): void => {};
  let fogMode = 0;
  let fogColor = 0;
  let fogNear = 0;
  let fogFar = 0;
  let fogDensity = 0;
  const updateFog = (): void => {};
  let ambientLight: any = null;

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

  const functions: Record<string, (...args: any[]) => any> = {
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
    Lower: (sPtr) =>
      allocB3DStringObj(decodeB3DStringObj(sPtr | 0).toLowerCase()),
    Upper: (sPtr) =>
      allocB3DStringObj(decodeB3DStringObj(sPtr | 0).toUpperCase()),
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
      rec.out.push(
        len & 0xff,
        (len >> 8) & 0xff,
        (len >> 16) & 0xff,
        (len >> 24) & 0xff,
      );
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
      rec.out.push(
        x & 0xff,
        (x >> 8) & 0xff,
        (x >> 16) & 0xff,
        (x >> 24) & 0xff,
      );
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
      const mesh = entity as any;
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
      const mesh = entity as any;
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
      const mesh = entity as any;
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
      const mesh = entity as any;
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
      const mesh = entity as any;
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
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
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
function printOutput(text: string, type: OutputLineKind = "info"): void {
  const line = document.createElement("div");
  line.className = `output-line ${type}`;
  line.textContent = text;
  outputEl.appendChild(line);
  outputEl.scrollTop = outputEl.scrollHeight;
}

function clearOutput(): void {
  outputEl.innerHTML = "";
}

function setStatus(state: string, text: string): void {
  statusIndicatorEl.className = "status-indicator " + state;
  statusTextEl.textContent = text;
}

function showTab(tabName: TabName): void {
  document.querySelectorAll<HTMLButtonElement>(".tab").forEach((tab) => {
    tab.classList.remove("active");
    if ((tab.dataset.tab ?? "") === tabName) {
      tab.classList.add("active");
    }
  });

  document.querySelectorAll<HTMLElement>(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  const targetTab = document.getElementById(tabName + "-tab");
  if (targetTab) {
    targetTab.classList.add("active");
  }
}

console.log("Blitz3D Interpreter loaded");
