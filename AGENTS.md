# Blitz3D-WASM

A compiler and runtime that compiles Blitz3D BASIC to WebAssembly for browser
execution.

## Project Status (January 2026)

**Compiler**: Production-ready (~17K lines Swift) — 94.7% SCPCB pass rate\
**Runtime**: Sophisticated TypeScript runtime (~12K lines) with command buffers\
**Target**: Run SCP: Containment Breach in browser

### Working Demo

**https://blitz3d.exe.xyz:8000/test.html** - Particle system demo

- Particles fall with gravity
- Alpha fading and deletion
- All logic in compiled BB → WASM
- JS only provides Three.js rendering calls

## Architecture

**WASM does game logic. JS provides browser API bindings.**

```
┌─────────────────────────────────────────────────────────────┐
│                   WASM (Compiled BB Code)                    │
├─────────────────────────────────────────────────────────────┤
│ • Type system (New, Delete, linked lists)                   │
│ • Field access (p\x, p\y, p\obj)                            │
│ • Physics/math (gravity, velocity, distance)                │
│ • Game logic (AI, events, state)                            │
│ • Control flow (If, While, For Each)                        │
│ • Memory management                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ imports runtime functions
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                TypeScript Runtime (~12K lines)               │
├─────────────────────────────────────────────────────────────┤
│ • CreateSprite/Mesh → Three.js objects                      │
│ • PositionEntity → obj.position.set()                       │
│ • EntityAlpha → material.opacity                            │
│ • LoadSound/PlaySound → Web Audio                           │
│ • KeyDown/MouseX → DOM events                               │
│ • Command buffer system → batch WASM→JS calls               │
│ • Virtual filesystem → ZIP-based asset loading              │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
blitz3d-wasm/
├── Sources/
│   ├── Compiler/          # Swift compiler (~17K lines)
│   │   ├── Lexer/         # Tokenizer
│   │   ├── Parser/        # Recursive descent (~2.2K lines)
│   │   ├── AST/           # Syntax tree nodes
│   │   ├── IR/            # Intermediate representation
│   │   ├── Lowering/      # AST → IR (~1.3K lines)
│   │   └── CodeGen/       # WASM generation
│   │
│   ├── Runtime/
│   │   ├── thin/          # Minimal demo runtime (~500 lines JS)
│   │   │   ├── runtime.js # Browser bindings for particle demo
│   │   │   ├── test.html  # Working particle demo
│   │   │   └── particles.bb
│   │   ├── JS/            # Legacy TS/JS runtime bindings
│   │   └── modules/       # Legacy full runtime
│   │
│   └── Blitz3DEngine/     # Swift asset parsers
│
├── web/                   # Modern web frontend
│   ├── src/
│   │   ├── main.ts        # SCPCB loader (~2K lines)
│   │   ├── runtime/       # TypeScript runtime (~9K lines)
│   │   │   ├── core.ts    # Core runtime functions
│   │   │   ├── graphics.ts # Three.js integration (~3.7K lines)
│   │   │   ├── fileio.ts  # Virtual filesystem (~1K lines)
│   │   │   ├── b3d.ts     # B3D format parser
│   │   │   └── smpk.ts    # SMPK format loader
│   │   ├── shared/        # Command buffer, boot state (~560 lines)
│   │   └── worker/        # Web worker harness (~935 lines)
│   └── public/            # Built assets and manifests
│
├── Tools/                 # Development and testing tools
│   ├── memleak/           # Memory leak detection suite
│   ├── smpk/              # Asset format tools
│   ├── analyzer/          # WASM analysis and visualization
│   └── tests/             # Comprehensive test suite
│
├── Tests/
│   ├── CompilerTests/     # Swift unit tests
│   ├── fixtures/          # Test .bb files
│   └── IntegrationTests/  # Browser tests
│
├── docs/                  # Documentation
│   ├── COMPILER_STATUS_ANALYSIS.md  # Compiler metrics
│   ├── COMMAND_BUFFER_SYSTEM.md     # Binary protocol spec
│   ├── SMPK_SYSTEM.md               # Asset format spec
│   └── compiler_improvements/       # Compiler design docs
│
├── plan/                  # Implementation phases
│   ├── README.md          # Plan index
│   └── scpcb-web-track-b/ # SCPCB web port execution plans
│
└── Examples/              # Demo projects
```

