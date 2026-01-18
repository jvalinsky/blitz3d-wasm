/**
 * WASM Compilation WebWorker
 * Performs WASM compilation in a background thread to avoid blocking the UI
 * 
 * Usage:
 *   const worker = new Worker('lib/wasm-compiler-worker.js');
 *   worker.postMessage({ url, importObject, id });
 *   worker.onmessage = (event) => {
 *     if (event.data.success) {
 *       const { module, compileTime, totalTime, size } = event.data;
 *     } else {
 *       const { error } = event.data;
 *     }
 *   };
 * 
 * @module wasm-compiler-worker
 */

// Listen for compilation requests
self.onmessage = async function(event) {
    const { url, importObject, id } = event.data;
    
    try {
        console.log(`[Worker ${id}] Starting compilation of ${url}`);
        const startTime = performance.now();
        
        // Fetch the WASM file
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const bytes = await response.arrayBuffer();
        console.log(`[Worker ${id}] Downloaded ${(bytes.byteLength / 1024).toFixed(2)} KB in ${(performance.now() - startTime).toFixed(2)}ms`);
        
        // Compile the module
        const compileStart = performance.now();
        let module;
        
        if (WebAssembly.compileStreaming) {
            module = await WebAssembly.compileStreaming(new Response(bytes));
        } else {
            module = await WebAssembly.compile(bytes);
        }
        
        const compileTime = performance.now() - compileStart;
        const totalTime = performance.now() - startTime;
        
        console.log(`[Worker ${id}] Compilation completed in ${compileTime.toFixed(2)}ms (total: ${totalTime.toFixed(2)}ms)`);
        
        // Return the compiled module
        self.postMessage({
            id: id,
            success: true,
            module: module,
            compileTime: compileTime,
            totalTime: totalTime,
            size: bytes.byteLength
        });
        
    } catch (error) {
        console.error(`[Worker ${id}] Compilation failed:`, error);
        self.postMessage({
            id: id,
            success: false,
            error: error.message
        });
    }
};

console.log('WASM Compilation Worker initialized');