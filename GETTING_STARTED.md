# Getting Started Guide

## Overview

This guide helps you get started with Blitz3D-WASM, from setting up the
development environment to running your first compiled game in the browser.
Blitz3D-WASM is a production-ready compiler that successfully runs complex games
like SCP: Containment Breach.

## Quick Start

### Prerequisites

- **Swift 6.0+** (`swift --version` should show 6.x)
- **Deno** (`deno --version` should show 2.x)
- **Git** for cloning the repository
- **Modern browser** (Chrome/Firefox/Edge with WebAssembly support)

### Setup Steps

1. **Clone Repository**
   ```bash
   git clone https://github.com/jvalinsky/blitz3d-wasm.git
   cd blitz3d-wasm
   ```

2. **Build Compiler**
   ```bash
   swift build -c release
   ```

3. **(Optional) Run the BB→WASM smoke suite**

   This is the fastest way to verify “core language + runner” behavior
   end-to-end.

   ```bash
   deno test --allow-read --allow-write=/tmp --allow-run=deno Tools/tests/bb_deno_compile_and_run_smoke.test.ts
   ```

   If a test hangs, it should be killed by the watchdog timeout (by design).

4. **Setup Web Development**
   ```bash
   deno task web:setup
   ```

5. **Run Development Server**
   ```bash
   deno task web:dev
   ```

6. **Open Browser** Navigate to `http://localhost:8000`

You should see the Blitz3D-WASM interface with debugging tools ready.

## First Project

### Simple Particle System

Create a new file `particles.bb`:

```blitz3d
; particles.bb - Simple particle system demo

; Set up graphics mode
Graphics3D 800, 600, 32, 2

; Camera setup
camera = CreateCamera()
PositionEntity camera, 0, 0, -5
CameraClsColor camera, 0, 0, 32

; Particle system
Const MAX_PARTICLES% = 100
Dim particles(MAX_PARTICLES)

Type Particle
    Field entityHandle%
    Field x#, y#, z#
    Field vx#, vy#, vz#
    Field life#
End Type

; Create particles
For i = 1 To MAX_PARTICLES
    p.Particle = New Particle
    p\entityHandle = CreateCube()
    ScaleEntity p\entityHandle, 0.05, 0.05, 0.05
    p\x = (Rnd(2) - 1) * 3
    p\y = Rnd(5)
    p\z = (Rnd(2) - 1) * 3
    p\vx = (Rnd(2) - 1) * 0.1
    p\vy = -Rnd(0.2) - 0.1
    p\vz = (Rnd(2) - 1) * 0.1
    p\life = Rnd(100) + 50
Next

; Main game loop
While Not KeyHit(1) ; ESC to quit
    ; Update particles
    For p.Particle = Each Particle
        ; Apply gravity
        p\vy = p\vy - 0.01
        
        ; Update position
        p\x = p\x + p\vx
        p\y = p\y + p\vy
        p\z = p\z + p\vz
        
        ; Update entity
        PositionEntity p\entityHandle, p\x, p\y, p\z
        
        ; Decrease life
        p\life = p\life - 1
        
        ; Reset if dead
        If p\life <= 0 Then
            p\x = (Rnd(2) - 1) * 3
            p\y = Rnd(5)
            p\z = (Rnd(2) - 1) * 3
            p\vx = (Rnd(2) - 1) * 0.1
            p\vy = -Rnd(0.2) - 0.1
            p\vz = (Rnd(2) - 1) * 0.1
            p\life = Rnd(100) + 50
        EndIf
        
        ; Fade based on life
        alpha# = p\life / 100.0
        EntityAlpha p\entityHandle, alpha#
    Next
    
    ; Update camera
    UpdateWorld
    RenderWorld
    Flip
Wend

; Cleanup
For p.Particle = Each Particle
    FreeEntity p\entityHandle
Next
```

### Compile and Run

1. **Compile to WASM**
   ```bash
   .build/release/blitz3d-wasm particles.bb -o particles.wasm --debug
   ```

2. **Validate WASM**
   ```bash
   wasm-validate particles.wasm
   ```

