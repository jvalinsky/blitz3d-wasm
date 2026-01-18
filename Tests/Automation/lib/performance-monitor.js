/**
 * Performance Monitor Module
 * Comprehensive performance monitoring for WASM applications
 */

class PerformanceMonitor {
    constructor() {
        this.measurements = [];
        this.benchmarks = [];
        this.memorySnapshots = [];
        this.isMonitoring = false;
    }

    /**
     * Initialize performance monitoring on a Puppeteer page
     */
    async initialize(page) {
        // Inject performance monitoring code
        await page.evaluateOnNewDocument(() => {
            window.performanceMetrics = {
                startTime: performance.now(),
                memorySnapshots: [],
                functionCallTimes: {},
                wasmCompilationTime: null,
                pageLoadEvents: {},
                networkRequests: []
            };

            // Enhanced memory monitoring
            function captureMemorySnapshot(label) {
                if (performance.memory) {
                    const snapshot = {
                        timestamp: performance.now(),
                        label: label,
                        used: performance.memory.usedJSHeapSize,
                        total: performance.memory.totalJSHeapSize,
                        limit: performance.memory.jsHeapSizeLimit,
                        detailed: {
                            used: performance.memory.usedJSHeapSize,
                            total: performance.memory.totalJSHeapSize,
                            limit: performance.memory.jsHeapSizeLimit
                        }
                    };
                    window.performanceMetrics.memorySnapshots.push(snapshot);
                    return snapshot;
                }
                return null;
            }

            // Monitor page load events
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    window.performanceMetrics.pageLoadEvents[entry.name] = {
                        startTime: entry.startTime,
                        duration: entry.duration,
                        entryType: entry.entryType
                    };
                }
            });
            observer.observe({ entryTypes: ['navigation', 'paint', 'resource'] });

            // Monitor function call performance
            window.measureFunction = function(name, fn) {
                return function(...args) {
                    const startTime = performance.now();
                    const result = fn.apply(this, args);
                    const endTime = performance.now();
                    
                    if (!window.performanceMetrics.functionCallTimes[name]) {
                        window.performanceMetrics.functionCallTimes[name] = [];
                    }
                    
                    window.performanceMetrics.functionCallTimes[name].push({
                        duration: endTime - startTime,
                        timestamp: startTime,
                        args: args.length
                    });
                    
                    return result;
                };
            };

            // Network request monitoring
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const startTime = performance.now();
                const url = args[0];
                
