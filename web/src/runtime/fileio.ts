/**
 * Blitz3D Runtime File I/O Module
 * Handles file reading, virtual file system, and asset bundling
 */

type AssetManifestEntry = {
  path: string;
  url?: string;
  size?: number;
  group?: string;
};

type AssetManifest = {
  basePath?: string;
  groups?: Record<string, string[]>;
  files?: AssetManifestEntry[];
};

type PreloadOptions = {
  concurrency?: number;
  onProgress?: (loaded: number, total: number | null, file?: string) => void;
};

// Browser shim for path
const path = {
  join: (...args: string[]) => args.join("/").replace(/\/+/g, "/"),
  dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
};

export class Blitz3DFileIO {
  [key: string]: any;
  constructor(core) {
    this.core = core;
    this.fileSystem = new Map();
    this._fileSystemByLower = new Map();
    this.openFiles = new Map();
    this.nextFileHandle = 1;
    this.assetBundle = null;
    this.assetManifest = null;
    this.pendingLoads = new Map();
    this.basePath = "";
    this.syncFetchEnabled = false;
    this._manifestByPath = null;
    this._manifestByPathLower = null;
    this._missingCounts = new Map();
    this._missingLastLogMs = new Map();
    this._missingGlobalLastMs = 0;
  }

  /**
   * Initialize the file I/O system with optional asset bundle
   * @param {string} basePath - Base path for asset files
   * @param {Object} assetBundle - Optional pre-loaded asset bundle
   */
  init(
    basePath = "",
    assetBundle = null,
    assetManifest: AssetManifest | null = null,
  ) {
    this.basePath = basePath;
    this.assetBundle = assetBundle;
    this.assetManifest = assetManifest;
    this._rebuildManifestIndex();
    console.log(`File I/O initialized with base path: ${basePath}`);

    if (assetBundle) {
      console.log(
        `Asset bundle loaded with ${assetBundle.fileCount || 0} files`,
      );
    }

    if (assetManifest) {
      console.log(
        `Asset manifest loaded with ${assetManifest.files?.length ?? 0} files`,
      );
    }
  }

  /**
   * Load an asset bundle from a JSON or binary file
   * @param {string} bundlePath - Path to the asset bundle
   */
  async loadAssetBundle(bundlePath: string) {
    try {
      const response = await fetch(bundlePath);
      const data = await response.json();
      this.assetBundle = data;
      console.log(
        `Asset bundle loaded: ${this.assetBundle.files.length} files`,
      );
      return true;
    } catch (error: any) {
      console.error(`Failed to load asset bundle: ${error.message}`);
      return false;
    }
  }

