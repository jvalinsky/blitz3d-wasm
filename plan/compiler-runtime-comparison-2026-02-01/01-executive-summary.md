# Executive Summary: Blitz3D Compiler & Runtime Analysis

**Date**: February 1, 2026\
**Analysis Scope**: Swift compiler + Swift engine vs Blitz3D-NG reference\
**Primary Goal**: Identify gaps preventing SCPCB from running in browser

---

## TL;DR

Our Swift-based Blitz3D→WASM compiler and runtime implementation has a **solid
architectural foundation** but is missing **critical functionality** needed for
SCPCB. The compiler has **good language coverage** but lacks include file
support. The runtime covers only **22% of Blitz3D-NG's functions**, with major
gaps in asset loading, file I/O, and math operations.

**Bottom Line**: Cannot run SCPCB without implementing include files, asset
loading, and core runtime functions.

---

## What We Have

### Swift Compiler ✅

- **Individual file compilation**: 94.7% success rate (54/57 SCPCB files)
- **Language features**: Most Blitz3D constructs supported
- **WASM generation**: 100% spec compliance
- **Code quality**: Clean architecture, good error handling
- **Relooper**: Correctly handles GOTO/GOSUB for WASM

### Swift Engine ✅

- **Scene graph**: 64% coverage (51/80 functions) - Strong foundation
- **Entity management**: Comprehensive transform/appearance/visibility support
- **Memory operations**: 37% coverage with bounds checking
- **Collision detection**: Basic collision queries, LinePick implemented
- **Architecture**: Clean modular design with singleton managers

### TypeScript Runtime 🤔

- **Status**: Not yet audited in this analysis
- **Potential**: May provide missing browser-specific functionality
- **Role**: Three.js rendering, Web Audio, asset loading via browser APIs

---

## What We're Missing

### 🔴 Critical (Blocking)

1. **Include File Support**
   - **Status**: Stubbed out in Swift compiler (Parser.swift:495-501)
   - **Impact**: SCPCB Main.bb uses 23 #Include statements
   - **Why Critical**: Individual files compile, but assembled game won't work
   - **Files Affected**: Items.bb, NPCs.bb, MapSystem.bb, Particles.bb, menu.bb,
     etc.

2. **Asset Loading Pipeline**
   - **Missing**: LoadMesh, LoadTexture, LoadImage (0 functions)
   - **Impact**: Cannot load game assets
   - **Why Critical**: SCPCB loads hundreds of models and textures

3. **File I/O Operations**
   - **Coverage**: 0/30 functions
   - **Missing**: All file read/write operations
   - **Impact**: Cannot read config files, save games, load data

4. **Math Library**
   - **Coverage**: 0/29 functions
   - **Missing**: Sin, Cos, Tan, Sqrt, Abs, Floor, Ceil, etc.
   - **Impact**: Cannot perform basic game calculations

5. **String Operations**
   - **Coverage**: 0/28 functions
   - **Missing**: Len, Mid, Left, Right, Replace, Instr, etc.
   - **Impact**: Cannot manipulate strings (UI, parsing, etc.)

### 🟠 Major (Limiting)

6. **Physics Engine**
   - **Coverage**: 15/100 functions (15%)
   - **Missing**: ODE integration, rigid body dynamics
   - **Impact**: Limited collision and physics simulation

7. **Audio System**
   - **Coverage**: 3/32 functions (9%)
   - **Missing**: Channel management, sound properties, 3D audio
   - **Impact**: Basic sound only, no music or advanced audio

8. **Graphics Pipeline**
   - **Coverage**: 44/150 functions (29%)
   - **Missing**: Geometric primitives (CreateCube, CreateSphere, etc.)
   - **Missing**: Display mode management, camera clipping
   - **Impact**: Limited rendering control

### 🟡 Moderate (Nice to Have)

9. **Animation System**
   - **Coverage**: 4/18 functions (22%)
   - **Missing**: Animation sequences, MD2 support
   - **Impact**: Basic animation only

10. **Input Devices**
    - **Coverage**: 13/60 functions (22%)
    - **Missing**: Joystick support, GetKey, WaitKey
    - **Impact**: Keyboard/mouse only

