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

const withTimeout = async <T>(p: Promise<T>, ms: number, label: string): Promise<T> => {
  let id: number | null = null;
  const timeout = new Promise<T>((_resolve, reject) => {
    id = setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms) as unknown as number;
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

const waitFor = async (worker: Worker, predicate: (msg: any) => boolean, ms: number, label: string) => {
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

const callExport = async (worker: Worker, callId: number, exportName: string, args?: Array<number | string>) => {
  const msg: WorkerCallMsg = { cmd: "call", callId, exportName, args };
  const pDone = waitFor(worker, (m) => m?.type === "callDone" && m?.callId === callId, 5000, `callDone ${exportName}`);
  worker.postMessage(msg);
  const done = await pDone;
  return done?.result as number;
};

Deno.test("scpcb_worker integration: preload group + step UpdateGame 300 frames", async () => {
  // Minimal wasm module:
  // (module
  //   (global $tick (mut i32) (i32.const 0))
  //   (func (export "InitOnce") (result i32) ... increments tick ...)
  //   (func (export "UpdateGame") (result i32) ... increments tick ...))
  const wasmB64 =
    "AGFzbQEAAAABBQFgAAF/AwMCAAAGBgF/AUEACwcZAghJbml0T25jZQAAClVwZGF0ZUdhbWUAAQoZAgsAIwBBAWokACMACwsAIwBBAWokACMACw==";
  const wasmBytes = Uint8Array.from(atob(wasmB64), (c) => c.charCodeAt(0));

  const tmp = await Deno.makeTempDir({ dir: "/tmp", prefix: "blitz3d-wasm-worker-preload-step-" });
  const wasmPath = `${tmp}/stepper.wasm`;
  await Deno.writeFile(wasmPath, wasmBytes);

  // Fake preload assets (small, local, no network).
  const optionsIniPath = `${tmp}/options.ini`;
  const initDatPath = `${tmp}/init.dat`;
  const optionsIniBytes = new TextEncoder().encode("[options]\nGraphicWidth=800\n");
  const initDatBytes = new Uint8Array([1, 2, 3, 4, 5]);
  await Deno.writeFile(optionsIniPath, optionsIniBytes);
  await Deno.writeFile(initDatPath, initDatBytes);

  const basePath = `${pathToFileURL(tmp).href}${tmp.endsWith("/") ? "" : "/"}`;
  const manifestPath = `${tmp}/manifest.json`;
  const manifest = {
    basePath,
    files: [
      { path: "options.ini", size: optionsIniBytes.byteLength },
      { path: "init.dat", size: initDatBytes.byteLength },
    ],
    groups: { boot: ["options.ini", "init.dat"] },
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

    const sawPreload = waitFor(
      worker,
      (m) => m?.type === "status" && typeof m?.status?.stage === "string" && String(m.status.stage).startsWith("preload:"),
      20_000,
      "saw preload status",
    );
    const pReady = waitFor(worker, (m) => m?.type === "ready", 20_000, "worker ready");
    worker.postMessage(initMsg);
    await sawPreload;
    await pReady;

    const initRes = await callExport(worker, 1, "InitOnce");
    assert((initRes | 0) === 1, "InitOnce must increment tick to 1");

    let last = initRes | 0;
    for (let i = 0; i < 300; i++) {
      last = (await callExport(worker, i + 2, "UpdateGame")) | 0;
    }
    assert(last === 301, "after 300 frames, tick must be 301");

    worker.postMessage({ cmd: "dispose" });
    await waitFor(worker, (m) => m?.type === "status" && m?.status?.stage === "disposed", 2000, "worker disposed");
  } finally {
    worker.terminate();
  }
});

