import { Blitz3DGraphics } from "../index";
import * as THREE from "three";

export function setup2D(this: Blitz3DGraphics, imports: any) {
    imports.env.ClsColor = (r: number, g: number, b: number) => {
        this.clearColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
        if (this.renderer) {
            this.renderer.setClearColor(
                new THREE.Color(r / 255.0, g / 255.0, b / 255.0),
                1.0,
            );
        }
    };

    imports.env.Cls = () => {
        if (this.renderer) {
            this.renderer.clear();
        }
        if (this.core.ctx2d && this.core.textCanvas) {
            this.core.ctx2d.clearRect(
                0,
                0,
                this.core.textCanvas.width,
                this.core.textCanvas.height,
            );
        }
    };

    imports.env.Color = (r: number, g: number, b: number) => {
        this.currentColor = [r, g, b, 255];
        if (this.core.ctx2d) {
            this.core.ctx2d.fillStyle = `rgb(${r},${g},${b})`;
            this.core.ctx2d.strokeStyle = `rgb(${r},${g},${b})`;
        }
    };

    imports.env.GetColor = (x: number, y: number) => {
        return 0;
    };
    imports.env.ColorRed = () => this.currentColor[0] || 0;
    imports.env.ColorGreen = () => this.currentColor[1] || 0;
    imports.env.ColorBlue = () => this.currentColor[2] || 0;

    // Bitwise helpers that sometimes get imported as functions
    imports.env.And = (a: number, b: number) => (a | 0) & (b | 0);
    imports.env.Or = (a: number, b: number) => (a | 0) | (b | 0);

    // 2D Primitives Stubs
    imports.env.Rect = (x: number, y: number, w: number, h: number, solid: number) => {
        if (this.core.ctx2d) {
            if (solid) this.core.ctx2d.fillRect(x, y, w, h);
            else this.core.ctx2d.strokeRect(x, y, w, h);
        }
    };
    imports.env.Oval = (x: number, y: number, w: number, h: number, solid: number) => {
        if (this.core.ctx2d) {
            this.core.ctx2d.beginPath();
            this.core.ctx2d.ellipse(
                x + w / 2,
                y + h / 2,
                w / 2,
                h / 2,
                0,
                0,
                2 * Math.PI,
            );
            if (solid) this.core.ctx2d.fill();
            else this.core.ctx2d.stroke();
        }
    };
    imports.env.Line = (x1: number, y1: number, x2: number, y2: number) => {
        if (this.core.ctx2d) {
            this.core.ctx2d.beginPath();
            this.core.ctx2d.moveTo(x1, y1);
            this.core.ctx2d.lineTo(x2, y2);
            this.core.ctx2d.stroke();
        }
    };
    imports.env.Text = (x: number, y: number, txtPtr: number, cx: number, cy: number) => {
        const txt = this.core.readString(txtPtr);
        if (this.core.ctx2d) {
            this.core.ctx2d.font = `${this.currentFontSize}px ${this.currentFont}`;
            this.core.ctx2d.textBaseline = "top";

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
    const measureText = (txt: string) => {
        if (!this.core.ctx2d) return { width: 0, height: this.currentFontSize };
        this.core.ctx2d.font = `${this.currentFontSize}px ${this.currentFont}`;
        const metrics = this.core.ctx2d.measureText(txt);
        const height =
            (metrics.actualBoundingBoxAscent || this.currentFontSize * 0.8) +
            (metrics.actualBoundingBoxDescent || this.currentFontSize * 0.2);
        return { width: metrics.width || 0, height };
    };

    imports.env.StringWidth = (txtPtr: number) => {
        const txt = this.core.readString(txtPtr);
        return Math.floor(measureText(txt).width);
    };

    imports.env.StringHeight = (txtPtr: number) => {
        const txt = this.core.readString(txtPtr);
        return Math.floor(measureText(txt).height);
    };

    imports.env.FontWidth = () => Math.floor(this.currentFontSize * 0.6);
    imports.env.FontHeight = () => Math.floor(this.currentFontSize);

    // Font Functions
    imports.env.LoadFont = (namePtr: number, size: number, bold: number, italic: number, underline: number) => {
        const fontName = this.core.readString(namePtr);
        const id = this.nextImageId++; // Reuse image ID counter for fonts
        this.images[id] = {
            type: "font",
            name: fontName,
            size: size || 12,
            bold: bold || 0,
            italic: italic || 0,
            underline: underline || 0,
        } as any; // Cast to any because we are storing font data in images map
        return id;
    };

    imports.env.SetFont = (fontId: number) => {
        const font = this.images[fontId] as any;
        if (font && font.type === "font") {
            let fontStyle = "";
            if (font.italic) fontStyle += "italic ";
            if (font.bold) fontStyle += "bold ";

            this.currentFont = font.name;
            this.currentFontSize = font.size;

            if (this.core.ctx2d) {
                this.core.ctx2d.font = `${fontStyle}${font.size}px ${font.name}`;
            }
        }
    };

    imports.env.FreeFont = (fontId: number) => {
        if (this.images[fontId]) {
            delete this.images[fontId];
        }
    };

    // AAText compatibility (minimal rendering shim)
    imports.env.InitAAFont = (fontId: number) => {
        this.currentAAFont = fontId;
        this.aaFonts[fontId] = { font: null, size: 0 };
        return fontId;
    };

    imports.env.AAFont = (fontId: number) => {
        this.currentAAFont = fontId;
        return fontId;
    };

    imports.env.AASetFont = (fontId: number) => {
        this.currentAAFont = fontId;
        imports.env.SetFont(fontId);
    };

    imports.env.ReloadAAFont = (fontId: number) => {
        // No-op placeholder – real implementation would reload atlas textures.
        return fontId;
    };

    imports.env.AAText = (x: number, y: number, txtPtr: number, centerX: number, centerY: number) => {
        // Delegate to Text to keep behavior consistent
        imports.env.Text(x, y, txtPtr, centerX, centerY);
    };

    imports.env.AAStringWidth = (txtPtr: number) => imports.env.StringWidth(txtPtr);
    imports.env.AAStringHeight = (txtPtr: number) => imports.env.StringHeight(txtPtr);
    imports.env.AASpritePosition = (spriteId: number, x: number, y: number) => {
        const sprite = this.entities[spriteId];
        if (sprite) sprite.position.set(x, y, sprite.position.z);
    };
    imports.env.AASpriteScale = (spriteId: number, sx: number, sy: number) => {
        const sprite = this.entities[spriteId];
        if (sprite) sprite.scale.set(sx, sy, sprite.scale.z || 1);
    };
}