---

## Coverage Analysis

### By Category

```
Category                Coverage    Status
─────────────────────────────────────────────
Scene Graph             64%         ✅ Strong
Memory/Banks            37%         ⚠️ Partial
Graphics/Rendering      29%         ⚠️ Limited
Input System            22%         ⚠️ Basic
Animation               22%         ⚠️ Basic
Physics/Collision       15%         ❌ Minimal
Audio System             9%         ❌ Minimal
File I/O                 0%         ❌ Missing
String Operations        0%         ❌ Missing
Math Functions           0%         ❌ Missing
System/Networking        0%         ❌ Missing
─────────────────────────────────────────────
TOTAL                   22%         ⚠️ Insufficient
```

### By Priority for SCPCB

```
Priority    Category              Status    Blocker?
────────────────────────────────────────────────────
P0          Include Files         ❌ Stub   YES
P0          Asset Loading         ❌ None   YES
P0          File I/O              ❌ None   YES
P0          Math Library          ❌ None   YES
P1          String Operations     ❌ None   YES
P1          Physics Engine        ⚠️ 15%    Partial
P1          Audio System          ⚠️ 9%     Partial
P2          Graphics Pipeline     ⚠️ 29%    Partial
P2          Animation System      ⚠️ 22%    Partial
P3          Input Devices         ⚠️ 22%    No
```

---

## Architectural Assessment

### What's Right ✅

1. **Separation of Concerns**
   - Compiler generates WASM
   - Runtime provides implementations
   - Clean interface via imports
   - **Verdict**: Sound architecture

2. **Relooper Algorithm**
   - Required for WASM (no direct jumps)
   - Converts unstructured control flow to structured blocks
   - **Verdict**: Correct implementation, not a bug

3. **Type System**
   - Simple suffix-based mapping works for WASM
   - Forward-scanning type inference is pragmatic
   - **Verdict**: Acceptable trade-off vs Blitz3D-NG's complexity

4. **Memory Safety**
   - Bounds checking on bank operations
   - Swift safety features
   - **Verdict**: Better than Blitz3D-NG in this regard

### What's Different ⚠️

1. **Type Suffix Handling**
   - **Swift**: Suffixes attached at lexer level (single token)
   - **Blitz3D-NG**: Suffixes parsed separately (optional)
   - **Risk**: Edge cases with optional suffixes
   - **Verdict**: Test edge cases

2. **Type System Complexity**
   - **Swift**: Simple suffix → WASM type mapping
   - **Blitz3D-NG**: Polymorphic type hierarchy with full checking
   - **Risk**: May miss type errors
   - **Verdict**: Acceptable for WASM target

3. **Control Flow**
   - **Swift**: Relooper (structured blocks)
   - **Blitz3D-NG**: Direct jumps (JSR/RET)
   - **Risk**: Edge cases with nested gotos
   - **Verdict**: Test complex control flow

### What's Missing ❌

1. **Include File Support**
   - **Status**: Stubbed out
   - **Impact**: Cannot compile multi-file projects
   - **Verdict**: Must implement

2. **Runtime Coverage**
   - **Status**: 22% of Blitz3D-NG
   - **Impact**: Cannot run real games
   - **Verdict**: Must expand (prioritize asset loading, file I/O, math)

3. **Implicit Variable Type Inference**
   - **Swift**: Forward scanning with i32 default
   - **Blitz3D-NG**: Full semantic analysis
   - **Risk**: May guess wrong types
   - **Verdict**: Monitor for bugs, may need improvement

---

## Recommendations

### Immediate (Week 1-2)

1. **Implement Include File Support** 🔴
   - Location: `Sources/Compiler/Parser/Parser.swift:495-501`
   - Effort: Medium (file loading + recursive parsing)
   - Impact: Unlocks multi-file projects
   - Priority: **P0 - Critical**

2. **Audit TypeScript Runtime** 🔍
   - Check which functions it provides via browser APIs
   - May already have asset loading, file I/O
   - Effort: Low (investigation)
   - Priority: **P0 - Critical**

