import { Blitz3DGraphicsInterface, Blitz3DImage } from "../types.ts";
import * as THREE from "three";

export function setupImage(graphics: Blitz3DGraphicsInterface, imports: any) {
  const resolveUrl = (path: string): string => {
    const r = (globalThis as any).__BLITZ3D_URL_RESOLVER;
    if (typeof r === "function") {
      try {
        const out = r(path);
        if (typeof out === "string" && out) return out;
      } catch {}
    }
    return path;
  };

  // Helpers for buffer-backed pixel operations (ImageBuffer/TextureBuffer/etc).
  const getBufferContext = (bufferId: number) => {
    // BackBuffer/front buffer use the shared text canvas
    if (!bufferId || bufferId === -1) {
      return graphics.core.ctx2d || null;
    }

    const img = graphics.images[bufferId];
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

  // Best-effort "locked buffer" acceleration for ReadPixelFast/WritePixelFast.
  // Blitz3D code often wraps tight pixel loops with LockBuffer/UnlockBuffer.
  const normalizeBufferKey = (bufferId: number) => {
    // Match getBufferContext behavior: 0/-1 mean the main 2D buffer.
    if (!bufferId || bufferId === -1) return -1;
    return bufferId | 0;
  };
  type LockedBuffer = {
    ctx: CanvasRenderingContext2D;
    imgData: ImageData;
    dirty: boolean;
  };
  const lockedBuffers = new Map<number, LockedBuffer>();

  // Image Functions
  imports.env.LoadImage = (pathPtr: number) => {
    const path = graphics.core.readString(pathPtr);
    const img = new Image();
    const id = graphics.nextImageId++;

    graphics.images[id] = {
      type: "image",
      element: img,
      width: 0,
      height: 0,
      loaded: false,
      loading: new Promise<void>((resolve) => {
        img.onload = () => {
          console.log(`[Image] Loaded: ${path} (${img.width}x${img.height})`);
          graphics.images[id].width = img.width;
          graphics.images[id].height = img.height;
          graphics.images[id].loaded = true;
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

    img.src = resolveUrl(path);
    return id;
  };

  imports.env.LoadImage_Strict = (pathPtr: number) => {
    return imports.env.LoadImage(pathPtr);
  };

  imports.env.ImageLoaded = (imgId: number) => {
    const img = graphics.images[imgId];
    return (img && img.type === "image" && img.loaded) ? 1 : 0;
  };

  imports.env.CreateImage = (width: number, height: number, frames: number) => {
    const id = graphics.nextImageId++;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    graphics.images[id] = {
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
    (graphics.images[id] as any).canvas = canvas;
    (graphics.images[id] as any).canvasCtx = canvas.getContext("2d");
    return id;
  };

  imports.env.CreateTexture = (
    width: number,
    height: number,
    flags: number,
  ) => {
    const data = new Uint8Array((width || 1) * (height || 1) * 4).fill(255);
    const tex = new THREE.DataTexture(data, width || 1, height || 1);
    tex.needsUpdate = true;
    tex.image = { width: width || 1, height: height || 1, data: data as any };
    tex.name = `runtime_texture_${graphics.nextTextureId}`;
    const id = graphics.nextTextureId++;
    graphics.textures[id] = {
      type: "texture",
      texture: tex,
      width: width || 1,
      height: height || 1,
      flags: flags,
    };
    return id;
  };

  // Texture loading (async)
  imports.env.LoadTexture = (pathPtr: number, flags: number) => {
    const path = graphics.core.readString(pathPtr);
    const url = resolveUrl(path);
    const id = graphics.nextTextureId++;
    const placeholder = new THREE.Texture();
    (placeholder as any).name = `runtime_texture_${id}`;
    const rec: any = {
      type: "texture",
      texture: placeholder,
      width: 0,
      height: 0,
      flags: flags || 0,
      loaded: false,
    };
    graphics.textures[id] = rec;

    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        rec.texture = tex;
        rec.loaded = true;
        rec.width = (tex as any).image?.width ?? 0;
        rec.height = (tex as any).image?.height ?? 0;
      },
      undefined,
      () => {
        delete graphics.textures[id];
      },
    );
    return id;
  };

  imports.env.LoadTexture_Strict = (pathPtr: number, flags: number) => {
    return imports.env.LoadTexture(pathPtr, flags);
  };

  imports.env.TextureLoaded = (texId: number) => {
    const tex = graphics.textures[texId] as any;
    return tex?.loaded ? 1 : 0;
  };

  imports.env.TextureWidth = (texId: number) => {
    const tex = graphics.textures[texId] as any;
    return tex?.width ?? 0;
  };

  imports.env.TextureHeight = (texId: number) => {
    const tex = graphics.textures[texId] as any;
    return tex?.height ?? 0;
  };

  imports.env.TextureBlend = (texId: number, blend: number) => {
    const tex = graphics.textures[texId];
    if (tex && tex.type === "texture") {
      tex.blend = blend;
    }
  };

  imports.env.TextureCoords = (texId: number, coords: number) => {
    const tex = graphics.textures[texId];
    if (tex && tex.type === "texture") {
      tex.coords = coords;
    }
  };

  imports.env.ScaleTexture = (texId: number, u: number, v: number) => {
    const tex = graphics.textures[texId];
    if (tex && tex.type === "texture" && tex.texture) {
      tex.texture.repeat.set(u, v);
      // Three.js doesn't wrap by default unless WrapS/WrapT are set.
      // Blitz3D expects wrapping for tiled textures.
      if (u !== 1 || v !== 1) {
        tex.texture.wrapS = THREE.RepeatWrapping;
        tex.texture.wrapT = THREE.RepeatWrapping;
        tex.texture.needsUpdate = true;
      }
    }
  };

  imports.env.PositionTexture = (texId: number, u: number, v: number) => {
    const tex = graphics.textures[texId];
    if (tex && tex.type === "texture" && tex.texture) {
      tex.texture.offset.set(u, v);
    }
  };

  imports.env.RotateTexture = (texId: number, angle: number) => {
    const tex = graphics.textures[texId];
    if (tex && tex.type === "texture" && tex.texture) {
      tex.texture.center.set(0.5, 0.5);
      tex.texture.rotation = angle * Math.PI / 180; // Degrees to Radians
    }
  };

  const drawImageTransformed = (
    ctx: CanvasRenderingContext2D,
    img: Blitz3DImage,
    x: number,
    y: number,
    drawFn: (dx: number, dy: number) => void,
  ) => {
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

  imports.env.DrawImage = (
    imgId: number,
    x: number,
    y: number,
    frame: number,
  ) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image" && img.loaded && graphics.core.ctx2d) {
      drawImageTransformed(graphics.core.ctx2d, img, x, y, (dx, dy) => {
        graphics.core.ctx2d!.drawImage(img.element, dx, dy);
      });
    }
  };

  imports.env.DrawBlock = (
    imgId: number,
    x: number,
    y: number,
    frame: number,
  ) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image" && img.loaded && graphics.core.ctx2d) {
      const oldOp = graphics.core.ctx2d.globalCompositeOperation;
      graphics.core.ctx2d.globalCompositeOperation = "source-over";
      drawImageTransformed(graphics.core.ctx2d, img, x, y, (dx, dy) => {
        graphics.core.ctx2d!.drawImage(img.element, dx, dy);
      });
      graphics.core.ctx2d.globalCompositeOperation = oldOp;
    }
  };

  imports.env.DrawImageRect = (
    imgId: number,
    x: number,
    y: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
    frame: number,
  ) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image" && img.loaded && graphics.core.ctx2d) {
      drawImageTransformed(graphics.core.ctx2d, img, x, y, (dx, dy) => {
        graphics.core.ctx2d!.drawImage(
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

  imports.env.TileImage = (
    imgId: number,
    x: number,
    y: number,
    frame: number,
  ) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image" && img.loaded && graphics.core.ctx2d) {
      // TileImage usually ignores rotation/scale in basic implementations,
      // but checking if we need to support it.
      // For now, standard implementation.
      const pattern = graphics.core.ctx2d.createPattern(img.element, "repeat");
      if (pattern && graphics.core.canvas) {
        graphics.core.ctx2d.fillStyle = pattern;
        graphics.core.ctx2d.translate(x, y); // Offset pattern
        graphics.core.ctx2d.fillRect(
          -x,
          -y,
          graphics.core.canvas.width,
          graphics.core.canvas.height,
        );
        graphics.core.ctx2d.translate(-x, -y);
      }
    }
  };

  imports.env.ImageWidth = (imgId: number) => {
    const img = graphics.images[imgId];
    return (img && img.type === "image") ? img.width : 0;
  };

  imports.env.ImageHeight = (imgId: number) => {
    const img = graphics.images[imgId];
    return (img && img.type === "image") ? img.height : 0;
  };

  imports.env.HandleImage = (imgId: number, x: number, y: number) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image") {
      img.handleX = x;
      img.handleY = y;
    }
  };

  imports.env.MidHandle = (imgId: number) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image") {
      img.handleX = img.width / 2;
      img.handleY = img.height / 2;
    }
  };

  imports.env.AutoMidHandle = (enabled: number) => {
    // No-op
  };

  imports.env.RotateImage = (imgId: number, angle: number) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image") {
      img.rotation = angle;
    }
  };

  imports.env.ScaleImage = (imgId: number, xs: number, ys: number) => {
    const img = graphics.images[imgId];
    if (img && img.type === "image") {
      img.scaleX = xs;
      img.scaleY = ys;
    }
  };

  imports.env.ResizeImage = (imgId: number, w: number, h: number) => {
    const img = graphics.images[imgId];
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
    const img = graphics.images[imgId];
    if (!img || img.type !== "image") return;
    const ctx = getBufferContext(imgId);
    if (!ctx) return;

    const rr = Math.max(0, Math.min(255, r | 0));
    const gg = Math.max(0, Math.min(255, g | 0));
    const bb = Math.max(0, Math.min(255, b | 0));

    try {
      const w = Math.max(1, ctx.canvas.width | 0);
      const h = Math.max(1, ctx.canvas.height | 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] === rr && d[i + 1] === gg && d[i + 2] === bb) {
          d[i + 3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      // Ensure future draws use the masked canvas (not the original HTMLImageElement).
      const blitzImg = img as any;
      if (blitzImg.canvas) {
        img.element = blitzImg.canvas;
        img.width = blitzImg.canvas.width;
        img.height = blitzImg.canvas.height;
        img.loaded = true;
      }
    } catch {
      // ignore (tainted canvas or unsupported)
    }
  };

  imports.env.FreeImage = (imgId: number) => {
    if (graphics.images[imgId]) {
      const img = graphics.images[imgId];
      try {
        if (img?.element && img.element instanceof HTMLImageElement) {
          img.element.onload = null;
          img.element.onerror = null;
          img.element.src = "";
        }
      } catch {}
      delete graphics.images[imgId];
    }
  };

  imports.env.Handle = (imgId: number) => {
    const img = graphics.images[imgId];
    if (img) {
      // Blitz3D exposes handleX/handleY; here we pack X in low 16 bits, Y in high 16 bits.
      return ((img.handleY & 0xffff) << 16) | (img.handleX & 0xffff);
    }
    return 0;
  };

  // Buffer accessors (used by SetBuffer/CopyRect/etc.)
  imports.env.BackBuffer = () => -1;
  imports.env.FrontBuffer = () => -1;
  imports.env.GraphicsBuffer = () => {
    const buf = (graphics as any).currentBuffer;
    // Default to back buffer (-1) if unset.
    if (typeof buf !== "number") return -1;
    return buf | 0;
  };
  imports.env.ScanLine = () => 0;
  imports.env.AvailVidMem = () => 1024 * 1024 * 512; // Mock 512MB
  imports.env.TotalVidMem = () => 1024 * 1024 * 512;
  imports.env.ImageBuffer = (imgId: number, frame: number) => imgId || -1;
  imports.env.TextureBuffer = (texId: number) => texId || -1;
  imports.env.SetBuffer = (bufferId: number) => {
    (graphics as any).currentBuffer = bufferId;
    if (graphics.core.ctx2d) {
      // Future: switch active context if bufferId is an image
    }
  };

  imports.env.LockBuffer = (bufferId: number) => {
    const key = normalizeBufferKey(bufferId);
    const ctx = getBufferContext(key);
    if (!ctx) return;
    try {
      const w = Math.max(1, ctx.canvas.width | 0);
      const h = Math.max(1, ctx.canvas.height | 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      lockedBuffers.set(key, { ctx, imgData, dirty: false });
    } catch {
      // ignore
    }
  };

  imports.env.UnlockBuffer = (bufferId: number) => {
    const key = normalizeBufferKey(bufferId);
    const lock = lockedBuffers.get(key);
    if (!lock) return;
    try {
      if (lock.dirty) lock.ctx.putImageData(lock.imgData, 0, 0);
    } catch {
      // ignore
    } finally {
      lockedBuffers.delete(key);
    }
  };

  imports.env.WritePixelFast = (
    x: number,
    y: number,
    color: number,
    bufferId: number,
  ) => {
    const key = normalizeBufferKey(bufferId);
    const lock = lockedBuffers.get(key);
    const ix = x | 0;
    const iy = y | 0;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    const a = ((color >>> 24) & 0xff) || 0xff;

    if (lock) {
      const w = lock.imgData.width | 0;
      const h = lock.imgData.height | 0;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return;
      const off = (iy * w + ix) * 4;
      const d = lock.imgData.data;
      d[off + 0] = r;
      d[off + 1] = g;
      d[off + 2] = b;
      d[off + 3] = a;
      lock.dirty = true;
      return;
    }

    const ctx = getBufferContext(key);
    if (!ctx) return;
    const imgData = ctx.createImageData(1, 1);
    imgData.data[0] = r;
    imgData.data[1] = g;
    imgData.data[2] = b;
    imgData.data[3] = a;
    ctx.putImageData(imgData, ix, iy);
  };

  imports.env.ReadPixelFast = (x: number, y: number, bufferId: number) => {
    const key = normalizeBufferKey(bufferId);
    const lock = lockedBuffers.get(key);
    const ix = x | 0;
    const iy = y | 0;

    if (lock) {
      const w = lock.imgData.width | 0;
      const h = lock.imgData.height | 0;
      if (ix < 0 || iy < 0 || ix >= w || iy >= h) return 0;
      const off = (iy * w + ix) * 4;
      const d = lock.imgData.data;
      return ((d[off + 3] || 0) << 24) | (d[off + 0] << 16) |
        (d[off + 1] << 8) |
        (d[off + 2] || 0);
    }

    const ctx = getBufferContext(key);
    if (!ctx) return 0;
    const data = ctx.getImageData(ix, iy, 1, 1).data;
    return ((data[3] || 0) << 24) | (data[0] << 16) | (data[1] << 8) | data[2];
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

  imports.env.js_ReadImagePixels = (imgId: number, bufferPtr: number) => {
    const img = graphics.images[imgId];
    if (!img || img.type !== "image") return;

    const ctx = getBufferContext(imgId);
    if (!ctx) return;

    const width = img.width || 1;
    const height = img.height || 1;
    const imageData = ctx.getImageData(0, 0, width, height);

    // Copy to WASM memory
    // bufferPtr points to Int32 array (ARGB)
    // imageData.data is Uint8ClampedArray (RGBA)

    if (graphics.core.memory) {
      const memView = new DataView(graphics.core.memory.buffer);
      // Verify bounds?

      for (let i = 0; i < width * height; i++) {
        const r = imageData.data[i * 4];
        const g = imageData.data[i * 4 + 1];
        const b = imageData.data[i * 4 + 2];
        const a = imageData.data[i * 4 + 3];

        // ARGB
        const argb = (a << 24) | (r << 16) | (g << 8) | b;
        memView.setInt32(bufferPtr + i * 4, argb, true); // Little endian
      }
    }
  };

  imports.env.js_WriteImagePixels = (imgId: number, bufferPtr: number) => {
    const img = graphics.images[imgId];
    if (!img || img.type !== "image") return;

    const ctx = getBufferContext(imgId);
    if (!ctx) return;

    const width = img.width || 1;
    const height = img.height || 1;
    // Create fresh ImageData
    const imageData = ctx.createImageData(width, height);

    if (graphics.core.memory) {
      const memView = new DataView(graphics.core.memory.buffer);

      for (let i = 0; i < width * height; i++) {
        const argb = memView.getInt32(bufferPtr + i * 4, true);

        const a = (argb >>> 24) & 0xFF; // Unsigned shift
        const r = (argb >> 16) & 0xFF;
        const g = (argb >> 8) & 0xFF;
        const b = argb & 0xFF;

        imageData.data[i * 4] = r;
        imageData.data[i * 4 + 1] = g;
        imageData.data[i * 4 + 2] = b;
        imageData.data[i * 4 + 3] = a;
      }
      ctx.putImageData(imageData, 0, 0);
    }
  };

  // --- Batch 2 Image Stubs ---
  if (!imports.blitz3d) imports.blitz3d = {};

  imports.blitz3d.LoadAnimImage = (
    path: number,
    w: number,
    h: number,
    first: number,
    count: number,
  ) => {
    // Fallback to LoadImage for now (single frame) or 0
    return imports.env.LoadImage(path);
  };
  imports.blitz3d.GrabImage = (img: number, x: number, y: number) => {};
  imports.blitz3d.TileBlock = (
    img: number,
    x: number,
    y: number,
    frame: number,
  ) => {
    imports.env.TileImage(img, x, y, frame);
  };

  imports.blitz3d.TFormImage = (img: number) => 0;
  imports.blitz3d.TFormFilter = (enabled: number) => {};
  imports.blitz3d.TextureFilter = (tex: number, flags: number) => {};

  // Collisions (Image-based 2D) - Stubs returning 0 (no collision)
  imports.blitz3d.ImageRectOverlap = (
    img: number,
    x: number,
    y: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ) => 0;
  imports.blitz3d.ImageRectCollide = (
    img: number,
    x: number,
    y: number,
    rx: number,
    ry: number,
    rw: number,
    rh: number,
  ) => 0;
  imports.blitz3d.RectsOverlap = (
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number,
  ) => 0;
  imports.blitz3d.ImagesOverlap = (
    img1: number,
    x1: number,
    y1: number,
    img2: number,
    x2: number,
    y2: number,
  ) => 0;
  imports.blitz3d.ImagesCollide = (
    img1: number,
    x1: number,
    y1: number,
    img2: number,
    x2: number,
    y2: number,
  ) => 0;

  imports.blitz3d.CopyRect = (
    sx: number,
    sy: number,
    w: number,
    h: number,
    dx: number,
    dy: number,
    srcBuf: number,
    destBuf: number,
  ) => {
    // Basic stub using CopyPixel loop if needed, or console warning
    // console.warn("CopyRect stub");
  };
}
