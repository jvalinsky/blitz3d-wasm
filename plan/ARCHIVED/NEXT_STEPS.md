# Next Steps - Blitz3D-WASM

## Current State (January 27, 2026)

✅ **Working:**

- Compiler generates valid WASM
- Type system (New, Delete, For Each, field access)
- Thin runtime (~500 lines JS)
- Particle demo with falling particles

⚠️ **Issues:**

- 20 functions SCPCB needs are missing from compiler
- Function shadowing (user functions can't share names with runtime)
- Goto/Gosub not fully implemented

## Phase 1: Complete SCPCB Function Coverage (1-2 days)

### 1.1 Add Missing Function Signatures to Compiler

Add to `Sources/Compiler/CodeGen/CodeGenerator.swift`:

```swift
// Input
("FlushKeys", "FlushKeys", [], [], "env"),
("FlushMouse", "FlushMouse", [], [], "env"),

// Audio
("ChannelPan", "ChannelPan", [.i32, .f32], [], "env"),
("PauseChannel", "PauseChannel", [.i32], [], "env"),
("ResumeChannel", "ResumeChannel", [.i32], [], "env"),

// File System
("CreateDir", "CreateDir", [.i32], [.i32], "env"),
("DeleteDir", "DeleteDir", [.i32], [.i32], "env"),
("DeleteFile", "DeleteFile", [.i32], [.i32], "env"),
("CopyFile", "CopyFile", [.i32, .i32], [.i32], "env"),

// Buffer
("LockBuffer", "LockBuffer", [.i32], [], "env"),
("UnlockBuffer", "UnlockBuffer", [.i32], [], "env"),
("SetBuffer", "SetBuffer", [.i32], [], "env"),
("WritePixelFast", "WritePixelFast", [.i32, .i32, .i32, .i32], [], "env"),

// 2D Graphics
("DrawImageRect", "DrawImageRect", [.i32, .i32, .i32, .i32, .i32, .i32, .i32, .i32], [], "env"),
("RotateImage", "RotateImage", [.i32, .f32], [], "env"),

// 3D Graphics
("FlipMesh", "FlipMesh", [.i32], [], "env"),
("MeshCullBox", "MeshCullBox", [.i32, .f32, .f32, .f32, .f32, .f32, .f32], [], "env"),
("EntityOrder", "EntityOrder", [.i32, .i32], [], "env"),
("LightConeAngles", "LightConeAngles", [.i32, .f32, .f32], [], "env"),
```

### 1.2 Add Stub Implementations to Runtime

In `Sources/Runtime/thin/runtime.js`, add stubs:

```javascript
FlushKeys: () => { /* clear key state */ },
FlushMouse: () => { /* clear mouse state */ },
ChannelPan: (ch, pan) => { /* set audio pan */ },
// ... etc
```

### 1.3 Test with SCPCB Files

```bash
# Test individual files
./build/debug/blitz3d-wasm ~/Software/scpcb/Difficulty.bb -o /tmp/test.wasm
./build/debug/blitz3d-wasm ~/Software/scpcb/KeyName.bb -o /tmp/test.wasm
./build/debug/blitz3d-wasm ~/Software/scpcb/Particles.bb -o /tmp/test.wasm

# Validate
wasm-validate /tmp/test.wasm
```

## Phase 2: Fix Compiler Issues (2-3 days)

### 2.1 Function Shadowing Fix

**Problem:** User function `Distance#()` conflicts with runtime import
`Distance`.

**Solution:** Prefix user functions or use different export names.

```swift
// In CodeGenerator.swift, when exporting user functions:
let exportName = "user_" + functionName  // or use mangling
```

### 2.2 Goto/Gosub Implementation

**Problem:** Goto/Gosub require Relooper algorithm for structured control flow.

**Current state:** IR/Passes/Relooper.swift exists but may be incomplete.

**Test case:**

```blitz
Goto skip
Print "should not print"
.skip
Print "skipped!"
```

### 2.3 Select/Case Edge Cases

Test and fix:

```blitz
Select x
    Case 1, 2, 3
        Print "1-3"
    Case 4 To 10
        Print "4-10"
    Default
        Print "other"
End Select
```

## Phase 3: Compile SCPCB Main.bb (3-5 days)

### 3.1 Handle Include Files

SCPCB structure:

```
Main.bb
├── Include "Difficulty.bb"
├── Include "KeyName.bb"
├── Include "NPCs.bb"
├── Include "MapSystem.bb"
├── Include "Items.bb"
├── Include "Save.bb"
└── ... 30+ files
```

**Test:**

```bash
./build/debug/blitz3d-wasm ~/Software/scpcb/Main.bb -o /tmp/scpcb.wasm 2>&1 | head -50
```

### 3.2 Fix Case Sensitivity Issues

SCPCB has inconsistent casing:

- `dreamfilter.bb` vs `Dreamfilter.bb`
- `include "file.bb"` vs `Include "File.bb"`

### 3.3 Handle Large Codebase

SCPCB is 52K lines. May need:

- Memory optimization
- Better error messages
- Progress indication

## Phase 4: Runtime Implementation (1-2 weeks)

### 4.1 Essential Runtime Functions

Priority order for SCPCB:

1. **Graphics3D, RenderWorld** - Basic 3D setup
2. **LoadTexture, LoadMesh** - Asset loading
3. **CreateCamera, CameraRange** - View setup
4. **KeyDown, KeyHit, MouseX, MouseY** - Input
5. **LoadSound, PlaySound** - Audio
6. **ReadFile, WriteFile** - Save/Load

### 4.2 RMesh Loader

SCPCB uses custom RMesh format. Options:

**Option A:** Compile SCPCB's LoadRMesh BB code to WASM

- Uses existing BB code
- Calls runtime's low-level mesh functions

**Option B:** JS implementation

- Already have `Sources/Runtime/modules/rmesh.js`
- Need to wire it up

### 4.3 Virtual File System

For loading SCPCB assets:

```javascript
// Pre-load assets into memory
await vfs.mount("/GFX/", "https://example.com/scpcb/GFX/");
await vfs.mount("/SFX/", "https://example.com/scpcb/SFX/");

// BB code calls ReadFile("GFX\texture.png")
// VFS intercepts and returns from cache
```

## Phase 5: Run SCPCB (2-4 weeks)

### 5.1 Milestone: Main Menu

- Load menu textures
- Render menu background
- Handle input
- Play menu music

### 5.2 Milestone: Load a Room

- Parse room data
- Load RMesh
- Position player
- Basic movement

### 5.3 Milestone: Playable Demo

- Multiple rooms
- Doors working
- Basic NPCs
- Save/Load

## Timeline Summary

| Phase | Task                   | Duration  |
| ----- | ---------------------- | --------- |
| 1     | Add missing functions  | 1-2 days  |
| 2     | Fix compiler issues    | 2-3 days  |
| 3     | Compile SCPCB          | 3-5 days  |
| 4     | Runtime implementation | 1-2 weeks |
| 5     | Run SCPCB              | 2-4 weeks |

**Total: 4-8 weeks to playable SCPCB demo**

## Quick Wins (Today)

1. Add the 20 missing function signatures (~30 min)
2. Test compiling more SCPCB files (~1 hour)
3. Document any new errors found (~30 min)

## Commands Cheat Sheet

```bash
# Build compiler
cd ~/Software/blitz3d-wasm
swift build

# Compile BB file
.build/debug/blitz3d-wasm input.bb -o output.wasm

# Validate WASM
wasm-validate output.wasm

# See WASM as text
wasm2wat output.wasm | head -100

# Run thin runtime demo
cd Sources/Runtime/thin
python3 -m http.server 8000
# Open http://localhost:8000/test.html

# Count functions in SCPCB
grep -ohE '\b[A-Z][a-zA-Z0-9_]+\s*\(' ~/Software/scpcb/*.bb | sed 's/(//' | sort | uniq -c | sort -rn
```
