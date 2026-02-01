# Critical Issues Blocking SCPCB

**Date**: February 1, 2026  
**Status**: Analysis Complete

---

## Overview

Five **critical blockers** prevent SCPCB from running in the browser. These must be addressed before any meaningful gameplay is possible.

---

## Issue #1: Include File Support (COMPILER)

### Status: 🔴 **Critical Blocker**

### Problem

Swift compiler stubs out `#Include` statements:

**Location**: `Sources/Compiler/Parser/Parser.swift:495-501`

```swift
case .keywordInclude:
    advance()
    if currentToken.type == .stringLiteral {
        advance()
        return .empty(endSpan(from: startSpan()))  // STUB - Does nothing!
    }
    return nil
```

### Impact on SCPCB

SCPCB Main.bb uses **23 #Include statements**:

```blitz3d
Include "FMod.bb"
Include "StrictLoads.bb"
Include "KeyName.bb"
Include "Blitz_Basic_Bank.bb"
Include "Blitz_File_FileName.bb"
Include "Blitz_File_ZipApi.bb"
Include "Update.bb"
Include "DevilParticleSystem.bb"
Include "AAText.bb"
Include "Achievements.bb"
Include "Difficulty.bb"
Include "dreamfilter.bb"
Include "Items.bb"              # Item system
Include "Particles.bb"          # Particle effects
Include "MapSystem.bb"          # Level generation
Include "NPCs.bb"               # Enemy AI
Include "UpdateEvents.bb"       # Event handling
Include "menu.bb"               # UI system
Include "LoadAllSounds.bb"      # Audio loading
Include "save.bb"               # Save/load system
```

### Why It Fails

- Individual files compile successfully (94.7% success rate)
- But assembled game is missing critical systems:
  - Items system not loaded
  - NPC AI not loaded
  - Map generator not loaded
  - UI system not loaded
  - Event handler not loaded

### What's Needed

Full include file implementation like Blitz3D-NG:

```cpp
// Pseudo-code from blitz3d-ng/src/tools/compiler/tree/parser.cpp:144-160
std::set<std::string> included;  // Track loaded files

void Parser::parseInclude() {
    std::string filename = parseStringLiteral();
    std::string fullpath = fullfilename(filename);
    
    // Prevent duplicate includes
    if (included.find(fullpath) != included.end()) {
        return;
    }
    included.insert(fullpath);
    
    // Load file
    std::string content = readFile(fullpath);
    if (content.empty()) {
        error("Include file not found: " + filename);
    }
    
    // Parse recursively
    Lexer *prevLexer = lexer;
    lexer = new Lexer(content, fullpath);
    
    parseStatements();  // Recursive parse
    
    // Restore previous lexer
    delete lexer;
    lexer = prevLexer;
}
```

### Implementation Plan

**Effort**: Medium (2-3 days)  
**Priority**: P0 - Must implement immediately

