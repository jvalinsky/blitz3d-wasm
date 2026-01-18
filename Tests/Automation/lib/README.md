# WASM Infrastructure Library

This directory contains JavaScript modules for optimized WASM loading, caching, and performance monitoring in the Blitz3D WASM project.

## Architecture Overview

```
Tests/Automation/lib/
├── wasm-cache.js              # Cache API + IndexedDB caching
├── wasm-compression.js        # Brotli/gzip decompression
├── wasm-compiler-worker.js    # Background compilation WebWorker
├── enhanced-wasm-loader.js    # Integrated loader with all optimizations
└── enhanced-performance-monitor.js  # Performance monitoring & analysis
```

## Modules

### WASMCache (`wasm-cache.js`)

Provides intelligent caching for WASM modules using Cache API and IndexedDB.

**Key Features:**
- Dual-layer caching (Cache API for raw bytes, IndexedDB for compiled modules)
- Automatic cache invalidation (7-day TTL)
- Cache preloading for multiple modules
- Statistics and cleanup utilities

**API:**
```javascript
const cache = new WASMCache();
await cache.init();
const result = await cache.loadWithCache(url, importObject);
await cache.clear();
const stats = await cache.getStats();
```

### WASMCompression (`wasm-compression.js`)

Handles compression and decompression of WASM files.

**Key Features:**
- Brotli and gzip decompression support
- Automatic format detection
- Bundle manager for loading multiple modules
- Compression ratio statistics

**API:**
```javascript
const compression = new WASMCompression();
const support = await compression.checkSupport();
const decompressed = await compression.decompress(buffer, 'br');
const bundle = await bundleManager.loadBundle('id', urls, importObject);
```

### WASMCompilerWorker (`wasm-compiler-worker.js`)

WebWorker for background WASM compilation to avoid blocking the main thread.

**Usage:**
```javascript
const worker = new Worker('lib/wasm-compiler-worker.js');
worker.postMessage({ url, importObject, id });
worker.onmessage = (event) => {
  if (event.data.success) {
    // event.data.module, event.data.compileTime
  }
};
```

### EnhancedWASMLoader (`enhanced-wasm-loader.js`)

Integrated loader combining caching, WebWorker compilation, and progressive loading.

**Key Features:**
- Automatic cache-first loading
- WebWorker compilation when beneficial
- Concurrency control for workers
- Preload multiple modules in parallel
- Statistics and cache management

**API:**
```javascript
const loader = new EnhancedWASMLoader({
  useWorker: true,
  useCache: true,
  maxCacheSize: 50 * 1024 * 1024
});

const result = await loader.load(url, importObject);
const stats = loader.getStats();
await loader.preload([url1, url2]);
await loader.clearCache();
```

### EnhancedPerformanceMonitor (`enhanced-performance-monitor.js`)

Comprehensive performance monitoring for WASM loading operations.

**Key Features:**
- WASM loading phase tracking (fetch, compile, instantiate)
- Memory usage monitoring
- Network performance analysis
- Automatic bottleneck detection
- Optimization recommendations
- Report generation

**API:**
```javascript
const monitor = new EnhancedPerformanceMonitor();
await monitor.initialize(page);
monitor.startMonitoring();
// ... perform WASM load ...
const metrics = await monitor.stopMonitoring();
const report = monitor.generateReport(metrics);
```

## Integration with Tests

The test runner (`run_tests.js`) automatically integrates with:

1. **Error Capture**: WASM errors are captured and categorized
2. **Performance Monitoring**: Load times and bottlenecks are tracked
3. **Reports**: JSON, text, and performance reports are generated

## Testing

Run the integration tests:

```bash
# Run cache tests
node test-wasm-cache.js

# Run performance tests
node test-performance.js

# Run all tests
node run_tests.js
```

## Performance Considerations

1. **First Load**: Slower due to network fetch and compilation
2. **Subsequent Loads**: Faster due to cached compiled modules
3. **Worker Compilation**: Non-blocking compilation for better UI responsiveness
4. **Memory**: Compiled modules stored in IndexedDB survive page refreshes

## Browser Compatibility

- Chrome 60+ (Cache API, DecompressionStream)
- Firefox 57+ (Cache API)
- Safari 11+ (IndexedDB, basic WASM)
- Edge 79+

## Configuration

Options for `EnhancedWASMLoader`:

| Option | Default | Description |
|--------|---------|-------------|
| `cache` | `new WASMCache()` | Cache instance to use |
| `workerScript` | `'lib/wasm-compiler-worker.js'` | WebWorker script path |
| `useWorker` | `true` | Enable WebWorker compilation |
| `useCache` | `true` | Enable caching |
| `maxCacheSize` | `50MB` | Maximum cache size |

## Error Handling

All modules gracefully handle errors and continue without caching if storage is unavailable. This ensures the application works even in restricted environments.
