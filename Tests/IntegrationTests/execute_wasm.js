const fs = require('fs');
const path = require('path');

async function runWasm(wasmPath) {
    console.log(`Executing ${wasmPath}...`);

    const wasmBuffer = fs.readFileSync(wasmPath);

    let output = [];

    let memory;

    let stringHeapPtr = 524288; // Start string heap at 512KB

    const writeString = (ptr, str) => {
        if (!memory) return;
        const bytes = new Uint8Array(memory.buffer);
        const uint32 = new Uint32Array(memory.buffer);

        // Header
        uint32[ptr / 4] = 0; // RefCount
        uint32[ptr / 4 + 1] = str.length; // Length

        // Data
        for (let i = 0; i < str.length; i++) {
            bytes[ptr + 8 + i] = str.charCodeAt(i);
        }
        bytes[ptr + 8 + str.length] = 0; // Null terminator
    };

    const allocString = (str) => {
        const ptr = stringHeapPtr;
        // 8 (header) + length + 1 (null)
        const size = 8 + str.length + 1;
        stringHeapPtr = (stringHeapPtr + size + 3) & ~3; // Align to 4 bytes
        writeString(ptr, str);
        return ptr;
    };

    const readString = (ptr) => {
        if (!memory || ptr === 0) return "";
        if (ptr % 4 !== 0) {
            console.error(`[JS ERROR] Unaligned string pointer: ${ptr}`);
        }
        const bytes = new Uint8Array(memory.buffer);
        const uint32 = new Uint32Array(memory.buffer);

        // Header: RefCount=4, Length=4
        const length = uint32[ptr / 4 + 1];

        let str = "";
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(bytes[ptr + 8 + i]);
        }
        return str;
    };

    let nextId = 1;
    const entities = new Set();
    const surfaces = new Map();

    const envBase = {
        PrintInt: (val) => {
            console.log(`[WASM] ${val}`);
            output.push(val.toString());
        },
        PrintFloat: (val) => {
            console.log(`[WASM] ${val}`);
            output.push(val.toString());
        },
        PrintString: (ptr) => {
            const str = readString(ptr);
            console.log(`[WASM] ${str}`);
            output.push(str);
        },
        StringConcat: (ptr1, ptr2) => {
            const s1 = readString(ptr1);
            const s2 = readString(ptr2);
            return allocString(s1 + s2);
        },
        IntToString: (val) => {
            return allocString(val.toString());
        },
        FloatToString: (val) => {
            return allocString(val.toString());
        },
        Handle: (ptr) => ptr,
        Object: (ptr) => ptr,
        MilliSecs: () => Date.now(),
        MilliCSecs: () => Date.now(),
        Rnd: (min, max) => Math.random() * (max - min) + min,
        Rand: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        RuntimeError: (ptr) => {
            const msg = readString(ptr);
            console.error(`RUNTIME ERROR: ${msg}`);
            process.exit(1);
        },
        CreateMesh: () => {
            const id = nextId++;
            entities.add(id);
            return id;
        },
        CreateSurface: (mesh) => {
            const id = nextId++;
            surfaces.set(id, { vertices: 0, triangles: 0 });
            return id;
        },
        AddVertex: (surf) => {
            const s = surfaces.get(surf);
            if (s) return s.vertices++;
            return 0;
        },
        AddTriangle: (surf) => {
            const s = surfaces.get(surf);
            if (s) return s.triangles++;
            return 0;
        },
        CountVertices: (surf) => {
            const s = surfaces.get(surf);
            return s ? s.vertices : 0;
        },
        CountTriangles: (surf) => {
            const s = surfaces.get(surf);
            return s ? s.triangles : 0;
        },
        CreatePivot: () => {
            const id = nextId++;
            entities.add(id);
            return id;
        }
    };

    const env = new Proxy(envBase, {
        get: (target, prop) => {
            if (prop in target) {
                return target[prop];
            }
            // console.warn(`[JS WARNING] Missing Blitz3D command: ${prop}, returning no-op`);
            return (...args) => {
                console.log(`[JS DEBUG] Call to MISSING command: ${prop}(${args.join(', ')})`);
                return 0;
            };
        }
    });

    const imports = { env };

    try {
        const { instance } = await WebAssembly.instantiate(wasmBuffer, imports);
        memory = instance.exports.memory || instance.exports.mem;

        if (!memory) {
            console.error("[JS ERROR] No memory export found!");
        }
        if (instance.exports._start) {
            console.log("Calling _start...");
            instance.exports._start();
        } else if (instance.exports.Main) {
            console.log("Calling Main...");
            instance.exports.Main();
        } else if (instance.exports.main) {
            console.log("Calling main...");
            instance.exports.main();
        } else {
            // Find any exported function that looks like a main function
            const mainFunc = Object.keys(instance.exports).find(name =>
                name.toLowerCase() === 'main' || name.toLowerCase() === '_main'
            );
            if (mainFunc) {
                console.log(`Calling ${mainFunc}...`);
                instance.exports[mainFunc]();
            } else {
                console.warn("No Main function found. Available exports:", Object.keys(instance.exports).filter(k => typeof instance.exports[k] === 'function'));
            }
        }
    } catch (err) {
        console.error("Execution failed:", err);
    }

    return output;
}

const wasmFile = process.argv[2];
if (wasmFile) {
    runWasm(wasmFile).then(output => {
        console.log("\nExecution complete.");
    });
} else {
    console.error("Usage: node execute_wasm.js <path_to_wasm>");
}
