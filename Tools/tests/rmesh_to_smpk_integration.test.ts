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

Deno.test("convert_rmesh_to_smpk produces a readable SMPK", async () => {
  const out = "/tmp/173_opt.smpk";
  await run([
    "deno",
    "run",
    "-A",
    "Tools/convert_rmesh_to_smpk.ts",
    "web/public/GFX/map/173_opt.rmesh",
    "-o",
    out,
  ]);
  const bytes = await Deno.readFile(out);
  const smpk = decodeSmpk(bytes);
  assert(smpk.json.meshes.length === 1);
  assert(smpk.json.meshes[0]!.primitives.length > 0);
  const prim = smpk.json.meshes[0]!.primitives[0]!;
  assert(typeof prim.attributes["POSITION"] === "number");
  assert(typeof prim.attributes["TEXCOORD_1"] === "number");

  // RMESH metadata export (point entities + trigger boxes).
  const rmesh = (smpk.json as any).extras?.rmesh;
  assert(Array.isArray(rmesh?.entities) && rmesh.entities.length > 0);
  assert(Array.isArray(rmesh?.triggers) && rmesh.triggers.length === 3);
  assert(typeof rmesh.triggers[0]?.name === "string");
  assert(Array.isArray(rmesh.triggers[0]?.aabb?.min));
  assert(Array.isArray(rmesh.triggers[0]?.aabb?.max));
});
