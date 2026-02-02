// ============================================
// Blitz3D Web Interpreter - Main Module
// ============================================

// --- STATE ---
let compilerWASM = null;
let compiledModule = null;
let runtimeInstance = null;
let THREE = window.THREE || null;
let threeScene = null;
let threeRenderer = null;
let threeCamera = null;
const entities = new Map();
let nextEntityId = 1;
let isCompiling = false;

// --- DOM ELEMENTS ---
const getEl = (id) => document.getElementById(id);
const editorEl = getEl('editor');
const outputEl = getEl('output');
const statusIndicatorEl = getEl('status-indicator');
const statusTextEl = getEl('status-text');
const canvasContainerEl = getEl('canvas-container');
const gameCanvasEl = getEl('game-canvas');
const runBtnEl = getEl('run-btn');
const exampleSelectEl = getEl('example-select');

// --- EXAMPLES ---
const examples = {
    hello: `Print "Hello from Blitz3D WASM!"
Print "This code is compiled and runs in your browser."`,
    
    graphics: `; 3D Cube Demo
Graphics 800, 600, 32

; Create a simple cube
cube = CreateCube()
PositionEntity cube, 0, 0, 5

; Main loop (simplified)
Print "Cube created successfully!"
Print "In a full implementation, this would render a 3D cube."`
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    editorEl.value = examples.hello;
    
    if (THREE) {
        initThreeJS();
    }
    
    await initCompiler();
    setupEventListeners();
});

function setupEventListeners() {
    runBtnEl.addEventListener('click', runCode);
    
    exampleSelectEl.addEventListener('change', (e) => {
        const example = e.target.value;
        if (example && examples[example]) {
            editorEl.value = examples[example];
        }
    });
}

function initThreeJS() {
    printOutput(`Three.js v${THREE.REVISION} loaded.`, 'success');
    
    threeScene = new THREE.Scene();
    threeScene.background = new THREE.Color(0x1a1a2a);
    
    threeCamera = new THREE.PerspectiveCamera(
        75, 
        canvasContainerEl.clientWidth / canvasContainerEl.clientHeight, 
        0.1, 
        1000
    );
    threeCamera.position.z = 5;
    
    threeRenderer = new THREE.WebGLRenderer({ 
        canvas: gameCanvasEl, 
        antialias: true,
        alpha: false
    });
    threeRenderer.setSize(canvasContainerEl.clientWidth, canvasContainerEl.clientHeight);
    threeRenderer.setPixelRatio(window.devicePixelRatio);
}

