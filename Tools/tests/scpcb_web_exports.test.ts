/**
 * A-M0 Entrypoint Contract — CI Gate
 *
 * Validates that:
 * 1. The wrapper .bb defines all six Web_* entrypoint functions.
 * 2. When a built scpcb.wasm is available, it exports the required
 *    Web_* entrypoints + __CmdBuf* ABI globals.
 *
 * Part of subplan 05, milestone A-M0.
 * See plan/subplans/05_scpcb_integration.md
 */

import { assert } from "./assert.ts";
import {
  REQUIRED_CMDBUF_EXPORTS,
  REQUIRED_WEB_EXPORTS,
} from "../web_export_contract.ts";

const WRAPPER_BB_PATH = new URL("../scpcb_wrapper.bb", import.meta.url);
const SCPCB_WASM_PATHS = [
  new URL("../../dist/scpcb.wasm", import.meta.url),
  new URL("../../web/public/scpcb.wasm", import.meta.url),
];

Deno.test("A-M0: wrapper .bb defines all Web_* entrypoint functions", async () => {
  let content: string;
  try {
    content = await Deno.readTextFile(WRAPPER_BB_PATH);
  } catch {
    assert(false, `Wrapper .bb not found at ${WRAPPER_BB_PATH.pathname}`);
    return;
  }

  const missing: string[] = [];
  for (const name of REQUIRED_WEB_EXPORTS) {
    // Match "Function Web_InitOnce%" or "Function Web_InitOnce(" etc.
    const re = new RegExp(`^\\s*Function\\s+${name}[%#\\$]?\\s*\\(`, "m");
    if (!re.test(content)) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    assert(
      false,
      `Wrapper .bb missing Web_* function definitions: ${missing.join(", ")}`,
    );
  }

  // Verify the wrapper actually includes SCPCB's Main.bb.
  assert(
    /Include\s+"Main\.bb"/.test(content),
    "Wrapper .bb must Include Main.bb to pull in SCPCB sources",
  );
});

Deno.test("A-M0: REQUIRED_WEB_EXPORTS matches the subplan contract", () => {
  // Ensure the export list hasn't drifted from the documented contract.
  // The contract is frozen as part of decision D2.
  const names = REQUIRED_WEB_EXPORTS as readonly string[];
  assert(names.length === 6, "must define exactly 6 Web_* entries");
  assert(names[0] === "Web_InitOnce", "first entry must be Web_InitOnce");
  assert(names[1] === "Web_Tick", "second entry must be Web_Tick");
  assert(names[2] === "Web_EnterMenu", "third entry must be Web_EnterMenu");
  assert(names[3] === "Web_LeaveMenu", "fourth entry must be Web_LeaveMenu");
  assert(names[4] === "Web_EnterGame", "fifth entry must be Web_EnterGame");
  assert(names[5] === "Web_LeaveGame", "sixth entry must be Web_LeaveGame");
});

Deno.test("A-M0: built scpcb.wasm exports all required names (when available)", async () => {
  // Find a built scpcb.wasm — may be in dist/ or web/public/.
  let wasmPath: string | null = null;
  for (const url of SCPCB_WASM_PATHS) {
    try {
      await Deno.stat(url);
      wasmPath = url.pathname;
      break;
    } catch {
      // continue
    }
  }

  if (!wasmPath) {
    // No built wasm available — skip with a warning, don't fail.
    console.warn(
      "[A-M0 gate] no scpcb.wasm found in dist/ or web/public/ — skipping export validation. " +
        "Run `deno task scpcb:compile:main` to build it (currently blocked by a compiler crash).",
    );
    return;
  }

  const bytes = await Deno.readFile(wasmPath);
  const mod = new WebAssembly.Module(bytes as unknown as BufferSource);
  const exported = new Set(
    WebAssembly.Module.exports(mod).map((e) => e.name),
  );

  const missingWeb: string[] = [];
  for (const name of REQUIRED_WEB_EXPORTS) {
    if (!exported.has(name)) missingWeb.push(name);
  }

  const missingCmdbuf: string[] = [];
  for (const name of REQUIRED_CMDBUF_EXPORTS) {
    if (!exported.has(name)) missingCmdbuf.push(name);
  }

  if (missingWeb.length > 0 || missingCmdbuf.length > 0) {
    const msgs: string[] = [];
    if (missingWeb.length > 0) {
      msgs.push(`missing Web_* exports: ${missingWeb.join(", ")}`);
    }
    if (missingCmdbuf.length > 0) {
      msgs.push(`missing __CmdBuf* exports: ${missingCmdbuf.join(", ")}`);
    }
    assert(false, `${wasmPath}: ${msgs.join("; ")}`);
  }
});
