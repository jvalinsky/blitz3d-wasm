type Finding = {
  file: string;
  line: number;
  kind: string;
  text: string;
};

const patterns: { kind: string; re: RegExp }[] = [
  {
    kind: "raf-no-handle",
    re: /\brequestAnimationFrame\s*\(\s*\(/,
  },
  {
    kind: "interval",
    re: /\bsetInterval\s*\(/,
  },
  {
    kind: "timeout",
    re: /\bsetTimeout\s*\(/,
  },
  {
    kind: "anon-listener",
    re: /\baddEventListener\s*\(\s*[^,]+,\s*\(/,
  },
  {
    kind: "three-dispose-call",
    re: /\.\s*dispose\s*\(/,
  },
  {
    kind: "three-clone",
    re: /\.clone\s*\(/,
  },
];

const defaultRoots = ["web/src/runtime", "Sources/Runtime/thin"];

const parseArgs = (args: string[]) => {
  const roots: string[] = [];
  let failOn = false;
  let maxFindings = 200;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--root") roots.push(args[++i]);
    else if (a === "--fail") failOn = true;
    else if (a === "--max") maxFindings = Number(args[++i] ?? "200");
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Static scan for common leak patterns (best-effort heuristics).",
          "",
          "Usage:",
          "  deno run -A Tools/memleak/scan.ts [--root <path> ...] [--fail] [--max <n>]",
        ].join("\n"),
      );
      Deno.exit(0);
    }
  }

  return {
    roots: roots.length ? roots : defaultRoots,
    failOn,
    maxFindings: Number.isFinite(maxFindings) ? maxFindings : 200,
  };
};

const isTextFile = (path: string) => {
  return path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".html");
};

const main = async () => {
  const { roots, failOn, maxFindings } = parseArgs(Deno.args);
  const findings: Finding[] = [];

  for (const root of roots) {
    for await (const entry of Deno.readDir(root)) {
      // shallow walk for speed; add subdirs explicitly via --root if needed
      const full = `${root}/${entry.name}`.replace(/\/+/g, "/");
      if (entry.isDirectory) continue;
      if (!isTextFile(full)) continue;

      const text = await Deno.readTextFile(full);
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i];
        for (const { kind, re } of patterns) {
          if (re.test(lineText)) {
            findings.push({
              file: full,
              line: i + 1,
              kind,
              text: lineText.trim(),
            });
            if (findings.length >= maxFindings) break;
          }
        }
        if (findings.length >= maxFindings) break;
      }
      if (findings.length >= maxFindings) break;
    }
  }

  const byKind = new Map<string, number>();
  for (const f of findings) byKind.set(f.kind, (byKind.get(f.kind) ?? 0) + 1);

  console.log("memleak:scan roots:", roots.join(", "));
  for (
    const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])
  ) {
    console.log(`- ${kind}: ${count}`);
  }

  if (findings.length) {
    console.log("\nSample findings:");
    for (const f of findings.slice(0, 25)) {
      console.log(`- ${f.kind} ${f.file}:${f.line}: ${f.text}`);
    }
  }

  if (failOn && findings.length) Deno.exit(1);
};

await main();
