/**
 * Enhanced Performance Monitor for WASM Loading
 * Provides comprehensive performance analysis and bottleneck detection
 */

class EnhancedPerformanceMonitor {
    constructor() {
        this.measurements = [];
        this.benchmarks = new Map();
        this.memorySnapshots = [];
        this.isMonitoring = false;
        this.wasmLoadPhases = {
            fetchStart: null,
            fetchEnd: null,
            compileStart: null,
            compileEnd: null,
            instantiateStart: null,
            instantiateEnd: null,
            initStart: null,
            initEnd: null
        };
    }

    /**
     * Initialize enhanced performance monitoring on a Puppeteer page
     */
    async initialize(page) {
        this.page = page;
        
        // Inject enhanced monitoring code
        await page.evaluateOnNewDocument(() => {
            window.enhancedPerfMetrics = {
                startTime: performance.now(),
                memorySnapshots: [],
                wasmLoadPhases: {},
                functionCallTimes: {},
                networkRequests: [],
                loadingStages: [],
                bottlenecks: []
            };

            // Track WASM loading phases by overriding WebAssembly methods
            const originalInstantiateStreaming = WebAssembly.instantiateStreaming;
            const originalInstantiate = WebAssembly.instantiate;
            const originalCompileStreaming = WebAssembly.compileStreaming;

            WebAssembly.instantiateStreaming = async function(...args) {
                window.enhancedPerfMetrics.wasmLoadPhases.compileStart = performance.now();
                try {
                    const result = await originalInstantiateStreaming.apply(this, args);
                    window.enhancedPerfMetrics.wasmLoadPhases.compileEnd = performance.now();
                    return result;
                } catch (error) {
                    window.enhancedPerfMetrics.wasmLoadPhases.compileEnd = performance.now();
                    throw error;
                }
            };

            WebAssembly.instantiate = async function(...args) {
                window.enhancedPerfMetrics.wasmLoadPhases.compileStart = performance.now();
                try {
                    const result = await originalInstantiate.apply(this, args);
                    window.enhancedPerfMetrics.wasmLoadPhases.compileEnd = performance.now();
                    return result;
                } catch (error) {
                    window.enhancedPerfMetrics.wasmLoadPhases.compileEnd = performance.now();
                    throw error;
                }
            };

            // Monitor fetch for network timing
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const url = args[0];
                const startTime = performance.now();
                
                return originalFetch.apply(this, args)
                    .then(response => {
                        const endTime = performance.now();
                        const duration = endTime - startTime;
                        
                        window.enhancedPerfMetrics.networkRequests.push({
                            url: url,
                            startTime: startTime,
                            endTime: endTime,
                            duration: duration,
                            status: response.status,
                            success: response.ok,
                            type: url.includes('.wasm') ? 'wasm' : 'other'
                        });

                        // Track WASM fetch specifically
                        if (url.includes('.wasm')) {
                            window.enhancedPerfMetrics.wasmLoadPhases.fetchStart = startTime;
                            window.enhancedPerfMetrics.wasmLoadPhases.fetchEnd = endTime;
                        }

                        return response;
                    });
            };

            // Memory monitoring with snapshot capture
            function captureMemorySnapshot(label) {
                if (performance.memory) {
                    const snapshot = {
                        timestamp: performance.now(),
                        label: label,
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                    };
                    window.enhancedPerfMetrics.memorySnapshots.push(snapshot);
                    return snapshot;
                }
                return null;
            }

            // Capture initial memory state
            captureMemorySnapshot('initial');

            // Monitor page load events
            if (typeof PerformanceObserver !== 'undefined') {
                try {
                    const observer = new PerformanceObserver((list) => {
                        for (const entry of list.getEntries()) {
                            window.enhancedPerfMetrics.loadingStages.push({
                                name: entry.name,
                                startTime: entry.startTime,
                                duration: entry.duration,
                                entryType: entry.entryType
                            });
                        }
                    });
                    observer.observe({ entryTypes: ['navigation', 'paint', 'resource', 'largest-contentful-paint'] });
                } catch (e) {
                    console.warn('PerformanceObserver not fully supported');
                }
            }

            // Expose memory capture function globally
            window.captureMemorySnapshot = captureMemorySnapshot;
        });

