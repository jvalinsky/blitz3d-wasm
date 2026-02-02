/**
 * Blitz3D Runtime File I/O Module
 * Handles file reading, virtual file system, and asset bundling.
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

interface VirtualFile {
  data: Uint8Array;
  size: number;
  position: number;
  path: string;
  eof: boolean;
}

type OpenFileMode = "r" | "w";

interface OpenFile extends VirtualFile {
  mode: OpenFileMode;
  out?: number[]; // present for "w" handles
}

interface Core {
  readString(ptr: number): string;
  allocString: ((str: string) => number) | null;
  memory?: WebAssembly.Memory;
}

interface AssetBundleFile {
  path: string;
  data: Uint8Array;
  size: number;
}

interface WASMImportsEnv {
  ReadFile?: (pathPtr: number) => number;
  WriteFile?: (pathPtr: number) => number;
  CloseFile?: (stream: number) => void;
  ReadInt?: (stream: number) => number;
  ReadFloat?: (stream: number) => number;
  ReadString?: (stream: number) => number;
  ReadByte?: (stream: number) => number;
  ReadShort?: (stream: number) => number;
  ReadUShort?: (stream: number) => number;
  ReadUInt?: (stream: number) => number;
  ReadDouble?: (stream: number) => number;
  Eof?: (stream: number) => number;
  FileSize?: (pathPtr: number) => number;
  FileType?: (pathPtr: number) => number;
  ReadData?: (stream: number, buf: number, count: number) => number;
  FileSeek?: (stream: number, position: number) => number;
  FileTell?: (stream: number) => number;
  ReadPString?: (stream: number) => number;
  ReadLString?: (stream: number) => number;
  WriteByte?: (stream: number, v: number) => number;
  WriteShort?: (stream: number, v: number) => number;
  WriteInt?: (stream: number, v: number) => number;
  WriteFloat?: (stream: number, v: number) => number;
  WriteDouble?: (stream: number, v: number) => number;
  WriteString?: (stream: number, strPtr: number) => number;
  WriteLine?: (stream: number, strPtr: number) => number;
}

interface WASMImports {
  env: WASMImportsEnv;
}

// Browser shim for path
const path = {
  join: (...args: string[]) => args.join("/").replace(/\/+/g, "/"),
  dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
};

export class Blitz3DFileIO {
  [key: string]: unknown;
  core: Core;
  fileSystem: Map<string, VirtualFile>;
  _fileSystemByLower: Map<string, string>;
  openFiles: Map<number, OpenFile>;
  nextFileHandle: number;
  assetBundle: { files: AssetBundleFile[] } | null;
  assetManifest: AssetManifest | null;
  pendingLoads: Map<string, Promise<void>>;
  basePath: string;
  _manifestByPath: Map<string, AssetManifestEntry> | null;
  _manifestByPathLower: Map<string, AssetManifestEntry> | null;
  _missingCounts: Map<string, number>;
  _missingLastLogMs: Map<string, number>;
  _missingGlobalLastMs: number;
  _registeredCount: number;

  constructor(core: Core = { readString: () => "", allocString: () => 0 }) {
    this.core = core;
    this.fileSystem = new Map();
    this._fileSystemByLower = new Map();
    this.openFiles = new Map();
    this.nextFileHandle = 1;
    this.assetBundle = null;
    this.assetManifest = null;
    this.pendingLoads = new Map();
    this.basePath = "";
    this._manifestByPath = null;
    this._manifestByPathLower = null;
    this._missingCounts = new Map();
    this._missingLastLogMs = new Map();
    this._missingGlobalLastMs = 0;
    this._registeredCount = 0;
  }

  /**
   * Initialize the file I/O system with optional asset bundle
   * @param {string} basePath - Base path for asset files
   * @param {Object} assetBundle - Optional pre-loaded asset bundle
   */
  init(
    basePath = "",
    assetBundle: { files: AssetBundleFile[] } | null = null,
    assetManifest: AssetManifest | null = null,
  ) {
    this.basePath = basePath;
    this.assetBundle = assetBundle;
    this.assetManifest = assetManifest;
    this._rebuildManifestIndex();
    console.log(`File I/O initialized with base path: ${basePath}`);

    if (assetBundle) {
      console.log(
        `Asset bundle loaded: ${assetBundle.files.length} files`,
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
      const fileCount = data.files.length;
      console.log(
        `Asset bundle loaded: ${fileCount} files`,
      );
      return true;
    } catch (error: unknown) {
      console.error(`Failed to load asset bundle: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async loadAssetManifest(manifestPath: string) {
    try {
      const response = await fetch(manifestPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json() as AssetManifest;
      this.assetManifest = data;
      if (data.basePath) {
        this.basePath = data.basePath;
      }
      this._rebuildManifestIndex();
      console.log(`Asset manifest loaded: ${data.files?.length ?? 0} files`);
      return true;
    } catch (error: unknown) {
      console.error(`Failed to load asset manifest: ${error instanceof Error ? error.message : String(error)}`);
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

    (globalThis as { __SCPCB_LAST_FILE_REQ?: string }).__SCPCB_LAST_FILE_REQ = resolvedPath;

    if (count === 1 || now - prev > 500) {
      this._missingLastLogMs.set(resolvedPath, now);
      console.warn(`[FileIO] ${context}: ${resolvedPath} (count=${count})`);
    } else if (now - (this._missingGlobalLastMs ?? 0) > 1500) {
      this._missingGlobalLastMs = now;
      console.warn(`[FileIO] still waiting on: ${resolvedPath}`);
    }
  }

  _dispatchErrorEvent(error: Error, filePath: string) {
    const event = new CustomEvent("blitz3d-file-error", {
      detail: {
        error,
        filePath,
        timestamp: Date.now(),
      },
      bubbles: true,
    });
    console.error(`[FileIO] Error loading ${filePath}:`, error.message);
    if (typeof window !== "undefined") {
      window.dispatchEvent(event);
    }
  }

  _queueAsyncFetch(entry: AssetManifestEntry, resolvedPath: string) {
    if (!entry) return;
    if (this.fileSystem.has(resolvedPath)) return;
    if (this.pendingLoads.has(resolvedPath)) return;
    this.fetchAndRegister(entry).catch((error) => {
      this._dispatchErrorEvent(error instanceof Error ? error : new Error(String(error)), resolvedPath);
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
          (globalThis as { __SCPCB_INIT_FILE?: string }).__SCPCB_INIT_FILE = entry.path;
        } catch {}
        await this.fetchAndRegister(entry);
        completed += 1;
        if (options.onProgress) {
          options.onProgress(completed, total, entry.path);
        }
        try {
          (globalThis as { __SCPCB_ASSET_PRELOAD?: { loaded: number; total: number; file: string } }).__SCPCB_ASSET_PRELOAD = {
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

  async fetchWithRetry(
    url: string,
    maxRetries = 3,
    baseDelay = 1000,
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          if (response.status >= 500 && attempt < maxRetries - 1) {
            const delay = baseDelay * Math.pow(2, attempt);
            console.warn(`[FileIO] Server error ${response.status}, retrying in ${delay}ms...`);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.warn(`[FileIO] Fetch failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw lastError ?? new Error("Fetch failed after all retries");
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
      const response = await this.fetchWithRetry(url);

      const totalHint = (typeof entry.size === "number" && entry.size > 0)
        ? entry.size
        : (() => {
            const contentLength = response.headers.get("Content-Length");
            return contentLength ? Number(contentLength) : null;
          })();

      if ((totalHint ?? 0) > 0 && (totalHint as number) <= 1024 * 1024) {
        try {
          (globalThis as { __SCPCB_FETCH_STATUS?: { file: string; loaded: number; total: number | null } }).__SCPCB_FETCH_STATUS = {
            file: resolvedPath,
            loaded: 0,
            total: totalHint,
          };
        } catch {}

        const buffer = new Uint8Array(await response.arrayBuffer());
        try {
          (globalThis as { __SCPCB_FETCH_STATUS?: { file: string; loaded: number; total: number | null } }).__SCPCB_FETCH_STATUS = {
            file: resolvedPath,
            loaded: buffer.byteLength,
            total: totalHint,
          };
        } catch {}
        if (onProgress) onProgress(buffer.byteLength, totalHint, resolvedPath);
        this.registerFile(resolvedPath, buffer);
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
            (globalThis as { __SCPCB_FETCH_STATUS?: { file: string; loaded: number; total: number | null } }).__SCPCB_FETCH_STATUS = {
              file: resolvedPath,
              loaded,
              total,
            };
          } catch {}
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
  registerFile(filePath: string, data: Uint8Array) {
    const resolvedPath = this.resolvePath(filePath);
    this.fileSystem.set(resolvedPath, {
      data: data,
      size: data.length,
      position: 0,
      path: resolvedPath,
      eof: false,
    });
    this._fileSystemByLower.set(resolvedPath.toLowerCase(), resolvedPath);
    this._registeredCount = (this._registeredCount ?? 0) + 1;
    const n = this._registeredCount as number;
    if (n <= 50 || (n <= 500 && n % 50 === 0) || n % 500 === 0) {
      console.log(`Registered file: ${resolvedPath} (${data.length} bytes)`);
    }
  }

  /**
   * Register a directory of files (Stubbed for Web)
   * @param {string} dirPath - Directory path
   * @param {Array<string>} extensions - File extensions to include
   */
  registerDirectory(
    dirPath: string,
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

  openFile(filePath: string): number {
    if (!this._validatePath(filePath)) {
      console.warn(`[FileIO] Invalid path rejected: ${filePath}`);
      return 0;
    }

    const candidates = this._openFileCandidates(filePath);

    for (const resolvedPath of candidates) {
      const vfsKey = this._fileSystemByLower.get(resolvedPath.toLowerCase()) ?? resolvedPath;
      if (this.fileSystem.has(vfsKey)) {
        const file = this.fileSystem.get(vfsKey)!;
        file.position = 0;
        const handle = this.nextFileHandle++;
        this.openFiles.set(handle, { ...file, path: vfsKey, eof: false, mode: "r" });
        console.log(`Opened file from VFS: ${vfsKey} (handle: ${handle})`);
        return handle;
      }

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
            mode: "r",
          });
          console.log(
            `Opened file from bundle: ${resolvedPath} (handle: ${handle})`,
          );
          return handle;
        }
      }

      const entry = this._getManifestEntry(resolvedPath);
      if (entry) {
        this._logMissing(resolvedPath, "ReadFile: asset not preloaded, queuing async fetch");
        this._queueAsyncFetch(entry, resolvedPath);
        return 0;
      }
    }

    console.warn(`File not found: ${candidates[0] ?? this.resolvePath(filePath)}`);
    return 0;
  }

  openWriteFile(filePath: string): number {
    if (!this._validatePath(filePath)) {
      console.warn(`[FileIO] Invalid path rejected: ${filePath}`);
      return 0;
    }

    const resolvedPath = this.resolvePath(filePath);
    if (!resolvedPath) return 0;
    const handle = this.nextFileHandle++;
    this.openFiles.set(handle, {
      data: new Uint8Array(0),
      size: 0,
      position: 0,
      path: resolvedPath,
      eof: false,
      mode: "w",
      out: [],
    });
    return handle;
  }

  /**
   * Close a file handle
   * @param {number} handle - File handle
   */
  closeFile(handle: number) {
    if (this.openFiles.has(handle)) {
      const file = this.openFiles.get(handle)!;
      this.openFiles.delete(handle);
      if (file.mode === "w") {
        const bytes = new Uint8Array(file.out ?? []);
        this.registerFile(file.path, bytes);
      }
      console.log(`Closed file handle: ${handle} (${file.path})`);
    }
  }

  /**
   * Read a byte from a file
   * @param {number} handle - File handle
   * @returns {number} Byte value (0-255), -1 on EOF
   */
  readByte(handle: number): number {
    const file = this.openFiles.get(handle);
    if (!file || file.mode !== "r" || file.position >= file.size) {
      if (file) file.eof = true;
      return -1;
    }
    return file.data[file.position++];
  }

  /**
   * Read a signed byte from a file
   * @param {number} handle - File handle
   * @returns {number} Signed byte value (-128 to 127)
   */
  readSignedByte(handle: number): number {
    const byte = this.readByte(handle);
    return byte > 127 ? byte - 256 : byte;
  }

  /**
   * Read a short (16-bit integer)
   * @param {number} handle - File handle
   * @returns {number} Short value
   */
  readShort(handle: number): number {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    if (b1 < 0 || b2 < 0) return 0;
    return b1 | (b2 << 8);
  }

  /**
   * Read an unsigned short
   * @param {number} handle - File handle
   * @returns {number} Unsigned short value
   */
  readUShort(handle: number): number {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    if (b1 < 0 || b2 < 0) return 0;
    return (b1 & 0xFF) | ((b2 & 0xFF) << 8);
  }

  /**
   * Read a 32-bit integer
   * @param {number} handle - File handle
   * @returns {number} Integer value
   */
  readInt(handle: number): number {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    const b3 = this.readByte(handle);
    const b4 = this.readByte(handle);

    if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) {
      return 0;
    }

    return b1 | (b2 << 8) | (b3 << 16) | (b4 << 24);
  }

  /**
   * Read a 32-bit unsigned integer
   * @param {number} handle - File handle
   * @returns {number} Unsigned integer value
   */
  readUInt(handle: number): number {
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
   * Read a 64-bit floating point number
   * @param {number} handle - File handle
   * @returns {number} Double precision float
   */
  readDouble(handle: number): number {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      bytes[i] = this.readByte(handle);
      if (bytes[i] < 0) return 0;
    }

    const view = new DataView(bytes.buffer);
    return view.getFloat64(0, true);
  }

  /**
   * Read a 32-bit floating point number
   * @param {number} handle - File handle
   * @returns {number} Single precision float
   */
  readFloat(handle: number): number {
    const b1 = this.readByte(handle);
    const b2 = this.readByte(handle);
    const b3 = this.readByte(handle);
    const b4 = this.readByte(handle);

    if (b1 < 0 || b2 < 0 || b3 < 0 || b4 < 0) {
      return 0.0;
    }

    const bytes = new Uint8Array([b1, b2, b3, b4]);
    const view = new DataView(bytes.buffer);
    return view.getFloat32(0, true);
  }

  /**
   * Read a null-terminated string from a file
   * @param {number} handle - File handle
   * @returns {number} Pointer to string in WASM memory (0 on failure)
   */
  readString(handle: number): number {
    const file = this.openFiles.get(handle);
    if (!file) return 0;

    let str = "";
    let bytesRead = 0;
    const maxStringLen = 65536;

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

    if (this.core && typeof this.core.allocString === "function") {
      return this.core.allocString(str);
    }

    console.error("Cannot allocate string: allocString not available");
    return 0;
  }

  /**
   * Read a Pascal-style string
   * @param {number} handle - File handle
   * @returns {number} Pointer to string in WASM memory
   */
  readPString(handle: number): number {
    const length = this.readByte(handle);
    if (length < 0) return 0;

    let str = "";
    for (let i = 0; i < length && !this.eof(handle); i++) {
      const byte = this.readByte(handle);
      if (byte < 0) break;
      str += String.fromCharCode(byte);
    }

    if (this.core && typeof this.core.allocString === "function") {
      return this.core.allocString(str);
    }
    return 0;
  }

  /**
   * Read a 32-bit integer length-prefixed string
   * @param {number} handle - File handle
   * @returns {number} Pointer to string in WASM memory
   */
  readLString(handle: number): number {
    const length = this.readInt(handle);
    if (length <= 0) return 0;

    let str = "";
    for (let i = 0; i < length && !this.eof(handle); i++) {
      const byte = this.readByte(handle);
      if (byte < 0) break;
      str += String.fromCharCode(byte);
    }

    if (this.core && typeof this.core.allocString === "function") {
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
  readData(handle: number, bufferPtr: number, count: number): number {
    const file = this.openFiles.get(handle);
    if (!file) return 0;

    const bytesToRead = Math.min(count, file.size - file.position);
    if (bytesToRead <= 0) return 0;

    if (this.core.memory) {
      const memory = new Uint8Array(this.core.memory.buffer);
      for (let i = 0; i < bytesToRead; i++) {
        memory[bufferPtr + i] = file.data[file.position + i];
      }
    }

    file.position += bytesToRead;
    return bytesToRead;
  }

  /**
   * Check if end of file reached
   * @param {number} handle - File handle
   * @returns {number} 1 if EOF, 0 otherwise
   */
  eof(handle: number): number {
    const file = this.openFiles.get(handle);
    if (!file) return 1;
    return file.position >= file.size ? 1 : 0;
  }

  /**
   * Get file size
   * @param {string} filePath - File path
   * @returns {number} File size in bytes (0 if not found)
   */
  fileSize(filePath: string): number {
    const resolvedPath = this.resolvePath(filePath);

    if (this.fileSystem.has(resolvedPath)) {
      return this.fileSystem.get(resolvedPath)!.size;
    }

    const entry = this._getManifestEntry(resolvedPath);
    if (entry) {
      this._logMissing(resolvedPath, "FileSize: asset not preloaded, queuing async fetch");
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
  fileType(filePath: string): number {
    const resolvedPath = this.resolvePath(filePath);

    if (this.fileSystem.has(resolvedPath)) {
      return 1;
    }

    const entry = this._getManifestEntry(resolvedPath);
    if (entry) {
      this._logMissing(resolvedPath, "FileType: asset not preloaded, queuing async fetch");
      this._queueAsyncFetch(entry, resolvedPath);
      return 0;
    }

    return 0;
  }

  /**
   * Seek to position in file
   * @param {number} handle - File handle
   * @param {number} position - Position to seek to
   * @returns {number} New position
   */
  seek(handle: number, position: number): number {
    const file = this.openFiles.get(handle);
    if (!file) return 0;

    if (file.mode === "w") {
      const pos = Math.max(0, position | 0);
      file.position = pos;
      file.size = Math.max(file.size, pos);
      return file.position;
    }

    file.position = Math.max(0, Math.min(position, file.size));
    file.eof = false;
    return file.position;
  }

  /**
   * Get current position in file
   * @param {number} handle - File handle
   * @returns {number} Current position
   */
  tell(handle: number): number {
    const file = this.openFiles.get(handle);
    if (!file) return 0;
    return file.position;
  }

  _writeBytes(handle: number, bytes: Uint8Array): number {
    const file = this.openFiles.get(handle);
    if (!file || file.mode !== "w") return 0;
    if (!file.out) file.out = [];
    const out = file.out;
    const start = Math.max(0, file.position | 0);
    while (out.length < start) out.push(0);
    for (let i = 0; i < bytes.length; i++) {
      const idx = start + i;
      if (idx < out.length) out[idx] = bytes[i]!;
      else out.push(bytes[i]!);
    }
    file.position = start + bytes.length;
    file.size = out.length;
    return bytes.length;
  }

  writeByte(handle: number, value: number): number {
    return this._writeBytes(handle, new Uint8Array([value & 0xFF]));
  }

  writeShort(handle: number, value: number): number {
    const v = value | 0;
    return this._writeBytes(handle, new Uint8Array([v & 0xFF, (v >> 8) & 0xFF]));
  }

  writeInt(handle: number, value: number): number {
    const v = value | 0;
    return this._writeBytes(
      handle,
      new Uint8Array([
        v & 0xFF,
        (v >> 8) & 0xFF,
        (v >> 16) & 0xFF,
        (v >> 24) & 0xFF,
      ]),
    );
  }

  writeFloat(handle: number, value: number): number {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, value, true);
    return this._writeBytes(handle, new Uint8Array(buf));
  }

  writeDouble(handle: number, value: number): number {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    return this._writeBytes(handle, new Uint8Array(buf));
  }

  writeString(handle: number, ptr: number): number {
    const s = this.core.readString(ptr);
    const bytes = new TextEncoder().encode(s);
    // Length-prefixed i32 (Blitz WriteString).
    this.writeInt(handle, bytes.length);
    this._writeBytes(handle, bytes);
    return bytes.length;
  }

  writeLine(handle: number, ptr: number): number {
    const s = this.core.readString(ptr);
    const bytes = new TextEncoder().encode(s + "\n");
    this._writeBytes(handle, bytes);
    return bytes.length;
  }

  _validatePath(filePath: string): boolean {
    if (filePath.startsWith("/") || filePath.startsWith("\\")) {
      console.warn(`[FileIO] Rejected absolute path: ${filePath}`);
      return false;
    }

    const resolved = this.resolvePath(filePath);

    if (resolved.startsWith("/") || resolved.startsWith("\\")) {
      console.warn(`[FileIO] Rejected absolute path: ${filePath}`);
      return false;
    }

    const normalized = resolved.replace(/\\/g, "/");
    if (normalized.includes("..")) {
      console.warn(`[FileIO] Rejected path with traversal: ${filePath}`);
      return false;
    }

    if (normalized.includes(":") || normalized.includes("//")) {
      console.warn(`[FileIO] Rejected unsafe path: ${filePath}`);
      return false;
    }

    return true;
  }

  /**
   * Resolve file path (handle relative paths, etc.)
   * @param {string} filePath - Input file path
   * @returns {string} Resolved absolute path
   */
  resolvePath(filePath: string): string {
    let resolved = filePath.replace(/\\/g, "/");
    resolved = resolved.replace(/^\/+|\/+$/g, "");
    return resolved;
  }

  /**
   * Read bytes without advancing file position (peek)
   * @param {number} handle - File handle
   * @param {number} count - Number of bytes to peek
   * @returns {Uint8Array} Peeked bytes
   */
  peekBytes(handle: number, count: number): Uint8Array {
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
  readRemaining(handle: number): Uint8Array {
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
  setupImports(imports: WASMImports) {
    const self = this;

    Object.assign(imports.env, {
      ReadFile: (pathPtr: number) => {
        const path = self.core.readString(pathPtr);
        return self.openFile(path);
      },

      WriteFile: (pathPtr: number) => {
        const path = self.core.readString(pathPtr);
        return self.openWriteFile(path);
      },

      CloseFile: (stream: number) => {
        self.closeFile(stream);
      },

      ReadInt: (stream: number) => {
        return self.readInt(stream);
      },

      ReadFloat: (stream: number) => {
        return self.readFloat(stream);
      },

      ReadString: (stream: number) => {
        return self.readString(stream);
      },

      ReadByte: (stream: number) => {
        return self.readByte(stream);
      },

      ReadShort: (stream: number) => {
        return self.readShort(stream);
      },

      ReadUShort: (stream: number) => {
        return self.readUShort(stream);
      },

      ReadUInt: (stream: number) => {
        return self.readUInt(stream);
      },

      ReadDouble: (stream: number) => {
        return self.readDouble(stream);
      },

      Eof: (stream: number) => {
        return self.eof(stream);
      },

      FileSize: (pathPtr: number) => {
        const path = self.core.readString(pathPtr);
        return self.fileSize(path);
      },

      FileType: (pathPtr: number) => {
        const path = self.core.readString(pathPtr);
        return self.fileType(path);
      },

      ReadData: (stream: number, buf: number, count: number) => {
        return self.readData(stream, buf, count);
      },

      FileSeek: (stream: number, position: number) => {
        return self.seek(stream, position);
      },

      FileTell: (stream: number) => {
        return self.tell(stream);
      },

      ReadPString: (stream: number) => {
        return self.readPString(stream);
      },

      ReadLString: (stream: number) => {
        return self.readLString(stream);
      },

      WriteByte: (stream: number, v: number) => {
        return self.writeByte(stream, v) ? 1 : 0;
      },

      WriteShort: (stream: number, v: number) => {
        return self.writeShort(stream, v) ? 1 : 0;
      },

      WriteInt: (stream: number, v: number) => {
        return self.writeInt(stream, v) ? 1 : 0;
      },

      WriteFloat: (stream: number, v: number) => {
        return self.writeFloat(stream, v) ? 1 : 0;
      },

      WriteDouble: (stream: number, v: number) => {
        return self.writeDouble(stream, v) ? 1 : 0;
      },

      WriteString: (stream: number, ptr: number) => {
        return self.writeString(stream, ptr) ? 1 : 0;
      },

      WriteLine: (stream: number, ptr: number) => {
        return self.writeLine(stream, ptr) ? 1 : 0;
      },
    });
  }

  /**
   * Get memory access for readData operations
   * @param {WebAssembly.Memory} memory - WASM memory instance
   */
  setMemory(memory: WebAssembly.Memory) {
    this.core.memory = memory;
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
    this.core.memory = undefined;
  }
}
