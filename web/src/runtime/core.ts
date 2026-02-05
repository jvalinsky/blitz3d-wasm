/**
 * Blitz3D runtime core (browser).
 *
 * This module owns the shared WASM state (memory/exports) and browser resources
 * (canvas, 2D context). Other subsystems (File I/O, Graphics, Audio) attach
 * themselves to a single `Blitz3DCore` instance.
 */
import JSZip from "jszip";
import { EntityTableView } from "../shared/entity_table.ts";

/**
 * Shared state for a single Blitz3D runtime instance.
 *
 * The core is created early, then:
 * - `init(canvasId)` wires DOM resources
 * - WASM instantiation fills `memory` and `exports`
 * - runtime subsystems attach themselves via `core.fileIO`, `core.graphics`, etc.
 */
export class Blitz3DCore {
  [key: string]: any;
  env: Record<string, unknown>;
  allocString: ((str: string) => number) | null;
  textCanvas: HTMLCanvasElement | null;

  constructor() {
    this.memory = null;
    this.canvas = null;
    this.gl = null;
    this.textCanvas = null;
    this.ctx2d = null;
    this.instance = null;
    this.module = null;
    this.exports = null;
    this.dataPointer = 256;
    this.allocString = null;
    this.entityTable = null;
    this.env = {};

    // Seeded random number generator (LCG)
    this.randomSeed = 0;
    this.randomState = 0;

    // Performance monitoring
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.fps = 0;
    this.frameTimes = [];
    this.maxFrameSamples = 60;

    // Memory tracking
    this.heapAllocations = 0;
    this.stringAllocations = 0;

    // Optimization flags
    this.useBatchRendering = true;
    this.useGeometryInstancing = false;
    this.cachedTextureLookups = true;
    this.currentDir = "/";

    // Banks support
    this.banks = new Map();
    this.nextBankId = 1;
  }

