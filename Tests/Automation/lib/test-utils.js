/**
 * Test Utilities Module
 * Common testing patterns and helper functions for WASM testing
 */

const fs = require('fs');
const path = require('path');

class TestUtils {
    constructor() {
        this.testDataDir = path.join(__dirname, '../../IntegrationTests');
        this.assetsDir = path.join(this.testDataDir, 'Assets');
    }

    /**
     * Find all .bb files in integration tests directory
     */
    findBBFiles() {
        const bbFiles = [];
        
        function scanDirectory(dir) {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (item.endsWith('.bb')) {
                    bbFiles.push(fullPath);
                }
            }
        }
        
        scanDirectory(this.testDataDir);
        return bbFiles;
    }

    /**
     * Find all .wasm files in integration tests directory
     */
    findWASMFiles() {
        const wasmFiles = [];
        
        function scanDirectory(dir) {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (item.endsWith('.wasm')) {
                    wasmFiles.push(fullPath);
                }
            }
        }
        
        scanDirectory(this.testDataDir);
        return wasmFiles;
    }

    /**
     * Check if file exists and get its stats
     */
    getFileStats(filePath) {
        try {
            const stat = fs.statSync(filePath);
            return {
                exists: true,
                size: stat.size,
                modified: stat.mtime,
                isFile: stat.isFile(),
                path: filePath
            };
        } catch (error) {
            return {
                exists: false,
                error: error.message,
                path: filePath
            };
        }
    }

    /**
     * Generate test configuration based on available files
     */
    generateTestConfig() {
        const bbFiles = this.findBBFiles();
        const wasmFiles = this.findWASMFiles();
        const htmlFiles = this.findHTMLFiles();
        
        return {
            bbFiles: bbFiles.map(f => path.relative(this.testDataDir, f)),
            wasmFiles: wasmFiles.map(f => path.relative(this.testDataDir, f)),
            htmlFiles: htmlFiles.map(f => path.relative(this.testDataDir, f)),
            generated: new Date().toISOString()
        };
    }

    /**
     * Find all HTML test files
     */
    findHTMLFiles() {
        const htmlFiles = [];
        
        function scanDirectory(dir) {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(fullPath);
                } else if (item.endsWith('.html')) {
                    htmlFiles.push(fullPath);
                }
            }
        }
        
        scanDirectory(this.testDataDir);
        return htmlFiles;
    }

    /**
     * Wait for a condition to be true with timeout
     */
    async waitFor(condition, timeout = 10000, interval = 100) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            if (await condition()) {
                return true;
            }
            await this.sleep(interval);
        }
        
        throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }

    /**
     * Sleep helper
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Create test file stubs for missing WASM files
     */
    createTestStubs() {
        const bbFiles = this.findBBFiles();
        const missingFiles = [];

        for (const bbFile of bbFiles) {
            const wasmFile = bbFile.replace('.bb', '.wasm');
            const wasmStats = this.getFileStats(wasmFile);
            
            if (!wasmStats.exists) {
                missingFiles.push({
                    bbFile: path.relative(this.testDataDir, bbFile),
                    wasmFile: path.relative(this.testDataDir, wasmFile)
                });
            }
        }

        return missingFiles;
    }

    /**
     * Validate WASM file structure
     */
    validateWASMFile(filePath) {
        try {
            const buffer = fs.readFileSync(filePath);
            
            // Basic WASM magic number check
            const magic = buffer.readUInt32LE(0);
            if (magic !== 0x6d736100) { // "\0asm"
                return {
                    valid: false,
                    error: 'Invalid WASM magic number',
                    filePath
                };
            }

            // Basic version check
            const version = buffer.readUInt32LE(4);
            if (version !== 1) {
                return {
                    valid: false,
                    error: `Unsupported WASM version: ${version}`,
                    filePath
                };
            }

            return {
                valid: true,
                size: buffer.length,
                version,
                filePath
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
                filePath
            };
        }
    }

    /**
     * Generate performance benchmark test
     */
    generatePerformanceTest(page) {
        return page.evaluate(() => {
            const results = {
                memoryUsage: {},
                performance: {},
                compilationTime: null
            };

            // Memory usage
            if (performance.memory) {
                results.memoryUsage = {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                };
            }

            // Performance timing
            if (performance.timing) {
                results.performance = {
                    navigationStart: performance.timing.navigationStart,
                    loadEventEnd: performance.timing.loadEventEnd,
                    domContentLoaded: performance.timing.domContentLoadedEventEnd
                };
            }

            // WASM compilation time if available
            if (window.wasmCompilationStart && window.wasmCompilationEnd) {
                results.compilationTime = window.wasmCompilationEnd - window.wasmCompilationStart;
            }

            return results;
        });
    }

    /**
     * Check for specific WASM imports in compiled module
     */
    async checkWASMImports(page) {
        return await page.evaluate(() => {
            if (!window.wasmInstance) {
                return { error: 'No WASM instance found' };
            }

            try {
                const imports = [];
                // This would need to be enhanced to actually inspect the WASM module
                // For now, we'll capture what we can from the runtime environment
                if (window.wasmErrors) {
                    const importErrors = window.wasmErrors.filter(e => e.importObject);
                    importErrors.forEach(error => {
                        if (error.importObject) {
                            imports.push(...error.importObject);
                        }
                    });
                }

                return {
                    found: Array.from(new Set(imports)),
                    timestamp: Date.now()
                };
            } catch (error) {
                return {
                    error: error.message,
                    timestamp: Date.now()
                };
            }
        });
    }

    /**
     * Create directory if it doesn't exist
     */
    ensureDirectory(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    /**
     * Save test data to file
     */
    saveTestData(data, filename, reportsDir) {
        this.ensureDirectory(reportsDir);
        const filePath = path.join(reportsDir, filename);
        
        if (typeof data === 'object') {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        } else {
            fs.writeFileSync(filePath, data);
        }
        
        return filePath;
    }

    /**
     * Load test data from file
     */
    loadTestData(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            
            // Try to parse as JSON first
            try {
                return JSON.parse(content);
            } catch {
                // Return as text if not JSON
                return content;
            }
        } catch (error) {
            throw new Error(`Failed to load test data from ${filePath}: ${error.message}`);
        }
    }
}

module.exports = TestUtils;