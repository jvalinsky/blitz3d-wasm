/// <reference lib="dom" />
/**
 * Blitz3D Runtime Graphics Module
 * WebGL/Three.js integration for 3D rendering
 */
import * as THREE from "three";
import { Blitz3DMesh, Blitz3DSurface } from "../mesh.ts";
import { decodeSmpk, SMPKLoader } from "../smpk.ts";
import { Blitz3DAnimation } from "../animation.ts";
import { XLoader } from "../xloader.ts";
import { Blitz3DAudio } from "../audio.ts";
import { drainCmds } from "../../shared/command_buffer.ts";
import { dispatchCmd, type CommandExecutor } from "../command_executor.ts";
import { EngineExports, EngineBridge } from "../../engine/bridge.ts";
import { WasmSceneManager } from "../../engine/wasm_scene_manager.ts"; // IMPORT ADDED (legacy)
import { SceneManager } from "../../engine/scene_manager.ts";

import {
    GraphicsCore,
    Blitz3DImage,
    Blitz3DTexture,
    Blitz3DBrush,
    Blitz3DEntity,
    PickResult,
    AAFontData,
    ENGINE_ENTITY_TYPE,
    Blitz3DGraphicsInterface,
    AnimationSystem,
} from "./types.ts";

import { InputManager } from "./input.ts";
import { setupAllImports } from "./setup/index.ts";

/**
 * Blitz3D graphics runtime for the web.
 *
 * This class is responsible for:
 * - Installing WASM imports for graphics (`setupImports()`)
 * - Managing a Three.js scene (legacy path) or an engine-backed manager (thin client)
 * - Keeping runtime entity IDs stable and mapping them to render objects
 *
 * The SCPCB loader and the interpreter both use this class.
 */
export class Blitz3DGraphics implements Blitz3DGraphicsInterface {
    [key: string]: unknown;
    core: GraphicsCore;
    // ... items ...

    // Physics / Picking
    collisions: { srcType: number, destType: number, method: number, response: number }[] = [];
    lastPick: PickResult | null = null;

    // ID Counters
    nextImageId: number = 1;
    nextTextureId: number = 1;
    nextEntityId: number = 1;

    // Thin Client Manager (legacy Three.js path)
    wasmManager: WasmSceneManager | null = null;
    // New native WebGL2 scene manager (Three.js-free)
    nativeManager: SceneManager | null = null;
    inputManager: InputManager | null = null;

    // Three.js
    renderer: THREE.WebGLRenderer | null = null;
    scene: THREE.Scene | null = null;
    camera: THREE.Camera | null = null;

    // Animation
    animationSystem: AnimationSystem | null = null;
    animMixers: Set<THREE.AnimationMixer> = new Set();
    smpkLoader: SMPKLoader | null = null;

    // State
    _stopped: boolean = false;
    _rafHandle: number | null = null;
    lastTime: number = 0;
    frameCount: number = 0;
    clearColor: [number, number, number, number] = [0, 0, 0, 1];
    currentColor: [number, number, number, number] = [255, 255, 255, 255];
    currentBuffer: number = 0;
    currentFont: string = "sans-serif";
    currentFontSize: number = 16;

    // Resources
    entities: Record<number, THREE.Object3D> = {};
    textures: Record<number, Blitz3DTexture> = {};
    images: Record<number, Blitz3DImage> = {};
    surfaces: Record<number, any> = {};
    brushes: Record<number, Blitz3DBrush> = {};

    // Audio
    audioSystem: Blitz3DAudio | null = null;

    // Engine
    _engine: EngineExports | null = null;
    _engineIds: Map<number, number> = new Map();
    _cmdTextDecoder: TextDecoder = new TextDecoder("latin1");

    // Imports
    Blitz3DAnimation = Blitz3DAnimation;

