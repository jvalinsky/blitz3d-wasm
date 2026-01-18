/**
 * WASM Compression Module
 * Provides compression and decompression for WASM files
 * Supports Brotli and gzip compression
 */

class WASMCompression {
    constructor() {
        this.supportedFormats = [];
        this.decompressionStreamSupported = 'DecompressionStream' in window;
    }

    /**
     * Check available compression support
     */
    async checkSupport() {
        const support = {
            brotli: false,
            gzip: false,
            decompressionStream: this.decompressionStreamSupported
        };

        // Check Brotli support via Accept-Encoding
        try {
            const response = await fetch('', { method: 'HEAD' });
            const acceptEncoding = response.headers.get('Accept-Encoding') || '';
            support.brotli = acceptEncoding.includes('br');
            support.gzip = acceptEncoding.includes('gzip');
        } catch (e) {
            console.warn('Could not check compression support:', e);
        }

        this.supportedFormats = Object.entries(support)
            .filter(([key, value]) => value && key !== 'decompressionStream')
            .map(([key]) => key);

        console.log('Compression support:', support);
        return support;
    }

    /**
     * Decompress WASM file from compressed format
     */
    async decompress(arrayBuffer, encoding = 'br') {
        const startTime = performance.now();
        
        try {
            let decompressed;
            
            if (this.decompressionStreamSupported && encoding === 'br') {
                // Use DecompressionStream for Brotli
                const ds = new DecompressionStream('br');
                const writer = ds.writable.getWriter();
                writer.write(arrayBuffer);
                writer.close();
                
                const response = new Response(ds.readable);
                decompressed = await response.arrayBuffer();
            } else if (encoding === 'gzip' || encoding === 'gz') {
                // Use DecompressionStream for gzip
                const ds = new DecompressionStream('gzip');
                const writer = ds.writable.getWriter();
                writer.write(arrayBuffer);
                writer.close();
                
                const response = new Response(ds.readable);
                decompressed = await response.arrayBuffer();
            } else {
                // Fallback: assume data is uncompressed
                decompressed = arrayBuffer;
            }

            const decompressTime = performance.now() - startTime;
            console.log(`Decompression (${encoding}): ${(decompressTime).toFixed(2)}ms`);
            console.log(`  Original: ${(arrayBuffer.byteLength / 1024).toFixed(2)} KB`);
            console.log(`  Decompressed: ${(decompressed.byteLength / 1024).toFixed(2)} KB`);
            console.log(`  Ratio: ${((1 - arrayBuffer.byteLength / decompressed.byteLength) * 100).toFixed(1)}%`);

            return decompressed;
        } catch (error) {
            console.warn(`Decompression failed for ${encoding}:`, error);
            // Return original data if decompression fails
            return arrayBuffer;
        }
    }

    /**
     * Load compressed WASM with automatic format detection
     */
    async loadCompressedWasm(url, importObject) {
        console.log(`Loading compressed WASM: ${url}`);
        const startTime = performance.now();

        // Try to get content-encoding header
        let response;
        try {
            response = await fetch(url, { method: 'HEAD' });
        } catch (e) {
            // Fallback to GET request
            response = await fetch(url);
        }

        const contentEncoding = response.headers?.get('Content-Encoding') || '';
        const originalSize = response.headers?.get('Content-Length') || 0;

        // Fetch the actual data
        if (!response.ok || !response.body) {
            response = await fetch(url);
        }

        let arrayBuffer;
        let encoding = '';

        if (contentEncoding.includes('br')) {
            encoding = 'br';
            arrayBuffer = await response.arrayBuffer();
            arrayBuffer = await this.decompress(arrayBuffer, 'br');
        } else if (contentEncoding.includes('gzip')) {
            encoding = 'gzip';
            arrayBuffer = await response.arrayBuffer();
            arrayBuffer = await this.decompress(arrayBuffer, 'gzip');
        } else {
            // Try to detect by file extension
            if (url.endsWith('.br.wasm')) {
                encoding = 'br';
            } else if (url.endsWith('.gz.wasm')) {
                encoding = 'gzip';
            } else {
                encoding = 'none';
            }
            
            arrayBuffer = await response.arrayBuffer();
            
            // Try decompression if file seems compressed
            if (encoding !== 'none' && arrayBuffer.byteLength > 0) {
                const decompressed = await this.decompress(arrayBuffer, encoding);
                // Verify it's a valid WASM file
                const view = new Uint8Array(decompressed);
                if (view[0] === 0 && view[1] === 0 && view[2] === 0 && view[3] === 0x61) {
                    arrayBuffer = decompressed;
                }
            }
        }

        // Instantiate WASM
        const instantiateStart = performance.now();
        let result;
        
        if (WebAssembly.compileStreaming) {
            const module = await WebAssembly.compileStreaming(new Response(arrayBuffer));
            result = await WebAssembly.instantiate(module, importObject);
        } else {
            result = await WebAssembly.instantiate(arrayBuffer, importObject);
        }

        const instantiateTime = performance.now() - instantiateStart;
        const totalTime = performance.now() - startTime;

        console.log(`Compressed WASM load: ${totalTime.toFixed(2)}ms total`);
        console.log(`  Decompression: ${totalTime - instantiateTime}ms`);
        console.log(`  Instantiation: ${instantiateTime}ms`);

        return result;
    }

