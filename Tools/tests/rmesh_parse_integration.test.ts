import { parseRMesh } from "../rmesh/parse.ts";
import { assert } from "./assert.ts";

Deno.test("parseRMesh parses a real SCPCB RMESH", async () => {
  const bytes = await Deno.readFile("web/public/GFX/map/173.rmesh");
  const rm = parseRMesh(bytes);
  assert(rm.header === "RoomMesh" || rm.header === "RoomMesh.HasTriggerBox");
  assert(rm.drawn.length > 0);
  const s0 = rm.drawn[0]!;
  assert(s0.positions.length > 0);
  assert(s0.uvs0.length === (s0.positions.length / 3) * 2);
  assert(s0.indices.length > 0);
});

