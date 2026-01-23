const fs = require('fs');

async function run() {
    const wasmBuffer = fs.readFileSync('/tmp/menu.wasm');

    // First, check what imports are needed
    const module = await WebAssembly.compile(wasmBuffer);
    const importList = WebAssembly.Module.imports(module);

    console.log(`Module requires ${importList.length} imports`);
    const modules = [...new Set(importList.map(i => i.module))];
    console.log(`From modules: ${modules.join(', ')}`);

    // Show some imports
    console.log('\nFirst 20 imports:');
    importList.slice(0, 20).forEach(i => console.log(`  ${i.module}.${i.name} (${i.kind})`));
    if (importList.length > 20) console.log(`  ... and ${importList.length - 20} more\n`);

    // Create stub for each required module
    let memory = null; // Will be set after instantiation
    const imports = {};

    // Helper to read Blitz3D string from memory
    // Format: [RefCount: i32][Length: i32][Data: bytes][NullTerminator]
    function readString(addr) {
        if (addr === 0) return '(null)';
        if (!memory) return `(memory not ready)`;
        try {
            const view = new DataView(memory.buffer);
            const length = view.getInt32(addr + 4, true); // little-endian
            if (length < 0 || length > 10000) return `(invalid length: ${length})`;
            const bytes = new Uint8Array(memory.buffer, addr + 8, length);
            return new TextDecoder().decode(bytes);
        } catch (e) {
            return `(error: ${e.message})`;
        }
    }

    // Functions that take string arguments (first arg is string pointer)
    const stringArgFuncs = new Set([
        'LoadImage', 'LoadImage_Strict', 'LoadAnimImage', 'LoadSound', 'LoadFont',
        'OpenFile', 'ReadFile', 'WriteFile', 'FileType', 'FileSize',
        'LoadTexture', 'LoadMesh', 'LoadAnimMesh', 'Load3DSound',
        'Print', 'PrintString', 'RuntimeError', 'AppTitle',
        'CreateDir', 'DeleteDir', 'DeleteFile', 'CopyFile',
        'ReadLine', 'WriteLine', 'Input', 'Locate',
        'ExecFile', 'CommandLine', 'SystemProperty',
    ]);

    // Placeholder memory for imports (will be replaced with actual memory)
    let importMemory = new WebAssembly.Memory({ initial: 256 });

    for (const mod of modules) {
        imports[mod] = new Proxy({}, {
            get(target, prop) {
                // Handle memory import
                if (prop === 'memory') return importMemory;

                return (...args) => {
                    // Only log first few calls to avoid spam
                    if (!target._callCount) target._callCount = {};
                    if (!target._callCount[prop]) target._callCount[prop] = 0;
                    target._callCount[prop]++;

                    if (target._callCount[prop] <= 5) {
                        // Decode string arguments for known functions
                        let displayArgs = args.slice(0, 4);
                        if (stringArgFuncs.has(prop) && args.length > 0 && typeof args[0] === 'number') {
                            const str = readString(args[0]);
                            displayArgs = [`"${str}"`, ...args.slice(1, 4)];
                        }
                        console.log(`[${mod}.${prop}](${displayArgs.join(', ')}${args.length > 4 ? '...' : ''})`);
                        if (target._callCount[prop] === 5) {
                            console.log(`  (suppressing further ${prop} calls)`);
                        }
                    }
                    return 0;
                };
            }
        });
    }

    try {
        console.log('Loading WASM module...');
        const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);

        // Get memory from exports (module defines its own memory with data segments)
        if (instance.exports.memory) {
            memory = instance.exports.memory;
            console.log(`Using exported memory: ${memory.buffer.byteLength} bytes`);
        } else {
            memory = importMemory;
            console.log('Using imported memory (no export found)');
        }

        console.log('\nExported functions:');
        const exports = Object.keys(instance.exports).filter(k => typeof instance.exports[k] === 'function');
        console.log(`  ${exports.length} functions exported`);
        console.log(`  First 20: ${exports.slice(0, 20).join(', ')}`);

        console.log('\nExported globals:');
        const globals = Object.keys(instance.exports).filter(k => instance.exports[k] instanceof WebAssembly.Global);
        console.log(`  ${globals.length} globals exported`);

        // Try to find and call entry point
        const entryPoints = ['Main', 'main', '_main', '__main', '_start'];
        let called = false;

        for (const entry of entryPoints) {
            if (instance.exports[entry]) {
                console.log(`\nCalling ${entry}()...`);
                try {
                    const result = instance.exports[entry]();
                    console.log(`${entry}() returned: ${result}`);
                } catch (e) {
                    console.log(`${entry}() threw: ${e.message}`);
                    if (e.stack) {
                        console.log(e.stack.split('\n').slice(0, 5).join('\n'));
                    }
                }
                called = true;
                break;
            }
        }

        if (!called) {
            console.log('\nNo entry point found. Available exports starting with letters:');
            const named = exports.filter(e => /^[a-zA-Z]/.test(e)).slice(0, 30);
            named.forEach(n => console.log(`  - ${n}`));
        }

    } catch (e) {
        console.error('Failed to instantiate:', e.message);
        if (e.message.includes('import')) {
            console.log('\nTrying to get import requirements...');
            const module = await WebAssembly.compile(wasmBuffer);
            const importList = WebAssembly.Module.imports(module);
            console.log('Required imports:');
            importList.slice(0, 30).forEach(imp => {
                console.log(`  ${imp.module}.${imp.name} (${imp.kind})`);
            });
            if (importList.length > 30) {
                console.log(`  ... and ${importList.length - 30} more`);
            }
        }
    }
}

run();
