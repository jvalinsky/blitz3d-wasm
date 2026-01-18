/**
 * Blitz3D Runtime - Backwards Compatible Entry Point
 * This file provides the same API as the original runtime.js
 * while using the modular implementation internally
 */

// The modular implementation is in runtime.modular.js
// This file provides backwards compatibility

// Expose modules globally for testing and debugging
window.Blitz3DCore = require('./modules/core');
window.Blitz3DGraphics = require('./modules/graphics');
window.Blitz3DPhysics = require('./modules/physics');
window.Blitz3DInput = require('./modules/input');

// The main runtime is loaded from the modular version
// but we need to make sure it's available
const Blitz3D = require('./modules/runtime');

// Re-export for compatibility
window.Blitz3D = Blitz3D;

console.log("Blitz3D Runtime (Modular) loaded successfully");
console.log("Available modules: core, graphics, physics, input");

// Debug helper
window.debugBlitz3D = function() {
    return {
        core: Blitz3D.core ? 'initialized' : 'not initialized',
        graphics: Blitz3D.graphics ? 'initialized' : 'not initialized',
        physics: Blitz3D.physics ? 'initialized' : 'not initialized',
        input: Blitz3D.input ? 'initialized' : 'not initialized',
        instance: Blitz3D.core?.instance ? 'loaded' : 'not loaded',
        memory: Blitz3D.core?.memory ? 'available' : 'not available'
    };
};