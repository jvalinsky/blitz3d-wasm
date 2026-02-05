/// <reference lib="deno.ns" />
/// <reference lib="dom" />

import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type Page,
} from "npm:playwright";
import { Buffer } from "node:buffer";
import { fromFileUrl, join } from "std/path/mod.ts";

type TestServer = {
  url: string;
  shutdown: () => Promise<void>;
};

type ExampleReport = {
  key: string;
  expected: string[];
  expectedStrict: boolean;
  matched: string;
  ok: boolean;
  error?: string;
  durationMs: number;
  statusText: string;
  outputLines: string[];
  output: string;
  stubsSummary: string;
  bbdbgSummary: string;
  memSummary: string;
  watSummary: string;
  artifacts?: {
    screenshotPath?: string;
    htmlPath?: string;
    outputPath?: string;
    stubsPath?: string;
    bbdbgPath?: string;
    memPath?: string;
    watPath?: string;
  };
};

type VfsFixture = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

const EXAMPLE_EXPECTATIONS: Record<string, string[]> = {
  hello: ["Hello from Blitz3D WASM!"],
  languageBasics: ["sum ok:", "case 15"],
  arrays: ["a("],
  customTypes: ["node id="],
  dataReadRestore: ["a="],
  stringsMath: ["abs="],
  debugCallStack: ["total="],
  debugStubs: ["About to call missing imports..."],
  memoryArray: ["a(0)="],
  graphics: ["Cube created successfully!"],
  rotatingCube: ["Rotating cube demo running"],
  rotatingCubeEdges: ["Rotating cube (blue + edges) running"],
  rotatingCubeColor: ["Rotating cube + color cycle demo running"],
  hud2D: ["Drew HUD overlay"],
  inputHud: ["Move the mouse and press keys"],
  image2D: ["Image requested", "Drew image."],
  imageDebug: ["Requested image load", "Loaded image:"],
  textureCube: ["Loading texture..."],
  vfsFileIO: ["Reading one line per frame..."],
  fogCube: ["Fog demo running"],
  proceduralMesh: ["Procedural mesh demo running"],
  b3dInspectRender: ["== B3D Inspect =="],
  xInspectRender: ["== X Inspect =="],
  rmeshInspectRender: ["== RMESH Inspect =="],
};

const NON_STRICT_EXPECTATIONS = new Set<string>([
  // Known-broken semantics (currently prints only numeric IDs; report still captures output).
  "customTypes",
]);

const ensureCompilerWasmInPublic = async (): Promise<void> => {
  const webRoot = fromFileUrl(new URL(".", import.meta.url));
  const source = join(webRoot, "blitz3d-compiler.wasm");
  const dest = join(webRoot, "public", "blitz3d-compiler.wasm");
  try {
    const [srcStat, dstStat] = await Promise.all([
      Deno.stat(source),
      Deno.stat(dest).catch(() => undefined),
    ]);
    if (!dstStat || dstStat.mtime?.getTime() !== srcStat.mtime?.getTime()) {
      await Deno.copyFile(source, dest);
    }
  } catch (err) {
    console.error("[interpreter test] failed to ensure compiler wasm in public", err);
  }
};

