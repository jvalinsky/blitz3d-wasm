# SCPB Save/Load System Analysis

## Executive Summary

**Critical Finding: The SCPB save/load system cannot be analyzed from this repository.**

This repository contains a **Blitz3D-to-WASM compiler infrastructure** (Swift-based compiler + JavaScript runtime), not the SCPB game source code. The SCPB game files (Save.bb, Main.bb, Items.bb, NPCs.bb, etc.) do not exist in this codebase.

---

## Repository Contents Analysis

### What This Repository Contains

| Component | Description |
|-----------|-------------|
| **Compiler** | Swift-based toolchain converting BlitzBasic to WebAssembly |
| **Runtime** | JavaScript library providing browser APIs (Three.js, WebGL, Web Audio) |
| **Test Suite** | Integration tests validating compilation and runtime |
| **Build System** | Swift Package Manager configuration |

### What Is Missing

| File | Purpose | Status |
|------|---------|--------|
| `Save.bb` | Save/Load system implementation | **NOT FOUND** |
| `Main.bb` | Game initialization and main loop | **NOT FOUND** |
| `Items.bb` | Inventory system | **NOT FOUND** |
| `NPCs.bb` | NPC behavior and AI | **NOT FOUND** |
| `Map.bb` | Room/map system | **NOT FOUND** |
| `Config.bb` | Game configuration | **NOT FOUND** |

### Evidence of Absence

Comprehensive searches were performed for the following patterns:

```
glob("**/Save.bb")                    → No matches
glob("**/*Save*.bb")                  → No matches
grep("Type SaveData") in *.bb         → No matches
grep("Function SaveGame") in *.bb     → No matches
grep("Function LoadGame") in *.bb     → No matches
grep("SaveSlot") in *.bb              → No matches
grep("quicksave|autosave") in *.bb    → No matches
```

The only `.bb` files present are compiler test files:
- `Tests/IntegrationTests/*.bb` (test programs)
- `Tests/IntegrationTests/Assets/*.bb` (test programs)
- `test_project/src/*.bb` (example programs)

---

## Expected Save/Load System Architecture

Based on the BlitzBasic/Blitz3D engine patterns and typical SCPB game structure, the save/load system would conceptually include:

### 1. SaveData Type Definition

```blitzbasic
; Expected structure (from SCPB patterns)
Type SaveData
    ; Header
    Field Version%
    Field Checksum&
    
    ; Player State
    Field PlayerPosX#
    Field PlayerPosY#
    Field PlayerPosZ#
    Field PlayerRot#
    Field Health#
    Field Stamina#
    Field Sanity#
    
    ; Inventory
    Field Inventory$[20]        ; 20 item slots
    Field SelectedItem%
    
    ; Progress
    Field CurrentRoom%
    Field CheckpointsHit%
    Field GameTime&
    Field Difficulty%
    
    ; NPC States
    Field SCP173State%          ; 0: inactive, 1: active, 2: dead
    Field SCP096State%
    Field SCP106State%
    Field SCP049State%
    Field SCP939State%
    
    ; World State
    Field DoorsOpened[50]       ; Door status array
    Field LightsOn[100]         ; Light status array
    Field ItemsCollected[100]   ; Collectible status
End Type
```

### 2. Expected Save Functions

```blitzbasic
; Core save/load functions
Function SaveGame(slot%)           ; Save to slot N (1-10)
Function LoadGame(slot%)           ; Load from slot N
Function QuickSave()               ; Save to quicksave slot
Function QuickLoad()               ; Load from quicksave slot
Function AutoSave()                ; Trigger auto-save
Function DeleteSave(slot%)         ; Delete save slot

; Utility functions
Function GetSaveInfo(slot%)        ; Returns save metadata
Function SaveSlotExists(slot%)     ; Check if slot occupied
Function GetSaveChecksum#(save$)   ; Calculate save integrity
Function ValidateSave%(save$)      ; Check save corruption
```

### 3. Expected Save File Format

