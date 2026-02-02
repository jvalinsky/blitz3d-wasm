// Audit a compiled BB->WASM module's `env.*` imports against the web
// interpreter's thin runtime (`web/interpreter.js`).
//
// Usage:
//   deno run -A Tools/interpreter_import_audit.ts path/to/program.wasm
//
// Output:
// - total env imports
// - runtime implemented symbols
// - missing env imports (sorted)
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

function parseInterpreterRuntimeKeys(source: string): Set<string> {
  const marker = "const functions = {";
  const idx = source.indexOf(marker);
  if (idx === -1) {
    throw new Error(
      "Failed to find `const functions = {` in web/interpreter.js",
    );
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
    if (m) keys.add(m[1]);
  }
  return keys;
}

async function listEnvImports(wasmBytes: Uint8Array): Promise<string[]> {
  const module = await WebAssembly.compile(wasmBytes);
  return WebAssembly.Module.imports(module)
    .filter((i) => i.module === "env" && i.kind === "function")
    .map((i) => i.name);
}

if (Deno.args.length < 1) usage();

const interpreterJS = await Deno.readTextFile("web/interpreter.js");
const implemented = parseInterpreterRuntimeKeys(interpreterJS);

const allImports = new Set<string>();
for (const wasmPath of Deno.args) {
  const bytes = await Deno.readFile(wasmPath);
  const imports = await listEnvImports(bytes);
  for (const name of imports) allImports.add(name);
}

const envImports = uniqSorted(allImports);
const missing = envImports.filter((name) => !implemented.has(name));
const extra = uniqSorted([...implemented].filter((k) => !allImports.has(k)));

function safeLog(text: string) {
  try {
    console.log(text);
  } catch (err) {
    // When piping to `head`, stdout can close early.
    if (err instanceof Deno.errors.BrokenPipe) Deno.exit(0);
    throw err;
  }
}

safeLog(`env imports: ${envImports.length}`);
safeLog(`runtime implemented: ${implemented.size}`);
safeLog(`missing in runtime: ${missing.length}`);
if (missing.length) {
  safeLog("\n--- missing env imports ---");
  safeLog(missing.join("\n"));
}

safeLog(`\nimplemented but not required (by these modules): ${extra.length}`);
if (extra.length) {
  safeLog("\n--- extra runtime keys ---");
  safeLog(extra.join("\n"));
}
