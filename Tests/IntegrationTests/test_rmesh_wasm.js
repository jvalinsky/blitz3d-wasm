/**
 * Integration test for RMesh loading via WASM
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const blitz3dWasmDir = path.join(__dirname, "../..");
const scpcbDir = path.join(blitz3dWasmDir, "..", "scpcb");
const testBbFile = path.join(__dirname, "TestRMesh.bb");
const testWasmFile = path.join(__dirname, "TestRMesh.wasm");

function compileToWasm() {
  const compilerPath = path.join(
    blitz3dWasmDir,
    ".build/arm64-apple-macosx/debug/blitz3d-wasm",
  );

  if (!fs.existsSync(compilerPath)) {
    console.error(`Compiler not found at: ${compilerPath}`);
    process.exit(1);
  }

  console.log("Compiling TestRMesh.bb to WASM...");
  try {
    execSync(`"${compilerPath}" "${testBbFile}" -o "${testWasmFile}"`, {
      cwd: blitz3dWasmDir,
      stdio: "inherit",
    });
    console.log("Compilation successful!\n");
  } catch (err) {
    console.error("Compilation failed:", err.message);
    process.exit(1);
  }
}

async function runWasm() {
  console.log(`Executing ${testWasmFile}...\n`);

  if (!fs.existsSync(testWasmFile)) {
    console.error(`WASM file not found: ${testWasmFile}`);
    process.exit(1);
  }

  const wasmBuffer = fs.readFileSync(testWasmFile);
  let memory = null;
  let stringHeapPtr = 524288;

  const writeString = (ptr, str) => {
    if (!memory) return;
    const bytes = new Uint8Array(memory.buffer);
    const uint32 = new Uint32Array(memory.buffer);
    uint32[ptr / 4] = 0;
    uint32[ptr / 4 + 1] = str.length;
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
    const length = bytes[ptr + 4] | (bytes[ptr + 5] << 8) |
      (bytes[ptr + 6] << 16) | (bytes[ptr + 7] << 24);
    if (length > 10000 || length < 0) {
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

  const openFiles = new Map();
  let nextFileId = 1;

  const envBase = {
    PrintString: (ptr) => {
      const str = readString(ptr);
      console.log(`[WASM] ${str}`);
    },
    PrintInt: (val) => {
      console.log(`[WASM] ${val}`);
    },
    Graphics3D: () => 1,
    MilliCSecs: () => Date.now(),
    CreateCamera: () => 1,
    CreateMesh: () => {
      const meshId = nextMeshId++;
      meshes.set(meshId, { surfaces: [] });
      console.log(`[CreateMesh] meshId=${meshId}`);
      return meshId;
    },
    CreateSurface: (meshId) => {
      const mesh = meshes.get(meshId);
      if (!mesh) return 0;
      const surfId = nextSurfaceId++;
      mesh.surfaces.push(surfId);
      surfaces.set(surfId, { meshId, vertexCount: 0, triangleCount: 0 });
      console.log(`[CreateSurface] surfId=${surfId} for meshId=${meshId}`);
      return surfId;
    },
    AddVertex: (surfId, x, y, z) => {
      const surf = surfaces.get(surfId);
      if (!surf) return -1;
      const idx = surf.vertexCount;
      surf.vertexCount++;
      return idx;
    },
    AddTriangle: (surfId, v0, v1, v2) => {
      const surf = surfaces.get(surfId);
      if (!surf) return;
      surf.triangleCount++;
    },
    CountSurfaces: (meshId) => {
      const mesh = meshes.get(meshId);
      if (!mesh) return 0;
      return mesh.surfaces.length;
    },
    GetSurface: (meshId, index) => {
      const mesh = meshes.get(meshId);
      if (!mesh) return 0;
      const idx = index - 1;
      if (idx < 0 || idx >= mesh.surfaces.length) return 0;
      return mesh.surfaces[idx];
    },
    CountVertices: (surfId) => {
      const surf = surfaces.get(surfId);
      if (!surf) return 0;
      return surf.vertexCount;
    },
    CountTriangles: (surfId) => {
      const surf = surfaces.get(surfId);
      if (!surf) return 0;
      return surf.triangleCount;
    },
    FreeEntity: (entityId) => {
      const entity = meshes.get(entityId);
      if (entity) {
        if (entity.surfaces) {
          for (const surfId of entity.surfaces) {
            surfaces.delete(surfId);
          }
        }
        meshes.delete(entityId);
        console.log(`[FreeEntity] Freed entity ${entityId}`);
      }
    },
    ReadFile: (pathPtr) => {
      const filePath = readString(pathPtr);
      const fullPath = path.join(scpcbDir, filePath);
      console.log(`[ReadFile] "${filePath}" -> ${fullPath}`);
      try {
        const fileData = fs.readFileSync(fullPath);
        const fileId = nextFileId++;
        openFiles.set(fileId, { data: fileData, offset: 0 });
        console.log(
          `[ReadFile] Opened: fileId=${fileId}, size=${fileData.length}`,
        );
        return fileId;
      } catch (err) {
        console.error(`[ReadFile] Failed: ${err.message}`);
        return 0;
      }
    },
    CloseFile: (fileId) => {
      console.log(`[CloseFile] fileId=${fileId}`);
      openFiles.delete(fileId);
    },
    ReadByte: (fileId) => {
      const file = openFiles.get(fileId);
      if (!file || file.offset >= file.data.length) return 0;
      return file.data[file.offset++];
    },
    ReadInt: (fileId) => {
      const file = openFiles.get(fileId);
      if (!file || file.offset + 4 > file.data.length) return 0;
      const val = new DataView(file.data.buffer).getInt32(file.offset, true);
      file.offset += 4;
      return val;
    },
    ReadFloat: (fileId) => {
      const file = openFiles.get(fileId);
      if (!file || file.offset + 4 > file.data.length) return 0;
      const val = new DataView(file.data.buffer).getFloat32(file.offset, true);
      file.offset += 4;
      return val;
    },
    ReadString: (fileId) => {
      const file = openFiles.get(fileId);
      if (!file) return allocString("");
      if (file.offset + 4 > file.data.length) return allocString("");
      const len = new DataView(file.data.buffer).getInt32(file.offset, true);
      file.offset += 4;
      if (len < 0 || file.offset + len > file.data.length) {
        return allocString("");
      }
      let str = "";
      for (let i = 0; i < len; i++) {
        str += String.fromCharCode(file.data[file.offset++]);
      }
      return allocString(str);
    },
    StringConcat: (ptr1, ptr2) =>
      allocString(readString(ptr1) + readString(ptr2)),
    IntToString: (val) => allocString(val.toString()),
    FloatToString: (val) => allocString(val.toString()),
    Len: (strPtr) => {
      if (!memory || strPtr === 0) return 0;
      // B3D string length is at offset 4
      const len = new DataView(memory.buffer).getInt32(strPtr + 4, true);
      return len;
    },
    Instr: (str1, str2, start) => {
      const s1 = readString(str1);
      const s2 = readString(str2);
      const idx = s1.indexOf(s2, (start || 1) - 1);
      return idx + 1;
    },
    Trim: (str) => allocString(readString(str).trim()),
    LTrim: (str) => allocString(readString(str).trimStart()),
    RTrim: (str) => allocString(readString(str).trimEnd()),
    Upper: (str) => allocString(readString(str).toUpperCase()),
    Lower: (str) => allocString(readString(str).toLowerCase()),
    Replace: (str, oldStr, newStr) =>
      allocString(
        readString(str).split(readString(oldStr)).join(readString(newStr)),
      ),
    Rnd: () => Math.random(),
    Rand: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    Chr: (code) => allocString(String.fromCharCode(code)),
  };

  const env = new Proxy(envBase, {
    get: (target, prop) => {
      if (prop === "ReadFile") {
        console.log(`[ENV-PROXY] Getting ReadFile`);
      }
      if (prop in target) {
        return target[prop];
      }
      if (typeof prop === "string" && /^[a-zA-Z]/.test(prop)) {
        return () => {
          if (
            prop.toLowerCase().includes("create") ||
            prop.toLowerCase().includes("load") ||
            prop.toLowerCase().includes("get")
          ) {
            return 0;
          }
          return 0;
        };
      }
      return undefined;
    },
  });

  const meshes = new Map();
  const surfaces = new Map();
  let nextMeshId = 1;
  let nextSurfaceId = 1;

  const blitz3dBase = {
    CreateBank: () => 0,
    FreeBank: () => {},
    BankSize: () => 0,
    PeekByte: () => 0,
    PokeByte: () => {},
    PeekInt: () => 0,
    PokeInt: () => {},
    PeekFloat: () => 0.0,
    PokeFloat: () => {},
    PeekShort: () => 0,
    PokeShort: () => {},
    ParseB3D: () => 0,
    ParseRMesh: () => 0,
    GetMeshSurfaceCount: () => 0,
    GetSurfaceVertexCount: () => 0,
    GetSurfaceIndexCount: () => 0,
    GetSurfaceVerticesPtr: () => 0,
    GetSurfaceIndicesPtr: () => 0,
  };

  const blitz3d = new Proxy(blitz3dBase, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      return () => 0;
    },
  });

  const alBase = {
    alInit: () => 0,
    alGetAvailableDeviceCount: () => 0,
    alGetAvailableDeviceName: () => 0,
    alDeviceInit: () => 0,
    alGetNumSources: () => 0,
    alDestroy: () => {},
    alUpdate: () => {},
    alListenerSetPosition: () => {},
    alListenerSetDirection: () => {},
    alListenerSetUp: () => {},
    alListenerSetVelocity: () => {},
    alListenerSetMasterVolume: () => {},
    alCreateBuffer: () => 0,
    alFreeBuffer: () => {},
    alCreateSource: () => 0,
    alCreateSource_: () => 0,
    alFreeSource: () => {},
    alSourcePlay: () => 0,
    alSourcePlay_: () => 0,
    alSourcePlay2D: () => 0,
    alSourcePlay2D_: () => 0,
    alSourcePlay3D: () => 0,
    alSourcePlay3D_: () => 0,
    alSourcePause: () => {},
    alSourceResume: () => {},
    alSourceStop: () => {},
    alSourceIsPlaying: () => 0,
    alSourceIsPaused: () => 0,
    alSourceIsStopped: () => 0,
    alSourceSetVolume: () => {},
    alSourceSetPitch: () => {},
    alSourceSetPan: () => {},
    alSourceSetPosition: () => {},
    alSourceSetVelocity: () => {},
    alSourceSetLooping: () => {},
    alSourceSetRange: () => {},
  };

  const al = new Proxy(alBase, {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      return () => 0;
    },
  });

  try {
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {
      env,
      blitz3d,
      al,
    });

    memory = instance.exports.memory || instance.exports.mem ||
      instance.exports.Memory;

    if (!memory) {
      console.log("[WARN] No memory export found");
    } else {
      console.log("[INFO] Memory found:", memory.buffer.byteLength, "bytes");
    }

    const mainFunc = instance.exports._start || instance.exports.Main ||
      instance.exports.main || instance.exports.bb_Main;

    if (mainFunc) {
      console.log("Calling main function...\n");
      mainFunc();
    } else {
      const exports = Object.keys(instance.exports).filter((k) =>
        typeof instance.exports[k] === "function"
      );
      console.error("No main function found. Available exports:", exports);
      process.exit(1);
    }
  } catch (err) {
    console.error("\nExecution failed:", err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

async function main() {
  console.log("=== RMesh WASM Integration Test ===\n");

  compileToWasm();
  await runWasm();

  console.log("\n=== Test Complete ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
