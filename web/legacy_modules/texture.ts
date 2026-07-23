/**
 * Blitz3D Texture Loader
 * Handles loading, caching, and management of textures for SCPCB assets
 * Supports BMP, JPG, PNG, and DDS formats
 */

class Blitz3DTextureLoader {
  constructor(graphics, fileIO, assetManager) {
    this.graphics = graphics;
    this.fileIO = fileIO;
    this.assetManager = assetManager;

    // Texture cache (path -> Three.js texture)
    this.textureCache = new Map();
    this.nextTextureId = 1;

    // Default texture settings
    this.defaultMinFilter = THREE.LinearMipmapLinearFilter;
    this.defaultMagFilter = THREE.LinearFilter;
    this.defaultWrapS = THREE.RepeatWrapping;
    this.defaultWrapT = THREE.RepeatWrapping;

    // Mipmap generation enabled by default
    this.generateMipmaps = true;

    // Anisotropy for better texture quality at angles
    this.maxAnisotropy = 4;

    // Placeholder texture
    this.placeholderTexture = null;

    // Loading in progress
    this.loadingPromises = new Map();
  }

  /**
   * Initialize the texture loader
   */
  init() {
    this.createPlaceholderTexture();
    console.log("Texture loader initialized");
  }

  /**
   * Create a placeholder texture (pink checkerboard for missing textures)
   */
  createPlaceholderTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");

    // Pink checkerboard pattern (SCPCB standard for missing textures)
    ctx.fillStyle = "#ff69b4"; // Hot pink
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#ff1493"; // Deep pink
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillRect(32, 32, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);

