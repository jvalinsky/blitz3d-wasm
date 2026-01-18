const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WASMErrorCapture = require('./lib/wasm-error-capture');
const EnhancedPerformanceMonitor = require('./lib/enhanced-performance-monitor');

const PORT = 8080;
const TESTS = [
    { name: "Banks Test", url: `http://localhost:${PORT}/Tests/IntegrationTests/Assets/index.html`, expected: ["Value: 123", "Size: 20"], checkWASMErrors: true },
    { name: "Zip Test", url: `http://localhost:${PORT}/Tests/IntegrationTests/Assets/index_zip.html`, expected: ["Extract success: 1", "Content: Hello World"], checkWASMErrors: true },
    { name: "Audio Test", url: `http://localhost:${PORT}/Tests/IntegrationTests/Assets/index_audio.html`, expected: ["Init Result: 1", "Playing on channel: 0"], clickOverlay: true, checkWASMErrors: true },
    { name: "Menu Test", url: `http://localhost:${PORT}/index_menu.html`, expected: ["Blitz3D Runtime Initialized"], checkWASMErrors: true },
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
        stdio: 'inherit' // Pipe server output to main console
    });
    // Wait for server to be ready (simple timeout)
    await new Promise(resolve => setTimeout(resolve, 2000));
    return server;
}

