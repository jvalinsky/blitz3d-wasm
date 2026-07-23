const filename = "web/public/GFX/items/Battery/Battery.x";
const data = await Deno.readFile(filename);
console.log("File size:", data.length);

const view = new DataView(data.buffer);

const magic = new TextDecoder().decode(data.slice(0, 4));
if (magic !== "xof ") throw new Error("Not X file");

const type = new TextDecoder().decode(data.slice(8, 12));
console.log("Compression type:", type);

if (type !== "bzip") {
  console.log("Not bzip, exiting");
  Deno.exit(0);
}

const totalUncompressed = view.getUint32(16, true);
console.log("Total Uncompressed:", totalUncompressed);

let offset = 20;
const chunks: Uint8Array[] = [];

while (offset < data.length) {
  if (offset + 4 > data.length) break;
  const uncompBlockSize = view.getUint16(offset, true);
  const compBlockSize = view.getUint16(offset + 2, true);
  offset += 4;

  console.log(
    `Block: uncomp=${uncompBlockSize}, comp=${compBlockSize} at ${offset}`,
  );

  if (offset + compBlockSize > data.length) {
    console.error("Block overflows file");
    break;
  }

  const blockData = data.slice(offset, offset + compBlockSize);
  offset += compBlockSize;

  if (blockData[0] !== 0x43 || blockData[1] !== 0x4B) {
    console.error("Missing CK signature");
    break;
  }

  const deflateData = blockData.slice(2);
  try {
    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(deflateData);
    writer.close();

    const chunksBuf = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunksBuf.push(value);
    }

    // Merge chunks
    const total = chunksBuf.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(total);
    let p = 0;
    for (const c of chunksBuf) {
      out.set(c, p);
      p += c.length;
    }
    chunks.push(out);
    console.log(`Decompressed ${out.length} bytes`);
  } catch (e) {
    console.error("Decompression failed:", e);
    break;
  }
}

// Merge all blocks
const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
const final = new Uint8Array(totalSize);
let p = 0;
for (const c of chunks) {
  final.set(c, p);
  p += c.length;
}

console.log("Final decmpressed size:", final.length);
console.log("Head:", new TextDecoder().decode(final.slice(0, 64)));
console.log(
  "Hex head:",
  [...final.slice(0, 32)].map((b) => b.toString(16).padStart(2, "0")).join(" "),
);
