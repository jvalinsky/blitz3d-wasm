/**
 * Walking Simulator Demo (Combined BB + JS)
 * Uses walking_sim.wasm for logic and RMeshLoader.wasm for mesh parsing
 */

// --- Three.js Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x05050a); 
container.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

let currentMeshObject = null;
let collisionMesh = null;

// --- Player State ---
const playerState = {
    height: 0.7, 
    radius: 0.35,
    speed: 5.0, 
    runSpeed: 10.0,
    jumpStrength: 8.0,
    velocity: new THREE.Vector3(),
    onGround: false,
    flyMode: false
};

const cameraPitch = new THREE.Object3D();
const cameraYaw = new THREE.Object3D();
scene.add(cameraYaw);
cameraYaw.add(cameraPitch);
cameraPitch.add(camera);

cameraYaw.position.set(0, 2, 0);

// --- Input ---
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyG') playerState.flyMode = !playerState.flyMode;
    if (e.code === 'KeyC') {
        if (collisionMesh) {
            const isVisible = !collisionMesh.userData.debugVisible;
            collisionMesh.userData.debugVisible = isVisible;
            collisionMesh.traverse(c => {
                if (c.isMesh) c.material.visible = isVisible;
            });
        }
    }
    // Jump trigger
    if (e.code === 'Space' && playerState.onGround && !playerState.flyMode) {
        playerState.velocity.y = playerState.jumpStrength;
        playerState.onGround = false;
    }
});
document.addEventListener('keyup', (e) => keys[e.code] = false);

const instructions = document.getElementById('instructions');
const status = document.getElementById('status');
const debugText = document.getElementById('debug');

container.addEventListener('click', () => {
    container.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    instructions.style.display = document.pointerLockElement === container ? 'none' : 'block';
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== container) return;
    cameraYaw.rotation.y -= e.movementX * 0.002;
    cameraPitch.rotation.x -= e.movementY * 0.002;
    cameraPitch.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraPitch.rotation.x));
});

// --- Collision ---
let collisionVertices = [];
let collisionIndices = [];
const floorRaycaster = new THREE.Raycaster();
const wallRaycaster = new THREE.Raycaster();

// --- WASM Environment ---
let gameExports = null;
let loaderExports = null;

const entities = new Map();
let nextEntityId = 100;

const meshes = new Map();
const surfaces = new Map();
let nextMeshId = 1;
let nextSurfaceId = 1;

const virtualFiles = new Map();
const openFiles = new Map();
let nextFileId = 1;

const banks = new Map();
let nextBankId = 1;

const heapPointers = new Map();

// Context-aware memory resolver
let activeMemory = null;

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
    } catch (e) { return ""; }
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
        try { memory.grow(1); } catch(e) { return 0; }
    }
    writeString(memory, ptr, str);
    heapPointers.set(memory, (ptr + size + 3) & ~3);
    return ptr;
}