## Building

### Prerequisites

- Swift 6.0+ (`swift --version`)
  - For WebAssembly compilation support, see [docs/SWIFT_WASM_SETUP.md](docs/SWIFT_WASM_SETUP.md)
- Deno (for web development and testing)
- wabt (for wasm-validate)

### Development Workflow for Demos

**IMPORTANT**: When editing demo HTML files (e.g., `web/public/npc_smpk_demo.html`), always run the deployment script after making changes:

```bash
cd /home/exedev/Software/blitz3d-wasm
./deploy.sh
```

This script:
1. Builds TypeScript sources (if needed)
2. Creates/updates web root at `/var/www/html` (nginx web root)
3. Copies HTML and static assets
4. Copies built JavaScript/TypeScript dist
5. Converts and copies NPC models (if source B3D files exist)

**Do NOT manually copy files to `/var/www/html`** - use the deploy script to ensure all changes are properly deployed.

**Note**: The deployment uses nginx which is already running on port 8000. After deployment, the demo is immediately available at:
- Local: `http://localhost:8000/npc_smpk_demo.html`
- Public: `https://blitz3d.exe.xyz:8000/npc_smpk_demo.html`

No need to start a separate web server - nginx is already configured to serve from `/var/www/html` on port 8000.

### Linux Note

Comment out the macOS linker flag in Package.swift:

```swift
// linkerSettings: [.unsafeFlags(["-Xlinker", "-stack_size", "-Xlinker", "0x10000000"])]
```

### Compile

```bash
# Build compiler
swift build

# Compile a .bb file
.build/debug/blitz3d-wasm input.bb -o output.wasm

# Validate output
wasm-validate output.wasm
```

### Run Thin Demo (Minimal Particle Demo)

```bash
cd Sources/Runtime/thin
python3 -m http.server 8000
# Open http://localhost:8000/test.html
```

### Run NPC Demo (SCPCB Models)

The NPC demo (`web/public/npc_smpk_demo.html`) showcases SCPCB character models with skeletal animation:

1. Deploy to web root:
   ```bash
   cd /home/exedev/Software/blitz3d-wasm
   ./deploy.sh
   ```

2. Open in browser (nginx is already running):
   - Local: `http://localhost:8000/npc_smpk_demo.html`
   - Public: `https://blitz3d.exe.xyz:8000/npc_smpk_demo.html`

Features:
- Load SCPCB NPC models (SCP-173, SCP-049, Guard, Class-D, etc.)
- Skeletal animation playback with Three.js AnimationMixer
- Animation controls: play/pause, speed adjustment (0.25x-2.0x), frame scrubbing
- Clip and sequence selection
- Real-time frame counter

## Web UI (SCPCB Loader)

The `web/` frontend is intended to be driven via Deno tasks (no `npm run`
required).

```bash
# From repo root
deno task web:setup
deno task web:dev

# Build production assets into dist/
deno task web:build
```

### Freeze Triage (Firefox/Chrome)

If the browser freezes immediately, use URL flags to prevent auto-running WASM
and step through initialization safely:

- `?debug` shows an on-screen log feed (no devtools needed).
- Default is **paused** (no auto-run). Click buttons in the overlay to:
  - run init (safe; does not call `Main()` by default) and
  - step `UpdateGame()` manually.
