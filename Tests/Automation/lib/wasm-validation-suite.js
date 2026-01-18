/**
 * WASM Validation Suite
 * Comprehensive testing for WASM compilation, instantiation, and validation
 */

const puppeteer = require('puppeteer');
const path = require('path');
const TestUtils = require('./test-utils');
const WASMErrorCapture = require('./wasm-error-capture');

class WASMValidationSuite {
    constructor() {
        this.testUtils = new TestUtils();
        this.errorCapture = new WASMErrorCapture();
        this.compilerPath = path.join(__dirname, '../../../.build/debug/blitz3d-wasm');
    }

    /**
     * Run complete WASM validation suite
     */
    async runValidationSuite(options = {}) {
        const {
            port = 8081,
            headless = "new",
            timeout = 30000
        } = options;

        console.log("=== WASM Validation Suite ===");
        
        const results = {
            timestamp: new Date().toISOString(),
            compilationTests: await this.runCompilationTests(),
            validationTests: [],
            importTests: [],
            runtimeTests: [],
            summary: {}
        };

        // Run browser-based validation tests
        if (options.includeBrowserTests !== false) {
            console.log("Running browser validation tests...");
            const browser = await puppeteer.launch({
                headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webassembly']
            });

            try {
                results.validationTests = await this.runBrowserValidationTests(browser, port);
                results.importTests = await this.runImportValidationTests(browser, port);
                results.runtimeTests = await this.runRuntimeValidationTests(browser, port);
            } finally {
                await browser.close();
            }
        }

        // Generate summary
        results.summary = this.generateSummary(results);

        return results;
    }

    /**
     * Test compilation of all .bb files
     */
    async runCompilationTests() {
        console.log("Testing .bb file compilation...");
        const bbFiles = this.testUtils.findBBFiles();
        const results = [];

        for (const bbFile of bbFiles) {
            const result = await this.testSingleCompilation(bbFile);
            results.push(result);
            console.log(`  ${path.basename(bbFile)}: ${result.success ? 'PASS' : 'FAIL'}`);
        }

        return results;
    }

    /**
     * Test compilation of a single .bb file
     */
    async testSingleCompilation(bbFile) {
        const wasmFile = bbFile.replace('.bb', '.wasm');
        const result = {
            bbFile: path.relative(process.cwd(), bbFile),
            wasmFile: path.relative(process.cwd(), wasmFile),
            success: false,
            error: null,
            startTime: Date.now(),
            endTime: null,
            duration: null
        };

        try {
            // Check if compiler exists
            const { spawn } = require('child_process');
            
            await new Promise((resolve, reject) => {
                const process = spawn(this.compilerPath, [bbFile, '-o', wasmFile], {
                    stdio: 'pipe'
                });

                let stdout = '';
                let stderr = '';

                process.stdout.on('data', (data) => {
                    stdout += data.toString();
                });

                process.stderr.on('data', (data) => {
                    stderr += data.toString();
                });

                process.on('close', (code) => {
                    result.endTime = Date.now();
                    result.duration = result.endTime - result.startTime;
                    
                    if (code === 0) {
                        result.success = true;
                        
                        // Validate generated WASM file
                        const wasmValidation = this.testUtils.validateWASMFile(wasmFile);
                        result.wasmValidation = wasmValidation;
                        if (!wasmValidation.valid) {
                            result.success = false;
                            result.error = `Invalid WASM generated: ${wasmValidation.error}`;
                        }
                    } else {
                        result.success = false;
                        result.error = `Compiler exit code: ${code}, stderr: ${stderr}`;
                        result.stdout = stdout;
                        result.stderr = stderr;
                    }
                    
                    resolve();
                });

                process.on('error', (error) => {
                    result.endTime = Date.now();
                    result.duration = result.endTime - result.startTime;
                    result.success = false;
                    result.error = `Process error: ${error.message}`;
                    reject(error);
                });
            });

        } catch (error) {
            result.endTime = Date.now();
            result.duration = result.endTime - result.startTime;
            result.success = false;
            result.error = error.message;
        }

        return result;
    }

