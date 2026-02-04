#!/usr/bin/env -S deno run -A
import { dirname, join } from "std/path/mod.ts";

type Args = {
  sdk: string;
  configuration: "debug" | "release";
};

const parseArgs = (argv: string[]): Args => {
  let sdk = "swift-6.2.3-RELEASE_wasm";
  let configuration: Args["configuration"] = "release";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--sdk") sdk = argv[++i] ?? sdk;
    else if (a === "-c" || a === "--configuration") {
      const v = argv[++i];
      if (v === "debug" || v === "release") configuration = v;
    } else if (a === "--debug") configuration = "debug";
    else if (a === "--release") configuration = "release";
  }

  return { sdk, configuration };
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path);
    return true;
  } catch {
    return false;
  }
};

const repoRoot = new URL("../", import.meta.url).pathname;

const run = async (
  cmd: string[],
  opts?: { cwd?: string; env?: Record<string, string> },
): Promise<void> => {
  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    cwd: opts?.cwd,
    env: opts?.env,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const { code } = await p.status;
  if (code !== 0) throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
};

const ensureDir = async (path: string): Promise<void> => {
  await Deno.mkdir(path, { recursive: true });
};

const { sdk, configuration } = parseArgs(Deno.args);

const home = Deno.env.get("HOME") ?? "";
const swiftBinEnv = Deno.env.get("SWIFT_BIN");
const swiftToolchainLatest = home
  ? join(
    home,
    "Library/Developer/Toolchains/swift-latest.xctoolchain/usr/bin/swift",
  )
  : null;
const swiftToolchain623 = home
  ? join(
    home,
    "Library/Developer/Toolchains/swift-6.2.3-RELEASE.xctoolchain/usr/bin/swift",
  )
  : null;

let swiftBin = "swift";
if (swiftBinEnv) {
  swiftBin = swiftBinEnv;
} else if (swiftToolchainLatest && await exists(swiftToolchainLatest)) {
  swiftBin = swiftToolchainLatest;
} else if (swiftToolchain623 && await exists(swiftToolchain623)) {
  swiftBin = swiftToolchain623;
}

await ensureDir("/tmp/clang-module-cache");
await ensureDir("/tmp/swiftpm-cache");

const swiftEnv = {
  ...Deno.env.toObject(),
  CLANG_MODULE_CACHE_PATH: "/tmp/clang-module-cache",
  SWIFTPM_CACHE_PATH: "/tmp/swiftpm-cache",
};

await run([
  swiftBin,
  "build",
  "--disable-sandbox",
  "--package-path",
  "compiler-wasm",
  "--product",
  "blitz3d-compiler",
  "--swift-sdk",
  sdk,
  "-c",
  configuration,
], { cwd: repoRoot, env: swiftEnv });

const outDir = join(
  repoRoot,
  "compiler-wasm/.build/wasm32-unknown-wasip1",
  configuration,
);
const builtWasm = join(outDir, "blitz3d-compiler.wasm");

const webWasm = join(repoRoot, "web/blitz3d-compiler.wasm");
const publicWasm = join(repoRoot, "web/public/blitz3d-compiler.wasm");

await ensureDir(dirname(webWasm));
await ensureDir(dirname(publicWasm));

await Deno.copyFile(builtWasm, webWasm);
await Deno.copyFile(builtWasm, publicWasm);

const size = (await Deno.stat(builtWasm)).size;
console.log(`[compiler:build] wrote web/blitz3d-compiler.wasm (${size} bytes)`);
console.log(
  `[compiler:build] wrote web/public/blitz3d-compiler.wasm (${size} bytes)`,
);
