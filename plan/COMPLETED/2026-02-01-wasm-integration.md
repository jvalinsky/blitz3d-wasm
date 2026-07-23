# WASM Integration Plan

_Created: February 1, 2026_

## Overview

We successfully compiled the Swift Blitz3D engine to WebAssembly (58MB). This
plan outlines the steps to integrate the WASM module with the existing
TypeScript runtime and get SCPCB running in the browser.

## Current State

✅ **Completed**:

- Swift 6.2.3 toolchain working (bypassed swiftly via system Swift symlink)
- Swift engine compiles to WASM
  (`.build/wasm32-unknown-wasip1/release/blitz3d-engine.wasm`)
- WASM validation passes
- 166 engine functions exported via `@_cdecl`
- Experimental `Extern` feature enabled for WASM imports

🔧 **Issues Fixed**:

- Nix environment `$DEVELOPER_DIR` interference
- JavaScriptKit optional unwrapping
- Package.swift executable target configuration
- Entry point naming (`main.swift`)

## Phase 1: WASM Loading & Initialization (4-6 hours)

### 1.1 Create WASM Loader Module

**File**: `web/src/runtime/wasm-loader.ts`

```typescript
import { instantiateWasm } from './wasm-bindings';

export async function loadBlitz3DEngine(wasmPath: string) {
    const response = await fetch(wasmPath);
    const wasmBytes = await response.arrayBuffer();
    
    const imports = {
        env: {
            // JavaScript functions WASM can import
            js_LoadSound: (pathPtr: number, flags: number) => { ... },
            js_PlaySound: (sound: number, volume: number, ...) => { ... },
            // ... all other js_* functions from AudioImports.swift, etc.
        }
    };
    
    const { instance, module } = await WebAssembly.instantiate(wasmBytes, imports);
    
    return {
        memory: instance.exports.memory as WebAssembly.Memory,
        exports: instance.exports,
        malloc: instance.exports.malloc as (size: number) => number,
        free: instance.exports.free as (ptr: number) => void,
        // All @_cdecl exported functions
        CreateBank: instance.exports.CreateBank as (size: number) => number,
        LoadMesh: instance.exports.LoadMesh as (pathPtr: number) => number,
        // ... etc
    };
}
```

**Tasks**:

- [ ] Create `wasm-loader.ts` skeleton
- [ ] Define TypeScript interface for all 166 engine exports
- [ ] Implement memory helpers (string marshaling, pointer handling)
- [ ] Test loading WASM module
- [ ] Verify memory allocation/deallocation works

### 1.2 String Marshaling

**Challenge**: Swift uses UTF-8 strings, JS uses UTF-16. Need to marshal between
WASM linear memory and JS strings.

```typescript
export class WasmStringHelper {
  constructor(
    private memory: WebAssembly.Memory,
    private malloc: (size: number) => number,
    private free: (ptr: number) => void,
  ) {}

  // JS string → WASM memory
  copyStringToWasm(str: string): number {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str + "\0"); // Null-terminated
    const ptr = this.malloc(bytes.length);
    const view = new Uint8Array(this.memory.buffer, ptr, bytes.length);
    view.set(bytes);
    return ptr;
  }

  // WASM memory → JS string
  readStringFromWasm(ptr: number): string {
    const view = new Uint8Array(this.memory.buffer);
    let end = ptr;
    while (view[end] !== 0) end++;
    const bytes = view.slice(ptr, end);
    return new TextDecoder().decode(bytes);
  }
}
```

**Tasks**:

- [ ] Implement `WasmStringHelper` class
- [ ] Test round-trip string marshaling
- [ ] Handle string lifecycle (when to free?)

### 1.3 Test Basic Function Calls

**Test Plan**:

1. Call `CreateBank(1024)` → verify returns handle
2. Call `BankSize(handle)` → verify returns 1024
3. Call `PokeByte(handle, 0, 42)` → verify writes
4. Call `PeekByte(handle, 0)` → verify reads 42
5. Call `FreeBank(handle)` → verify cleanup

**File**: `web/src/runtime/wasm-engine.test.ts`

