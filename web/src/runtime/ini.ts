export class BlitzINI {
  constructor(private context: any, private fileIO: any) {}

  registerImports(imports: any) {
    if (!imports.env) imports.env = {};

    imports.env.GetINIInt = (
      pathPtr: number,
      sectionPtr: number,
      keyPtr: number,
      defaultValue: number,
    ) => {
      const path = this.context.readString(pathPtr);
      const section = this.context.readString(sectionPtr);
      const key = this.context.readString(keyPtr);

      // Read file from virtual file system
      let data: Uint8Array | undefined;
      const core = this.fileIO?.core || (globalThis as any).__core;
      const fileSystem = core?.fileSystem || this.fileIO?.fileSystem;
      
      if (fileSystem && fileSystem.has(path)) {
          data = fileSystem.get(path).data;
      }

      if (!data) return defaultValue;

      // Parse simple INI format
      try {
        const text = new TextDecoder().decode(data);
        const lines = text.split(/\r?\n/);
        let inSection = false;
        const targetSection = section.toLowerCase();
        const targetKey = key.toLowerCase();
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            const secName = trimmed.slice(1, -1).trim().toLowerCase();
            inSection = secName === targetSection;
            continue;
          }
          if (inSection && trimmed.includes("=")) {
            const eqIdx = trimmed.indexOf("=");
            const k = trimmed.slice(0, eqIdx).trim().toLowerCase();
            const v = trimmed.slice(eqIdx + 1).trim();
            if (k === targetKey) {
              const parsed = parseInt(v, 10);
              return Number.isFinite(parsed) ? parsed : defaultValue;
            }
          }
        }
      } catch {
        // Parse error — return default
      }
      return defaultValue;
    };
  }
}
