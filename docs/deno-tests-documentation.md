# Deno Test Suite Documentation

## Overview

The Blitz3D-WASM project includes a comprehensive Deno-based test suite focused on memory leak detection, resource management validation, and headless browser testing. This test suite is designed to ensure the WASM-compiled Blitz3D code runs reliably without memory leaks or resource retention issues.

## Test Categories

### 1. Memory Leak Detection Tools

#### Static Analysis (`memleak:scan`)

**Purpose**: Performs static code analysis to detect common memory leak patterns using heuristic pattern matching.

**Implementation**: `Tools/memleak/scan.ts`

**Key Patterns Detected**:
- `requestAnimationFrame` calls without handle storage
- `setInterval` calls (potential memory retention)
- `setTimeout` calls (potential memory retention)
- Anonymous event listeners
- Three.js `dispose()` calls (cleanup verification)
- Three.js `clone()` calls (potential duplication issues)

**Usage**:
```bash
deno run -A Tools/memleak/scan.ts [--root <path> ...] [--fail] [--max <n>]
```

**Technical Notes**: This tool uses regex patterns to scan `.ts`, `.js`, and `.html` files in specified directories. It's a best-effort heuristic tool designed to catch common anti-patterns before they become issues.

#### Headless Runtime Leak Detection (`memleak:run`)

**Purpose**: Creates and disposes runtime instances repeatedly to detect memory leaks in the actual Blitz3D runtime environment.

**Implementation**: `Tools/memleak/leakcheck.ts`

**Key Features**:
- Instantiates full Blitz3D runtime (Core, Graphics, FileIO)
- Optional WASM module loading and execution
- Resource count validation (entities, textures, images)
- RAF (RequestAnimationFrame) listener tracking
- Event listener leak detection
- Heap growth monitoring with configurable thresholds

**Usage**:
```bash
deno run -A --node-modules-dir Tools/memleak/leakcheck.ts [options]
```

**Key Options**:
- `--wasm <path>`: Optional WASM file to instantiate
- `--cycles <n>`: Create+dispose cycles (default 5)
- `--call-export <name>`: Export to call after instantiation
- `--fail-on-growth-bytes <n>`: Heap growth threshold (default 10MB)

**Technical Notes**: This test provides a more realistic memory usage profile by actually instantiating and exercising the runtime components, then verifying proper cleanup.

### 2. WebGPU Resource Management

#### WebGPU Smoke Test (`memleak:webgpu` variants)

**Purpose**: Tests WebGPU resource allocation/destruction cycles to detect GPU memory leaks and ensure proper resource cleanup.

**Implementation**: `Tools/memleak/webgpu_smoke.ts`

**Test Variants**:
- `memleak:webgpu`: Basic WebGPU test with `--skip-if-unavailable`
- `memleak:webgpu:strict`: Strict mode that fails on uncaptured GPU errors
- `memleak:webgpu:strict-queue`: Additional queue validation requirements
- `memleak:webgpu:strict-queue-hard`: Requires `queue.onSubmittedWorkDone` to resolve

**Key Features**:
- GPU buffer allocation and destruction
- GPU texture allocation with render pass execution
- Command encoder submission and cleanup
- Queue work completion validation
- Device loss monitoring
- Uncaptured error detection

**Usage**:
```bash
deno run -A --unstable-webgpu Tools/memleak/webgpu_smoke.ts
```

**Technical Requirements**: Requires Deno with WebGPU support (`--unstable-webgpu`) and system GPU access or appropriate environment variables (`DENO_WEBGPU_BACKEND`, `DENO_WEBGPU_POWER_PREFERENCE`).

### 3. SCPCB-Specific Testing

#### SCPCB Churn Test (`memleak:scpcb:churn`)

**Purpose**: Repeatedly calls specific WASM exports (typically SCPCB game functions) to ensure runtime handle maps remain clean during extended operation.

**Implementation**: `Tools/memleak/scpcb_churn.ts`

**Key Features**:
- Loads SCPCB WASM and initializes runtime
- Calls specified export function repeatedly (default: `__LeakTestStep%`)
- Monitors graphics resource counts (entities, textures, images)
- Tracks WASM memory growth
- Validates cleanup after churn cycles
- Preloads `options.ini` for SCPCB initialization requirements

**Usage**:
```bash
deno run -A --sloppy-imports --node-modules-dir Tools/memleak/scpcb_churn.ts [options]
```

**Key Options**:
- `--wasm <path>`: WASM file (default `Main.leaktest.wasm`)
- `--export <name>`: Export to call (default `__LeakTestStep%`)
- `--steps <n>`: Number of iterations (default 2000)
- `--check-every <n>`: Validation frequency (default 50)
- `--wasm-fail-on-growth-bytes <n>`: WASM memory threshold (default 64MB)

