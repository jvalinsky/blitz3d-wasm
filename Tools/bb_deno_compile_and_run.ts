// Blitz3D → WASM compile-and-run helper for Deno
//
// Usage (from repo root):
//   deno run -A Tools/bb_deno_compile_and_run.ts path/to/program.bb
//   # optionally override compiler binary path:
//   # BLITZ3D_COMPILER=/absolute/path/to/blitz3d-wasm deno run -A ...
//
// This script:
//   1. Uses the native Swift Blitz3D compiler binary to compile .bb → WASM
//   2. Loads the compiled WASM with a tiny env runtime (Print / PrintInt / PrintFloat)
//   3. Runs its `main` (or `_start`) export and prints output to the Deno console
//
// Note: Uses the native compiler binary (not compiler WASM) because the compiler
// WASM module is too large for WebAssembly instantiation limits.

import { join } from "std/path/mod.ts";

const verbose = (Deno.env.get("BB_DENO_VERBOSE") ?? "1") !== "0";
const timeoutMs = Number(Deno.env.get("BB_DENO_TIMEOUT_MS") ?? "2000");
const debugBuild = (Deno.env.get("BB_DENO_DEBUG") ?? "0") === "1";
const bbdbgLog = (Deno.env.get("BB_DENO_BBDBG_LOG") ?? "0") === "1";

async function compileWithNativeCompiler(
  compilerPath: string,
  bbPath: string,
  outputPath: string,
): Promise<void> {
  const cmd = new Deno.Command(compilerPath, {
    args: [bbPath, "-o", outputPath, ...(debugBuild ? ["-d"] : [])],
    stdout: "piped",
    stderr: "piped",
  });

  const { code, stdout, stderr } = await cmd.output();

  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    throw new Error(`Compiler failed (exit ${code}):\n${errorText}`);
  }

  const outputText = new TextDecoder().decode(stdout);
  if (outputText.trim()) {
    if (verbose) console.log(outputText.trim());
  }
}

type WorkerToMainMessage =
  | { type: "stdout"; line: string }
  | { type: "warn"; line: string }
  | { type: "error"; message: string; stack?: string }
  | { type: "done" };

type MainToWorkerMessage = {
  type: "run";
  wasmBytes: Uint8Array;
  bbdbgJson?: string;
};

function isWorkerMode(): boolean {
  return new URL(import.meta.url).searchParams.get("bb_deno_worker") === "1";
}

async function runCompiledProgramInWorker(
  wasmBytes: Uint8Array,
  bbdbgJson?: string,
): Promise<void> {
  const workerUrl = new URL(import.meta.url);
  workerUrl.searchParams.set("bb_deno_worker", "1");

  const worker = new Worker(workerUrl.href, {
    type: "module",
  });

  const decoder = new TextDecoder();
  let timeoutHandle: number | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          worker.terminate();
          reject(
            new Error(
              `Execution timed out after ${timeoutMs}ms (BB_DENO_TIMEOUT_MS).`,
            ),
          );
        }, timeoutMs) as unknown as number;
      }

      worker.onmessage = (evt: MessageEvent<WorkerToMainMessage>) => {
        const msg = evt.data;
        switch (msg.type) {
          case "stdout":
            console.log(msg.line);
            break;
          case "warn":
            console.warn(msg.line);
            break;
          case "error": {
            const details = msg.stack ? `\n${msg.stack}` : "";
            reject(new Error(`${msg.message}${details}`));
            break;
          }
          case "done":
            resolve();
            break;
        }
      };
      worker.onerror = (evt) => {
        reject(new Error(`Worker error: ${evt.message}`));
      };
      const payload: MainToWorkerMessage = bbdbgJson
        ? { type: "run", wasmBytes, bbdbgJson }
        : { type: "run", wasmBytes };
      // Transfer the ArrayBuffer so the worker can’t accidentally retain parent memory.
      worker.postMessage(payload, [wasmBytes.buffer]);
      // Keep decoder referenced to avoid Deno tree-shaking weirdness in older configs.
      void decoder;
    });
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    worker.terminate();
  }
}

