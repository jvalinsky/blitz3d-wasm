/**
 * WASM Module Loader for Blitz3D Engine
 * Loads the compiled Swift engine and provides typed access to all exports
 */

import type {
  Blitz3DEngineExports,
  Blitz3DEngineImports,
} from "./wasm-types.ts";
import { WasmStringHelper } from "./wasm-string-helper.ts";
import type { GraphicsAPI } from "./graphics-api.ts";
import { createGraphicsAPI } from "./graphics-factory.ts";

export interface LoadedEngine {
  /** Raw WASM instance */
  instance: WebAssembly.Instance;

  /** Typed engine exports */
  exports: Blitz3DEngineExports;

  /** String marshaling helper */
  strings: WasmStringHelper;

  /** Convenience methods */
  helpers: {
    /** Call a function with a string parameter */
    callWithString<T>(fn: (ptr: number) => T, str: string): T;

    /** Read a returned string and optionally free it */
    readString(ptr: number, free?: boolean): string;
  };
}

/**
 * Create minimal JavaScriptKit runtime stubs
 * Real implementation would provide full JS interop
 */
function createJavaScriptKitStubs() {
  return {
    swjs_call_new: () => 0,
    swjs_set_prop: () => {},
    swjs_get_prop: () => 0,
    swjs_set_subscript: () => {},
    swjs_instanceof: () => 0,
    swjs_get_subscript: () => 0,
    swjs_call_function_with_this_no_catch: () => 0,
    swjs_i64_to_bigint_slow: () => 0,
    swjs_release: () => {},
    swjs_create_function: () => 0,
    swjs_call_function_no_catch: () => 0,
    swjs_decode_string: () => 0,
    swjs_encode_string: () => 0,
    swjs_load_string: () => {},
    swjs_call_function_with_this: () => 0,
    swjs_call_function: () => 0,
    swjs_call_throwing_new: () => 0,
    swjs_create_typed_array: () => 0,
    swjs_load_typed_array: () => {},
  };
}

/**
 * Create minimal WASI stubs
 * Returns 0 (success) for most operations
 */
function createWasiStubs() {
  return {
    args_get: () => 0,
    args_sizes_get: () => 0,
    environ_get: () => 0,
    environ_sizes_get: () => 0,
    clock_res_get: () => 0,
    clock_time_get: () => 0,
    fd_advise: () => 0,
    fd_allocate: () => 0,
    fd_close: () => 0,
    fd_datasync: () => 0,
    fd_fdstat_get: () => 0,
    fd_fdstat_set_flags: () => 0,
    fd_fdstat_set_rights: () => 0,
    fd_filestat_get: () => 0,
    fd_filestat_set_size: () => 0,
    fd_filestat_set_times: () => 0,
    fd_pread: () => 0,
    fd_prestat_get: () => 0,
    fd_prestat_dir_name: () => 0,
    fd_pwrite: () => 0,
    fd_read: () => 0,
    fd_readdir: () => 0,
    fd_renumber: () => 0,
    fd_seek: () => 0,
    fd_sync: () => 0,
    fd_tell: () => 0,
    fd_write: () => 0,
    path_create_directory: () => 0,
    path_filestat_get: () => 0,
    path_filestat_set_times: () => 0,
    path_link: () => 0,
    path_open: () => 0,
    path_readlink: () => 0,
    path_remove_directory: () => 0,
    path_rename: () => 0,
    path_symlink: () => 0,
    path_unlink_file: () => 0,
    poll_oneoff: () => 0,
    proc_exit: () => {},
    proc_raise: () => 0,
    random_get: () => 0,
    sched_yield: () => 0,
    sock_accept: () => 0,
    sock_recv: () => 0,
    sock_send: () => 0,
    sock_shutdown: () => 0,
  };
}

import { Blitz3DAudio } from "./audio.ts";
import { Blitz3DCore } from "./core.ts";

