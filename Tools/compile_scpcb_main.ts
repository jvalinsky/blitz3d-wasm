#!/usr/bin/env -S deno run -A

import { join } from "node:path";
import { checkCmdbufExports } from "./cmdbuf_wasm_check.ts";

type Options = {
  scpcbRoot: string;
  entryBb: string;
  outRuntimeWasm: string;
  outWebPublicWasm: string | null;
  buildCompiler: boolean;
  debug: boolean;
  sourceMap: boolean;
  quiet: boolean;
};

type CliProgressEvent = {
  type: "b3d-progress";
  version: number;
  kind: "start" | "progress" | "end" | "error";
  phase: string;
  current?: number | null;
  total?: number | null;
  message?: string | null;
  file?: string | null;
  tsMs?: number | null;
};

const parseArgs = (args: string[]): Options => {
  const opts: Options = {
    scpcbRoot: new URL("../../scpcb/", import.meta.url).pathname,
    entryBb: "Main.bb",
    // Default to a temp output. The Track B web loader consumes `web/public/scpcb.wasm`
    // (copied to dist during `deno task web:build`), and we avoid writing generated
    // artifacts into source directories.
    outRuntimeWasm: "/tmp/scpcb_cmdbuf.wasm",
    outWebPublicWasm:
      new URL("../web/public/scpcb.wasm", import.meta.url).pathname,
    buildCompiler: true,
    debug: false,
    sourceMap: false,
    quiet: true,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--scpcb-root") opts.scpcbRoot = args[++i] ?? opts.scpcbRoot;
    else if (a === "--entry") opts.entryBb = args[++i] ?? opts.entryBb;
    else if (a === "--out-runtime") {
      opts.outRuntimeWasm = args[++i] ?? opts.outRuntimeWasm;
    } else if (a === "--out-web-public") {
      opts.outWebPublicWasm = args[++i] ?? opts.outWebPublicWasm;
    } else if (a === "--no-web-public") opts.outWebPublicWasm = null;
    else if (a === "--no-build") opts.buildCompiler = false;
    else if (a === "--debug" || a === "-d") opts.debug = true;
    else if (a === "--source-map" || a === "-g") opts.sourceMap = true;
    else if (a === "--verbose") opts.quiet = false;
    else if (a === "--help" || a === "-h") {
      console.log(
        [
          "Compile SCPCB Main.bb to a Track B (--cmdbuf) WASM for the web port.",
          "",
          "Usage:",
          "  deno run -A Tools/compile_scpcb_main.ts [options]",
          "",
          "Options:",
          "  --scpcb-root <dir>        path to SCPCB repo (default: ../../scpcb)",
          "  --entry <file.bb>         entry BB file inside scpcb root (default: Main.bb)",
          "  --out-runtime <path>      write to a .wasm output (default: /tmp/scpcb_cmdbuf.wasm)",
          "  --out-web-public <path>   also write to web/public/scpcb.wasm",
          "  --no-web-public           do not write web/public/scpcb.wasm",
          "  --no-build                skip swift build step",
          "  -d, --debug               emit bbdbg hooks + scpcb.bbdbg.json (enables inspector helpers)",
          "  -g, --source-map          emit scpcb.wasm.map (useful for wasm-validate digests)",
          "  --verbose                 show compiler output (no --quiet/-q)",
        ].join("\n"),
      );
      Deno.exit(0);
    }
  }
  return opts;
};

const enc = new TextEncoder();
const dec = new TextDecoder();

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

type WasmExport = { name: string; kind: number; index: number };

const readU32 = (bytes: Uint8Array, offset: number) => {
  let result = 0;
  let shift = 0;
  let pos = offset;
  while (true) {
    const byte = bytes[pos++]!;
    result |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value: result >>> 0, next: pos };
};

const writeU32 = (value: number) => {
  const out: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return new Uint8Array(out);
};

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
};

