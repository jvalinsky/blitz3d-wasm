/**
 * Master WASM Test Runner
 * Integrates all test suites into a single unified testing process
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

async function runCommand(scriptName, args = []) {
    console.log(`\n>>> Running: node ${scriptName} ${args.join(' ')}`);
    
    return new Promise((resolve) => {
        const process = spawn('node', [scriptName, ...args], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        process.on('close', (code) => {
            resolve(code === 0);
        });
    });
}

async function runAllTests() {
    console.log("========================================");
    console.log("   UNIFIED WASM TESTING FRAMEWORK");
    console.log("========================================\n");
    
    const startTime = Date.now();
    const results = {
        validation: false,
        functional: false,
        performance: false
    };

    // 1. Run WASM Validation (Compilation & Instantiation)
    results.validation = await runCommand('run-wasm-validation.js', ['--headless']);

    // 2. Run Functional Tests (with Enhanced Error Capture)
    results.functional = await runCommand('run_tests.js');

    // 3. Run Performance Benchmarks
    results.performance = await runCommand('run-performance-tests.js');

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n========================================");
    console.log("       FINAL TEST RESULTS SUMMARY");
    console.log("========================================");
    console.log(`Total Duration: ${duration}s`);
    console.log(`Validation Suite: ${results.validation ? 'PASS' : 'FAIL'}`);
    console.log(`Functional Suite:   ${results.functional ? 'PASS' : 'FAIL'}`);
    console.log(`Performance Suite:  ${results.performance ? 'PASS' : 'FAIL'}`);
    console.log("========================================\n");

    const allPassed = Object.values(results).every(v => v);
    process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
    runAllTests();
}
