# Web Deployment Plan: SCPCB Browser Execution

**Created**: 2026-02-01  
**Status**: Ready for Approval  
**Goal**: Deploy fully functional SCP: Containment Breach to web browsers  
**Estimated Time**: 2-3 days of focused work

---

## Executive Summary

Based on SwiftWasm porting analysis (Grade A+, 95/100), the project is **exceptionally ready** for web deployment. With 378 functions implemented, zero missing functions for SCPCB, and proper WASM-first architecture, the remaining work is primarily **integration, not refactoring**.

### Current State
- ✅ Swift Compiler: 94.7% SCPCB success (54/57 files), 772KB WASM output
- ✅ Swift Engine: 378 functions (50% Blitz3D coverage), ~8,700 lines
- ✅ TypeScript Runtime: ~12K lines with command buffer system
- ✅ JavaScriptKit: Integrated with proper conditional compilation
- ✅ WASM Readiness: A+ grade, zero incompatible frameworks

### What Needs to Happen
1. Build Swift engine to WASM (1 hour setup + build)
2. Integrate engine WASM with TypeScript runtime (2-3 hours)
3. Test SCPCB in browser with full rendering/input/audio (4-5 hours)

---

## Phase 1: SwiftWasm Toolchain Setup (1-2 hours)

### Task 1.1: Install SwiftWasm Toolchain (30 minutes)

**Objective**: Get SwiftWasm toolchain installed and verified

**Steps**:
1. Download SwiftWasm 6.0+ toolchain
   - URL: https://github.com/swiftwasm/swift/releases
   - Choose: `swift-wasm-6.0-RELEASE-macos_arm64.pkg` (for M-series Mac)
   - Or: `swift-wasm-6.0-RELEASE-macos_x86_64.pkg` (for Intel Mac)

2. Install to toolchains directory:
   ```bash
   # Installer will place in:
   # ~/Library/Developer/Toolchains/swift-wasm-6.0.0-RELEASE.xctoolchain/
   ```

3. Verify installation:
   ```bash
   export TOOLCHAINS=swift-wasm-6.0.0-RELEASE
   swift --version
   # Should show: Swift version 6.0 (swiftwasm...)
   ```

**Success Criteria**:
- SwiftWasm toolchain responds to `swift --version`
- Shows WebAssembly target support

**Risks**: None - straightforward installation

---

### Task 1.2: Build Swift Engine to WASM (30 minutes)

**Objective**: Compile Blitz3DEngine to WebAssembly

**Steps**:
1. Set environment variables:
   ```bash
   cd /Users/jack/Software/scp_port/blitz3d-wasm
   export TOOLCHAINS=swift-wasm-6.0.0-RELEASE
   ```

2. Build engine target:
   ```bash
   swift build --triple wasm32-unknown-wasi \
     --target Blitz3DEngine \
     -c release \
     -Xlinker --export-all \
     -Xlinker --no-entry
   ```

3. Verify WASM output:
   ```bash
   file .build/wasm32-unknown-wasi/release/libBlitz3DEngine.a
   # Should show: current ar archive or WebAssembly binary
   
   # Extract WASM if in archive
   ar x .build/wasm32-unknown-wasi/release/libBlitz3DEngine.a
   # Or find the .wasm file in build artifacts
   ```

4. Validate with wabt:
   ```bash
   wasm-validate engine.wasm
   wasm-objdump -x engine.wasm | head -50
   ```

**Success Criteria**:
- WASM file generated successfully
- `wasm-validate` passes
- Exported functions visible in `wasm-objdump` output
- File size reasonable (~500KB-2MB for engine)

**Alternative Approach**: Use existing `deno.json` task if already configured:
```bash
deno task engine:build
# Check deno.json line 8 for current build command
```

**Risks**: 
- Build errors due to WASM-specific issues (Low - code already has proper `#if arch(wasm32)`)
- JavaScriptKit import issues (Low - properly conditionally imported)

---

## Phase 2: Runtime Integration (2-3 hours)

### Task 2.1: Connect Engine WASM to TypeScript Runtime (1 hour)

**Objective**: Load Swift engine WASM and wire up basic function calls

**Approach**: Use existing worker infrastructure in `web/src/worker/scpcb_worker.ts`

**Steps**:
1. Copy engine WASM to web directory:
   ```bash
   cp .build/wasm32-unknown-wasi/release/engine.wasm web/public/engine.wasm
   ```

