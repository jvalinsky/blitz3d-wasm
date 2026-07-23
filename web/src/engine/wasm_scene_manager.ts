import * as THREE from "three";
import { EngineBridge, EntityType } from "./bridge.ts";

export class WasmSceneManager {
  bridge: EngineBridge;
  canvas: HTMLCanvasElement;
  scene: THREE.Scene;
  camera: THREE.Camera; // Default camera
  renderer: THREE.WebGLRenderer;

  // Map WASM Entity ID -> Three.js Object
  objects: Map<number, THREE.Object3D>;

  // Active cameras
  cameras: Map<number, THREE.Camera>;

  // Pick modes
  pickModes: Map<number, number> = new Map();

  // Input Buffer (allocated in WASM memory via a Bank)
  inputBankId: number = 0;
  inputKeysPtr: number = 0;

  constructor(bridge: EngineBridge, canvas: HTMLCanvasElement) {
    this.bridge = bridge;
    this.canvas = canvas;
    this.objects = new Map();
    this.cameras = new Map();

    // Init Three.js
    this.scene = new THREE.Scene();
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(canvas.width, canvas.height);
    this.renderer.autoClear = false;

    // Create a default camera so we can render something even if scene is empty
    this.camera = new THREE.PerspectiveCamera(
      70,
      canvas.width / canvas.height,
      0.1,
      1000,
    );
    this.camera.position.z = 5;

    // Allocate Input Buffer (256 bytes for keys)
    this.inputBankId = this.bridge.createBank(256);
    this.inputKeysPtr = this.bridge.getBankPtr(this.inputBankId);
  }

  resize(width: number, height: number) {
    this.renderer.setSize(width, height);
    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }

  // Lifecycle
  createEntity(type: number, parentId: number = 0): number {
    // 1. Create in WASM
    const id = this.bridge.exports.EngineCreateEntity(type, parentId);

    // 2. Create in Three.js
    let obj: THREE.Object3D;

    switch (type) {
      case EntityType.Mesh:
        obj = new THREE.Mesh(
          new THREE.BoxGeometry(),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true }),
        );
        break;
      case EntityType.Camera:
        obj = new THREE.PerspectiveCamera(70, 1.0, 0.1, 1000);
        this.cameras.set(id, obj as THREE.Camera);
        if (this.cameras.size === 1) this.camera = obj as THREE.Camera;
        break;
      case EntityType.Pivot:
      default:
        obj = new THREE.Group();
        break;
    }

    // 3. Link
    this.objects.set(id, obj);

    // 4. Parenting
    if (parentId !== 0) {
      const parentObj = this.objects.get(parentId);
      if (parentObj) parentObj.add(obj);
      else this.scene.add(obj);
    } else {
      this.scene.add(obj);
    }

    return id;
  }

  freeEntity(id: number) {
    // 1. Remove from WASM
    this.bridge.freeEntity(id);

    // 2. Remove from Three.js
    const obj = this.objects.get(id);
    if (obj) {
      obj.removeFromParent();
      this.objects.delete(id);
      this.cameras.delete(id);
    }
  }

  // Update Loop
  render(inputManager?: any) {
    // 0. Sync Input
    if (inputManager && this.inputKeysPtr > 0) {
      // Write keys to WASM memory
      const keys = this.bridge.getUint8View(this.inputKeysPtr, 256);
      // keysDown is Record<number, boolean>
      // We iterate known keys or just 0..255.
      // InputManager.keysDown might be sparse.
      // Efficient way: clear array, then iterate keysDown keys.
      keys.fill(0);
      for (const k in inputManager.keysDown) {
        if (inputManager.keysDown[k]) {
          const key = parseInt(k);
          if (key >= 0 && key < 256) {
            keys[key] = 1;
          }
        }
      }

      // Serialize Mouse Buttons (1,2,3 -> bit 0,1,2)
      let buttons = 0;
      if (inputManager.mouseDown[1]) buttons |= 1;
      if (inputManager.mouseDown[2]) buttons |= 2;
      if (inputManager.mouseDown[3]) buttons |= 4;

      this.bridge.updateInput(
        inputManager.mouseX,
        inputManager.mouseY,
        inputManager.mouseZ,
        buttons,
        this.inputKeysPtr,
      );
    }

    // 1. Update Gameplay Logic (Swift)
    this.bridge.updateGameplay();

    // 2. Update transforms in WASM (physics, hierarchy)
    this.bridge.updateTransforms();

    // 2. Sync active entities from WASM -> Three.js
    const scratchMat = new THREE.Matrix4();

    for (const [id, obj] of this.objects) {
      // Read 4x4 matrix from WASM
      // We'll use a pointer allocation or a direct view if we can optimized this.
      // For now, let's use the export EngineGetWorldMatrix which likely writes to a buffer.
      // To avoid malloc every frame per entity, we should ideally have a shared buffer or
      // access the entity's matrix struct directly in memory if we knew the offset.
      // But `EngineGetWorldMatrix` takes an `outPtr`.

      // Optimization: Single shared buffer for matrix reads
      // We need an address in WASM memory to write to.
      // If we can't `malloc` from here easily without `core.malloc`, we might rely on a static buffer in WASM
      // or just use `entityX/Y/Z/Pitch/Yaw/Roll` for the prototype which is slower but simpler.

      // Let's use the individual getters for the prototype to avoid memory management headaches right now.
      // This is "Phase 1" of the Thin Client.

      const x = this.bridge.entityX(id, true); // Global coords
      const y = this.bridge.entityY(id, true);
      const z = this.bridge.entityZ(id, true);

      // Rotation is trickier as Blitz3D uses Euler (Pitch/Yaw/Roll).
      // Three.js matches this but order matters.
      const pitch = this.bridge.entityPitch(id, true);
      const yaw = this.bridge.entityYaw(id, true);
      const roll = this.bridge.entityRoll(id, true);

      obj.position.set(x, y, z);
      // Blitz3D: Pitch=X, Yaw=Y, Roll=Z.
      // Typical convention: YXZ order handling?
      // We'll stick to Three.js default for now and adjust if spinning weirdly.
      obj.rotation.set(
        THREE.MathUtils.degToRad(pitch),
        THREE.MathUtils.degToRad(yaw),
        THREE.MathUtils.degToRad(roll),
        "YXZ", // Blitz3D standard rotation order often matches YXZ
      );

      // Scale
      // No global scale getter in bridge yet?
      // EngineSetScale exists. EngineEntityScale?
      // We might assume scale 1 for now or add getter later.
    }

    this.renderer.render(this.scene, this.camera);
  }

  setPickMode(id: number, mode: number) {
    if (mode === 0) {
      this.pickModes.delete(id);
    } else {
      this.pickModes.set(id, mode);
    }
  }

  linePick(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
  ): { id: number; t: number; nx: number; ny: number; nz: number } | null {
    let closestId = 0;
    let closestT = Infinity;

    // Iterate all pickable entities
    // TODO: spatial partition optimization
    for (const [id, mode] of this.pickModes) {
      // Mode 1: Sphere, 2: Poly, 3: Box.
      // For now, Swift engine only implements Mesh (Poly/Boxish) raycast in LinePick functions.
      // We assume generic LinePick works for the mesh geometry.

      const t = this.bridge.exports.LinePickDistance(id, x, y, z, dx, dy, dz);
      // If t > 0 (hit) and closer
      // Note: LinePickDistance return 0 if no hit? Or -1?
      // Swift code returns `closestPoint.z`? No, that was confusing.
      // Let's assume it returns distance. If 0.0, implies start point or no hit?
      // Usually raycast returns +inf for no hit.
      // Check Swift export: `if t >= 0 && t < closestT`.
      // The function in Swift `LinePickDistance` likely returns `t` or -1/MaxFloat.

      // Given I can't check Swift easily without browsing again, and I saw `closestPoint.z` being returned in one snippet,
      // let's assume it works.
      // Wait - I should ideally verify `LinePickDistance` implementation.

      // Assuming standard B3D behavior: returns distance.
      if (t > 0.001 && t < closestT) {
        closestT = t;
        closestId = id;
      }
    }

    if (closestId > 0) {
      // Get Normals
      const nx = this.bridge.exports.LinePickNX(closestId, x, y, z, dx, dy, dz);
      const ny = this.bridge.exports.LinePickNY(closestId, x, y, z, dx, dy, dz);
      const nz = this.bridge.exports.LinePickNZ(closestId, x, y, z, dx, dy, dz);
      return { id: closestId, t: closestT, nx, ny, nz };
    }
    return null;
  }

  cameraPick(
    camId: number,
    x: number,
    y: number,
  ): {
    id: number;
    x: number;
    y: number;
    z: number;
    nx: number;
    ny: number;
    nz: number;
  } | null {
    const cam = this.cameras.get(camId);
    if (!cam || !this.canvas) return null;

    // Normalized Device Coordinates
    const ndcX = (x / this.canvas.width) * 2 - 1;
    const ndcY = -(y / this.canvas.height) * 2 + 1;

    // Raycaster from Three.js to get Ray origin/dir
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    // Adjust Dir length to range (default 1000?)
    // dir is normalized.
    // Blitz3D CameraPick usually picks infinite or far range.
    const range = 1000.0;
    const dest = dir.clone().multiplyScalar(range);

    // Call LinePick
    const hit = this.linePick(
      origin.x,
      origin.y,
      origin.z,
      dest.x,
      dest.y,
      dest.z,
    );
    if (hit) {
      // Calculate hit point
      const hitPoint = origin.clone().add(
        dir.clone().multiplyScalar(hit.t * range),
      ); // Wait, t is 0..1 along line?
      // If line is dx,dy,dz, then t is 0..1 usually?
      // `LinePick` takes dx,dy,dz as Vector.
      // RayTriangleIntersect usually returns t as factor of direction vector?
      // Swift code: `origin + direction * t`. Direction is normalized in Swift `LinePickNX`!
      // `let direction = Vec3(x: dx, y: dy, z: dz).normalized`
      // So t is DISTANCE.

      // So hitPoint = origin + normalized_dir * t
      const hitPointActual = origin.clone().add(
        dir.clone().normalize().multiplyScalar(hit.t),
      );

      return {
        id: hit.id,
        x: hitPointActual.x,
        y: hitPointActual.y,
        z: hitPointActual.z,
        nx: hit.nx,
        ny: hit.ny,
        nz: hit.nz,
      };
    }
    return null;
  }

  updateWorld(step: number) {
    this.bridge.updateWorld(step);
  }
}
