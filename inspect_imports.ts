const wasmPath = Deno.args[0] || "Main.wasm";

try {
  const wasmCode = await Deno.readFile(wasmPath);
  const wasmModule = await WebAssembly.compile(wasmCode);
  const imports = WebAssembly.Module.imports(wasmModule);

  console.log(`Imports for ${wasmPath}:`);
  const organized: Record<string, string[]> = {};

  imports.forEach((imp) => {
    if (!organized[imp.module]) organized[imp.module] = [];
    organized[imp.module].push(imp.name);
  });

  for (const mod in organized) {
    console.log(`\nModule: ${mod}`);
    organized[mod].sort().forEach((name) => {
      console.log(`  - ${name}`);
    });
  }
} catch (e) {
  console.error("Failed to inspect WASM:", e);
}
