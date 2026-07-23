#!/usr/bin/env -S deno run -A
import { walkFiles } from "./fs.ts";

type Manifest = {
  basePath?: string;
  files?: Array<{ path: string; size?: number }>;
  groups?: Record<string, string[]>;
};

const usage = () => {
  throw new Error(
    "usage: Tools/validate_manifest_files.ts <rootDir> <manifest.json> [--allow-missing file1,file2] [--warn-unreferenced]",
  );
};

const exists = async (p: string) => {
  try {
    const st = await Deno.stat(p);
    return st.isFile;
  } catch {
    return false;
  }
};

if (import.meta.main) {
  const warnUnref = Deno.args.includes("--warn-unreferenced");
  const allowIdx = Deno.args.findIndex((a) => a === "--allow-missing");
  const allowMissing = allowIdx >= 0
    ? (Deno.args[allowIdx + 1] ?? "").split(",").map((s) => s.trim()).filter(
      Boolean,
    )
    : [];
  const args0 = allowIdx >= 0
    ? Deno.args.filter((_, i) => i !== allowIdx && i !== allowIdx + 1)
    : [...Deno.args];
  const args = args0.filter((a) => a !== "--warn-unreferenced");
  const rootDir = args[0];
  const manifestPath = args[1];
  if (!rootDir || !manifestPath) usage();

  const allow = new Set(allowMissing);
  const txt = await Deno.readTextFile(manifestPath);
  const manifest = JSON.parse(txt) as Manifest;
  if (!manifest || typeof manifest !== "object") {
    throw new Error("invalid manifest JSON");
  }

  const files = manifest.files ?? [];
  const filesSet = new Set(files.map((f) => f.path));

  // Validate groups reference known files.
  const missingInFilesList: string[] = [];
  for (const [g, arr] of Object.entries(manifest.groups ?? {})) {
    if (!Array.isArray(arr)) continue;
    for (const p of arr) {
      if (typeof p !== "string") continue;
      if (!filesSet.has(p)) missingInFilesList.push(`${g}:${p}`);
    }
  }
  if (missingInFilesList.length) {
    throw new Error(
      `manifest groups reference missing files[] entries:\n${
        missingInFilesList.slice(0, 50).join("\n")
      }`,
    );
  }

  // Validate each file exists on disk relative to rootDir.
  const missingOnDisk: string[] = [];
  for (const f of files) {
    const p = f?.path;
    if (!p || typeof p !== "string") continue;
    if (allow.has(p)) continue;
    const diskPath = `${rootDir.replace(/\/+$/g, "")}/${p.replace(/^\/+/, "")}`;
    if (!(await exists(diskPath))) missingOnDisk.push(p);
  }
  if (missingOnDisk.length) {
    throw new Error(
      `manifest files missing on disk:\n${
        missingOnDisk.slice(0, 50).join("\n")
      }`,
    );
  }

  if (warnUnref) {
    // Optional: detect stray files in rootDir not referenced (informational).
    const referencedDisk = new Set(
      files.map((f) =>
        `${rootDir.replace(/\/+$/g, "")}/${(f.path ?? "").replace(/^\/+/, "")}`
      ),
    );
    let unreferenced = 0;
    for await (const entry of walkFiles(rootDir)) {
      const p = entry.path;
      if (p.endsWith("/.DS_Store")) continue;
      if (!referencedDisk.has(p)) unreferenced++;
    }
    if (unreferenced) {
      console.log(
        `[manifest] warning: ${unreferenced} files in rootDir are not referenced by manifest`,
      );
    }
  }

  console.log("[ok] manifest file references exist on disk");
}
