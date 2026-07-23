import { pathToFileURL } from "node:url";
import { assert } from "./assert.ts";

type WorkerInitMsg = {
  cmd: "init";
  manifestUrl: string;
  preloadGroup: string;
  wasmUrl: string;
};

type WorkerCallMsg = {
  cmd: "call";
  callId: number;
  exportName: string;
  args?: Array<number | string>;
};

const withTimeout = async <T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  let id: number | null = null;
  const timeout = new Promise<T>((_resolve, reject) => {
    id = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms: ${label}`)),
      ms,
    ) as unknown as number;
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (id !== null) clearTimeout(id);
  }
};

const startWorker = () => {
  const url = new URL("../../web/src/worker/scpcb_worker.ts", import.meta.url);
  return new Worker(url.href, { type: "module" });
};

const waitFor = async (
  worker: Worker,
  predicate: (msg: any) => boolean,
  ms: number,
  label: string,
) => {
  return await withTimeout(
    new Promise<any>((resolve, reject) => {
      const onMsg = (ev: MessageEvent) => {
        const msg = ev.data;
        if (msg?.type === "error") {
          cleanup();
          reject(new Error(`worker error: ${msg?.error ?? "unknown"}`));
          return;
        }
        if (predicate(msg)) {
          cleanup();
          resolve(msg);
        }
      };
      const onErr = (ev: ErrorEvent) => {
        cleanup();
        reject(ev.error ?? new Error(String(ev.message)));
      };
      const cleanup = () => {
        worker.removeEventListener("message", onMsg);
        worker.removeEventListener("error", onErr as any);
      };
      worker.addEventListener("message", onMsg);
      worker.addEventListener("error", onErr as any);
    }),
    ms,
    label,
  );
};

const callExport = async (
  worker: Worker,
  callId: number,
  exportName: string,
  args?: Array<number | string>,
) => {
  const msg: WorkerCallMsg = { cmd: "call", callId, exportName, args };
  const pDone = waitFor(
    worker,
    (m) => m?.type === "callDone" && m?.callId === callId,
    5000,
    `callDone ${exportName}`,
  );
  worker.postMessage(msg);
  const done = await pDone;
  return done?.result as number;
};

Deno.test("scpcb_worker smoke: init + call export", async () => {
  // Minimal wasm module:
  // (module (func (export "add") (param i32 i32) (result i32) local.get 0 local.get 1 i32.add))
  const wasmB64 = "AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=";
  const wasmBytes = Uint8Array.from(atob(wasmB64), (c) => c.charCodeAt(0));

  const mod = await WebAssembly.compile(wasmBytes);
  const exports = WebAssembly.Module.exports(mod).map((e) => e.name);
  assert(exports.includes("add"), "fixture wasm must export add");

  const tmp = await Deno.makeTempDir({
    dir: "/tmp",
    prefix: "blitz3d-wasm-worker-smoke-",
  });
  const wasmPath = `${tmp}/min_add.wasm`;
  await Deno.writeFile(wasmPath, wasmBytes);

  const manifestPath = `${tmp}/manifest.json`;
  const basePath = `${pathToFileURL(tmp).href}${tmp.endsWith("/") ? "" : "/"}`;
  const manifest = {
    basePath,
    files: [],
    groups: { boot: [] },
  };
  await Deno.writeTextFile(manifestPath, JSON.stringify(manifest));

  const worker = startWorker();
  try {
    const initMsg: WorkerInitMsg = {
      cmd: "init",
      manifestUrl: pathToFileURL(manifestPath).href,
      preloadGroup: "boot",
      wasmUrl: pathToFileURL(wasmPath).href,
    };
    const pReady = waitFor(
      worker,
      (m) => m?.type === "ready",
      20_000,
      "worker ready",
    );
    worker.postMessage(initMsg);
    await pReady;

    for (let i = 0; i < 50; i++) {
      const res = await callExport(worker, i + 1, "add", [1, 2]);
      assert((res | 0) === 3, "add(1,2) must equal 3");
    }

    worker.postMessage({ cmd: "dispose" });
    await waitFor(
      worker,
      (m) => m?.type === "status" && m?.status?.stage === "disposed",
      2000,
      "worker disposed",
    );
  } finally {
    worker.terminate();
  }
});
