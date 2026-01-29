#!/usr/bin/env -S deno run -A
/**
 * Offline SCPCB asset conversion for web deploy:
 * - Convert all `.b3d`, `.x`, and `.rmesh` under `web/public` into `.smpk` alongside the source.
 * - Optionally delete source files after successful conversion.
 *
 * Usage:
 *   deno run -A Tools/assets_scpcb_convert.ts
 *   deno run -A Tools/assets_scpcb_convert.ts --root web/public --delete-source
 */

import { validateNoSourceModels } from "./validate_no_source_models.ts";

type Args = {
  root: string;
  deleteSource: boolean;
  rewriteManifest: boolean;
  validateManifest: boolean;
};

const parseArgs = (): Args => {
  const rootIdx = Deno.args.findIndex((a) => a === "--root");
  const root = rootIdx >= 0 ? (Deno.args[rootIdx + 1] ?? "web/public") : "web/public";
  const deleteSource = Deno.args.includes("--delete-source");
  const rewriteManifest = !Deno.args.includes("--no-rewrite-manifest");
  const validateManifest = !Deno.args.includes("--no-validate-manifest");
  return { root, deleteSource, rewriteManifest, validateManifest };
};

const walk = async function* (dir: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walk(p);
      continue;
    }
    if (!entry.isFile) continue;
    yield p;
  }
};

const lowerExt = (p: string) => {
  const m = p.match(/\.([^.]+)$/);
  return m ? m[1]!.toLowerCase() : "";
};

const run = async (cmd: string[], cwd?: string) => {
  const p = new Deno.Command(cmd[0]!, { args: cmd.slice(1), cwd, stdout: "inherit", stderr: "inherit" }).spawn();
  const { code } = await p.status;
  if (code !== 0) throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
};

const main = async () => {
  const args = parseArgs();
  const b3dFiles: string[] = [];
  const xFiles: string[] = [];
  const rmeshFiles: string[] = [];

  for await (const p of walk(args.root)) {
    const ext = lowerExt(p);
    if (ext === "b3d") b3dFiles.push(p);
    else if (ext === "x") xFiles.push(p);
    else if (ext === "rmesh") rmeshFiles.push(p);
  }

  console.log(`[assets] root=${args.root}`);
  console.log(`[assets] found b3d=${b3dFiles.length} x=${xFiles.length} rmesh=${rmeshFiles.length}`);

  let converted = 0;

  for (const p of b3dFiles) {
    const out = p.replace(/\.b3d$/i, ".smpk");
    await run(["deno", "run", "-A", "Tools/convert_b3d_to_smpk.ts", p, "-o", out]);
    converted++;
    if (args.deleteSource) await Deno.remove(p);
  }

  for (const p of xFiles) {
    const out = p.replace(/\.x$/i, ".smpk");
    await run(["deno", "run", "-A", "Tools/convert_x_to_smpk.ts", p, "-o", out]);
    converted++;
    if (args.deleteSource) await Deno.remove(p);
  }

  for (const p of rmeshFiles) {
    const out = p.replace(/\.rmesh$/i, ".smpk");
    const st = await Deno.stat(p);
    if (st.size === 0) {
      console.warn(`[assets] skipping empty rmesh: ${p}`);
      continue;
    }
    await run(["deno", "run", "-A", "Tools/convert_rmesh_to_smpk.ts", p, "-o", out]);
    converted++;
    if (args.deleteSource) await Deno.remove(p);
  }

  if (args.rewriteManifest) {
    const manifestPath = `${args.root.replace(/\/+$/g, "")}/scpcb_manifest.json`;
    try {
      const txt = await Deno.readTextFile(manifestPath);
      const j = JSON.parse(txt);
      const rewritePath = (s: string) => s.replace(/\.b3d$/i, ".smpk").replace(/\.x$/i, ".smpk").replace(/\.rmesh$/i, ".smpk");
      if (j && typeof j === "object") {
        if (j.files && Array.isArray(j.files)) {
          for (const f of j.files) {
            if (f && typeof f.path === "string") f.path = rewritePath(f.path);
          }
        }
        if (j.groups && typeof j.groups === "object") {
          for (const k of Object.keys(j.groups)) {
            const arr = j.groups[k];
            if (!Array.isArray(arr)) continue;
            j.groups[k] = arr.map((p: any) => (typeof p === "string" ? rewritePath(p) : p));
          }
        }
        await Deno.writeTextFile(manifestPath, JSON.stringify(j, null, 2));
        console.log(`[assets] rewrote manifest paths: ${manifestPath}`);

        if (args.validateManifest) {
          const check = (v: unknown) => {
            if (typeof v === "string") {
              if (/\.(b3d|x|rmesh)$/i.test(v)) throw new Error(`manifest still references source asset: ${v}`);
            } else if (Array.isArray(v)) {
              for (const x of v) check(x);
            } else if (v && typeof v === "object") {
              for (const k of Object.keys(v as Record<string, unknown>)) check((v as any)[k]);
            }
          };
          check(j);
          console.log("[assets] manifest validation ok (no .b3d/.x/.rmesh references)");
        }
      }
    } catch {
      // ignore if missing
    }
  }

  if (args.deleteSource) {
    const manifestPath = `${args.root.replace(/\/+$/g, "")}/scpcb_manifest.json`;
    let mp: string | undefined;
    try {
      const st = await Deno.stat(manifestPath);
      if (st.isFile) mp = manifestPath;
    } catch {
      // ignore
    }
    await validateNoSourceModels({ rootDir: args.root, manifestPath: mp, bannedExts: ["b3d", "x", "rmesh"] });
    console.log("[assets] filesystem validation ok (no .b3d/.x/.rmesh files)");
  }

  console.log(`[assets] converted ${converted} files`);
  if (args.deleteSource) {
    console.log(`[assets] deleted original .b3d/.x/.rmesh sources`);
  } else {
    console.log(`[assets] kept original .b3d/.x/.rmesh sources (use --delete-source for deploy)`);
  }
};

if (import.meta.main) {
  await main();
}
