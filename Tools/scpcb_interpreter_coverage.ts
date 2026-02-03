// SCPCB → Interpreter coverage report.
//
// Reads `import_requirements_full.json` (function usage across SCPCB sources)
// and compares it to:
// - the web runtime import implementations (TypeScript sources under `web/src/runtime/`)
// - the interpreter’s sandbox worker imports (`web/interpreter.ts`)
// - the compiler-worker auto-import allowlist (`web/compiler_worker.ts`)
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

function parseImportsAssignments(source: string): Set<string> {
  const keys = new Set<string>();
  // Match common patterns across the runtime:
  //   imports.env.Foo = ...
  //   imports.blitz3d.ParseRMesh = ...
  //   imports.al.alSourcePlay = ...
  const re = /\bimports\.(env|blitz3d|al)\.([A-Za-z0-9_]+)\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    keys.add(canonical(m[2]));
  }
  return keys;
}

function parseWorkerAutoImports(source: string): Set<string> {
  const marker = "const autoImports = [";
  const idx = source.indexOf(marker);
  if (idx === -1) {
    throw new Error("Failed to find `const autoImports = [` in web/compiler_worker.ts");
  }
  const slice = source.slice(idx + marker.length);
  const end = slice.indexOf("];");
  if (end === -1) {
    throw new Error("Failed to find end of autoImports list in web/compiler_worker.ts");
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

async function* walkFiles(root: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(root)) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkFiles(path);
    } else if (entry.isFile) {
      yield path;
    }
  }
}

async function readSources(paths: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const p of paths) out.push(await Deno.readTextFile(p));
  return out;
}

const topN = parseArgNumber("--top", 80);
const checkAllowlist = Deno.args.includes("--check-allowlist");

const reqRaw = await Deno.readTextFile("import_requirements_full.json");
const req = JSON.parse(reqRaw) as ImportReqMap;

const workerTS = await Deno.readTextFile("web/compiler_worker.ts");
const allowlisted = parseWorkerAutoImports(workerTS);

// Collect runtime sources (TypeScript).
const runtimeFiles: string[] = [];
for await (const p of walkFiles("web/src/runtime")) {
  if (p.endsWith(".ts")) runtimeFiles.push(p);
}
for await (const p of walkFiles("web/src/shared")) {
  if (p.endsWith(".ts")) runtimeFiles.push(p);
}
runtimeFiles.push("web/interpreter.ts");

const sources = await readSources(runtimeFiles);
const implemented = new Set<string>();
for (const src of sources) {
  for (const k of parseImportsAssignments(src)) implemented.add(k);
}

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

// “Implemented but not allowlisted” can cause invalid-WASM when a function is
// used in an expression position (e.g. `a = CreatePivot()`).
//
// The full runtime implements far more functions than we need to auto-import in
// the compiler worker. Only flag functions that appear in SCPCB sources.
const scpcbImplementedNotAllowlisted = uniqSorted(
  scpcb
    .filter((e) => e.implemented && !e.allowlisted)
    .map((e) => e.name),
);
safePrint("");
safePrint(
  `SCPCB-used + implemented, but not allowlisted: ${scpcbImplementedNotAllowlisted.length}`,
);
if (scpcbImplementedNotAllowlisted.length) {
  safePrint("");
  safePrint("--- SCPCB-used implemented but not allowlisted ---");
  for (const k of scpcbImplementedNotAllowlisted) safePrint(k);
}

if (checkAllowlist && scpcbImplementedNotAllowlisted.length) {
  Deno.exit(1);
}