    constructor(core: GraphicsCore) {
        // ... existing constructor ...
        this.core = core;
        this.clearColor = [0, 0, 0, 1];
        this.currentColor = [255, 255, 255, 255];
        this.currentBuffer = 0;
        this.currentFont = "sans-serif";
        this.currentFontSize = 16;
        this.animationSystem = new this.Blitz3DAnimation(this as any, core) as unknown as AnimationSystem;
        // Ensure input is available for KeyDown/MouseX/etc (interpreter path).
        this.inputManager = new InputManager(this as any);
        // ...
        // Engine dual storage
        this._engine = null;
        this._engineIds = new Map();
        this._cmdTextDecoder = new TextDecoder("latin1");
    }

    /**
     * Set the Swift engine WASM exports.
     * Initializes WasmSceneManager for Thin Client mode.
     */
    setEngine(exports: EngineExports, shaderSources?: any): void {
        this._engine = exports;

        // Initialize scene manager
        if (this.core.canvas) {
            const bridge = new EngineBridge(exports);

            if (shaderSources) {
                // New native WebGL2 path (Three.js-free)
                this.nativeManager = new SceneManager(bridge, this.core.canvas, shaderSources);
                this.wasmManager = null;
            } else {
                // Legacy Three.js path (fallback)
                this.wasmManager = new WasmSceneManager(bridge, this.core.canvas);
            }
        }
    }

    // ------------------------------------------------------------------
    // Engine Integration
    // ------------------------------------------------------------------

    /** Create an engine entity and track the mapping. Returns engine ID (0 if engine not loaded). */
    engineCreate(gameId: number, type: number, parentGameId?: number): number {
        const manager = this.nativeManager ?? this.wasmManager;
        if (!manager) return 0;
        const parentEngineId = parentGameId ? (this._engineIds.get(parentGameId) ?? 0) : 0;
        const engineId = manager.createEntity(type, parentEngineId);
        this._engineIds.set(gameId, engineId);
        return engineId;
    }

    /** Get the engine entity ID for a game entity ID. */
    eid(gameId: number): number {
        return this._engineIds.get(gameId) ?? 0;
    }

    /** Call an engine function if the engine is loaded and the entity exists in it. */
    engineCall(gameId: number, fn: (engineId: number) => void): void {
        if (!this._engine) return;
        const eid = this._engineIds.get(gameId);
        if (eid) fn(eid);
    }

    setupImports(imports: any) {
        if (!imports.env) imports.env = {};
        if (!imports.blitz3d) imports.blitz3d = {};

        // Delegate to setup modules
        setupAllImports(this, imports);

        // Command Buffer Drain Helper
        imports.env.DrainCommandBuffer = () => this.drainCommandBuffer();
    }

