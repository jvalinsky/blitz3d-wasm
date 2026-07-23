# Memory Leak Detection

## Overview

Blitz3D-WASM includes a comprehensive memory leak detection suite designed to
prevent production issues and ensure long-term stability of browser-based games.
The system combines static code analysis, runtime lifecycle testing, and
specialized WebGPU validation to catch memory issues before they reach users.

### Design Philosophy

- **Prevention First**: Catch leaks during development, not in production
- **Comprehensive Coverage**: Test both JavaScript and WebAssembly memory
  domains
- **Automated Validation**: CI/CD integration prevents regressions
- **Developer Friendly**: Clear diagnostics and actionable feedback
- **Performance Conscious**: Minimal overhead during testing

## Testing Architecture

### Multi-Level Testing

```
┌─────────────────────────────────────────┐
│ Static Analysis (Pattern Matching)      │
├─────────────────────────────────────────┤
│ Headless Runtime Testing              │
├─────────────────────────────────────────┤
│ Browser-based Testing                │
├─────────────────────────────────────────┤
│ WebGPU Resource Testing              │
└─────────────────────────────────────────┘
```

### Memory Domains Monitored

1. **JavaScript Heap**: V8/SpiderMonkey garbage collection
2. **WASM Linear Memory**: WebAssembly memory growth
3. **Graphics Resources**: Three.js objects, textures, meshes
4. **Event Listeners**: DOM and animation frame callbacks
5. **GPU Resources**: WebGPU buffers, textures, command queues

## Static Analysis

### Pattern Scanner

The static analyzer scans source code for common memory leak patterns using
heuristic matching.

```bash
# Run static analysis
deno task memleak:scan --root web/src/runtime --fail --max 50
```

### Detected Patterns

#### Event Listener Leaks

```javascript
// ❌ Potential leak - listener never removed
addEventListener("click", handler);

// ✅ Proper cleanup
const handler = () => {/* ... */};
addEventListener("click", handler);
// Later: removeEventListener('click', handler);
```

#### Animation Frame Loops

```javascript
// ❌ Potential leak - RAF never cancelled
function animate() {
  // Game logic
  requestAnimationFrame(animate);
}
animate();

// ✅ Proper cleanup
let animationId = null;
function animate() {
  // Game logic
  animationId = requestAnimationFrame(animate);
}
function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
}
```

#### Three.js Resource Leaks

```javascript
// ❌ Potential leak - texture not disposed
const texture = new THREE.Texture();
// texture.dispose() never called

// ✅ Proper cleanup
function disposeTexture(texture) {
  texture.dispose();
  // Remove references
  texture = null;
}
```

### Configuration

```typescript
interface LeakScanConfig {
  patterns: {
    requestAnimationFrame: boolean;
    setInterval: boolean;
    setTimeout: boolean;
    anonymousListeners: boolean;
    threeDispose: boolean;
    threeClone: boolean;
  };
  thresholds: {
    maxPatterns: number;
    maxAnonymousHandlers: number;
  };
  paths: string[];
  failOnError: boolean;
}
```

## Runtime Testing

### Headless Lifecycle Testing

Tests component creation/destruction cycles without browser overhead.

```bash
# Basic lifecycle testing
deno task memleak:run --cycles 5 --settle-ms 10

# With WASM module
deno task memleak:run --wasm Main.wasm --cycles 10 --call-count 5

# With growth thresholds
deno task memleak:run --cycles 5 --fail-on-growth-bytes 10485760
```

### Test Framework

```typescript
class MemoryLeakTest {
  private baseline: MemorySnapshot;
  private snapshots: MemorySnapshot[] = [];

  async runTest(config: LeakTestConfig): Promise<LeakTestResult> {
    // Establish baseline
    this.baseline = await this.captureSnapshot();

    // Run create/dispose cycles
    for (let i = 0; i < config.cycles; i++) {
      await this.createComponents();
      await this.settle(config.settleMs);
      this.snapshots.push(await this.captureSnapshot());
      await this.disposeComponents();
      await this.settle(config.settleMs);
    }

    return this.analyzeResults(config);
  }

  private async createComponents(): Promise<void> {
    // Instantiate runtime components
    this.runtime = new Blitz3DRuntime();
    this.graphics = new ThreeJSRenderer();
    this.audio = new WebAudioSystem();
  }

  private async disposeComponents(): Promise<void> {
    // Clean up all resources
    this.graphics.dispose();
    this.audio.dispose();
    this.runtime.dispose();
  }

  private analyzeResults(config: LeakTestConfig): LeakTestResult {
    const growth = this.calculateGrowth();
    const leaks = this.detectLeaks();

    return {
      passed: growth.bytes < config.maxGrowthBytes,
      growth,
      leaks,
      recommendations: this.generateRecommendations(leaks),
    };
  }
}
```

### Memory Snapshots

