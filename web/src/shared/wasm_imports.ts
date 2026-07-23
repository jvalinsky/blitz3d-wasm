/**
 * Utilities for instantiating WASM modules whose import surface is not fully
 * implemented.
 *
 * The interpreter and some loader paths intentionally stub "unknown" imports so:
 * - compilation can succeed even if a runtime binding is missing, and
 * - demos can still run for the subset they exercise.
 *
 * This should be used with care: stubbing can hide real runtime gaps. Prefer
 * implementing the import properly when moving a feature from "demo" to "engine".
 */

export type StubMissingImportsOptions = {
  /**
   * If a module imports from `blitz3d.X` but `env.X` is implemented, mirror it
   * into `imports.blitz3d.X` so instantiation succeeds.
   */
  preferEnvForBlitz3d?: boolean;
  /**
   * Ensure `imports.env.memory` exists when a memory import is required.
   */
  ensureEnvMemory?: boolean;
  /**
   * When a memory import is required and `imports.env.memory` is absent, create
   * it with these limits.
   */
  envMemoryLimits?: { initial: number; maximum: number };
  stubGlobals?: boolean;
  stubTables?: boolean;
  stubMemory?: boolean;
  /**
   * Treat import names as case-insensitive when a matching implementation exists
   * under a different casing (Blitz3D source is case-insensitive, but WASM
   * imports are not).
   *
   * This is especially useful for interpreter/demo builds where modules may
   * import `filetype` but the runtime implements `FileType`.
   */
  caseInsensitive?: boolean;
  defaultReturn?: number;
  onStub?: (info: {
    module: string;
    name: string;
    kind: WebAssembly.ImportExportKind;
  }) => void;
  onCallMissingFunction?: (info: { key: string }) => void;
};

/**
 * Populate an imports object with "safe" stubs for any missing WASM imports.
 *
 * This is used by the interpreter and some demo/harness paths so that:
 * - compilation can succeed when an import isn't implemented yet, and
 * - modules can still run for the subset of the runtime they exercise.
 *
 * Prefer implementing missing imports for production paths; stubbing can hide
 * real engine gaps.
 */
export const stubMissingImports = (
  imports: Record<string, any>,
  module: WebAssembly.Module,
  opts: StubMissingImportsOptions = {},
): void => {
  const {
    preferEnvForBlitz3d = false,
    ensureEnvMemory = false,
    envMemoryLimits = { initial: 256, maximum: 512 },
    stubGlobals = false,
    stubTables = false,
    stubMemory = false,
    caseInsensitive = false,
    defaultReturn = 0,
    onStub,
    onCallMissingFunction,
  } = opts;

  const required = WebAssembly.Module.imports(module);
  for (const imp of required) {
    if (preferEnvForBlitz3d && imp.module === "blitz3d") {
      const env = (imports as any).env;
      if (env && Object.prototype.hasOwnProperty.call(env, imp.name)) {
        if (!(imports as any).blitz3d) (imports as any).blitz3d = {};
        if (
          !Object.prototype.hasOwnProperty.call(
            (imports as any).blitz3d,
            imp.name,
          )
        ) {
          (imports as any).blitz3d[imp.name] = env[imp.name];
        }
      }
    }

    if (!(imp.module in imports)) imports[imp.module] = {};
    if (imp.name in imports[imp.module]) continue;

    if (caseInsensitive) {
      const want = imp.name.toLowerCase();
      const searchModules = [imp.module, "env", "blitz3d"];
      for (const m of searchModules) {
        const obj = (imports as any)[m];
        if (!obj || typeof obj !== "object") continue;
        try {
          for (const k of Object.keys(obj)) {
            if (k.toLowerCase() === want) {
              (imports as any)[imp.module][imp.name] = obj[k];
              // Found an implementation; stop searching.
              break;
            }
          }
        } catch {
          // ignore
        }
        if (imp.name in (imports as any)[imp.module]) break;
      }
      if (imp.name in (imports as any)[imp.module]) continue;
    }

    onStub?.({ module: imp.module, name: imp.name, kind: imp.kind });

    if (imp.name.toLowerCase() === "graphics3d") {
      console.log(
        `[DEBUG_STUB] stubMissingImports checking Graphics3D. Module=${imp.module}. Keys in imports[${imp.module}]:`,
        Object.keys(imports[imp.module] || {}),
      );
      console.log(
        `[DEBUG_STUB] imports.env keys:`,
        Object.keys((imports as any).env || {}),
      );
    }

    if (imp.kind === "function") {
      const key = `${imp.module}.${imp.name}`;
      imports[imp.module][imp.name] = (..._args: any[]) => {
        try {
          onCallMissingFunction?.({ key });
        } catch {}
        return defaultReturn;
      };
      continue;
    }

    if (imp.kind === "global") {
      if (stubGlobals) imports[imp.module][imp.name] = 0;
      continue;
    }

    if (imp.kind === "table") {
      if (stubTables) {
        imports[imp.module][imp.name] = new WebAssembly.Table({
          initial: 0,
          element: "anyfunc",
        });
      }
      continue;
    }

    if (imp.kind === "memory") {
      if (ensureEnvMemory) {
        const env = (imports as any).env ?? ((imports as any).env = {});
        if (!env.memory) {
          env.memory = new WebAssembly.Memory({
            initial: envMemoryLimits.initial,
            maximum: envMemoryLimits.maximum,
          });
        }
      }
      if (stubMemory) {
        const envMem = (imports as any).env?.memory;
        if (envMem && !imports[imp.module].memory) {
          imports[imp.module].memory = envMem;
        }
      }
      continue;
    }
  }
};
