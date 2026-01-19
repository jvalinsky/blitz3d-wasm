/**
 * Blitz3D Runtime File I/O Module
 * Handles file reading, virtual file system, and asset bundling
 */

const fs = require('fs');
const path = require('path');

class Blitz3DFileIO {
    constructor(core) {
        this.core = core;
        this.fileSystem = new Map();
        this.openFiles = new Map();
        this.nextFileHandle = 1;
        this.assetBundle = null;
        this.basePath = '';
    }

    /**
     * Initialize the file I/O system with optional asset bundle
     * @param {string} basePath - Base path for asset files
     * @param {Object} assetBundle - Optional pre-loaded asset bundle
     */
    init(basePath = '', assetBundle = null) {
        this.basePath = basePath;
        this.assetBundle = assetBundle;
        console.log(`File I/O initialized with base path: ${basePath}`);
        
        if (assetBundle) {
            console.log(`Asset bundle loaded with ${assetBundle.fileCount || 0} files`);
        }
    }

    /**
     * Load an asset bundle from a JSON or binary file
     * @param {string} bundlePath - Path to the asset bundle
     */
    async loadAssetBundle(bundlePath) {
        try {
            const bundleData = fs.readFileSync(bundlePath);
            this.assetBundle = JSON.parse(bundleData.toString());
            console.log(`Asset bundle loaded: ${this.assetBundle.files.length} files`);
            return true;
        } catch (error) {
            console.error(`Failed to load asset bundle: ${error.message}`);
            return false;
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
    registerDirectory(dirPath, extensions = ['.rmesh', '.bmp', '.jpg', '.png', '.b3d']) {
        const walkDir = (dir, base = '') => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relPath = path.join(base, item);
                
                if (fs.statSync(fullPath).isDirectory()) {
                    walkDir(fullPath, relPath);
                } else if (extensions.some(ext => item.toLowerCase().endsWith(ext))) {
                    const data = fs.readFileSync(fullPath);
                    this.registerFile(relPath, new Uint8Array(data));
                }
            }
        };
        
        walkDir(dirPath);
        console.log(`Registered ${this.fileSystem.size} files from ${dirPath}`);
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
        
        // Try to read from disk directly
        try {
            const data = fs.readFileSync(path.join(this.basePath, resolvedPath));
            const handle = this.nextFileHandle++;
            this.openFiles.set(handle, {
                data: new Uint8Array(data),
                size: data.length,
                position: 0,
                path: resolvedPath,
                eof: false
            });
            console.log(`Opened file from disk: ${resolvedPath} (handle: ${handle})`);
            return handle;
        } catch (error) {
            console.error(`Failed to open file: ${resolvedPath} - ${error.message}`);
            return 0;
        }
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
        
        try {
            const stats = fs.statSync(path.join(this.basePath, resolvedPath));
            return stats.size;
        } catch (error) {
            return 0;
        }
    }

    /**
     * Get file type
     * @param {string} filePath - File path
     * @returns {number} 0=unknown, 1=file, 2=directory
     */
    fileType(filePath) {
        const resolvedPath = this.resolvePath(filePath);
        
        if (this.fileSystem.has(resolvedPath)) {
            return 1; // File
        }
        
        try {
            const stats = fs.statSync(path.join(this.basePath, resolvedPath));
            return stats.isDirectory() ? 2 : 1;
        } catch (error) {
            return 0; // Unknown
        }
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
     * Create import functions for WASM
     * @returns {Object} Import object for WASM importObject
     */
    createWASMImports() {
        const self = this;
        
        return {
            env: {
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
            }
        };
    }

    /**
     * Get memory access for readData operations
     * @param {WebAssembly.Memory} memory - WASM memory instance
     */
    setMemory(memory) {
        this.memory = memory;
    }
}

module.exports = Blitz3DFileIO;