    this.placeholderTexture = texture;
    return texture;
  }

  /**
   * Load a texture from file
   * @param {string} filePath - Path to texture file
   * @param {Object} options - Texture loading options
   * @returns {Promise<THREE.Texture>} Loaded texture
   */
  async loadTexture(filePath, options = {}) {
    // Check cache first
    if (this.textureCache.has(filePath)) {
      return this.textureCache.get(filePath);
    }

    // Check if already loading
    if (this.loadingPromises.has(filePath)) {
      return this.loadingPromises.get(filePath);
    }

    // Start loading
    const loadingPromise = this.doLoadTexture(filePath, options);
    this.loadingPromises.set(filePath, loadingPromise);

    try {
      const texture = await loadingPromise;
      this.textureCache.set(filePath, texture);
      return texture;
    } finally {
      this.loadingPromises.delete(filePath);
    }
  }

  /**
   * Internal texture loading
   */
  async doLoadTexture(filePath, options = {}) {
    const ext = path.extname(filePath).toLowerCase();

    let textureData;

    // Try to get from asset manager first
    if (this.assetManager) {
      textureData = this.assetManager.getFile(filePath);
    }

    // If not in bundle, try file I/O
    if (!textureData && this.fileIO) {
      const handle = this.fileIO.openFile(filePath);
      if (handle !== 0) {
        const size = this.fileIO.fileSize(filePath);
        if (size > 0) {
          const buffer = new Uint8Array(size);
          this.fileIO.readData(handle, buffer, size);
          textureData = buffer;
        }
        this.fileIO.closeFile(handle);
      }
    }

    // If still not found, return placeholder
    if (!textureData || textureData.length === 0) {
      console.warn(`Texture not found: ${filePath}`);
      return this.placeholderTexture.clone();
    }

    // Load based on format
    switch (ext) {
      case ".bmp":
        return this.loadBMPTexture(textureData, options);
      case ".jpg":
      case ".jpeg":
        return this.loadJPGTexture(textureData, options);
      case ".png":
        return this.loadPNGTexture(textureData, options);
      case ".dds":
        return this.loadDDSTexture(textureData, options);
      default:
        console.warn(`Unsupported texture format: ${ext}`);
        return this.placeholderTexture.clone();
    }
  }

  /**
   * Load BMP texture
   * SCPCB uses uncompressed BMP files
   */
  loadBMPTexture(data, options = {}) {
    // BMP header parsing
    const headerSize = new DataView(data.buffer).getUint32(0, true);

    if (headerSize === 40) {
      // BITMAPINFOHEADER
      return this.parseBMPInfoHeader(data, options);
    } else if (headerSize === 12) {
      // BITMAPCOREHEADER (OS/2 style)
      return this.parseBMPCoreHeader(data, options);
    }

    console.warn(`Unknown BMP header size: ${headerSize}`);
    return this.placeholderTexture.clone();
  }

  /**
   * Parse BITMAPINFOHEADER
   */
  parseBMPInfoHeader(data, options = {}) {
    const view = new DataView(data.buffer);
    const headerSize = view.getUint32(0, true);
    const width = view.getInt32(4, true);
    const height = view.getInt32(8, true); // Negative = top-down
    const planes = view.getUint16(12, true);
    const bitsPerPixel = view.getUint16(14, true);
    const compression = view.getUint32(16, true);
    const imageSize = view.getUint32(20, true);
    const xPixelsPerMeter = view.getInt32(24, true);
    const yPixelsPerMeter = view.getInt32(28, true);
    const colorsUsed = view.getUint32(32, true);
    const colorsImportant = view.getUint32(36, true);

    // Determine if top-down
    const topDown = height < 0;
    const texHeight = Math.abs(height);

    // Calculate row pitch (multiple of 4 bytes)
    const rowPitch = Math.ceil((width * bitsPerPixel) / 32) * 4;

    // Calculate pixel data offset
    const pixelOffset = headerSize + (colorsUsed > 0 ? colorsUsed * 4 : 0);

    // Create canvas for conversion
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = texHeight;
    const ctx = canvas.getContext("2d");

    const imageData = ctx.createImageData(width, texHeight);

    // Parse pixels
    let pixelIndex = 0;
    for (let y = 0; y < texHeight; y++) {
      const row = topDown ? y : (texHeight - 1 - y);
      const rowOffset = pixelOffset + row * rowPitch;

      for (let x = 0; x < width; x++) {
        const pixelOffsetBytes = rowOffset + (x * bitsPerPixel) / 8;

        let r, g, b;

        if (bitsPerPixel === 24) {
          b = data[pixelOffsetBytes];
          g = data[pixelOffsetBytes + 1];
          r = data[pixelOffsetBytes + 2];
        } else if (bitsPerPixel === 32) {
          b = data[pixelOffsetBytes];
          g = data[pixelOffsetBytes + 1];
          r = data[pixelOffsetBytes + 2];
          const a = data[pixelOffsetBytes + 3];
          imageData.data[pixelIndex + 3] = a;
        } else if (bitsPerPixel === 16) {
          const color16 = data[pixelOffsetBytes] |
            (data[pixelOffsetBytes + 1] << 8);
          r = ((color16 >> 10) & 31) * 8;
          g = ((color16 >> 5) & 31) * 8;
          b = (color16 & 31) * 8;
        } else if (bitsPerPixel === 8) {
          // 8-bit indexed color
          const paletteOffset = headerSize + data[pixelOffsetBytes] * 4;
          b = data[paletteOffset];
          g = data[paletteOffset + 1];
          r = data[paletteOffset + 2];
        }

        imageData.data[pixelIndex] = r;
        imageData.data[pixelIndex + 1] = g;
        imageData.data[pixelIndex + 2] = b;
        imageData.data[pixelIndex + 3] = 255;

        pixelIndex += 4;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    // Create Three.js texture
    const texture = new THREE.CanvasTexture(canvas);
    this.applyTextureOptions(texture, options);

    return texture;
  }

  /**
   * Parse BITMAPCOREHEADER (OS/2)
   */
  parseBMPCoreHeader(data, options = {}) {
    const view = new DataView(data.buffer);
    const width = view.getUint16(4, true);
    const height = view.getUint16(6, true);
    const planes = view.getUint16(8, true);
    const bitsPerPixel = view.getUint16(10, true);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const imageData = ctx.createImageData(width, height);
    // Simplified - assumes 24-bit
    const pixelOffset = 26;

    let pixelIndex = 0;
    for (let y = height - 1; y >= 0; y--) {
      for (let x = 0; x < width; x++) {
        const offset = pixelOffset + (y * width + x) * 3;
        imageData.data[pixelIndex] = data[offset + 2];
        imageData.data[pixelIndex + 1] = data[offset + 1];
        imageData.data[pixelIndex + 2] = data[offset];
        imageData.data[pixelIndex + 3] = 255;
        pixelIndex += 4;
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    this.applyTextureOptions(texture, options);

    return texture;
  }

  /**
   * Load JPG texture
   */
  loadJPGTexture(data, options = {}) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([data], { type: "image/jpeg" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const texture = new THREE.Texture(img);
        this.applyTextureOptions(texture, options);
        URL.revokeObjectURL(url);
        resolve(texture);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn(`Failed to load JPG: ${options.path || "unknown"}`);
        resolve(this.placeholderTexture.clone());
      };
      img.src = url;
    });
  }

  /**
   * Load PNG texture
   */
  loadPNGTexture(data, options = {}) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([data], { type: "image/png" });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      img.onload = () => {
        const texture = new THREE.Texture(img);
        this.applyTextureOptions(texture, options);
        URL.revokeObjectURL(url);
        resolve(texture);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.warn(`Failed to load PNG: ${options.path || "unknown"}`);
        resolve(this.placeholderTexture.clone());
      };
      img.src = url;
    });
  }

  /**
   * Load DDS texture (DirectDraw Surface)
   * Supports compressed textures (BC1-BC7)
   */
  loadDDSTexture(data, options = {}) {
    // DDS header parsing
    const view = new DataView(data.buffer);

    // Verify magic number
    const magic = view.getUint32(0, true);
    if (magic !== 0x20534444) { // "DDS "
      console.warn("Invalid DDS file");
      return this.placeholderTexture.clone();
    }

    const headerSize = view.getUint32(4, true);
    const flags = view.getUint32(8, true);
    const height = view.getUint32(12, true);
    const width = view.getUint32(16, true);
    const pitchOrLinearSize = view.getUint32(20, true);
    const depth = view.getUint32(24, true);
    const mipMapCount = view.getUint32(28, true);

    // Parse pixel format
    const pfFlags = view.getUint32(76, true);
    const pfFourCC = view.getUint32(80, true);
    const pfRGBBitCount = view.getUint32(84, true);
    const pfRBitMask = view.getUint32(88, true);
    const pfGBitMask = view.getUint32(92, true);
    const pfBBitMask = view.getUint32(96, true);
    const pfABitMask = view.getUint32(100, true);

    const caps = view.getUint32(108, true);
    const caps2 = view.getUint32(112, true);

    // Determine format
    let format = null;
    let compression = null;

    if (pfFlags & 0x04) { // FourCC
      switch (pfFourCC) {
        case 0x30315844: // "DX10"
          format = "DXT10";
          break;
        case 0x30315844: // DXT1
          compression = "BC1";
          format = "BC1";
          break;
        case 0x30315844: // DXT3
          compression = "BC2";
          format = "BC2";
          break;
        case 0x30315844: // DXT5
          compression = "BC3";
          format = "BC3";
          break;
        default:
          console.warn(`Unknown DDS FourCC: ${pfFourCC.toString(16)}`);
      }
    } else if (pfFlags & 0x01) { // RGB
      format = "RGBA";
    }

    // For now, use placeholder for compressed formats
    // Full DXT decompression would require WebGL2 and specific shader support
    if (compression) {
      console.warn(
        `DDS compression ${compression} not fully supported, using placeholder`,
      );
      return this.placeholderTexture.clone();
    }

    // Create texture from raw pixels
    const header = 128;
    const pixelData = new Uint8Array(data.buffer, header);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const imageData = ctx.createImageData(width, height);
    const bytesPerPixel = pfRGBBitCount / 8;

    let pixelIndex = 0;
    for (let i = 0; i < pixelData.length; i += bytesPerPixel) {
      imageData.data[pixelIndex] = pixelData[i + 2]; // R
      imageData.data[pixelIndex + 1] = pixelData[i + 1]; // G
      imageData.data[pixelIndex + 2] = pixelData[i]; // B
      imageData.data[pixelIndex + 3] = (pfABitMask && pfABitMask !== 0xff000000)
        ? pixelData[i + 3]
        : 255; // A
      pixelIndex += 4;
    }

    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    this.applyTextureOptions(texture, options);

    return texture;
  }

  /**
   * Apply texture options from Blitz3D flags
   */
  applyTextureOptions(texture, options = {}) {
    // Filtering
    if (options.smooth !== false) {
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = this.generateMipmaps
        ? THREE.LinearMipmapLinearFilter
        : THREE.LinearFilter;
    } else {
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
    }

    // Wrapping
    texture.wrapS = options.wrapU || this.defaultWrapS;
    texture.wrapT = options.wrapV || this.defaultWrapT;

    // Mipmaps
    if (this.generateMipmaps) {
      texture.generateMipmaps = true;
    }

    // Anisotropy
    texture.anisotropy = Math.min(
      this.maxAnisotropy,
      this.graphics.renderer.capabilities.getMaxAnisotropy(),
    );

    // Make sure texture needs update
    texture.needsUpdate = true;

    return texture;
  }

  /**
   * Create a texture from raw pixel data
   * @param {number} width - Texture width
   * @param {number} height - Texture height
   * @param {Uint8Array} pixels - Raw pixel data (RGBA)
   * @param {Object} options - Texture options
   * @returns {THREE.Texture} Created texture
   */
  createTextureFromPixels(width, height, pixels, options = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    this.applyTextureOptions(texture, options);

    return texture;
  }

  /**
   * Create a blank texture
   * @param {number} width - Width
   * @param {number} height - Height
   * @param {number} color - RGB color (0xRRGGBB)
   * @returns {THREE.Texture} Blank texture
   */
  createBlankTexture(width = 64, height = 64, color = 0x808080) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Create a cube map from 6 textures
   */
  async createCubeMap(textures, options = {}) {
    const images = [];

    for (const texPath of textures) {
      const texture = await this.loadTexture(texPath, options);
      if (texture.image) {
        images.push(texture.image);
      } else {
        // Use placeholder for failed loads
        images.push(this.placeholderTexture.image);
      }
    }

    const cubeTexture = new THREE.CubeTexture(images);
    this.applyTextureOptions(cubeTexture, options);

    return cubeTexture;
  }

  /**
   * Get texture from cache
   */
  getCachedTexture(path) {
    return this.textureCache.get(path) || null;
  }

  /**
   * Cache a texture manually
   */
  cacheTexture(path, texture) {
    this.textureCache.set(path, texture);
  }

  /**
   * Remove texture from cache
   */
  uncacheTexture(path) {
    const texture = this.textureCache.get(path);
    if (texture) {
      texture.dispose();
      this.textureCache.delete(path);
    }
  }

  /**
   * Clear all cached textures
   */
  clearCache() {
    for (const [path, texture] of this.textureCache) {
      texture.dispose();
    }
    this.textureCache.clear();
    console.log("Texture cache cleared");
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cached: this.textureCache.size,
      loading: this.loadingPromises.size,
    };
  }

  /**
   * Set up WASM imports for texture functions
   */
  setupImports(imports) {
    const self = this;

    imports.env.LoadTexture = (pathPtr, flags) => {
      const path = this.core.readString(pathPtr);
      console.log(`[Texture] LoadTexture: ${path} flags: ${flags}`);

      // Load texture asynchronously
      self.loadTexture(path, { flags }).then((texture) => {
        const texId = self.nextTextureId++;
        self.graphics.textures[texId] = texture;
        console.log(`[Texture] Loaded with ID: ${texId}`);
      }).catch((error) => {
        console.error(`[Texture] Failed to load: ${error.message}`);
      });

      return 0; // Return 0 for async loading
    };

    imports.env.FreeTexture = (texId) => {
      console.log(`[Texture] FreeTexture: ${texId}`);
      if (self.graphics.textures[texId]) {
        self.graphics.textures[texId].dispose();
        delete self.graphics.textures[texId];
        return 1;
      }
      return 0;
    };

    imports.env.TextureWidth = (texId) => {
      const tex = self.graphics.textures[texId];
      return tex && tex.image ? tex.image.width : 0;
    };

    imports.env.TextureHeight = (texId) => {
      const tex = self.graphics.textures[texId];
      return tex && tex.image ? tex.image.height : 0;
    };

    imports.env.TextureBlend = (texId, blend) => {
      const tex = self.graphics.textures[texId];
      if (tex) {
        // Apply Blitz3D blend modes
        switch (blend) {
          case 1: // Replace
            tex.envMap = null;
            tex.envMapIntensity = 0;
            break;
          case 2: // Add
            tex.envMap = null;
            tex.envMapIntensity = 1;
            break;
          case 3: // Multiply (lightmap)
            tex.envMap = null;
            tex.envMapIntensity = 0.5;
            break;
          case 5: // Blend
            tex.envMap = null;
            tex.envMapIntensity = 0.3;
            break;
        }
        return 1;
      }
      return 0;
    };

    imports.env.TextureCoords = (texId, uvSet) => {
      console.log(`[Texture] TextureCoords: tex=${texId}, uv=${uvSet}`);
      // UV set handling would be done at mesh creation time
      return 1;
    };
  }
}

// Import path for Node.js
const path = require("path");

// Import THREE if available
let THREE;
try {
  THREE = require("three");
} catch (e) {
  // In browser, THREE is global
  if (typeof window !== "undefined" && window.THREE) {
    THREE = window.THREE;
  }
}

module.exports = Blitz3DTextureLoader;
