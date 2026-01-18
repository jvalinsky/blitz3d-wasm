/**
 * WASM Cache Integration Tests
 * Tests caching functionality including cache hit/miss behavior,
 * cache invalidation, and performance improvements
 * 
 * Note: Some tests require a browser environment (with indexedDB and fetch)
 */

const assert = require('assert');
const path = require('path');

class WASMCacheTests {
    constructor() {
        this.testResults = [];
        this.cache = null;
        this.isBrowser = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
    }

    async runAllTests() {
        console.log('=== WASM Cache Integration Tests ===');
        console.log(`Environment: ${this.isBrowser ? 'Browser' : 'Node.js (limited)'}\n`);

        await this.testCacheInitialization();
        await this.testApiSurface();
        await this.testCacheMiss();
        await this.testCacheStats();
        await this.testCacheCleanup();
        await this.testCacheInvalidation();
        
        if (this.isBrowser) {
            console.log('\n[Browser-only tests]');
            await this.testCacheStoreAndRetrieve();
            await this.testCachePreload();
        } else {
            console.log('\n[Skipped: Browser-only tests require browser environment]');
            this.testResults.push({ name: 'Cache Store and Retrieve', passed: 'skipped', note: 'Browser API required' });
            this.testResults.push({ name: 'Cache Preload', passed: 'skipped', note: 'Browser API required' });
        }

        this.printSummary();
        return this.testResults;
    }