        // Set up Puppeteer-specific monitoring
        page.on('response', response => {
            const url = response.url();
            const timing = response.timing();
            
            if (url.includes('.wasm')) {
                this.wasmLoadPhases.fetchStart = timing.requestTime * 1000;
                this.wasmLoadPhases.responseEnd = (timing.requestTime + timing.receiveHeadersEnd) * 1000;
            }
        });
    }

    /**
     * Start monitoring a WASM load operation
     */
    startMonitoring() {
        this.wasmLoadPhases = {
            fetchStart: null,
            fetchEnd: null,
            compileStart: null,
            compileEnd: null,
            instantiateStart: null,
            instantiateEnd: null,
            initStart: null,
            initEnd: null
        };
        this.isMonitoring = true;
    }

    /**
     * Stop monitoring and collect results
     */
    async stopMonitoring() {
        this.isMonitoring = false;
        
        // Collect page metrics
        const metrics = await this.page.evaluate(() => {
            return window.enhancedPerfMetrics;
        });

        return this.analyzeResults(metrics);
    }

    /**
     * Analyze performance results and identify bottlenecks
     */
    analyzeResults(metrics) {
        const analysis = {
            totalLoadTime: 0,
            phases: {},
            bottlenecks: [],
            recommendations: [],
            memoryUsage: {},
            networkPerformance: {}
        };

        // Calculate phase durations
        const phases = ['fetchStart', 'fetchEnd', 'compileStart', 'compileEnd', 'instantiateStart', 'instantiateEnd'];
        
        if (metrics.wasmLoadPhases) {
            phases.forEach(phase => {
                if (metrics.wasmLoadPhases[phase]) {
                    analysis.phases[phase] = metrics.wasmLoadPhases[phase];
                }
            });

            // Calculate key metrics
            if (metrics.wasmLoadPhases.fetchStart && metrics.wasmLoadPhases.fetchEnd) {
                analysis.phases.fetchDuration = metrics.wasmLoadPhases.fetchEnd - metrics.wasmLoadPhases.fetchStart;
            }
            
            if (metrics.wasmLoadPhases.compileStart && metrics.wasmLoadPhases.compileEnd) {
                analysis.phases.compileDuration = metrics.wasmLoadPhases.compileEnd - metrics.wasmLoadPhases.compileStart;
            }

            // Total load time
            if (metrics.wasmLoadPhases.fetchStart && metrics.wasmLoadPhases.compileEnd) {
                analysis.totalLoadTime = metrics.wasmLoadPhases.compileEnd - metrics.wasmLoadPhases.fetchStart;
            }
        }

        // Analyze network performance
        const wasmRequests = metrics.networkRequests?.filter(r => r.type === 'wasm') || [];
        if (wasmRequests.length > 0) {
            analysis.networkPerformance = {
                requestCount: wasmRequests.length,
                averageDuration: wasmRequests.reduce((sum, r) => sum + r.duration, 0) / wasmRequests.length,
                totalDownloadTime: wasmRequests.reduce((sum, r) => sum + r.duration, 0),
                successRate: wasmRequests.filter(r => r.success).length / wasmRequests.length
            };
        }

        // Analyze memory usage
        if (metrics.memorySnapshots && metrics.memorySnapshots.length > 0) {
            const initial = metrics.memorySnapshots[0];
            const final = metrics.memorySnapshots[metrics.memorySnapshots.length - 1];
            
            analysis.memoryUsage = {
                initialHeap: initial?.usedJSHeapSize || 0,
                finalHeap: final?.usedJSHeapSize || 0,
                peakHeap: Math.max(...metrics.memorySnapshots.map(s => s.usedJSHeapSize)),
                memoryGrowth: (final?.usedJSHeapSize || 0) - (initial?.usedJSHeapSize || 0)
            };
        }

        // Identify bottlenecks
        this.identifyBottlenecks(analysis, metrics);
        
        // Generate recommendations
        this.generateRecommendations(analysis);

        return analysis;
    }

    /**
     * Identify performance bottlenecks
     */
    identifyBottlenecks(analysis, metrics) {
        // Check for slow compile times
        if (analysis.phases.compileDuration > 1000) {
            analysis.bottlenecks.push({
                type: 'compile',
                severity: 'high',
                message: `WASM compilation took ${analysis.phases.compileDuration.toFixed(2)}ms`,
                suggestion: 'Consider using WebWorkers for background compilation or implementing lazy compilation'
            });
        }

        // Check for slow network times
        if (analysis.networkPerformance.averageDuration > 500) {
            analysis.bottlenecks.push({
                type: 'network',
                severity: 'medium',
                message: `Average WASM download time: ${analysis.networkPerformance.averageDuration.toFixed(2)}ms`,
                suggestion: 'Implement WASM caching, use compression, or consider code splitting'
            });
        }

        // Check for memory issues
        if (analysis.memoryUsage.memoryGrowth > 10 * 1024 * 1024) {
            analysis.bottlenecks.push({
                type: 'memory',
                severity: 'medium',
                message: `Memory grew by ${(analysis.memoryUsage.memoryGrowth / 1024 / 1024).toFixed(2)}MB`,
                suggestion: 'Review memory allocation patterns and implement proper cleanup'
            });
        }
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        // Compilation recommendations
        if (analysis.phases.compileDuration > 500) {
            recommendations.push({
                category: 'compilation',
                priority: 'high',
                recommendation: 'Implement WebWorker-based WASM compilation to avoid blocking the main thread',
                implementation: 'Move WebAssembly.compileStreaming to a WebWorker and use postMessage for communication'
            });
        }

        // Network recommendations
        if (analysis.networkPerformance.averageDuration > 200) {
            recommendations.push({
                category: 'network',
                priority: 'medium',
                recommendation: 'Implement WASM caching strategy using Cache API or IndexedDB',
                implementation: 'Cache compiled WASM modules for faster subsequent loads'
            });
        }

        // Size recommendations
        if (analysis.networkPerformance.totalDownloadTime > 1000) {
            recommendations.push({
                category: 'size',
                priority: 'medium',
                recommendation: 'Consider WASM code splitting and lazy loading for large modules',
                implementation: 'Split WASM into core and optional modules, load optional modules on demand'
            });
        }

        analysis.recommendations = recommendations;
    }

    /**
     * Generate comprehensive performance report
     */
    generateReport(analysis) {
        let report = `=== WASM Performance Analysis Report ===\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;

        report += `Overall Performance:\n`;
        report += `- Total Load Time: ${analysis.totalLoadTime.toFixed(2)}ms\n`;
        
        if (analysis.phases.fetchDuration) {
            report += `- Download Time: ${analysis.phases.fetchDuration.toFixed(2)}ms\n`;
        }
        if (analysis.phases.compileDuration) {
            report += `- Compilation Time: ${analysis.phases.compileDuration.toFixed(2)}ms\n`;
        }

        report += `\nNetwork Performance:\n`;
        report += `- WASM Requests: ${analysis.networkPerformance.requestCount}\n`;
        report += `- Average Download: ${analysis.networkPerformance.averageDuration.toFixed(2)}ms\n`;
        report += `- Success Rate: ${(analysis.networkPerformance.successRate * 100).toFixed(1)}%\n`;

        report += `\nMemory Usage:\n`;
        report += `- Initial Heap: ${(analysis.memoryUsage.initialHeap / 1024 / 1024).toFixed(2)}MB\n`;
        report += `- Final Heap: ${(analysis.memoryUsage.finalHeap / 1024 / 1024).toFixed(2)}MB\n`;
        report += `- Peak Heap: ${(analysis.memoryUsage.peakHeap / 1024 / 1024).toFixed(2)}MB\n`;
        report += `- Memory Growth: ${(analysis.memoryUsage.memoryGrowth / 1024 / 1024).toFixed(2)}MB\n`;

        if (analysis.bottlenecks.length > 0) {
            report += `\nIdentified Bottlenecks:\n`;
            analysis.bottlenecks.forEach((b, i) => {
                report += `${i+1}. [${b.severity.toUpperCase()}] ${b.message}\n`;
                report += `   Suggestion: ${b.suggestion}\n`;
            });
        }

        if (analysis.recommendations.length > 0) {
            report += `\nOptimization Recommendations:\n`;
            analysis.recommendations.forEach((r, i) => {
                report += `${i+1}. [${r.priority}] ${r.recommendation}\n`;
                report += `   Implementation: ${r.implementation}\n`;
            });
        }

        return report;
    }

    /**
     * Reset monitoring state
     */
    reset() {
        this.measurements = [];
        this.memorySnapshots = [];
        this.wasmLoadPhases = {};
        this.isMonitoring = false;
    }
}

module.exports = EnhancedPerformanceMonitor;