# Roadmap to 100% SCP:CB Running in Browser

**Goal**: Compile all SCPCB files to WASM and run the game in a browser with full functionality.

**Current State**: 
- [DONE] 100% compilation rate (36/36 files compile without crashes)
- [TODO] ~450 WASM validation errors across 7 files
- [TODO] Parser bug causes missing functions/globals
- [STUB] Runtime ~70% complete (425+ functions, but some stubs)
- [TODO] Browser integration not yet tested

---

## Phase 1: Fix Critical Compiler Bugs (BLOCKING)

### 1.1 Parser Bug: Missing Functions/Globals (HIGH PRIORITY)  4-6 hours

**Problem**: Parser processes entire file but only finds 1/28 functions, 16/23 globals in Menu.bb
**Root Cause**: `parseFunction()` doesn't correctly identify `End Function` boundary
**Impact**: Blocks all other work - can't test runtime without valid WASM

**Tasks**:
1. **Investigate parseFunction() body parsing** (1h)
   - Add logging to track token consumption
   - Find where `End Function` detection fails
   - Check if function body parser is consuming too many tokens

2. **Fix function boundary detection** (2h)
   - Ensure `parseFunction()` stops at `End Function`
   - Verify currentToken position after parsing
   - Handle edge cases (nested functions, empty functions)

3. **Implement resilient top-level parsing** (1h)
   - Make `parseTopLevelStatement()` never return nil except EOF
   - Add synchronization for error recovery (Approach A + C from plan)
   - Skip malformed statements instead of stopping

4. **Test and validate** (1h)
   - Menu.bb: Should find 28 functions, 23 globals
   - Main.bb: Should find all globals
   - Run full test suite

5. **Clean up debug logging** (30min)
   - Keep essential warnings
   - Remove verbose diagnostics

**Success Criteria**:
- [DONE] All 28 functions found in Menu.bb
- [DONE] All 23 globals found in Menu.bb  
- [DONE] All SCPCB files parse completely
- [DONE] Zero parser-related errors

**Estimated Time**: 4-6 hours
**Priority**: [CRITICAL] CRITICAL - Blocks everything else

---

### 1.2 Optional Parameter Support (HIGH PRIORITY)  6-8 hours

**Problem**: 86 errors in Main.bb alone - functions with 2-4 parameter variants
**Examples**: 
- `EntityTexture(mesh, tex)` vs `EntityTexture(mesh, tex, frame, index)`
- `LoadMesh(file)` vs `LoadMesh(file, parent)`

**Current State**: Compiler doesn't support optional parameters at all

**Research Needed**:
- Check blitz3d-ng reference for how Blitz3D handles this
- Determine if it's true optional parameters or function overloading

**Tasks**:

1. **Research Blitz3D semantics** (1h)
   ```bash
   cd /Users/jack/Software/scp_port/reference/blitz3d-ng
   grep -r "optional.*param" src/tools/compiler/
   grep -r "default.*argument" src/tools/compiler/
   ```

2. **Design implementation** (1h)
   - AST changes: Add `defaultValue: ExpressionNode?` to parameter
   - Parser changes: Detect `= value` after parameter
   - CodeGen changes: Insert default values when argument missing

3. **Implement in Parser** (2h)
   - Update `parseParameter()` to handle default values
   - Store defaults in function signature
   - Validate default expressions are constants

4. **Implement in CodeGen** (2h)
   - Detect when call has fewer arguments than parameters
   - Insert default value expressions
   - Handle type conversions

5. **Test with real SCPCB code** (1h)
   - EntityTexture, LoadMesh, etc.
   - Verify WASM validates
   - Check generated code is correct

6. **Handle built-in functions** (1h)
   - Many Blitz3D built-ins have optional params
   - Update function registry
   - Add default values to signatures

**Success Criteria**:
- [DONE] Parser accepts `Function Foo(x%, y% = 10)`
- [DONE] Calls with missing args compile correctly
- [DONE] 86 call errors in Main.bb → 0
- [DONE] EntityTexture/LoadMesh work with variable arg counts

**Estimated Time**: 6-8 hours
**Priority**: [CRITICAL] HIGH - Affects 86 errors in Main.bb

---

