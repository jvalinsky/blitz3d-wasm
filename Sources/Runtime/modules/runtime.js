/**
 * Blitz3D WASM Runtime - Modular Version
 * Provides WebGL, Web Audio, and other browser APIs to the WASM module
 */

// Import modules - just reference the window globals directly
// No need to redeclare since they're already in global scope from previous script tags
console.log('[runtime.js] Checking module references...');
console.log('[runtime.js] Module references available:', {
    Blitz3DCore: typeof window.Blitz3DCore !== 'undefined',
    Blitz3DGraphics: typeof window.Blitz3DGraphics !== 'undefined',
    Blitz3DMesh: typeof window.Blitz3DMesh !== 'undefined',
    Blitz3DPhysics: typeof window.Blitz3DPhysics !== 'undefined',
    Blitz3DInput: typeof window.Blitz3DInput !== 'undefined',
    Blitz3DAudio: typeof window.Blitz3DAudio !== 'undefined',
    VirtualFileSystem: typeof window.VirtualFileSystem !== 'undefined'
});

const Blitz3D = {
    // Core components
    core: null,
    graphics: null,
    mesh: null,
    physics: null,
    input: null,
    audio: null,
    vfs: null,

    // Asset management
    assets: {},
    assetManifest: null,

    // Bank Manager
    bankManager: {
        banks: new Map(),
        nextHandle: 1
    },

    // Zip Manager
    zipManager: {
        archives: new Map(),
        mountedFiles: new Map(),
        nextHandle: 1,

        loadZip: async function (url) {
            try {
                const filename = url.replace(/\\/g, '/').split('/').pop();
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                const fileMap = new Map();
                const promises = [];
                zip.forEach((relativePath, file) => {
                    if (!file.dir) {
                        promises.push(file.async("uint8array").then(data => {
                            fileMap.set(relativePath, data);
                        }));
                    }
                });
                await Promise.all(promises);
                this.archives.set(filename, fileMap);
                console.log(`Mounted ZIP archive: ${filename} (${fileMap.size} files)`);
                return filename;
            } catch (err) {
                console.error(`Failed to load ZIP ${url}:`, err);
                return null;
            }
        }
    },

    // FMOD Manager
    fmodManager: {
        streams: new Map(),
        channels: new Map(),
        nextHandle: 1,
        context: null
    },

    // File System
    fs: {},
    files: {},
    nextFileId: 1,

    init: function (canvasId) {
        // Initialize core
        this.core = new window.Blitz3DCore();
        this.core.init(canvasId);

        // Initialize graphics
        this.graphics = new window.Blitz3DGraphics(this.core);
        this.graphics.init3D();

        // Initialize mesh module
        this.mesh = new window.Blitz3DMesh(this.graphics);

        // Initialize physics
        this.physics = new window.Blitz3DPhysics(this.core, this.graphics);

        // Initialize input
        this.input = new window.Blitz3DInput(this.core, this.graphics);
        this.input.setupEventListeners();

        // Initialize audio
        this.audio = new window.Blitz3DAudio(this.core);

        // Initialize virtual file system
        this.vfs = new window.VirtualFileSystem(this.core);

        // Expose input test globally
        window.testBlitz3DInput = () => this.input.testInput();

        // Set up common imports
        this.core.setupCommonImports(this.imports);
        this.graphics.setupImports(this.imports);
        this.mesh.setupImports(this.imports);
        this.physics.setupImports(this.imports);
        this.input.setupImports(this.imports);
        this.audio.setupImports(this.imports);
        this.vfs.setupImports(this.imports);

        // Debug: check imports
        console.log('[runtime] Imports configured:', {
            envFunctions: Object.keys(this.imports.env).length,
            alFunctions: Object.keys(this.imports.al).length,
            hasPrintInt: typeof this.imports.env.PrintInt === 'function'
        });

        console.log("Blitz3D Runtime Initialized (Modular)");
    },

    getAssetData: function (path) {
        const asset = this.assets[path];
        if (asset && asset.data) {
            return asset.data;
        }
        if (this.assetManifest && this.assetManifest.embedAssets) {
            const assetInfo = this.assetManifest.assets.find(a => a.path === path);
            if (assetInfo && assetInfo.offset) {
                const data = new Uint8Array(this.core.memory.buffer);
                return data.slice(assetInfo.offset, assetInfo.offset + assetInfo.size);
            }
        }
        return null;
    },

    setupInput: function () {
        // Input is already set up in init()
    },

    // Import object for WASM
    imports: {
        env: {},
        blitz3d: {
            // Bank (byte array) functions
            CreateBank: (size) => {
                const bank = new Uint8Array(size);
                const id = this.nextBankId || 1;
                this.nextBankId = id + 1;
                this.banks = this.banks || {};
                this.banks[id] = bank;
                return id;
            },
            FreeBank: (bankId) => {
                delete this.banks[bankId];
            },
            BankSize: (bankId) => {
                return this.banks[bankId]?.length || 0;
            },
            ResizeBank: (bankId, size) => {
                const oldBank = this.banks[bankId];
                if (oldBank) {
                    const newBank = new Uint8Array(size);
                    newBank.set(oldBank.slice(0, Math.min(oldBank.length, size)));
                    this.banks[bankId] = newBank;
                }
            },
            PeekByte: (bankId, offset) => {
                return this.banks[bankId]?.[offset] || 0;
            },
            PokeByte: (bankId, offset, value) => {
                if (this.banks[bankId]) {
                    this.banks[bankId][offset] = value & 0xFF;
                }
            },
            PeekInt: (bankId, offset) => {
                const bank = this.banks[bankId];
                if (bank) {
                    return bank[offset] | (bank[offset+1] << 8) | (bank[offset+2] << 16) | (bank[offset+3] << 24);
                }
                return 0;
            },
            PokeInt: (bankId, offset, value) => {
                const bank = this.banks[bankId];
                if (bank) {
                    bank[offset] = value & 0xFF;
                    bank[offset+1] = (value >> 8) & 0xFF;
                    bank[offset+2] = (value >> 16) & 0xFF;
                    bank[offset+3] = (value >> 24) & 0xFF;
                }
            },
            PeekFloat: (bankId, offset) => {
                const bank = this.banks[bankId];
                if (bank) {
                    const view = new DataView(bank.buffer, bank.byteOffset);
                    return view.getFloat32(offset, true); // little-endian
                }
                return 0.0;
            },
            PokeFloat: (bankId, offset, value) => {
                const bank = this.banks[bankId];
                if (bank) {
                    const view = new DataView(bank.buffer, bank.byteOffset);
                    view.setFloat32(offset, value, true); // little-endian
                }
            },
            PeekShort: (bankId, offset) => {
                const bank = this.banks[bankId];
                if (bank) {
                    return bank[offset] | (bank[offset+1] << 8);
                }
                return 0;
            },
            PokeShort: (bankId, offset, value) => {
                const bank = this.banks[bankId];
                if (bank) {
                    bank[offset] = value & 0xFF;
                    bank[offset+1] = (value >> 8) & 0xFF;
                }
            },
            
            // Mesh parsing functions (stubs for now)
            ParseB3D: (bankId) => {
                console.log("ParseB3D: bankId=" + bankId);
                return 0; // Return mesh ID
            },
            ParseRMesh: (bankId) => {
                console.log("ParseRMesh: bankId=" + bankId);
                return 0; // Return mesh ID
            },
            
            // Mesh query functions
            GetMeshSurfaceCount: (meshId) => {
                return 0; // Number of surfaces
            },
            GetSurfaceVertexCount: (surfaceId) => {
                return 0; // Number of vertices
            },
            GetSurfaceVerticesPtr: (surfaceId) => {
                return 0; // Pointer to vertex data
            },
            GetSurfaceIndexCount: (surfaceId) => {
                return 0; // Number of indices
            },
            GetSurfaceIndicesPtr: (surfaceId) => {
                return 0; // Pointer to index data
            }
        },
        al: {
            // OpenAL (custom wrapper) stubs
            alInit: () => { console.log("OpenAL initialized"); return 1; },
            alDeviceInit: () => 1,
            alDestroy: () => {},
            alUpdate: () => {},
            alGetNumSources: () => 0,
            alGetAvailableDeviceCount: () => 1,
            alGetAvailableDeviceName: () => 0,
            
            // Buffer management
            alCreateBuffer: () => 1,
            alFreeBuffer: () => {},
            
            // Source management  
            alCreateSource: () => 1,
            alCreateSource_: () => 1,
            alFreeSource: () => {},
            
            // Source playback
            alSourcePlay: () => {},
            alSourcePlay_: () => {},
            alSourcePlay2D: () => {},
            alSourcePlay2D_: () => {},
            alSourcePlay3D: () => {},
            alSourcePlay3D_: () => {},
            alSourceStop: () => {},
            alSourcePause: () => {},
            alSourceResume: () => {},
            alSourceSeek: () => {},
            
            // Source state queries
            alSourceIsPlaying: () => 0,
            alSourceIsPaused: () => 0,
            alSourceIsStopped: () => 1,
            alSourceGetAudioTime: () => 0.0,
            alSourceGetLenght: () => 0.0,
            
            // Source properties
            alSourceSetVolume: () => {},
            alSourceSetPitch: () => {},
            alSourceSetLoop: () => {},
            alSourceSet3DPosition: () => {},
            alSourceSetRolloffFactor: () => {},
            
            // Listener properties
            alListenerSetPosition: () => {},
            alListenerSetDirection: () => {},
            alListenerSetUp: () => {},
            alListenerSetVelocity: () => {},
            alListenerSetMasterVolume: () => {},
            
            // Effects
            alCreateEffect: () => 1,
            alFreeEffect: () => {},
            alEffectSetEAXReverb: () => {}
        }
    },

    loadEngine: async function() {
        console.log("Loading Blitz3DEngine.wasm...");
        try {
            const response = await fetch('dist/Blitz3DEngine.wasm');
            const arrayBuffer = await response.arrayBuffer();
            const result = await WebAssembly.instantiate(arrayBuffer, {
                env: {
                    // Engine might need some JS imports later
                }
            });
            this.engineInstance = result.instance;
            this.engineExports = result.instance.exports;
            
            // Populate blitz3d imports for game WASM
            for (const key in this.engineExports) {
                if (typeof this.engineExports[key] === 'function') {
                    this.imports.blitz3d[key] = this.engineExports[key];
                }
            }
            
            // Enable WASM collision if available
            if (this.physics) {
                this.physics.setWasmEngineReady(true);
                this.physics.enableWasmCollision(true);
            }
            
            console.log("Blitz3DEngine loaded and linked.");
        } catch (e) {
            console.warn("Blitz3DEngine not available, using JS fallback:", e.message);
            this.engineInstance = null;
            this.engineExports = {};
        }
    },

    load: async function (wasmUrl, canvasId) {
        if (canvasId) {
            this.init(canvasId);
        } else if (!this.core.canvas) {
            console.error("Blitz3D canvas not initialized.");
            return;
        }

        await this.loadEngine();

        this.setupInput();
        console.log(`Loading WASM from ${wasmUrl}...`);
        const startTime = performance.now();

        try {
            let result;

            // Try WASM cache if available
            if (window.WASMCache && typeof window.WASMCache === 'function') {
                console.log("Attempting WASM cache load...");
                try {
                    const wasmCache = new window.WASMCache();
                    await wasmCache.init();
                    result = await wasmCache.loadWithCache(wasmUrl, this.imports);
                    this.core.instance = result.instance;
                    this.core.module = result.module;
                    this.core.exports = result.instance.exports;
                    this.core.memory = result.instance.exports.memory;

                    const endTime = performance.now();
                    console.log(`WASM Loaded from Cache in ${(endTime - startTime).toFixed(2)}ms`);
                    console.log("WASM Imports:", Object.keys(this.imports.env));

                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('Blitz3DLoaded', {
                            detail: { instance: this.core.instance, module: this.core.module, loadTime: endTime - startTime, fromCache: true }
                        }));
                    }

                    if (this.core.instance.exports.main) {
                        this.core.instance.exports.main();
                    } else if (this.core.instance.exports.Main) {
                        this.core.instance.exports.Main();
                    }

                    return result;
                } catch (cacheError) {
                    console.warn("Cache load failed, using standard loading:", cacheError.message);
                }
            }

            // Standard loading
            const response = await fetch(wasmUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
            if (totalBytes) {
                console.log(`WASM size: ${(totalBytes / 1024).toFixed(2)} KB`);
            }

            console.log("DEBUG: Checking imports.env.CreateCamera:", this.imports.env.CreateCamera);
            if (this.imports.env.CreateCamera) {
                console.log("DEBUG: CreateCamera source:", this.imports.env.CreateCamera.toString());
            } else {
                console.error("DEBUG: CreateCamera is MISSING from imports!");
            }

            if (WebAssembly.instantiateStreaming) {
                console.log("Using WebAssembly.instantiateStreaming.");
                try {
                    result = await WebAssembly.instantiateStreaming(response, this.imports);
                } catch (e) {
                    console.warn("instantiateStreaming failed, falling back...");
                    const fallbackResponse = await fetch(wasmUrl);
                    const buffer = await fallbackResponse.arrayBuffer();
                    console.log(`WASM size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
                    result = await WebAssembly.instantiate(buffer, this.imports);
                }
            } else {
                const buffer = await response.arrayBuffer();
                console.log(`WASM size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
                result = await WebAssembly.instantiate(buffer, this.imports);
            }

            const { instance, module } = result;
            this.core.instance = instance;
            this.core.module = module;
            this.core.exports = instance.exports;
            this.core.memory = instance.exports.memory;

            const alloc = instance.exports.__Alloc;
            if (alloc) {
                this.core.allocString = function (str) {
                    const len = str.length;
                    const ptr = alloc(len + 1);
                    const mem = new Uint8Array(this.core.memory.buffer);
                    for (let i = 0; i < len; i++) {
                        mem[ptr + i] = str.charCodeAt(i);
                    }
                    mem[ptr + len] = 0;
                    return ptr;
                }.bind(this);
            }

            const endTime = performance.now();
            console.log(`WASM Loaded and Compiled in ${(endTime - startTime).toFixed(2)}ms`);
            console.log("WASM Imports:", Object.keys(this.imports.env));

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('Blitz3DLoaded', {
                    detail: { instance, module, loadTime: endTime - startTime, fromCache: false }
                }));
            }

            if (instance.exports.main) {
                instance.exports.main();
            } else if (instance.exports.Main) {
                instance.exports.Main();
            }

            return result;
        } catch (e) {
            console.error("Failed to load WASM:", e);
            throw e;
        }
    },

    preload: async function (fileList) {
        const zips = fileList.filter(f => f.toLowerCase().endsWith('.zip'));
        const files = fileList.filter(f => !f.toLowerCase().endsWith('.zip'));

        if (zips.length > 0) {
            for (const url of zips) {
                await this.zipManager.loadZip(url);
            }
        }

        for (const file of files) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    this.fs[file] = buffer;
                    console.log("Preloaded: " + file);
                }
            } catch (e) {
                console.warn("Error preloading: " + file, e);
            }
        }
    }
};

// Convenience getters for compatibility
Object.defineProperty(Blitz3D, 'memory', {
    get: function () { return this.core?.memory; }
});

Object.defineProperty(Blitz3D, 'instance', {
    get: function () { return this.core?.instance; }
});

Object.defineProperty(Blitz3D, 'exports', {
    get: function () { return this.core?.exports; }
});

Object.defineProperty(Blitz3D, 'canvas', {
    get: function () { return this.core?.canvas; }
});

window.Blitz3D = Blitz3D;

// Version for cache busting
console.log("Blitz3D Runtime v1.0.5 loaded");

// Export to window for browser
if (typeof window !== 'undefined') {
    window.Blitz3D = Blitz3D;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blitz3D;
}
