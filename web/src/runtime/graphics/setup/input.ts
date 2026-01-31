
import { Blitz3DGraphics } from "../index";

export function setupInput(this: Blitz3DGraphics, imports: any) {
    // Input initialization
    if (this.inputManager) {
        this.inputManager.installInputListeners();
    }

    // Keyboard
    imports.env.KeyDown = (key: number) => {
        return (this.inputManager && this.inputManager.keysDown[key]) ? 1 : 0;
    };

    imports.env.KeyHit = (key: number) => {
        if (!this.inputManager) return 0;
        const hits = this.inputManager.keysHit[key] || 0;
        this.inputManager.keysHit[key] = 0; // Clear hits after reading
        return hits;
    };

    imports.env.GetKey = () => {
        if (!this.inputManager) return 0;
        const q = this.inputManager.keyQueue;
        if (!q || q.length === 0) return 0;
        const v = q.shift();
        return Number.isFinite(v as number) ? (v as number) : 0;
    };

    imports.env.FlushKeys = () => {
        if (this.inputManager) {
            this.inputManager.keysDown = {};
            this.inputManager.keysHit = {};
            this.inputManager.keyQueue = [];
        }
    };

    imports.env.WaitKey = imports.env.GetKey; // Best-effort: non-blocking

    // Mouse
    imports.env.MouseDown = (btn: number) => {
        return (this.inputManager && this.inputManager.mouseDown[btn]) ? 1 : 0;
    };

    imports.env.MouseHit = (btn: number) => {
        if (!this.inputManager) return 0;
        const hits = this.inputManager.mouseHit[btn] || 0;
        this.inputManager.mouseHit[btn] = 0;
        return hits;
    };

    imports.env.MouseX = () => this.inputManager ? this.inputManager.mouseX : 0;
    imports.env.MouseY = () => this.inputManager ? this.inputManager.mouseY : 0;
    imports.env.MouseZ = () => this.inputManager ? this.inputManager.mouseZ : 0;
    imports.env.MouseXSpeed = () => this.inputManager ? this.inputManager.mouseXSpeed : 0;
    imports.env.MouseYSpeed = () => this.inputManager ? this.inputManager.mouseYSpeed : 0;
    imports.env.MouseZSpeed = () => this.inputManager ? this.inputManager.mouseZSpeed : 0;

    imports.env.FlushMouse = () => {
        if (this.inputManager) {
            this.inputManager.mouseDown = {};
            this.inputManager.mouseHit = {};
        }
    };

    imports.env.MoveMouse = (x: number, y: number) => {
        // Cannot programmatically move system mouse in browser
        if (this.inputManager) {
            this.inputManager.mouseX = x;
            this.inputManager.mouseY = y;
        }
    };
}
