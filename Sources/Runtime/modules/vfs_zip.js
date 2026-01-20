/**
 * Blitz3D Runtime - Virtual Filesystem with ZIP Support
 * Provides file I/O with ZIP archive mounting
 */

class VirtualFileSystem {
    constructor(core) {
        this.core = core;
        this.files = new Map();           // fileId -> { data, position, path }
        this.archives = new Map();        // archiveName -> Map<path, Uint8Array>
        this.mountedFiles = new Map();    // virtualPath -> {archive, realPath}
        this.nextFileId = 1;
        this.nextArchiveId = 1;
    }

    // Load and mount a ZIP archive
    async loadZip(url) {
        try {
            // Check if JSZip is available
            if (typeof JSZip === 'undefined') {
                console.error("JSZip library not loaded! Include jszip.min.js");
                return 0;
            }

            const filename = url.replace(/\\/g, '/').split('/').pop();
            console.log(`Loading ZIP archive: ${filename} from ${url}`);

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const zip = await JSZip.loadAsync(arrayBuffer);
            
            const fileMap = new Map();
            const promises = [];

            // Extract all files from ZIP
            zip.forEach((relativePath, file) => {
                if (!file.dir) {
                    promises.push(
                        file.async("uint8array").then(data => {
                            fileMap.set(relativePath.toLowerCase(), data);
                            // Also store with original case
                            fileMap.set(relativePath, data);
                        })
                    );
                }
            });

            await Promise.all(promises);

            const archiveId = this.nextArchiveId++;
            this.archives.set(archiveId, {
                name: filename,
                files: fileMap
            });

            console.log(`ZIP archive loaded: ${filename} (${fileMap.size} files, ID: ${archiveId})`);
            return archiveId;

        } catch (err) {
            console.error(`Failed to load ZIP ${url}:`, err);
            return 0;
        }
    }

    // Resolve a file path (check archives, then try direct fetch)
    resolveFile(path) {
        // Normalize path
        const normalizedPath = path.replace(/\\/g, '/').toLowerCase();

        // Search all mounted archives
        for (const [archiveId, archive] of this.archives.entries()) {
            if (archive.files.has(normalizedPath)) {
                return {
                    found: true,
                    data: archive.files.get(normalizedPath),
                    source: `archive:${archive.name}`
                };
            }
            // Try without leading slash
            const withoutSlash = normalizedPath.replace(/^\/+/, '');
            if (archive.files.has(withoutSlash)) {
                return {
                    found: true,
                    data: archive.files.get(withoutSlash),
                    source: `archive:${archive.name}`
                };
            }
        }

        return { found: false, data: null, source: null };
    }

    setupImports(imports) {
        // OpenFile
        imports.env.OpenFile = (pathPtr) => {
            const path = this.core.readString(pathPtr);
            console.log(`OpenFile: ${path}`);

            // Try to resolve from archives
            const resolved = this.resolveFile(path);
            
            if (resolved.found) {
                const fileId = this.nextFileId++;
                this.files.set(fileId, {
                    data: resolved.data,
                    position: 0,
                    path: path,
                    source: resolved.source
                });
                console.log(`  -> Opened from ${resolved.source} (ID: ${fileId}, size: ${resolved.data.length})`);
                return fileId;
            }

            // If not in archive, try to fetch from server
            console.log(`  -> File not in archives, would need async fetch`);
            return 0;
        };

        // CloseFile
        imports.env.CloseFile = (fileId) => {
            if (this.files.has(fileId)) {
                this.files.delete(fileId);
                console.log(`CloseFile: ${fileId}`);
            }
        };

        // ReadByte
        imports.env.ReadByte = (fileId) => {
            const file = this.files.get(fileId);
            if (!file || file.position >= file.data.length) return 0;
            const byte = file.data[file.position];
            file.position++;
            return byte;
        };

        // ReadInt
        imports.env.ReadInt = (fileId) => {
            const file = this.files.get(fileId);
            if (!file || file.position + 4 > file.data.length) return 0;
            
            const dataView = new DataView(file.data.buffer, file.data.byteOffset);
            const value = dataView.getInt32(file.position, true); // little-endian
            file.position += 4;
            return value;
        };

        // ReadFloat
        imports.env.ReadFloat = (fileId) => {
            const file = this.files.get(fileId);
            if (!file || file.position + 4 > file.data.length) return 0.0;
            
            const dataView = new DataView(file.data.buffer, file.data.byteOffset);
            const value = dataView.getFloat32(file.position, true); // little-endian
            file.position += 4;
            return value;
        };

        // ReadString
        imports.env.ReadString = (fileId) => {
            const file = this.files.get(fileId);
            if (!file) return 0;

            let str = "";
            while (file.position < file.data.length) {
                const byte = file.data[file.position++];
                if (byte === 0 || byte === 10 || byte === 13) break; // null or newline
                str += String.fromCharCode(byte);
            }

            // Allocate string in WASM memory if available
            if (this.core.allocString) {
                return this.core.allocString(str);
            }
            return 0;
        };

        // ReadLine
        imports.env.ReadLine = (fileId) => {
            const file = this.files.get(fileId);
            if (!file) return 0;

            let str = "";
            while (file.position < file.data.length) {
                const byte = file.data[file.position++];
                if (byte === 10) break; // newline
                if (byte !== 13) { // skip carriage return
                    str += String.fromCharCode(byte);
                }
            }

            if (this.core.allocString) {
                return this.core.allocString(str);
            }
            return 0;
        };

        // Eof
        imports.env.Eof = (fileId) => {
            const file = this.files.get(fileId);
            if (!file) return 1;
            return file.position >= file.data.length ? 1 : 0;
        };

        // FilePos
        imports.env.FilePos = (fileId) => {
            const file = this.files.get(fileId);
            return file ? file.position : 0;
        };

        // SeekFile
        imports.env.SeekFile = (fileId, pos) => {
            const file = this.files.get(fileId);
            if (file) {
                file.position = Math.max(0, Math.min(pos, file.data.length));
            }
        };

        // FileSize (helper function)
        imports.env.FileSize = (pathPtr) => {
            const path = this.core.readString(pathPtr);
            const resolved = this.resolveFile(path);
            return resolved.found ? resolved.data.length : 0;
        };

        // FileType
        imports.env.FileType = (pathPtr) => {
            const path = this.core.readString(pathPtr);
            const resolved = this.resolveFile(path);
            return resolved.found ? 1 : 0; // 0=none, 1=file, 2=dir
        };

        // Write functions (not fully implemented - files are read-only)
        imports.env.WriteInt = (fileId, value) => {
            console.log(`WriteInt: file=${fileId} value=${value}`);
        };

        imports.env.WriteFloat = (fileId, value) => {
            console.log(`WriteFloat: file=${fileId} value=${value}`);
        };

        imports.env.WriteByte = (fileId, value) => {
            console.log(`WriteByte: file=${fileId} value=${value}`);
        };

        imports.env.WriteString = (fileId, strPtr) => {
            const str = this.core.readString(strPtr);
            console.log(`WriteString: file=${fileId} str="${str}"`);
        };

        imports.env.WriteLine = (fileId, strPtr) => {
            const str = this.core.readString(strPtr);
            console.log(`WriteLine: file=${fileId} str="${str}"`);
        };

        imports.env.WriteShort = (fileId, value) => {
            console.log(`WriteShort: file=${fileId} value=${value}`);
        };
    }
}

if (typeof window !== 'undefined') {
    window.VirtualFileSystem = VirtualFileSystem;
}
module.exports = VirtualFileSystem;
