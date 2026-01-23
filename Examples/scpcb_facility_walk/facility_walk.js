/**
 * SCPCB Facility Walk Demo
 * Uses facility_walk.wasm for movement/door logic and RMeshLoader.wasm for mesh parsing.
 */

const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x07080a);
container.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

let currentMeshObject = null;
let collisionMesh = null;
let collisionMinY = null;
let collisionMaxY = null;
let collisionMinX = null;
let collisionMaxX = null;
let collisionMinZ = null;
let collisionMaxZ = null;

const cameraPitch = new THREE.Object3D();
const cameraYaw = new THREE.Object3D();
scene.add(cameraYaw);
cameraYaw.add(cameraPitch);
cameraPitch.add(camera);

cameraYaw.position.set(0, 0, 0);
cameraPitch.position.y = 0;

const keys = {};
const keyHits = new Set();
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let wantJump = false;
let lastFloorHit = false;
let lastFloorY = null;
let grounded = false;
let floorGrace = 0;
let canJump = true;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const playerHeight = 0.7;
const moveSpeed = 18.0;
const gravity = 25.0;
const jumpForce = 12.0;
const playerRadius = 0.35;

function handleKeyDown(e) {
    if (!keys[e.code]) keyHits.add(e.code);
    keys[e.code] = true;
    switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
            moveForward = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveBackward = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            moveLeft = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveRight = true;
            break;
        case 'Space':
            wantJump = true;
            break;
        case 'ShiftLeft':
            moveDown = true;  // Crouch/down
            break;
        case 'ControlLeft':
            moveDown = true;
            break;
        case 'KeyC':
            if (collisionMesh) {
                collisionMesh.material.visible = !collisionMesh.material.visible;
            }
            break;
    }
}

function handleKeyUp(e) {
    keys[e.code] = false;
    switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
            moveForward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            moveBackward = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            moveLeft = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            moveRight = false;
            break;
        case 'Space':
            wantJump = false;
            break;
        case 'ShiftLeft':
        case 'ControlLeft':
            moveDown = false;
            break;
    }
}

document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

const instructions = document.getElementById('instructions');
const status = document.getElementById('status');
const meshSelect = document.getElementById('mesh-select');
const brightnessSlider = document.getElementById('brightness-slider');
let ambientLight = null;
let sunLight = null;
const debugHud = document.createElement('div');
debugHud.style.position = 'absolute';
debugHud.style.top = '20px';
debugHud.style.right = '20px';
debugHud.style.padding = '8px 10px';
debugHud.style.background = 'rgba(0,0,0,0.6)';
debugHud.style.color = '#e0e0e0';
debugHud.style.font = '12px/1.4 monospace';
debugHud.style.whiteSpace = 'pre';
debugHud.style.pointerEvents = 'none';
document.body.appendChild(debugHud);

container.addEventListener('click', () => {
    container.requestPointerLock();
});

instructions.addEventListener('click', () => {
    instructions.style.display = 'none'; // Optimistic hide
    container.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === container;
    instructions.style.display = locked ? 'none' : 'block';
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== container) return;
    cameraYaw.rotation.y -= e.movementX * 0.01;
    cameraPitch.rotation.x -= e.movementY * 0.01;
    cameraPitch.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraPitch.rotation.x));
});

const collisionVertices = [];
const collisionIndices = [];
const floorRaycaster = new THREE.Raycaster();
const wallRaycaster = new THREE.Raycaster();

const doorColliders = [];
const doorStates = [];
const rmeshDoorPositions = [];

// XLoader for loading DirectX .x meshes
let xLoader = null;
function getXLoader() {
    console.log('getXLoader called, window.XLoader exists:', !!window.XLoader);
    if (!xLoader && window.XLoader) {
        console.log('Creating new XLoader instance...');
        xLoader = new window.XLoader({ entities: {}, scene, nextEntityId: 10000 }, null, null);
        console.log('XLoader created:', xLoader);
    }
    return xLoader;
}

// Load Door01.x mesh asynchronously
async function loadDoorXMesh(x, y, z, angle) {
    console.log(`=== loadDoorXMesh called at ${x}, ${y}, ${z} angle ${angle} ===`);
    const loader = getXLoader();
    if (!loader) {
        console.warn('XLoader not available, falling back to box door');
        return createDoorMesh(x, y, z, angle);
    }

    try {
        // Fetch and parse the X file
        const response = await fetch('assets/Door01.x');
        if (!response.ok) throw new Error('Failed to fetch Door01.x');
        const xContent = await response.text();

        // Parse the X file
        const xData = loader.parseXFile(xContent);
        if (!xData || !xData.meshes.length) {
            throw new Error('No mesh data in Door01.x');
        }

        // Create Three.js mesh from parsed data
        const meshData = xData.meshes[0];
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
        geometry.setIndex(meshData.faces);

        if (meshData.uvs.length > 0) {
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(meshData.uvs, 2));
        }
        if (meshData.normals.length > 0) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
        } else {
            geometry.computeVertexNormals();
        }

        // Load texture
        const texture = textureLoader.load('assets/Door01.jpg');
        texture.flipY = false;
        const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide });

        const mesh = new THREE.Mesh(geometry, material);

        // Scale to appropriate size (original is large, scale down to ~1m wide door)
        const scale = 0.04; // Blitz3D uses different units
        mesh.scale.set(scale, scale, scale);

        const group = new THREE.Group();
        group.add(mesh);
        group.position.set(x, y, z);
        group.rotation.y = angle * Math.PI / 180;
        scene.add(group);

        // Create collider
        const colliderGeo = new THREE.BoxGeometry(0.8, 1.5, 0.2);
        const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
        const collider = new THREE.Mesh(colliderGeo, colliderMat);
        group.add(collider);
        doorColliders.push(collider);

        console.log(`Door01.x loaded: ${meshData.vertices.length / 3} verts, ${meshData.faces.length / 3} tris`);
        return { group, mesh, collider, openState: 0, open: false };

    } catch (error) {
        console.error('Failed to load Door01.x:', error);
        return createDoorMesh(x, y, z, angle);
    }
}

const meshOptions = [
    'room2cafeteria_opt.rmesh',
    'room2offices3_opt.rmesh',
    'room2_opt.rmesh',
    'room2offices_opt.rmesh',
    'testroom_opt.rmesh',
    'room2tunnel_opt.rmesh',
    'room3_opt.rmesh',
];
let spawnPoint = null;

let gameExports = null;
let loaderExports = null;

const entities = new Map();
let nextEntityId = 1;
let playerEntityId = null;

const meshes = new Map();
const surfaces = new Map();
let nextMeshId = 1;
let nextSurfaceId = 1;

const virtualFiles = new Map();
const openFiles = new Map();
let nextFileId = 1;

const heapPointers = new Map();
let activeMemory = null;
let currentMeshName = null;

// Collision system state
const collisionPairs = [];  // [{typeA, typeB, method, response}]
const entityCollisionState = new Map();  // entityId -> collision state

// Per-frame picking result
let lastPick = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, entity: 0 };

// Helper to get or create collision state for an entity
function getOrCreateCollisionState(entityId) {
    if (!entityCollisionState.has(entityId)) {
        entityCollisionState.set(entityId, {
            type: 0,           // collision type (HIT_MAP=1, HIT_PLAYER=2, etc.)
            pickMode: 0,       // 0=none, 1=sphere, 2=polygon
            radiusX: 0.5,      // ellipsoid X radius
            radiusY: 0.5,      // ellipsoid Y radius
            radiusZ: 0.5,      // ellipsoid Z radius (usually same as X)
            collisions: []     // results from last collision check: [{x, y, z, nx, ny, nz, entity}]
        });
    }
    return entityCollisionState.get(entityId);
}