```typescript
import { loadBlitz3DEngine } from "./wasm-loader";

Deno.test("WASM engine loads", async () => {
  const engine = await loadBlitz3DEngine("/path/to/blitz3d-engine.wasm");
  assertEquals(typeof engine.CreateBank, "function");
});

Deno.test("Bank operations work", async () => {
  const engine = await loadBlitz3DEngine("/path/to/blitz3d-engine.wasm");
  const handle = engine.CreateBank(1024);
  assertEquals(engine.BankSize(handle), 1024);
  engine.PokeByte(handle, 0, 42);
  assertEquals(engine.PeekByte(handle, 0), 42);
  engine.FreeBank(handle);
});
```

**Tasks**:

- [ ] Write unit tests for bank operations
- [ ] Test string functions (CreateString, GetStringPtr, FreeString)
- [ ] Test math functions (Sin, Cos, Sqrt)
- [ ] Verify no memory leaks in tests

## Phase 2: Command Buffer Integration (6-8 hours)

### 2.1 Wire WASM Exports to Command Buffer

**Current System**: TypeScript runtime processes command buffer written by...
WASM? Wait, this needs rethinking.

**Architecture Decision**: Two approaches:

**Option A: WASM Calls TypeScript** (via imports)

- Swift engine calls `js_LoadSound()`, `js_PlaySound()`, etc.
- TypeScript provides implementations via WASM imports
- No command buffer needed for Swift→JS calls
- **Simpler, more direct**

**Option B: Command Buffer** (existing system)

- Swift writes commands to shared memory buffer
- TypeScript polls and executes commands
- More complex but better for batching
- **Current system expects this**

**Recommendation**: **Option A** for Phase 2, migrate to Option B later if
needed.

### 2.2 Implement WASM Import Functions

Map all `js_*` functions from Swift imports to TypeScript implementations:

**File**: `web/src/runtime/wasm-imports.ts`

```typescript
import { GraphicsRuntime } from "./graphics";
import { AudioManager } from "./audio";
import { InputManager } from "./input";

export function createWasmImports(
  graphics: GraphicsRuntime,
  audio: AudioManager,
  input: InputManager,
  stringHelper: WasmStringHelper,
) {
  return {
    env: {
      // Audio imports (from AudioImports.swift)
      js_LoadSound: (pathPtr: number, flags: number): number => {
        const path = stringHelper.readStringFromWasm(pathPtr);
        return audio.loadSound(path, flags);
      },

      js_PlaySound: (
        sound: number,
        volume: number,
        pan: number,
        rate: number,
        loop: number,
      ): number => {
        return audio.playSound(sound, volume, pan, rate, loop !== 0);
      },

      js_FreeSound: (sound: number): void => {
        audio.freeSound(sound);
      },
      // Graphics imports (if any from WebAPIIntegration.swift)
      // Input imports (if any)
      // etc.
    },
  };
}
```

**Tasks**:

- [ ] Identify all `@_extern` imports in Swift engine
- [ ] Implement corresponding TypeScript functions
- [ ] Test each import function individually
- [ ] Handle error cases (null pointers, invalid handles)

### 2.3 Graphics Integration

**Challenge**: Swift engine expects to call Three.js operations. How?

**Current Graphics System**:

- `graphics.ts` (~3.7K lines) manages Three.js scene
- Entity handle system (Map<handle, Object3D>)
- Command buffer processes rendering commands

**New Integration**: Swift engine exports like `CreateMesh`, `LoadMesh`,
`PositionEntity` should be callable from compiled Blitz3D code, but they need to
call into TypeScript graphics runtime.

**Two-Way Communication**:

1. **Blitz3D code → Swift exports → TypeScript** (for rendering)
2. **TypeScript imports ← Swift engine ← Blitz3D code** (for browser APIs)

Example flow:

```
Blitz3D: mesh = LoadMesh("model.b3d")
  ↓
Swift Engine: LoadMesh() calls js_LoadMeshData(path) import
  ↓
TypeScript: Loads model, uploads to GPU, returns handle
  ↓
Swift Engine: Returns handle to Blitz3D
```