3. **Run in Browser** Copy `particles.wasm` to the web directory and open
   `http://localhost:8000/test.html?file=particles.wasm`

## Safe runner demos (2026-02-02)

Two “no-freeze” runner entry points exist:

- `web/public/bb_wasm_runner_demo.html`
  - Upload a compiled `.wasm` and run it in a Worker with a watchdog timeout.
- `web/interpreter.html`
  - The in-browser editor/compile UI, now executing compiled modules in a Worker
    with a Stop button + timeout.
  - When using the Vite dev server / build pipeline, `interpreter.html` is a
    first-class entrypoint (no CDN globals; uses bundled npm deps like `three`).

**Why**: BB programs can contain infinite loops; in the browser this must never
lock the UI thread.

## Notes on `deno task web:build`

`deno task web:build` uses Vite to build the `web/` frontend.

If you see a Vite/Rollup error about failing to resolve `three`, run:

```bash
deno task web:setup
```

`web:setup` now prefetches the required npm deps (including `three`) and also
runs the SCPCB public/ manifest setup (`web/setup.ts`).

If you cannot fetch npm deps (offline / restricted network), you can still serve
the static `web/public/*.html` demos without running the Vite pipeline.

The production build is multi-page and should emit at least:

- `dist/index.html`
- `dist/interpreter.html`

## Development Workflow

### Project Structure

For a real project, use this structure:

```
my_game/
├── src/
│   ├── main.bb           # Entry point
│   ├── player.bb         # Player logic
│   ├── enemies.bb        # Enemy AI
│   └── utils.bb          # Utility functions
├── assets/
│   ├── models/           # 3D models (.b3d)
│   ├── textures/         # Textures (.png, .jpg)
│   └── sounds/          # Audio files (.wav, .mp3)
├── web/
│   ├── index.html        # Game HTML
│   └── runtime.js       # Runtime wrapper
└── project.json         # Project configuration
```

### Project Configuration

Create `project.json`:

```json
{
  "entry": "src/main.bb",
  "sources": [
    "src/main.bb",
    "src/player.bb",
    "src/enemies.bb",
    "src/utils.bb"
  ],
  "assets": ["assets/"],
  "output": "game.wasm",
  "debug": true,
  "embedAssets": false,
  "manifest": true
}
```

### Include System

Use `Include` statements for modular code:

```blitz3d
; main.bb
Include "utils.bb"
Include "player.bb"
Include "enemies.bb"

; Game initialization
Function InitGame()
    SetupGraphics()
    LoadAssets()
    CreatePlayer()
    SpawnEnemies()
End Function

; Main game loop
Function MainGame()
    UpdatePlayer()
    UpdateEnemies()
    RenderFrame()
End Function

InitGame()
While Not GameOver()
    MainGame()
Wend
```

```blitz3d
; utils.bb
; Mathematical utilities
Function Distance#(x1#, y1#, z1#, x2#, y2#, z2#)
    dx# = x2# - x1#
    dy# = y2# - y1#
    dz# = z2# - z1#
    Return Sqr(dx#*dx# + dy#*dy# + dz#*dz#)
End Function

; Random range function
Function RndRange#(min#, max#)
    Return Rnd() * (max# - min#) + min#
End Function
```

## Building Assets

### 3D Models

Blitz3D-WASM supports B3D, X, and RMesh formats:

```bash
# Convert model to web format during build
deno task web:build

# Manual conversion
deno run -A Tools/convert_b3d_to_smpk.ts model.b3d -o model.smpk
```

### Asset Organization

Assets are automatically converted to SMPK format for web deployment:

```
web/public/assets/
├── models/
│   ├── player.b3d     → models/player.smpk
│   └── enemy.b3d     → models/enemy.smpk
├── textures/
│   ├── player.png     → textures/player.smpk
│   └── environment.png → textures/environment.smpk
└── sounds/
    ├── shoot.wav      → sounds/shoot.smpk
    └── ambient.wav    → sounds/ambient.smpk
```

## Testing

### Compiler Testing

```bash
# Test compilation
swift test

# Compile with verbose output
swift run blitz3d-wasm main.bb -o test.wasm --verbose

# Check WASM output
wasm-validate test.wasm
wasm-objdump test.wasm | head -20
```

