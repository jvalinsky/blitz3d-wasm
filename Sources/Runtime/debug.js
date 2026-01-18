/**
 * Debug Overlay
 * 
 * Shows FPS, entity count, draw calls, memory usage.
 */

const DebugOverlay = {
    enabled: true,
    element: null,
    stats: {
        fps: 0,
        frameTime: 0,
        entityCount: 0,
        drawCalls: 0,
        memoryUsed: 0,
        particleCount: 0
    },
    
    init() {
        if (!this.enabled) return;
        
        this.element = document.createElement('div');
        this.element.id = 'debug-overlay';
        this.element.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #0f0;
            font: 12px monospace;
            padding: 10px;
            pointer-events: none;
            z-index: 9999;
            min-width: 150px;
        `;
        document.body.appendChild(this.element);
        
        this.lastFrameTime = performance.now();
        this.frameCount = 0;
        
        console.log('Debug overlay initialized');
    },
    
    update() {
        if (!this.enabled || !this.element) return;
        
        const now = performance.now();
        this.frameCount++;
        
        if (now - this.lastFrameTime >= 1000) {
            this.stats.fps = this.frameCount;
            this.stats.frameTime = (1000 / this.frameCount).toFixed(1);
            this.frameCount = 0;
            this.lastFrameTime = now;
            
            this._updateDisplay();
        }
    },
    
    setStat(key, value) {
        this.stats[key] = value;
    },
    
    incrementStat(key) {
        this.stats[key]++;
    },
    
    resetStats() {
        this.stats.entityCount = 0;
        this.stats.drawCalls = 0;
        this.stats.particleCount = 0;
    },
    
    toggle() {
        this.enabled = !this.enabled;
        if (this.element) {
            this.element.style.display = this.enabled ? 'block' : 'none';
        }
    },
    
    _updateDisplay() {
        if (!this.element) return;
        
        this.element.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 5px;">DEBUG</div>
            FPS: ${this.stats.fps} (${this.stats.frameTime}ms)<br>
            Entities: ${this.stats.entityCount}<br>
            Draw Calls: ${this.stats.drawCalls}<br>
            Particles: ${this.stats.particleCount}<br>
            Memory: ${(this.stats.memoryUsed / 1024 / 1024).toFixed(1)} MB
        `;
    }
};

window.DebugOverlay = DebugOverlay;
