import { parseB3D } from "../b3d/parse.ts";
import { assert } from "./assert.ts";

const read = async (path: string) => new Uint8Array(await Deno.readFile(path));

Deno.test("parseB3D parses a real SCPCB B3D (static)", async () => {
  const bytes = await read("web/public/GFX/npcs/duck_low_res.b3d");
  const b3d = parseB3D(bytes);
  assert(b3d.root);

  // Find first mesh
  const stack = [b3d.root!];
  let meshCount = 0;
  while (stack.length) {
    const n = stack.pop()!;
    if (n.mesh) {
      meshCount++;
      assert(n.mesh.positions.length > 0);
      assert(n.mesh.indices.length > 0);
    }
    for (const c of n.children) stack.push(c);
  }
  assert(meshCount >= 1);
});
