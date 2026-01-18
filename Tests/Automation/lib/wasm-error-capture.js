/**
 * WASM Error Capture Module
 * Provides comprehensive error monitoring and categorization for WebAssembly testing
 */

class WASMErrorCapture {
    constructor() {
        this.errors = [];
        this.consoleMessages = [];
        this.wasmImports = [];
        this.wasmCompilationTime = null;
        this.setupComplete = false;
    }

    /**
     * Initialize error capture on a Puppeteer page
     */
    async initialize(page) {
        if (this.setupComplete) {
            return;
        }

        // Inject custom error handlers and monitoring
        await page.evaluateOnNewDocument(() => {
            // Global error storage
            window.wasmTestErrors = [];
            window.wasmConsoleMessages = [];
            window.wasmImportErrors = [];
            window.wasmCompilationStart = null;
            window.wasmCompilationEnd = null;

            // Enhanced console capture
            const originalConsole = {
                log: console.log,
                error: console.error,
                warn: console.warn,
                info: console.info
            };

            function captureConsole(level, args) {
                const message = Array.from(args).join(' ');
                window.wasmConsoleMessages.push({
                    timestamp: Date.now(),
                    level: level,
                    message: message,
                    stack: level === 'error' && args[0] instanceof Error ? args[0].stack : null
                });
                
                // Call original console
                originalConsole[level].apply(console, args);
            }

            // Override console methods
            console.log = (...args) => captureConsole('log', args);
            console.error = (...args) => captureConsole('error', args);
            console.warn = (...args) => captureConsole('warn', args);
            console.info = (...args) => captureConsole('info', args);

            // Global error handlers
            window.addEventListener('error', (event) => {
                window.wasmTestErrors.push({
                    type: 'GlobalError',
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error ? event.error.stack : null,
                    timestamp: Date.now()
                });
            });

            window.addEventListener('unhandledrejection', (event) => {
                window.wasmTestErrors.push({
                    type: 'UnhandledPromiseRejection',
                    message: event.reason ? event.reason.toString() : 'Unknown reason',
                    stack: event.reason && event.reason.stack ? event.reason.stack : null,
                    timestamp: Date.now()
                });
            });

            // WebAssembly error capture
            const originalInstantiate = WebAssembly.instantiate;
            const originalInstantiateStreaming = WebAssembly.instantiateStreaming;

            WebAssembly.instantiate = async function(...args) {
                const startTime = performance.now();
                window.wasmCompilationStart = startTime;
                
                try {
                    const result = await originalInstantiate.apply(this, args);
                    window.wasmCompilationEnd = performance.now();
                    return result;
                } catch (error) {
                    window.wasmCompilationEnd = performance.now();
                    window.wasmTestErrors.push({
                        type: 'WebAssemblyCompileError',
                        name: error.constructor.name,
                        message: error.message,
                        stack: error.stack,
                        compilationTime: window.wasmCompilationEnd - window.wasmCompilationStart,
                        timestamp: Date.now()
                    });
                    throw error;
                }
            };

            WebAssembly.instantiateStreaming = async function(...args) {
                const startTime = performance.now();
                window.wasmCompilationStart = startTime;
                
                try {
                    const result = await originalInstantiateStreaming.apply(this, args);
                    window.wasmCompilationEnd = performance.now();
                    return result;
                } catch (error) {
                    window.wasmCompilationEnd = performance.now();
                    window.wasmTestErrors.push({
                        type: 'WebAssemblyStreamingCompileError',
                        name: error.constructor.name,
                        message: error.message,
                        stack: error.stack,
                        compilationTime: window.wasmCompilationEnd - window.wasmCompilationStart,
                        timestamp: Date.now()
                    });
                    throw error;
                }
            };

            // Monitor WASM module instantiation
            const originalInstance = WebAssembly.Instance;
            WebAssembly.Instance = function(module, importObject) {
                try {
                    // Validate imports before instantiation
                    if (importObject && module) {
                        const requiredImports = [];
                        // This would need to be enhanced to actually read module imports
                        // For now, we'll capture any import-related errors during instantiation
                    }
                    
                    return new originalInstance(module, importObject);
                } catch (error) {
                    window.wasmTestErrors.push({
                        type: 'WebAssemblyLinkError',
                        name: error.constructor.name,
                        message: error.message,
                        stack: error.stack,
                        importObject: importObject ? Object.keys(importObject) : null,
                        timestamp: Date.now()
                    });
                    throw error;
                }
            };
        });

        // Set up Puppeteer event listeners
        await this.setupPuppeteerListeners(page);
        this.setupComplete = true;
    }

    /**
     * Set up Puppeteer-specific event listeners
     */
    async setupPuppeteerListeners(page) {
        // Console message capture
        page.on('console', msg => {
            this.consoleMessages.push({
                type: msg.type(),
                text: msg.text(),
                location: msg.location(),
                timestamp: Date.now()
            });
        });

        // Page error capture
        page.on('pageerror', error => {
            this.errors.push({
                type: 'PageError',
                message: error.message,
                stack: error.stack,
                timestamp: Date.now()
            });
        });

        // Request failure capture
        page.on('requestfailed', request => {
            this.errors.push({
                type: 'RequestFailed',
                url: request.url(),
                failure: request.failure(),
                timestamp: Date.now()
            });
        });

        // Response error capture
        page.on('response', response => {
            if (response.status() >= 400) {
                this.errors.push({
                    type: 'ResponseError',
                    url: response.url(),
                    status: response.status(),
                    statusText: response.statusText(),
                    timestamp: Date.now()
                });
            }
        });
    }

