import { assert } from "./assert.ts";

const run = async (cmd: string[]) => {
  const p = new Deno.Command(cmd[0]!, { args: cmd.slice(1), stdout: "piped", stderr: "piped" }).spawn();
  const out = await p.output();
  return {
    code: out.code,
    stdout: new TextDecoder().decode(out.stdout),
    stderr: new TextDecoder().decode(out.stderr),
  };
};

const writeLatin1 = async (path: string, text: string) => {
  await Deno.writeFile(path, new TextEncoder().encode(text));
};

Deno.test("scpcb_audit_gate: passes when no new literals and no dynamic calls", async () => {
  const root = await Deno.makeTempDir({ dir: "/tmp", prefix: "scpcb-audit-gate-ok-" });
  const scpcb = `${root}/scpcb`;
  await Deno.mkdir(scpcb, { recursive: true });
  await writeLatin1(`${scpcb}/Main.bb`, 'Graphics3D 800,600,32,2\nx$="GFX\\\\map\\\\door01.x"\n');

  const baselinePath = `${root}/baseline.json`;
  const baseline = {
    summary: { root: scpcb, totals: { assetHits: 1, dynamicMeshCalls: 0 }, extensions: { b3d: { hits: 0, unique: 0 }, x: { hits: 1, unique: 1 }, rmesh: { hits: 0, unique: 0 } } },
    assets: [{ file: "Main.bb", line: 2, text: "x$=...", asset: "GFX\\\\map\\\\door01.x", ext: "x" }],
    dynamicCalls: [],
  };
  await Deno.writeTextFile(baselinePath, JSON.stringify(baseline, null, 2));

  const r = await run(["deno", "run", "-A", "Tools/scpcb_audit_gate.ts", "--root", scpcb, "--baseline", baselinePath, "--require-root"]);
  assert(r.code === 0);
});

Deno.test("scpcb_audit_gate: fails on new source-model literal", async () => {
  const root = await Deno.makeTempDir({ dir: "/tmp", prefix: "scpcb-audit-gate-new-" });
  const scpcb = `${root}/scpcb`;
  await Deno.mkdir(scpcb, { recursive: true });
  await writeLatin1(
    `${scpcb}/Main.bb`,
    'x$="GFX\\\\map\\\\door01.x"\ny$="GFX\\\\map\\\\newthing.rmesh"\n',
  );

  const baselinePath = `${root}/baseline.json`;
  const baseline = {
    summary: { root: scpcb, totals: { assetHits: 1, dynamicMeshCalls: 0 }, extensions: { b3d: { hits: 0, unique: 0 }, x: { hits: 1, unique: 1 }, rmesh: { hits: 0, unique: 0 } } },
    assets: [{ file: "Main.bb", line: 1, text: "x$=...", asset: "GFX\\\\map\\\\door01.x", ext: "x" }],
    dynamicCalls: [],
  };
  await Deno.writeTextFile(baselinePath, JSON.stringify(baseline, null, 2));

  const r = await run(["deno", "run", "-A", "Tools/scpcb_audit_gate.ts", "--root", scpcb, "--baseline", baselinePath, "--require-root"]);
  assert(r.code === 1, `expected code=1; got ${r.code}\n${r.stdout}\n${r.stderr}`);
});

Deno.test("scpcb_audit_gate: fails on dynamic LoadMesh call unless allow-dynamic", async () => {
  const root = await Deno.makeTempDir({ dir: "/tmp", prefix: "scpcb-audit-gate-dyn-" });
  const scpcb = `${root}/scpcb`;
  await Deno.mkdir(scpcb, { recursive: true });
  await writeLatin1(`${scpcb}/Main.bb`, "p$=SomeVar$\nLoadMesh(p$)\n");

  const baselinePath = `${root}/baseline.json`;
  const baseline = {
    summary: { root: scpcb, totals: { assetHits: 0, dynamicMeshCalls: 0 }, extensions: { b3d: { hits: 0, unique: 0 }, x: { hits: 0, unique: 0 }, rmesh: { hits: 0, unique: 0 } } },
    assets: [],
    dynamicCalls: [],
  };
  await Deno.writeTextFile(baselinePath, JSON.stringify(baseline, null, 2));

  const r1 = await run(["deno", "run", "-A", "Tools/scpcb_audit_gate.ts", "--root", scpcb, "--baseline", baselinePath, "--require-root"]);
  assert(r1.code === 1);

  const r2 = await run([
    "deno",
    "run",
    "-A",
    "Tools/scpcb_audit_gate.ts",
    "--root",
    scpcb,
    "--baseline",
    baselinePath,
    "--require-root",
    "--allow-dynamic",
  ]);
  assert(r2.code === 0);
});

