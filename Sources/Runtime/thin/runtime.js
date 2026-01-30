/**
 * Blitz3D Thin Runtime
 * Minimal JS layer - only browser API bindings
 * All game logic runs in compiled BB -> WASM
 */

class Blitz3DThinRuntime {
    constructor(canvas) {
        this.canvas = canvas;
        this.entities = new Map();  // id -> {obj, type, ...}
        this.textures = new Map();  // id -> THREE.Texture
        this.sounds = new Map();    // id -> AudioBuffer
        this.channels = new Map();  // id -> AudioBufferSourceNode
        this.nextEntityId = 1;
        this.nextTextureId = 1;
        this.nextSoundId = 1;
        this.nextChannelId = 1;
        
        // Three.js
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
        this.renderer.setSize(canvas.width, canvas.height);
        this.activeCamera = null;
        
        // Audio
        this.audioCtx = null;  // Lazy init on user interaction
        
        // Input state
        this.keys = new Set();
        this.keysHit = new Set();
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseButtons = 0;
        this.mouseButtonsHit = 0;
        
        // Memory for WASM string handling
        this.memory = null;
        this.stringHeapPtr = 65536;
        
        this._setupInput();
    }
    
    _setupInput() {
        document.addEventListener('keydown', (e) => {
            this.keys.add(e.keyCode);
            this.keysHit.add(e.keyCode);
        });
        document.addEventListener('keyup', (e) => {
            this.keys.delete(e.keyCode);
        });
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            this.mouseButtons |= (1 << e.button);
            this.mouseButtonsHit |= (1 << e.button);
        });
        this.canvas.addEventListener('mouseup', (e) => {
            this.mouseButtons &= ~(1 << e.button);
        });
    }
    
    _initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }
    
    _readString(ptr) {
        if (!ptr || !this.memory) return "";
        const view = new DataView(this.memory.buffer);
        const len = view.getInt32(ptr + 4, true);
        if (len <= 0 || len > 10000) return "";
        const bytes = new Uint8Array(this.memory.buffer, ptr + 8, len);
        return new TextDecoder().decode(bytes);
    }
    
    clearHitStates() {
        this.keysHit.clear();
        this.mouseButtonsHit = 0;
    }
    
    render() {
        this.updateAnimations();
        if (this.activeCamera) {
            this.renderer.render(this.scene, this.activeCamera);
        }
    }
    
    //==========================================================================
    // IMPORTS - These are called from WASM
    //==========================================================================
    
    getImports() {
        const self = this;
        
        // Auto-stub for unimplemented functions
        const stub = (name) => (...args) => {
            // console.warn(`Stub: ${name}(${args.join(', ')})`);
            return 0;
        };
        
        const createProxy = (obj) => new Proxy(obj, {
            get(target, prop) {
                if (prop in target) return target[prop];
                return stub(prop);
            }
        });
        
        return {
            env: createProxy({
                memory: null,  // Will be set by WASM
                
                //--------------------------------------------------------------
                // Print
                //--------------------------------------------------------------
                PrintInt: (v) => console.log(v),
                PrintFloat: (v) => console.log(v.toFixed(4)),
                PrintString: (ptr) => console.log(self._readString(ptr)),
                Print: (ptr) => console.log(self._readString(ptr)),
                
                //--------------------------------------------------------------
                // Math
                //--------------------------------------------------------------
                Sin: (x) => Math.sin(x * Math.PI / 180),
                Cos: (x) => Math.cos(x * Math.PI / 180),
                Tan: (x) => Math.tan(x * Math.PI / 180),
                ASin: (x) => Math.asin(x) * 180 / Math.PI,
                ACos: (x) => Math.acos(x) * 180 / Math.PI,
                ATan: (x) => Math.atan(x) * 180 / Math.PI,
                ATan2: (y, x) => Math.atan2(y, x) * 180 / Math.PI,
                Sqr: Math.sqrt,
                Abs: Math.abs,
                Floor: Math.floor,
                Ceil: Math.ceil,
                Exp: Math.exp,
                Log: Math.log,
                Log10: Math.log10,
                Sgn: (x) => x > 0 ? 1 : x < 0 ? -1 : 0,
                Rnd: (lo, hi) => Math.random() * (hi - lo) + lo,
                Rand: (lo, hi) => Math.floor(Math.random() * (hi - lo + 1)) + lo,
                SeedRnd: () => {},
                Min: Math.min,
                Max: Math.max,
                
                //--------------------------------------------------------------
                // Core
                //--------------------------------------------------------------
                MilliSecs: () => performance.now() | 0,
                Delay: (ms) => {},  // Can't block in browser
                End: () => console.log("End"),
                RuntimeError: (ptr) => { throw new Error(self._readString(ptr)); },
                
                //--------------------------------------------------------------
                // Graphics - Entity Creation
                //--------------------------------------------------------------
                CreateCamera: (parent) => {
                    const cam = new THREE.PerspectiveCamera(75, self.canvas.width / self.canvas.height, 0.1, 1000);
                    const id = self.nextEntityId++;
                    self.entities.set(id, { obj: cam, type: 'camera' });
                    self.scene.add(cam);
                    if (!self.activeCamera) self.activeCamera = cam;
                    return id;
                },
                
                CreateLight: (type, parent) => {
                    let light;
                    switch (type) {
                        case 1: light = new THREE.DirectionalLight(0xffffff, 1); break;
                        case 2: light = new THREE.PointLight(0xffffff, 1); break;
                        case 3: light = new THREE.SpotLight(0xffffff, 1); break;
                        default: light = new THREE.AmbientLight(0xffffff, 0.5);
                    }
                    const id = self.nextEntityId++;
                    self.entities.set(id, { obj: light, type: 'light' });
                    self.scene.add(light);
                    return id;
                },
                
                CreatePivot: (parent) => {
                    const pivot = new THREE.Object3D();
                    const id = self.nextEntityId++;
                    self.entities.set(id, { obj: pivot, type: 'pivot' });
                    self.scene.add(pivot);
                    return id;
                },
                
                CreateSprite: (parent) => {
                    const material = new THREE.SpriteMaterial({ color: 0x00ff00, sizeAttenuation: true });
                    const sprite = new THREE.Sprite(material);
                    sprite.scale.set(0.5, 0.5, 1); // Make visible
                    const id = self.nextEntityId++;
                    self.entities.set(id, { obj: sprite, type: 'sprite', material });
                    self.scene.add(sprite);
                    console.log(`CreateSprite() -> id=${id}`);
                    return id;
                },
                
                CreateMesh: (parent) => {
                    const geometry = new THREE.BufferGeometry();
                    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
                    const mesh = new THREE.Mesh(geometry, material);
                    const id = self.nextEntityId++;
                    self.entities.set(id, { obj: mesh, type: 'mesh', geometry, material });
                    self.scene.add(mesh);
                    return id;
                },
                
                CreateCube: (parent) => {
                    const geometry = new THREE.BoxGeometry(1, 1, 1);
                    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
                    const mesh = new THREE.Mesh(geometry, material);
                    const id = self.nextEntityId++;
                    self.entities.set(id, { obj: mesh, type: 'mesh', geometry, material });
                    self.scene.add(mesh);
                    return id;
                },
                
                CreateSphere: (segments, parent) => {
                    const geometry = new THREE.SphereGeometry(1, segments || 16, segments || 16);
                    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
                    const mesh = new THREE.Mesh(geometry, material);
                    const id = self.nextEntityId++;
                    self.entities.set(id, { obj: mesh, type: 'mesh', geometry, material });
                    self.scene.add(mesh);
                    return id;
                },
                
                //--------------------------------------------------------------
                // Graphics - Entity Transform
                //--------------------------------------------------------------
                PositionEntity: (e, x, y, z, global) => {
                    const ent = self.entities.get(e);
                    if (ent) {
                        ent.obj.position.set(x, y, -z);  // Blitz3D uses -Z forward
                        console.log(`PositionEntity(${e}, ${x}, ${y}, ${z})`);
                    } else {
                        console.warn(`PositionEntity: entity ${e} not found`);
                    }
                },
                
                RotateEntity: (e, pitch, yaw, roll, global) => {
                    const ent = self.entities.get(e);
                    if (ent) {
                        ent.obj.rotation.set(
                            pitch * Math.PI / 180,
                            yaw * Math.PI / 180,
                            roll * Math.PI / 180
                        );
                    }
                },
                
                ScaleEntity: (e, x, y, z, global) => {
                    const ent = self.entities.get(e);
                    if (ent) ent.obj.scale.set(x, y, z);
                },
                
                MoveEntity: (e, x, y, z) => {
                    const ent = self.entities.get(e);
                    if (ent) ent.obj.translateX(x).translateY(y).translateZ(-z);
                },
                
                TranslateEntity: (e, x, y, z, global) => {
                    const ent = self.entities.get(e);
                    if (ent) {
                        ent.obj.position.x += x;
                        ent.obj.position.y += y;
                        ent.obj.position.z -= z;
                    }
                },
                
                TurnEntity: (e, pitch, yaw, roll, global) => {
                    const ent = self.entities.get(e);
                    if (ent) {
                        ent.obj.rotation.x += pitch * Math.PI / 180;
                        ent.obj.rotation.y += yaw * Math.PI / 180;
                        ent.obj.rotation.z += roll * Math.PI / 180;
                    }
                },
                
                EntityX: (e, global) => {
                    const ent = self.entities.get(e);
                    return ent ? ent.obj.position.x : 0;
                },
                
                EntityY: (e, global) => {
                    const ent = self.entities.get(e);
                    return ent ? ent.obj.position.y : 0;
                },
                
                EntityZ: (e, global) => {
                    const ent = self.entities.get(e);
                    return ent ? -ent.obj.position.z : 0;
                },
                
                EntityPitch: (e, global) => {
                    const ent = self.entities.get(e);
                    return ent ? ent.obj.rotation.x * 180 / Math.PI : 0;
                },
                
                EntityYaw: (e, global) => {
                    const ent = self.entities.get(e);
                    return ent ? ent.obj.rotation.y * 180 / Math.PI : 0;
                },
                
                EntityRoll: (e, global) => {
                    const ent = self.entities.get(e);
                    return ent ? ent.obj.rotation.z * 180 / Math.PI : 0;
                },
                
                //--------------------------------------------------------------
                // Graphics - Entity Properties
                //--------------------------------------------------------------
                EntityAlpha: (e, alpha) => {
                    const ent = self.entities.get(e);
                    if (ent && ent.material) {
                        ent.material.opacity = alpha;
                        ent.material.transparent = alpha < 1;
                    }
                },
                
                EntityColor: (e, r, g, b) => {
                    const ent = self.entities.get(e);
                    if (ent && ent.material) {
                        ent.material.color.setRGB(r / 255, g / 255, b / 255);
                    }
                },
                
                EntityBlend: (e, mode) => {
                    const ent = self.entities.get(e);
                    if (ent && ent.material) {
                        switch (mode) {
                            case 1: ent.material.blending = THREE.NormalBlending; break;
                            case 2: ent.material.blending = THREE.MultiplyBlending; break;
                            case 3: ent.material.blending = THREE.AdditiveBlending; break;
                        }
                    }
                },
                
                EntityFX: (e, fx) => {
                    const ent = self.entities.get(e);
                    if (ent && ent.material) {
                        // 1 = fullbright, 8 = disable fog, etc.
                        if (fx & 1) ent.material.emissive = ent.material.color;
                    }
                },
                
                EntityTexture: (e, tex) => {
                    const ent = self.entities.get(e);
                    const texture = self.textures.get(tex);
                    if (ent && ent.material && texture) {
                        ent.material.map = texture;
                        ent.material.needsUpdate = true;
                    }
                },
                
                EntityParent: (e, parent, global) => {
                    const ent = self.entities.get(e);
                    const parentEnt = self.entities.get(parent);
                    if (ent && parentEnt) {
                        parentEnt.obj.add(ent.obj);
                    }
                },
                
                FreeEntity: (e) => {
                    const ent = self.entities.get(e);
                    if (ent) {
                        if (ent.obj.parent) ent.obj.parent.remove(ent.obj);
                        else self.scene.remove(ent.obj);
                        self.entities.delete(e);
                    }
                },
                
                HideEntity: (e) => {
                    const ent = self.entities.get(e);
                    if (ent) ent.obj.visible = false;
                },
                
                ShowEntity: (e) => {
                    const ent = self.entities.get(e);
                    if (ent) ent.obj.visible = true;
                },
                
                //--------------------------------------------------------------
                // Sprite-specific
                //--------------------------------------------------------------
                ScaleSprite: (e, w, h) => {
                    const ent = self.entities.get(e);
                    if (ent && ent.type === 'sprite') {
                        ent.obj.scale.set(w, h, 1);
                    }
                },
                
                SpriteViewMode: (e, mode) => {
                    // 1=fixed, 2=free, 3=upright
                    // Three.js sprites are always camera-facing
                },
                
                //--------------------------------------------------------------
                // Camera
                //--------------------------------------------------------------
                CameraRange: (cam, near, far) => {
                    const ent = self.entities.get(cam);
                    if (ent && ent.type === 'camera') {
                        ent.obj.near = near;
                        ent.obj.far = far;
                        ent.obj.updateProjectionMatrix();
                    }
                },
                
                CameraZoom: (cam, zoom) => {
                    const ent = self.entities.get(cam);
                    if (ent && ent.type === 'camera') {
                        ent.obj.fov = 75 / zoom;
                        ent.obj.updateProjectionMatrix();
                    }
                },
                
                //--------------------------------------------------------------
                // Rendering
                //--------------------------------------------------------------
                RenderWorld: () => self.render(),
                Flip: (sync) => {},  // Handled by requestAnimationFrame
                Cls: () => self.renderer.clear(),
                
                //--------------------------------------------------------------
                // Input
                //--------------------------------------------------------------
                KeyDown: (key) => self.keys.has(key) ? 1 : 0,
                KeyHit: (key) => {
                    const hit = self.keysHit.has(key);
                    self.keysHit.delete(key);
                    return hit ? 1 : 0;
                },
                MouseX: () => self.mouseX,
                MouseY: () => self.mouseY,
                MouseDown: (btn) => (self.mouseButtons & (1 << (btn - 1))) ? 1 : 0,
                MouseHit: (btn) => {
                    const hit = self.mouseButtonsHit & (1 << (btn - 1));
                    self.mouseButtonsHit &= ~(1 << (btn - 1));
                    return hit ? 1 : 0;
                },
                MoveMouse: (x, y) => {},
                HidePointer: () => self.canvas.style.cursor = 'none',
                ShowPointer: () => self.canvas.style.cursor = 'default',
                
                //--------------------------------------------------------------
                // Audio (lazy init)
                //--------------------------------------------------------------
                LoadSound: (pathPtr) => {
                    // Async load - return placeholder ID
                    const id = self.nextSoundId++;
                    self._initAudio();
                    const path = self._readString(pathPtr);
                    fetch(path)
                        .then(r => r.arrayBuffer())
                        .then(buf => self.audioCtx.decodeAudioData(buf))
                        .then(audioBuffer => self.sounds.set(id, audioBuffer))
                        .catch(e => console.warn(`Failed to load sound: ${path}`));
                    return id;
                },
                
                PlaySound: (snd) => {
                    const buffer = self.sounds.get(snd);
                    if (buffer && self.audioCtx) {
                        const source = self.audioCtx.createBufferSource();
                        source.buffer = buffer;
                        source.connect(self.audioCtx.destination);
                        source.start();
                        const id = self.nextChannelId++;
                        self.channels.set(id, source);
                        return id;
                    }
                    return 0;
                },
                
                StopChannel: (ch) => {
                    const source = self.channels.get(ch);
                    if (source) {
                        source.stop();
                        self.channels.delete(ch);
                    }
                },
                
                ChannelPlaying: (ch) => self.channels.has(ch) ? 1 : 0,
                FreeSound: (snd) => self.sounds.delete(snd),
                
                //==================================================================
                // B3D Model Loading (simplified parser for thin runtime)
                //==================================================================
                
                LoadAnimMesh: async (pathPtr) => {
                    const path = self._readString(pathPtr);
                    console.log(`LoadAnimMesh: ${path}`);
                    
                    try {
                        const response = await fetch(path);
                        if (!response.ok) throw new Error(`HTTP ${response.status}`);
                        const buffer = await response.arrayBuffer();
                        const data = new Uint8Array(buffer);
                        
                        // Parse B3D and create Three.js mesh
                        const entityId = await self._parseB3D(data, 0);
                        console.log(`Loaded B3D model -> entity ${entityId}`);
                        return entityId;
                    } catch (e) {
                        console.warn(`Failed to load ${path}: ${e.message}`);
                        // Return placeholder cube
                        return self._createPlaceholder();
                    }
                },
                
                Animate: (entityId, mode, speed, seq, trans) => {
                    const ent = self.entities.get(entityId);
                    if (ent && ent.animations) {
                        // mode: 0=stop, 1=loop, 2=pingpong, 3=oneshot
                        ent.animMode = mode;
                        ent.animSpeed = speed || 1.0;
                        ent.animSeq = seq || 0;
                        ent.animTime = 0;
                        ent.animPlaying = mode !== 0;
                        console.log(`Animate entity ${entityId}: mode=${mode}, speed=${speed}`);
                    }
                },
                
                AnimLength: (entityId) => {
                    const ent = self.entities.get(entityId);
                    return ent && ent.animLength ? ent.animLength : 0;
                },
                
                AnimTime: (entityId) => {
                    const ent = self.entities.get(entityId);
                    return ent ? (ent.animTime || 0) : 0;
                },
                
                Animating: (entityId) => {
                    const ent = self.entities.get(entityId);
                    return (ent && ent.animPlaying) ? 1 : 0;
                },
                
                SetAnimSeq: (entityId, seq) => {
                    const ent = self.entities.get(entityId);
                    if (ent) ent.animSeq = seq;
                },
            }),
            
            blitz3d: createProxy({}),
            al: createProxy({}),
        };
    }
    
    //==================================================================
    // B3D Parser (simplified)
    //==================================================================
    
    async _parseB3D(data, parentId) {
        const offset = 0;
        
        // Check header
        const header = String.fromCharCode(...data.slice(0, 4));
        if (header !== 'BB3D') {
            console.warn('Invalid B3D header');
            return this._createPlaceholder();
        }
        
        const version = new DataView(data.buffer).getInt32(4, true);
        console.log(`B3D version: ${version}`);
        
        let pos = 8;
        const meshes = [];
        const animations = [];
        
        while (pos < data.length - 8) {
            const chunkId = new DataView(data.buffer).getInt32(pos, false);
            const chunkSize = new DataView(data.buffer).getInt32(pos + 4, true);
            const chunkName = String.fromCharCode(
                (chunkId >> 24) & 0xff,
                (chunkId >> 16) & 0xff,
                (chunkId >> 8) & 0xff,
                chunkId & 0xff
            );
            
            const chunkEnd = pos + 8 + chunkSize;
            
            if (chunkName === 'TEXS') {
                pos = await this._parseTextures(data, pos + 8, chunkSize);
            } else if (chunkName === 'BRUS') {
                pos = this._parseBrushes(data, pos + 8, chunkSize);
            } else if (chunkName === 'MESH') {
                const meshData = await this._parseMesh(data, pos + 8, chunkSize);
                if (meshData) meshes.push(meshData);
                pos = chunkEnd;
            } else if (chunkName === 'ANIM') {
                const animData = this._parseAnimation(data, pos + 8, chunkSize);
                if (animData) animations.push(animData);
                pos = chunkEnd;
            } else {
                pos = chunkEnd;
            }
        }
        
        // Create Three.js objects
        const root = new THREE.Group();
        const rootId = this.nextEntityId++;
        this.entities.set(rootId, { 
            obj: root, 
            type: 'model',
            animations: animations,
            animMode: 0,
            animSpeed: 1.0,
            animTime: 0,
            animPlaying: false,
            animLength: animations.length > 0 ? animations[0].frames : 0
        });
        this.scene.add(root);
        
        // Create meshes
        for (const meshData of meshes) {
            const mesh = this._createMeshFromData(meshData);
            if (mesh) root.add(mesh);
        }
        
        return rootId;
    }
    
    async _parseTextures(data, offset, size) {
        const end = offset + size;
        while (offset < end) {
            let name = '';
            while (offset < end && data[offset] !== 0) {
                name += String.fromCharCode(data[offset++]);
            }
            offset++; // skip null
            // Skip texture flags, blend, u/v params
            offset += 4 + 4 + 4 + 4 + 4 + 4 + 4;
        }
        return end;
    }
    
    _parseBrushes(data, offset, size) {
        const end = offset + size;
        const numTexs = new DataView(data.buffer).getInt32(offset, true);
        offset += 4;
        
        while (offset < end) {
            let name = '';
            while (offset < end && data[offset] !== 0) {
                name += String.fromCharCode(data[offset++]);
            }
            offset++; // skip null
            // Skip color (4 floats), blend, fx
            offset += 4 + 4 + 4 + 4 + 4 + 4 + 4;
            // Skip texture IDs
            for (let i = 0; i < numTexs && offset < end; i++) {
                offset += 4;
            }
        }
        return end;
    }
    
    async _parseMesh(data, offset, size) {
        const end = offset + size;
        
        // Skip mesh flags if present
        if (offset + 4 <= end && data[offset] === 0xff) {
            offset += 4;
        }
        
        let vertices = null;
        let indices = null;
        let brushIndex = -1;
        
        while (offset < end - 8) {
            const subChunkId = new DataView(data.buffer).getInt32(offset, false);
            const subChunkSize = new DataView(data.buffer).getInt32(offset + 4, true);
            const subEnd = offset + 8 + subChunkSize;
            
            const subChunkName = String.fromCharCode(
                (subChunkId >> 24) & 0xff,
                (subChunkId >> 16) & 0xff,
                (subChunkId >> 8) & 0xff,
                subChunkId & 0xff
            );
            
            if (subChunkName === 'VRTS') {
                vertices = this._parseVertices(data, offset + 8, subChunkSize);
            } else if (subChunkName === 'TRIS') {
                brushIndex = new DataView(data.buffer).getInt32(offset + 8, true);
                indices = this._parseTriangles(data, offset + 12, subChunkSize - 4);
            }
            
            offset = subEnd;
        }
        
        return vertices && indices ? { vertices, indices, brushIndex } : null;
    }
    
    _parseVertices(data, offset, size) {
        const end = offset + size;
        const vertexFlags = new DataView(data.buffer).getInt32(offset, true);
        const texCoordSets = new DataView(data.buffer).getInt32(offset + 4, true);
        const texCoordSize = new DataView(data.buffer).getInt32(offset + 8, true);
        offset += 12;
        
        const positions = [];
        const normals = [];
        const uvs = [];
        const colors = [];
        
        while (offset < end - 12) {
            const x = new DataView(data.buffer).getFloat32(offset, true);
            const y = new DataView(data.buffer).getFloat32(offset + 4, true);
            const z = new DataView(data.buffer).getFloat32(offset + 8, true);
            positions.push(x, y, -z); // Negate Z
            offset += 12;
            
            if (vertexFlags & 1) {
                const nx = new DataView(data.buffer).getFloat32(offset, true);
                const ny = new DataView(data.buffer).getFloat32(offset + 4, true);
                const nz = new DataView(data.buffer).getFloat32(offset + 8, true);
                normals.push(nx, ny, -nz);
                offset += 12;
            }
            
            if (vertexFlags & 2) {
                colors.push(data[offset] / 255, data[offset + 1] / 255, data[offset + 2] / 255, data[offset + 3] / 255);
                offset += 4;
            }
            
            for (let tc = 0; tc < texCoordSets && tc < 2; tc++) {
                if (offset + 8 > end) break;
                const u = new DataView(data.buffer).getFloat32(offset, true);
                const v = new DataView(data.buffer).getFloat32(offset + 4, true);
                uvs.push(u, 1 - v);
                offset += 8;
            }
        }
        
        return { positions, normals, uvs, colors, vertexFlags };
    }
    
    _parseTriangles(data, offset, size) {
        const end = offset + size;
        const indices = [];
        
        while (offset < end - 12) {
            const v0 = new DataView(data.buffer).getInt32(offset, true);
            const v1 = new DataView(data.buffer).getInt32(offset + 4, true);
            const v2 = new DataView(data.buffer).getInt32(offset + 8, true);
            indices.push(v0, v2, v1); // Reverse winding
            offset += 12;
            
            if (offset + 12 <= end) {
                offset += 12; // Skip control points
            }
        }
        
        return indices;
    }
    
    _parseAnimation(data, offset, size) {
        const end = offset + size;
        const flags = new DataView(data.buffer).getInt32(offset, true);
        const frames = new DataView(data.buffer).getInt32(offset + 4, true);
        const speed = new DataView(data.buffer).getFloat32(offset + 8, true);
        
        return { flags, frames, speed, tracks: [] };
    }
    
    _createMeshFromData(meshData) {
        const { positions, indices, normals, uvs, colors } = meshData;
        
        if (positions.length === 0) return null;
        
        const geometry = new THREE.BufferGeometry();
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        if (normals.length > 0) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        } else {
            geometry.computeVertexNormals();
        }
        
        if (uvs.length > 0) {
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        }
        
        if (indices.length > 0) {
            geometry.setIndex(indices);
        }
        
        let material;
        if (colors.length > 0) {
            material = new THREE.MeshBasicMaterial({
                vertexColors: true,
                side: THREE.DoubleSide
            });
        } else {
            material = new THREE.MeshStandardMaterial({
                color: 0x888888,
                side: THREE.DoubleSide
            });
        }
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        return mesh;
    }
    
    _createPlaceholder() {
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        const mesh = new THREE.Mesh(geometry, material);
        
        const root = new THREE.Group();
        const rootId = this.nextEntityId++;
        this.entities.set(rootId, { obj: root, type: 'model' });
        root.add(mesh);
        this.scene.add(root);
        
        return rootId;
    }
    
    //==================================================================
    // Animation Update (called each frame)
    //==================================================================
    
    updateAnimations() {
        for (const [id, ent] of this.entities) {
            if (ent.animations && ent.animPlaying && ent.animMode !== 0) {
                ent.animTime += ent.animSpeed;
                
                const length = ent.animLength || 30;
                if (ent.animTime >= length) {
                    if (ent.animMode === 1) { // Loop
                        ent.animTime = 0;
                    } else if (ent.animMode === 3) { // OneShot
                        ent.animTime = length;
                        ent.animPlaying = false;
                    } else if (ent.animMode === 2) { // PingPong
                        ent.animTime = length;
                        ent.animMode = -2; // Reverse
                    }
                } else if (ent.animTime < 0 && ent.animMode === -2) {
                    ent.animTime = 0;
                    ent.animMode = 2; // Forward
                }
                
                // Apply animation to entity (simple: rotate based on time)
                if (ent.obj) {
                    ent.obj.rotation.y = (ent.animTime / length) * Math.PI * 2;
                }
            }
        }
    }
    
    async loadAndRun(wasmUrl, entryPoint = 'Main') {
        const response = await fetch(wasmUrl);
        const bytes = await response.arrayBuffer();
        const imports = this.getImports();
        
        const { instance } = await WebAssembly.instantiate(bytes, imports);
        
        // Get memory reference
        this.memory = instance.exports.memory || imports.env.memory;
        
        // Run entry point
        if (instance.exports[entryPoint]) {
            instance.exports[entryPoint]();
        } else if (instance.exports._start) {
            instance.exports._start();
        }
        
        return instance;
    }
}

// Export for browser
if (typeof window !== 'undefined') {
    window.Blitz3DThinRuntime = Blitz3DThinRuntime;
}

// Export for Node
if (typeof module !== 'undefined') {
    module.exports = Blitz3DThinRuntime;
}