    init3D() {
        console.log("init3D called");

        // Assert core is available
        if (!this.core) {
            console.error("init3D: core is not available");
            return;
        }

        // Assert canvas is available
        if (!this.core.canvas) {
            console.error("init3D: canvas is not available");
            return;
        }

        // Validate canvas dimensions
        const canvasWidth = this.core.canvas.width;
        const canvasHeight = this.core.canvas.height;
        console.log(
            "Canvas dimensions from core: " + canvasWidth + "x" + canvasHeight,
        );

        if (!canvasWidth || canvasWidth <= 0) {
            console.error(
                "init3D: Invalid canvas width: " + canvasWidth + ", defaulting to 800",
            );
            this.core.canvas.width = 800;
        }
        if (!canvasHeight || canvasHeight <= 0) {
            console.error(
                "init3D: Invalid canvas height: " + canvasHeight +
                ", defaulting to 600",
            );
            this.core.canvas.height = 600;
        }

        // Check Three.js availability
        if (!THREE) {
            console.error("Three.js not loaded! Cannot initialize 3D graphics.");
            return;
        }

        console.log("Three.js version: " + THREE.REVISION);

        this.scene = new THREE.Scene();
        console.log("THREE.Scene created");

        const createMockRenderer = () => {
            // Minimal mock renderer for environments without WebGL (e.g. Deno headless tooling).
            this.renderer = {
                setSize: (w: number, h: number) => {
                    if (this.core && this.core.canvas) {
                        this.core.canvas.width = w;
                        this.core.canvas.height = h;
                    }
                },
                render: (_scene: any, _camera: any) => { },
                setClearColor: (_color: any, _alpha: any) => { },
                clear: () => { },
                setPixelRatio: () => { },
                capabilities: { getMaxAnisotropy: () => 1 },
                domElement: this.core.canvas,
            } as any;
        };

        const isHeadless = (globalThis as any).__BLITZ3D_HEADLESS === true;
        const noAutoRaf = (globalThis as any).__BLITZ3D_NO_AUTO_RAF === true;
        const hasWebGL = (() => {
            // IMPORTANT: never probe WebGL support by calling getContext() on the
            // actual render canvas, because that would permanently claim a context
            // (e.g. "webgl") and Three may later request a different type
            // (e.g. "webgl2"), causing "Canvas has an existing context of a different type".
            try {
                if (isHeadless) return false;
                if (typeof document === "undefined") return false;
                const probe = document.createElement("canvas");
                return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
            } catch {
                return false;
            }
        })();

        // Create WebGL renderer with validation
        console.log("Creating WebGLRenderer...");
        if (isHeadless || !hasWebGL) {
            createMockRenderer();
        } else {
            try {
                this.renderer = new THREE.WebGLRenderer({
                    canvas: this.core.canvas as HTMLCanvasElement,
                    antialias: false,
                    alpha: false,
                    powerPreference: "high-performance",
                });
                console.log("WebGLRenderer created successfully");

                // Verify renderer was created properly
                if (!this.renderer) {
                    throw new Error("Renderer is null after construction");
                }

                // Verify renderer has required methods
                if (typeof this.renderer.setSize !== "function") {
                    throw new Error("Renderer missing setSize method");
                }
                if (typeof this.renderer.render !== "function") {
                    throw new Error("Renderer missing render method");
                }

                if (!this.core.canvas) return;
                this.renderer.setSize(this.core.canvas.width, this.core.canvas.height);
                if (this.wasmManager) this.wasmManager.resize(this.core.canvas.width, this.core.canvas.height);
                if (this.core.env?.DebugLog) {
                    console.log(
                        "Renderer size set to: " + this.core.canvas.width + "x" +
                        this.core.canvas.height
                    );
                }
                this.renderer.autoClear = false;
                const gl = this.renderer.getContext?.();
                if (gl) {
                    console.log("WebGL context verified");
                    console.log("WebGL Renderer: " + gl.getParameter(gl.RENDERER));
                    console.log("WebGL Version: " + gl.getParameter(gl.VERSION));
                } else {
                    console.warn("Could not verify WebGL context");
                }
            } catch (e: any) {
                console.error("WebGL Init Failed: " + e.message);
                console.warn("Falling back to mock renderer");

                // Create mock renderer for debugging
                createMockRenderer();
            }
        }

        // Expose THREE for debugging
        (window as any).THREE = THREE;

        console.log("Animation system initialized");

        // In headless mode, skip RAF-based animation to keep tooling deterministic and avoid
        // WebGLRenderer creation entirely.
        //
        // The interpreter also disables the internal RAF loop so that stepping + Pause truly
        // freeze rendering, and `RenderWorld()` can act as the explicit draw trigger.
        if (!isHeadless && !noAutoRaf) {
            this._stopped = false;
            this.animate(0);
            console.log("Animation loop started");
        } else {
            this._stopped = true;
            this._rafHandle = null;
        }
    }

