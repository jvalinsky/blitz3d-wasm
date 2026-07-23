/**
 * Decompresses MSZip encoded data from X files.
 * Format:
 * - 4 bytes: Total Uncompressed Size
 * - Sequence of Blocks:
 *   - 2 bytes: Block Uncompressed Size? (Ignored/Check)
 *   - 2 bytes: Block Compressed Size
 *   - Data:
 *     - 2 bytes: MSZip Signature (0x43, 0x4B)
 *     - Deflate Stream
 */
export const decompressMsZip = async (
  data: Uint8Array,
): Promise<Uint8Array> => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  if (data.length < 4) throw new Error("MSZip: data too short");
  const totalUncompressed = view.getUint32(0, true);

  let offset = 4;
  const chunks: Uint8Array[] = [];

  while (offset < data.length) {
    if (offset + 4 > data.length) break;
    const _uncompBlockSize = view.getUint16(offset, true);
    const compBlockSize = view.getUint16(offset + 2, true);
    offset += 4;

    if (offset + compBlockSize > data.length) {
      throw new Error("MSZip: block overflow");
    }

    const blockData = data.subarray(offset, offset + compBlockSize);
    offset += compBlockSize;

    if (
      blockData.length < 2 || blockData[0] !== 0x43 || blockData[1] !== 0x4B
    ) {
      throw new Error("MSZip: Missing CK signature (invalid block)");
    }

    const deflateData = blockData.subarray(2); // Strip CK

    const ds = new DecompressionStream("deflate-raw");
    const writer = ds.writable.getWriter();
    writer.write(deflateData as any);
    writer.close();

    const reader = ds.readable.getReader();
    const chunkParts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunkParts.push(value);
    }

    // Merge chunk parts
    const totalLen = chunkParts.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(totalLen);
    let p = 0;
    for (const c of chunkParts) {
      out.set(c, p);
      p += c.length;
    }
    chunks.push(out);
  }

  // Merge all chunks
  const totalSize = chunks.reduce((acc, c) => acc + c.length, 0);
  // Verify size matches expected?
  // Warning if mismatch?

  const final = new Uint8Array(totalSize);
  let p = 0;
  for (const c of chunks) {
    final.set(c, p);
    p += c.length;
  }

  if (final.length !== totalUncompressed) {
    console.warn(
      `MSZip: Warning: Expected ${totalUncompressed} bytes, got ${final.length}`,
    );
  }

  return final;
};
