import { validateNoSourceModels } from "../validate_no_source_models.ts";
import { assert } from "./assert.ts";

const tmpDir = async (name: string) => {
  const dir = await Deno.makeTempDir({
    dir: "/tmp",
    prefix: `blitz3d-wasm-${name}-`,
  });
  return dir.replace(/\/+$/g, "");
};

Deno.test("validateNoSourceModels passes clean output", async () => {
  const root = await tmpDir("clean");
  await Deno.writeTextFile(`${root}/a.smpk`, "ok");
  await Deno.writeTextFile(
    `${root}/scpcb_manifest.json`,
    JSON.stringify({ files: [{ path: "a.smpk" }] }),
  );
  await validateNoSourceModels({
    rootDir: root,
    manifestPath: `${root}/scpcb_manifest.json`,
  });
});

Deno.test("validateNoSourceModels fails on leaked .b3d/.x files", async () => {
  const root = await tmpDir("leak-files");
  await Deno.writeTextFile(`${root}/bad.b3d`, "nope");
  let threw = false;
  try {
    await validateNoSourceModels({ rootDir: root });
  } catch {
    threw = true;
  }
  assert(threw, "expected validator to throw on leaked file");
});

Deno.test("validateNoSourceModels fails on leaked .b3d/.x in manifest", async () => {
  const root = await tmpDir("leak-manifest");
  await Deno.writeTextFile(
    `${root}/scpcb_manifest.json`,
    JSON.stringify({ files: [{ path: "GFX/npcs/duck.b3d" }] }),
  );
  let threw = false;
  try {
    await validateNoSourceModels({
      rootDir: root,
      manifestPath: `${root}/scpcb_manifest.json`,
    });
  } catch {
    threw = true;
  }
  assert(threw, "expected validator to throw on leaked manifest path");
});
