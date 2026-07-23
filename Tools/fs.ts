export type WalkFile = { path: string };

export const ensureDir = async (dir: string) => {
  await Deno.mkdir(dir, { recursive: true });
};

export const walkFiles = async function* (
  root: string,
): AsyncGenerator<WalkFile> {
  for await (const entry of Deno.readDir(root)) {
    const p = `${root}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkFiles(p);
      continue;
    }
    if (entry.isFile) yield { path: p };
  }
};

export const copyFile = async (
  src: string,
  dest: string,
  opts?: { overwrite?: boolean },
) => {
  if (opts?.overwrite) {
    try {
      await Deno.remove(dest);
    } catch {
      // ignore
    }
  }
  await Deno.copyFile(src, dest);
};

export const copyDir = async (
  srcDir: string,
  destDir: string,
  opts?: { overwrite?: boolean },
) => {
  await ensureDir(destDir);
  for await (const entry of Deno.readDir(srcDir)) {
    const src = `${srcDir}/${entry.name}`;
    const dest = `${destDir}/${entry.name}`;
    if (entry.isDirectory) {
      await copyDir(src, dest, opts);
    } else if (entry.isFile) {
      await ensureDir(destDir);
      await copyFile(src, dest, opts);
    }
  }
};

export const copy = async (
  src: string,
  dest: string,
  opts?: { overwrite?: boolean },
) => {
  const st = await Deno.stat(src);
  if (st.isDirectory) return await copyDir(src, dest, opts);
  await ensureDir(dest.replace(/\/[^/]+$/g, "") || ".");
  return await copyFile(src, dest, opts);
};
