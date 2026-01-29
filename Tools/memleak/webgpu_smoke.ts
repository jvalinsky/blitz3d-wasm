type Options = {
  iterations: number;
  buffersPerIter: number;
  texturesPerIter: number;
  textureSize: number;
  bufferSize: number;
  settleMs: number;
  failOnGrowthBytes: number;
  verbose: boolean;
  skipIfUnavailable: boolean;
  strictQueue: boolean;
  requireWorkDone: boolean;
  queueTimeoutMs: number;
};

const parseArgs = (args: string[]): Options => {
  const opts: Options = {
    iterations: 50,
    buffersPerIter: 200,
    texturesPerIter: 50,
    textureSize: 64,
    bufferSize: 64 * 1024,
    settleMs: 0,
    failOnGrowthBytes: 25 * 1024 * 1024,
    verbose: false,
    skipIfUnavailable: false,
    strictQueue: false,
    requireWorkDone: false,
    queueTimeoutMs: 2000,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--iterations") {
      opts.iterations = Number(args[++i] ?? opts.iterations);
    } else if (a === "--buffers") {
      opts.buffersPerIter = Number(args[++i] ?? opts.buffersPerIter);
    } else if (a === "--textures") {
      opts.texturesPerIter = Number(args[++i] ?? opts.texturesPerIter);
    } else if (a === "--tex-size") {
      opts.textureSize = Number(args[++i] ?? opts.textureSize);
    } else if (a === "--buf-size") {
      opts.bufferSize = Number(args[++i] ?? opts.bufferSize);
    } else if (a === "--settle-ms") {
      opts.settleMs = Number(args[++i] ?? opts.settleMs);
    } else if (a === "--fail-on-growth-bytes") {
      opts.failOnGrowthBytes = Number(args[++i] ?? opts.failOnGrowthBytes);
    } else if (a === "--verbose") opts.verbose = true;
    else if (a === "--skip-if-unavailable") opts.skipIfUnavailable = true;
    else if (a === "--strict-queue") opts.strictQueue = true;
    else if (a === "--require-work-done") {
      opts.strictQueue = true;
      opts.requireWorkDone = true;
    } else if (a === "--queue-timeout-ms") {
      opts.queueTimeoutMs = Number(args[++i] ?? opts.queueTimeoutMs);
    } else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Headless WebGPU smoke + leak cycle test (Deno).",
          "",
          "Run:",
          "  deno run -A --unstable-webgpu Tools/memleak/webgpu_smoke.ts",
          "",
          "Recommended for stable heap numbers:",
          "  deno run -A --unstable-webgpu --v8-flags=--expose-gc Tools/memleak/webgpu_smoke.ts",
          "",
          "Options:",
          "  --iterations <n>              (default 50)",
          "  --buffers <n>                 GPUBuffer allocs per iter (default 200)",
          "  --textures <n>                GPUTexture allocs per iter (default 50)",
          "  --tex-size <n>                square texture size (default 64)",
          "  --buf-size <n>                buffer size bytes (default 65536)",
          "  --settle-ms <n>               delay between iters (default 0)",
          "  --fail-on-growth-bytes <n>    heap growth threshold (default 25MB)",
          "  --verbose                     log per-iter stats",
          "  --skip-if-unavailable         exit 0 if no adapter found",
          "  --strict-queue                fail on uncaptured GPU errors (workDone is best-effort)",
          "  --require-work-done           also require queue.onSubmittedWorkDone to resolve",
          "  --queue-timeout-ms <n>         timeout for onSubmittedWorkDone (default 2000)",
        ].join("\n"),
      );
      Deno.exit(0);
    }
  }

  if (!Number.isFinite(opts.iterations) || opts.iterations <= 0) {
    opts.iterations = 1;
  }
  if (!Number.isFinite(opts.buffersPerIter) || opts.buffersPerIter < 0) {
    opts.buffersPerIter = 0;
  }
  if (!Number.isFinite(opts.texturesPerIter) || opts.texturesPerIter < 0) {
    opts.texturesPerIter = 0;
  }
  if (!Number.isFinite(opts.textureSize) || opts.textureSize <= 0) {
    opts.textureSize = 1;
  }
  if (!Number.isFinite(opts.bufferSize) || opts.bufferSize <= 0) {
    opts.bufferSize = 1;
  }
  if (!Number.isFinite(opts.settleMs) || opts.settleMs < 0) opts.settleMs = 0;
  if (!Number.isFinite(opts.failOnGrowthBytes) || opts.failOnGrowthBytes < 0) {
    opts.failOnGrowthBytes = 0;
  }
  if (!Number.isFinite(opts.queueTimeoutMs) || opts.queueTimeoutMs <= 0) {
    opts.queueTimeoutMs = 2000;
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

const awaitQueueWorkDone = async (
  device: GPUDevice,
  timeoutMs: number,
): Promise<"ok" | "timeout" | "unsupported"> => {
  const fn = (device.queue as any)?.onSubmittedWorkDone;
  if (typeof fn !== "function") return "unsupported";

  try {
    const result = await Promise.race([
      fn.call(device.queue),
      sleep(timeoutMs).then(() => "timeout"),
    ]);
    if (result === "timeout") return "timeout";
    return "ok";
  } catch {
    // Treat a rejection as ok-for-await semantics; caller can decide to fail.
    throw new Error("onSubmittedWorkDone rejected");
  }
};

const main = async () => {
  const opts = parseArgs(Deno.args);

  const backendEnv = Deno.env.get("DENO_WEBGPU_BACKEND");
  const powerPrefEnv = Deno.env.get("DENO_WEBGPU_POWER_PREFERENCE");
  const adapterNameEnv = Deno.env.get("DENO_WEBGPU_ADAPTER_NAME");

  if (!("navigator" in globalThis) || !(navigator as any).gpu) {
    console.error(
      "WebGPU not available. Run with `--unstable-webgpu` and ensure your Deno build supports WebGPU.",
    );
    if (opts.skipIfUnavailable) {
      console.log("SKIP: navigator.gpu missing");
      Deno.exit(0);
    }
    Deno.exit(2);
  }

  if (opts.verbose) {
    console.log(
      `deno=${Deno.version.deno} v8=${Deno.version.v8} ts=${Deno.version.typescript} platform=${Deno.build.os}-${Deno.build.arch}`,
    );
    console.log(
      `env: DENO_WEBGPU_BACKEND=${
        backendEnv ?? "(unset)"
      } DENO_WEBGPU_POWER_PREFERENCE=${
        powerPrefEnv ?? "(unset)"
      } DENO_WEBGPU_ADAPTER_NAME=${adapterNameEnv ?? "(unset)"}`,
    );
  }

  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) {
    console.error(
      "No WebGPU adapter available (navigator.gpu.requestAdapter() returned null).",
    );
    console.error(
      "Try setting env vars like `DENO_WEBGPU_BACKEND=metal` (macOS), or run on a machine/CI runner with GPU access.",
    );
    if (opts.skipIfUnavailable) {
      console.log("SKIP: no WebGPU adapter");
      Deno.exit(0);
    }
    Deno.exit(3);
  }

  const device: GPUDevice = await adapter.requestDevice();
  let uncapturedErrorCount = 0;
  let lastUncapturedError: string | null = null;
  let workDoneMode: "enabled" | "disabled" | "unsupported" = "enabled";
  const deviceLost = (device as any).lost;
  if (deviceLost && typeof deviceLost.then === "function") {
    deviceLost.then((info: any) => {
      console.error(
        `GPU device lost: ${info?.reason ?? "(unknown)"} ${info?.message ?? ""}`
          .trim(),
      );
    });
  } else if (opts.verbose) {
    console.warn(
      "GPUDevice.lost is not available in this WebGPU runtime; continuing without device-loss monitoring.",
    );
    try {
      const keys = Object.keys(device as any).slice(0, 50);
      console.warn(
        `debug: typeof device.lost=${typeof (device as any)
          .lost} device keys(sample)=[${keys.join(", ")}]`,
      );
    } catch {
      // ignore
    }
  }

  // Best-effort: surface uncaptured errors.
  try {
    (device as any).addEventListener?.("uncapturederror", (ev: any) => {
      const err = ev?.error ?? ev;
      uncapturedErrorCount++;
      lastUncapturedError = err?.message ?? String(err);
      console.error(`GPU uncaptured error: ${lastUncapturedError}`);
    });
  } catch {
    // ignore
  }

  // Minimal render pipeline to force some GPU work without a canvas surface.
  const shaderModule = device.createShaderModule({
    code: `
      @vertex fn vs_main(@builtin(vertex_index) i : u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 3>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>( 3.0, -1.0),
          vec2<f32>(-1.0,  3.0),
        );
        let p = pos[i];
        return vec4<f32>(p, 0.0, 1.0);
      }
      @fragment fn fs_main() -> @location(0) vec4<f32> {
        return vec4<f32>(0.1, 0.2, 0.3, 1.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: shaderModule, entryPoint: "vs_main" },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format: "rgba8unorm" }],
    },
    primitive: { topology: "triangle-list" },
  });

  const heapStart = Deno.memoryUsage().heapUsed;
  let heapLast = heapStart;

  for (let iter = 1; iter <= opts.iterations; iter++) {
    const buffers: GPUBuffer[] = [];
    const textures: GPUTexture[] = [];
    const textureViews: GPUTextureView[] = [];

    // Allocate buffers.
    for (let i = 0; i < opts.buffersPerIter; i++) {
      const buf = device.createBuffer({
        size: opts.bufferSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC |
          GPUBufferUsage.UNIFORM,
      });
      buffers.push(buf);
    }

    // Allocate textures and do a tiny render pass for each to exercise command submission.
    for (let i = 0; i < opts.texturesPerIter; i++) {
      const tex = device.createTexture({
        size: [opts.textureSize, opts.textureSize, 1],
        format: "rgba8unorm",
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC |
          GPUTextureUsage.COPY_DST,
      });
      textures.push(tex);
      const view = tex.createView();
      textureViews.push(view);

      const encoder = device.createCommandEncoder();
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view,
          loadOp: "clear",
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          storeOp: "store",
        }],
      });
      pass.setPipeline(pipeline);
      pass.draw(3);
      pass.end();
      device.queue.submit([encoder.finish()]);
    }

    // Explicitly destroy GPU resources.
    for (const b of buffers) {
      try {
        b.destroy();
      } catch {
        // ignore
      }
    }
    for (const t of textures) {
      try {
        t.destroy();
      } catch {
        // ignore
      }
    }

    if (opts.strictQueue) {
      try {
        if (workDoneMode === "enabled") {
          const status = await awaitQueueWorkDone(device, opts.queueTimeoutMs);
          if (status === "unsupported") {
            workDoneMode = "unsupported";
            if (opts.verbose) {
              console.warn(
                "warn: queue.onSubmittedWorkDone is not available; strict-queue will use uncapturederror-only mode.",
              );
            }
          } else if (status === "timeout") {
            if (opts.requireWorkDone) {
              console.error(
                `FAIL: queue.onSubmittedWorkDone timed out after ${opts.queueTimeoutMs}ms`,
              );
              Deno.exit(5);
            }

            workDoneMode = "disabled";
            console.warn(
              `warn: queue.onSubmittedWorkDone timed out after ${opts.queueTimeoutMs}ms; strict-queue will use uncapturederror-only mode`,
            );
          }
        }
      } catch (e) {
        console.error(`FAIL: queue.onSubmittedWorkDone rejected: ${String(e)}`);
        Deno.exit(5);
      }

      if (uncapturedErrorCount > 0) {
        console.error(
          `FAIL: encountered ${uncapturedErrorCount} GPU uncaptured error(s) (last: ${
            lastUncapturedError ?? "(unknown)"
          })`,
        );
        Deno.exit(6);
      }
    }

    // Drop references.
    buffers.length = 0;
    textures.length = 0;
    textureViews.length = 0;

    maybeGC();
    if (opts.settleMs) await sleep(opts.settleMs);

    const heapNow = Deno.memoryUsage().heapUsed;
    heapLast = heapNow;

    if (opts.verbose) {
      console.log(
        `iter ${iter}/${opts.iterations}: heapUsed=${fmtBytes(heapNow)} (Δ ${
          fmtBytes(heapNow - heapStart)
        })`,
      );
    }
  }

  maybeGC();
  await sleep(0);

  const heapEnd = Deno.memoryUsage().heapUsed;
  const growth = heapEnd - heapStart;

  // Surface device loss, if any.
  if (deviceLost && typeof deviceLost.then === "function") {
    await Promise.race([deviceLost, Promise.resolve({ reason: "ok" } as any)]);
  }

  console.log(`iterations: ${opts.iterations}`);
  console.log(
    `heapUsed: ${fmtBytes(heapStart)} -> ${fmtBytes(heapEnd)} (Δ ${
      fmtBytes(growth)
    })`,
  );

  if (growth > opts.failOnGrowthBytes) {
    console.error(
      `FAIL: heap growth exceeds threshold (${
        fmtBytes(opts.failOnGrowthBytes)
      })`,
    );
    Deno.exit(4);
  }

  // Give the queue a chance to drain before exit (best-effort).
  try {
    const status = await awaitQueueWorkDone(device, opts.queueTimeoutMs);
    if (status === "timeout" && opts.verbose) {
      console.warn(
        `warn: queue.onSubmittedWorkDone timed out after ${opts.queueTimeoutMs}ms; continuing`,
      );
    }
  } catch {
    // ignore
  }

  if (opts.strictQueue && uncapturedErrorCount > 0) {
    console.error(
      `FAIL: encountered ${uncapturedErrorCount} GPU uncaptured error(s) (last: ${
        lastUncapturedError ?? "(unknown)"
      })`,
    );
    Deno.exit(6);
  }

  console.log("OK: WebGPU allocate/destroy cycle completed");
};

await main();
