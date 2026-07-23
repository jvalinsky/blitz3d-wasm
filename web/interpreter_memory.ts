// Pure (non-DOM) helpers for the Blitz3D interpreter memory panel.

export function parseByteOffset(s: string): number {
  const t = String(s ?? "").trim().toLowerCase();
  if (!t) return 0;
  if (t.startsWith("0x")) return Number.parseInt(t.slice(2), 16) || 0;
  if (t.startsWith("$")) return Number.parseInt(t.slice(1), 16) || 0;
  return Number.parseInt(t, 10) || 0;
}

export function isAllZero(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false;
  return true;
}

export function formatHexDump(bytes: Uint8Array, baseOffset: number): string {
  const lines: string[] = [];
  const row = 16;
  for (let i = 0; i < bytes.length; i += row) {
    const off = (baseOffset + i) >>> 0;
    const slice = bytes.subarray(i, Math.min(bytes.length, i + row));
    const hex = [...slice].map((b) => b.toString(16).padStart(2, "0")).join(
      " ",
    );
    const pad = "   ".repeat(row - slice.length);
    const ascii = [...slice].map((b) =>
      (b >= 32 && b <= 126) ? String.fromCharCode(b) : "."
    ).join("");
    lines.push(
      `${off.toString(16).padStart(8, "0")}: ${hex}${pad}  |${ascii}|`,
    );
  }
  return lines.join("\n");
}