    render(time: number) {
        const delta = (time - this.lastTime) / 1000.0;
        this.lastTime = time;

        if (delta > 0 && delta < 0.1) {
            this.animMixers.forEach((mixer: any) => mixer.update(delta));
        }

        // Debug Log every ~100 frames (approx 1.6s)
        this.frameCount = (this.frameCount || 0) + 1;
        const debug = (globalThis as any).__BLITZ3D_DEBUG === true;
        if (debug && this.frameCount % 100 === 0) {
            console.log("--- Debug Frame " + this.frameCount + " ---");
            console.log("Loop Running. Camera:", this.camera ? "Exists" : "MISSING");
            if (this.camera) {
                console.log("Camera Pos:", this.camera.position);
                console.log("Camera Rot:", this.camera.rotation);
            }
            if (this.scene) {
                console.log("Scene Children:", this.scene.children.length);
            }
        }

        if (this.nativeManager) {
            this.nativeManager.render(this.inputManager);
            return;
        }

        if (this.wasmManager) {
            this.wasmManager.render(this.inputManager);
            return;
        }

        if (this.renderer && this.scene && this.camera) {
            this.updateSurfaces();
            this.renderer.render(this.scene, this.camera);
            this.audioSystem?.updateListener(this.camera);
        }
    }

    animate(time: number) {
        if (this._stopped) return;
        this._rafHandle = requestAnimationFrame((t) => this.animate(t));
        this.render(time);
    }

    // Helper used by created movie objects
    drawMovieFrame(movie: any) {
        if (
            !this.core.ctx2d || !movie.video || movie.video.paused ||
            movie.video.ended
        ) return;

        // Draw video frame to 2D canvas
        this.core.ctx2d.globalAlpha = 1.0;
        this.core.ctx2d.drawImage(
            movie.video,
            movie.x,
            movie.y,
            movie.width,
            movie.height,
        );
    }

    updateSurfaces() {
        for (const id in this.surfaces) {
            this.surfaces[id].update();
        }
    }

    ensureUniqueMaterial(child: any) {
        if (!child || !child.material || Array.isArray(child.material)) return;
        const mat = child.material as any;
        if (mat.userData?.__blitz3dUnique) return;
        const clone = mat.clone();
        clone.userData = { ...(clone.userData || {}), __blitz3dUnique: true };
        child.material = clone;
    }

    detachTextureFromMaterial(material: any, texture: any) {
        if (!material || !texture) return;
        const textureSlots = [
            "map",
            "alphaMap",
            "aoMap",
            "bumpMap",
            "displacementMap",
            "emissiveMap",
            "envMap",
            "lightMap",
            "metalnessMap",
            "roughnessMap",
            "normalMap",
            "specularMap",
        ];
        for (const slot of textureSlots) {
            if (material[slot] === texture) {
                material[slot] = null;
                material.needsUpdate = true;
            }
        }
    }

