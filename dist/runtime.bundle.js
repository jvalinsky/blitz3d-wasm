(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/**
 * Blitz3D Runtime Animation Module
 * Handles skeletal animation, bone hierarchy traversal, and playback control
 */

class Blitz3DAnimation {
    constructor(graphics) {
        this.graphics = graphics;
    }

    animate(entityId, mode, speed, seq, trans) {
        const entity = this.graphics.entities[entityId];
        if (!entity) return;

        // If entity has an AnimationMixer attached (created during load)
        if (entity.userData.mixer) {
            const action = entity.userData.action;
            if (action) {
                action.enabled = (mode !== 0);
                action.setEffectiveTimeScale(speed || 1.0);

                if (mode === 1) { // Loop
                    action.setLoop(THREE.LoopRepeat);
                    action.play();
                } else if (mode === 2) { // PingPong - Not directly supported by simple action, approximating
                    action.setLoop(THREE.LoopPingPong);
                    action.play();
                } else if (mode === 3) { // OneShot
                    action.setLoop(THREE.LoopOnce);
                    action.clampWhenFinished = true;
                    action.play();
                } else {
                    action.stop();
                }
            }
        }
    }

    setAnimTime(entityId, time, seq) {
        const entity = this.graphics.entities[entityId];
        if (entity && entity.userData.mixer && entity.userData.action) {
            entity.userData.action.time = time;
            entity.userData.mixer.update(0); // Force update
        }
    }

    // Placeholder for actual GLTF/B3D loading
    // In a real implementation, this would parse the file, create the hierarchy,
    // and most importantly: REGISTER BONES AS ENTITIES
    loadAnimMesh(path, parentId) {
        console.log(`Loading Anim Mesh: ${path}`);

        // Simulating a hierarchy load
        // 1. Create Root (pivot)
        // 2. Load Model (SkinnedMesh)
        // 3. Register all Bones

        const root = new THREE.Group();
        const rootId = this.graphics.nextEntityId++;
        this.graphics.entities[rootId] = root;

        if (parentId) {
            const parent = this.graphics.entities[parentId];
            if (parent) parent.add(root);
        } else {
            this.graphics.scene.add(root);
        }

        // Logic to traverse loaded GLTF and register bones:
        /*
        loader.load(path, (gltf) => {
            const model = gltf.scene;
            root.add(model);
            
            // Setup Animation Mixer
            const mixer = new THREE.AnimationMixer(model);
            const clips = gltf.animations;
            if (clips.length > 0) {
                const action = mixer.clipAction(clips[0]);
                root.userData.mixer = mixer;
                root.userData.action = action;
                this.graphics.animMixers.add(mixer);
            }

            model.traverse((child) => {
                // Register every node/bone as a Blitz3D entity
                const id = this.graphics.nextEntityId++;
                this.graphics.entities[id] = child;
                child.userData.id = id;
                
                // If it's a bone, we can now use RotateEntity(id, ...) on it!
            });
        });
        */

        // For now, return the root ID
        return rootId;
    }
}

module.exports = { Blitz3DAnimation };

},{}],2:[function(require,module,exports){
/**
 * Blitz3D Runtime Core Module
 * Essential functionality and initialization
 */

class Blitz3DCore {
    constructor() {
        this.memory = null;
        this.canvas = null;
        this.gl = null;
        this.textCanvas = null;
        this.ctx2d = null;
        this.instance = null;
        this.module = null;
        this.exports = null;
        this.dataPointer = 256;
        this.allocString = null;
    }

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error("Canvas not found: " + canvasId);
            return;
        }

        // Setup 2D overlay canvas for Text commands
        this.textCanvas = document.createElement('canvas');
        this.textCanvas.width = this.canvas.width;
        this.textCanvas.height = this.canvas.height;
        this.textCanvas.style.position = 'absolute';
        this.textCanvas.style.top = '0';
        this.textCanvas.style.left = '0';
        this.textCanvas.style.pointerEvents = 'none';
        this.canvas.parentElement.appendChild(this.textCanvas);
        this.ctx2d = this.textCanvas.getContext('2d');

        console.log("Blitz3D Runtime Core Initialized");
    }

    readString(ptr) {
        if (!this.memory || !this.memory.buffer) {
            return "";
        }
        const memory = new Uint8Array(this.memory.buffer);
        const maxLen = memory.length;
        let str = "";
        let i = ptr;
        const maxStringLen = 1024 * 1024;
        let charsRead = 0;
        while (i < maxLen && charsRead < maxStringLen) {
            const byte = memory[i];
            if (byte === 0) break;
            str += String.fromCharCode(byte);
            i++;
            charsRead++;
        }
        return str;
    }

    setupCommonImports(imports) {
        imports.env.PrintInt = (val) => console.log(`[Blitz3D] Int: ${val}`);
        imports.env.PrintString = (ptr) => {
            const str = this.readString(ptr);
            console.log(`[Blitz3D] String: ${str}`);
            return str.length;
        };

        imports.env.Cls = () => {
            if (this.gl) {
                this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
            }
            if (this.ctx2d) {
                this.ctx2d.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);
            }
        };

        imports.env.Flip = (vwait) => {
            // No-op for now in requestAnimationFrame loop
        };

        // Time
        imports.env.MilliCSecs = () => performance.now() | 0;
        imports.env.Delay = (ms) => { };

        // Math
        imports.env.Sin = Math.sin;
        imports.env.Cos = Math.cos;
        imports.env.Tan = Math.tan;
        imports.env.ASin = Math.asin;
        imports.env.ACos = Math.acos;
        imports.env.ATan = Math.atan;
        imports.env.ATan2 = Math.atan2;
        imports.env.Sqr = Math.sqrt;
        imports.env.Sqrt = Math.sqrt;
        imports.env.Floor = Math.floor;
        imports.env.Ceil = Math.ceil;
        imports.env.Exp = Math.exp;
        imports.env.Log = Math.log;
        imports.env.Log10 = Math.log10;
        imports.env.Abs = Math.abs;
        imports.env.Sgn = Math.sign;
        imports.env.Mod = (a, b) => a % b;
        imports.env.Rnd = (min, max) => Math.random() * (max - min) + min;
        imports.env.Rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        imports.env.SeedRnd = (seed) => { }; // TODO: Implement seeded random

        // Strings
        imports.env.StringConcat = (aPtr, bPtr) => {
            const a = this.readString(aPtr);
            const b = this.readString(bPtr);
            // Alloc new string currently not implemented fully in this stub
            // Ideally we call back to WASM to alloc, or use a JS string manager
            console.warn("StringConcat not fully implemented");
            return 0;
        };
        imports.env.IntToString = (i) => 0; // Stub
        imports.env.FloatToString = (f) => 0; // Stub

        imports.env.Left = (str, n) => 0;
        imports.env.Right = (str, n) => 0;
        imports.env.Mid = (str, start, len) => 0;
        imports.env.Upper = (str) => 0;
        imports.env.Lower = (str) => 0;
        imports.env.Replace = (str, find, sub) => 0;
        imports.env.Instr = (str, find, start) => 0;
        imports.env.Len = (str) => 0;
        imports.env.Trim = (str) => 0;
        imports.env.LTrim = (str) => 0;
        imports.env.RTrim = (str) => 0;

        // File I/O Stubs
        imports.env.ReadFile = (path) => 0;
        imports.env.WriteFile = (path) => 0;
        imports.env.CloseFile = (stream) => { };
        imports.env.ReadInt = (stream) => 0;
        imports.env.ReadFloat = (stream) => 0.0;
        imports.env.ReadString = (stream) => 0;
        imports.env.ReadByte = (stream) => 0;
        imports.env.ReadShort = (stream) => 0;
        imports.env.Eof = (stream) => 1;
        imports.env.FileSize = (path) => 0;
        imports.env.FileType = (path) => 0;
        imports.env.ReadData = (stream, buf, count) => 0;
        imports.env.RestoreData = (label) => { };

        // Banks
        imports.env.CreateBank = (size) => 0;
        imports.env.FreeBank = (bank) => { };
        imports.env.BankSize = (bank) => 0;
        imports.env.ResizeBank = (bank, size) => { };
        imports.env.CopyBank = (src, srcPos, dest, destPos, count) => { };
        imports.env.PeekByte = (bank, offset) => 0;
        imports.env.PokeByte = (bank, offset, val) => { };
        imports.env.PeekInt = (bank, offset) => 0;
        imports.env.PokeInt = (bank, offset, val) => { };
        imports.env.PeekFloat = (bank, offset) => 0.0;
        imports.env.PokeFloat = (bank, offset, val) => { };
        imports.env.PeekShort = (bank, offset) => 0;
        imports.env.PokeShort = (bank, offset, val) => { };

        // Audio Stubs
        imports.env.PlaySound = (sound) => 0;
        imports.env.FreeSound = (sound) => { };
        imports.env.StopChannel = (chn) => { };
        imports.env.ChannelVolume = (chn, vol) => { };
        imports.env.ChannelPaused = (chn, paused) => { };
        imports.env.ChannelPlaying = (chn) => 0;
        imports.env.FSOUND_Init = (freq, channels, flags) => 1;
        imports.env.FSOUND_Stream_Open = (path, mode, offset, len) => 0;
        imports.env.FSOUND_Stream_Play = (chn, stream) => 0;
        imports.env.FSOUND_SetVolume = (chn, vol) => { };
        imports.env.FSOUND_SetPaused = (chn, paused) => { };
        imports.env.FSOUND_Stream_Stop = (stream) => { };
        imports.env.FSOUND_Close = () => { };

        // Zip Stubs
        imports.env.ZlibWapi_Open = (path) => 0;
        imports.env.ZlibWapi_Close = (zip) => { };
        imports.env.ZlibWapi_GetFileCount = (zip) => 0;
        imports.env.ZlibWapi_GetFileName = (zip, index) => 0;
        imports.env.ZlibWapi_ExtractFile = (zip, index, dest) => 0;
    }
}

