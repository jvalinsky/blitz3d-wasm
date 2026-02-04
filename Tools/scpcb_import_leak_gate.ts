#!/usr/bin/env -S deno run -A
/**
 * SCPCB WASM import leak gate
 *
 * Goal: prevent SCPCB user-defined functions from accidentally being emitted as WASM imports.
 *
 * Why this exists:
 * - The web runtime provides a large set of Blitz3D/engine imports (env.*).
 * - SCPCB also defines many helper/gameplay functions in BB source files.
 * - If a SCPCB function name ends up in the WASM import list, the module will instantiate only
 *   if the host provides a stub. That silently breaks gameplay because the real SCPCB logic
 *   never runs.
 *
 * This gate scans the SCPCB source tree for `Function ...` definitions, then asserts that none
 * of those function names appear in the WASM module's function imports.
 *
 * It is intentionally a "coarse" correctness check: if SCPCB defines a function with the same
 * name as a runtime import, we treat that as a leak (because the SCPCB definition should be
 * what executes inside the module).
 */

type Options = {
  wasmPath: string;
  scpcbRoot: string;
  requireRoot: boolean;
  maxPrint: number;
};

const usage = () => {
  console.error(
    [
      "usage: Tools/scpcb_import_leak_gate.ts --wasm <path> [--scpcb-root <dir>] [--require-root]",
      "",
      "Defaults:",
      "  --wasm       web/public/scpcb.wasm",
      "  --scpcb-root ../../scpcb   (relative to this script)",
      "  --max-print  60",
      "",
      "Exit codes:",
      "  0  pass (or skipped when SCPCB root missing and --require-root not set)",
      "  1  gate failed (one or more SCPCB function names appear in WASM imports)",
      "  2  usage/missing args, missing wasm, or missing root with --require-root",
    ].join("\n"),
  );
};

const parseArgs = (): Options => {
  const opts: Options = {
    wasmPath: new URL("../web/public/scpcb.wasm", import.meta.url).pathname,
    scpcbRoot: new URL("../../scpcb/", import.meta.url).pathname,
    requireRoot: false,
    maxPrint: 60,
  };

  for (let i = 0; i < Deno.args.length; i++) {
    const a = Deno.args[i]!;
    if (a === "--wasm") opts.wasmPath = Deno.args[++i] ?? opts.wasmPath;
    else if (a === "--scpcb-root") opts.scpcbRoot = Deno.args[++i] ?? opts.scpcbRoot;
    else if (a === "--require-root") opts.requireRoot = true;
    else if (a === "--max-print") opts.maxPrint = Number(Deno.args[++i] ?? opts.maxPrint);
    else if (a === "-h" || a === "--help") {
      usage();
      Deno.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      usage();
      Deno.exit(2);
    }
  }

  return opts;
};

const statDir = async (p: string) => {
  try {
    const st = await Deno.stat(p);
    return st.isDirectory;
  } catch {
    return false;
  }
};

const statFile = async (p: string) => {
  try {
    const st = await Deno.stat(p);
    return st.isFile;
  } catch {
    return false;
  }
};

async function* walkBbFiles(dir: string): AsyncGenerator<string> {
  for await (const ent of Deno.readDir(dir)) {
    const p = `${dir.replace(/\/+$/g, "")}/${ent.name}`;
    if (ent.isDirectory) {
      yield* walkBbFiles(p);
    } else if (ent.isFile && p.toLowerCase().endsWith(".bb")) {
      yield p;
    }
  }
}

const parseFunctionNamesFromScpcb = async (root: string): Promise<Set<string>> => {
  const out = new Set<string>();

  // `Function Name%(...)` / `Function Name#(...)` / `Function Name$(...)` / `Function Name.Type(...)`
  // We only keep the base function name (Blitz3D is case-insensitive).
  const re =
    /^\s*Function\s+([A-Za-z_][A-Za-z0-9_]*)(?:[%#$])?(?:\.[A-Za-z_][A-Za-z0-9_]*)?/i;

  for await (const p of walkBbFiles(root)) {
    const txt = await Deno.readTextFile(p).catch(() => null);
    if (!txt) continue;
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(re);
      if (m) out.add(m[1]!.toLowerCase());
    }
  }

  return out;
};

const parseWasmFunctionImports = (bytes: Uint8Array): Set<string> => {
  const module = new WebAssembly.Module(bytes);
  const imports = WebAssembly.Module.imports(module)
    .filter((i) => i.kind === "function")
    .map((i) => i.name.toLowerCase());
  return new Set(imports);
};

const main = async () => {
  const opts = parseArgs();

  if (!await statFile(opts.wasmPath)) {
    console.error(`[scpcb-imports] missing wasm: ${opts.wasmPath}`);
    Deno.exit(2);
  }

  const hasRoot = await statDir(opts.scpcbRoot);
  if (!hasRoot) {
    const msg = `[scpcb-imports] SCPCB root not found at ${opts.scpcbRoot}`;
    if (opts.requireRoot) {
      console.error(`${msg} (--require-root set)`);
      Deno.exit(2);
    }
    console.warn(`${msg} (skipping; pass)`);
    return;
  }

  const wasmBytes = await Deno.readFile(opts.wasmPath);
  const wasmImports = parseWasmFunctionImports(wasmBytes);
  const scpcbFns = await parseFunctionNamesFromScpcb(opts.scpcbRoot);

  const leaks = [...scpcbFns].filter((name) => wasmImports.has(name)).sort();

  if (leaks.length === 0) {
    console.log(
      `[scpcb-imports] ok: wasmImports=${wasmImports.size} scpcbFns=${scpcbFns.size} leaks=0`,
    );
    return;
  }

  console.error(
    `[scpcb-imports] FAIL: wasmImports=${wasmImports.size} scpcbFns=${scpcbFns.size} leaks=${leaks.length}`,
  );
  for (const n of leaks.slice(0, Math.max(0, opts.maxPrint | 0))) {
    console.error(`- ${n}`);
  }
  if (leaks.length > opts.maxPrint) {
    console.error(`- … ${leaks.length - opts.maxPrint} more`);
  }
  Deno.exit(1);
};

if (import.meta.main) await main();

