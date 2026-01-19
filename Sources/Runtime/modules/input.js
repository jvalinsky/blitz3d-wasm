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