/**
 * Blitz3D Asset Bundle Manager
 * Handles packaging, loading, and caching of game assets
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

class Blitz3DAssetManager {
  constructor(fileIO) {
    this.fileIO = fileIO;
    this.cache = new Map();
    this.textureCache = new Map();
    this.meshCache = new Map();
    this.bundle = null;
    this.basePath = "";
    this.compressionEnabled = true;
    this.maxCacheSize = 100; // Maximum cached assets
  }

  /**
   * Initialize asset manager
   * @param {string} basePath - Base path for assets
   * @param {Object} options - Configuration options
   */
  init(basePath = "", options = {}) {
    this.basePath = basePath;
    this.compressionEnabled = options.compression !== false;
    console.log(`Asset Manager initialized at: ${basePath}`);
  }

  /**
   * Create an asset bundle from a directory
   * @param {string} sourceDir - Source directory
   * @param {string} outputFile - Output bundle file path
   * @param {Object} options - Bundle options
   */
  async createBundle(sourceDir, outputFile, options = {}) {
    const files = [];
    const extensions = options.extensions ||
      [".rmesh", ".bmp", ".jpg", ".png", ".b3d", ".wav", ".ogg"];

    // Walk directory
    const walkDir = (dir, base = "") => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relPath = path.join(base, item);

        if (fs.statSync(fullPath).isDirectory()) {
          walkDir(fullPath, relPath);
        } else if (extensions.some((ext) => item.toLowerCase().endsWith(ext))) {
          const stats = fs.statSync(fullPath);
          files.push({
            path: relPath,
            size: stats.size,
            mtime: stats.mtime.toISOString(),
          });
        }
      }
    };

    walkDir(sourceDir);
    console.log(`Found ${files.length} files to bundle`);

    // Read file contents
    for (const file of files) {
      const fullPath = path.join(sourceDir, file.path);
      let data = fs.readFileSync(fullPath);

      // Optionally compress
      if (this.compressionEnabled && file.size > 1024) {
        data = zlib.inflateSync(data);
      }

      file.data = Array.from(data);
      file.compressed = this.compressionEnabled;
    }

    // Create bundle
    this.bundle = {
      version: "1.0",
      created: new Date().toISOString(),
      basePath: sourceDir,
      fileCount: files.length,
      files: files.map((f) => ({
        path: f.path,
        size: f.size,
        compressed: f.compressed,
        mtime: f.mtime,
        data: f.data,
      })),
    };

    // Write bundle
    const bundleData = JSON.stringify(this.bundle);
    fs.writeFileSync(outputFile, bundleData);
    console.log(`Asset bundle created: ${outputFile} (${files.length} files)`);

    return this.bundle;
  }

  /**
   * Load an asset bundle from file
   * @param {string} bundlePath - Path to bundle file
   * @returns {boolean} Success status
   */
  async loadBundle(bundlePath) {
    try {
      const data = fs.readFileSync(bundlePath);
      this.bundle = JSON.parse(data.toString());
      console.log(`Loaded asset bundle: ${this.bundle.fileCount} files`);

      // Register files with file I/O system
      if (this.fileIO) {
        for (const file of this.bundle.files) {
          this.fileIO.registerFile(file.path, new Uint8Array(file.data));
        }
      }

      return true;
    } catch (error) {
      console.error(`Failed to load bundle: ${error.message}`);
      return false;
    }
  }

  /**
   * Get a file from the bundle
   * @param {string} filePath - Path to file
   * @returns {Uint8Array|null} File data or null
   */
  getFile(filePath) {
    if (!this.bundle) return null;

    const file = this.bundle.files.find((f) => f.path === filePath);
    if (!file) return null;

    let data = new Uint8Array(file.data);

    // Decompress if needed
    if (file.compressed) {
      data = zlib.deflateSync(data);
    }

    return data;
  }

  /**
   * Cache an asset
   * @param {string} key - Cache key
   * @param {*} asset - Asset to cache
   * @param {string} type - Asset type ('texture', 'mesh', etc.)
   */
  cacheAsset(key, asset, type = "generic") {
    // Evict oldest if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.evictAsset(oldestKey);
    }

    this.cache.set(key, {
      asset,
      type,
      timestamp: Date.now(),
    });

    // Type-specific caching
    if (type === "texture" && asset instanceof HTMLImageElement) {
      this.textureCache.set(key, asset);
    } else if (type === "mesh") {
      this.meshCache.set(key, asset);
    }
  }

  /**
   * Get a cached asset
   * @param {string} key - Cache key
   * @returns {*} Cached asset or null
   */
  getCachedAsset(key) {
    const entry = this.cache.get(key);
    if (entry) {
      entry.timestamp = Date.now(); // Update access time
      return entry.asset;
    }
    return null;
  }

  /**
   * Evict an asset from cache
   * @param {string} key - Cache key to evict
   */
  evictAsset(key) {
    const entry = this.cache.get(key);
    if (entry) {
      // Type-specific cleanup
      if (entry.type === "texture" && entry.asset instanceof HTMLImageElement) {
        this.textureCache.delete(key);
      } else if (entry.type === "mesh") {
        this.meshCache.delete(key);
      }

      this.cache.delete(key);
    }
  }

  /**
   * Clear all caches
   */
  clearCache() {
    for (const [key, entry] of this.cache) {
      if (entry.type === "texture" && entry.asset instanceof HTMLImageElement) {
        // Allow texture garbage collection
      }
    }
    this.cache.clear();
    this.textureCache.clear();
    this.meshCache.clear();
    console.log("Asset cache cleared");
  }

  /**
   * Load a texture from asset bundle
   * @param {string} texturePath - Path to texture file
   * @returns {HTMLImageElement|null} Loaded texture or null
   */
  async loadTexture(texturePath) {
    // Check cache first
    if (this.textureCache.has(texturePath)) {
      return this.textureCache.get(texturePath);
    }

    // Get file data
    const fileData = this.getFile(texturePath);
    if (!fileData) {
      console.warn(`Texture not found: ${texturePath}`);
      return null;
    }

    // Create image from data
    const blob = new Blob([fileData], { type: this.getMimeType(texturePath) });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cacheAsset(texturePath, img, "texture");
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        console.error(`Failed to load texture: ${texturePath}`);
        resolve(null);
      };
      img.src = url;
    });
  }

  /**
   * Get MIME type for file extension
   * @param {string} filePath - File path
   * @returns {string} MIME type
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".bmp": "image/bmp",
      ".webp": "image/webp",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".mp3": "audio/mpeg",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }

  /**
   * Preload multiple assets
   * @param {Array<string>} assetPaths - Paths to assets
   * @param {Function} progressCallback - Progress callback
   */
  async preloadAssets(assetPaths, progressCallback = null) {
    let loaded = 0;
    const total = assetPaths.length;

    for (const assetPath of assetPaths) {
      const ext = path.extname(assetPath).toLowerCase();

      if ([".png", ".jpg", ".jpeg", ".bmp", ".gif"].includes(ext)) {
        await this.loadTexture(assetPath);
      } else {
        // Just cache the raw data
        const data = this.getFile(assetPath);
        if (data) {
          this.cacheAsset(assetPath, data, "data");
        }
      }

      loaded++;
      if (progressCallback) {
        progressCallback(loaded / total, assetPath);
      }
    }

    console.log(`Preloaded ${loaded}/${total} assets`);
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getCacheStats() {
    return {
      totalCached: this.cache.size,
      textures: this.textureCache.size,
      meshes: this.meshCache.size,
      maxSize: this.maxCacheSize,
    };
  }

  /**
   * List all files in bundle
   * @param {string} filter - Optional extension filter
   * @returns {Array<string>} List of file paths
   */
  listFiles(filter = null) {
    if (!this.bundle) return [];

    if (filter) {
      return this.bundle.files
        .filter((f) => f.path.toLowerCase().endsWith(filter.toLowerCase()))
        .map((f) => f.path);
    }

    return this.bundle.files.map((f) => f.path);
  }

  /**
   * Find files matching a pattern
   * @param {RegExp} pattern - Pattern to match
   * @returns {Array<string>} Matching file paths
   */
  findFiles(pattern) {
    if (!this.bundle) return [];

    return this.bundle.files
      .filter((f) => pattern.test(f.path))
      .map((f) => f.path);
  }
}

module.exports = Blitz3DAssetManager;