async function runCompiledProgram(
  wasmBytes: Uint8Array,
  emit: (line: string) => void,
  warn: (line: string) => void,
  bbdbgJson?: string,
) {
  // First, compile the module to inspect its imports
  const module = await WebAssembly.compile(wasmBytes);

  // Get import requirements
  const importDescs = WebAssembly.Module.imports(module);

  const imports: Record<string, Record<string, WebAssembly.ImportValue>> = {
    env: {},
    blitz3d: {},
    al: {},
    bbdbg: {},
  };

  // Best-effort bbdbg: if compiled with `-d/--debug`, the module will call these hooks.
  // This is intentionally minimal: it’s mainly for smoke-testing debug builds without a browser.
  const bbdbgFileMap = new Map<number, string>();
  const bbdbgFuncMap = new Map<number, { id: number; name: string }>();
  const bbdbgCallStack: Array<{ funcId: number; name: string }> = [];
  let bbdbgLast: { fileId: number; line: number } | null = null;

  if (bbdbgJson) {
    try {
      const meta = JSON.parse(bbdbgJson) as any;
      const files = Array.isArray(meta?.files) ? meta.files : [];
      const funcs = Array.isArray(meta?.functions) ? meta.functions : [];
      for (const f of files) {
        const id = Number(f?.id ?? 0) | 0;
        const p = String(f?.path ?? "");
        if (id > 0 && p) bbdbgFileMap.set(id, p);
      }
      for (const fn of funcs) {
        const id = Number(fn?.id ?? 0) | 0;
        const name = String(fn?.name ?? "");
        if (id >= 0 && name) bbdbgFuncMap.set(id, { id, name });
      }
    } catch {}
  }

  const bbdbgFilePath = (id: number) =>
    bbdbgFileMap.get(id | 0) ?? `file_${id | 0}`;
  const bbdbgFuncName = (id: number) =>
    bbdbgFuncMap.get(id | 0)?.name ?? `func_${id | 0}`;

  imports.bbdbg.__bbdbg_enter = (funcId: number) => {
    const id = funcId | 0;
    bbdbgCallStack.push({ funcId: id, name: bbdbgFuncName(id) });
  };
  imports.bbdbg.__bbdbg_leave = (_funcId: number) => {
    bbdbgCallStack.pop();
  };
  imports.bbdbg.__bbdbg_stmt = (fileId: number, line: number) => {
    bbdbgLast = { fileId: fileId | 0, line: line | 0 };
    if (bbdbgLog) emit(`[bbdbg] ${bbdbgFilePath(fileId)}:${line | 0}`);
  };

  const functions = {
    decodeB3DString: (ptr: number, memory: WebAssembly.Memory): string => {
      if (!ptr) return "";
      const buf = memory.buffer;
      if (ptr < 0 || ptr + 8 > buf.byteLength) {
        return `<invalid_str_ptr:${ptr}>`;
      }
      const view = new DataView(buf);
      const len = view.getInt32(ptr + 4, true);
      if (len < 0 || ptr + 8 + len > buf.byteLength) {
        return `<invalid_str_len:${ptr}:${len}>`;
      }
      const bytes = new Uint8Array(buf, ptr + 8, len);
      return new TextDecoder().decode(bytes);
    },
    allocB3DString: (text: string): number => {
      if (!runtimeInstance) return 0;
      const alloc = runtimeInstance.exports.__StringAlloc as
        | ((len: number) => number)
        | undefined;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      if (typeof alloc !== "function") return 0;

      const utf8 = new TextEncoder().encode(text);
      const ptr = alloc(utf8.length);
      const view = new DataView(memory.buffer);
      view.setInt32(ptr + 0, 1, true); // refcount
      view.setInt32(ptr + 4, utf8.length, true); // length
      new Uint8Array(memory.buffer, ptr + 8, utf8.length).set(utf8);
      new Uint8Array(memory.buffer, ptr + 8 + utf8.length, 1)[0] = 0;
      return ptr;
    },
    Print: (ptr: number, memory: WebAssembly.Memory) => {
      emit(functions.decodeB3DString(ptr, memory));
    },
    PrintInt: (val: number) => {
      emit(String(val));
    },
    PrintFloat: (val: number) => {
      emit(String(val));
    },
  };

  let runtimeInstance: WebAssembly.Instance | null = null;

  // Add memory first (needed before we can use it)
  imports.env.memory = new WebAssembly.Memory({ initial: 256, maximum: 512 });

  // Add Print functions to both env and blitz3d namespaces
  const printFunc = (ptr: number) => {
    if (!runtimeInstance) return;
    const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
    functions.Print(ptr, memory);
  };

  imports.env.Print = printFunc;
  imports.env.PrintString = printFunc;
  imports.env.PrintInt = functions.PrintInt;
  imports.env.PrintFloat = functions.PrintFloat;
  imports.blitz3d.Print = printFunc;
  imports.blitz3d.PrintString = printFunc;
  imports.blitz3d.PrintInt = functions.PrintInt;
  imports.blitz3d.PrintFloat = functions.PrintFloat;

  // Minimal string conversion helpers used by the compiler for `"x=" + i` style output.
  const intToStringFunc = (val: number) => {
    if (!runtimeInstance) return 0;
    const alloc = runtimeInstance.exports.__StringAlloc as
      | ((len: number) => number)
      | undefined;
    const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
    if (typeof alloc !== "function") return 0;

    const text = `${val | 0}`;
    const utf8 = new TextEncoder().encode(text);
    const ptr = alloc(utf8.length);
    const view = new DataView(memory.buffer);
    view.setInt32(ptr + 0, 1, true); // refcount
    view.setInt32(ptr + 4, utf8.length, true); // length
    new Uint8Array(memory.buffer, ptr + 8, utf8.length).set(utf8);
    new Uint8Array(memory.buffer, ptr + 8 + utf8.length, 1)[0] = 0;
    return ptr;
  };

  const floatToStringFunc = (val: number) => {
    if (!runtimeInstance) return 0;
    const alloc = runtimeInstance.exports.__StringAlloc as
      | ((len: number) => number)
      | undefined;
    const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
    if (typeof alloc !== "function") return 0;

    const text = `${val}`;
    const utf8 = new TextEncoder().encode(text);
    const ptr = alloc(utf8.length);
    const view = new DataView(memory.buffer);
    view.setInt32(ptr + 0, 1, true); // refcount
    view.setInt32(ptr + 4, utf8.length, true); // length
    new Uint8Array(memory.buffer, ptr + 8, utf8.length).set(utf8);
    new Uint8Array(memory.buffer, ptr + 8 + utf8.length, 1)[0] = 0;
    return ptr;
  };

  imports.env.IntToString = intToStringFunc;
  imports.env.FloatToString = floatToStringFunc;
  imports.blitz3d.IntToString = intToStringFunc;
  imports.blitz3d.FloatToString = floatToStringFunc;

  // String built-ins used by many smoke scripts (keeps Deno runner closer to web interpreter behavior).
  const stringBuiltins = {
    Len: (ptr: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      return functions.decodeB3DString(ptr | 0, memory).length | 0;
    },
    Trim: (ptr: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory).trim();
      return functions.allocB3DString(s);
    },
    Upper: (ptr: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory).toUpperCase();
      return functions.allocB3DString(s);
    },
    Lower: (ptr: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory).toLowerCase();
      return functions.allocB3DString(s);
    },
    Left: (ptr: number, n: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory);
      return functions.allocB3DString(s.substring(0, n | 0));
    },
    Right: (ptr: number, n: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory);
      const count = n | 0;
      return functions.allocB3DString(
        s.substring(Math.max(0, s.length - count)),
      );
    },
    Mid: (ptr: number, start: number, len: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory);
      const st = (start | 0) - 1;
      const ln = len | 0;
      return functions.allocB3DString(
        s.substring(Math.max(0, st), Math.max(0, st) + ln),
      );
    },
    Instr: (ptr1: number, ptr2: number, start?: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr1 | 0, memory);
      const find = functions.decodeB3DString(ptr2 | 0, memory);
      const startIdx = Math.max(0, ((start ?? 1) | 0) - 1);
      const idx = s.indexOf(find, startIdx);
      return idx === -1 ? 0 : (idx + 1) | 0;
    },
    Replace: (ptr: number, findPtr: number, replPtr: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory);
      const find = functions.decodeB3DString(findPtr | 0, memory);
      const repl = functions.decodeB3DString(replPtr | 0, memory);
      return functions.allocB3DString(s.split(find).join(repl));
    },
    Chr: (code: number) =>
      functions.allocB3DString(String.fromCharCode(code | 0)),
    Asc: (ptr: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory);
      return s.length ? (s.charCodeAt(0) | 0) : 0;
    },
    String: (ptr: number, count: number) => {
      if (!runtimeInstance) return 0;
      const memory = runtimeInstance.exports.memory as WebAssembly.Memory;
      const s = functions.decodeB3DString(ptr | 0, memory);
      return functions.allocB3DString(s.repeat(Math.max(0, count | 0)));
    },
  } as const;

  for (const [name, fn] of Object.entries(stringBuiltins)) {
    imports.blitz3d[name] = fn as unknown as WebAssembly.ImportValue;
    imports.env[name] = fn as unknown as WebAssembly.ImportValue;
  }

  // Stub all other imports with no-ops or default values
  for (const imp of importDescs) {
    const moduleName = imp.module;
    const fieldName = imp.name;
    const kind = imp.kind;

    if (!imports[moduleName]) {
      imports[moduleName] = {};
    }

    // Skip if we already have it
    if (imports[moduleName][fieldName]) {
      continue;
    }

    // Provide stubs based on kind
    if (kind === "function") {
      imports[moduleName][fieldName] = () => {
        // Silent stub - most functions can be no-ops for simple text programs
      };
    } else if (kind === "memory") {
      if (!imports[moduleName].memory) {
        imports[moduleName].memory = imports.env.memory;
      }
    } else if (kind === "table") {
      if (!imports[moduleName].table) {
        imports[moduleName].table = new WebAssembly.Table({
          initial: 0,
          element: "anyfunc",
        });
      }
    } else if (kind === "global") {
      imports[moduleName][fieldName] = 0; // Default to 0 for globals
    }
  }

  const { instance } = await WebAssembly.instantiate(wasmBytes, imports);
  runtimeInstance = instance;

  // Try common entry point names
  const entryPoints = ["main", "_start", "Main", "Main_", "__main"];
  let executed = false;

  for (const name of entryPoints) {
    const exportFn = instance.exports[name] as (() => void) | undefined;
    if (typeof exportFn === "function") {
      exportFn();
      executed = true;
      break;
    }
  }

  if (!executed) {
    const exportNames = Object.keys(instance.exports);
    warn(
      `No entry point found. Available exports: ${
        exportNames.slice(0, 20).join(", ")
      }${exportNames.length > 20 ? "..." : ""}`,
    );
    warn(
      "The program may need to be called explicitly via one of its exports.",
    );
  }

  if (debugBuild && bbdbgLast) {
    const loc = `${bbdbgFilePath(bbdbgLast.fileId)}:${bbdbgLast.line | 0}`;
    const stack = bbdbgCallStack.map((f) => f.name).reverse().join(" -> ");
    warn(`[bbdbg] last location: ${loc}${stack ? ` stack=${stack}` : ""}`);
  }
}