    async testCacheInitialization() {
        const testName = 'Cache Initialization';
        console.log(`Running: ${testName}`);

        try {
            const WASMCache = require('./lib/wasm-cache');
            this.cache = new WASMCache();

            assert.ok(this.cache, 'Cache instance should be created');
            assert.strictEqual(this.cache.cacheName, 'blitz3d-wasm-cache', 'Cache name should match');
            assert.strictEqual(this.cache.dbName, 'WASMIndexedDB', 'DB name should match');
            assert.strictEqual(this.cache.dbVersion, 1, 'DB version should be 1');
            assert.strictEqual(this.cache.isInitialized, false, 'Should not be initialized yet');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testApiSurface() {
        const testName = 'API Surface';
        console.log(`Running: ${testName}`);

        try {
            const WASMCache = require('./lib/wasm-cache');
            this.cache = new WASMCache();

            const requiredMethods = [
                'init', 'openIndexedDB', 'getCompiledModule', 'storeCompiledModule',
                'isModuleValid', 'getRawBytes', 'storeRawBytes', 'loadWithCache',
                'preload', 'clear', 'getStats', 'cleanup'
            ];

            const missingMethods = requiredMethods.filter(m => typeof this.cache[m] !== 'function');
            
            if (missingMethods.length > 0) {
                throw new Error(`Missing methods: ${missingMethods.join(', ')}`);
            }

            assert.strictEqual(requiredMethods.length, requiredMethods.filter(m => typeof this.cache[m] === 'function').length, 
                'All required methods should exist');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testCacheStoreAndRetrieve() {
        const testName = 'Cache Store and Retrieve';
        console.log(`Running: ${testName}`);

        if (!this.isBrowser) {
            this.testResults.push({ name: testName, passed: 'skipped', note: 'Browser API required' });
            console.log(`  [SKIP] ${testName} (requires browser)\n`);
            return;
        }

        try {
            await this.cache.init();

            const testData = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
            const testUrl = 'test-module.wasm';

            await this.cache.storeRawBytes(testUrl, testData.buffer);
            const retrieved = await this.cache.getRawBytes(testUrl);

            assert.ok(retrieved, 'Should retrieve cached data');
            assert.strictEqual(retrieved.byteLength, testData.length, 'Data length should match');

            const retrievedArray = new Uint8Array(retrieved);
            assert.deepStrictEqual(retrievedArray, testData, 'Data content should match');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testCacheMiss() {
        const testName = 'Cache Miss Handling';
        console.log(`Running: ${testName}`);

        try {
            await this.cache.init();

            const nonExistentUrl = 'non-existent-module.wasm';
            const result = await this.cache.getRawBytes(nonExistentUrl);

            assert.strictEqual(result, null, 'Cache miss should return null');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testCacheInvalidation() {
        const testName = 'Cache Invalidation';
        console.log(`Running: ${testName}`);

        if (!this.isBrowser) {
            this.testResults.push({ name: testName, passed: 'skipped', note: 'Browser API required' });
            console.log(`  [SKIP] ${testName} (requires browser)\n`);
            return;
        }

        try {
            const testUrl = 'test-invalidation.wasm';
            const testData = new Uint8Array([1, 2, 3, 4]);

            await this.cache.storeRawBytes(testUrl, testData.buffer);
            let retrieved = await this.cache.getRawBytes(testUrl);
            assert.ok(retrieved, 'Should retrieve before clearing');

            await this.cache.clear();
            retrieved = await this.cache.getRawBytes(testUrl);

            assert.strictEqual(retrieved, null, 'Cache should be empty after clear');

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testCacheStats() {
        const testName = 'Cache Statistics';
        console.log(`Running: ${testName}`);

        try {
            await this.cache.init();

            const stats = await this.cache.getStats();

            if (stats.error) {
                console.log(`  Cache not available in this environment: ${stats.error}`);
                this.testResults.push({ name: testName, passed: 'skipped', note: 'IndexedDB unavailable' });
                console.log(`  [SKIP] ${testName} (IndexedDB unavailable)\n`);
                return;
            }

            assert.ok(stats, 'Stats should be returned');
            assert.ok(typeof stats.compiledModules === 'number', 'compiledModules should be a number');
            assert.ok(typeof stats.totalSize === 'number', 'totalSize should be a number');
            assert.strictEqual(stats.cacheName, 'blitz3d-wasm-cache', 'Cache name should match');

            console.log(`  Cache Stats: ${stats.compiledModules} modules, ${(stats.totalSize / 1024).toFixed(2)} KB`);

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testCachePreload() {
        const testName = 'Cache Preload';
        console.log(`Running: ${testName}`);

        if (!this.isBrowser) {
            this.testResults.push({ name: testName, passed: 'skipped', note: 'Browser API required' });
            console.log(`  [SKIP] ${testName} (requires browser)\n`);
            return;
        }

        try {
            const testUrls = [
                '/test_project/test.wasm',
                '/test_data_print.wasm'
            ];

            const results = await this.cache.preload(testUrls);

            assert.strictEqual(results.length, 2, 'Should have results for both URLs');
            console.log(`  Preload results: ${results.filter(r => r.success).length}/${results.length} successful`);

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    async testCacheCleanup() {
        const testName = 'Cache Cleanup';
        console.log(`Running: ${testName}`);

        try {
            await this.cache.init();

            if (!this.isBrowser) {
                this.testResults.push({ name: testName, passed: 'skipped', note: 'Browser API required' });
                console.log(`  [SKIP] ${testName} (requires browser)\n`);
                return;
            }

            const removed = await this.cache.cleanup();

            assert.ok(typeof removed === 'number', 'Should return number of removed entries');
            console.log(`  Cleaned up ${removed} expired entries`);

            this.testResults.push({ name: testName, passed: true });
            console.log(`  [PASS] ${testName}\n`);
        } catch (error) {
            this.testResults.push({ name: testName, passed: false, error: error.message });
            console.error(`  [FAIL] ${testName}: ${error.message}\n`);
        }
    }

    printSummary() {
        const passed = this.testResults.filter(r => r.passed === true).length;
        const skipped = this.testResults.filter(r => r.passed === 'skipped').length;
        const failed = this.testResults.filter(r => r.passed === false).length;

        console.log('\n=== Cache Test Summary ===');
        console.log(`Total: ${this.testResults.length}`);
        console.log(`Passed: ${passed}`);
        console.log(`Skipped: ${skipped}`);
        console.log(`Failed: ${failed}`);
        console.log('');

        if (failed > 0) {
            console.log('Failed tests:');
            this.testResults.filter(r => r.passed === false).forEach(r => {
                console.log(`  - ${r.name}: ${r.error}`);
            });
        }
    }
}

async function main() {
    const tests = new WASMCacheTests();
    const results = await tests.runAllTests();

    const exitCode = results.every(r => r.passed === true || r.passed === 'skipped') ? 0 : 1;
    process.exit(exitCode);
}

main().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
});