// --- COMPILER INITIALIZATION ---
async function initCompiler() {
    console.log('initCompiler started');
    printOutput('Starting compiler initialization...', 'info');
    setStatus('loading', 'Loading compiler...');
    
    try {
        const response = await fetch('./blitz3d-compiler.wasm');
        if (!response.ok) {
            throw new Error(`Failed to fetch compiler: ${response.status} ${response.statusText}`);
        }
        
        const bytes = await response.arrayBuffer();
        
        let wasmMemoryRef = null;
        
        const wasiImports = {
            args_get: () => 0,
            args_sizes_get: (argc, argv_buf_size) => {
                if (!wasmMemoryRef) return 0;
                const view = new DataView(wasmMemoryRef.buffer);
                view.setUint32(argc, 0, true);
                view.setUint32(argv_buf_size, 0, true);
                return 0;
            },
            environ_get: () => 0,
            environ_sizes_get: (envc, env_buf_size) => {
                if (!wasmMemoryRef) return 0;
                const view = new DataView(wasmMemoryRef.buffer);
                view.setUint32(envc, 0, true);
                view.setUint32(env_buf_size, 0, true);
                return 0;
            },
            fd_write: (fd, iovs, iovs_len, nwritten) => {
                if (!wasmMemoryRef) return 0;
                if (fd === 1 || fd === 2) {
                    const view = new DataView(wasmMemoryRef.buffer);
                    const bytes = new Uint8Array(wasmMemoryRef.buffer);
                    let written = 0;
                    for (let i = 0; i < iovs_len; i++) {
                        const ptr = view.getUint32(iovs + i * 8, true);
                        const len = view.getUint32(iovs + i * 8 + 4, true);
                        const text = new TextDecoder().decode(bytes.subarray(ptr, ptr + len));
                        if (text) console.log(text);
                        written += len;
                    }
                    view.setUint32(nwritten, written, true);
                }
                return 0;
            },
            fd_read: () => 0,
            fd_close: () => 0,
            fd_seek: () => 0,
            fd_fdstat_get: () => 0,
            fd_fdstat_set_flags: () => 0,
            fd_prestat_get: () => 8,
            fd_prestat_dir_name: () => 8,
            path_open: () => 8,
            path_filestat_get: () => 8,
            proc_exit: (code) => {
                console.log(`Compiler exited with code: ${code}`);
            },
            random_get: (buf, bufLen) => {
                if (!wasmMemoryRef) return 0;
                const mem = new Uint8Array(wasmMemoryRef.buffer);
                for (let i = 0; i < bufLen; i++) {
                    mem[buf + i] = Math.floor(Math.random() * 256);
                }
                return 0;
            },
            clock_time_get: (id, precision, time) => {
                if (!wasmMemoryRef) return 0;
                const view = new DataView(wasmMemoryRef.buffer);
                view.setBigUint64(time, BigInt(Date.now()) * BigInt(1000000), true);
                return 0;
            },
            poll_oneoff: () => 0,
            sched_yield: () => 0,
            clock_res_get: () => 0,
            fd_filestat_get: () => 0,
            fd_filestat_set_size: () => 0,
            fd_pread: () => 0,
            fd_readdir: () => 0,
            fd_sync: () => 0,
            fd_tell: () => 0,
            path_create_directory: () => 0,
            path_filestat_set_times: () => 0,
            path_link: () => 0,
            path_readlink: () => 0,
            path_remove_directory: () => 0,
            path_rename: () => 0,
            path_symlink: () => 0,
            path_unlink_file: () => 0
        };
        
        const wasm = await WebAssembly.instantiate(bytes, {
            env: {},
            wasi_snapshot_preview1: wasiImports
        });
        
        compilerWASM = wasm.instance;
        wasmMemoryRef = compilerWASM.exports.memory;
        
        try {
            compilerWASM.exports._start();
        } catch (error) {
            printOutput(`Swift runtime initialization warning: ${error.message}`, 'warning');
            console.warn('Swift _start() error:', error);
        }
        
        printOutput('Blitz3D compiler loaded successfully!', 'success');
        setStatus('ready', 'Ready');
        
    } catch (error) {
        const errorMsg = `Failed to load compiler: ${error.message}`;
        printOutput(errorMsg, 'error');
        setStatus('error', 'Compiler load failed');
        console.error('Compiler load error:', error);
        
        const outputDiv = document.getElementById('output');
        if (outputDiv) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'output-line error';
            errorDiv.style.fontWeight = 'bold';
            errorDiv.textContent = errorMsg;
            outputDiv.appendChild(errorDiv);
        }
    }
}