```typescript
interface MemorySnapshot {
  timestamp: number;
  jsHeap: {
    used: number;
    total: number;
    limit: number;
  };
  wasmMemory?: {
    used: number;
    capacity: number;
  };
  graphics: {
    entities: number;
    textures: number;
    meshes: number;
    materials: number;
  };
  eventListeners: number;
  rafCallbacks: number;
}
```

## WebGPU Testing

### GPU Resource Management

WebGPU-specific testing catches GPU memory leaks that aren't visible to
JavaScript GC.

```bash
# Basic WebGPU test
deno task memleak:webgpu --iterations 50 --verbose

# Strict mode validation
deno task memleak:webgpu:strict --iterations 100 --fail-on-growth-bytes 52428800

# Queue validation
deno task memleak:webgpu:strict-queue --iterations 50 --queue-timeout-ms 2000
```

### WebGPU Test Framework

```typescript
class WebGPULeakTest {
  private adapter: GPUAdapter;
  private device: GPUDevice;
  private queue: GPUQueue;
  private resources: GPUResource[] = [];

  async runTest(config: WebGPUConfig): Promise<WebGPULeakResult> {
    await this.initializeWebGPU();

    const baseline = await this.captureGPUState();

    for (let i = 0; i < config.iterations; i++) {
      await this.createGPUResources();
      await this.executeCommands();
      await this.disposeGPUResources();

      const state = await this.captureGPUState();
      this.detectGPULeaks(baseline, state);
    }

    return this.analyzeGPUResults();
  }

  private async createGPUResources(): Promise<void> {
    // Create buffers
    const buffer = this.device.createBuffer({
      size: 1024 * 1024, // 1MB
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.resources.push(buffer);

    // Create textures
    const texture = this.device.createTexture({
      size: { width: 512, height: 512 },
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    this.resources.push(texture);
  }

  private async disposeGPUResources(): Promise<void> {
    for (const resource of this.resources) {
      if ("destroy" in resource) {
        resource.destroy();
      }
    }
    this.resources.length = 0;
  }
}
```

## SCPCB-Specific Testing

### Game-Specific Validation

Specialized tests for SCP: Containment Breach runtime patterns.

```bash
# Compile SCPCB leak test
deno task memleak:scpcb:compile

# Run churn test (simulates gameplay)
deno task memleak:scpcb:churn --steps 2000 --check-every 50

# With strict thresholds
deno task memleak:scpcb:churn --steps 5000 \
  --fail-on-growth-bytes 25000000 \
  --wasm-fail-on-growth-bytes 67108864 \
  --runtime-logs --verbose
```

### SCPCB Test Patterns

```typescript
class SCPCBLeakTest extends MemoryLeakTest {
  async runGameLoop(steps: number): Promise<void> {
    for (let i = 0; i < steps; i++) {
      // Simulate one game tick
      await this.gameTick();

      // Check handle maps every N steps
      if (i % this.config.checkEvery === 0) {
        this.validateHandleMaps();
      }
    }
  }

  private async gameTick(): Promise<void> {
    // Simulate gameplay operations
    await this.simulateEntityUpdates();
    await this.simulateAudioPlayback();
    await this.simulateGraphicsRendering();
  }

  private validateHandleMaps(): void {
    const entityCount = this.runtime.getEntityCount();
    const graphicsHandles = this.graphics.getHandleCount();

    if (entityCount !== graphicsHandles) {
      throw new Error(
        `Handle map mismatch: ${entityCount} entities, ${graphicsHandles} graphics handles`,
      );
    }
  }
}
```

## CI/CD Integration

### Automated Testing Pipeline

```yaml
# .github/workflows/memleak.yml
name: Memory Leak Detection

on: [push, pull_request]

jobs:
  memleak-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: denoland/setup-deno@v2

      - name: Static Analysis
        run: deno task memleak:scan --fail --max 50

      - name: Runtime Testing
        run: deno task memleak:run --cycles 5 --fail-on-growth-bytes 10485760

      - name: WebGPU Testing
        run: deno task memleak:webgpu:strict --iterations 50 || true

      - name: SCPCB Validation
        run: |
          deno task memleak:scpcb:compile
          deno task memleak:scpcb:churn --steps 1000 --check-every 50 \
            --fail-on-growth-bytes 25000000
```

### Performance Regression Detection

```typescript
interface PerformanceBaseline {
  timestamp: string;
  metrics: {
    heapGrowthPerHour: number;
    wasmGrowthPerHour: number;
    graphicsHandleGrowth: number;
    maxEntities: number;
  };
}

function compareWithBaseline(
  current: PerformanceMetrics,
  baseline: PerformanceBaseline,
): RegressionReport {
  const regressionThreshold = 1.5; // 50% increase threshold

  return {
    heapRegression: current.heapGrowthPerHour >
      baseline.metrics.heapGrowthPerHour * regressionThreshold,
    wasmRegression: current.wasmGrowthPerHour >
      baseline.metrics.wasmGrowthPerHour * regressionThreshold,
    overallPassed: current.overallGrowth < baseline.metrics.maxGrowth * 1.2,
  };
}
```

