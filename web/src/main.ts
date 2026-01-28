import { Blitz3DCore } from './runtime/core';
import { Blitz3DGraphics } from './runtime/graphics';
import { Blitz3DFileIO } from './runtime/fileio';

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
    section?: 'wasm' | 'assets';
    progress?: number;
    text?: string;
    detail?: string;
};

const BOOT_WASM_PATH = '/scpcb.wasm';
const BOOT_MANIFEST_PATH = '/scpcb_manifest.json';
const BOOT_ASSET_GROUP = 'boot';

const getLoaderElements = (): LoaderElements => {
    const overlay = document.getElementById('loading') as HTMLElement | null;
    const wasmBar = document.getElementById('loading-bar-wasm') as HTMLElement | null;
    const wasmText = document.getElementById('loading-text-wasm') as HTMLElement | null;
    const assetsBar = document.getElementById('loading-bar-assets') as HTMLElement | null;
    const assetsText = document.getElementById('loading-text-assets') as HTMLElement | null;
    const detail = document.getElementById('loading-detail') as HTMLElement | null;
    const diagnostics = document.getElementById('diagnostics') as HTMLElement | null;

    if (!overlay || !wasmBar || !wasmText || !assetsBar || !assetsText || !detail || !diagnostics) {
        throw new Error('Missing loader UI elements');
    }

    return { overlay, wasmBar, wasmText, assetsBar, assetsText, detail, diagnostics };
};

