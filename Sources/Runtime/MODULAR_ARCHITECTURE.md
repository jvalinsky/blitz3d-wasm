/**
 * Blitz3D WASM Runtime - Modular System Documentation
 * 
 * ## Overview
 * 
 * The Blitz3D Runtime has been refactored into modular components for better
 * maintainability, testing, and extensibility.
 * 
 * ## Module Structure
 * 
 * ```
 * Sources/Runtime/
 * ├── runtime.js              # Main entry point (backwards compatible)
 * ├── modules/
 * │   ├── core.js             # Core functionality and initialization
 * │   ├── graphics.js         # 3D graphics (Three.js integration)
 * │   ├── physics.js          # Collision detection and physics
 * │   ├── input.js            # Keyboard/mouse input handling
 * │   └── runtime.js          # Main integration module
 * ```
 * 
 * ## Usage
 * 
 * ### Standard Usage (Same as before)
 * ```html
 * <script src="Sources/Runtime/runtime.js"></script>
 * <script>
 *     Blitz3D.init('canvas');
 *     await Blitz3D.load('game.wasm');
 * </script>
 * ```
 * 
 * ### Programmatic Usage with Cache
 * ```javascript
 * // Use WASM cache for faster subsequent loads
 * const cache = new WASMCache();
 * await cache.init();
 * const result = await cache.loadWithCache(url, imports);
 * ```
 * 
 * ### Enhanced Loading with WebWorkers
 * ```javascript
 * const loader = new EnhancedWASMLoader({
 *     useWorker: true,
 *     useCache: true,
 *     maxWorkers: 4
 * });
 * const result = await loader.load(url, imports);
 * ```
 * 
 * ## New Features
 * 
 * ### WASM Caching
 * - **Cache API**: Stores raw WASM bytes for fast network retrieval
 * - **IndexedDB**: Stores compiled WebAssembly.Module objects
 * - **Automatic cleanup**: Removes entries older than 7 days
 * - **Pre-warming**: Preload critical WASM files before use
 * 
 * ### Performance Monitoring
 * ```javascript
 * const monitor = new EnhancedPerformanceMonitor();
 * await monitor.initialize(page);
 * monitor.startMonitoring();
 * // ... load WASM ...
 * const analysis = await monitor.stopMonitoring();
 * console.log(monitor.generateReport(analysis));
 * ```
 * 
 * ### Background Compilation
 * ```javascript
 * // Compilation happens in WebWorker, doesn't block UI
 * const worker = new Worker('lib/wasm-compiler-worker.js');
 * worker.postMessage({ url: wasmUrl, imports, id: uniqueId });
 * ```
 * 
 * ## API Reference
 * 
 * ### WASMCache
 * ```javascript
 * const cache = new WASMCache();
 * await cache.init();
 * await cache.loadWithCache(url, imports);  // Load with caching
 * await cache.preload([urls]);               // Preload multiple files
 * await cache.clear();                       // Clear all cached data
 * const stats = await cache.getStats();      // Get cache statistics
 * ```
 * 
 * ### EnhancedPerformanceMonitor
 * ```javascript
 * const monitor = new EnhancedPerformanceMonitor();
 * await monitor.initialize(page);
 * monitor.startMonitoring();
 * // ... perform operations ...
 * const analysis = await monitor.stopMonitoring();
 * console.log(analysis.bottlenecks);   // Identified issues
 * console.log(analysis.recommendations); // Optimization suggestions
 * ```
 * 
 * ## Migration Guide
 * 
 * ### From Original runtime.js
 * The new runtime.js is fully backwards compatible. Simply replace:
 * ```html
 * <script src="Sources/Runtime/runtime.js"></script>
 * ```
 * with the new version - everything should work identically.
 * 
 * ### Using New Features
 * To enable caching, include the cache module:
 * ```html
 * <script src="lib/wasm-cache.js"></script>
 * <script src="Sources/Runtime/runtime.js"></script>
 * ```
 * 
 * ## Testing
 * 
 * ### Standard Tests
 * ```bash
 * cd Tests/Automation
 * node run_tests.js
 * ```
 * 
 * ### Enhanced Tests with Monitoring
 * ```bash
 * cd Tests/Automation
 * node run_enhanced_tests.js
 * ```
 * 
 * ## Performance Tips
 * 
 * 1. **Preload critical modules**: Use `cache.preload()` for frequently used WASM files
 * 2. **Use WebWorkers**: Enable `useWorker: true` for non-blocking compilation
 * 3. **Monitor performance**: Use EnhancedPerformanceMonitor to identify bottlenecks
 * 4. **Compress WASM files**: Use Brotli compression for smaller downloads
 * 
 * ## File Structure
 * 
 * ### Test Infrastructure
 * ```
 * Tests/Automation/
 * ├── run_tests.js              # Original test runner
 * ├── run_enhanced_tests.js     # Enhanced test runner with monitoring
 * └── lib/
 *     ├── wasm-cache.js              # WASM caching module
 *     ├── wasm-compiler-worker.js    # Background compilation worker
 *     ├── enhanced-wasm-loader.js    # Optimized WASM loader
 *     ├── enhanced-performance-monitor.js  # Performance analysis
 *     └── wasm-error-capture.js      # Error monitoring
 * ```
 * 
 * ## Changelog
 * 
 * ### Version 2.0.0
 * - ✅ Modular architecture (core, graphics, physics, input)
 * - ✅ WASM caching with Cache API and IndexedDB
 * - ✅ Background compilation with WebWorkers
 * - ✅ Enhanced performance monitoring
 * - ✅ Better error handling and reporting
 * - ✅ Improved test harness with explicit timing
 * - ✅ Backwards compatible API
 */