async function main() {
  if (Deno.args.length < 1) {
    console.error(
      "Usage: deno run -A Tools/bb_deno_compile_and_run.ts path/to/program.bb",
    );
    Deno.exit(1);
  }

  // Resolve repo root (Tools/bb_deno_compile_and_run.ts -> Tools -> repo root)
  const scriptDir = new URL(".", import.meta.url).pathname;
  const repoRoot = join(scriptDir, "..");

  // Resolve bbPath: if absolute, use as-is; if relative, resolve from repo root
  const bbPathArg = Deno.args[0];
  const bbPath = bbPathArg.startsWith("/")
    ? bbPathArg
    : join(repoRoot, bbPathArg);

  // Resolve native compiler binary path - check multiple possible locations
  const possiblePaths = [
    Deno.env.get("BLITZ3D_COMPILER"),
    join(repoRoot, ".build", "debug", "blitz3d-wasm"),
    join(repoRoot, ".build", "arm64-apple-macosx", "debug", "blitz3d-wasm"),
    join(repoRoot, ".build", "x86_64-apple-macosx", "debug", "blitz3d-wasm"),
  ].filter((p): p is string => p !== undefined);

  let compilerPath: string | null = null;
  for (const path of possiblePaths) {
    try {
      const stat = await Deno.stat(path);
      if (stat.isFile) {
        compilerPath = path;
        break;
      }
    } catch {
      // Try next path
    }
  }

  if (!compilerPath) {
    console.error("Compiler binary not found. Tried:");
    for (const path of possiblePaths) {
      console.error(`  - ${path}`);
    }
    console.error(
      "\nThe compiler executable 'blitz3d-wasm' needs to be built.",
    );
    console.error(
      "\nNote: The current Package.swift only builds the engine, not the compiler.",
    );
    console.error("To build the compiler, you may need to:");
    console.error(
      "  1. Restore a Package.swift that includes the compiler executable",
    );
    console.error("  2. Or build from a different package/directory");
    console.error("\nThe compiler source is at: Tools/wasm-cli/main.swift");
    console.error(
      "\nOr set BLITZ3D_COMPILER environment variable to point to an existing compiler binary.",
    );
    Deno.exit(1);
  }

  if (verbose) {
    console.log(`Using compiler: ${compilerPath}`);
    console.log(`Reading Blitz3D source: ${bbPath}`);
  }

  // Create temp output file
  const tempWasm = await Deno.makeTempFile({ suffix: ".wasm" });
  const tempBbdbg = tempWasm.replace(/\.wasm$/i, ".bbdbg.json");

  try {
    // Compile using native compiler
    await compileWithNativeCompiler(compilerPath, bbPath, tempWasm);

    // Read compiled WASM
    const wasmBytes = await Deno.readFile(tempWasm);
    if (verbose) {
      console.log(
        `Compilation succeeded, wasm size = ${wasmBytes.length} bytes`,
      );
    }

    // Run the compiled program
    let bbdbgJson: string | undefined;
    if (debugBuild) {
      try {
        bbdbgJson = await Deno.readTextFile(tempBbdbg);
        if (verbose) {
          console.log(`Loaded bbdbg metadata (${bbdbgJson.length} bytes)`);
        }
      } catch {}
    }
    await runCompiledProgramInWorker(wasmBytes, bbdbgJson);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error),
    );
    Deno.exit(1);
  } finally {
    // Cleanup
    try {
      await Deno.remove(tempWasm);
    } catch {
      // Ignore cleanup errors
    }
    try {
      await Deno.remove(tempBbdbg);
    } catch {
      // Ignore cleanup errors
    }
  }
}

if (import.meta.main) {
  if (isWorkerMode()) {
    const post = (msg: WorkerToMainMessage) =>
      (globalThis as unknown as DedicatedWorkerGlobalScope).postMessage(msg);
    const emit = (line: string) => post({ type: "stdout", line });
    const warn = (line: string) => post({ type: "warn", line });

    (globalThis as unknown as DedicatedWorkerGlobalScope).onmessage = async (
      evt: MessageEvent<MainToWorkerMessage>,
    ) => {
      if (evt.data?.type !== "run") return;
      try {
        await runCompiledProgram(
          evt.data.wasmBytes,
          emit,
          warn,
          evt.data.bbdbgJson,
        );
        post({ type: "done" });
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        post({ type: "error", message: e.message, stack: e.stack });
      }
    };
  } else {
    await main();
  }
}