### 1.3 Type Promotion Fixes (MEDIUM PRIORITY)  3-4 hours

**Problem**: 147 errors across Save.bb (96), UpdateEvents.bb (7), NPCs.bb (14)
**Pattern**: Float variables used in integer operations without conversion

**Root Cause**: Binary operations don't check actual operand types

**Tasks**:

1. **Fix binary operation type checking** (1h)
   - In `ExpressionGeneration.swift::generateBinaryOp()`
   - Actually check operand types from variable registry
   - Don't default to i32 blindly

2. **Insert type conversions automatically** (1h)
   - When operands are mixed (i32 + f32)
   - Promote to common type (Blitz3D rules)
   - Insert i32.convert_f32 or f32.convert_i32

3. **Fix comparison operators** (30min)
   - Same issue as binary ops
   - Need f32.gt vs i32.gt_s based on actual types

4. **Test on problem files** (30min)
   - Save.bb: 96 errors → 0
   - UpdateEvents.bb: 7 errors → 0
   - NPCs.bb: 14 type errors → 0

**Note**: Type conversion infrastructure already exists (from Session 4), just need to USE it correctly.

**Success Criteria**:
- [DONE] Float variables work in arithmetic
- [DONE] Mixed int/float expressions auto-convert
- [DONE] Save.bb validates (96 errors → 0)
- [DONE] All type-related errors eliminated

**Estimated Time**: 3-4 hours
**Priority**: [MEDIUM] MEDIUM - Affects 147 errors

---

### 1.4 Stack Balance Fixes (LOW PRIORITY)  2-3 hours

**Problem**: 3 errors across DevilParticleSystem.bb (1), MapSystem.bb (2)
**Pattern**: If branches leaving orphaned values (function calls as statements)

**Tasks**:

1. **Find orphaned values** (1h)
   - Use wasm2wat to find exact locations
   - Identify which function calls
   - Check if they're correctly generating .drop

2. **Fix function call cleanup** (1h)
   - Ensure function calls as statements drop return values
   - Check if branches properly balance
   - Verify calculateStackDelta() accuracy

3. **Test and validate** (30min)
   - DevilParticleSystem.bb: 1 error → 0
   - MapSystem.bb: 2 errors → 0

**Success Criteria**:
- [DONE] All if branches balanced
- [DONE] Function call return values properly dropped
- [DONE] Zero stack balance errors

**Estimated Time**: 2-3 hours
**Priority**: [LOW] LOW - Only 3 errors total

---

## Phase 2: Runtime Implementation (PARALLEL TRACK)

### 2.1 Runtime Function Audit  3-4 hours

**Current State**: 425+ functions (363 env, 18 blitz3d, 40+ al)
**Unknown**: Which functions are stubs vs fully implemented

**Tasks**:

1. **Audit runtime.js** (2h)
   ```bash
   cd /Users/jack/Software/scp_port/blitz3d-wasm/Runtime
   grep -c "TODO\|STUB\|not implemented" runtime.js
   ```
   - Count stubs
   - List critical missing functions
   - Prioritize by SCPCB usage frequency

2. **Check SCPCB function usage** (1h)
   ```bash
   cd /Users/jack/Software/scp_port/scpcb
   for func in CreateMesh LoadTexture PositionEntity; do
     echo "$func: $(grep -c $func *.bb) uses"
   done
   ```
   - Find most-used functions
   - Cross-reference with runtime

3. **Create implementation priority list** (30min)
   - Critical path: Graphics, input, file I/O
   - Nice to have: Audio, particles
   - Can defer: Advanced features

**Deliverable**: RUNTIME_AUDIT.md with:
- Complete function list
- Implementation status ([DONE] Done, [STUB] Stub, [TODO] Missing)
- Priority ranking
- Estimated hours per function

**Estimated Time**: 3-4 hours
**Priority**: [MEDIUM] MEDIUM - Can run in parallel with Phase 1

---

### 2.2 Core Runtime Functions  20-30 hours

**Critical for basic functionality**:

**Graphics (Blitz3D 3D Engine)** (10-12h):
- [DONE] CreateCamera, CameraRange (done)
- [STUB] CreateMesh, CreateSurface (need implementation)
- [STUB] LoadMesh, LoadTexture (need Three.js integration)
- [STUB] EntityTexture, EntityColor (need material system)
- [STUB] PositionEntity, RotateEntity, ScaleEntity (need transform system)
- [STUB] RenderWorld, UpdateWorld (main loop)

