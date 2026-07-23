# Web Freeze Mitigation Plan

## Status

**Type**: Critical Fix **Priority**: Critical **Timeline**: 1 week **Progress**:
Partial (core “kill switch” implemented for interpreter demos)

## Problem Description

### Current Issue

Browser tabs freeze immediately when loading complex SCPCB WASM modules,
preventing any user interaction or debugging access.

### Root Causes Identified

1. **Infinite loops in WASM initialization** - Blocking UI thread
2. **Large asset loading without progress** - Browser timeout protection
3. **Synchronous file I/O expectations** - Blocking on async web APIs
4. **Main() blocking loops** - Game loop prevents UI responsiveness

### Impact Assessment

- **Severity**: Critical - Prevents all browser usage
- **Scope**: All SCPCB and complex Blitz3D games
- **User Experience**: Complete inability to use web application
- **Development**: Cannot debug or test in browser environment

## Success Criteria

- [x] Browser tab remains responsive during user-code WASM execution (Worker +
      watchdog for interpreter demos)
- [ ] Users can access debug overlay and controls
- [ ] Progressive loading shows progress to user
- [x] Main() execution can be stopped/controlled (Stop button + timeout
      termination in interpreter demos)
- [ ] Recovery from initialization errors without page reload

## 2026-02-02 implementation notes

We implemented the minimal freeze-prevention foundation for the “web
interpreter” style demos:

- `web/interpreter.html` now has a **Stop** button and a **timeout** input.
- `web/interpreter.js` runs compiled BB→WASM inside a **Worker** and can
  terminate it on timeout.
- A standalone upload+run demo exists at `web/public/bb_wasm_runner_demo.html`.

This does not fully solve SCPCB’s “init/Main() + asset preload” freeze risks
yet, but it establishes the baseline pattern: **never run untrusted/unknown WASM
entrypoints on the UI thread**.

## Solution Architecture

### 1. Phased Initialization System

```typescript
// Progressive loading states
enum BootState {
  LOADING_WASM = "LOADING_WASM",
  LOADING_MANIFEST = "LOADING_MANIFEST",
  PRELOADING_BOOT = "PRELOADING_BOOT",
  READY = "READY",
  RUNNING = "RUNNING",
  ERROR = "ERROR",
}

// State machine with stall detection
class BootStateMachine {
  private currentState: BootState = BootState.LOADING_WASM;
  private lastProgress = 0;
  private stallTimeout: number;

  async transitionTo(newState: BootState): Promise<void> {
    // Prevent infinite loops with stall detection
    this.stallTimeout = setTimeout(() => {
      if (this.currentState === newState) {
        this.handleError("INITIALIZATION_STALL");
      }
    }, 10000); // 10 second stall detection

    // Perform state transition
    await this.performStateTransition(newState);

    // Clear stall timeout on success
    clearTimeout(this.stallTimeout);
    this.currentState = newState;
  }
}
```

### 2. Non-Blocking Main() Integration

```typescript
// Wrap Main() execution in controllable way
class MainController {
  private mainRunning = false;
  private mainPaused = false;
  private mainStepMode = false;

  async startMain(): Promise<void> {
    if (this.mainRunning) return;

    try {
      this.mainRunning = true;
      this.mainPaused = false;

      // Step-based execution for debugging
      if (this.mainStepMode) {
        await this.stepMainLoop();
      } else {
        await this.continuousMainLoop();
      }
    } catch (error) {
      this.handleMainError(error);
    }
  }

  pauseMain(): void {
    this.mainPaused = true;
  }

  resumeMain(): void {
    this.mainPaused = false;
  }

  async stepMainLoop(): Promise<void> {
    // Execute one iteration of game loop
    const result = await this.wasmInstance.exports.Main();

    // Check for blocking patterns
    if (this.isBlockingPattern(result)) {
      throw new Error("Main() contains blocking loop");
    }
  }
}
```

### 3. Synchronous File System Abstraction