const parseExportSection = (bytes: Uint8Array) => {
  let offset = 8; // magic + version
  while (offset < bytes.length) {
    const id = bytes[offset++]!;
    const sizeInfo = readU32(bytes, offset);
    const size = sizeInfo.value;
    const payloadStart = sizeInfo.next;
    const payloadEnd = payloadStart + size;
    if (id === 7) {
      const countInfo = readU32(bytes, payloadStart);
      let pos = countInfo.next;
      const exports: WasmExport[] = [];
      for (let i = 0; i < countInfo.value; i++) {
        const nameLenInfo = readU32(bytes, pos);
        const nameLen = nameLenInfo.value;
        pos = nameLenInfo.next;
        const name = dec.decode(bytes.subarray(pos, pos + nameLen));
        pos += nameLen;
        const kind = bytes[pos++]!;
        const idxInfo = readU32(bytes, pos);
        pos = idxInfo.next;
        exports.push({ name, kind, index: idxInfo.value });
      }
      return { sectionStart: offset - 1, sectionEnd: payloadEnd, exports };
    }
    offset = payloadEnd;
  }
  return null;
};

const encodeExportSection = (exports: WasmExport[]) => {
  const parts: Uint8Array[] = [writeU32(exports.length)];
  for (const exp of exports) {
    const nameBytes = enc.encode(exp.name);
    parts.push(writeU32(nameBytes.length));
    parts.push(nameBytes);
    parts.push(Uint8Array.of(exp.kind));
    parts.push(writeU32(exp.index));
  }
  const payload = concatBytes(parts);
  const size = writeU32(payload.length);
  return concatBytes([Uint8Array.of(7), size, payload]);
};

const addExportAliases = (
  bytes: Uint8Array,
  aliases: Array<{ name: string; target: string }>,
) => {
  const parsed = parseExportSection(bytes);
  if (!parsed) {
    return { bytes, added: 0, skipped: aliases.map((a) => a.name), missing: [] as string[] };
  }
  const { sectionStart, sectionEnd } = parsed;
  const exports = [...parsed.exports];
  const byName = new Map(exports.map((e) => [e.name, e]));
  const missing: string[] = [];
  let added = 0;

  for (const alias of aliases) {
    if (byName.has(alias.name)) continue;
    const target = byName.get(alias.target);
    if (!target) {
      missing.push(alias.target);
      continue;
    }
    exports.push({ name: alias.name, kind: target.kind, index: target.index });
    byName.set(alias.name, exports[exports.length - 1]!);
    added++;
  }

  if (!added) return { bytes, added: 0, skipped: [], missing };

  const newSection = encodeExportSection(exports);
  const out = concatBytes([
    bytes.subarray(0, sectionStart),
    newSection,
    bytes.subarray(sectionEnd),
  ]);
  return { bytes: out, added, skipped: [], missing };
};

const fmtBar = (ratio: number, width: number) => {
  const r = clamp01(ratio);
  const filled = Math.round(r * width);
  return `${"▰".repeat(filled)}${"▱".repeat(Math.max(0, width - filled))}`;
};