// --- COMPILATION ---
async function compileSource(source) {
    if (!compilerWASM) {
        throw new Error('Compiler not loaded yet');
    }
    
    const exports = compilerWASM.exports;
    const memory = exports.memory;
    const malloc = exports.malloc;
    const free = exports.free;
    
    console.log('WASM exports:', Object.keys(exports));
    
    const compileFunc = exports.compile_blitz3d || exports._compile_blitz3d || exports.compileBlitz3D;
    
    if (!compileFunc) {
        throw new Error('compile_blitz3d function not found in WASM. Available: ' + Object.keys(exports).join(', '));
    }
    
    console.log('Using compile function:', compileFunc.name || 'anonymous');
    
    const encoder = new TextEncoder();
    const sourceBytes = encoder.encode(source);
    
    const sourcePtr = malloc(sourceBytes.length + 1);
    if (sourcePtr === 0) {
        throw new Error('Failed to allocate memory for source code');
    }
    
    try {
        const sourceView = new Uint8Array(memory.buffer, sourcePtr, sourceBytes.length);
        sourceView.set(sourceBytes);
        
        const resultPtrPtr = malloc(4);
        const resultLenPtr = malloc(4);
        
        if (resultPtrPtr === 0 || resultLenPtr === 0) {
            throw new Error('Failed to allocate memory for result pointers');
        }
        
        try {
            const ret = compileFunc(
                sourcePtr,
                sourceBytes.length,
                0,
                0,
                resultPtrPtr,
                resultLenPtr
            );
            
            if (ret !== 0) {
                throw new Error(`Compilation failed with exit code: ${ret}`);
            }
            
            const resultPtrView = new Uint32Array(memory.buffer, resultPtrPtr, 1);
            const resultLenView = new Uint32Array(memory.buffer, resultLenPtr, 1);
            const resultPtr = resultPtrView[0];
            const resultLen = resultLenView[0];
            
            if (resultPtr === 0 || resultLen === 0) {
                throw new Error('Compilation returned empty result');
            }
            
            const resultView = new Uint8Array(memory.buffer, resultPtr, resultLen);
            const decoder = new TextDecoder();
            const resultJSON = decoder.decode(resultView);
            
            const result = JSON.parse(resultJSON);
            
            if (exports.free_result) {
                exports.free_result(resultPtr);
            }
            
            return result;
            
        } finally {
            free(resultPtrPtr);
            free(resultLenPtr);
        }
        
    } finally {
        free(sourcePtr);
    }
}

// --- CODE EXECUTION ---
async function runCode() {
    const source = editorEl.value.trim();
    
    if (!source) {
        printOutput('Please enter some code to compile.', 'error');
        return;
    }
    
    if (isCompiling) {
        printOutput('Compilation already in progress...', 'warning');
        return;
    }
    
    isCompiling = true;
    runBtnEl.disabled = true;
    runBtnEl.textContent = 'Compiling...';
    setStatus('compiling', 'Compiling...');
    clearOutput();
    printOutput('Compiling Blitz3D code...', 'info');
    
    try {
        const result = await compileSource(source);
        
        if (result.success) {
            printOutput(`Compilation successful!`, 'success');
            printOutput(`WASM size: ${result.size || 0} bytes`, 'info');
            
            if (result.wasm) {
                await executeCompiledWASM(result.wasm);
            }
        } else {
            printOutput(`Compilation failed:`, 'error');
            printOutput(result.error || 'Unknown error', 'error');
        }
        
    } catch (error) {
        printOutput(`Error: ${error.message}`, 'error');
        console.error('Run code error:', error);
    } finally {
        isCompiling = false;
        runBtnEl.disabled = false;
        runBtnEl.textContent = 'Run';
        setStatus('ready', 'Ready');
    }
}

async function executeCompiledWASM(wasmBase64) {
    try {
        printOutput('Loading compiled module...', 'info');
        
        const wasmBytes = base64ToBytes(wasmBase64);
        const imports = createRuntimeImports();
        
        const wasm = await WebAssembly.instantiate(wasmBytes, imports);
        runtimeInstance = wasm.instance;
        
        printOutput('Executing compiled code...', 'info');
        
        if (runtimeInstance.exports.main) {
            runtimeInstance.exports.main();
        } else if (runtimeInstance.exports._start) {
            runtimeInstance.exports._start();
        } else {
            printOutput('Warning: No entry point found in compiled module', 'warning');
        }
        
        printOutput('Execution completed.', 'success');
        
    } catch (error) {
        printOutput(`Execution error: ${error.message}`, 'error');
        console.error('Execution error:', error);
    }
}

