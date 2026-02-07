/**
 * Shared TypeScript types for the Blitz3D web runtime graphics subsystem.
 *
 * These are intentionally "contract"-style interfaces: they model the shape
 * that other runtime modules depend on, while allowing the underlying
 * implementation to evolve.
 */
/// <reference lib="dom" />

// Three.js import kept for legacy code path compatibility.
// New native code path (SceneManager) does not use Three.js.
import * as THREE from "three";
import type { Blitz3DFileIO } from "../fileio.ts";
import type { EntityTableView } from "../../shared/entity_table.ts";
import type { EngineBridge, EngineExports } from "../../engine/bridge.ts";
import type { SMPKLoader } from "../smpk.ts";

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
    /**
     * SCPCB/Blitz3D uses SetAnimTime/AnimTime in *frame units*.
     *
     * Concrete implementation (`web/src/runtime/animation.ts`) is responsible for
     * mapping frames <-> seconds using the model's fps metadata.
     */
    setAnimTime?: (entityId: number, timeFrames: number, seq: number) => void;
    getAnimTime?: (entityId: number) => number; // frames
    getAnimLength?: (entityId: number) => number; // frames
    update?: (deltaSeconds: number) => void;
}

/**
 * Minimal interface for the audio subsystem as used by core imports.
 */
export interface AudioSystem {
    nextSoundId: number;
    ensureContext?: () => boolean;
    loadSound: (path: string, flags: number) => number;
    openStream?: (path: string, mode: number) => number;
    playStream?: (streamId: number, vol?: number, pan?: number, rate?: number, loop?: boolean) => number;
    stopStream?: (streamId: number) => void;
    closeStream?: (streamId: number) => void;
    resume?: () => void;
    dispose?: () => void;
    freeSound?: (soundId: number) => void;
    loopSound?: (soundId: number, loop: boolean) => void;
    setSoundVolume?: (soundId: number, volume: number) => void;
    setSoundPan?: (soundId: number, pan: number) => void;
    setSoundPitch?: (soundId: number, pitch: number) => void;
    setSoundPosition?: (soundId: number, x: number, y: number, z: number) => void;
    playSound?: (soundId: number, vol?: number, pan?: number, rate?: number, loop?: boolean) => number;
    stopChannel?: (chanId: number) => void;
    pauseChannel?: (chanId: number) => void;
    resumeChannel?: (chanId: number) => void;
    setChannelPitch?: (chanId: number, pitch: number) => void;
    setChannelVolume?: (chanId: number, vol: number) => void;
    setChannelPan?: (chanId: number, pan: number) => void;
    isChannelPlaying?: (chanId: number) => boolean;
    updateListener?: (camera: unknown) => void;
    playSound3D: (soundId: number, x: number, y: number, z: number) => number;
}

/**
 * Minimal interface for the engine-backed scene manager used by the thin client path.
 */
export interface WasmEntityManager {
    createEntity: (type: number, parent: number) => number;
    bridge: EngineBridge;
    updateWorld?: (step: number) => void;
    setPickMode?: (id: number, mode: number) => void;
    cameraPick?: (camId: number, x: number, y: number) => any;
    linePick?: (x: number, y: number, z: number, dx: number, dy: number, dz: number) => any;
}

export interface InputManagerLike {
    installInputListeners: () => void;
    keysDown: Record<number, boolean>;
    keysHit: Record<number, number>;
    keyQueue: number[];
    mouseDown: Record<number, boolean>;
    mouseHit: Record<number, number>;
    mouseX: number;
    mouseY: number;
    mouseZ: number;
    mouseXSpeed: number;
    mouseYSpeed: number;
    mouseZSpeed: number;
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
    entityTable?: EntityTableView;
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
    blend?: number;
    coords?: number;
}

export interface Blitz3DBrush {
    color: [number, number, number, number];
    alpha: number;
    shininess: number;
    blendMode: number;
    fxMode: number;
    textures: (Blitz3DTexture | undefined)[];
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
    inputManager: InputManagerLike | null;
    particles?: any; // BlitzParticles

    entities: Record<number, THREE.Object3D>;
    textures: Record<number, Blitz3DTexture>;
    images: Record<number, Blitz3DImage>;
    brushes: Record<number, Blitz3DBrush>;
    surfaces: Record<number, any>;

    nextImageId: number;
    nextTextureId: number;
    nextEntityId: number;

    lastTime: number;
    lastPick: PickResult | null;

    enablePointerLock?: boolean;

    // 2D render state used by setup/2d.ts
    clearColor: [number, number, number, number];
    currentColor: [number, number, number, number];
    currentBuffer: number;
    currentFont: string;
    currentFontSize: number;

    // Animation mixer registry used by some loaders (B3D/SMPK).
    animMixers?: Set<THREE.AnimationMixer>;

    // Engine exports bag used by some import shims.
    _engine?: EngineExports | null;
    _engineIds: Map<number, number>;
    smpkLoader?: SMPKLoader | null;

    init3D: () => void;
    disposeObject3D: (root: any) => void;
    ensureUniqueMaterial: (child: any) => void;

    engineCreate(gameId: number, type: number, parentGameId?: number): number;
    eid(gameId: number): number;
    engineCall(gameId: number, fn: (engineId: number) => void): void;
    [key: string]: unknown;
}