    /**
     * Capture all errors and console messages from the page
     */
    async captureResults(page) {
        const results = await page.evaluate(() => {
            return {
                errors: window.wasmTestErrors || [],
                consoleMessages: window.wasmConsoleMessages || [],
                compilationTime: window.wasmCompilationStart && window.wasmCompilationEnd ? 
                    window.wasmCompilationEnd - window.wasmCompilationStart : null,
                importErrors: window.wasmImportErrors || []
            };
        });

        // Merge with Puppeteer-captured errors
        this.errors = [...this.errors, ...results.errors];
        this.consoleMessages = [...this.consoleMessages, ...results.consoleMessages];
        this.wasmCompilationTime = results.compilationTime;

        return this.getComprehensiveResults();
    }

    /**
     * Categorize errors and provide comprehensive results
     */
    getComprehensiveResults() {
        const categorized = {
            compileErrors: [],
            linkErrors: [],
            runtimeErrors: [],
            consoleErrors: [],
            networkErrors: [],
            otherErrors: []
        };

        // Categorize errors
        this.errors.forEach(error => {
            switch (error.type) {
                case 'WebAssemblyCompileError':
                case 'WebAssemblyStreamingCompileError':
                    categorized.compileErrors.push(error);
                    break;
                case 'WebAssemblyLinkError':
                    categorized.linkErrors.push(error);
                    break;
                case 'PageError':
                case 'GlobalError':
                case 'UnhandledPromiseRejection':
                    categorized.runtimeErrors.push(error);
                    break;
                case 'RequestFailed':
                case 'ResponseError':
                    categorized.networkErrors.push(error);
                    break;
                default:
                    categorized.otherErrors.push(error);
            }
        });

        // Categorize console messages
        this.consoleMessages.forEach(msg => {
            if (msg.type === 'error') {
                categorized.consoleErrors.push(msg);
            }
        });

        return {
            summary: {
                totalErrors: this.errors.length,
                totalConsoleMessages: this.consoleMessages.length,
                compilationTime: this.wasmCompilationTime,
                errorCounts: {
                    compile: categorized.compileErrors.length,
                    link: categorized.linkErrors.length,
                    runtime: categorized.runtimeErrors.length,
                    console: categorized.consoleErrors.length,
                    network: categorized.networkErrors.length,
                    other: categorized.otherErrors.length
                }
            },
            categorized,
            rawErrors: this.errors,
            rawConsoleMessages: this.consoleMessages
        };
    }

    /**
     * Generate detailed error report
     */
    generateReport() {
        const results = this.getComprehensiveResults();
        
        let report = `=== WASM Error Capture Report ===\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;
        
        report += `Summary:\n`;
        report += `- Total Errors: ${results.summary.totalErrors}\n`;
        report += `- Console Messages: ${results.summary.totalConsoleMessages}\n`;
        if (results.summary.compilationTime) {
            report += `- Compilation Time: ${results.summary.compilationTime.toFixed(2)}ms\n`;
        }
        report += `\nError Breakdown:\n`;
        Object.entries(results.summary.errorCounts).forEach(([type, count]) => {
            if (count > 0) {
                report += `- ${type}: ${count}\n`;
            }
        });

        // Detailed errors
        if (results.categorized.compileErrors.length > 0) {
            report += `\n=== Compile Errors ===\n`;
            results.categorized.compileErrors.forEach((error, i) => {
                report += `${i+1}. ${error.name}: ${error.message}\n`;
                if (error.compilationTime) {
                    report += `   Compilation time: ${error.compilationTime.toFixed(2)}ms\n`;
                }
                if (error.stack) {
                    report += `   Stack: ${error.stack.split('\n')[0]}\n`;
                }
            });
        }

        if (results.categorized.linkErrors.length > 0) {
            report += `\n=== Link Errors ===\n`;
            results.categorized.linkErrors.forEach((error, i) => {
                report += `${i+1}. ${error.name}: ${error.message}\n`;
                if (error.importObject) {
                    report += `   Available imports: ${error.importObject.join(', ')}\n`;
                }
            });
        }

        if (results.categorized.runtimeErrors.length > 0) {
            report += `\n=== Runtime Errors ===\n`;
            results.categorized.runtimeErrors.forEach((error, i) => {
                report += `${i+1}. ${error.type}: ${error.message}\n`;
                if (error.stack) {
                    report += `   Stack: ${error.stack.split('\n')[0]}\n`;
                }
            });
        }

        return report;
    }

    /**
     * Reset all captured data
     */
    reset() {
        this.errors = [];
        this.consoleMessages = [];
        this.wasmImports = [];
        this.wasmCompilationTime = null;
    }
}

module.exports = WASMErrorCapture;