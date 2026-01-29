
// verify_main.ts
const filename = "Main.wasm";
console.log(`Reading ${filename}...`);

try {
  const wasmBuffer = Deno.readFileSync(filename);
  console.log(`Size: ${wasmBuffer.length} bytes`);

  const module = new WebAssembly.Module(wasmBuffer);
  console.log("Module compiled successfully.");

  const imports = WebAssembly.Module.imports(module);
  console.log(`Detected ${imports.length} imports.`);

  // Mock imports
  const importObject = {};

  for (const imp of imports) {
    if (!importObject[imp.module]) {
      importObject[imp.module] = {};
    }

    if (imp.kind === "function") {
      importObject[imp.module][imp.name] = function (...args) {
        return 0;
      };
    } else if (imp.kind === "memory") {
      importObject[imp.module][imp.name] = new WebAssembly.Memory({ initial: 256, maximum: 32768 });
    } else if (imp.kind === "global") {
      // Guess type. Usually i32.
      importObject[imp.module][imp.name] = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
    } else if (imp.kind === "table") {
      importObject[imp.module][imp.name] = new WebAssembly.Table({ initial: 10, element: "anyfunc" });
    }
  }

  console.log("Attempting instantiation with mocks...");
  const instance = new WebAssembly.Instance(module, importObject);

  console.log("✅ Instantiation successful!");

  const exports = WebAssembly.Module.exports(module);
  console.log(`Detected ${exports.length} exports.`);

  const exportedNames = exports.map(e => e.name);
  // console.log("Exported names (first 20):", exportedNames.slice(0, 20));

  const mainExports = exportedNames.filter(n => n.toLowerCase() === "main" || n.toLowerCase() === "bbmain");

  if (mainExports.length > 0) {
    console.log(`Found main export(s): ${JSON.stringify(mainExports)}`);
  } else {
    if (exportedNames.includes("_start")) {
      console.log("Found '_start' export (WASI style).");
    } else {
      console.warn("WARNING: Neither 'main' (any case) nor '_start' found.");

      // fuzzy search
      const candidates = exportedNames.filter(n => n.toLowerCase().includes("main"));
      if (candidates.length > 0) {
        console.log("Candidates found containing 'main':", candidates);
      }
    }
  }

  // globals check
  if (exportedNames.includes("ParticleCam")) console.log("Confimred: ParticleCam exported.");

} catch (e) {
  console.error("❌ verification failed:", e);
  Deno.exit(1);
}
