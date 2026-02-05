/// <reference lib="deno.ns" />

import { assert, assertEquals } from "./assert.ts";

Deno.test("All SCPCB top-50 functions are in allowlist", async () => {
  const summaryText = await Deno.readTextFile("import_requirements_summary.json");
  const summary = JSON.parse(summaryText) as { name: string; calls: number; fileCount: number }[];
  const requiredNames = summary.map((e) => e.name.toLowerCase());

  const workerSrc = await Deno.readTextFile("web/compiler_worker.ts");
  const m = workerSrc.match(/const autoImports = \[(.*?)\];/s);
  assert(m, "Could not find autoImports array in compiler_worker.ts");
  const autoImports = Array.from(m![1].matchAll(/"([^"]+)"/g)).map((x) => x[1]!);
  const allowSet = new Set(autoImports.map((s) => s.toLowerCase()));

  const missing: string[] = [];
  for (const name of requiredNames) {
    if (!allowSet.has(name)) {
      missing.push(name);
    }
  }
  assertEquals(
    missing.length,
    0,
    `Missing from allowlist: ${missing.join(", ")}`,
  );
});

Deno.test("No duplicate entries in allowlist", async () => {
  const workerSrc = await Deno.readTextFile("web/compiler_worker.ts");
  const m = workerSrc.match(/const autoImports = \[(.*?)\];/s);
  assert(m, "Could not find autoImports array in compiler_worker.ts");
  const autoImports = Array.from(m![1].matchAll(/"([^"]+)"/g)).map((x) => x[1]!);

  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const name of autoImports) {
    const lower = name.toLowerCase();
    if (seen.has(lower)) {
      dupes.push(name);
    }
    seen.add(lower);
  }
  assertEquals(dupes.length, 0, `Duplicate entries: ${dupes.join(", ")}`);
});
