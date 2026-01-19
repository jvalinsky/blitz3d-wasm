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