    detachTextureFromScene(texture: any) {
        if (!this.scene || !texture) return;
        this.scene.traverse((obj: any) => {
            if (!obj.material) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m: any) => this.detachTextureFromMaterial(m, texture));
        });
    }

    disposeObject3D(root: any) {
        if (!root) return;
        root.traverse?.((obj: any) => {
            const mixer = obj.userData?.mixer;
            if (mixer && this.animMixers?.has?.(mixer)) {
                try {
                    mixer.stopAllAction?.();
                    mixer.uncacheRoot?.(obj);
                } catch { }
                this.animMixers.delete(mixer);
                if (obj.userData) {
                    delete obj.userData.mixer;
                    delete obj.userData.action;
                    delete obj.userData.animationClip;
                }
            }

            if (obj.geometry?.dispose) {
                try {
                    obj.geometry.dispose();
                } catch { }
            }
            if (obj.material) {
                const mats = Array.isArray(obj.material)
                    ? obj.material
                    : [obj.material];
                mats.forEach((m: any) => {
                    if (m?.dispose) {
                        try {
                            m.dispose();
                        } catch { }
                    }
                });
            }
        });
    }

    private ensureSceneForCmdBuf(): void {
        if (this.scene) return;
        try {
            this.init3D();
        } catch { }
    }

    private cmdCreateEntityWithId(entityType: number, parentGameId: number, id: number): void {
        // Avoid id collisions if some code paths still allocate entities on the JS side.
        if (id >= this.nextEntityId) this.nextEntityId = id + 1;

        // If the entity already exists, treat this as idempotent.
        if (this.entities[id]) return;

        this.ensureSceneForCmdBuf();

        const canvas = this.core?.canvas;
        const aspect = canvas && canvas.height ? (canvas.width / canvas.height) : 1.0;

        let obj: THREE.Object3D;
        switch (entityType | 0) {
            case ENGINE_ENTITY_TYPE.MESH: {
                const mesh = new THREE.Mesh();
                mesh.material = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    vertexColors: true,
                    side: THREE.DoubleSide,
                });
                obj = mesh;
                break;
            }
            case ENGINE_ENTITY_TYPE.CAMERA: {
                obj = new THREE.PerspectiveCamera(70, aspect, 0.1, 1000);
                break;
            }
            case ENGINE_ENTITY_TYPE.LIGHT: {
                // Default to a point light. Type-specific light configuration is handled by separate runtime calls.
                obj = new THREE.PointLight(0xffffff, 1, 0);
                break;
            }
            case ENGINE_ENTITY_TYPE.SPRITE: {
                obj = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
                break;
            }
            case ENGINE_ENTITY_TYPE.TERRAIN:
            case ENGINE_ENTITY_TYPE.PIVOT:
            default:
                obj = new THREE.Object3D();
                break;
        }

        this.entities[id] = obj;

        // Mirror to the engine-backed scene (if active).
        this.engineCreate(id, entityType, parentGameId || undefined);

        const parentObj = parentGameId ? this.entities[parentGameId] : null;
        if (parentObj) parentObj.add(obj);
        else if (this.scene) this.scene.add(obj);

        // If this is the first camera created, adopt it as the active camera for the legacy renderer path.
        if (!this.camera && obj instanceof THREE.Camera) {
            this.camera = obj;
        }
    }

    private cmdFreeEntity(id: number): void {
        const entity = this.entities[id];
        if (!entity) return;

        try {
            this.disposeObject3D(entity);
        } catch { }
        try {
            entity.removeFromParent();
        } catch { }

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const engineId = this._engineIds.get(id) ?? 0;
            if (manager && engineId) manager.freeEntity(engineId);
        } catch { }

        this._engineIds.delete(id);
        delete this.entities[id];
    }

    private cmdSetParent(childId: number, parentId: number, global: number): void {
        const child = this.entities[childId];
        if (!child) return;

        this.ensureSceneForCmdBuf();

        const parent = parentId ? this.entities[parentId] : this.scene;
        if (!parent) return;

        const keepGlobal = (global | 0) !== 0;
        let worldMatrix: THREE.Matrix4 | null = null;
        if (keepGlobal) {
            try {
                child.updateMatrixWorld(true);
                worldMatrix = child.matrixWorld.clone();
            } catch {
                worldMatrix = null;
            }
        }

        try {
            child.removeFromParent();
        } catch { }
        try {
            parent.add(child);
        } catch { }

        if (keepGlobal && worldMatrix) {
            try {
                parent.updateMatrixWorld(true);
                const inv = new THREE.Matrix4();
                inv.copy((parent as any).matrixWorld ?? new THREE.Matrix4()).invert();
                const local = new THREE.Matrix4().multiplyMatrices(inv, worldMatrix);
                local.decompose(child.position, child.quaternion, child.scale);
                child.updateMatrixWorld(true);
            } catch { }
        }

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const childEid = this._engineIds.get(childId) ?? 0;
            if (manager && childEid) {
                const parentEid = parentId ? (this._engineIds.get(parentId) ?? 0) : 0;
                manager.bridge.setParent(childEid, parentEid);
            }
        } catch { }
    }

    private cmdSetVisibility(id: number, visible: number): void {
        const entity = this.entities[id];
        if (!entity) return;
        entity.visible = (visible | 0) !== 0;

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const eid = this._engineIds.get(id) ?? 0;
            if (manager && eid) {
                if ((visible | 0) !== 0) manager.bridge.exports.EngineShowEntity(eid);
                else manager.bridge.exports.EngineHideEntity(eid);
            }
        } catch { }
    }

    private cmdSetPosition(id: number, x: number, y: number, z: number): void {
        const entity = this.entities[id];
        if (entity) entity.position.set(x, y, -z);

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const eid = this._engineIds.get(id) ?? 0;
            if (manager && eid) manager.bridge.setPosition(eid, x, y, z);
        } catch { }
    }

    private cmdSetRotationEuler(id: number, pitch: number, yaw: number, roll: number): void {
        const entity = this.entities[id];
        if (entity) {
            entity.rotation.set(
                pitch * Math.PI / 180,
                yaw * Math.PI / 180,
                roll * Math.PI / 180,
            );
        }

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const eid = this._engineIds.get(id) ?? 0;
            if (manager && eid) manager.bridge.setRotation(eid, pitch, yaw, roll);
        } catch { }
    }

    private cmdSetScale(id: number, x: number, y: number, z: number): void {
        const entity = this.entities[id];
        if (entity) entity.scale.set(x, y, z);

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const eid = this._engineIds.get(id) ?? 0;
            if (manager && eid) manager.bridge.setScale(eid, x, y, z);
        } catch { }
    }

    private cmdSetTransform(id: number, pos: [number, number, number], rot: [number, number, number, number], scl: [number, number, number]): void {
        const entity = this.entities[id];
        if (!entity) return;

        // Keep consistent with the legacy Blitz3D->Three coordinate convention used elsewhere in this runtime:
        // - JS Three scene uses -Z for game +Z.
        entity.position.set(pos[0], pos[1], -pos[2]);
        entity.scale.set(scl[0], scl[1], scl[2]);

        // Quaternion is currently assumed to be in the same coordinate basis as the WASM writer.
        // If we later standardize quaternion basis for Track B, adjust this mapping accordingly.
        try {
            (entity as any).quaternion?.set?.(rot[0], rot[1], rot[2], rot[3]);
        } catch { }
    }

    private forEachRenderable(ent: THREE.Object3D, fn: (obj: any) => void): void {
        if (!ent) return;
        if (typeof (ent as any).traverse === "function") {
            (ent as any).traverse((o: any) => {
                try {
                    fn(o);
                } catch { }
            });
            return;
        }
        fn(ent as any);
    }

    private forEachMaterial(obj: any, fn: (mat: any) => void): void {
        const mat = obj?.material;
        if (!mat) return;
        const mats = Array.isArray(mat) ? mat : [mat];
        for (const m of mats) {
            if (!m) continue;
            try {
                fn(m);
            } catch { }
        }
    }

    private cmdEntityColor(entityId: number, r: number, g: number, b: number): void {
        const ent = this.entities[entityId];
        if (!ent) return;
        const col = new THREE.Color((r | 0) / 255, (g | 0) / 255, (b | 0) / 255);
        this.forEachRenderable(ent, (obj) => {
            if (obj?.isMesh) this.ensureUniqueMaterial(obj);
            this.forEachMaterial(obj, (mat) => {
                if (mat?.color?.set) mat.color.set(col);
                if (typeof mat?.needsUpdate === "boolean") mat.needsUpdate = true;
            });
        });
    }

    private cmdEntityAlpha(entityId: number, a: number): void {
        const ent = this.entities[entityId];
        if (!ent) return;
        const alpha = Math.max(0, Math.min(1, Number(a)));
        this.forEachRenderable(ent, (obj) => {
            if (obj?.isMesh) this.ensureUniqueMaterial(obj);
            this.forEachMaterial(obj, (mat) => {
                if (typeof mat?.opacity === "number") mat.opacity = alpha;
                if (typeof mat?.transparent === "boolean") mat.transparent = alpha < 0.999;
                if (typeof mat?.needsUpdate === "boolean") mat.needsUpdate = true;
            });
        });
    }

    private cmdEntityFX(entityId: number, fx: number): void {
        // Best-effort: match the subset currently used elsewhere in the runtime (bit 0 => wireframe).
        const ent = this.entities[entityId];
        if (!ent) return;
        const flags = fx | 0;
        const wireframe = (flags & 1) !== 0;
        this.forEachRenderable(ent, (obj) => {
            if (obj?.isMesh) this.ensureUniqueMaterial(obj);
            this.forEachMaterial(obj, (mat) => {
                if (typeof mat?.wireframe === "boolean") mat.wireframe = wireframe;
                if (typeof mat?.needsUpdate === "boolean") mat.needsUpdate = true;
            });
        });
    }

    private cmdEntityBlend(entityId: number, blend: number): void {
        // Best-effort mapping (Blitz3D blend modes are not 1:1 with Three).
        const ent = this.entities[entityId];
        if (!ent) return;
        const mode = blend | 0;
        this.forEachRenderable(ent, (obj) => {
            if (obj?.isMesh) this.ensureUniqueMaterial(obj);
            this.forEachMaterial(obj, (mat) => {
                try {
                    if (mode === 2) mat.blending = THREE.MultiplyBlending;
                    else if (mode === 3) mat.blending = THREE.AdditiveBlending;
                    else mat.blending = THREE.NormalBlending;
                    if (typeof mat?.transparent === "boolean") {
                        // Multiply/Additive generally requires transparency enabled.
                        if (mode === 2 || mode === 3) mat.transparent = true;
                    }
                    if (typeof mat?.needsUpdate === "boolean") mat.needsUpdate = true;
                } catch { }
            });
        });
    }

    private cmdEntityTexture(entityId: number, textureId: number, _frame: number, _index: number): void {
        const ent = this.entities[entityId];
        const tex = this.textures[textureId];
        if (!ent || !tex?.texture) return;
        this.forEachRenderable(ent, (obj) => {
            if (obj?.isMesh) this.ensureUniqueMaterial(obj);
            this.forEachMaterial(obj, (mat) => {
                if (Array.isArray(mat)) return;
                (mat as any).map = tex.texture;
                if (typeof (mat as any).needsUpdate === "boolean") (mat as any).needsUpdate = true;
            });
        });
    }

    private cmdMoveEntity(id: number, x: number, y: number, z: number): void {
        const entity = this.entities[id];
        if (entity) {
            entity.translateX(x);
            entity.translateY(y);
            entity.translateZ(-z);
        }

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const eid = this._engineIds.get(id) ?? 0;
            if (manager && eid) manager.bridge.exports.EngineMoveEntity(eid, x, y, z);
        } catch { }
    }

    private cmdTurnEntity(id: number, pitch: number, yaw: number, roll: number): void {
        const entity = this.entities[id];
        if (entity) {
            entity.rotateX(pitch * Math.PI / 180);
            entity.rotateY(yaw * Math.PI / 180);
            entity.rotateZ(roll * Math.PI / 180);
        }

        // Mirror to the engine-backed scene (if active).
        try {
            const manager = this.nativeManager ?? this.wasmManager;
            const eid = this._engineIds.get(id) ?? 0;
            if (manager && eid) manager.bridge.exports.EngineTurnEntity(eid, pitch, yaw, roll);
        } catch { }
    }

    private cmdDebugLog(ptr: number, len: number): void {
        const mem = this.core?.memory;
        if (!mem) return;
        if (!ptr || !len) return;
        if (ptr + len > mem.buffer.byteLength) return;
        try {
            const bytes = new Uint8Array(mem.buffer, ptr, len);
            const msg = this._cmdTextDecoder.decode(bytes);
            console.log(`[CMDB] ${msg}`);
        } catch { }
    }

    private cmdPlaySound(soundId: number, volume: number, loop: number, outChannelPtr?: number): void {
        const audio = this.audioSystem;
        if (!audio?.playSound) return;
        const chan = audio.playSound(soundId, volume, 0, 1, (loop | 0) !== 0) | 0;
        if (outChannelPtr && this.core?.memory) {
            try {
                new DataView(this.core.memory.buffer).setInt32(outChannelPtr, chan, true);
            } catch { }
        }
    }

    drainCommandBuffer() {
        const mem: WebAssembly.Memory | null = this.core?.memory ?? null;
        const ptr: number = (this.core as any)?.cmdBufPtr ?? 0;
        const bytes: number = (this.core as any)?.cmdBufBytes ?? 0;
        if (!mem || !ptr || !bytes) return 0;

        // IMPORTANT: memory.buffer can change on grow; create a fresh DataView each drain.
        if (ptr + bytes > mem.buffer.byteLength) {
            console.warn("[CMDB] ptr/len out of bounds; skipping drain");
            return 0;
        }

        const dv = new DataView(mem.buffer, ptr, bytes);
        let drained = 0;

        const exec: CommandExecutor = {
            onCreateEntity: (entityType, parent, id) => {
                this.cmdCreateEntityWithId(entityType, parent, id);
            },
            onDestroyEntity: (id) => this.cmdFreeEntity(id),
            onFreeEntity: (id) => this.cmdFreeEntity(id),
            onSetTransform: (id, pos, rot, scl) => this.cmdSetTransform(id, pos, rot, scl),
            onSetVisibility: (id, visible) => this.cmdSetVisibility(id, visible),
            onSetPosition: (id, x, y, z) => this.cmdSetPosition(id, x, y, z),
            onSetRotationEuler: (id, pitch, yaw, roll, _global) => {
                this.cmdSetRotationEuler(id, pitch, yaw, roll);
            },
            onSetScale: (id, x, y, z) => this.cmdSetScale(id, x, y, z),
            onMoveEntity: (id, x, y, z) => this.cmdMoveEntity(id, x, y, z),
            onTurnEntity: (id, pitch, yaw, roll, _global) => {
                this.cmdTurnEntity(id, pitch, yaw, roll);
            },
            onSetParent: (id, parent, global) => this.cmdSetParent(id, parent, global),
            onDebugLogPtrLen: (ptr, len) => this.cmdDebugLog(ptr, len),
            onPlaySound: (soundId, volume, loop, outChannelPtr) => {
                this.cmdPlaySound(soundId, volume, loop, outChannelPtr);
            },
            // Not currently emitted by the Swift compiler CMDB lowering (as of Feb 2026),
            // but accepted by the decoder; keep these safe no-ops for forward compatibility.
            onSetMaterial: (_id, _matId) => { },
            onLoadMesh: (_id, _parent, _pathPtr) => { },
            onLoadAnimMesh: (_id, _parent, _pathPtr) => { },
            onCreateMesh: (_id, _parent) => { },
            onLoadTexture: (_id, _pathPtr, _flags) => { },
            onTextureBlend: (_id, _blend) => { },
            onTextureCoords: (_id, _coords) => { },
            onCreateBrush: (_id) => { },
            onBrushColor: (_id, _r, _g, _b) => { },
            onBrushAlpha: (_id, _a) => { },
            onBrushShininess: (_id, _s) => { },
            onBrushTexture: (_brushId, _textureId, _frame, _index) => { },
            onEntityTexture: (entityId, textureId, frame, index) => this.cmdEntityTexture(entityId, textureId, frame, index),
            onEntityColor: (entityId, r, g, b) => this.cmdEntityColor(entityId, r, g, b),
            onEntityAlpha: (entityId, a) => this.cmdEntityAlpha(entityId, a),
            onEntityShininess: (_entityId, _s) => { },
            onEntityFX: (entityId, fx) => this.cmdEntityFX(entityId, fx),
            onEntityBlend: (entityId, blend) => this.cmdEntityBlend(entityId, blend),
        };

        drainCmds(dv, (cmd) => {
            drained++;
            dispatchCmd(exec, cmd);
        });

        return drained;
    }

    dispose() {
        this._stopped = true;
        if (this._rafHandle) {
            cancelAnimationFrame(this._rafHandle);
            this._rafHandle = null;
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            this.renderer.domElement = null as any;
            this.renderer = null;
        }

        if (this.scene) {
            this.disposeObject3D(this.scene);
            this.scene = null;
        }

        this.entities = {};
        this.textures = {};
        this.images = {};
        this.surfaces = {};
        this.brushes = {};
    }
}