    /**
     * Calculate compression statistics
     */
    calculateStats(originalBuffer, compressedBuffer) {
        const originalSize = originalBuffer.byteLength;
        const compressedSize = compressedBuffer.byteLength;
        const ratio = (1 - compressedSize / originalSize) * 100;
        const savings = originalSize - compressedSize;

        return {
            originalSize,
            compressedSize,
            ratio: ratio.toFixed(1),
            savings,
            savingsFormatted: `${(savings / 1024).toFixed(2)} KB`
        };
    }
}

/**
 * WASM Bundle Manager
 * Handles loading of compressed and uncompressed WASM files
 */
class WASMBundleManager {
    constructor(compression = null) {
        this.compression = compression || new WASMCompression();
        this.bundles = new Map();
        this.loadingPromises = new Map();
    }

    /**
     * Load WASM bundle with automatic compression support
     */
    async loadBundle(bundleId, urls, importObject = {}) {
        if (this.loadingPromises.has(bundleId)) {
            return this.loadingPromises.get(bundleId);
        }

        const loadPromise = this._loadBundleInternal(bundleId, urls, importObject);
        this.loadingPromises.set(bundleId, loadPromise);

        return loadPromise;
    }

    async _loadBundleInternal(bundleId, urls, importObject) {
        const bundle = {
            id: bundleId,
            modules: new Map(),
            loading: true,
            loaded: false
        };

        this.bundles.set(bundleId, bundle);

        try {
            // Load all modules in parallel
            const loadPromises = urls.map(async (urlInfo) => {
                const url = typeof urlInfo === 'string' ? urlInfo : urlInfo.url;
                const required = typeof urlInfo === 'string' || urlInfo.required !== false;
                const priority = typeof urlInfo === 'string' ? 0 : (urlInfo.priority || 0);

                try {
                    let result;
                    
                    // Try compressed loading first
                    if (url.endsWith('.br.wasm') || url.endsWith('.gz.wasm')) {
                        result = await this.compression.loadCompressedWasm(url, importObject);
                    } else {
                        // Try network with compression headers
                        const response = await fetch(url, {
                            headers: {
                                'Accept-Encoding': 'br, gzip'
                            }
                        });
                        
                        if (response.ok) {
                            const encoding = response.headers.get('Content-Encoding');
                            if (encoding) {
                                result = await this.compression.loadCompressedWasm(url, importObject);
                            } else {
                                // Load normally
                                const arrayBuffer = await response.arrayBuffer();
                                result = await WebAssembly.instantiate(arrayBuffer, importObject);
                            }
                        } else {
                            // Fallback to normal load
                            const arrayBuffer = await fetch(url).then(r => r.arrayBuffer());
                            result = await WebAssembly.instantiate(arrayBuffer, importObject);
                        }
                    }

                    bundle.modules.set(url, {
                        instance: result.instance,
                        module: result.module,
                        priority
                    });

                    return { url, success: true };
                } catch (error) {
                    console.error(`Failed to load module ${url}:`, error);
                    if (required) {
                        throw error;
                    }
                    return { url, success: false, error: error.message };
                }
            });

            const results = await Promise.all(loadPromises);
            
            bundle.loaded = true;
            bundle.loading = false;

            console.log(`Bundle ${bundleId} loaded: ${results.filter(r => r.success).length}/${urls.length} modules`);

            return bundle;
        } catch (error) {
            bundle.loading = false;
            bundle.error = error;
            throw error;
        }
    }

    /**
     * Get a specific module from a bundle
     */
    getModule(bundleId, url) {
        const bundle = this.bundles.get(bundleId);
        if (!bundle || !bundle.loaded) {
            return null;
        }
        return bundle.modules.get(url);
    }

    /**
     * Get all modules from a bundle
     */
    getBundleModules(bundleId) {
        const bundle = this.bundles.get(bundleId);
        if (!bundle || !bundle.loaded) {
            return [];
        }
        return Array.from(bundle.modules.values());
    }

    /**
     * Preload bundles in the background
     */
    async preloadBundle(bundleId, urls, importObject = {}) {
        // Load with lower priority
        return this.loadBundle(bundleId, urls.map((url, i) => ({
            url: typeof url === 'string' ? url : url.url,
            required: false,
            priority: -i
        })), importObject);
    }

    /**
     * Unload a bundle and free memory
     */
    unloadBundle(bundleId) {
        const bundle = this.bundles.get(bundleId);
        if (bundle) {
            bundle.modules.forEach((moduleInfo) => {
                // Module cleanup would go here
            });
            bundle.modules.clear();
            this.bundles.delete(bundleId);
        }
    }
}

// Export
if (typeof window !== 'undefined') {
    window.WASMCompression = WASMCompression;
    window.WASMBundleManager = WASMBundleManager;
}

module.exports = { WASMCompression, WASMBundleManager };