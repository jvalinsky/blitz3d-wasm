/**
 * Enhanced WASM Loader
 * Integrates caching, WebWorker compilation, and progressive loading
 */

class EnhancedWASMLoader {
    constructor(options = {}) {
        this.cache = options.cache || new WASMCache();
        this.workerScript = options.workerScript || 'lib/wasm-compiler-worker.js';
        this.useWorker = options.useWorker !== false;
        this.useCache = options.useCache !== false;
        this.maxCacheSize = options.maxCacheSize || 50 * 1024 * 1024; // 50MB
        this.pendingLoads = new Map();
        this.activeWorkers = [];
        this.maxWorkers = navigator.hardwareConcurrency || 4;
    }

    /**
     * Load WASM with all optimizations
     */
    async load(url, importObject = {}) {
        const loadId = this.generateLoadId();
        const startTime = performance.now();
        
        console.log(`Loading WASM: ${url} (id: ${loadId})`);
        
        try {
            // Try cache first if enabled
            if (this.useCache) {
                const cachedResult = await this.loadFromCache(url, importObject);
                if (cachedResult) {
                    cachedResult.loadTime = performance.now() - startTime;
                    cachedResult.fromCache = true;
                    return cachedResult;
                }
            }

            // Use WebWorker compilation if enabled
            if (this.useWorker && this.shouldUseWorker()) {
                return await this.loadWithWorker(url, importObject, loadId, startTime);
            }

            // Fallback to direct loading
            return await this.loadDirect(url, importObject, loadId, startTime);
            
        } catch (error) {
            console.error(`Failed to load ${url}:`, error);
            throw error;
        }
    }

    /**
     * Load from cache
     */
    async loadFromCache(url, importObject) {
        try {
            const result = await this.cache.loadWithCache(url, importObject);
            if (result && result.instance) {
                console.log(`Cache hit: ${url} loaded in ${result.loadTime.toFixed(2)}ms`);
                return result;
            }
        } catch (error) {
            console.warn(`Cache load failed for ${url}:`, error);
        }
        return null;
    }

    /**
     * Load using WebWorker for background compilation
     */
    async loadWithWorker(url, importObject, loadId, startTime) {
        return new Promise((resolve, reject) => {
            // Check if we need to wait for a worker
            if (this.activeWorkers.length >= this.maxWorkers) {
                // Wait for a worker to become available
                this.waitForWorker().then(() => {
                    this.loadWithWorker(url, importObject, loadId, startTime).then(resolve).catch(reject);
                });
                return;
            }

            // Create worker
            const worker = new Worker(this.workerScript);
            this.activeWorkers.push(worker);

            // Set up timeout
            const timeout = setTimeout(() => {
                worker.terminate();
                this.activeWorkers = this.activeWorkers.filter(w => w !== worker);
                reject(new Error(`Compilation timeout for ${url}`));
            }, 30000);

            // Handle worker response
            worker.onmessage = async (event) => {
                clearTimeout(timeout);
                this.activeWorkers = this.activeWorkers.filter(w => w !== worker);
                
                const { success, module, error, compileTime, totalTime, size } = event.data;
                
                if (!success) {
                    reject(new Error(error));
                    return;
                }

                try {
                    // Instantiate the compiled module
                    const instantiateStart = performance.now();
                    const instance = await WebAssembly.instantiate(module, importObject);
                    const instantiateTime = performance.now() - instantiateStart;

                    console.log(`Worker compilation: ${url} in ${totalTime.toFixed(2)}ms (compile: ${compileTime.toFixed(2)}ms, instantiate: ${instantiateTime.toFixed(2)}ms)`);

                    // Store in cache for future use
                    if (this.useCache) {
                        await this.cache.storeCompiledModule(url, module, { compileTime, totalTime });
                        await this.cache.storeRawBytes(url, new Uint8Array(size));
                    }

                    resolve({
                        instance,
                        module,
                        loadTime: performance.now() - startTime,
                        compileTime,
                        instantiateTime,
                        fromCache: false
                    });
                } catch (instantiateError) {
                    reject(instantiateError);
                }
            };

            worker.onerror = (error) => {
                clearTimeout(timeout);
                this.activeWorkers = this.activeWorkers.filter(w => w !== worker);
                reject(new Error(`Worker error: ${error.message}`));
            };

            // Start compilation
            worker.postMessage({ url, importObject, id: loadId });
        });
    }

    /**
     * Direct loading without worker
     */
    async loadDirect(url, importObject, loadId, startTime) {
        console.log(`Direct loading: ${url}`);
        
        // Fetch
        const fetchStart = performance.now();
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const bytes = await response.arrayBuffer();
        const fetchTime = performance.now() - fetchStart;

        console.log(`Download: ${(bytes.byteLength / 1024).toFixed(2)} KB in ${fetchTime.toFixed(2)}ms`);

        // Compile
        const compileStart = performance.now();
        let module;
        
        if (WebAssembly.compileStreaming) {
            module = await WebAssembly.compileStreaming(new Response(bytes));
        } else {
            module = await WebAssembly.compile(bytes);
        }
        const compileTime = performance.now() - compileStart;

        // Instantiate
        const instantiateStart = performance.now();
        const instance = await WebAssembly.instantiate(module, importObject);
        const instantiateTime = performance.now() - instantiateStart;

        console.log(`Direct load: ${url} - compile: ${compileTime.toFixed(2)}ms, instantiate: ${instantiateTime.toFixed(2)}ms`);

        // Cache the result
        if (this.useCache) {
            await this.cache.storeCompiledModule(url, module, { compileTime, totalTime: compileTime + instantiateTime });
            await this.cache.storeRawBytes(url, bytes);
        }

        return {
            instance,
            module,
            loadTime: performance.now() - startTime,
            compileTime,
            instantiateTime,
            fromCache: false
        };
    }

    /**
     * Check if we should use WebWorker
     */
    shouldUseWorker() {
        // Don't use worker for very small files or if all workers are busy
        return this.activeWorkers.length < this.maxWorkers;
    }

    /**
     * Wait for a worker to become available
     */
    waitForWorker() {
        return new Promise(resolve => {
            const checkInterval = setInterval(() => {
                if (this.activeWorkers.length < this.maxWorkers) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 50);
        });
    }

    /**
     * Generate unique load ID
     */
    generateLoadId() {
        return `load_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Preload multiple WASM modules
     */
    async preload(urls, options = {}) {
        const results = new Map();
        
        // Load in parallel with limited concurrency
        const concurrency = options.concurrency || 2;
        const chunks = this.chunkArray(urls, concurrency);
        
        for (const chunk of chunks) {
            const promises = chunk.map(url => 
                this.load(url).then(result => ({ url, success: true, result }))
                .catch(error => ({ url, success: false, error: error.message }))
            );
            
            const chunkResults = await Promise.all(promises);
            chunkResults.forEach(r => results.set(r.url, r));
        }

        return results;
    }

    /**
     * Split array into chunks
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Get loader statistics
     */
    getStats() {
        return {
            activeWorkers: this.activeWorkers.length,
            maxWorkers: this.maxWorkers,
            pendingLoads: this.pendingLoads.size,
            cacheEnabled: this.useCache,
            workerEnabled: this.useWorker
        };
    }

    /**
     * Clear all caches
     */
    async clearCache() {
        await this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        return await this.cache.getStats();
    }
}

// Export
if (typeof window !== 'undefined') {
    window.EnhancedWASMLoader = EnhancedWASMLoader;
}

module.exports = EnhancedWASMLoader;