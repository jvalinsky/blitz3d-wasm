#!/usr/bin/env -S deno run -A
import { walkFiles } from "./fs.ts";

export type ValidateOpts = {
  rootDir: string;
  manifestPath?: string;
  bannedExts?: string[]; // lowercase, without dot
};

const lowerExt = (p: string) => {
  const m = p.match(/\.([^.]+)$/);
  return m ? m[1]!.toLowerCase() : "";
};

export const validateNoSourceModels = async (opts: ValidateOpts) => {
  const banned = new Set(
    (opts.bannedExts ?? ["b3d", "x"]).map((s) => s.toLowerCase()),
  );

  for await (const entry of walkFiles(opts.rootDir)) {
    const ext = lowerExt(entry.path);
    if (banned.has(ext)) {
      throw new Error(`banned source asset in output: ${entry.path}`);
    }
  }

  if (opts.manifestPath) {
    const txt = await Deno.readTextFile(opts.manifestPath);
    const j = JSON.parse(txt);
    const check = (v: unknown) => {
      if (typeof v === "string") {
        const ext = lowerExt(v);
        if (banned.has(ext)) {
          throw new Error(`banned source asset in manifest: ${v}`);
        }
      } else if (Array.isArray(v)) {
        for (const x of v) check(x);
      } else if (v && typeof v === "object") {
        for (const k of Object.keys(v as Record<string, unknown>)) {
          check((v as any)[k]);
        }
      }
    };
    check(j);
  }
};

if (import.meta.main) {
  const banIdx = Deno.args.findIndex((a) => a === "--ban");
  const bannedExts = banIdx >= 0
    ? (Deno.args[banIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(
      Boolean,
    )
    : undefined;
  const positional = Deno.args.filter((a, i) =>
    i !== banIdx && i !== banIdx + 1
  );
  const rootDir = positional[0];
  if (!rootDir) {
    throw new Error(
      "usage: Tools/validate_no_source_models.ts [--ban b3d,x,rmesh] <rootDir> [manifest.json]",
    );
  }
  const manifestPath = positional[1];
  await validateNoSourceModels({ rootDir, manifestPath, bannedExts });
  console.log("[ok] no banned source model assets found");
}
