import { XFile } from "./types.ts";
import { parseTextX } from "./parse_text_x.ts";
import { parseBinX } from "./parse_bin_x.ts";
import { decompressMsZip } from "./mszip.ts";

export const parseX = async (data: Uint8Array): Promise<XFile> => {
  if (data.length < 16) throw new Error("File too short");
  const head = new TextDecoder().decode(data.slice(0, 16)).toLowerCase();

  if (!head.startsWith("xof ")) throw new Error("Not X file");
  const version = head.slice(4, 8);
  const format = head.slice(8, 12);
  const floatSize = head.slice(12, 16);

  if (format === "txt ") {
    const text = new TextDecoder().decode(data);
    return parseTextX(text);
  } else if (format === "bin ") {
    // Skip header (16 bytes)
    return parseBinX(data.slice(16));
  } else if (format === "tzip") {
    const uncomp = await decompressMsZip(data.slice(16)); // header logic handled inside? No, mszip expect data after header.
    // My mszip.ts expects raw x file minus 16 bytes?
    // No, mszip.ts reads 4 bytes total size.
    // In "bzip" format (compressed X file), the 16 bytes header are standard X header.
    // The MSZip stream follows.
    // So `slice(16)` is correct.
    // tzip -> text
    const text = new TextDecoder().decode(uncomp);
    // But we stripped the header. parseTextX expects header?
    // parseTextX checks for "xof".
    // We should prepend a header?
    // Or modify parseTextX to optionally skip check?
    // "xof 0303txt 0032" + text.
    const newHead = new TextEncoder().encode(`xof ${version}txt ${floatSize}`);
    const full = new Uint8Array(newHead.length + uncomp.length);
    full.set(newHead);
    full.set(uncomp, newHead.length);
    return parseTextX(new TextDecoder().decode(full));
  } else if (format === "bzip") {
    const uncomp = await decompressMsZip(data.slice(16));
    // bzip -> binary
    // Prepend header?
    // parseBinX expects tokens buffer (no header).
    // My `parseBinX` implementation assumes buffer starts with tokens (it doesn't skip header).
    // Wait, `parseBinX` I wrote doesn't skip header.
    // But `parseX` above calls `parseBinX(data.slice(16))`.
    // So `parseBinX` receives just tokens.
    // So for uncompressed data, passing it directly is fine.
    return parseBinX(uncomp);
  }

  throw new Error(`Unsupported X format: ${format}`);
};
