/**
 * WASM Module Loader for Blitz3D Engine
 * Loads the compiled Swift engine and provides typed access to all exports
 */

import type { Blitz3DEngineExports, Blitz3DEngineImports } from './wasm-types.ts';
import { WasmStringHelper } from './wasm-string-helper.ts';
import type { GraphicsAPI } from './graphics-api.ts';
import { createGraphicsAPI } from './graphics-factory.ts';

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

// Global graphics API instance (initialized in loadBlitz3DEngine)
let graphicsAPI: GraphicsAPI | null = null;

/**
 * Create WASM import object with real and stub implementations
 * Phase 2: Graphics imports now implemented
 */
function createEngineImports(): Blitz3DEngineImports {
    return {
        env: {
            // === Graphics Imports (Phase 2 - IMPLEMENTED) ===
            
            js_Graphics3D: (width: number, height: number, depth: number, mode: number): number => {
                console.log(`Graphics3D(${width}x${height}, ${depth}bit, mode ${mode})`);
                // Graphics API initialization happens in loadBlitz3DEngine before WASM loads
                if (!graphicsAPI) {
                    console.error('Graphics API not initialized!');
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
                console.log(`RenderWorld(tween: ${tween})`);
                graphicsAPI.endFrame();
                graphicsAPI.beginFrame();
            },
            
            js_Flip: (vsync: number): void => {
                if (!graphicsAPI) return;
                console.log(`Flip(vsync: ${vsync})`);
                // End current frame and present
                graphicsAPI.endFrame();
            },
            
            js_SetBuffer: (buffer: number): void => {
                console.log(`SetBuffer(${buffer})`);
                // WebGPU/WebGL don't need explicit buffer selection
                // Always rendering to canvas
            },
            
            // === Audio Stubs (Phase 2 - TODO) ===
            js_LoadSound: (pathPtr: number, flags: number): number => {
                console.warn('js_LoadSound stub called');
                return 0; // Invalid handle
            },
            
            js_PlaySound: (sound: number, volume: number, pan: number, rate: number, loop: number): number => {
                console.warn('js_PlaySound stub called');
                return 0; // Invalid channel
            },
            
            js_FreeSound: (sound: number): void => {
                console.warn('js_FreeSound stub called');
            },
            
            js_StopChannel: (channel: number): void => {
                console.warn('js_StopChannel stub called');
            },
            
            js_ChannelPitch: (channel: number, pitch: number): void => {
                console.warn('js_ChannelPitch stub called');
            },
            
            js_ChannelVolume: (channel: number, volume: number): void => {
                console.warn('js_ChannelVolume stub called');
            },
            
            js_ChannelPan: (channel: number, pan: number): void => {
                console.warn('js_ChannelPan stub called');
            },
        },
        javascript_kit: createJavaScriptKitStubs(),
        wasi_snapshot_preview1: createWasiStubs(),
    } as any;
}

/**
 * Load the Blitz3D WASM engine from a file
 */
export async function loadBlitz3DEngine(wasmPath: string): Promise<LoadedEngine> {
    console.log(`Loading Blitz3D Engine from ${wasmPath}...`);
    
    // Read WASM binary from filesystem
    let wasmBytes: Uint8Array;
    
    // Check if running in Deno (has Deno.readFile)
    if (typeof Deno !== 'undefined' && Deno.readFile) {
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
    
    // Create imports
    const imports = createStubImports();
    
    // Compile and instantiate WASM module
    const module = await WebAssembly.compile(wasmBytes);
    const instance = await WebAssembly.instantiate(module, imports as any);
    console.log('WASM instantiated successfully');
    
    // Initialize Swift runtime by calling _start
    const _start = instance.exports._start as any;
    if (_start) {
        try {
            _start();
            console.log('Swift runtime initialized');
        } catch (e) {
            console.warn('_start threw error (this may be expected):', e);
        }
    }
    
    // Cast exports to our typed interface
    const exports = instance.exports as unknown as Blitz3DEngineExports;
    
    // Verify required exports exist
    if (!exports.memory) {
        throw new Error('WASM module does not export memory');
    }
    // Check for our wrapper functions
    if (typeof exports.wasm_malloc !== 'function') {
        console.warn('WASM module does not export wasm_malloc');
    }
    if (typeof exports.wasm_free !== 'function') {
        console.warn('WASM module does not export wasm_free');
    }
    
    // Create string helper using our wrapper functions
    const strings = new WasmStringHelper(
        exports.memory,
        exports.wasm_malloc || (() => { throw new Error('wasm_malloc not exported'); }),
        exports.wasm_free || (() => { throw new Error('wasm_free not exported'); })
    );
    
    // Create convenience helpers
    const helpers = {
        callWithString<T>(fn: (ptr: number) => T, str: string): T {
            return strings.withString(str, fn);
        },
        
        readString(ptr: number, free = false): string {
            return strings.takeString(ptr, free);
        },
    };
    
    console.log('Blitz3D Engine loaded successfully');
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
        if (typeof WebAssembly === 'object' &&
            typeof WebAssembly.instantiate === 'function') {
            // Test instantiation with minimal module
            const module = new WebAssembly.Module(new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
            ]));
            return module instanceof WebAssembly.Module;
        }
        return false;
    } catch (e) {
        return false;
    }
}
