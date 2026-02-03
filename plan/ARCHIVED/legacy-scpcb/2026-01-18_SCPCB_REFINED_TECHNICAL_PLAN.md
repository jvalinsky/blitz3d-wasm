# SCP:CB WASM Refined Technical Plan

**Timestamp:** Sun Jan 18 19:04:13 EST 2026
**Status:** Build / Implementation

This document outlines the refined technical strategy for porting SCP: Containment Breach to the browser using the Blitz3D WASM compiler.

---

## Phase 1: Compiler Infrastructure (Current Focus)
**Goal:** Robust transformation of legacy Blitz3D control flow and symbol management.

- **State Machine V2:**
    - Transform functions containing `Goto` or `Gosub` into a structured state machine.
    - Each code block between labels becomes an isolated `if (state == ID)` block.
    - Implement automatic fall-through by updating the state variable at the end of each block.
- **Case-Insensitivity:**
    - Normalize all Functions, Variables, Types, and Labels to lowercase during symbol registration.
    - Matches Blitz3D's original behavior and prevents cross-module linking errors.
- **Loop Integrity:**
    - Recalculate branch depths for `Exit` and `Continue` to account for the additional nesting of state machine chunks.

## Phase 2: The Three.js Bridge
**Goal:** Seamless translation of the Blitz3D 3D engine to WebGL.

- **Handedness Bridge:**
    - Mirror the Z-axis in `PositionEntity`, `RotateEntity`, and `MoveEntity`.
    - Converts Blitz3D's Left-Handed system to Three.js's Right-Handed system transparently.
- **RMESH / Dynamic Mesh API:**
    - Map `CreateSurface`, `AddVertex`, and `AddTriangle` to Three.js `BufferGeometry`.
    - Use `DynamicDraw` usage flags to support runtime geometry generation.
- **Entity ID Registry:**
    - Maintain a unified `Map<Int, THREE.Object3D>` in the runtime for efficient handle-based lookups.

## Phase 3: Memory & Asset Flow
**Goal:** Performance and stability for large-scale assets.

- **Heap Recycling (FreeLists):**
    - Implement `FreeLists` for each User-Defined Type.
    - Reclaim memory on `Delete` to prevent leaks during long play sessions.
- **Reference-Counted Strings:**
    - Use a standard string header `[refCount, length, data]`.
    - Optimizes the heavy string concatenation used in the UI and log systems.
- **glTF Conversion Pipeline:**
    - Automated conversion of `.b3d` to `.glb` (glTF Binary) with **Draco compression**.
    - Reduces the 500MB original asset size to ~60MB for fast web delivery.

## Phase 4: Browser Connectivity
**Goal:** Native-feeling web integration.

- **Asynchronous Main Loop:**
    - Unroll the blocking `While...Wend` game loop into an `Update()` function driven by `requestAnimationFrame`.
- **Web Worker Execution:**
    - Offload game logic to a Web Worker to keep the UI thread responsive.
- **FMOD to Web Audio:**
    - Emulate positional audio and radio filters using `PannerNode` and `BiquadFilterNode`.
- **IndexedDB Persistence:**
    - Store save games and cached assets in **IndexedDB** for offline support and large capacity.