// Collision detection - called after entity movement
function updateCollisions(entityId) {
    if (!collisionMesh) return;

    const state = entityCollisionState.get(entityId);
    if (!state || state.type === 0) return;

    const ent = entities.get(entityId);
    if (!ent) return;

    // Clear previous collision results
    state.collisions = [];

    // Check against collision pairs where this entity's type is typeA
    for (const pair of collisionPairs) {
        if (state.type !== pair.typeA) continue;

        // For method=2 (ellipsoid), response=2 (slide)
        // SCP:CB mainly uses floor detection via CollisionY
        const results = checkEllipsoidCollision(ent, state, pair);
        state.collisions.push(...results);
    }
}

// Ellipsoid collision check - primarily for floor detection
function checkEllipsoidCollision(ent, state, pair) {
    const results = [];
    const pos = ent.obj.position;

    // Floor detection: cast ray downward from center of entity
    // The ellipsoid's center is at entity position, extends radiusY up and down
    const rayOrigin = new THREE.Vector3(pos.x, pos.y + state.radiusY, pos.z);
    const raycaster = new THREE.Raycaster();
    raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    raycaster.far = state.radiusY * 2 + 0.5;  // Check down through ellipsoid plus margin

    const hits = raycaster.intersectObject(collisionMesh, true);

    for (const hit of hits) {
        const blitzPos = threeToBlitz(hit.point);
        const normal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);

        results.push({
            x: blitzPos.x,
            y: blitzPos.y,
            z: blitzPos.z,
            nx: normal.x,
            ny: normal.y,
            nz: -normal.z,  // Convert to Blitz3D coords
            entity: 0  // HIT_MAP doesn't have specific entity ID
        });
    }

    // Also check cardinal directions for wall collisions
    const directions = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ];

    const wallOrigin = new THREE.Vector3(pos.x, pos.y, pos.z);

    for (const dir of directions) {
        raycaster.set(wallOrigin, dir);
        raycaster.far = state.radiusX + 0.1;

        const wallHits = raycaster.intersectObject(collisionMesh, true);
        for (const hit of wallHits) {
            if (hit.distance < state.radiusX) {
                const blitzPos = threeToBlitz(hit.point);
                const normal = hit.face ? hit.face.normal : dir.clone().negate();

                results.push({
                    x: blitzPos.x,
                    y: blitzPos.y,
                    z: blitzPos.z,
                    nx: normal.x,
                    ny: normal.y,
                    nz: -normal.z,
                    entity: 0
                });
            }
        }
    }

    return results;
}

function getSafeBuffer(data) {
    if (!data) return new ArrayBuffer(0);
    if (data instanceof ArrayBuffer) return data;
    if (data.buffer instanceof ArrayBuffer) return data.buffer;
    return new ArrayBuffer(0);
}

function readString(memory, ptr) {
    if (!ptr || !memory) return "";
    try {
        const buffer = getSafeBuffer(memory.buffer);
        const view = new DataView(buffer);
        const length = view.getInt32(ptr + 4, true);
        if (length <= 0 || length > 10000) return "";
        const bytes = new Uint8Array(buffer, ptr + 8, length);
        let str = "";
        for (let i = 0; i < length; i++) str += String.fromCharCode(bytes[i]);
        return str;
    } catch (e) {
        return "";
    }
}

function writeString(memory, ptr, str) {
    const buffer = getSafeBuffer(memory.buffer);
    const view = new DataView(buffer);
    view.setInt32(ptr, 0, true);
    view.setInt32(ptr + 4, str.length, true);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < str.length; i++) bytes[ptr + 8 + i] = str.charCodeAt(i);
    bytes[ptr + 8 + str.length] = 0;
}

function allocString(memory, str) {
    if (!memory) return 0;
    if (!heapPointers.has(memory)) heapPointers.set(memory, 1024 * 1024);
    let ptr = heapPointers.get(memory);
    const size = 8 + str.length + 4;
    if (ptr + size > memory.buffer.byteLength) {
        try {
            memory.grow(1);
        } catch (e) {
            return 0;
        }
    }
    writeString(memory, ptr, str);
    heapPointers.set(memory, (ptr + size + 3) & ~3);
    return ptr;
}

const RMESH_SCALE = 8.0 / 2048.0;

function rmeshToThree(x, y, z) {
    return new THREE.Vector3(-x * RMESH_SCALE, y * RMESH_SCALE, z * RMESH_SCALE);
}

function blitzToThree(x, y, z) {
    return new THREE.Vector3(x, y, -z);
}

function threeToBlitz(vec) {
    return { x: vec.x, y: vec.y, z: -vec.z };
}

function toWorldVector(x, y, z) {
    return blitzToThree(x, y, z);
}

function moveEntityLocal(ent, x, y, z) {
    const obj = ent.obj;
    const yaw = obj.rotation.y;
    const local = toWorldVector(x, y, z);
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const dx = local.x * cos - local.z * sin;
    const dz = local.x * sin + local.z * cos;
    obj.position.x += dx;
    obj.position.y += local.y;
    obj.position.z += dz;
}

function createDoorMesh(x, y, z, angle) {
    console.log(`Creating door mesh at ${x}, ${y}, ${z} angle ${angle}`);
    const geometry = new THREE.BoxGeometry(0.64, 1.28, 0.08);
    const texture = textureLoader.load('assets/Door01.jpg');
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.flipY = false;
    const material = new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff });
    const mesh = new THREE.Mesh(geometry, material);

    const group = new THREE.Group();
    group.add(mesh);
    const base = rmeshToThree(x, y, z);
    group.position.set(base.x, base.y + 1.05, base.z);
    group.rotation.y = angle * Math.PI / 180;
    scene.add(group);

    const colliderGeo = new THREE.BoxGeometry(0.64, 1.28, 0.15);
    const colliderMat = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(colliderGeo, colliderMat);
    group.add(collider);

    doorColliders.push(collider);

    return { group, mesh, collider, openState: 0, open: false };
}

const doors = new Map();
let nextDoorId = 1;