## Debugging Tools

### Firefox Heap Snapshot Analysis

```bash
# Analyze Firefox heap snapshot
deno task memleak:fxsnapshot:strings \
  /path/to/snapshot.fxsnapshot \
  --kind both \
  --match "WebAssembly|THREE|wasm"
```

### Runtime Monitoring

```typescript
class MemoryMonitor {
  private intervalId: number;
  private history: MemorySnapshot[] = [];

  startMonitoring(intervalMs: number = 5000): void {
    this.intervalId = setInterval(() => {
      this.history.push(this.captureSnapshot());

      // Keep last 100 snapshots
      if (this.history.length > 100) {
        this.history.shift();
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    clearInterval(this.intervalId);
  }

  detectAnomalies(): MemoryAnomaly[] {
    const anomalies: MemoryAnomaly[] = [];

    for (let i = 1; i < this.history.length; i++) {
      const current = this.history[i];
      const previous = this.history[i - 1];

      // Detect sudden growth spikes
      if (current.jsHeap.used > previous.jsHeap.used * 1.5) {
        anomalies.push({
          type: "heap_spike",
          timestamp: current.timestamp,
          before: previous.jsHeap.used,
          after: current.jsHeap.used,
          growth: current.jsHeap.used - previous.jsHeap.used,
        });
      }
    }

    return anomalies;
  }
}
```

## Best Practices

### Development Guidelines

1. **Regular Testing**: Run leak tests after significant changes
2. **Threshold Management**: Set appropriate growth limits for your use case
3. **Resource Tracking**: Maintain clear ownership of all resources
4. **Cleanup Patterns**: Establish consistent disposal patterns
5. **Monitoring**: Enable memory monitoring during development

### Resource Ownership

```typescript
class ResourceManager {
  private resources = new Map<string, DisposableResource>();

  acquire<T extends DisposableResource>(id: string, factory: () => T): T {
    if (this.resources.has(id)) {
      throw new Error(`Resource ${id} already exists`);
    }

    const resource = factory();
    this.resources.set(id, resource);
    return resource;
  }

  release(id: string): void {
    const resource = this.resources.get(id);
    if (resource) {
      resource.dispose();
      this.resources.delete(id);
    }
  }

  disposeAll(): void {
    for (const [id, resource] of this.resources) {
      resource.dispose();
    }
    this.resources.clear();
  }
}
```

### Pattern Libraries

```typescript
// Reusable leak-safe patterns
export const LeakSafePatterns = {
  eventListener: <T extends Event>(
    target: EventTarget,
    type: string,
    handler: (event: T) => void,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler, options);

    return () => {
      target.removeEventListener(type, handler, options);
    };
  },

  animationFrame: (callback: FrameRequestCallback) => {
    let animationId: number;

    const animate = () => {
      callback();
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  },

  timeout: (callback: () => void, delay: number) => {
    const timeoutId = setTimeout(callback, delay);

    return () => clearTimeout(timeoutId);
  },
};
```

## Performance Impact

### Testing Overhead

| Test Type    | CPU Overhead | Memory Overhead | Duration |
| ------------ | ------------ | --------------- | -------- |
| Static Scan  | < 5%         | Negligible      | < 1s     |
| Runtime Test | 10-15%       | Temporary       | 5-30s    |
| WebGPU Test  | 5-10%        | GPU memory      | 10-60s   |
| SCPCB Churn  | 15-20%       | WASM + JS       | 30-120s  |

### Production Monitoring

```typescript
// Production-safe memory monitoring
class ProductionMemoryMonitor {
  private static instance: ProductionMemoryMonitor;
  private thresholds = {
    maxHeapGrowthPerHour: 10 * 1024 * 1024, // 10MB
    maxWASMGrowthPerHour: 50 * 1024 * 1024, // 50MB
    maxHandleGrowthPerHour: 100,
  };

  static getInstance(): ProductionMemoryMonitor {
    if (!this.instance) {
      this.instance = new ProductionMemoryMonitor();
    }
    return this.instance;
  }

  checkMemory(): HealthReport {
    const snapshot = this.captureSnapshot();
    const growth = this.calculateGrowth(snapshot);

    return {
      healthy: growth.heap < this.thresholds.maxHeapGrowthPerHour &&
        growth.wasm < this.thresholds.maxWASMGrowthPerHour &&
        growth.handles < this.thresholds.maxHandleGrowthPerHour,
      snapshot,
      growth,
      alerts: this.generateAlerts(growth),
    };
  }
}
```

---

The memory leak detection system provides comprehensive coverage of all memory
domains in Blitz3D-WASM applications, ensuring production stability and
long-term performance for complex browser-based games.
