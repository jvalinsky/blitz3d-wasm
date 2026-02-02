import { Blitz3DGraphicsInterface, ENGINE_ENTITY_TYPE } from "../types.ts";
import { decodeSmpk, SMPKLoader } from "../../smpk.ts";
import * as THREE from "three";

export function setup3D(graphics: Blitz3DGraphicsInterface, imports: any) {
    // Helpers
    const computeBounds = (entity: THREE.Object3D) => {
        if (!entity) return null;
        try {
            const box = new THREE.Box3().setFromObject(entity);
            if (typeof box.isEmpty === "function" && box.isEmpty()) {
                return null;
            }
            return box;
        } catch (e) {
            return null;
        }
    };

    const dimensionFromBounds = (entity: THREE.Object3D, axis: "x" | "y" | "z") => {
        const bounds = computeBounds(entity);
        if (!bounds) return 1.0;
        switch (axis) {
            case "x":
                return Math.max(bounds.max.x - bounds.min.x, 0.0001);
            case "y":
                return Math.max(bounds.max.y - bounds.min.y, 0.0001);
            case "z":
                return Math.max(bounds.max.z - bounds.min.z, 0.0001);
            default:
                return 1.0;
        }
    };

    imports.env.CreateCamera = (parent: number) => {
        if (graphics.wasmManager) {
            // Thin Client Path
            const id = graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.CAMERA, parent);
            console.log(`[WasmManager] Created Camera ID: ${id} Parent: ${parent} `);
            return id;
        }

        console.log("CreateCamera called with parent: " + parent);

        // Validation assertions
        if (!graphics.core) {
            console.error("CreateCamera: core is not initialized");
            return 0;
        }
        if (!graphics.core.canvas) {
            console.error("CreateCamera: canvas is not available");
            return 0;
        }
        if (!graphics.scene) {
            console.warn("CreateCamera: scene not initialized, calling init3D");
            graphics.init3D();
        }
        if (!graphics.scene) {
            console.error("CreateCamera: scene is not initialized");
            return 0;
        }

        // Check canvas dimensions
        const canvasWidth = graphics.core.canvas.width || 800;
        const canvasHeight = graphics.core.canvas.height || 600;
        if (canvasWidth <= 0 || canvasHeight <= 0) {
            console.error(
                "CreateCamera: invalid canvas dimensions " + canvasWidth + "x" +
                canvasHeight,
            );
            return 0;
        }

        console.log(
            "Creating PerspectiveCamera with aspect: " +
            (canvasWidth / canvasHeight),
        );
        const cam = new THREE.PerspectiveCamera(
            75,
            canvasWidth / canvasHeight,
            1.0,
            1000.0,
        );

        // Set camera position and look at origin
        cam.position.set(0, 0, 5);
        cam.lookAt(0, 0, 0);

        console.log(
            "Camera position set to: " + cam.position.x + ", " + cam.position.y +
            ", " + cam.position.z,
        );

        const id = graphics.nextEntityId++;
        graphics.entities[id] = cam as any; // Cast to conform to Blitz3DEntity map (imports THREE.Camera extended)
        (graphics.entities[id] as any).isCamera = true;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.CAMERA, parent || undefined);

        if (parent && graphics.entities[parent]) {
            console.log("Adding camera as child of parent entity: " + parent);
            graphics.entities[parent].add(cam);
        } else {
            graphics.scene.add(cam);
            console.log("Camera added directly to scene");
        }

        if (!graphics.camera) {
            console.log("Setting active camera to ID: " + id);
            graphics.camera = cam;
        } else {
            console.log("Active camera already exists, keeping existing camera");
        }

        console.log("CreateCamera completed, ID: " + id);
        console.log(
            "Active camera is now: " +
            (graphics.camera === cam ? "NEW CAMERA" : "EXISTING CAMERA"),
        );

        return id;
    };

    imports.env.Load3DSound = (pathPtr: number) => {
        const path = graphics.core.readString(pathPtr);
        const audio = graphics.audioSystem;
        if (!audio) return 0;

        const id = audio.nextSoundId++;
        audio.loadSound(path, 0); // Background load
        return id;
    };

    imports.env.EmitSound = (soundId: number, entityId: number) => {
        const ent = graphics.entities[entityId];
        if (!ent || !graphics.audioSystem) return 0;

        // Get world position
        const pos = new THREE.Vector3();
        ent.getWorldPosition(pos);

        // Blitz3D -> Three: negate Z again if we are spatializing in right-handed space
        // but WebAudio panner usually expects the same coordinate system as the listener.
        // Since our listener is Three.js based, we use pos.x, pos.y, pos.z directly.
        return graphics.audioSystem.playSound3D(soundId, pos.x, pos.y, pos.z);
    };

    imports.env.CreateLight = (type: number) => {
        if (graphics.wasmManager) {
            const id = graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.LIGHT, 0); // Lighting parenting?
            // LightType needs to be set. WasmManager.createEntity defaults to basic.
            // We can use the bridge to set type? 
            // Actually currently WasmManager.createEntity just takes generic TYPE.
            // We'll trust it returns an ID.
            console.log(`[WasmManager] Created Light ID: ${id} `);
            return id;
        }

        console.log("CreateLight called with type: " + type);

        // Validate scene
        if (!graphics.scene) {
            console.error("CreateLight: scene is not initialized");
            return 0;
        }

        let light: THREE.Light;
        switch (type) {
            case 1:
                light = new THREE.PointLight(0xffffff, 1, 100);
                console.log("Created PointLight");
                break;
            case 2:
                light = new THREE.SpotLight(0xffffff, 1);
                (light as THREE.SpotLight).penumbra = 0.5;
                console.log("Created SpotLight");
                break;
            default:
                light = new THREE.DirectionalLight(0xffffff, 1);
                console.log("Created DirectionalLight (default)");
        }

        const id = graphics.nextEntityId++;
        graphics.entities[id] = light as any;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.LIGHT);
        graphics.scene.add(light);
        console.log("Light added to scene, ID: " + id);
        return id;
    };

    imports.env.CreateMesh = (parent: number) => {
        if (graphics.wasmManager) {
            return graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.MESH, parent);
        }
        console.log("CreateMesh called with parent: " + parent);

        const mesh = new THREE.Mesh();
        // mesh.isMesh = true; // Read-only

        // Ensure mesh has a visible material
        mesh.material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            vertexColors: true,
            side: THREE.DoubleSide,
        });

        console.log("Mesh created with default white material");

        const id = graphics.nextEntityId++;
        graphics.entities[id] = mesh;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.MESH, parent || undefined);

        if (parent && graphics.entities[parent]) {
            console.log("Adding mesh as child of parent: " + parent);
            graphics.entities[parent].add(mesh);
        } else {
            if (graphics.scene) {
                graphics.scene.add(mesh);
                console.log(
                    "Mesh added directly to scene at position: " +
                    mesh.position.x + ", " + mesh.position.y + ", " + mesh.position.z,
                );
            }
        }

        console.log("Mesh created, ID: " + id);
        return id;
    };

    imports.blitz3d.ParseRMesh = (bankId: number) => {
        // This one is complex as it parses binary data.
        // If WasmManager, we should preferably use valid WASM import ParseRMesh?
        // bridge.ts has ParseRMesh(bankId).
        if (graphics.wasmManager) {
            console.log("ParseRMesh: Delegating to Engine via Bridge");
            return graphics.wasmManager.bridge.exports.ParseRMesh(bankId);
        }

        // Parse RMESH from SMPK in bank (metadata + visual)
        if (!graphics.core.banks) return 0; // Added null check
        const data = graphics.core.banks.get(bankId);
        if (!data) {
            console.error(`ParseRMesh: Invalid bankId ${bankId} `);
            return 0;
        }

        // 1. Decode SMPK to access extras
        let smpkJson;
        try {
            const { json } = decodeSmpk(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            smpkJson = json;
        } catch (e) {
            console.error(`ParseRMesh: Failed to decode SMPK / JSON: ${e} `);
            return 0;
        }

        // 2. Load visual mesh via SMPKLoader
        // Lazy init loader
        if (!graphics.smpkLoader) graphics.smpkLoader = new SMPKLoader(graphics, graphics.core);

        // We load it as a child of the world (0). It returns a new entity ID.
        const rootId = graphics.smpkLoader.loadFromBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), 0, `rmesh_${bankId} `);
        const root = graphics.entities[rootId];
        if (!root) {
            console.error("ParseRMesh: Failed to create root entity");
            return 0;
        }

        // 3. Spawn Extras (Entities & Triggers)
        // These are spawned as children of the Room Mesh parented to it so they move together.

        const spawnEntity = (e: any) => {
            if (!e.type) return;
            const type = e.type.toLowerCase();
            let id = 0;

            // Map RMESH types to Blitz3D entities
            if (type === "pointlight" || type === "light") {
                // 2 = Point Light
                id = imports.env.CreateLight(2);
            } else if (type === "spotlight") {
                // 3 = Spot Light
                id = imports.env.CreateLight(3);
            } else if (
                type === "screen" || type === "waypoint" || type === "playerstart" ||
                type === "soundemitter"
            ) {
                id = imports.env.CreatePivot(rootId);
            } else if (type === "model") {
                // Models in RMESH often point to external files.
                // For now, simple pivot placeholder.
                id = imports.env.CreatePivot(rootId);
            } else {
                // Fallback
                id = imports.env.CreatePivot(rootId);
            }

            if (id) {
                // Ensure parented to room
                imports.env.EntityParent(id, rootId, 0);

                // Position (assume Blitz coords)
                imports.env.PositionEntity(id, e.x || 0, e.y || 0, e.z || 0, 0);

                // Rotation
                if (e.pitch || e.yaw || e.roll) {
                    imports.env.RotateEntity(id, e.pitch || 0, e.yaw || 0, e.roll || 0);
                }

                // Name
                const obj = graphics.entities[id];
                if (obj && e.name) obj.name = e.name;

                // Light Props
                if (type.includes("light")) {
                    if (e.r !== undefined || e.g !== undefined || e.b !== undefined) {
                        const r = e.r !== undefined ? e.r * 255 : 255;
                        const g = e.g !== undefined ? e.g * 255 : 255;
                        const b = e.b !== undefined ? e.b * 255 : 255;
                        imports.env.LightColor(id, r, g, b);
                    }
                    if (e.range !== undefined) {
                        imports.env.LightRange(id, e.range);
                    }
                }
            }
        };

        const spawnTrigger = (t: any) => {
            const id = imports.env.CreatePivot(rootId);
            if (id) {
                const obj = graphics.entities[id];
                if (obj) {
                    obj.name = t.name;

                    // Calculate center from AABB
                    const min = t.aabb.min;
                    const max = t.aabb.max;
                    const cx = (min[0] + max[0]) / 2;
                    const cy = (min[1] + max[1]) / 2;
                    const cz = (min[2] + max[2]) / 2;

                    imports.env.PositionEntity(id, cx, cy, cz, 0);

                    // Store metadata
                    obj.userData.trigger = true;
                    obj.userData.aabbMin = min;
                    obj.userData.aabbMax = max;
                }
            }
        };

        if (smpkJson.extras?.rmesh) {
            const rm = smpkJson.extras.rmesh;
            if (Array.isArray(rm.entities)) rm.entities.forEach(spawnEntity);
            if (Array.isArray(rm.triggers)) rm.triggers.forEach(spawnTrigger);
        }

        return rootId;
    };

    // ... (Many other functions)
    // I will add the rest of the Entity functions here

    imports.env.PositionEntity = (ent: number, x: number, y: number, z: number) => {
        const entity = graphics.entities[ent];
        if (graphics.core.entityTable) {
            graphics.core.entityTable.setX(ent, x);
            graphics.core.entityTable.setY(ent, y);
            graphics.core.entityTable.setZ(ent, z);
        }
        if (entity) {
            entity.position.set(x, y, -z);
        }
        graphics.engineCall(ent, (eid) => graphics._engine!.EngineSetPosition(eid, x, y, z));
    };

    imports.env.RotateEntity = (ent: number, pitch: number, yaw: number, roll: number) => {
        const entity = graphics.entities[ent];
        if (graphics.core.entityTable) {
            graphics.core.entityTable.setPitch(ent, pitch);
            graphics.core.entityTable.setYaw(ent, yaw);
            graphics.core.entityTable.setRoll(ent, roll);
        }
        if (entity) {
            entity.rotation.set(
                pitch * Math.PI / 180,
                yaw * Math.PI / 180,
                roll * Math.PI / 180,
            );
        }
        graphics.engineCall(ent, (eid) => graphics._engine!.EngineSetRotation(eid, pitch, yaw, roll));
    };

    imports.env.ScaleEntity = (ent: number, x: number, y: number, z: number) => {
        const entity = graphics.entities[ent];
        if (graphics.core.entityTable) {
            graphics.core.entityTable.setScaleX(ent, x);
            graphics.core.entityTable.setScaleY(ent, y);
            graphics.core.entityTable.setScaleZ(ent, z);
        }
        if (entity) entity.scale.set(x, y, z);
        graphics.engineCall(ent, (eid) => graphics._engine!.EngineSetScale(eid, x, y, z));
    };

    imports.env.MoveEntity = (ent: number, x: number, y: number, z: number) => {
        const entity = graphics.entities[ent];
        if (entity) {
            entity.translateX(x);
            entity.translateY(y);
            entity.translateZ(-z);
            if (graphics.core.entityTable) {
                graphics.core.entityTable.setX(ent, entity.position.x);
                graphics.core.entityTable.setY(ent, entity.position.y);
                graphics.core.entityTable.setZ(ent, -entity.position.z);
            }
        }
        graphics.engineCall(ent, (eid) => graphics._engine!.EngineMoveEntity(eid, x, y, z));
    };

    imports.env.TurnEntity = (ent: number, pitch: number, yaw: number, roll: number, global: number) => {
        const entity = graphics.entities[ent];
        if (entity) {
            entity.rotateX(pitch * Math.PI / 180);
            entity.rotateY(yaw * Math.PI / 180);
            entity.rotateZ(roll * Math.PI / 180);
            if (graphics.core.entityTable) {
                graphics.core.entityTable.setPitch(ent, entity.rotation.x * 180 / Math.PI);
                graphics.core.entityTable.setYaw(ent, entity.rotation.y * 180 / Math.PI);
                graphics.core.entityTable.setRoll(ent, entity.rotation.z * 180 / Math.PI);
            }
        }
        graphics.engineCall(ent, (eid) => graphics._engine!.EngineTurnEntity(eid, pitch, yaw, roll));
    };

    // Entity Property Getters
    imports.env.EntityX = (ent: number, global: number) => {
        if (!global && graphics.core.entityTable) return graphics.core.entityTable.getX(ent);
        const entity = graphics.entities[ent];
        if (!entity) return 0.0;
        if (global) {
            const worldPos = new THREE.Vector3();
            entity.getWorldPosition(worldPos);
            return worldPos.x;
        }
        return entity.position.x;
    };

    imports.env.EntityY = (ent: number, global: number) => {
        if (!global && graphics.core.entityTable) return graphics.core.entityTable.getY(ent);
        const entity = graphics.entities[ent];
        if (!entity) return 0.0;
        if (global) {
            const worldPos = new THREE.Vector3();
            entity.getWorldPosition(worldPos);
            return worldPos.y;
        }
        return entity.position.y;
    };

    imports.env.EntityZ = (ent: number, global: number) => {
        if (!global && graphics.core.entityTable) return graphics.core.entityTable.getZ(ent);
        const entity = graphics.entities[ent];
        if (!entity) return 0.0;
        // Convert from Three.js coordinate system back to Blitz3D (negate Z)
        if (global) {
            const worldPos = new THREE.Vector3();
            entity.getWorldPosition(worldPos);
            return -worldPos.z;
        }
        return -entity.position.z;
    };

    imports.env.EntityPitch = (ent: number, global: number) => {
        if (!global && graphics.core.entityTable) return graphics.core.entityTable.getPitch(ent);
        const entity = graphics.entities[ent];
        if (!entity) return 0.0;
        if (global) {
            const worldRot = new THREE.Euler();
            entity.getWorldQuaternion(new THREE.Quaternion());
            worldRot.setFromQuaternion(entity.quaternion as THREE.Quaternion);
            return worldRot.x * 180 / Math.PI;
        }
        return entity.rotation.x * 180 / Math.PI;
    };

    imports.env.EntityYaw = (ent: number, global: number) => {
        if (!global && graphics.core.entityTable) return graphics.core.entityTable.getYaw(ent);
        const entity = graphics.entities[ent];
        if (!entity) return 0.0;
        if (global) {
            const worldRot = new THREE.Euler();
            entity.getWorldQuaternion(new THREE.Quaternion());
            worldRot.setFromQuaternion(entity.quaternion as THREE.Quaternion);
            return worldRot.y * 180 / Math.PI;
        }
        return entity.rotation.y * 180 / Math.PI;
    };

    imports.env.EntityRoll = (ent: number, global: number) => {
        if (!global && graphics.core.entityTable) return graphics.core.entityTable.getRoll(ent);
        const entity = graphics.entities[ent];
        if (!entity) return 0.0;
        if (global) {
            const worldRot = new THREE.Euler();
            entity.getWorldQuaternion(new THREE.Quaternion());
            worldRot.setFromQuaternion(entity.quaternion as THREE.Quaternion);
            return worldRot.z * 180 / Math.PI;
        }
        return entity.rotation.z * 180 / Math.PI;
    };

    imports.env.EntityDistance = (ent1: number, ent2: number) => {
        const entity1 = graphics.entities[ent1];
        const entity2 = graphics.entities[ent2];
        if (!entity1 || !entity2) return 0.0;

        const pos1 = new THREE.Vector3();
        const pos2 = new THREE.Vector3();
        entity1.getWorldPosition(pos1);
        entity2.getWorldPosition(pos2);

        return pos1.distanceTo(pos2);
    };

    imports.env.MeshWidth = (meshId: number) => {
        const entity = graphics.entities[meshId];
        return dimensionFromBounds(entity, "x");
    };

    imports.env.MeshHeight = (meshId: number) => {
        const entity = graphics.entities[meshId];
        return dimensionFromBounds(entity, "y");
    };

    imports.env.MeshDepth = (meshId: number) => {
        const entity = graphics.entities[meshId];
        return dimensionFromBounds(entity, "z");
    };

    // Entity Hierarchy Queries
    imports.env.CountChildren = (ent: number) => {
        const entity = graphics.entities[ent];
        return entity ? entity.children.length : 0;
    };

    imports.env.GetChild = (ent: number, index: number) => {
        const entity = graphics.entities[ent];
        if (!entity || index < 0 || index >= entity.children.length) return 0;

        const child = entity.children[index];
        // Find the entity ID for this child
        for (const [id, obj] of Object.entries(graphics.entities)) {
            if (obj === child) return parseInt(id);
        }
        return 0;
    };

    imports.env.FindChild = (ent: number, name: string) => {
        const entity = graphics.entities[ent];
        if (!entity) return 0;

        // Search through children for matching name
        for (const child of entity.children) {
            if (child.name === name) {
                // Find the entity ID for this child
                for (const [id, obj] of Object.entries(graphics.entities)) {
                    if (obj === child) return parseInt(id);
                }
            }
        }
        return 0;
    };

    imports.env.GetParent = (ent: number) => {
        const entity = graphics.entities[ent];
        if (!entity || !entity.parent || entity.parent === graphics.scene) return 0;

        // Find the entity ID for the parent
        for (const [id, obj] of Object.entries(graphics.entities)) {
            if (obj === entity.parent) return parseInt(id);
        }
        return 0;
    };

    imports.env.CreatePivot = (parent: number) => {
        if (graphics.wasmManager) return graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.PIVOT, parent);

        const pivot = new THREE.Object3D();
        const id = graphics.nextEntityId++;
        graphics.entities[id] = pivot;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.PIVOT, parent || undefined);

        if (parent && graphics.entities[parent]) {
            graphics.entities[parent].add(pivot);
        } else if (graphics.scene) {
            graphics.scene.add(pivot);
        } else {
            console.warn("CreatePivot: scene not initialized; calling init3D");
            graphics.init3D();
            if (graphics.scene) {
                graphics.scene.add(pivot);
            } else {
                console.warn(
                    "CreatePivot: scene still not initialized; deferring add",
                    { id, parent },
                );
            }
        }

        console.log("CreatePivot: id=" + id + " parent=" + parent);
        return id;
    };

    imports.env.FreeEntity = (ent: number) => {
        const entity = graphics.entities[ent];
        if (entity) {
            try {
                graphics.disposeObject3D(entity);
            } catch { }
            if (entity.parent) entity.parent.remove(entity);
            graphics.engineCall(ent, (eid) => graphics._engine!.EngineFreeEntity(eid));
            graphics._engineIds.delete(ent);
            delete graphics.entities[ent];
        }
    };

    imports.env.CopyEntity = (ent: number) => {
        // TODO: engine-backed copy; for now, implement the legacy Three.js path.
        if (graphics.wasmManager || graphics.nativeManager) {
            console.warn("CopyEntity not supported in engine mode yet");
            return 0;
        }
        const entity = graphics.entities[ent];
        if (!entity) return 0;

        const clone = entity.clone(true);
        // Ensure cloned meshes have unique materials (so wireframe/color edits don't affect original).
        try {
            clone.traverse((child: any) => {
                if (child?.isMesh) graphics.ensureUniqueMaterial(child);
            });
        } catch { }

        const id = graphics.nextEntityId++;
        graphics.entities[id] = clone;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.MESH, undefined);

        const parent = entity.parent;
        if (parent && parent !== graphics.scene) parent.add(clone);
        else if (graphics.scene) graphics.scene.add(clone);

        return id;
    };

    imports.env.EntityTexture = (ent: number, tex: number, frame: number, index: number) => {
        const entity = graphics.entities[ent];
        const texture = graphics.textures[tex];
        if (entity && texture) {
            entity.traverse((child: THREE.Object3D) => { // Added type annotation
                if ((child as THREE.Mesh).isMesh) {
                    graphics.ensureUniqueMaterial(child);
                    const mat = (child as THREE.Mesh).material as any;
                    if (Array.isArray(mat)) return;
                    mat.map = texture.texture;
                    mat.needsUpdate = true;
                }
            });
        }
        graphics.engineCall(ent, (eid) => graphics._engine!.EngineEntityTexture(eid, tex, frame || 0, index || 0));
    };

    // Entity Property Functions
    imports.env.EntityAutoFade = (ent: number, near: number, far: number) => {
        const entity = graphics.entities[ent];
        if (entity) {
            entity.userData.autoFade = { near, far };
        }
    };

    imports.env.EntityOrder = (ent: number, order: number) => {
        const entity = graphics.entities[ent];
        if (entity) {
            entity.renderOrder = order;
        }
    };

    // ... and so on. There are more functions. 
    // I will append the rest of the functions in a subsequent edit or include them here.
    // Including more for completeness.

    imports.env.NameEntity = (ent: number, name: string) => {
        const entity = graphics.entities[ent];
        if (entity) {
            entity.name = name;
        }
    };

    imports.env.EntityName = (ent: number) => {
        const entity = graphics.entities[ent];
        if (entity && entity.name && graphics.core.allocString) {
            return graphics.core.allocString(entity.name);
        }
        return 0;
    };

    imports.env.LoadMesh = (pathPtr: number, parent: number) => {
        const rawPath = graphics.core.readString(pathPtr);
        const path = rawPath.replace(/\.(b3d|x|rmesh)$/i, ".smpk");
        console.log(`Loading Mesh: ${rawPath} -> ${path} `);

        const placeholderId = imports.env.CreateMesh(parent);
        const ent = graphics.entities[placeholderId];
        if (ent) ent.name = rawPath;

        // Determine loader
        const lowerPath = path.toLowerCase();
        if (lowerPath.endsWith(".smpk")) {
            graphics.animationSystem.loadAnimMesh(path, parent || 0).then(() => {
                console.log(`[SMPK] Loaded ${path} `);
            }).catch((err: any) => console.error(`[SMPK] ${path}: `, err));
        } else if (lowerPath.endsWith(".b3d") || lowerPath.endsWith(".x") || lowerPath.endsWith(".rmesh")) {
            throw new Error(`Refusing to load source mesh at runtime: ${rawPath} (convert offline to.smpk)`);
        }

        return placeholderId;
    };

    imports.env.LoadMesh_Strict = (pathPtr: number, parent: number) => {
        return imports.env.LoadMesh(pathPtr, parent);
    };

    // Primitives
    imports.env.CreateCube = (parent: number) => {
        if (graphics.wasmManager) return graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.MESH, parent);
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        const id = graphics.nextEntityId++;
        graphics.entities[id] = mesh;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.MESH, parent || undefined);
        if (parent && graphics.entities[parent]) graphics.entities[parent].add(mesh);
        else if (graphics.scene) graphics.scene.add(mesh);
        return id;
    };

    imports.env.CreateSphere = (parent: number, segs: number) => {
        if (graphics.wasmManager) return graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.MESH, parent);
        const segments = segs || 16;
        const geometry = new THREE.SphereGeometry(1, segments, segments);
        const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
        );
        const id = graphics.nextEntityId++;
        graphics.entities[id] = mesh;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.MESH, parent || undefined);
        if (parent && graphics.entities[parent]) graphics.entities[parent].add(mesh);
        else if (graphics.scene) graphics.scene.add(mesh);
        return id;
    };

    imports.env.CreatePlane = (parent: number) => {
        if (graphics.wasmManager) return graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.MESH, parent);
        const geometry = new THREE.PlaneGeometry(20, 20);
        const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({
                color: 0x888888,
                side: THREE.DoubleSide,
            }),
        );
        mesh.rotation.x = -Math.PI / 2;
        const id = graphics.nextEntityId++;
        graphics.entities[id] = mesh;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.MESH, parent || undefined);
        if (parent && graphics.entities[parent]) graphics.entities[parent].add(mesh);
        else if (graphics.scene) graphics.scene.add(mesh);
        return id;
    };

    imports.env.CreateSprite = (parentId: number) => {
        if (graphics.wasmManager) return graphics.wasmManager.createEntity(ENGINE_ENTITY_TYPE.SPRITE, parentId);
        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ color: 0xffffff }),
        );
        const id = graphics.nextEntityId++;
        graphics.entities[id] = sprite as any;
        graphics.engineCreate(id, ENGINE_ENTITY_TYPE.SPRITE, parentId || undefined);

        if (parentId && graphics.entities[parentId]) {
            graphics.entities[parentId].add(sprite);
        } else if (graphics.scene) {
            graphics.scene.add(sprite);
        }

        return id;
    };

    imports.env.ScaleSprite = (spriteId: number, xScale: number, yScale: number) => {
        const sprite = graphics.entities[spriteId];
        if (sprite) {
            sprite.scale.set(xScale, yScale, 1);
        }
    };

    imports.env.SpriteViewMode = (spriteId: number, mode: number) => {
        // Mode: 1=fixed, 2=free, 3=billboard
        console.log(`SpriteViewMode: sprite = ${spriteId} mode = ${mode} `);
    };

    imports.env.AddEntity = (entityId: number, parentId: number) => {
        const entity = graphics.entities[entityId];
        const parent = graphics.entities[parentId];
        if (entity && parent) {
            parent.add(entity);
        }
    };
}
