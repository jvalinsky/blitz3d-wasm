// Site-19 Terminal Logic

// --- Three.js Setup ---
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setClearColor(0x000000, 0); // Transparent background to show CSS grid
container.appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();

let currentMeshObject = null; // The Three.js object in the scene

// --- FPS Controls ---
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

// Camera setup for FPS
const cameraPitch = new THREE.Object3D();
const cameraYaw = new THREE.Object3D();
scene.add(cameraYaw);
cameraYaw.add(cameraPitch);
cameraPitch.add(camera);

const controls = {
    wireframe: false,
    walkMode: true,
    showCollision: false,
    moveSpeed: 100.0 // Reduced speed for better control
};

const gui = new dat.GUI();
gui.add(controls, 'wireframe').onChange(e => {
    if (currentMeshObject) {
        currentMeshObject.traverse(child => {
            if (child.isMesh) child.material.wireframe = e;
        });
    }
});
gui.add(controls, 'walkMode').name('Walk Mode (G)');
gui.add(controls, 'showCollision').name('Show Collision').onChange(e => {
    if (collisionMesh) collisionMesh.visible = e;
});
gui.add(controls, 'moveSpeed', 10, 500);

// --- Collision System ---
let collisionVertices = [];
let collisionIndices = [];
let collisionMesh = null;
const raycaster = new THREE.Raycaster();
const playerHeight = 1.7; // Facility standard human height
const wallRaycaster = new THREE.Raycaster();

// ... existing code ...

// Input Handling
const onKeyDown = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
        case 'Space': moveUp = true; break;
        case 'ShiftLeft':
        case 'ControlLeft': moveDown = true; break;
        case 'KeyG': // Toggle Walk Mode
            controls.walkMode = !controls.walkMode;
            // Update GUI if it exists
            for (let i in gui.__controllers) {
                if (gui.__controllers[i].property === 'walkMode') gui.__controllers[i].updateDisplay();
            }
            log(`Walk Mode: ${controls.walkMode ? 'ON' : 'OFF'}`);
            break;
    }
};

const gui = new dat.GUI();
gui.add(controls, 'wireframe').onChange(e => {
    if (currentMeshObject) {
        currentMeshObject.traverse(child => {
            if (child.isMesh) child.material.wireframe = e;
        });
    }
});
gui.add(controls, 'walkMode');
gui.add(controls, 'moveSpeed', 100, 1000);

// --- Collision System ---
let collisionVertices = [];
let collisionIndices = [];
let collisionMesh = null;
const raycaster = new THREE.Raycaster();
const playerHeight = 1.7; // Facility standard human height
const playerWidth = 0.4;
const wallRaycaster = new THREE.Raycaster();

// Input Handling
const onKeyDown = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = true; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = true; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = true; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = true; break;
        case 'Space': moveUp = true; break;
        case 'ShiftLeft':
        case 'ControlLeft': moveDown = true; break;
    }
};

const onKeyUp = function (event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW': moveForward = false; break;
        case 'ArrowLeft':
        case 'KeyA': moveLeft = false; break;
        case 'ArrowDown':
        case 'KeyS': moveBackward = false; break;
        case 'ArrowRight':
        case 'KeyD': moveRight = false; break;
        case 'Space': moveUp = false; break;
        case 'ShiftLeft':
        case 'ControlLeft': moveDown = false; break;
    }
};

document.addEventListener('keydown', onKeyDown);
document.addEventListener('keyup', onKeyUp);

// Pointer Lock
const instructions = document.getElementById('instructions');
if (instructions) instructions.style.display = 'block';

const onMouseMove = function (event) {
    if (document.pointerLockElement !== container) return;
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    cameraYaw.rotation.y -= movementX * 0.002;
    cameraPitch.rotation.x -= movementY * 0.002;
    cameraPitch.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, cameraPitch.rotation.x));
};

document.addEventListener('mousemove', onMouseMove);

container.addEventListener('click', function () {
    container.requestPointerLock();
});

