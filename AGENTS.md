# Blitz3D-WASM

A compiler and runtime that compiles Blitz3D BASIC to WebAssembly for browser
execution.

## Project Status (January 2026)

**Compiler**: Working - compiles Blitz3D code to valid WASM\
**Runtime**: Thin runtime (~500 lines JS) for browser API bindings\
**Target**: Run SCP: Containment Breach in browser

### Working Demo

**https://blitz3d.exe.xyz:8000/test.html** - Particle system demo

- Particles fall with gravity
- Alpha fading and deletion
- All logic in compiled BB → WASM
- JS only provides Three.js rendering calls

## Architecture

**WASM does game logic. JS only wraps browser APIs.**

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
                              │ imports ~10-50 functions
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   JS Runtime (~500 lines)                    │
├─────────────────────────────────────────────────────────────┤
│ • CreateSprite/Mesh → Three.js objects                      │
│ • PositionEntity → obj.position.set()                       │
│ • EntityAlpha → material.opacity                            │
│ • LoadSound/PlaySound → Web Audio                           │
│ • KeyDown/MouseX → DOM events                               │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
blitz3d-wasm/
├── Sources/
│   ├── Compiler/          # Swift compiler (14K lines)
│   │   ├── Lexer/         # Tokenizer
│   │   ├── Parser/        # Recursive descent (2K lines)
│   │   ├── AST/           # Syntax tree nodes
│   │   ├── IR/            # Intermediate representation
│   │   ├── Lowering/      # AST → IR
│   │   └── CodeGen/       # WASM generation (5K lines)
│   │
│   ├── Runtime/
│   │   ├── thin/          # Minimal runtime ← USE THIS
│   │   │   ├── runtime.js # ~500 lines, browser bindings
│   │   │   ├── test.html  # Working particle demo
│   │   │   └── particles.bb
│   │   ├── JS/            # TS/JS runtime bindings
│   │   └── modules/       # Legacy full runtime (11K lines)
│   │
│   └── Blitz3DEngine/     # Swift asset parsers
│
├── Tests/
│   ├── CompilerTests/     # Swift unit tests
│   ├── fixtures/          # Test .bb files
│   └── IntegrationTests/  # Browser tests
│
├── Tools/
│   ├── wasm-cli/          # CLI compiler
│   └── analyzer/          # WASM debugging
│
├── Examples/              # Demo projects
├── docs/                  # Documentation
│   ├── compiler/          # Compiler docs
│   └── archive/           # Old session notes
├── notes/                 # SCPCB analysis
├── plan/                  # Implementation phases
└── web/                   # Web frontend app
```

## Building

### Prerequisites

- Swift 6.0+ (`swift --version`)
- Deno (for serving)
- wabt (for wasm-validate)

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

### Run Demo

```bash
cd Sources/Runtime/thin
python3 -m http.server 8000
# Open http://localhost:8000/test.html
```

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
- SCPCB’s built-in launcher is a blocking UI loop; it’s disabled by default in `web/public/options.ini` and the loader also forces `LauncherEnabled=0` unless you opt in with `?launcher=1`.
- SCPCB `Main()` often contains a blocking loop; the loader will only call it if you opt in with `?init=main` (init once) or `?run=main` (run forever; will freeze the tab).
- SCPCB init contains a tight “press any key” loop; when opting into `?init=main`, the loader primes a synthetic key/mouse hit so init can complete without freezing.
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
deno task memleak:fxsnapshot:strings -- /Users/jack/Desktop/693042.fxsnapshot --kind both --match "WebAssembly|THREE|wasm"
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
- Functions with return types
- Control flow (If/Then/Else, For/Next, While/Wend, Select/Case)
- Operators (arithmetic, comparison, logical, string)
- Field access (obj\field)
- Include files

### Known Issues

- Function shadowing: user functions can't have same name as runtime imports
- For Each + Delete: use While loop with saved next pointer instead

## Key Files

| File                                                  | Purpose                |
| ----------------------------------------------------- | ---------------------- |
| `Sources/Compiler/Parser/Parser.swift`                | Main parser (2K lines) |
| `Sources/Compiler/CodeGen/CodeGenerator.swift`        | WASM generation        |
| `Sources/Compiler/CodeGen/StatementGeneration.swift`  | Statement codegen      |
| `Sources/Compiler/CodeGen/ExpressionGeneration.swift` | Expression codegen     |
| `Sources/Runtime/thin/runtime.js`                     | Thin JS runtime        |
| `Sources/Runtime/thin/particles.bb`                   | Working demo source    |

## Recent Fixes (Jan 2026)

- Type system: `New` allocation, `Delete` linked list management
- Field access: case-insensitive lookups
- Function exports: user functions no longer shadowed by imports
- For Each: proper iteration over type instances
