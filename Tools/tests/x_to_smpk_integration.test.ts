import { decodeSmpk } from "../smpk/codec.ts";
import { assert } from "./assert.ts";

const run = async (cmd: string[]) => {
  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const { code, stdout, stderr } = await p.output();
  if (code !== 0) {
    throw new Error(
      `command failed (${code})\nstdout:\n${
        new TextDecoder().decode(stdout)
      }\nstderr:\n${new TextDecoder().decode(stderr)}`,
    );
  }
};

Deno.test("convert_x_to_smpk produces a readable SMPK", async () => {
  const out = await Deno.makeTempFile({ dir: "/tmp", suffix: ".smpk" });
  await run([
    "deno",
    "run",
    "-A",
    "Tools/convert_x_to_smpk.ts",
    "web/public/GFX/map/ButtonScanner.x",
    "-o",
    out,
  ]);

  const bytes = new Uint8Array(await Deno.readFile(out));
  const smpk = decodeSmpk(bytes);
  assert(smpk.json.meshes.length >= 1);
  assert(smpk.bin.length > 0);
});