  async loadAssetManifest(manifestPath: string) {
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = (await response.json()) as AssetManifest;
      this.assetManifest = data;
      if (data.basePath) {
        this.basePath = data.basePath;
      }
      this._rebuildManifestIndex();
      console.log(`Asset manifest loaded: ${data.files?.length ?? 0} files`);
      return true;
    } catch (error: any) {
      console.error(`Failed to load asset manifest: ${error.message}`);
      return false;
    }
  }

  _rebuildManifestIndex() {
    const files = this.assetManifest?.files;
    if (!files || !Array.isArray(files)) {
      this._manifestByPath = null;
      this._manifestByPathLower = null;
      return;
    }
    const map = new Map<string, AssetManifestEntry>();
    const mapLower = new Map<string, AssetManifestEntry>();
    for (const entry of files) {
      if (!entry?.path) continue;
      const p = this.resolvePath(entry.path);
      map.set(p, entry);
      mapLower.set(p.toLowerCase(), entry);
    }
    this._manifestByPath = map;
    this._manifestByPathLower = mapLower;
  }

  _getManifestEntry(resolvedPath: string): AssetManifestEntry | null {
    if (this._manifestByPath instanceof Map) {
      return this._manifestByPath.get(resolvedPath) ??
        (this._manifestByPathLower instanceof Map
          ? (this._manifestByPathLower.get(resolvedPath.toLowerCase()) ?? null)
          : null);
    }
    if (this.assetManifest?.files) {
      return this.assetManifest.files.find((file) => file.path === resolvedPath) ??
        null;
    }
    return null;
  }

  _logMissing(resolvedPath: string, context: string) {
    const now = performance.now();
    const prev = this._missingLastLogMs.get(resolvedPath) ?? 0;
    const count = (this._missingCounts.get(resolvedPath) ?? 0) + 1;
    this._missingCounts.set(resolvedPath, count);

    (globalThis as any).__SCPCB_LAST_FILE_REQ = resolvedPath;

    // Throttle per-path logs to avoid a log storm in tight loops.
    if (count === 1 || now - prev > 500) {
      this._missingLastLogMs.set(resolvedPath, now);
      console.warn(`[FileIO] ${context}: ${resolvedPath} (count=${count})`);
    } else if (now - (this._missingGlobalLastMs ?? 0) > 1500) {
      this._missingGlobalLastMs = now;
      console.warn(`[FileIO] still waiting on: ${resolvedPath}`);
    }
  }

  _syncFetchAndRegister(entry: AssetManifestEntry, resolvedPath: string) {
    if (!this.syncFetchEnabled) return false;
    if (!entry) return false;
    if (this.fileSystem.has(resolvedPath)) return true;
    if (this.pendingLoads.has(resolvedPath)) return false;

    const url = entry.url ?? path.join(this.basePath, entry.path);
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.responseType = "arraybuffer";
      xhr.send(null);
      if (xhr.status >= 200 && xhr.status < 300 && xhr.response) {
        const buf = new Uint8Array(xhr.response as ArrayBuffer);
        this.registerFile(resolvedPath, buf);
        return true;
      }
      console.warn(
        `[FileIO] sync fetch failed: ${resolvedPath} (HTTP ${xhr.status})`,
      );
    } catch (e) {
      console.warn(`[FileIO] sync fetch error: ${resolvedPath}`, e);
    }
    return false;
  }

  _queueAsyncFetch(entry: AssetManifestEntry, resolvedPath: string) {
    if (!entry) return;
    if (this.fileSystem.has(resolvedPath)) return;
    if (this.pendingLoads.has(resolvedPath)) return;
    this.fetchAndRegister(entry).catch((error) => {
      console.error(`Failed to fetch asset ${resolvedPath}:`, error);
    });
  }

  async preloadAssetGroup(group: string, options: PreloadOptions = {}) {
    if (!this.assetManifest?.groups || !this.assetManifest.files) {
      console.warn("No asset manifest groups available");
      return false;
    }

    const files = this.assetManifest.groups[group];
    if (!files) {
      console.warn(`Asset group not found: ${group}`);
      return false;
    }

    const manifestFiles = new Map(
      this.assetManifest.files.map((file) => [file.path, file]),
    );
    const list = files.map((path) => manifestFiles.get(path)).filter(
      Boolean,
    ) as AssetManifestEntry[];

    await this.preloadFiles(list, options);
    return true;
  }

  async preloadFiles(
    files: AssetManifestEntry[],
    options: PreloadOptions = {},
  ) {
    const concurrency = options.concurrency ?? 4;
    let completed = 0;
    const total = files.length;
    const queue = [...files];

    const pump = async () => {
      while (queue.length) {
        const entry = queue.shift();
        if (!entry) return;
        try {
          (globalThis as any).__SCPCB_INIT_FILE = entry.path;
        } catch {}
        // IMPORTANT: for group preloads, we want progress in *files*, not per-network-chunk bytes.
        // Passing the callback into `fetchAndRegister` can generate a huge volume of progress events
        // (and in debug mode, a lot of DOM/log work). Keep it simple: emit one progress event per file.
        await this.fetchAndRegister(entry);
        completed += 1;
        if (options.onProgress) {
          options.onProgress(completed, total, entry.path);
        }
        try {
          (globalThis as any).__SCPCB_ASSET_PRELOAD = {
            loaded: completed,
            total,
            file: entry.path,
          };
        } catch {}
        // Yield to event loop to keep UI responsive
        await new Promise((r) => setTimeout(r, 0));
      }
    };

    await Promise.all(new Array(concurrency).fill(0).map(() => pump()));
  }

  async fetchAndRegister(
    entry: AssetManifestEntry,
    onProgress?: (loaded: number, total: number | null, file?: string) => void,
  ) {
    const resolvedPath = this.resolvePath(entry.path);
    if (this.fileSystem.has(resolvedPath)) {
      return;
    }

    const url = entry.url ?? path.join(this.basePath, entry.path);
    if (this.pendingLoads.has(resolvedPath)) {
      await this.pendingLoads.get(resolvedPath);
      return;
    }

    const loadPromise = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const totalHint = (typeof entry.size === "number" && entry.size > 0)
        ? entry.size
        : (() => {
          const contentLength = response.headers.get("Content-Length");
          return contentLength ? Number(contentLength) : null;
        })();

      // Fast path for small files (INI/config/etc): avoid streaming loops which can
      // generate many tiny chunks and trip Firefox's long-task watchdog.
      if ((totalHint ?? 0) > 0 && (totalHint as number) <= 1024 * 1024) {
        try {
          (globalThis as any).__SCPCB_FETCH_STATUS = {
            file: resolvedPath,
            loaded: 0,
            total: totalHint,
          };
        } catch {}

        const buffer = new Uint8Array(await response.arrayBuffer());
        try {
          (globalThis as any).__SCPCB_FETCH_STATUS = {
            file: resolvedPath,
            loaded: buffer.byteLength,
            total: totalHint,
          };
        } catch {}
        if (onProgress) onProgress(buffer.byteLength, totalHint, resolvedPath);
        this.registerFile(resolvedPath, buffer);
        // Yield once after registering to keep UI responsive.
        await new Promise((r) => setTimeout(r, 0));
        return;
      }

      if (!response.body) {
        const buffer = new Uint8Array(await response.arrayBuffer());
        this.registerFile(resolvedPath, buffer);
        return;
      }

      const reader = response.body.getReader();
      const total = totalHint;
      let loaded = 0;
      const chunks: Uint8Array[] = [];
      let lastYield = performance.now();
      let lastYieldLoaded = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (onProgress) onProgress(loaded, total, resolvedPath);
          try {
            (globalThis as any).__SCPCB_FETCH_STATUS = {
              file: resolvedPath,
              loaded,
              total,
            };
          } catch {}
          // Yield occasionally to keep the browser responsive (Firefox can otherwise warn/kill).
          const now = performance.now();
          if (loaded - lastYieldLoaded >= 256 * 1024 || now - lastYield >= 16) {
            lastYield = now;
            lastYieldLoaded = loaded;
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      const buffer = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }

      this.registerFile(resolvedPath, buffer);
    })();

    this.pendingLoads.set(resolvedPath, loadPromise);
    try {
      await loadPromise;
    } finally {
      this.pendingLoads.delete(resolvedPath);
    }
  }

  /**
   * Register a file in the virtual file system
   * @param {string} filePath - Virtual file path
   * @param {Uint8Array} data - File contents
   */
  registerFile(filePath, data) {
    const resolvedPath = this.resolvePath(filePath);
    this.fileSystem.set(resolvedPath, {
      data: data,
      size: data.length,
      position: 0,
    });
    this._fileSystemByLower.set(resolvedPath.toLowerCase(), resolvedPath);
    // Asset preloads can register thousands of files; per-file logging can freeze the tab,
    // especially when `?debug` mirrors logs into the DOM. Keep this low-noise.
    this._registeredCount = (this._registeredCount ?? 0) + 1;
    const n = this._registeredCount as number;
    if (n <= 50 || (n <= 500 && n % 50 === 0) || n % 500 === 0) {
      console.log(`Registered file: ${resolvedPath} (${data.length} bytes)`);
    }
  }

  /**
   * Register a directory of files
   * @param {string} dirPath - Directory path
   * @param {Array<string>} extensions - File extensions to include
   */
  /**
   * Register a directory of files (Stubbed for Web)
   * @param {string} dirPath - Directory path
   * @param {Array<string>} extensions - File extensions to include
   */
  registerDirectory(
    dirPath: string,
    // Track B: prefer packed assets; avoid encouraging source model formats in the web build.
    extensions = [".smpk", ".png", ".jpg", ".jpeg", ".bmp", ".ogg", ".wav"],
  ) {
    console.warn("registerDirectory is not supported in browser environment");
  }

  /**
   * Open a file and return a file handle
   * @param {string} filePath - Path to the file
   * @returns {number} File handle (0 on failure)
   */
  _rewriteSourceModelPath(resolvedPath: string) {
    return resolvedPath.replace(/\.(b3d|x|rmesh)$/i, ".smpk");
  }

  _openFileCandidates(filePath: string) {
    const rp = this.resolvePath(filePath);
    const rpLower = rp.toLowerCase();
    const rewritten = this._rewriteSourceModelPath(rp);

    const out: string[] = [];
    const seen = new Set<string>();
    const push = (p: string) => {
      const r = this.resolvePath(p);
      if (!r) return;
      const k = r.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(r);
    };

    push(rp);
    if (rewritten !== rp) push(rewritten);

    if (!rpLower.startsWith("assets/")) {
      push(`assets/${rp}`);
      if (rewritten !== rp) push(`assets/${rewritten}`);
    } else {
      const stripped = rp.slice("assets/".length);
      push(stripped);
      const strippedRewritten = this._rewriteSourceModelPath(stripped);
      if (strippedRewritten !== stripped) push(strippedRewritten);
    }

    // Dev convenience: some older manifests/servers place Data/* at root.
    if (rpLower.startsWith("data/")) {
      const stripped = rp.slice("data/".length);
      push(stripped);
      const strippedRewritten = this._rewriteSourceModelPath(stripped);
      if (strippedRewritten !== stripped) push(strippedRewritten);
      if (!rpLower.startsWith("assets/")) {
        push(`assets/${stripped}`);
        if (strippedRewritten !== stripped) push(`assets/${strippedRewritten}`);
      }
    }

    return out;
  }

  openFile(filePath) {
    const candidates = this._openFileCandidates(filePath);

    for (const resolvedPath of candidates) {
      const vfsKey = this._fileSystemByLower.get(resolvedPath.toLowerCase()) ?? resolvedPath;
      // Check virtual file system first
      if (this.fileSystem.has(vfsKey)) {
        const file = this.fileSystem.get(vfsKey);
        file.position = 0;
        const handle = this.nextFileHandle++;
        this.openFiles.set(handle, {
          ...file,
          path: vfsKey,
          eof: false,
        });
        console.log(`Opened file from VFS: ${vfsKey} (handle: ${handle})`);
        return handle;
      }

      // Check asset bundle
      if (this.assetBundle && this.assetBundle.files) {
        const bundleFile = this.assetBundle.files.find((f) =>
          f.path === resolvedPath
        );
        if (bundleFile) {
          const handle = this.nextFileHandle++;
          this.openFiles.set(handle, {
            data: new Uint8Array(bundleFile.data),
            size: bundleFile.size,
            position: 0,
            path: resolvedPath,
            eof: false,
          });
          console.log(
            `Opened file from bundle: ${resolvedPath} (handle: ${handle})`,
          );
          return handle;
        }
      }

      // Try manifest-driven fetch on demand
      const entry = this._getManifestEntry(resolvedPath);
      if (entry) {
        if (this._syncFetchAndRegister(entry, resolvedPath)) {
          return this.openFile(resolvedPath);
        }
        this._logMissing(resolvedPath, "ReadFile requested missing asset");
        this._queueAsyncFetch(entry, resolvedPath);
        return 0;
      }
    }

    // Try to read from disk directly (Node.js only)
    console.warn(`File not found: ${candidates[0] ?? this.resolvePath(filePath)}`);
    return 0;
  }

  /**
   * Close a file handle
   * @param {number} handle - File handle
   */
  closeFile(handle) {
    if (this.openFiles.has(handle)) {
      this.openFiles.delete(handle);
      console.log(`Closed file handle: ${handle}`);
    }
  }

  /**
   * Read a byte from a file
   * @param {number} handle - File handle
   * @returns {number} Byte value (0-255), -1 on EOF
   */
  readByte(handle) {
    const file = this.openFiles.get(handle);
    if (!file || file.position >= file.size) {
      file.eof = true;
      return -1;
    }
    return file.data[file.position++];
  }

  /**
   * Read a signed byte from a file
   * @param {number} handle - File handle
   * @returns {number} Signed byte value (-128 to 127)
   */
  readSignedByte(handle) {
    const byte = this.readByte(handle);
    return byte > 127 ? byte - 256 : byte;
  }

  /**
   * Read a short (16-bit integer) from a file
   * @param {number} handle - File handle
   * @returns {number} Short value
   */
  readShort(handle) {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    if (b1 < 0 || b2 < 0) return 0;
    return b1 | (b2 << 8);
  }

  /**
   * Read an unsigned short from a file
   * @param {number} handle - File handle
   * @returns {number} Unsigned short value
   */
  readUShort(handle) {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    if (b1 < 0 || b2 < 0) return 0;
    return (b1 & 0xFF) | ((b2 & 0xFF) << 8);
  }

  /**
   * Read a 32-bit integer from a file
   * @param {number} handle - File handle
   * @returns {number} Integer value
   */
  readInt(handle) {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    const b3 = this.readByte(handle);
    const b4 = this.readByte(handle);

    if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) {
      return 0;
    }

    // Little-endian
    return b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
  }

  /**
   * Read a 32-bit unsigned integer from a file
   * @param {number} handle - File handle
   * @returns {number} Unsigned integer value
   */
  readUInt(handle) {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    const b3 = this.readByte(handle);
    const b4 = this.readByte(handle);

    if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) {
      return 0;
    }

    return (b1 & 0xFF) | ((b2 & 0xFF) << 8) | ((b3 & 0xFF) << 16) |
      ((b4 & 0xFF) << 24);
  }

  /**
   * Read a 64-bit floating point number from a file
   * @param {number} handle - File handle
   * @returns {number} Double precision float
   */
  readDouble(handle) {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      bytes[i] = this.readByte(handle);
      if (bytes[i] < 0) return 0;
    }

    // Little-endian double
    const view = new DataView(bytes.buffer);
    return view.getFloat64(0, true);
  }

  /**
   * Read a 32-bit floating point number from a file
   * @param {number} handle - File handle
   * @returns {number} Single precision float
   */
  readFloat(handle) {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    const b3 = this.readByte(handle);
    const b4 = this.readByte(handle);

    if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) {
      return 0.0;
    }

    // Little-endian float - create bytes array and use DataView
    const bytes = new Uint8Array([b1, b2, b3, b4]);
    const view = new DataView(bytes.buffer);
    return view.getFloat32(0, true); // true = little-endian
  }

  /**
   * Read a null-terminated string from a file
   * @param {number} handle - File handle
   * @returns {number} Pointer to string in WASM memory (0 on failure)
   */
  readString(handle) {
    const file = this.openFiles.get(handle);
    if (!file) return 0;

    let str = "";
    let bytesRead = 0;
    const maxStringLen = 65536; // 64KB max string length

    while (file.position < file.size && bytesRead < maxStringLen) {
      const byte = this.readByte(handle);
      if (byte < 0) break;
      if (byte === 0) break;
      str += String.fromCharCode(byte);
      bytesRead++;
    }

    if (bytesRead >= maxStringLen) {
      console.warn(`String too long in file: ${file.path}`);
    }

    // Allocate string in WASM memory and return pointer
    if (this.core && this.core.allocString) {
      return this.core.allocString(str);
    }

    console.error("Cannot allocate string: allocString not available");
    return 0;
  }

  /**
   * Read a Pascal-style string (length byte followed by data)
   * @param {number} handle - File handle
   * @returns {number} Pointer to string in WASM memory
   */
  readPString(handle) {
    const length = this.readByte(handle);
    if (length < 0) return 0;

    let str = "";
    for (let i = 0; i < length && !this.eof(handle); i++) {
      const byte = this.readByte(handle);
      if (byte < 0) break;
      str += String.fromCharCode(byte);
    }

    if (this.core && this.core.allocString) {
      return this.core.allocString(str);
    }
    return 0;
  }

  /**
   * Read a 32-bit integer length-prefixed string
   * @param {number} handle - File handle
   * @returns {number} Pointer to string in WASM memory
   */
  readLString(handle) {
    const length = this.readInt(handle);
    if (length <= 0) return 0;

    let str = "";
    for (let i = 0; i < length && !this.eof(handle); i++) {
      const byte = this.readByte(handle);
      if (byte < 0) break;
      str += String.fromCharCode(byte);
    }

    if (this.core && this.core.allocString) {
      return this.core.allocString(str);
    }
    return 0;
  }

  /**
   * Read raw data into a buffer
   * @param {number} handle - File handle
   * @param {number} bufferPtr - Pointer to WASM memory buffer
   * @param {number} count - Number of bytes to read
   * @returns {number} Number of bytes actually read
   */
  readData(handle, bufferPtr, count) {
    const file = this.openFiles.get(handle);
    if (!file) return 0;

    const bytesToRead = Math.min(count, file.size - file.position);
    if (bytesToRead <= 0) return 0;

    // Write directly to WASM memory
    const memory = new Uint8Array(this.core.memory.buffer);
    for (let i = 0; i < bytesToRead; i++) {
      memory[bufferPtr + i] = file.data[file.position + i];
    }

    file.position += bytesToRead;
    return bytesToRead;
  }

  /**
   * Check if end of file reached
   * @param {number} handle - File handle
   * @returns {number} 1 if EOF, 0 otherwise
   */
  eof(handle) {
    const file = this.openFiles.get(handle);
    if (!file) return 1;
    return file.position >= file.size ? 1 : 0;
  }

  /**
   * Get file size
   * @param {string} filePath - File path
   * @returns {number} File size in bytes (0 if not found)
   */
  fileSize(filePath) {
    const resolvedPath = this.resolvePath(filePath);

    if (this.fileSystem.has(resolvedPath)) {
      return this.fileSystem.get(resolvedPath).size;
    }

    const entry = this._getManifestEntry(resolvedPath);
    if (entry) {
      if (this._syncFetchAndRegister(entry, resolvedPath)) {
        return this.fileSystem.get(resolvedPath)?.size ?? 0;
      }
      this._logMissing(resolvedPath, "FileSize requested missing asset");
      this._queueAsyncFetch(entry, resolvedPath);
      return entry.size ?? 0;
    }

    return 0;
  }

  /**
   * Get file type
   * @param {string} filePath - File path
   * @returns {number} 0=unknown, 1=file, 2=directory
   */
  fileType(filePath: string) {
    const resolvedPath = this.resolvePath(filePath);

    if (this.fileSystem.has(resolvedPath)) {
      return 1; // File
    }

    const entry = this._getManifestEntry(resolvedPath);
    if (entry) {
      if (this._syncFetchAndRegister(entry, resolvedPath)) {
        return 1;
      }
      this._logMissing(resolvedPath, "FileType requested missing asset");
      this._queueAsyncFetch(entry, resolvedPath);
      return 0;
    }

    return 0; // Unknown
  }

  /**
   * Seek to position in file
   * @param {number} handle - File handle
   * @param {number} position - Position to seek to
   * @returns {number} New position
   */
  seek(handle, position) {
    const file = this.openFiles.get(handle);
    if (!file) return 0;

    file.position = Math.max(0, Math.min(position, file.size));
    return file.position;
  }

  /**
   * Get current position in file
   * @param {number} handle - File handle
   * @returns {number} Current position
   */
  tell(handle) {
    const file = this.openFiles.get(handle);
    if (!file) return 0;
    return file.position;
  }

  /**
   * Resolve file path (handle relative paths, etc.)
   * @param {string} filePath - Input file path
   * @returns {string} Resolved absolute path
   */
  resolvePath(filePath) {
    // Normalize path separators
    let resolved = filePath.replace(/\\/g, "/");

    // Remove leading/trailing slashes for consistency
    resolved = resolved.replace(/^\/+|\/+$/g, "");

    return resolved;
  }

  /**
   * Read bytes without advancing file position (peek)
   * @param {number} handle - File handle
   * @param {number} count - Number of bytes to peek
   * @returns {Uint8Array} Peeked bytes
   */
  peekBytes(handle, count) {
    const file = this.openFiles.get(handle);
    if (!file) return new Uint8Array(0);

    const result = new Uint8Array(count);
    for (let i = 0; i < count && file.position + i < file.size; i++) {
      result[i] = file.data[file.position + i];
    }
    return result;
  }

  /**
   * Get all remaining data from file
   * @param {number} handle - File handle
   * @returns {Uint8Array} Remaining file data
   */
  readRemaining(handle) {
    const file = this.openFiles.get(handle);
    if (!file) return new Uint8Array(0);

    const remaining = file.size - file.position;
    const result = new Uint8Array(remaining);
    for (let i = 0; i < remaining; i++) {
      result[i] = file.data[file.position + i];
    }
    file.position = file.size;
    return result;
  }

  /**
   * Setup import functions for WASM
   * @param {Object} imports - WASM imports object to populate
   */
  setupImports(imports) {
    const self = this;

    Object.assign(imports.env, {
      ReadFile: (pathPtr) => {
        const path = this.core.readString(pathPtr);
        return this.openFile(path);
      },

      WriteFile: (pathPtr) => {
        const path = this.core.readString(pathPtr);
        console.log(`WriteFile not fully implemented: ${path}`);
        return 0;
      },

      CloseFile: (stream) => {
        this.closeFile(stream);
      },

      ReadInt: (stream) => {
        return this.readInt(stream);
      },

      ReadFloat: (stream) => {
        return this.readFloat(stream);
      },

      ReadString: (stream) => {
        return this.readString(stream);
      },

      ReadByte: (stream) => {
        return this.readByte(stream);
      },

      ReadShort: (stream) => {
        return this.readShort(stream);
      },

      ReadUShort: (stream) => {
        return this.readUShort(stream);
      },

      ReadUInt: (stream) => {
        return this.readUInt(stream);
      },

      ReadDouble: (stream) => {
        return this.readDouble(stream);
      },

      Eof: (stream) => {
        return this.eof(stream);
      },

      FileSize: (pathPtr) => {
        const path = this.core.readString(pathPtr);
        return this.fileSize(path);
      },

      FileType: (pathPtr) => {
        const path = this.core.readString(pathPtr);
        return this.fileType(path);
      },

      ReadData: (stream, buf, count) => {
        return this.readData(stream, buf, count);
      },

      FileSeek: (stream, position) => {
        return this.seek(stream, position);
      },

      FileTell: (stream) => {
        return this.tell(stream);
      },

      ReadPString: (stream) => {
        return this.readPString(stream);
      },

      ReadLString: (stream) => {
        return this.readLString(stream);
      },
    });
  }

  /**
   * Get memory access for readData operations
   * @param {WebAssembly.Memory} memory - WASM memory instance
   */
  setMemory(memory) {
    this.memory = memory;
  }

  dispose(options: { clearCache?: boolean } = {}) {
    const clearCache = options.clearCache ?? true;
    try {
      this.openFiles?.clear?.();
    } catch {}
    try {
      this.pendingLoads?.clear?.();
    } catch {}
    if (clearCache) {
      try {
        this.fileSystem?.clear?.();
      } catch {}
      this.assetBundle = null;
      this.assetManifest = null;
    }
    this.memory = null;
  }
}
