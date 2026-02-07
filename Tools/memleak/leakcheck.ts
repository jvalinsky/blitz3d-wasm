import { installHeadlessEnv } from "./headless.ts";
import { Blitz3DCore } from "../../web/src/runtime/core.ts";
import { Blitz3DGraphics } from "../../web/src/runtime/graphics/index.ts";
import { Blitz3DFileIO } from "../../web/src/runtime/fileio.ts";

type LeakcheckOptions = {
  wasmPath?: string;
  cycles: number;
  settleMs: number;
  callExport?: string;
  callCount: number;
  failOnGrowthBytes: number;
  verbose: boolean;
};

const parseArgs = (args: string[]): LeakcheckOptions => {
  const opts: LeakcheckOptions = {
    cycles: 5,
    settleMs: 5,
    callCount: 0,
    failOnGrowthBytes: 10 * 1024 * 1024,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--wasm") opts.wasmPath = args[++i];
    else if (a === "--cycles") opts.cycles = Number(args[++i] ?? "5");
    else if (a === "--settle-ms") opts.settleMs = Number(args[++i] ?? "5");
    else if (a === "--call-export") opts.callExport = args[++i];
    else if (a === "--call-count") opts.callCount = Number(args[++i] ?? "0");
    else if (a === "--fail-on-growth-bytes") {
      opts.failOnGrowthBytes = Number(
        args[++i] ?? String(opts.failOnGrowthBytes),
      );
    } else if (a === "--verbose") opts.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Deno headless leakcheck (no browser)",
          "",
          "Usage:",
          "  deno run -A --node-modules-dir Tools/memleak/leakcheck.ts [options]",
          "",
          "Options:",
          "  --wasm <path>                 Optional WASM file to instantiate",
          "  --cycles <n>                  Create+dispose cycles (default 5)",
          "  --settle-ms <n>               Delay between phases (default 5)",
          "  --call-export <name>          Export to call after instantiate (optional)",
          "  --call-count <n>              Times to call export (default 0)",
          "  --fail-on-growth-bytes <n>    Heap growth threshold (default 10MB)",
          "  --verbose                     Extra logging",
          "",
          "Notes:",
          "- For more stable heap numbers, run with:",
          "    deno run -A --node-modules-dir --v8-flags=--expose-gc Tools/memleak/leakcheck.ts ...",
        ].join("\n"),
      );
      Deno.exit(0);
    }
  }

  if (!Number.isFinite(opts.cycles) || opts.cycles <= 0) opts.cycles = 1;
  if (!Number.isFinite(opts.settleMs) || opts.settleMs < 0) opts.settleMs = 0;
  if (!Number.isFinite(opts.callCount) || opts.callCount < 0) {
    opts.callCount = 0;
  }
  if (!Number.isFinite(opts.failOnGrowthBytes) || opts.failOnGrowthBytes < 0) {
    opts.failOnGrowthBytes = 0;
  }

  return opts;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

type CycleResult = {
  cycle: number;
  heapUsedBefore: number;
  heapUsedAfterDispose: number;
  heapDelta: number;
  listenersAfterDispose: number;
  rafAfterDispose: number;
  graphicsCountsAfterDispose: {
    entities: number;
    textures: number;
    images: number;
  };
  wasmMemoryBytes: number | null;
  errors: string[];
};

const setupImports = (
  core: Blitz3DCore,
  graphics: Blitz3DGraphics,
  fileIO: Blitz3DFileIO,
) => {
  const imports: any = {
    env: {
      __indirect_function_table: new WebAssembly.Table({
        initial: 0,
        element: "anyfunc",
      }),
    },
    blitz3d: {},
  };

  core.setupCommonImports?.(imports);
  graphics.setupImports?.(imports);
  fileIO.setupImports?.(imports);

  return imports;
};

const attachRuntime = (
  core: Blitz3DCore,
  fileIO: Blitz3DFileIO,
  instance: WebAssembly.Instance,
) => {
  core.memory = instance.exports.memory as WebAssembly.Memory;
  core.instance = instance;
  core.exports = instance.exports;

  core.allocString = (str: string) => {
    const alloc = instance.exports.__StringAlloc as
      | undefined
      | ((n: number) => number);
    if (!alloc) return 0;
    const ptr = alloc(str.length);
    const view = new DataView(core.memory.buffer);
    view.setInt32(ptr + 0, 1, true);
    view.setInt32(ptr + 4, str.length, true);
    const mem = new Uint8Array(core.memory.buffer, ptr + 8, str.length + 1);
    for (let i = 0; i < str.length; i++) mem[i] = str.charCodeAt(i) & 0xff;
    mem[str.length] = 0;
    return ptr;
  };

  fileIO.setMemory(core.memory);
};

const stubMissingImports = (imports: any, module: WebAssembly.Module) => {
  const requiredImports = WebAssembly.Module.imports(module);
  for (const imp of requiredImports) {
    if (!(imp.module in imports)) imports[imp.module] = {};
    if (imp.name in imports[imp.module]) continue;
    if (imp.kind === "function") {
      imports[imp.module][imp.name] = (..._args: any[]) => 0;
    }
  }
};

const instantiateOptionalWasm = async (
  wasmPath: string,
  imports: any,
): Promise<WebAssembly.Instance> => {
  const bytes = await Deno.readFile(wasmPath);
  const module = await WebAssembly.compile(bytes);
  stubMissingImports(imports, module);
  return await WebAssembly.instantiate(module, imports);
};

