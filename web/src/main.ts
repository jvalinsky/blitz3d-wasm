import { Blitz3DCore } from './runtime/core';
import { Blitz3DGraphics } from './runtime/graphics';
import { Blitz3DFileIO } from './runtime/fileio';

type LoaderElements = {
    overlay: HTMLElement;
    stage: HTMLElement;
    progress: HTMLElement;
    detail: HTMLElement;
    diagnostics: HTMLElement;
};

type ProgressUpdate = {
    stage: string;
    progress?: number;
    detail?: string;
};

const BOOT_WASM_PATH = '/scpcb.wasm';
const BOOT_MANIFEST_PATH = '/scpcb_manifest.json';
const BOOT_ASSET_GROUP = 'boot';

const getLoaderElements = (): LoaderElements => {
    const overlay = document.getElementById('loading') as HTMLElement | null;
    const stage = document.getElementById('loading-stage') as HTMLElement | null;
    const progress = document.getElementById('loading-progress') as HTMLElement | null;
    const detail = document.getElementById('loading-detail') as HTMLElement | null;
    const diagnostics = document.getElementById('diagnostics') as HTMLElement | null;

    if (!overlay || !stage || !progress || !detail || !diagnostics) {
        throw new Error('Missing loader UI elements');
    }

    return { overlay, stage, progress, detail, diagnostics };
};

const updateLoader = (elements: LoaderElements, update: ProgressUpdate) => {
    elements.stage.textContent = update.stage;
    if (typeof update.progress === 'number') {
        const clamped = Math.max(0, Math.min(1, update.progress));
        elements.progress.style.width = `${Math.round(clamped * 100)}%`;
    }
    elements.detail.textContent = update.detail ?? '';
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
    let lastTime = performance.now();
    let lastLoaded = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            loaded += value.length;
            const now = performance.now();
            const dt = (now - lastTime) / 1000;
            let rate: number | null = null;
            if (dt > 0.25) {
                rate = (loaded - lastLoaded) / dt;
                lastLoaded = loaded;
                lastTime = now;
            }
            onProgress(loaded, total, rate);
        }
    }

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
    const wasmModule = await WebAssembly.compile(buffer);
    stubMissingImports(imports, wasmModule);
    onProgress(0.95, 'Instantiating WASM');
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
        setTimeout(() => {
            try {
                (instance.exports.Main as Function)();
            } catch (e) {
                console.error('Blitz3D Execution Error:', e);
            }
        }, 100);
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
    const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
    if (!canvas) throw new Error('No canvas found');

    const loader = getLoaderElements();
    updateLoader(loader, { stage: 'Initializing runtime...', progress: 0.05 });

    const core = new Blitz3DCore();
    core.init('canvas');

    const graphics = new Blitz3DGraphics(core);
    const fileIO = new Blitz3DFileIO(core);

    core.graphics = graphics;
    core.fileIO = fileIO;

    graphics.init3D();
    console.log('Graphics init3D done. Scene:', graphics.scene ? 'ok' : 'missing');

    try {
        updateLoader(loader, { stage: 'Downloading WASM...', progress: 0.1, detail: BOOT_WASM_PATH });

        const diagnosticsState: Record<string, string | number> = {
            'WASM': 'starting',
            'Assets': 'pending',
            'Downloads': 0
        };

        const buffer = await streamFetchWithProgress(BOOT_WASM_PATH, (loaded, total, rate) => {
            const ratio = total ? loaded / total : 0;
            const sizeLabel = total ? `${formatBytes(loaded)} / ${formatBytes(total)}` : formatBytes(loaded);
            const rateLabel = rate ? `${formatBytes(rate)}/s` : '';
            diagnosticsState.WASM = rateLabel ? `${sizeLabel} (${rateLabel})` : sizeLabel;
            loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
            updateLoader(loader, {
                stage: 'Downloading WASM...',
                progress: 0.1 + ratio * 0.6,
                detail: rateLabel ? `${sizeLabel} • ${rateLabel}` : sizeLabel
            });
        });

        updateLoader(loader, { stage: 'Preparing imports...', progress: 0.72 });
        const imports = setupImports(core, graphics, fileIO);

        const instance = await instantiateWasm(buffer, imports, (ratio, detail) => {
            updateLoader(loader, { stage: detail, progress: 0.72 + ratio * 0.28 });
        });

        attachRuntime(core, fileIO, instance);

        updateLoader(loader, { stage: 'Loading boot assets...', progress: 0.98 });
        diagnosticsState.Assets = 'loading';
        loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
        const manifestLoaded = await fileIO.loadAssetManifest(BOOT_MANIFEST_PATH);

        console.log('WASM Instantiated', instance.exports);
        startMain(instance);
        startUpdateLoop(core);
        startRenderLoop(core);

        updateLoader(loader, { stage: 'Running', progress: 1, detail: 'Streaming assets…' });
        loader.overlay.style.display = 'none';

        if (manifestLoaded) {
            let completed = 0;
            fileIO.preloadAssetGroup(BOOT_ASSET_GROUP, {
                concurrency: 4,
                onProgress: (loaded, total, file) => {
                    const ratio = total ? loaded / total : 0;
                    completed = loaded;
                    diagnosticsState.Assets = `${loaded}/${total ?? '?'}`;
                    diagnosticsState.Downloads = Math.max(diagnosticsState.Downloads as number, loaded);
                    loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
                    updateLoader(loader, {
                        stage: 'Streaming boot assets…',
                        progress: 0.98 + ratio * 0.02,
                        detail: file ?? ''
                    });
                }
            }).catch(err => console.error('Boot asset preload failed:', err));
            diagnosticsState.Assets = `${completed}/${fileIO.assetManifest?.groups?.[BOOT_ASSET_GROUP]?.length ?? 0}`;

            if (fileIO.assetManifest?.groups?.facility_assets?.length) {
                const totalAssets = fileIO.assetManifest.groups.facility_assets.length;
                let loadedAssets = 0;
                fileIO.preloadAssetGroup('facility_assets', {
                    concurrency: 4,
                    onProgress: (loaded, total, file) => {
                        loadedAssets = loaded;
                        const ratio = total ? loaded / total : 0;
                        diagnosticsState.Assets = `${loadedAssets}/${totalAssets}`;
                        diagnosticsState.Downloads = Math.max(diagnosticsState.Downloads as number, loadedAssets);
                        loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
                        updateLoader(loader, {
                            stage: 'Streaming facility assets…',
                            progress: 0.99 + ratio * 0.01,
                            detail: file ?? ''
                        });
                    }
                }).catch(err => console.error('Facility asset preload failed:', err));
                diagnosticsState.Assets = `${loadedAssets}/${totalAssets}`;
                loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
            }
        } else {
            diagnosticsState.Assets = 'manifest missing';
            loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
        }

        updateLoader(loader, { stage: 'Running', progress: 1, detail: 'Streaming assets…' });
    } catch (e: any) {
        console.error('Game Launch Error:', e);
        updateLoader(loader, { stage: 'Launch failed', progress: 1, detail: e?.message ?? String(e) });
    }
}

init();