document.addEventListener('pointerlockchange', function () {
    if (document.pointerLockElement === container) {
        if (instructions) instructions.style.display = 'none';
    } else {
        if (instructions) instructions.style.display = 'block';
    }
});

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(1, 1, 1);
scene.add(directionalLight);

// Camera position - managed by cameraYaw now
// camera.position.z = 5; 

// Render Loop
let prevTime = performance.now();

function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now();
    const delta = (time - prevTime) / 1000;
    
    if (document.pointerLockElement === container) {
        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= velocity.y * 10.0 * delta;
        
        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.y = Number(moveUp) - Number(moveDown);
        direction.normalize();
        
        const speed = controls.moveSpeed;
        if (moveForward || moveBackward) velocity.z -= direction.z * speed * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * speed * delta;
        if (moveUp || moveDown) velocity.y += direction.y * speed * delta;
        
        cameraYaw.translateX(-velocity.x * delta);
        cameraYaw.translateZ(-velocity.z * delta);
        
        if (controls.walkMode && collisionMesh) {
            // Floor detection
            const rayOrigin = cameraYaw.position.clone();
            rayOrigin.y += 1.0; // Start ray slightly above player to detect floor reliably
            raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
            const intersects = raycaster.intersectObject(collisionMesh);
            
            if (intersects.length > 0) {
                const floorY = intersects[0].point.y;
                cameraYaw.position.y = floorY + playerHeight;
                velocity.y = 0;
            } else {
                // Fly mode fallback if no floor detected
                cameraYaw.position.y += velocity.y * delta;
            }
        } else {
            cameraYaw.position.y += velocity.y * delta;
        }
    }
    
    prevTime = time;
    renderer.render(scene, camera);
}
animate();

// Resize handler
window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
});

// --- WASM & Runtime State ---
let wasmInstance = null;
let wasmMemory = null;
let stringHeapPtr = 524288; // Start after 512KB (arbitrary safe start)

// File System (Virtual)
const virtualFiles = new Map(); // filename -> ArrayBuffer
const openFiles = new Map(); // fileId -> { buffer, cursor }
let nextFileId = 1;

// Mesh System (Virtual)
const meshes = new Map(); // meshId -> { surfaces: [] }
const surfaces = new Map(); // surfId -> { vertices: [], indices: [], meshId }
let nextMeshId = 1;
let nextSurfaceId = 1;

// --- WASM Helpers ---
function writeString(ptr, str) {
    if (!wasmMemory) return;
    const bytes = new Uint8Array(wasmMemory.buffer);
    const uint32 = new Uint32Array(wasmMemory.buffer);
    // B3D String format: [0-3: garbage/class?][4-7: length][8...: chars]
    // My compiler uses: 8 byte header. Offset 4 is length.
    uint32[ptr / 4] = 0; // Header part 1
    uint32[ptr / 4 + 1] = str.length; // Length
    for (let i = 0; i < str.length; i++) {
        bytes[ptr + 8 + i] = str.charCodeAt(i);
    }
    bytes[ptr + 8 + str.length] = 0; // Null terminator (optional but good)
}

function allocString(str) {
    const ptr = stringHeapPtr;
    const size = 8 + str.length + 1;
    stringHeapPtr = (stringHeapPtr + size + 3) & ~3; // Align 4
    writeString(ptr, str);
    return ptr;
}

function readString(ptr) {
    if (!wasmMemory || ptr === 0) return "";
    const bytes = new Uint8Array(wasmMemory.buffer);
    const length = new DataView(wasmMemory.buffer).getInt32(ptr + 4, true);
    if (length < 0 || length > 10000) return ""; // Sanity check
    
    let str = "";
    for (let i = 0; i < length; i++) {
        str += String.fromCharCode(bytes[ptr + 8 + i]);
    }
    return str;
}

