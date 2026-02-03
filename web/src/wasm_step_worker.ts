import { stubMissingImports } from "./shared/wasm_imports.ts";

type StepRequest = {
  wasm: ArrayBuffer;
  exportName: string;
  runInit: boolean;
};

type StepResponse =
  | { ok: true; exportName: string; ms: number }
  | { ok: false; exportName: string; ms: number; error: string };

const isEndError = (e: unknown) => {
  return (e as any)?.__blitz3dEnd === true || (e as any)?.message === "__BLITZ3D_END__";
};

const safeErrorString = (e: unknown) => {
  try {
    if (e instanceof Error) return `${e.name}: ${e.message}\n${e.stack ?? ""}`.trim();
    return String(e);
  } catch {
    return "unknown error";
  }
};

self.onmessage = async (ev: MessageEvent<StepRequest>) => {
  const req = ev.data;
  const t0 = performance.now();
  const respond = (msg: StepResponse) => {
    (self as any).postMessage(msg);
  };

  try {
    const module = await WebAssembly.compile(req.wasm);
    const imports: any = {
      env: {
        __indirect_function_table: new WebAssembly.Table({
          initial: 0,
          element: "anyfunc",
        }),
      },
      blitz3d: {},
      al: {},
    };

    // Provide a few basics used by the runtime/compiler.
    imports.env.MilliSecs2 = () => performance.now() | 0;
    imports.env.MilliSecs = () => performance.now() | 0;
    imports.env.MilliCSecs = () => performance.now() | 0;
    imports.env.SystemProperty = (_p: number) => 0;
    imports.env.RuntimeError = (_p: number) => {
      throw new Error("RuntimeError");
    };
    imports.env.End = () => {
      const err: any = new Error("__BLITZ3D_END__");
      err.__blitz3dEnd = true;
      throw err;
    };

    stubMissingImports(imports, module, {
      preferEnvForBlitz3d: true,
      caseInsensitive: true,
    });
    const instance = await WebAssembly.instantiate(module, imports);

    if (req.runInit) {
      const mainFn = (instance.exports as any).Main;
      if (typeof mainFn === "function") {
        try {
          mainFn();
        } catch (e) {
          if (!isEndError(e)) throw e;
        }
      }
    }

    const fn = (instance.exports as any)[req.exportName];
    if (typeof fn !== "function") {
      throw new Error(`Missing export ${req.exportName}`);
    }

    fn();
    const ms = performance.now() - t0;
    respond({ ok: true, exportName: req.exportName, ms });
  } catch (e) {
    const ms = performance.now() - t0;
    respond({ ok: false, exportName: req.exportName, ms, error: safeErrorString(e) });
  }
};
