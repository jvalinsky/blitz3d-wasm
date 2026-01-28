/**
 * Blitz3D Runtime Graphics Module
 * WebGL/Three.js integration for 3D rendering
 */
import * as THREE from 'three';
import { Blitz3DSurface, Blitz3DMesh } from './mesh';
import { Blitz3DAnimation } from './animation';
import { XLoader } from './xloader';

export class Blitz3DGraphics {
    [key: string]: any;

    constructor(core: any) {
        this.core = core;
        this.Blitz3DSurface = Blitz3DSurface;
        this.Blitz3DAnimation = Blitz3DAnimation;
        this.XLoader = XLoader;

        this.animationSystem = new this.Blitz3DAnimation(this, core);
        this.meshSystem = Blitz3DMesh(this);
        this.xLoader = null; // Initialized lazily when first needed
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
        this.textures = {};
        this.nextTextureId = 1;
        this.brushes = {};
        this.nextBrushId = 1;
        this.lastPick = { entity: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, surface: 0, triangle: 0 };
        this.aaFonts = {};
        this.currentAAFont = null;
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
        if (!THREE) {
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
                antialias: false,
                alpha: false,
                powerPreference: 'high-performance'
            });
            console.log("WebGLRenderer created successfully");

            // Ensure renderer canvas is attached to DOM
            if (this.renderer.domElement && this.core.canvas && this.renderer.domElement !== this.core.canvas) {
                const oldCanvas = this.core.canvas;
                if (oldCanvas.parentElement) {
                    oldCanvas.parentElement.replaceChild(this.renderer.domElement, oldCanvas);
                }
                this.core.canvas = this.renderer.domElement;
            }

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

            const gl = this.renderer.getContext?.();
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

        // Expose THREE for debugging
        (window as any).THREE = THREE;

        console.log("Animation system initialized");

        this.animate(0);
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
        if (this.meshSystem && this.meshSystem.setupImports) {
            this.meshSystem.setupImports(imports);
        }

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