const getEnvFunctions = (memRefGetter) => ({
    PrintInt: (v) => console.log("BB:", v),
    PrintFloat: (v) => console.log("BB:", v.toFixed(4)),
    PrintString: (ptr) => console.log("BB:", readString(memRefGetter(), ptr)),
    Print: (ptr) => console.log("BB:", readString(memRefGetter(), ptr)),
    MilliSecs: () => performance.now() | 0,
    Graphics3D: (w, h, d, m) => { console.log(`Graphics3D ${w}x${h}`); },
    CreateCamera: (p) => { const id = nextEntityId++; entities.set(id, { obj: camera }); return id; },
    CreatePivot: (p) => { const id = nextEntityId++; entities.set(id, { obj: cameraYaw }); return id; },
    PositionEntity: (e, x, y, z) => { if(entities.get(e)) entities.get(e).obj.position.set(x, y, -z); },
    RotateEntity: (e, p, y, r) => {
        const ent = entities.get(e);
        if (ent) {
            if (ent.obj === cameraYaw) ent.obj.rotation.set(0, y * Math.PI / 180, 0);
            else if (ent.obj === camera) cameraPitch.rotation.set(p * Math.PI / 180, 0, 0);
        }
    },
    EntityX: (e) => entities.get(e)?.obj.position.x || 0,
    EntityY: (e) => entities.get(e)?.obj.position.y || 0,
    EntityZ: (e) => -(entities.get(e)?.obj.position.z || 0),
    EntityYaw: (e) => entities.get(e)?.obj.rotation.y * 180 / Math.PI || 0,
    EntityPitch: (e) => (cameraPitch.rotation.x * 180 / Math.PI),
    MoveEntity: (e, x, y, z) => {}, 
    TranslateEntity: (e, x, y, z) => {},
    
    AddEntity: (typePtr, x, y, z) => {
        if (Math.abs(x) > 5000 || isNaN(x)) return; 
        const type = readString(memRefGetter(), typePtr).toLowerCase();
        const scale = 8.0 / 2048.0;
        const pos = new THREE.Vector3(-x * scale, y * scale, z * scale);
        if (type === "playerstart" || (type === "waypoint" && !window.playerSpawned)) {
            cameraYaw.position.copy(pos);
            cameraYaw.position.y += 0.5;
            window.playerSpawned = true;
        }
    },
    CreateMesh: (p) => { const id = nextMeshId++; meshes.set(id, { surfaces: [] }); return id; },
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
        const scale = 8.0 / 2048.0;
        surf.vertices.push(-x * scale, y * scale, z * scale);
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
        const scale = 8.0 / 2048.0;
        collisionVertices.push(-x * scale, y * scale, z * scale);
    },
    AddCollisionTriangle: (v0, v1, v2) => {
        collisionIndices.push(v0, v2, v1);
    },
    KeyDown: (k) => {
        const map = { 17: 'KeyW', 31: 'KeyS', 30: 'KeyA', 32: 'KeyD', 200: 'ArrowUp', 208: 'ArrowDown', 203: 'ArrowLeft', 205: 'ArrowRight', 57: 'Space', 42: 'ShiftLeft', 54: 'ShiftRight' };
        return keys[map[k]] ? 1 : 0;
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
    TFormVector: (x, y, z, s, d) => { window.tformed = new THREE.Vector3(x, y, -z).applyQuaternion(cameraYaw.quaternion); },
    TFormedX: () => window.tformed?.x || 0,
    TFormedY: () => window.tformed?.y || 0,
    TFormedZ: () => -(window.tformed?.z || 0),
    Sin: (v) => Math.sin(v * Math.PI / 180),
    Cos: (v) => Math.cos(v * Math.PI / 180),
    Sqr: (v) => Math.sqrt(v),
    UpdateWorld: () => {},
    RenderWorld: () => {},
    Flip: () => {},
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
    
    if (collisionVertices.length > 0) {
        const collGeo = new THREE.BufferGeometry();
        collGeo.setAttribute('position', new THREE.Float32BufferAttribute(collisionVertices, 3));
        collGeo.setIndex(collisionIndices);
        collGeo.computeBoundingSphere();
        collisionMesh = new THREE.Mesh(collGeo, new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, side: THREE.DoubleSide }));
        collisionMesh.material.visible = false; 
        scene.add(collisionMesh);
    } else {
        collisionMesh = group;
    }
}

let prevTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now();
    const delta = Math.min((time - prevTime) / 1000, 0.1);
    prevTime = time;

    if (document.pointerLockElement === container) {
        const moveForward = keys['KeyW'] || keys['ArrowUp'];
        const moveBackward = keys['KeyS'] || keys['ArrowDown'];
        const moveLeft = keys['KeyA'] || keys['ArrowLeft'];
        const moveRight = keys['KeyD'] || keys['ArrowRight'];
        const isRunning = keys['ShiftLeft'] || keys['ShiftRight'];
        const dirZ = (moveForward ? 1 : 0) - (moveBackward ? 1 : 0);
        const dirX = (moveRight ? 1 : 0) - (moveLeft ? 1 : 0);
        
        if (dirZ !== 0 || dirX !== 0) {
            const currentSpeed = isRunning ? playerState.runSpeed : playerState.speed;
            const move = new THREE.Vector3(dirX, 0, -dirZ).normalize().applyQuaternion(cameraYaw.quaternion);
            cameraYaw.position.add(move.multiplyScalar(currentSpeed * delta));
        }

        const updateFunc = gameExports?.UpdateGame || gameExports?.updategame;
        if (updateFunc) {
            activeMemory = gameExports.memory;
            updateFunc();
        }
        updateCollision(delta);
    }

    renderer.render(scene, camera);
    if (debugText) debugText.textContent = `POS: ${cameraYaw.position.x.toFixed(2)}, ${cameraYaw.position.y.toFixed(2)}, ${cameraYaw.position.z.toFixed(2)} | GND: ${playerState.onGround}`;
}

