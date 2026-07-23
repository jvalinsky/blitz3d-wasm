#!/usr/bin/env node
// Compare required imports (from imports-scan) against runtime-provided env imports.
// Usage:
//   node compare-imports.js --requirements ../import_requirements_summary.json [--runtimeDir ../Sources/Runtime/modules]
// Output:
//   - Missing: required names not found in runtime env
//   - Unused (optional): provided names not required (informational)

import fsPromises from "fs/promises";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { globSync } from "glob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    requirements: "../../import_requirements_summary.json",
    runtimeDir: "../../Sources/Runtime/modules",
    showUnused: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--requirements") opts.requirements = args[++i];
    else if (a === "--runtimeDir") opts.runtimeDir = args[++i];
    else if (a === "--showUnused") opts.showUnused = true;
  }
  return opts;
}

async function loadJSON(p) {
  const resolved = path.isAbsolute(p) ? p : path.join(__dirname, p);
  const data = await fsPromises.readFile(resolved, "utf8");
  return JSON.parse(data);
}

function collectRuntimeImports(runtimeDir) {
  const dir = path.isAbsolute(runtimeDir)
    ? runtimeDir
    : path.join(__dirname, runtimeDir);
  const files = globSync(path.join(dir, "**/*.js"));
  const names = new Set();
  const regex = /imports\.env\.([A-Za-z0-9_]+)/g;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = regex.exec(text)) !== null) {
      names.add(m[1].toLowerCase());
    }
  }
  return names;
}

async function main() {
  const opts = parseArgs();
  const reqData = await loadJSON(opts.requirements);
  const runtimeNames = collectRuntimeImports(opts.runtimeDir);

  const required = reqData.map((e) => ({
    name: e.name,
    key: e.name.toLowerCase(),
    calls: e.calls,
    fileCount: e.fileCount,
  }));

  const missing = required.filter((r) => !runtimeNames.has(r.key));
  const providedUnused = opts.showUnused
    ? Array.from(runtimeNames).filter((p) => !required.some((r) => r.key === p))
    : [];

  console.log(`Runtime imports found: ${runtimeNames.size}`);
  console.log(`Required imports (unique): ${required.length}`);
  console.log(`Missing in runtime: ${missing.length}`);
  console.log("\nTop missing (by call count):");
  missing
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 50)
    .forEach((m) =>
      console.log(`- ${m.name} (calls=${m.calls}, files=${m.fileCount})`)
    );

  if (opts.showUnused) {
    console.log("\nUnused provided (runtime but not required):");
    providedUnused.slice(0, 50).forEach((p) => console.log(`- ${p}`));
    if (providedUnused.length > 50) {
      console.log(`...and ${providedUnused.length - 50} more`);
    }
  }
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