function base64ToBytes(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// --- RUNTIME IMPORTS FOR COMPILED CODE ---
function createRuntimeImports() {
    const imports = {
        env: {},
        blitz3d: {},
        al: {}
    };

    const functions = {
        Print: (ptr, len) => {
            const memory = runtimeInstance.exports.memory;
            const bytes = new Uint8Array(memory.buffer, ptr, len);
            const text = new TextDecoder().decode(bytes);
            printOutput(text, 'success');
        },
        PrintInt: (val) => printOutput(String(val), 'success'),
        PrintFloat: (val) => printOutput(String(val), 'success'),
        PrintString: (ptr, len) => {
            const memory = runtimeInstance.exports.memory;
            const bytes = new Uint8Array(memory.buffer, ptr, len);
            const text = new TextDecoder().decode(bytes);
            printOutput(text, 'success');
        },
        Graphics: (width, height, depth) => {
            printOutput(`Graphics ${width}x${height}x${depth}`, 'info');
            showTab('canvas');
        },
        Graphics3D: (width, height, depth, mode) => {
            printOutput(`Graphics3D ${width}x${height}x${depth} mode ${mode}`, 'info');
            showTab('canvas');
        },
        Cls: () => {
            printOutput('Clear screen', 'info');
            threeScene.background = new THREE.Color(0x000000);
            threeRenderer.clear();
        },
        Flip: () => {
            threeRenderer.render(threeScene, threeCamera);
        },
        ClsColor: (red, green, blue) => {
            const color = new THREE.Color(red / 255, green / 255, blue / 255);
            threeScene.background = color;
        },
        Color: (red, green, blue) => {
            // Placeholder
        },
        GetColor: () => 0,
        CreateCube: () => {
            if (!THREE || !threeScene) {
                printOutput('Error: 3D graphics not available', 'error');
                return 0;
            }
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const cube = new THREE.Mesh(geometry, material);
            const id = nextEntityId++;
            entities.set(id, cube);
            threeScene.add(cube);
            printOutput(`Created cube (entity ${id})`, 'success');
            return id;
        },
        PositionEntity: (id, x, y, z) => {
            const entity = entities.get(id);
            if (entity) {
                entity.position.set(x, y, z);
            }
        },
        RenderWorld: () => {
            if (threeRenderer && threeScene && threeCamera) {
                threeRenderer.render(threeScene, threeCamera);
            }
        },
        Rect: (x, y, width, height, solid) => {
            // 2D drawing - not implemented yet
        },
        Oval: (x, y, width, height, solid) => {
            // 2D drawing - not implemented yet
        },
        Line: (x1, y1, x2, y2) => {
            // 2D drawing - not implemented yet
        },
        Text: (x, y, text, centered) => {
            // 2D drawing - not implemented yet
        },
        LoadFont: (font, height, bold, italic, underline) => {
            // Font loading - not implemented yet
            return 0; // Return a font handle
        },
        SetFont: (fontHandle) => {
            // Font setting - not implemented yet
        },
        FreeFont: (fontHandle) => {
            // Font freeing - not implemented yet
        },
        LoadImage: (file, mask, flags) => {
            // Image loading - not implemented yet
            return 0; // Return image handle
        },
        CreateImage: (width, height, frames) => {
            // Image creation - not implemented yet
            return 0; // Return image handle
        },
        DrawImage: (image, x, y, frame) => {
            // Image drawing - not implemented yet
        },
        DrawImageRect: (image, x, y, frame) => {
            // Image Rect drawing - not implemented yet
        },

        DrawBlock: (image, x, y, frame) => {
            // Block drawing - not implemented yet
        },
        TileImage: (image, x, y, frame) => {
            // Tile Image - not implemented yet
        }



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
        FreeSound: () => 0
    });
    
    // Add memory to env
    imports.env.memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });

    return imports;
}

// --- UI HELPERS ---
function printOutput(text, type = 'info') {
    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.textContent = text;
    outputEl.appendChild(line);
    outputEl.scrollTop = outputEl.scrollHeight;
}

function clearOutput() {
    outputEl.innerHTML = '';
}

function setStatus(state, text) {
    statusIndicatorEl.className = 'status-indicator ' + state;
    statusTextEl.textContent = text;
}

function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.textContent.toLowerCase().includes(tabName)) {
            tab.classList.add('active');
        }
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetTab = document.getElementById(tabName + '-tab');
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    if (tabName === 'canvas' && threeRenderer) {
        threeRenderer.render(threeScene, threeCamera);
    }
}

// Expose functions to global scope for inline onclick handlers
window.showTab = showTab;
window.clearOutput = clearOutput;

console.log('Blitz3D Interpreter loaded');
