import { installHeadlessEnv } from "./headless.ts";
import { Blitz3DCore } from "../../web/src/runtime/core.ts";
import { Blitz3DGraphics } from "../../web/src/runtime/graphics/index.ts";
import { Blitz3DFileIO } from "../../web/src/runtime/fileio.ts";

type Options = {
  wasmPath: string;
  exportName: string;
  initExport: string | null;
  iniPath: string | null;
  steps: number;
  checkEvery: number;
  settleMs: number;
  failOnGrowthBytes: number;
  wasmFailOnGrowthBytes: number;
  verbose: boolean;
  runtimeLogs: boolean;
};

const parseArgs = (args: string[]): Options => {
  const opts: Options = {
    wasmPath: "Main.leaktest.wasm",
    exportName: "__LeakTestStep%",
    initExport: null,
    iniPath: null,
    steps: 2000,
    checkEvery: 50,
    settleMs: 0,
    failOnGrowthBytes: 25 * 1024 * 1024,
    wasmFailOnGrowthBytes: 64 * 1024 * 1024,
    verbose: false,
    runtimeLogs: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--wasm") opts.wasmPath = args[++i] ?? opts.wasmPath;
    else if (a === "--export") opts.exportName = args[++i] ?? opts.exportName;
    else if (a === "--init") opts.initExport = args[++i] ?? opts.initExport;
    else if (a === "--ini") opts.iniPath = args[++i] ?? opts.iniPath;
    else if (a === "--steps") opts.steps = Number(args[++i] ?? opts.steps);
    else if (a === "--check-every") {
      opts.checkEvery = Number(args[++i] ?? opts.checkEvery);
    } else if (a === "--settle-ms") {
      opts.settleMs = Number(args[++i] ?? opts.settleMs);
    } else if (
      a === "--fail-on-growth-bytes" || a === "--heap-max-delta-bytes"
    ) {
      opts.failOnGrowthBytes = Number(args[++i] ?? opts.failOnGrowthBytes);
    } else if (a === "--wasm-fail-on-growth-bytes") {
      opts.wasmFailOnGrowthBytes = Number(
        args[++i] ?? opts.wasmFailOnGrowthBytes,
      );
    } else if (a === "--verbose") opts.verbose = true;
    else if (a === "--runtime-logs") opts.runtimeLogs = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "SCPCB churn test (headless): calls a WASM export repeatedly and asserts runtime maps stay clean.",
          "",
          "Usage:",
          "  deno run -A --sloppy-imports --node-modules-dir Tools/memleak/scpcb_churn.ts [options]",
          "",
          "Options:",
          "  --wasm <path>                  WASM path (default Main.leaktest.wasm)",
          "  --export <name>                export to call (default __LeakTestStep%)",
          "  --init <name>                  optional init export to call once (e.g. Main)",
          "  --ini <path>                   options.ini to preload into VFS (default: web/public/options.ini if present)",
          "  --steps <n>                    iterations (default 2000)",
          "  --check-every <n>              assert every N calls (default 50)",
          "  --settle-ms <n>                delay per step (default 0)",
          "  --fail-on-growth-bytes <n>     heap growth threshold (default 25MB)",
          "  --heap-max-delta-bytes <n>     alias for --fail-on-growth-bytes",
          "  --wasm-fail-on-growth-bytes <n>  WASM memory growth threshold (default 64MB)",
          "  --verbose                      log progress",
          "  --runtime-logs                 keep runtime console.log noise",
          "",
          "Notes:",
          "- For stable heap numbers, run with:",
          "    deno run -A --sloppy-imports --node-modules-dir --v8-flags=--expose-gc Tools/memleak/scpcb_churn.ts ...",
        ].join("\n"),
      );
      Deno.exit(0);
    }
  }

  if (!Number.isFinite(opts.steps) || opts.steps <= 0) opts.steps = 1;
  if (!Number.isFinite(opts.checkEvery) || opts.checkEvery <= 0) {
    opts.checkEvery = 1;
  }
  if (!Number.isFinite(opts.settleMs) || opts.settleMs < 0) opts.settleMs = 0;
  if (!Number.isFinite(opts.failOnGrowthBytes) || opts.failOnGrowthBytes < 0) {
    opts.failOnGrowthBytes = 0;
  }
  if (
    !Number.isFinite(opts.wasmFailOnGrowthBytes) ||
    opts.wasmFailOnGrowthBytes < 0
  ) {
    opts.wasmFailOnGrowthBytes = 0;
  }

  return opts;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const fmtBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};

