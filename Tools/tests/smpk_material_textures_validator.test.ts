import { encodeSmpk } from "../smpk/codec.ts";

const run = async (cmd: string[], cwd?: string) => {
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

Deno.test("validate_smpk_material_textures passes when textures exist", async () => {
  const root = await Deno.makeTempDir({
    dir: "/tmp",
    prefix: "smpk-textures-ok-",
  });
  const dist = `${root}/dist`;
  await Deno.mkdir(`${dist}/assets`, { recursive: true });

  // Put a texture somewhere under dist; basename-only references should find it.
  await Deno.mkdir(`${dist}/GFX`, { recursive: true });
  await Deno.writeFile(`${dist}/GFX/metal.jpg`, new Uint8Array([1, 2, 3]));

  const smpk = encodeSmpk({
    json: {
      version: 1,
      accessors: [],
      meshes: [],
      nodes: [],
      materials: [{
        name: "m0",
        baseColorTexture: "metal.jpg",
        lightmapTexture: "",
      }],
    },
    bin: new Uint8Array(),
  });
  await Deno.writeFile(`${dist}/assets/test.smpk`, smpk);

  const r = await run([
    "deno",
    "run",
    "-A",
    "Tools/validate_smpk_material_textures.ts",
    dist,
  ]);
  if (r.code !== 0) {
    throw new Error(`expected pass, got ${r.code}\n${r.stdout}\n${r.stderr}`);
  }
});

Deno.test("validate_smpk_material_textures fails when textures are missing", async () => {
  const root = await Deno.makeTempDir({
    dir: "/tmp",
    prefix: "smpk-textures-fail-",
  });
  const dist = `${root}/dist`;
  await Deno.mkdir(`${dist}/assets`, { recursive: true });

  const smpk = encodeSmpk({
    json: {
      version: 1,
      accessors: [],
      meshes: [],
      nodes: [],
      materials: [{
        name: "m0",
        baseColorTexture: "missing.png",
        lightmapTexture: "",
      }],
    },
    bin: new Uint8Array(),
  });
  await Deno.writeFile(`${dist}/assets/test.smpk`, smpk);

  const r = await run([
    "deno",
    "run",
    "-A",
    "Tools/validate_smpk_material_textures.ts",
    dist,
  ]);
  if (r.code === 0) {
    throw new Error(`expected failure, got 0\n${r.stdout}\n${r.stderr}`);
  }
});
