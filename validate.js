const buf = Deno.readFileSync("temp.wasm");

try {
  const mod = new WebAssembly.Module(buf);
  console.log("Valid!");
} catch (e) {
  console.error(e.toString());
}
