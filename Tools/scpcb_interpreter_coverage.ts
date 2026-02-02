// SCPCB → Interpreter coverage report.
//
// Reads `import_requirements_full.json` (function usage across SCPCB sources)
// and compares it to the interpreter thin runtime (`web/interpreter.js`) plus
// the compiler-worker auto-import allowlist (`web/compiler_worker.js`).
//
// Usage:
//   deno run -A Tools/scpcb_interpreter_coverage.ts [--top 80]
//
// Notes:
// - This is a prioritization tool for SCPCB-complete work.
// - It does not prove semantic correctness; it only highlights missing symbols.

type ImportReqEntry = {
  name?: string;
  calls?: number;
  files?: string[];
};

type ImportReqMap = Record<string, ImportReqEntry>;

function parseArgNumber(flag: string, fallback: number): number {
  const i = Deno.args.indexOf(flag);
  if (i === -1) return fallback;
  const raw = Deno.args[i + 1];
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function canonical(name: string): string {
  let s = String(name || "").trim().toLowerCase();
  s = s.replace(/[$%#]+$/g, "");
  return s;
}

function uniqSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function parseInterpreterRuntimeKeys(source: string): Set<string> {
  const marker = "const functions = {";
  const idx = source.indexOf(marker);
  if (idx === -1) {
    throw new Error("Failed to find `const functions = {` in web/interpreter.js");
  }

  const slice = source.slice(idx + marker.length);
  const end = slice.indexOf("\n  };");
  if (end === -1) {
    throw new Error("Failed to find end of `functions` object in interpreter");
  }

  const body = slice.slice(0, end);
  const keys = new Set<string>();
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*:\s*\(/);
    if (m) keys.add(canonical(m[1]));
  }
  return keys;
}

function parseWorkerAutoImports(source: string): Set<string> {
  const marker = "const autoImports = [";
  const idx = source.indexOf(marker);
  if (idx === -1) {
    throw new Error("Failed to find `const autoImports = [` in web/compiler_worker.js");
  }
  const slice = source.slice(idx + marker.length);
  const end = slice.indexOf("];");
  if (end === -1) {
    throw new Error("Failed to find end of autoImports list in web/compiler_worker.js");
  }
  const body = slice.slice(0, end);
  const keys = new Set<string>();
  for (const line of body.split("\n")) {
    const m = line.match(/"([^"]+)"/);
    if (m) keys.add(canonical(m[1]));
  }
  return keys;
}

function safePrint(line: string) {
  try {
    console.log(line);
  } catch (err) {
    if (err instanceof Deno.errors.BrokenPipe) Deno.exit(0);
    throw err;
  }
}

const topN = parseArgNumber("--top", 80);
const checkAllowlist = Deno.args.includes("--check-allowlist");

const reqRaw = await Deno.readTextFile("import_requirements_full.json");
const req = JSON.parse(reqRaw) as ImportReqMap;

const interpreterJS = await Deno.readTextFile("web/interpreter.js");
const workerJS = await Deno.readTextFile("web/compiler_worker.js");

const implemented = parseInterpreterRuntimeKeys(interpreterJS);
const allowlisted = parseWorkerAutoImports(workerJS);

const entries = Object.entries(req).map(([k, v]) => {
  const name = canonical(v?.name ?? k);
  const calls = Number(v?.calls ?? 0) || 0;
  const files = Array.isArray(v?.files) ? v.files : [];
  const scpcbFiles = files.filter((p) => String(p).includes("/scpcb/"));
  return {
    key: k,
    name,
    calls,
    files,
    scpcbFiles,
    isInScpcb: scpcbFiles.length > 0,
    implemented: implemented.has(name),
    allowlisted: allowlisted.has(name),
  };
});

const scpcb = entries.filter((e) => e.isInScpcb);
scpcb.sort((a, b) => (b.calls - a.calls) || a.name.localeCompare(b.name));

const missingRuntime = scpcb.filter((e) => !e.implemented);
const missingAllowlist = scpcb.filter((e) => !e.allowlisted);

safePrint(`SCPCB functions in import_requirements_full.json: ${scpcb.length}`);
safePrint(`Interpreter runtime implements: ${implemented.size}`);
safePrint(`Worker autoImports allowlist: ${allowlisted.size}`);
safePrint("");
safePrint(`Missing in interpreter runtime: ${missingRuntime.length}`);
safePrint(`Missing in worker allowlist: ${missingAllowlist.length}`);

safePrint("");
safePrint(`--- Top ${topN} missing runtime (by call count) ---`);
for (const e of missingRuntime.slice(0, topN)) {
  safePrint(`${e.calls.toString().padStart(6, " ")}  ${e.name}`);
}

safePrint("");
safePrint(`--- Top ${topN} missing allowlist (by call count) ---`);
for (const e of missingAllowlist.slice(0, topN)) {
  safePrint(`${e.calls.toString().padStart(6, " ")}  ${e.name}`);
}

// Also show “implemented but not in allowlist” (can cause invalid-WASM when used in expressions).
const implementedNotAllowlisted = uniqSorted(
  [...implemented].filter((k) => !allowlisted.has(k)),
);
safePrint("");
safePrint(
  `Implemented in runtime but not allowlisted: ${implementedNotAllowlisted.length}`,
);
if (implementedNotAllowlisted.length) {
  safePrint("");
  safePrint("--- implemented but not allowlisted ---");
  for (const k of implementedNotAllowlisted) safePrint(k);
}

if (checkAllowlist && implementedNotAllowlisted.length) {
  Deno.exit(1);
}
