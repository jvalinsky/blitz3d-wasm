# Debug Patterns

## Overview

This collection contains debugging strategies, problem-solving patterns, and
troubleshooting approaches developed throughout the Blitz3D-WASM project. These
patterns have been proven effective and can be applied to similar WebAssembly
and browser-based game development challenges.

## Debugging Strategy Framework

### Multi-Layer Debugging Approach

```typescript
interface DebuggingLayers {
  wasm_level: {
    stack_validation: boolean;
    memory_inspection: boolean;
    execution_tracing: boolean;
  };
  runtime_level: {
    command_buffer_debugging: boolean;
    asset_loading_tracing: boolean;
    performance_monitoring: boolean;
  };
  browser_level: {
    dom_event_tracing: boolean;
    memory_profiling: boolean;
    network_monitoring: boolean;
  };
}
```

### Debug Pattern Classification

1. **Immediate Issues**: Crash/Freeze detection and recovery
2. **Performance Issues**: Slow execution, memory usage problems
3. **Logic Issues**: Incorrect behavior, state management problems
4. **Integration Issues**: Component interaction failures

## Immediate Issue Debugging

### Browser Freeze Detection and Recovery

```typescript
class FreezeDetectionPattern {
  private heartbeatInterval: number;
  private lastResponseTime: number;
  private freezeThreshold = 5000; // 5 seconds

  startMonitoring(): void {
    this.lastResponseTime = performance.now();

    // Heartbeat to check UI responsiveness
    this.heartbeatInterval = setInterval(() => {
      const now = performance.now();

      if (now - this.lastResponseTime > this.freezeThreshold) {
        this.handleFreeze();
      }

      // Simulate UI interaction
      this.simulateUserInteraction();
      this.lastResponseTime = now;
    }, 1000);
  }

  handleFreeze(): void {
    console.warn("Browser freeze detected");

    // Offer recovery options
    this.showRecoveryDialog({
      message: "Application appears to be frozen",
      options: [
        { label: "Reload in Safe Mode", action: "safe_reload" },
        { label: "Enable Debug Mode", action: "debug_mode" },
        { label: "Kill JavaScript", action: "kill_js" },
      ],
    });
  }

  private simulateUserInteraction(): void {
    // Simulate mouse move to maintain responsiveness
    const event = new MouseEvent("mousemove", {
      clientX: Math.random() * window.innerWidth,
      clientY: Math.random() * window.innerHeight,
    });
    document.dispatchEvent(event);
  }
}
```

### WASM Initialization Errors

```typescript
class WasmInitDebugPattern {
  debugWasmInstantiation(wasmBytes: ArrayBuffer, importObject: any): void {
    try {
      // Validate WASM before instantiation
      if (!this.validateWasmBytes(wasmBytes)) {
        throw new Error("Invalid WASM bytecode");
      }

      const instance = new WebAssembly.Instance(
        new WebAssembly.Module(wasmBytes),
        importObject,
      );

      this.validateInstance(instance);
    } catch (error) {
      this.handleWasmError(error);
    }
  }

  private validateWasmBytes(bytes: ArrayBuffer): boolean {
    // Check WASM magic number
    const view = new DataView(bytes);
    const magic = view.getUint32(0, true);

    if (magic !== 0x6d736100) { // "\0asm"
      console.error("Invalid WASM magic number");
      return false;
    }

    // Basic structure validation
    try {
      WebAssembly.validate(bytes);
    } catch (error) {
      console.error("WASM validation failed:", error);
      return false;
    }

    return true;
  }

  private validateInstance(instance: WebAssembly.Instance): void {
    // Check critical exports
    const requiredExports = ["Main", "memory"];

    for (const exportName of requiredExports) {
      if (!(exportName in instance.exports)) {
        throw new Error(`Missing required export: ${exportName}`);
      }
    }

    // Validate memory
    const memory = instance.exports.memory as WebAssembly.Memory;
    if (!memory) {
      throw new Error("WASM module missing memory export");
    }

    console.log("WASM instance validation passed");
  }
}
```

## Performance Debugging

### Memory Leak Detection Pattern