### Runtime Testing

```bash
# Run all tests
deno task test:all

# Memory leak detection
deno task memleak:run --wasm test.wasm --cycles 5 --verbose

# WebGPU testing (if supported)
deno task memleak:webgpu --iterations 50 --verbose
```

### Browser Testing

```javascript
// Test loading in browser console
async function testWasm() {
  try {
    const result = await Blitz3D.load("game.wasm");
    console.log("WASM loaded successfully:", result);

    // Test function calls
    const entity = Blitz3D.createCube();
    console.log("Created entity:", entity);
  } catch (error) {
    console.error("WASM failed to load:", error);
  }
}

testWasm();
```

## Debugging

### Browser Debug Tools

Access debugging features with URL parameters:

- `?debug=1` - Show debug overlay
- `?pause=1` - Start paused (for stepping)
- `?verbose=1` - Verbose logging
- `?nogpu=1` - Skip GPU initialization

Example: `http://localhost:8000/test.html?debug=1&pause=1&verbose=1`

### Debug Overlay

The debug overlay shows:

- **FPS**: Current frame rate
- **Entities**: Active entity count
- **Memory**: WASM and JavaScript memory usage
- **Commands**: Command buffer statistics
- **Errors**: Recent error messages

### WASM Debugging

Enable debug logging:

```blitz3d
; In your Blitz3D code
DebugLog "Initializing player system"
DebugLog "Player position: " + Str$(player\x) + "," + Str$(player\y) + "," + Str$(player\z)
```

### Browser Console

Check browser console for detailed error messages:

```javascript
// Enable WASM logging
Blitz3D.setLogLevel("debug");

// Monitor memory usage
setInterval(() => {
  const memory = Blitz3D.getMemoryUsage();
  console.log("WASM Memory:", memory);
}, 5000);
```

## Common Issues

### Setup Problems

**"Swift not found"**:

```bash
# macOS: Install Xcode Command Line Tools
xcode-select --install

# Linux: Install Swift via package manager
# Ubuntu/Debian
sudo apt-get install swift swift-clang

# Or install from swift.org
```

**"wasm-validate not found"**:

```bash
# macOS
brew install wabt

# Linux
sudo apt-get install wabt

# Or download from GitHub releases
```

### Compilation Issues

**"Undefined function" errors**:

- Check function names match runtime imports
- Verify `Include` files are found
- Use `--verbose` flag for detailed error messages

**"Type mismatch" errors**:

- Ensure parameter types match function signatures
- Check for proper type conversions
- Use `DebugLog` to trace variable values

### Runtime Issues

**"WASM failed to load"**:

- Validate WASM file: `wasm-validate game.wasm`
- Check browser console for specific error
- Verify runtime.js is loaded correctly

**"No entities visible"**:

- Check camera positioning
- Verify entity creation succeeded
- Ensure lighting is configured
- Check entity visibility flags

### Performance Issues

**Low frame rate**:

- Reduce particle count
- Optimize entity updates
- Check for memory leaks
- Profile with debug overlay

**High memory usage**:

- Run memory leak detection
- Check for undisposed resources
- Optimize asset loading
- Monitor WASM memory growth

## Next Steps

### Learning Resources

1. **Documentation**: Read the full API documentation in `docs/API.md`
2. **Examples**: Study examples in the `Examples/` directory
3. **Compiler Internals**: Understand the compilation process in
   `docs/compiler/`
4. **Runtime Architecture**: Learn about the command buffer system

### Community

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share projects
- **Contributing**: See `CONTRIBUTING.md` for development guidelines

### Advanced Topics

Once comfortable with basics, explore:

- **Command Buffer System**: Direct WASM→JS communication
- **Memory Management**: Advanced leak detection and prevention
- **Asset Pipeline**: SMPK format and optimization
- **Performance Tuning**: Optimization techniques and profiling

---

Welcome to Blitz3D-WASM development! You now have everything needed to create
and deploy browser-based 3D games using the Blitz3D language. Start with simple
projects, experiment with the examples, and gradually build up to more complex
applications.
