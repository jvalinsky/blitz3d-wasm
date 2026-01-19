# SCP:CB Full Implementation Plan

**Created:** Mon Jan 19 2026
**Git Commit:** b205e5af4ce548fe14e51d47995e0cc0c6d6f7fa
**Goal:** Complete the Blitz3D WASM compiler to fully compile and run SCP: Containment Breach in the browser.

---

## Phase 1: Language Infrastructure (Compiler)
**Priority: HIGHEST** - Must complete before any SCP:CB code will compile

| Task | Files | Effort |
|------|-------|--------|
| **1.1 Type Field Arrays** | `Parser.swift`, `CodeGenerator.swift`, `AST.swift` | 2-3 days |
| **1.2 Field Default Values** | `Parser.swift`, `CodeGenerator.swift`, `StatementGeneration.swift` | 1-2 days |
| **1.3 Handle/Object Casting** | `CodeGenerator.swift`, `ExpressionGeneration.swift` | 2-3 days |
| **1.4 Multi-Value Case Statements** | `Parser.swift`, `StatementGeneration.swift` | 1-2 days |

### Sub-tasks for 1.1 (Type Field Arrays)
- [ ] Add `dimensions: [Int]?` property to `FieldNode` in AST
- [ ] Update `Parser.parseTypeDeclaration` to capture `[expression]` after field names
- [ ] Update `CodeGenerator.processTypeDeclarations` to calculate offsets × array size
- [ ] Update `generateFieldAccess` to support array indexing
- [ ] Add tests in `Tests/CompilerTests/FieldArrayTests.swift`

### Sub-tasks for 1.2 (Field Default Values)
- [ ] Update parser to accept `= expression` syntax in Type blocks
- [ ] Store `defaultValue: ExpressionNode?` in `FieldNode`
- [ ] Emit initialization code in `New` opcode helper
- [ ] Add tests for `Field x% = 5` patterns

### Sub-tasks for 1.3 (Handle/Object)
- [ ] Implement `Handle(expr)` - return pointer as i32
- [ ] Implement `Object.Type(handle)` - cast i32 back to pointer
- [ ] Add type ID validation for safety
- [ ] Test with SCPCB save/load patterns

### Sub-tasks for 1.4 (Multi-Value Case)
- [ ] Update `CaseNode` to hold `[ExpressionNode]`
- [ ] Modify parser to collect comma-separated expressions
- [ ] Emit multiple conditional branches in `generateSelect`
- [ ] Support `Case x To y` range syntax

---

## Phase 2: Core Runtime Functions
**Priority: HIGH** - Required for basic SCP:CB gameplay

| Task | Files | Effort |
|------|-------|--------|
| **2.1 Complete String Functions** | `runtime.js`, `core.js` | 3-4 days |
| **2.2 Seeded Random** | `core.js` | 1 day |
| **2.3 Asc/Chr/Hex/Bin** | `core.js`, `CodeGenerator.swift` | 1-2 days |
| **2.4 File I/O Implementation** | `fileio.js`, `vfs.js` | 3-4 days |

### Sub-tasks for 2.1 (String Functions)
- [ ] Implement `Left(str, n)` - substring from start
- [ ] Implement `Right(str, n)` - substring from end
- [ ] Implement `Mid(str, start, len)` - substring with position
- [ ] Implement `Upper/Lower` - case conversion
- [ ] Implement `Replace(str, find, sub)` - string replacement
- [ ] Implement `Instr(str, find, start)` - find substring
- [ ] Implement `Len(str)` - string length
- [ ] Implement `Trim/LTrim/RTrim` - whitespace trimming

### Sub-tasks for 2.2 (Seeded Random)
- [ ] Add random state object to `Blitz3DCore`
- [ ] Implement LCG (Linear Congruential Generator) algorithm
- [ ] Wire `SeedRnd(seed)` to initialize state
- [ ] Update `Rnd`/`Rand` to use seeded generator

