/**
 * Enhanced Test Runner with WASM Caching and Performance Monitoring
 * Provides comprehensive testing with caching, performance analysis, and bottleneck detection
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WASMErrorCapture = require('./lib/wasm-error-capture');
const EnhancedPerformanceMonitor = require('./lib/enhanced-performance-monitor');
const WASMCache = require('./lib/wasm-cache');

// Configuration
const PORT = 8080;
const TESTS = [
    { name: "Banks Test", url: `http://localhost:${PORT}/Tests/IntegrationTests/Assets/index.html`, expected: ["Value: 123", "Size: 20"], checkWASMErrors: true },
    { name: "Zip Test", url: `http://localhost:${PORT}/Tests/IntegrationTests/Assets/index_zip.html`, expected: ["Extract success: 1", "Content: Hello World"], checkWASMErrors: true },
    { name: "Audio Test", url: `http://localhost:${PORT}/Tests/IntegrationTests/Assets/index_audio.html`, expected: ["Init Result: 1", "Playing on channel: 0"], clickOverlay: true, checkWASMErrors: true },
    { name: "Menu Test", url: `http://localhost:${PORT}/index_menu.html`, expected: ["Blitz3D Runtime Initialized"], checkWASMErrors: true, timeout: 30000 },
    { name: "Lighting Test", url: `http://localhost:${PORT}/index_lighting.html`, expected: ["Blitz3D Runtime Initialized"], checkWASMErrors: true },
    { name: "FPS Test", url: `http://localhost:${PORT}/index_fps.html`, expected: ["Blitz3D Runtime Initialized"], checkWASMErrors: true },
    { name: "Animation Test", url: `http://localhost:${PORT}/index_anim.html`, expected: ["Blitz3D Runtime Initialized"], checkWASMErrors: true }
];

// Test results storage
const testResults = [];

async function startServer() {
    console.log("Starting static server from project root...");
    const server = spawn('./node_modules/.bin/http-server', ['../../', '-p', PORT], {
        cwd: __dirname,
        stdio: 'inherit'
    });
    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
    return server;
}

async function runTest(test, browser, errorCapture, perfMonitor, wasmCache) {
    const page = await browser.newPage();
    
    // Initialize error capture for this page
    await errorCapture.initialize(page);
    
    // Initialize performance monitoring
    await perfMonitor.initialize(page);
    
    // Capture logs for compatibility with existing tests
    const logs = [];
    page.on('console', msg => {
        const text = msg.text();
        logs.push(text);
    });

    const testResult = {
        name: test.name,
        url: test.url,
        startTime: Date.now(),
        endTime: null,
        passed: false,
        error: null,
        logs: [],
        errors: [],
        wasmResults: null,
        performance: null
    };

    try {
        console.log(`\nRunning ${test.name}...`);
        
        // Start performance monitoring
        perfMonitor.startMonitoring();
        
        // Wait for proper page load with network idle and WASM ready state
        await page.goto(test.url, { 
            waitUntil: 'networkidle0', 
            timeout: 30000 
        });

        // Explicitly wait for WASM to be ready by checking Blitz3D state
        const wasmReady = await page.waitForFunction(() => {
            return window.Blitz3D && 
                   window.Blitz3D.instance && 
                   window.Blitz3D.exports &&
                   (window.Blitz3D.exports.main || window.Blitz3D.exports.Main);
        }, { timeout: test.timeout || 30000 }).then(() => true).catch(() => false);

        if (!wasmReady) {
            // Fallback: wait for expected console output with longer timeout
            await new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    const allFound = test.expected.every(exp => logs.some(log => log.includes(exp)));
                    if (allFound) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 200);

                setTimeout(() => {
                    clearInterval(checkInterval);
                    reject(new Error("Timeout waiting for WASM ready state and expected output"));
                }, Math.max(test.timeout || 15000, 15000));
            });
        }

        // Handle audio overlay if needed
        if (test.clickOverlay) {
            try {
                await page.waitForSelector('#overlay', { timeout: 3000 });
                await page.click('#overlay');
                console.log("Clicked overlay.");
            } catch (e) {
                console.log("No overlay found or click failed.");
            }
        }

        // Wait for expected results with improved timeout handling
        const timeoutDuration = test.timeout || (test.name.includes('Menu') ? 30000 : 15000);
        
        await new Promise((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const allFound = test.expected.every(exp => logs.some(log => log.includes(exp)));
                
                if (allFound) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (elapsed > timeoutDuration) {
                    clearInterval(checkInterval);
                    reject(new Error(`Timeout after ${elapsed}ms waiting for expected output: ${test.expected.join(', ')}`));
                }
            }, 100);

            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error("Timeout waiting for expected output"));
            }, timeoutDuration);
        });

        // Stop performance monitoring and collect results
        const perfAnalysis = await perfMonitor.stopMonitoring();
        testResult.performance = perfAnalysis;

        testResult.passed = true;
        console.log(`[PASS] ${test.name}`);
        
        // Log performance metrics
        if (perfAnalysis.totalLoadTime) {
            console.log(`  Performance: Total load ${perfAnalysis.totalLoadTime.toFixed(2)}ms`);
            if (perfAnalysis.phases.compileDuration) {
                console.log(`  - Compilation: ${perfAnalysis.phases.compileDuration.toFixed(2)}ms`);
            }
            if (perfAnalysis.phases.fetchDuration) {
                console.log(`  - Download: ${perfAnalysis.phases.fetchDuration.toFixed(2)}ms`);
            }
        }
        
    } catch (e) {
        testResult.passed = false;
        testResult.error = e.message;
        console.error(`[FAIL] ${test.name}: ${e.message}`);
        
        // Try to get performance data even for failed tests
        try {
            const perfAnalysis = await perfMonitor.stopMonitoring();
            testResult.performance = perfAnalysis;
        } catch (perfError) {
            // Ignore performance monitoring errors
        }
        
        // Take screenshot on failure for debugging
        try {
            const screenshotPath = path.join(__dirname, 'reports', `${test.name.replace(/\s+/g, '_')}_failure.png`);
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`Screenshot saved: ${screenshotPath}`);
        } catch (screenshotError) {
            console.log(`Failed to take screenshot: ${screenshotError.message}`);
        }
    } finally {
        testResult.endTime = Date.now();
        testResult.logs = logs;
        
        // Capture comprehensive error results
        if (test.checkWASMErrors) {
            try {
                const isClosed = await page.isClosed();
                if (!isClosed) {
                    testResult.wasmResults = await errorCapture.captureResults(page);
                }
            } catch (captureError) {
                console.log(`Failed to capture WASM results: ${captureError.message}`);
            }
        }
        
        try {
            const isClosed = await page.isClosed();
            if (!isClosed) {
                await page.close();
            }
        } catch (closeError) {
            // Ignore close errors
        }
    }

    return testResult;
}

async function runTests() {
    const serverProcess = await startServer();
    
    // Ensure reports directory exists
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--autoplay-policy=no-user-gesture-required',
            '--enable-webassembly',
            '--allow-insecure-localhost'
        ]
    });

    const errorCapture = new WASMErrorCapture();
    const perfMonitor = new EnhancedPerformanceMonitor();
    const wasmCache = new WASMCache();
    
    let exitCode = 0;

    console.log("=== Starting Enhanced WASM Test Suite ===");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Tests: ${TESTS.length}`);
    console.log(`Reports: ${reportsDir}`);
    console.log("Features: Performance Monitoring, WASM Caching, Bottleneck Detection");

    // Pre-warm cache with test WASM files
    console.log("\nPre-loading WASM files into cache...");
    const testWasmFiles = [
        '/Tests/IntegrationTests/Banks_Test.wasm',
        '/Tests/IntegrationTests/Zip_Test.wasm',
        '/Tests/IntegrationTests/Audio_Test.wasm',
        '/Tests/IntegrationTests/MainMenu_Test.wasm'
    ];
    
    try {
        await wasmCache.init();
        await wasmCache.preload(testWasmFiles.map(f => `http://localhost:${PORT}${f}`));
        console.log("Cache pre-warming complete");
    } catch (cacheError) {
        console.warn(`Cache pre-warming failed: ${cacheError.message}`);
    }

    // Run all tests
    for (const test of TESTS) {
        const result = await runTest(test, browser, errorCapture, perfMonitor, wasmCache);
        testResults.push(result);
        
        if (!result.passed) {
            exitCode = 1;
        }

        // Reset between tests
        errorCapture.reset();
        perfMonitor.reset();
    }

    // Generate comprehensive report
    await generateReports(testResults, reportsDir, wasmCache);

    await browser.close();
    serverProcess.kill();
    
    console.log(`\n=== Test Suite Complete ===`);
    console.log(`Passed: ${testResults.filter(r => r.passed).length}/${testResults.length}`);
    console.log(`Reports saved to: ${reportsDir}`);
    
    process.exit(exitCode);
}

async function generateReports(testResults, reportsDir, wasmCache) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate summary report
    const summary = {
        timestamp: new Date().toISOString(),
        totalTests: testResults.length,
        passed: testResults.filter(r => r.passed).length,
        failed: testResults.filter(r => r.failed).length,
        results: testResults,
        performance: {
            averageLoadTime: 0,
            totalLoadTime: 0,
            bottlenecks: [],
            recommendations: []
        },
        wasmErrors: testResults.filter(r => r.wasmResults).map(r => ({
            test: r.name,
            summary: r.wasmResults.summary,
            hasCompileErrors: r.wasmResults.categorized.compileErrors.length > 0,
            hasLinkErrors: r.wasmResults.categorized.linkErrors.length > 0,
            hasRuntimeErrors: r.wasmResults.categorized.runtimeErrors.length > 0
        }))
    };

    // Calculate performance statistics
    const testsWithPerf = testResults.filter(r => r.performance && r.performance.totalLoadTime);
    if (testsWithPerf.length > 0) {
        summary.performance.averageLoadTime = testsWithPerf.reduce((sum, r) => sum + r.performance.totalLoadTime, 0) / testsWithPerf.length;
        summary.performance.totalLoadTime = testsWithPerf.reduce((sum, r) => sum + r.performance.totalLoadTime, 0);
        
        // Collect all bottlenecks
        testsWithPerf.forEach(r => {
            if (r.performance.bottlenecks) {
                summary.performance.bottlenecks.push(...r.performance.bottlenecks.map(b => ({ test: r.name, ...b })));
            }
            if (r.performance.recommendations) {
                summary.performance.recommendations.push(...r.performance.recommendations.map(rec => ({ test: r.name, ...rec })));
            }
        });
    }

    // Save JSON report
    const jsonReport = path.join(reportsDir, `enhanced-test-report-${timestamp}.json`);
    fs.writeFileSync(jsonReport, JSON.stringify(summary, null, 2));
    console.log(`JSON report saved: ${jsonReport}`);

    // Generate text report
    let textReport = `=== Enhanced WASM Test Suite Report ===\n`;
    textReport += `Generated: ${new Date().toISOString()}\n`;
    textReport += `Total Tests: ${summary.totalTests}\n`;
    textReport += `Passed: ${summary.passed}\n`;
    textReport += `Failed: ${summary.failed}\n\n`;

    // Performance summary
    if (summary.performance.averageLoadTime > 0) {
        textReport += `Performance Summary:\n`;
        textReport += `- Average Load Time: ${summary.performance.averageLoadTime.toFixed(2)}ms\n`;
        textReport += `- Total Load Time: ${summary.performance.totalLoadTime.toFixed(2)}ms\n\n`;
    }

    // Individual test results
    testResults.forEach(result => {
        textReport += `--- ${result.name} ---\n`;
        textReport += `Status: ${result.passed ? 'PASS' : 'FAIL'}\n`;
        textReport += `Duration: ${result.endTime - result.startTime}ms\n`;
        
        if (!result.passed && result.error) {
            textReport += `Error: ${result.error}\n`;
        }
        
        if (result.performance) {
            textReport += `Performance:\n`;
            if (result.performance.totalLoadTime) {
                textReport += `  - Total Load: ${result.performance.totalLoadTime.toFixed(2)}ms\n`;
            }
            if (result.performance.phases) {
                if (result.performance.phases.compileDuration) {
                    textReport += `  - Compilation: ${result.performance.phases.compileDuration.toFixed(2)}ms\n`;
                }
                if (result.performance.phases.fetchDuration) {
                    textReport += `  - Download: ${result.performance.phases.fetchDuration.toFixed(2)}ms\n`;
                }
            }
            
            if (result.performance.bottlenecks && result.performance.bottlenecks.length > 0) {
                textReport += `  Bottlenecks:\n`;
                result.performance.bottlenecks.forEach(b => {
                    textReport += `    - [${b.severity}] ${b.message}\n`;
                });
            }
        }
        
        if (result.wasmResults) {
            const wasm = result.wasmResults;
            textReport += `WASM Errors: ${wasm.summary.totalErrors}\n`;
            textReport += `Console Messages: ${wasm.summary.totalConsoleMessages}\n`;
        }
        textReport += '\n';
    });

    const textReportPath = path.join(reportsDir, `enhanced-test-report-${timestamp}.txt`);
    fs.writeFileSync(textReportPath, textReport);
    console.log(`Text report saved: ${textReportPath}`);

    // Generate cache statistics if available
    try {
        const cacheStats = await wasmCache.getStats();
        const cacheReportPath = path.join(reportsDir, `cache-stats-${timestamp}.json`);
        fs.writeFileSync(cacheReportPath, JSON.stringify(cacheStats, null, 2));
        console.log(`Cache statistics saved: ${cacheReportPath}`);
    } catch (e) {
        // Ignore cache stats errors
    }

    // Generate detailed WASM error reports
    testResults.forEach(result => {
        if (result.wasmResults && result.wasmResults.summary.totalErrors > 0) {
            const errorCapture = new WASMErrorCapture();
            errorCapture.errors = result.wasmResults.rawErrors;
            errorCapture.consoleMessages = result.wasmResults.rawConsoleMessages;
            errorCapture.wasmCompilationTime = result.wasmResults.summary.compilationTime;
            
            const wasmReport = errorCapture.generateReport();
            const wasmReportPath = path.join(reportsDir, `${result.name.replace(/\s+/g, '_')}_wasm_errors-${timestamp}.txt`);
            fs.writeFileSync(wasmReportPath, wasmReport);
            console.log(`WASM error report saved: ${wasmReportPath}`);
        }
    });
}

runTests();