const maybeGC = () => {
  try {
    (globalThis as any).gc?.();
  } catch {
    // ignore
  }
};

const countValues = (obj: unknown) => {
  if (!obj || typeof obj !== "object") return 0;
  return Object.values(obj as Record<string, unknown>).filter(Boolean).length;
};

const snapshotCounts = (graphics: Blitz3DGraphics) => {
  return {
    entities: countValues((graphics as any).entities),
    textures: countValues((graphics as any).textures),
    images: countValues((graphics as any).images),
  };
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

const stubMissingImports = (imports: any, module: WebAssembly.Module) => {
  for (const imp of WebAssembly.Module.imports(module)) {
    if (!(imp.module in imports)) imports[imp.module] = {};
    if (imp.name in imports[imp.module]) continue;
    if (imp.kind === "function") {
      imports[imp.module][imp.name] = (..._args: any[]) => 0;
    }
  }
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

const main = async () => {
  const opts = parseArgs(Deno.args);
  const headless = installHeadlessEnv();

  const originalLog = console.log.bind(console);
  if (!opts.runtimeLogs) {
    console.log = (...args: unknown[]) => {
      const msg = args[0];
      if (typeof msg === "string") {
        if (
          msg.startsWith("Loading Texture:") ||
          msg.startsWith("[TextureLoader] Loaded") ||
          msg.startsWith("FreeTexture:") ||
          msg.startsWith("init3D called") ||
          msg.startsWith("Canvas dimensions from core:") ||
          msg.startsWith("Three.js version:") ||
          msg.startsWith("THREE.Scene created") ||
          msg.startsWith("Creating WebGLRenderer") ||
          msg.startsWith("Animation system initialized") ||
          msg.startsWith("Animation loop started") ||
          msg.startsWith("--- Debug Frame") ||
          msg.startsWith("Loop Running.") ||
          msg.startsWith("Scene Children:")
        ) return;
      }
      originalLog(...args as any);
    };
  }

  const heapStart = Deno.memoryUsage().heapUsed;
  maybeGC();

  const core = new Blitz3DCore();
  const graphics = new Blitz3DGraphics(core);
  const fileIO = new Blitz3DFileIO(core);
  core.graphics = graphics;
  core.fileIO = fileIO;

  // SCPCB reads options.ini at module init time to set GraphicWidth/RealGraphicWidth/etc.
  // Preload it so menu/input helpers (e.g. ScaledMouseX) don't divide by 0.
  const defaultIni = "web/public/options.ini";
  const iniPath = opts.iniPath ?? (await (async () => {
    try {
      await Deno.stat(defaultIni);
      return defaultIni;
    } catch {
      return null;
    }
  })());
  if (iniPath) {
    try {
      const iniBytes = await Deno.readFile(iniPath);
      fileIO.registerFile("options.ini", iniBytes);
    } catch (e) {
      console.warn(`warn: failed to preload options.ini from ${iniPath}:`, e);
    }
  }

  core.init("canvas");
  graphics.init3D();

  const imports = setupImports(core, graphics, fileIO);

  const bytes = await Deno.readFile(opts.wasmPath);
  const module = await WebAssembly.compile(bytes);
  stubMissingImports(imports, module);
  const instance = await WebAssembly.instantiate(module, imports);
  attachRuntime(core, fileIO, instance);
  const wasmMemStart = core.memory?.buffer?.byteLength ?? 0;

  if (opts.initExport) {
    const initFn = (instance.exports as any)[opts.initExport];
    if (typeof initFn !== "function") {
      console.warn(`warn: init export not found: ${opts.initExport}`);
    } else {
      // SCPCB's init can enter tight "press any key" loops (DrawLoading(100,...)) and/or the launcher.
      // In headless mode the JS event loop can't deliver new input while WASM is running, so prime input.
      try {
        const g: any = graphics as any;
        g.keyQueue = g.keyQueue ?? [];
        g.keyQueue.push(13); // Enter
        g.keysHit = g.keysHit ?? {};
        g.keysHit[13] = (g.keysHit[13] ?? 0) + 1;
        g.keysDown = g.keysDown ?? {};
        g.keysDown[13] = true;
        g.mouseHit = g.mouseHit ?? {};
        g.mouseHit[1] = (g.mouseHit[1] ?? 0) + 1;
      } catch {
        // ignore
      }

      // Disable launcher loop by force (even if options.ini says otherwise).
      try {
        const launcher = (instance.exports as any).LauncherEnabled;
        if (launcher && typeof launcher === "object" && "value" in launcher) {
          (launcher as WebAssembly.Global).value = 0 as any;
        }
      } catch {
        // ignore
      }

      try {
        initFn();
      } catch (e: any) {
        if (e?.__blitz3dEnd || String(e) === "__BLITZ3D_END__") {
          // ok: SCPCB's init sometimes ends with `End` after establishing state.
        } else {
          throw e;
        }
      }
    }
  }

  const fn = (instance.exports as any)[opts.exportName];
  if (typeof fn !== "function") {
    console.error(`Missing export: ${opts.exportName}`);
    console.error(
      "Tip: run `deno run -A inspect_imports.ts <wasm>` or list exports via WebAssembly.Module.exports()",
    );
    Deno.exit(2);
  }

  const baseline = snapshotCounts(graphics);
  if (
    baseline.entities !== 0 || baseline.textures !== 0 || baseline.images !== 0
  ) {
    console.warn(`warn: non-zero baseline counts: ${JSON.stringify(baseline)}`);
  }

  for (let i = 1; i <= opts.steps; i++) {
    fn();
    // Allow async texture/image loader callbacks to run.
    await sleep(opts.settleMs);

    if (i % opts.checkEvery === 0 || i === opts.steps) {
      const now = snapshotCounts(graphics);
      const ok = now.entities === baseline.entities &&
        now.textures === baseline.textures &&
        now.images === baseline.images;
      if (!ok) {
        console.error(`FAIL: counts diverged at step ${i}`);
        console.error(
          `baseline=${JSON.stringify(baseline)} now=${JSON.stringify(now)}`,
        );
        Deno.exit(3);
      }
      if (opts.verbose) {
        const heapNow = Deno.memoryUsage().heapUsed;
        console.log(
          `step ${i}/${opts.steps}: heapUsed=${fmtBytes(heapNow)} (Δ ${
            fmtBytes(heapNow - heapStart)
          })`,
        );
      }
    }
  }

  // Final settle and cleanup.
  await sleep(10);
  maybeGC();
  await sleep(0);

  const finalCounts = snapshotCounts(graphics);
  if (
    finalCounts.entities !== baseline.entities ||
    finalCounts.textures !== baseline.textures ||
    finalCounts.images !== baseline.images
  ) {
    console.error("FAIL: counts diverged after final settle");
    console.error(
      `baseline=${JSON.stringify(baseline)} now=${JSON.stringify(finalCounts)}`,
    );
    Deno.exit(3);
  }

  graphics.dispose?.();
  fileIO.dispose?.({ clearCache: true });
  core.dispose?.();

  const heapEnd = Deno.memoryUsage().heapUsed;
  const growth = heapEnd - heapStart;
  const wasmMemEnd = core.memory?.buffer?.byteLength ?? wasmMemStart;
  const wasmGrowth = wasmMemEnd - wasmMemStart;

  const okListeners = headless.getActiveListenerCount() === 0;
  const okRaf = headless.getActiveRafCount() === 0;

  originalLog(`wasm: ${opts.wasmPath}`);
  originalLog(`export: ${opts.exportName}`);
  originalLog(`steps: ${opts.steps}`);
  originalLog(
    `heapUsed: ${fmtBytes(heapStart)} -> ${fmtBytes(heapEnd)} (Δ ${
      fmtBytes(growth)
    })`,
  );
  originalLog(
    `wasmMemory: ${fmtBytes(wasmMemStart)} -> ${fmtBytes(wasmMemEnd)} (Δ ${
      fmtBytes(wasmGrowth)
    })`,
  );
  originalLog(
    `listenersActive: ${headless.getActiveListenerCount()} rafActive: ${headless.getActiveRafCount()}`,
  );

  if (!okListeners || !okRaf) {
    console.error("FAIL: retained RAF/listeners after dispose");
    Deno.exit(4);
  }

  if (growth > opts.failOnGrowthBytes) {
    console.error(
      `FAIL: heap growth exceeds threshold (${
        fmtBytes(opts.failOnGrowthBytes)
      })`,
    );
    Deno.exit(5);
  }

  if (wasmGrowth > opts.wasmFailOnGrowthBytes) {
    console.error(
      `FAIL: WASM memory growth exceeds threshold (${
        fmtBytes(opts.wasmFailOnGrowthBytes)
      })`,
    );
    Deno.exit(6);
  }

  originalLog("OK: SCPCB churn completed with clean runtime counts");
};

await main();
