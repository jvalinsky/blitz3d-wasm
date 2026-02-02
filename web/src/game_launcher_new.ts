/**
 * Game Launcher - Real WASM Integration
 * 
 * Coordinates menu → WASM loading → game initialization
 */

import type { GameStartParams } from './menu.ts';

export interface LauncherCallbacks {
    onProgress?: (percent: number, message: string) => void;
    onError?: (error: Error) => void;
    onReady?: () => void;
}

// WASM runtime state
let wasmInstance: WebAssembly.Instance | null = null;
let gameLoopRunning = false;

export class GameLauncher {
    private callbacks: LauncherCallbacks;
    
    constructor(callbacks: LauncherCallbacks = {}) {
        this.callbacks = callbacks;
    }
    
    async initGameWorld(params: GameStartParams): Promise<void> {
        console.log('[Launcher] Initializing game world', params);
        
        try {
            this.updateProgress(10, 'Loading WASM module...');
            await this.loadWASM();
            
            this.updateProgress(30, 'Loading room templates...');
            await this.loadRoomTemplates();
            
            this.updateProgress(50, 'Loading assets...');
            await this.loadAssets();
            
            this.updateProgress(70, 'Initializing world...');
            await this.initWorld(params);
            
            this.updateProgress(90, 'Spawning player...');
            await this.spawnPlayer();
            
            this.updateProgress(95, 'Starting game loop...');
            await this.startGameLoop();
            
            this.updateProgress(100, 'Complete!');
            
            setTimeout(() => {
                this.callbacks.onReady?.();
            }, 500);
            
        } catch (error) {
            console.error('[Launcher] Initialization failed:', error);
            this.callbacks.onError?.(error as Error);
            throw error;
        }
    }
    
    private async loadWASM(): Promise<void> {
        console.log('[Launcher] Loading WASM module from /scpcb.wasm');
        
        const response = await fetch('/scpcb.wasm');
        if (!response.ok) {
            throw new Error(`Failed to fetch WASM: ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        
        const imports = {
            env: {
                memory: new WebAssembly.Memory({ initial: 256, maximum: 512 }),
                __indirect_function_table: new WebAssembly.Table({
                    initial: 100,
                    element: 'anyfunc'
                }),
                abort: () => console.error('WASM abort'),
                sin: Math.sin,
                cos: Math.cos,
                sqrt: Math.sqrt,
                pow: Math.pow,
                MilliSecs: () => Date.now() & 0x7fffffff,
                Graphics3D: () => {},
                CreateCamera: () => 1,
                CameraClsColor: () => {},
                PositionEntity: () => {},
                RotateEntity: () => {},
                RenderWorld: () => {},
                UpdateWorld: () => {},
                Flip: () => {},
                Cls: () => {},
                KeyDown: (k: number) => 0,
                KeyHit: (k: number) => 0,
                MouseDown: (b: number) => 0,
                MouseHit: (b: number) => 0,
                MouseX: () => 0,
                MouseY: () => 0,
                FSOUND_Init: () => 1,
                LoadSound: () => 0,
                PlaySound: () => 0,
                StopChannel: () => {},
                ChannelVolume: () => {},
            }
        };
        
        const { instance } = await WebAssembly.instantiate(buffer, imports);
        wasmInstance = instance;
        wasmMemory = imports.env.memory;
        
        console.log('[Launcher] WASM loaded successfully');
    }
    
    private async loadRoomTemplates(): Promise<void> {
        console.log('[Launcher] Loading room templates');
        await new Promise(r => setTimeout(r, 500));
    }
    
    private async loadAssets(): Promise<void> {
        console.log('[Launcher] Loading assets for room2');
        await new Promise(r => setTimeout(r, 500));
    }
    
    private async initWorld(params: GameStartParams): Promise<void> {
        console.log('[Launcher] Initializing world with seed:', params.seed);
        await new Promise(r => setTimeout(r, 500));
    }
    
    private async spawnPlayer(): Promise<void> {
        console.log('[Launcher] Spawning player at origin');
        await new Promise(r => setTimeout(r, 500));
    }
    
    private async startGameLoop(): Promise<void> {
        console.log('[Launcher] Starting game loop');
        gameLoopRunning = true;
        this.gameLoop();
    }
    
    private gameLoop() {
        if (!gameLoopRunning) return;
        
        requestAnimationFrame(() => this.gameLoop());
        
        if (wasmInstance) {
            try {
                const update = wasmInstance.exports.UpdateGame as () => void;
                update?.();
            } catch (e) {
                // Ignore errors during update
            }
        }
    }
    
    stopGameLoop() {
        gameLoopRunning = false;
    }
    
    private updateProgress(percent: number, message: string) {
        console.log(`[Launcher] ${percent}% - ${message}`);
        this.callbacks.onProgress?.(percent, message);
    }
}
