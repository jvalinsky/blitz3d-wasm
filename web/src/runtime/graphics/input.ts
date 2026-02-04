import { PickResult, Blitz3DGraphicsInterface as Blitz3DGraphics, InputHandlers } from "./types.ts";
import { Blitz3DGraphics as IBlitz3DGraphics } from "./index.ts";

export class InputManager {
    graphics: Blitz3DGraphics;
    _inputInstalled: boolean = false;
    _inputHandlers: InputHandlers | null = null;

    keysDown: Record<number, boolean> = {};
    keysHit: Record<number, number> = {};
    keyQueue: number[] = [];
    mouseDown: Record<number, boolean> = {};
    mouseHit: Record<number, number> = {};
    mouseX: number = 0;
    mouseY: number = 0;
    mouseZ: number = 0;
    mouseXSpeed: number = 0;
    mouseYSpeed: number = 0;
    mouseZSpeed: number = 0;

    constructor(graphics: Blitz3DGraphics) {
        this.graphics = graphics;
    }

    installInputListeners() {
        if (this._inputInstalled || typeof window === "undefined") return;

        const toBlitzKey = (e: any): number => {
            const code = typeof e?.code === "string" ? e.code : "";
            // Blitz3D key codes match DirectInput scan codes (DIK_*), not DOM keyCode.
            // We map from `KeyboardEvent.code` (physical key) for layout-independent behavior.
            const map: Record<string, number> = {
                Escape: 1,
                Digit1: 2,
                Digit2: 3,
                Digit3: 4,
                Digit4: 5,
                Digit5: 6,
                Digit6: 7,
                Digit7: 8,
                Digit8: 9,
                Digit9: 10,
                Digit0: 11,
                Minus: 12,
                Equal: 13,
                Backspace: 14,
                Tab: 15,
                KeyQ: 16,
                KeyW: 17,
                KeyE: 18,
                KeyR: 19,
                KeyT: 20,
                KeyY: 21,
                KeyU: 22,
                KeyI: 23,
                KeyO: 24,
                KeyP: 25,
                BracketLeft: 26,
                BracketRight: 27,
                Enter: 28,
                ControlLeft: 29,
                KeyA: 30,
                KeyS: 31,
                KeyD: 32,
                KeyF: 33,
                KeyG: 34,
                KeyH: 35,
                KeyJ: 36,
                KeyK: 37,
                KeyL: 38,
                Semicolon: 39,
                Quote: 40,
                Backquote: 41,
                ShiftLeft: 42,
                Backslash: 43,
                KeyZ: 44,
                KeyX: 45,
                KeyC: 46,
                KeyV: 47,
                KeyB: 48,
                KeyN: 49,
                KeyM: 50,
                Comma: 51,
                Period: 52,
                Slash: 53,
                ShiftRight: 54,
                NumpadMultiply: 55,
                AltLeft: 56,
                Space: 57,
                CapsLock: 58,
                F1: 59,
                F2: 60,
                F3: 61,
                F4: 62,
                F5: 63,
                F6: 64,
                F7: 65,
                F8: 66,
                F9: 67,
                F10: 68,
                NumLock: 69,
                ScrollLock: 70,
                Numpad7: 71,
                Numpad8: 72,
                Numpad9: 73,
                NumpadSubtract: 74,
                Numpad4: 75,
                Numpad5: 76,
                Numpad6: 77,
                NumpadAdd: 78,
                Numpad1: 79,
                Numpad2: 80,
                Numpad3: 81,
                Numpad0: 82,
                NumpadDecimal: 83,
                F11: 87,
                F12: 88,
                ControlRight: 157,
                AltRight: 184,
                NumpadEnter: 156,
                NumpadDivide: 181,
                Insert: 210,
                Delete: 211,
                Home: 199,
                End: 207,
                PageUp: 201,
                PageDown: 209,
                ArrowUp: 200,
                ArrowLeft: 203,
                ArrowRight: 205,
                ArrowDown: 208,
            };
            const v = map[code];
            if (typeof v === "number") return v;

            // Fallback: some browsers/devices provide only keyCode; keep best-effort support.
            const keyCode = Number(e?.keyCode ?? 0);
            return Number.isFinite(keyCode) ? keyCode : 0;
        };

        this._inputHandlers = {
            keydown: (e: any) => {
                const keyStr = typeof e.key === "string" ? e.key : "";
                const ascii = (keyStr.length === 1)
                    ? keyStr.charCodeAt(0)
                    : (e.keyCode ?? 0);
                const blitzKey = toBlitzKey(e);
                if (blitzKey) {
                    this.keysDown[blitzKey] = true;
                    this.keysHit[blitzKey] = (this.keysHit[blitzKey] || 0) + 1;
                }
                // GetKey/WaitKey return an ASCII-ish code; keep feeding printable characters.
                if (Number.isFinite(ascii) && ascii) {
                    this.keyQueue.push(ascii);
                }
            },
            keyup: (e: any) => {
                const blitzKey = toBlitzKey(e);
                if (blitzKey) this.keysDown[blitzKey] = false;
            },
            mousemove: (e: any) => {
                this.mouseXSpeed = e.movementX;
                this.mouseYSpeed = e.movementY;
                this.mouseX = e.clientX;
                this.mouseY = e.clientY;
            },
            mousedown: (e: any) => {
                this.mouseDown[e.button + 1] = true;
                this.mouseHit[e.button + 1] = (this.mouseHit[e.button + 1] || 0) + 1;

                if (this.graphics.enablePointerLock && this.graphics.renderer?.domElement) {
                    const el = this.graphics.renderer.domElement;
                    if (document.pointerLockElement !== el) {
                        try {
                            // Only request on user gesture (mousedown matches this requirement)
                            el.requestPointerLock();
                        } catch (err) {
                            console.warn("Pointer lock failed:", err);
                        }
                    }
                }
            },
            mouseup: (e: any) => {
                this.mouseDown[e.button + 1] = false;
            },
        };

        window.addEventListener("keydown", this._inputHandlers.keydown);
        window.addEventListener("keyup", this._inputHandlers.keyup);
        window.addEventListener("mousemove", this._inputHandlers.mousemove);
        if (this._inputHandlers.mousedown) {
            window.addEventListener("mousedown", this._inputHandlers.mousedown);
        }
        if (this._inputHandlers.mouseup) {
            window.addEventListener("mouseup", this._inputHandlers.mouseup);
        }

        // Resume Audio Context on interaction
        const resumeAudio = () => {
            this.graphics.audioSystem?.resume?.();
            window.removeEventListener("mousedown", resumeAudio);
            window.removeEventListener("keydown", resumeAudio);
        };
        window.addEventListener("mousedown", resumeAudio);
        window.addEventListener("keydown", resumeAudio);

        this._inputInstalled = true;
    }

    removeInputListeners() {
        if (
            !this._inputInstalled || typeof window === "undefined" ||
            !this._inputHandlers
        ) return;

        window.removeEventListener("keydown", this._inputHandlers.keydown);
        window.removeEventListener("keyup", this._inputHandlers.keyup);
        window.removeEventListener("mousemove", this._inputHandlers.mousemove);
        if (this._inputHandlers.mousedown) {
            window.removeEventListener("mousedown", this._inputHandlers.mousedown);
        }
        if (this._inputHandlers.mouseup) {
            window.removeEventListener("mouseup", this._inputHandlers.mouseup);
        }

        this._inputInstalled = false;
        this._inputHandlers = null;
    }
}
