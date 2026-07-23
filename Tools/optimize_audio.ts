#!/usr/bin/env -S deno run -A
/**
 * Audio Optimization Tool
 * - Scans for .wav files
 * - Converts them to .ogg using `ffmpeg`
 * - Options to delete source files.
 */

type Args = {
  root: string;
  deleteSource: boolean;
};

const parseArgs = (): Args => {
  const rootIdx = Deno.args.findIndex((a) => a === "--root");
  const root = rootIdx >= 0
    ? (Deno.args[rootIdx + 1] ?? "web/public")
    : "web/public";
  const deleteSource = Deno.args.includes("--delete-source");
  return { root, deleteSource };
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

const run = async (cmd: string[]) => {
  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    stdout: "null",
    stderr: "piped",
  }).spawn();
  const { code, stderr } = await p.status;
  if (code !== 0) {
    const errText = new TextDecoder().decode(stderr);
    throw new Error(`command failed (${code}): ${cmd.join(" ")}\n${errText}`);
  }
};

const hasFfmpeg = async () => {
  try {
    const p = new Deno.Command("ffmpeg", {
      args: ["-version"],
      stdout: "null",
      stderr: "null",
    }).spawn();
    return (await p.status).code === 0;
  } catch {
    return false;
  }
};

const main = async () => {
  const args = parseArgs();
  console.log(`[audio] Scanning ${args.root}...`);

  const wavFiles: string[] = [];
  for await (const p of walk(args.root)) {
    if (p.toLowerCase().endsWith(".wav")) {
      wavFiles.push(p);
    }
  }

  console.log(`[audio] Found ${wavFiles.length} .wav files`);

  if (wavFiles.length === 0) return;

  if (!(await hasFfmpeg())) {
    console.warn("[audio] 'ffmpeg' not found. Skipping conversion.");
    return;
  }

  let converted = 0;
  for (const p of wavFiles) {
    const oggPath = p.replace(/\.wav$/i, ".ogg");

    try {
      // Skip if ogg exists and is new enough
      try {
        const wavSt = await Deno.stat(p);
        const oggSt = await Deno.stat(oggPath);
        if (oggSt.mtime && wavSt.mtime && oggSt.mtime > wavSt.mtime) {
          if (args.deleteSource) await Deno.remove(p);
          continue;
        }
      } catch {}

      // -vn: disable video
      // -map_metadata -1: strip metadata
      await run([
        "ffmpeg",
        "-y",
        "-i",
        p,
        "-vn",
        "-map_metadata",
        "-1",
        oggPath,
      ]);
      converted++;
      if (args.deleteSource) await Deno.remove(p);
    } catch (e) {
      console.error(`[audio] Failed to convert ${p}: ${e}`);
    }
  }

  console.log(`[audio] Converted ${converted} WAVs to OGG`);
};

if (import.meta.main) await main();