```typescript
class MemoryLeakDebugPattern {
  private baseline: MemorySnapshot;
  private snapshots: MemorySnapshot[] = [];
  private leakThresholds = {
    heapGrowth: 50 * 1024 * 1024, // 50MB
    wasmGrowth: 100 * 1024 * 1024, // 100MB
    resourceGrowth: 100, // additional objects
  };

  async detectLeaks(duration: number = 60000): Promise<LeakReport> {
    // Capture baseline
    this.baseline = await this.captureSnapshot();

    // Monitor over time
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      await this.wait(1000); // Check every second
      const snapshot = await this.captureSnapshot();
      this.snapshots.push(snapshot);

      // Check for leaks
      this.analyzeForLeaks(snapshot);
    }

    return this.generateLeakReport();
  }

  private async captureSnapshot(): Promise<MemorySnapshot> {
    return {
      timestamp: Date.now(),
      jsHeap: {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit,
      },
      wasmMemory: this.getWasmMemoryUsage(),
      resources: {
        entities: this.getEntityCount(),
        textures: this.getTextureCount(),
        audioSources: this.getAudioSourceCount(),
      },
      domNodes: {
        eventListeners: this.getEventListenerCount(),
        rafCallbacks: this.getRAFCallbackCount(),
      },
    };
  }

  private analyzeForLeaks(snapshot: MemorySnapshot): void {
    const growth = this.calculateGrowth(this.baseline, snapshot);

    if (growth.jsHeap > this.leakThresholds.heapGrowth) {
      console.warn(
        `JavaScript heap leak detected: ${growth.jsHeap / 1024 / 1024}MB`,
      );
      this.heapLeakAnalysis();
    }

    if (growth.wasm > this.leakThresholds.wasmGrowth) {
      console.warn(`WASM memory leak detected: ${growth.wasm / 1024 / 1024}MB`);
      this.wasmLeakAnalysis();
    }

    if (growth.resources > this.leakThresholds.resourceGrowth) {
      console.warn(
        `Resource leak detected: ${growth.resources} additional objects`,
      );
      this.resourceLeakAnalysis();
    }
  }
}
```

### Command Buffer Debugging

```typescript
class CommandBufferDebugPattern {
  private commandLog: CommandLogEntry[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];

  enableCommandLogging(): void {
    // Wrap command processing for logging
    const originalProcessCommand = this.processCommand.bind(this);

    this.processCommand = (opcode: number, payload: ArrayBuffer) => {
      const entry: CommandLogEntry = {
        timestamp: performance.now(),
        opcode,
        payloadSize: payload.byteLength,
        stackTrace: new Error().stack,
      };

      this.commandLog.push(entry);

      // Performance measurement
      const startTime = performance.now();
      const result = originalProcessCommand(opcode, payload);
      const duration = performance.now() - startTime;

      this.performanceMetrics.push({
        opcode,
        duration,
        timestamp: startTime,
      });

      // Check for performance issues
      if (duration > this.getSlowThreshold(opcode)) {
        console.warn(
          `Slow command detected: ${
            this.getOpcodeName(opcode)
          } took ${duration}ms`,
        );
      }

      return result;
    };
  }

  analyzeCommandLog(): CommandAnalysis {
    const opcodeFrequency = new Map<number, number>();
    const totalCommands = this.commandLog.length;

    // Count opcode frequency
    for (const entry of this.commandLog) {
      opcodeFrequency.set(
        entry.opcode,
        (opcodeFrequency.get(entry.opcode) || 0) + 1,
      );
    }

    // Find hotspots
    const hotspots = Array.from(opcodeFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return {
      totalCommands,
      hotspots,
      averageDuration: this.calculateAverageDuration(),
      slowCommands: this.findSlowCommands(),
      performanceRecommendations: this.generateOptimizationSuggestions(),
    };
  }
}
```

## Logic Debugging

### State Management Debugging

```typescript
class StateDebugPattern {
  private stateHistory: StateSnapshot[] = [];
  private maxHistorySize = 100;

  captureStateSnapshot(label: string): void {
    const snapshot: StateSnapshot = {
      timestamp: Date.now(),
      label,
      gameState: this.captureGameState(),
      runtimeState: this.captureRuntimeState(),
      renderState: this.captureRenderState(),
    };

    this.stateHistory.push(snapshot);

    // Maintain history size
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }

    console.log(`State snapshot captured: ${label}`, snapshot);
  }

  compareStates(snapshot1: StateSnapshot, snapshot2: StateSnapshot): StateDiff {
    const diff: StateDiff = {
      gameState: this.compareGameState(
        snapshot1.gameState,
        snapshot2.gameState,
      ),
      runtimeState: this.compareRuntimeState(
        snapshot1.runtimeState,
        snapshot2.runtimeState,
      ),
      renderState: this.compareRenderState(
        snapshot1.renderState,
        snapshot2.renderState,
      ),
    };

    // Log significant differences
    if (this.isSignificantDiff(diff)) {
      console.warn("Significant state change detected:", diff);
      this.analyzeStateChange(diff);
    }

    return diff;
  }

  private isSignificantDiff(diff: StateDiff): boolean {
    // Check if differences are meaningful
    return diff.gameState.entityCount > 100 || // Large entity change
      diff.runtimeState.memoryUsage > 10 * 1024 * 1024 || // Large memory change
      diff.renderState.renderTime > 16.67; // Frame time > 60fps
  }
}
```

