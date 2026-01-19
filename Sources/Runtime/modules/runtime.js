/**
 * Blitz3D WASM Runtime - Modular Version
 * Provides WebGL, Web Audio, and other browser APIs to the WASM module
 */

// Import modules if available, otherwise use global
const Blitz3DCore = window.Blitz3DCore || require('./core');
const Blitz3DGraphics = window.Blitz3DGraphics || require('./graphics');
const Blitz3DMesh = window.Blitz3DMesh || require('./mesh');
const Blitz3DPhysics = window.Blitz3DPhysics || require('./physics');
const Blitz3DInput = window.Blitz3DInput || require('./input');

const Blitz3D = {
    // Core components
    core: null,
    graphics: null,
    mesh: null,
    physics: null,
    input: null,

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
        this.core = new Blitz3DCore();
        this.core.init(canvasId);

        // Initialize graphics
        this.graphics = new Blitz3DGraphics(this.core);
        this.graphics.init3D();

        // Initialize mesh module
        this.mesh = new Blitz3DMesh(this.graphics);

        // Initialize physics
        this.physics = new Blitz3DPhysics(this.core, this.graphics);

        // Initialize input
        this.input = new Blitz3DInput(this.core, this.graphics);
        this.input.setupEventListeners();

        // Expose input test globally
        window.testBlitz3DInput = () => this.input.testInput();

        // Set up common imports
        this.core.setupCommonImports(this.imports);
        this.graphics.setupImports(this.imports);
        this.mesh.setupImports(this.imports);
        this.physics.setupImports(this.imports);
        this.input.setupImports(this.imports);

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
        blitz3d: {}
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
            console.log("Blitz3DEngine loaded and linked.");
        } catch (e) {
            console.error("Failed to load Blitz3DEngine:", e);
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

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blitz3D;
}