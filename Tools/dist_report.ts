#!/usr/bin/env -S deno run -A
import { walkFiles } from "./fs.ts";

type Entry = { rel: string; size: number };

const usage = () => {
  throw new Error("usage: Tools/dist_report.ts <rootDir> [--top N]");
};

if (import.meta.main) {
  const rootDir = Deno.args[0];
  if (!rootDir) usage();
  const topIdx = Deno.args.findIndex((a) => a === "--top");
  const topN = topIdx >= 0 ? Number(Deno.args[topIdx + 1] ?? "20") : 20;
  if (!Number.isFinite(topN) || topN <= 0) throw new Error("bad --top");

  const root = rootDir.replace(/\/+$/g, "");
  const list: Entry[] = [];
  let total = 0;

  for await (const e of walkFiles(root)) {
    const st = await Deno.stat(e.path);
    if (!st.isFile) continue;
    const rel = e.path.slice(root.length + 1).replace(/\\/g, "/");
    total += st.size;
    list.push({ rel, size: st.size });
  }

  list.sort((a, b) => b.size - a.size);

  const fmt = (n: number) => {
    const kb = n / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MiB`;
    if (kb >= 1) return `${kb.toFixed(1)} KiB`;
    return `${n} B`;
  };

  console.log(`[dist] root=${root}`);
  console.log(`[dist] files=${list.length}`);
  console.log(`[dist] total=${fmt(total)}`);
  console.log(`[dist] top=${topN}`);
  for (const e of list.slice(0, topN)) {
    console.log(`${fmt(e.size).padStart(10)}  ${e.rel}`);
  }
}