const getEnvFunctions = (memRefGetter) => ({
    PrintInt: (v) => console.log("BB:", v),
    PrintFloat: (v) => console.log("BB:", v.toFixed(4)),
    PrintString: (ptr) => console.log("BB:", readString(memRefGetter(), ptr)),
    Print: (ptr) => console.log("BB:", readString(memRefGetter(), ptr)),
    MilliSecs: () => performance.now() | 0,
    Graphics3D: (w, h, d, m) => { console.log(`Graphics3D ${w}x${h}`); },
    CreateCamera: (p) => {
        const id = nextEntityId++;
        entities.set(id, { obj: camera });
        return id;
    },
    CreatePivot: (p) => {
        const id = nextEntityId++;
        if (!playerEntityId) {
            playerEntityId = id;
            entities.set(id, { obj: cameraYaw });
        } else {
            const obj = new THREE.Object3D();
            scene.add(obj);
            entities.set(id, { obj });
        }
        return id;
    },
    PositionEntity: (e, x, y, z) => {
        const ent = entities.get(e);
        if (ent) {
            const pos = blitzToThree(x, y, z);
            ent.obj.position.set(pos.x, pos.y, pos.z);
        }
    },
    RotateEntity: (e, p, y, r) => {
        const ent = entities.get(e);
        if (!ent) return;
        ent.obj.rotation.set(p * Math.PI / 180, y * Math.PI / 180, r * Math.PI / 180);
    },
    EntityX: (e) => threeToBlitz(entities.get(e)?.obj.position || new THREE.Vector3()).x,
    EntityY: (e) => threeToBlitz(entities.get(e)?.obj.position || new THREE.Vector3()).y,
    EntityZ: (e) => threeToBlitz(entities.get(e)?.obj.position || new THREE.Vector3()).z,
    EntityYaw: (e) => entities.get(e)?.obj.rotation.y * 180 / Math.PI || 0,
    MoveEntity: (e, x, y, z) => {
        const ent = entities.get(e);
        if (!ent) return;
        moveEntityLocal(ent, x, y, z);
        // Update collisions after movement
        if (entityCollisionState.has(e)) {
            updateCollisions(e);
        }
    },
    TranslateEntity: (e, x, y, z, global) => {
        const ent = entities.get(e);
        if (!ent) return;

        if (global) {
            // Global translation - add offset directly in world coordinates
            ent.obj.position.add(blitzToThree(x, y, z));
        } else {
            // Local translation - relative to entity's orientation
            moveEntityLocal(ent, x, y, z);
        }

        // Update collisions after movement
        if (entityCollisionState.has(e)) {
            updateCollisions(e);
        }
    },
    AddEntity: (typePtr, x, y, z) => {
        // Enforce bounds to filter garbage
        if (isNaN(x) || isNaN(y) || isNaN(z)) return;
        if (Math.abs(x) > 5000 || Math.abs(y) > 5000 || Math.abs(z) > 5000) return;

        let originalType = readString(memRefGetter(), typePtr).toLowerCase();
        // aggressively clean the string
        let type = originalType.replace(/[^\x20-\x7E]/g, '');

        if (type.length === 0) {
            // console.log(`Empty Entity Type! ptr=${typePtr}`);
        }

        console.log(`Entity found (cleaned): '${type}' (raw len: ${originalType.length}) at ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`);

        const pos = rmeshToThree(x, y, z);
        if (pos.y < 0.5) pos.y = 1.5; // Fix low spawn
        if (type === "playerstart" || (type === "waypoint" && !window.playerSpawned)) {
            console.log("Spawn point found:", pos);
            spawnPoint = pos.clone();
            cameraYaw.position.copy(pos);
            window.playerSpawned = true;
        }
        if (type.includes("door")) {
            console.log(`Door detected via substring! '${type}'`);
            rmeshDoorPositions.push({ x, y, z });
        }
    },

    CreateMesh: () => {
        const id = nextMeshId++;
        meshes.set(id, { surfaces: [] });
        return id;
    },
    CreateSurface: (meshId) => {
        const mesh = meshes.get(meshId);
        if (!mesh) return 0;
        const id = nextSurfaceId++;
        const surf = { vertices: [], indices: [], uvs: [], uvs2: [], colors: [], meshId };
        surfaces.set(id, surf);
        mesh.surfaces.push(id);
        return id;
    },
    AddVertexExtended: (surfId, x, y, z, u, v, u2, v2, r, g, b) => {
        const surf = surfaces.get(surfId);
        if (!surf) return 0;
        const idx = surf.vertices.length / 3;
        const pos = rmeshToThree(x, y, z);
        surf.vertices.push(pos.x, pos.y, pos.z);
        surf.uvs.push(u, v);
        surf.uvs2.push(u2, v2);
        return idx;
    },
    AddTriangle: (surfId, v0, v1, v2) => {
        const surf = surfaces.get(surfId);
        if (surf) surf.indices.push(v0, v1, v2);
    },
    SetSurfaceTexture: (surfId, pathPtr) => {
        const surf = surfaces.get(surfId);
        if (surf) surf.texturePath = readString(memRefGetter(), pathPtr);
    },
    SetSurfaceLightmap: (surfId, pathPtr) => {
        const surf = surfaces.get(surfId);
        if (surf) surf.lightmapPath = readString(memRefGetter(), pathPtr);
    },
    AddCollisionVertex: (x, y, z) => {
        const pos = rmeshToThree(x, y, z);
        collisionVertices.push(pos.x, pos.y, pos.z);
    },
    AddCollisionTriangle: (v0, v1, v2) => {
        collisionIndices.push(v0, v2, v1);
    },
    KeyDown: (k) => {
        const map = {
            17: 'KeyW', 31: 'KeyS', 30: 'KeyA', 32: 'KeyD',
            200: 'ArrowUp', 208: 'ArrowDown', 203: 'ArrowLeft', 205: 'ArrowRight',
            57: 'Space', 42: 'ShiftLeft', 54: 'ShiftRight', 18: 'KeyE'
        };
        return keys[map[k]] ? 1 : 0;
    },
    KeyHit: (k) => {
        const map = {
            17: 'KeyW', 31: 'KeyS', 30: 'KeyA', 32: 'KeyD',
            200: 'ArrowUp', 208: 'ArrowDown', 203: 'ArrowLeft', 205: 'ArrowRight',
            57: 'Space', 42: 'ShiftLeft', 54: 'ShiftRight', 18: 'KeyE'
        };
        const code = map[k];
        if (!code) return 0;
        if (keyHits.has(code)) {
            keyHits.delete(code);
            return 1;
        }
        return 0;
    },
    ReadFile: (pathPtr) => {
        const path = readString(memRefGetter(), pathPtr);
        if (!path) return 0;
        const filename = path.split(/[\\/]/).pop().toLowerCase();
        const buffer = virtualFiles.get(filename);
        if (buffer) {
            const id = nextFileId++;
            openFiles.set(id, { buffer, cursor: 0 });
            return id;
        }
        return 0;
    },
    ReadByte: (id) => {
        const f = openFiles.get(id);
        if (!f || f.cursor >= f.buffer.byteLength) return 0;
        return new Uint8Array(getSafeBuffer(f.buffer))[f.cursor++];
    },
    ReadInt: (id) => {
        const f = openFiles.get(id);
        if (!f || f.cursor + 4 > f.buffer.byteLength) return 0;
        const v = new DataView(getSafeBuffer(f.buffer)).getInt32(f.cursor, true);
        f.cursor += 4;
        return v;
    },
    ReadFloat: (id) => {
        const f = openFiles.get(id);
        if (!f || f.cursor + 4 > f.buffer.byteLength) return 0;
        const v = new DataView(getSafeBuffer(f.buffer)).getFloat32(f.cursor, true);
        f.cursor += 4;
        return v;
    },
    ReadString: (id) => {
        const f = openFiles.get(id);
        if (!f || f.cursor + 4 > f.buffer.byteLength) return allocString(memRefGetter(), "");
        const len = new DataView(getSafeBuffer(f.buffer)).getInt32(f.cursor, true);
        f.cursor += 4;
        if (len <= 0 || len > 10000 || f.cursor + len > f.buffer.byteLength) return allocString(memRefGetter(), "");
        const bytes = new Uint8Array(getSafeBuffer(f.buffer), f.cursor, len);
        const str = new TextDecoder().decode(bytes);
        f.cursor += len;
        return allocString(memRefGetter(), str);
    },
    Eof: (id) => {
        const f = openFiles.get(id);
        return (!f || f.cursor >= f.buffer.byteLength) ? 1 : 0;
    },
    CloseFile: (id) => openFiles.delete(id),
    Len: (p) => readString(memRefGetter(), p).length,
    StringEqual: (p1, p2) => readString(memRefGetter(), p1) === readString(memRefGetter(), p2) ? 1 : 0,
    IntToString: (v) => allocString(memRefGetter(), v.toString()),
    FloatToString: (v) => allocString(memRefGetter(), v.toFixed(4)),
    StringConcat: (p1, p2) => allocString(memRefGetter(), readString(memRefGetter(), p1) + readString(memRefGetter(), p2)),
    Sin: (v) => Math.sin(v * Math.PI / 180),
    Cos: (v) => Math.cos(v * Math.PI / 180),
    Sqr: (v) => Math.sqrt(v),
    Cls: () => { },
    ClsColor: () => { },
    Color: () => { },
    GetColor: () => 0,
    UpdateWorld: () => { },
    RenderWorld: () => { },
    Flip: () => { },

    // Math functions
    Abs: (v) => Math.abs(v),
    Min: (a, b) => Math.min(a, b),
    Max: (a, b) => Math.max(a, b),
    Floor: (v) => Math.floor(v),
    Ceil: (v) => Math.ceil(v),
    Sgn: (v) => Math.sign(v),
    Mod: (a, b) => a % b,
    Tan: (v) => Math.tan(v * Math.PI / 180),
    ASin: (v) => Math.asin(v) * 180 / Math.PI,
    ACos: (v) => Math.acos(v) * 180 / Math.PI,
    ATan: (v) => Math.atan(v) * 180 / Math.PI,
    ATan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI,
    Exp: (v) => Math.exp(v),
    Log: (v) => Math.log(v),
    Log10: (v) => Math.log10(v),
    Pow: (base, exp) => Math.pow(base, exp),
    Rnd: (lo, hi) => lo + Math.random() * (hi - lo),
    Rand: (lo, hi) => Math.floor(lo + Math.random() * (hi - lo + 1)),
    SeedRnd: (seed) => { /* JS random can't be seeded */ },

    // String functions
    Left: (p, n) => allocString(memRefGetter(), readString(memRefGetter(), p).slice(0, n)),
    Right: (p, n) => allocString(memRefGetter(), readString(memRefGetter(), p).slice(-n)),
    Mid: (p, start, len) => allocString(memRefGetter(), readString(memRefGetter(), p).slice(start - 1, start - 1 + (len || 999999))),
    Upper: (p) => allocString(memRefGetter(), readString(memRefGetter(), p).toUpperCase()),
    Lower: (p) => allocString(memRefGetter(), readString(memRefGetter(), p).toLowerCase()),
    Trim: (p) => allocString(memRefGetter(), readString(memRefGetter(), p).trim()),
    LTrim: (p) => allocString(memRefGetter(), readString(memRefGetter(), p).trimStart()),
    RTrim: (p) => allocString(memRefGetter(), readString(memRefGetter(), p).trimEnd()),
    Replace: (p, find, repl) => allocString(memRefGetter(), readString(memRefGetter(), p).replaceAll(readString(memRefGetter(), find), readString(memRefGetter(), repl))),
    Instr: (p, find, start) => readString(memRefGetter(), p).indexOf(readString(memRefGetter(), find), (start || 1) - 1) + 1,
    Asc: (p) => readString(memRefGetter(), p).charCodeAt(0) || 0,
    Chr: (code) => allocString(memRefGetter(), String.fromCharCode(code)),
    Hex: (v) => allocString(memRefGetter(), v.toString(16).toUpperCase()),
    Bin: (v) => allocString(memRefGetter(), (v >>> 0).toString(2)),

    // Mouse input
    MouseX: () => window.mouseX || 0,
    MouseY: () => window.mouseY || 0,
    MouseZ: () => 0,
    MouseDown: (btn) => (window.mouseButtons || 0) & (1 << (btn - 1)) ? 1 : 0,
    MouseHit: (btn) => { const hit = (window.mouseHits || 0) & (1 << (btn - 1)); window.mouseHits &= ~(1 << (btn - 1)); return hit ? 1 : 0; },
    MouseXSpeed: () => window.mouseXSpeed || 0,
    MouseYSpeed: () => window.mouseYSpeed || 0,
    MoveMouse: (x, y) => { /* handled by pointer lock */ },
    HidePointer: () => { },
    ShowPointer: () => { },

    // Utility
    Delay: (ms) => { /* can't block in JS */ },
    WaitKey: () => 0,
    MilliCSecs: () => performance.now(),
    MilliSecs2: () => performance.now(),
    CurrentDate: () => allocString(memRefGetter(), new Date().toLocaleDateString()),
    DebugLog: (p) => console.log('[BB DEBUG]', readString(memRefGetter(), p)),
    RuntimeError: (p) => { throw new Error(readString(memRefGetter(), p)); },
    CatchErrors: () => { },

    // Angle/curve helpers
    WrapAngle: (a) => ((a % 360) + 360) % 360,
    CurveValue: (newVal, curVal, rate) => rate <= 0 ? newVal : curVal + (newVal - curVal) / rate,
    CurveAngle: (newA, curA, rate) => {
        let diff = ((newA - curA + 180) % 360) - 180;
        if (diff < -180) diff += 360;
        return rate <= 0 ? newA : curA + diff / rate;
    },
    Distance: (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2),
    Point_Direction: (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI,

    // Entity stubs (no-op for now)
    FreeEntity: () => { },
    CopyEntity: () => 0,
    HideEntity: () => { },
    ShowEntity: () => { },
    EntityAlpha: () => { },
    EntityColor: () => { },
    EntityFX: () => { },
    EntityBlend: () => { },
    EntityOrder: () => { },
    EntityAutoFade: () => { },
    EntityPitch: () => 0,
    EntityRoll: () => 0,
    EntityDistance: (e1, e2) => 0,
    EntityVisible: () => 1,
    EntityInView: () => 1,
    PointEntity: () => { },
    ScaleEntity: () => { },
    TurnEntity: () => { },
    NameEntity: () => { },
    EntityName: () => allocString(memRefGetter(), ""),
    EntityParent: () => { },
    GetParent: () => 0,
    EntityClass: () => allocString(memRefGetter(), ""),
    AlignToVector: () => { },

    // Graphics stubs
    Rect: () => { },
    Oval: () => { },
    Line: () => { },
    Text: () => { },
    LoadImage: () => 0,
    DrawImage: () => { },
    DrawBlock: () => { },
    TileImage: () => { },
    ImageWidth: () => 0,
    ImageHeight: () => 0,
    HandleImage: () => { },
    MidHandle: () => { },
    AutoMidHandle: () => { },
    MaskImage: () => { },
    ScaleImage: () => { },
    ResizeImage: () => { },
    FreeImage: () => { },
    LoadFont: () => 0,
    SetFont: () => { },
    FreeFont: () => { },

    // Sound stubs
    LoadSound: () => 0,
    PlaySound: () => 0,
    FreeSound: () => { },
    StopChannel: () => { },
    ChannelVolume: () => { },
    ChannelPaused: () => 0,
    ChannelPlaying: () => 0,

    // Camera/Light stubs
    CreateLight: () => 0,
    AmbientLight: () => { },
    LightColor: () => { },
    LightRange: () => { },
    CameraClsColor: () => { },
    CameraRange: () => { },
    CameraZoom: () => { },
    CameraProjMode: () => { },
    CameraViewport: () => { },
    CameraProject: () => { },
    FogMode: () => { },
    FogColor: () => { },
    FogRange: () => { },
    FogDensity: () => { },

    // Collision stubs
    ClearCollisions: () => { collisionPairs.length = 0; },
    EntityBox: () => { },
    CollisionTime: () => 0,
    CollisionSurface: () => 0,
    CollisionTriangle: () => 0,
    EntityCollided: () => 0,

    // Transform stubs
    TFormPoint: () => { },
    TFormVector: () => { },
    TFormNormal: () => { },
    TFormedX: () => 0,
    TFormedY: () => 0,
    TFormedZ: () => 0,

    // Animation stubs
    Animate: () => { },
    SetAnimTime: () => { },
    AnimTime: () => 0,
    AnimLength: () => 0,
    ExtractAnimSeq: () => 0,
    AddAnimSeq: () => 0,
    AnimSeq: () => 0,
    Animating: () => 0,
    Animate2: () => { },
    LoadAnimMesh: () => 0,
    LoadAnimMesh_Strict: () => 0,

    // Mesh stubs
    LoadMesh: () => 0,
    LoadMesh_Strict: () => 0,
    CountSurfaces: () => 0,
    GetSurface: () => 0,
    AddVertex: () => 0,
    VertexColor: () => { },
    VertexTexCoords: () => { },
    UpdateNormals: () => { },
    CreateCube: () => 0,
    CreateSphere: () => 0,
    CreatePlane: () => 0,

    // Texture stubs
    LoadTexture: () => 0,
    LoadTexture_Strict: () => 0,
    TextureWidth: () => 0,
    TextureHeight: () => 0,
    FreeTexture: () => { },
    TextureBlend: () => { },
    TextureCoords: () => { },
    ScaleTexture: () => { },
    PositionTexture: () => { },
    RotateTexture: () => { },
    EntityTexture: () => { },

    // Brush stubs
    CreateBrush: () => 0,
    BrushColor: () => { },
    BrushAlpha: () => { },
    BrushShininess: () => { },
    BrushTexture: () => { },
    BrushFX: () => { },
    BrushBlend: () => { },
    FreeBrush: () => { },
    PaintEntity: () => { },
    PaintMesh: () => { },
    PaintSurface: () => { },
    EntityShininess: () => { },

    // Child/hierarchy stubs
    CountChildren: () => 0,
    GetChild: () => 0,
    FindChild: () => 0,

    // Sprite stubs
    CreateSprite: () => 0,
    ScaleSprite: () => { },
    SpriteViewMode: () => { },

    // Bank stubs
    CreateBank: () => 0,
    FreeBank: () => { },
    BankSize: () => 0,
    ResizeBank: () => { },
    CopyBank: () => { },
    PeekByte: () => 0,
    PokeByte: () => { },
    PeekInt: () => 0,
    PokeInt: () => { },
    PeekFloat: () => 0,
    PokeFloat: () => { },
    PeekShort: () => 0,
    PokeShort: () => { },

    // File stubs
    OpenFile: (p) => 0,
    WriteFile: (p) => 0,
    ReadShort: () => 0,
    WriteInt: () => { },
    WriteFloat: () => { },
    WriteString: () => { },
    WriteByte: () => { },
    WriteShort: () => { },
    SeekFile: () => { },
    FilePos: () => 0,
    FileSize: () => 0,
    FileType: () => 0,
    ReadData: () => { },
    RestoreData: () => { },

    // FMOD stubs
    FSOUND_Init: () => 1,
    FSOUND_Close: () => { },
    FSOUND_Stream_Open: () => 0,
    FSOUND_Stream_Play: () => 0,
    FSOUND_Stream_Stop: () => { },
    FSOUND_SetVolume: () => { },
    FSOUND_SetPaused: () => { },
    Sound3D: () => 0,
    SetListenerLocation: () => { },

    // OpenAL stubs
    alInit: () => 1,
    alGetAvailableDeviceCount: () => 0,
    alGetAvailableDeviceName: () => allocString(memRefGetter(), ""),
    alDeviceInit: () => 1,
    alGetNumSources: () => 0,
    alDestroy: () => { },
    alUpdate: () => { },
    alListenerSetPosition: () => { },
    alListenerSetDirection: () => { },
    alListenerSetUp: () => { },
    alListenerSetVelocity: () => { },
    alListenerSetMasterVolume: () => { },
    alCreateBuffer: () => 0,
    alFreeBuffer: () => { },
    alCreateSource: () => 0,
    alCreateSource_: () => 0,
    alFreeSource: () => { },
    alSourcePlay: () => { },
    alSourcePlay_: () => { },
    alSourcePlay2D: () => { },
    alSourcePlay2D_: () => { },
    alSourcePlay3D: () => { },
    alSourcePlay3D_: () => { },
    alSourcePause: () => { },
    alSourceResume: () => { },
    alSourceStop: () => { },
    alSourceIsPlaying: () => 0,
    alSourceIsPaused: () => 0,
    alSourceIsStopped: () => 1,
    alSourceSetVolume: () => { },
    alSourceSetPitch: () => { },
    alSourceSetLoop: () => { },
    alSourceSeek: () => { },
    alSourceGetAudioTime: () => 0,
    alSourceGetLenght: () => 0,
    alSourceSet3DPosition: () => { },
    alSourceSetRolloffFactor: () => { },
    alCreateEffect: () => 0,
    alFreeEffect: () => { },
    alEffectSetEAXReverb: () => { },

    // Asset loading stubs
    LoadAsset: () => 0,
    GetAssetData: () => 0,
    GetAssetSize: () => 0,

    // Network stubs
    OpenTCPStream: () => 0,
    CloseTCPStream: () => { },
    WriteLine: () => { },
    ReadLine: () => allocString(memRefGetter(), ""),
    ReadAvail: () => 0,
    SendNetMsg: () => { },

    // Mesh parsing stubs
    ParseB3D: () => 0,
    ParseRMesh: () => 0,
    GetMeshSurfaceCount: () => 0,
    GetSurfaceVertexCount: () => 0,
    GetSurfaceIndexCount: () => 0,
    GetSurfaceVerticesPtr: () => 0,
    GetSurfaceIndicesPtr: () => 0,

    // ZIP stubs
    ZlibWapi_Open: () => 0,
    ZlibWapi_Close: () => { },
    ZlibWapi_GetFileCount: () => 0,
    ZlibWapi_GetFileName: () => allocString(memRefGetter(), ""),
    ZlibWapi_ExtractFile: () => 0,

    // Movie stubs
    OpenMovie: () => 0,
    DrawMovie: () => { },
    MoviePlaying: () => 0,

    // Strict loading stubs
    LoadSound_Strict: () => 0,
    LoadImage_Strict: () => 0,
    FreeSound_Strict: () => { },
    LoadTempSound: () => 0,
    PlaySound_Strict: () => 0,
    LoopSound2: () => 0,

    // Particle stubs
    CreateParticle: () => 0,
    UpdateParticles: () => { },
    RemoveParticle: () => { },
    ParticleTextures: () => { },
    SetEmitter: () => { },
    UpdateEmitters: () => { },
    DeleteDevilEmitters: () => { },
    UpdateDevilEmitters: () => { },
    CreateDecal: () => 0,
    UpdateDecals: () => { },

    // Game-specific stubs
    GiveAchievement: () => { },
    Update294: () => { },
    UpdateItems: () => { },
    PickItem: () => 0,
    DropItem: () => { },
    AnimateNPC: () => { },
    ChangeNPCTextureID: () => { },
    CheckForNPCInFacility: () => 0,
    Console_SpawnNPC: () => { },
    CreateConsoleMsg: () => { },
    ChangeAngleValueForCorrectBoneAssigning: () => 0,

    // Stat/debug
    CountFPS: () => 60,
    PerformanceStats: () => { },
    Kill: () => { },
    DoorCreate: (x, y, z, angle) => {
        const door = createDoorMesh(x, y, z, angle);
        const id = nextDoorId++;
        doors.set(id, door);
        return id;
    },
    DoorSetOpenState: (id, openState, open) => {
        const door = doors.get(id);
        if (!door) return;
        const offset = Math.sin(openState * Math.PI / 180) * 0.6;
        door.mesh.position.set(offset, 0, 0);
        door.openState = openState;
        door.open = !!open;
        door.collider.visible = !open || openState < 90;
    },

    // ========== Collision Configuration APIs ==========
    Collisions: (typeA, typeB, method, response) => {
        collisionPairs.push({ typeA, typeB, method, response });
    },

    EntityType: (entity, type) => {
        getOrCreateCollisionState(entity).type = type;
    },

    EntityPickMode: (entity, mode) => {
        getOrCreateCollisionState(entity).pickMode = mode;
    },

    EntityRadius: (entity, rx, ry, rz) => {
        // Blitz3D: EntityRadius entity, rx[, ry]
        // If ry not provided, it defaults to rx. rz is always same as rx.
        if (ry === undefined || ry === 0) ry = rx;
        if (rz === undefined || rz === 0) rz = rx;
        const state = getOrCreateCollisionState(entity);
        state.radiusX = rx;
        state.radiusY = ry;
        state.radiusZ = rz;
    },

    ResetEntity: (entity) => {
        const state = entityCollisionState.get(entity);
        if (state) state.collisions = [];
    },

    // ========== Collision Query APIs ==========
    CountCollisions: (entity) => {
        return entityCollisionState.get(entity)?.collisions.length || 0;
    },

    CollisionX: (entity, index) => {
        return entityCollisionState.get(entity)?.collisions[index - 1]?.x || 0;
    },

    CollisionY: (entity, index) => {
        return entityCollisionState.get(entity)?.collisions[index - 1]?.y || 0;
    },

    CollisionZ: (entity, index) => {
        return entityCollisionState.get(entity)?.collisions[index - 1]?.z || 0;
    },

    CollisionNX: (entity, index) => {
        return entityCollisionState.get(entity)?.collisions[index - 1]?.nx || 0;
    },

    CollisionNY: (entity, index) => {
        return entityCollisionState.get(entity)?.collisions[index - 1]?.ny || 0;
    },

    CollisionNZ: (entity, index) => {
        return entityCollisionState.get(entity)?.collisions[index - 1]?.nz || 0;
    },

    CollisionEntity: (entity, index) => {
        return entityCollisionState.get(entity)?.collisions[index - 1]?.entity || 0;
    },

    GetEntityType: (entity) => {
        return entityCollisionState.get(entity)?.type || 0;
    },

    // ========== Picking (Raycasting) APIs ==========
    LinePick: (x, y, z, dx, dy, dz, radius) => {
        if (!collisionMesh) return 0;

        const origin = blitzToThree(x, y, z);
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length < 0.0001) return 0;

        const dir = blitzToThree(dx, dy, dz).normalize();

        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, dir);
        raycaster.far = length;

        const hits = raycaster.intersectObject(collisionMesh, true);
        if (hits.length > 0) {
            const hit = hits[0];
            const blitzPos = threeToBlitz(hit.point);
            const normal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);
            lastPick = {
                x: blitzPos.x,
                y: blitzPos.y,
                z: blitzPos.z,
                nx: normal.x,
                ny: normal.y,
                nz: -normal.z,  // Convert back to Blitz3D coords
                entity: 1  // Return truthy value for HIT_MAP
            };
            return lastPick.entity;
        }
        lastPick = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, entity: 0 };
        return 0;
    },

    PickedX: () => lastPick.x,
    PickedY: () => lastPick.y,
    PickedZ: () => lastPick.z,
    PickedNX: () => lastPick.nx,
    PickedNY: () => lastPick.ny,
    PickedNZ: () => lastPick.nz,
    PickedEntity: () => lastPick.entity,

    EntityPick: (entity, range) => {
        const ent = entities.get(entity);
        if (!ent || !collisionMesh) return 0;

        const pos = ent.obj.position.clone();
        // Get forward direction from entity rotation (Blitz3D forward is -Z)
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(ent.obj.quaternion);

        const raycaster = new THREE.Raycaster();
        raycaster.set(pos, dir);
        raycaster.far = range;

        const hits = raycaster.intersectObject(collisionMesh, true);
        if (hits.length > 0) {
            const hit = hits[0];
            const blitzPos = threeToBlitz(hit.point);
            const normal = hit.face ? hit.face.normal : new THREE.Vector3(0, 1, 0);
            lastPick = {
                x: blitzPos.x,
                y: blitzPos.y,
                z: blitzPos.z,
                nx: normal.x,
                ny: normal.y,
                nz: -normal.z,
                entity: 1
            };
            return lastPick.entity;
        }
        lastPick = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, entity: 0 };
        return 0;
    }
});

