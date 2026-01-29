type Options = {
  wasmPath: string;
  initExport: string | null;
  callExport: string;
  iterations: number;
  timeoutMs: number;
  verbose: boolean;
};

const parseArgs = (args: string[]): Options => {
  const opts: Options = {
    wasmPath: "web/public/scpcb.wasm",
    initExport: null,
    callExport: "UpdateGame",
    iterations: 1,
    timeoutMs: 2000,
    verbose: false,
  };

  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") continue;
    if (a === "--wasm") opts.wasmPath = args[++i] ?? opts.wasmPath;
    else if (a === "--init") opts.initExport = args[++i] ?? opts.initExport;
    else if (a === "--call") opts.callExport = args[++i] ?? opts.callExport;
    else if (a === "--iterations") opts.iterations = Number(args[++i] ?? opts.iterations);
    else if (a === "--timeout-ms") opts.timeoutMs = Number(args[++i] ?? opts.timeoutMs);
    else if (a === "--verbose") opts.verbose = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Run a WASM export in a dedicated Worker with a watchdog timeout (to detect hangs).",
          "",
          "Usage:",
          "  deno run -A Tools/memleak/wasm_timeout_probe.ts [options]",
          "",
          "Options:",
          "  --wasm <path>        wasm file path (default web/public/scpcb.wasm)",
          "  --init <export>      optional init export (e.g. Main)",
          "  --call <export>      export to call (default UpdateGame)",
          "  --iterations <n>     number of calls (default 1)",
          "  --timeout-ms <n>     watchdog timeout (default 2000)",
          "  --verbose            print per-iter timings",
        ].join("\n"),
      );
      Deno.exit(0);
    } else if (a.startsWith("-")) {
      console.error(`Unknown flag: ${a}`);
      Deno.exit(2);
    } else {
      positional.push(a);
    }
  }

  if (positional.length && !args.includes("--wasm")) opts.wasmPath = positional[0]!;
  if (!Number.isFinite(opts.iterations) || opts.iterations < 1) opts.iterations = 1;
  if (!Number.isFinite(opts.timeoutMs) || opts.timeoutMs < 10) opts.timeoutMs = 10;

  return opts;
};

type WorkerReady = { type: "ready" };
type WorkerLog = { type: "log"; msg: string };
type WorkerOk = { type: "ok"; iter: number; ms: number };
type WorkerErr = { type: "error"; err: string };
type WorkerMsg = WorkerReady | WorkerLog | WorkerOk | WorkerErr;

const main = async () => {
  const raw = Deno.args.includes("--")
    ? Deno.args.slice(Deno.args.indexOf("--") + 1)
    : Deno.args;
  const opts = parseArgs(raw);

  const bytes = await Deno.readFile(opts.wasmPath);
  const wasmBytes = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

  const worker = new Worker(
    new URL("./wasm_timeout_probe.worker.ts", import.meta.url),
    { type: "module", deno: { namespace: true } as any },
  );

  let lastProgress = Date.now();
  let completed = 0;
  let resolved = false;

  const stop = (code: number, msg?: string) => {
    if (resolved) return;
    resolved = true;
    try {
      worker.terminate();
    } catch {
      // ignore
    }
    if (msg) console.log(msg);
    Deno.exit(code);
  };

  const watchdog = setInterval(() => {
    if (resolved) return;
    const age = Date.now() - lastProgress;
    if (age > opts.timeoutMs) {
      stop(3, `FAIL: timed out after ${opts.timeoutMs}ms (completed ${completed}/${opts.iterations})`);
    }
  }, 25);

  worker.onmessage = (ev: MessageEvent<WorkerMsg>) => {
    lastProgress = Date.now();
    const m = ev.data;
    if (m.type === "ready") return;
    if (m.type === "log") {
      console.log(m.msg);
      return;
    }
    if (m.type === "error") {
      clearInterval(watchdog);
      stop(2, `FAIL: ${m.err}`);
      return;
    }
    if (m.type === "ok") {
      completed = m.iter;
      if (opts.verbose) console.log(`ok iter ${m.iter}: ${m.ms.toFixed(2)}ms`);
      if (completed >= opts.iterations) {
        clearInterval(watchdog);
        stop(0, `OK: completed ${completed} calls without hanging`);
      }
    }
  };

  worker.onerror = (e) => {
    clearInterval(watchdog);
    stop(2, `FAIL: worker error: ${e.message ?? String(e)}`);
  };

  worker.postMessage(
    {
      wasmBytes,
      initExport: opts.initExport,
      callExport: opts.callExport,
      iterations: opts.iterations,
    },
    [wasmBytes],
  );
};

await main();