**Tasks**:

- [ ] Define `js_LoadMeshData`, `js_CreateMesh`, etc. imports
- [ ] Implement in TypeScript graphics runtime
- [ ] Test with simple mesh creation
- [ ] Verify GPU upload works

### 2.4 Asset Loading Bridge

**File I/O Challenge**: Swift engine has `LoadMesh`, `LoadTexture`, but they
need file data.

**Options**:

1. Swift calls `js_ReadFile(path)` → TypeScript fetches from VFS → returns bytes
2. Swift uses WASI file APIs → TypeScript VFS provides WASI polyfill
3. Preload all assets, Swift reads from WASM memory

**Recommendation**: Option 1 (simplest for now)

```typescript
env: {
  js_ReadFile: ((pathPtr: number, outLenPtr: number): number => {
    const path = stringHelper.readStringFromWasm(pathPtr);
    const data = vfs.readFile(path); // Uint8Array

    // Allocate WASM memory for file data
    const ptr = wasmEngine.malloc(data.length);
    const view = new Uint8Array(wasmEngine.memory.buffer, ptr, data.length);
    view.set(data);

    // Write length to output pointer
    const lenView = new Int32Array(wasmEngine.memory.buffer, outLenPtr, 1);
    lenView[0] = data.length;

    return ptr; // Caller must free()
  });
}
```

**Tasks**:

- [ ] Implement `js_ReadFile` import
- [ ] Test with VFS (virtual filesystem)
- [ ] Test with ZIP-loaded assets
- [ ] Handle missing files gracefully

## Phase 3: SCPCB Test Build (8-10 hours)

### 3.1 Compile SCPCB Main.bb to WASM

**Challenge**: The Swift **compiler** generates WASM that imports the Swift
**engine**. Both are WASM modules.

**Architecture**:

```
SCPCB Main.bb
  ↓
[Swift Compiler (native macOS)] Parses → AST → IR → WASM Codegen
  ↓
main_bb.wasm (imports: CreateMesh, LoadTexture, etc. from engine)
```

Then in browser:

```
1. Load blitz3d-engine.wasm → instance1
2. Load main_bb.wasm with imports from instance1.exports
3. Call main_bb.wasm's exported Main()
```

**Tasks**:

- [ ] Compile `Main.bb` with Swift compiler
- [ ] Examine generated WASM imports
- [ ] Verify imports match engine exports
- [ ] Create multi-WASM loader

### 3.2 Multi-WASM Module Loading

**File**: `web/src/runtime/multi-wasm-loader.ts`

```typescript
export async function loadGameWithEngine(
  enginePath: string,
  gamePath: string,
) {
  // Load engine first
  const engine = await loadBlitz3DEngine(enginePath);

  // Load game WASM, importing from engine
  const gameResponse = await fetch(gamePath);
  const gameBytes = await gameResponse.arrayBuffer();

  const gameImports = {
    env: {
      // Browser API imports (from js_* in engine)
      ...createWasmImports(graphics, audio, input, stringHelper),
    },
    blitz3d_engine: {
      // Engine function imports
      CreateMesh: engine.CreateMesh,
      LoadMesh: engine.LoadMesh,
      LoadTexture: engine.LoadTexture,
      PositionEntity: engine.PositionEntity,
      // ... all 166 engine exports
    },
  };

  const { instance: gameInstance } = await WebAssembly.instantiate(
    gameBytes,
    gameImports,
  );

  return {
    engine,
    game: gameInstance.exports,
    runGame: gameInstance.exports.Main as () => void,
  };
}
```

**Tasks**:

- [ ] Implement multi-module loader
- [ ] Handle import namespacing correctly
- [ ] Test with simple two-module setup
- [ ] Verify memory sharing works

### 3.3 SCPCB Initialization

**Challenges from `project/related/scpcb`**:

- Blocking UI loops (launcher)
- Synchronous file I/O expectations
- Init sequence requires "press any key" loop
- Uses `options.ini` very early in boot

**Adaptations Needed**:

- Short-circuit `Main()` to avoid blocking
- Preload `facility_assets` before init
- Synthetic key/mouse events for init
- URL flags for debugging (`?debug`, `?safe`, `?nogl=1`)

**Tasks**:

- [ ] Modify SCPCB Main.bb for web (create `Main.web.bb`?)
- [ ] Add non-blocking init mode
- [ ] Preload asset manifest
- [ ] Test init sequence
- [ ] Debug startup issues

### 3.4 Render Loop Integration

**SCPCB uses**:

```blitz3d
While True
    UpdateWorld
    RenderWorld
    Flip
Wend
```

**Problem**: Blocks forever in WASM!

**Solution**: Restructure to use requestAnimationFrame

**Options**:

1. Modify SCPCB to call `GameTick()` once per frame (invasive)
2. Use Asyncify to pause/resume WASM loop (complex)
3. Restructure compiler to emit RAF-friendly code (very complex)

**Recommendation**: Option 1 for now

```blitz3d
; Main.web.bb
Function GameTick()
    UpdateWorld()
    RenderWorld()
    Flip()
End Function

; Called from JavaScript via RAF
```

**Tasks**:

- [ ] Create web-friendly SCPCB entry point
- [ ] Implement RAF loop in TypeScript
- [ ] Test frame timing
- [ ] Verify no dropped frames

### 3.5 Debugging & Profiling

**Tools**:

- Chrome DevTools Performance tab
- WebAssembly debugging in browser
- `console.log` from WASM (via imports)

**Metrics to Track**:

- Frame time (target: 16.67ms for 60fps)
- WASM→JS call overhead
- Asset loading time
- Memory usage

**Tasks**:

- [ ] Add performance markers
- [ ] Profile typical gameplay
- [ ] Identify bottlenecks
- [ ] Optimize hot paths

## Testing Strategy

### Unit Tests

- Each WASM import function
- String marshaling
- Memory allocation/deallocation
- Handle lifecycle

### Integration Tests

- Load engine + game together
- Asset loading pipeline
- Render loop execution
- Input handling

### End-to-End Tests

- Full SCPCB startup
- Navigate menus
- Load facility
- Basic gameplay (walk around)

## Success Criteria

**Phase 1 Complete**:

- [ ] WASM engine loads in browser
- [ ] Can call basic functions (CreateBank, math, strings)
- [ ] No memory leaks in tests

**Phase 2 Complete**:

- [ ] All WASM imports implemented
- [ ] Graphics rendering works
- [ ] Audio playback works
- [ ] Input events propagate

**Phase 3 Complete**:

- [ ] SCPCB compiles to WASM
- [ ] Game loads in browser
- [ ] Renders main menu
- [ ] Can start new game
- [ ] Playable (30+ fps)

## Risks & Mitigation

### Risk: WASM Binary Too Large (58MB)

**Mitigation**:

- Strip debug symbols in release build
- Use wasm-opt for size optimization
- Lazy-load engine modules if possible

### Risk: Performance Too Slow

**Mitigation**:

- Profile early and often
- Use WebAssembly SIMD if needed
- Offload to Web Workers
- Consider WebGPU for rendering

### Risk: Memory Management Issues

**Mitigation**:

- Comprehensive leak testing
- Clear ownership rules for handles
- Use WeakMap for JS-side references
- Monitor heap growth

### Risk: Browser Compatibility

**Mitigation**:

- Test on Chrome, Firefox, Safari
- Polyfill missing APIs
- Feature detection and fallbacks
- Clear browser requirements

## Timeline Estimate

**Optimistic**: 18 hours (6 hours per phase) **Realistic**: 24 hours (8 hours
per phase)\
**Pessimistic**: 36 hours (12 hours per phase + debugging)

**Calendar**: 3-4 days of focused work

## Next Immediate Steps

1. Create `web/src/runtime/wasm-loader.ts`
2. Define TypeScript interfaces for all 166 exports
3. Implement `WasmStringHelper`
4. Write first test: load WASM and call `CreateBank()`
5. Verify test passes

---

**Document Status**: Living document, update as we progress **Last Updated**:
February 1, 2026