function buildThreeJSMesh(meshId) {
    const meshData = meshes.get(meshId);
    if (!meshData) return;
    const group = new THREE.Group();
    for (const surfId of meshData.surfaces) {
        const surf = surfaces.get(surfId);
        if (!surf || surf.vertices.length === 0) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(surf.vertices, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(surf.uvs, 2));
        if (surf.uvs2 && surf.uvs2.length > 0) geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(surf.uvs2, 2));
        geometry.setIndex(surf.indices);
        geometry.computeVertexNormals();
        let map = null;
        if (surf.texturePath) {
            const texName = surf.texturePath.split(/[\\/]/).pop().replace(/\.bmp$/i, '.png');
            map = textureLoader.load(`assets/${texName}`);
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.flipY = false;
        }
        let lightMap = null;
        if (surf.lightmapPath) {
            const lmName = surf.lightmapPath.split(/[\\/]/).pop().replace(/\.bmp$/i, '.png');
            lightMap = textureLoader.load(`assets/${lmName}`);
            lightMap.flipY = false;
        }
        group.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
            map, lightMap, lightMapIntensity: 0.4, side: THREE.DoubleSide, color: map ? 0xffffff : 0xcccccc
        })));
    }
    scene.add(group);
    currentMeshObject = group;

    // Use visual mesh for collision (the loaded collision block is often incomplete)
    // The visual mesh group contains all the room geometry needed for proper collision
    collisionMesh = group;

    // Compute bounds from the visual mesh
    const box = new THREE.Box3().setFromObject(group);
    collisionMinX = box.min.x;
    collisionMaxX = box.max.x;
    collisionMinY = box.min.y;
    collisionMaxY = box.max.y;
    collisionMinZ = box.min.z;
    collisionMaxZ = box.max.z;

    console.log(`Using visual mesh for collision. Bounds: Y=${collisionMinY.toFixed(2)}..${collisionMaxY.toFixed(2)}`);

    // Also build the explicit collision mesh if data exists (for debugging with 'C' key)
    if (collisionVertices.length > 0) {
        console.log(`Explicit collision block: ${collisionVertices.length / 3} vertices, ${collisionIndices.length / 3} triangles`);
        const collGeo = new THREE.BufferGeometry();
        collGeo.setAttribute('position', new THREE.Float32BufferAttribute(collisionVertices, 3));
        collGeo.setIndex(collisionIndices);
        const explicitCollisionMesh = new THREE.Mesh(
            collGeo,
            new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, side: THREE.DoubleSide, visible: false })
        );
        scene.add(explicitCollisionMesh);
    }

    placePlayerOnGround();

    if (rmeshDoorPositions.length) {
        for (const pos of rmeshDoorPositions) {
            const id = nextDoorId++;
            const door = createDoorMesh(pos.x, pos.y, pos.z, 0);
            doors.set(id, door);
            doorStates.push({ id, open: false, openState: 0 });
        }
    }
}

