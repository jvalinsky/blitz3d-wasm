// Simple WASM validator
const fs = require('fs');

const wasmPath = process.argv[2] || 'input_test.wasm';
const wasmBuffer = fs.readFileSync(wasmPath);

console.log(`WASM file size: ${wasmBuffer.length} bytes`);
console.log(`Magic number: 0x${wasmBuffer.slice(0, 4).toString('hex')}`);
console.log(`Version: ${wasmBuffer.readUInt32LE(4)}`);

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
    console.log(`  Content: ${wasmBuffer.slice(offset, offset + Math.min(20, size)).toString('hex')}`);
    
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
        result |= (byte & 0x7F) << shift;
        shift += 7;
    } while (byte & 0x80);
    
    return result;
}