    /**
     * Run browser-based validation tests
     */
    async runBrowserValidationTests(browser, port) {
        console.log("Running browser WASM validation tests...");
        
        const page = await browser.newPage();
        await this.errorCapture.initialize(page);
        
        const testResults = [];

        try {
            // Test basic WASM compilation in browser
            testResults.push(await this.testBrowserWASMCompilation(page));
            
            // Test WASM module validation
            testResults.push(await this.testWASMModuleValidation(page));
            
            // Test WASM instantiation
            testResults.push(await this.testWASMInstantiation(page));
            
        } finally {
            await page.close();
        }

        return testResults;
    }

    /**
     * Test basic WASM compilation in browser
     */
    async testBrowserWASMCompilation(page) {
        const testName = "Browser WASM Compilation";
        
        try {
            const result = await page.evaluate(() => {
                return new Promise((resolve) => {
                    // Simple WASM binary for testing (minimal valid module)
                    const wasmBytes = new Uint8Array([
                        0x00, 0x61, 0x73, 0x6d, // Magic
                        0x01, 0x00, 0x00, 0x00  // Version
                    ]);

                    WebAssembly.compile(wasmBytes)
                        .then(module => {
                            resolve({
                                success: true,
                                hasExports: false
                            });
                        })
                        .catch(error => {
                            resolve({
                                success: false,
                                error: error.message,
                                name: error.constructor.name
                            });
                        });
                });
            });

            return {
                test: testName,
                success: result.success,
                result: result,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                test: testName,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Test WASM module validation
     */
    async testWASMModuleValidation(page) {
        const testName = "WASM Module Validation";
        
        try {
            const result = await page.evaluate(() => {
                return new Promise((resolve) => {
                    // Test invalid WASM module
                    const invalidWasmBytes = new Uint8Array([0x00, 0x61, 0x73, 0x6d]); // Incomplete magic
                    
                    const isValidInvalid = WebAssembly.validate(invalidWasmBytes);
                    if (isValidInvalid) {
                        resolve({
                            success: false,
                            error: "Invalid WASM should not validate"
                        });
                        return;
                    }

                    // Test valid WASM module
                    const validWasmBytes = new Uint8Array([
                        0x00, 0x61, 0x73, 0x6d, // Magic
                        0x01, 0x00, 0x00, 0x00  // Version
                    ]);
                    
                    const isValid = WebAssembly.validate(validWasmBytes);
                    resolve({
                        success: isValid,
                        validModulePassed: isValid,
                        invalidModuleRejected: true
                    });
                });
            });

            return {
                test: testName,
                success: result.success,
                result: result,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                test: testName,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Test WASM instantiation
     */
    async testWASMInstantiation(page) {
        const testName = "WASM Instantiation";
        
        try {
            const result = await page.evaluate(() => {
                return new Promise((resolve) => {
                    // Minimal valid WASM module: Header only
                    const wasmBytes = new Uint8Array([
                        0x00, 0x61, 0x73, 0x6d, // Magic
                        0x01, 0x00, 0x00, 0x00  // Version
                    ]);

                    WebAssembly.instantiate(wasmBytes, {})
                        .then(result => {
                            resolve({
                                success: true,
                                hasInstance: !!result.instance,
                                hasModule: !!result.module
                            });
                        })
                        .catch(error => {
                            resolve({
                                success: false,
                                error: error.message,
                                name: error.constructor.name
                            });
                        });
                });
            });

            return {
                test: testName,
                success: result.success,
                result: result,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                test: testName,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Run import validation tests
     */
    async runImportValidationTests(browser, port) {
        console.log("Running import validation tests...");
        
        const page = await browser.newPage();
        await this.errorCapture.initialize(page);
        
        const testResults = [];

        try {
            // Test missing imports
            testResults.push(await this.testMissingImports(page));
            
            // Test incorrect import signatures
            testResults.push(await this.testIncorrectImportSignatures(page));
            
        } finally {
            await page.close();
        }

        return testResults;
    }

    /**
     * Test missing imports scenario
     */
    async testMissingImports(page) {
        const testName = "Missing Imports Test";
        
        try {
            const result = await page.evaluate(() => {
                return new Promise((resolve) => {
                    // WASM module that requires a function import: (import "env" "f" (func))
                    const wasmBytes = new Uint8Array([
                        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                        0x01, 0x04, 0x01, 0x60, 0x00, 0x00,             // type 0: ()->()
                        0x02, 0x09, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x01, 0x66, 0x00, 0x00 // import "env"."f" type 0
                    ]);

                    // Try to instantiate without providing the import
                    WebAssembly.instantiate(wasmBytes, {})
                        .then(() => {
                            resolve({
                                success: false,
                                error: "Should have failed with missing import"
                            });
                        })
                        .catch(error => {
                            resolve({
                                success: error instanceof WebAssembly.LinkError,
                                errorType: error.constructor.name,
                                errorMessage: error.message
                            });
                        });
                });
            });

            return {
                test: testName,
                success: result.success && result.errorType === 'LinkError',
                result: result,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                test: testName,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Test incorrect import signatures
     */
    async testIncorrectImportSignatures(page) {
        const testName = "Incorrect Import Signatures Test";
        
        try {
            const result = await page.evaluate(() => {
                return new Promise((resolve) => {
                    // WASM module that requires a function import: (import "env" "f" (func))
                    const wasmBytes = new Uint8Array([
                        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                        0x01, 0x04, 0x01, 0x60, 0x00, 0x00,
                        0x02, 0x09, 0x01, 0x03, 0x65, 0x6e, 0x76, 0x01, 0x66, 0x00, 0x00
                    ]);

                    // Import object with wrong type (string instead of function)
                    const wrongImportObject = {
                        env: {
                            f: "not a function"
                        }
                    };

                    WebAssembly.instantiate(wasmBytes, wrongImportObject)
                        .then(() => {
                            resolve({
                                success: false,
                                error: "Should have failed with wrong import type"
                            });
                        })
                        .catch(error => {
                            resolve({
                                success: error instanceof TypeError || error instanceof WebAssembly.LinkError,
                                errorType: error.constructor.name,
                                errorMessage: error.message
                            });
                        });
                });
            });

            return {
                test: testName,
                success: result.success,
                result: result,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                test: testName,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Run runtime validation tests
     */
    async runRuntimeValidationTests(browser, port) {
        console.log("Running runtime validation tests...");
        
        const page = await browser.newPage();
        await this.errorCapture.initialize(page);
        
        const testResults = [];

        try {
            // Test function calls
            testResults.push(await this.testWASMFunctionCalls(page));
            
            // Test memory operations
            testResults.push(await this.testWASMMemoryOperations(page));
            
        } finally {
            await page.close();
        }

        return testResults;
    }

    /**
     * Test WASM function calls
     */
    async testWASMFunctionCalls(page) {
        const testName = "WASM Function Calls";
        
        try {
            const result = await page.evaluate(() => {
                return new Promise((resolve) => {
                    // Simple addition function
                    const wasmBytes = new Uint8Array([
                        0x00, 0x61, 0x73, 0x6d, // Magic
                        0x01, 0x00, 0x00, 0x00, // Version
                        0x01, 0x07, 0x01,       // Type section
                        0x60, 0x02, 0x7f, 0x7f, // Function type (i32, i32) -> i32
                        0x01, 0x7f,             // Return type i32
                        0x03, 0x02, 0x01, 0x00, // Function section
                        0x07, 0x07, 0x01,       // Export section
                        0x03, 0x61, 0x64, 0x64, // Export name "add"
                        0x00, 0x00,             // Export function 0
                        0x0a, 0x09, 0x01,       // Code section
                        0x07,                   // Function body size
                        0x00,                   // Locals count
                        0x20, 0x00,             // Local.get 0
                        0x20, 0x01,             // Local.get 1
                        0x6a,                   // i32.add
                        0x0b                    // End
                    ]);

                    WebAssembly.instantiate(wasmBytes)
                        .then(result => {
                            const { add } = result.instance.exports;
                            const testResult = add(5, 3); // Should be 8
                            
                            resolve({
                                success: testResult === 8,
                                result: testResult,
                                expected: 8
                            });
                        })
                        .catch(error => {
                            resolve({
                                success: false,
                                error: error.message
                            });
                        });
                });
            });

            return {
                test: testName,
                success: result.success,
                result: result,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                test: testName,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Test WASM memory operations
     */
    async testWASMMemoryOperations(page) {
        const testName = "WASM Memory Operations";
        
        try {
            const result = await page.evaluate(() => {
                return new Promise((resolve) => {
                    // WASM module that exports memory: (memory 1) (export "memory" (memory 0))
                    const wasmBytes = new Uint8Array([
                        0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
                        0x05, 0x03, 0x01, 0x00, 0x01, // Memory section: 1 page, initial 1
                        0x07, 0x0a, 0x01, 0x06, 0x6d, 0x65, 0x6d, 0x6f, 0x72, 0x79, 0x02, 0x00 // Export section: "memory"
                    ]);

                    WebAssembly.instantiate(wasmBytes)
                        .then(result => {
                            const { memory } = result.instance.exports;
                            
                            // Write value to memory
                            const view = new Uint8Array(memory.buffer);
                            view[0] = 42;
                            
                            resolve({
                                success: view[0] === 42,
                                memorySize: memory.buffer.byteLength,
                                hasMemory: !!memory,
                                memoryPageCount: memory.buffer.byteLength / 65536
                            });
                        })
                        .catch(error => {
                            resolve({
                                success: false,
                                error: error.message
                            });
                        });
                });
            });

            return {
                test: testName,
                success: result.success,
                result: result,
                timestamp: Date.now()
            };

        } catch (error) {
            return {
                test: testName,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    /**
     * Generate test summary
     */
    generateSummary(results) {
        const summary = {
            totalTests: 0,
            passedTests: 0,
            failedTests: 0,
            categories: {}
        };

        // Count compilation tests
        summary.categories.compilation = {
            total: results.compilationTests.length,
            passed: results.compilationTests.filter(t => t.success).length,
            failed: results.compilationTests.filter(t => !t.success).length
        };

        // Count validation tests
        summary.categories.validation = {
            total: results.validationTests.length,
            passed: results.validationTests.filter(t => t.success).length,
            failed: results.validationTests.filter(t => !t.success).length
        };

        // Count import tests
        summary.categories.import = {
            total: results.importTests.length,
            passed: results.importTests.filter(t => t.success).length,
            failed: results.importTests.filter(t => !t.success).length
        };

        // Count runtime tests
        summary.categories.runtime = {
            total: results.runtimeTests.length,
            passed: results.runtimeTests.filter(t => t.success).length,
            failed: results.runtimeTests.filter(t => !t.success).length
        };

        // Calculate totals
        Object.values(summary.categories).forEach(category => {
            summary.totalTests += category.total;
            summary.passedTests += category.passed;
            summary.failedTests += category.failed;
        });

        summary.successRate = summary.totalTests > 0 ? 
            (summary.passedTests / summary.totalTests * 100).toFixed(2) : 0;

        return summary;
    }

    /**
     * Generate validation report
     */
    generateReport(results) {
        let report = `=== WASM Validation Suite Report ===\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;

        const summary = results.summary;
        report += `Summary:\n`;
        report += `- Total Tests: ${summary.totalTests}\n`;
        report += `- Passed: ${summary.passedTests}\n`;
        report += `- Failed: ${summary.failedTests}\n`;
        report += `- Success Rate: ${summary.successRate}%\n\n`;

        // Category breakdowns
        Object.entries(summary.categories).forEach(([category, stats]) => {
            if (stats.total > 0) {
                report += `${category.toUpperCase()} Tests:\n`;
                report += `- Total: ${stats.total}\n`;
                report += `- Passed: ${stats.passed}\n`;
                report += `- Failed: ${stats.failed}\n`;
                report += `- Success Rate: ${(stats.passed / stats.total * 100).toFixed(2)}%\n\n`;
            }
        });

        // Failed test details
        const allTests = [
            ...results.compilationTests,
            ...results.validationTests,
            ...results.importTests,
            ...results.runtimeTests
        ];

        const failedTests = allTests.filter(t => !t.success);
        if (failedTests.length > 0) {
            report += `=== Failed Test Details ===\n`;
            failedTests.forEach((test, i) => {
                report += `${i+1}. ${test.test || path.basename(test.bbFile || 'unknown')}\n`;
                if (test.error) {
                    report += `   Error: ${test.error}\n`;
                }
                if (test.bbFile) {
                    report += `   File: ${test.bbFile}\n`;
                }
                report += '\n';
            });
        }

        return report;
    }
}

module.exports = WASMValidationSuite;