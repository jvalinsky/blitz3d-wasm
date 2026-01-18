/**
 * Blitz3D Runtime Graphics Module
 * WebGL/Three.js integration for 3D rendering
 */

class Blitz3DGraphics {
    constructor(core) {
        this.core = core;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.entities = {};
        this.textures = {};
        this.animMixers = new Set();
        this.images = {};
        this.nextImageId = 1;
        this.nextEntityId = 1;
        this.currentFont = "arial";
        this.currentFontSize = 12;
        this.currentColor = [255, 255, 255, 255];
        this.clearColor = [0, 0, 0, 1];
        this.lastTime = 0;
        this.ambientLight = null;
        this.fog = null;
    }

    init3D() {
        if (!window.THREE) {
            console.error("Three.js not loaded");
            return;
        }

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: this.core.canvas, 
            antialias: false 
        });
        this.renderer.setSize(this.core.canvas.width, this.core.canvas.height);
        this.renderer.autoClear = false;

        this.animate();
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));

        const delta = (time - this.lastTime) / 1000.0;
        this.lastTime = time;

        if (delta > 0 && delta < 0.1) {
            this.animMixers.forEach(mixer => mixer.update(delta));
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    setupImports(imports) {
        imports.env.ClsColor = (r, g, b) => {
            this.clearColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
            if (this.renderer) {
                this.renderer.setClearColor(new THREE.Color(r / 255.0, g / 255.0, b / 255.0), 1.0);
            }
        };

        imports.env.Color = (r, g, b) => {
            this.currentColor = [r, g, b, 255];
            if (this.core.ctx2d) {
                this.core.ctx2d.fillStyle = `rgb(${r},${g},${b})`;
                this.core.ctx2d.strokeStyle = `rgb(${r},${g},${b})`;
            }
        };

        imports.env.CreateCamera = (parent) => {
            const cam = new THREE.PerspectiveCamera(
                75, 
                this.core.canvas.width / this.core.canvas.height, 
                1.0, 
                1000.0
            );
            const id = this.nextEntityId++;
            this.entities[id] = cam;

            if (parent && this.entities[parent]) {
                this.entities[parent].add(cam);
            }
            return id;
        };

        imports.env.CreateLight = (type) => {
            let light;
            switch (type) {
                case 1: // Point light
                    light = new THREE.PointLight(0xffffff, 1, 100);
                    break;
                case 2: // Spot light
                    light = new THREE.SpotLight(0xffffff, 1);
                    light.penumbra = 0.5;
                    break;
                default: // Ambient or directional
                    light = new THREE.DirectionalLight(0xffffff, 1);
            }
            
            const id = this.nextEntityId++;
            this.entities[id] = light;
            this.scene.add(light);
            return id;
        };

        imports.env.CreateMesh = (parent) => {
            const mesh = new THREE.Mesh();
            const id = this.nextEntityId++;
            this.entities[id] = mesh;
            
            if (parent && this.entities[parent]) {
                this.entities[parent].add(mesh);
            } else {
                this.scene.add(mesh);
            }
            return id;
        };

        imports.env.PositionEntity = (ent, x, y, z) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.position.set(x, y, -z);
            }
        };

        imports.env.RotateEntity = (ent, pitch, yaw, roll) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.rotation.set(
                    pitch * Math.PI / 180,
                    yaw * Math.PI / 180,
                    roll * Math.PI / 180
                );
            }
        };

        imports.env.ScaleEntity = (ent, x, y, z) => {
            const entity = this.entities[ent];
            if (entity) {
                entity.scale.set(x, y, z);
            }
        };
    }
}

window.Blitz3DGraphics = Blitz3DGraphics;
module.exports = Blitz3DGraphics;