window.Blitz3DCore = Blitz3DCore;
module.exports = Blitz3DCore;
},{}],3:[function(require,module,exports){
/**
 * Blitz3D Runtime Graphics Module
 * WebGL/Three.js integration for 3D rendering
 */

class Blitz3DGraphics {
    constructor(core) {
        this.core = core;
        this.Blitz3DSurface = require('./mesh').Blitz3DSurface;
        this.Blitz3DAnimation = require('./animation').Blitz3DAnimation;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.entities = {};
        this.textures = {};
        this.animMixers = new Set();
        this.images = {};
        this.nextImageId = 1;
        this.nextEntityId = 1;
        this.surfaces = {};
        this.nextSurfaceId = 1;
        this.nextTextureId = 1;
        this.currentFont = "arial";
        this.currentFontSize = 12;
        this.currentColor = [255, 255, 255, 255];
        this.clearColor = [0, 0, 0, 1];
        this.lastTime = 0;
        this.ambientLight = null;
        this.fog = null;
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
        console.log("Canvas dimensions from core: " + canvasWidth + "x" + canvasHeight);

        if (!canvasWidth || canvasWidth <= 0) {
            console.error("init3D: Invalid canvas width: " + canvasWidth + ", defaulting to 800");
            this.core.canvas.width = 800;
        }
        if (!canvasHeight || canvasHeight <= 0) {
            console.error("init3D: Invalid canvas height: " + canvasHeight + ", defaulting to 600");
            this.core.canvas.height = 600;
        }

        // Check Three.js availability
        if (!window.THREE) {
            console.error("Three.js not loaded! Cannot initialize 3D graphics.");
            return;
        }

        console.log("Three.js version: " + THREE.REVISION);

        this.scene = new THREE.Scene();
        console.log("THREE.Scene created");

        // Create WebGL renderer with validation
        console.log("Creating WebGLRenderer...");
        try {
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.core.canvas,
                antialias: false
            });
            console.log("WebGLRenderer created successfully");

            // Verify renderer was created properly
            if (!this.renderer) {
                throw new Error("Renderer is null after construction");
            }

            // Verify renderer has required methods
            if (typeof this.renderer.setSize !== 'function') {
                throw new Error("Renderer missing setSize method");
            }
            if (typeof this.renderer.render !== 'function') {
                throw new Error("Renderer missing render method");
            }

            // Set size
            this.renderer.setSize(this.core.canvas.width, this.core.canvas.height);
            this.renderer.autoClear = false;
            console.log("Renderer size set to: " + this.core.canvas.width + "x" + this.core.canvas.height);

            // Verify WebGL context
            const gl = this.core.canvas.getContext('webgl') || this.core.canvas.getContext('experimental-webgl');
            if (gl) {
                console.log("WebGL context verified");
                console.log("WebGL Renderer: " + gl.getParameter(gl.RENDERER));
                console.log("WebGL Version: " + gl.getParameter(gl.VERSION));
            } else {
                console.warn("Could not verify WebGL context");
            }

        } catch (e) {
            console.error("WebGL Init Failed: " + e.message);
            console.warn("Falling back to mock renderer");

            // Create mock renderer for debugging
            this.renderer = {
                setSize: (w, h) => {
                    console.log("MockRenderer.setSize: " + w + "x" + h);
                    if (this.core && this.core.canvas) {
                        this.core.canvas.width = w;
                        this.core.canvas.height = h;
                    }
                },
                render: (scene, camera) => {
                    console.log("MockRenderer.render called (no-op)");
                },
                setClearColor: (color, alpha) => {
                    console.log("MockRenderer.setClearColor called");
                },
                clear: () => {
                    console.log("MockRenderer.clear called");
                },
                setPixelRatio: () => {
                    console.log("MockRenderer.setPixelRatio called");
                },
                capabilities: { getMaxAnisotropy: () => 1 },
                domElement: this.core.canvas
            };
        }

        this.animationSystem = new this.Blitz3DAnimation(this);
        console.log("Animation system initialized");

        this.animate();
        console.log("Animation loop started");
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));

        const delta = (time - this.lastTime) / 1000.0;
        this.lastTime = time;

        if (delta > 0 && delta < 0.1) {
            this.animMixers.forEach(mixer => mixer.update(delta));
        }

        // Debug Log every ~100 frames (approx 1.6s)
        this.frameCount = (this.frameCount || 0) + 1;
        if (this.frameCount % 100 === 0) {
            console.log("--- Debug Frame " + this.frameCount + " ---");
            console.log("Loop Running. Camera:", this.camera ? "Exists" : "MISSING");
            if (this.camera) {
                console.log("Camera Pos:", this.camera.position);
                console.log("Camera Rot:", this.camera.rotation);
            }
            if (this.scene) {
                console.log("Scene Children:", this.scene.children.length);
                this.scene.children.forEach((child, i) => {
                    console.log(`Child ${i} (ID ${child.id}): Type ${child.type} Pos ${JSON.stringify(child.position)}`);
                });
            }
        }

        if (this.renderer && this.scene && this.camera) {
            this.updateSurfaces();
            this.renderer.render(this.scene, this.camera);
        }
    }

    setupImports(imports) {
        imports.env.Graphics3D = (width, height, depth, mode) => {
            console.log("Graphics3D called: " + width + "x" + height + ", depth=" + depth + ", mode=" + mode);

            // Validate dimensions
            if (width <= 0 || height <= 0) {
                console.error("Graphics3D: Invalid dimensions " + width + "x" + height + ", using defaults");
                width = 800;
                height = 600;
            }

            if (width > 4096 || height > 4096) {
                console.warn("Graphics3D: dimensions exceed maximum, capping to 4096");
                width = Math.min(width, 4096);
                height = Math.min(height, 4096);
            }

            if (this.core.canvas) {
                console.log("Updating canvas from " + this.core.canvas.width + "x" + this.core.canvas.height + " to " + width + "x" + height);
                this.core.canvas.width = width;
                this.core.canvas.height = height;
            } else {
                console.error("Graphics3D: canvas is not available!");
            }

            if (this.renderer) {
                console.log("Setting renderer size to " + width + "x" + height);
                this.renderer.setSize(width, height);

                // Important: Update camera aspect ratio
                if (this.camera) {
                    console.log("Updating camera aspect from " + this.camera.aspect + " to " + (width / height));
                    this.camera.aspect = width / height;
                    this.camera.updateProjectionMatrix();
                    console.log("Camera projection updated");
                } else {
                    console.warn("Graphics3D: No camera to update aspect ratio");
                }
            } else {
                console.error("Graphics3D: renderer is not initialized!");
            }

            console.log("Graphics3D initialization complete");
        };

        imports.env.ClsColor = (r, g, b) => {
            this.clearColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
            if (this.renderer) {
                this.renderer.setClearColor(new THREE.Color(r / 255.0, g / 255.0, b / 255.0), 1.0);
            }
        };

        imports.env.Cls = () => {
            if (this.renderer) {
                this.renderer.clear();
            }
            if (this.core.ctx2d) {
                this.core.ctx2d.clearRect(0, 0, this.core.textCanvas.width, this.core.textCanvas.height);
            }
        };

        imports.env.Color = (r, g, b) => {
            this.currentColor = [r, g, b, 255];
            if (this.core.ctx2d) {
                this.core.ctx2d.fillStyle = `rgb(${r},${g},${b})`;
                this.core.ctx2d.strokeStyle = `rgb(${r},${g},${b})`;
            }
        };

        imports.env.GetColor = (x, y) => { };

        // 2D Primitives Stubs
        imports.env.Rect = (x, y, w, h, solid) => {
            if (this.core.ctx2d) {
                if (solid) this.core.ctx2d.fillRect(x, y, w, h);
                else this.core.ctx2d.strokeRect(x, y, w, h);
            }
        };
        imports.env.Oval = (x, y, w, h, solid) => {
            if (this.core.ctx2d) {
                this.core.ctx2d.beginPath();
                this.core.ctx2d.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
                if (solid) this.core.ctx2d.fill();
                else this.core.ctx2d.stroke();
            }
        };
        imports.env.Line = (x1, y1, x2, y2) => {
            if (this.core.ctx2d) {
                this.core.ctx2d.beginPath();
                this.core.ctx2d.moveTo(x1, y1);
                this.core.ctx2d.lineTo(x2, y2);
                this.core.ctx2d.stroke();
            }
        };
        imports.env.Text = (x, y, txtPtr, cx, cy) => {
            const txt = this.core.readString(txtPtr);
            if (this.core.ctx2d) {
                this.core.ctx2d.fillText(txt, x, y);
            }
        };

        // Image Stubs
        imports.env.LoadImage = (pathPtr) => 0;
        imports.env.DrawImage = (img, x, y, frame) => { };
        imports.env.DrawBlock = (img, x, y, frame) => { };
        imports.env.TileImage = (img, x, y, frame) => { };
        imports.env.ImageWidth = (img) => 0;
        imports.env.ImageHeight = (img) => 0;
        imports.env.HandleImage = (img, x, y) => { };
        imports.env.MidHandle = (img) => { };
        imports.env.AutoMidHandle = (img) => { };
        imports.env.MaskImage = (img, r, g, b) => { };
        imports.env.ScaleImage = (img, w, h) => { };
        imports.env.ResizeImage = (img, w, h) => { };
        imports.env.FreeImage = (img) => { };

        imports.env.CreateCamera = (parent) => {
            console.log("CreateCamera called with parent: " + parent);

            // Validation assertions
            if (!this.core) {
                console.error("CreateCamera: core is not initialized");
                return 0;
            }
            if (!this.core.canvas) {
                console.error("CreateCamera: canvas is not available");
                return 0;
            }
            if (!this.scene) {
                console.error("CreateCamera: scene is not initialized");
                return 0;
            }

            // Check canvas dimensions
            const canvasWidth = this.core.canvas.width || 800;
            const canvasHeight = this.core.canvas.height || 600;
            if (canvasWidth <= 0 || canvasHeight <= 0) {
                console.error("CreateCamera: invalid canvas dimensions " + canvasWidth + "x" + canvasHeight);
                return 0;
            }

            console.log("Creating PerspectiveCamera with aspect: " + (canvasWidth / canvasHeight));
            const cam = new THREE.PerspectiveCamera(75, canvasWidth / canvasHeight, 1.0, 1000.0);
            
            // Set camera position and look at origin
            cam.position.set(0, 0, 5);
            cam.lookAt(0, 0, 0);
            
            console.log("Camera position set to: " + cam.position.x + ", " + cam.position.y + ", " + cam.position.z);
            
            const id = this.nextEntityId++;
            this.entities[id] = cam;
            this.entities[id].isCamera = true;

            if (parent && this.entities[parent]) {
                console.log("Adding camera as child of parent entity: " + parent);
                this.entities[parent].add(cam);
            } else {
                this.scene.add(cam);
                console.log("Camera added directly to scene");
            }

            if (!this.camera) {
                console.log("Setting active camera to ID: " + id);
                this.camera = cam;
            } else {
                console.log("Active camera already exists, keeping existing camera");
            }

            console.log("CreateCamera completed, ID: " + id);
            console.log("Active camera is now: " + (this.camera === cam ? 'NEW CAMERA' : 'EXISTING CAMERA'));
            
            return id;
        };

        imports.env.CreateLight = (type) => {
            console.log("CreateLight called with type: " + type);

            // Validate scene
            if (!this.scene) {
                console.error("CreateLight: scene is not initialized");
                return 0;
            }

            let light;
            switch (type) {
                case 1:
                    light = new THREE.PointLight(0xffffff, 1, 100);
                    console.log("Created PointLight");
                    break;
                case 2:
                    light = new THREE.SpotLight(0xffffff, 1);
                    light.penumbra = 0.5;
                    console.log("Created SpotLight");
                    break;
                default:
                    light = new THREE.DirectionalLight(0xffffff, 1);
                    console.log("Created DirectionalLight (default)");
            }

            const id = this.nextEntityId++;
            this.entities[id] = light;
            this.scene.add(light);
            console.log("Light added to scene, ID: " + id);
            return id;
        };

        imports.env.CreateMesh = (parent) => {
            console.log("CreateMesh called with parent: " + parent);

            const mesh = new THREE.Mesh();
            mesh.isMesh = true;
            
            // Ensure mesh has a visible material
            mesh.material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                vertexColors: true,
                side: THREE.DoubleSide
            });
            
            console.log("Mesh created with default white material");

            const id = this.nextEntityId++;
            this.entities[id] = mesh;

            if (parent && this.entities[parent]) {
                console.log("Adding mesh as child of parent: " + parent);
                this.entities[parent].add(mesh);
            } else {
                this.scene.add(mesh);
                console.log("Mesh added directly to scene at position: " + 
                    mesh.position.x + ", " + mesh.position.y + ", " + mesh.position.z);
            }

            console.log("Mesh created, ID: " + id);
            return id;
        };

        imports.env.PositionEntity = (ent, x, y, z) => {
            const entity = this.entities[ent];
            if (entity) {
                // Convert from Blitz3D's left-handed coordinate system to Three.js right-handed
                // In Blitz3D: +Z is towards viewer, -Z is away
                // In Three.js: +Z is away from viewer, -Z is towards viewer
                // So we negate Z to convert
                entity.position.set(x, y, -z);
                console.log("PositionEntity ID " + ent + " to (" + x + ", " + y + ", " + z + ") -> Three.js (" + 
                    entity.position.x + ", " + entity.position.y + ", " + entity.position.z + ")");
            } else {
                console.warn("PositionEntity: entity " + ent + " not found");
            }
        };

        imports.env.RotateEntity = (ent, pitch, yaw, roll) => {
            const entity = this.entities[ent];
            if (entity) entity.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180);
        };

        imports.env.ScaleEntity = (ent, x, y, z) => {
            const entity = this.entities[ent];
            if (entity) entity.scale.set(x, y, z);
        };

        imports.env.MoveEntity = (ent, x, y, z) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.translateX(x);
                entity.translateY(y);
                entity.translateZ(-z);
            }
        };

        imports.env.TurnEntity = (ent, pitch, yaw, roll, global) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.rotateX(pitch * Math.PI / 180);
                entity.rotateY(yaw * Math.PI / 180);
                entity.rotateZ(roll * Math.PI / 180);
                if (this.frameCount % 60 === 0 || this.frameCount < 10) {
                    console.log("TurnEntity ID " + ent + " by (" + pitch + ", " + yaw + ", " + roll + "), rotation: (" + 
                        (entity.rotation.x * 180 / Math.PI).toFixed(1) + ", " +
                        (entity.rotation.y * 180 / Math.PI).toFixed(1) + ", " +
                        (entity.rotation.z * 180 / Math.PI).toFixed(1) + ")");
                }
            }
        };

        // Extended Entity Stubs
        imports.env.EntityX = (ent, global) => 0.0;
        imports.env.EntityY = (ent, global) => 0.0;
        imports.env.EntityZ = (ent, global) => 0.0;
        imports.env.EntityPitch = (ent, global) => 0.0;
        imports.env.EntityYaw = (ent, global) => 0.0;
        imports.env.EntityRoll = (ent, global) => 0.0;
        imports.env.EntityDistance = (ent1, ent2) => 0.0;
        imports.env.EntityVisible = (src, dest) => 0;
        imports.env.EntityInView = (ent, cam) => 0;
        imports.env.CreatePivot = (parent) => this.imports.env.CreateMesh(parent);
        imports.env.FreeEntity = (ent) => {
            const entity = this.entities[ent];
            if (entity) {
                if (entity.parent) entity.parent.remove(entity);
                this.entities[ent] = null; // Should traverse and remove children too
            }
        };

        imports.env.CopyEntity = (ent, parent) => {
            const entity = this.entities[ent];
            if (entity) {
                const clone = entity.clone();
                const id = this.nextEntityId++;
                this.entities[id] = clone;

                if (parent && this.entities[parent]) {
                    this.entities[parent].add(clone);
                } else {
                    this.scene.add(clone);
                }
                return id;
            }
            return 0;
        };

        imports.env.EntityTexture = (ent, tex, frame, index) => {
            const entity = this.entities[ent];
            const texture = this.textures[tex];
            if (entity && texture) {
                entity.traverse((child) => {
                    if (child.isMesh) {
                        // Ensure material is not shared if we modify it
                        if (!Array.isArray(child.material)) {
                            child.material = child.material.clone();
                            child.material.map = texture;
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        };

        // Mesh Surface Commands
        imports.env.CreateSurface = (meshId, brushId) => {
            const mesh = this.entities[meshId];
            if (mesh) {
                if (this.frameCount < 5) {
                    console.log("CreateSurface for mesh ID: " + meshId);
                }
                const surface = new this.Blitz3DSurface(mesh);
                const id = this.nextSurfaceId++;
                this.surfaces[id] = surface;

                // Store surface reference in the surface mesh's userData for UpdateNormals to find
                if (mesh.children.length > 0) {
                    const surfaceMesh = mesh.children[mesh.children.length - 1];
                    surfaceMesh.userData.surface = surface;
                    if (this.frameCount < 5) {
                        console.log("Surface created, ID: " + id + ", stored in userData");
                    }
                }

                return id;
            } else {
                if (this.frameCount < 5) {
                    console.error("CreateSurface: mesh " + meshId + " not found");
                }
            }
            return 0;
        };

        imports.env.AddVertex = (surfId, x, y, z, u, v, w) => {
            const surface = this.surfaces[surfId];
            if (surface) {
                const vertexIndex = surface.addVertex(x, y, z, u, v);
                console.log("AddVertex surface " + surfId + ": index=" + vertexIndex + " at (" + x + ", " + y + ", " + z + ")");
                return vertexIndex;
            } else {
                console.error("AddVertex: surface " + surfId + " not found");
                return 0;
            }
        };

        imports.env.AddTriangle = (surfId, v0, v1, v2) => {
            const surface = this.surfaces[surfId];
            if (surface) {
                const triangleIndex = surface.addTriangle(v0, v1, v2);
                if (this.frameCount < 10) {
                    console.log("AddTriangle surface " + surfId + ": indices=(" + v0 + ", " + v1 + ", " + v2 + "), triangleIndex=" + triangleIndex);
                }
                return triangleIndex;
            } else {
                console.error("AddTriangle: surface " + surfId + " not found");
                return 0;
            }
        };

        imports.env.VertexColor = (surfId, vid, r, g, b, a) => {
            const surface = this.surfaces[surfId];
            if (surface) surface.vertexColor(vid, r, g, b, a);
        };

        imports.env.UpdateNormals = (meshId) => {
            const mesh = this.entities[meshId];
            if (mesh) {
                if (this.frameCount < 5) {
                    console.log("UpdateNormals for mesh ID: " + meshId + ", children: " + mesh.children.length);
                }

                if (mesh.children) {
                    // Iterate through children which are the surface meshes
                    mesh.children.forEach((child, i) => {
                        if (this.frameCount < 5) {
                            console.log("  Processing child " + i + ": type=" + (child.isMesh ? 'Mesh' : 'Other'));
                        }

                        // First, update the surface if it's a Blitz3DSurface
                        // This ensures geometry.attributes.position exists
                        if (child.userData && child.userData.surface) {
                            if (this.frameCount < 5) {
                                console.log("  Found surface in userData, calling update()...");
                            }
                            child.userData.surface.update();
                            if (this.frameCount < 5) {
                                console.log("  Surface update complete");
                            }
                        } else {
                            if (this.frameCount < 5) {
                                console.log("  No surface in userData, checking surfaces map...");
                            }
                            // Also check if this.graphics.surfaces contains a matching surface
                            for (const surfId in this.surfaces) {
                                const surf = this.surfaces[surfId];
                                if (surf.mesh === child) {
                                    if (this.frameCount < 5) {
                                        console.log("  Found matching surface in map, ID: " + surfId + ", calling update()...");
                                    }
                                    surf.update();
                                    if (this.frameCount < 5) {
                                        console.log("  Surface update complete");
                                    }
                                    break;
                                }
                            }
                        }

                        // Now check geometry status with ULTRA-SAFE guards
                        try {
                            if (!child || !child.geometry) {
                                if (this.frameCount < 5) {
                                    console.log("  Skipping child " + i + ": no geometry");
                                }
                                return;
                            }

                            // Check if attributes exist
                            if (!child.geometry.attributes) {
                                if (this.frameCount < 5) {
                                    console.log("  Skipping child " + i + ": no attributes, available: " + Object.keys(child.geometry).join(', '));
                                }
                                return;
                            }

                            // Check if position attribute exists
                            if (!child.geometry.attributes.position) {
                                if (this.frameCount < 5) {
                                    console.log("  Skipping child " + i + ": no position attribute");
                                }
                                return;
                            }

                            // Now compute normals on the updated geometry with optional chaining
                            child.geometry.computeVertexNormals?.();

                            // Ultra-safe needsUpdate with optional chaining
                            child.geometry.attributes.position.needsUpdate = true;

                            if (this.frameCount < 5) {
                                console.log("  Computed normals for child " + i);
                            }
                        } catch (e) {
                            console.warn("UpdateNormals safe-guard caught error: " + e.message);
                        }
                    });
                }
            } else {
                if (this.frameCount < 5) {
                    console.error("UpdateNormals: mesh " + meshId + " not found");
                }
            }
        };

        imports.env.LoadMesh = (pathPtr, parent) => {
            const path = this.core.readString(pathPtr);
            console.log(`Loading Mesh: ${path}`);
            return this.imports.env.CreateMesh(parent);
        };

        // Animation Commands
        imports.env.LoadAnimMesh = (pathPtr, parent) => {
            const path = this.core.readString(pathPtr);
            return this.animationSystem.loadAnimMesh(path, parent);
        };

        imports.env.Animate = (ent, mode, speed, seq, trans) => {
            this.animationSystem.animate(ent, mode, speed, seq, trans);
        };

        imports.env.SetAnimTime = (ent, time, seq) => {
            this.animationSystem.setAnimTime(ent, time, seq);
        };

        imports.env.RenderWorld = (tween) => {
            // Validation before rendering
            if (!this.renderer) {
                if (this.frameCount % 60 === 0) console.error("RenderWorld: renderer is null");
                return;
            }
            if (!this.scene) {
                if (this.frameCount % 60 === 0) console.error("RenderWorld: scene is null");
                return;
            }
            if (!this.camera) {
                if (this.frameCount % 60 === 0) console.error("RenderWorld: camera is null - mesh will not be visible!");
                return;
            }

            // Verify camera aspect ratio
            if (isNaN(this.camera.aspect) || !isFinite(this.camera.aspect)) {
                if (this.frameCount % 60 === 0) {
                    console.error("RenderWorld: camera aspect is invalid: " + this.camera.aspect);
                    console.error("Canvas dimensions: " + this.core.canvas.width + "x" + this.core.canvas.height);
                }
                return;
            }

            // Verify renderer has render method
            if (typeof this.renderer.render !== 'function') {
                if (this.frameCount % 60 === 0) console.error("RenderWorld: renderer.render is not a function");
                return;
            }

            // All checks passed, render
            this.updateSurfaces();
            try {
                this.renderer.render(this.scene, this.camera);
            } catch (e) {
                if (this.frameCount % 60 === 0) console.error("RenderWorld: render failed: " + e.message);
            }
        };

        imports.env.UpdateWorld = (elapsed) => { };

        // Camera/Light/Fog Stubs
        imports.env.AmbientLight = (r, g, b) => {
            if (this.ambientLight) {
                this.scene.remove(this.ambientLight);
            }
            this.ambientLight = new THREE.AmbientLight(new THREE.Color(r / 255.0, g / 255.0, b / 255.0));
            this.scene.add(this.ambientLight);
        };
        imports.env.LightColor = (light, r, g, b) => { };
        imports.env.LightRange = (light, range) => { };
        imports.env.CameraClsColor = (cam, r, g, b) => { };
        imports.env.CameraRange = (cam, near, far) => { };
        imports.env.CameraZoom = (cam, zoom) => { };
        imports.env.CameraProjMode = (cam, mode) => { };
        imports.env.CameraViewport = (cam, x, y, w, h) => { };
        imports.env.FogMode = (mode) => { };
        imports.env.FogColor = (r, g, b) => { };
        imports.env.FogRange = (near, far) => { };
        imports.env.FogDensity = (d) => { };

        // Primitives
        imports.env.CreateCube = (parent) => {
            const geometry = new THREE.BoxGeometry(2, 2, 2); // Blitz3D cubes are 2x2x2 by default centered at 0
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            const id = this.nextEntityId++;
            this.entities[id] = mesh;
            if (parent && this.entities[parent]) this.entities[parent].add(mesh);
            else this.scene.add(mesh);
            return id;
        };

        imports.env.CreateSphere = (parent, segs) => {
            const segments = segs || 8;
            const geometry = new THREE.SphereGeometry(1, segments, segments); // Radius 1
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            const id = this.nextEntityId++;
            this.entities[id] = mesh;
            if (parent && this.entities[parent]) this.entities[parent].add(mesh);
            else this.scene.add(mesh);
            return id;
        };

        // Texture/Assets
        imports.env.LoadTexture = (pathPtr, flags) => {
            const path = this.core.readString(pathPtr);
            console.log("Loading Texture:", path);
            // TODO: Cache texture loading
            const loader = new THREE.TextureLoader();
            const tex = loader.load(path);

            // Handle flags (1: Color, 2: Alpha, 4: Masked) - simplified for now
            if (flags & 2) tex.format = THREE.RGBAFormat;

            const id = this.nextTextureId++; // Need to add this to class
            this.textures[id] = tex;
            return id;
        };

        imports.env.LoadAsset = (pathPtr) => 0;
        imports.env.GetAssetData = (handle) => 0;
        imports.env.GetAssetSize = (handle) => 0;

        imports.env.AnimTime = (ent) => 0.0;
        imports.env.AnimLength = (ent) => 0.0;
        imports.env.ExtractAnimSeq = (ent, first, last) => 0;
        imports.env.AddAnimSeq = (ent, len) => 0;
        imports.env.AnimSeq = (ent) => 0;
        imports.env.Animating = (ent) => 0;
        imports.env.Delay = (ms) => { };
        imports.env.WaitKey = () => 0;
    }

    updateSurfaces() {
        for (const id in this.surfaces) {
            this.surfaces[id].update();
        }
    }
}

window.Blitz3DGraphics = Blitz3DGraphics;
module.exports = Blitz3DGraphics;
},{"./animation":1,"./mesh":5}],4:[function(require,module,exports){
/**
 * Blitz3D Runtime Input Module
 * Keyboard and mouse input handling
 */

class Blitz3DInput {
    constructor(core, graphics) {
        this.core = core;
        this.graphics = graphics;
        this.keys = {};
        this.keyHits = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseZ = 0;
        this.mouseXSpeed = 0;
        this.mouseYSpeed = 0;
        this.mouseButtons = {};
        this.mouseButtonHits = {};
        this.pointerLocked = false;
        this.consoleLine = 0;
        this.wantPointerLock = false;
    }

    setupImports(imports) {
        imports.env.KeyDown = (key) => this.keys[key] ? 1 : 0;
        imports.env.KeyHit = (key) => this.keyHits[key] ? 1 : 0;
        imports.env.MouseX = () => this.mouseX;
        imports.env.MouseY = () => this.mouseY;
        imports.env.MouseZ = () => this.mouseZ;
        imports.env.MouseXSpeed = () => this.mouseXSpeed;
        imports.env.MouseYSpeed = () => this.mouseYSpeed;
        imports.env.MouseDown = (button) => this.mouseButtons[button + 1] ? 1 : 0;
        imports.env.MouseHit = (button) => this.mouseButtonHits[button + 1] ? 1 : 0;
        imports.env.MoveMouse = (x, y) => { /* Hardware cursor move not possible in browser */ };
        imports.env.HidePointer = () => { if (this.core.canvas) this.core.canvas.style.cursor = 'none'; };
        imports.env.ShowPointer = () => { if (this.core.canvas) this.core.canvas.style.cursor = 'default'; };

        imports.env.WaitKey = () => {
            return new Promise((resolve) => {
                const handler = (e) => {
                    this.keys[e.keyCode] = true;
                    window.removeEventListener('keydown', handler);
                    resolve(e.keyCode);
                };
                window.addEventListener('keydown', handler);
            });
        };

        imports.env.EnablePointerLock = (enable) => {
            this.wantPointerLock = enable === 1;
            if (this.wantPointerLock && !this.pointerLocked && this.core.canvas) {
                this.core.canvas.requestPointerLock();
            }
        };
    }

    setupEventListeners() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.keyCode] = true;
            this.keyHits[e.keyCode] = true;
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.keyCode] = false;
        });

        window.addEventListener('mousemove', (e) => {
            if (this.core.canvas) {
                const rect = this.core.canvas.getBoundingClientRect();
                this.mouseX = e.clientX - rect.left;
                this.mouseY = e.clientY - rect.top;
                this.mouseXSpeed += e.movementX;
                this.mouseYSpeed += e.movementY;
            }
        });

        window.addEventListener('mousedown', (e) => {
            this.mouseButtons[e.button + 1] = true;
            this.mouseButtonHits[e.button + 1] = true;

            if (this.wantPointerLock && !this.pointerLocked && this.core.canvas) {
                this.core.canvas.requestPointerLock();
            }
        });

        window.addEventListener('mouseup', (e) => {
            this.mouseButtons[e.button + 1] = false;
        });

        window.addEventListener('wheel', (e) => {
            this.mouseZ += e.deltaY;
        });

        document.addEventListener('pointerlockchange', () => {
            this.pointerLocked = (document.pointerLockElement === this.core.canvas);
        });
    }

    update() {
        this.keyHits = {};
        this.mouseButtonHits = {};
        this.mouseXSpeed = 0;
        this.mouseYSpeed = 0;
    }
}

