import * as THREE from "three";

/** Engine entity type IDs matching Swift EntityType enum */
export const ENGINE_ENTITY_TYPE = { PIVOT: 0, MESH: 1, CAMERA: 2, LIGHT: 3, SPRITE: 4, TERRAIN: 5 } as const;

export interface GraphicsCore {
    canvas?: HTMLCanvasElement;
    ctx2d?: CanvasRenderingContext2D;
    memory?: WebAssembly.Memory;
    readString(ptr: number): string;
    allocString: ((str: string) => number) | null;
    entityTable?: any;
    banks?: Map<number, DataView>;
    textCanvas?: HTMLCanvasElement | null;
    env: any; // Add env for DebugLog etc.
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
    animations: any;
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
    [key: string]: any; // Allow arbitrary props like userData
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
    animationSystem: any;
    audioSystem: any;
    wasmManager: any;
    inputManager: any;

    entities: Record<number, any>;
    textures: Record<number, any>;
    images: Record<number, any>;
    brushes: Record<number, any>;
    surfaces: Record<number, any>;

    nextImageId: number;
    nextTextureId: number;
    nextEntityId: number;

    lastTime: number;
    lastPick: PickResult | null;

    enablePointerLock?: boolean;

    engineCreate(gameId: number, type: number, parentGameId?: number): number;
    eid(gameId: number): number;
    engineCall(gameId: number, fn: (engineId: number) => void): void;
    [key: string]: any;
}
