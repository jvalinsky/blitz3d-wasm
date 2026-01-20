/**
 * Browser Compatibility Shim
 * Makes Node.js-style modules work in the browser
 * DOES NOT declare any Blitz3D objects - only provides module/require infrastructure
 */

// Mock module.exports for browser
// Each module will reset this, which is fine - we only care about window globals
if (typeof module === 'undefined') {
    window.module = {};
}
if (typeof module.exports === 'undefined') {
    module.exports = {};
}

// Mock require for browser (returns window globals)
if (typeof require === 'undefined') {
    window.require = function(path) {
        // Extract module name from path
        const moduleName = path.replace(/^\.\//, '').replace(/\.js$/, '');
        
        // Map module names to window globals (these are set by the actual module files)
        const moduleMap = {
            'core': window.Blitz3DCore,
            'animation': window.Blitz3DAnimationModule || { Blitz3DAnimation: window.Blitz3DAnimation },
            'b3d': window.B3DLoader,
            'graphics': window.Blitz3DGraphics,
            'mesh': { Blitz3DSurface: window.Blitz3DSurface, Blitz3DWasmSurface: window.Blitz3DWasmSurface },
            'physics': window.Blitz3DPhysics,
            'input': window.Blitz3DInput,
            'audio': window.Blitz3DAudio,
            'vfs_zip': window.VirtualFileSystem,
            'runtime': window.Blitz3D
        };
        
        const module = moduleMap[moduleName];
        if (!module) {
            console.warn(`Module '${moduleName}' not found in window globals`);
        }
        return module || {};
    };
}

console.log('Browser compatibility shim loaded');
