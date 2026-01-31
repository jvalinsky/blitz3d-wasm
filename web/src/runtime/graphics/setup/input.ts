
import { Blitz3DGraphicsInterface } from "../types.ts";

export function setupInput(graphics: Blitz3DGraphicsInterface, imports: any) {
    // Input initialization
    if (graphics.inputManager) {
        graphics.inputManager.installInputListeners();
    }

    // Keyboard
    imports.env.KeyDown = (key: number) => {
        return (graphics.inputManager && graphics.inputManager.keysDown[key]) ? 1 : 0;
    };

    imports.env.KeyHit = (key: number) => {
        if (!graphics.inputManager) return 0;
        const hits = graphics.inputManager.keysHit[key] || 0;
        graphics.inputManager.keysHit[key] = 0; // Clear hits after reading
        return hits;
    };

    imports.env.GetKey = () => {
        if (!graphics.inputManager) return 0;
        const q = graphics.inputManager.keyQueue;
        if (!q || q.length === 0) return 0;
        const v = q.shift();
        return Number.isFinite(v as number) ? (v as number) : 0;
    };

    imports.env.FlushKeys = () => {
        if (graphics.inputManager) {
            graphics.inputManager.keysDown = {};
            graphics.inputManager.keysHit = {};
            graphics.inputManager.keyQueue = [];
        }
    };

    imports.env.WaitKey = imports.env.GetKey; // Best-effort: non-blocking

    // Mouse
    imports.env.MouseDown = (btn: number) => {
        return (graphics.inputManager && graphics.inputManager.mouseDown[btn]) ? 1 : 0;
    };

    imports.env.MouseHit = (btn: number) => {
        if (!graphics.inputManager) return 0;
        const hits = graphics.inputManager.mouseHit[btn] || 0;
        graphics.inputManager.mouseHit[btn] = 0;
        return hits;
    };

    imports.env.MouseX = () => graphics.inputManager ? graphics.inputManager.mouseX : 0;
    imports.env.MouseY = () => graphics.inputManager ? graphics.inputManager.mouseY : 0;
    imports.env.MouseZ = () => graphics.inputManager ? graphics.inputManager.mouseZ : 0;
    imports.env.MouseXSpeed = () => graphics.inputManager ? graphics.inputManager.mouseXSpeed : 0;
    imports.env.MouseYSpeed = () => graphics.inputManager ? graphics.inputManager.mouseYSpeed : 0;
    imports.env.MouseZSpeed = () => graphics.inputManager ? graphics.inputManager.mouseZSpeed : 0;

    imports.env.FlushMouse = () => {
        if (graphics.inputManager) {
            graphics.inputManager.mouseDown = {};
            graphics.inputManager.mouseHit = {};
        }
    };

    imports.env.MoveMouse = (x: number, y: number) => {
        // Cannot programmatically move system mouse in browser
        if (graphics.inputManager) {
            graphics.inputManager.mouseX = x;
            graphics.inputManager.mouseY = y;
        }
    };
}