const getEnvInt = (name: string, fallback: number): number => {
  const raw = (Deno.env.get(name) ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.floor(n);
};

const resolveReportPaths = async (): Promise<{
  reportPath: string;
  artifactsDir: string | null;
}> => {
  const raw = (Deno.env.get("INTERPRETER_TEST_REPORT_PATH") ??
    "/tmp/interpreter_demo_report.json").trim();
  const rawArtifacts = (Deno.env.get("INTERPRETER_TEST_ARTIFACTS_DIR") ?? "")
    .trim();

  const looksLikeDir = raw.endsWith("/") || raw.endsWith("\\");
  let isDir = looksLikeDir;

  if (!looksLikeDir) {
    try {
      const stat = await Deno.stat(raw);
      isDir = stat.isDirectory;
    } catch {
      isDir = false;
    }
  }

  let reportPath = raw;
  if (isDir) {
    const dir = raw.replace(/[\\/]+$/, "");
    reportPath = join(dir, "interpreter_demo_report.json");
  } else {
    try {
      const stat = await Deno.stat(raw);
      if (stat.isDirectory) {
        reportPath = join(raw, "interpreter_demo_report.json");
      }
    } catch {
      // ignore
    }
  }

  const defaultArtifactsDir = reportPath.replace(/\.json$/i, "") + "_artifacts";
  const artifactsDir = rawArtifacts.length > 0 ? rawArtifacts : defaultArtifactsDir;

  return {
    reportPath,
    artifactsDir: artifactsDir.trim() ? artifactsDir : null,
  };
};

const withTimeout = async <T>(
  label: string,
  ms: number,
  fn: () => Promise<T>,
): Promise<T> => {
  const timeoutMs = Math.max(0, ms | 0);
  let timer: number | null = null;
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
};

const startServer = async (): Promise<TestServer> => {
  const explicit = (Deno.env.get("INTERPRETER_TEST_SERVER_URL") ?? "").trim();
  if (explicit) {
    const normalized = explicit.endsWith("/interpreter.html")
      ? explicit
      : explicit.replace(/\/+$/, "") + "/interpreter.html";
    return { url: normalized, shutdown: async () => {} };
  }

  const repoRoot = fromFileUrl(new URL("../", import.meta.url));
  const port = Number(Deno.env.get("INTERPRETER_TEST_PORT") ?? 5173);
  const url = `http://127.0.0.1:${port}/interpreter.html`;
  const startupTimeoutMs = getEnvInt("INTERPRETER_TEST_SERVER_STARTUP_TIMEOUT_MS", 60_000);

  try {
    const res = await fetch(url, { method: "HEAD" });
    if (res.ok) {
      return { url, shutdown: async () => {} };
    }
  } catch {
    // ignore
  }

  const serverProcess = new Deno.Command("deno", {
    args: [
      "task",
      "web:dev",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    cwd: repoRoot,
    stdout: Deno.env.get("INTERPRETER_TEST_SERVER_LOGS") ? "inherit" : "piped",
    stderr: Deno.env.get("INTERPRETER_TEST_SERVER_LOGS") ? "inherit" : "piped",
  }).spawn();

  let exited: Deno.CommandStatus | null = null;
  const serverStatus = serverProcess.status
    .then((s) => {
      exited = s;
      return s;
    })
    .catch(() => null);

  const logTail: string[] = [];
  const maxLogLines = 200;
  const recordLogs = async (stream: ReadableStream<Uint8Array> | null, prefix: string) => {
    if (!stream) return;
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let carry = "";
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const parts = carry.split(/\r?\n/);
        carry = parts.pop() ?? "";
        for (const line of parts) {
          const msg = `${prefix}${line}`;
          logTail.push(msg);
          if (logTail.length > maxLogLines) logTail.splice(0, logTail.length - maxLogLines);
        }
      }
    } catch {
      // ignore
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  };

  const stdoutStream = (serverProcess.stdout ?? null) as ReadableStream<Uint8Array> | null;
  const stderrStream = (serverProcess.stderr ?? null) as ReadableStream<Uint8Array> | null;
  void recordLogs(stdoutStream, "[server stdout] ");
  void recordLogs(stderrStream, "[server stderr] ");

  let ready = false;
  const startedAt = Date.now();
  while (Date.now() - startedAt < startupTimeoutMs) {
    if (exited) break;
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  if (!ready) {
    try {
      serverProcess.kill("SIGTERM");
    } catch {
      // ignore
    }
    const exitInfo = exited ? ` (exited: ${JSON.stringify(exited)})` : "";
    const tail = logTail.length > 0 ? `\n\n${logTail.join("\n")}\n` : "";
    throw new Error(`[interpreter test] Vite server did not become ready at ${url}${exitInfo}.${tail}`);
  }

  return {
    url,
    shutdown: async () => {
      try {
        serverProcess.kill("SIGTERM");
      } catch {
        // ignore
      }
      try {
        await serverStatus;
      } catch {
        // ignore
      }
    },
  };
};

const findPlaywrightCacheRoot = (): string | undefined => {
  const home = Deno.env.get("HOME");
  if (!home) return undefined;
  return join(home, "Library", "Caches", "ms-playwright");
};

const findHeadlessShell = async (): Promise<string | undefined> => {
  const cacheRoot = findPlaywrightCacheRoot();
  if (!cacheRoot) return undefined;
  try {
    for await (const entry of Deno.readDir(cacheRoot)) {
      if (!entry.isDirectory || !entry.name.startsWith("chromium_headless_shell-")) {
        continue;
      }
      const base = join(cacheRoot, entry.name);
      const arm64 = join(base, "chrome-headless-shell-mac-arm64", "chrome-headless-shell");
      try {
        const stat = await Deno.stat(arm64);
        if (stat.isFile) return arm64;
      } catch {
        // ignore
      }
      const x64 = join(base, "chrome-headless-shell-mac-x64", "chrome-headless-shell");
      try {
        const stat = await Deno.stat(x64);
        if (stat.isFile) return x64;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return undefined;
};

const findChromiumExecutable = async (): Promise<string | undefined> => {
  const cacheRoot = findPlaywrightCacheRoot();
  if (!cacheRoot) return undefined;
  try {
    for await (const entry of Deno.readDir(cacheRoot)) {
      if (!entry.isDirectory || !entry.name.startsWith("chromium-")) continue;
      const base = join(cacheRoot, entry.name);
      const cftArm64 = join(
        base,
        "chrome-mac-arm64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing",
      );
      try {
        const stat = await Deno.stat(cftArm64);
        if (stat.isFile) return cftArm64;
      } catch {
        // ignore
      }
      const cftX64 = join(
        base,
        "chrome-mac-x64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing",
      );
      try {
        const stat = await Deno.stat(cftX64);
        if (stat.isFile) return cftX64;
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
  return undefined;
};

const launchBrowser = async (): Promise<{ browser: Browser; name: string }> => {
  const executablePath = Deno.env.get("PLAYWRIGHT_EXECUTABLE_PATH") ??
    Deno.env.get("CHROME_EXECUTABLE_PATH") ??
    await findChromiumExecutable() ??
    await findHeadlessShell();

  const headlessEnv = Deno.env.get("PLAYWRIGHT_HEADLESS");
  const headless = headlessEnv ? headlessEnv !== "0" : true;
  const allowFallbackHeaded = Deno.env.get("PLAYWRIGHT_FALLBACK_HEADED") !== "0";
  const preferred = (Deno.env.get("PLAYWRIGHT_BROWSER") ?? "chromium").toLowerCase();
  const candidates = preferred === "webkit"
    ? [webkit, chromium, firefox]
    : preferred === "firefox"
    ? [firefox, chromium, webkit]
    : [chromium, firefox, webkit];

  console.log(
    `[interpreter test] headless=${headless} fallbackHeaded=${allowFallbackHeaded} preferred=${preferred}`,
  );

  const chromiumArgs = [
    "--disable-crashpad",
    "--disable-crash-reporter",
    "--no-crashpad",
    "--no-zygote",
    "--crash-dumps-dir=/tmp",
    "--disable-features=Crashpad,CrashpadHandler",
  ];
  const chromiumChannel = Deno.env.get("PLAYWRIGHT_CHANNEL");

  let lastError: unknown;
  for (const browserType of candidates) {
    const tryLaunch = async (forceHeadless: boolean): Promise<Browser> => {
      if (browserType === chromium) {
        return await browserType.launch({
          headless: forceHeadless,
          executablePath: executablePath || undefined,
          args: chromiumArgs,
          channel: chromiumChannel || undefined,
        });
      }
      return await browserType.launch({
        headless: forceHeadless,
        env: {
          MOZ_CRASHREPORTER_DISABLE: "1",
          MOZ_DISABLE_CRASHREPORTER: "1",
        },
      });
    };

    try {
      const browser = await tryLaunch(headless);
      console.log(`[interpreter test] using ${browserType.name()}`);
      return { browser, name: browserType.name() };
    } catch (err) {
      console.error(`[interpreter test] ${browserType.name()} launch failed`, err);
      lastError = err;
      if (allowFallbackHeaded && headless) {
        try {
          const browser = await tryLaunch(false);
          console.log(`[interpreter test] using ${browserType.name()} (headed fallback)`);
          return { browser, name: browserType.name() };
        } catch (fallbackErr) {
          console.error(
            `[interpreter test] ${browserType.name()} headed fallback failed`,
            fallbackErr,
          );
          lastError = fallbackErr;
        }
      }
    }
  }

  throw lastError ?? new Error("No Playwright browser available");
};

const createVfsFixtures = async (): Promise<VfsFixture[]> => {
  const webRoot = fromFileUrl(new URL(".", import.meta.url));
  const badgeJpg = Buffer.from(await Deno.readFile(
    join(webRoot, "public", "GFX", "items", "badge1.jpg"),
  ));
  const demoPng = Buffer.from(await Deno.readFile(join(webRoot, "public", "assets", "294test.png")));
  const npcB3d = Buffer.from(await Deno.readFile(join(webRoot, "public", "GFX", "npcs", "173_2.b3d")));
  const mugX = Buffer.from(await Deno.readFile(join(webRoot, "public", "GFX", "map", "Props", "mug.x")));
  const checkpointRmesh = Buffer.from(await Deno.readFile(
    join(webRoot, "public", "GFX", "map", "checkpoint2_opt.rmesh"),
  ));

  const txt = Buffer.from(new TextEncoder().encode("line1\nline2\n"));

  return [
    { name: "badge1.jpg", mimeType: "image/jpeg", buffer: badgeJpg },
    { name: "demo.png", mimeType: "image/png", buffer: demoPng },
    { name: "demo.txt", mimeType: "text/plain", buffer: txt },
    { name: "173_2.b3d", mimeType: "application/octet-stream", buffer: npcB3d },
    { name: "cup.x", mimeType: "text/plain", buffer: mugX },
    {
      name: "checkpoint2_opt.rmesh",
      mimeType: "application/octet-stream",
      buffer: checkpointRmesh,
    },
  ];
};

const waitForReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => {
    const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
    return statusText === "Ready";
  }, undefined, { timeout: 60_000 });
};

const assertUiBasics = async (page: Page, serverUrl: string): Promise<void> => {
  const faviconUrl = new URL("/favicon.svg", serverUrl).toString();
  const faviconRes = await fetch(faviconUrl);
  if (!faviconRes.ok) {
    throw new Error(`[interpreter test] favicon fetch failed: ${faviconRes.status} ${faviconRes.statusText}`);
  }
  const faviconText = await faviconRes.text();
  if (!faviconText.includes("<svg")) {
    throw new Error("[interpreter test] favicon.svg did not look like SVG");
  }

  await page.waitForFunction(() => {
    const compileBtn = document.querySelector<HTMLButtonElement>("#compile-btn");
    const runBtn = document.querySelector<HTMLButtonElement>("#run-btn");
    const editor = document.querySelector<HTMLTextAreaElement>("#editor");
    const exampleSelect = document.querySelector<HTMLSelectElement>("#example-select");
    return Boolean(
      compileBtn && !compileBtn.disabled && runBtn && editor && exampleSelect && exampleSelect.options.length >= 5,
    );
  }, undefined, { timeout: 60_000 });

  // Tab switching smoke: output -> debug -> canvas -> output
  await page.click("#tab-debug");
  await page.waitForFunction(() => {
    const debugTab = document.querySelector("#debug-tab");
    const stubsClear = document.querySelector("#stubs-clear-btn");
    return Boolean(debugTab?.classList.contains("active") && stubsClear);
  }, undefined, { timeout: 10_000 });

  await page.click("#tab-canvas");
  await page.waitForFunction(() => {
    const canvasTab = document.querySelector("#canvas-tab");
    return Boolean(canvasTab?.classList.contains("active"));
  }, undefined, { timeout: 10_000 });

  await page.click("#tab-output");
  await page.waitForFunction(() => {
    const outputTab = document.querySelector("#output-tab");
    return Boolean(outputTab?.classList.contains("active"));
  }, undefined, { timeout: 10_000 });

  // Example selection behavior (prefersTab + default timeout).
  await page.selectOption("#example-select", "debugStubs");
  await page.waitForFunction(() => {
    const debugTab = document.querySelector("#debug-tab");
    const req = document.querySelector("#example-req")?.textContent ?? "";
    return Boolean(debugTab?.classList.contains("active") && req.includes("Required uploads"));
  }, undefined, { timeout: 10_000 });

  await page.selectOption("#example-select", "fogCube");
  await page.waitForFunction(() => {
    const canvasTab = document.querySelector("#canvas-tab");
    const timeout = (document.querySelector<HTMLInputElement>("#timeout-ms")?.value ?? "").trim();
    return Boolean(canvasTab?.classList.contains("active") && timeout === "0");
  }, undefined, { timeout: 10_000 });

  await page.selectOption("#example-select", "hello");
  await page.waitForFunction(() => {
    const outputTab = document.querySelector("#output-tab");
    return Boolean(outputTab?.classList.contains("active"));
  }, undefined, { timeout: 10_000 });
  const helloCode = await page.inputValue("#editor");
  if (!helloCode.toLowerCase().includes("hello")) {
    throw new Error("[interpreter test] selecting hello did not update editor content");
  }
};

const getTextContent = async (page: Page, selector: string): Promise<string> => {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return (el?.textContent ?? "").toString();
  }, selector);
};

const getAttr = async (page: Page, selector: string, attr: string): Promise<string> => {
  return await page.evaluate(([sel, name]) => {
    const el = document.querySelector(sel);
    return (el?.getAttribute(name) ?? "").toString();
  }, [selector, attr] as const);
};

const getOutputLines = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    const root = document.querySelector("#output");
    if (!root) return [];
    const nodes = Array.from(root.querySelectorAll(".output-line"));
    if (nodes.length > 0) {
      return nodes.map((n) => (n.textContent ?? "").toString());
    }
    const raw = (root.textContent ?? "").toString();
    return raw.split(/\r?\n/).map((s) => s.trimEnd()).filter((s) => s.length > 0);
  });
};

const clearPanels = async (page: Page): Promise<void> => {
  await page.click("#clear-btn");
  await page.evaluate(() => {
    (document.getElementById("stubs-clear-btn") as HTMLButtonElement | null)?.click();
    (document.getElementById("bbdbg-clear-btn") as HTMLButtonElement | null)?.click();
  });
};

const stopIfRunning = async (page: Page, timeoutMs = 30_000): Promise<void> => {
  const stopBtn = page.locator("#stop-btn");
  if (await stopBtn.isEnabled()) {
    await stopBtn.click();
  }
  await page.waitForFunction(() => {
    const runBtn = document.querySelector<HTMLButtonElement>("#run-btn");
    const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
    return Boolean(runBtn && !runBtn.disabled && runBtn.textContent?.trim() === "Run") &&
      (statusText === "Ready" || statusText.startsWith("Paused"));
  }, undefined, { timeout: Math.max(1000, timeoutMs | 0) });
};

const uploadVfsFixtures = async (page: Page): Promise<void> => {
  await page.click("#vfs-clear-btn");
  await page.fill("#vfs-prefix", "assets/");

  const fixtures = await createVfsFixtures();
  await page.setInputFiles("#vfs-upload", fixtures);

  const expectedNames = fixtures.map((f) => f.name);
  await page.waitForFunction((names: string[]) => {
    const txt = document.querySelector("#vfs-list")?.textContent ?? "";
    return names.every((n) => txt.includes(n));
  }, expectedNames);
};

const getExampleKeys = async (page: Page): Promise<string[]> => {
  return await page.evaluate(() => {
    const sel = document.querySelector<HTMLSelectElement>("#example-select");
    if (!sel) return [];
    return Array.from(sel.options).map((o) => o.value).filter((v) => v);
  });
};

type ExampleSignal =
  | { kind: "expected"; matched: string }
  | { kind: "ready" }
  | { kind: "error"; statusText: string };

const waitForRunStart = async (page: Page, timeoutMs = 5000): Promise<void> => {
  await page.waitForFunction(() => {
    const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
    const runBtn = document.querySelector<HTMLButtonElement>("#run-btn");
    return statusText !== "Ready" || Boolean(runBtn && (runBtn.disabled || runBtn.textContent?.trim() !== "Run"));
  }, undefined, { timeout: Math.max(250, timeoutMs | 0) });
};

const waitForExampleSignal = async (
  page: Page,
  expected: string[],
  timeoutMs: number,
): Promise<ExampleSignal> => {
  const handle = await page.waitForFunction((subs: string[]) => {
    const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
    const indicatorCls = document.querySelector("#status-indicator")?.className ?? "";
    const txt = document.querySelector("#output")?.textContent ?? "";
    for (const s of subs) {
      if (s && txt.includes(s)) return { kind: "expected", matched: s };
    }
    if (statusText === "Ready") return { kind: "ready" };
    if (indicatorCls.includes("error") || statusText.toLowerCase().includes("failed")) {
      return { kind: "error", statusText };
    }
    return false;
  }, expected, { timeout: Math.max(250, timeoutMs | 0) });

  const value = (await handle.jsonValue()) as ExampleSignal;
  await handle.dispose();
  return value;
};

const findMatchedExpected = (output: string, expected: string[]): string => {
  for (const s of expected) {
    if (s && output.includes(s)) return s;
  }
  return "";
};

const sanitizeFileComponent = (s: string): string => {
  return String(s).replaceAll(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
};

const runExample = async (
  page: Page,
  key: string,
  {
    waitMs,
    artifactsDir,
  }: { waitMs: number; artifactsDir: string | null },
): Promise<ExampleReport> => {
  const startedAt = Date.now();
  const expected = EXAMPLE_EXPECTATIONS[key] ?? [];
  const strictAll = (Deno.env.get("INTERPRETER_TEST_STRICT") ?? "").trim() === "1";
  let signal: ExampleSignal | null = null;
  let error: string | undefined;
  let artifacts: ExampleReport["artifacts"];

  try {
    await clearPanels(page);
    await page.selectOption("#example-select", key);

    const timeoutMs = String(
      Math.max(250, Number(Deno.env.get("INTERPRETER_TEST_TIMEOUT_MS") ?? "15000") || 15000),
    );
    await page.fill("#timeout-ms", timeoutMs);

    await page.click("#run-btn");
    await waitForRunStart(page, 10_000);
    signal = await waitForExampleSignal(page, expected, waitMs);
  } catch (err) {
    error = String(err);
  }

  try {
    await stopIfRunning(page, 30_000);
  } catch (stopErr) {
    error = error ? `${error}\nstop failed: ${stopErr}` : `stop failed: ${stopErr}`;
  }

  if (key === "debugStubs") {
    try {
      await page.click("#tab-debug");
      await page.waitForFunction(() => {
        const t = document.querySelector("#stubs-summary")?.textContent ?? "";
        return t.trim() !== "" && !t.includes("No stubbed imports yet.");
      }, undefined, { timeout: 20_000 });
    } catch (stubsErr) {
      error = error ? `${error}\nstubs wait failed: ${stubsErr}` : `stubs wait failed: ${stubsErr}`;
    }
  }

  const statusText = (await getTextContent(page, "#status-text")).trim();
  const outputLines = await getOutputLines(page);
  const output = outputLines.join("\n");
  const stubsSummary = (await getTextContent(page, "#stubs-summary")).trim();
  const bbdbgSummary = (await getTextContent(page, "#bbdbg-summary")).trim();
  const memSummary = (await getTextContent(page, "#mem-summary")).trim();
  const watSummary = (await getTextContent(page, "#wat-summary")).trim();

  let matched = expected.length > 0 ? findMatchedExpected(output, expected) : "";
  if (!matched && signal?.kind === "expected") matched = signal.matched;

  const expectedStrict = expected.length > 0 && (strictAll || !NON_STRICT_EXPECTATIONS.has(key));

  const stubsOk = key !== "debugStubs"
    ? true
    : stubsSummary.trim() !== "" && !stubsSummary.includes("No stubbed imports");

  const ok = expected.length === 0
    ? !error
    : (!error && (signal?.kind !== "error") && stubsOk && (!expectedStrict || Boolean(matched)));

  if (!ok && artifactsDir) {
    try {
      await Deno.mkdir(artifactsDir, { recursive: true });
      const base = sanitizeFileComponent(key);
      const screenshotPath = join(artifactsDir, `${base}.png`);
      const htmlPath = join(artifactsDir, `${base}.html`);
      const outputPath = join(artifactsDir, `${base}.output.txt`);
      const stubsPath = join(artifactsDir, `${base}.stubs.txt`);
      const bbdbgPath = join(artifactsDir, `${base}.bbdbg.txt`);
      const memPath = join(artifactsDir, `${base}.mem.txt`);
      const watPath = join(artifactsDir, `${base}.wat.txt`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await Deno.writeTextFile(htmlPath, await page.content());
      await Deno.writeTextFile(outputPath, outputLines.join("\n") + "\n");

      const stubsText = [
        (await getTextContent(page, "#stubs-summary")).trim(),
        "",
        (await getTextContent(page, "#stubs-list")).trim(),
        "",
        (await getTextContent(page, "#stubs-called")).trim(),
      ].join("\n");
      await Deno.writeTextFile(stubsPath, stubsText + "\n");

      const bbdbgText = [
        (await getTextContent(page, "#bbdbg-summary")).trim(),
        "",
        (await getTextContent(page, "#bbdbg-breakpoints")).trim(),
        "",
        (await getTextContent(page, "#bbdbg-stack")).trim(),
        "",
        (await getTextContent(page, "#bbdbg-trace")).trim(),
      ].join("\n");
      await Deno.writeTextFile(bbdbgPath, bbdbgText + "\n");

      const memText = [
        (await getTextContent(page, "#mem-summary")).trim(),
        "",
        (await getTextContent(page, "#mem-dump")).trim(),
      ].join("\n");
      await Deno.writeTextFile(memPath, memText + "\n");

      const watText = [
        (await getTextContent(page, "#wat-summary")).trim(),
        "",
        (await getTextContent(page, "#wat-code")).trim(),
      ].join("\n");
      await Deno.writeTextFile(watPath, watText + "\n");

      artifacts = { screenshotPath, htmlPath, outputPath, stubsPath, bbdbgPath, memPath, watPath };
    } catch (artifactErr) {
      error = error
        ? `${error}\nartifact capture failed: ${artifactErr}`
        : `artifact capture failed: ${artifactErr}`;
    }
  }

  const durationMs = Math.max(0, Date.now() - startedAt);

  return {
    key,
    expected,
    expectedStrict,
    matched,
    ok,
    error,
    durationMs,
    statusText,
    outputLines,
    output,
    stubsSummary,
    bbdbgSummary,
    memSummary,
    watSummary,
    artifacts,
  };
};

Deno.test("interpreter demos smoke", async () => {
  const totalTimeoutMs = getEnvInt("INTERPRETER_TEST_TOTAL_TIMEOUT_MS", 8 * 60_000);

  await withTimeout("interpreter demos smoke", totalTimeoutMs, async () => {
    await ensureCompilerWasmInPublic();
    const server = await startServer();
    console.log(`[interpreter test] server: ${server.url}`);

    const { reportPath, artifactsDir } = await resolveReportPaths();
    console.log(`[interpreter test] report: ${reportPath}`);
    if (artifactsDir) console.log(`[interpreter test] artifacts: ${artifactsDir}`);

    const compilerUrl = new URL("/blitz3d-compiler.wasm", server.url).toString();
    try {
      const res = await fetch(compilerUrl);
      const buf = new Uint8Array(await res.arrayBuffer());
      const magic = Array.from(buf.slice(0, 4)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      console.log(
        `[interpreter test] compiler wasm ${res.status} ${res.headers.get("content-type") ?? ""} magic=${magic}`,
      );
    } catch (err) {
      console.error("[interpreter test] compiler wasm fetch failed", err);
    }

    const { browser } = await launchBrowser();
    const http404: string[] = [];
    const httpErrors: Array<{ status: number; url: string }> = [];
    const consoleErrors: string[] = [];
    const report: ExampleReport[] = [];

    try {
      const page = await browser.newPage();
      page.setDefaultTimeout(getEnvInt("INTERPRETER_TEST_PLAYWRIGHT_TIMEOUT_MS", 60_000));

      page.on("console", (msg) => {
        const text = msg.text();
        console.log(`[page ${msg.type()}] ${text}`);
        if (msg.type() === "error") consoleErrors.push(text);
      });
      page.on("pageerror", (err) => {
        console.error("[page error]", err);
        consoleErrors.push(String(err));
      });
      page.on("response", (res) => {
        const url = res.url();
        const status = res.status();
        if (status >= 500) {
          httpErrors.push({ status, url });
          console.log(`[http ${status}]`, url);
        } else if (status === 404) {
          http404.push(url);
          console.log("[http 404]", url);
        }
        if (url.includes("blitz3d-compiler.wasm")) {
          console.log("[compiler wasm response]", res.status(), url);
        }
      });
      page.on("requestfailed", (req) => {
        const failure = req.failure();
        console.log("[request failed]", req.url(), failure?.errorText ?? "");
      });

      await page.goto(server.url, { waitUntil: "domcontentloaded" });
      await waitForReady(page);
      await assertUiBasics(page, server.url);
      await uploadVfsFixtures(page);

      const onlyRaw = (Deno.env.get("INTERPRETER_TEST_ONLY") ?? "").trim();
      const only = onlyRaw.length > 0
        ? new Set(onlyRaw.split(",").map((s) => s.trim()).filter(Boolean))
        : null;

      const keys = (await getExampleKeys(page)).filter((k) => !only || only.has(k));
      const interpreterTimeoutMs = Math.max(
        250,
        getEnvInt("INTERPRETER_TEST_TIMEOUT_MS", 15_000) || 15_000,
      );
      const legacyOutputWaitMs = Math.max(
        0,
        getEnvInt("INTERPRETER_TEST_OUTPUT_TIMEOUT_MS", 0) || 0,
      );
      const waitMs = Math.max(
        250,
        getEnvInt(
          "INTERPRETER_TEST_WAIT_FOR_OUTPUT_MS",
          legacyOutputWaitMs > 0 ? legacyOutputWaitMs : Math.min(60_000, interpreterTimeoutMs + 5000),
        ),
      );

      for (const key of keys) {
        console.log(`[interpreter test] running example: ${key}`);
        report.push(await runExample(page, key, { waitMs, artifactsDir: artifactsDir || null }));
      }

      try {
        await Deno.writeTextFile(
          reportPath,
          JSON.stringify({ url: server.url, http404, httpErrors, consoleErrors, report }, null, 2),
        );
        console.log(`[interpreter test] wrote report: ${reportPath}`);
      } catch (err) {
        console.error(`[interpreter test] failed to write report: ${reportPath}`, err);
      }

      const failed = report.filter((r) => !r.ok);
      if (failed.length > 0) {
        for (const f of failed) {
          const outPreview = f.output.trim().split(/\r?\n/).slice(0, 8).join("\\n");
          console.error(
            `[interpreter test] FAIL ${f.key}: status="${f.statusText}" matched="${f.matched}" ` +
              `strict=${f.expectedStrict} expected=[${f.expected.join(", ")}] ` +
              `error=${f.error ?? ""} output="${outPreview}"`,
          );
        }
        const names = failed.map((r) => r.key).join(", ");
        throw new Error(
          `interpreter demos smoke: ${failed.length}/${report.length} examples failed: ${names} (see ${reportPath})`,
        );
      }
    } finally {
      try {
        await Deno.writeTextFile(
          reportPath,
          JSON.stringify({ url: server.url, http404, httpErrors, consoleErrors, report }, null, 2),
        );
      } catch {
        // ignore
      }
      await browser.close();
      await server.shutdown();
    }
  });
});

Deno.test("interpreter ui behavior", async () => {
  const totalTimeoutMs = getEnvInt("INTERPRETER_TEST_TOTAL_TIMEOUT_MS", 5 * 60_000);

  await withTimeout("interpreter ui behavior", totalTimeoutMs, async () => {
    await ensureCompilerWasmInPublic();
    const server = await startServer();
    console.log(`[interpreter ui] server: ${server.url}`);

    const { artifactsDir: baseArtifactsDir } = await resolveReportPaths();
    const uiArtifactsDir = baseArtifactsDir ? join(baseArtifactsDir, "ui") : null;

    const { browser } = await launchBrowser();
    try {
      const ctx = await browser.newContext({ acceptDownloads: true });
      try {
        await ctx.grantPermissions(["clipboard-write"], { origin: new URL(server.url).origin });
      } catch {
        // ignore (not all drivers support this permission call)
      }
      const page = await ctx.newPage();
      page.setDefaultTimeout(getEnvInt("INTERPRETER_TEST_PLAYWRIGHT_TIMEOUT_MS", 60_000));

      const captureUiArtifacts = async (label: string, details: string) => {
        if (!uiArtifactsDir) return;
        try {
          await Deno.mkdir(uiArtifactsDir, { recursive: true });
          const base = sanitizeFileComponent(label);
          const screenshotPath = join(uiArtifactsDir, `${base}.png`);
          const htmlPath = join(uiArtifactsDir, `${base}.html`);
          const outputPath = join(uiArtifactsDir, `${base}.output.txt`);
          const detailsPath = join(uiArtifactsDir, `${base}.details.txt`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          await Deno.writeTextFile(htmlPath, await page.content());
          await Deno.writeTextFile(outputPath, (await getOutputLines(page)).join("\n") + "\n");
          await Deno.writeTextFile(detailsPath, details + "\n");
        } catch (err) {
          console.error("[interpreter ui] artifact capture failed", err);
        }
      };

      const step = async (label: string, fn: () => Promise<void>) => {
        console.log(`[interpreter ui] step: ${label}`);
        try {
          await fn();
        } catch (err) {
          const statusText = (await getTextContent(page, "#status-text")).trim();
          const statusCls = (await getAttr(page, "#status-indicator", "class")).trim();
          const tail = (await getOutputLines(page)).slice(-20).join("\n");
          const msg =
            `[interpreter ui] FAIL step="${label}" status="${statusText}" cls="${statusCls}" err=${String(err)}\n` +
            `output tail:\n${tail}`;
          console.error(msg);
          await captureUiArtifacts(label, msg);
          throw new Error(msg);
        }
      };

      await page.goto(server.url, { waitUntil: "domcontentloaded" });
      await waitForReady(page);
      await assertUiBasics(page, server.url);

      await step("vfs upload", async () => {
        await uploadVfsFixtures(page);
        await page.waitForFunction(() => {
          const t = document.querySelector("#vfs-list")?.textContent ?? "";
          return t.includes("Uploaded:") && !t.includes("VFS is empty.");
        }, undefined, { timeout: 15_000 });

        // VFS copy path (best-effort: only runs if clipboard is available in this browser context).
        const clipboardOk = await page.evaluate(() => {
          try {
            return Boolean((navigator as any).clipboard?.writeText) && Boolean((window as any).isSecureContext);
          } catch {
            return false;
          }
        });
        if (clipboardOk) {
          await page.locator(".vfs-path", { hasText: "assets/demo.txt" }).first().click();
          await page.waitForFunction(() => {
            const out = document.querySelector("#output")?.textContent ?? "";
            return out.includes("Copied path: assets/demo.txt");
          }, undefined, { timeout: 15_000 });
        } else {
          console.log("[interpreter ui] skipping VFS clipboard assertion (clipboard unavailable)");
        }
      });

      await step("vfs clear", async () => {
        // VFS clear should update list + output.
        await page.click("#vfs-clear-btn");
        await page.waitForFunction(() => {
          const list = document.querySelector("#vfs-list")?.textContent ?? "";
          const out = document.querySelector("#output")?.textContent ?? "";
          return list.includes("VFS is empty.") && out.includes("VFS cleared.");
        }, undefined, { timeout: 15_000 });

        // Restore fixtures for subsequent demos that read files.
        await uploadVfsFixtures(page);
      });

      await step("compile error + clear", async () => {
        // Compile error UX + recovery.
        await clearPanels(page);
        await page.fill("#editor", "@\n");
        await page.click("#compile-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Compilation failed:") || out.includes("Error:");
        }, undefined, { timeout: 30_000 });
        await page.click("#clear-btn");
        await page.waitForFunction(() => {
          const root = document.querySelector("#output");
          if (!root) return false;
          const lines = Array.from(root.querySelectorAll(".output-line")).map((n) =>
            (n.textContent ?? "").trim()
          );
          return lines.length === 0;
        }, undefined, { timeout: 10_000 });
      });

      await step("stop during compilation", async () => {
        // True stop-during-compilation behavior: Stop should cancel the in-flight compile
        // and return the UI to Ready (no hung promises / disabled buttons).
        await clearPanels(page);
        await page.fill("#timeout-ms", "20000");

        // Make this deterministic: ask the compiler worker to hold the result for a bit so
        // the Stop button has a reliable window to cancel the in-flight compile.
        await page.evaluate(() => {
          (globalThis as any).__B3D_COMPILER_DEBUG_HOLD_MS = 1500;
        });
        try {
          const parts: string[] = [
            "; Generated: large source to make compilation non-trivial",
            "Local x% = 0",
          ];
          for (let i = 0; i < 20000; i++) parts.push("x = x + 1");
          parts.push("Print x");
          await page.fill("#editor", parts.join("\n") + "\n");

          await page.click("#run-btn");
          await waitForRunStart(page, 10_000);

          // Stop should become enabled while compilation is running, and cancellation should prevent
          // "Loading compiled module..." from ever printing.
          await page.waitForFunction(() => {
            const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn");
            const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
            return statusText.startsWith("Compiling") &&
              Boolean(stopBtn && !stopBtn.disabled);
          }, undefined, { timeout: 60_000 });
          await page.click("#stop-btn");

          await page.waitForFunction(() => {
            const out = document.querySelector("#output")?.textContent ?? "";
            return out.includes("Compilation canceled.");
          }, undefined, { timeout: 60_000 });

          // Must always return to Ready with controls enabled, and must not have started execution.
          await page.waitForFunction(() => {
            const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
            const runBtn = document.querySelector<HTMLButtonElement>("#run-btn");
            const compileBtn = document.querySelector<HTMLButtonElement>("#compile-btn");
            const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn");
            const out = document.querySelector("#output")?.textContent ?? "";
            return statusText === "Ready" &&
              Boolean(runBtn && !runBtn.disabled) &&
              Boolean(compileBtn && !compileBtn.disabled) &&
              Boolean(stopBtn && stopBtn.disabled) &&
              !out.includes("Loading compiled module...");
          }, undefined, { timeout: 60_000 });
        } finally {
          await page.evaluate(() => {
            (globalThis as any).__B3D_COMPILER_DEBUG_HOLD_MS = 0;
          });
        }
      });

      await step("bbdbg pause/step/continue", async () => {
        // Smoke-test stepping controls: Pause -> Step -> Continue should update bbdbg steps/trace
        // and status text should reflect pause/resume.
        await clearPanels(page);
        await page.fill("#timeout-ms", "2000");
        await page.selectOption("#example-select", "rotatingCube");
        await page.click("#run-btn");
        await waitForRunStart(page, 10_000);

        await page.click("#tab-debug");

        const readSteps = async (): Promise<number> => {
          return await page.evaluate(() => {
            const t = document.querySelector("#bbdbg-summary")?.textContent ?? "";
            const m = t.match(/Steps:\\s*(\\d+)/);
            return m ? Number(m[1]) | 0 : -1;
          });
        };

        // Wait for at least a couple steps to tick.
        await page.waitForFunction(() => {
          const t = document.querySelector("#bbdbg-summary")?.textContent ?? "";
          const m = t.match(/Steps:\\s*(\\d+)/);
          return Boolean(m && Number(m[1]) >= 2);
        }, undefined, { timeout: 60_000 });

        // Pause should flip controls + status.
        await page.waitForFunction(() => {
          const btn = document.querySelector<HTMLButtonElement>("#bbdbg-pause-btn");
          return Boolean(btn && !btn.disabled);
        }, undefined, { timeout: 30_000 });
        await page.click("#bbdbg-pause-btn");
        await page.waitForFunction(() => {
          const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
          const pauseBtn = document.querySelector<HTMLButtonElement>("#bbdbg-pause-btn");
          const contBtn = document.querySelector<HTMLButtonElement>("#bbdbg-continue-btn");
          const stepBtn = document.querySelector<HTMLButtonElement>("#bbdbg-step-btn");
          return statusText.startsWith("Paused") &&
            Boolean(pauseBtn && pauseBtn.disabled) &&
            Boolean(contBtn && !contBtn.disabled) &&
            Boolean(stepBtn && !stepBtn.disabled);
        }, undefined, { timeout: 30_000 });

        const pausedSteps = await readSteps();
        // Single-step should increment steps while remaining paused.
        await page.click("#bbdbg-step-btn");
        await page.waitForFunction((prev: number) => {
          const t = document.querySelector("#bbdbg-summary")?.textContent ?? "";
          const m = t.match(/Steps:\\s*(\\d+)/);
          const n = m ? Number(m[1]) | 0 : -1;
          const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
          return statusText.startsWith("Paused") && n >= prev + 1;
        }, pausedSteps, { timeout: 30_000 });

        // Continue should resume stepping (steps keep increasing) and re-enable Pause.
        const stepAfterSingle = await readSteps();
        await page.click("#bbdbg-continue-btn");
        await page.waitForFunction((prev: number) => {
          const pauseBtn = document.querySelector<HTMLButtonElement>("#bbdbg-pause-btn");
          const contBtn = document.querySelector<HTMLButtonElement>("#bbdbg-continue-btn");
          const stepBtn = document.querySelector<HTMLButtonElement>("#bbdbg-step-btn");
          const t = document.querySelector("#bbdbg-summary")?.textContent ?? "";
          const m = t.match(/Steps:\\s*(\\d+)/);
          const n = m ? Number(m[1]) | 0 : -1;
          return Boolean(pauseBtn && !pauseBtn.disabled) &&
            Boolean(contBtn && contBtn.disabled) &&
            Boolean(stepBtn && stepBtn.disabled) &&
            n >= prev + 1;
        }, stepAfterSingle, { timeout: 60_000 });

        await stopIfRunning(page, 30_000);
      });

      await step("vfs prefix upload correctness", async () => {
        // Changing the VFS prefix should affect the paths registered in the VFS list,
        // and programs should be able to read using the prefixed path.
        await page.click("#vfs-clear-btn");
        await page.fill("#vfs-prefix", "assets/sub/");
        const fixtures = await createVfsFixtures();
        const demoTxt = fixtures.find((f) => f.name === "demo.txt");
        if (!demoTxt) throw new Error("[interpreter ui] demo.txt fixture missing");
        await page.setInputFiles("#vfs-upload", [demoTxt]);

        await page.waitForFunction(() => {
          const list = document.querySelector("#vfs-list")?.textContent ?? "";
          return list.includes("assets/sub/demo.txt");
        }, undefined, { timeout: 15_000 });

        await clearPanels(page);
        await page.fill(
          "#editor",
          [
            'Local f% = ReadFile("assets/sub/demo.txt")',
            'If f = 0 Then Print "open failed": End',
            "Print ReadLine(f)",
            "Print ReadLine(f)",
            "CloseFile f",
          ].join("\n") + "\n",
        );
        await page.click("#run-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("line1") && out.includes("line2");
        }, undefined, { timeout: 60_000 });
        await stopIfRunning(page, 30_000);

        // Restore fixtures and prefix for subsequent examples.
        await uploadVfsFixtures(page);
      });

      await step("runtime gaps called changes + clear", async () => {
        await page.click("#tab-debug");

        const readCalledCount = async (): Promise<number> => {
          return await page.evaluate(() => {
            const t = document.querySelector("#stubs-summary")?.textContent ?? "";
            const m = t.match(/Called:\\s*(\\d+)/);
            return m ? Number(m[1]) | 0 : -1;
          });
        };

        // Clear should reset everything to the empty state.
        await page.click("#stubs-clear-btn");
        await page.waitForFunction(() => {
          const summary = document.querySelector("#stubs-summary")?.textContent ?? "";
          const called = document.querySelector("#stubs-called")?.textContent ?? "";
          return summary.includes("No stubbed imports yet.") && called.includes("No stubbed calls observed.");
        }, undefined, { timeout: 15_000 });

        // debugStubs intentionally calls missing imports -> Called should be > 0.
        await page.selectOption("#example-select", "debugStubs");
        await page.click("#run-btn");
        await page.waitForFunction(() => {
          const summary = document.querySelector("#stubs-summary")?.textContent ?? "";
          return summary.includes("Stubbed imports:") && summary.includes("Called:");
        }, undefined, { timeout: 60_000 });
        const called1 = await readCalledCount();
        if (called1 <= 0) {
          throw new Error(`[interpreter ui] expected debugStubs called>0, got ${called1}`);
        }

        // A simple program should generally call 0 missing imports.
        await page.selectOption("#example-select", "hello");
        await page.click("#run-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Hello from Blitz3D WASM!");
        }, undefined, { timeout: 60_000 });
        await page.click("#tab-debug");
        await page.waitForFunction(() => {
          const summary = document.querySelector("#stubs-summary")?.textContent ?? "";
          return summary.includes("Stubbed imports:") && summary.includes("Called:");
        }, undefined, { timeout: 30_000 });
        const called2 = await readCalledCount();
        if (called2 !== 0) {
          throw new Error(`[interpreter ui] expected hello called==0, got ${called2}`);
        }

        // Clear again should return us to empty.
        await page.click("#stubs-clear-btn");
        await page.waitForFunction(() => {
          const summary = document.querySelector("#stubs-summary")?.textContent ?? "";
          return summary.includes("No stubbed imports yet.");
        }, undefined, { timeout: 15_000 });

        await stopIfRunning(page, 30_000);
      });

      await step("watchdog timeout", async () => {
        // Watchdog timeout UX + recovery.
        // This timeout is used for both compilation and execution; keep it large enough
        // to compile, but small enough to trip the sandbox watchdog quickly.
        await page.click("#clear-btn");
        await page.fill("#timeout-ms", "5000");
        await page.fill("#editor", "Print 1\nWhile 1\nWend\n");
        await page.click("#run-btn");
        await page.waitForFunction(() => {
          const root = document.querySelector("#output");
          if (!root) return false;
          const lines = Array.from(root.querySelectorAll(".output-line"))
            .map((n) => (n.textContent ?? "").trim());
          return lines.some((l) => l.includes("Compilation successful!")) &&
            lines.some((l) => l.includes("Loading compiled module..."));
        }, undefined, { timeout: 60_000 });
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Execution timed out after") || out.includes("Compilation timed out after");
        }, undefined, { timeout: 30_000 });
      });

      await step("stop semantics (watchdog disabled)", async () => {
        // Stop semantics with watchdog disabled: Stop should always bring us back to Ready.
        await page.fill("#timeout-ms", "0");
        await page.fill("#editor", "While 1\nWend\n");
        await page.click("#run-btn");
        await waitForRunStart(page, 10_000);
        await page.waitForFunction(() => {
          const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn");
          const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
          return Boolean(stopBtn && !stopBtn.disabled) && statusText !== "Ready";
        }, undefined, { timeout: 20_000 });
        await page.click("#stop-btn");
        await page.waitForFunction(() => {
          const stopBtn = document.querySelector<HTMLButtonElement>("#stop-btn");
          const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
          return Boolean(stopBtn && stopBtn.disabled) && statusText === "Ready";
        }, undefined, { timeout: 20_000 });
      });

      await step("compile-only does not execute", async () => {
        await clearPanels(page);
        await page.fill("#timeout-ms", "5000");
        await page.selectOption("#example-select", "hello");
        await page.click("#compile-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Compilation successful!");
        }, undefined, { timeout: 60_000 });
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return !out.includes("Execution completed.") && !out.includes("Loading compiled module...");
        }, undefined, { timeout: 5_000 });
      });

      await step("run hello", async () => {
        await page.fill("#timeout-ms", "2000");
        await page.selectOption("#example-select", "hello");
        await page.click("#run-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Hello from Blitz3D WASM!");
        }, undefined, { timeout: 60_000 });
        await stopIfRunning(page, 30_000);
      });

      await step("keyboard nav to run", async () => {
        // Keyboard navigation: Tab to Run, press Enter should start a run.
        await page.click("#clear-btn");
        await page.selectOption("#example-select", "hello");
        await page.focus("body");
        let focused = "";
        for (let i = 0; i < 80; i++) {
          await page.keyboard.press("Tab");
          focused = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id ?? "");
          if (focused === "run-btn") break;
        }
        if (focused !== "run-btn") {
          throw new Error(`[interpreter ui] could not Tab-focus run button (active=${focused})`);
        }
        await page.keyboard.press("Enter");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Compiling Blitz3D code...");
        }, undefined, { timeout: 30_000 });
        await stopIfRunning(page, 30_000);
      });

      await step("breakpoints", async () => {
        // Breakpoint toggling via gutter should reflect in bbdbg panel.
        await page.click("#tab-debug");
        await page.click("#tab-output");
        await page.waitForFunction(() => Boolean(document.querySelector(".editor-linenum")), undefined, {
          timeout: 30_000,
        });
        await page.click('.editor-linenum[data-line="1"]');
        await page.click("#tab-debug");
        await page.waitForFunction(() => {
          const t = document.querySelector("#bbdbg-breakpoints")?.textContent ?? "";
          return t.includes("1");
        }, undefined, { timeout: 30_000 });
        await page.click("#bbdbg-clear-bps-btn");
        await page.waitForFunction(() => {
          const t = document.querySelector("#bbdbg-breakpoints")?.textContent ?? "";
          return t.includes("(none)");
        }, undefined, { timeout: 30_000 });
      });

      await step("downloads (wat)", async () => {
        // Download/export actions.
        // WAT download requires enabling capture before running.
        await page.click("#tab-debug");
        await page.waitForFunction(() => {
          const el = document.querySelector("#debug-tab");
          return Boolean(el?.classList.contains("active"));
        }, undefined, { timeout: 10_000 });
        const watEnabled = page.locator("#wat-enabled");
        try {
          await watEnabled.scrollIntoViewIfNeeded();
          await watEnabled.check();
        } catch {
          // Some layouts may clip the checkbox out of view; fall back to a DOM-set.
          await page.evaluate(() => {
            const el = document.getElementById("wat-enabled") as HTMLInputElement | null;
            if (!el) return;
            el.checked = true;
            el.dispatchEvent(new Event("change", { bubbles: true }));
          });
        }
        await page.click("#tab-output");
        await page.selectOption("#example-select", "hello");
        await page.click("#run-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Compilation successful!");
        }, undefined, { timeout: 60_000 });

        // Download button lives on the Debug tab; switch back so Playwright can click it.
        await page.click("#tab-debug");
        await page.waitForFunction(() => {
          const el = document.querySelector("#debug-tab");
          return Boolean(el?.classList.contains("active"));
        }, undefined, { timeout: 10_000 });

        // WAT copy should be enabled once WAT exists; click should print a success/error message.
        await page.waitForFunction(() => {
          const code = document.querySelector("#wat-code")?.textContent ?? "";
          const copyBtn = document.querySelector<HTMLButtonElement>("#wat-copy-btn");
          return code.includes("(module") && Boolean(copyBtn && !copyBtn.disabled);
        }, undefined, { timeout: 60_000 });
        await page.click("#wat-copy-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("WAT copied to clipboard.") || out.includes("Copy failed:");
        }, undefined, { timeout: 30_000 });

        const watDownloadBtn = page.locator("#wat-download-btn");
        await watDownloadBtn.scrollIntoViewIfNeeded();
        await page.waitForFunction(() => {
          const btn = document.querySelector<HTMLButtonElement>("#wat-download-btn");
          return Boolean(btn && !btn.disabled);
        }, undefined, { timeout: 60_000 });

        // Use Promise.all so we never leave a dangling waitForEvent promise on click failures.
        const [watDownload] = await Promise.all([
          page.waitForEvent("download", { timeout: 60_000 }),
          watDownloadBtn.click(),
        ]);
        const watPath = await Deno.makeTempFile({ prefix: "interpreter-wat-", suffix: ".wat" });
        await watDownload.saveAs(watPath);
        const watText = await Deno.readTextFile(watPath);
        if (!watText.includes("(module")) {
          throw new Error("[interpreter ui] WAT download did not look like WAT");
        }

        // Clear should wipe the preview and disable copy/download.
        await page.click("#wat-clear-btn");
        await page.waitForFunction(() => {
          const summary = document.querySelector("#wat-summary")?.textContent ?? "";
          const code = (document.querySelector("#wat-code")?.textContent ?? "").trim();
          const copyBtn = document.querySelector<HTMLButtonElement>("#wat-copy-btn");
          const dlBtn = document.querySelector<HTMLButtonElement>("#wat-download-btn");
          return summary.includes("No WAT yet") &&
            code === "" &&
            Boolean(copyBtn && copyBtn.disabled) &&
            Boolean(dlBtn && dlBtn.disabled);
        }, undefined, { timeout: 15_000 });

        await stopIfRunning(page, 30_000);
      });

      await step("runtime gaps export", async () => {
        // Runtime gaps export should produce JSON with non-zero totals after debugStubs runs.
        await page.selectOption("#example-select", "debugStubs");
        await page.click("#run-btn");
        await page.waitForFunction(() => {
          const t = document.querySelector("#stubs-summary")?.textContent ?? "";
          return t.trim() !== "" && !t.includes("No stubbed imports yet.");
        }, undefined, { timeout: 60_000 });

        await page.click("#tab-debug");
        const stubsDlPromise = page.waitForEvent("download");
        await page.click("#stubs-export-btn");
        const stubsDl = await stubsDlPromise;
        const stubsPath = await Deno.makeTempFile({ prefix: "interpreter-stubs-", suffix: ".json" });
        await stubsDl.saveAs(stubsPath);
        const stubsObj = JSON.parse(await Deno.readTextFile(stubsPath)) as {
          schemaVersion?: number;
          total?: number;
          called?: Array<unknown>;
        };
        if (stubsObj.schemaVersion !== 2) {
          throw new Error(`[interpreter ui] stubs export schemaVersion mismatch: ${stubsObj.schemaVersion}`);
        }
        if (!stubsObj.total || stubsObj.total <= 0) {
          throw new Error(`[interpreter ui] stubs export total was not > 0: ${stubsObj.total}`);
        }
      });

      await step("bbdbg download/load saved (best-effort)", async () => {
        // bbdbg metadata download is best-effort: if metadata isn't present, the UI prints a warning.
        await page.click("#tab-debug");
        const bbdbgDlPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
        await page.click("#bbdbg-download-meta-btn");
        const bbdbgDl = await bbdbgDlPromise;
        if (bbdbgDl) {
          const bbdbgPath = await Deno.makeTempFile({ prefix: "interpreter-bbdbg-", suffix: ".json" });
          await bbdbgDl.saveAs(bbdbgPath);
          const bbdbgText = await Deno.readTextFile(bbdbgPath);
          if (!bbdbgText.includes("{")) {
            throw new Error("[interpreter ui] bbdbg download did not look like JSON");
          }
        } else {
          await page.waitForFunction(() => {
            const out = document.querySelector("#output")?.textContent ?? "";
            return out.includes("No bbdbg metadata loaded.");
          }, undefined, { timeout: 10_000 });
        }

        // IndexedDB persistence: reload and verify "Load Saved" works.
        await page.reload({ waitUntil: "domcontentloaded" });
        await waitForReady(page);
        await page.click("#tab-debug");
        await page.click("#bbdbg-load-saved-btn");
        await page.waitForFunction(() => {
          const out = document.querySelector("#output")?.textContent ?? "";
          return out.includes("Loaded saved bbdbg") || out.includes("No saved bbdbg found");
        }, undefined, { timeout: 60_000 });
      });
    } finally {
      await browser.close();
      await server.shutdown();
    }
  });
});