2. Create engine loader module:
   ```typescript
   // web/src/runtime/engine_loader.ts
   
   export async function loadEngineWASM(wasmPath: string) {
     const response = await fetch(wasmPath);
     const buffer = await response.arrayBuffer();
     
     // Create imports object with stub functions
     const imports = {
       env: {
         // Memory will be imported
         memory: new WebAssembly.Memory({ initial: 256, maximum: 512 })
       },
       wasi_snapshot_preview1: {
         // WASI stubs (proc_exit, fd_write, etc.)
         proc_exit: (code: number) => console.log('proc_exit', code),
         fd_write: () => 0,
         // Add other WASI functions as needed
       }
     };
     
     const { instance } = await WebAssembly.instantiate(buffer, imports);
     return instance.exports;
   }
   ```

3. Test basic function calls:
   ```typescript
   // Test in browser console or test file
   const engine = await loadEngineWASM('/engine.wasm');
   
   // Test system queries
   const vram = engine.AvailVidMem();
   console.log('Detected VRAM:', vram, 'MB');
   
   const totalMem = engine.TotalVidMem();
   console.log('Total VRAM:', totalMem, 'MB');
   ```

**Success Criteria**:
- Engine WASM loads without errors
- Basic functions callable from TypeScript
- AvailVidMem returns realistic GPU-based estimates (not hardcoded 512)
- No import/export mismatches

**Files to Review**:
- `web/src/worker/scpcb_worker.ts` - Existing WASM loader pattern
- `web/src/shared/path_alias.ts` - VFS path resolution

---

### Task 2.2: Wire Up File I/O to VFS (1 hour)

**Objective**: Connect Swift FileIOManager to TypeScript virtual filesystem

**Approach**: Map Swift file functions to existing VFS

**Steps**:
1. Implement file I/O imports for WASM:
   ```typescript
   // In engine imports object
   const fileOperations = {
     // Called from Swift FileIOManager
     vfs_read_file: (pathPtr: number, pathLen: number): number => {
       const path = readString(memory, pathPtr, pathLen);
       const data = vfs.readFile(path);
       return storeDataInMemory(memory, data);
     },
     
     vfs_write_file: (pathPtr: number, dataPtr: number, dataLen: number): number => {
       const path = readString(memory, pathPtr);
       const data = readBytes(memory, dataPtr, dataLen);
       vfs.writeFile(path, data);
       return 1; // Success
     },
     
     vfs_file_exists: (pathPtr: number): number => {
       const path = readString(memory, pathPtr);
       return vfs.exists(path) ? 1 : 0;
     }
   };
   
   imports.env = { ...imports.env, ...fileOperations };
   ```

2. Test file operations:
   ```typescript
   // Preload test file
   vfs.writeFile('/test.txt', 'Hello from VFS');
   
   // Call Swift file read function
   const handle = engine.ReadFile('/test.txt');
   const line = engine.ReadLine(handle);
   engine.CloseFile(handle);
   
   console.log('Read from VFS:', line);
   ```

3. Connect to manifest system:
   ```typescript
   // Load scpcb_manifest.json
   const manifest = await fetch('/scpcb_manifest.json').then(r => r.json());
   
   // Preload facility_assets group
   for (const file of manifest.groups.facility_assets) {
     const data = await fetch(`/${file}`).then(r => r.arrayBuffer());
     vfs.writeFile(file, new Uint8Array(data));
   }
   ```

**Success Criteria**:
- Swift engine can read files from VFS
- File handles work correctly (open/read/close cycle)
- SCPCB assets (options.ini, etc.) accessible from Swift
- No path resolution errors

**Files to Review**:
- `web/scpcb_manifest.json` - Asset grouping
- `Sources/Blitz3DEngine/FileIO/FileManager.swift` - File I/O abstraction

---

### Task 2.3: Test Command Buffer Communication (30 minutes)

**Objective**: Verify WASM → TypeScript communication via command buffer

**Approach**: Use existing command buffer system documented in `docs/COMMAND_BUFFER_SYSTEM.md`

**Steps**:
1. Review command buffer protocol:
   ```typescript
   // Command buffer format (from docs/COMMAND_BUFFER_SYSTEM.md)
   // [command_id: u16][param_count: u8][...params]
   ```

2. Implement command buffer polling:
   ```typescript
   function processCmdBuffer(engine: any, memory: WebAssembly.Memory) {
     const bufferPtr = engine.get_cmdbuf_ptr();
     const bufferLen = engine.get_cmdbuf_len();
     
     const view = new DataView(memory.buffer);
     let offset = bufferPtr;
     
     while (offset < bufferPtr + bufferLen) {
       const cmdId = view.getUint16(offset, true);
       if (cmdId === 0) break; // End marker
       
       offset += 2;
       const paramCount = view.getUint8(offset++);
       
       // Execute command
       executeCommand(cmdId, view, offset, paramCount);
       offset += paramCount * 4; // Assume 4 bytes per param
     }
     
     // Clear buffer
     engine.clear_cmdbuf();
   }
   ```

