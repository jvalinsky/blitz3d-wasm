/**
 * Game Launcher
 * 
 * Coordinates menu → WASM loading → game initialization
 */

import type { GameStartParams } from './menu.ts';

export interface LauncherCallbacks {
    onProgress?: (percent: number, message: string) => void;
    onError?: (error: Error) => void;
    onReady?: () => void;
}

export class GameLauncher {
    private callbacks: LauncherCallbacks;
    
    constructor(callbacks: LauncherCallbacks = {}) {
        this.callbacks = callbacks;
    }
    
    /**
     * Initialize game world with parameters from menu
     */
    async initGameWorld(params: GameStartParams): Promise<void> {
        console.log('[Launcher] Initializing game world', params);
        
        try {
            // Step 1: Load WASM module
            this.updateProgress(10, 'Loading WASM module...');
            await this.loadWASM();
            
            // Step 2: Load room templates
            this.updateProgress(30, 'Loading room templates...');
            await this.loadRoomTemplates();
            
            // Step 3: Load assets for starting room
            this.updateProgress(50, 'Loading assets...');
            await this.loadAssets();
            
            // Step 4: Initialize world with seed
            this.updateProgress(70, 'Initializing world...');
            await this.initWorld(params);
            
            // Step 5: Spawn player
            this.updateProgress(90, 'Spawning player...');
            await this.spawnPlayer();
            
            // Step 6: Complete
            this.updateProgress(100, 'Complete!');
            
            // Notify ready
            setTimeout(() => {
                if (this.callbacks.onReady) {
                    this.callbacks.onReady();
                }
            }, 500);
            
        } catch (error) {
            console.error('[Launcher] Initialization failed:', error);
            if (this.callbacks.onError) {
                this.callbacks.onError(error as Error);
            }
            throw error;
        }
    }
    
    private async loadWASM(): Promise<void> {
        console.log('[Launcher] Loading WASM module from /scpcb.wasm');
        
        // TODO: Import and call main.ts init() function
        // For now, simulate loading
        await this.delay(500);
        
        // This would be:
        // import { init } from './main.ts';
        // await init();
    }
    
    private async loadRoomTemplates(): Promise<void> {
        console.log('[Launcher] Loading room templates');
        await this.delay(500);
        
        // This would call WASM exports like:
        // await wasmExports.LoadRoomTemplates();
    }
    
    private async loadAssets(): Promise<void> {
        console.log('[Launcher] Loading assets for starting room');
        await this.delay(500);
        
        // This would load room2 or testroom assets:
        // await wasmExports.LoadRoom('room2');
    }
    
    private async initWorld(params: GameStartParams): Promise<void> {
        console.log('[Launcher] Initializing world with seed:', params.seed);
        await this.delay(500);
        
        // This would call WASM to set seed and difficulty:
        // wasmExports.SetRandomSeed(params.seed);
        // wasmExports.SetDifficulty(params.difficulty);
        // wasmExports.InitWorld();
    }
    
    private async spawnPlayer(): Promise<void> {
        console.log('[Launcher] Spawning player at origin');
        await this.delay(500);
        
        // This would spawn the player entity:
        // wasmExports.SpawnPlayer(0, 0, 0);
    }
    
    private updateProgress(percent: number, message: string) {
        console.log(`[Launcher] ${percent}% - ${message}`);
        if (this.callbacks.onProgress) {
            this.callbacks.onProgress(percent, message);
        }
    }
    
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