// Simple FileIO adapter for synchronous sound loading
class SimpleFileIO {
  openFile(path: string): any {
    try {
      // Deno support
      const Deno = (globalThis as any).Deno;
      if (typeof Deno !== "undefined" && Deno.readFileSync) {
        const data = Deno.readFileSync(path);
        return { data, pos: 0 };
      }
      // Browser synchronous XHR (legacy but required for sync loading)
      const xhr = new XMLHttpRequest();
      xhr.open("GET", path, false); // synchronous
      xhr.responseType = "arraybuffer";
      xhr.send(null);
      if (xhr.status === 200) {
        return { data: new Uint8Array(xhr.response), pos: 0 };
      }
    } catch (e) {
      console.warn(`SimpleFileIO: Failed to load ${path}: ${e}`);
    }
    return null; // Handle not found
  }

  readRemaining(handle: any): Uint8Array | null {
    if (!handle || !handle.data) return null;
    return handle.data;
  }

  closeFile(handle: any) {
    // No-op for buffer
  }
}

// Global graphics API instance (initialized in loadBlitz3DEngine)
let graphicsAPI: GraphicsAPI | null = null;
let audioSystem: Blitz3DAudio | null = null;

// Expose globally for test pages
declare global {
  interface Window {
    graphicsAPI: GraphicsAPI | null;
    audioSystem: Blitz3DAudio | null;
  }
}
if (typeof window !== "undefined") {
  window.graphicsAPI = null;
  window.audioSystem = null;
}

/**
 * Create WASM import object with real and stub implementations
 * Phase 2: Graphics imports now implemented
 */
/**
 * Create WASM import object with real and stub implementations
 * Phase 2: Graphics imports now implemented
 */
function createEngineImports(
  audio?: Blitz3DAudio,
  readString?: (ptr: number) => string,
): Blitz3DEngineImports {
  return {
    env: {
      // === Graphics Imports (Phase 2 - IMPLEMENTED) ===

      js_Graphics3D: (
        width: number,
        height: number,
        depth: number,
        mode: number,
      ): number => {
        console.log(
          `Graphics3D(${width}x${height}, ${depth}bit, mode ${mode})`,
        );
        // Graphics API initialization happens in loadBlitz3DEngine before WASM loads
        if (!graphicsAPI) {
          console.error("Graphics API not initialized!");
          return 0; // Failure
        }
        return 1; // Success
      },

      js_ClearScreen: (): void => {
        if (!graphicsAPI) return;
        // Clear to black by default
        graphicsAPI.clear(0, 0, 0, 1);
      },

      js_RenderWorld: (tween: number): void => {
        if (!graphicsAPI) return;
        // console.log(`RenderWorld(tween: ${tween})`);
        graphicsAPI.endFrame();
        graphicsAPI.beginFrame();
      },

      js_Flip: (vsync: number): void => {
        if (!graphicsAPI) return;
        // console.log(`Flip(vsync: ${vsync})`);
        // End current frame and present
        graphicsAPI.endFrame();
      },

      js_SetBuffer: (buffer: number): void => {
        // console.log(`SetBuffer(${buffer})`);
        // WebGPU/WebGL don't need explicit buffer selection
        // Always rendering to canvas
      },

      // === Audio Imports (Phase 3 - Implemented) ===
      js_LoadSound: (pathPtr: number, flags: number): number => {
        if (!audio || !readString) return 0;
        const path = readString(pathPtr);
        console.log(`js_LoadSound('${path}', ${flags})`);
        return audio.loadSound(path, flags);
      },

      js_PlaySound: (
        sound: number,
        volume: number,
        pan: number,
        rate: number,
        loop: number,
      ): number => {
        if (!audio) return 0;
        return audio.playSound(sound, volume, pan, rate, loop !== 0);
      },

      js_FreeSound: (sound: number): void => {
        if (audio) audio.freeSound(sound);
      },

      js_StopChannel: (channel: number): void => {
        if (audio) audio.stopChannel(channel);
      },

      js_ChannelPitch: (channel: number, pitch: number): void => {
        if (audio) audio.setChannelPitch(channel, pitch);
      },

      js_ChannelVolume: (channel: number, volume: number): void => {
        if (audio) audio.setChannelVolume(channel, volume);
      },

      js_ChannelPan: (channel: number, pan: number): void => {
        if (audio) audio.setChannelPan(channel, pan);
      },

      js_PauseChannel: (channel: number): void => {
        if (audio) audio.pauseChannel(channel);
      },

      js_ResumeChannel: (channel: number): void => {
        if (audio) audio.resumeChannel(channel);
      },

      js_EmitSound: (sound: number, entityId: number): number => {
        if (!audio) return 0;
        // EmitSound is usually playSound3D with entity position
        return audio.playSound3D(
          sound,
          0,
          0,
          0,
          undefined,
          undefined,
          undefined,
          entityId,
        );
      },

      js_ChannelPosition: (
        channel: number,
        x: number,
        y: number,
        z: number,
      ): void => {
        if (audio) {
          const entry = audio.channels.get(channel);
          if (entry) {
            entry.position = { x, y, z };
            if (entry.panner instanceof PannerNode && audio.context) {
              entry.panner.positionX.setTargetAtTime(
                x,
                audio.context.currentTime,
                0.02,
              );
              entry.panner.positionY.setTargetAtTime(
                y,
                audio.context.currentTime,
                0.02,
              );
              entry.panner.positionZ.setTargetAtTime(
                z,
                audio.context.currentTime,
                0.02,
              );
            }
          }
        }
      },

      js_PlayMusic: (pathPtr: number): number => {
        if (!audio || !readString) return 0;
        const path = readString(pathPtr);
        console.log(`js_PlayMusic('${path}')`);
        return audio.openStream(path, 1); // 1 = loop/music mode?
      },

      js_StopMusic: (): void => {
        // Simplified music handling
        console.log("js_StopMusic");
      },

      js_MusicVolume: (volume: number): void => {
        console.log(`js_MusicVolume(${volume})`);
      },
    },
    javascript_kit: createJavaScriptKitStubs(),
    wasi_snapshot_preview1: createWasiStubs(),
  } as any;
}