3. Test basic rendering command:
   ```typescript
   // Swift calls: CreateSphere, EntityColor, etc.
   // These should populate command buffer
   // TypeScript reads buffer and executes Three.js operations
   
   engine.Graphics3D(800, 600);
   const sphere = engine.CreateSphere();
   engine.EntityColor(sphere, 255, 0, 0);
   
   processCmdBuffer(engine, memory);
   // Should see red sphere in Three.js scene
   ```

**Success Criteria**:
- Command buffer reads/writes work
- Basic graphics commands execute
- No buffer overflow or corruption
- Commands process in correct order

---

## Phase 3: Full SCPCB Integration (4-5 hours)

### Task 3.1: Load Game WASM (30 minutes)

**Objective**: Load compiled SCPCB Main.bb WASM and initialize

**Steps**:
1. Compile SCPCB with current command:
   ```bash
   deno task scpcb:compile:main
   # Or manually:
   .build/release/blitz3d-wasm /Users/jack/Software/scp_port/scpcb/Main.bb \
     -o web/public/scpcb.wasm
   ```

2. Verify WASM output:
   ```bash
   ls -lh web/public/scpcb.wasm
   # Should be ~772KB as reported
   
   wasm-validate web/public/scpcb.wasm
   ```

3. Load in worker:
   ```typescript
   // In scpcb_worker.ts
   const gameWASM = await loadWASM('/scpcb.wasm', {
     env: engineExports, // Import all 378 engine functions
     blitz3d: engineExports // Aliased module name
   });
   
   // Call Main() function
   gameWASM.Main();
   ```

**Success Criteria**:
- SCPCB WASM loads successfully
- All 666 imports resolve to engine functions
- Main() function callable
- No import/export mismatches

---

### Task 3.2: Render Pipeline Integration (2 hours)

**Objective**: Connect rendering commands to Three.js

**Approach**: Execute command buffer commands as Three.js operations

**Steps**:
1. Implement core rendering commands:
   ```typescript
   // web/src/runtime/command_executor.ts
   
   const commandHandlers = {
     CMD_GRAPHICS3D: (width, height) => {
       renderer.setSize(width, height);
       scene = new THREE.Scene();
       camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
     },
     
     CMD_CREATE_SPHERE: (handle, segments) => {
       const geometry = new THREE.SphereGeometry(1, segments, segments);
       const material = new THREE.MeshBasicMaterial();
       const mesh = new THREE.Mesh(geometry, material);
       entityMap.set(handle, mesh);
       scene.add(mesh);
       return handle;
     },
     
     CMD_ENTITY_COLOR: (handle, r, g, b) => {
       const entity = entityMap.get(handle);
       if (entity) {
         entity.material.color.setRGB(r/255, g/255, b/255);
       }
     },
     
     CMD_POSITION_ENTITY: (handle, x, y, z) => {
       const entity = entityMap.get(handle);
       if (entity) {
         entity.position.set(x, y, z);
       }
     },
     
     CMD_RENDER_WORLD: () => {
       renderer.render(scene, camera);
     }
   };
   ```

2. Process command buffer each frame:
   ```typescript
   function gameLoop() {
     // Step WASM (executes game logic)
     gameWASM.GameLoop(); // Or Main() if blocking
     
     // Process commands
     processCmdBuffer(engine, memory);
     
     // Continue loop
     requestAnimationFrame(gameLoop);
   }
   ```

3. Test with simple scene:
   - Create sphere
   - Set color
   - Position camera
   - Render world
   - Verify sphere visible in canvas

**Success Criteria**:
- Basic primitives render (sphere, cube, mesh)
- Entity transformations work (position, rotation, scale)
- Camera movement functional
- Scene updates at reasonable framerate (30+ FPS)

**Files to Review**:
- `web/src/runtime/graphics.ts` - Existing Three.js integration (~3.7K lines)
- `docs/COMMAND_BUFFER_SYSTEM.md` - Command protocol

---

### Task 3.3: Input System Integration (1 hour)

**Objective**: Wire keyboard/mouse to Swift engine

**Steps**:
1. Capture browser events:
   ```typescript
   // web/src/runtime/input.ts
   
   const keyStates = new Set<string>();
   const mouseState = { x: 0, y: 0, buttons: 0 };
   
   document.addEventListener('keydown', (e) => {
     keyStates.add(e.code);
     engine.InjectKeyDown(getKeyCode(e.code));
   });
   
   document.addEventListener('keyup', (e) => {
     keyStates.delete(e.code);
     engine.InjectKeyUp(getKeyCode(e.code));
   });
   
   document.addEventListener('mousemove', (e) => {
     mouseState.x = e.clientX;
     mouseState.y = e.clientY;
     engine.InjectMouseMove(e.clientX, e.clientY);
   });
   ```

