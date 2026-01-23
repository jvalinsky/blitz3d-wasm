// Simple WASM validator

const wasmPath = Deno.args[0] || "input_test.wasm";
const wasmBuffer = Deno.readFileSync(wasmPath);
const view = new DataView(wasmBuffer.buffer, wasmBuffer.byteOffset, wasmBuffer.byteLength);

console.log(`WASM file size: ${wasmBuffer.length} bytes`);
console.log(`Magic number: 0x${toHex(wasmBuffer.subarray(0, 4))}`);
console.log(`Version: ${view.getUint32(4, true)}`);

let offset = 8;
let sectionIndex = 0;

while (offset < wasmBuffer.length) {
  const sectionId = readVaruint(wasmBuffer, offset);
  const sectionStart = offset;
  const size = readVaruint(wasmBuffer, offset);
  const contentStart = offset;

  console.log(`\nSection ${sectionIndex}:`);
  console.log(`  ID: ${sectionId}`);
  console.log(`  Size: ${size} bytes`);
  console.log(`  Content starts at: ${contentStart}`);
  console.log(`  Content: ${toHex(wasmBuffer.subarray(offset, offset + Math.min(20, size)))}`);

  offset = contentStart + size;
  sectionIndex++;

  if (sectionId === 0) break; // End of sections
}

function readVaruint(buffer, offset) {
  let result = 0;
  let shift = 0;
  let byte;

  do {
    byte = buffer[offset++];
    result |= (byte & 0x7f) << shift;
    shift += 7;
  } while (byte & 0x80);

  return result;
}

function toHex(buffer) {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
