import { Blitz3DGraphics } from "../index";
import { Blitz3DImage } from "../types";
import * as THREE from "three";

export function setupImage(this: Blitz3DGraphics, imports: any) {
    // Helpers for buffer-backed pixel operations (ImageBuffer/TextureBuffer/etc).
    const getBufferContext = (bufferId: number) => {
        // BackBuffer/front buffer use the shared text canvas
        if (!bufferId || bufferId === -1) {
            return this.core.ctx2d || null;
        }

        const img = this.images[bufferId];
        if (!img) return null;

        // Lazily create an offscreen canvas for writable images
        const blitzImg = img as any; // Cast to access canvas/canvasCtx
        if (!blitzImg.canvas) {
            const canvas = document.createElement("canvas");
            canvas.width = img.width || img.element?.width || 1;
            canvas.height = img.height || img.element?.height || 1;
            const ctx = canvas.getContext("2d");
            if (img.element && img.loaded) {
                ctx?.drawImage(img.element, 0, 0);
            }
            blitzImg.canvas = canvas;
            blitzImg.canvasCtx = ctx;
        }
        return blitzImg.canvasCtx || null;
    };

    // Image Functions
    imports.env.LoadImage = (pathPtr: number) => {
        const path = this.core.readString(pathPtr);
        const img = new Image();
        const id = this.nextImageId++;

        this.images[id] = {
            type: "image",
            element: img,
            width: 0,
            height: 0,
            loaded: false,
            loading: new Promise<void>((resolve) => {
                img.onload = () => {
                    this.images[id].width = img.width;
                    this.images[id].height = img.height;
                    this.images[id].loaded = true;
                    resolve();
                };
            }),
            handleX: 0,
            handleY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            flags: 0,
        };

        img.src = path;
        return id;
    };

    imports.env.LoadImage_Strict = (pathPtr: number) => {
        return imports.env.LoadImage(pathPtr);
    };

    imports.env.CreateImage = (width: number, height: number, frames: number) => {
        const id = this.nextImageId++;
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        this.images[id] = {
            type: "image",
            element: canvas as any,
            width: canvas.width,
            height: canvas.height,
            loaded: true,
            handleX: 0,
            handleY: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            flags: 0,
            loading: Promise.resolve(),
        };
        // Add custom properties
        (this.images[id] as any).canvas = canvas;
        (this.images[id] as any).canvasCtx = canvas.getContext("2d");
        return id;
    };

    imports.env.CreateTexture = (width: number, height: number, flags: number) => {
        const data = new Uint8Array((width || 1) * (height || 1) * 4).fill(255);
        const tex = new THREE.DataTexture(data, width || 1, height || 1);
        tex.needsUpdate = true;
        tex.image = { width: width || 1, height: height || 1, data: data as any };
        tex.name = `runtime_texture_${this.nextTextureId}`;
        const id = this.nextTextureId++;
        this.textures[id] = {
            type: "texture",
            texture: tex,
            width: width || 1,
            height: height || 1,
            flags: flags
        };
        return id;
    };

    const drawImageTransformed = (ctx: CanvasRenderingContext2D, img: Blitz3DImage, x: number, y: number, drawFn: (dx: number, dy: number) => void) => {
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

    imports.env.DrawImage = (imgId: number, x: number, y: number, frame: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
            drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
                this.core.ctx2d!.drawImage(img.element, dx, dy);
            });
        }
    };

    imports.env.DrawBlock = (imgId: number, x: number, y: number, frame: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
            const oldOp = this.core.ctx2d.globalCompositeOperation;
            this.core.ctx2d.globalCompositeOperation = "source-over";
            drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
                this.core.ctx2d!.drawImage(img.element, dx, dy);
            });
            this.core.ctx2d.globalCompositeOperation = oldOp;
        }
    };

    imports.env.DrawImageRect = (imgId: number, x: number, y: number, rx: number, ry: number, rw: number, rh: number, frame: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
            drawImageTransformed(this.core.ctx2d, img, x, y, (dx, dy) => {
                this.core.ctx2d!.drawImage(
                    img.element,
                    rx,
                    ry,
                    rw,
                    rh,
                    dx,
                    dy,
                    rw,
                    rh,
                );
            });
        }
    };

    imports.env.TileImage = (imgId: number, x: number, y: number, frame: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image" && img.loaded && this.core.ctx2d) {
            // TileImage usually ignores rotation/scale in basic implementations,
            // but checking if we need to support it.
            // For now, standard implementation.
            const pattern = this.core.ctx2d.createPattern(img.element, "repeat");
            if (pattern && this.core.canvas) {
                this.core.ctx2d.fillStyle = pattern;
                this.core.ctx2d.translate(x, y); // Offset pattern
                this.core.ctx2d.fillRect(
                    -x,
                    -y,
                    this.core.canvas.width,
                    this.core.canvas.height,
                );
                this.core.ctx2d.translate(-x, -y);
            }
        }
    };

    imports.env.ImageWidth = (imgId: number) => {
        const img = this.images[imgId];
        return (img && img.type === "image") ? img.width : 0;
    };

    imports.env.ImageHeight = (imgId: number) => {
        const img = this.images[imgId];
        return (img && img.type === "image") ? img.height : 0;
    };

    imports.env.HandleImage = (imgId: number, x: number, y: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image") {
            img.handleX = x;
            img.handleY = y;
        }
    };

    imports.env.MidHandle = (imgId: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image") {
            img.handleX = img.width / 2;
            img.handleY = img.height / 2;
        }
    };

    imports.env.AutoMidHandle = (enabled: number) => {
        // No-op
    };

    imports.env.RotateImage = (imgId: number, angle: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image") {
            img.rotation = angle;
        }
    };

    imports.env.ScaleImage = (imgId: number, xs: number, ys: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image") {
            img.scaleX = xs;
            img.scaleY = ys;
        }
    };

    imports.env.ResizeImage = (imgId: number, w: number, h: number) => {
        const img = this.images[imgId];
        if (img && img.type === "image") {
            // Resize logic ideally needs to resample.
            // For now, hack using scale if not strictly required to be destructive
            img.scaleX = w / (img.element.width || 1);
            img.scaleY = h / (img.element.height || 1);
            // Note: ImageWidth() will still return original width unless we update it
            // To be robust, we'd need to create a new canvas.
            // Leaving as soft-resize (scale) for now.
        }
    };

    imports.env.MaskImage = (imgId: number, r: number, g: number, b: number) => {
        // Color masking - complex, stub for now
    };

    imports.env.FreeImage = (imgId: number) => {
        if (this.images[imgId]) {
            const img = this.images[imgId];
            try {
                if (img?.element && img.element instanceof HTMLImageElement) {
                    img.element.onload = null;
                    img.element.onerror = null;
                    img.element.src = "";
                }
            } catch { }
            delete this.images[imgId];
        }
    };

    imports.env.Handle = (imgId: number) => {
        const img = this.images[imgId];
        if (img) {
            // Blitz3D exposes handleX/handleY; here we pack X in low 16 bits, Y in high 16 bits.
            return ((img.handleY & 0xffff) << 16) | (img.handleX & 0xffff);
        }
        return 0;
    };

    // Buffer accessors (used by SetBuffer/CopyRect/etc.)
    imports.env.BackBuffer = () => -1;
    imports.env.FrontBuffer = () => -1;
    imports.env.GraphicsBuffer = () => -1; // TODO: return current buffer
    imports.env.ScanLine = () => 0;
    imports.env.AvailVidMem = () => 1024 * 1024 * 512; // Mock 512MB
    imports.env.TotalVidMem = () => 1024 * 1024 * 512;
    imports.env.ImageBuffer = (imgId: number, frame: number) => imgId || -1;
    imports.env.TextureBuffer = (texId: number) => texId || -1;
    imports.env.SetBuffer = (bufferId: number) => {
        (this as any).currentBuffer = bufferId;
        if (this.core.ctx2d) {
            // Future: switch active context if bufferId is an image
        }
    };

    imports.env.LockBuffer = (bufferId: number) => {
        // Return a dummy pointer/handle for the locked buffer
        // In a real implementation, this might CopyImageData to a WASM memory bank
        return 1;
    };

    imports.env.UnlockBuffer = (bufferId: number) => {
        // Commit changes if we were using a shadow buffer
    };

    imports.env.WritePixelFast = (x: number, y: number, color: number, bufferId: number) => {
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

    imports.env.ReadPixelFast = (x: number, y: number, bufferId: number) => {
        const ctx = getBufferContext(bufferId);
        if (!ctx) return 0;
        const data = ctx.getImageData(x, y, 1, 1).data;
        return ((data[3] || 0) << 24) | (data[0] << 16) | (data[1] << 8) |
            data[2];
    };

    imports.env.ReadPixel = imports.env.ReadPixelFast;
    imports.env.WritePixel = imports.env.WritePixelFast;

    imports.env.CopyPixel = (
        srcX: number,
        srcY: number,
        destX: number,
        destY: number,
        srcBuffer: number,
        destBuffer: number,
    ) => {
        const srcCtx = getBufferContext(srcBuffer);
        const destCtx = getBufferContext(destBuffer);
        if (srcCtx && destCtx) {
            const pixel = srcCtx.getImageData(srcX, srcY, 1, 1);
            destCtx.putImageData(pixel, destX, destY);
        }
    };
    imports.env.CopyPixelFast = imports.env.CopyPixel;
}
