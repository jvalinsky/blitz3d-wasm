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

Deno.test("no-freeze watchdog: main thread stays responsive while worker steps", async () => {
  // WASM module:
  // (global $tick (mut i32) (i32.const 0))
  // (func (export "InitOnce") (result i32) ... increments tick ...)
  // (func (export "UpdateGame") (result i32) ... increments tick ...)
  const wasmB64 =
    "AGFzbQEAAAABBQFgAAF/AwMCAAAGBgF/AUEACwcZAghJbml0T25jZQAAClVwZGF0ZUdhbWUAAQoZAgsAIwBBAWokACMACwsAIwBBAWokACMACw==";
  const wasmBytes = Uint8Array.from(atob(wasmB64), (c) => c.charCodeAt(0));

  const tmp = await Deno.makeTempDir({ dir: "/tmp", prefix: "blitz3d-wasm-no-freeze-" });
  const wasmPath = `${tmp}/stepper.wasm`;
  await Deno.writeFile(wasmPath, wasmBytes);

  const basePath = `${pathToFileURL(tmp).href}${tmp.endsWith("/") ? "" : "/"}`;
  const manifestPath = `${tmp}/manifest.json`;
  const manifest = { basePath, files: [], groups: { boot: [] } };
  await Deno.writeTextFile(manifestPath, JSON.stringify(manifest));

  // Heartbeat: if the main thread is blocked (tab freeze class), this won't tick.
  let heartbeats = 0;
  const hb = setInterval(() => {
    heartbeats++;
  }, 25) as unknown as number;

  const worker = startWorker();
  try {
    const t0 = performance.now();
    const initMsg: WorkerInitMsg = {
      cmd: "init",
      manifestUrl: pathToFileURL(manifestPath).href,
      preloadGroup: "boot",
      wasmUrl: pathToFileURL(wasmPath).href,
    };
    const pReady = waitFor(worker, (m) => m?.type === "ready", 20_000, "worker ready");
    worker.postMessage(initMsg);
    await pReady;

    const initRes = await callExport(worker, 1, "InitOnce");
    assert((initRes | 0) === 1);

    // Step enough frames that we'd notice a blocked event loop if something regressed.
    // (This is a watchdog test: it doesn't validate SCPCB correctness, only responsiveness.)
    for (let i = 0; i < 2000; i++) {
      await callExport(worker, i + 2, "UpdateGame");
      if (i % 250 === 0) {
        // Give timers a chance to run even if microtasks are saturated.
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const elapsedMs = performance.now() - t0;
    // If the main thread is truly blocked, the worker response handling will stall and the test will
    // fail via timeouts before reaching this assertion. This is a lightweight sanity check that
    // timers were still able to run at least once during the stepping loop.
    assert(
      heartbeats >= 1,
      `expected main thread heartbeats to advance (elapsed=${Math.round(elapsedMs)}ms), got ${heartbeats}`,
    );
  } finally {
    clearInterval(hb);
    worker.terminate();
  }
});
