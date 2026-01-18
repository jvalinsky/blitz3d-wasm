/**
 * WASM Caching Module
 * Provides intelligent caching for WASM modules using Cache API and IndexedDB
 * Supports both compiled modules and raw bytes caching
 */

class WASMCache {
    constructor() {
        this.cacheName = 'blitz3d-wasm-cache';
        this.dbName = 'WASMIndexedDB';
        this.dbVersion = 1;
        this.db = null;
        this.cache = null;
        this.isInitialized = false;
    }

    /**
     * Initialize the cache system
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Open IndexedDB for compiled modules
            this.db = await this.openIndexedDB();
            
            // Open Cache API for raw bytes
            this.cache = await caches.open(this.cacheName);
            
            this.isInitialized = true;
            console.log('WASM cache initialized');
        } catch (error) {
            console.warn('WASM cache initialization failed, continuing without cache:', error);
            // Continue without caching - don't fail
            this.isInitialized = true;
        }
    }

    /**
     * Open IndexedDB for storing compiled WASM modules
     */
    openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Store compiled WASM modules
                if (!db.objectStoreNames.contains('compiledModules')) {
                    const store = db.createObjectStore('compiledModules', { keyPath: 'url' });
                    store.createIndex('timestamp', 'timestamp');
                    store.createIndex('size', 'size');
                }

                // Store module metadata
                if (!db.objectStoreNames.contains('moduleMetadata')) {
                    db.createObjectStore('moduleMetadata', { keyPath: 'url' });
                }
            };
        });
    }

    /**
     * Get cached compiled module from IndexedDB
     */
    async getCompiledModule(url) {
        if (!this.db) return null;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['compiledModules'], 'readonly');
            const store = transaction.objectStore('compiledModules');
            const request = store.get(url);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (result && this.isModuleValid(result)) {
                    console.log(`Cache hit for compiled module: ${url}`);
                    resolve(result.module);
                } else {
                    resolve(null);
                }
            };
        });
    }

    /**
     * Store compiled module in IndexedDB
     */
    async storeCompiledModule(url, module, metadata = {}) {
        if (!this.db) return;

        const record = {
            url: url,
            module: module,
            timestamp: Date.now(),
            size: module.byteLength || 0,
            metadata: metadata
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['compiledModules'], 'readwrite');
            const store = transaction.objectStore('compiledModules');
            const request = store.put(record);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Check if cached module is still valid
     */
    isModuleValid(record) {
        // Check if module is not too old (7 days max)
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - record.timestamp > maxAge) {
            return false;
        }

        // Check if module has required properties
        return record.module && record.module instanceof WebAssembly.Module;
    }

    /**
     * Get cached raw bytes from Cache API
     */
    async getRawBytes(url) {
        if (!this.cache) return null;

        try {
            const response = await this.cache.match(url);
            if (response) {
                console.log(`Cache hit for raw bytes: ${url}`);
                return await response.arrayBuffer();
            }
        } catch (error) {
            console.warn('Error reading from cache:', error);
        }
        return null;
    }

    /**
     * Store raw bytes in Cache API
     */
    async storeRawBytes(url, bytes) {
        if (!this.cache) return;

        try {
            const response = new Response(bytes, {
                headers: { 'Content-Type': 'application/wasm' }
            });
            await this.cache.put(url, response);
        } catch (error) {
            console.warn('Error storing in cache:', error);
        }
    }

    /**
     * Load WASM module with full caching support
     * Tries cache first, then network, then stores in cache
     */
    async loadWithCache(url, importObject = {}) {
        await this.init();

        const startTime = performance.now();
        let source = null;
        let useCache = false;

        // Try to get from cache first
        const cachedBytes = await this.getRawBytes(url);
        if (cachedBytes) {
            source = cachedBytes;
            useCache = true;
            console.log(`Loading ${url} from cache...`);
        }

        // If not in cache, fetch from network
        if (!source) {
            console.log(`Fetching ${url} from network...`);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            source = await response.arrayBuffer();

            // Store in cache for future use
            await this.storeRawBytes(url, source);
        }

        // Try to get compiled module from IndexedDB
        let module = await this.getCompiledModule(url);
        let instance;

        if (module && useCache) {
            // Use cached compiled module
            console.log('Using cached compiled module');
            instance = await WebAssembly.instantiate(module, importObject);
        } else {
            // Compile from source
            console.log('Compiling WASM module...');
            const compileStart = performance.now();
            
            if (WebAssembly.compileStreaming) {
                module = await WebAssembly.compileStreaming(new Response(source));
            } else {
                module = await WebAssembly.compile(source);
            }

            const compileTime = performance.now() - compileStart;
            console.log(`Compilation time: ${compileTime.toFixed(2)}ms`);

            // Store compiled module in IndexedDB
            await this.storeCompiledModule(url, module, { compileTime });

            // Instantiate
            instance = await WebAssembly.instantiate(module, importObject);
        }

        const loadTime = performance.now() - startTime;
        console.log(`Total load time: ${loadTime.toFixed(2)}ms (${useCache ? 'cached' : 'network'})`);

        return {
            instance,
            module,
            loadTime,
            fromCache: useCache,
            source: source
        };
    }

    /**
     * Preload WASM modules into cache
     */
    async preload(urls) {
        await this.init();

        console.log(`Preloading ${urls.length} WASM modules...`);
        const results = [];

        for (const url of urls) {
            try {
                const result = await this.loadWithCache(url);
                results.push({ url, success: true, loadTime: result.loadTime });
            } catch (error) {
                console.warn(`Failed to preload ${url}:`, error);
                results.push({ url, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Clear all cached data
     */
    async clear() {
        // Clear Cache API
        if (this.cache) {
            await this.cache.delete(this.cacheName);
            this.cache = await caches.open(this.cacheName);
        }

        // Clear IndexedDB
        if (this.db) {
            const transaction = this.db.transaction(['compiledModules'], 'readwrite');
            const store = transaction.objectStore('compiledModules');
            await store.clear();
        }

        console.log('WASM cache cleared');
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        if (!this.db) {
            return { error: 'Cache not initialized' };
        }

        const stats = {
            cacheName: this.cacheName,
            compiledModules: 0,
            totalSize: 0,
            oldestEntry: null,
            newestEntry: null
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['compiledModules'], 'readonly');
            const store = transaction.objectStore('compiledModules');
            const request = store.getAll();

            request.onsuccess = () => {
                const modules = request.result || [];
                stats.compiledModules = modules.length;
                stats.totalSize = modules.reduce((sum, m) => sum + (m.size || 0), 0);

                if (modules.length > 0) {
                    stats.oldestEntry = new Date(Math.min(...modules.map(m => m.timestamp))).toISOString();
                    stats.newestEntry = new Date(Math.max(...modules.map(m => m.timestamp))).toISOString();
                }

                resolve(stats);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Remove expired entries from cache
     */
    async cleanup() {
        if (!this.db) return;

        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        const now = Date.now();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['compiledModules'], 'readwrite');
            const store = transaction.objectStore('compiledModules');
            const request = store.getAll();

            request.onsuccess = () => {
                const modules = request.result || [];
                let removed = 0;

                modules.forEach(module => {
                    if (now - module.timestamp > maxAge) {
                        store.delete(module.url);
                        removed++;
                    }
                });

                console.log(`Cache cleanup: removed ${removed} expired entries`);
                resolve(removed);
            };

            request.onerror = () => reject(request.error);
        });
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.WASMCache = WASMCache;
}

module.exports = WASMCache;