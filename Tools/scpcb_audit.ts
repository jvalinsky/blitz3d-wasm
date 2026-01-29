#!/usr/bin/env -S deno run -A
/**
 * SCPCB audit helper
 *
 * Scans `../scpcb` for:
 * - literal asset references ending in .b3d/.x/.rmesh
 * - LoadMesh/LoadAnimMesh callsites with non-literal (dynamic) arguments
 *
 * Usage:
 *   deno run -A Tools/scpcb_audit.ts
 *   deno run -A Tools/scpcb_audit.ts --root ../scpcb --json
 */

type AssetHit = {
  file: string;
  line: number;
  text: string;
  asset: string;
  ext: string;
};

type DynamicCallHit = {
  file: string;
  line: number;
  fn: string;
  arg: string;
  text: string;
};

const args = new Set(Deno.args);
const rootArgIdx = Deno.args.findIndex((a) => a === "--root");
const root = rootArgIdx >= 0 ? (Deno.args[rootArgIdx + 1] ?? "../scpcb") : "../scpcb";
const jsonOut = args.has("--json");
const maxPerFile = 5000;

const exts = new Set(["b3d", "x", "rmesh"]);

const normalizePath = (p: string) => p.replaceAll("\\", "/");

const walkBbFiles = async function* (dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      // Skip obvious build artifacts.
      if (entry.name === "bin" || entry.name === "dist" || entry.name === "node_modules") continue;
      yield* walkBbFiles(full);
      continue;
    }
    if (!entry.isFile) continue;
    if (entry.name.toLowerCase().endsWith(".bb")) yield full;
  }
};

const readText = async (path: string): Promise<string> => {
  const data = await Deno.readFile(path);
  // SCPCB sources are effectively ANSI/Latin-1-ish; decode leniently.
  return new TextDecoder("latin1", { fatal: false }).decode(data);
};

const stripInlineComment = (line: string) => {
  // Blitz3D uses `;` for comments. Keep it simple: if the line starts with comment, drop it.
  const trimmed = line.trimStart();
  if (trimmed.startsWith(";")) return "";
  return line;
};

const extractAssetsFromLine = (
  file: string,
  lineNo: number,
  line: string,
): AssetHit[] => {
  const hits: AssetHit[] = [];
  // Match quoted strings containing a recognized extension.
  // Example: "GFX\\map\\door01.x"
  const re = /"([^"\r\n]*\.(b3d|x|rmesh))"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const assetRaw = m[1] ?? "";
    const ext = (m[2] ?? "").toLowerCase();
    if (!exts.has(ext)) continue;
    // Filter obvious non-asset string fragments like ".b3d" or "_opt.rmesh".
    const normalized = normalizePath(assetRaw);
    if (normalized === "temp.x") continue;
    if (
      (normalized.startsWith(".") || normalized.startsWith("_")) &&
      !normalized.includes("/") && !normalized.includes("\\")
    ) continue;
    // Require some indication of a path (avoid matching extension-only tokens).
    if (
      !normalized.includes("/") && !normalized.includes("\\") &&
      !/^(GFX|Data|Loadingscreens)\b/i.test(normalized)
    ) continue;
    hits.push({
      file,
      line: lineNo,
      text: line,
      asset: assetRaw,
      ext,
    });
  }
  return hits;
};

const extractDynamicMeshCallsFromLine = (
  file: string,
  lineNo: number,
  line: string,
): DynamicCallHit[] => {
  const hits: DynamicCallHit[] = [];
  // Capture first argument of LoadMesh/LoadAnimMesh, including _Strict variants.
  const re =
    /\b(LoadAnimMesh_Strict|LoadMesh_Strict|LoadAnimMesh|LoadMesh)\s*\(\s*([^\),]+)\s*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const fn = m[1] ?? "";
    const arg = (m[2] ?? "").trim();
    if (!fn) continue;
    // If it's a string literal, it's handled by asset extraction.
    if (arg.startsWith("\"")) continue;
    // If it’s clearly empty or numeric, ignore.
    if (!arg || /^[0-9.\-+]+$/.test(arg)) continue;
    // Skip obvious commented-out (inline) occurrences.
    if (line.trimStart().startsWith(";")) continue;
    hits.push({ file, line: lineNo, fn, arg, text: line });
  }
  return hits;
};

const main = async () => {
  const assets: AssetHit[] = [];
  const dynamicCalls: DynamicCallHit[] = [];

  for await (const path of walkBbFiles(root)) {
    const txt = await readText(path);
    const rel = normalizePath(path);

    let lineNo = 0;
    let perFile = 0;
    for (const rawLine of txt.split(/\r?\n/)) {
      lineNo += 1;
      if (perFile > maxPerFile) break;
      const line = stripInlineComment(rawLine);
      if (!line) continue;
      assets.push(...extractAssetsFromLine(rel, lineNo, rawLine));
      dynamicCalls.push(...extractDynamicMeshCallsFromLine(rel, lineNo, rawLine));
      perFile += 1;
    }
  }

  const byExt = new Map<string, AssetHit[]>();
  for (const a of assets) {
    const arr = byExt.get(a.ext) ?? [];
    arr.push(a);
    byExt.set(a.ext, arr);
  }

  const uniqAssetsByExt = (ext: string) => {
    const arr = byExt.get(ext) ?? [];
    const set = new Set(arr.map((h) => normalizePath(h.asset)));
    return [...set].sort();
  };

  const summary = {
    root,
    totals: {
      assetHits: assets.length,
      dynamicMeshCalls: dynamicCalls.length,
    },
    extensions: {
      b3d: { hits: (byExt.get("b3d") ?? []).length, unique: uniqAssetsByExt("b3d").length },
      x: { hits: (byExt.get("x") ?? []).length, unique: uniqAssetsByExt("x").length },
      rmesh: { hits: (byExt.get("rmesh") ?? []).length, unique: uniqAssetsByExt("rmesh").length },
    },
  };

  if (jsonOut) {
    console.log(JSON.stringify({ summary, assets, dynamicCalls }, null, 2));
    return;
  }

  const printTop = (title: string, items: string[], limit = 40) => {
    console.log(`\n${title} (${items.length})`);
    for (const s of items.slice(0, limit)) console.log(`- ${s}`);
    if (items.length > limit) console.log(`- … ${items.length - limit} more`);
  };

  console.log(`# SCPCB Audit`);
  console.log(`root: ${root}`);
  console.log(
    `asset hits: ${summary.totals.assetHits} (b3d=${summary.extensions.b3d.hits}, x=${summary.extensions.x.hits}, rmesh=${summary.extensions.rmesh.hits})`,
  );
  console.log(
    `unique assets: b3d=${summary.extensions.b3d.unique}, x=${summary.extensions.x.unique}, rmesh=${summary.extensions.rmesh.unique}`,
  );
  console.log(`dynamic LoadMesh* callsites: ${summary.totals.dynamicMeshCalls}`);

  printTop("Unique .x assets", uniqAssetsByExt("x"));
  printTop("Unique .b3d assets", uniqAssetsByExt("b3d"));
  printTop("Unique .rmesh assets", uniqAssetsByExt("rmesh"));

  if (dynamicCalls.length) {
    console.log(`\nDynamic LoadMesh* callsites (first 30)`);
    for (const h of dynamicCalls.slice(0, 30)) {
      console.log(`- ${h.file}:${h.line} ${h.fn}(${h.arg})`);
    }
    if (dynamicCalls.length > 30) console.log(`- … ${dynamicCalls.length - 30} more`);
  }
};

if (import.meta.main) {
  await main();
}