```typescript
// Async-to-sync bridge for Blitz3D file operations
class FileSystemBridge {
  private preloadedFiles = new Map<string, ArrayBuffer>();
  private loadingQueue = new PromiseQueue();

  // Preload critical files before WASM execution
  async preloadCriticalFiles(fileList: string[]): Promise<void> {
    const loadPromises = fileList.map(async (filename) => {
      const data = await this.loadFileAsync(filename);
      this.preloadedFiles.set(filename, data);
    });

    await Promise.all(loadPromises);
  }

  // Synchronous accessor for WASM
  readFile(filename: string): ArrayBuffer {
    const data = this.preloadedFiles.get(filename);
    if (!data) {
      throw new Error(`File not preloaded: ${filename}`);
    }
    return data;
  }

  // Background loading for non-critical files
  async loadBackgroundFile(filename: string): Promise<ArrayBuffer> {
    return this.loadingQueue.add(() => this.loadFileAsync(filename));
  }
}
```

### 4. Browser Compatibility Layer

```typescript
// Cross-browser freeze prevention
class FreezePrevention {
  private heartbeatInterval: number;
  private progressIndicator: HTMLElement;

  startHeartbeat(): void {
    // Keep main thread responsive
    this.heartbeatInterval = setInterval(() => {
      this.checkResponsiveness();
    }, 100); // Every 100ms

    // Show user-friendly loading screen
    this.showProgressIndicator();
  }

  checkResponsiveness(): void {
    const now = performance.now();

    // If no response for 2 seconds, take action
    if (now - this.lastUserInteraction > 2000) {
      this.offerDebugMode();
    }
  }

  offerDebugMode(): void {
    const debugMode = confirm(
      "Application appears to be frozen. Enable debug mode?",
    );

    if (debugMode) {
      this.enableDebugControls();
    }
  }
}
```

## Implementation Plan

### Phase 1: State Machine Implementation (Days 1-2)

1. [ ] Create BootStateMachine with stall detection
2. [ ] Implement progressive loading states
3. [ ] Add UI feedback for each loading phase
4. [ ] Test with simple WASM modules

### Phase 2: Main() Controller (Days 3-4)

1. [ ] Implement MainController with step/continuous modes
2. [ ] Add blocking pattern detection
3. [ ] Create debug controls for Main() execution
4. [ ] Test with SCPCB Main() patterns

### Phase 3: File System Bridge (Days 4-5)

1. [ ] Implement FileSystemBridge for async/sync conversion
2. [ ] Add critical file preloading
3. [ ] Create background loading queue
4. [ ] Test with SCPCB asset loading patterns

### Phase 4: Browser Compatibility (Days 5-6)

1. [ ] Implement FreezePrevention system
2. [ ] Add heartbeat monitoring
3. [ ] Create debug mode activation
4. [ ] Test across different browsers

### Phase 5: Integration & Testing (Days 6-7)

1. [ ] Integrate all systems into web runtime
2. [ ] Test with full SCPCB compilation
3. [ ] Verify no browser freezes occur
4. [ ] Add comprehensive error recovery

## URL Flag Interface

### Debug Controls

```typescript
// URL parameters for freeze mitigation
interface FreezeMitigationFlags {
  debug?: boolean; // Show debug overlay
  pause?: boolean; // Start paused
  step?: boolean; // Step mode
  auto?: boolean; // Auto-run Main()
  safe?: boolean; // Safe mode (no auto-run)
  nogl?: boolean; // Skip WebGL
  noassets?: boolean; // Skip asset loading
  fps?: number; // Frame rate limit
  timeout?: number; // Custom timeout in ms
}
```

### Usage Examples

```html
<!-- Safe debugging mode -->
http://localhost:8000/test.html?debug=1&pause=1&safe=1

<!-- Step through Main() -->
http://localhost:8000/test.html?debug=1&step=1&timeout=30000

<!-- Skip problematic components -->
http://localhost:8000/test.html?nogpu=1&noassets=1&fps=5

<!-- Production with safeguards -->
http://localhost:8000/test.html?auto=1&timeout=60000
```

## Error Recovery Strategies

### Initialization Failures

```typescript
class ErrorRecovery {
  async handleInitializationError(error: Error): Promise<void> {
    console.error("WASM initialization failed:", error);

    // Show user-friendly error
    this.showErrorDialog(error.message);

    // Offer recovery options
    const action = await this.presentRecoveryOptions();

    switch (action) {
      case "retry":
        await this.retryInitialization();
        break;
      case "debug":
        this.enableDebugMode();
        break;
      case "fallback":
        await this.loadFallbackMode();
        break;
    }
  }

  private async presentRecoveryOptions(): Promise<string> {
    return new Promise((resolve) => {
      // Present UI for user selection
      this.showRecoveryDialog(resolve);
    });
  }
}
```

