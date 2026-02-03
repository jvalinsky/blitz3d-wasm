// Audit a compiled BB->WASM module's `env.*` imports against the web
// runtime/import implementations (TypeScript under `web/src/runtime/` and
// `web/interpreter.ts`).
//
// Usage:
//   deno run -A Tools/interpreter_import_audit.ts path/to/program.wasm
//
// Output:
// - total imports by module
// - implemented symbols by module (from sources)
// - missing imports by module (sorted)
//
// Notes:
// - The compiler currently imports a large default runtime surface even when
//   unused. This tool is still useful to prioritize what the interpreter
//   should implement vs stub.

function usage(): never {
  console.error(
    "Usage: deno run -A Tools/interpreter_import_audit.ts <program.wasm> [more.wasm...]",
  );
  Deno.exit(2);
}

function uniqSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

type Mod = "env" | "blitz3d" | "al";

function parseImportsAssignments(source: string): Map<Mod, Set<string>> {
  const out = new Map<Mod, Set<string>>([
    ["env", new Set()],
    ["blitz3d", new Set()],
    ["al", new Set()],
  ]);

  const re = /\bimports\.(env|blitz3d|al)\.([A-Za-z0-9_]+)\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    const mod = m[1] as Mod;
    out.get(mod)!.add(m[2]);
  }
  return out;
}

async function listFnImports(
  wasmBytes: Uint8Array,
): Promise<Map<string, Set<string>>> {
  const module = await WebAssembly.compile(wasmBytes);
  const out = new Map<string, Set<string>>();
  for (const i of WebAssembly.Module.imports(module)) {
    if (i.kind !== "function") continue;
    const set = out.get(i.module) ?? new Set<string>();
    set.add(i.name);
    out.set(i.module, set);
  }
  return out;
}

if (Deno.args.length < 1) usage();

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

const sources: string[] = [];
for await (const p of walkFiles("web/src/runtime")) {
  if (p.endsWith(".ts")) sources.push(await Deno.readTextFile(p));
}
for await (const p of walkFiles("web/src/shared")) {
  if (p.endsWith(".ts")) sources.push(await Deno.readTextFile(p));
}
sources.push(await Deno.readTextFile("web/interpreter.ts"));

const implementedByModule = new Map<string, Set<string>>();
for (const src of sources) {
  const parsed = parseImportsAssignments(src);
  for (const [mod, keys] of parsed.entries()) {
    const set = implementedByModule.get(mod) ?? new Set<string>();
    for (const k of keys) set.add(k);
    implementedByModule.set(mod, set);
  }
}

const requiredByModule = new Map<string, Set<string>>();
for (const wasmPath of Deno.args) {
  const bytes = await Deno.readFile(wasmPath);
  const imports = await listFnImports(bytes);
  for (const [mod, names] of imports.entries()) {
    const set = requiredByModule.get(mod) ?? new Set<string>();
    for (const n of names) set.add(n);
    requiredByModule.set(mod, set);
  }
}

function safeLog(text: string) {
  try {
    console.log(text);
  } catch (err) {
    // When piping to `head`, stdout can close early.
    if (err instanceof Deno.errors.BrokenPipe) Deno.exit(0);
    throw err;
  }
}

for (const mod of uniqSorted(requiredByModule.keys())) {
  const required = requiredByModule.get(mod)!;
  const implemented = implementedByModule.get(mod) ?? new Set<string>();
  const req = uniqSorted(required);
  const miss = req.filter((n) => !implemented.has(n));

  safeLog(`${mod} imports: ${req.length}`);
  safeLog(`${mod} implemented: ${implemented.size}`);
  safeLog(`${mod} missing: ${miss.length}`);
  if (miss.length) {
    safeLog(`\n--- missing ${mod} imports ---`);
    safeLog(miss.join("\n"));
  }
  safeLog("");
}
