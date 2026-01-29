import { SmpkFile, SmpkJson } from "./types.ts";

const MAGIC = new Uint8Array([0x53, 0x4d, 0x50, 0x4b]); // "SMPK"

const writeU32LE = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value >>> 0, true);
};

const readU32LE = (view: DataView, offset: number) => view.getUint32(offset, true);

export const encodeSmpk = (file: SmpkFile): Uint8Array => {
  const jsonText = JSON.stringify(file.json);
  const jsonBytes = new TextEncoder().encode(jsonText);
  const binBytes = file.bin ?? new Uint8Array();

  const headerLen = 16;
  const totalLen = headerLen + jsonBytes.byteLength + binBytes.byteLength;
  const out = new Uint8Array(totalLen);
  out.set(MAGIC, 0);
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  writeU32LE(dv, 4, 1); // version
  writeU32LE(dv, 8, jsonBytes.byteLength);
  writeU32LE(dv, 12, binBytes.byteLength);
  out.set(jsonBytes, headerLen);
  out.set(binBytes, headerLen + jsonBytes.byteLength);
  return out;
};

export const decodeSmpk = (bytes: Uint8Array): SmpkFile => {
  if (bytes.byteLength < 16) throw new Error("SMPK too small");
  if (
    bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1] || bytes[2] !== MAGIC[2] ||
    bytes[3] !== MAGIC[3]
  ) {
    throw new Error("Invalid SMPK magic");
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = readU32LE(dv, 4);
  if (version !== 1) throw new Error(`Unsupported SMPK version ${version}`);
  const jsonLen = readU32LE(dv, 8);
  const binLen = readU32LE(dv, 12);
  const headerLen = 16;
  const jsonStart = headerLen;
  const jsonEnd = jsonStart + jsonLen;
  const binStart = jsonEnd;
  const binEnd = binStart + binLen;
  if (binEnd > bytes.byteLength) throw new Error("SMPK truncated");

  const jsonBytes = bytes.subarray(jsonStart, jsonEnd);
  const jsonText = new TextDecoder().decode(jsonBytes);
  const json = JSON.parse(jsonText) as SmpkJson;
  if (!json || json.version !== 1) throw new Error("Invalid SMPK JSON");
  const bin = bytes.subarray(binStart, binEnd);
  return { json, bin };
};