**Technical Notes**: This test is specifically designed for SCPCB's runtime patterns and includes special handling for SCPCB's initialization requirements, including synthetic key inputs to bypass "press any key" loops.

### 4. Unit Tests (`test:deno`)

**Purpose**: Runs the comprehensive unit test suite covering various components.

**Implementation**: `Tools/tests/` directory

**Test Categories**:
- Asset parsing and conversion tests
- Runtime component tests
- WebGPU command buffer tests
- Manifest validation tests
- Distribution validation tests

**Usage**:
```bash
deno test --allow-read --allow-write=/tmp --allow-run=deno Tools/tests
```

### 5. BB compile-and-run smoke suite (runner correctness)

**Purpose**: Validate BB language/codegen behavior end-to-end by compiling and executing small `.bb` programs through the Deno runner (`Tools/bb_deno_compile_and_run.ts`).

**Why this exists**:
- The fastest feedback loop for “does this language feature actually run”.
- Catches “web demo would freeze” failure modes early (infinite loops → watchdog timeout).
- Ensures the runner matches the compiler’s ABI expectations (notably Blitz string objects).

**Key files**:
- `Tools/bb_deno_compile_and_run.ts` — Compiles via native compiler binary and runs the output WASM in a Worker with a timeout.
- `Tests/deno_smoke/` — The BB programs (coverage checklist in `Tests/deno_smoke/COVERAGE.md`).
- `Tools/tests/bb_deno_compile_and_run_smoke.test.ts` — Deno tests that execute the programs and assert stdout.

**Usage**:
```bash
deno test --allow-read --allow-write=/tmp --allow-run=deno Tools/tests/bb_deno_compile_and_run_smoke.test.ts
```

**Important implementation detail**:
- `Print`/`PrintString` take a **pointer to a Blitz string object**, not `(ptr,len)`. The runner must decode `[refcount][len][utf8 bytes...]`.

## Technical Architecture

### Memory Management Strategy

The test suite follows a multi-layered approach to memory leak detection:

1. **Static Analysis**: Pre-commit prevention using pattern matching
2. **Headless Testing**: Runtime validation without browser overhead
3. **Integration Testing**: Full system validation with SCPCB workload
4. **Resource-Specific Testing**: WebGPU and graphics resource validation

### Headless Environment

All memory leak tests run in a headless environment using `installHeadlessEnv()` which provides:
- Mock DOM APIs (addEventListener, removeEventListener)
- RAF (requestAnimationFrame) tracking
- Event listener lifecycle monitoring
- Browser-like timing mechanisms without actual browser

### Resource Tracking

Key resources tracked during tests:
- **JavaScript Heap**: Using `Deno.memoryUsage().heapUsed`
- **WASM Memory**: Using `WebAssembly.Memory.buffer.byteLength`
- **Graphics Resources**: Three.js objects (entities, textures, images)
- **Event Listeners**: Active DOM event listeners
- **RAF Handles**: Active requestAnimationFrame callbacks
- **GPU Resources**: WebGPU buffers, textures, and command queues

## Integration with Development Workflow

### Continuous Integration

The test suite is designed for CI/CD integration:
- All tests run without browser dependencies
- Configurable failure thresholds for different environments
- Non-destructive testing (doesn't modify source code)
- Fast execution for rapid feedback

### Development Usage

During development, the tests can be used iteratively:
```bash
# Quick static check
deno task memleak:scan

# Full memory validation with WASM
deno task memleak:run --wasm Main.wasm --cycles 10 --verbose

# SCPCB-specific validation
deno task memleak:scpcb:compile
deno task memleak:scpcb:churn --steps 1000 --verbose
```

## Best Practices and Standards

Based on industry standards for memory leak detection in WebAssembly applications:

1. **Automated Detection**: Continuous monitoring prevents memory issues from reaching production
2. **Threshold-Based Validation**: Configurable thresholds accommodate different deployment environments
3. **Resource-Specific Testing**: Different resource types require specialized validation approaches
4. **Headless Testing**: Eliminates browser variability and enables CI/CD integration

## References and Standards

### Memory Leak Detection Standards
- Chrome DevTools Memory Inspector documentation for WASM Memory inspection
- WebAssembly Memory Model specifications
- V8 Engine memory management best practices

### Testing Framework Standards
- Deno testing framework best practices
- Headless browser testing methodologies
- WebGPU resource management specifications

### Industry Tools Referenced
- Memlab framework patterns for JavaScript memory leak detection
- Chrome DevTools Memory Inspector for ArrayBuffer and WASM analysis
- WebGPU specification for resource lifecycle management

## Future Enhancements

The test suite architecture supports:
- Additional resource type tracking
- Custom leak detection patterns
- Environment-specific threshold configuration
- Integration with external profiling tools
- Automated regression testing

---

*This documentation reflects the current state of the Deno test suite as of January 2026. The test suite continues to evolve based on project requirements and emerging best practices in WebAssembly memory management.*
