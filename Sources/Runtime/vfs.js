/**
 * Virtual File System
 *
 * Provides transparent file access to extracted game assets.
 * Maps game paths to browser fetch URLs.
 */

const VFS = {
  mountPoint: "/data/",
  basePath: "",
  files: new Map(),
  directories: new Map(),
  watchers: [],
  manifest: null,

  init(basePath = "assets/") {
    this.basePath = basePath;
    console.log(`VFS initialized with base: ${basePath}`);
  },

  async mount(path, data) {
    this.files.set(path, data);
    this._addToDirectory(path);
  },

  async loadManifest(url) {
    const response = await fetch(url);
    this.manifest = await response.json();
    console.log(`VFS loaded manifest: ${this.manifest.files.length} files`);
    console.log(`Embedded assets: ${this.manifest.embedAssets ? "yes" : "no"}`);
  },

  readFile(path) {
    if (this.files.has(path)) {
      return this.files.get(path);
    }
    return null;
  },

  readString(path) {
    const data = this.readFile(path);
    if (!data) return null;
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(data);
  },

  fileExists(path) {
    if (this.files.has(path)) return true;
    if (this.manifest && this.manifest.files) {
      return this.manifest.files.some((f) => f.path === path);
    }
    return false;
  },

  getFileSize(path) {
    const file = this.files.get(path);
    if (file) return file.byteLength;
    if (this.manifest && this.manifest.files) {
      const manifestFile = this.manifest.files.find((f) => f.path === path);
      if (manifestFile) return manifestFile.size;
    }
    return 0;
  },

  listFiles(dir = "") {
    const result = [];
    for (const [path] of this.files) {
      if (path.startsWith(dir)) {
        result.push(path);
      }
    }
    return result;
  },

  listDirectory(dir = "") {
    const result = new Set();
    for (const [path] of this.files) {
      if (path.startsWith(dir)) {
        const remaining = path.slice(dir.length).split("/");
        if (remaining.length > 1) {
          result.add(remaining[0]);
        }
      }
    }
    return Array.from(result);
  },

  _addToDirectory(path) {
    const parts = path.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      const dirPath = parts.slice(0, i + 1).join("/");
      if (!this.directories.has(dirPath)) {
        this.directories.set(dirPath, new Set());
      }
      this.directories.get(dirPath).add(parts[i + 1]);
    }
  },

  normalize(path) {
    return path.replace(/\\/g, "/").toLowerCase();
  },
};

window.VFS = VFS;
