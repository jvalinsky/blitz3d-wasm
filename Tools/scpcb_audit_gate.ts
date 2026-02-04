#!/usr/bin/env -S deno run -A
/**
 * SCPCB audit gate
 *
 * Fails if new `.b3d/.x/.rmesh` string literals are introduced in SCPCB `.bb`
 * sources compared to a checked-in baseline audit JSON.
 *
 * This is intended for CI environments where the SCPCB repo exists adjacent to
 * this repo (default: `../../scpcb` relative to this script).
 */

import { scanScpcb } from "./scpcb_audit.ts";

type GateOptions = {
  root: string;
  baselinePath: string;
  requireRoot: boolean;
  allowDynamic: boolean;
};

const usage = () => {
  console.error(
    [
      "usage: Tools/scpcb_audit_gate.ts [--root <scpcbDir>] [--baseline <audit.json>]",
      "                               [--require-root] [--allow-dynamic]",
      "",
      "Defaults:",
      "  --root     ../../scpcb",
      "  --baseline docs/scpcb/scpcb_audit_baseline.json",
      "",
      "Exit codes:",
      "  0  pass (or skipped when SCPCB root missing and --require-root not set)",
      "  1  gate failed (new literals and/or dynamic callsites)",
      "  2  usage/missing baseline or missing root with --require-root",
    ].join("\n"),
  );
};

const parseArgs = (): GateOptions => {
  const opts: GateOptions = {
    root: new URL("../../scpcb/", import.meta.url).pathname,
    baselinePath: new URL("../docs/scpcb/scpcb_audit_baseline.json", import.meta.url).pathname,
    requireRoot: false,
    allowDynamic: false,
  };

  for (let i = 0; i < Deno.args.length; i++) {
    const a = Deno.args[i]!;
    if (a === "--root") opts.root = Deno.args[++i] ?? opts.root;
    else if (a === "--baseline") opts.baselinePath = Deno.args[++i] ?? opts.baselinePath;
    else if (a === "--require-root") opts.requireRoot = true;
    else if (a === "--allow-dynamic") opts.allowDynamic = true;
    else if (a === "-h" || a === "--help") {
      usage();
      Deno.exit(0);
    } else {
      console.error(`unknown arg: ${a}`);
      usage();
      Deno.exit(2);
    }
  }
  return opts;
};

const normalizePath = (p: string) => p.replaceAll("\\", "/");

const uniqSorted = (xs: string[]) => [...new Set(xs.map(normalizePath))].sort();

const tryReadJson = async (path: string) => {
  const txt = await Deno.readTextFile(path);
  return JSON.parse(txt) as any;
};

const statDir = async (p: string) => {
  try {
    const st = await Deno.stat(p);
    return st.isDirectory;
  } catch {
    return false;
  }
};

const main = async () => {
  const opts = parseArgs();

  const root = opts.root.replace(/\/+$/g, "");
  const baselinePath = opts.baselinePath;

  const hasRoot = await statDir(root);
  if (!hasRoot) {
    const msg = `[scpcb-audit] SCPCB root not found at ${root}`;
    if (opts.requireRoot) {
      console.error(`${msg} (--require-root set)`);
      Deno.exit(2);
    }
    console.warn(`${msg} (skipping; pass)`);
    return;
  }

  let baseline: any;
  try {
    baseline = await tryReadJson(baselinePath);
  } catch (e) {
    console.error(`[scpcb-audit] failed to read baseline: ${baselinePath}`);
    console.error(String((e as any)?.message ?? e));
    console.error(
      "Generate one with: `deno run -A Tools/scpcb_audit.ts --root <scpcbDir> --json > docs/scpcb/scpcb_audit_baseline.json`",
    );
    Deno.exit(2);
  }

  const baselineAssets = Array.isArray(baseline?.assets) ? baseline.assets : [];
  const baselineDynamics = Array.isArray(baseline?.dynamicCalls) ? baseline.dynamicCalls : [];

  const baselineUniq = uniqSorted(
    baselineAssets.map((h: any) => String(h?.asset ?? "")).filter(Boolean),
  );

  const cur = await scanScpcb(root);
  const curUniq = uniqSorted(cur.assets.map((h) => h.asset));

  const baselineSet = new Set(baselineUniq.map((s) => s.toLowerCase()));
  const newLiterals = curUniq.filter((s) => !baselineSet.has(s.toLowerCase()));

  const dynamicCount = cur.dynamicCalls.length;
  const baselineDynamicCount = baselineDynamics.length;
  const hasDynamic = dynamicCount > 0;

  if (!newLiterals.length && (!hasDynamic || opts.allowDynamic)) {
    console.log(
      `[scpcb-audit] ok: literals=${curUniq.length} dynamic=${dynamicCount}` +
        (opts.allowDynamic ? " (allow-dynamic)" : ""),
    );
    return;
  }

  console.error(
    `[scpcb-audit] FAIL: newLiterals=${newLiterals.length} dynamic=${dynamicCount} (baseline dynamic=${baselineDynamicCount})`,
  );

  if (newLiterals.length) {
    console.error("\nNew source-model literals (first 50):");
    for (const s of newLiterals.slice(0, 50)) console.error(`- ${s}`);
    if (newLiterals.length > 50) console.error(`- … ${newLiterals.length - 50} more`);
  }

  if (hasDynamic && !opts.allowDynamic) {
    console.error("\nDynamic LoadMesh/LoadAnimMesh callsites (first 30):");
    for (const h of cur.dynamicCalls.slice(0, 30)) {
      console.error(`- ${h.file}:${h.line} ${h.fn}(${h.arg})`);
    }
    if (cur.dynamicCalls.length > 30) console.error(`- … ${cur.dynamicCalls.length - 30} more`);
  }

  Deno.exit(1);
};

if (import.meta.main) await main();
