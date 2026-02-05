import { assert } from "./assert.ts";
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