const run = async (cmd: string[], cwd: string | undefined, label: string) => {
  const toolHome = Deno.env.get("SCPCB_SMOKE_HOME") ?? "/tmp/blitz3d-wasm-home";
  const clangCache = Deno.env.get("SCPCB_SMOKE_CLANG_MODULE_CACHE_PATH") ??
    `${toolHome.replace(/\/+$/g, "")}/clang-module-cache`;
  try {
    await Deno.mkdir(clangCache, { recursive: true });
  } catch {}

  const env: Record<string, string> = {
    ...(Deno.env.toObject?.() ?? {}),
    HOME: toolHome,
    CLANG_MODULE_CACHE_PATH: clangCache,
  };

  const isTTY = (() => {
    try {
      return Deno.stderr.isTerminal();
    } catch {
      return false;
    }
  })();
  const frames = ["|", "/", "-", "\\"] as const;
  let frame = 0;
  const t0 = Date.now();
  let timer: number | null = null;
  if (isTTY) {
    timer = setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      const msg = `\r${frames[frame++ % frames.length]} ${label} (${s}s)`;
      try {
        Deno.stderr.writeSync(enc.encode(msg));
      } catch {}
    }, 120) as unknown as number;
  } else {
    timer = setInterval(() => {
      try {
        console.error(`[progress] ${label}...`);
      } catch {}
    }, 5000) as unknown as number;
  }

  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    cwd,
    env,
    stdout: "inherit",
    stderr: "inherit",
  }).spawn();
  const { code } = await p.status;

  if (timer !== null) clearInterval(timer);
  const s = Math.floor((Date.now() - t0) / 1000);
  if (isTTY) {
    try {
      Deno.stderr.writeSync(enc.encode(`\r✔ ${label} (${s}s)\n`));
    } catch {}
  } else {
    try {
      console.error(`[done] ${label} (${s}s)`);
    } catch {}
  }

  if (code !== 0) throw new Error(`command failed (${code}): ${cmd.join(" ")}`);
};

