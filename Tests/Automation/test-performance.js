/**
 * Performance Monitoring Integration Tests
 * Tests performance monitoring functionality including metrics collection,
 * bottleneck detection, and report generation
 */

const assert = require('assert');
const path = require('path');

class PerformanceTests {
    constructor() {
        this.testResults = [];
        this.monitor = null;
    }

    async runAllTests() {
        console.log('=== WASM Performance Monitoring Tests ===\n');

        await this.testMonitorInitialization();
        await this.testMonitorLifecycle();
        await this.testMetricsCollection();
        await this.testBottleneckIdentification();
        await this.testReportGeneration();
        await this.testRecommendations();
        await this.testReset();

        this.printSummary();
        return this.testResults;
    }

    async testMonitorInitialization() {
        const testName = 'Monitor Initialization';
        console.log(`Running: ${testName}`);

        try {
            const EnhancedPerformanceMonitor = require('./lib/enhanced-performance-monitor');
            this.monitor = new EnhancedPerformanceMonitor();

            assert.ok(this.monitor, 'Monitor instance should be created');
            assert.ok(Array.isArray(this.monitor.measurements), 'Measurements should be array');
            assert.ok(this.monitor.benchmarks instanceof Map, 'Benchmarks should be Map');
            assert.ok(Array.isArray(this.monitor.memorySnapshots), 'Memory snapshots should be array');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testMonitorLifecycle() {
        const testName = 'Monitor Lifecycle';
        console.log(`Running: ${testName}`);

        try {
            this.monitor.startMonitoring();
            assert.strictEqual(this.monitor.isMonitoring, true, 'Should be monitoring after start');

            this.monitor.stopMonitoring();
            assert.strictEqual(this.monitor.isMonitoring, false, 'Should not be monitoring after stop');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testMetricsCollection() {
        const testName = 'Metrics Collection';
        console.log(`Running: ${testName}`);

        try {
            const mockMetrics = {
                wasmLoadPhases: {
                    fetchStart: 100,
                    fetchEnd: 200,
                    compileStart: 200,
                    compileEnd: 500
                },
                networkRequests: [
                    { url: 'test.wasm', duration: 100, type: 'wasm', success: true },
                    { url: 'test.js', duration: 50, type: 'other', success: true }
                ],
                memorySnapshots: [
                    { usedJSHeapSize: 10000000, label: 'initial' },
                    { usedJSHeapSize: 15000000, label: 'final' }
                ]
            };

            const analysis = this.monitor.analyzeResults(mockMetrics);

            assert.ok(analysis, 'Analysis should be returned');
            assert.ok(typeof analysis.totalLoadTime === 'number', 'Total load time should be a number');
            assert.ok(analysis.phases, 'Phases should be present');
            assert.ok(analysis.networkPerformance, 'Network performance should be present');
            assert.ok(analysis.memoryUsage, 'Memory usage should be present');

            assert.strictEqual(analysis.phases.fetchDuration, 100, 'Fetch duration should be 100ms');
            assert.strictEqual(analysis.phases.compileDuration, 300, 'Compile duration should be 300ms');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testBottleneckIdentification() {
        const testName = 'Bottleneck Identification';
        console.log(`Running: ${testName}`);

        try {
            const mockMetrics = {
                wasmLoadPhases: {
                    fetchStart: 0,
                    fetchEnd: 50,
                    compileStart: 50,
                    compileEnd: 2000
                },
                networkRequests: [
                    { url: 'test.wasm', duration: 800, type: 'wasm', success: true }
                ],
                memorySnapshots: [
                    { usedJSHeapSize: 10000000 },
                    { usedJSHeapSize: 25000000 }
                ]
            };

            const analysis = this.monitor.analyzeResults(mockMetrics);

            assert.ok(Array.isArray(analysis.bottlenecks), 'Bottlenecks should be an array');
            assert.ok(analysis.bottlenecks.length > 0, 'Should identify at least one bottleneck');

            const compileBottleneck = analysis.bottlenecks.find(b => b.type === 'compile');
            assert.ok(compileBottleneck, 'Should identify compile bottleneck');
            assert.strictEqual(compileBottleneck.severity, 'high', 'Compile bottleneck should be high severity');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testReportGeneration() {
        const testName = 'Report Generation';
        console.log(`Running: ${testName}`);

        try {
            const mockMetrics = {
                wasmLoadPhases: {
                    fetchStart: 0,
                    fetchEnd: 100,
                    compileStart: 100,
                    compileEnd: 500
                },
                networkRequests: [
                    { url: 'test.wasm', duration: 100, type: 'wasm', success: true }
                ],
                memorySnapshots: [
                    { usedJSHeapSize: 10000000, label: 'initial' },
                    { usedJSHeapSize: 12000000, label: 'final' }
                ]
            };

            const analysis = this.monitor.analyzeResults(mockMetrics);
            const report = this.monitor.generateReport(analysis);

            assert.ok(typeof report === 'string', 'Report should be a string');
            assert.ok(report.includes('WASM Performance Analysis Report'), 'Report should have header');
            assert.ok(report.includes('Total Load Time'), 'Report should include load time');
            assert.ok(report.includes('Network Performance'), 'Report should include network section');

            console.log(`  Generated report (${report.length} characters)`);

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testRecommendations() {
        const testName = 'Optimization Recommendations';
        console.log(`Running: ${testName}`);

        try {
            const mockMetrics = {
                wasmLoadPhases: {
                    fetchStart: 0,
                    fetchEnd: 300,
                    compileStart: 300,
                    compileEnd: 1000
                },
                networkRequests: [
                    { url: 'test.wasm', duration: 300, type: 'wasm', success: true }
                ],
                memorySnapshots: []
            };

            const analysis = this.monitor.analyzeResults(mockMetrics);

            assert.ok(Array.isArray(analysis.recommendations), 'Recommendations should be an array');
            assert.ok(analysis.recommendations.length > 0, 'Should generate recommendations');

            const networkRec = analysis.recommendations.find(r => r.category === 'network');
            assert.ok(networkRec, 'Should have network recommendation');
            assert.ok(networkRec.implementation, 'Recommendation should have implementation details');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testReset() {
        const testName = 'Monitor Reset';
        console.log(`Running: ${testName}`);

        try {
            this.monitor.startMonitoring();
            this.monitor.measurements.push({ test: 'data' });
            this.monitor.memorySnapshots.push({ test: 'snapshot' });

            this.monitor.reset();

            assert.strictEqual(this.monitor.isMonitoring, false, 'Should not be monitoring after reset');
            assert.strictEqual(this.monitor.measurements.length, 0, 'Measurements should be cleared');
            assert.strictEqual(this.monitor.memorySnapshots.length, 0, 'Memory snapshots should be cleared');
            assert.deepStrictEqual(this.monitor.wasmLoadPhases, {}, 'WASM phases should be cleared');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    printSummary() {
        const passed = this.testResults.filter(r => r.passed).length;
        const failed = this.testResults.filter(r => !r.passed).length;

        console.log('\n=== Performance Test Summary ===');
        console.log(`Total: ${this.testResults.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
        console.log('');

        if (failed > 0) {
            console.log('Failed tests:');
            this.testResults.filter(r => !r.passed).forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }
    }
}

async function main() {
    const tests = new PerformanceTests();
    const results = await tests.runAllTests();

    const exitCode = results.every(r => r.passed) ? 0 : 1;
    process.exit(exitCode);
}

main().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
});
