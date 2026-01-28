
import { Blitz3DCore } from './runtime/core';
import { Blitz3DGraphics } from './runtime/graphics';
import { Blitz3DFileIO } from './runtime/fileio';

async function init() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) throw new Error("No canvas found");

    // Initialize Core
    const core = new Blitz3DCore();
    core.init('canvas'); // Pass ID string as expected by core.init

    // Initialize Subsystems
    const graphics = new Blitz3DGraphics(core);
    const fileIO = new Blitz3DFileIO(core);

    // Attach to core (legacy pattern support)
    core.graphics = graphics;
    core.fileIO = fileIO;

    // Load WASM
    try {
        const response = await fetch('/Main.wasm');
        if (!response.ok) throw new Error(`Failed to load WASM: ${response.statusText}`);

        const buffer = await response.arrayBuffer();

        // Create Imports Object
        const imports: any = {
            env: {
                // Add missing stubs
                __indirect_function_table: new WebAssembly.Table({ initial: 0, element: 'anyfunc' })
            },
            blitz3d: {}
        };

        // Setup Imports
        if (core.setupCommonImports) core.setupCommonImports(imports);
        if (graphics.setupImports) graphics.setupImports(imports);
        if (fileIO.setupImports) fileIO.setupImports(imports);

        // --- Automatic Stubbing for Missing Imports ---
        const wasmModule = await WebAssembly.compile(buffer);
        const requiredImports = WebAssembly.Module.imports(wasmModule);

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
                    // Memory is usually provided by the host, but sometimes imported
                    // If missing, we might have a problem, but let's try to provide a default
                    console.warn(`[Runtime] Missing memory import: ${imp.module}.${imp.name}`);
                }
            }
        });

        // Instantiate
        const instance = await WebAssembly.instantiate(wasmModule, imports);

        // Link Memory
        core.memory = instance.exports.memory;
        core.instance = instance;
        core.exports = instance.exports;

        // Implementation of string allocation in WASM memory
        core.allocString = (str: string) => {
            if (instance.exports.__StringAlloc) {
                const ptr = (instance.exports.__StringAlloc as Function)(str.length);
                const mem = new Uint8Array(core.memory.buffer, ptr, str.length + 1);
                for (let i = 0; i < str.length; i++) {
                    mem[i] = str.charCodeAt(i);
                }
                mem[str.length] = 0; // Null terminator
                return ptr;
            }
            return 0;
        };

        // Initialize FileIO Memory Access
        fileIO.setMemory(core.memory);

        // Run Main (Implicit or Explicit export)
        console.log("WASM Instantiated", instance.exports);

        if (instance.exports.Main) {
            console.log("Starting Blitz3D Main (Async)...");
            setTimeout(() => {
                try {
                    (instance.exports.Main as Function)();
                } catch (e) {
                    console.error("Blitz3D Execution Error:", e);
                }
            }, 100);
        } else if (instance.exports._start) {
            console.log("Starting WASI _start...");
            (instance.exports._start as Function)();
        } else {
            console.warn("No Main/_start found, assuming auto-start or library mode");
        }

        // Start Render Loop
        const loop = () => {
            core.beginFrame();
            // Blitz3D usually drives its own loop via Flip(), but we might need to pump it here if Main() returns
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);

        document.getElementById('loading')!.style.display = 'none';

    } catch (e) {
        console.error("Game Launch Error:", e);
        document.getElementById('loading')!.innerText = `Error: ${e}`;
    }
}

init();