function resetRMeshState() {
    if (currentMeshObject) {
        scene.remove(currentMeshObject);
        currentMeshObject = null;
    }
    if (collisionMesh) {
        scene.remove(collisionMesh);
        collisionMesh = null;
    }
    collisionMinY = collisionMaxY = null;
    collisionMinX = collisionMaxX = null;
    collisionMinZ = collisionMaxZ = null;
    collisionVertices.length = 0;
    collisionIndices.length = 0;
    meshes.clear();
    surfaces.clear();
    nextMeshId = 1;
    nextSurfaceId = 1;
    console.log("RESETTING RMESH STATE");
    rmeshDoorPositions.length = 0;
    for (const door of doors.values()) {
        scene.remove(door.group);
    }
    doors.clear();
    doorColliders.length = 0;
    doorStates.length = 0;
    spawnPoint = null;
    window.playerSpawned = false;
}

async function loadRMesh(name) {
    resetRMeshState();
    currentMeshName = name;
    status.textContent = `LOADING ${name}...`;

    const res = await fetch(`assets/${name}`);
    if (!res.ok) throw new Error(`Failed to load ${name}`);
    virtualFiles.set(name.toLowerCase(), await res.arrayBuffer());

    activeMemory = loaderExports.memory;
    const ptr = allocString(loaderExports.memory, name);
    const meshLoadFunc = loaderExports["LoadRMesh%"] || loaderExports["loadrmesh"];
    if (meshLoadFunc) {
        const meshId = meshLoadFunc(ptr);
        if (meshId) buildThreeJSMesh(meshId);

        if (name.includes('room2cafeteria')) {
            console.log("Spawning Door from Door01.x for Cafeteria");
            // Door at the black doorway - user at ~0.1, 0.7, 2.9
            loadDoorXMesh(0.0, 0.0, 3.5, 0).then(door => {
                if (door) {
                    const id = nextDoorId++;
                    doors.set(id, door);
                    doorStates.push({ id, open: false, openState: 0 });
                    console.log(`X Door ${id} loaded and registered at 0.0, 0.0, 3.5`);
                }
            });
        }
    }
    status.textContent = "READY. CLICK TO START.";
}

