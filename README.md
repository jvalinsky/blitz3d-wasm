# Blitz3D WASM Compiler

A Swift-based compiler that translates Blitz3D BASIC to WebAssembly.

## Building

```bash
swift build
```

## Usage

### Single File

```bash
swift run blitz3d-wasm input.bb -o output.wasm
```

### Multi-File Project with Project File

Create a `project.json` file:

```json
{
    "entry": "src/main.bb",
    "sources": ["src/main.bb", "src/utils.bb"],
    "assets": ["assets/"],
    "output": "game.wasm"
}
```

Then compile:

```bash
blitz3d-wasm project.json -o game.wasm --assets ./assets
```

### Command Line Options

```
blitz3d-wasm [options] <input.bb|project.json> [-o <output.wasm>]

Options:
  -o, --output <file>     Output WASM file (default: input.wasm)
  -g, --source-map        Generate source map (.wasm.map)
  -d, --debug             Instrument with live debug hooks
  --quiet                 Suppress non-error compiler logs
  --verbose               Enable verbose compiler logs
  -h, --help              Show this help
  -t, --tokens            Show tokens only (debug)
  -w, --wat               Output WebAssembly text format (.wat)
  -a, --assets <dir>      Include assets from directory
  -I, --input-dir <dir>   Input directory for multi-file projects
  -p, --project <file>    Project file (JSON) specifying sources and assets
  --no-dedupe-includes    Do not dedupe repeated Include statements
  --embed-assets          Embed assets into WASM data sections
  --manifest              Generate asset manifest JSON
```

### Include Statements

Multi-file projects are supported via `Include` statements:

```blitz3d
; main.bb
Include "utils.bb"

; ... rest of code
```

By default, includes are deduped to avoid accidental double-inclusion. Use `--no-dedupe-includes` if you need strict textual inclusion.

## Running in Browser

1. Compile your code to WASM
2. Include `runtime.js` in your HTML
3. Load the WASM module:

```html
<script src="runtime.js"></script>
<script>
Blitz3D.load('game.wasm', 'canvasId').catch(err => {
    console.error(err);
});
</script>
```

### Asset Loading

Assets can be loaded from embedded WASM memory or external files:

```javascript
// Load asset manifest (for embedded assets)
Blitz3D.loadAssetManifest('game_manifest.json');

// Load an asset
Blitz3D.loadAsset('textures/player.png').then(asset => {
    // Use asset.data (ArrayBuffer)
});
```

## Project Structure

```
blitz3d-wasm/
├── Sources/
│   ├── Compiler/
│   │   ├── Lexer/
│   │   ├── Parser/
│   │   ├── AST/
│   │   ├── Preprocessor/
│   │   └── CodeGen/
│   └── Runtime/
│       ├── runtime.js
│       └── index.html
├── Tools/
│   └── wasm-cli/
├── Tests/
├── test_project/
│   ├── project.json
│   ├── src/
│   └── assets/
└── Package.swift
```
