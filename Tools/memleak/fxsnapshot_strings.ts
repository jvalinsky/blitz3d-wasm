type Options = {
  path: string;
  minLen: number;
  top: number;
  match: RegExp | null;
  kind: "utf16le" | "ascii" | "both";
  uniqueOnly: boolean;
};

const parseArgs = (args: string[]): Options => {
  const opts: Options = {
    path: "",
    minLen: 6,
    top: 50,
    match: null,
    kind: "utf16le",
    uniqueOnly: false,
  };

  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") continue;
    if (a === "--min-len") opts.minLen = Number(args[++i] ?? opts.minLen);
    else if (a === "--top") opts.top = Number(args[++i] ?? opts.top);
    else if (a === "--match") {
      const pat = args[++i] ?? "";
      opts.match = pat ? new RegExp(pat, "i") : null;
    } else if (a === "--kind") {
      const k = (args[++i] ?? "").toLowerCase();
      if (k === "utf16le" || k === "ascii" || k === "both") opts.kind = k;
    } else if (a === "--unique-only") opts.uniqueOnly = true;
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Extract readable strings from a Firefox DevTools heap snapshot (.fxsnapshot).",
          "",
          "Usage:",
          "  deno run -A Tools/memleak/fxsnapshot_strings.ts <path> [options]",
          "",
          "Options:",
          "  --min-len <n>        minimum string length (default 6)",
          "  --top <n>            print top N by frequency (default 50)",
          "  --match <regex>      only include strings matching regex (case-insensitive)",
          "  --kind <k>           utf16le | ascii | both (default utf16le)",
          "  --unique-only        only print strings with count==1",
          "",
          "Examples:",
          "  deno run -A Tools/memleak/fxsnapshot_strings.ts /path/to/file.fxsnapshot --kind both --match \"wasm|WebGL|THREE\"",
        ].join("\n"),
      );
      Deno.exit(0);
    } else if (a.startsWith("-")) {
      console.error(`Unknown flag: ${a}`);
      Deno.exit(2);
    } else {
      positional.push(a);
    }
  }

  opts.path = positional[0] ?? "";
  if (!opts.path) {
    console.error("Missing <path> argument. Try --help.");
    Deno.exit(2);
  }
  if (!Number.isFinite(opts.minLen) || opts.minLen < 2) opts.minLen = 2;
  if (!Number.isFinite(opts.top) || opts.top < 1) opts.top = 50;

  return opts;
};

const isPrintableAscii = (b: number) => b >= 32 && b < 127;

const decodeGzipIfNeeded = async (bytes: Uint8Array): Promise<Uint8Array> => {
  // gzip header: 1f 8b
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof (globalThis as any).DecompressionStream !== "function") {
      throw new Error(
        "gzip input detected but DecompressionStream is not available in this runtime.",
      );
    }
    const ds = new DecompressionStream("gzip");
    const stream = new Response(bytes).body!.pipeThrough(ds);
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return out;
  }
  return bytes;
};

const extractUtf16leAsciiRuns = (
  bytes: Uint8Array,
  minLen: number,
  startOffset: 0 | 1,
): string[] => {
  const out: string[] = [];
  const buf: number[] = [];
  for (let i = startOffset; i + 1 < bytes.length; i += 2) {
    const lo = bytes[i];
    const hi = bytes[i + 1];
    if (hi === 0 && isPrintableAscii(lo)) {
      buf.push(lo);
    } else {
      if (buf.length >= minLen) {
        out.push(String.fromCharCode(...buf));
      }
      buf.length = 0;
    }
  }
  if (buf.length >= minLen) out.push(String.fromCharCode(...buf));
  return out;
};

const extractAsciiRuns = (bytes: Uint8Array, minLen: number): string[] => {
  const out: string[] = [];
  const buf: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (isPrintableAscii(b)) {
      buf.push(b);
    } else {
      if (buf.length >= minLen) out.push(String.fromCharCode(...buf));
      buf.length = 0;
    }
  }
  if (buf.length >= minLen) out.push(String.fromCharCode(...buf));
  return out;
};

const main = async () => {
  const opts = parseArgs(Deno.args);

  const raw = await Deno.readFile(opts.path);
  const data = await decodeGzipIfNeeded(raw);

  const strings: string[] = [];
  if (opts.kind === "utf16le" || opts.kind === "both") {
    strings.push(...extractUtf16leAsciiRuns(data, opts.minLen, 0));
    strings.push(...extractUtf16leAsciiRuns(data, opts.minLen, 1));
  }
  if (opts.kind === "ascii" || opts.kind === "both") {
    strings.push(...extractAsciiRuns(data, opts.minLen));
  }

  const filtered = opts.match ? strings.filter((s) => opts.match!.test(s)) : strings;

  const counts = new Map<string, number>();
  for (const s of filtered) counts.set(s, (counts.get(s) ?? 0) + 1);

  const entries = [...counts.entries()]
    .filter(([_, c]) => (opts.uniqueOnly ? c === 1 : true))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  console.log(`file: ${opts.path}`);
  console.log(`bytes: ${raw.length} (raw) -> ${data.length} (decoded)`);
  console.log(`extracted: ${strings.length} strings (${counts.size} unique after filter)`);
  if (opts.match) console.log(`match: ${opts.match}`);
  console.log(`kind: ${opts.kind} minLen: ${opts.minLen} top: ${opts.top}`);

  for (const [s, c] of entries.slice(0, opts.top)) {
    console.log(`${String(c).padStart(6)} ${s}`);
  }
};

await main();