2. Implement Swift input functions:
   ```swift
   // In InputExports.swift (or new InputInjection.swift)
   
   private var keyDownSet: Set<Int32> = []
   private var keyHitSet: Set<Int32> = []
   
   @_cdecl("InjectKeyDown")
   public func InjectKeyDown(_ keyCode: Int32) {
       keyDownSet.insert(keyCode)
       keyHitSet.insert(keyCode)
   }
   
   @_cdecl("KeyDown")
   public func KeyDown(_ keyCode: Int32) -> Int32 {
       return keyDownSet.contains(keyCode) ? 1 : 0
   }
   
   @_cdecl("KeyHit")
   public func KeyHit(_ keyCode: Int32) -> Int32 {
       if keyHitSet.contains(keyCode) {
           keyHitSet.remove(keyCode)
           return 1
       }
       return 0
   }
   ```

3. Test input:
   - Press keys, verify KeyDown() returns 1
   - Move mouse, verify MouseX/MouseY update
   - Click mouse, verify MouseDown() returns 1

**Success Criteria**:
- All keyboard keys detectable
- Mouse movement tracked accurately
- Mouse buttons work
- No input lag (< 16ms response time)

---

### Task 3.4: Audio System Integration (1 hour)

**Objective**: Enable sound playback via Web Audio API

**Steps**:
1. Create Web Audio context:
   ```typescript
   // web/src/runtime/audio.ts
   
   const audioContext = new AudioContext();
   const soundBuffers = new Map<number, AudioBuffer>();
   const activeSources = new Map<number, AudioBufferSourceNode>();
   
   async function loadSound(url: string): Promise<AudioBuffer> {
     const response = await fetch(url);
     const arrayBuffer = await response.arrayBuffer();
     return await audioContext.decodeAudioData(arrayBuffer);
   }
   ```

2. Implement Swift audio imports:
   ```typescript
   const audioImports = {
     audio_load_sound: async (pathPtr: number): Promise<number> => {
       const path = readString(memory, pathPtr);
       const buffer = await loadSound(path);
       const handle = nextAudioHandle++;
       soundBuffers.set(handle, buffer);
       return handle;
     },
     
     audio_play_sound: (soundHandle: number): number => {
       const buffer = soundBuffers.get(soundHandle);
       if (!buffer) return 0;
       
       const source = audioContext.createBufferSource();
       source.buffer = buffer;
       source.connect(audioContext.destination);
       source.start(0);
       
       const channelHandle = nextChannelHandle++;
       activeSources.set(channelHandle, source);
       return channelHandle;
     }
   };
   ```

3. Test audio:
   - Load sound file
   - Play sound
   - Verify audio plays in browser
   - Test volume, pan controls

**Success Criteria**:
- Sounds load without errors
- Audio plays on user interaction (browser policy)
- Multiple sounds can play simultaneously
- No audio crackling or distortion

**Note**: Browser autoplay policy requires user interaction before audio plays. First sound should trigger on click/keypress.

---

## Phase 4: Testing & Polish (Optional, ongoing)

### Task 4.1: Performance Profiling

**Objective**: Ensure smooth 60 FPS gameplay

**Tools**:
- Chrome DevTools Performance tab
- `performance.now()` for frame timing
- WASM profiling tools

**Metrics to Track**:
- Frame time: < 16ms (60 FPS target)
- WASM execution time: < 10ms per frame
- Command buffer processing: < 2ms per frame
- Render time: < 4ms per frame

### Task 4.2: Memory Leak Detection

**Objective**: Verify no memory leaks over time

**Existing Tools**:
```bash
deno task memleak:scpcb:churn
```

**What to Check**:
- Memory usage stable over 1000+ frames
- No unbounded growth in entityMap
- Texture/mesh disposal working
- Command buffer clearing correctly

### Task 4.3: Browser Compatibility

**Test on**:
- Chrome/Chromium (primary)
- Firefox
- Safari (if accessible)

**Known Differences**:
- `navigator.deviceMemory` not in Firefox/Safari
- `performance.memory` Chrome-only

### Task 4.4: Error Handling

**Add graceful degradation**:
- WebGL not available
- Audio context blocked by policy
- WASM not supported (old browsers)
- Network errors loading assets

---

## Success Criteria (Overall)

