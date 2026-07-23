/**
 * Graphics API factory with feature detection
 * Selects WebGPU if available, falls back to WebGL 2
 */

/// <reference lib="dom" />

import type { GraphicsAPI } from "./graphics-api.ts";
import { WebGPUGraphics } from "./webgpu-graphics.ts";
import { WebGLGraphics } from "./webgl-graphics.ts";
import { GraphicsNotSupportedError } from "./graphics-api.ts";

/**
 * Create graphics API with automatic feature detection
 *
 * Tries WebGPU first (modern, performant), falls back to WebGL 2 (compatible).
 *
 * @param canvas - Canvas element to render to
 * @param forceWebGL - Force WebGL even if WebGPU is available (for testing)
 * @returns Initialized graphics API
 * @throws GraphicsNotSupportedError if no supported API found
 */
export async function createGraphicsAPI(
  canvas: HTMLCanvasElement,
  forceWebGL = false,
): Promise<GraphicsAPI> {
  // Try WebGPU first (if not forced to WebGL)
  if (!forceWebGL && "gpu" in navigator) {
    try {
      console.log("🔍 Attempting WebGPU initialization...");
      const api = new WebGPUGraphics();
      await api.initialize(canvas);

      const caps = api.getCapabilities();
      console.log(
        `✅ Using ${caps.apiName} (max texture: ${caps.maxTextureSize})`,
      );
      return api;
    } catch (e) {
      console.warn(
        "⚠️  WebGPU initialization failed, falling back to WebGL 2:",
        e,
      );
    }
  }

  // Fallback to WebGL 2
  try {
    console.log("🔍 Attempting WebGL 2 initialization...");
    const api = new WebGLGraphics();
    await api.initialize(canvas);

    const caps = api.getCapabilities();
    console.log(
      `✅ Using ${caps.apiName} (max texture: ${caps.maxTextureSize})`,
    );
    return api;
  } catch (e) {
    console.error("❌ WebGL 2 initialization failed:", e);
    throw new GraphicsNotSupportedError("No supported graphics API");
  }
}

/**
 * Check if WebGPU is supported
 */
export function isWebGPUSupported(): boolean {
  return "gpu" in navigator;
}

/**
 * Check if WebGL 2 is supported
 */
export function isWebGL2Supported(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    return gl !== null;
  } catch {
    return false;
  }
}

/**
 * Get graphics capabilities without creating full API
 * Useful for feature detection in menus
 */
export async function getGraphicsInfo(): Promise<{
  webgpuSupported: boolean;
  webgl2Supported: boolean;
  preferredAPI: "WebGPU" | "WebGL2" | "None";
}> {
  const webgpuSupported = isWebGPUSupported();
  const webgl2Supported = isWebGL2Supported();

  let preferredAPI: "WebGPU" | "WebGL2" | "None";

  if (webgpuSupported) {
    // Double-check WebGPU actually works
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      if (adapter) {
        preferredAPI = "WebGPU";
      } else {
        preferredAPI = webgl2Supported ? "WebGL2" : "None";
      }
    } catch {
      preferredAPI = webgl2Supported ? "WebGL2" : "None";
    }
  } else if (webgl2Supported) {
    preferredAPI = "WebGL2";
  } else {
    preferredAPI = "None";
  }

  return {
    webgpuSupported,
    webgl2Supported,
    preferredAPI,
  };
}