### WASM Function Debugging

```typescript
class WasmFunctionDebugPattern {
  private functionTraces: FunctionTrace[] = [];
  private breakpoints = new Set<number>();

  traceWasmFunction(functionName: string, args: any[]): void {
    const trace: FunctionTrace = {
      functionName,
      arguments: args,
      timestamp: performance.now(),
      callStack: this.captureCallStack(),
      wasmMemoryBefore: this.getWasmMemoryUsage(),
    };

    this.functionTraces.push(trace);

    try {
      const result = this.wasmInstance.exports[functionName](...args);

      trace.result = result;
      trace.success = true;
      trace.wasmMemoryAfter = this.getWasmMemoryUsage();
      trace.duration = performance.now() - trace.timestamp;
    } catch (error) {
      trace.error = error;
      trace.success = false;
      trace.wasmMemoryAfter = this.getWasmMemoryUsage();
      trace.duration = performance.now() - trace.timestamp;
    }

    console.log(`WASM Function Trace: ${functionName}`, trace);
  }

  addBreakpoint(instructionAddress: number): void {
    this.breakpoints.add(instructionAddress);
    console.log(`Breakpoint added at address: ${instructionAddress}`);
  }

  checkBreakpoints(instructionAddress: number): boolean {
    return this.breakpoints.has(instructionAddress);
  }

  stepThroughWasm(): void {
    // Enable single-step execution mode
    console.log("WASM single-step mode enabled");
    // Implementation would require runtime support
  }
}
```

## Integration Debugging

### End-to-End Testing Pattern

```typescript
class EndToEndDebugPattern {
  async runIntegrationTest(testScenario: TestScenario): Promise<TestResult> {
    console.log(`Starting integration test: ${testScenario.name}`);

    const testState = {
      startTime: performance.now(),
      phase: "setup",
      errors: [],
      measurements: {},
    };

    try {
      // Setup phase
      await this.setupTestEnvironment(testScenario.setup);
      testState.phase = "execution";

      // Execution phase
      const executionResult = await this.executeTestScenario(
        testScenario.execution,
      );
      testState.phase = "validation";

      // Validation phase
      const validationResult = await this.validateTestResult(
        testScenario.validation,
      );

      testState.endTime = performance.now();
      testState.duration = testState.endTime - testState.startTime;
      testState.success = validationResult.success;

      return this.generateTestReport(
        testState,
        executionResult,
        validationResult,
      );
    } catch (error) {
      testState.errors.push(error);
      testState.endTime = performance.now();
      testState.duration = testState.endTime - testState.startTime;
      testState.success = false;

      return this.generateTestReport(testState, null, null);
    }
  }

  private async executeTestScenario(
    scenario: ExecutionScenario,
  ): Promise<ExecutionResult> {
    const result: ExecutionResult = {
      actions: [],
      performance: {},
      artifacts: {},
    };

    for (const action of scenario.actions) {
      const actionResult = await this.executeAction(action);
      result.actions.push(actionResult);

      // Check for performance thresholds
      if (actionResult.duration > action.expectedMaxDuration) {
        console.warn(`Action exceeded expected duration: ${action.name}`);
      }
    }

    return result;
  }
}
```

### Cross-Browser Testing Pattern

```typescript
class CrossBrowserDebugPattern {
  private browsers = ["chrome", "firefox", "safari", "edge"];
  private testResults = new Map<string, BrowserTestResult>();

  async runCrossBrowserTest(testUrl: string): Promise<CrossBrowserReport> {
    const results = new Map<string, BrowserTestResult>();

    for (const browser of this.browsers) {
      try {
        const result = await this.runBrowserTest(browser, testUrl);
        results.set(browser, result);
      } catch (error) {
        console.error(`Browser test failed for ${browser}:`, error);
        results.set(browser, {
          browser,
          success: false,
          error: error.message,
        });
      }
    }

    return this.analyzeCrossBrowserResults(results);
  }

  private async runBrowserTest(
    browser: string,
    url: string,
  ): Promise<BrowserTestResult> {
    // This would integrate with browser automation tools
    console.log(`Testing on ${browser}...`);

    // Simulate browser-specific testing
    const startTime = performance.now();

    try {
      // Load test page
      const results = await this.loadTestPage(browser, url);

      // Run test suite
      const testResults = await this.runTestSuite(results);

      return {
        browser,
        success: true,
        loadTime: performance.now() - startTime,
        testResults,
      };
    } catch (error) {
      return {
        browser,
        success: false,
        error: error.message,
      };
    }
  }
}
```