window.Blitz3DInput = Blitz3DInput;
module.exports = Blitz3DInput;
},{}],5:[function(require,module,exports){
/**
 * Blitz3D Runtime Mesh Module
 * Handles procedural mesh generation and manipulation using Three.js BufferGeometry
 */

class Blitz3DSurface {
    constructor(mesh) {
        this.mesh = mesh;
        this.vertices = []; // [x, y, z, u, v, w, r, g, b, a]
        this.indices = [];
        this.dirty = true;

        // Geometry buffers
        this.geometry = new THREE.BufferGeometry();
        this.mesh.add(new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        })));
    }

    addVertex(x, y, z, u, v, w) {
        // Negate Z for Left-Handed -> Right-Handed conversion
        this.vertices.push(
            x, y, -z,
            u || 0, v || 0,
            255, 255, 255, 255 // Default color white
        );
        this.dirty = true;
        return (this.vertices.length / 9) - 1;
    }

    addTriangle(v0, v1, v2) {
        // Reverse winding order for Left-Handed -> Right-Handed
        this.indices.push(v0, v2, v1);
        this.dirty = true;
        return (this.indices.length / 3) - 1;
    }

    vertexColor(v, r, g, b, a) {
        const index = v * 9 + 5;
        if (index < this.vertices.length) {
            this.vertices[index] = r;
            this.vertices[index + 1] = g;
            this.vertices[index + 2] = b;
            this.vertices[index + 3] = a || 255;
            this.dirty = true;
        }
    }

    update() {
        if (!this.dirty) return;

        const vertexCount = this.vertices.length / 9;
        
        // Check if we have enough vertices
        if (vertexCount === 0) {
            console.log("Blitz3DSurface.update: No vertices to update");
            return;
        }

        const positions = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const colors = new Float32Array(vertexCount * 4); // r,g,b,a 0-1 range

        for (let i = 0; i < vertexCount; i++) {
            const src = i * 9;
            const dst = i * 3;
            const dstUV = i * 2;
            const dstCol = i * 4;

            positions[dst] = this.vertices[src];
            positions[dst + 1] = this.vertices[src + 1];
            positions[dst + 2] = this.vertices[src + 2];

            uvs[dstUV] = this.vertices[src + 3];
            uvs[dstUV + 1] = this.vertices[src + 4];

            colors[dstCol] = this.vertices[src + 5] / 255.0;
            colors[dstCol + 1] = this.vertices[src + 6] / 255.0;
            colors[dstCol + 2] = this.vertices[src + 7] / 255.0;
            colors[dstCol + 3] = (this.vertices[src + 8] || 255) / 255.0;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));

        if (this.indices.length > 0) {
            this.geometry.setIndex(this.indices);
        }

        this.geometry.computeVertexNormals();

        // Mark for upload
        if (this.geometry.attributes.position) {
            this.geometry.attributes.position.needsUpdate = true;
        }
        if (this.geometry.attributes.uv) {
            this.geometry.attributes.uv.needsUpdate = true;
        }
        if (this.geometry.attributes.color) {
            this.geometry.attributes.color.needsUpdate = true;
        }

        this.dirty = false;
        console.log("Blitz3DSurface.update: Updated " + vertexCount + " vertices, " + (this.indices.length / 3) + " triangles");
    }
}