async function runTest(test, browser, errorCapture) {
    const page = await browser.newPage();
    const perfMonitor = new EnhancedPerformanceMonitor();
    
    await perfMonitor.initialize(page);
    await perfMonitor.startMonitoring();
    
    // Initialize error capture for this page
    await errorCapture.initialize(page);
    
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
        performanceMetrics: null
    };

    try {
        console.log(`\nRunning ${test.name}...`);
        
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
        }, { timeout: 30000 }).then(() => true).catch(() => false);

        if (!wasmReady) {
            // Fallback: wait for expected console output with longer timeout
            await new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    const allFound = test.expected.every(exp => logs.some(log => log.includes(exp)));
                    if (allFound) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 200); // More frequent checking

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
            }, 100); // More frequent checking for faster response

            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error("Timeout waiting for expected output"));
            }, timeoutDuration);
        });

        testResult.passed = true;
        console.log(`[PASS] ${test.name}`);
        }
    } catch (e) {
        testResult.passed = false;
        testResult.error = e.message;
        console.error(`[FAIL] ${test.name}: ${e.message}`);
        
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
        
        // Capture performance metrics if monitoring
        try {
            const isClosed = await page.isClosed();
            if (!isClosed && perfMonitor.isMonitoring) {
                testResult.performanceMetrics = await perfMonitor.stopMonitoring();
            }
        } catch (e) {
            console.log(`Failed to capture performance metrics: ${e.message}`);
        }
        
        // Capture comprehensive error results
        if (test.checkWASMErrors) {
            try {
                // Check if page is still usable
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
    let exitCode = 0;

    console.log("=== Starting WASM Test Suite ===");
    console.log(`Server: http://localhost:${PORT}`);
    console.log(`Tests: ${TESTS.length}`);
    console.log(`Reports: ${reportsDir}`);

    // Run all tests
    for (const test of TESTS) {
        const result = await runTest(test, browser, errorCapture);
        testResults.push(result);
        
        if (!result.passed) {
            exitCode = 1;
        }

        // Reset error capture between tests
        errorCapture.reset();
    }

        // Generate summary report
        await generateReports(testResults, reportsDir);
        
        // Generate performance report if metrics were collected
        await generatePerformanceReport(testResults, reportsDir);

    await browser.close();
    serverProcess.kill();
    
    console.log(`\n=== Test Suite Complete ===`);
    console.log(`Passed: ${testResults.filter(r => r.passed).length}/${testResults.length}`);
    console.log(`Reports saved to: ${reportsDir}`);
    
    process.exit(exitCode);
}

async function generateReports(testResults, reportsDir) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate summary report
    const summary = {
        timestamp: new Date().toISOString(),
        totalTests: testResults.length,
        passed: testResults.filter(r => r.passed).length,
        failed: testResults.filter(r => r.failed).length,
        results: testResults,
        wasmErrors: testResults.filter(r => r.wasmResults).map(r => ({
            test: r.name,
            summary: r.wasmResults.summary,
            hasCompileErrors: r.wasmResults.categorized.compileErrors.length > 0,
            hasLinkErrors: r.wasmResults.categorized.linkErrors.length > 0,
            hasRuntimeErrors: r.wasmResults.categorized.runtimeErrors.length > 0
        }))
    };

    // Save JSON report
    const jsonReport = path.join(reportsDir, `test-report-${timestamp}.json`);
    fs.writeFileSync(jsonReport, JSON.stringify(summary, null, 2));
    console.log(`JSON report saved: ${jsonReport}`);

    // Generate text report
    let textReport = `=== WASM Test Suite Report ===\n`;
    textReport += `Generated: ${new Date().toISOString()}\n`;
    textReport += `Total Tests: ${summary.totalTests}\n`;
    textReport += `Passed: ${summary.passed}\n`;
    textReport += `Failed: ${summary.failed}\n\n`;

    // Individual test results
    testResults.forEach(result => {
        textReport += `--- ${result.name} ---\n`;
        textReport += `Status: ${result.passed ? 'PASS' : 'FAIL'}\n`;
        textReport += `Duration: ${result.endTime - result.startTime}ms\n`;
        
        if (!result.passed && result.error) {
            textReport += `Error: ${result.error}\n`;
        }
        
        if (result.wasmResults) {
            const wasm = result.wasmResults;
            textReport += `WASM Errors: ${wasm.summary.totalErrors}\n`;
            textReport += `Console Messages: ${wasm.summary.totalConsoleMessages}\n`;
            if (wasm.summary.compilationTime) {
                textReport += `Compilation Time: ${wasm.summary.compilationTime.toFixed(2)}ms\n`;
            }
            
            if (wasm.summary.errorCounts.compile > 0) {
                textReport += `Compile Errors: ${wasm.summary.errorCounts.compile}\n`;
            }
            if (wasm.summary.errorCounts.link > 0) {
                textReport += `Link Errors: ${wasm.summary.errorCounts.link}\n`;
            }
        }
        textReport += '\n';
    });

    const textReportPath = path.join(reportsDir, `test-report-${timestamp}.txt`);
    fs.writeFileSync(textReportPath, textReport);
    console.log(`Text report saved: ${textReportPath}`);
}

async function generatePerformanceReport(testResults, reportsDir) {
    const testsWithMetrics = testResults.filter(r => r.performanceMetrics);
    
    if (testsWithMetrics.length === 0) {
        console.log('\nNo performance metrics collected (requires --enhanced flag or browser environment)');
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let perfReport = `=== WASM Performance Report ===\n`;
    perfReport += `Generated: ${new Date().toISOString()}\n\n`;
    
    perfReport += `Tests with metrics: ${testsWithMetrics.length}/${testResults.length}\n\n`;
    
    testsWithMetrics.forEach(result => {
        perfReport += `--- ${result.name} ---\n`;
        perfReport += `Total Load Time: ${result.performanceMetrics.totalLoadTime.toFixed(2)}ms\n`;
        
        if (result.performanceMetrics.phases.fetchDuration) {
            perfReport += `Download Time: ${result.performanceMetrics.phases.fetchDuration.toFixed(2)}ms\n`;
        }
        if (result.performanceMetrics.phases.compileDuration) {
            perfReport += `Compile Time: ${result.performanceMetrics.phases.compileDuration.toFixed(2)}ms\n`;
        }
        
        if (result.performanceMetrics.bottlenecks.length > 0) {
            perfReport += `Bottlenecks:\n`;
            result.performanceMetrics.bottlenecks.forEach(b => {
                perfReport += `  - [${b.severity}] ${b.message}\n`;
            });
        }
        perfReport += '\n';
    });
    
    const perfReportPath = path.join(reportsDir, `performance-report-${timestamp}.txt`);
    fs.writeFileSync(perfReportPath, perfReport);
    console.log(`Performance report saved: ${perfReportPath}`);

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