**File I/O** (4-5h):
- [STUB] OpenFile, CloseFile (virtual filesystem)
- [STUB] ReadInt, ReadFloat, ReadString
- [STUB] WriteInt, WriteFloat, WriteString
- [STUB] FileSize, FileType (directory support)

**Input** (3-4h):
- [STUB] KeyDown, KeyHit (keyboard)
- [STUB] MouseX, MouseY, MouseDown (mouse)
- [STUB] FlushKeys, FlushMouse

**String Functions** (2-3h):
- [DONE] Basic string ops (done)
- [STUB] Left, Right, Mid (substring)
- [STUB] Replace, Instr (search)
- [STUB] Chr, Asc (character conversion)

**Math** (1h):
- [DONE] Most done
- [STUB] Rand, Rnd (random - need proper seed)

**Estimated Time**: 20-30 hours
**Priority**: [CRITICAL] CRITICAL - Game can't run without these

---

### 2.3 Asset Loading System  6-8 hours

**Problem**: SCPCB assets are in ZIP files, need virtual filesystem

**Tasks**:

1. **ZIP File Support** (3h)
   - Use JSZip for browser
   - Implement Blitz_File_ZipApi.bb functions
   - Map ZlibWapi_* functions to JSZip API

2. **Virtual Filesystem** (2h)
   - In-memory file structure
   - Path resolution (/SCP-173/texture.png)
   - File handles and cursors

3. **Asset Loader** (1h)
   - Preload all ZIPs on startup
   - Extract to virtual FS
   - Progress bar for user

4. **Test with real assets** (1h)
   - Load GFX.zip, SFX.zip, etc.
   - Verify file access works
   - Check memory usage

**Success Criteria**:
- [DONE] Can load SCPCB ZIP files
- [DONE] ReadFile/WriteFile work with virtual paths
- [DONE] Three.js can load textures from virtual FS

**Estimated Time**: 6-8 hours
**Priority**: [CRITICAL] HIGH - Needed for textures/models/sounds

---

## Phase 3: Browser Integration  8-10 hours

### 3.1 WASM Loading and Initialization (3-4h)

**Tasks**:

1. **Create HTML wrapper** (1h)
   - Canvas for rendering
   - Input capture
   - Loading screen
   - Error display

2. **WASM instantiation** (1h)
   - Load .wasm file
   - Import runtime functions
   - Handle initialization
   - Error handling

3. **Memory management** (1h)
   - Allocate WASM linear memory
   - Handle growth
   - String passing (UTF-16 in Blitz3D)

4. **Test loading** (30min)
   - Load main.wasm in browser
   - Verify imports resolve
   - Check memory initialized

**Deliverable**: `index.html`, `loader.js`

**Estimated Time**: 3-4 hours

---

### 3.2 Three.js Graphics Integration (4-5h)

**Tasks**:

1. **Setup Three.js scene** (1h)
   - Scene, Camera, Renderer
   - WebGL context
   - Resize handling

2. **Entity system** (2h)
   - Map Blitz3D entities to Three.js objects
   - Handle hierarchy (parent/child)
   - Transform updates

3. **Mesh loading** (1h)
   - Parse .b3d/.rmesh formats
   - Create Three.js geometry
   - Handle materials/textures

4. **Render loop** (30min)
   - RequestAnimationFrame
   - Update WASM
   - Render scene

**Success Criteria**:
- [DONE] Can create meshes from WASM
- [DONE] Entities render in 3D
- [DONE] Camera movement works

**Estimated Time**: 4-5 hours

---

### 3.3 Input and Controls (1-2h)

**Tasks**:

1. **Keyboard mapping** (30min)
   - Capture key events
   - Map to Blitz3D key codes
   - Store state for KeyDown()

2. **Mouse handling** (30min)
   - Capture mouse movement
   - Calculate relative position
   - Handle clicks

3. **Pointer lock** (30min)
   - Request pointer lock for FPS controls
   - Handle escape to release

**Success Criteria**:
- [DONE] WASD movement works
- [DONE] Mouse look works
- [DONE] ESC menu works

