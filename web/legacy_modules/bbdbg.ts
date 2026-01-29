/**
 * Blitz3D Runtime - Debug Module
 * Handles live debugging interactions via bbdbg imports
 */

class Blitz3DDebug {
    constructor(core) {
        this.core = core;
        this.enabled = false;
        this.metadata = null;

        // Runtime state
        this.callStack = [];
        this.currentFileId = 0;
        this.currentLine = 0;

        // Configuration
        this.logStatements = false;
        this.logCalls = false;

        // ID lookup cache
        this.fileMap = new Map();
        this.funcMap = new Map();
    }

    async loadMetadata(wasmUrl) {
        const jsonUrl = wasmUrl.replace(/\.wasm$/, '.bbdbg.json');
        try {
            const resp = await fetch(jsonUrl);
            if (!resp.ok) return; // fast fail if no debug info

            this.metadata = await resp.json();
            this.enabled = true;

            // Build lookups
            if (this.metadata.files) {
                this.metadata.files.forEach(f => this.fileMap.set(f.id, f.path));
            }
            if (this.metadata.functions) {
                this.metadata.functions.forEach(f => this.funcMap.set(f.id, f));
            }

            console.log(`[Blitz3DDebug] Loaded metadata for ${this.metadata.functions.length} functions`);
        } catch (e) {
            console.warn("[Blitz3DDebug] Metadata load skipped/failed:", e.message);
        }
    }

    setupImports(imports) {
        imports.bbdbg = {
            __bbdbg_enter: (funcId) => {
                if (!this.enabled) return;

                const func = this.funcMap.get(funcId);
                const name = func ? func.name : `func_${funcId}`;

                this.callStack.push({ funcId, name, startTime: performance.now() });

                if (this.logCalls) {
                    console.log(`-> ENTER ${name}`);
                }
            },

            __bbdbg_leave: (funcId) => {
                if (!this.enabled) return;

                const frame = this.callStack.pop();
                if (this.logCalls && frame) {
                    const dt = (performance.now() - frame.startTime).toFixed(3);
                    console.log(`<- LEAVE ${frame.name} (${dt}ms)`);
                }
            },

            __bbdbg_stmt: (fileId, line) => {
                if (!this.enabled) return;

                this.currentFileId = fileId;
                this.currentLine = line;

                if (this.logStatements) {
                    const file = this.fileMap.get(fileId) || `file_${fileId}`;
                    console.log(`STMT ${file}:${line}`);
                }
            }
        };
    }

    // API for external tools
    getStackTrace() {
        return this.callStack.map(frame => {
            return `${frame.name}`;
        }).reverse();
    }

    getCurrentLocation() {
        if (!this.enabled) return null;
        return {
            file: this.fileMap.get(this.currentFileId) || 'unknown',
            line: this.currentLine
        };
    }
}

// Export
if (typeof window !== 'undefined') {
    window.Blitz3DDebug = Blitz3DDebug;
}
if (typeof module !== 'undefined') {
    module.exports = Blitz3DDebug;
}
