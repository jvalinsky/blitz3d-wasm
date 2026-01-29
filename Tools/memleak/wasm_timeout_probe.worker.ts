type WorkerInit = {
  wasmBytes: ArrayBuffer;
  initExport: string | null;
  callExport: string;
  iterations: number;
};

type WorkerMsg =
  | { type: "ready" }
  | { type: "log"; msg: string }
  | { type: "ok"; iter: number; ms: number }
  | { type: "error"; err: string };

const post = (m: WorkerMsg, transfer: Transferable[] = []) => {
  (self as any).postMessage(m, transfer);
};

const nowMs = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const makeStubImports = async (module: WebAssembly.Module) => {
  const imports: any = {
    env: {
      __indirect_function_table: new WebAssembly.Table({
        initial: 0,
        element: "anyfunc",
      }),
    },
    blitz3d: {},
  };

  for (const imp of WebAssembly.Module.imports(module)) {
    if (!(imp.module in imports)) imports[imp.module] = {};
    if (imp.name in imports[imp.module]) continue;
    if (imp.kind !== "function") continue;

    // Best-effort stubs. Returning 0 is safe for i32/f32/f64 and "void".
    // For string pointers, 0 means null/empty; for handles, 0 means invalid.
    imports[imp.module][imp.name] = (..._args: any[]) => 0;
  }

  // Time functions commonly used for frame pacing.
  imports.env.MilliSecs = () => (Date.now() & 0x7fffffff);
  imports.env.MilliSecs2 = imports.env.MilliSecs;
  imports.env.Delay = (_ms: number) => {};

  return imports;
};

post({ type: "ready" });

self.onmessage = async (ev: MessageEvent<WorkerInit>) => {
  try {
    const { wasmBytes, initExport, callExport, iterations } = ev.data;
    const module = await WebAssembly.compile(wasmBytes);
    const imports = await makeStubImports(module);
    const instance = await WebAssembly.instantiate(module, imports);

    const initFn = initExport ? (instance.exports as any)[initExport] : null;
    if (initExport && typeof initFn !== "function") {
      post({ type: "log", msg: `warn: init export not found: ${initExport}` });
    }

    const callFn = (instance.exports as any)[callExport];
    if (typeof callFn !== "function") {
      post({ type: "error", err: `missing export: ${callExport}` });
      return;
    }

    if (typeof initFn === "function") {
      post({ type: "log", msg: `call init ${initExport}()` });
      initFn();
    }

    for (let i = 1; i <= iterations; i++) {
      const t0 = nowMs();
      callFn();
      const dt = nowMs() - t0;
      post({ type: "ok", iter: i, ms: dt });
    }
  } catch (e: any) {
    post({ type: "error", err: String(e?.stack ?? e?.message ?? e) });
  }
};

