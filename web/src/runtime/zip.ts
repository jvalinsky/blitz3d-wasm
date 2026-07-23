import JSZip from "jszip";

export class BlitzZipApi {
  private zipArchives = new Map();
  private nextZipHandle = 1;

  constructor(private context: any, private fileIO: any) {}

  async loadZipArchive(path: string) {
    try {
      let data: Uint8Array | undefined;
      const core = this.fileIO?.core || (globalThis as any).__core;
      const fileSystem = core?.fileSystem || this.fileIO?.fileSystem;
      
      if (fileSystem && fileSystem.has(path)) {
        data = fileSystem.get(path).data;
      }
      
      let arrayBuffer: ArrayBuffer;
      if (data) {
        arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      } else {
        const response = await fetch(path);
        if (!response.ok) throw new Error("HTTP " + response.status);
        arrayBuffer = await response.arrayBuffer();
      }

      const zip = await JSZip.loadAsync(arrayBuffer);
      const fileMap = new Map();

      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          fileMap.set(relativePath, zipEntry);
        }
      });

      this.zipArchives.set(path, fileMap);
      console.log("Loaded ZIP: " + path + " (" + fileMap.size + " files)");
      return fileMap.size;
    } catch (e) {
      console.error("Failed to load ZIP " + path + ":", e);
      return 0;
    }
  }

  registerImports(imports: any) {
    if (!imports.env) imports.env = {};

    imports.env.ZlibWapi_Open = async (pathPtr: number) => {
      const path = this.context.readString(pathPtr);
      const handle = this.nextZipHandle++;

      const fileCount = await this.loadZipArchive(path);
      if (fileCount > 0) {
        this.zipArchives.set(handle, {
          path: path,
          files: this.zipArchives.get(path),
          isHandle: true,
        });
        this.zipArchives.delete(path);
        return handle;
      }
      return 0;
    };

    imports.env.ZlibWapi_Close = (zip: number) => {
      if (this.zipArchives.has(zip)) {
        this.zipArchives.delete(zip);
      }
    };

    imports.env.ZlibWapi_GetFileCount = (zip: number) => {
      const archive = this.zipArchives.get(zip);
      if (archive && archive.files) {
        return archive.files.size;
      }
      return 0;
    };

    imports.env.ZlibWapi_GetFileName = (zip: number, index: number) => {
      const archive = this.zipArchives.get(zip);
      if (archive && archive.files) {
        const entries = Array.from(archive.files.keys());
        if (index >= 0 && index < entries.length) {
          const filename = entries[index];
          const core = this.fileIO?.core || (globalThis as any).__core;
          if (core && core.allocString) {
             return core.allocString(filename as string);
          } else if (this.context.allocString) {
             return this.context.allocString(filename as string);
          }
        }
      }
      return 0;
    };

    imports.env.ZlibWapi_ExtractFile = async (zip: number, index: number, destPtr: number) => {
      const archive = this.zipArchives.get(zip);
      if (archive && archive.files) {
        const entries = Array.from(archive.files.keys());
        if (index >= 0 && index < entries.length) {
          const filename = entries[index];
          const zipEntry = archive.files.get(filename);

          if (zipEntry) {
            try {
              const data = await zipEntry.async("uint8array");
              const destPath = this.context.readString(destPtr);

              const core = this.fileIO?.core || (globalThis as any).__core;
              if (core && core.registerFile) {
                core.registerFile(destPath, data);
              } else if (this.fileIO && typeof this.fileIO.registerFile === "function") {
                this.fileIO.registerFile(destPath, data);
              }

              console.log("Extracted: " + filename + " -> " + destPath);
              return 1;
            } catch (e) {
              console.error("Failed to extract " + filename + ":", e);
            }
          }
        }
      }
      return 0;
    };
  }
}
