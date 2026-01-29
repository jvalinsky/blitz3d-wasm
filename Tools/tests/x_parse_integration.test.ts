import { parseTextX } from "../x/parse_text_x.ts";
import { assert } from "./assert.ts";

Deno.test("parseTextX parses SCPCB .x text mesh", async () => {
  const text = await Deno.readTextFile("web/public/GFX/map/ButtonScanner.x");
  const x = parseTextX(text);
  assert(x.root);
  const mesh = findFirstMeshInFrame(x.root) ?? x.meshes[0];
  assert(mesh);
  assert(mesh.positions.length > 0);
  assert(mesh.indices.length > 0);
});

const findFirstMeshInFrame = (f: any): any => {
  if (f.mesh) return f.mesh;
  for (const c of f.children ?? []) {
    const m = findFirstMeshInFrame(c);
    if (m) return m;
  }
  return null;
};
