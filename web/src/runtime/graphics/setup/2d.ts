import { Blitz3DGraphicsInterface } from "../types.ts";
import * as THREE from "three";

export function setup2D(graphics: Blitz3DGraphicsInterface, imports: any) {
  const getContext = (): CanvasRenderingContext2D | null => {
    const buf = (graphics as any).currentBuffer;
    if (!buf || buf === -1 || buf === 0) return graphics.core.ctx2d || null;

    const img = graphics.images[buf];
    if (img && img.type === "image") {
      const blitzImg = img as any;
      if (!blitzImg.canvas) {
        // Lazy create canvas if missing (duplicated from image.ts logic)
        const canvas = document.createElement("canvas");
        canvas.width = img.width || 1;
        canvas.height = img.height || 1;
        const ctx = canvas.getContext("2d");
        if (
          img.element && img.loaded && img.element instanceof HTMLImageElement
        ) {
          ctx?.drawImage(img.element, 0, 0);
        }
        blitzImg.canvas = canvas;
        blitzImg.canvasCtx = ctx;
      }
      return blitzImg.canvasCtx;
    }
    return graphics.core.ctx2d || null;
  };

  imports.env.js_ClsColor = (r: number, g: number, b: number) => {
    graphics.clearColor = [r / 255.0, g / 255.0, b / 255.0, 1.0];
    if (graphics.renderer) {
      graphics.renderer.setClearColor(
        new THREE.Color(r / 255.0, g / 255.0, b / 255.0),
        1.0,
      );
    }
  };

  imports.env.js_Cls = () => {
    // Clear 3D
    if (
      graphics.renderer &&
      ((graphics as any).currentBuffer === -1 ||
        !(graphics as any).currentBuffer)
    ) {
      graphics.renderer.clear();
    }

    // Clear 2D
    const ctx = getContext();
    if (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      // If ClsColor overrides, fill? Blitz3D Cls uses ClsColor.
      // But standard 2D context clearRect clears to transparent.
      // We should fill with ClsColor if it's an image.
      if ((graphics as any).currentBuffer > 0) {
        ctx.fillStyle = `rgba(${graphics.clearColor[0] * 255}, ${
          graphics.clearColor[1] * 255
        }, ${graphics.clearColor[2] * 255}, ${graphics.clearColor[3]})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // Restore current color?
        const c = graphics.currentColor;
        ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      } else if (graphics.core.textCanvas && ctx === graphics.core.ctx2d) {
        // Overlay canvas is transparent usually?
        // Blitz3D BackBuffer Cls fills with ClsColor.
        // But our 3D renderer handles the background color if we use standard clear.
        // The overlay should be cleared to transparent.
        // So default behavior is correct for Overlay.
      }
    }
  };

  imports.env.js_Color = (r: number, g: number, b: number) => {
    graphics.currentColor = [r, g, b, 255];
    const ctx = getContext();
    if (ctx) {
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.strokeStyle = `rgb(${r},${g},${b})`;
    }
  };

  // Blitz3D GetColor reads the pixel at (x,y) from the current buffer and
  // updates the internal "current color" registers used by ColorRed/Green/Blue.
  imports.env.js_GetColor = (x: number, y: number) => {
    const ctx = getContext();
    if (!ctx) return 0;
    const ix = x | 0;
    const iy = y | 0;
    if (
      ix < 0 || iy < 0 || ix >= (ctx.canvas?.width ?? 0) ||
      iy >= (ctx.canvas?.height ?? 0)
    ) {
      return 0;
    }
    const data = ctx.getImageData(ix, iy, 1, 1).data;
    const r = data[0] ?? 0;
    const g = data[1] ?? 0;
    const b = data[2] ?? 0;
    const a = data[3] ?? 255;
    graphics.currentColor = [r, g, b, a];
    return ((a & 0xff) << 24) | ((r & 0xff) << 16) | ((g & 0xff) << 8) |
      (b & 0xff);
  };
  imports.env.js_ColorRed = () => graphics.currentColor[0] || 0;
  imports.env.js_ColorGreen = () => graphics.currentColor[1] || 0;
  imports.env.js_ColorBlue = () => graphics.currentColor[2] || 0;

  imports.env.And = (a: number, b: number) => (a | 0) & (b | 0);
  imports.env.Or = (a: number, b: number) => (a | 0) | (b | 0);

  // ------------------------------------------------------------------
  // Blitz3D API aliases
  //
  // The compiler/runtime historically used `Rect/Text/Cls/...` names, but the
  // modern runtime implementation lives under `js_*`. Provide aliases so
  // interpreter demos (and older compiled modules) render correctly.
  // ------------------------------------------------------------------

  imports.env.Graphics = (width: number, height: number, _depth: number) => {
    // 2D mode: no need to init 3D renderer, but we do want deterministic sizes.
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);

    const c = graphics.core.canvas as HTMLCanvasElement | undefined | null;
    if (c) {
      c.width = w;
      c.height = h;
    }
    const tc = graphics.core.textCanvas as HTMLCanvasElement | undefined | null;
    if (tc) {
      tc.width = w;
      tc.height = h;
    }
  };

  // Core 2D drawing aliases.
  imports.env.ClsColor = (r: number, g: number, b: number) =>
    imports.env.js_ClsColor(r, g, b);
  imports.env.Cls = () => imports.env.js_Cls();
  imports.env.Color = (r: number, g: number, b: number) =>
    imports.env.js_Color(r, g, b);
  imports.env.GetColor = (x: number, y: number) =>
    imports.env.js_GetColor(x, y);
  imports.env.ColorRed = () => imports.env.js_ColorRed();
  imports.env.ColorGreen = () => imports.env.js_ColorGreen();
  imports.env.ColorBlue = () => imports.env.js_ColorBlue();

  imports.env.Rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    solid: number,
  ) => imports.env.js_Rect(x, y, w, h, solid);
  imports.env.Oval = (
    x: number,
    y: number,
    w: number,
    h: number,
    solid: number,
  ) => imports.env.js_Oval(x, y, w, h, solid);
  imports.env.Line = (x1: number, y1: number, x2: number, y2: number) =>
    imports.env.js_Line(x1, y1, x2, y2);
  // Blitz's `Text x,y,"msg",centerX[,centerY]` is common; wire to js_Text.
  imports.env.Text = (
    x: number,
    y: number,
    txtPtr: number,
    centerX: number = 0,
    centerY: number = 0,
  ) => imports.env.js_Text(x, y, txtPtr, centerX, centerY);
  imports.env.StringWidth = (txtPtr: number) =>
    imports.env.js_StringWidth(txtPtr);
  imports.env.StringHeight = (txtPtr: number) =>
    imports.env.js_StringHeight(txtPtr);
  imports.env.FontWidth = () => imports.env.js_FontWidth();
  imports.env.FontHeight = () => imports.env.js_FontHeight();

  imports.env.LoadFont = (
    namePtr: number,
    size: number,
    bold: number,
    italic: number,
    underline: number,
  ) => imports.env.js_LoadFont(namePtr, size, bold, italic, underline);
  imports.env.SetFont = (fontId: number) => imports.env.js_SetFont(fontId);
  imports.env.FreeFont = (fontId: number) => imports.env.js_FreeFont(fontId);

  imports.env.js_Rect = (
    x: number,
    y: number,
    w: number,
    h: number,
    solid: number,
  ) => {
    const ctx = getContext();
    if (ctx) {
      const c = graphics.currentColor;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;

      if (solid) ctx.fillRect(x, y, w, h);
      else ctx.strokeRect(x, y, w, h);
    }
  };
  imports.env.js_Oval = (
    x: number,
    y: number,
    w: number,
    h: number,
    solid: number,
  ) => {
    const ctx = getContext();
    if (ctx) {
      const c = graphics.currentColor;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;

      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI);
      if (solid) ctx.fill();
      else ctx.stroke();
    }
  };
  imports.env.js_Line = (x1: number, y1: number, x2: number, y2: number) => {
    const ctx = getContext();
    if (ctx) {
      const c = graphics.currentColor;
      ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  };
  imports.env.js_Text = (
    x: number,
    y: number,
    txtPtr: number,
    cx: number,
    cy: number,
  ) => {
    const txt = graphics.core.readString(txtPtr);
    const ctx = getContext();
    if (ctx) {
      const c = graphics.currentColor;
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;

      ctx.font = `${graphics.currentFontSize}px ${graphics.currentFont}`;
      ctx.textBaseline = "top";

      let finalX = x;
      let finalY = y;

      // Treat these as Blitz-style booleans (usually 0 / 1 / -1). Some codegen
      // paths can accidentally pass non-boolean values; avoid unintended centering.
      const centerX = ((cx | 0) === 1) || ((cx | 0) === -1);
      const centerY = ((cy | 0) === 1) || ((cy | 0) === -1);

      if (centerX) {
        const metrics = ctx.measureText(txt);
        finalX -= metrics.width / 2;
      }
      if (centerY) {
        finalY -= graphics.currentFontSize / 2;
      }

      ctx.fillText(txt, finalX, finalY);
    }
  };

  const measureText = (txt: string) => {
    const ctx = getContext();
    if (!ctx) return { width: 0, height: graphics.currentFontSize };
    ctx.font = `${graphics.currentFontSize}px ${graphics.currentFont}`;
    const metrics = ctx.measureText(txt);
    const height =
      (metrics.actualBoundingBoxAscent || graphics.currentFontSize * 0.8) +
      (metrics.actualBoundingBoxDescent || graphics.currentFontSize * 0.2);
    return { width: metrics.width || 0, height };
  };

  imports.env.js_StringWidth = (txtPtr: number) => {
    const txt = graphics.core.readString(txtPtr);
    return Math.floor(measureText(txt).width);
  };

  imports.env.js_StringHeight = (txtPtr: number) => {
    const txt = graphics.core.readString(txtPtr);
    return Math.floor(measureText(txt).height);
  };

  imports.env.js_FontWidth = () => Math.floor(graphics.currentFontSize * 0.6);
  imports.env.js_FontHeight = () => Math.floor(graphics.currentFontSize);

  imports.env.js_LoadFont = (
    namePtr: number,
    size: number,
    bold: number,
    italic: number,
    underline: number,
  ) => {
    const fontName = graphics.core.readString(namePtr);
    const id = graphics.nextImageId++;
    graphics.images[id] = {
      type: "font",
      name: fontName,
      size: size || 12,
      bold: bold || 0,
      italic: italic || 0,
      underline: underline || 0,
    } as any;
    return id;
  };

  imports.env.js_SetFont = (fontId: number) => {
    const font = graphics.images[fontId] as any;
    if (font && font.type === "font") {
      let fontStyle = "";
      if (font.italic) fontStyle += "italic ";
      if (font.bold) fontStyle += "bold ";
      graphics.currentFont = font.name;
      graphics.currentFontSize = font.size;
    }
  };

  imports.env.js_FreeFont = (fontId: number) => {
    if (graphics.images[fontId]) delete graphics.images[fontId];
  };

  imports.env.InitAAFont = (fontId: number) => fontId;
  imports.env.AAFont = (fontId: number) => fontId;
  imports.env.AASetFont = (fontId: number) => imports.env.js_SetFont(fontId);
  imports.env.ReloadAAFont = (fontId: number) => fontId;
  imports.env.AAText = (
    x: number,
    y: number,
    txtPtr: number,
    centerX: number,
    centerY: number,
  ) => imports.env.js_Text(x, y, txtPtr, centerX, centerY);

  imports.env.AAStringWidth = (txtPtr: number) =>
    imports.env.js_StringWidth(txtPtr);
  imports.env.AAStringHeight = (txtPtr: number) =>
    imports.env.js_StringHeight(txtPtr);
  imports.env.AASpritePosition = (id: number, x: number, y: number) => {
    const s = graphics.entities[id];
    if (s) s.position.set(x, y, s.position.z);
  };
  imports.env.AASpriteScale = (id: number, x: number, y: number) => {
    const s = graphics.entities[id];
    if (s) s.scale.set(x, y, s.scale.z || 1);
  };
}