        // Helpers for buffer-backed pixel operations (ImageBuffer/TextureBuffer/etc).
        const getBufferContext = (bufferId) => {
            // BackBuffer/front buffer use the shared text canvas
            if (!bufferId || bufferId === -1) {
                return this.core.ctx2d || null;
            }

            const img = this.images[bufferId];
            if (!img) return null;

            // Lazily create an offscreen canvas for writable images
            if (!img.canvas) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width || img.element?.width || 1;
                canvas.height = img.height || img.element?.height || 1;
                const ctx = canvas.getContext('2d');
                if (img.element && img.loaded) {
                    ctx.drawImage(img.element, 0, 0);
                }
                img.canvas = canvas;
                img.canvasCtx = ctx;
            }
            return img.canvasCtx || null;
        };

        const computeBounds = (entity) => {
            if (!entity) return null;
            try {
                const box = new THREE.Box3().setFromObject(entity);
                if (typeof box.isEmpty === 'function' && box.isEmpty()) {
                    return null;
                }
                return box;
            } catch (e) {
                return null;
            }
        };

        imports.env.GetColor = (x, y) => { return 0; };
        imports.env.ColorRed = () => this.currentColor[0] || 0;
        imports.env.ColorGreen = () => this.currentColor[1] || 0;
        imports.env.ColorBlue = () => this.currentColor[2] || 0;

        // Bitwise helpers that sometimes get imported as functions
        imports.env.And = (a, b) => (a | 0) & (b | 0);
        imports.env.Or = (a, b) => (a | 0) | (b | 0);

        // Graphics Metrics
        imports.env.GraphicsWidth = () => this.core.canvas ? this.core.canvas.width : 800;
        imports.env.GraphicsHeight = () => this.core.canvas ? this.core.canvas.height : 600;
        imports.env.WindowWidth = () => window.innerWidth;
        imports.env.WindowHeight = () => window.innerHeight;
        imports.env.VWait = (n) => { }; // No-op

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
                this.core.ctx2d.font = `${this.currentFontSize}px ${this.currentFont}`;
                this.core.ctx2d.textBaseline = 'top';

                // Handle centering
                let finalX = x;
                let finalY = y;

                if (cx) {
                    const metrics = this.core.ctx2d.measureText(txt);
                    finalX -= metrics.width / 2;
                }

                if (cy) {
                    finalY -= this.currentFontSize / 2;
                }

                this.core.ctx2d.fillText(txt, finalX, finalY);
            }
        };

        // Text metrics helpers for UI positioning
        const measureText = (txt) => {
            if (!this.core.ctx2d) return { width: 0, height: this.currentFontSize };
            this.core.ctx2d.font = `${this.currentFontSize}px ${this.currentFont}`;
            const metrics = this.core.ctx2d.measureText(txt);
            const height = (metrics.actualBoundingBoxAscent || this.currentFontSize * 0.8) +
                (metrics.actualBoundingBoxDescent || this.currentFontSize * 0.2);
            return { width: metrics.width || 0, height };
        };

        imports.env.StringWidth = (txtPtr) => {
            const txt = this.core.readString(txtPtr);
            return Math.floor(measureText(txt).width);
        };

        imports.env.StringHeight = (txtPtr) => {
            const txt = this.core.readString(txtPtr);
            return Math.floor(measureText(txt).height);
        };

        imports.env.FontWidth = () => Math.floor(this.currentFontSize * 0.6);
        imports.env.FontHeight = () => Math.floor(this.currentFontSize);

        // Font Functions
        imports.env.LoadFont = (namePtr, size, bold, italic, underline) => {
            const fontName = this.core.readString(namePtr);
            const id = this.nextImageId++;  // Reuse image ID counter for fonts
            this.images[id] = {
                type: 'font',
                name: fontName,
                size: size || 12,
                bold: bold || 0,
                italic: italic || 0,
                underline: underline || 0
            };
            return id;
        };

        imports.env.SetFont = (fontId) => {
            const font = this.images[fontId];
            if (font && font.type === 'font') {
                let fontStyle = '';
                if (font.italic) fontStyle += 'italic ';
                if (font.bold) fontStyle += 'bold ';

                this.currentFont = font.name;
                this.currentFontSize = font.size;

                if (this.core.ctx2d) {
                    this.core.ctx2d.font = `${fontStyle}${font.size}px ${font.name}`;
                }
            }
        };

        imports.env.FreeFont = (fontId) => {
            if (this.images[fontId]) {
                delete this.images[fontId];
            }
        };

        // AAText compatibility (minimal rendering shim)
        imports.env.InitAAFont = (fontId) => {
            this.currentAAFont = fontId;
            this.aaFonts[fontId] = { id: fontId };
            return fontId;
        };

        imports.env.AAFont = (fontId) => {
            this.currentAAFont = fontId;
            return fontId;
        };

        imports.env.AASetFont = (fontId) => {
            this.currentAAFont = fontId;
            imports.env.SetFont(fontId);
        };

        imports.env.ReloadAAFont = (fontId) => {
            // No-op placeholder – real implementation would reload atlas textures.
            return fontId;
        };

        imports.env.AAText = (x, y, txtPtr, centerX, centerY) => {
            // Delegate to Text to keep behavior consistent
            imports.env.Text(x, y, txtPtr, centerX, centerY);
        };

        imports.env.AAStringWidth = (txtPtr) => imports.env.StringWidth(txtPtr);
        imports.env.AAStringHeight = (txtPtr) => imports.env.StringHeight(txtPtr);
        imports.env.AASpritePosition = (spriteId, x, y) => {
            const sprite = this.entities[spriteId];
            if (sprite) sprite.position.set(x, y, sprite.position.z);
        };
        imports.env.AASpriteScale = (spriteId, sx, sy) => {
            const sprite = this.entities[spriteId];
            if (sprite) sprite.scale.set(sx, sy, sprite.scale.z || 1);
        };

        // Image Functions
        imports.env.LoadImage = (pathPtr) => {
            const path = this.core.readString(pathPtr);
            const img = new Image();
            const id = this.nextImageId++;

            this.images[id] = {
                type: 'image',
                element: img,
                width: 0,
                height: 0,
                loaded: false,
                handleX: 0,
                handleY: 0
            };

            img.onload = () => {
                this.images[id].width = img.width;
                this.images[id].height = img.height;
                this.images[id].loaded = true;
            };

            img.src = path;
            return id;
        };

        imports.env.LoadImage_Strict = (pathPtr) => {
            return imports.env.LoadImage(pathPtr);
        };

        imports.env.CreateImage = (width, height, frames) => {
            const id = this.nextImageId++;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            this.images[id] = {
                type: 'image',
                element: canvas,
                canvas,
                canvasCtx: canvas.getContext('2d'),
                width: canvas.width,
                height: canvas.height,
                loaded: true,
                handleX: 0,
                handleY: 0
            };
            return id;
        };

        imports.env.CreateTexture = (width, height, flags) => {
            const data = new Uint8Array((width || 1) * (height || 1) * 4).fill(255);
            const tex = new THREE.DataTexture(data, width || 1, height || 1);
            tex.needsUpdate = true;
            tex.image = { width: width || 1, height: height || 1, data: data as any };
            tex.name = `runtime_texture_${this.nextTextureId}`;
            const id = this.nextTextureId++;
            this.textures[id] = tex;
            return id;
        };

        const drawImageTransformed = (ctx, img, x, y, drawFn) => {
            const rot = img.rotation || 0;
            const sx = img.scaleX || 1;
            const sy = img.scaleY || 1;

            if (rot !== 0 || sx !== 1 || sy !== 1) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(rot * Math.PI / 180);
                ctx.scale(sx, sy);
                ctx.translate(-img.handleX, -img.handleY);
                // Draw at 0,0 because we translated to x,y then offset by handle
                drawFn(0, 0);
                ctx.restore();
            } else {
                drawFn(x - img.handleX, y - img.handleY);
            }
        };

        imports.env.DrawImage = (imgId, x, y, frame) => {
            const img = this.images[imgId];
            if (img && img.type === 'image' && img.loaded && this.core.ctx2d) {
                drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
                    this.core.ctx2d.drawImage(img.element, dx, dy);
                });
            }
        };

        imports.env.DrawBlock = (imgId, x, y, frame) => {
            const img = this.images[imgId];
            if (img && img.type === 'image' && img.loaded && this.core.ctx2d) {
                const oldOp = this.core.ctx2d.globalCompositeOperation;
                this.core.ctx2d.globalCompositeOperation = 'source-over';
                drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
                    this.core.ctx2d.drawImage(img.element, dx, dy);
                });
                this.core.ctx2d.globalCompositeOperation = oldOp;
            }
        };

        imports.env.DrawImageRect = (imgId, x, y, rx, ry, rw, rh, frame) => {
            const img = this.images[imgId];
            if (img && img.type === 'image' && img.loaded && this.core.ctx2d) {
                drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
                    this.core.ctx2d.drawImage(img.element, rx, ry, rw, rh, dx, dy, rw, rh);
                });
            }
        };

        imports.env.TileImage = (imgId, x, y, frame) => {
            const img = this.images[imgId];
            if (img && img.type === 'image' && img.loaded && this.core.ctx2d) {
                // TileImage usually ignores rotation/scale in basic implementations,
                // but checking if we need to support it. 
                // For now, standard implementation.
                const pattern = this.core.ctx2d.createPattern(img.element, 'repeat');
                if (pattern) {
                    this.core.ctx2d.fillStyle = pattern;
                    this.core.ctx2d.translate(x, y); // Offset pattern
                    this.core.ctx2d.fillRect(-x, -y, this.core.canvas.width, this.core.canvas.height);
                    this.core.ctx2d.translate(-x, -y);
                }
            }
        };

        imports.env.ImageWidth = (imgId) => {
            const img = this.images[imgId];
            return (img && img.type === 'image') ? img.width : 0;
        };

        imports.env.ImageHeight = (imgId) => {
            const img = this.images[imgId];
            return (img && img.type === 'image') ? img.height : 0;
        };

        imports.env.HandleImage = (imgId, x, y) => {
            const img = this.images[imgId];
            if (img && img.type === 'image') {
                img.handleX = x;
                img.handleY = y;
            }
        };

        imports.env.MidHandle = (imgId) => {
            const img = this.images[imgId];
            if (img && img.type === 'image') {
                img.handleX = img.width / 2;
                img.handleY = img.height / 2;
            }
        };

        imports.env.AutoMidHandle = (enabled) => {
            // No-op
        };

        imports.env.RotateImage = (imgId, angle) => {
            const img = this.images[imgId];
            if (img && img.type === 'image') {
                img.rotation = angle;
            }
        };

        imports.env.ScaleImage = (imgId, xs, ys) => {
            const img = this.images[imgId];
            if (img && img.type === 'image') {
                img.scaleX = xs;
                img.scaleY = ys;
            }
        };

        imports.env.ResizeImage = (imgId, w, h) => {
            const img = this.images[imgId];
            if (img && img.type === 'image') {
                // Resize logic ideally needs to resample. 
                // For now, hack using scale if not strictly required to be destructive
                img.scaleX = w / (img.element.width || 1);
                img.scaleY = h / (img.element.height || 1);
                // Note: ImageWidth() will still return original width unless we update it
                // To be robust, we'd need to create a new canvas.
                // Leaving as soft-resize (scale) for now.
            }
        };

        imports.env.MaskImage = (imgId, r, g, b) => {
            // Color masking - complex, stub for now
        };

        imports.env.ScaleImage = (imgId, scaleX, scaleY) => {
            const img = this.images[imgId];
            if (img && img.type === 'image') {
                img.scaleX = scaleX;
                img.scaleY = scaleY;
            }
        };

        imports.env.ResizeImage = (imgId, width, height) => {
            const img = this.images[imgId];
            if (img && img.type === 'image') {
                img.width = width;
                img.height = height;
            }
        };

        imports.env.FreeImage = (imgId) => {
            if (this.images[imgId]) {
                delete this.images[imgId];
            }
        };

        imports.env.Handle = (imgId) => {
            const img = this.images[imgId];
            if (img) {
                // Blitz3D exposes handleX/handleY; here we pack X in low 16 bits, Y in high 16 bits.
                return ((img.handleY & 0xffff) << 16) | (img.handleX & 0xffff);
            }
            return 0;
        };

        // Buffer accessors (used by SetBuffer/CopyRect/etc.)
        imports.env.BackBuffer = () => -1;

        // --- Input System ---

        this.keysDown = {};
        this.keysHit = {};
        this.mouseDown = {};
        this.mouseHit = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseZ = 0;
        this.mouseXSpeed = 0;
        this.mouseYSpeed = 0;
        this.mouseZSpeed = 0;

        // Setup input listeners
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', (e) => {
                const code = e.keyCode; // Blitz3D uses legacy keycodes mostly
                this.keysDown[code] = true;
                this.keysHit[code] = (this.keysHit[code] || 0) + 1;
            });
            window.addEventListener('keyup', (e) => {
                this.keysDown[e.keyCode] = false;
            });
            window.addEventListener('mousemove', (e) => {
                this.mouseXSpeed = e.movementX;
                this.mouseYSpeed = e.movementY;
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
                // Adjust for canvas offset if needed
            });
            window.addEventListener('mousedown', (e) => {
                this.mouseDown[e.button + 1] = true; // Blitz: 1=Left, 2=Right, 3=Middle
                this.mouseHit[e.button + 1] = (this.mouseHit[e.button + 1] || 0) + 1;
            });
            window.addEventListener('mouseup', (e) => {
                this.mouseDown[e.button + 1] = false;
            });
        }

        // Keyboard
        imports.env.KeyDown = (key) => this.keysDown[key] ? 1 : 0;
        imports.env.KeyHit = (key) => {
            const hits = this.keysHit[key] || 0;
            this.keysHit[key] = 0; // Clear hits after reading
            return hits;
        };
        imports.env.FlushKeys = () => {
            this.keysDown = {};
            this.keysHit = {};
        };
        imports.env.WaitKey = () => 0; // Stub: async wait not easy in loop

        // Mouse
        imports.env.MouseDown = (btn) => this.mouseDown[btn] ? 1 : 0;
        imports.env.MouseHit = (btn) => {
            const hits = this.mouseHit[btn] || 0;
            this.mouseHit[btn] = 0;
            return hits;
        };
        imports.env.MouseX = () => this.mouseX;
        imports.env.MouseY = () => this.mouseY;
        imports.env.MouseZ = () => this.mouseZ;
        imports.env.MouseXSpeed = () => this.mouseXSpeed;
        imports.env.MouseYSpeed = () => this.mouseYSpeed;
        imports.env.MouseZSpeed = () => this.mouseZSpeed;
        imports.env.FlushMouse = () => {
            this.mouseDown = {};
            this.mouseHit = {};
        };
        imports.env.MoveMouse = (x, y) => {
            // Cannot programmatically move system mouse in browser
            this.mouseX = x;
            this.mouseY = y;
        };

        imports.env.HidePointer = () => {
            if (this.core.canvas) this.core.canvas.style.cursor = 'none';
        };

        imports.env.ShowPointer = () => {
            if (this.core.canvas) this.core.canvas.style.cursor = 'default';
        };

        // Joystick (Stubs)
        imports.env.JoyDown = (btn) => 0;
        imports.env.JoyHit = (btn) => 0;
        imports.env.JoyX = () => 0;
        imports.env.JoyY = () => 0;
        imports.env.JoyZ = () => 0;
        imports.env.JoyType = () => 0; // 0 = None

        imports.env.FrontBuffer = () => -1;
        imports.env.GraphicsBuffer = () => -1;
        imports.env.ScanLine = () => 0;
        imports.env.AvailVidMem = () => 1024 * 1024 * 512; // Mock 512MB
        imports.env.TotalVidMem = () => 1024 * 1024 * 512;
        imports.env.ImageBuffer = (imgId, frame) => imgId || -1;
        imports.env.TextureBuffer = (texId) => texId || -1;
        imports.env.SetBuffer = (bufferId) => {
            this.currentBuffer = bufferId;
            if (this.core.ctx2d) {
                // Future: switch active context if bufferId is an image
            }
        };


        imports.env.LockBuffer = (bufferId) => {
            // Return a dummy pointer/handle for the locked buffer
            // In a real implementation, this might CopyImageData to a WASM memory bank
            return 1;
        };

        imports.env.UnlockBuffer = (bufferId) => {
            // Commit changes if we were using a shadow buffer
        };

        imports.env.WritePixelFast = (x, y, color, bufferId) => {
            const ctx = getBufferContext(bufferId);
            if (!ctx) return;
            const r = (color >> 16) & 0xFF;
            const g = (color >> 8) & 0xFF;
            const b = color & 0xFF;
            const a = (color >>> 24) & 0xFF || 0xFF;
            const imgData = ctx.createImageData(1, 1);
            imgData.data[0] = r;
            imgData.data[1] = g;
            imgData.data[2] = b;
            imgData.data[3] = a;
            ctx.putImageData(imgData, x, y);
        };

        imports.env.ReadPixelFast = (x, y, bufferId) => {
            const ctx = getBufferContext(bufferId);
            if (!ctx) return 0;
            const data = ctx.getImageData(x, y, 1, 1).data;
            return ((data[3] || 0) << 24) | (data[0] << 16) | (data[1] << 8) | data[2];
        };

        imports.env.ReadPixel = imports.env.ReadPixelFast;
        imports.env.WritePixel = imports.env.WritePixelFast;

        imports.env.CopyPixel = (srcX, srcY, destX, destY, srcBuffer, destBuffer) => {
            const srcCtx = getBufferContext(srcBuffer);
            const destCtx = getBufferContext(destBuffer);
            if (srcCtx && destCtx) {
                const pixel = srcCtx.getImageData(srcX, srcY, 1, 1);
                destCtx.putImageData(pixel, destX, destY);
            }
        };
        imports.env.CopyPixelFast = imports.env.CopyPixel;

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
                console.warn("CreateCamera: scene not initialized, calling init3D");
                this.init3D();
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
            // mesh.isMesh = true; // Read-only

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

        // Entity Property Getters
        imports.env.EntityX = (ent, global) => {
            const entity = this.entities[ent];
            if (!entity) return 0.0;
            if (global) {
                const worldPos = new THREE.Vector3();
                entity.getWorldPosition(worldPos);
                return worldPos.x;
            }
            return entity.position.x;
        };

        imports.env.EntityY = (ent, global) => {
            const entity = this.entities[ent];
            if (!entity) return 0.0;
            if (global) {
                const worldPos = new THREE.Vector3();
                entity.getWorldPosition(worldPos);
                return worldPos.y;
            }
            return entity.position.y;
        };

        imports.env.EntityZ = (ent, global) => {
            const entity = this.entities[ent];
            if (!entity) return 0.0;
            // Convert from Three.js coordinate system back to Blitz3D (negate Z)
            if (global) {
                const worldPos = new THREE.Vector3();
                entity.getWorldPosition(worldPos);
                return -worldPos.z;
            }
            return -entity.position.z;
        };

        imports.env.EntityPitch = (ent, global) => {
            const entity = this.entities[ent];
            if (!entity) return 0.0;
            if (global) {
                const worldRot = new THREE.Euler();
                entity.getWorldQuaternion(new THREE.Quaternion()).setFromRotationMatrix(entity.matrixWorld);
                worldRot.setFromQuaternion(entity.quaternion);
                return worldRot.x * 180 / Math.PI;
            }
            return entity.rotation.x * 180 / Math.PI;
        };

        imports.env.EntityYaw = (ent, global) => {
            const entity = this.entities[ent];
            if (!entity) return 0.0;
            if (global) {
                const worldRot = new THREE.Euler();
                entity.getWorldQuaternion(new THREE.Quaternion()).setFromRotationMatrix(entity.matrixWorld);
                worldRot.setFromQuaternion(entity.quaternion);
                return worldRot.y * 180 / Math.PI;
            }
            return entity.rotation.y * 180 / Math.PI;
        };

        imports.env.EntityRoll = (ent, global) => {
            const entity = this.entities[ent];
            if (!entity) return 0.0;
            if (global) {
                const worldRot = new THREE.Euler();
                entity.getWorldQuaternion(new THREE.Quaternion()).setFromRotationMatrix(entity.matrixWorld);
                worldRot.setFromQuaternion(entity.quaternion);
                return worldRot.z * 180 / Math.PI;
            }
            return entity.rotation.z * 180 / Math.PI;
        };

        imports.env.EntityDistance = (ent1, ent2) => {
            const entity1 = this.entities[ent1];
            const entity2 = this.entities[ent2];
            if (!entity1 || !entity2) return 0.0;

            const pos1 = new THREE.Vector3();
            const pos2 = new THREE.Vector3();
            entity1.getWorldPosition(pos1);
            entity2.getWorldPosition(pos2);

            return pos1.distanceTo(pos2);
        };

        const dimensionFromBounds = (entity, axis) => {
            const bounds = computeBounds(entity);
            if (!bounds) return 1.0;
            switch (axis) {
                case 'x':
                    return Math.max(bounds.max.x - bounds.min.x, 0.0001);
                case 'y':
                    return Math.max(bounds.max.y - bounds.min.y, 0.0001);
                case 'z':
                    return Math.max(bounds.max.z - bounds.min.z, 0.0001);
                default:
                    return 1.0;
            }
        };

        imports.env.MeshWidth = (meshId) => {
            const entity = this.entities[meshId];
            return dimensionFromBounds(entity, 'x');
        };

        imports.env.MeshHeight = (meshId) => {
            const entity = this.entities[meshId];
            return dimensionFromBounds(entity, 'y');
        };

        imports.env.MeshDepth = (meshId) => {
            const entity = this.entities[meshId];
            return dimensionFromBounds(entity, 'z');
        };

        // Entity Hierarchy Queries
        imports.env.CountChildren = (ent) => {
            const entity = this.entities[ent];
            return entity ? entity.children.length : 0;
        };

        imports.env.GetChild = (ent, index) => {
            const entity = this.entities[ent];
            if (!entity || index < 0 || index >= entity.children.length) return 0;

            const child = entity.children[index];
            // Find the entity ID for this child
            for (const [id, obj] of Object.entries(this.entities)) {
                if (obj === child) return parseInt(id);
            }
            return 0;
        };

        imports.env.FindChild = (ent, name) => {
            const entity = this.entities[ent];
            if (!entity) return 0;

            // Search through children for matching name
            for (const child of entity.children) {
                if (child.name === name) {
                    // Find the entity ID for this child
                    for (const [id, obj] of Object.entries(this.entities)) {
                        if (obj === child) return parseInt(id);
                    }
                }
            }
            return 0;
        };

        imports.env.GetParent = (ent) => {
            const entity = this.entities[ent];
            if (!entity || !entity.parent || entity.parent === this.scene) return 0;

            // Find the entity ID for the parent
            for (const [id, obj] of Object.entries(this.entities)) {
                if (obj === entity.parent) return parseInt(id);
            }
            return 0;
        };

        imports.env.PickedEntity = () => {
            return this.lastPick?.entity || 0;
        };
        imports.env.PickedNX = () => {
            return this.lastPick?.nx || 0.0;
        };
        imports.env.PickedNY = () => {
            return this.lastPick?.ny || 0.0;
        };
        imports.env.PickedNZ = () => {
            return this.lastPick?.nz || 0.0;
        };

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
                        if (!Array.isArray(child.material)) {
                            child.material = child.material.clone();
                            child.material.map = texture;
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        };

        // Entity Property Functions
        imports.env.EntityAutoFade = (ent, near, far) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.userData.autoFade = { near, far };
            }
        };

        imports.env.EntityOrder = (ent, order) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.renderOrder = order;
            }
        };

        imports.env.EntityAlpha = (ent, alpha) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.traverse((child) => {
                    if (child.isMesh) {
                        if (!Array.isArray(child.material)) {
                            child.material = child.material.clone();
                            child.material.opacity = alpha;
                            child.material.transparent = alpha < 1.0;
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        };

        imports.env.EntityColor = (ent, red, green, blue) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.traverse((child) => {
                    if (child.isMesh) {
                        if (!Array.isArray(child.material)) {
                            child.material = child.material.clone();
                            child.material.color.setRGB(red / 255, green / 255, blue / 255);
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        };

        imports.env.EntityFX = (ent, fx) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.traverse((child) => {
                    if (child.isMesh) {
                        if (!Array.isArray(child.material)) {
                            child.material = child.material.clone();
                            // FX flags: 1 = fullbright, 2 = modulate, 4 = add, 8 = alpha
                            child.material.emissive = new THREE.Color(0, 0, 0);
                            if (fx & 1) { // fullbright
                                child.material.emissive.setRGB(1, 1, 1);
                            }
                            if (fx & 4) { // additive blending
                                child.material.blending = THREE.AdditiveBlending;
                            } else {
                                child.material.blending = THREE.NormalBlending;
                            }
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        };

        imports.env.EntityBlend = (ent, blend) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.traverse((child) => {
                    if (child.isMesh) {
                        if (!Array.isArray(child.material)) {
                            child.material = child.material.clone();
                            // Blend: 0 = solid, 1 = alpha, 2 = multiply, 3 = additive
                            switch (blend) {
                                case 0: // solid
                                    child.material.transparent = false;
                                    child.material.blending = THREE.NoBlending;
                                    break;
                                case 1: // alpha
                                    child.material.transparent = true;
                                    child.material.blending = THREE.NormalBlending;
                                    break;
                                case 3: // additive
                                    child.material.transparent = true;
                                    child.material.blending = THREE.AdditiveBlending;
                                    break;
                                default:
                                    child.material.transparent = false;
                                    child.material.blending = THREE.NormalBlending;
                            }
                            child.material.needsUpdate = true;
                        }
                    }
                });
            }
        };

        // --- Picking System ---

        imports.env.EntityPickMode = (ent, mode, obs) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.userData.pickMode = mode; // 1: sphere, 2: poly, 3: box
                entity.traverse((child) => {
                    child.userData.pickMode = mode;
                });
            }
        };

        const updatePickResult = (intersect) => {
            if (!intersect) {
                this.lastPick = { entity: 0, x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, surface: 0, triangle: 0 };
                return 0;
            }
            // Find blitz entity ID from object or parents
            let pickedEnt = 0;
            let curr = intersect.object;
            while (curr) {
                if (curr.userData && curr.id) {
                    for (let id in this.entities) {
                        if (this.entities[id] === curr || this.entities[id] === curr.parent) {
                            pickedEnt = parseInt(id);
                            break;
                        }
                    }
                    if (pickedEnt) break;
                }
                curr = curr.parent;
            }

            this.lastPick.entity = pickedEnt;
            this.lastPick.x = intersect.point.x;
            this.lastPick.y = intersect.point.y;
            this.lastPick.z = intersect.point.z;
            if (intersect.face) {
                this.lastPick.nx = intersect.face.normal.x;
                this.lastPick.ny = intersect.face.normal.y;
                this.lastPick.nz = intersect.face.normal.z;
            }
            return pickedEnt;
        };

        imports.env.CameraPick = (camId, x, y) => {
            const cam = this.entities[camId];
            if (!cam) return 0;

            // Convert screen x,y to normalized device coords (-1 to +1)
            const ndcX = (x / this.core.canvas.width) * 2 - 1;
            const ndcY = -(y / this.core.canvas.height) * 2 + 1;

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), cam);

            const pickables = [];
            this.scene.traverse((obj) => {
                if (obj.userData && obj.userData.pickMode) pickables.push(obj);
            });

            const intersects = raycaster.intersectObjects(pickables, false);
            if (intersects.length > 0) {
                return updatePickResult(intersects[0]);
            }
            updatePickResult(null);
            return 0;
        };

        imports.env.EntityPick = (entId, range) => {
            const ent = this.entities[entId];
            if (!ent) return 0;

            const origin = ent.position.clone();
            const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(ent.quaternion).normalize();

            const raycaster = new THREE.Raycaster(origin, direction, 0, range > 0 ? range : Infinity);

            const pickables = [];
            this.scene.traverse((obj) => {
                if (obj !== ent && obj.userData && obj.userData.pickMode) pickables.push(obj);
            });

            const intersects = raycaster.intersectObjects(pickables, false);
            if (intersects.length > 0) {
                return updatePickResult(intersects[0]);
            }
            updatePickResult(null);
            return 0;
        };

        imports.env.LinePick = (x, y, z, dx, dy, dz, radius) => {
            const origin = new THREE.Vector3(x, y, z);
            const direction = new THREE.Vector3(dx, dy, dz);
            const length = direction.length();
            direction.normalize();

            const raycaster = new THREE.Raycaster(origin, direction, 0, length);

            const pickables = [];
            this.scene.traverse((obj) => {
                if (obj.userData && obj.userData.pickMode) pickables.push(obj);
            });

            const intersects = raycaster.intersectObjects(pickables, false);
            if (intersects.length > 0) {
                return updatePickResult(intersects[0]);
            }
            updatePickResult(null);
            return 0;
        };

        imports.env.PickedX = () => this.lastPick.x;
        imports.env.PickedY = () => this.lastPick.y;
        imports.env.PickedZ = () => this.lastPick.z;
        imports.env.PickedNX = () => this.lastPick.nx;
        imports.env.PickedNY = () => this.lastPick.ny;
        imports.env.PickedNZ = () => this.lastPick.nz;
        imports.env.PickedEntity = () => this.lastPick.entity;
        imports.env.PickedSurface = () => 0; // Stub
        imports.env.PickedTriangle = () => 0; // Stub

        imports.env.PointEntity = (ent, target) => {
            const entity = this.entities[ent];
            const targetEntity = this.entities[target];
            if (entity && targetEntity) {
                entity.lookAt(targetEntity.position);
            }
        };

        // --- Collision System (Stubs) ---

        this.collisions = []; // List of collision pairs: {src, dest, method, response}
        this.collisionState = {}; // entId -> { collisions: [], type: 0, radius: [x,y], box: [x,y,z,w,h,d] }

        // Setup
        imports.env.Collisions = (srcType, destType, method, response) => {
            this.collisions.push({ srcType, destType, method, response });
        };

        imports.env.EntityType = (entId, typeId, recurs) => {
            const ent = this.entities[entId];
            if (ent) {
                ent.userData.typeId = typeId;
                // recursive...
            }
        };

        imports.env.EntityRadius = (entId, radiusX, radiusY) => {
            const ent = this.entities[entId];
            if (ent) ent.userData.radius = [radiusX, radiusY || radiusX];
        };

        imports.env.EntityBox = (entId, x, y, z, w, h, d) => {
            const ent = this.entities[entId];
            if (ent) ent.userData.box = [x, y, z, w, h, d];
        };

        imports.env.ResetEntity = (entId) => {
            // Reset collision history
        };

        imports.env.ClearCollisions = () => {
            // Clear current frame collisions
        };

        imports.env.UpdateWorld = (step) => {
            // Perform physics/collision steps
            // 1. Move entities based on velocity/gravity? (Blitz3D handles this internally or user does?)
            // Blitz3D UpdateWorld typically handles animation and collisions.
            // We need to implement simple collision detection here if we want gameplay.
            // For now: Animation update

            // Update animations
            const now = performance.now();
            const delta = (now - this.lastTime) * 0.001;
            this.lastTime = now;

            if (this.animationSystem) {
                this.animationSystem.update(delta * step);
            }
        };

        // Query
        imports.env.EntityCollided = (entId, typeId) => {
            // Return entity ID that collided with entId of type typeId
            return 0;
        };

        imports.env.CountCollisions = (entId) => {
            return 0;
        };

        imports.env.CollisionX = (entId, index) => 0;
        imports.env.CollisionY = (entId, index) => 0;
        imports.env.CollisionZ = (entId, index) => 0;
        imports.env.CollisionNX = (entId, index) => 0;
        imports.env.CollisionNY = (entId, index) => 0;
        imports.env.CollisionNZ = (entId, index) => 0;
        imports.env.CollisionTime = (entId, index) => 0;
        imports.env.CollisionEntity = (entId, index) => 0;
        imports.env.CollisionSurface = (entId, index) => 0;
        imports.env.CollisionTriangle = (entId, index) => 0;

        imports.env.GetEntityType = (entId) => {
            const ent = this.entities[entId];
            return ent ? (ent.userData.typeId || 0) : 0;
        };


        imports.env.NameEntity = (ent, name) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.name = name;
            }
        };

        imports.env.EntityName = (ent) => {
            const entity = this.entities[ent];
            if (entity && entity.name && this.core.allocString) {
                return this.core.allocString(entity.name);
            }
            return 0;
        };

        // VertexTexCoords for UV mapping
        imports.env.VertexTexCoords = (surfId, vid, u, v, w) => {
            const surface = this.surfaces[surfId];
            if (surface) {
                surface.setVertexUV(vid, u, v);
            }
        };

        // Mesh Surface Commands
        imports.env.CreateSurface = (meshId, brushId) => {
            const mesh = this.entities[meshId];
            if (mesh) {
                const surface = new this.Blitz3DSurface(mesh);
                const id = this.nextSurfaceId++;
                this.surfaces[id] = surface;
                surface.id = id;

                if (!mesh.userData.surfaces) mesh.userData.surfaces = [];
                mesh.userData.surfaces.push(surface);

                return id;
            }
            return 0;
        };

        imports.env.CountSurfaces = (meshId) => {
            const mesh = this.entities[meshId];
            if (mesh && mesh.userData && mesh.userData.surfaces) {
                return mesh.userData.surfaces.length;
            }
            return 0;
        };

        imports.env.GetSurface = (meshId, index) => {
            const mesh = this.entities[meshId];
            if (mesh && mesh.userData && mesh.userData.surfaces) {
                const surface = mesh.userData.surfaces[index - 1]; // Blitz3D is 1-indexed? No, usually 1..n for GetSurface
                return surface?.id || 0;
            }
            return 0;
        };

        imports.env.GetSurface = (meshId, index) => {
            const mesh = this.entities[meshId];
            if (mesh && mesh.children && index > 0 && index <= mesh.children.length) {
                const child = mesh.children[index - 1];
                if (child.userData && child.userData.surface) {
                    for (const id in this.surfaces) {
                        if (this.surfaces[id] === child.userData.surface) return parseInt(id);
                    }
                    const id = this.nextSurfaceId++;
                    this.surfaces[id] = child.userData.surface;
                    return id;
                }
            }
            return 0;
        };

        imports.env.AddVertex = (surfId, x, y, z, u, v, w) => {
            const surface = this.surfaces[surfId];
            if (surface) {
                const vertexIndex = surface.addVertex(x, y, z, u, v);
                // console.log("AddVertex surface " + surfId + ": index=" + vertexIndex + " at (" + x + ", " + y + ", " + z + ")");
                return vertexIndex;
            } else {
                console.error("AddVertex: surface " + surfId + " not found");
                return 0;
            }
        };

        imports.env.AddVertexExtended = (surfId, x, y, z, u, v, w, nx, ny, nz) => {
            const surface = this.surfaces[surfId];
            if (surface) {
                // Extended version supports normals
                const vertexIndex = surface.addVertex(x, y, z, u, v);
                // Set normal if surface supports it (might need to update the surface class)
                if (surface.setNormal) {
                    surface.setNormal(vertexIndex, nx, ny, nz);
                }
                return vertexIndex;
            } else {
                console.error("AddVertexExtended: surface " + surfId + " not found");
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

            const placeholderId = imports.env.CreateMesh(parent);
            const ent = this.entities[placeholderId];
            ent.name = path;

            // Determine loader
            const lowerPath = path.toLowerCase();
            if (lowerPath.endsWith('.rmesh')) {
                const handle = this.core.fileIO?.openFile?.(path) ?? 0;
                if (!handle) {
                    console.warn(`LoadMesh: failed to open rmesh ${path}`);
                } else {
                    const data = this.core.fileIO?.readRemaining?.(handle);
                    this.core.fileIO?.closeFile?.(handle);
                    if (data && data.length) {
                        const bankId = this.core.createBankFromData?.(data);
                        if (bankId) {
                            console.log(`LoadMesh: parsing rmesh ${path} (bank ${bankId})`);
                            imports.blitz3d?.ParseRMesh?.(bankId);
                        }
                    }
                }
            } else if (lowerPath.endsWith('.x')) {
                if (!this.xLoader) this.xLoader = new this.XLoader(this, this.core, null);
                this.xLoader.loadFile(path, parent).then(entityId => {
                    // XLoader creates its own entity, we might need to swap or just add to parent
                    console.log(`[XLoader] Loaded ${path}`);
                }).catch(err => console.error(`[XLoader] ${path}:`, err));
            } else if (lowerPath.endsWith('.b3d')) {
                this.animationSystem.b3dLoader.loadFile(path, parent).then(entityId => {
                    console.log(`[B3DLoader] Loaded ${path}`);
                }).catch(err => console.error(`[B3DLoader] ${path}:`, err));
            }

            return placeholderId;
        };

        imports.env.LoadMesh_Strict = (pathPtr, parent) => {
            return imports.env.LoadMesh(pathPtr, parent);
        };

        // Animation Commands
        imports.env.LoadAnimMesh = (pathPtr, parent) => {
            const path = this.core.readString(pathPtr);
            console.log(`Loading Anim Mesh: ${path}`);

            // Similar to LoadMesh, but via animationSystem which uses B3DLoader
            const placeholderId = imports.env.CreateMesh(parent);
            const ent = this.entities[placeholderId];
            ent.name = path;

            this.animationSystem.b3dLoader.loadFile(path, parent).then(entityId => {
                console.log(`[B3DLoader] Loaded Anim ${path}`);
            }).catch(err => console.error(`[B3DLoader] Anim ${path}:`, err));

            return placeholderId;
        };

        imports.env.LoadAnimMesh_Strict = (pathPtr, parent) => {
            return imports.env.LoadAnimMesh(pathPtr, parent);
        };

        if (!imports.blitz3d) imports.blitz3d = {};
        imports.blitz3d.ParseB3D = (bankId) => {
            const bank = this.core.banks.get(bankId);
            if (!bank) return 0;
            console.log(`ParseB3D: bankId=${bankId}, size=${bank.length}`);

            // For now, return a placeholder mesh. 
            // In a better implementation, we'd use B3DLoader.parseBinaryData
            const entityId = imports.env.CreateMesh(0);

            // Async load from bank data
            this.animationSystem.b3dLoader.parseBinaryData(bank);
            // Note: need to actually create the Three.js objects here

            return entityId;
        };

        imports.blitz3d.ParseRMesh = (bankId) => {
            const bank = this.core.banks.get(bankId);
            if (!bank) return 0;
            console.log(`ParseRMesh: bankId=${bankId}, size=${bank.length}`);
            return 1;
        };

        // Mesh Bridge
        imports.blitz3d.GetMeshSurfaceCount = (meshId) => {
            const ent = this.entities[meshId];
            if (!ent) return 0;
            let count = 0;
            ent.traverse(child => { if (child instanceof THREE.Mesh) count++; });
            return count;
        };
        imports.blitz3d.GetSurfaceVertexCount = (m, s) => 0;
        imports.blitz3d.GetSurfaceIndexCount = (m, s) => 0;
        imports.blitz3d.GetSurfaceVerticesPtr = (m, s) => 0;
        imports.blitz3d.GetSurfaceIndicesPtr = (m, s) => 0;
        imports.blitz3d.GetSurfaceVertexStride = () => 11;

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
            const segments = segs || 16;
            const geometry = new THREE.SphereGeometry(1, segments, segments); // Radius 1
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            const id = this.nextEntityId++;
            this.entities[id] = mesh;
            if (parent && this.entities[parent]) this.entities[parent].add(mesh);
            else this.scene.add(mesh);
            return id;
        };

        imports.env.CreatePlane = (parent) => {
            const geometry = new THREE.PlaneGeometry(20, 20);
            const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x888888, side: THREE.DoubleSide }));
            const id = this.nextEntityId++;
            this.entities[id] = mesh;
            if (parent && this.entities[parent]) this.entities[parent].add(mesh);
            else this.scene.add(mesh);
            return id;
        };

        // Brush/Material functions
        imports.env.CreateBrush = () => {
            const brush = {
                r: 255, g: 255, b: 255,
                alpha: 255,
                shininess: 0,
                texture: null
            };
            const id = this.nextBrushId++;
            this.brushes[id] = brush;
            console.log("CreateBrush: ID=" + id);
            return id;
        };

        imports.env.LoadBrush = (pathPtr, flags, u_scale, v_scale) => {
            const brushId = imports.env.CreateBrush();
            const textureId = imports.env.LoadTexture(pathPtr, flags);
            if (textureId) {
                imports.env.BrushTexture(brushId, textureId, 0, 0);
                // Note: u_scale/v_scale ignored for now, would need ScaleTexture(textureId, u_scale, v_scale)
            }
            return brushId;
        };

        imports.env.BrushColor = (brushId, r, g, b) => {
            const brush = this.brushes[brushId];
            if (brush) {
                brush.r = r;
                brush.g = g;
                brush.b = b;
                console.log("BrushColor: ID=" + brushId + " RGB(" + r + "," + g + "," + b + ")");
            }
        };

        imports.env.BrushAlpha = (brushId, alpha) => {
            const brush = this.brushes[brushId];
            if (brush) {
                brush.alpha = alpha;
                console.log("BrushAlpha: ID=" + brushId + " alpha=" + alpha);
            }
        };

        imports.env.BrushShininess = (brushId, shininess) => {
            const brush = this.brushes[brushId];
            if (brush) {
                brush.shininess = shininess;
                console.log("BrushShininess: ID=" + brushId + " shininess=" + shininess);
            }
        };

        imports.env.BrushTexture = (brushId, textureId, frame, index) => {
            const brush = this.brushes[brushId];
            if (brush) {
                brush.texture = textureId;
                brush.textureFrame = frame || 0;
                brush.textureIndex = index || 0;
                console.log("BrushTexture: brushId=" + brushId + " textureId=" + textureId);
            }
        };

        imports.env.GetBrushTexture = (brushId, index) => {
            const brush = this.brushes[brushId];
            if (brush) {
                if (index && index !== 0) {
                    console.warn("GetBrushTexture: only primary texture supported, index=" + index);
                }
                return brush.texture || 0;
            }
            return 0;
        };

        imports.env.BrushFX = (brushId, fx) => {
            const brush = this.brushes[brushId];
            if (brush) {
                brush.fx = fx;
                console.log("BrushFX: brushId=" + brushId + " fx=" + fx);
            }
        };

        imports.env.BrushBlend = (brushId, blend) => {
            const brush = this.brushes[brushId];
            if (brush) {
                brush.blend = blend;
                console.log("BrushBlend: brushId=" + brushId + " blend=" + blend);
            }
        };

        imports.env.FreeBrush = (brushId) => {
            delete this.brushes[brushId];
            console.log("FreeBrush: brushId=" + brushId);
        };

        imports.env.GetEntityBrush = (ent) => {
            // Stub: return a default brush
            return 1;
        };

        imports.env.PaintMesh = (meshId, brushId) => {
            const mesh = this.entities[meshId];
            if (mesh && mesh.mesh) {
                // Apply brush properties to mesh material
                console.log("PaintMesh: meshId=" + meshId + " brushId=" + brushId);
            }
        };

        imports.env.GetSurfaceBrush = (surfaceId) => {
            const surface = this.surfaces[surfaceId];
            return surface && surface.brushId ? surface.brushId : 0;
        };

        imports.env.PaintSurface = (surfaceId, brushId) => {
            console.log("PaintSurface: surfaceId=" + surfaceId + " brushId=" + brushId);
            const surface = this.surfaces[surfaceId];
            if (surface) {
                surface.brushId = brushId;
            }
        };

        imports.env.TextureWidth = (textureId) => {
            const texture = this.textures[textureId];
            return texture ? (texture.image?.width || 256) : 256;
        };

        imports.env.TextureHeight = (textureId) => {
            const texture = this.textures[textureId];
            return texture ? (texture.image?.height || 256) : 256;
        };

        imports.env.TextureName = (textureId) => {
            const texture = this.textures[textureId];
            return texture ? this.core.allocString(texture.name || "") : 0;
        };

        imports.env.FreeTexture = (textureId) => {
            delete this.textures[textureId];
            console.log("FreeTexture: textureId=" + textureId);
        };

        imports.env.TextureBlend = (textureId, blend) => {
            console.log("TextureBlend: textureId=" + textureId + " blend=" + blend);
        };

        imports.env.TextureCoords = (textureId, coords) => {
            console.log("TextureCoords: textureId=" + textureId + " coords=" + coords);
        };

        imports.env.ScaleTexture = (textureId, uScale, vScale) => {
            console.log("ScaleTexture: textureId=" + textureId + " uScale=" + uScale + " vScale=" + vScale);
        };

        imports.env.PositionTexture = (textureId, u, v) => {
            console.log("PositionTexture: textureId=" + textureId + " u=" + u + " v=" + v);
        };

        imports.env.RotateTexture = (textureId, angle) => {
            console.log("RotateTexture: textureId=" + textureId + " angle=" + angle);
        };

        // Store last transformed coordinates
        this.tformedX = 0;
        this.tformedY = 0;
        this.tformedZ = 0;

        imports.env.TFormVector = (x, y, z, srcEntity, destEntity) => {
            // Transform vector from src to dest coordinate space
            // For now, just store the input (TODO: proper transformation)
            this.tformedX = x;
            this.tformedY = y;
            this.tformedZ = z;
        };

        imports.env.TFormPoint = (x, y, z, srcEntity, destEntity) => {
            // Transform point from src to dest coordinate space
            // For now, just store the input (TODO: proper transformation)
            this.tformedX = x;
            this.tformedY = y;
            this.tformedZ = z;
        };

        imports.env.TFormNormal = (x, y, z, srcEntity, destEntity) => {
            // Transform normal from src to dest coordinate space
            // For now, just store the input (TODO: proper transformation)
            this.tformedX = x;
            this.tformedY = y;
            this.tformedZ = z;
        };

        imports.env.TFormedX = () => this.tformedX;
        imports.env.TFormedY = () => this.tformedY;
        imports.env.TFormedZ = () => this.tformedZ;

        imports.env.Graphics3D = (width, height, depth, mode) => {
            console.log(`Graphics3D: ${width}x${height} depth=${depth} mode=${mode}`);
            // Already initialized in init3D
        };

        imports.env.AddEntity = (entityId, parentId) => {
            const entity = this.entities[entityId];
            const parent = this.entities[parentId];
            if (entity && parent) {
                parent.add(entity);
            }
        };

        imports.env.CreatePivot = (parentId) => {
            const pivot = new THREE.Object3D();
            const id = this.nextEntityId++;
            this.entities[id] = pivot;

            if (parentId && this.entities[parentId]) {
                this.entities[parentId].add(pivot);
            } else if (this.scene) {
                this.scene.add(pivot);
            } else {
                console.warn("CreatePivot: scene not initialized; calling init3D");
                this.init3D();
                if (this.scene) {
                    this.scene.add(pivot);
                } else {
                    console.warn("CreatePivot: scene still not initialized; deferring add", { id, parentId });
                }
            }

            console.log("CreatePivot: id=" + id + " parent=" + parentId);
            return id;
        };

        // Sprite Functions
        imports.env.CreateSprite = (parentId) => {
            const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }));
            const id = this.nextEntityId++;
            this.entities[id] = sprite;

            if (parentId && this.entities[parentId]) {
                this.entities[parentId].add(sprite);
            } else {
                this.scene.add(sprite);
            }

            return id;
        };

        imports.env.ScaleSprite = (spriteId, xScale, yScale) => {
            const sprite = this.entities[spriteId];
            if (sprite) {
                sprite.scale.set(xScale, yScale, 1);
            }
        };

        imports.env.SpriteViewMode = (spriteId, mode) => {
            // Mode: 1=fixed, 2=free, 3=billboard
            console.log(`SpriteViewMode: sprite=${spriteId} mode=${mode}`);
        };

        // Extended Entity Functions
        imports.env.TranslateEntity = (entityId, x, y, z) => {
            const entity = this.entities[entityId];
            if (entity) {
                entity.translateX(x);
                entity.translateY(y);
                entity.translateZ(z);
            }
        };

        imports.env.EntityAlpha = (entityId, alpha) => {
            const entity = this.entities[entityId];
            if (entity && entity.material) {
                entity.material.opacity = alpha;
                entity.material.transparent = alpha < 1.0;
            }
        };

        imports.env.EntityColor = (entityId, r, g, b) => {
            const entity = this.entities[entityId];
            if (entity && entity.material) {
                entity.material.color.setRGB(r / 255, g / 255, b / 255);
            }
        };

        imports.env.EntityShininess = (entityId, shininess) => {
            const entity = this.entities[entityId];
            if (entity && entity.material) {
                entity.material.shininess = shininess;
            }
        };

        imports.env.EntityFX = (entityId, fx) => {
            // FX flags: 1=full-bright, 2=vertical gradient, etc.
            console.log(`EntityFX: entity=${entityId} fx=${fx}`);
        };

        imports.env.EntityBlend = (entityId, blend) => {
            const entity = this.entities[entityId];
            if (entity && entity.material) {
                // 0=solid, 1=alpha, 2=multiply, 3=add
                if (blend === 3) {
                    entity.material.blending = THREE.AdditiveBlending;
                } else if (blend === 2) {
                    entity.material.blending = THREE.MultiplyBlending;
                } else {
                    entity.material.blending = THREE.NormalBlending;
                }
            }
        };

        imports.env.EntityParent = (entityId, parentId, global) => {
            const entity = this.entities[entityId];
            const parent = this.entities[parentId];
            if (entity && parent) {
                parent.add(entity);
            }
        };

        imports.env.EntityClass = (entityId) => {
            const ent = this.entities[entityId];
            if (!ent) return 0;
            let cls = "Object";
            if (ent.isMesh) cls = "Mesh";
            else if (ent.isCamera) cls = "Camera";
            else if (ent.isLight) cls = "Light";
            else if (ent.isSprite) cls = "Sprite";
            else if (ent.type === "Object3D") cls = "Pivot";

            return this.core.allocString(cls);
        };

        imports.env.HideEntity = (entityId) => {
            const entity = this.entities[entityId];
            if (entity) {
                entity.visible = false;
            }
        };

        imports.env.ShowEntity = (entityId) => {
            const entity = this.entities[entityId];
            if (entity) {
                entity.visible = true;
            }
        };

        imports.env.EntityVisible = (entityId, targetId) => {
            // Check if entity is visible from target (basic frustum check)
            return 1; // Stub: always visible
        };

        imports.env.EntityInView = (entityId, cameraId) => {
            // Check if entity is in camera view
            return 1; // Stub: always in view
        };

        imports.env.CopyEntity = (entityId, parentId) => {
            const entity = this.entities[entityId];
            if (entity) {
                const clone = entity.clone();
                const id = this.nextEntityId++;
                this.entities[id] = clone;

                if (parentId && this.entities[parentId]) {
                    this.entities[parentId].add(clone);
                } else {
                    this.scene.add(clone);
                }

                return id;
            }
            return 0;
        };

        imports.env.NameEntity = (entityId, namePtr) => {
            const entity = this.entities[entityId];
            if (entity) {
                entity.name = this.core.readString(namePtr);
            }
        };

        imports.env.EntityName = (entityId) => {
            const entity = this.entities[entityId];
            if (entity && entity.name) {
                return this.core.allocString(entity.name);
            }
            return 0;
        };

        imports.env.GetParent = (entityId) => {
            const entity = this.entities[entityId];
            if (entity && entity.parent) {
                // Find ID of parent
                for (const id in this.entities) {
                    if (this.entities[id] === entity.parent) return parseInt(id);
                }
            }
            return 0;
        };

        imports.env.CountChildren = (entityId) => {
            const entity = this.entities[entityId];
            return entity ? entity.children.length : 0;
        };

        imports.env.GetChild = (entityId, index) => {
            const entity = this.entities[entityId];
            if (entity && index >= 1 && index <= entity.children.length) {
                const child = entity.children[index - 1];
                for (const id in this.entities) {
                    if (this.entities[id] === child) return parseInt(id);
                }
            }
            return 0;
        };

        imports.env.FindChild = (entityId, namePtr) => {
            const entity = this.entities[entityId];
            const name = this.core.readString(namePtr).toLowerCase();
            if (entity) {
                const child = entity.getObjectByName(name);
                if (child) {
                    for (const id in this.entities) {
                        if (this.entities[id] === child) return parseInt(id);
                    }
                }
            }
            return 0;
        };

        imports.env.Kill = (entityId) => {
            const entity = this.entities[entityId];
            if (entity) {
                if (entity.parent) {
                    entity.parent.remove(entity);
                }
                delete this.entities[entityId];
            }
        };

        // Particle System
        this.particles = [];

        imports.env.CreateParticle = (x, y, z, image, size, gravity, lifetime) => {
            const particle = {
                id: this.nextEntityId++,
                x, y, z,
                image, size, gravity, lifetime,
                timer: 0
            };
            this.particles.push(particle);

            // Create a sprite for the particle with bright color
            const material = new THREE.SpriteMaterial({
                color: 0xff0000,  // Bright red so it's visible
                sizeAttenuation: false,
                transparent: true,
                opacity: 0.8
            });
            const sprite = new THREE.Sprite(material);
            sprite.position.set(x, y, z);
            sprite.scale.set(size * 0.05, size * 0.05, 1); // Small particle dots
            this.scene.add(sprite);
            this.entities[particle.id] = sprite;

            console.log(`CreateParticle: id=${particle.id} pos=(${x},${y},${z}) size=${size}`);

            return particle.id;
        };

        imports.env.UpdateParticles = () => {
            // Update all particles
            this.particles = this.particles.filter(p => {
                p.timer += 1;
                if (p.timer > p.lifetime) return false;

                const sprite = this.entities[p.id];
                if (sprite) {
                    sprite.position.y -= p.gravity;
                }
                return true;
            });
        };

        imports.env.RemoveParticle = (particleId) => {
            const index = this.particles.findIndex(p => p.id === particleId);
            if (index !== -1) {
                this.particles.splice(index, 1);
                const sprite = this.entities[particleId];
                if (sprite) {
                    this.scene.remove(sprite);
                    delete this.entities[particleId];
                }
            }
        };

        imports.env.ParticleTextures = (minImage, maxImage, flags) => {
            console.log(`ParticleTextures: min=${minImage} max=${maxImage} flags=${flags}`);
            return 1;
        };

        // Devil Particle System (DLL wrapper)
        this.emitters = {};

        imports.env.SetEmitter = (entityId, emitterId) => {
            console.log(`SetEmitter: entity=${entityId} emitter=${emitterId}`);
            this.emitters[emitterId] = { entity: entityId };
            return emitterId;
        };

        imports.env.UpdateEmitters = (roomId) => {
            // Update all emitters
            console.log(`UpdateEmitters: room=${roomId}`);
        };

        imports.env.DeleteDevilEmitters = () => {
            this.emitters = {};
        };

        imports.env.UpdateDevilEmitters = () => {
            // Update devil particle emitters
        };

        // Decal System
        this.decals = [];

        imports.env.CreateDecal = (id, x, y, z, pitch, yaw, roll, scale, meshId) => {
            const decal = {
                id: this.nextEntityId++,
                type: id,
                x, y, z,
                pitch, yaw, roll,
                scale,
                mesh: meshId
            };
            this.decals.push(decal);

            // Create a plane mesh for the decal
            const geometry = new THREE.PlaneGeometry(scale, scale);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            mesh.rotation.set(pitch * Math.PI / 180, yaw * Math.PI / 180, roll * Math.PI / 180);
            this.scene.add(mesh);
            this.entities[decal.id] = mesh;

            return decal.id;
        };

        imports.env.UpdateDecals = () => {
            // Update/fade decals over time
        };

        // Game-Specific Functions
        imports.env.GiveAchievement = (achievementId) => {
            console.log(`[Achievement] Unlocked: ${achievementId}`);
        };

        imports.env.Update294 = () => {
            // Update SCP-294 (coffee machine) logic
        };

        imports.env.UpdateItems = () => {
            // Update all items in the game
        };

        imports.env.PickItem = (itemId) => {
            console.log(`PickItem: ${itemId}`);
        };

        imports.env.DropItem = (itemId) => {
            console.log(`DropItem: ${itemId}`);
        };

        imports.env.AnimateNPC = (npcId, startFrame, endFrame, speed, loop, transition) => {
            console.log(`AnimateNPC: ${npcId} frames=${startFrame}-${endFrame}`);
        };

        imports.env.Animate2 = (entityId, currentFrame, startFrame, endFrame, speed, loopFlag) => {
            // Stub: advance frame within [startFrame, endFrame] and wrap/stop based on loopFlag
            const delta = speed;
            let next = currentFrame + delta;
            const minF = Math.min(startFrame, endFrame);
            const maxF = Math.max(startFrame, endFrame);
            const ascending = endFrame >= startFrame;
            if (ascending) {
                if (next > maxF) {
                    next = loopFlag ? startFrame : maxF;
                }
            } else {
                if (next < minF) {
                    next = loopFlag ? startFrame : minF;
                }
            }
            return next;
        };

        imports.env.ChangeNPCTextureID = (npcId, textureId) => {
            console.log(`ChangeNPCTextureID: npc=${npcId} texture=${textureId}`);
        };

        imports.env.CheckForNPCInFacility = (npcType) => {
            console.log(`CheckForNPCInFacility: type=${npcType}`);
            return 0; // No NPC found
        };

        imports.env.Console_SpawnNPC = (npcType) => {
            console.log(`Console_SpawnNPC: type=${npcType}`);
        };

        imports.env.CreateConsoleMsg = (msgPtr) => {
            const msg = this.core.readString(msgPtr);
            console.log(`[Console] ${msg}`);
        };

        imports.env.UseDoor = (doorId, showMsg = 1, playSfx = 1) => {
            console.log(`UseDoor: door=${doorId} showMsg=${showMsg} playSfx=${playSfx}`);
        };

        imports.env.SetNPCFrame = (npcId, frame) => {
            console.log(`SetNPCFrame: npc=${npcId} frame=${frame}`);
        };

        imports.env.CreateNPC = (npcType, x, y, z) => {
            console.log(`CreateNPC: type=${npcType} at (${x}, ${y}, ${z})`);
            return 0;
        };

        imports.env.RemoveNPC = (npcId) => {
            console.log(`RemoveNPC: npc=${npcId}`);
        };

        imports.env.FindPath = (npcId, x, y, z) => {
            console.log(`FindPath: npc=${npcId} target=(${x}, ${y}, ${z})`);
            return 0;
        };

        imports.env.PointEntity = (entityId, targetId) => {
            console.log(`PointEntity: entity=${entityId} target=${targetId}`);
        };

        imports.env.CreateEmitter = (x, y, z, emitterType) => {
            console.log(`CreateEmitter: pos=(${x}, ${y}, ${z}) type=${emitterType}`);
            return 0;
        };

        imports.env.ChangeAngleValueForCorrectBoneAssigning = (angle) => {
            // Adjust angle for bone animations
            return angle;
        };

        imports.env.CameraFogRange = (cameraId, near, far) => {
            console.log(`CameraFogRange: cam=${cameraId} near=${near} far=${far}`);
        };

        imports.env.CameraFogColor = (cameraId, r, g, b) => {
            console.log(`CameraFogColor: cam=${cameraId} rgb=(${r},${g},${b})`);
        };

        imports.env.CameraFogMode = (cameraId, mode) => {
            console.log(`CameraFogMode: cam=${cameraId} mode=${mode}`);
        };

        imports.env.DrawLoading = (percent, shortLoading = 0) => {
            console.log(`DrawLoading: ${percent}% short=${shortLoading}`);
        };

        imports.env.sky_CreateSky = (filenamePtr, parent = 0) => {
            const name = this.core.readString(filenamePtr);
            console.log(`sky_CreateSky: base=${name} parent=${parent}`);
            return 0;
        };

        imports.env.UpdateSky = () => {
            // Stub; real impl would position sky to camera
        };

        imports.env.LoadSprite = (pathPtr, flags) => {
            const path = this.core.readString(pathPtr);
            console.log(`LoadSprite: ${path} flags=${flags}`);
            return 0;
        };

        imports.env.ScaleMesh = (meshId, sx, sy, sz) => {
            console.log(`ScaleMesh: mesh=${meshId} scale=(${sx},${sy},${sz})`);
        };

        imports.env.HideChunks = () => {
            console.log("HideChunks");
        };

        imports.env.UpdateEndings = () => {
            console.log("UpdateEndings");
        };

        // Geometry/Math Helpers
        imports.env.AlignToVector = (entityId, vx, vy, vz, axis, rate) => {
            // Align entity to vector over time
            console.log(`AlignToVector: entity=${entityId} vec=(${vx},${vy},${vz})`);
        };

        imports.env.CurveAngle = (currentAngle, targetAngle, speed) => {
            // Smooth angle interpolation (already in core.js)
            let delta = targetAngle - currentAngle;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            return currentAngle + delta * speed;
        };

        // Camera Functions
        imports.env.CameraProject = (cameraId, x, y, z) => {
            // Project 3D position to 2D screen coordinates
            console.log(`CameraProject: camera=${cameraId} pos=(${x},${y},${z})`);
        };

        imports.env.PaintEntity = (entityId, brushId) => {
            const entity = this.entities[entityId];
            const brush = this.brushes[brushId];
            if (entity && brush) {
                const color = (brush.r << 16) | (brush.g << 8) | brush.b;
                const opacity = brush.alpha / 255;

                // Create material based on brush properties
                let material;
                if (brush.shininess > 0) {
                    // Use Phong material for shininess
                    material = new THREE.MeshPhongMaterial({
                        color: color,
                        transparent: opacity < 1,
                        opacity: opacity,
                        shininess: brush.shininess,
                        specular: 0x444444
                    });
                } else {
                    // Use basic material
                    material = new THREE.MeshBasicMaterial({
                        color: color,
                        transparent: opacity < 1,
                        opacity: opacity
                    });
                }

                // Apply material to entity and all children
                entity.traverse((child) => {
                    if (child.isMesh) {
                        child.material = material;
                    }
                });

                // Store brush reference for debugging
                entity.userData.brushId = brushId;

                console.log("PaintEntity: Entity=" + entityId + " Brush=" + brushId + " Color=0x" + color.toString(16).padStart(6, '0'));
            }
        };

        // Texture/Assets
        imports.env.LoadTexture = (pathPtr, flags) => {
            const path = this.core.readString(pathPtr);
            console.log("Loading Texture:", path);

            // Create a small placeholder texture immediately
            const placeholder = new THREE.DataTexture(new Uint8Array([255, 0, 255, 255]), 1, 1, THREE.RGBAFormat);
            placeholder.needsUpdate = true;
            placeholder.name = path;

            const id = this.nextTextureId++;
            this.textures[id] = placeholder;

            // Load actual texture async
            const loader = new THREE.TextureLoader();
            loader.load(path, (tex) => {
                console.log(`[TextureLoader] Loaded ${path}`);
                // Handle flags
                if (flags & 2) tex.format = THREE.RGBAFormat;
                tex.name = path;

                // Swap placeholder with actual texture
                this.textures[id] = tex;

                // If any materials are using the placeholder, they need to be notified
                this.scene?.traverse((obj: any) => {
                    if (obj.material) {
                        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                        mats.forEach((m: any) => {
                            if (m.map === placeholder) m.map = tex;
                            m.needsUpdate = true;
                        });
                    }
                });
            }, undefined, (err) => {
                console.error(`[TextureLoader] Error ${path}:`, err);
            });

            return id;
        };

        imports.env.LoadTexture_Strict = (pathPtr, flags) => {
            return imports.env.LoadTexture(pathPtr, flags);
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

        // Movie Playback Functions (for SCP:CB intro videos)
        this.movies = new Map();
        this.nextMovieId = 1;

        imports.env.OpenMovie = (pathPtr) => {
            const path = this.core.readString(pathPtr);
            const id = this.nextMovieId++;

            const video = document.createElement('video');
            video.src = path;
            video.crossOrigin = 'anonymous';
            video.muted = true; // Start muted for autoplay
            video.playsInline = true;

            this.movies.set(id, {
                path: path,
                video: video,
                x: 0,
                y: 0,
                width: 800,
                height: 600,
                playing: false
            });

            console.log("OpenMovie: " + path + " (id=" + id + ")");
            return id;
        };

        imports.env.DrawMovie = (movieId, x, y, width, height) => {
            const movie = this.movies.get(movieId);
            if (movie) {
                movie.x = x;
                movie.y = y;
                movie.width = width;
                movie.height = height;

                // Store for rendering in update()
                movie.shouldRender = true;
            }
        };

        imports.env.MoviePlaying = (movieId) => {
            const movie = this.movies.get(movieId);
            if (movie && movie.video) {
                return (!movie.video.paused && !movie.video.ended) ? 1 : 0;
            }
            return 0;
        };

        // Override renderWorld to draw movies
        const originalRenderWorld = imports.env.RenderWorld;
        imports.env.RenderWorld = (interp) => {
            // First render 3D scene
            if (this.renderer && this.scene && this.camera) {
                this.renderer.setClearColor(0x000000, 1);
                this.renderer.clear();
                this.renderer.render(this.scene, this.camera);
            }

            // Then render movies on top
            for (const [id, movie] of this.movies) {
                if (movie.shouldRender && movie.video && movie.video.readyState >= 2) {
                    this.drawMovieFrame(movie);
                }
            }
        };

        this.drawMovieFrame = (movie) => {
            if (!this.core.ctx2d || !movie.video || movie.video.paused || movie.video.ended) return;

            // Draw video frame to 2D canvas
            this.core.ctx2d.globalAlpha = 1.0;
            this.core.ctx2d.drawImage(movie.video, movie.x, movie.y, movie.width, movie.height);
        };

        // Start playing movie when opened
        const originalStreamPlay = imports.env.FSOUND_Stream_Play;
        imports.env.FSOUND_Stream_Play = (channel, streamId) => {
            // Check if this is actually a movie
            const movie = this.movies.get(streamId);
            if (movie && movie.video) {
                movie.video.play().then(() => {
                    movie.playing = true;
                    console.log("Movie started: " + movie.path);
                }).catch(e => {
                    console.error("Failed to play movie: " + e);
                });
                return streamId;
            }
            // Otherwise, use original audio stream logic
            if (originalStreamPlay) return originalStreamPlay(channel, streamId);
            return 0;
        };

    }

    updateSurfaces() {
        for (const id in this.surfaces) {
            this.surfaces[id].update();
        }
    }
}