### Sub-tasks for 2.3 (Asc/Chr/Hex/Bin)
- [ ] Add `Asc(str)` - character to ASCII code
- [ ] Add `Chr(n)` - ASCII code to character
- [ ] Add `Hex(n)` - integer to hex string
- [ ] Add `Bin(n)` - integer to binary string
- [ ] Register in `CodeGenerator.swift` function registry

### Sub-tasks for 2.4 (File I/O)
- [ ] Implement real `ReadFile` using VFS
- [ ] Implement `WriteFile` for save games
- [ ] Implement `ReadInt/Float/String/Byte/Short`
- [ ] Implement `Eof` checking
- [ ] Connect to IndexedDB for persistence

---

## Phase 3: Graphics & Entity API
**Priority: MEDIUM-HIGH** - Required for 3D rendering

| Task | Files | Effort |
|------|-------|--------|
| **3.1 VertexTexCoords** | `graphics.js`, `mesh.js` | 1 day |
| **3.2 Entity Properties** | `graphics.js` | 2-3 days |
| **3.3 Camera Sub-Viewports** | `graphics.js` | 1-2 days |
| **3.4 Entity Name System** | `graphics.js`, `runtime.js` | 2 days |

### Sub-tasks for 3.1 (VertexTexCoords)
- [ ] Add UV coordinate support to surface vertices
- [ ] Store in `VertexData` structure
- [ ] Pass to Three.js BufferGeometry

### Sub-tasks for 3.2 (Entity Properties)
- [ ] Implement `EntityAlpha(entity, alpha)` - transparency
- [ ] Implement `EntityColor(entity, r, g, b)` - diffuse color
- [ ] Implement `EntityFX(entity, fx)` - special effects
- [ ] Implement `EntityBlend(entity, blend)` - blend mode
- [ ] Implement `PointEntity(entity, target)` - look at

### Sub-tasks for 3.3 (Sub-Viewports)
- [ ] Add `CameraViewport(cam, x, y, w, h)`
- [ ] Add `CameraProjMode(cam, mode)` - perspective/orthographic
- [ ] Handle multiple viewports in `RenderWorld`

### Sub-tasks for 3.4 (Entity Names)
- [ ] Implement `NameEntity(entity, name)` - assign name
- [ ] Implement `EntityName(entity)` - retrieve name
- [ ] Store in entity registry Map

---

## Phase 4: FMOD Audio (Full Implementation)
**Priority: MEDIUM** - Required for sound/music

| Task | Files | Effort |
|------|-------|--------|
| **4.1 FSOUND_Init with Web Audio** | `audio.js`, `core.js` | 2-3 days |
| **4.2 Stream Playback** | `audio.js` | 3-4 days |
| **4.3 Positional Audio** | `audio.js` | 2-3 days |
| **4.4 Sample Management** | `audio.js` | 2 days |

### Sub-tasks for 4.1 (FSOUND_Init)
- [ ] Create `AudioContext` on init
- [ ] Configure sample rate and channels
- [ ] Implement master gain node

### Sub-tasks for 4.2 (Stream Playback)
- [ ] Implement `FSOUND_Stream_Open` - load audio file
- [ ] Implement `FSOUND_Stream_Play` - start playback
- [ ] Implement `FSOUND_Stream_Stop` - stop
- [ ] Implement pause/resume via `SetPaused`
- [ ] Support MP3/OGG/WAV via Web Audio decodeAudioData

### Sub-tasks for 4.3 (Positional Audio)
- [ ] Create `PannerNode` for 3D positioning
- [ ] Connect to entity position updates
- [ ] Implement distance attenuation
- [ ] Implement `SetVolume` per channel

### Sub-tasks for 4.4 (Samples)
- [ ] Implement `LoadSound` - load into AudioBuffer
- [ ] Implement `PlaySound` - trigger one-shot
- [ ] Implement 3D sound sources attached to entities

---

## Phase 5: SCP:CB Specific Integration
**Priority: MEDIUM** - Features specific to the game