module.exports = { Blitz3DSurface };

},{}],6:[function(require,module,exports){
/**
 * Blitz3D Runtime Physics Module
 * Collision detection and physics management
 */

class Blitz3DPhysics {
    constructor(core, graphics) {
        this.core = core;
        this.graphics = graphics;
        this.collisionRules = [];
        this.collisionResults = {};
        this.picks = [];
        this.collided = false;
        this.lastPick = null;
    }

    setupImports(imports) {
        imports.env.Collisions = (srcType, destType, method, response) => {
            this.collisionRules.push({
                typeA: srcType,
                typeB: destType,
                method: method,
                response: response
            });
            console.log(`Collision: ${srcType} <-> ${destType} method=${method}`);
        };

        imports.env.ClearCollisions = () => {
            this.collisionRules = [];
            this.collisionResults = {};
        };

        imports.env.EntityType = (ent, type, recurse) => {
            const entity = this.graphics.entities[ent];
            if (entity) {
                entity.userData.collisionType = type;
                // recursive not fully implemented yet
            }
        };

        imports.env.EntityRadius = (ent, r1, r2) => {
            const entity = this.graphics.entities[ent];
            if (entity) {
                entity.userData.radius = r1;
                // r2 corresponds to height/y-radius usually for capsules
            }
        };

        imports.env.EntityPick = (entity, range) => {
            const obj = this.graphics.entities[entity];
            if (obj && this.graphics.camera) {
                const raycaster = new THREE.Raycaster();
                const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(obj.quaternion);
                raycaster.set(obj.position, dir);
                raycaster.far = range;

                const intersects = raycaster.intersectObjects(this.graphics.scene.children, true);
                if (intersects.length > 0) {
                    this.lastPick = intersects[0];
                    return 1;
                }
            }
            return 0;
        };

        imports.env.LinePick = (x, y, z, dx, dy, dz, radius) => {
            if (this.graphics.scene) {
                const origin = new THREE.Vector3(x, y, -z);
                const dir = new THREE.Vector3(dx, dy, -dz).normalize();
                const raycaster = new THREE.Raycaster(origin, dir);
                raycaster.far = new THREE.Vector3(dx, dy, -dz).length();

                const intersects = raycaster.intersectObjects(this.graphics.scene.children, true);
                if (intersects.length > 0) {
                    this.lastPick = intersects[0];
                    return intersects[0].object.id || 1;
                }
            }
            return 0;
        };

        imports.env.GetMatPickX = () => this.lastPick?.point?.x || 0;
        imports.env.GetMatPickY = () => -(this.lastPick?.point?.y || 0);
        imports.env.GetMatPickZ = () => this.lastPick?.point?.z || 0;

        imports.env.CountCollisions = (ent) => {
            const entity = this.graphics.entities[ent];
            if (!entity || !this.collisionResults) return 0;
            return (this.collisionResults[ent]?.length) || 0;
        };

        imports.env.CollisionX = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx].point?.x || 0;
            }
            return 0;
        };

        imports.env.CollisionY = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return -(collisions[idx].point?.y || 0);
            }
            return 0;
        };

        imports.env.CollisionZ = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx].point?.z || 0;
            }
            return 0;
        };

        imports.env.CollisionEntity = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                const collision = collisions[idx];
                if (collision?.object) {
                    for (let id in this.graphics.entities) {
                        if (this.graphics.entities[id] === collision.object) {
                            return parseInt(id);
                        }
                    }
                }
            }
            return 0;
        };

        imports.env.CollisionNX = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx]?.face?.normal?.x || 0;
            }
            return 0;
        };

        imports.env.CollisionNY = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return -(collisions[idx]?.face?.normal?.y || 0);
            }
            return 0;
        };

        imports.env.CollisionNZ = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx]?.face?.normal?.z || 0;
            }
            return 0;
        };

        imports.env.CollisionSurface = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return 1;
            }
            return 0;
        };

        imports.env.CollisionTriangle = (ent, idx) => {
            const collisions = this.collisionResults[ent];
            if (collisions && idx >= 0 && idx < collisions.length) {
                return collisions[idx]?.faceIndex || 0;
            }
            return 0;
        };
    }

    updateCollisions() {
        // Perform collision detection based on rules
        this.collisionResults = {};

        for (const rule of this.collisionRules) {
            // Simplified collision detection
            // In a full implementation, this would check entity positions and types
        }
    }
}

