/**
 * Integration test for StrictLoads.bb mesh loading via WASM
 *
 * This test:
 * 1. Compiles TestStrictLoads.bb (which includes StrictLoads.bb) to WASM
 * 2. Implements LoadMesh import using B3D parsing
 * 3. Implements FileType to check file existence
 * 4. Implements mesh query functions (CountSurfaces, GetSurface, etc.)
 * 5. Executes WASM and captures output
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Path configuration
const blitz3dWasmDir = path.join(__dirname, '../..');
const scpcbDir = path.join(blitz3dWasmDir, '..', 'scpcb');
const modulesDir = path.join(blitz3dWasmDir, 'Sources/Runtime/modules');
const testBbFile = path.join(__dirname, 'TestStrictLoads.bb');
const testWasmFile = path.join(__dirname, 'TestStrictLoads.wasm');

// Compile the .bb file to WASM
function compileToWasm() {
    const compilerPath = path.join(blitz3dWasmDir, '.build/arm64-apple-macosx/debug/blitz3d-wasm');

    if (!fs.existsSync(compilerPath)) {
        console.error(`Compiler not found at: ${compilerPath}`);
        console.error('Please build the compiler first with: swift build');
        process.exit(1);
    }

    console.log('Compiling TestStrictLoads.bb to WASM...');
    try {
        execSync(`"${compilerPath}" "${testBbFile}" -o "${testWasmFile}"`, {
            cwd: blitz3dWasmDir,
            stdio: 'inherit'
        });
        console.log('Compilation successful!\n');
    } catch (err) {
        console.error('Compilation failed:', err.message);
        process.exit(1);
    }
}

// Simple B3D parser for Node.js (extracts mesh data without Three.js)
class SimpleB3DParser {
    constructor(data) {
        this.data = data;
        this.offset = 0;
        this.meshes = [];
    }

    parse() {
        // Check header
        const header = String.fromCharCode(
            this.data[0], this.data[1], this.data[2], this.data[3]
        );

        if (header !== 'BB3D') {
            throw new Error(`Invalid B3D header: expected "BB3D", got "${header}"`);
        }

        this.offset = 4;

        // Check for file size field
        const fileSizeCheck = this.readInt32LE();
        const remainingSize = this.data.length - this.offset;

        if (fileSizeCheck !== remainingSize && fileSizeCheck !== remainingSize + 4) {
            // Not a file size field, treat as version
            this.offset -= 4;
        }

        // Read version
        const version = this.readInt32LE();

        // Parse chunks
        while (this.offset + 8 <= this.data.length) {
            const chunkId = this.readInt32BE();
            const chunkSize = this.readInt32LE();
            const chunkStart = this.offset;

            const chunkName = String.fromCharCode(
                (chunkId >> 24) & 0xff,
                (chunkId >> 16) & 0xff,
                (chunkId >> 8) & 0xff,
                chunkId & 0xff
            );

            if (chunkName === 'NODE') {
                this.parseNode(chunkSize);
            } else if (chunkName === 'MESH') {
                this.parseMesh(chunkSize);
            }

            this.offset = chunkStart + chunkSize;
        }

        return { meshes: this.meshes };
    }

    parseNode(chunkSize) {
        const endOffset = this.offset + chunkSize;

        // Read name
        this.readNullTerminatedString();

        // Skip transform data if present (position, scale, rotation)
        // These are variable, so we'll scan for sub-chunks

        while (this.offset + 8 <= endOffset) {
            // Check if next bytes look like a chunk ID
            const nextByte = this.data[this.offset];

            // Try to read as sub-chunk
            if (this.offset + 8 <= endOffset) {
                const subChunkId = this.readInt32BE();
                const subChunkSize = this.readInt32LE();
                const subChunkStart = this.offset;

                const subChunkName = String.fromCharCode(
                    (subChunkId >> 24) & 0xff,
                    (subChunkId >> 16) & 0xff,
                    (subChunkId >> 8) & 0xff,
                    subChunkId & 0xff
                );

                if (subChunkName === 'MESH') {
                    this.parseMesh(subChunkSize);
                } else if (subChunkName === 'NODE') {
                    this.parseNode(subChunkSize);
                }

                this.offset = subChunkStart + subChunkSize;
            }
        }
    }

    parseMesh(chunkSize) {
        const endOffset = this.offset + chunkSize;

        const mesh = {
            vertices: [],
            triangles: [],
            vertexCount: 0,
            triangleCount: 0
        };

        // Skip optional mesh ID (0xffffffff)
        if (this.offset + 4 <= endOffset) {
            const maybeId = this.peekInt32LE();
            if (maybeId === -1) {
                this.offset += 4;
            }
        }

        // Parse sub-chunks
        while (this.offset + 8 <= endOffset) {
            const subChunkId = this.readInt32BE();
            const subChunkSize = this.readInt32LE();
            const subChunkStart = this.offset;

            const subChunkName = String.fromCharCode(
                (subChunkId >> 24) & 0xff,
                (subChunkId >> 16) & 0xff,
                (subChunkId >> 8) & 0xff,
                subChunkId & 0xff
            );

            if (subChunkName === 'VRTS') {
                this.parseVertices(mesh, subChunkSize);
            } else if (subChunkName === 'TRIS') {
                this.parseTriangles(mesh, subChunkSize);
            }

            this.offset = subChunkStart + subChunkSize;
        }

        this.meshes.push(mesh);
    }

    parseVertices(mesh, chunkSize) {
        const endOffset = this.offset + chunkSize;

        const flags = this.readInt32LE();
        const texCoordSets = this.readInt32LE();
        const texCoordSize = this.readInt32LE();

        const hasNormals = flags & 1;
        const hasColors = flags & 2;

        while (this.offset + 12 <= endOffset) {
            // Position (always present)
            const x = this.readFloat32();
            const y = this.readFloat32();
            const z = this.readFloat32();
            mesh.vertices.push({ x, y, z });

            // Normals
            if (hasNormals && this.offset + 12 <= endOffset) {
                this.offset += 12; // Skip nx, ny, nz
            }

            // Colors
            if (hasColors && this.offset + 4 <= endOffset) {
                this.offset += 4; // Skip RGBA
            }

            // Texture coords
            for (let tc = 0; tc < texCoordSets && tc < 2; tc++) {
                if (this.offset + 8 <= endOffset) {
                    this.offset += 8; // Skip u, v
                }
            }
        }

        mesh.vertexCount = mesh.vertices.length;
    }

    parseTriangles(mesh, chunkSize) {
        const endOffset = this.offset + chunkSize;

        // Brush index
        this.readInt32LE();

        while (this.offset + 12 <= endOffset) {
            const v0 = this.readInt32LE();
            const v1 = this.readInt32LE();
            const v2 = this.readInt32LE();
            mesh.triangles.push({ v0, v1, v2 });
        }

        mesh.triangleCount = mesh.triangles.length;
    }

    readInt32LE() {
        const val = this.data[this.offset] |
               (this.data[this.offset + 1] << 8) |
               (this.data[this.offset + 2] << 16) |
               (this.data[this.offset + 3] << 24);
        this.offset += 4;
        return val;
    }

    readInt32BE() {
        const val = (this.data[this.offset] << 24) |
               (this.data[this.offset + 1] << 16) |
               (this.data[this.offset + 2] << 8) |
               this.data[this.offset + 3];
        this.offset += 4;
        return val;
    }

    peekInt32LE() {
        return this.data[this.offset] |
               (this.data[this.offset + 1] << 8) |
               (this.data[this.offset + 2] << 16) |
               (this.data[this.offset + 3] << 24);
    }

    readFloat32() {
        const view = new DataView(this.data.buffer, this.data.byteOffset + this.offset, 4);
        const val = view.getFloat32(0, true);
        this.offset += 4;
        return val;
    }

    readNullTerminatedString() {
        let str = '';
        while (this.offset < this.data.length && this.data[this.offset] !== 0) {
            str += String.fromCharCode(this.data[this.offset++]);
        }
        this.offset++;
        return str;
    }
}

// Run the WASM test
async function runWasm() {
    console.log(`Executing ${testWasmFile}...\n`);

    if (!fs.existsSync(testWasmFile)) {
        console.error(`WASM file not found: ${testWasmFile}`);
        process.exit(1);
    }

    const wasmBuffer = fs.readFileSync(testWasmFile);

    let output = [];
    let memory = null; // Will be set after instantiation

    let stringHeapPtr = 524288; // Start string heap at 512KB

    // String handling utilities
    const writeString = (ptr, str) => {
        if (!memory) return;
        const bytes = new Uint8Array(memory.buffer);
        const uint32 = new Uint32Array(memory.buffer);

        // Header: RefCount=4, Length=4
        uint32[ptr / 4] = 0;
        uint32[ptr / 4 + 1] = str.length;

        // Data
        for (let i = 0; i < str.length; i++) {
            bytes[ptr + 8 + i] = str.charCodeAt(i);
        }
        bytes[ptr + 8 + str.length] = 0;
    };

    const allocString = (str) => {
        const ptr = stringHeapPtr;
        const size = 8 + str.length + 1;
        stringHeapPtr = (stringHeapPtr + size + 3) & ~3;
        writeString(ptr, str);
        return ptr;
    };

    const readString = (ptr) => {
        if (!memory || ptr === 0) return "";
        const bytes = new Uint8Array(memory.buffer);

        // Debug: check what's at the pointer
        if (ptr < 1000) {
            console.log(`[readString] ptr=${ptr}, first 20 bytes: ${Array.from(bytes.slice(ptr, ptr + 20)).join(', ')}`);
        }

        // Read length as little-endian 32-bit int from bytes (handles unaligned access)
        const length = bytes[ptr + 4] |
                      (bytes[ptr + 5] << 8) |
                      (bytes[ptr + 6] << 16) |
                      (bytes[ptr + 7] << 24);

        // If length is unreasonable, try null-terminated string
        if (length > 10000 || length < 0) {
            console.log(`[readString] Invalid length ${length} at ptr ${ptr}, trying null-terminated`);
            let str = "";
            for (let i = 0; i < 1000 && bytes[ptr + i] !== 0; i++) {
                str += String.fromCharCode(bytes[ptr + i]);
            }
            return str;
        }

        let str = "";
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(bytes[ptr + 8 + i]);
        }
        return str;
    };

    // Entity/mesh tracking
    let nextId = 1;
    const entities = new Map();  // id -> { type, data }
    const surfaces = new Map();  // id -> { mesh, surfaceIndex, vertices, triangles }

    // Environment imports
    const env = {
        // String operations
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
            return allocString(readString(ptr1) + readString(ptr2));
        },
        IntToString: (val) => {
            return allocString(val.toString());
        },
        FloatToString: (val) => {
            return allocString(val.toString());
        },

        // Basic runtime
        MilliSecs: () => Date.now() & 0x7fffffff,
        RuntimeError: (ptr) => {
            const msg = readString(ptr);
            console.error(`[RUNTIME ERROR] ${msg}`);
            throw new Error(`RuntimeError: ${msg}`);
        },
        DebugLog: (ptr) => {
            const msg = readString(ptr);
            console.log(`[DEBUG] ${msg}`);
        },

        // File operations
        FileType: (pathPtr) => {
            const filePath = readString(pathPtr);
            // Resolve path relative to scpcb directory
            const fullPath = path.join(scpcbDir, filePath);

            try {
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) return 1;
                if (stat.isDirectory()) return 2;
                return 0;
            } catch (e) {
                return 0;
            }
        },

        // Graphics3D initialization
        Graphics3D: (width, height, depth, mode) => {
            console.log(`[WASM] Graphics3D(${width}, ${height}, ${depth}, ${mode})`);
            return 1;
        },

        // Mesh loading - THE KEY FUNCTION
        LoadMesh: (pathPtr, parent) => {
            console.log(`[LoadMesh] pathPtr=${pathPtr}, parent=${parent}`);
            const filePath = readString(pathPtr);
            console.log(`[LoadMesh] filePath="${filePath}"`);
            const fullPath = path.join(scpcbDir, filePath);

            console.log(`[LoadMesh] Loading: ${fullPath}`);

            try {
                const fileData = fs.readFileSync(fullPath);
                const parser = new SimpleB3DParser(fileData);
                const result = parser.parse();

                if (result.meshes.length === 0) {
                    console.error(`[LoadMesh] No meshes found in ${filePath}`);
                    return 0;
                }

                // Create mesh entity
                const meshId = nextId++;
                const meshData = {
                    type: 'mesh',
                    surfaces: []
                };

                // Create surfaces from parsed meshes
                for (let i = 0; i < result.meshes.length; i++) {
                    const parsedMesh = result.meshes[i];
                    const surfId = nextId++;

                    surfaces.set(surfId, {
                        meshId: meshId,
                        surfaceIndex: i,
                        vertexCount: parsedMesh.vertexCount,
                        triangleCount: parsedMesh.triangleCount
                    });

                    meshData.surfaces.push(surfId);
                }

                entities.set(meshId, meshData);

                console.log(`[LoadMesh] Created mesh ${meshId} with ${meshData.surfaces.length} surface(s)`);
                return meshId;
            } catch (err) {
                console.error(`[LoadMesh] Error loading ${filePath}:`, err.message);
                return 0;
            }
        },

        // Mesh query functions
        CountSurfaces: (meshId) => {
            const entity = entities.get(meshId);
            if (!entity || entity.type !== 'mesh') {
                console.warn(`[CountSurfaces] Invalid mesh ID: ${meshId}`);
                return 0;
            }
            return entity.surfaces.length;
        },

        GetSurface: (meshId, index) => {
            const entity = entities.get(meshId);
            if (!entity || entity.type !== 'mesh') {
                console.warn(`[GetSurface] Invalid mesh ID: ${meshId}`);
                return 0;
            }
            // Blitz3D uses 1-based indexing for surfaces
            const surfIndex = index - 1;
            if (surfIndex < 0 || surfIndex >= entity.surfaces.length) {
                console.warn(`[GetSurface] Invalid surface index: ${index}`);
                return 0;
            }
            return entity.surfaces[surfIndex];
        },

        CountVertices: (surfId) => {
            const surface = surfaces.get(surfId);
            if (!surface) {
                console.warn(`[CountVertices] Invalid surface ID: ${surfId}`);
                return 0;
            }
            return surface.vertexCount;
        },

        CountTriangles: (surfId) => {
            const surface = surfaces.get(surfId);
            if (!surface) {
                console.warn(`[CountTriangles] Invalid surface ID: ${surfId}`);
                return 0;
            }
            return surface.triangleCount;
        },

        // Entity management
        FreeEntity: (entityId) => {
            const entity = entities.get(entityId);
            if (entity) {
                // Clean up surfaces
                if (entity.surfaces) {
                    for (const surfId of entity.surfaces) {
                        surfaces.delete(surfId);
                    }
                }
                entities.delete(entityId);
                console.log(`[FreeEntity] Freed entity ${entityId}`);
            }
        },

        // Stubs for functions that might be called
        Handle: (ptr) => ptr,
        Object: (ptr) => ptr,
        Rnd: (min, max) => Math.random() * (max - min) + min,
        Rand: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

        // Stub sound functions (from StrictLoads.bb)
        LoadSound: (pathPtr) => 0,
        FreeSound: (handle) => {},
        PlaySound: (handle) => 0,
        ChannelPlaying: (channel) => 0,
        ChannelVolume: (channel, volume) => {},

        // FMOD stubs
        FSOUND_Stream_Open: (pathPtr, mode, offset) => 0,
        FSOUND_Stream_Play: (channel, stream) => 0,
        FSOUND_Stream_Stop: (stream) => {},
        FSOUND_Stream_Close: (stream) => {},
        FSOUND_SetVolume: (channel, volume) => {},
        FSOUND_SetPaused: (channel, paused) => {},
        FSOUND_StopSound: (channel) => {},
        FSOUND_IsPlaying: (channel) => 0,
        FSOUND_SetPan: (channel, pan) => {},

        // 3D functions
        EntityDistance: (ent1, ent2) => 0,
        DeltaYaw: (ent1, ent2) => 0,
        Sin: (angle) => Math.sin(angle * Math.PI / 180),
        Cos: (angle) => Math.cos(angle * Math.PI / 180),
        Max: (a, b) => Math.max(a, b),
        Min: (a, b) => Math.min(a, b),
        Int: (val) => Math.floor(val),
        Chr: (code) => allocString(String.fromCharCode(code))
    };

    // Blitz3D module imports (bank/parsing functions)
    const blitz3d = {
        CreateBank: (size) => {
            console.log(`[blitz3d.CreateBank] size=${size}`);
            return 0;
        },
        FreeBank: (bank) => {},
        BankSize: (bank) => 0,
        PeekByte: (bank, offset) => 0,
        PokeByte: (bank, offset, value) => {},
        PeekInt: (bank, offset) => 0,
        PokeInt: (bank, offset, value) => {},
        PeekFloat: (bank, offset) => 0.0,
        PokeFloat: (bank, offset, value) => {},
        PeekShort: (bank, offset) => 0,
        PokeShort: (bank, offset, value) => {},
        ParseB3D: (bank) => 0,
        ParseRMesh: (bank) => 0,
        GetMeshSurfaceCount: (mesh) => 0,
        GetSurfaceVertexCount: (mesh, surfIdx) => 0,
        GetSurfaceIndexCount: (mesh, surfIdx) => 0,
        GetSurfaceVerticesPtr: (mesh, surfIdx) => 0,
        GetSurfaceIndicesPtr: (mesh, surfIdx) => 0
    };

    // Proxy to catch missing functions
    const createProxy = (target, moduleName) => new Proxy(target, {
        get: (t, prop) => {
            if (prop in t) {
                return t[prop];
            }
            return (...args) => {
                console.log(`[MISSING ${moduleName}] ${prop}(${args.map(a => typeof a === 'number' ? a : '?').join(', ')})`);
                return 0;
            };
        }
    });

    // OpenAL module imports (audio functions - stubs)
    const al = {
        alInit: () => 0,
        alGetAvailableDeviceCount: () => 0,
        alGetAvailableDeviceName: (idx) => 0,
        alDeviceInit: (name, freq, rate) => 0,
        alGetNumSources: () => 0,
        alDestroy: () => {},
        alUpdate: () => {},
        alListenerSetPosition: (x, y, z) => {},
        alListenerSetDirection: (x, y, z) => {},
        alListenerSetUp: (x, y, z) => {},
        alListenerSetVelocity: (x, y, z) => {},
        alListenerSetMasterVolume: (vol) => {},
        alCreateBuffer: (data, size) => 0,
        alFreeBuffer: (buf) => {},
        alCreateSource: (buf, loop, rate) => 0,
        alCreateSource_: (buf, loop, rate) => 0,
        alFreeSource: (src) => {},
        alSourcePlay: (src, buf) => 0,
        alSourcePlay_: (src, buf) => 0,
        alSourcePlay2D: (src, buf) => 0,
        alSourcePlay2D_: (src, buf) => 0,
        alSourcePlay3D: (src, buf) => 0,
        alSourcePlay3D_: (src, buf) => 0,
        alSourcePause: (src) => {},
        alSourceResume: (src) => {},
        alSourceStop: (src) => {},
        alSourceIsPlaying: (src) => 0,
        alSourceIsPaused: (src) => 0,
        alSourceIsStopped: (src) => 0,
        alSourceSetVolume: (src, vol) => {},
        alSourceSetPitch: (src, pitch) => {},
        alSourceSetPan: (src, pan) => {},
        alSourceSetPosition: (src, x, y, z) => {},
        alSourceSetVelocity: (src, x, y, z) => {},
        alSourceSetLooping: (src, loop) => {},
        alSourceSetRange: (src, range) => {}
    };

    const envProxy = createProxy(env, 'env');
    const blitz3dProxy = createProxy(blitz3d, 'blitz3d');
    const alProxy = createProxy(al, 'al');

    try {
        const { instance } = await WebAssembly.instantiate(wasmBuffer, {
            env: envProxy,
            blitz3d: blitz3dProxy,
            al: alProxy
        });

        // Try to get memory from exports (various possible names)
        memory = instance.exports.memory ||
                 instance.exports.mem ||
                 instance.exports.__memory ||
                 instance.exports.Memory;

        if (!memory) {
            console.log("[WARN] No memory export found, string operations may fail");
            console.log("Available exports:", Object.keys(instance.exports).filter(k => !k.startsWith('_')).slice(0, 20));
        } else {
            console.log("[INFO] Memory found:", memory.buffer.byteLength, "bytes");
        }

        // Find and call main function
        const mainFunc = instance.exports._start ||
                        instance.exports.Main ||
                        instance.exports.main ||
                        instance.exports.bb_Main;

        if (mainFunc) {
            console.log("Calling main function...\n");
            mainFunc();
        } else {
            const exports = Object.keys(instance.exports).filter(k => typeof instance.exports[k] === 'function');
            console.error("No main function found. Available exports:", exports);
            process.exit(1);
        }
    } catch (err) {
        console.error("\nExecution failed:", err.message);
        if (err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    }

    return output;
}

// Main execution
async function main() {
    console.log("=== StrictLoads WASM Integration Test ===\n");

    // Step 1: Compile
    compileToWasm();

    // Step 2: Run
    const output = await runWasm();

    console.log("\n=== Test Complete ===");
    console.log("Captured output:", output);
}

main().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
