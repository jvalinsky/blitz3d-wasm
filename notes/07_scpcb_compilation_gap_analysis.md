# SCP:CB Compilation Gap Analysis

This document details the remaining features required for the Blitz3D WASM compiler to successfully compile the full SCP: Containment Breach source code.

## 1. Language & Parser Enhancements
These core syntax patterns are prevalent in the SCP:CB codebase but are currently unsupported or partially implemented in the compiler.

### Type Field Arrays (High Priority)
*   **Usage:** `Field NPC.NPCs[12]`, `Field SoundEmitter%[MaxRoomEmitters]`
*   **Current State:** Parser skips the bracketed section; CodeGen ignores the array size.
*   **Requirement:** Update `Parser.parseTypeDeclaration` to capture array dimensions and `CodeGenerator.processTypeDeclarations` to allocate appropriate memory space in the type instance.

### Field Default Values
*   **Usage:** `Field MaxLights% = 0`
*   **Current State:** Parser expects only field names and type suffixes.
*   **Requirement:** Support assignment syntax within `Type` blocks and ensure the `New` opcode initializes these fields to their specified defaults.

### Object & Handle Logic
*   **Usage:** `Local h = Handle(myInstance)`, `Local obj.NPCs = Object.NPCs(h)`
*   **Current State:** Keywords are parsed, but no WASM is emitted.
*   **Requirement:** Implement a lookup table (or simple pointer-to-int conversion) to allow passing type instances as integers and casting them back safely.

### Multi-Value Case Statements
*   **Usage:** `Case 1, 2, 3`, `Case x To y`
*   **Current State:** Only single-value `Case` statements are supported.
*   **Requirement:** Update `parseSelectStatement` and `StatementGeneration.generateSelect` to handle multiple branch conditions for a single block.

## 2. Missing Engine API Imports
The following command groups must be added to the registry in `CodeGenerator.swift` and implemented in the browser runtime.

### Dynamic Mesh API (RMESH Support)
*   **Commands:** `CreateSurface`, `AddVertex`, `AddTriangle`, `VertexColor`, `VertexTexCoords`, `UpdateNormals`, `CountSurfaces`, `GetSurface`.
*   **Impact:** Essential for the custom room loading system.

### Entity Properties & Effects
*   **Commands:** `PointEntity`, `EntityAlpha`, `EntityColor`, `EntityFX`, `EntityBlend`, `NameEntity`, `EntityName`.
*   **Impact:** Used for visual cues and NPC identification.

### System & High-Resolution Input
*   **Commands:** `MilliSecs` (timer), `AppTitle`, `WaitKey`, `JoyDown`, `JoyHit`.
*   **Impact:** Core game loop timing and initialization.

### Missing Core Built-ins
*   **Commands:** `Asc`, `Chr`, `Hex`, `Bin`.
*   **Impact:** Used extensively in string manipulation and bank data dumping.

## 3. Networking & Platform Bridging
### TCP/IP Networking
*   **Commands:** `OpenTCPStream`, `ReadAvail`, `WriteLine`, `ReadLine`.
*   **Strategy:** Map to WebSockets or `fetch` APIs in the browser runtime.

### External Library (.decls) Support
*   **Modules:** FMOD (audio), Zlib (compression), User32/Kernel32 (Windows APIs).
*   **Strategy:** Provide WASM imports for critical functions and mock/stub non-essential system calls.

### Movie Playback
*   **Commands:** `OpenMovie`, `DrawMovie`, `MoviePlaying`.
*   **Strategy:** Map to HTML5 `<video>` element rendering via Three.js texture.

## 4. Implementation Plan

| Phase | Target | Milestone |
| :--- | :--- | :--- |
| **Phase 1** | **Infrastructure** | Implement Type Field Arrays, Default Values, and Handle/Object casting. |
| **Phase 2** | **Graphics API** | Add Dynamic Mesh manipulation and advanced Entity properties. |
| **Phase 3** | **System Utility** | Import missing String (`Asc`/`Chr`) and System (`MilliSecs`) functions. |
| **Phase 4** | **Connectivity** | Stub/Implement Networking and External Library imports. |
