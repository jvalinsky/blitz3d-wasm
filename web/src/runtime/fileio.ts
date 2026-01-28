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
    join: (...args: string[]) => args.join('/').replace(/\/+/g, '/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/')
};

export class Blitz3DFileIO {
    [key: string]: any;
    constructor(core) {
        this.core = core;
        this.fileSystem = new Map();
        this.openFiles = new Map();
        this.nextFileHandle = 1;
        this.assetBundle = null;
        this.assetManifest = null;
        this.pendingLoads = new Map();
        this.basePath = '';
    }

    /**
     * Initialize the file I/O system with optional asset bundle
     * @param {string} basePath - Base path for asset files
     * @param {Object} assetBundle - Optional pre-loaded asset bundle
     */
    init(basePath = '', assetBundle = null, assetManifest: AssetManifest | null = null) {
        this.basePath = basePath;
        this.assetBundle = assetBundle;
        this.assetManifest = assetManifest;
        console.log(`File I/O initialized with base path: ${basePath}`);

        if (assetBundle) {
            console.log(`Asset bundle loaded with ${assetBundle.fileCount || 0} files`);
        }

        if (assetManifest) {
            console.log(`Asset manifest loaded with ${assetManifest.files?.length ?? 0} files`);
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
            console.log(`Asset bundle loaded: ${this.assetBundle.files.length} files`);
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
            console.log(`Asset manifest loaded: ${data.files?.length ?? 0} files`);
            return true;
        } catch (error: any) {
            console.error(`Failed to load asset manifest: ${error.message}`);
            return false;
        }
    }

    async preloadAssetGroup(group: string, options: PreloadOptions = {}) {
        if (!this.assetManifest?.groups || !this.assetManifest.files) {
            console.warn('No asset manifest groups available');
            return false;
        }

        const files = this.assetManifest.groups[group];
        if (!files) {
            console.warn(`Asset group not found: ${group}`);
            return false;
        }

        const manifestFiles = new Map(this.assetManifest.files.map(file => [file.path, file]));
        const list = files.map(path => manifestFiles.get(path)).filter(Boolean) as AssetManifestEntry[];

        await this.preloadFiles(list, options);
        return true;
    }

    async preloadFiles(files: AssetManifestEntry[], options: PreloadOptions = {}) {
        const concurrency = options.concurrency ?? 4;
        let completed = 0;
        const total = files.length;
        const queue = [...files];

        const pump = async () => {
            while (queue.length) {
                const entry = queue.shift();
                if (!entry) return;
                await this.fetchAndRegister(entry, options.onProgress);
                completed += 1;
                if (options.onProgress) {
                    options.onProgress(completed, total, entry.path);
                }
            }
        };

        await Promise.all(new Array(concurrency).fill(0).map(() => pump()));
    }

    async fetchAndRegister(entry: AssetManifestEntry, onProgress?: (loaded: number, total: number | null, file?: string) => void) {
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

            if (!response.body) {
                const buffer = new Uint8Array(await response.arrayBuffer());
                this.registerFile(resolvedPath, buffer);
                return;
            }

            const reader = response.body.getReader();
            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? Number(contentLength) : null;
            let loaded = 0;
            const chunks: Uint8Array[] = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                if (value) {
                    chunks.push(value);
                    loaded += value.length;
                    if (onProgress) onProgress(loaded, total, resolvedPath);
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
        this.fileSystem.set(filePath, {
            data: data,
            size: data.length,
            position: 0
        });
        console.log(`Registered file: ${filePath} (${data.length} bytes)`);
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
    registerDirectory(dirPath: string, extensions = ['.rmesh', '.bmp', '.jpg', '.png', '.b3d']) {
        console.warn("registerDirectory is not supported in browser environment");
    }

    /**
     * Open a file and return a file handle
     * @param {string} filePath - Path to the file
     * @returns {number} File handle (0 on failure)
     */
    openFile(filePath) {
        const resolvedPath = this.resolvePath(filePath);

        // Check virtual file system first
        if (this.fileSystem.has(resolvedPath)) {
            const file = this.fileSystem.get(resolvedPath);
            file.position = 0;
            const handle = this.nextFileHandle++;
            this.openFiles.set(handle, {
                ...file,
                path: resolvedPath,
                eof: false
            });
            console.log(`Opened file from VFS: ${resolvedPath} (handle: ${handle})`);
            return handle;
        }

        // Check asset bundle
        if (this.assetBundle && this.assetBundle.files) {
            const bundleFile = this.assetBundle.files.find(f => f.path === resolvedPath);
            if (bundleFile) {
                const handle = this.nextFileHandle++;
                this.openFiles.set(handle, {
                    data: new Uint8Array(bundleFile.data),
                    size: bundleFile.size,
                    position: 0,
                    path: resolvedPath,
                    eof: false
                });
                console.log(`Opened file from bundle: ${resolvedPath} (handle: ${handle})`);
                return handle;
            }
        }

        // Try manifest-driven fetch on demand
        if (this.assetManifest?.files) {
            const entry = this.assetManifest.files.find(file => file.path === resolvedPath);
            if (entry) {
                console.warn(`File not yet loaded, fetching: ${resolvedPath}`);
                this.fetchAndRegister(entry).catch((error) => {
                    console.error(`Failed to fetch asset ${resolvedPath}:`, error);
                });
                return 0;
            }
        }

        // Try to read from disk directly (Node.js only)
        console.warn(`File not found: ${resolvedPath}`);
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

        return (b1 & 0xFF) | ((b2 & 0xFF) << 8) | ((b3 & 0xFF) << 16) | ((b4 & 0xFF) << 24);
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
        return view.getFloat32(0, true);  // true = little-endian
    }

    /**
     * Read a null-terminated string from a file
     * @param {number} handle - File handle
     * @returns {number} Pointer to string in WASM memory (0 on failure)
     */
    readString(handle) {
        const file = this.openFiles.get(handle);
        if (!file) return 0;

        let str = '';
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

        console.error('Cannot allocate string: allocString not available');
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

        let str = '';
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

        let str = '';
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
        let resolved = filePath.replace(/\\/g, '/');

        // Remove leading/trailing slashes for consistency
        resolved = resolved.replace(/^\/+|\/+$/g, '');

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
            }
        });
    }

    /**
     * Get memory access for readData operations
     * @param {WebAssembly.Memory} memory - WASM memory instance
     */
    setMemory(memory) {
        this.memory = memory;
    }
}