const updateLoader = (elements: LoaderElements, update: LoaderUpdate) => {
    if (update.section === 'wasm') {
        if (typeof update.progress === 'number') {
            const clamped = Math.max(0, Math.min(1, update.progress));
            elements.wasmBar.style.width = `${Math.round(clamped * 100)}%`;
        }
        if (update.text) elements.wasmText.textContent = update.text;
    } else if (update.section === 'assets') {
        if (typeof update.progress === 'number') {
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
        .join('');
};

const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const streamFetchWithProgress = async (
    url: string,
    onProgress: (loaded: number, total: number | null, rate: number | null) => void
) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
        const buffer = await response.arrayBuffer();
        onProgress(buffer.byteLength, buffer.byteLength, null);
        return buffer;
    }

    const contentLength = response.headers.get('Content-Length');
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
                await new Promise(r => setTimeout(r, 0));
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

const setupImports = (core: Blitz3DCore, graphics: Blitz3DGraphics, fileIO: Blitz3DFileIO) => {
    const imports: any = {
        env: {
            __indirect_function_table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' })
        },
        blitz3d: {}
    };

    if (core.setupCommonImports) core.setupCommonImports(imports);
    if (graphics.setupImports) graphics.setupImports(imports);
    if (fileIO.setupImports) fileIO.setupImports(imports);

    return imports;
};

const stubMissingImports = (imports: any, module: WebAssembly.Module) => {
    const requiredImports = WebAssembly.Module.imports(module);

    requiredImports.forEach(imp => {
        if (!(imp.module in imports)) {
            imports[imp.module] = {};
        }
        if (!(imp.name in imports[imp.module])) {
            if (imp.kind === 'function') {
                console.warn(`[Runtime] Stubbing missing import: ${imp.module}.${imp.name}`);
                imports[imp.module][imp.name] = (...args: any[]) => {
                    console.warn(`[WASM] Called missing function: ${imp.module}.${imp.name}`, args);
                    return 0;
                };
            } else if (imp.kind === 'memory') {
                console.warn(`[Runtime] Missing memory import: ${imp.module}.${imp.name}`);
            }
        }
    });
};

const instantiateWasm = async (
    buffer: ArrayBuffer,
    imports: any,
    onProgress: (ratio: number, detail: string) => void
): Promise<WebAssembly.Instance> => {
    onProgress(0.85, 'Compiling WASM');
    // Yield before heavy compilation
    await new Promise(r => setTimeout(r, 10));

    const wasmModule = await WebAssembly.compile(buffer);
    stubMissingImports(imports, wasmModule);

    onProgress(0.95, 'Instantiating WASM');
    // Yield before instantiation
    await new Promise(r => setTimeout(r, 10));

    const instance = await WebAssembly.instantiate(wasmModule, imports);
    onProgress(1, 'WASM ready');
    return instance;
};

const attachRuntime = (core: Blitz3DCore, fileIO: Blitz3DFileIO, instance: WebAssembly.Instance) => {
    core.memory = instance.exports.memory as WebAssembly.Memory;
    core.instance = instance;
    core.exports = instance.exports;

    core.allocString = (str: string) => {
        if (instance.exports.__StringAlloc) {
            const ptr = (instance.exports.__StringAlloc as Function)(str.length);
            const mem = new Uint8Array(core.memory.buffer, ptr, str.length + 1);
            for (let i = 0; i < str.length; i++) {
                mem[i] = str.charCodeAt(i);
            }
            mem[str.length] = 0;
            return ptr;
        }
        return 0;
    };

    fileIO.setMemory(core.memory);
};

const startMain = (instance: WebAssembly.Instance) => {
    if (instance.exports.Main) {
        console.log('Starting Blitz3D Main (Async)...');
        // Use requestAnimationFrame to yield control to the browser before starting the heavy Main loop.
        // This ensures the DOM updates (like hiding loader) have a chance to paint.
        requestAnimationFrame(() => {
            try {
                (instance.exports.Main as Function)();
            } catch (e) {
                console.error('Blitz3D Execution Error:', e);
            }
        });
    } else if (instance.exports._start) {
        console.log('Starting WASI _start...');
        (instance.exports._start as Function)();
    } else {
        console.warn('No Main/_start found, assuming auto-start or library mode');
    }
};

const startUpdateLoop = (core: Blitz3DCore) => {
    if (!core.exports || typeof core.exports.UpdateGame !== 'function') {
        console.warn('No UpdateGame export found; skipping tick loop');
        return;
    }

    const tick = () => {
        try {
            (core.exports.UpdateGame as Function)();
        } catch (e) {
            console.error('UpdateGame error:', e);
        }
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
};

const startRenderLoop = (core: Blitz3DCore) => {
    const loop = () => {
        core.beginFrame();
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
};

async function init() {
    const loader = getLoaderElements();
    updateLoader(loader, { section: 'wasm', text: 'Initializing...', progress: 0.1 });

    const core = new Blitz3DCore();
    core.init('canvas');

    const graphics = new Blitz3DGraphics(core);
    const fileIO = new Blitz3DFileIO(core);

    core.graphics = graphics;
    core.fileIO = fileIO;

    graphics.init3D();
    console.log('Graphics init3D done. Scene:', graphics.scene ? 'ok' : 'missing');

    try {
        updateLoader(loader, { section: 'wasm', text: 'Connecting...', progress: 0.1 });

        const diagnosticsState: Record<string, string | number> = {
            'WASM': 'starting',
            'Assets': 'pending',
            'Downloads': 0
        };

        // Parallelize WASM fetch and Manifest fetch
        const wasmPromise = streamFetchWithProgress(BOOT_WASM_PATH, (loaded, total, rate) => {
            const ratio = total ? loaded / total : 0;
            const sizeLabel = total ? `${formatBytes(loaded)} / ${formatBytes(total)}` : formatBytes(loaded);
            const rateLabel = rate ? `${formatBytes(rate)}/s` : '';
            diagnosticsState.WASM = rateLabel ? `${sizeLabel} (${rateLabel})` : sizeLabel;
            loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
            updateLoader(loader, {
                section: 'wasm',
                text: 'Downloading',
                progress: ratio,
                detail: rateLabel ? `${sizeLabel} • ${rateLabel}` : sizeLabel
            });
        });

        const manifestPromise = fileIO.loadAssetManifest(BOOT_MANIFEST_PATH).then(success => {
            if (success) {
                console.log('Manifest loaded early');
                // Start preloading BOOT assets as soon as manifest is ready, but don't await completion yet
                diagnosticsState.Assets = 'streaming';

                // Initialize asset streaming in background
                let lastUpdate = 0;
                fileIO.preloadAssetGroup(BOOT_ASSET_GROUP, {
                    concurrency: 4,
                    onProgress: (loaded, total, file) => {
                        const now = performance.now();
                        if (now - lastUpdate > 32 || loaded === total) {
                            const ratio = total ? loaded / total : 0;
                            diagnosticsState.Assets = `${loaded}/${total ?? '?'}`;
                            diagnosticsState.Downloads = Math.max(diagnosticsState.Downloads as number, loaded);
                            loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);

                            updateLoader(loader, {
                                section: 'assets',
                                text: 'Streaming',
                                progress: ratio,
                                detail: file ?? ''
                            });
                            lastUpdate = now;
                        }
                    }
                }).catch(err => {
                    console.error('Boot asset preload failed:', err);
                    diagnosticsState.Assets = 'error';
                    loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
                });
            }
            return success;
        });

        const [buffer, manifestLoaded] = await Promise.all([wasmPromise, manifestPromise]);

        updateLoader(loader, { section: 'wasm', text: 'Imports...', progress: 1 });
        const imports = setupImports(core, graphics, fileIO);

        const instance = await instantiateWasm(buffer as ArrayBuffer, imports, (ratio, detail) => {
            updateLoader(loader, { section: 'wasm', text: detail, progress: ratio });
        });

        attachRuntime(core, fileIO, instance);

        console.log('WASM Instantiated', instance.exports);

        // Start Game Loop
        startMain(instance);
        startUpdateLoop(core);
        startRenderLoop(core);

        // Hide loader immediately to show game
        updateLoader(loader, { section: 'wasm', text: 'Running', progress: 1 });
        loader.overlay.style.display = 'none';

        // Continue with facility assets if available
        if (manifestLoaded && fileIO.assetManifest?.groups?.facility_assets?.length) {
            const totalAssets = fileIO.assetManifest.groups.facility_assets.length;
            let loadedAssets = 0;
            let lastUpdate = 0;

            fileIO.preloadAssetGroup('facility_assets', {
                concurrency: 2, // Reduced concurrency
                onProgress: (loaded, total, file) => {
                    loadedAssets = loaded;
                    const now = performance.now();

                    // Throttle UI updates to 10fps (100ms)
                    if (now - lastUpdate > 100 || loaded === total) {
                        diagnosticsState.Assets = `${loadedAssets}/${totalAssets}`;
                        diagnosticsState.Downloads = Math.max(diagnosticsState.Downloads as number, loadedAssets);
                        loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
                        updateLoader(loader, {
                            section: 'assets',
                            text: 'Streaming',
                            progress: total ? loadedAssets / total : 0,
                            detail: file ?? ''
                        });
                        lastUpdate = now;
                    }
                }
            }).catch(err => console.error('Facility asset preload failed:', err));
        }

    } catch (e: any) {
        console.error('Game Launch Error:', e);
        updateLoader(loader, { section: 'wasm', text: 'Error', progress: 1, detail: e?.message ?? String(e) });
        loader.detail.style.color = '#ff5252';
    }
}

init();
