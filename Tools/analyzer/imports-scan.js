#!/usr/bin/env node
// Scan BB source files to extract external function calls and emit a required-imports report.
// Usage:
//   node imports-scan.js --glob "../../scpcb/**/*.bb" --out report.json [--summary]
// Notes:
// - This is a heuristic scanner: it looks for Identifier( ... ) call patterns and collects names.
// - It lowercases names for normalization and counts call sites.
// - Does not resolve overloads; assumes env module unless mapped.
// - Intended as an input to manual signature vetting and runtime coverage checks.

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { globSync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { pattern: "../../scpcb/**/*.bb", out: null, summary: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--glob") opts.pattern = args[++i];
    else if (a === "--out") opts.out = args[++i];
    else if (a === "--summary") opts.summary = true;
  }
  return opts;
}

function extractCalls(text) {
  // Very simple lexer: find identifiers followed by '(' with optional whitespace.
  // Exclude common keywords and control flow.
  const calls = [];
  const regex = /([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
  const exclusions = new Set([
    "if",
    "while",
    "for",
    "foreach",
    "repeat",
    "until",
    "select",
    "case",
    "function",
    "local",
    "global",
    "type",
    "int",
    "float",
    "str",
    "then",
    "else",
    "elseif",
    "wend",
    "next",
    "end",
    "return",
    "abs",
    "sgn",
    "mod",
    "pi",
  ]);
  let m;
  while ((m = regex.exec(text)) !== null) {
    const name = m[1];
    if (!exclusions.has(name.toLowerCase())) {
      calls.push({ name, index: m.index });
    }
  }
  return calls;
}

async function scanFiles(pattern) {
  const files = globSync(pattern, { cwd: __dirname, absolute: true });
  const result = {};
  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const calls = extractCalls(text);
    const rel = path.relative(path.join(__dirname, "..", ".."), file);
    for (const c of calls) {
      const key = c.name.toLowerCase();
      if (!result[key]) {
        result[key] = { name: c.name, calls: 0, files: new Set() };
      }
      result[key].calls += 1;
      result[key].files.add(rel);
    }
  }
  // Serialize sets
  const normalized = Object.fromEntries(
    Object.entries(result).map((
      [k, v],
    ) => [k, { name: v.name, calls: v.calls, files: Array.from(v.files) }]),
  );
  return normalized;
}

function toSummary(data) {
  return Object.entries(data)
    .sort((a, b) => b[1].calls - a[1].calls)
    .map(([k, v]) => ({
      name: v.name,
      calls: v.calls,
      fileCount: v.files.length,
    }));
}

async function main() {
  const opts = parseArgs();
  const data = await scanFiles(opts.pattern);
  if (opts.summary) {
    console.log(JSON.stringify(toSummary(data), null, 2));
    return;
  }
  if (opts.out) {
    const outPath = path.isAbsolute(opts.out)
      ? opts.out
      : path.join(__dirname, opts.out);
    await fs.writeFile(outPath, JSON.stringify(data, null, 2));
    console.log(`Wrote ${Object.keys(data).length} imports to ${outPath}`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