const main = async () => {
  const opts = parseArgs(Deno.args);

  const headless = installHeadlessEnv();

  const results: CycleResult[] = [];

  let firstHeap = 0;
  let lastHeap = 0;

  for (let cycle = 1; cycle <= opts.cycles; cycle++) {
    const errors: string[] = [];

    headless.reset();

    const heapBefore = Deno.memoryUsage().heapUsed;
    if (cycle === 1) firstHeap = heapBefore;

    const core = new Blitz3DCore();
    const graphics = new Blitz3DGraphics(core);
    const fileIO = new Blitz3DFileIO(core);
    core.graphics = graphics;
    core.fileIO = fileIO;

    try {
      core.init("canvas");
    } catch (e) {
      errors.push(`core.init failed: ${String(e)}`);
    }

    try {
      graphics.init3D();
      // SetupImports installs input listeners; do it early to validate teardown.
      setupImports(core, graphics, fileIO);
    } catch (e) {
      errors.push(`graphics init/setup failed: ${String(e)}`);
    }

    let instance: WebAssembly.Instance | null = null;
    if (opts.wasmPath) {
      try {
        const imports = setupImports(core, graphics, fileIO);
        instance = await instantiateOptionalWasm(opts.wasmPath, imports);
        attachRuntime(core, fileIO, instance);
      } catch (e) {
        errors.push(`wasm instantiate failed: ${String(e)}`);
      }
    }

    if (instance && opts.callExport && opts.callCount > 0) {
      const fn = (instance.exports as any)[opts.callExport];
      if (typeof fn !== "function") {
        errors.push(`export not found or not a function: ${opts.callExport}`);
      } else {
        try {
          for (let i = 0; i < opts.callCount; i++) fn();
        } catch (e) {
          errors.push(`export call failed (${opts.callExport}): ${String(e)}`);
        }
      }
    }

    await sleep(opts.settleMs);

    try {
      graphics.dispose?.();
    } catch (e) {
      errors.push(`graphics.dispose failed: ${String(e)}`);
    }
    try {
      fileIO.dispose?.({ clearCache: true });
    } catch (e) {
      errors.push(`fileIO.dispose failed: ${String(e)}`);
    }
    try {
      core.dispose?.();
    } catch (e) {
      errors.push(`core.dispose failed: ${String(e)}`);
    }

    // Encourage GC if available.
    try {
      (globalThis as any).gc?.();
    } catch {
      // ignore
    }

    await sleep(opts.settleMs);

    const heapAfter = Deno.memoryUsage().heapUsed;
    lastHeap = heapAfter;

    const entitiesCount =
      Object.values((graphics as any).entities ?? {}).filter(Boolean).length;
    const texturesCount =
      Object.values((graphics as any).textures ?? {}).filter(Boolean).length;
    const imagesCount =
      Object.values((graphics as any).images ?? {}).filter(Boolean).length;

    const wasmMemBytes = instance
      ? (core.memory?.buffer?.byteLength ?? null)
      : null;

    const result: CycleResult = {
      cycle,
      heapUsedBefore: heapBefore,
      heapUsedAfterDispose: heapAfter,
      heapDelta: heapAfter - heapBefore,
      listenersAfterDispose: headless.getActiveListenerCount(),
      rafAfterDispose: headless.getActiveRafCount(),
      graphicsCountsAfterDispose: {
        entities: entitiesCount,
        textures: texturesCount,
        images: imagesCount,
      },
      wasmMemoryBytes: wasmMemBytes,
      errors,
    };
    results.push(result);

    if (opts.verbose) {
      console.log(
        `cycle ${cycle}: heap ${fmtBytes(heapBefore)} -> ${
          fmtBytes(heapAfter)
        } (Δ ${fmtBytes(result.heapDelta)}), ` +
          `listeners=${result.listenersAfterDispose}, raf=${result.rafAfterDispose}, ` +
          `entities=${entitiesCount}, textures=${texturesCount}, images=${imagesCount}` +
          (wasmMemBytes != null ? `, wasmMem=${fmtBytes(wasmMemBytes)}` : ""),
      );
      for (const err of errors) console.warn(`  - ${err}`);
    }

    const hardLeaks = result.listenersAfterDispose !== 0 ||
      result.rafAfterDispose !== 0 ||
      result.graphicsCountsAfterDispose.entities !== 0 ||
      result.graphicsCountsAfterDispose.textures !== 0 ||
      result.graphicsCountsAfterDispose.images !== 0;

    if (hardLeaks) {
      console.error(`FAIL: resources retained after dispose (cycle ${cycle})`);
      console.error(JSON.stringify(result, null, 2));
      Deno.exit(2);
    }
  }

  const totalGrowth = lastHeap - firstHeap;
  const growthOk = totalGrowth <= opts.failOnGrowthBytes;

  console.log(`cycles: ${opts.cycles}`);
  console.log(
    `heapUsed: ${fmtBytes(firstHeap)} -> ${fmtBytes(lastHeap)} (Δ ${
      fmtBytes(totalGrowth)
    })`,
  );
  if (opts.wasmPath) console.log(`wasm: ${opts.wasmPath}`);

  if (!growthOk) {
    console.error(
      `FAIL: heap growth exceeds threshold (${
        fmtBytes(opts.failOnGrowthBytes)
      })`,
    );
    console.error(
      JSON.stringify({ firstHeap, lastHeap, totalGrowth, results }, null, 2),
    );
    Deno.exit(3);
  }

  console.log("OK: no retained JS resources detected across cycles");
};

await main();
