/**
 * WASM Performance Test Runner
 * Runs benchmarks and captures performance metrics for WASM modules
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const PerformanceMonitor = require('./lib/performance-monitor');
const TestUtils = require('./lib/test-utils');

// Configuration
const PORT = 8083;
const BENCHMARKS = [
    {
        name: "WASM Compilation",
        url: `http://localhost:${PORT}/index_test.html`,
        iterations: 5,
        testFunction: async () => {
            // This assumes the page has a function to trigger WASM compilation
            // or we just reload the page and measure it
            location.reload();
        }
    },
    {
        name: "Main Menu Loading",
        url: `http://localhost:${PORT}/index_menu.html`,
        iterations: 3,
        expected: ["Blitz3D Runtime Initialized"]
    },
    {
        name: "FPS Scene Performance",
        url: `http://localhost:${PORT}/index_fps.html`,
        iterations: 3,
        expected: ["Blitz3D Runtime Initialized"]
    }
];

async function startServer() {
    console.log("Starting static server from project root...");
    const server = spawn('./node_modules/.bin/http-server', ['../../', '-p', PORT], {
        cwd: __dirname,
        stdio: 'inherit'
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    return server;
}

async function runPerformanceTests() {
    console.log("=== WASM Performance Test Runner ===\n");
    
    const serverProcess = await startServer();
    const performanceMonitor = new PerformanceMonitor();
    const testUtils = new TestUtils();
    
    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, 'reports');
    testUtils.ensureDirectory(reportsDir);

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--enable-webassembly',
            '--enable-precise-memory-info'
        ]
    });

    const results = {
        timestamp: new Date().toISOString(),
        benchmarks: [],
        memoryAnalysis: {},
        overallAnalysis: {}
    };

    try {
        for (const config of BENCHMARKS) {
            console.log(`Running benchmark: ${config.name}...`);
            const page = await browser.newPage();
            
            try {
                // Initialize performance monitoring for each new page (especially important for navigation)
                await performanceMonitor.initialize(page);
                await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Run the benchmark
                const benchmarkResult = await performanceMonitor.runBenchmark(page, {
                    name: config.name,
                    iterations: config.iterations || 5,
                    isNavigation: true,
                    url: config.url
                });

                results.benchmarks.push(benchmarkResult);
                console.log(`  Average Duration: ${benchmarkResult.summary.duration.mean.toFixed(2)}ms`);
                
            } catch (error) {
                console.error(`  Benchmark failed: ${error.message}`);
                results.benchmarks.push({
                    name: config.name,
                    error: error.message,
                    success: false
                });
            } finally {
                await page.close();
            }
        }

        // Generate reports
        const textReport = performanceMonitor.generateTextReport();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const reportPath = path.join(reportsDir, `performance-report-${timestamp}.txt`);
        const jsonPath = path.join(reportsDir, `performance-report-${timestamp}.json`);

        fs.writeFileSync(reportPath, textReport);
        fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

        console.log("\n" + textReport);
        console.log(`\nReports saved to:`);
        console.log(`- Text: ${reportPath}`);
        console.log(`- JSON: ${jsonPath}`);

    } catch (error) {
        console.error("Performance tests failed:", error);
    } finally {
        await browser.close();
        serverProcess.kill();
        process.exit(0);
    }
}

if (require.main === module) {
    runPerformanceTests();
}

module.exports = { runPerformanceTests };