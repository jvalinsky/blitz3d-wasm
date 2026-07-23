/**
 * Texture Loader — loads textures into WebGL2 without Three.js.
 *
 * Supports loading from URLs, raw byte arrays, and WASM pixel buffers.
 */

import type { GPUResources } from "./gpu_resources.ts";

/**
 * Load a texture from a URL into GPU resources.
 * Returns the GPU texture ID.
 */
export async function loadTextureFromURL(
  url: string,
  resources: GPUResources,
  flags?: number,
): Promise<number> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  const id = resources.createTexture(bitmap, flags);
  bitmap.close();
  return id;
}

/**
 * Load a texture from raw image bytes (PNG, JPEG, etc.) into GPU resources.
 * Returns the GPU texture ID.
 */
export async function loadTextureFromBytes(
  bytes: Uint8Array,
  resources: GPUResources,
  flags?: number,
): Promise<number> {
  const blob = new Blob([bytes]);
  const bitmap = await createImageBitmap(blob);
  const id = resources.createTexture(bitmap, flags);
  bitmap.close();
  return id;
}

/**
 * Create a texture from raw RGBA pixel data (Uint8Array, 4 bytes per pixel).
 * Returns the GPU texture ID.
 */
export function createTextureFromPixels(
  gl: WebGL2RenderingContext,
  resources: GPUResources,
  width: number,
  height: number,
  pixels: Uint8Array,
  flags?: number,
): number {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );

  const f = flags ?? 0;
  const mipmap = (f & 8) !== 0;
  const clampU = (f & 16) !== 0;
  const clampV = (f & 32) !== 0;

  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_S,
    clampU ? gl.CLAMP_TO_EDGE : gl.REPEAT,
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_T,
    clampV ? gl.CLAMP_TO_EDGE : gl.REPEAT,
  );

  if (mipmap) {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      gl.LINEAR_MIPMAP_LINEAR,
    );
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Use the internal GPUResources texture registration
  // We need to add this texture to the resources tracking.
  // Since GPUResources.createTexture only takes ImageBitmap, we register it directly.
  return resources.registerTexture(tex, width, height);
}

/**
 * Convert ARGB pixel buffer (from Blitz3D WritePixelFast) to RGBA.
 * Operates in-place or returns a new array.
 */
export function convertARGBtoRGBA(
  argb: Uint8Array,
  out?: Uint8Array,
): Uint8Array {
  const rgba = out ?? new Uint8Array(argb.length);
  for (let i = 0; i < argb.length; i += 4) {
    rgba[i] = argb[i + 1]; // R
    rgba[i + 1] = argb[i + 2]; // G
    rgba[i + 2] = argb[i + 3]; // B
    rgba[i + 3] = argb[i]; // A
  }
  return rgba;
}