function placePlayerOnGround() {
    if (!collisionMesh) return;
    let target = spawnPoint ? spawnPoint.clone() : null;

    if (!target && collisionMinX !== null && collisionMaxX !== null && collisionMinZ !== null && collisionMaxZ !== null) {
        const baseY = (collisionMaxY !== null) ? collisionMaxY + 50 : 200;
        const samples = 5;
        let best = null;

        for (let ix = 0; ix < samples; ix++) {
            const tX = ix / (samples - 1);
            const x = collisionMinX + (collisionMaxX - collisionMinX) * tX;
            for (let iz = 0; iz < samples; iz++) {
                const tZ = iz / (samples - 1);
                const z = collisionMinZ + (collisionMaxZ - collisionMinZ) * tZ;
                const origin = new THREE.Vector3(x, baseY, z);
                floorRaycaster.set(origin, new THREE.Vector3(0, -1, 0));
                floorRaycaster.far = 800;
                const hits = floorRaycaster.intersectObject(collisionMesh, true);
                if (!hits.length) continue;
                const hit = hits.reduce((best, h) => (h.point.y < best.point.y ? h : best), hits[0]);
                const candidate = new THREE.Vector3(hit.point.x, hit.point.y + playerHeight, hit.point.z);
                let blocked = false;
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
                    wallRaycaster.set(new THREE.Vector3(candidate.x, candidate.y - playerHeight + 0.5, candidate.z), dir);
                    wallRaycaster.far = playerRadius + 0.05;
                    const wHits = wallRaycaster.intersectObject(collisionMesh, true);
                    if (wHits.length > 0 && wHits[0].distance < playerRadius) {
                        blocked = true;
                        break;
                    }
                }
                if (!blocked) {
                    best = candidate;
                    break;
                }
            }
            if (best) break;
        }

        if (best) target = best;
    }

    if (!target && collisionMinY !== null) {
        target = new THREE.Vector3(0, collisionMinY, 0);
    }

    if (target) {
        cameraYaw.position.copy(target);
        velocity.set(0, 0, 0);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    if (!animate.lastTime) animate.lastTime = now;
    const delta = Math.min((now - animate.lastTime) / 1000, 0.1);
    animate.lastTime = now;

    if (document.pointerLockElement === container) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= velocity.y * 10.0 * delta;

        direction.z = Number(moveBackward) - Number(moveForward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.y = Number(moveUp) - Number(moveDown);
        if (direction.lengthSq() > 0) {
            direction.normalize();
        } else {
            direction.set(0, 0, 0);
        }

        let currentSpeed = moveSpeed;
        if (moveDown) currentSpeed *= 2.5;

        if (moveForward || moveBackward) velocity.z -= direction.z * currentSpeed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * currentSpeed * delta;
        if (moveUp || moveDown) velocity.y += direction.y * moveSpeed * delta;

        if (!Number.isFinite(delta)) return;

        // Store position before movement for collision
        const prevPos = cameraYaw.position.clone();

        // Apply horizontal movement
        cameraYaw.translateX(-velocity.x * delta);
        cameraYaw.translateZ(-velocity.z * delta);

        if (collisionMesh) {
            const maxStepHeight = 0.5;  // Max height player can step up (like stairs)
            const feetY = cameraYaw.position.y - playerHeight;

            // Sample multiple points for floor detection (center + movement direction)
            // This allows detecting stairs ahead of the player
            const samplePoints = [
                cameraYaw.position.clone(),  // Center
            ];

            // Add sample point in movement direction
            const moveDir = new THREE.Vector3(
                cameraYaw.position.x - prevPos.x,
                0,
                cameraYaw.position.z - prevPos.z
            );
            if (moveDir.lengthSq() > 0.0001) {
                moveDir.normalize();
                const aheadPoint = cameraYaw.position.clone();
                aheadPoint.x += moveDir.x * playerRadius;
                aheadPoint.z += moveDir.z * playerRadius;
                samplePoints.push(aheadPoint);
            }

            // Find best floor from all sample points
            let bestFloorY = null;
            for (const samplePoint of samplePoints) {
                const rayOrigin = samplePoint.clone();
                rayOrigin.y = cameraYaw.position.y + 2.0;  // Start from above head
                floorRaycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
                floorRaycaster.far = 10;

                const intersects = floorRaycaster.intersectObject(collisionMesh, true);
                for (const hit of intersects) {
                    const hitY = hit.point.y;
                    // Accept floors we can step onto (within step height above current feet)
                    // or any floor below us
                    if (hitY <= feetY + maxStepHeight) {
                        if (bestFloorY === null || hitY > bestFloorY) {
                            bestFloorY = hitY;
                        }
                    }
                }
            }

            lastFloorHit = bestFloorY !== null;
            if (bestFloorY !== null) {
                lastFloorY = bestFloorY;
                grounded = true;
                floorGrace = 0.15;
            } else {
                // Fallback: cast longer ray to find any floor below
                const rayOrigin = cameraYaw.position.clone();
                rayOrigin.y += 2.0;
                floorRaycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
                floorRaycaster.far = 100;
                const intersects = floorRaycaster.intersectObject(collisionMesh, true);
                if (intersects.length > 0) {
                    // Find highest floor
                    let highest = intersects[0];
                    for (const hit of intersects) {
                        if (hit.point.y > highest.point.y) highest = hit;
                    }
                    lastFloorY = highest.point.y;
                    lastFloorHit = true;
                }
                floorGrace = Math.max(0, floorGrace - delta);
                grounded = floorGrace > 0 && lastFloorY !== null;
            }

            // Handle jump
            if (grounded && wantJump && canJump) {
                velocity.y = jumpForce;
                canJump = false;
                grounded = false;
                wantJump = false;
            }

            if (grounded && lastFloorY !== null) {
                canJump = true;  // Can jump again when grounded
                const targetY = lastFloorY + playerHeight;
                const currentY = cameraYaw.position.y;
                const diff = targetY - currentY;

                if (Math.abs(diff) < 0.01) {
                    // Close enough, snap
                    cameraYaw.position.y = targetY;
                    velocity.y = 0;
                } else if (diff > 0 && diff < maxStepHeight) {
                    // Stepping up (stairs) - smooth interpolation
                    cameraYaw.position.y += diff * Math.min(15 * delta, 1);
                    velocity.y = 0;
                } else if (diff < 0 && diff > -0.5) {
                    // Stepping down - smooth interpolation
                    cameraYaw.position.y += diff * Math.min(20 * delta, 1);
                    velocity.y = 0;
                } else if (currentY > targetY) {
                    // Falling
                    velocity.y -= gravity * delta;
                    cameraYaw.position.y += velocity.y * delta;
                    if (cameraYaw.position.y < targetY) {
                        cameraYaw.position.y = targetY;
                        velocity.y = 0;
                    }
                } else {
                    // Below floor somehow, push up
                    cameraYaw.position.y = targetY;
                    velocity.y = 0;
                }
            } else {
                velocity.y -= gravity * delta;
                cameraYaw.position.y += velocity.y * delta;
            }
        } else {
            velocity.y -= gravity * delta;
            cameraYaw.position.y += velocity.y * delta;
        }

        if (collisionMesh) {
            const targets = [collisionMesh, ...doorColliders.filter(c => c.visible)];
            const feetY = cameraYaw.position.y - playerHeight;

            // Wall collision at two heights (lower body and upper body)
            const heights = [0.2, 0.5];
            const numAngles = 8;

            for (const h of heights) {
                const origin = new THREE.Vector3(cameraYaw.position.x, feetY + h, cameraYaw.position.z);
                for (let i = 0; i < numAngles; i++) {
                    const angle = (i / numAngles) * Math.PI * 2;
                    const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                    wallRaycaster.set(origin, dir);
                    wallRaycaster.far = playerRadius + 0.05;
                    const hits = wallRaycaster.intersectObjects(targets, true);
                    if (hits.length > 0 && hits[0].distance < playerRadius) {
                        const pushback = playerRadius - hits[0].distance + 0.005;
                        cameraYaw.position.x -= dir.x * pushback;
                        cameraYaw.position.z -= dir.z * pushback;
                    }
                }
            }
        }

        if (!Number.isFinite(cameraYaw.position.x) || !Number.isFinite(cameraYaw.position.y) || !Number.isFinite(cameraYaw.position.z)) {
            cameraYaw.position.set(0, playerHeight, 0);
            velocity.set(0, 0, 0);
        }
    }

    if (keyHits.has('KeyE')) {
        console.log(`Interaction Key (E) Detected. Player: ${cameraYaw.position.x.toFixed(2)}, ${cameraYaw.position.y.toFixed(2)}, ${cameraYaw.position.z.toFixed(2)}. Doors count: ${doors.size}`);
        keyHits.delete('KeyE');
        const pos = cameraYaw.position;
        let closest = null;
        let closestDist = 2.0;
        for (const [id, door] of doors) {
            const dpos = door.group.position;
            const dx = pos.x - dpos.x;
            const dz = pos.z - dpos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            console.log(`Checking door ${id} at ${dpos.x.toFixed(2)},${dpos.z.toFixed(2)} dist=${dist.toFixed(2)}`);
            if (dist < closestDist) {
                closest = door;
                closestDist = dist;
            }
        }
        if (closest) {
            closest.open = !closest.open;
        }
    }

    for (const door of doors.values()) {
        if (door.open) {
            door.openState = Math.min(180, door.openState + 120 * delta);
        } else {
            door.openState = Math.max(0, door.openState - 120 * delta);
        }
        const offset = Math.sin(door.openState * Math.PI / 180) * 0.6;
        door.mesh.position.set(offset, 0, 0);
        door.collider.visible = !door.open || door.openState < 90;
    }

    if (gameExports?.UpdateGame) {
        activeMemory = gameExports.memory;
        gameExports.UpdateGame();
    }
    if (status) {
        const bounds = (collisionMinY === null || collisionMaxY === null)
            ? "bounds ?"
            : `bounds ${collisionMinY.toFixed(2)}..${collisionMaxY.toFixed(2)}`;
        const spawn = spawnPoint
            ? `spawn ${spawnPoint.x.toFixed(2)} ${spawnPoint.y.toFixed(2)} ${spawnPoint.z.toFixed(2)}`
            : "spawn none";
        status.textContent = `POS ${cameraYaw.position.x.toFixed(2)} ${cameraYaw.position.y.toFixed(2)} ${cameraYaw.position.z.toFixed(2)} | ${bounds} | ${spawn}`;
    }
    const playerCollState = playerEntityId ? entityCollisionState.get(playerEntityId) : null;
    const collCount = playerCollState?.collisions.length || 0;
    const floorCollY = playerCollState?.collisions[0]?.y;
    debugHud.textContent = [
        `lock: ${document.pointerLockElement === container}`,
        `vel: ${velocity.x.toFixed(3)} ${velocity.y.toFixed(3)} ${velocity.z.toFixed(3)}`,
        `Pos: ${cameraYaw.position.x.toFixed(1)}, ${cameraYaw.position.y.toFixed(1)}, ${cameraYaw.position.z.toFixed(1)}`,
        `grounded: ${grounded} canJump: ${canJump}`,
        `floorY: ${lastFloorY !== null ? lastFloorY.toFixed(2) : '-'}`,
        `doors: ${doors.size} [E to interact]`,
        `yaw: ${(cameraYaw.rotation.y * 180 / Math.PI).toFixed(1)}`
    ].join('\n');
    renderer.render(scene, camera);
}

