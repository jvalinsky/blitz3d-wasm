/**
 * Shared TypeScript types for the Blitz3D web runtime graphics subsystem.
 *
 * These are intentionally "contract"-style interfaces: they model the shape
 * that other runtime modules depend on, while allowing the underlying
 * implementation to evolve.
 */

// Three.js import kept for legacy code path compatibility.
// New native code path (SceneManager) does not use Three.js.
import * as THREE from "three";
import type { Blitz3DFileIO } from "../fileio.ts";

/** Engine entity type IDs matching Swift EntityType enum */
export const ENGINE_ENTITY_TYPE = { PIVOT: 0, MESH: 1, CAMERA: 2, LIGHT: 3, SPRITE: 4, TERRAIN: 5 } as const;

/**
 * Minimal interface for the animation subsystem as used by the JS runtime.
 *
 * The concrete implementation is `Blitz3DAnimation` (SMPK-backed).
 */
export interface AnimationSystem {
    loadAnimMesh: (path: string, parentId: number, targetId?: number) => Promise<number>;
    animate?: (entityId: number, mode: number, speed: number, seq: number, trans: number) => void;
}

/**
 * Minimal interface for the audio subsystem as used by core imports.
 */
export interface AudioSystem {
    nextSoundId: number;
    loadSound: (path: string, flags: number) => void;
    playSound3D: (soundId: number, x: number, y: number, z: number) => number;
}

/**
 * Minimal interface for the engine-backed scene manager used by the thin client path.
 */
export interface WasmEntityManager {
    createEntity: (type: number, parent: number) => number;
}

export interface GraphicsCore {
    canvas?: HTMLCanvasElement;
    ctx2d?: CanvasRenderingContext2D;
    memory?: WebAssembly.Memory;
    readString(ptr: number): string;
    allocString: ((str: string) => number) | null;
    /**
     * Optional File I/O service used by JS-side loaders and the interpreter VFS.
     *
     * In the SCPCB loader, this is wired during runtime initialization.
     */
    fileIO?: Blitz3DFileIO;
    entityTable?: unknown;
    banks?: Map<number, DataView>;
    textCanvas?: HTMLCanvasElement | null;
    /**
     * Environment helpers installed by the runtime (e.g. DebugLog).
     *
     * This is not the WASM import object; it's a convenience bag for JS-side systems.
     */
    env: Record<string, unknown>;
    cmdBufPtr?: number;
    cmdBufBytes?: number;
    [key: string]: unknown;
}

export interface Blitz3DImage {
    type: "image";
    element: HTMLImageElement;
    width: number;
    height: number;
    handleX: number;
    handleY: number;
    scaleX: number;
    scaleY: number;
    rotation: number;
    flags: number;
    loaded: boolean;
    loading: Promise<void>;
}

export interface Blitz3DTexture {
    type: "texture";
    texture: THREE.Texture;
    width: number;
    height: number;
    flags: number;
}

export interface Blitz3DBrush {
    color: [number, number, number, number];
    alpha: number;
    shininess: number;
    blendMode: number;
    fxMode: number;
    texture?: Blitz3DTexture;
}

export interface Blitz3DEntity extends THREE.Object3D {
    typeId?: number;
    // parent is already in Object3D
    // children is already in Object3D
    animations?: unknown;
    animPlaying?: boolean;
    animMode?: number;
    animSpeed?: number;
    animSeq?: number;
    animTime?: number;
    animLength?: number;
    // visible is in Object3D
    collisionType?: number;
    collisionRadius?: number;
    collisionCenter?: THREE.Vector3;
    [key: string]: unknown; // Allow runtime-attached props
}

export interface AAFontData {
    font: unknown;
    size: number;
}

export interface PickResult {
    entity: number;
    x: number;
    y: number;
    z: number;
    nx: number;
    ny: number;
    nz: number;
    surface: number;
    triangle: number;
}

export interface InputHandlers {
    keydown: (e: KeyboardEvent) => void;
    keyup: (e: KeyboardEvent) => void;
    mousemove: (e: MouseEvent) => void;
    mousedown?: (e: MouseEvent) => void;
    mouseup?: (e: MouseEvent) => void;
}

export interface Blitz3DGraphicsInterface {
    core: GraphicsCore;
    renderer: THREE.WebGLRenderer | null;
    scene: THREE.Scene | null;
    camera: THREE.Camera | null;
    animationSystem: AnimationSystem | null;
    audioSystem: AudioSystem | null;
    wasmManager: WasmEntityManager | null;
    inputManager: unknown | null;

    entities: Record<number, THREE.Object3D>;
    textures: Record<number, Blitz3DTexture>;
    images: Record<number, Blitz3DImage>;
    brushes: Record<number, Blitz3DBrush>;
    surfaces: Record<number, unknown>;

    nextImageId: number;
    nextTextureId: number;
    nextEntityId: number;

    lastTime: number;
    lastPick: PickResult | null;

    enablePointerLock?: boolean;

    engineCreate(gameId: number, type: number, parentGameId?: number): number;
    eid(gameId: number): number;
    engineCall(gameId: number, fn: (engineId: number) => void): void;
    [key: string]: unknown;
}
