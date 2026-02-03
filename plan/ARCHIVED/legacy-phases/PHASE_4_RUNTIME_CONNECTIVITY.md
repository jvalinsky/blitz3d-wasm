# Phase 4: Runtime & Connectivity

This phase handles the most platform-specific features like networking and external DLL compatibility.

## 1. Networking (Stub/Bridge)
SCP:CB uses networking primarily for version checking.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `OpenTCPStream(server$, port)`
    - `ReadAvail(stream)`
    - `WriteLine(stream, string$)`
    - `ReadLine$(stream)`
- [ ] **Runtime (JS):** 
    - Implement a "Virtual Stream" using `fetch` or WebSockets.
    - For initial port, return failure/empty to allow the game to bypass the update check gracefully.

## 2. External Library (.decls) Support
Support for FMOD and Zlib.

### Tasks:
- [ ] **Infrastructure:** Decide on a strategy for `.decls` files.
    - Option A: Add a `.decls` parser to the compiler.
    - Option B: Manually add required signatures to `CodeGenerator.swift` (Recommended for MVP).
- [ ] **CodeGenerator:** Add imports for critical FMOD (`FSOUND_*`) and Zlib (`ZlibWapi_*`) functions.
- [ ] **Runtime (JS):**
    - Map FMOD calls to Web Audio API.
    - Map Zlib calls to `CompressionStream` API or a small JS library.

## 3. Movie Playback
Support for intro and ending cutscenes.

### Tasks:
- [ ] **CodeGenerator:** Add imports for:
    - `OpenMovie(filename$)`
    - `DrawMovie(movie, x, y, [w], [h])`
    - `MoviePlaying(movie)`
- [ ] **Runtime (JS):** Implement using HTML5 `<video>` tags rendered onto a texture in the Three.js scene.

## Verification
- Compile and validate `Main.bb` (Full entry point).
- Test audio playback and decompression in the browser runtime.