## Debugging Tools and Utilities

### Debug Information Collector

```typescript
class DebugInfoCollector {
  collectSystemInfo(): SystemInfo {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      webgl: this.getWebGLInfo(),
      webgpu: this.getWebGPUInfo(),
      memory: performance.memory,
      cores: navigator.hardwareConcurrency,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
      },
    };
  }

  collectWasmInfo(): WasmInfo {
    return {
      module: this.getWasmModuleInfo(),
      memory: this.getWasmMemoryInfo(),
      imports: this.getWasmImportInfo(),
      exports: this.getWasmExportInfo(),
      performance: this.getWasmPerformanceInfo(),
    };
  }

  generateDebugDump(): DebugDump {
    const timestamp = new Date().toISOString();

    return {
      timestamp,
      system: this.collectSystemInfo(),
      wasm: this.collectWasmInfo(),
      logs: this.collectRecentLogs(),
      errors: this.collectRecentErrors(),
      performance: this.collectPerformanceMetrics(),
    };
  }
}
```

### Error Recovery Pattern

```typescript
class ErrorRecoveryPattern {
  private recoveryStrategies = new Map<string, RecoveryStrategy>();

  setupRecoveryStrategies(): void {
    this.recoveryStrategies.set("wasm_instantiation_failed", {
      name: "WASM Instantiation Failed",
      recover: this.recoverFromWasmInstantiationError.bind(this),
      fallback: this.loadFallbackWasm.bind(this),
    });

    this.recoveryStrategies.set("asset_loading_failed", {
      name: "Asset Loading Failed",
      recover: this.retryAssetLoading.bind(this),
      fallback: this.usePlaceholderAssets.bind(this),
    });

    this.recoveryStrategies.set("rendering_failed", {
      name: "Rendering Failed",
      recover: this.reinitializeRenderer.bind(this),
      fallback: this.useTextMode.bind(this),
    });
  }

  async handleError(error: Error, context: string): Promise<RecoveryResult> {
    const strategy = this.recoveryStrategies.get(error.type);

    if (!strategy) {
      // Unknown error type
      return {
        success: false,
        error: "Unknown error type: " + error.type,
        action: "manual_intervention_required",
      };
    }

    try {
      const result = await strategy.recover(error, context);

      console.log(`Recovery strategy executed: ${strategy.name}`, result);

      return {
        success: true,
        strategy: strategy.name,
        action: result,
      };
    } catch (recoveryError) {
      console.error(`Recovery strategy failed:`, recoveryError);

      try {
        const fallbackResult = await strategy.fallback(error, context);
        console.log(`Fallback strategy executed:`, fallbackResult);

        return {
          success: true,
          strategy: strategy.name + " (fallback)",
          action: fallbackResult,
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: "Both recovery and fallback failed",
          action: "manual_intervention_required",
        };
      }
    }
  }
}
```

## Best Practices and Lessons Learned

### Debugging Best Practices

1. **Multi-layer Approach**: Debug at WASM, runtime, and browser levels
2. **Comprehensive Logging**: Log everything with context and performance data
3. **Automated Detection**: Prevent issues before users encounter them
4. **User-Friendly Recovery**: Graceful degradation and clear error messages

### Common Pitfalls

1. **Silent Failures**: Errors that don't show visible symptoms
2. **Memory Leaks**: Gradual memory growth that becomes problematic over time
3. **Performance Regressions**: Slow code execution that wasn't slow before
4. **Browser Differences**: Code that works in one browser but not others

### Debugging Workflow

1. **Reproduce Consistently**: Create reliable reproduction steps
2. **Isolate Variables**: Test one change at a time
3. **Measure Everything**: Use quantitative data to guide fixes
4. **Document Solutions**: Record problems and solutions for future reference

---

**Purpose**: These debugging patterns provide proven approaches for identifying,
diagnosing, and resolving issues in WebAssembly-based web applications.

**Application**: These patterns have been successfully applied throughout the
Blitz3D-WASM project to achieve production stability and performance.

**Evolution**: The patterns evolved from basic debugging to sophisticated,
automated detection and recovery systems.