**Steps**:
1. Add file loading support (Swift's `FileManager` or custom)
2. Maintain `included` set to prevent duplicates
3. Implement recursive parsing
4. Handle relative/absolute paths
5. Error handling for missing files
6. Test with SCPCB's 23 includes

**Files to Modify**:
- `Sources/Compiler/Parser/Parser.swift` (main implementation)
- Add `FileLoader.swift` helper class (optional)

---

## Issue #2: Asset Loading (ENGINE)

### Status: 🔴 **Critical Blocker**

### Problem

Zero asset loading functions in Swift engine:

```
LoadMesh       - Not implemented
LoadTexture    - Not implemented
LoadImage      - Not implemented
LoadBrush      - Not implemented
LoadAnimMesh   - Not implemented
```

### Impact on SCPCB

SCPCB loads hundreds of assets:

```blitz3d
; Meshes
mesh = LoadMesh("GFX\map\room1archive_mesh.rmesh")
door = LoadMesh("GFX\map\door01.x")
npc = LoadAnimMesh("GFX\npcs\173_2.b3d")

; Textures
tex = LoadTexture("GFX\map\wall_cement.jpg")
overlay = LoadTexture("GFX\overlays\fog.png")

; Images (2D)
img = LoadImage("GFX\menu\back.jpg")
```

**Result**: Cannot display any game content

### What's Needed

**File Format Support**:
- B3D (Blitz3D native format) - ✅ Parser exists in `Sources/Blitz3DEngine/Parsers/B3DParser.swift`
- RMESH (SCPCB custom format) - ✅ Parser exists in `Sources/Blitz3DEngine/Parsers/RMeshParser.swift`
- X (DirectX format) - ❌ Need parser
- MD2 (Quake format) - ❌ Need parser
- Images (JPG, PNG, BMP) - ❌ Need decoder

**Implementation Strategy**:

```swift
@_cdecl("LoadMesh")
public func LoadMesh(filename: Int32, parent: Int32) -> Int32 {
    let path = readStringFromMemory(filename)
    let ext = pathExtension(path)
    
    switch ext {
    case "b3d":
        return loadB3DFile(path, parent)
    case "rmesh":
        return loadRMeshFile(path, parent)
    case "x":
        return loadXFile(path, parent)
    default:
        print("Unsupported mesh format: \(ext)")
        return 0
    }
}

@_cdecl("LoadTexture")
public func LoadTexture(filename: Int32, flags: Int32) -> Int32 {
    let path = readStringFromMemory(filename)
    let imageData = loadImageFile(path)  // Use stb_image or similar
    return TextureManager.shared.createFromData(imageData, flags)
}
```

**Challenges**:
- File I/O in WASM (need virtual filesystem)
- Image decoding (use stb_image library or browser APIs)
- Mesh parsing (B3D parser exists, need X and MD2)

### Implementation Plan

**Effort**: High (2-3 weeks)  
**Priority**: P0 - Cannot display game without this

**Phase 1: Virtual Filesystem** (3 days)
- Integrate with TypeScript runtime VFS
- File loading from ZIP archives
- Path resolution

**Phase 2: LoadMesh** (1 week)
- B3D format (use existing parser)
- RMESH format (use existing parser)
- X format (new parser or use library)
- MD2 format (for animated NPCs)

**Phase 3: LoadTexture/LoadImage** (3-5 days)
- Image decoding (stb_image or browser Image API)
- Texture creation and upload
- Format support (JPG, PNG, BMP, TGA)

**Files to Create/Modify**:
- `Sources/Blitz3DEngine/Exports.swift` - Add LoadMesh/LoadTexture/LoadImage
- `Sources/Blitz3DEngine/Loaders/` - New directory for loaders
- `Sources/Blitz3DEngine/Parsers/XParser.swift` - X format
- `Sources/Blitz3DEngine/Parsers/MD2Parser.swift` - MD2 format

---

## Issue #3: File I/O (ENGINE)

### Status: 🔴 **Critical Blocker**

### Problem

Zero file I/O functions (0/30):

```
OpenFile       - Not implemented
ReadFile       - Not implemented
WriteFile      - Not implemented
ReadByte/Int/Float/String - Not implemented
FileType       - Not implemented
FileSize       - Not implemented
CurrentDir     - Not implemented
```

### Impact on SCPCB

SCPCB reads config files at startup:

```blitz3d
; Load options
file = ReadFile("Data\options.ini")
width = ReadInt(file)
height = ReadInt(file)
fullscreen = ReadInt(file)
CloseFile(file)

; Save game
file = WriteFile("Saves\save.dat")
WriteInt(file, playerHealth)
WriteFloat(file, playerX)
WriteString(file, currentRoom)
CloseFile(file)
```

**Result**: Cannot load settings, cannot save games

### What's Needed

**File System Architecture**:

```
Browser Environment:
├─ Virtual Filesystem (in-memory)
│  ├─ Preloaded ZIP archives
│  └─ Runtime-created files
├─ IndexedDB (persistent storage)
└─ File System Access API (user files)
```

**Implementation Strategy**:

Two-tier approach:

**Tier 1: Read-Only VFS** (for assets)
```typescript
// TypeScript runtime manages VFS
class VirtualFileSystem {
    loadZip(url: string): Promise<void>
    readFile(path: string): Uint8Array
    fileExists(path: string): boolean
    listDir(path: string): string[]
}
```

**Tier 2: Read-Write Storage** (for saves)
```typescript
class PersistentStorage {
    // IndexedDB for save files
    saveFile(path: string, data: Uint8Array): Promise<void>
    loadFile(path: string): Promise<Uint8Array>
}
```

**Swift Engine Integration**:
```swift
@_cdecl("ReadFile")
public func ReadFile(filename: Int32) -> Int32 {
    let path = readStringFromMemory(filename)
    // Call into TypeScript runtime via command buffer
    return fileSystem.openFile(path, mode: .read)
}

@_cdecl("ReadInt")
public func ReadInt(handle: Int32) -> Int32 {
    return fileSystem.readInt(handle)
}

@_cdecl("WriteFile")
public func WriteFile(filename: Int32) -> Int32 {
    let path = readStringFromMemory(filename)
    return fileSystem.openFile(path, mode: .write)
}
```

### Implementation Plan

**Effort**: High (2-3 weeks)  
**Priority**: P0 - Cannot load config or save games

**Phase 1: TypeScript VFS** (1 week)
- Virtual filesystem with ZIP support
- Path resolution and normalization
- Directory traversal
- Integration with existing asset loading

**Phase 2: Swift File I/O API** (3-5 days)
- OpenFile, ReadFile, WriteFile
- ReadByte, ReadInt, ReadFloat, ReadString
- CloseFile, FilePos, SeekFile
- FileType, FileSize

**Phase 3: Persistent Storage** (3-5 days)
- IndexedDB integration for saves
- Save/load game data
- Config file persistence

**Files to Create/Modify**:
- `web/src/runtime/filesystem.ts` - VFS implementation
- `Sources/Blitz3DEngine/FileIO/` - New directory
- `Sources/Blitz3DEngine/FileIO/FileExports.swift` - File functions
- Integration with command buffer system

---

## Issue #4: Math Library (ENGINE)

### Status: 🔴 **Critical Blocker**

### Problem

Zero math functions (0/29):

```
Sin, Cos, Tan  - Not implemented
Sqrt           - Not implemented
Abs, Floor, Ceil - Not implemented
ASin, ACos, ATan - Not implemented
```

### Impact on SCPCB

SCPCB uses math extensively:

```blitz3d
; Camera control
angle# = ATan2(mouseY - centerY, mouseX - centerX)
RotateEntity(camera, pitch#, yaw#, 0)

; Distance calculations
dist# = Sqrt((x2-x1)^2 + (y2-y1)^2 + (z2-z1)^2)

; Movement
newX# = x# + Cos(angle#) * speed#
newZ# = z# + Sin(angle#) * speed#

; Interpolation
t# = Floor(timer)
alpha# = timer - t#
```

**Result**: Cannot calculate positions, rotations, or distances

### What's Needed

**Good News**: WASM has built-in math instructions!

```wasm
; WASM math instructions
f32.sqrt       ; Square root
f32.floor      ; Floor
f32.ceil       ; Ceiling
f32.abs        ; Absolute value
f32.sin        ; Sine (via imported function)
f32.cos        ; Cosine (via imported function)
```

**Implementation Strategy**:

**Option A: WASM Imports** (Recommended)
```swift
// Declare as imports in generated WASM
(import "env" "sin" (func $sin (param f32) (result f32)))
(import "env" "cos" (func $cos (param f32) (result f32)))

// TypeScript provides implementations
export function sin(x: number): number {
    return Math.sin(x);
}
```

**Option B: Swift Functions**
```swift
@_cdecl("Sin")
public func Sin(angle: Float) -> Float {
    return Foundation.sin(angle)
}

@_cdecl("Cos")
public func Cos(angle: Float) -> Float {
    return Foundation.cos(angle)
}
```

**Option C: Direct WASM Instructions** (Best Performance)
```swift
// In CodeGen, emit WASM instructions directly
func generateSin(_ value: WASMValue) -> WASMInstruction {
    return .f32_call_indirect(mathTableIndex, sinFunctionIndex)
}
```

### Implementation Plan

**Effort**: Low-Medium (2-5 days)  
**Priority**: P0 - Needed immediately

**Approach**: Use Option A (WASM imports) initially, optimize later

**Phase 1: TypeScript Math Library** (1 day)
```typescript
export const mathLib = {
    sin: (x: number) => Math.sin(x),
    cos: (x: number) => Math.cos(x),
    tan: (x: number) => Math.tan(x),
    sqrt: (x: number) => Math.sqrt(x),
    abs: (x: number) => Math.abs(x),
    floor: (x: number) => Math.floor(x),
    ceil: (x: number) => Math.ceil(x),
    asin: (x: number) => Math.asin(x),
    acos: (x: number) => Math.acos(x),
    atan: (x: number) => Math.atan(x),
    atan2: (y: number, x: number) => Math.atan2(y, x),
    // ... 29 total functions
};
```

**Phase 2: Compiler Import Generation** (1 day)
- Generate WASM import declarations
- Type conversion (f32/i32)

**Phase 3: Testing** (1-2 days)
- Unit tests for each function
- Accuracy validation
- Performance benchmarks

**Files to Create/Modify**:
- `web/src/runtime/math.ts` - Math library
- `Sources/Compiler/CodeGen/FunctionGeneration.swift` - Import generation
- No Swift engine code needed (all in TypeScript)

---

## Issue #5: String Operations (ENGINE)

### Status: 🔴 **Critical Blocker**

### Problem

Zero string functions (0/28):

```
Len, Mid, Left, Right - Not implemented
Replace, Instr        - Not implemented
Upper, Lower, Trim    - Not implemented
Chr, Asc              - Not implemented
```

### Impact on SCPCB

SCPCB uses strings for:

```blitz3d
; Config parsing
line$ = ReadLine(file)
key$ = Left(line$, Instr(line$, "=") - 1)
value$ = Right(line$, Len(line$) - Instr(line$, "="))

; UI formatting
text$ = "Health: " + Str(health) + "%"
text$ = Upper(playerName$)

; File path manipulation
ext$ = Right(filename$, 3)
If Lower(ext$) = "ini" Then
    ; Parse INI file
EndIf
```

**Result**: Cannot parse config, build UI text, or manipulate paths

### What's Needed

**Implementation Strategy**:

**Option A: TypeScript Runtime** (Recommended)
```typescript
export const stringLib = {
    len: (s: string) => s.length,
    mid: (s: string, start: number, count: number) => s.substring(start - 1, start + count - 1),
    left: (s: string, count: number) => s.substring(0, count),
    right: (s: string, count: number) => s.substring(s.length - count),
    replace: (s: string, find: string, replace: string) => s.replace(find, replace),
    instr: (s: string, find: string) => s.indexOf(find) + 1,  // 1-indexed
    upper: (s: string) => s.toUpperCase(),
    lower: (s: string) => s.toLowerCase(),
    trim: (s: string) => s.trim(),
    chr: (code: number) => String.fromCharCode(code),
    asc: (s: string) => s.charCodeAt(0),
    // ... 28 total functions
};
```

**Challenges**:
- Strings are pointers in WASM
- Need memory management for string creation
- 1-based indexing (Blitz3D) vs 0-based (JS/WASM)

### Implementation Plan

**Effort**: Medium (1-2 weeks)  
**Priority**: P0 - Needed for config parsing

**Phase 1: String Memory Model** (2-3 days)
- String storage in WASM linear memory
- Reference counting or GC
- Conversion between WASM pointer and JS string

**Phase 2: Basic Operations** (3-5 days)
- Len, Mid, Left, Right
- Chr, Asc
- Upper, Lower, Trim

**Phase 3: Advanced Operations** (3-5 days)
- Replace, Instr
- String, Hex, Bin
- LSet, RSet

**Files to Create/Modify**:
- `web/src/runtime/string.ts` - String library
- `Sources/Compiler/CodeGen/` - String handling
- Memory management for strings

---

## Summary of Critical Issues

| Issue | Location | Effort | Priority | Blocker? |
|-------|----------|--------|----------|----------|
| 1. Include Files | Compiler | Medium (2-3 days) | P0 | YES |
| 2. Asset Loading | Engine | High (2-3 weeks) | P0 | YES |
| 3. File I/O | Engine | High (2-3 weeks) | P0 | YES |
| 4. Math Library | Runtime | Low (2-5 days) | P0 | YES |
| 5. String Operations | Runtime | Medium (1-2 weeks) | P0 | YES |

**Total Estimated Effort**: 7-11 weeks (parallel work can reduce this)

**Critical Path**:
1. Include files (blocks compilation)
2. Math + Strings (blocks basic logic)
3. File I/O (blocks config/saves)
4. Asset loading (blocks rendering)

---

## Next Document

See **05-priority-matrix.md** for prioritized implementation plan.