- SCPCB uses `options.ini` very early (for `GraphicWidth/RealGraphicWidth/...`); ensure it is in the manifest `boot` group (`web/public/scpcb_manifest.json`) so it is available before running init/steps.
- SCPCB's built-in launcher is a blocking UI loop; it's disabled by default in `web/public/options.ini` and the loader also forces `LauncherEnabled=0` unless you opt in with `?launcher=1`.
- SCPCB `Main()` often contains a blocking loop; the loader will only call it if you opt in with `?init=main` (init once) or `?run=main` (run forever; will freeze the tab).
- SCPCB init contains a tight "press any key" loop; when opting into `?init=main`, the loader primes a synthetic key/mouse hit so init can complete without freezing.
- For debugging init hangs, the web build includes SCPCB `DebugLog` markers like `WEBINIT: ...` (compiled into `web/public/scpcb.wasm`).
- SCPCB init expects synchronous file IO; the web port preloads `facility_assets` before calling `Main()` when using `?init=main` to avoid hangs from async-on-demand fetches.
- Current SCPCB web build short-circuits `Main()` early (`WEBINIT: short-circuit...`) to avoid blocking the tab while we refactor init into resumable steps.
- `?auto=1` enables auto-run (starts ticking `UpdateGame()` via RAF).
- `?tick=manual` disables the update RAF loop; use the **Step UpdateGame**
  button.
- `?nogl=1` skips WebGL init and disables rendering (debug logic without GPU).
- `?noassets=1` stubs texture/mesh/image/font loaders (no fetch/decode storms).
- `?noaudio=1` stubs sound playback/decoding (no AudioContext work).
- `?fps=10` limits the render loop (useful on slow GPUs).
- `?safe` never runs any WASM entrypoints (just loads/instantiates + shows
  exports).

### Headless Leak/Freeze Tooling (Deno)

```bash
# Repeatedly call an exported churn step and assert runtime handle maps stay clean
deno task memleak:scpcb:churn -- --wasm Main.leaktest.wasm --export "__LeakTestStep%" --steps 2000

# Triage a Firefox heap snapshot (quick string scan, not a dominator parser)
deno task memleak:fxsnapshot:strings -- /path/to/snapshot.fxsnapshot --kind both --match "WebAssembly|THREE|wasm"
```

## Headless Leak Checks (No Browser)

Best-effort checks to catch JS-side lifecycle leaks (RAF loops, event listeners,
retained maps) and optional WASM instantiation leaks without loading a browser.

```bash
# Scan for suspicious patterns (heuristic)
deno task memleak:scan

# Create+dispose cycles (optionally instantiate a WASM module)
deno task memleak:run -- --cycles 5 --wasm Main.wasm --verbose

# WebGPU allocate/destroy cycles (no Three.js, no browser UI)
deno task memleak:webgpu --iterations 50 --verbose

# Strict mode (fails if no adapter is available)
deno task memleak:webgpu:strict --iterations 50 --verbose

# Strict queue mode (fails on uncaptured errors; workDone is best-effort)
deno task memleak:webgpu:strict-queue --iterations 50 --verbose --queue-timeout-ms 2000

# Strict queue hard mode (requires workDone to resolve; may fail on some Deno backends)
deno task memleak:webgpu:strict-queue-hard --iterations 50 --verbose --queue-timeout-ms 2000

# SCPCB churn (headless; exercises runtime imports via a test export)
deno task memleak:scpcb:compile
deno task memleak:scpcb:churn -- --wasm Main.leaktest.wasm --export "__LeakTestStep%" --steps 2000 --check-every 50 --fail-on-growth-bytes 25000000
# Add --runtime-logs / --verbose if you want noisy per-step output.
```

## Language Support

### Implemented ✅

- Variables (Local, Global, Const, Dim)
- Types (custom types with fields)
- Type operations (New, Delete, First, Last, After, Before)
- For Each iteration
- Functions with return types and parameter defaults
- Control flow (If/Then/Else, For/Next, While/Wend, Select/Case)
- Operators (arithmetic, comparison, logical, string)
- Field access (obj\field, case-insensitive)
- Include files
- Data/Read/Restore statements

### Known Issues

- Function shadowing: user functions can't have same name as runtime imports
- For Each + Delete: use While loop with saved next pointer instead

## Key Files

