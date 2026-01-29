import { assert } from "./assert.ts";

const run = async (cmd: string[]) => {
  const p = new Deno.Command(cmd[0]!, { args: cmd.slice(1), stdout: "piped", stderr: "piped" }).spawn();
  const { code, stdout, stderr } = await p.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
};

Deno.test("dist_report prints total and top list", async () => {
  const root = await Deno.makeTempDir({ dir: "/tmp", prefix: "blitz3d-wasm-dist-report-" });
  await Deno.mkdir(`${root}/a`, { recursive: true });
  await Deno.writeFile(`${root}/a.bin`, new Uint8Array(100));
  await Deno.writeFile(`${root}/a/b.bin`, new Uint8Array(200));
  const r = await run(["deno", "run", "-A", "Tools/dist_report.ts", root, "--top", "1"]);
  assert(r.code === 0, `expected ok, got ${r.code}\n${r.stdout}\n${r.stderr}`);
  assert(r.stdout.includes("[dist] total="));
  assert(r.stdout.includes("[dist] top=1"));
});