### Short Term (Month 1-2)

3. **Add Core Runtime Functions** 🔴
   - Math library: Sin, Cos, Tan, Sqrt, Abs, Floor, Ceil (29 functions)
   - String operations: Len, Mid, Left, Right, Replace, Instr (28 functions)
   - File I/O: Basic read/write operations (10-15 functions)
   - Effort: High
   - Priority: **P0-P1 - Critical**

4. **Asset Loading Pipeline** 🔴
   - Implement LoadMesh, LoadTexture, LoadImage
   - Support B3D, RMESH formats (already have parsers!)
   - Integrate with Three.js via TypeScript runtime
   - Effort: High
   - Priority: **P0 - Critical**

### Medium Term (Month 3-6)

5. **Expand Graphics Pipeline** 🟠
   - Add geometric primitives (CreateCube, CreateSphere, etc.)
   - Complete camera control functions
   - Display mode management
   - Effort: Medium-High
   - Priority: **P2 - High**

6. **Physics Engine Integration** 🟠
   - Evaluate ODE WASM port or alternative (Rapier, Cannon.js)
   - Implement rigid body dynamics
   - Joint constraints
   - Effort: Very High
   - Priority: **P1 - High**

7. **Complete Audio System** 🟠
   - Channel management functions
   - Sound properties (pitch, volume, pan)
   - 3D audio via Web Audio API
   - Effort: Medium
   - Priority: **P1 - High**

### Long Term (Month 6-12)

8. **Complete Animation System** 🟡
   - Animation sequences
   - MD2 model support
   - Animation keys
   - Effort: Medium
   - Priority: **P2 - Medium**

9. **Input Expansion** 🟡
   - Joystick support via Gamepad API
   - GetKey, WaitKey implementations
   - Effort: Low-Medium
   - Priority: **P3 - Low**

---

## Risk Assessment

### High Risk 🔴

1. **Include Files Not Working** → Cannot compile SCPCB Main.bb
2. **No Asset Loading** → Cannot load game content
3. **No Math Functions** → Game calculations fail
4. **Type Suffix Edge Cases** → Subtle bugs in compilation

### Medium Risk 🟠

1. **Type Inference Defaults** → Wrong variable types
2. **Control Flow Edge Cases** → Relooper semantic differences
3. **Memory Model Incompatibility** → DATA/READ/RESTORE issues
4. **Physics Integration** → Large effort, may not complete

### Low Risk 🟡

1. **Animation Sequences** → Workarounds possible
2. **Joystick Support** → Not essential for SCPCB
3. **String Operations** → Can implement incrementally

---

## Success Metrics

### Phase 1: Core Functionality (Month 1-2)

- ✅ Include files working
- ✅ Math library implemented
- ✅ String operations implemented
- ✅ Basic file I/O working
- ✅ Asset loading pipeline functional
- **Target**: Can compile and load SCPCB assets

### Phase 2: Basic Gameplay (Month 3-4)

- ✅ Graphics pipeline expanded
- ✅ Audio system functional
- ✅ Physics collision working
- **Target**: Basic SCPCB gameplay working

### Phase 3: Full Compatibility (Month 5-12)

- ✅ Physics engine integrated
- ✅ Animation system complete
- ✅ All SCPCB features working
- **Target**: Full SCPCB experience in browser

---

## Conclusion

**Current State**: Strong foundation with critical gaps

**Viability**: SCPCB port is **achievable** but requires significant runtime
expansion

**Effort Estimate**: 6-12 months to full compatibility (medium team)

**Recommendation**:

1. Implement include files immediately
2. Audit TypeScript runtime for existing functionality
3. Prioritize math/string/file I/O functions
4. Add asset loading pipeline
5. Iterate based on SCPCB testing

**Strategic Decision**: The import-based architecture is sound. Focus on
expanding runtime coverage rather than redesigning the compiler.

---

## Next Steps

1. Read detailed comparison documents (02-04)
2. Review priority matrix (05)
3. Execute implementation roadmap (06)
4. Test against SCPCB requirements (07)