**Estimated Time**: 1-2 hours

---

## Phase 4: Testing and Debugging  10-20 hours

### 4.1 Unit Testing (3-4h)

1. **Compiler tests** (1h)
   - Ensure all 36 files compile
   - Zero validation errors
   - Regression tests

2. **Runtime tests** (2h)
   - Test each function category
   - Mock WASM calls
   - Verify correct behavior

**Estimated Time**: 3-4 hours

---

### 4.2 Integration Testing (5-8h)

1. **Menu system** (2h)
   - Main menu loads
   - Options work
   - Load game works

2. **Basic gameplay** (3h)
   - Player spawns
   - Can move/look
   - Rooms load

3. **Game mechanics** (3h)
   - SCP entities spawn
   - Collisions work
   - Inventory functions

**Estimated Time**: 5-8 hours

---

### 4.3 Performance Optimization (5-10h)

1. **Profile bottlenecks** (2h)
   - Chrome DevTools
   - Identify slow functions
   - Memory leaks

2. **Optimize hot paths** (3h)
   - Reduce allocations
   - Cache calculations
   - WebAssembly.Table for indirect calls

3. **Asset optimization** (2h)
   - Compress textures
   - LOD meshes
   - Lazy loading

**Estimated Time**: 5-10 hours

---

## Phase 5: Polish and Release  5-10 hours

### 5.1 Error Handling (2-3h)

- Graceful failure
- Error messages
- Crash recovery
- Save game corruption handling

### 5.2 Loading and Saving (2-3h)

- Save to localStorage/IndexedDB
- Load saved games
- Autosave

### 5.3 UI Polish (2-3h)

- Loading screens
- Settings menu
- About/credits
- Controls help

### 5.4 Documentation (1-2h)

- README for players
- Build instructions
- Known issues
- Browser compatibility

**Estimated Time**: 5-10 hours

---

## Summary: Total Time Estimate

| Phase | Component | Time | Priority |
|-------|-----------|------|----------|
| **1** | **Compiler Bugs** | **15-21h** | **[CRITICAL] CRITICAL** |
| 1.1 | Parser bug | 4-6h | [CRITICAL] Blocks all |
| 1.2 | Optional params | 6-8h | [CRITICAL] 86 errors |
| 1.3 | Type promotion | 3-4h | [MEDIUM] 147 errors |
| 1.4 | Stack balance | 2-3h | [LOW] 3 errors |
| **2** | **Runtime** | **29-42h** | **[CRITICAL] CRITICAL** |
| 2.1 | Function audit | 3-4h | [MEDIUM] Planning |
| 2.2 | Core functions | 20-30h | [CRITICAL] Essential |
| 2.3 | Asset loading | 6-8h | [CRITICAL] Essential |
| **3** | **Browser Integration** | **8-10h** | **[CRITICAL] HIGH** |
| 3.1 | WASM loading | 3-4h | [CRITICAL] Required |
| 3.2 | Three.js integration | 4-5h | [CRITICAL] Required |
| 3.3 | Input/controls | 1-2h | [CRITICAL] Required |
| **4** | **Testing/Debug** | **10-20h** | **[MEDIUM] IMPORTANT** |
| 4.1 | Unit tests | 3-4h | [MEDIUM] Quality |
| 4.2 | Integration tests | 5-8h | [MEDIUM] Quality |
| 4.3 | Performance | 5-10h | [LOW] Nice-to-have |
| **5** | **Polish** | **5-10h** | **[LOW] OPTIONAL** |

**TOTAL ESTIMATED TIME: 67-103 hours** (8-13 working days)

---

## Critical Path (Minimum Viable Product)

To get a **working demo** (not full game):

1. **Fix parser bug** (4-6h) - Can't proceed without this
2. **Optional parameters** (6-8h) - Too many errors otherwise
3. **Type promotion** (3-4h) - Affects core gameplay
4. **Core graphics runtime** (10h) - Mesh, texture, entity basics
5. **File I/O** (4h) - Load assets
6. **Asset loading** (6h) - Get game data
7. **Browser integration** (8h) - Actually run in browser
8. **Basic testing** (5h) - Ensure it works

**MINIMUM TIME TO DEMO: 46-55 hours** (~6-7 working days)