| File                                                  | Purpose                       |
| ----------------------------------------------------- | ----------------------------- |
| `Sources/Compiler/Parser/Parser.swift`                | Main parser (~2.2K lines)     |
| `Sources/Compiler/CodeGen/CodeGenerator.swift`        | WASM generation               |
| `Sources/Compiler/CodeGen/StatementGeneration.swift`  | Statement codegen             |
| `Sources/Compiler/CodeGen/ExpressionGeneration.swift` | Expression codegen            |
| `web/src/main.ts`                                     | SCPCB loader (~2K lines)      |
| `web/src/runtime/core.ts`                             | Core runtime (~2K lines)      |
| `web/src/runtime/graphics.ts`                         | Three.js integration (~3.7K)  |
| `web/src/worker/scpcb_worker.ts`                      | Worker harness (~935 lines)   |
| `Sources/Runtime/thin/runtime.js`                     | Minimal demo runtime          |
| `Sources/Runtime/thin/particles.bb`                   | Working demo source           |

## Recent Achievements (Jan 2026)

- 94.7% SCPCB compilation success rate (54/57 files)
- Complete asset pipeline: B3D/X/RMESH → SMPK conversion
- Command buffer system for efficient WASM→JS batching
- Virtual filesystem with path aliasing for SCPCB compatibility
- Memory leak detection tooling (scan, churn, WebGPU smoke tests)
- CI gates for no-source-model deployment
- Track B execution plans for SCPCB web port

## Source of Truth

- **Plan index**: `plan/README.md`
- **SCPCB web port (Track B)**: `plan/scpcb-web-track-b/README.md`
- **Compiler status + metrics**: `docs/COMPILER_STATUS_ANALYSIS.md`

## Breaking Changes (January 2026)

### Synchronous XHR Removal

**What changed**: The `_syncFetchAndRegister` fallback was removed. Synchronous
XMLHttpRequest is deprecated and being removed from browsers.

**Impact**:
- `?init=main` mode now requires ALL init-required files to be in the 'init'
  or 'facility_assets' asset groups (as defined in scpcb_manifest.json)
- Files not in preload groups will cause SCPCB init to hang or return 0

**Migration**:
1. Ensure your manifest includes all files SCPCB reads during init
2. Add missing files to the 'init' asset group
3. Test with `?init=main` before deploying

**Alternative**: For partial initialization without preloading all assets,
use the non-blocking mode (default, no `?init=main`) with lazy loading.

### AudioContext Lazy Initialization

**What changed**: AudioContext is no longer created in the constructor. It
is now lazily initialized on first user interaction (click/keydown/touch).

**Impact**: Audio won't play until the user interacts with the page.

**Reason**: Browser autoplay policies require user gesture for audio.

### Three.js Update

**What changed**: Updated from r128 to r170 in `Sources/Runtime/thin/test.html`.

**Impact**: Some deprecated Three.js APIs may behave differently. Test the
particle demo after updates.

## Code Cleanup Summary (January 2026)

### Completed Fixes

| Issue | File | Status |
|-------|------|--------|
| Memory leak in FreeEntity | `Sources/Runtime/thin/runtime.js` | Fixed |
| AudioContext autoplay | `Sources/Runtime/thin/runtime.js` | Fixed |
| Sync XHR deprecated | `web/src/runtime/fileio.ts` | Removed |
| Three.js outdated | `Sources/Runtime/thin/test.html` | Updated to r170 |
| Duplicate functions | `web/src/runtime/graphics.ts` | Removed |
| Debug logging | `web/src/runtime/fileio.ts` | Fixed |
| TextDecoder caching | `Sources/Runtime/thin/runtime.js` | Fixed |
| Animation iteration | `Sources/Runtime/thin/runtime.js` | Optimized |
| Path validation | `web/src/runtime/fileio.ts` | Added |

### New Features

- **Error handling**: `fetchWithRetry()` with exponential backoff
- **Error events**: CustomEvent dispatched on file load failures
- **Type safety**: Proper TypeScript types for fileio.ts
- **Unit tests**: 25 passing tests in `web/src/runtime/runtime.test.ts`

### Test Coverage

Run tests with:
```bash
deno test --allow-read --allow-net web/src/runtime/runtime.test.ts
```