window.Blitz3DPhysics = Blitz3DPhysics;
module.exports = Blitz3DPhysics;
},{}],7:[function(require,module,exports){
/**
 * Blitz3D WASM Runtime - Modular Version
 * Provides WebGL, Web Audio, and other browser APIs to the WASM module
 */

// Import modules if available, otherwise use global
// Import modules if available, otherwise use global
const Blitz3DCore = window.Blitz3DCore || require('./core');
const Blitz3DGraphics = window.Blitz3DGraphics || require('./graphics');
const Blitz3DPhysics = window.Blitz3DPhysics || require('./physics');
const Blitz3DInput = window.Blitz3DInput || require('./input');

const Blitz3D = {
    // Core components
    core: null,
    graphics: null,
    physics: null,
    input: null,

    // Asset management
    assets: {},
    assetManifest: null,

    // Bank Manager
    bankManager: {
        banks: new Map(),
        nextHandle: 1
    },

    // Zip Manager
    zipManager: {
        archives: new Map(),
        mountedFiles: new Map(),
        nextHandle: 1,

        loadZip: async function (url) {
            try {
                const filename = url.replace(/\\/g, '/').split('/').pop();
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                const zip = await JSZip.loadAsync(arrayBuffer);
                const fileMap = new Map();
                const promises = [];
                zip.forEach((relativePath, file) => {
                    if (!file.dir) {
                        promises.push(file.async("uint8array").then(data => {
                            fileMap.set(relativePath, data);
                        }));
                    }
                });
                await Promise.all(promises);
                this.archives.set(filename, fileMap);
                console.log(`Mounted ZIP archive: ${filename} (${fileMap.size} files)`);
                return filename;
            } catch (err) {
                console.error(`Failed to load ZIP ${url}:`, err);
                return null;
            }
        }
    },

    // FMOD Manager
    fmodManager: {
        streams: new Map(),
        channels: new Map(),
        nextHandle: 1,
        context: null
    },

    // File System
    fs: {},
    files: {},
    nextFileId: 1,

    init: function (canvasId) {
        // Initialize core
        this.core = new Blitz3DCore();
        this.core.init(canvasId);

        // Initialize graphics
        this.graphics = new Blitz3DGraphics(this.core);
        this.graphics.init3D();

        // Initialize physics
        this.physics = new Blitz3DPhysics(this.core, this.graphics);

        // Initialize input
        this.input = new Blitz3DInput(this.core, this.graphics);
        this.input.setupEventListeners();

        // Set up common imports
        this.core.setupCommonImports(this.imports);
        this.graphics.setupImports(this.imports);
        this.physics.setupImports(this.imports);
        this.input.setupImports(this.imports);

        console.log("Blitz3D Runtime Initialized (Modular)");
    },

    getAssetData: function (path) {
        const asset = this.assets[path];
        if (asset && asset.data) {
            return asset.data;
        }
        if (this.assetManifest && this.assetManifest.embedAssets) {
            const assetInfo = this.assetManifest.assets.find(a => a.path === path);
            if (assetInfo && assetInfo.offset) {
                const data = new Uint8Array(this.core.memory.buffer);
                return data.slice(assetInfo.offset, assetInfo.offset + assetInfo.size);
            }
        }
        return null;
    },

    setupInput: function () {
        // Input is already set up in init()
    },

    // Import object for WASM
    imports: {
        env: {}
    },

    load: async function (wasmUrl, canvasId) {
        if (canvasId) {
            this.init(canvasId);
        } else if (!this.core.canvas) {
            console.error("Blitz3D canvas not initialized.");
            return;
        }

        this.setupInput();
        console.log(`Loading WASM from ${wasmUrl}...`);
        const startTime = performance.now();

        try {
            let result;

            // Try WASM cache if available
            if (window.WASMCache && typeof window.WASMCache === 'function') {
                console.log("Attempting WASM cache load...");
                try {
                    const wasmCache = new window.WASMCache();
                    await wasmCache.init();
                    result = await wasmCache.loadWithCache(wasmUrl, this.imports);
                    this.core.instance = result.instance;
                    this.core.module = result.module;
                    this.core.exports = result.instance.exports;
                    this.core.memory = result.instance.exports.memory;

                    const endTime = performance.now();
                    console.log(`WASM Loaded from Cache in ${(endTime - startTime).toFixed(2)}ms`);
                    console.log("WASM Imports:", Object.keys(this.imports.env));

                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('Blitz3DLoaded', {
                            detail: { instance: this.core.instance, module: this.core.module, loadTime: endTime - startTime, fromCache: true }
                        }));
                    }

                    if (this.core.instance.exports.main) {
                        this.core.instance.exports.main();
                    } else if (this.core.instance.exports.Main) {
                        this.core.instance.exports.Main();
                    }

                    return result;
                } catch (cacheError) {
                    console.warn("Cache load failed, using standard loading:", cacheError.message);
                }
            }

            // Standard loading
            const response = await fetch(wasmUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const contentLength = response.headers.get('content-length');
            const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
            if (totalBytes) {
                console.log(`WASM size: ${(totalBytes / 1024).toFixed(2)} KB`);
            }

            console.log("DEBUG: Checking imports.env.CreateCamera:", this.imports.env.CreateCamera);
            if (this.imports.env.CreateCamera) {
                console.log("DEBUG: CreateCamera source:", this.imports.env.CreateCamera.toString());
            } else {
                console.error("DEBUG: CreateCamera is MISSING from imports!");
            }

            if (WebAssembly.instantiateStreaming) {
                console.log("Using WebAssembly.instantiateStreaming.");
                try {
                    result = await WebAssembly.instantiateStreaming(response, this.imports);
                } catch (e) {
                    console.warn("instantiateStreaming failed, falling back...");
                    const fallbackResponse = await fetch(wasmUrl);
                    const buffer = await fallbackResponse.arrayBuffer();
                    console.log(`WASM size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
                    result = await WebAssembly.instantiate(buffer, this.imports);
                }
            } else {
                const buffer = await response.arrayBuffer();
                console.log(`WASM size: ${(buffer.byteLength / 1024).toFixed(2)} KB`);
                result = await WebAssembly.instantiate(buffer, this.imports);
            }

            const { instance, module } = result;
            this.core.instance = instance;
            this.core.module = module;
            this.core.exports = instance.exports;
            this.core.memory = instance.exports.memory;

            const alloc = instance.exports.__Alloc;
            if (alloc) {
                this.core.allocString = function (str) {
                    const len = str.length;
                    const ptr = alloc(len + 1);
                    const mem = new Uint8Array(this.core.memory.buffer);
                    for (let i = 0; i < len; i++) {
                        mem[ptr + i] = str.charCodeAt(i);
                    }
                    mem[ptr + len] = 0;
                    return ptr;
                }.bind(this);
            }

            const endTime = performance.now();
            console.log(`WASM Loaded and Compiled in ${(endTime - startTime).toFixed(2)}ms`);
            console.log("WASM Imports:", Object.keys(this.imports.env));

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('Blitz3DLoaded', {
                    detail: { instance, module, loadTime: endTime - startTime, fromCache: false }
                }));
            }

            if (instance.exports.main) {
                instance.exports.main();
            } else if (instance.exports.Main) {
                instance.exports.Main();
            }

            return result;
        } catch (e) {
            console.error("Failed to load WASM:", e);
            throw e;
        }
    },

    preload: async function (fileList) {
        const zips = fileList.filter(f => f.toLowerCase().endsWith('.zip'));
        const files = fileList.filter(f => !f.toLowerCase().endsWith('.zip'));

        if (zips.length > 0) {
            for (const url of zips) {
                await this.zipManager.loadZip(url);
            }
        }

        for (const file of files) {
            try {
                const response = await fetch(file);
                if (response.ok) {
                    const buffer = await response.arrayBuffer();
                    this.fs[file] = buffer;
                    console.log("Preloaded: " + file);
                }
            } catch (e) {
                console.warn("Error preloading: " + file, e);
            }
        }
    }
};

// Convenience getters for compatibility
Object.defineProperty(Blitz3D, 'memory', {
    get: function () { return this.core?.memory; }
});

Object.defineProperty(Blitz3D, 'instance', {
    get: function () { return this.core?.instance; }
});

Object.defineProperty(Blitz3D, 'exports', {
    get: function () { return this.core?.exports; }
});

Object.defineProperty(Blitz3D, 'canvas', {
    get: function () { return this.core?.canvas; }
});

window.Blitz3D = Blitz3D;

// Version for cache busting
console.log("Blitz3D Runtime v1.0.5 loaded");

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Blitz3D;
}
},{"./core":2,"./graphics":3,"./input":4,"./physics":6}],8:[function(require,module,exports){
/**
 * Blitz3D Runtime - Backwards Compatible Entry Point
 * This file provides the same API as the original runtime.js
 * while using the modular implementation internally
 */

// The modular implementation is in runtime.modular.js
// This file provides backwards compatibility

// Expose modules globally for testing and debugging
window.Blitz3DCore = require('./modules/core');
window.Blitz3DGraphics = require('./modules/graphics');
window.Blitz3DPhysics = require('./modules/physics');
window.Blitz3DInput = require('./modules/input');

// The main runtime is loaded from the modular version
// but we need to make sure it's available
const Blitz3D = require('./modules/runtime');

// Re-export for compatibility
window.Blitz3D = Blitz3D;

console.log("Blitz3D Runtime (Modular) loaded successfully");
console.log("Available modules: core, graphics, physics, input");

// Debug helper
window.debugBlitz3D = function() {
    return {
        core: Blitz3D.core ? 'initialized' : 'not initialized',
        graphics: Blitz3D.graphics ? 'initialized' : 'not initialized',
        physics: Blitz3D.physics ? 'initialized' : 'not initialized',
        input: Blitz3D.input ? 'initialized' : 'not initialized',
        instance: Blitz3D.core?.instance ? 'loaded' : 'not loaded',
        memory: Blitz3D.core?.memory ? 'available' : 'not available'
    };
};
},{"./modules/core":2,"./modules/graphics":3,"./modules/input":4,"./modules/physics":6,"./modules/runtime":7}]},{},[8]);
