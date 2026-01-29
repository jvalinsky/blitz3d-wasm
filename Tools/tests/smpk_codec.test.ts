import { decodeSmpk, encodeSmpk } from "../smpk/codec.ts";
import type { SmpkFile } from "../smpk/types.ts";
import { assert, assertEquals } from "./assert.ts";

Deno.test("SMPK encode/decode roundtrip", () => {
  const bin = new Uint8Array([1, 2, 3, 4, 5]);
  const file: SmpkFile = {
    json: {
      version: 1,
      generator: "test",
      accessors: [{ offset: 0, count: 5, componentType: "u8", type: "SCALAR" }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
      nodes: [{ name: "root", mesh: 0 }],
      sceneRoots: [0],
    },
    bin,
  };

  const bytes = encodeSmpk(file);
  const decoded = decodeSmpk(bytes);
  assertEquals(decoded.json.version, 1);
  assertEquals(decoded.json.meshes.length, 1);
  assertEquals(decoded.bin.length, 5);
  assertEquals([...decoded.bin], [1, 2, 3, 4, 5]);
  assert(decoded.json.accessors[0]);
});
