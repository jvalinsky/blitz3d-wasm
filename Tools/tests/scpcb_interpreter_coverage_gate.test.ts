import { assert, assertEquals } from "./assert.ts";
import { fromFileUrl } from "std/path/mod.ts";

const run = async (cmd: string[], cwd: string) => {
  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    cwd,
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const out = await p.output();
  return {
    code: out.code,
    stdout: new TextDecoder().decode(out.stdout),
    stderr: new TextDecoder().decode(out.stderr),
  };
};

Deno.test("scpcb_interpreter_coverage_gate: check task passes", async () => {
  const repoRoot = fromFileUrl(new URL("../../", import.meta.url));
  const r = await run(
    ["deno", "task", "interpreter:scpcb-coverage:check"],
    repoRoot,
  );
  assert(
    r.code === 0,
    `expected code=0; got ${r.code}\n${r.stdout}\n${r.stderr}`,
  );
});

Deno.test("No SCPCB top functions missing from allowlist", async () => {
  const repoRoot = fromFileUrl(new URL("../../", import.meta.url));
  const summaryPath = `${repoRoot}/import_requirements_summary.json`;
  const workerPath = `${repoRoot}/web/compiler_worker.ts`;

  const summaryText = await Deno.readTextFile(summaryPath);
  const summary = JSON.parse(summaryText) as { name: string; calls: number; fileCount: number }[];
  const requiredNames = summary.map((e) => e.name.toLowerCase());

  const workerSrc = await Deno.readTextFile(workerPath);
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
  assertEquals(missing.length, 0, `Missing from allowlist: ${missing.join(", ")}`);
});