async function start() {
    status.textContent = "LOADING WASM...";
    try {
        const loaderRes = await fetch('RMeshLoader.wasm');
        const gameRes = await fetch('walking_sim.wasm');
        const loaderModule = await WebAssembly.compile(await loaderRes.arrayBuffer());
        const gameModule = await WebAssembly.compile(await gameRes.arrayBuffer());

        const createImports = (module, memRefGetter) => {
            const funcs = getEnvFunctions(memRefGetter);
            const result = { env: {}, blitz3d: {}, al: {} };
            WebAssembly.Module.imports(module).forEach(imp => {
                const target = result[imp.module] || result.env;
                target[imp.name] = funcs[imp.name] || (() => 0);
            });
            return result;
        };

        const loaderInstance = await WebAssembly.instantiate(loaderModule, createImports(loaderModule, () => loaderExports ? loaderExports.memory : null));
        loaderExports = loaderInstance.exports;

        const gameInstance = await WebAssembly.instantiate(gameModule, createImports(gameModule, () => gameExports ? gameExports.memory : null));
        gameExports = gameInstance.exports;

        if (loaderExports.Graphics3D) loaderExports.Graphics3D(800, 600, 32, 2);
        if (gameExports.Main) {
            activeMemory = gameExports.memory;
            gameExports.Main();
        }

        const rmeshName = "room2cafeteria_opt.rmesh"; 
        const res = await fetch(`assets/${rmeshName}`);
        virtualFiles.set(rmeshName.toLowerCase(), await res.arrayBuffer());
        
        const textures = ["294.jpg", "keyboard.jpg", "ceiling.jpg", "concretefloor.jpg", "officewall.jpg", "metal.jpg", "white.jpg", "tilefloor.jpg", "misc.jpg", "dirtymetal.jpg", "glass.png", "crtbev.jpg", "miscsigns3.jpg", "door01.jpg", "red.jpg", "papertexture.jpg", "controlpanel.jpg", "metalpanels2.jpg"];
        for (const t of textures) {
            const tRes = await fetch(`assets/${t}`);
            if (tRes.ok) virtualFiles.set(t.toLowerCase(), await tRes.arrayBuffer());
        }
        
        activeMemory = loaderExports.memory;
        const ptr = allocString(loaderExports.memory, rmeshName);
        const meshLoadFunc = loaderExports["LoadRMesh%"] || loaderExports["loadrmesh"];
        if (meshLoadFunc) {
            const meshId = meshLoadFunc(ptr);
            if (meshId) buildThreeJSMesh(meshId);
        }

        scene.add(new THREE.AmbientLight(0xffffff, 0.1));
        const sun = new THREE.DirectionalLight(0xffffff, 0.25);
        sun.position.set(10, 20, 10);
        scene.add(sun);

        status.textContent = "READY. CLICK TO START.";
        animate();
    } catch (e) {
        console.error("START ERROR:", e);
        status.textContent = "ERROR: " + e.message;
    }
}

function updateCollision(delta) {
    if (!collisionMesh || playerState.flyMode) return;
    
    playerState.velocity.y -= 25.0 * delta; 
    cameraYaw.position.y += playerState.velocity.y * delta;

    const rayHeight = 1.2;
    const rayOrigin = new THREE.Vector3(cameraYaw.position.x, cameraYaw.position.y + rayHeight, cameraYaw.position.z);
    floorRaycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    floorRaycaster.far = 10.0; 
    
    const hits = floorRaycaster.intersectObject(collisionMesh, true);
    let groundY = -Infinity;
    
    if (hits.length > 0) {
        for (const hit of hits) {
            if (hit.point.y <= cameraYaw.position.y + 0.3) {
                if (hit.point.y > groundY) groundY = hit.point.y;
            }
        }
    }

    playerState.onGround = false;
    if (groundY !== -Infinity) {
        const dist = cameraYaw.position.y - groundY;
        if (dist <= 0 || (playerState.velocity.y <= 0 && dist < 0.25)) {
            cameraYaw.position.y = groundY;
            playerState.velocity.y = 0;
            playerState.onGround = true;
            if (gameExports.vel_y) gameExports.vel_y.value = 0;
        }
    }
    
    const checkHeight = 0.4;
    const numRays = 8;
    for (let i = 0; i < numRays; i++) {
        const angle = (i / numRays) * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        wallRaycaster.set(new THREE.Vector3(cameraYaw.position.x, cameraYaw.position.y + checkHeight, cameraYaw.position.z), dir);
        wallRaycaster.far = playerState.radius + 0.2;
        const wallHits = wallRaycaster.intersectObject(collisionMesh, true);
        if (wallHits.length > 0 && wallHits[0].distance < playerState.radius) {
            cameraYaw.position.sub(dir.clone().multiplyScalar(playerState.radius - wallHits[0].distance));
        }
    }
}

start();