---

## Recommended Approach

### Week 1: Compiler (3-4 days)
- Fix parser bug
- Implement optional parameters
- Fix type promotion
- All SCPCB files compile with zero errors

### Week 2: Runtime (4-5 days)
- Audit existing runtime
- Implement core graphics functions
- Build asset loading system
- Test with simple WASM programs

### Week 3: Integration (3-4 days)
- Browser WASM loading
- Three.js integration
- Input handling
- Get SCPCB menu displaying

### Week 4+: Testing and Polish
- Integration testing
- Bug fixes
- Performance optimization
- Documentation

---

## Dependencies and Blockers

**Hard Blockers** (Must fix before anything else):
1. [BLOCKING] Parser bug - Affects all subsequent work
2. [BLOCKING] Optional parameters - 86 errors in Main.bb alone

**Soft Blockers** (Can work around temporarily):
3. Type promotion - Can manually fix in source if needed
4. Stack balance - Only 3 errors, low impact

**Parallel Work Possible**:
- Runtime implementation CAN start while fixing compiler
- Asset system CAN be built independently
- Browser integration CAN be prototyped with stub WASM

---

## Risk Assessment

### High Risk
- **Parser bug complexity**: May be deeper than current hypothesis
  - *Mitigation*: Allocated extra time (4-6h), have multiple approaches
  
- **Optional parameters**: Might need major architecture changes
  - *Mitigation*: Research blitz3d-ng first, have fallback to function wrappers

- **Runtime completeness**: Unknown how many stubs exist
  - *Mitigation*: Audit first, prioritize by usage frequency

### Medium Risk
- **Three.js integration**: .b3d/.rmesh format parsing
  - *Mitigation*: Use existing Blitz3D mesh loaders as reference

- **Performance**: WASM may be slower than native
  - *Mitigation*: Profile early, optimize hot paths

### Low Risk
- **Browser compatibility**: WebAssembly well-supported
- **Asset loading**: JSZip is mature library

---

## Success Metrics

### Phase 1 Complete:
- [DONE] All 36 SCPCB files compile
- [DONE] Zero WASM validation errors
- [DONE] Test suite: 244/244 passing
- [DONE] Fixture tests: 47/47 passing

### Phase 2 Complete:
- [DONE] All critical runtime functions implemented
- [DONE] Can load SCPCB assets from ZIP
- [DONE] Basic 3D rendering works

### Phase 3 Complete:
- [DONE] Game runs in browser
- [DONE] Main menu displays
- [DONE] Can start new game
- [DONE] Basic movement works

### Phase 4 Complete:
- [DONE] Full gameplay functional
- [DONE] Save/load works
- [DONE] No critical bugs
- [DONE] Playable at 30+ FPS

---

## Next Immediate Actions (Today/Tomorrow)

1. **Finish parser bug fix** (continue from Phase 1.1)
   - Investigate `parseFunction()` body parsing
   - Find `End Function` boundary issue
   - Implement fix + test

2. **Update project memory** with new findings

3. **Commit parser fix** when complete

4. **Move to optional parameters** (Phase 1.2)

5. **Create RUNTIME_AUDIT.md** (can do in parallel)

---

## Questions to Answer

Before starting Phase 2, research:
1. How does blitz3d-ng handle optional parameters?
2. What's the actual format of .rmesh files?
3. Which Three.js version should we target?
4. Do we need SharedArrayBuffer for threading?

Before starting Phase 3:
1. What's the minimum WebAssembly browser version needed?
2. Should we use WebGL 1.0 or 2.0?
3. How much memory should we allocate?
4. Do we need WebAssembly SIMD?

---

## Long-Term Vision

**After initial release**:
- Multiplayer support (WebRTC)
- Mobile controls (touch)
- VR support (WebXR)
- Mod support (custom maps/entities)
- Debugging tools (WASM inspector)

---

## References

- Parser fix plan: `PARSER_BUG_FIX_PLAN.md`
- Test fixtures: `Tests/fixtures/`
- Current progress: `compile_test_report_*.txt`
- Runtime code: `blitz3d-wasm/Runtime/runtime.js`
- SCPCB source: `scpcb/*.bb` (38 files, 52K+ lines)