const runCompilerWithProgress = async (
  cmd: string[],
  cwd: string | undefined,
  opts: { quiet: boolean },
) => {
  const toolHome = Deno.env.get("SCPCB_SMOKE_HOME") ?? "/tmp/blitz3d-wasm-home";
  const clangCache = Deno.env.get("SCPCB_SMOKE_CLANG_MODULE_CACHE_PATH") ??
    `${toolHome.replace(/\/+$/g, "")}/clang-module-cache`;
  try {
    await Deno.mkdir(clangCache, { recursive: true });
  } catch {}

  const env: Record<string, string> = {
    ...(Deno.env.toObject?.() ?? {}),
    HOME: toolHome,
    CLANG_MODULE_CACHE_PATH: clangCache,
  };

  const isTTY = (() => {
    try {
      return Deno.stderr.isTerminal();
    } catch {
      return false;
    }
  })();

  const t0 = Date.now();
  const phaseOrder = [
    "include-scan",
    "preprocess",
    "parse",
    "codegen",
    "encode",
    "write",
  ] as const;
  const phaseIndex = new Map<string, number>(phaseOrder.map((p, i) => [p, i]));
  const completed = new Set<string>();
  let activePhase: string | null = null;
  let activeMsg = "";
  let activeFile = "";
  let activeFraction = 0;

  const render = () => {
    if (!isTTY) return;
    const totalPhases = phaseOrder.length;
    const doneCount = completed.size;
    const idx = activePhase
      ? (phaseIndex.get(activePhase) ?? doneCount)
      : doneCount;
    const within = activePhase ? activeFraction : 0;
    const overall = clamp01((idx + within) / totalPhases);
    const s = Math.floor((Date.now() - t0) / 1000);
    const phaseLabel = activePhase ??
      (doneCount >= totalPhases ? "done" : "idle");
    const pct = String(Math.round(overall * 100)).padStart(3, " ");
    const bar = fmtBar(overall, 18);
    const left = `${phaseLabel.padEnd(12, " ")} ${bar} ${pct}%`;
    const detail = `${activeMsg}${activeFile ? ` (${activeFile})` : ""}`.trim();
    const msg = `${left}  ${detail}  ${s}s`;
    try {
      Deno.stderr.writeSync(
        enc.encode(`\r${msg.slice(0, 180).padEnd(180, " ")}`),
      );
    } catch {}
  };

  const finishLine = (ok: boolean) => {
    if (!isTTY) return;
    const s = Math.floor((Date.now() - t0) / 1000);
    const msg = `${ok ? "✔" : "✖"} compile scpcb/Main.bb (${s}s)`;
    try {
      Deno.stderr.writeSync(enc.encode(`\r${msg.padEnd(180, " ")}\n`));
    } catch {}
  };

  const p = new Deno.Command(cmd[0]!, {
    args: cmd.slice(1),
    cwd,
    env,
    // Always pipe so we can safely read without triggering Deno's "not piped" getter error.
    // If `quiet`, we just don't forward lines.
    stdout: "piped",
    stderr: "piped",
  }).spawn();

  // Keep the display "alive" even if a phase doesn't emit intermediate progress events.
  // (e.g. preprocess/codegen can be long and only bracketed by start/end events.)
  const aliveTimer = isTTY
    ? (setInterval(() => {
      render();
    }, 200) as unknown as number)
    : null;

  const pump = async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onLine: (line: string) => void,
  ) => {
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      while (true) {
        const idx = buf.indexOf("\n");
        if (idx < 0) break;
        const line = buf.slice(0, idx).replace(/\r$/, "");
        buf = buf.slice(idx + 1);
        onLine(line);
      }
    }
    const rest = buf.trimEnd();
    if (rest) onLine(rest);
  };

  const handleProgressLine = (line: string) => {
    if (!line.startsWith("{") || !line.includes('"b3d-progress"')) {
      if (!opts.quiet && line.trim()) console.error(line);
      return;
    }
    let ev: CliProgressEvent | null = null;
    try {
      ev = JSON.parse(line) as CliProgressEvent;
    } catch {
      if (!opts.quiet && line.trim()) console.error(line);
      return;
    }
    if (!ev || ev.type !== "b3d-progress" || ev.version !== 1) return;

    if (ev.kind === "start") {
      activePhase = ev.phase;
      activeFraction = 0;
      activeMsg = ev.message ? String(ev.message) : "";
      activeFile = ev.file ? String(ev.file).split("/").pop() ?? "" : "";
    } else if (ev.kind === "progress") {
      activePhase = ev.phase ?? activePhase;
      activeMsg = ev.message ? String(ev.message) : activeMsg;
      activeFile = ev.file
        ? String(ev.file).split("/").pop() ?? ""
        : activeFile;
      const cur = typeof ev.current === "number" ? ev.current : null;
      const tot = typeof ev.total === "number" ? ev.total : null;
      if (cur !== null && tot !== null && tot > 0) {
        activeFraction = clamp01(cur / tot);
      }
    } else if (ev.kind === "end") {
      completed.add(ev.phase);
      activePhase = null;
      activeFraction = 0;
      activeMsg = "";
      activeFile = "";
    } else if (ev.kind === "error") {
      activeMsg = ev.message ? String(ev.message) : "error";
    }
    render();
  };

  const stderrReader = p.stderr.getReader();
  const stdoutReader = p.stdout.getReader();

  const tasks: Promise<void>[] = [];
  tasks.push(pump(stderrReader, handleProgressLine));
  tasks.push(
    pump(stdoutReader, (line) => {
      if (!opts.quiet && line.trim()) console.log(line);
    }),
  );

  const status = await p.status;
  await Promise.all(tasks);
  if (aliveTimer !== null) clearInterval(aliveTimer);
  render();
  finishLine(status.success);
  if (!status.success) {
    throw new Error(`command failed (${status.code}): ${cmd.join(" ")}`);
  }
};