```
┌─────────────────────────────────────────────┐
│ SAVE FILE HEADER (32 bytes)                 │
├─────────────────────────────────────────────┤
│ Magic Number      : 4 bytes  ("SCPB")       │
│ Version           : 4 bytes  (e.g., 0x0102) │
│ Checksum          : 4 bytes  (CRC32)        │
│ Timestamp         : 8 bytes  (Unix time)    │
│ Slot Number       : 4 bytes                 │
│ Reserved          : 8 bytes                 │
├─────────────────────────────────────────────┤
│ PLAYER DATA (variable)                      │
├─────────────────────────────────────────────┤
│ Position X,Y,Z    : 12 bytes (3xFloat32)    │
│ Rotation          : 4 bytes  (Float32)      │
│ Health            : 4 bytes  (Float32)      │
│ Stamina           : 4 bytes  (Float32)      │
│ Sanity            : 4 bytes  (Float32)      │
├─────────────────────────────────────────────┤
│ INVENTORY (variable)                        │
├─────────────────────────────────────────────┤
│ Item Count        : 4 bytes                 │
│ Items[]           : N x 32 bytes (strings)  │
├─────────────────────────────────────────────┤
│ WORLD STATE (variable)                      │
├─────────────────────────────────────────────┤
│ Room ID           : 4 bytes                 │
│ Door States[]     : N x 4 bytes             │
│ Light States[]    : N x 4 bytes             │
├─────────────────────────────────────────────┤
│ NPC STATES (variable)                       │
├─────────────────────────────────────────────┤
│ NPC Count         : 4 bytes                 │
│ NPC Data[]        : N x 16 bytes            │
├─────────────────────────────────────────────┤
│ FOOTER                                    │
├─────────────────────────────────────────────┤
│ End Marker        : 4 bytes  (0xDEADBEEF)   │
│ Checksum          : 4 bytes  (CRC32)        │
└─────────────────────────────────────────────┘
```

### 4. Expected Checksum/Corruption Handling

```blitzbasic
; Pseudo-code for expected checksum calculation
Function GetSaveChecksum%(saveString$)
    Local checksum% = 0
    For i = 1 To Len(saveString$)
        checksum% = (checksum% * 31 + Asc(Mid$(saveString$, i, 1))) Mod 4294967296
    Next
    Return checksum%
End Function

; Corruption detection
Function ValidateSave%(saveData$)
    ; Check magic number
    If Left$(saveData$, 4) <> "SCPB" Then Return False
    
    ; Check version
    version% = ReadInt(Mid$(saveData$, 5, 4))
    If version% > SUPPORTED_VERSION Then Return False
    
    ; Verify checksum
    storedChecksum% = ReadInt(Mid$(saveData$, 13, 4))
    calculatedChecksum% = GetSaveChecksum$(Left$(saveData$, 12) + Mid$(saveData$, 17))
    If storedChecksum% <> calculatedChecksum% Then Return False
    
    ; Check end marker
    endMarker% = ReadInt(Right$(saveData$, 4))
    If endMarker% <> 0xDEADBEEF Then Return False
    
    Return True
End Function
```

### 5. Expected Auto-Save System

```blitzbasic
; Auto-save triggers
Const AUTOSAVE_EVENTS = 3
Const AUTOSAVE_INTERVAL = 300000  ; 5 minutes

Global AutoSaveTimer& = 0
Global AutoSaveEnabled% = True

Function UpdateAutoSave(deltaTime#)
    If Not AutoSaveEnabled% Then Return
    
    AutoSaveTimer& = AutoSaveTimer& + deltaTime
    
    ; Time-based auto-save
    If AutoSaveTimer& >= AUTOSAVE_INTERVAL Then
        AutoSave()
        AutoSaveTimer& = 0
    End If
End Function

Function AutoSave()
    ; Save to dedicated auto-save slot
    SaveGame(0)  ; Slot 0 reserved for auto-save
    
    ; Show notification
    Print "Game auto-saved..."
End Function
```

### 6. Expected Quicksave System

