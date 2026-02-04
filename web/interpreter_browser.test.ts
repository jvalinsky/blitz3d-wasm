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
  matched: string;
  statusText: string;
  output: string;
  stubsSummary: string;
  bbdbgSummary: string;
};

type VfsFixture = {
  name: string;
  mimeType: string;
  buffer: Buffer;
};

const EXAMPLE_EXPECTATIONS: Record<string, string[]> = {
  hello: ["Hello from Blitz3D WASM!"],
  languageBasics: ["sum ok:"],
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

const startServer = async (): Promise<TestServer> => {
  const repoRoot = fromFileUrl(new URL("../", import.meta.url));
  const port = Number(Deno.env.get("INTERPRETER_TEST_PORT") ?? 5173);
  const url = `http://127.0.0.1:${port}/interpreter.html`;

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
    stdout: "null",
    stderr: "null",
  }).spawn();

  for (let i = 0; i < 200; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) break;
    } catch {
      // ignore
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
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
        await serverProcess.status;
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
  });
};

const getTextContent = async (page: Page, selector: string): Promise<string> => {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return (el?.textContent ?? "").toString();
  }, selector);
};

const clearPanels = async (page: Page): Promise<void> => {
  await page.click("#clear-btn");
  await page.evaluate(() => {
    (document.getElementById("stubs-clear-btn") as HTMLButtonElement | null)?.click();
    (document.getElementById("bbdbg-clear-btn") as HTMLButtonElement | null)?.click();
  });
};

const stopIfRunning = async (page: Page): Promise<void> => {
  const stopBtn = page.locator("#stop-btn");
  if (await stopBtn.isEnabled()) {
    await stopBtn.click();
  }
  await page.waitForFunction(() => {
    const runBtn = document.querySelector<HTMLButtonElement>("#run-btn");
    const statusText = document.querySelector("#status-text")?.textContent?.trim() ?? "";
    return Boolean(runBtn && !runBtn.disabled && runBtn.textContent?.trim() === "Run") &&
      (statusText === "Ready" || statusText.startsWith("Paused"));
  });
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

const waitForOutputAny = async (
  page: Page,
  expected: string[],
): Promise<string> => {
  await page.waitForFunction((subs: string[]) => {
    const txt = document.querySelector("#output")?.textContent ?? "";
    return subs.some((s) => txt.includes(s));
  }, expected);

  const output = await getTextContent(page, "#output");
  for (const s of expected) {
    if (output.includes(s)) return s;
  }
  return "";
};

const runExample = async (page: Page, key: string): Promise<ExampleReport> => {
  await clearPanels(page);
  await page.selectOption("#example-select", key);
  const timeoutMs = String(
    Math.max(250, Number(Deno.env.get("INTERPRETER_TEST_TIMEOUT_MS") ?? "15000") || 15000),
  );
  await page.fill("#timeout-ms", timeoutMs);
  await page.click("#run-btn");

  const expected = EXAMPLE_EXPECTATIONS[key] ?? [];
  const matched = expected.length > 0
    ? await waitForOutputAny(page, expected)
    : "";

  if (key === "debugStubs") {
    await page.click("#tab-debug");
    await page.waitForFunction(() => {
      const t = document.querySelector("#stubs-summary")?.textContent ?? "";
      return t.trim() !== "" && !t.includes("No stubbed imports yet.");
    });
  }

  const statusText = (await getTextContent(page, "#status-text")).trim();
  const output = await getTextContent(page, "#output");
  const stubsSummary = (await getTextContent(page, "#stubs-summary")).trim();
  const bbdbgSummary = (await getTextContent(page, "#bbdbg-summary")).trim();

  await stopIfRunning(page);

  return {
    key,
    expected,
    matched,
    statusText,
    output,
    stubsSummary,
    bbdbgSummary,
  };
};

Deno.test("interpreter demos smoke", async () => {
  await ensureCompilerWasmInPublic();
  const server = await startServer();
  console.log(`[interpreter test] server: ${server.url}`);

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
  const consoleErrors: string[] = [];

  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120_000);

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
      if (res.status() === 404) {
        const url = res.url();
        http404.push(url);
        console.log("[http 404]", url);
      }
      const url = res.url();
      if (url.includes("blitz3d-compiler.wasm")) {
        console.log("[compiler wasm response]", res.status(), url);
      }
    });

    await page.goto(server.url, { waitUntil: "domcontentloaded" });
    await waitForReady(page);

    await uploadVfsFixtures(page);

    const onlyRaw = (Deno.env.get("INTERPRETER_TEST_ONLY") ?? "").trim();
    const only = onlyRaw.length > 0
      ? new Set(onlyRaw.split(",").map((s) => s.trim()).filter(Boolean))
      : null;

    const keys = (await getExampleKeys(page)).filter((k) => !only || only.has(k));
    const report: ExampleReport[] = [];
    for (const key of keys) {
      console.log(`[interpreter test] running example: ${key}`);
      report.push(await runExample(page, key));
    }

    const reportPath = Deno.env.get("INTERPRETER_TEST_REPORT_PATH") ??
      "/tmp/interpreter_demo_report.json";
    await Deno.writeTextFile(
      reportPath,
      JSON.stringify({ url: server.url, http404, consoleErrors, report }, null, 2),
    );
    console.log(`[interpreter test] wrote report: ${reportPath}`);

    for (const r of report) {
      if (r.expected.length === 0) continue;
      if (!r.matched) {
        throw new Error(`example ${r.key} did not match any expected output`);
      }
    }
  } finally {
    await browser.close();
    await server.shutdown();
  }
});