const main = async () => {
  const opts = parseArgs(Deno.args);
  const repoRoot = new URL("../", import.meta.url).pathname;
  const compilerBin =
    new URL("../.build/debug/blitz3d-wasm", import.meta.url).pathname;

  const scpcbRoot = opts.scpcbRoot.replace(/\/+$/g, "");
  const entryBb = join(scpcbRoot, opts.entryBb);
  try {
    await Deno.stat(entryBb);
  } catch {
    throw new Error(
      `Entry BB not found at ${entryBb} (set --scpcb-root/--entry)`,
    );
  }

  // If the user compiles something other than Main.bb, avoid overwriting the
  // web loader's `web/public/scpcb.wasm` unless they explicitly asked for it.
  if (
    opts.entryBb.toLowerCase() != "main.bb" &&
    Deno.args.every((a) => a !== "--out-web-public") &&
    Deno.args.every((a) => a !== "--no-web-public")
  ) {
    opts.outWebPublicWasm = null;
  }

  if (opts.buildCompiler) {
    const cmd = ["swift", "build", "--disable-sandbox"];
    if (opts.quiet) cmd.push("-q");
    await run(cmd, repoRoot, "swift build");
  }

  // Compile with Track B CMDB ABI enabled.
  {
    const cmd = [
      compilerBin,
      entryBb,
      "-o",
      opts.outRuntimeWasm,
      "--cmdbuf",
      "--jobs",
      "0",
      "--progress",
      "ndjson",
    ];
    if (opts.debug) cmd.push("--debug");
    if (opts.sourceMap) cmd.push("--source-map");
    if (opts.quiet) cmd.push("--quiet");
    await runCompilerWithProgress(cmd, repoRoot, { quiet: opts.quiet });
  }

  // Validate module parses and has required CMDB exports.
  let bytes = await Deno.readFile(opts.outRuntimeWasm);
  const r = checkCmdbufExports(bytes);
  if (r.missing.length) {
    throw new Error(
      `compiled wasm missing CMDB exports: ${r.missing.join(", ")}`,
    );
  }

  // Add web-port export aliases when SCPCB lacks safe entrypoints.
  const aliasResult = addExportAliases(bytes, [
    { name: "__WebUpdate", target: "UpdateMainMenu" },
    { name: "UpdateGame", target: "UpdateMainMenu" },
    { name: "__WebInit", target: "UpdateMainMenu" },
    { name: "InitOnce", target: "UpdateMainMenu" },
  ]);
  if (aliasResult.missing.length) {
    console.warn(
      `[scpcb] missing alias targets: ${[...new Set(aliasResult.missing)].join(", ")}`,
    );
  }
  if (aliasResult.added > 0) {
    bytes = aliasResult.bytes;
    await Deno.writeFile(opts.outRuntimeWasm, bytes);
    console.log(`[scpcb] added ${aliasResult.added} export alias(es)`);
  }

  if (opts.outWebPublicWasm) {
    await Deno.copyFile(opts.outRuntimeWasm, opts.outWebPublicWasm);
    if (opts.debug) {
      const srcBbdbg = opts.outRuntimeWasm.replace(/\.wasm$/i, ".bbdbg.json");
      const dstBbdbg = opts.outWebPublicWasm.replace(/\.wasm$/i, ".bbdbg.json");
      try {
        await Deno.copyFile(srcBbdbg, dstBbdbg);
      } catch {
        // Best-effort: debug build should emit this, but don't fail the compile tool if it doesn't exist.
      }
    }
    if (opts.sourceMap) {
      const srcMap = `${opts.outRuntimeWasm}.map`;
      const dstMap = `${opts.outWebPublicWasm}.map`;
      try {
        await Deno.copyFile(srcMap, dstMap);
      } catch {
        // Best-effort: source maps are optional.
      }
    }
  }

  console.log(`[scpcb] wrote ${opts.outRuntimeWasm}`);
  if (opts.outWebPublicWasm) {
    console.log(`[scpcb] wrote ${opts.outWebPublicWasm}`);
  }
  if (opts.outWebPublicWasm && opts.debug) {
    console.log(
      `[scpcb] wrote ${
        opts.outWebPublicWasm.replace(/\\.wasm$/i, ".bbdbg.json")
      }`,
    );
  }
  if (opts.outWebPublicWasm && opts.sourceMap) {
    console.log(`[scpcb] wrote ${opts.outWebPublicWasm}.map`);
  }
};

if (import.meta.main) {
  await main();
}