// --- Logging ---
const logOutput = document.getElementById('log-output');
function log(msg, type = 'info') {
    const span = document.createElement('span');
    span.className = `log-line ${type}`;
    span.textContent = `> ${msg}`;
    logOutput.appendChild(span);
    logOutput.scrollTop = logOutput.scrollHeight;
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

// --- WASM Environment (Imports) ---
const env = {
    // Console
    PrintString: (ptr) => log(readString(ptr)),
    PrintInt: (val) => log(val.toString()),
    PrintFloat: (val) => log(val.toFixed(4)),
    
    // File I/O
    ReadFile: (pathPtr) => {
        const path = readString(pathPtr);
        log(`Opening file: ${path}`);
        
        // Find in virtualFiles
        // Try exact match, then case-insensitive, then just filename
        let buffer = virtualFiles.get(path);
        if (!buffer) {
            // Try basenames
            const filename = path.split('/').pop().toLowerCase();
            for (const [key, buf] of virtualFiles) {
                if (key.toLowerCase().endsWith(filename)) {
                    buffer = buf;
                    break;
                }
            }
        }
        
        if (buffer) {
            const id = nextFileId++;
            openFiles.set(id, { buffer: buffer, cursor: 0, view: new DataView(buffer) });
            return id;
        }
        
        log(`File not found: ${path}`, 'error');
        return 0;
    },
    
    CloseFile: (id) => openFiles.delete(id),
    
    ReadByte: (id) => {
        const f = openFiles.get(id);
        if (!f || f.cursor >= f.buffer.byteLength) return 0;
        const v = f.view.getUint8(f.cursor); // Byte is unsigned usually? B3D is signed/unsigned? Assuming Uint8 for binary data.
        f.cursor += 1;
        return v;
    },
    
    ReadInt: (id) => {
        const f = openFiles.get(id);
        if (!f || f.cursor + 4 > f.buffer.byteLength) return 0;
        const v = f.view.getInt32(f.cursor, true); // Little endian
        f.cursor += 4;
        return v;
    },
    
    ReadFloat: (id) => {
        const f = openFiles.get(id);
        if (!f || f.cursor + 4 > f.buffer.byteLength) return 0;
        const v = f.view.getFloat32(f.cursor, true);
        f.cursor += 4;
        return v;
    },
    
    ReadString: (id) => {
        const f = openFiles.get(id);
        if (!f) return allocString("");
        
        // Read B3D string from file
        if (f.cursor + 4 > f.buffer.byteLength) return allocString("");
        const len = f.view.getInt32(f.cursor, true);
        f.cursor += 4;
        
        if (len < 0 || f.cursor + len > f.buffer.byteLength) return allocString("");
        
        let str = "";
        for (let i = 0; i < len; i++) {
            str += String.fromCharCode(f.view.getUint8(f.cursor + i));
        }
        f.cursor += len;
        
        return allocString(str);
    },
    
    // Mesh Creation
    CreateMesh: () => {
        const id = nextMeshId++;
        meshes.set(id, { surfaces: [] });
        return id;
    },
    
    CreateSurface: (meshId) => {
        const mesh = meshes.get(meshId);
        if (!mesh) return 0;
        const id = nextSurfaceId++;
        const surf = { vertices: [], indices: [], uvs: [], uvs2: [], colors: [], meshId: meshId, textureFlag: 0 };
        surfaces.set(id, surf);
        mesh.surfaces.push(id);
        console.log(`[DEBUG] Created Surface ${id} for Mesh ${meshId}`);
        return id;
    },
    
    AddVertex: (surfId, x, y, z) => {
        const surf = surfaces.get(surfId);
        if (!surf) return 0;
        const idx = surf.vertices.length / 3;
        // RMesh coordinates might need scaling/flipping for Three.js
        const scale = 8.0 / 2048.0; 
        surf.vertices.push(x * scale, y * scale, z * scale);
        surf.uvs.push(0, 0);
        surf.uvs2.push(0, 0);
        surf.colors.push(1, 1, 1);
        return idx;
    },
    
    AddVertexExtended: (surfId, x, y, z, u, v, u2, v2, r, g, b) => {
        const surf = surfaces.get(surfId);
        if (!surf) {
            console.error(`[DEBUG] AddVertexExtended: Surface ${surfId} not found!`);
            return 0;
        }
        
        // Debug first vertex of first surface
        if (surfId === 1 && surf.vertices.length === 0) {
            console.log(`[DEBUG] AddVertexExtended called! surf=${surfId} x=${x} y=${y} z=${z}`);
        }
        
        const idx = surf.vertices.length / 3;
        const scale = 8.0 / 2048.0; 
        surf.vertices.push(-x * scale, y * scale, z * scale); // Mirror over vertical axis (Flip X)
        surf.uvs.push(u, v);
        surf.uvs2.push(u2, v2);
        surf.colors.push(r/255, g/255, b/255);
        return idx;
    },
    
    AddTriangle: (surfId, v0, v1, v2) => {
        const surf = surfaces.get(surfId);
        if (!surf) return;
        // Standard winding
        surf.indices.push(v0, v1, v2); 
    },
    
    AddCollisionVertex: (x, y, z) => {
        const scale = 8.0 / 2048.0;
        collisionVertices.push(-x * scale, y * scale, z * scale); // Flip X to match mirrored mesh
    },
    
    AddCollisionTriangle: (v0, v1, v2) => {
        // Reverse winding for mirrored collision
        collisionIndices.push(v0, v2, v1);
    },
    
    AddEntity: (typePtr, x, y, z) => {
        const type = readString(typePtr);
        const scale = 8.0 / 2048.0;
        const pos = new THREE.Vector3(-x * scale, y * scale, z * scale);
        
        console.log(`[ENTITY] ${type} at ${pos.x}, ${pos.y}, ${pos.z}`);
        
        // Use playerstart or first waypoint as initial spawn
        if (type.toLowerCase() === "playerstart" || (type.toLowerCase() === "waypoint" && !window.playerSpawned)) {
            cameraYaw.position.copy(pos);
            cameraYaw.position.y += playerHeight;
            window.playerSpawned = true;
            log(`Assigned initial position at ${type}`);
        }
    },
    
    StringEqual: (p1, p2) => {
        return readString(p1) === readString(p2) ? 1 : 0;
    },
    
    SetSurfaceTexture: (surfId, pathPtr, flag) => {
        const path = readString(pathPtr);
        const surf = surfaces.get(surfId);
        if (surf) {
            surf.texturePath = path;
            surf.textureFlag = flag;
        }
    },
    
    SetSurfaceLightmap: (surfId, pathPtr) => {
        const path = readString(pathPtr);
        const surf = surfaces.get(surfId);
        if (surf) {
            surf.lightmapPath = path;
        }
    },
    
    // String Helpers
    Len: (strPtr) => readString(strPtr).length,
    IntToString: (val) => allocString(val.toString()),
    FloatToString: (val) => allocString(val.toFixed(4)),
    StringConcat: (a, b) => allocString(readString(a) + readString(b)),
    
    // Stubs
    Graphics3D: () => 1,
    CreateCamera: () => 1,
    MilliSecs: () => performance.now(),
    Cls: () => {},
    Flip: () => {},
    Color: () => {},
    Rect: () => {},
    Oval: () => {},
    Line: () => {},
    Text: () => {},
    FreeEntity: (id) => {
        // Called when mesh is freed. We might want to keep it if we are displaying it.
        // Or strictly follow logic.
        // For this viewer, FreeEntity is called at end of test.
        // But we want to KEEP the mesh data to render it.
        // So we will ignore FreeEntity for the viewer logic, or handle it by NOT deleting internal data immediately.
        log(`FreeEntity ${id} called (ignored for viewer)`);
    }
};

// Stub generator
const envProxy = new Proxy(env, {
    get: (target, prop) => {
        if (prop in target) return target[prop];
        // Stub missing functions
        if (typeof prop === 'string' && /^[a-zA-Z]/.test(prop)) {
            return () => 0;
        }
        return undefined;
    }
});

// --- Initialization ---
async function initWASM() {
    try {
        const response = await fetch('RMeshLoader.wasm');
        const buffer = await response.arrayBuffer();
        const results = await WebAssembly.instantiate(buffer, {
            env: envProxy,
            blitz3d: envProxy, // Reuse proxy for blitz3d namespace
            al: envProxy
        });
        
        wasmInstance = results.instance;
        wasmMemory = wasmInstance.exports.memory;
        
        log("WASM Module Loaded.", "info");
        return true;
    } catch (e) {
        log(`WASM Init Failed: ${e.message}`, "error");
        console.error(e);
        return false;
    }
}

// --- App Logic ---

async function loadFile(filename, buffer) {
    if (!wasmInstance) return;
    
    log(`Loading ${filename}...`);
    
    // Store file in virtual FS
    virtualFiles.set(filename, buffer);
    
    // Reset mesh and collision data
    meshes.clear();
    surfaces.clear();
    collisionVertices = [];
    collisionIndices = [];
    window.playerSpawned = false;
    nextMeshId = 1;
    nextSurfaceId = 1;
    
    if (collisionMesh) {
        scene.remove(collisionMesh);
        collisionMesh = null;
    }
    
    if (currentMeshObject) {
        scene.remove(currentMeshObject);
        currentMeshObject = null;
    }
    
    // Call LoadRMesh
    const filenamePtr = allocString(filename);
    
    // Need to find the exported function name. Assuming "LoadRMesh%"
    const loadFunc = wasmInstance.exports["LoadRMesh%"];
    if (!loadFunc) {
        log("Error: LoadRMesh% export not found!", "error");
        return;
    }
    
    const meshId = loadFunc(filenamePtr);
    
    log(`LoadRMesh returned ID: ${meshId}`);
    
    if (meshId !== 0) {
        buildThreeJSMesh(meshId);
    } else {
        log("Failed to load mesh.", "error");
    }
}

function buildThreeJSMesh(meshId) {
    const meshData = meshes.get(meshId);
    if (!meshData) return;
    
    const group = new THREE.Group();
    let totalVerts = 0;
    let totalTris = 0;
    
    for (const surfId of meshData.surfaces) {
        const surf = surfaces.get(surfId);
        if (!surf) continue;
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(surf.vertices, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(surf.colors, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(surf.uvs, 2));
        geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(surf.uvs2, 2));
        geometry.setIndex(surf.indices);
        geometry.computeVertexNormals();
        
        console.log(`[DEBUG] Surface ${surfId}: ${surf.vertices.length/3} verts, ${surf.indices.length/3} tris`);
        if (surf.vertices.length > 0) {
            console.log(`[DEBUG] First vert: ${surf.vertices[0]}, ${surf.vertices[1]}, ${surf.vertices[2]}`);
        }
        
        // Texture loading
        let map = null;
        if (surf.texturePath) {
            // Flatten path to assets/
            let texName = surf.texturePath.split(/[\\/]/).pop();
            // Handle legacy .bmp references that are actually .png
            if (texName.toLowerCase().endsWith('.bmp')) {
                 texName = texName.replace(/\.bmp$/i, '.png');
            }
            const texPath = `assets/${texName}`;
            map = textureLoader.load(texPath, () => {
                console.log(`[DEBUG] Texture loaded: ${texPath}`);
            }, undefined, (e) => {
                console.error(`[DEBUG] Texture failed: ${texPath}`, e);
            });
            map.wrapS = THREE.RepeatWrapping;
            map.wrapT = THREE.RepeatWrapping;
            map.flipY = false; // Manual flip for Blitz3D UVs
        }
        
        let lightMap = null;
        if (surf.lightmapPath) {
             let lmName = surf.lightmapPath.split(/[\\/]/).pop();
             // Handle legacy .bmp references that are actually .png
             if (lmName.toLowerCase().endsWith('.bmp')) {
                 lmName = lmName.replace(/\.bmp$/i, '.png');
             }
             const lmPath = `assets/${lmName}`;
             lightMap = textureLoader.load(lmPath);
             lightMap.flipY = false; // Manual flip for lightmaps
        }

        const isAlpha = (surf.textureFlag === 3);

        const material = new THREE.MeshStandardMaterial({ 
            map: map,
            lightMap: lightMap,
            lightMapIntensity: 1.5,
            side: THREE.DoubleSide,
            wireframe: controls.wireframe,
            vertexColors: false, // Disable vertex colors as they might be black/uninitialized in some RMesh files
            transparent: isAlpha,
            opacity: isAlpha ? 0.7 : 1.0,
            color: map ? 0xffffff : new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
        });
        
        // Fallback for debugging: if no texture and no vertex colors, make it visible
        if (!map && !surf.colors.length) {
             material.color.setHex(0xff00ff); // Magenta for missing textures
             material.vertexColors = false;
        }
        
        console.log(`[DEBUG] Material surf=${surfId} alpha=${isAlpha} map=${!!map} lightmap=${!!lightMap} vColors=${surf.colors.length > 0}`);
        
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);
        
        totalVerts += surf.vertices.length / 3;
        totalTris += surf.indices.length / 3;
    }
    
    scene.add(group);
    currentMeshObject = group;
    
    // Finalize Collision Mesh
    if (collisionVertices.length > 0) {
        const collGeo = new THREE.BufferGeometry();
        collGeo.setAttribute('position', new THREE.Float32BufferAttribute(collisionVertices, 3));
        collGeo.setIndex(collisionIndices);
        
        collisionMesh = new THREE.Mesh(collGeo, new THREE.MeshBasicMaterial({ 
            visible: false, // Keep invisible
            wireframe: true 
        }));
        scene.add(collisionMesh);
        log(`Collision grid generated: ${collisionIndices.length/3} triangles`);
    }
    
    // Update stats
    document.getElementById('stat-verts').textContent = totalVerts;
    document.getElementById('stat-tris').textContent = totalTris;
    document.getElementById('stat-surfs').textContent = meshData.surfaces.length;
    
    // Center camera
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 10; // Fallback to 10 if size is 0
    
    console.log(`[DEBUG] Bounding Box: Min(${box.min.x},${box.min.y},${box.min.z}) Max(${box.max.x},${box.max.y},${box.max.z})`);
    console.log(`[DEBUG] Center: (${center.x},${center.y},${center.z}) MaxDim: ${maxDim}`);
    
    controls.rotationSpeed = 0.005;
    
    // Move group to center
    group.position.sub(center);
    
    cameraYaw.position.set(0, maxDim * 0.5, maxDim * 1.5);
    cameraYaw.rotation.set(0, 0, 0);
    cameraPitch.rotation.set(0, 0, 0);
    
    log("Mesh constructed successfully.", "info");
}

// UI Event Listeners
document.getElementById('file-list').addEventListener('click', async (e) => {
    if (e.target.tagName === 'LI') {
        // Highlight
        document.querySelectorAll('#file-list li').forEach(li => li.classList.remove('active'));
        e.target.classList.add('active');
        
        const filename = e.target.dataset.file;
        const path = `assets/${filename}`;
        
        try {
            const res = await fetch(path);
            if (!res.ok) throw new Error(res.statusText);
            const buf = await res.arrayBuffer();
            loadFile(filename, buf);
        } catch (err) {
            log(`Fetch error: ${err.message}`, "error");
        }
    }
});

document.getElementById('file-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
        loadFile(file.name, evt.target.result);
    };
    reader.readAsArrayBuffer(file);
});

// Start
initWASM().then(() => {
    // Auto-load default
    const defaultLi = document.querySelector('#file-list li.active');
    if (defaultLi) defaultLi.click();
});