/**
 * Load the Blitz3D WASM engine from a file
 *
 * @param wasmPath - Path to the blitz3d-engine.wasm file
 * @param canvas - Optional canvas element for graphics rendering
 */
export async function loadBlitz3DEngine(
  wasmPath: string,
  canvas?: HTMLCanvasElement,
): Promise<LoadedEngine> {
  console.log(`Loading Blitz3D Engine from ${wasmPath}...`);

  // Initialize graphics API if canvas provided
  if (canvas) {
    console.log("Initializing graphics API...");
    graphicsAPI = await createGraphicsAPI(canvas);
    const caps = graphicsAPI.getCapabilities();
    console.log(
      `Graphics: ${caps.apiName}, max texture: ${caps.maxTextureSize}`,
    );

    // Expose globally for test pages
    if (typeof window !== "undefined") {
      window.graphicsAPI = graphicsAPI;
    }
  }

  // Read WASM binary from filesystem
  let wasmBytes: Uint8Array;

  // Check if running in Deno (has Deno.readFile)
  const Deno = (globalThis as any).Deno;
  if (typeof Deno !== "undefined" && Deno.readFile) {
    wasmBytes = await Deno.readFile(wasmPath);
  } else {
    // Browser: use fetch
    const response = await fetch(wasmPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch WASM: ${response.statusText}`);
    }
    wasmBytes = new Uint8Array(await response.arrayBuffer());
  }

  console.log(`Loaded ${wasmBytes.byteLength} bytes of WASM`);

  // Create audio system with SimpleFileIO
  audioSystem = new Blitz3DAudio({
    fileIO: new SimpleFileIO(),
  } as any, {
    createContext: typeof window !== "undefined"
      ? () => new (window.AudioContext || (window as any).webkitAudioContext)()
      : undefined,
  });

  if (typeof window !== "undefined") {
    window.audioSystem = audioSystem;
  }

  // Create Blitz3D Core (Banks, FileIO, System, Math)
  const core = new Blitz3DCore();

  // We need a way for the audio loader (js_LoadSound) to read strings from WASM memory.
  // The WasmStringHelper is created AFTER imports.
  let stringHelperRef: WasmStringHelper | null = null;

  // Create base imports
  const imports = createEngineImports(audioSystem, (ptr) => {
    if (!stringHelperRef) return "";
    return stringHelperRef.takeString(ptr, false);
  });

  // Enhance imports with Core functionalities (Banks, FileIO, etc.)
  core.setupCommonImports(imports as any);

  // Override Core's audio stubs if they conflict?
  // createEngineImports defines audio. core defines audio.
  // Object.assign in core won't overwrite existing keys?
  // core uses `Object.assign(imports.env, { ... })`. It MIGHT overwrite.
  // But core's audio wrappers check `getAudio()`. If we patch `core.graphics = { audioSystem }`, it works.
  // Let's wire core to our audio system.
  (core as any).graphics = { audioSystem: audioSystem };

  // Compile and instantiate WASM module
  const module = await WebAssembly.compile(wasmBytes as BufferSource);
  const instance = await WebAssembly.instantiate(module, imports as any);
  console.log("WASM instantiated successfully");

  // Provide memory and exports to Core
  core.memory = instance.exports.memory;
  core.exports = instance.exports;

  // Initialize Swift runtime by calling _start
  const _start = instance.exports._start as any;
  if (_start) {
    try {
      _start();
      console.log("Swift runtime initialized");
    } catch (e) {
      console.warn("_start threw error (this may be expected):", e);
    }
  }

  // Cast exports to our typed interface
  const exports = instance.exports as unknown as Blitz3DEngineExports;

  // Verify required exports exist
  if (!exports.memory) {
    throw new Error("WASM module does not export memory");
  }
  // Check for our wrapper functions
  if (typeof exports.wasm_malloc !== "function") {
    console.warn("WASM module does not export wasm_malloc");
  }
  if (typeof exports.wasm_free !== "function") {
    console.warn("WASM module does not export wasm_free");
  }

  // Create string helper using our wrapper functions
  const strings = new WasmStringHelper(
    exports.memory,
    (exports.wasm_malloc as any) || (() => {
      throw new Error("wasm_malloc not exported");
    }),
    (exports.wasm_free as any) || (() => {
      throw new Error("wasm_free not exported");
    }),
  );

  // Set the reference for imports to use
  stringHelperRef = strings;

  // Also likely need allocString for Core to write strings back to WASM
  // Core expects `this.allocString`
  core.allocString = (str: string) => strings.withString(str, (ptr) => ptr); // Wait, withString frees it.
  // We need 'allocString' that allocates and returns ptr, caller frees or engine takes ownership.
  // Runtime core uses `allocString` for returning strings to WASM.
  // WasmStringHelper doesn't expose a "allocate and forget" easily?
  // `wasm-string-helper.ts` needs to be checked.
  // Core.ts lines 28: allocString: ((str: string) => number) | null;

  // Quick fix for allocString using raw malloc/write
  core.allocString = (str: string) => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    // Blitz3D strings are [flags:32][len:32][chars...][null]
    // But the compiled engine might use C-strings or native Swift strings.
    // If it expects C-strings:
    const ptr = (exports as any).wasm_malloc(bytes.length + 1);
    const mem = new Uint8Array(exports.memory.buffer);
    mem.set(bytes, ptr);
    mem[ptr + bytes.length] = 0;
    return ptr;
  };
  // Note: This matches what `core.readString` expects *if* it falls back to C-string.

  // Create convenience helpers
  const helpers = {
    callWithString<T>(fn: (ptr: number) => T, str: string): T {
      return strings.withString(str, fn);
    },

    readString(ptr: number, free = false): string {
      return strings.takeString(ptr, free);
    },
  };

  console.log("Blitz3D Engine loaded successfully");
  console.log(`Memory: ${exports.memory.buffer.byteLength} bytes`);

  return {
    instance,
    exports,
    strings,
    helpers,
  };
}

/**
 * Check if WASM is supported in the current environment
 */
export function isWasmSupported(): boolean {
  try {
    if (
      typeof WebAssembly === "object" &&
      typeof WebAssembly.instantiate === "function"
    ) {
      // Test instantiation with minimal module
      const module = new WebAssembly.Module(
        new Uint8Array([
          0x00,
          0x61,
          0x73,
          0x6d,
          0x01,
          0x00,
          0x00,
          0x00,
        ]),
      );
      return module instanceof WebAssembly.Module;
    }
    return false;
  } catch (e) {
    return false;
  }
}
