# Directory: blitz3d-wasm/Sources/Runtime

**Parent**: [../](..)

**Description**: The JavaScript Runtime environment. Since WebAssembly cannot
directly access the DOM, WebGL, or FileSystem, this runtime provides the "OS"
for the compiled Blitz3D game.

### Structure

- **`JS/`**: Core JavaScript loader and module system.
  - `loader.js`: Initializes the WASM module and sets up imports.
  - `runtime.js`: The central registry of runtime functions.
- **`modules/`**: Specific subsystem implementations.
  - `graphics.js`: WebGL/Canvas rendering (Blitz3D `Graphics3D`, `Image`
    commands).
  - `input.js`: Keyboard/Mouse handling (`KeyDown`, `MouseX`).
  - `audio.js`: Sound playback.
  - `filesystem.js`: Virtual file system for `ReadFile`/`WriteFile`.
  - `blitz3d.js`: General language helpers (`MilliSecs`, `DebugLog`).

### How it works

The Compiler generates WASM that expects certain imports (e.g.,
`env.bb_Graphics`). The Runtime provides these functions during WASM
instantiation. When the WASM code calls `bb_Graphics`, it executes the
JavaScript code in `graphics.js`.
