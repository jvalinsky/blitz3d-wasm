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

const streamFetchWithProgress = async (url: string, onProgress: (loaded: number, total: number | null) => void) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }

    if (!response.body) {
        const buffer = await response.arrayBuffer();
        onProgress(buffer.byteLength, buffer.byteLength);
        return buffer;
    }

    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? Number(contentLength) : null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
            chunks.push(value);
            loaded += value.length;
            onProgress(loaded, total);
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

    try {
        updateLoader(loader, { stage: 'Downloading WASM...', progress: 0.1, detail: BOOT_WASM_PATH });

        const diagnosticsState: Record<string, string | number> = {
            'WASM': 'starting',
            'Assets': 'pending',
            'Downloads': 0
        };

        const buffer = await streamFetchWithProgress(BOOT_WASM_PATH, (loaded, total) => {
            const ratio = total ? loaded / total : 0;
            diagnosticsState.WASM = total ? `${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB` : `${(loaded / 1024 / 1024).toFixed(1)} MB`;
            loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
            updateLoader(loader, {
                stage: 'Downloading WASM...',
                progress: 0.1 + ratio * 0.6,
                detail: total ? `${(loaded / 1024 / 1024).toFixed(1)} / ${(total / 1024 / 1024).toFixed(1)} MB` : `${(loaded / 1024 / 1024).toFixed(1)} MB`
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
        if (manifestLoaded) {
            let completed = 0;
            await fileIO.preloadAssetGroup(BOOT_ASSET_GROUP, {
                concurrency: 4,
                onProgress: (loaded, total, file) => {
                    const ratio = total ? loaded / total : 0;
                    completed = loaded;
                    diagnosticsState.Assets = `${loaded}/${total ?? '?'}`;
                    diagnosticsState.Downloads = Math.max(diagnosticsState.Downloads as number, loaded);
                    loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);
                    updateLoader(loader, {
                        stage: 'Loading boot assets...',
                        progress: 0.98 + ratio * 0.02,
                        detail: file ?? ''
                    });
                }
            });
            diagnosticsState.Assets = `${completed}/${fileIO.assetManifest?.groups?.[BOOT_ASSET_GROUP]?.length ?? 0}`;
        } else {
            diagnosticsState.Assets = 'manifest missing';
        }
        loader.diagnostics.innerHTML = formatDiagnostics(diagnosticsState);

        console.log('WASM Instantiated', instance.exports);
        startMain(instance);
        startRenderLoop(core);

        updateLoader(loader, { stage: 'Ready', progress: 1, detail: '' });
        loader.overlay.style.display = 'none';
    } catch (e: any) {
        console.error('Game Launch Error:', e);
        updateLoader(loader, { stage: 'Launch failed', progress: 1, detail: e?.message ?? String(e) });
    }
}

init();