async function start() {
    try {
        status.textContent = "LOADING WASM...";

        const [gameRes, loaderRes] = await Promise.all([
            fetch('facility_walk.wasm'),
            fetch('RMeshLoader.wasm')
        ]);

        const gameBuffer = await gameRes.arrayBuffer();
        const loaderBuffer = await loaderRes.arrayBuffer();

        const memRefGetter = () => activeMemory;
        const baseEnv = getEnvFunctions(memRefGetter);
        const missingImports = new Set();
        const env = new Proxy(baseEnv, {
            get(target, prop) {
                if (prop in target) return target[prop];
                if (typeof prop === 'string') {
                    if (!missingImports.has(prop)) {
                        missingImports.add(prop);
                        console.warn(`Stubbed missing import: ${prop}`);
                    }
                    const stub = () => 0;
                    target[prop] = stub;
                    return stub;
                }
                return undefined;
            }
        });
        const importObject = { env, blitz3d: env, al: env };

        // Debug integration
        if (typeof Blitz3DDebug !== 'undefined') {
            console.log("Initializing Blitz3DDebug...");
            const coreShim = {
                get memory() { return activeMemory; }
            };
            const debugInstance = new Blitz3DDebug(coreShim);
            debugInstance.setupImports(importObject);
            debugInstance.logCalls = true;
            debugInstance.logStatements = true;
            debugInstance.loadMetadata('facility_walk.wasm');
            window.bbDebug = debugInstance; // Expose globally
        }

        const loaderInstance = await WebAssembly.instantiate(loaderBuffer, importObject);
        loaderExports = loaderInstance.instance.exports;

        const gameInstance = await WebAssembly.instantiate(gameBuffer, importObject);
        gameExports = gameInstance.instance.exports;

        if (loaderExports.Graphics3D) loaderExports.Graphics3D(800, 600, 32, 2);
        if (gameExports.Main) {
            activeMemory = gameExports.memory;
            gameExports.Main();
        }

        ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
        scene.add(ambientLight);
        sunLight = new THREE.DirectionalLight(0xffffff, 0.5);
        sunLight.position.set(10, 20, 10);
        scene.add(sunLight);

        // Brightness slider handler
        if (brightnessSlider) {
            brightnessSlider.addEventListener('input', (e) => {
                const val = e.target.value / 100;
                if (ambientLight) ambientLight.intensity = val;
                if (sunLight) sunLight.intensity = val * 1.5;
            });
            // Trigger initial value
            const initVal = brightnessSlider.value / 100;
            if (ambientLight) ambientLight.intensity = initVal;
            if (sunLight) sunLight.intensity = initVal * 1.5;
        }

        if (meshSelect) {
            meshSelect.innerHTML = '';
            for (const name of meshOptions) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name.replace('.rmesh', '');
                meshSelect.appendChild(option);
            }
            meshSelect.value = meshOptions[0];
            meshSelect.addEventListener('change', async (e) => {
                await loadRMesh(e.target.value);
            });
            // Fix UI interaction blocking
            ['mousedown', 'click', 'mouseup'].forEach(evt =>
                meshSelect.addEventListener(evt, e => e.stopPropagation())
            );
        }
        await loadRMesh(meshSelect ? meshSelect.value : meshOptions[0]);
        animate();
    } catch (e) {
        console.error("START ERROR:", e);
        status.textContent = "ERROR: " + e.message;
    }
}

start();