| Task | Files | Effort |
|------|-------|--------|
| **5.1 Movie Playback** | `video.js`, `runtime.js` | 2-3 days |
| **5.2 Networking (Multiplayer)** | `net.js` | 3-4 days |
| **5.3 Zlib Decompression** | `vfs.js` | 2 days |
| **5.4 Full Game Testing** | Test files | Ongoing |

### Sub-tasks for 5.1 (Movie Playback)
- [ ] Implement `OpenMovie(path)` - HTML5 video element
- [ ] Implement `DrawMovie(x, y, w, h)` - render to texture
- [ ] Implement `MoviePlaying()` - check if playing
- [ ] Support autoplay on start screen

### Sub-tasks for 5.2 (Networking)
- [ ] Implement `OpenTCPStream` via WebSocket
- [ ] Implement `ReadAvail` - check available bytes
- [ ] Implement `WriteLine` / `ReadLine` - message passing
- [ ] Handle SCP:CB multiplayer protocol

### Sub-tasks for 5.3 (Zlib)
- [ ] Implement `ZlibWapi_Open` - read ZIP file
- [ ] Implement file enumeration
- [ ] Implement `ExtractFile` with decompression
- [ ] Use pako library for inflate

---

## Phase 6: Optimization & Polish
**Priority: LOW** - After everything works

| Task | Files | Effort |
|------|-------|--------|
| **6.1 Performance Tuning** | Runtime | Ongoing |
| **6.2 Asset Pipeline** | Build tools | 2-3 days |
| **6.3 Save Game Persistence** | IndexedDB | 2 days |
| **6.4 Debug Tools** | Debug module | Ongoing |

---

## Parallel Work Streams

### Stream A: Language Features (Compiler)
- 1 developer on Phase 1 tasks in sequence (dependent)

### Stream B: Runtime Core
- 1 developer on Phase 2 (String functions, File I/O)

### Stream C: Graphics & Audio
- 1 developer on Phase 3 + Phase 4 (can run in parallel with Stream B)

### Stream D: SCPCB Integration
- 1 developer on Phase 5 (movie, networking, zip)

---

## Dependencies

```
Phase 1 (Language) ──────► Phase 6 (Full Game)
       │                        ▲
       │                        │
       ▼                        │
Phase 2 (Core Runtime) ─────────┤
       │                        │
       │                        │
Phase 3 (Graphics) ─────────────┤
       │                        │
       │                        │
Phase 4 (Audio) ────────────────┤
       │                        │
       │                        │
Phase 5 (SCPCB Specific) ───────┘
```

---

## Estimated Timeline

| Phase | Duration | After Phase |
|-------|----------|-------------|
| Phase 1: Language | 6-10 days | Base |
| Phase 2: Core Runtime | 8-12 days | Phase 1 |
| Phase 3: Graphics | 6-9 days | Phase 2 |
| Phase 4: Audio | 9-12 days | Phase 2 |
| Phase 5: SCPCB Specific | 9-11 days | Phase 2-4 |
| Phase 6: Optimization | Ongoing | All prior |

**Total Estimated Time:** 3-5 months with 1-2 developers

**Critical Path:** Phase 1 → Phase 2 → Phase 5 → Phase 6

---

## Success Criteria

1. ✅ SCP:CB source code compiles without errors
2. ✅ Intro movies play
3. ✅ Player can walk around test chamber
4. ✅ Audio plays (ambient + sound effects)
5. ✅ NPCs render and animate
6. ✅ Save/load system works
7. ✅ Full containment breach scenario playable

---

## Progress Log

| Date | Phase | Task | Status |
|------|-------|------|--------|
| 2026-01-19 | 1 | Type Field Arrays | COMPLETE |
| 2026-01-19 | 1 | Field Default Values | COMPLETE |
| 2026-01-19 | 1 | Handle/Object Casting | COMPLETE |
| 2026-01-19 | 1 | Multi-Value Case | COMPLETE |
| 2026-01-19 | 2 | String Functions | IN PROGRESS |
