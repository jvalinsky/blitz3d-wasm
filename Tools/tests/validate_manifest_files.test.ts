import { assert } from "./assert.ts";

const run = async (cmd: string[]) => {
  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const { code, stdout, stderr } = await p.output();
  return {
    code,
    stdout: new TextDecoder().decode(stdout),
    stderr: new TextDecoder().decode(stderr),
  };
};

const tmpDir = async (name: string) => {
  const dir = await Deno.makeTempDir({
    dir: "/tmp",
    prefix: `blitz3d-wasm-${name}-`,
  });
  return dir.replace(/\/+$/g, "");
};

Deno.test("validate_manifest_files passes when all files exist", async () => {
  const root = await tmpDir("manifest-ok");
  await Deno.mkdir(`${root}/assets`, { recursive: true });
  await Deno.writeTextFile(`${root}/scpcb.wasm`, "x");
  await Deno.writeTextFile(`${root}/assets/a.bin`, "y");
  const manifest = {
    basePath: "/",
    groups: { boot: ["scpcb.wasm"] },
    files: [{ path: "scpcb.wasm" }, { path: "assets/a.bin" }],
  };
  await Deno.writeTextFile(
    `${root}/scpcb_manifest.json`,
    JSON.stringify(manifest),
  );
  const r = await run([
    "deno",
    "run",
    "-A",
    "Tools/validate_manifest_files.ts",
    root,
    `${root}/scpcb_manifest.json`,
  ]);
  assert(r.code === 0, `expected ok, got ${r.code}\n${r.stdout}\n${r.stderr}`);
});

Deno.test("validate_manifest_files fails when a file is missing", async () => {
  const root = await tmpDir("manifest-missing");
  await Deno.writeTextFile(`${root}/scpcb.wasm`, "x");
  const manifest = {
    basePath: "/",
    groups: { boot: ["scpcb.wasm", "assets/missing.bin"] },
    files: [{ path: "scpcb.wasm" }, { path: "assets/missing.bin" }],
  };
  await Deno.writeTextFile(
    `${root}/scpcb_manifest.json`,
    JSON.stringify(manifest),
  );
  const r = await run([
    "deno",
    "run",
    "-A",
    "Tools/validate_manifest_files.ts",
    root,
    `${root}/scpcb_manifest.json`,
  ]);
  assert(r.code !== 0, "expected failure");
});