### Stall Detection and Recovery

```typescript
class StallDetection {
  private stallDetector: StallDetector;

  monitorWasmExecution(): void {
    this.stallDetector = new StallDetector({
      timeout: 15000, // 15 seconds
      checkInterval: 1000, // Check every second
      onStall: () => this.handleWasmStall(),
    });

    this.stallDetector.start();
  }

  private handleWasmStall(): void {
    console.warn("WASM execution stall detected");

    // Attempt recovery
    this.pauseWasmExecution();
    this.offerUserIntervention();

    // If user intervention fails, force recovery
    setTimeout(() => {
      if (this.stallDetector.isStalled()) {
        this.forceRecovery();
      }
    }, 5000);
  }

  forceRecovery(): void {
    // Terminate WASM instance
    this.terminateWasmInstance();

    // Reload in safe mode
    this.reloadInSafeMode();
  }
}
```

## Testing Strategy

### Freeze Detection Tests

```bash
# Test freeze scenarios
deno task web:build
deno task web:dev

# Test with problematic WASM
open "http://localhost:8000/test.html?file=scpcb.wasm&timeout=5000"

# Verify no freeze after timeout
# Should show error dialog instead of freezing browser
```

### Performance Impact Tests

```bash
# Measure loading performance
time deno task web:build

# Test with different configurations
# 1. Full features
# 2. No GPU
# 3. No assets
# 4. Step mode
```

### Browser Compatibility Tests

```bash
# Test across browsers
chrome http://localhost:8000/test.html
firefox http://localhost:8000/test.html  
safari http://localhost:8000/test.html
edge http://localhost:8000/test.html
```

## Success Metrics

### Technical Metrics

- **No browser freezes**: 100% test pass rate
- **Loading time**: < 10 seconds for SCPCB
- **Recovery success**: 95% error recovery without page reload
- **Debug accessibility**: All features accessible via URL flags

### User Experience Metrics

- **Visual feedback**: Progress indicators during all loading phases
- **Error handling**: Clear, actionable error messages
- **Recovery options**: Multiple paths to resolve issues
- **Debug tools**: Comprehensive debugging capabilities

## Risk Mitigation

### Implementation Risks

- **Performance impact**: Additional overhead from monitoring
  - Mitigation: Minimal impact design, conditional features
- **Complexity**: Increased system complexity
  - Mitigation: Modular design, clear interfaces
- **Compatibility**: Browser-specific behavior differences
  - Mitigation: Cross-browser testing, fallback mechanisms

### User Risks

- **Confusion**: New URL flags and controls
  - Mitigation: Clear documentation, tooltips in UI
- **Performance**: Slower loading due to safeguards
  - Mitigation: Optional features, performance modes

## Timeline Details

### Critical Path (7 days)

- **Days 1-2**: State machine implementation
- **Days 3-4**: Main() controller and file bridge
- **Days 5-6**: Browser compatibility layer
- **Day 7**: Integration, testing, and deployment

### Parallel Development

- **State machine**: Backend implementation
- **UI layer**: Frontend controls and indicators
- **Testing**: Automated and manual test suites
- **Documentation**: Usage guides and API reference

## Deliverables

### Code Components

1. **BootStateMachine** - Progressive loading manager
2. **MainController** - Controllable Main() execution
3. **FileSystemBridge** - Async/sync file interface
4. **FreezePrevention** - Browser compatibility layer

### User Interface

1. **Loading screens** - Progress indicators for each phase
2. **Debug overlay** - Real-time status and controls
3. **Error dialogs** - User-friendly error handling
4. **Control panel** - Debug controls and options

### Documentation

1. **Usage guide** - URL flags and debugging techniques
2. **API reference** - System interfaces and methods
3. **Troubleshooting** - Common issues and solutions

---

**Priority**: CRITICAL - This is the most critical issue preventing production
deployment of the Blitz3D-WASM web runtime. Browser freezes make the system
unusable for complex games like SCP: Containment Breach.

**Impact**: Solving this issue enables immediate production deployment and user
testing of the web runtime.

**Confidence**: High - All technical solutions are well-understood with clear
implementation paths.