                return originalFetch.apply(this, args)
                    .then(response => {
                        const endTime = performance.now();
                        window.performanceMetrics.networkRequests.push({
                            url: url,
                            startTime: startTime,
                            endTime: endTime,
                            duration: endTime - startTime,
                            status: response.status,
                            success: response.ok
                        });
                        return response;
                    })
                    .catch(error => {
                        const endTime = performance.now();
                        window.performanceMetrics.networkRequests.push({
                            url: url,
                            startTime: startTime,
                            endTime: endTime,
                            duration: endTime - startTime,
                            success: false,
                            error: error.message
                        });
                        throw error;
                    });
            };

            // Capture baseline memory
            setTimeout(() => captureMemorySnapshot('baseline'), 100);

            // Store helper functions globally
            window.captureMemorySnapshot = captureMemorySnapshot;
            window.getPerformanceMetrics = function() {
                return {
                    ...window.performanceMetrics,
                    currentTime: performance.now(),
                    totalDuration: performance.now() - window.performanceMetrics.startTime
                };
            };
        });

        // Set up Puppeteer-side monitoring
        await this.setupPuppeteerMonitoring(page);
    }

    /**
     * Set up Puppeteer-specific performance monitoring
     */
    async setupPuppeteerMonitoring(page) {
        // Monitor resource loading
        page.on('request', request => {
            this.measurements.push({
                type: 'request_start',
                url: request.url(),
                method: request.method(),
                timestamp: Date.now()
            });
        });

        page.on('response', response => {
            this.measurements.push({
                type: 'response',
                url: response.url(),
                status: response.status(),
                headers: response.headers(),
                timing: response.timing(),
                timestamp: Date.now()
            });
        });

        // Monitor console performance messages
        page.on('console', msg => {
            if (msg.text().includes('performance') || msg.text().includes('timing')) {
                this.measurements.push({
                    type: 'performance_message',
                    message: msg.text(),
                    timestamp: Date.now()
                });
            }
        });
    }

    /**
     * Start performance monitoring for a specific operation
     */
    async startMeasurement(label) {
        const startTime = performance.now();
        
        return {
            label: label,
            startTime: startTime,
            end: async (page) => {
                const endTime = performance.now();
                const duration = endTime - startTime;
                
                // Capture performance metrics from page
                const pageMetrics = await page.evaluate(() => window.getPerformanceMetrics());
                const memorySnapshot = await page.evaluate((l) => window.captureMemorySnapshot(l), label);
                
                const measurement = {
                    label: label,
                    startTime: startTime,
                    endTime: endTime,
                    duration: duration,
                    pageMetrics: pageMetrics,
                    memorySnapshot: memorySnapshot,
                    timestamp: Date.now()
                };
                
                this.measurements.push(measurement);
                return measurement;
            }
        };
    }

    /**
     * Capture performance benchmark
     */
    async runBenchmark(page, benchmarkConfig) {
        const {
            name,
            iterations = 10,
            warmupIterations = 3,
            setup = null,
            testFunction,
            teardown = null,
            isNavigation = false,
            url = null
        } = benchmarkConfig;

        console.log(`Running benchmark: ${name} (${iterations} iterations)`);

        // Warmup
        for (let i = 0; i < warmupIterations; i++) {
            if (isNavigation && url) {
                await page.goto(url, { waitUntil: 'networkidle0' });
            } else {
                if (setup) await page.evaluate(setup);
                await page.evaluate(testFunction);
                if (teardown) await page.evaluate(teardown);
            }
        }

        const results = [];

        // Main benchmark
        for (let i = 0; i < iterations; i++) {
            const measurement = await this.startMeasurement(`${name}_iteration_${i}`);
            
            if (isNavigation && url) {
                await page.goto(url, { waitUntil: 'networkidle0' });
            } else {
                if (setup) await page.evaluate(setup);
                const preTestMetrics = await page.evaluate(() => window.getPerformanceMetrics());
                
                await page.evaluate(testFunction);
                
                const postTestMetrics = await page.evaluate(() => window.getPerformanceMetrics());
                if (teardown) await page.evaluate(teardown);
                
                const result = await measurement.end(page);
                result.preTestMetrics = preTestMetrics;
                result.postTestMetrics = postTestMetrics;
                results.push(result);
                continue;
            }
            
            const result = await measurement.end(page);
            results.push(result);
        }

        const benchmark = {
            name: name,
            iterations: iterations,
            results: results,
            summary: this.calculateBenchmarkSummary(results)
        };

        this.benchmarks.push(benchmark);
        return benchmark;
    }

    /**
     * Calculate benchmark summary statistics
     */
    calculateBenchmarkSummary(results) {
        const durations = results.map(r => r.duration);
        const memoryDeltas = results.map(r => 
            r.postTestMetrics && r.preTestMetrics && r.postTestMetrics.memorySnapshots.length > 0 && r.preTestMetrics.memorySnapshots.length > 0 ?
            r.postTestMetrics.memorySnapshots[r.postTestMetrics.memorySnapshots.length - 1].used - 
            r.preTestMetrics.memorySnapshots[r.preTestMetrics.memorySnapshots.length - 1].used : 0
        );

        const sortedDurations = durations.sort((a, b) => a - b);
        const percentiles = {
            p50: sortedDurations[Math.floor(sortedDurations.length * 0.5)],
            p90: sortedDurations[Math.floor(sortedDurations.length * 0.9)],
            p95: sortedDurations[Math.floor(sortedDurations.length * 0.95)],
            p99: sortedDurations[Math.floor(sortedDurations.length * 0.99)]
        };

        return {
            duration: {
                min: Math.min(...durations),
                max: Math.max(...durations),
                mean: durations.reduce((a, b) => a + b, 0) / durations.length,
                median: percentiles.p50,
                stdDev: this.calculateStandardDeviation(durations),
                percentiles: percentiles
            },
            memory: {
                minDelta: Math.min(...memoryDeltas),
                maxDelta: Math.max(...memoryDeltas),
                meanDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
                totalDelta: memoryDeltas.reduce((a, b) => a + b, 0)
            }
        };
    }

    /**
     * Calculate standard deviation
     */
    calculateStandardDeviation(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        return Math.sqrt(avgSquaredDiff);
    }

    /**
     * Monitor WASM-specific performance
     */
    async monitorWASMPerformance(page) {
        const metrics = await page.evaluate(() => {
            // Capture WASM-specific performance metrics
            const wasmMetrics = {
                compilationTime: window.performanceMetrics.wasmCompilationTime,
                memorySnapshots: window.performanceMetrics.memorySnapshots,
                functionCalls: window.performanceMetrics.functionCallTimes,
                networkRequests: window.performanceMetrics.networkRequests,
                pageEvents: window.performanceMetrics.pageLoadEvents
            };

            // Analyze WASM module performance if available
            if (window.wasmInstance) {
                const module = window.wasmInstance;
                wasmMetrics.moduleInfo = {
                    exports: Object.keys(module.exports || {}),
                    hasMemory: !!(module.exports && module.exports.memory),
                    memorySize: module.exports && module.exports.memory ? 
                        module.exports.memory.buffer.byteLength : 0
                };
            }

            return wasmMetrics;
        });

        return metrics;
    }

    /**
     * Generate performance report
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalMeasurements: this.measurements.length,
                totalBenchmarks: this.benchmarks.length,
                memorySnapshots: this.memorySnapshots.length
            },
            measurements: this.measurements,
            benchmarks: this.benchmarks,
            analysis: this.analyzePerformanceData()
        };

        return report;
    }

    /**
     * Analyze performance data and generate insights
     */
    analyzePerformanceData() {
        const analysis = {
            performanceIssues: [],
            recommendations: [],
            bottlenecks: [],
            memoryAnalysis: {}
        };

        // Analyze memory usage
        if (this.memorySnapshots.length > 0) {
            const memoryValues = this.memorySnapshots.map(s => s.used);
            const maxMemory = Math.max(...memoryValues);
            const minMemory = Math.min(...memoryValues);
            const memoryGrowth = maxMemory - minMemory;

            analysis.memoryAnalysis = {
                peakMemory: maxMemory,
                minMemory: minMemory,
                memoryGrowth: memoryGrowth,
                averageMemory: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
                snapshotCount: this.memorySnapshots.length
            };

            if (memoryGrowth > 50 * 1024 * 1024) { // 50MB growth
                analysis.performanceIssues.push({
                    type: 'memory_growth',
                    severity: 'high',
                    message: `High memory growth detected: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`
                });
                analysis.recommendations.push('Investigate potential memory leaks');
            }
        }

        // Analyze benchmark results
        this.benchmarks.forEach(benchmark => {
            if (benchmark.summary.duration.stdDev > benchmark.summary.duration.mean * 0.5) {
                analysis.performanceIssues.push({
                    type: 'performance_variance',
                    severity: 'medium',
                    benchmark: benchmark.name,
                    message: `High performance variance in ${benchmark.name}`
                });
            }

            if (benchmark.summary.duration.mean > 1000) { // > 1 second
                analysis.bottlenecks.push({
                    type: 'slow_operation',
                    benchmark: benchmark.name,
                    duration: benchmark.summary.duration.mean
                });
            }
        });

        return analysis;
    }

    /**
     * Generate text report
     */
    generateTextReport() {
        const report = this.generateReport();
        
        let text = `=== WASM Performance Report ===\n`;
        text += `Generated: ${report.timestamp}\n\n`;

        text += `Summary:\n`;
        text += `- Total Measurements: ${report.summary.totalMeasurements}\n`;
        text += `- Total Benchmarks: ${report.summary.totalBenchmarks}\n`;
        text += `- Memory Snapshots: ${report.summary.memorySnapshots}\n\n`;

        // Benchmark results
        if (report.benchmarks.length > 0) {
            text += `=== Benchmark Results ===\n`;
            report.benchmarks.forEach(benchmark => {
                text += `${benchmark.name}:\n`;
                text += `  Iterations: ${benchmark.iterations}\n`;
                text += `  Mean Duration: ${benchmark.summary.duration.mean.toFixed(2)}ms\n`;
                text += `  Min Duration: ${benchmark.summary.duration.min.toFixed(2)}ms\n`;
                text += `  Max Duration: ${benchmark.summary.duration.max.toFixed(2)}ms\n`;
                text += `  Std Dev: ${benchmark.summary.duration.stdDev.toFixed(2)}ms\n`;
                text += `  P95: ${benchmark.summary.duration.percentiles.p95.toFixed(2)}ms\n`;
                
                if (benchmark.summary.memory.meanDelta !== 0) {
                    text += `  Avg Memory Delta: ${(benchmark.summary.memory.meanDelta / 1024).toFixed(2)}KB\n`;
                }
                text += '\n';
            });
        }

        // Performance issues
        if (report.analysis.performanceIssues.length > 0) {
            text += `=== Performance Issues ===\n`;
            report.analysis.performanceIssues.forEach((issue, i) => {
                text += `${i+1}. [${issue.severity.toUpperCase()}] ${issue.type}: ${issue.message}\n`;
            });
            text += '\n';
        }

        // Recommendations
        if (report.analysis.recommendations.length > 0) {
            text += `=== Recommendations ===\n`;
            report.analysis.recommendations.forEach((rec, i) => {
                text += `${i+1}. ${rec}\n`;
            });
            text += '\n';
        }

        // Memory analysis
        if (report.analysis.memoryAnalysis.snapshotCount > 0) {
            text += `=== Memory Analysis ===\n`;
            const mem = report.analysis.memoryAnalysis;
            text += `Peak Memory: ${(mem.peakMemory / 1024 / 1024).toFixed(2)}MB\n`;
            text += `Memory Growth: ${(mem.memoryGrowth / 1024 / 1024).toFixed(2)}MB\n`;
            text += `Average Memory: ${(mem.averageMemory / 1024 / 1024).toFixed(2)}MB\n`;
            text += `Snapshots: ${mem.snapshotCount}\n\n`;
        }

        return text;
    }

    /**
     * Reset all performance data
     */
    reset() {
        this.measurements = [];
        this.benchmarks = [];
        this.memorySnapshots = [];
        this.isMonitoring = false;
    }
}

module.exports = PerformanceMonitor;