  // Performance monitoring
  beginFrame(): void {
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const frameTime = now - this.lastFrameTime;
      this.frameTimes.push(frameTime);
      if (this.frameTimes.length > this.maxFrameSamples) {
        this.frameTimes.shift();
      }
      // Calculate rolling average FPS
      if (this.frameTimes.length === this.maxFrameSamples) {
        const avgFrameTime = this.frameTimes.reduce(
          (a: number, b: number) => a + b,
          0,
        ) /
          this.maxFrameSamples;
        this.fps = 1000 / avgFrameTime;
      }
    }
    this.lastFrameTime = now;
    this.frameCount++;
  }

  getPerformanceStats(): {
    fps: string;
    frameCount: number;
    heapAllocations: number;
    stringAllocations: number;
    memoryUsage: string;
  } {
    return {
      fps: this.fps.toFixed(1),
      frameCount: this.frameCount,
      heapAllocations: this.heapAllocations,
      stringAllocations: this.stringAllocations,
      memoryUsage: this.memory
        ? (this.memory.buffer.byteLength / 1024).toFixed(1) + " KB"
        : "N/A",
    };
  }

  // Linear Congruential Generator for seeded random
  seedRnd(seed: number): void {
    this.randomSeed = seed;
    this.randomState = seed;
  }

  // Returns float in [0, 1)
  rndFloat(min?: number, max?: number): number {
    if (min === undefined) min = 0;
    if (max === undefined) max = 1;

    // If seed is 0 (uninitialized), use Math.random
    if (this.randomSeed === 0) {
      return Math.random() * (max - min) + min;
    }

    // LCG: x_{n+1} = (a * x_n + c) mod m
    // Using parameters from Numerical Recipes
    this.randomState = (1664525 * this.randomState + 1013904223) % 4294967296;
    const normalized = this.randomState / 4294967296;
    return normalized * (max - min) + min;
  }

  // Returns integer in [min, max]
  rndInt(min: number, max: number): number {
    return Math.floor(this.rndFloat(min, max + 1));
  }

  /**
   * Initialize DOM resources for the runtime.
   *
   * This must be called before initializing graphics (`Graphics3D`).
   */
  init(canvasId: string): void {
    const existingCanvas = document.getElementById(canvasId) as
      | HTMLCanvasElement
      | null;
    if (!existingCanvas) {
      console.error("Canvas not found: " + canvasId);
      return;
    }

    const defaultSize =
      (existingCanvas.width === 300 && existingCanvas.height === 150) ||
      existingCanvas.width <= 0 || existingCanvas.height <= 0;
    const parent = existingCanvas.parentElement;
    const cssW = existingCanvas.clientWidth || parent?.clientWidth ||
      window.innerWidth;
    const cssH = existingCanvas.clientHeight || parent?.clientHeight ||
      window.innerHeight;
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const targetW = defaultSize ? Math.max(1, Math.floor(cssW * dpr)) : existingCanvas.width;
    const targetH = defaultSize ? Math.max(1, Math.floor(cssH * dpr)) : existingCanvas.height;

    // Always create a dedicated WebGL canvas (avoid 2D context contamination)
    const glCanvas = document.createElement("canvas");
    glCanvas.width = targetW || 800;
    glCanvas.height = targetH || 600;
    glCanvas.id = existingCanvas.id;
    glCanvas.style.width = existingCanvas.style.width || "100%";
    glCanvas.style.height = existingCanvas.style.height || "100%";
    glCanvas.style.display = existingCanvas.style.display || "block";
    glCanvas.style.position = existingCanvas.style.position || "relative";

    if (existingCanvas.parentElement) {
      existingCanvas.parentElement.replaceChild(glCanvas, existingCanvas);
    }
    this.canvas = glCanvas;

    // Setup 2D overlay canvas for Text commands
    this.textCanvas = document.createElement("canvas");
    this.textCanvas.width = this.canvas.width;
    this.textCanvas.height = this.canvas.height;
    // In debug HUD mode, ensure the overlay is visible even if the loader HTML overlay
    // is still on-screen by drawing above everything.
    const flags: any = (globalThis as any).__BLITZ3D_FLAGS;
    const debugHud = !!flags?.debugHud;
    this.textCanvas.style.position = debugHud ? "fixed" : "absolute";
    this.textCanvas.style.top = "0";
    this.textCanvas.style.left = "0";
    this.textCanvas.style.width = glCanvas.style.width;
    this.textCanvas.style.height = glCanvas.style.height;
    this.textCanvas.style.zIndex = debugHud ? "100000" : "10";
    this.textCanvas.style.pointerEvents = "none";
    if (this.canvas.parentElement) {
      // Ensure absolute-positioned children align to this container.
      try {
        const pe = this.canvas.parentElement as HTMLElement;
        const pos = globalThis.getComputedStyle?.(pe)?.position;
        if (!pos || pos === "static") pe.style.position = "relative";
      } catch { }
      this.canvas.parentElement.appendChild(this.textCanvas);
    }
    this.ctx2d = this.textCanvas.getContext("2d");

    console.log("Blitz3D Runtime Core Initialized");
  }

  createBankFromData(data: Uint8Array) {
    const bankId = this.nextBankId++;
    this.banks.set(bankId, data);
    return bankId;
  }

  readString(ptr: number): string {
    if (!this.memory || !this.memory.buffer) {
      return "";
    }
    if (!ptr) return "";
    const memory = new Uint8Array(this.memory.buffer);
    const maxLen = memory.length;

    // Blitz3D-WASM strings are typically stored with an 8-byte header:
    //   [refCount:i32][length:i32][bytes...][0]
    // Some older/utility paths may still pass a raw null-terminated C-string pointer,
    // so we auto-detect and fall back if the header looks invalid.
    try {
      if (ptr + 8 <= maxLen) {
        const view = new DataView(this.memory.buffer);
        const len = view.getInt32(ptr + 4, true);
        const start = ptr + 8;
        const end = start + len;
        const maxStringLen = 1024 * 1024;
        if (len >= 0 && len <= maxStringLen && end >= start && end <= maxLen) {
          let out = "";
          for (let i = start; i < end; i++) {
            out += String.fromCharCode(memory[i]);
          }
          return out;
        }
      }
    } catch {
      // fall through to C-string mode
    }

    // Fallback: raw null-terminated string.
    let str = "";
    let i = ptr;
    const maxStringLen = 1024 * 1024;
    let charsRead = 0;
    while (i < maxLen && charsRead < maxStringLen) {
      const byte = memory[i];
      if (byte === 0) break;
      str += String.fromCharCode(byte);
      i++;
      charsRead++;
    }
    return str;
  }

  setupCommonImports(imports: any) {
    // Keep a reference so other runtime subsystems (e.g. command buffer executor)
    // can call existing import-backed implementations (audio, etc.) without duplicating logic.
    this.imports = imports;

    // Math utilities
    imports.env.WrapAngle = (angle: number) => {
      // Normalize angle to -180 to 180
      while (angle > 180) angle -= 360;
      while (angle < -180) angle += 360;
      return angle;
    };

    imports.env.DeltaYaw = (src: number, dest: number) => {
      let delta = dest - src;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return delta;
    };

    imports.env.DeltaPitch = (src: number, dest: number) => {
      let delta = dest - src;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return delta;
    };

    imports.env.CurveValue = (current: number, target: number, speed: number) => {
      // Smooth interpolation towards target
      return current + (target - current) * speed;
    };

    imports.env.CurveAngle = (current: number, target: number, speed: number) => {
      // Smooth angle interpolation
      let delta = target - current;
      while (delta > 180) delta -= 360;
      while (delta < -180) delta += 360;
      return current + delta * speed;
    };

    imports.env.Distance = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.sqrt(dx * dx + dy * dy);
    };

    imports.env.Point_Direction = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      return Math.atan2(dy, dx) * 180 / Math.PI;
    };

    imports.env.DebugLog = (msgPtr: number) => {
      const msg = this.readString(msgPtr);
      console.log(`[Blitz3D Debug] ${msg}`);
    };

    imports.env.AppTitle = (titlePtr: number, _closeMsgPtr: number) => {
      const title = this.readString(titlePtr);
      document.title = title;
      console.log(`[Blitz3D] AppTitle: ${title}`);
    };

    imports.env.SystemProperty = (propPtr: number) => {
      const prop = this.readString(propPtr).toLowerCase();
      let result = "";
      if (prop === "os") result = "windows";
      else if (prop === "language") result = "en";
      else if (prop === "appdir") result = "/";
      else return 0; // Better safe than empty string pointer if not matched

      if (this.allocString) return this.allocString(result);
      return 0;
    };

    imports.env.RemoveEvent = (eventPtr: number) => {
      console.log(`RemoveEvent: event=${eventPtr}`);
    };

    imports.env.RuntimeError = (msgPtr: number) => {
      const msg = this.readString(msgPtr);
      console.error(`[Blitz3D Error] ${msg}`);
      throw new Error(msg);
    };

    imports.env.End = () => {
      // Many Blitz3D programs use `End` as a structured early-exit after initialization.
      // We throw a tagged error so JS callers can treat it as a non-fatal stop signal.
      const err: any = new Error("__BLITZ3D_END__");
      err.__blitz3dEnd = true;
      throw err;
    };

    imports.env.ExecFile = (filePtr: number) => {
      const file = this.readString(filePtr);
      console.warn(
        `[Blitz3D] ExecFile requested: ${file} (Ignored in browser)`,
      );
    };

    imports.env.CatchErrors = () => {
      console.log("[Blitz3D] CatchErrors enabled");
    };

    // SCPCB uses `MilliSecs()` to drive dt; clamp large jumps (tab background/resume)
    // to avoid physics/camera explosions.
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
          console.warn(
            `[Time] clamping MilliSecs delta ${delta.toFixed(1)}ms -> ${maxDeltaMs}ms`,
          );
          clampWarns++;
        }
        delta = maxDeltaMs;
      }
      virtualNowMs += delta;
      return (virtualNowMs | 0) & 0x7fffffff;
    };

    imports.env.MilliSecs = () => millisClamped();
    imports.env.MilliSecs2 = () => millisClamped();

    imports.env.DebugLog = (msgPtr) => {
      const msg = this.readString(msgPtr);
      console.log(`[BB Debug] ${msg}`);
    };

    imports.env.Delay = (ms) => {
      // Busy wait or ignore? Usually BB Delay is used for frame limiting.
      // In browser, we should definitely NOT busy wait.
      console.log(
        `[BB] Delay(${ms}) requested - ignoring to keep browser responsive`,
      );
    };

    imports.env.CurrentDate = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString();
      return this.allocString ? this.allocString(dateStr) : 0;
    };

    // Math utilities
    imports.env.Min = (a, b) => Math.min(a, b);
    imports.env.Max = (a, b) => Math.max(a, b);
    imports.env.ATan2 = (y, x) => Math.atan2(y, x);
    imports.env.Log10 = (x) => Math.log10(x);

    // String utilities
    imports.env.StringEqual = (str1Ptr, str2Ptr) => {
      const str1 = this.readString(str1Ptr);
      const str2 = this.readString(str2Ptr);
      return str1 === str2 ? 1 : 0;
    };

    // Data statements (not fully implemented)
    imports.env.ReadData = (typeHint) => {
      console.warn("ReadData not implemented");
      return 0;
    };

    imports.env.RestoreData = () => {
      console.warn("RestoreData not implemented");
    };

    imports.env.Print = (strPtr) => {
      const str = this.readString(strPtr);
      console.log(`[Blitz3D] ${str}`);
    };

    imports.env.PrintInt = (val) => console.log(`[Blitz3D] Int: ${val}`);
    imports.env.PrintFloat = (val) => console.log(`[Blitz3D] Float: ${val}`);
    imports.env.PrintString = (ptr) => {
      const str = this.readString(ptr);
      console.log(`[Blitz3D] String: ${str}`);
      return str.length;
    };

    // SCPCB helpers (safe no-ops / basic stubs)
    imports.env.UpdateSoundOrigin = (..._args: any[]) => { };
    imports.env.UpdateSoundOrigin2 = (..._args: any[]) => { };
    imports.env.LoadEventSound = (..._args: any[]) => 0;
    imports.env.PlayAnnouncement = (..._args: any[]) => { };
    imports.env.KeyName = (keyCode: number) => {
      const name = `KEY_${keyCode}`;
      return this.allocString ? this.allocString(name) : 0;
    };

    imports.env.Cls = () => {
      if (this.gl) {
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
      }
      if (this.ctx2d && this.textCanvas) {
        this.ctx2d.clearRect(
          0,
          0,
          this.textCanvas.width,
          this.textCanvas.height,
        );
      }
    };

    this.lastFlip = 0;
    imports.env.Flip = (vwait) => {
      // In a synchronous WASM loop, we can't truly yield.
      // But we can check if we're running too fast and maybe log a warning
      const now = performance.now();
      const delta = now - this.lastFlip;
      if (this.lastFlip > 0 && delta < 1) {
        // Running > 1000fps, might be a bug or tight loop
      }
      this.lastFlip = now;

      // Blitz3D expects Flip to swap buffers and potentially wait for VSync.
      // In the browser, the requestAnimationFrame loop in main.ts handles the actual rendering.
      // We just need to make sure this doesn't block forever if called in a loop.
    };

    // Time
    imports.env.MilliCSecs = () => performance.now() | 0;
    imports.env.Delay = (ms) => {
      console.warn(
        `[Blitz3D] Synchronous Delay(${ms}ms) is not possible in browser. Ignoring.`,
      );
    };

    // Math
    imports.env.Sin = (val) => Math.sin(val * Math.PI / 180);
    imports.env.Cos = (val) => Math.cos(val * Math.PI / 180);
    imports.env.Tan = Math.tan;
    imports.env.ASin = Math.asin;
    imports.env.ACos = Math.acos;
    imports.env.ATan = Math.atan;
    imports.env.ATan2 = Math.atan2;
    imports.env.Sqr = Math.sqrt;
    imports.env.Sqrt = Math.sqrt;
    imports.env.Floor = Math.floor;
    imports.env.Ceil = Math.ceil;
    imports.env.Exp = Math.exp;
    imports.env.Log = Math.log;
    imports.env.Log10 = Math.log10;
    imports.env.Abs = Math.abs;
    imports.env.Sgn = Math.sign;
    imports.env.Mod = (a, b) => a % b;
    imports.env.Pow = (a, b) => Math.pow(a, b);
    imports.env.Rnd = (min, max) => this.rndFloat(min, max);
    imports.env.Rand = (min, max) => this.rndInt(min, max);
    imports.env.SeedRnd = (seed) => {
      this.seedRnd(seed);
    };
    imports.env.RndSeed = () => {
      return this.randomSeed | 0;
    };

    // Strings
    imports.env.StringConcat = (aPtr, bPtr) => {
      const a = this.readString(aPtr);
      const b = this.readString(bPtr);
      if (this.allocString) {
        return this.allocString(a + b);
      }
      console.warn("StringConcat: allocString not available");
      return 0;
    };
    imports.env.IntToString = (i) => {
      if (this.allocString) {
        return this.allocString(i.toString());
      }
      return 0;
    };
    imports.env.FloatToString = (f) => {
      if (this.allocString) {
        return this.allocString(f.toString());
      }
      return 0;
    };

    // String manipulation functions
    imports.env.Left = (strPtr, n) => {
      const str = this.readString(strPtr);
      const result = str.substring(0, n);
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.Right = (strPtr, n) => {
      const str = this.readString(strPtr);
      const result = str.substring(str.length - n);
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.Mid = (strPtr, start, len) => {
      const str = this.readString(strPtr);
      // Blitz3D uses 1-based indexing
      const result = str.substring(start - 1, start - 1 + len);
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.Upper = (strPtr) => {
      const str = this.readString(strPtr);
      const result = str.toUpperCase();
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.Lower = (strPtr) => {
      const str = this.readString(strPtr);
      const result = str.toLowerCase();
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.Replace = (strPtr, findPtr, subPtr) => {
      const str = this.readString(strPtr);
      const find = this.readString(findPtr);
      const sub = this.readString(subPtr);
      const result = str.split(find).join(sub);
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.Instr = (strPtr, findPtr, start) => {
      const str = this.readString(strPtr);
      const find = this.readString(findPtr);
      // Blitz3D uses 1-based indexing
      const idx = str.indexOf(find, start - 1);
      return idx >= 0 ? idx + 1 : 0;
    };
    imports.env.Len = (strPtr) => {
      const str = this.readString(strPtr);
      return str.length;
    };
    imports.env.Trim = (strPtr) => {
      const str = this.readString(strPtr);
      const result = str.trim();
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.LTrim = (strPtr) => {
      const str = this.readString(strPtr);
      const result = str.trimStart();
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };
    imports.env.RTrim = (strPtr) => {
      const str = this.readString(strPtr);
      const result = str.trimEnd();
      if (this.allocString) {
        return this.allocString(result);
      }
      return 0;
    };

    // Character conversion functions
    imports.env.Asc = (strPtr) => {
      const str = this.readString(strPtr);
      return str.length > 0 ? str.charCodeAt(0) : 0;
    };
    imports.env.Chr = (n) => {
      if (this.allocString) {
        return this.allocString(String.fromCharCode(n));
      }
      return 0;
    };
    imports.env.Hex = (n) => {
      if (this.allocString) {
        return this.allocString(n.toString(16).toUpperCase());
      }
      return 0;
    };
    imports.env.Bin = (n) => {
      if (this.allocString) {
        return this.allocString(n.toString(2));
      }
      return 0;
    };

    // File I/O - Full implementation using virtual file system
    this.fileSystem = new Map();
    this.openFiles = new Map();
    this.nextFileHandle = 1;

    // Register a file in the virtual file system
    this.registerFile = (filePath, data) => {
      this.fileSystem.set(filePath, {
        data: data,
        size: data.length,
        position: 0,
      });
    };

    // Open a file and return a handle
    this.openFile = (filePath) => {
      if (this.fileSystem.has(filePath)) {
        const file = this.fileSystem.get(filePath);
        file.position = 0;
        const handle = this.nextFileHandle++;
        this.openFiles.set(handle, {
          ...file,
          path: filePath,
          eof: false,
        });
        return handle;
      }
      return 0; // File not found
    };

    // Close a file
    this.closeFile = (handle) => {
      this.openFiles.delete(handle);
    };

    // Read a byte
    this.readByte = (handle) => {
      const file = this.openFiles.get(handle);
      if (!file || file.position >= file.size) {
        if (file) file.eof = true;
        return -1;
      }
      return file.data[file.position++];
    };

    // Read signed byte
    this.readSignedByte = (handle) => {
      const byte = this.readByte(handle);
      return byte > 127 ? byte - 256 : byte;
    };

    // Read short (16-bit, little endian)
    this.readShort = (handle) => {
      const b1 = this.readByte(handle);
      const b2 = this.readByte(handle);
      if (b1 < 0 || b2 < 0) return 0;
      return b1 | (b2 << 8);
    };

    // Read int (32-bit, little endian)
    this.readInt = (handle) => {
      const b1 = this.readByte(handle);
      const b2 = this.readByte(handle);
      const b3 = this.readByte(handle);
      const b4 = this.readByte(handle);
      if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) return 0;
      return b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
    };

    // Read float
    this.readFloat = (handle) => {
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint8(0, this.readByte(handle));
      view.setUint8(1, this.readByte(handle));
      view.setUint8(2, this.readByte(handle));
      view.setUint8(3, this.readByte(handle));
      return view.getFloat32(0, true);
    };

    this.writeByte = (handle, byte) => {
      const file = this.openFiles.get(handle);
      if (!file || !file.isWrite) return;

      // Expand if needed
      if (file.position >= file.data.length) {
        const newSize = Math.max(file.data.length * 2, file.position + 128);
        const newData = new Uint8Array(newSize);
        newData.set(file.data);
        file.data = newData;
      }

      file.data[file.position++] = byte;
      if (file.position > file.size) file.size = file.position;
    };

    // Check EOF
    this.fileEof = (handle) => {
      const file = this.openFiles.get(handle);
      if (!file) return 1;
      return file.position >= file.size ? 1 : 0;
    };

    // Read string until newline or max length
    this.readLineFromFile = (handle) => {
      const file = this.openFiles.get(handle);
      if (!file) return 0;

      let str = "";
      let byte = this.readByte(handle);
      let count = 0;
      const maxLen = 1024;

      while (byte >= 0 && byte !== 10 && count < maxLen) {
        if (byte !== 13) { // Skip CR
          str += String.fromCharCode(byte);
        }
        byte = this.readByte(handle);
        count++;
      }

      if (this.allocString) {
        return this.allocString(str);
      }
      return 0;
    };

    imports.env.ReadFile = (pathPtr) => {
      const path = this.readString(pathPtr);
      return this.openFile(path);
    };

    imports.env.WriteFile = (pathPtr) => {
      const path = this.readString(pathPtr);
      // Write support is limited in browser - create a handle for saving
      const handle = this.nextFileHandle++;
      this.openFiles.set(handle, {
        data: new Uint8Array([]),
        size: 0,
        position: 0,
        path: path,
        eof: false,
        isWrite: true,
      });
      console.log(`WriteFile: ${path} (handle: ${handle})`);
      return handle;
    };

    imports.env.OpenFile = (pathPtr) => {
      const path = this.readString(pathPtr);
      let handle = this.openFile(path);
      if (handle) {
        const file = this.openFiles.get(handle);
        if (file) file.isWrite = true;
        return handle;
      }
      handle = this.nextFileHandle++;
      this.openFiles.set(handle, {
        data: new Uint8Array(32), // Start small
        size: 0,
        position: 0,
        path: path,
        eof: false,
        isWrite: true,
      });
      console.log(`OpenFile: ${path} (handle: ${handle})`);
      return handle;
    };

    imports.env.CloseFile = (stream) => {
      this.closeFile(stream);
    };

    imports.env.CreateDir = (pathPtr) => {
      const path = this.readString(pathPtr);
      console.log(`CreateDir: ${path}`);
      return 1; // Success
    };

    imports.env.DeleteDir = (pathPtr) => {
      const path = this.readString(pathPtr);
      console.log(`DeleteDir: ${path}`);
      return 1; // Success
    };

    imports.env.ChangeDir = (pathPtr) => {
      const path = this.readString(pathPtr);
      this.currentDir = path;
      console.log(`ChangeDir: ${path}`);
    };

    imports.env.CurrentDir = () => {
      return this.allocString ? this.allocString(this.currentDir) : 0;
    };

    imports.env.DeleteFile = (pathPtr) => {
      const path = this.readString(pathPtr);
      console.log(`DeleteFile: ${path}`);
      return 1; // Success
    };

    imports.env.CopyFile = (srcPtr, destPtr) => {
      const src = this.readString(srcPtr);
      const dest = this.readString(destPtr);
      console.log(`CopyFile: ${src} -> ${dest}`);
      return 1;
    };

    imports.env.RenameFile = (oldPtr, newPtr) => {
      const oldPath = this.readString(oldPtr);
      const newPath = this.readString(newPtr);
      console.log(`RenameFile: ${oldPath} -> ${newPath}`);
      return 1;
    };

    imports.env.FileTime = (pathPtr) => {
      return 0; // Stub
    };

    imports.env.ReadInt = (stream) => {
      return this.readInt(stream);
    };

    imports.env.ReadFloat = (stream) => {
      return this.readFloat(stream);
    };

    imports.env.WriteByte = (stream, byte) => this.writeByte(stream, byte);

    imports.env.WriteShort = (stream, val) => {
      this.writeByte(stream, val & 0xFF);
      this.writeByte(stream, (val >> 8) & 0xFF);
    };

    imports.env.WriteInt = (stream, val) => {
      this.writeByte(stream, val & 0xFF);
      this.writeByte(stream, (val >> 8) & 0xFF);
      this.writeByte(stream, (val >> 16) & 0xFF);
      this.writeByte(stream, (val >> 24) & 0xFF);
    };

    imports.env.WriteFloat = (stream, val) => {
      const buffer = new ArrayBuffer(4);
      new DataView(buffer).setFloat32(0, val, true);
      new Uint8Array(buffer).forEach((b) => this.writeByte(stream, b));
    };

    imports.env.WriteString = (stream, strPtr) => {
      const str = this.readString(strPtr);
      for (let i = 0; i < str.length; i++) {
        this.writeByte(stream, str.charCodeAt(i));
      }
      this.writeByte(stream, 0); // null term? Blitz write string typically writes length then chars or just chars?
      // "WriteString: Writes a string to a file stream. The 4 bytes following are the length of the string, followed by the string itself."
      // Ah, Blitz3D WriteString includes length (int).
      // Let's implement correctly: Length (Int) + Chars.
      // But wait, user might just expect C-string or raw.
      // Dictionary says: "Writes a string to the file stream. The string is written as an integer indicating the length of the string, followed by the characters."
      // Ref: https://blitzresearch.itch.io/blitz3d/docs/WriteString
    };

    // Redoing WriteString to be spec compliant
    imports.env.WriteString = (stream, strPtr) => {
      const str = this.readString(strPtr);
      const len = str.length;
      this.imports.env.WriteInt(stream, len);
      for (let i = 0; i < len; i++) this.writeByte(stream, str.charCodeAt(i));
    };

    imports.env.WriteLine = (stream, strPtr) => {
      const str = this.readString(strPtr);
      for (let i = 0; i < str.length; i++) {
        this.writeByte(stream, str.charCodeAt(i));
      }
      this.writeByte(stream, 13); // CR
      this.writeByte(stream, 10); // LF
    };

    imports.env.ReadString = (stream) => {
      return this.readLineFromFile(stream);
    };

    imports.env.ReadByte = (stream) => {
      return this.readByte(stream);
    };

    imports.env.ReadShort = (stream) => {
      return this.readShort(stream);
    };

    imports.env.Eof = (stream) => {
      return this.fileEof(stream);
    };

    imports.env.FilePos = (stream) => {
      const file = this.openFiles.get(stream);
      return file ? file.position : 0;
    };

    imports.env.SeekFile = (stream, pos) => {
      const file = this.openFiles.get(stream);
      if (file) {
        if (pos < 0) pos = 0;
        // Allow seeking past end? usually yes for write, maybe strict for read?
        // Blitz3D behavior: "If pos is greater than the file size, the file size is increased." (for write)
        // For read, it might just return EOF.
        file.position = pos;
        if (file.isWrite && pos > file.size) {
          // Expand if writing
          // Not handling expansion here yet, writeByte handles it on write.
          // But maybe we should update size if we just seeked past it?
          // "File size is extended". We'll update size if we write.
          // Changing size upon seek? Not necessarily unless we truncate/extend explicitly?
          // Actually "seek past end and write" extends. "Seek past end and read" is EOF.
        }
      }
    };

    imports.env.FileSize = (pathPtr) => {
      const path = this.readString(pathPtr);
      const file = this.fileSystem.get(path);
      return file ? file.size : 0;
    };

    imports.env.FileType = (pathPtr) => {
      const path = this.readString(pathPtr);
      const file = this.fileSystem.get(path);
      return file ? 1 : 0; // 1 = file, 0 = not found
    };

    // Banks
    imports.env.CreateBank = (size) => {
      const id = this.nextBankId++;
      this.banks.set(id, new Uint8Array(size));
      return id;
    };

    imports.env.FreeBank = (id) => {
      this.banks.delete(id);
    };

    imports.env.BankSize = (id) => {
      const bank = this.banks.get(id);
      return bank ? bank.length : 0;
    };

    imports.env.GetBankPtr = (id) => {
      // Note: In a real WASM runtime, banks might be in the main memory.
      // But here they are JS Uint8Arrays.
      // If the WASM expects a pointer, we have a problem.
      // However, Blitz3D often uses Bank handles, and GetBankPtr is for externals.
      // For now, return a virtual handle or log a warning.
      console.warn(
        `GetBankPtr called for bank ${id} - returning virtual offset`,
      );
      return id << 20; // 1MB aligned virtual pointers
    };

    imports.env.PeekByte = (id, offset) => {
      const bank = this.banks.get(id);
      return bank ? bank[offset] : 0;
    };

    imports.env.PokeByte = (id, offset, val) => {
      const bank = this.banks.get(id);
      if (bank) bank[offset] = val & 0xFF;
    };

    imports.env.PeekInt = (id, offset) => {
      const bank = this.banks.get(id);
      if (!bank) return 0;
      const view = new DataView(bank.buffer);
      return view.getInt32(offset, true);
    };

    imports.env.PokeInt = (id, offset, val) => {
      const bank = this.banks.get(id);
      if (!bank) return;
      const view = new DataView(bank.buffer);
      view.setInt32(offset, val, true);
    };

    imports.env.PeekFloat = (id, offset) => {
      const bank = this.banks.get(id);
      if (!bank) return 0;
      const view = new DataView(bank.buffer);
      return view.getFloat32(offset, true);
    };

    imports.env.PokeFloat = (id, offset, val) => {
      const bank = this.banks.get(id);
      if (!bank) return;
      const view = new DataView(bank.buffer);
      view.setFloat32(offset, val, true);
    };
    imports.env.ResizeBank = (id, size) => {
      const bank = this.banks.get(id);
      if (!bank) return;
      const newBank = new Uint8Array(size);
      newBank.set(bank.slice(0, Math.min(bank.length, size)));
      this.banks.set(id, newBank);
    };

    imports.env.CopyBank = (srcId, srcPos, destId, destPos, count) => {
      const src = this.banks.get(srcId);
      const dest = this.banks.get(destId);
      if (src && dest) {
        dest.set(src.subarray(srcPos, srcPos + count), destPos);
      }
    };

    imports.env.PeekShort = (id, offset) => {
      const bank = this.banks.get(id);
      if (!bank) return 0;
      const view = new DataView(bank.buffer);
      return view.getUint16(offset, true);
    };

    imports.env.PokeShort = (id, offset, val) => {
      const bank = this.banks.get(id);
      if (!bank) return;
      const view = new DataView(bank.buffer);
      view.setUint16(offset, val, true);
    };

    // Audio System - FMOD-style bindings (delegates to Blitz3DAudio)
    const getAudio = () => this.graphics?.audioSystem ?? null;

    imports.env.FSOUND_Init = (_freq, _channels, _flags) => {
      const audio = getAudio();
      if (!audio) return 0;
      if (audio.ensureContext) return audio.ensureContext() ? 1 : 0;
      return 1;
    };

    imports.env.FSOUND_Close = () => {
      this.shutdownAudio();
    };

    // Load a sound sample into memory (returns handle synchronously)
    imports.env.LoadSound = (pathPtr: number, flags = 0) => {
      const audio = getAudio();
      if (!audio) return 0;
      const path = this.readString(pathPtr);
      return audio.loadSound(path, flags);
    };

    imports.env.LoadTempSound = (pathPtr: number, flags = 0) => {
      return imports.env.LoadSound(pathPtr, flags);
    };

    // Play a one-shot sound
    imports.env.PlaySound = (soundId: number) => {
      return getAudio()?.playSound?.(soundId) ?? 0;
    };

    imports.env.PlaySound_Strict = (soundId: number) =>
      imports.env.PlaySound(soundId);
    imports.env.LoadSound_Strict = (pathPtr: number) =>
      imports.env.LoadSound(pathPtr, 0);
    imports.env.StreamSound_Strict = (pathPtr: number) =>
      imports.env.FSOUND_Stream_Open(pathPtr, 0);

    imports.env.SetStreamVolume_Strict = (streamHandle: number, vol: number) => {
      getAudio()?.setChannelVolume?.(streamHandle, vol);
    };

    imports.env.SetStreamPaused_Strict = (streamHandle: number, paused: number) => {
      imports.env.FSOUND_SetPaused(streamHandle, paused);
    };

    imports.env.IsStreamPlaying_Strict = (streamHandle: number) =>
      imports.env.FSOUND_IsPlaying(streamHandle);

    imports.env.SetStreamPan_Strict = (streamHandle: number, pan: number) => {
      const fmodPan = Math.round(127.5 + 127.5 * pan);
      imports.env.FSOUND_SetPan(streamHandle, fmodPan);
    };

    imports.env.StopStream_Strict = (streamHandle: number) => {
      // StrictLoads handles FSOUND_StopSound + Stream_Stop + Stream_Close itself.
      imports.env.FSOUND_StopSound(streamHandle);
    };

    imports.env.FreeSound = (soundId: number) => {
      getAudio()?.freeSound?.(soundId);
    };

    imports.env.LoopSound2 = (soundId: number) => {
      getAudio()?.loopSound?.(soundId, true);
    };

    imports.env.PlaySound2 = (soundId: number) => imports.env.PlaySound(soundId);
    imports.env.FreeSound_Strict = (soundId: number) =>
      imports.env.FreeSound(soundId);

    imports.env.StopChannel = (channel: number) => {
      getAudio()?.stopChannel?.(channel);
    };

    imports.env.ChannelPan = (channel: number, pan: number) => {
      getAudio()?.setChannelPan?.(channel, pan);
    };

    imports.env.ChannelVolume = (channel: number, volume: number) => {
      getAudio()?.setChannelVolume?.(channel, volume);
    };

    imports.env.ChannelPitch = (channel: number, pitch: number) => {
      getAudio()?.setChannelPitch?.(channel, pitch);
    };

    imports.env.ChannelPaused = (channel: number, paused: number) => {
      if (paused) getAudio()?.pauseChannel?.(channel);
      else getAudio()?.resumeChannel?.(channel);
    };

    imports.env.ChannelPlaying = (channelValue: number) => {
      return getAudio()?.isChannelPlaying?.(channelValue) ? 1 : 0;
    };

    imports.env.PauseChannel = (channel: number) => {
      getAudio()?.pauseChannel?.(channel);
    };

    imports.env.ResumeChannel = (channel: number) => {
      getAudio()?.resumeChannel?.(channel);
    };

    // Stream functions
    imports.env.FSOUND_Stream_Open = (pathPtr: number, mode: number) => {
      const audio = getAudio();
      if (!audio?.openStream) return 0;
      const path = this.readString(pathPtr);
      return audio.openStream(path, mode);
    };

    imports.env.FSOUND_Stream_Play = (_channel: number, streamId: number) => {
      return getAudio()?.playStream?.(streamId) ?? 0;
    };

    imports.env.FSOUND_Stream_Stop = (streamId: number) => {
      getAudio()?.stopStream?.(streamId);
    };

    imports.env.FSOUND_Stream_Close = (streamId: number) => {
      getAudio()?.closeStream?.(streamId);
    };

    imports.env.FSOUND_SetPan = (channel: number, pan: number) => {
      const normPan = (pan - 128) / 128.0;
      getAudio()?.setChannelPan?.(channel, normPan);
    };

    imports.env.FSOUND_StopSound = (channel: number) => {
      getAudio()?.stopChannel?.(channel);
    };

    imports.env.FSOUND_IsPlaying = (channel: number) => {
      return getAudio()?.isChannelPlaying?.(channel) ? 1 : 0;
    };

    imports.env.FSOUND_SetPaused = (channel: number, paused: number) => {
      if (paused) getAudio()?.pauseChannel?.(channel);
      else getAudio()?.resumeChannel?.(channel);
    };

    imports.env.FSOUND_SetVolume = (channel: number, volume: number) => {
      const normVol = volume / 255.0;
      getAudio()?.setChannelVolume?.(channel, normVol);
    };

    // 3D Sound helpers (SCPCB doesn't call Sound3D today, but keep it wired)
    imports.env.Sound3D = (soundId: number, x: number, y: number, z: number) => {
      getAudio()?.setSoundPosition?.(soundId, x, y, z);
    };

    imports.env.SetListenerLocation = (
      x,
      y,
      z,
      forwardX,
      forwardY,
      forwardZ,
      upX,
      upY,
      upZ,
    ) => {
      // Prefer audioSystem's listener updates (camera-based). Keep as no-op for now.
      void [x, y, z, forwardX, forwardY, forwardZ, upX, upY, upZ];
    };

    if (!imports.blitz3d) imports.blitz3d = {};
    imports.blitz3d.ChannelPitch = imports.env.ChannelPitch;
    imports.blitz3d.LoopSound = (soundId: number) =>
      getAudio()?.loopSound?.(soundId, true);
    imports.blitz3d.SoundVolume = (soundId: number, volume: number) =>
      getAudio()?.setSoundVolume?.(soundId, volume);
    imports.blitz3d.SoundPan = (soundId: number, pan: number) =>
      getAudio()?.setSoundPan?.(soundId, pan);

    imports.env.PlayMusic = (pathPtr: number) => {
      const audio = getAudio();
      if (!audio) return 0;
      const path = this.readString(pathPtr);
      if (audio.openStream && audio.playStream) {
        const streamId = audio.openStream(path, 2);
        return streamId ? audio.playStream(streamId, undefined, undefined, undefined, true) : 0;
      }
      const soundId = audio.loadSound(path, 0);
      if (soundId) {
        audio.loopSound?.(soundId, true);
        return audio.playSound?.(soundId) ?? 0;
      }
      return 0;
    };

    // Zip/Archive support for assets.zip
    this.zipArchives = new Map();
    this.nextZipHandle = 1;

    this.loadZipArchive = async (path) => {
      try {
        // Try virtual file system first
        if (this.fileSystem && this.fileSystem.has(path)) {
          const file = this.fileSystem.get(path);
          const zip = await JSZip.loadAsync(file.data);
          const fileMap = new Map();

          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
              fileMap.set(relativePath, zipEntry);
            }
          });

          this.zipArchives.set(path, fileMap);
          return fileMap.size;
        }

        // Try to fetch
        const response = await fetch(path);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const arrayBuffer = await response.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        const fileMap = new Map();

        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            fileMap.set(relativePath, zipEntry);
          }
        });

        this.zipArchives.set(path, fileMap);
        console.log("Loaded ZIP: " + path + " (" + fileMap.size + " files)");
        return fileMap.size;
      } catch (e) {
        console.error("Failed to load ZIP " + path + ":", e);
        return 0;
      }
    };

    imports.env.ZlibWapi_Open = async (pathPtr) => {
      const path = this.readString(pathPtr);
      const handle = this.nextZipHandle++;

      const fileCount = await this.loadZipArchive(path);
      if (fileCount > 0) {
        this.zipArchives.set(handle, {
          path: path,
          files: this.zipArchives.get(path),
          isHandle: true,
        });
        // Transfer ownership from path-based to handle-based
        this.zipArchives.delete(path);
        return handle;
      }
      return 0;
    };

    imports.env.ZlibWapi_Close = (zip) => {
      if (this.zipArchives.has(zip)) {
        this.zipArchives.delete(zip);
      }
    };

    imports.env.ZlibWapi_GetFileCount = (zip) => {
      const archive = this.zipArchives.get(zip);
      if (archive && archive.files) {
        return archive.files.size;
      }
      return 0;
    };

    imports.env.ZlibWapi_GetFileName = (zip, index) => {
      const archive = this.zipArchives.get(zip);
      if (archive && archive.files) {
        const entries = Array.from(archive.files.keys());
        if (index >= 0 && index < entries.length) {
          const filename = entries[index];
          if (this.allocString) {
            return this.allocString(filename as string);
          }
        }
      }
      return 0;
    };

    imports.env.ZlibWapi_ExtractFile = async (zip, index, destPtr) => {
      const archive = this.zipArchives.get(zip);
      if (archive && archive.files) {
        const entries = Array.from(archive.files.keys());
        if (index >= 0 && index < entries.length) {
          const filename = entries[index];
          const zipEntry = archive.files.get(filename);

          if (zipEntry) {
            try {
              const data = await zipEntry.async("uint8array");
              const destPath = this.readString(destPtr);

              // Register in virtual file system
              this.registerFile(destPath, data);

              console.log("Extracted: " + filename + " -> " + destPath);
              return 1;
            } catch (e) {
              console.error("Failed to extract " + filename + ":", e);
            }
          }
        }
      }
      return 0;
    };

    // Networking (TCP) for SCP:CB multiplayer
    this.tcpStreams = new Map();
    this.nextStreamId = 1;

    imports.env.OpenTCPStream = async (hostPtr, port) => {
      const host = this.readString(hostPtr);
      const streamId = this.nextStreamId++;

      try {
        // WebSocket as TCP substitute for browser
        const ws = new WebSocket("ws://" + host + ":" + port);

        ws.binaryType = "arraybuffer";

        const stream = {
          ws: ws,
          sendBuffer: [],
          receiveBuffer: new Uint8Array(0),
          connected: false,
          host: host,
          port: port,
        };

        ws.onopen = () => {
          stream.connected = true;
          console.log("TCPStream connected: " + host + ":" + port);
          // Send any buffered data
          while (
            stream.sendBuffer.length > 0 && ws.readyState === WebSocket.OPEN
          ) {
            const next = stream.sendBuffer.shift();
            if (next !== undefined) ws.send(next);
          }
        };

        ws.onmessage = (event) => {
          const data = new Uint8Array(event.data);
          const newBuffer = new Uint8Array(
            stream.receiveBuffer.length + data.length,
          );
          newBuffer.set(stream.receiveBuffer);
          newBuffer.set(data, stream.receiveBuffer.length);
          stream.receiveBuffer = newBuffer;
        };

        ws.onclose = () => {
          stream.connected = false;
          console.log("TCPStream closed: " + host + ":" + port);
        };

        ws.onerror = (e) => {
          console.error("TCPStream error: " + host + ":" + port, e);
        };

        this.tcpStreams.set(streamId, stream);
        return streamId;
      } catch (e) {
        console.error("Failed to open TCPStream: " + e);
        return 0;
      }
    };

    imports.env.CloseTCPStream = (streamId) => {
      const stream = this.tcpStreams.get(streamId);
      if (stream && stream.ws) {
        stream.ws.close();
        this.tcpStreams.delete(streamId);
      }
    };

    imports.env.WriteLine = (streamId, strPtr) => {
      const stream = this.tcpStreams.get(streamId);
      if (!stream || !stream.ws) return 0;

      const str = this.readString(strPtr);
      const data = str + "\n";

      if (stream.connected && stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.send(data);
        return 1;
      } else {
        // Buffer for later
        stream.sendBuffer.push(data);
        return 1;
      }
    };

    imports.env.ReadLine = (streamId) => {
      const stream = this.tcpStreams.get(streamId);
      if (!stream) return 0;

      // Look for newline in receive buffer
      let newlineIdx = -1;
      for (let i = 0; i < stream.receiveBuffer.length; i++) {
        if (stream.receiveBuffer[i] === 10) { // \n
          newlineIdx = i;
          break;
        }
        if (stream.receiveBuffer[i] === 13) { // \r
          newlineIdx = i;
          break;
        }
      }

      if (newlineIdx >= 0) {
        const line = stream.receiveBuffer.slice(0, newlineIdx);
        stream.receiveBuffer = stream.receiveBuffer.slice(newlineIdx + 1);

        // Convert to string
        let str = "";
        for (let i = 0; i < line.length; i++) {
          str += String.fromCharCode(line[i]);
        }

        if (this.allocString) {
          return this.allocString(str);
        }
      }
      return 0;
    };

    imports.env.ReadAvail = (streamId) => {
      const stream = this.tcpStreams.get(streamId);
      if (!stream) return 0;

      // Count bytes until newline
      let count = 0;
      for (let i = 0; i < stream.receiveBuffer.length; i++) {
        if (stream.receiveBuffer[i] === 10 || stream.receiveBuffer[i] === 13) {
          break;
        }
        count++;
      }
      return count;
    };

    // Performance monitoring functions
    imports.env.MilliSecs = () => {
      return Math.floor(performance.now());
    };

    imports.env.CountFPS = () => {
      return Math.floor(this.fps);
    };

    imports.env.PerformanceStats = () => {
      const stats = this.getPerformanceStats();
      if (this.allocString) {
        const statStr =
          `FPS:${stats.fps} Frames:${stats.frameCount} Heap:${stats.heapAllocations} Str:${stats.stringAllocations}`;
        return this.allocString(statStr);
      }
      return 0;
    };

    imports.env.SendNetMsg = (streamId, destId, msgId, data$, reliable) => {
      const stream = this.tcpStreams.get(streamId);
      if (!stream || !stream.ws) return 0;

      const data = this.readString(data$);
      const msg = JSON.stringify({
        dest: destId,
        id: msgId,
        data: data,
        reliable: reliable,
      });

      if (stream.connected && stream.ws.readyState === WebSocket.OPEN) {
        stream.ws.send(msg);
        return 1;
      }
      return 0;
    };

    // --- ZlibWapi Stubs ---
    imports.env.ZlibWapi_Open = (pathPtr, mode) => {
      console.warn("ZlibWapi_Open stub");
      return 1;
    };
    imports.env.ZlibWapi_Close = (handle) => { };
    imports.env.ZlibWapi_ExtractFile = (handle, entryPtr, destPtr) => {
      return 1;
    };
    imports.env.ZlibWapi_GetFileCount = (handle) => 0;
    imports.env.ZlibWapi_GetFileName = (handle, index) => 0;

    // --- OpenAL Stubs ---
    // --- OpenAL Module ---
    if (!imports.al) imports.al = {};
    const alStub = () => 0;
    const alVoidStub = () => { };

    const alFunctions = [
      "alCreateBuffer",
      "alCreateEffect",
      "alCreateSource",
      "alCreateSource_",
      "alDestroy",
      "alDeviceInit",
      "alEffectSetEAXReverb",
      "alFreeBuffer",
      "alFreeEffect",
      "alFreeSource",
      "alGetAvailableDeviceCount",
      "alGetAvailableDeviceName",
      "alGetNumSources",
      "alInit",
      "alListenerSetDirection",
      "alListenerSetMasterVolume",
      "alListenerSetPosition",
      "alListenerSetUp",
      "alListenerSetVelocity",
      "alSourceGetAudioTime",
      "alSourceGetLenght",
      "alSourceIsPaused",
      "alSourceIsPlaying",
      "alSourceIsStopped",
      "alSourcePause",
      "alSourcePlay",
      "alSourcePlay2D",
      "alSourcePlay2D_",
      "alSourcePlay3D",
      "alSourcePlay3D_",
      "alSourcePlay_",
      "alSourceResume",
      "alSourceSeek",
      "alSourceSet3DPosition",
      "alSourceSetLoop",
      "alSourceSetPitch",
      "alSourceSetRolloffFactor",
      "alSourceSetVolume",
      "alSourceStop",
      "alUpdate",
    ];

    if (!imports.al) imports.al = {};
    const alImports = imports.al as Record<string, unknown>;

    alFunctions.forEach((fn) => {
      alImports[fn] =
        fn.includes("Set") || fn.includes("Stop") || fn.includes("Pause") ||
          fn.includes("Resume") || fn.includes("Seek") ||
          fn.includes("Update") || fn.includes("Destroy") || fn.includes("Free")
          ? alVoidStub
          : alStub;
      // Also keep in env for safety if some parts of the code still expect it there
      imports.env[fn] = alImports[fn];
    });

    // --- Bank Stubs ---
    if (!imports.blitz3d) imports.blitz3d = {};

    imports.blitz3d.CreateBank = imports.env.CreateBank;
    imports.blitz3d.FreeBank = imports.env.FreeBank;
    imports.blitz3d.BankSize = imports.env.BankSize;
    imports.blitz3d.PeekByte = imports.env.PeekByte;
    imports.blitz3d.PeekShort = imports.env.PeekShort;
    imports.blitz3d.PeekInt = imports.env.PeekInt;
    imports.blitz3d.PeekFloat = imports.env.PeekFloat;
    imports.blitz3d.PokeByte = imports.env.PokeByte;
    imports.blitz3d.PokeShort = imports.env.PokeShort;
    imports.blitz3d.PokeInt = imports.env.PokeInt;
    imports.blitz3d.PokeFloat = imports.env.PokeFloat;

    // --- INI File Support ---
    imports.env.GetINIInt = (
      pathPtr: number,
      sectionPtr: number,
      keyPtr: number,
      defaultValue: number,
    ) => {
      const path = this.readString(pathPtr);
      const section = this.readString(sectionPtr);
      const key = this.readString(keyPtr);

      // Read file from virtual file system
      let data: Uint8Array | undefined;
      if (this.fileSystem && this.fileSystem.has(path)) {
        data = this.fileSystem.get(path).data;
      }
      if (!data) return defaultValue;

      // Parse simple INI format
      try {
        const text = new TextDecoder().decode(data);
        const lines = text.split(/\r?\n/);
        let inSection = false;
        const targetSection = section.toLowerCase();
        const targetKey = key.toLowerCase();
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            const secName = trimmed.slice(1, -1).trim().toLowerCase();
            inSection = secName === targetSection;
            continue;
          }
          if (inSection && trimmed.includes("=")) {
            const eqIdx = trimmed.indexOf("=");
            const k = trimmed.slice(0, eqIdx).trim().toLowerCase();
            const v = trimmed.slice(eqIdx + 1).trim();
            if (k === targetKey) {
              const parsed = parseInt(v, 10);
              return Number.isFinite(parsed) ? parsed : defaultValue;
            }
          }
        }
      } catch {
        // Parse error — return default
      }
      return defaultValue;
    };

    // --- CopyMesh ---
    imports.env.CopyMesh = (meshId: number, parent: number) => {
      const graphics = this.graphics;
      if (!graphics) return 0;
      const entity = graphics.entities[meshId];
      if (!entity) return 0;

      const clone = entity.clone(true);
      // Ensure cloned meshes have unique materials
      try {
        clone.traverse((child: any) => {
          if (child?.isMesh && graphics.ensureUniqueMaterial) {
            graphics.ensureUniqueMaterial(child);
          }
        });
      } catch {}

      const id = graphics.nextEntityId++;
      graphics.entities[id] = clone;

      if (parent && graphics.entities[parent]) {
        graphics.entities[parent].add(clone);
      } else if (graphics.scene) {
        graphics.scene.add(clone);
      }

      return id;
    };

    // --- Memory ---
    imports.env.Memory = () => {
      const perfMem = (performance as any).memory;
      if (perfMem) {
        return perfMem.jsHeapSizeLimit - perfMem.usedJSHeapSize;
      }
      return 256 * 1024 * 1024; // 256MB fallback
    };
  }

  shutdownAudio() {
    try {
      this.graphics?.audioSystem?.dispose?.();
    } catch { }
    try {
      if (this.channels) {
        for (const [channelId, ch] of this.channels.entries()) {
          try {
            ch.source?.stop?.();
          } catch { }
          try {
            ch.source?.disconnect?.();
          } catch { }
          try {
            ch.pan?.disconnect?.();
          } catch { }
          try {
            ch.gain?.disconnect?.();
          } catch { }
          try {
            this.channels.delete(channelId);
          } catch { }
        }
      }

      if (this.streams) {
        for (const [streamId, stream] of this.streams.entries()) {
          try {
            stream.element?.pause?.();
          } catch { }
          try {
            if (stream.element) {
              stream.element.src = "";
              stream.element.load?.();
            }
          } catch { }
          try {
            stream.source?.disconnect?.();
          } catch { }
          try {
            stream.gain?.disconnect?.();
          } catch { }
          try {
            this.streams.delete(streamId);
          } catch { }
        }
      }

      if (this.sounds) {
        try {
          this.sounds.clear();
        } catch { }
      }

      try {
        this.audioMaster?.disconnect?.();
      } catch { }
      this.audioMaster = null;

      if (this.audioContext) {
        try {
          this.audioContext.close();
        } catch { }
        this.audioContext = null;
      }
    } finally {
      this.audioInitialized = false;
    }
  }

  dispose() {
    this.shutdownAudio();

    try {
      if (this.textCanvas?.parentElement) {
        this.textCanvas.parentElement.removeChild(this.textCanvas);
      }
    } catch { }
    this.textCanvas = null;
    this.ctx2d = null;

    try {
      this.banks?.clear?.();
    } catch { }
    try {
      this.zipArchives?.clear?.();
    } catch { }

    if (this.tcpStreams) {
      for (const stream of this.tcpStreams.values()) {
        try {
          stream.ws?.close?.();
        } catch { }
      }
      try {
        this.tcpStreams.clear();
      } catch { }
    }

    this.exports = null;
    this.instance = null;
    this.module = null;
    this.memory = null;
  }
}

if (typeof window !== "undefined") {
  (window as any).Blitz3DCore = Blitz3DCore;
}