```blitzbasic
; Quick save/load key bindings
Const QUICKSAVE_KEY = KEY_F5
Const QUICKLOAD_KEY = KEY_F9

Function HandleQuickSaveKey()
    If KeyHit(QUICKSAVE_KEY) Then
        QuickSave()
    End If
End Function

Function HandleQuickLoadKey()
    If KeyHit(QUICKLOAD_KEY) Then
        QuickLoad()
    End If
End Function

Function QuickSave()
    ; Save to special quicksave slot (usually slot 99)
    SaveGame(99)
    PlaySound("save.wav")
End Function

Function QuickLoad()
    ; Load from quicksave slot
    If SaveSlotExists(99) Then
        LoadGame(99)
        PlaySound("load.wav")
    Else
        Print "No quicksave found!"
    End If
End Function
```

---

## Runtime Support for Save/Load

The JavaScript runtime provides file I/O capabilities that would be used by the save/load system:

### Virtual File System

```javascript
// From Sources/Runtime/modules/runtime.js
Blitz3D.fs = {};
Blitz3D.files = {};
Blitz3D.nextFileId = 1;

// ZIP archive support
Blitz3D.zipManager = {
    archives: new Map(),
    mountedFiles: new Map(),
    nextHandle: 1,
    
    loadZip: async function(url) {
        // Loads ZIP archives containing game assets
        // Could be used to store save files in archives
    }
};
```

### Expected Runtime Imports

The WASM runtime would provide file I/O functions:

| Function | Purpose |
|----------|---------|
| `ReadFile$(path)` | Read text file |
| `WriteFile(path, data$)` | Write text file |
| `ReadDir$(path)` | List directory contents |
| `FileExists(path)` | Check file existence |
| `DeleteFile(path)` | Delete file |
| `CreateDir(path)` | Create directory |

---

## Recommendations

### To Analyze the SCPB Save/Load System

1. **Obtain SCPB Source Code**
   - The original SCPB source code must be acquired from the original repository
   - Search for "scp-containment-breach source code" or "scpcb source"
   - The original repo typically contains all .bb files

2. **Locate Save.bb**
   - Once source is available, search for `Save.bb`
   - Extract `Type SaveData` definition
   - Document all save/load functions

3. **Analyze Save File Format**
   - Examine `SaveGame()` and `LoadGame()` functions
   - Identify serialization format (custom binary, INI, JSON)
   - Document checksum algorithm

4. **Test Save/Load Flow**
   - Create test saves in original SCPB
   - Analyze file structure
   - Document corruption handling

### Current Repository Status

This compiler repository can:
- Compile save/load code when provided with SCPB source
- Generate WASM modules containing save functionality
- Execute save/load operations via JavaScript runtime

But cannot:
- Analyze save/load system without game source code
- Test save/load without compiled game WASM

---

## File Locations Reference

### Where Files Should Be (When Available)

```
blitz3d-wasm/
├── Sources/
│   ├── Compiler/              # Swift compiler (existing)
│   └── Runtime/               # JS runtime (existing)
├── Sources/Game/              # [MISSING] SCPB game source
│   ├── Main.bb
│   ├── Save.bb                # [EXPECTED]
│   ├── Items.bb
│   ├── NPCs.bb
│   ├── Map.bb
│   └── ...
├── Tools/
│   └── wasm-cli/              # CLI compiler (existing)
└── Tests/
    ├── CompilerTests/         # (existing)
    └── IntegrationTests/      # (existing)
```

---

## Conclusion

The SCPB save/load system analysis cannot be completed with the current repository contents. The compiler infrastructure is complete and functional, but the actual SCPB game source code (including Save.bb) is not present.

**Next Steps:**
1. Acquire SCPB/-SCPCB source code from original repositories
2. Copy game source files to `Sources/Game/` directory
3. Recompile with save/load enabled
4. Analyze the compiled output or source files

The existing codebase provides a solid foundation for compiling and running the SCPB game with save/load functionality once the source files are obtained.

---

## References

- Original SCPB Repository: https://github.com/regalis/SCP-BD (archived)
- Blitz3D Documentation: Available in repository docs
- WASM Runtime: `Sources/Runtime/modules/runtime.js`
- Compiler Source: `Sources/Compiler/`

---

*Document generated: January 18, 2026*
*Repository: blitz3d-wasm*
*Analysis scope: Save/Load system implementation*
