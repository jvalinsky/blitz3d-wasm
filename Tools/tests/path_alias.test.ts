import { assertEquals } from "./assert.ts";
import { openFileCandidates } from "../../web/src/shared/path_alias.ts";

Deno.test("openFileCandidates includes assets/ prefix + .smpk rewrite", () => {
  const c = openFileCandidates("GFX/npcs/scp-1048.b3d");
  assertEquals(c[0], "GFX/npcs/scp-1048.b3d");
  // Extension rewrite
  if (!c.includes("GFX/npcs/scp-1048.smpk")) {
    throw new Error("missing .smpk candidate");
  }
  // assets/ prefix
  if (!c.includes("assets/GFX/npcs/scp-1048.b3d")) {
    throw new Error("missing assets/ candidate");
  }
  if (!c.includes("assets/GFX/npcs/scp-1048.smpk")) {
    throw new Error("missing assets/ .smpk candidate");
  }
});
