
import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        target: 'esnext', // Support Top-level await for WASM
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    loaders: [
                        './src/runtime/xloader.ts'
                    ]
                }
            }
        }
    },
    resolve: {
        alias: {
            '@': '/src'
        }
    }
});