### Must Have (MVP)
- [x] SCPCB compiles to WASM (Already done: 772KB)
- [ ] Swift engine compiles to WASM
- [ ] Engine WASM loads in browser
- [ ] Basic rendering works (sphere, cube visible)
- [ ] Keyboard input functional
- [ ] Game menu renders and responds to input
- [ ] Can navigate SCPCB main menu

### Should Have (Beta)
- [ ] Full rendering pipeline (rooms, NPCs, items)
- [ ] Mouse look functional
- [ ] Audio playback works
- [ ] File I/O for saves/config
- [ ] Stable 30+ FPS in typical rooms
- [ ] No memory leaks over 10 minutes

### Nice to Have (Polish)
- [ ] 60 FPS in most scenarios
- [ ] Full graphics options working
- [ ] Multiplayer support (if applicable)
- [ ] Mobile browser support
- [ ] Loading screen with progress bar

---

## Risk Assessment

### High Confidence (Will Work)
- ✅ Engine compilation to WASM (A+ readiness)
- ✅ Basic function calls (proper exports/imports)
- ✅ File I/O abstraction (VFS-ready design)
- ✅ Rendering pipeline (existing Three.js code)

### Medium Confidence (May Need Iteration)
- ⚠️ Performance (WASM overhead unknown until tested)
- ⚠️ Command buffer efficiency (may need optimization)
- ⚠️ Browser compatibility (Safari, Firefox differences)
- ⚠️ Audio timing (Web Audio API quirks)

### Low Confidence (High Risk)
- ⚠️ Game loop blocking (SCPCB may have `While True` loops)
- ⚠️ Memory management (closure lifetimes in complex scenarios)
- ⚠️ Asset loading performance (large file counts)

### Mitigation Strategies

**For Blocking Loops**:
- Use Emscripten's asyncify (if needed)
- Restructure game loop to yield control
- Run in Web Worker (already architected)

**For Performance**:
- Profile early, optimize hotspots
- Implement LOD system for complex scenes
- Use asset streaming (don't preload everything)

**For Compatibility**:
- Feature detection, graceful degradation
- Provide fallbacks for missing APIs
- Test on multiple browsers early

---

## Timeline Estimate

### Day 1 (6-8 hours)
- Morning: SwiftWasm toolchain setup, engine build
- Afternoon: Runtime integration, basic function tests
- Evening: File I/O VFS hookup, command buffer testing

### Day 2 (6-8 hours)
- Morning: Load game WASM, render pipeline integration
- Afternoon: Input system, test menu navigation
- Evening: Audio system, test sound playback

### Day 3 (4-6 hours)
- Morning: Bug fixes, performance profiling
- Afternoon: Browser testing, error handling
- Evening: Polish, documentation, demo deployment

**Total**: 16-22 hours of focused development work

---

## Alternative Approaches Considered

### Approach A: Native Compiler (Rejected)
**Idea**: Keep Swift compiler running natively, only compile engine to WASM

**Pros**:
- Faster development iteration
- Easier debugging

**Cons**:
- Can't compile user code in browser
- Doesn't leverage existing web IDE work
- Splits architecture (compiler native, game WASM)

**Verdict**: Not chosen. Current approach (both compiler and engine to WASM) is cleaner.

### Approach B: BridgeJS for Type-Safe Bindings (Future)
**Idea**: Use BridgeJS to generate TypeScript definitions from Swift

**Pros**:
- Type-safe Swift-JavaScript interop
- Automatic `.d.ts` generation
- Better IDE support

**Cons**:
- Additional tooling complexity
- Experimental (API may change)
- Not needed for MVP

**Verdict**: Consider for post-MVP to improve maintainability.

### Approach C: Full JavaScript Rewrite (Rejected)
**Idea**: Port entire engine to JavaScript/TypeScript

**Pros**:
- No WASM complexity
- Direct browser API access

**Cons**:
- Months of work
- Lose performance benefits of WASM
- Have to maintain two codebases

**Verdict**: Not viable. WASM approach is correct.

---

## Open Questions for User

None at this time. Plan is comprehensive and ready for execution.

If issues arise during implementation, will use SwiftWasm skills for guidance:
- `swiftwasm-javascriptkit` - Browser API patterns
- `swiftwasm-porting` - Compatibility issues
- `swiftwasm-bridgejs` - Type-safe bindings (if needed later)

---

## Next Actions

1. **User Approval**: Review and approve this plan
2. **Execute Phase 1**: Install SwiftWasm, build engine
3. **Document Progress**: Update plan with completion timestamps
4. **Iterate**: Adjust timeline based on actual task durations

**Ready to proceed when approved!** 🚀
