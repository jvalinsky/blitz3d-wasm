/// <reference lib="deno.ns" />

import {
  highlightBlitzBasicLine,
  highlightBlitzBasicToHtml,
} from "./interpreter_syntax.ts";
import {
  formatHexDump,
  isAllZero,
  parseByteOffset,
} from "./interpreter_memory.ts";

function assert(cond: unknown, msg = "assertion failed"): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertEquals<T>(actual: T, expected: T, msg?: string) {
  if (Object.is(actual, expected)) return;
  throw new Error(
    msg ??
      `assertEquals failed\nactual: ${String(actual)}\nexpected: ${
        String(expected)
      }`,
  );
}

Deno.test("Interpreter syntax highlighting - basic tokens", () => {
  const html = highlightBlitzBasicLine('Print "Hello" ; comment');
  assert(
    html.includes('class="tok builtin"'),
    "should classify Print as builtin",
  );
  assert(
    html.includes('class="tok string">&quot;Hello&quot;'),
    "should highlight string literal",
  );
  assert(
    html.includes('class="tok comment">; comment'),
    "should highlight line comment",
  );
});

Deno.test("Interpreter syntax highlighting - REM block handling + lineCount", () => {
  const src = ["Rem", "x=1", "End Rem", "Print 1"].join("\n");
  const { html, lineCount } = highlightBlitzBasicToHtml(src);
  assertEquals(lineCount, 4);

  const lines = html.split("\n");
  assertEquals(lines.length, 4);
  assert(lines[0]!.includes('class="tok comment"'), "rem should be comment");
  assert(
    lines[1]!.includes('class="tok comment"'),
    "rem body should be comment",
  );
  assert(
    lines[2]!.includes('class="tok comment"'),
    "end rem should be comment",
  );
  assert(
    lines[3]!.includes('class="tok builtin"'),
    "Print should be highlighted",
  );
  assert(
    lines[3]!.includes('class="tok number"'),
    "number literal should be highlighted",
  );
});

Deno.test("Interpreter memory helpers - parseByteOffset", () => {
  assertEquals(parseByteOffset("0x10"), 16);
  assertEquals(parseByteOffset("$ff"), 255);
  assertEquals(parseByteOffset("256"), 256);
  assertEquals(parseByteOffset(""), 0);
  assertEquals(parseByteOffset("nope"), 0);
});

Deno.test("Interpreter memory helpers - isAllZero", () => {
  assertEquals(isAllZero(new Uint8Array([])), true);
  assertEquals(isAllZero(new Uint8Array([0, 0, 0])), true);
  assertEquals(isAllZero(new Uint8Array([0, 1, 0])), false);
});

Deno.test("Interpreter memory helpers - formatHexDump includes base offset + ascii", () => {
  const bytes = new Uint8Array([0x41, 0x00, 0x7f]);
  const dump = formatHexDump(bytes, 0x10);
  assert(dump.includes("00000010:"), "should include base offset");
  assert(dump.includes("41 00 7f"), "should include hex bytes");
  assert(dump.includes("|A..|"), "should include ascii view");
});

Deno.test("Interpreter demos - debug examples avoid non-suffixed string vars", async () => {
  const text = await Deno.readTextFile(
    new URL("./interpreter.ts", import.meta.url),
  );

  const extract = (key: string): string => {
    const re = new RegExp(key + ":\\s*`([\\s\\S]*?)`,", "m");
    const m = text.match(re);
    if (!m || !m[1]) throw new Error(`failed to extract example: ${key}`);
    return m[1];
  };

  const callStack = extract("debugCallStack");
  assert(callStack.includes('s$ = s$ + " sum="'));
  assert(callStack.includes("Return s$"));
  assert(
    !/(^|\n)\s*s\s*=\s*s\s*\+/m.test(callStack),
    "debugCallStack should not assign to non-suffixed 's'",
  );

  const mem = extract("memoryArray");
  assert(mem.includes("Dim a%(2048)"));
  assert(mem.includes("Local idx%"));
  assert(mem.includes("s$ = s$ + Chr"));
  assert(
    !/(^|\n)\s*s\s*=\s*s\s*\+/m.test(mem),
    "memoryArray should not assign to non-suffixed 's'",
  );
});
