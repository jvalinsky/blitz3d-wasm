# Implementation Status

## Summary

| Category | Official API | Compiler Has | Missing |
|----------|--------------|--------------|---------|
| Total Functions | ~400 | 387 | ~85 |
| Used by SCPCB | 90 | 70 | **20** |

## Functions SCPCB Uses But Compiler Is Missing

These need to be added to `CodeGenerator.swift`:

```
ChannelPan          - Audio panning
CopyFile            - File system
CreateDir           - File system
DeleteDir           - File system
DeleteFile          - File system
DrawImageRect       - 2D graphics
EntityOrder         - Render order
ExecFile            - System
FlipMesh            - Mesh manipulation
FlushKeys           - Input
FlushMouse          - Input
LightConeAngles     - Lighting
LockBuffer          - Buffer access
MeshCullBox         - Mesh culling
PauseChannel        - Audio
ResumeChannel       - Audio
RotateImage         - 2D graphics
SetBuffer           - Buffer selection
UnlockBuffer        - Buffer access
WritePixelFast      - Pixel access
```

## How to Add Missing Functions

In `Sources/Compiler/CodeGen/CodeGenerator.swift`, add to the `knownFunctions` array:

```swift
// Example: Adding FlushKeys
("FlushKeys", "FlushKeys", [], [], "env"),

// Example: Adding ChannelPan (channel%, pan#)
("ChannelPan", "ChannelPan", [.i32, .f32], [], "env"),

// Example: Adding CopyFile (from$, to$)
("CopyFile", "CopyFile", [.i32, .i32], [], "env"),  // strings are i32 pointers
```

## Functions by Category

### Already Implemented (387)

#### Math (17/17) ✅
Sin, Cos, Tan, ASin, ACos, ATan, ATan2, Sqr, Floor, Ceil, Exp, Log, Log10, Rnd, Rand, SeedRnd, RndSeed

#### String (15/18) 
Left, Right, Mid, Replace, Instr, Upper, Lower, Trim, Chr, Asc, Len, Hex, Bin, String, LSet, RSet
Missing: CurrentDate, CurrentTime, LTrim, RTrim

#### Input (25/35)
KeyDown, KeyHit, GetKey, WaitKey, MouseDown, MouseHit, MouseX, MouseY, MouseZ, MouseXSpeed, MouseYSpeed, MouseZSpeed, MoveMouse, JoyType, JoyDown, JoyHit, JoyX, JoyY, JoyZ, JoyU, JoyV, JoyPitch, JoyYaw, JoyRoll, JoyHat
Missing: **FlushKeys, FlushMouse**, FlushJoy, WaitMouse, WaitJoy, JoyXDir, JoyYDir, JoyZDir, GetJoy, GetMouse

#### Audio (12/17)
LoadSound, FreeSound, PlaySound, SoundVolume, StopChannel, ChannelVolume, ChannelPlaying, Load3DSound, PlayMusic, PlayCDTrack
Missing: LoopSound, SoundPitch, SoundPan, **ChannelPan**, ChannelPitch, **PauseChannel, ResumeChannel**

#### 2D Graphics (50/80)
Graphics, Cls, ClsColor, Color, Line, Rect, Oval, Text, LoadFont, SetFont, LoadImage, FreeImage, DrawImage, DrawBlock, etc.
Missing: **DrawImageRect**, DrawBlockRect, TileBlock, **RotateImage**, TFormImage, **LockBuffer, UnlockBuffer**, **SetBuffer**, **WritePixelFast**, Plot, Origin, Viewport, etc.

#### 3D Graphics (130/150)
CreateCamera, CreateLight, CreateMesh, CreateSprite, PositionEntity, RotateEntity, etc.
Missing: CaptureWorld, ClearWorld, **FlipMesh**, **MeshCullBox**, **LightConeAngles**, **EntityOrder**, etc.

#### File System (12/17)
OpenFile, ReadFile, WriteFile, CloseFile, FilePos, SeekFile, FileSize, FileType, ReadDir, NextFile, CurrentDir
Missing: **CreateDir, DeleteDir, DeleteFile, CopyFile**, ChangeDir, CloseDir

### Priority for SCPCB

**High Priority** (blocks compilation):
1. FlushKeys, FlushMouse - Input handling
2. ChannelPan, PauseChannel, ResumeChannel - Audio control
3. CreateDir, DeleteDir, DeleteFile, CopyFile - Save system

**Medium Priority** (affects features):
1. LockBuffer, UnlockBuffer, SetBuffer, WritePixelFast - Screen effects
2. DrawImageRect, RotateImage - UI rendering
3. FlipMesh, MeshCullBox - Mesh optimization

**Low Priority** (rarely used):
1. LightConeAngles - Spotlights
2. EntityOrder - Render sorting
3. ExecFile - External programs

## Adding a New Function

1. **Find signature** in `docs/BLITZ3D_API_REFERENCE.md`
2. **Add to compiler** in `CodeGenerator.swift`:
   ```swift
   ("FunctionName", "FunctionName", [param_types], [return_types], "env"),
   ```
3. **Add to runtime** in `Sources/Runtime/thin/runtime.js`:
   ```javascript
   FunctionName: (params) => { /* implementation */ },
   ```
4. **Test** with a simple .bb file

## Type Mapping

| BB Type | WASM Type | Notes |
|---------|-----------|-------|
| `%` (Int) | `.i32` | |
| `#` (Float) | `.f32` | |
| `$` (String) | `.i32` | Pointer to string in memory |
| Entity/Handle | `.i32` | ID/handle number |
